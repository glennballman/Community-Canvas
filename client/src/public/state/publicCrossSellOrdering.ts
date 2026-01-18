/**
 * Cross-Sell Ordering Logic
 * 
 * Provides deterministic ordering of cross-sell candidates based on entry point type,
 * cart contents, and suggested windows.
 */

import { EntryPointType } from "./publicEntryPoint";
import { CarryForwardCandidate } from "./publicCarryForward";
import { PublicCartItem } from "./publicReservationMachine";

const CATEGORY_PRIORITY: Record<EntryPointType, EntryPointType[]> = {
  lodging: ["parking", "marina", "activity", "equipment"],
  parking: ["lodging", "marina", "activity", "equipment"],
  marina: ["lodging", "parking", "equipment", "activity"],
  activity: ["lodging", "parking", "equipment", "marina"],
  equipment: ["lodging", "activity", "parking", "marina"],
};

const SINGLE_INSTANCE: Record<string, boolean> = {
  lodging: true,
  marina: true,
  parking: false,
  activity: false,
  equipment: false,
};

interface OrderingContext {
  primaryType: EntryPointType;
  cartItems: PublicCartItem[];
  cartWindow?: { start: string; end: string };
}

function getCartWindow(items: PublicCartItem[]): { start: string; end: string } | undefined {
  if (items.length === 0) return undefined;
  
  let earliestStart = new Date(items[0].starts_at);
  let latestEnd = new Date(items[0].ends_at);
  
  for (const item of items) {
    const start = new Date(item.starts_at);
    const end = new Date(item.ends_at);
    if (start < earliestStart) earliestStart = start;
    if (end > latestEnd) latestEnd = end;
  }
  
  return {
    start: earliestStart.toISOString().split("T")[0],
    end: latestEnd.toISOString().split("T")[0],
  };
}

function getCartItemTypes(items: PublicCartItem[]): Set<string> {
  const types = new Set<string>();
  for (const item of items) {
    const title = item.title.toLowerCase();
    if (title.includes("slip") || title.includes("marina") || title.includes("dock")) {
      types.add("marina");
    } else if (title.includes("stall") || title.includes("parking") || title.includes("spot")) {
      types.add("parking");
    } else if (title.includes("kayak") || title.includes("rental") || title.includes("gear")) {
      types.add("equipment");
    } else if (title.includes("tour") || title.includes("excursion") || title.includes("activity")) {
      types.add("activity");
    } else {
      types.add("lodging");
    }
  }
  return types;
}

function getCartFacilityIds(items: PublicCartItem[]): Set<string> {
  return new Set(items.map(i => i.inventory_unit_id).filter(Boolean));
}

function windowsMatch(
  candidateWindow: { start: string; end: string } | undefined,
  cartWindow: { start: string; end: string } | undefined
): boolean {
  if (!candidateWindow || !cartWindow) return false;
  return candidateWindow.start === cartWindow.start && candidateWindow.end === cartWindow.end;
}

function getCategoryPriority(type: EntryPointType, primaryType: EntryPointType): number {
  const priorities = CATEGORY_PRIORITY[primaryType] || CATEGORY_PRIORITY.lodging;
  const index = priorities.indexOf(type);
  return index === -1 ? 999 : index;
}

/**
 * Filter candidates to exclude items already in cart or violating single-instance rules
 */
function filterCandidates(
  candidates: CarryForwardCandidate[],
  cartItemTypes: Set<string>,
  cartOfferIds: Set<string>
): CarryForwardCandidate[] {
  return candidates.filter(candidate => {
    const itemType = candidate.itemType || candidate.entryPointType;
    
    if (candidate.offerId && cartOfferIds.has(candidate.offerId)) {
      return false;
    }
    
    if (SINGLE_INSTANCE[itemType] && cartItemTypes.has(itemType)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort candidates deterministically
 */
function sortCandidates(
  candidates: CarryForwardCandidate[],
  context: OrderingContext
): CarryForwardCandidate[] {
  const cartWindow = context.cartWindow;
  const cartFacilityIds = getCartFacilityIds(context.cartItems);
  
  return [...candidates].sort((a, b) => {
    const aType = (a.itemType || a.entryPointType) as EntryPointType;
    const bType = (b.itemType || b.entryPointType) as EntryPointType;
    
    const aPriority = getCategoryPriority(aType, context.primaryType);
    const bPriority = getCategoryPriority(bType, context.primaryType);
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    const aWindowMatch = windowsMatch(a.suggestedWindow, cartWindow) ? 0 : 1;
    const bWindowMatch = windowsMatch(b.suggestedWindow, cartWindow) ? 0 : 1;
    if (aWindowMatch !== bWindowMatch) return aWindowMatch - bWindowMatch;
    
    const aFacilityMatch = a.facilityId && cartFacilityIds.has(a.facilityId) ? 0 : 1;
    const bFacilityMatch = b.facilityId && cartFacilityIds.has(b.facilityId) ? 0 : 1;
    if (aFacilityMatch !== bFacilityMatch) return aFacilityMatch - bFacilityMatch;
    
    const aName = a.displayName || a.hint || "";
    const bName = b.displayName || b.hint || "";
    if (aName !== bName) return aName.localeCompare(bName);
    
    const aTypeStr = aType || "";
    const bTypeStr = bType || "";
    if (aTypeStr !== bTypeStr) return aTypeStr.localeCompare(bTypeStr);
    
    const aId = a.offerId || a.offerSlug || "";
    const bId = b.offerId || b.offerSlug || "";
    return aId.localeCompare(bId);
  });
}

/**
 * Get ordered cross-sell candidates
 */
export function getOrderedCrossSellCandidates(
  candidates: CarryForwardCandidate[],
  cartItems: PublicCartItem[],
  primaryType: EntryPointType,
  maxResults: number = 4
): CarryForwardCandidate[] {
  const cartItemTypes = getCartItemTypes(cartItems);
  const cartOfferIds = new Set(cartItems.map(i => i.id).filter(Boolean));
  
  const context: OrderingContext = {
    primaryType,
    cartItems,
    cartWindow: getCartWindow(cartItems),
  };
  
  const filtered = filterCandidates(candidates, cartItemTypes, cartOfferIds);
  const sorted = sortCandidates(filtered, context);
  
  return sorted.slice(0, maxResults);
}

export { SINGLE_INSTANCE, CATEGORY_PRIORITY };

/**
 * Carry-Forward Candidates for Cross-Sell
 * 
 * Stores suggestions for additional items based on what the user has already added.
 * Uses sessionStorage. No backend involvement.
 */

import { EntryPointType } from "./publicEntryPoint";

export interface CarryForwardCandidate {
  entryPointType: EntryPointType;
  offerId?: string;
  offerSlug?: string;
  hint: string;
}

const STORAGE_KEY_PREFIX = "cc_carry_forward_";

function getStorageKey(portalId: string, offerId: string): string {
  return `${STORAGE_KEY_PREFIX}${portalId}_${offerId}`;
}

/**
 * Store carry-forward candidates in sessionStorage
 */
export function setCarryForwardCandidates(
  portalId: string,
  offerId: string,
  candidates: CarryForwardCandidate[]
): void {
  if (typeof window === "undefined") return;
  
  const key = getStorageKey(portalId, offerId);
  sessionStorage.setItem(key, JSON.stringify(candidates));
}

/**
 * Get carry-forward candidates from sessionStorage
 */
export function getCarryForwardCandidates(
  portalId: string,
  offerId: string
): CarryForwardCandidate[] {
  if (typeof window === "undefined") return [];
  
  const key = getStorageKey(portalId, offerId);
  const stored = sessionStorage.getItem(key);
  
  if (!stored) return [];
  
  try {
    return JSON.parse(stored) as CarryForwardCandidate[];
  } catch {
    return [];
  }
}

/**
 * Clear carry-forward candidates
 */
export function clearCarryForwardCandidates(
  portalId: string,
  offerId: string
): void {
  if (typeof window === "undefined") return;
  
  const key = getStorageKey(portalId, offerId);
  sessionStorage.removeItem(key);
}

/**
 * Generate default carry-forward candidates based on entry point type
 */
export function generateCandidatesForType(
  entryPointType: EntryPointType
): CarryForwardCandidate[] {
  const candidatesByType: Record<EntryPointType, CarryForwardCandidate[]> = {
    lodging: [
      { entryPointType: "parking", hint: "Add parking for your stay" },
      { entryPointType: "activity", hint: "Browse local activities" },
      { entryPointType: "equipment", hint: "Rent equipment" },
    ],
    parking: [
      { entryPointType: "lodging", hint: "Need a place to stay?" },
      { entryPointType: "marina", hint: "Add marina slip" },
      { entryPointType: "activity", hint: "Browse local activities" },
    ],
    marina: [
      { entryPointType: "lodging", hint: "Need a place to stay?" },
      { entryPointType: "parking", hint: "Add vehicle parking" },
    ],
    activity: [
      { entryPointType: "lodging", hint: "Need a place to stay?" },
      { entryPointType: "parking", hint: "Add parking" },
    ],
    equipment: [
      { entryPointType: "activity", hint: "Browse local activities" },
      { entryPointType: "lodging", hint: "Need a place to stay?" },
    ],
  };
  
  return candidatesByType[entryPointType] || [];
}

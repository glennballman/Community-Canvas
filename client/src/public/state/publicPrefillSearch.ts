/**
 * Prefill Search Intent
 * 
 * Stores a prefill intent in sessionStorage to pre-populate the availability search
 * when navigating from CrossSellRail.
 */

const STORAGE_KEY_PREFIX = "cc_prefill_search_";

export interface PrefillSearchIntent {
  itemType: string;
  suggestedWindow?: { start: string; end: string };
  facilityId?: string;
  displayName?: string;
  whyShown?: string;
}

function getStorageKey(portalId: string, cartId: string): string {
  return `${STORAGE_KEY_PREFIX}${portalId}_${cartId}`;
}

/**
 * Set prefill intent in sessionStorage
 */
export function setPrefillIntent(
  portalId: string,
  cartId: string,
  intent: PrefillSearchIntent
): void {
  if (typeof window === "undefined") return;
  
  const key = getStorageKey(portalId, cartId);
  sessionStorage.setItem(key, JSON.stringify(intent));
}

/**
 * Get prefill intent from sessionStorage
 */
export function getPrefillIntent(
  portalId: string,
  cartId: string
): PrefillSearchIntent | null {
  if (typeof window === "undefined") return null;
  
  const key = getStorageKey(portalId, cartId);
  const stored = sessionStorage.getItem(key);
  
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as PrefillSearchIntent;
  } catch {
    return null;
  }
}

/**
 * Clear prefill intent from sessionStorage
 */
export function clearPrefillIntent(portalId: string, cartId: string): void {
  if (typeof window === "undefined") return;
  
  const key = getStorageKey(portalId, cartId);
  sessionStorage.removeItem(key);
}

/**
 * Check if there's a pending prefill intent
 */
export function hasPrefillIntent(portalId: string, cartId: string): boolean {
  return getPrefillIntent(portalId, cartId) !== null;
}

/**
 * Session storage-based token store for public reservation flows.
 * 
 * Manages the reservation token lifecycle:
 * - Stores current token in sessionStorage
 * - Supports overwrite-only semantics (no append)
 * - Token rotation will be enforced in later phases
 */

const TOKEN_KEY = "reservation_token";
const PORTAL_KEY = "reservation_portal";
const OFFER_KEY = "reservation_offer";

export interface ReservationContext {
  token: string | null;
  portalSlug: string | null;
  offerSlug: string | null;
}

/**
 * Get the current reservation token from sessionStorage
 */
export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
};

/**
 * Set (overwrite) the reservation token in sessionStorage
 */
export const setToken = (token: string): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, token);
};

/**
 * Clear the reservation token from sessionStorage
 */
export const clearToken = (): void => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
};

/**
 * Get the current portal slug from sessionStorage
 */
export const getPortalSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PORTAL_KEY);
};

/**
 * Set the portal slug in sessionStorage
 */
export const setPortalSlug = (slug: string): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PORTAL_KEY, slug);
};

/**
 * Get the current offer slug from sessionStorage
 */
export const getOfferSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OFFER_KEY);
};

/**
 * Set the offer slug in sessionStorage
 */
export const setOfferSlug = (slug: string): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OFFER_KEY, slug);
};

/**
 * Get the full reservation context from sessionStorage
 */
export const getReservationContext = (): ReservationContext => {
  return {
    token: getToken(),
    portalSlug: getPortalSlug(),
    offerSlug: getOfferSlug(),
  };
};

/**
 * Set the full reservation context in sessionStorage
 */
export const setReservationContext = (
  token: string,
  portalSlug: string,
  offerSlug: string
): void => {
  setToken(token);
  setPortalSlug(portalSlug);
  setOfferSlug(offerSlug);
};

/**
 * Clear all reservation context from sessionStorage
 */
export const clearReservationContext = (): void => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PORTAL_KEY);
  sessionStorage.removeItem(OFFER_KEY);
};

/**
 * Check if there's an active reservation in progress
 */
export const hasActiveReservation = (): boolean => {
  return getToken() !== null;
};

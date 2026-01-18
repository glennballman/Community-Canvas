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

// Additional keys for cart-based auth
const PORTAL_ID_KEY = "reservation_portal_id";
const CART_ID_KEY = "reservation_cart_id";
const ACCESS_TOKEN_KEY = "reservation_access_token";

export interface PublicAuth {
  portalId: string;
  cartId: string;
  accessToken: string;
}

/**
 * Get the portal ID from sessionStorage
 */
export const getPortalId = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PORTAL_ID_KEY);
};

/**
 * Set the portal ID in sessionStorage
 */
export const setPortalId = (id: string): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PORTAL_ID_KEY, id);
};

/**
 * Get the cart ID from sessionStorage
 */
export const getCartId = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CART_ID_KEY);
};

/**
 * Set the cart ID in sessionStorage
 */
export const setCartId = (id: string): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CART_ID_KEY, id);
};

/**
 * Get the access token from sessionStorage
 */
export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Set the access token in sessionStorage
 */
export const setAccessToken = (token: string): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
};

/**
 * Try to extract auth from the stored token (if base64/JSON encoded).
 * If token is opaque, returns null - caller should use URL params.
 */
export const getAuthFromToken = (): PublicAuth | null => {
  const token = getToken();
  if (!token) return null;

  // Try to decode as base64 JSON
  try {
    const decoded = atob(token);
    const parsed = JSON.parse(decoded);
    if (parsed.portalId && parsed.cartId && parsed.accessToken) {
      return {
        portalId: parsed.portalId,
        cartId: parsed.cartId,
        accessToken: parsed.accessToken,
      };
    }
  } catch {
    // Token is opaque, not base64 JSON
  }

  // Fallback: check if we have individual values stored
  const portalId = getPortalId();
  const cartId = getCartId();
  const accessToken = getAccessToken();

  if (portalId && cartId && accessToken) {
    return { portalId, cartId, accessToken };
  }

  return null;
};

/**
 * Set full auth context (portalId, cartId, accessToken) in sessionStorage
 */
export const setAuthContext = (auth: PublicAuth): void => {
  setPortalId(auth.portalId);
  setCartId(auth.cartId);
  setAccessToken(auth.accessToken);
};

/**
 * Clear all auth context from sessionStorage
 */
export const clearAuthContext = (): void => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PORTAL_ID_KEY);
  sessionStorage.removeItem(CART_ID_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
};

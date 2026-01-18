/**
 * Public Reservation State Machine
 * 
 * Defines cart status types and lock/mutation helpers for the public reservation flow.
 */

export type PublicCartStatus = 
  | "active" 
  | "submitted" 
  | "completed" 
  | "expired" 
  | "unknown";

export interface PublicCartData {
  id: string;
  status: string;
  expires_at?: string | null;
  portal_id?: string;
  offer_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PublicCartItem {
  id: string;
  cart_id: string;
  inventory_unit_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
}

/**
 * Derive the cart status from cart data
 */
export function deriveCartStatus(cart: PublicCartData | null | undefined): PublicCartStatus {
  if (!cart) return "unknown";
  
  // Check for terminal states first
  if (cart.status === "completed") return "completed";
  if (cart.status === "submitted") return "submitted";
  
  // Check expiration
  if (cart.expires_at) {
    const expiresAt = new Date(cart.expires_at).getTime();
    if (expiresAt < Date.now()) return "expired";
  }
  
  // Active cart
  if (cart.status === "active") return "active";
  
  return "unknown";
}

/**
 * Check if the cart is locked (no mutations allowed)
 */
export function isLocked(status: PublicCartStatus): boolean {
  return status === "submitted" || status === "completed" || status === "expired";
}

/**
 * Check if the cart is expired
 */
export function isExpired(status: PublicCartStatus): boolean {
  return status === "expired";
}

/**
 * Check if the cart can accept new items
 */
export function canAddItems(status: PublicCartStatus): boolean {
  return status === "active";
}

/**
 * Check if the cart can be submitted
 */
export function canSubmit(status: PublicCartStatus): boolean {
  return status === "active";
}

/**
 * Get remaining time until expiration in seconds
 */
export function getExpirationSeconds(cart: PublicCartData | null | undefined): number | null {
  if (!cart?.expires_at) return null;
  
  const expiresAt = new Date(cart.expires_at).getTime();
  const now = Date.now();
  const remaining = Math.floor((expiresAt - now) / 1000);
  
  return remaining > 0 ? remaining : 0;
}

/**
 * Format expiration time for display
 */
export function formatExpirationTime(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds <= 0) return "Expired";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  
  return `${remainingSeconds}s`;
}

/**
 * Reservation flow steps
 */
export type ReservationStep = "search" | "details" | "review" | "confirm";

export const RESERVATION_STEPS: ReservationStep[] = ["search", "details", "review", "confirm"];

/**
 * Get step index
 */
export function getStepIndex(step: ReservationStep): number {
  return RESERVATION_STEPS.indexOf(step);
}

/**
 * Check if can navigate to a step
 */
export function canNavigateToStep(
  targetStep: ReservationStep,
  currentStep: ReservationStep,
  status: PublicCartStatus,
  hasItems: boolean
): boolean {
  // If locked, can only go backwards
  if (isLocked(status)) {
    return getStepIndex(targetStep) <= getStepIndex(currentStep);
  }
  
  // Details requires at least one item
  if (targetStep === "details" && !hasItems) {
    return false;
  }
  
  // Review requires at least one item
  if (targetStep === "review" && !hasItems) {
    return false;
  }
  
  // Confirm requires at least one item
  if (targetStep === "confirm" && !hasItems) {
    return false;
  }
  
  return true;
}

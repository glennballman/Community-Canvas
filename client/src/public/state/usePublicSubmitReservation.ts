/**
 * Submit Reservation Hook
 * 
 * Handles cart submission with token rotation and auth context overwrite.
 */

import { useState, useCallback } from "react";
import { publicApi } from "../api/publicApi";
import { 
  setAuthContext, 
  PublicAuth,
} from "./publicTokenStore";

const LAST_CONFIRMATION_TOKEN_KEY = "public:lastConfirmationToken";

export interface SubmitPayload {
  portalId: string;
  cartId: string;
  accessToken: string;
  email: string;
  fullName?: string;
  phone?: string;
  notes?: string;
}

export interface SubmitResult {
  ok: boolean;
  cartId?: string;
  status?: string;
  accessToken?: string;
  token?: string;
  reservationId?: string;
  error?: { code: string; message: string };
}

export interface UsePublicSubmitReservationResult {
  submit: (payload: SubmitPayload) => Promise<SubmitResult>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Store the last confirmation token for deep linking
 */
function storeConfirmationToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_CONFIRMATION_TOKEN_KEY, token);
}

/**
 * Get the last confirmation token
 */
export function getLastConfirmationToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LAST_CONFIRMATION_TOKEN_KEY);
}

export function usePublicSubmitReservation(): UsePublicSubmitReservationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useCallback(async (payload: SubmitPayload): Promise<SubmitResult> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await publicApi.submitCart({
        portalId: payload.portalId,
        cartId: payload.cartId,
        accessToken: payload.accessToken,
        email: payload.email,
        fullName: payload.fullName,
        phone: payload.phone,
        notes: payload.notes,
      });

      if (!res.ok) {
        const errorMsg = res.error?.message || "Failed to submit reservation";
        setSubmitError(errorMsg);
        return {
          ok: false,
          error: res.error || { code: "SUBMIT_FAILED", message: errorMsg },
        };
      }

      // Check for token in response - required for rotation
      const newAccessToken = res.accessToken || res.token;
      const newCartId = res.cartId || payload.cartId;

      if (!newAccessToken) {
        // If no new token, still consider it successful but warn
        console.warn("Submit succeeded but no new token returned - keeping existing auth");
      }

      // Overwrite auth context with new token (token rotation)
      const newAuth: PublicAuth = {
        portalId: payload.portalId,
        cartId: newCartId,
        accessToken: newAccessToken || payload.accessToken,
      };
      setAuthContext(newAuth);

      // Store confirmation token for deep linking
      const confirmToken = res.token || newAccessToken || res.reservationId;
      if (confirmToken) {
        storeConfirmationToken(confirmToken);
      }

      return {
        ok: true,
        cartId: newCartId,
        status: res.status,
        accessToken: newAccessToken,
        token: confirmToken,
        reservationId: res.reservationId,
      };
    } catch (err) {
      const errorMsg = "Network error - please try again";
      setSubmitError(errorMsg);
      return {
        ok: false,
        error: { code: "NETWORK_ERROR", message: errorMsg },
      };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    submit,
    isSubmitting,
    submitError,
  };
}

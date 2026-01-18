/**
 * Public Cart Hook
 * 
 * Manages cart data loading, refetching, and status derivation.
 */

import { useState, useEffect, useCallback } from "react";
import { publicApi } from "../api/publicApi";
import { PublicAuth } from "./publicTokenStore";
import {
  PublicCartData,
  PublicCartItem,
  PublicCartStatus,
  deriveCartStatus,
} from "./publicReservationMachine";

export interface UsePublicCartResult {
  cart: PublicCartData | null;
  items: PublicCartItem[];
  status: PublicCartStatus;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => Promise<void>;
}

export function usePublicCart(auth: PublicAuth | null): UsePublicCartResult {
  const [cart, setCart] = useState<PublicCartData | null>(null);
  const [items, setItems] = useState<PublicCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!auth) {
      setCart(null);
      setItems([]);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);

    try {
      const result = await publicApi.getCart(auth);

      if (!result.ok) {
        setIsError(true);
        setErrorMessage(result.error?.message || "Failed to load cart");
        setCart(null);
        setItems([]);
      } else {
        setCart(result.cart || null);
        setItems(result.items || []);
      }
    } catch (err) {
      setIsError(true);
      setErrorMessage("Network error loading cart");
      setCart(null);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [auth?.portalId, auth?.cartId, auth?.accessToken]);

  // Initial fetch
  useEffect(() => {
    if (auth) {
      fetchCart();
    }
  }, [auth?.portalId, auth?.cartId, auth?.accessToken]);

  // Refetch on visibility change (returning to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && auth) {
        fetchCart();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [auth, fetchCart]);

  const status = deriveCartStatus(cart);

  return {
    cart,
    items,
    status,
    isLoading,
    isError,
    errorMessage,
    refetch: fetchCart,
  };
}

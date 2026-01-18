/**
 * Public API client for reservation flows.
 * 
 * Follows P2 envelope contract: { ok: true, ...data } or { ok: false, error: { code, message } }
 * Never throws by default - returns error envelope instead.
 */

import type { P2Envelope, P2Error } from "./publicTypes";

type FetchOptions = {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: any;
  headers?: Record<string, string>;
};

function buildQuery(query?: FetchOptions["query"]) {
  const sp = new URLSearchParams();
  if (!query) return "";
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function publicFetch<T>(
  path: string,
  opts: FetchOptions = {}
): Promise<P2Envelope<T>> {
  const q = buildQuery(opts.query);
  const res = await fetch(`${path}${q}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await parseJsonSafe(res);

  // If backend returned envelope, pass through
  if (data && typeof data.ok === "boolean") return data as P2Envelope<T>;

  // Otherwise, normalize into error envelope
  const err: P2Error = {
    code: res.ok ? "INVALID_RESPONSE" : "HTTP_ERROR",
    message: data?.error?.message || `Request failed (${res.status})`,
    details: data ?? null,
  };

  return { ok: false, error: err };
}

// Convenience wrappers for public endpoints
export const publicApi = {
  getCart: (q: { portalId: string; cartId: string; accessToken: string }) =>
    publicFetch<{ cart: any; items: any[]; isExpired: boolean }>(
      "/api/p2/public/cart",
      { method: "GET", query: q }
    ),

  addCartItem: (body: any) =>
    publicFetch<{ cartId: string; cartItem: any }>(
      "/api/p2/public/cart/items",
      { method: "POST", body }
    ),

  removeCartItem: (id: string, body: any) =>
    publicFetch<{ cartId: string; removed: boolean; cartItemId: string }>(
      `/api/p2/public/cart/items/${id}`,
      { method: "DELETE", body }
    ),

  refreshCart: (body: any) =>
    publicFetch<{ cartId: string; expiresAt: string }>(
      "/api/p2/public/cart/refresh",
      { method: "POST", body }
    ),

  submitCart: (body: any) =>
    publicFetch<{ cartId: string; status: string; accessToken: string }>(
      "/api/p2/public/cart/submit",
      { method: "POST", body }
    ),

  availability: (q: { portalSlug: string; startAt: string; endAt: string; assetType?: string; assetId?: string }) =>
    publicFetch<any>(`/api/public/cc_portals/${q.portalSlug}/availability`, { 
      method: "GET", 
      query: { 
        start: q.startAt, 
        end: q.endAt,
        asset_type: q.assetType,
        asset_id: q.assetId,
      } 
    }),

  confirm: (body: any) =>
    publicFetch<any>("/api/p2/public/reservations/confirm", {
      method: "POST",
      body,
    }),

  submitConfirm: (body: any) =>
    publicFetch<any>("/api/p2/public/reservations/submit-confirm", {
      method: "POST",
      body,
    }),

  status: (q: any) =>
    publicFetch<any>("/api/p2/public/reservations/status", {
      method: "GET",
      query: q,
    }),

  resume: (q: any) =>
    publicFetch<any>("/api/p2/public/resume", { method: "GET", query: q }),
};

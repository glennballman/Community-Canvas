/**
 * Public API types following P2 envelope contract.
 */

export type P2Error = { code: string; message: string; details?: any };

export type P2Envelope<T> =
  | ({ ok: true } & T)
  | { ok: false; error: P2Error };

export type PublicAuth = {
  portalId: string;
  cartId: string;
  accessToken: string;
};

export type PublicCart = {
  id: string;
  portal_id: string;
  status: "active" | "submitted" | "completed";
  expires_at: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
};

export type PublicCartItem = {
  id: string;
  cart_id: string;
  item_type: string | null;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  quantity: number | null;
  status: string | null;
  offer_id?: string | null;
  unit_id?: string | null;
};

import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { p2Err } from "../p2Envelope";

export async function loadCartOrThrow(args: {
  portalId: string;
  cartId: string;
  accessToken: string;
  lock?: boolean;
}) {
  const { portalId, cartId, accessToken, lock } = args;

  const lockClause = lock ? sql`FOR UPDATE` : sql``;
  const q = sql`
    SELECT id, portal_id, access_token, status, expires_at
    FROM cc_reservation_carts
    WHERE id = ${String(cartId)}::uuid
    LIMIT 1
    ${lockClause}
  `;
  const cartRes = await db.execute(q);
  const cart = (cartRes.rows || [])[0];

  if (!cart) throw Object.assign(p2Err("NOT_FOUND", "Cart not found"), { __http: 404 });
  if (String(cart.portal_id) !== String(portalId)) throw Object.assign(p2Err("UNAUTHORIZED", "Portal mismatch"), { __http: 403 });
  if (String(cart.access_token) !== String(accessToken)) throw Object.assign(p2Err("UNAUTHORIZED", "Invalid access token"), { __http: 403 });

  const isExpired = cart.expires_at ? new Date(String(cart.expires_at)).getTime() < Date.now() : false;
  if (isExpired) throw Object.assign(p2Err("CONFLICT", "Cart is expired"), { __http: 409 });

  return cart;
}

export async function assertCartActive(args: { portalId: string; cartId: string; accessToken: string; lock?: boolean }) {
  const cart = await loadCartOrThrow(args);
  if (String(cart.status) !== "active") throw Object.assign(p2Err("CONFLICT", "Cart is not active"), { __http: 409 });
  return cart;
}

export async function assertCartSubmitted(args: { portalId: string; cartId: string; accessToken: string; lock?: boolean }) {
  const cart = await loadCartOrThrow(args);
  if (String(cart.status) !== "submitted") {
    throw Object.assign(p2Err("CONFLICT", "Cart must be submitted before confirmation"), { __http: 409 });
  }
  return cart;
}

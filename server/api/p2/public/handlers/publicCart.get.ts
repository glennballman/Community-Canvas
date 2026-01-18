import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId } from "../publicHelpers";

export async function getPublicCart(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.query);
    const cartId = String(req.query.cartId || "");
    const accessToken = String(req.query.accessToken || "");

    if (!cartId || !accessToken) return res.status(400).json(p2Err("BAD_REQUEST", "cartId and accessToken are required"));

    const cartRes = await db.execute(sql`
      SELECT *
      FROM cc_reservation_carts
      WHERE id = ${String(cartId)}::uuid
      LIMIT 1
    `);
    const cart = (cartRes.rows || [])[0];
    if (!cart) return res.status(404).json(p2Err("NOT_FOUND", "Cart not found"));
    if (String(cart.portal_id) !== String(portalId)) return res.status(403).json(p2Err("UNAUTHORIZED", "Portal mismatch"));
    if (String(cart.access_token) !== String(accessToken)) return res.status(403).json(p2Err("UNAUTHORIZED", "Invalid access token"));

    const isExpired = cart.expires_at ? new Date(String(cart.expires_at)).getTime() < Date.now() : false;

    const itemsRes = await db.execute(sql`
      SELECT *
      FROM cc_reservation_cart_items
      WHERE cart_id = ${String(cartId)}::uuid
      ORDER BY created_at ASC
    `);

    return res.json(p2Ok({ portalId, cart, items: itemsRes.rows || [], isExpired }));
  } catch (e: any) {
    const http = e?.__http || 500;
    return res.status(http).json(e?.ok === false ? e : p2Err("INTERNAL", e?.message || "Unknown error"));
  }
}

import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId } from "../publicHelpers";
import { parseResumeToken } from "../publicToken";

export async function getPublicResume(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.query);
    const resumeToken = String(req.query.resumeToken || "");

    if (!resumeToken) {
      return res.status(400).json(p2Err("BAD_REQUEST", "resumeToken required"));
    }

    const parsed = parseResumeToken(resumeToken);
    if (!parsed) {
      return res.status(400).json(p2Err("BAD_REQUEST", "Invalid resumeToken format"));
    }

    const { cartId, accessToken } = parsed;

    const cartRes = await db.execute(sql`
      SELECT * FROM cc_reservation_carts
      WHERE id = ${cartId}::uuid
      LIMIT 1
    `);

    const cart = (cartRes.rows || [])[0];
    if (!cart) {
      return res.status(404).json(p2Err("NOT_FOUND", "Cart not found"));
    }
    if (String(cart.portal_id) !== portalId) {
      return res.status(403).json(p2Err("UNAUTHORIZED", "Portal mismatch"));
    }
    if (String(cart.access_token) !== accessToken) {
      return res.status(403).json(p2Err("UNAUTHORIZED", "Invalid access token"));
    }

    const itemsRes = await db.execute(sql`
      SELECT * FROM cc_reservation_cart_items
      WHERE cart_id = ${cartId}::uuid
      ORDER BY created_at ASC
    `);

    const isExpired = cart.expires_at ? new Date(String(cart.expires_at)).getTime() < Date.now() : false;

    return res.json(p2Ok({
      portalId,
      cart,
      items: itemsRes.rows || [],
      isExpired
    }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

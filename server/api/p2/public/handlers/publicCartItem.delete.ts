import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { assertCartActive } from "../publicCartAuth";

export async function deletePublicCartItem(req: Request, res: Response) {
  try {
    const cartItemId = String(req.params.id || "");
    const { portalId, cartId, accessToken } = req.body || {};
    if (!portalId || !cartId || !accessToken || !cartItemId) {
      return res.status(400).json(p2Err("BAD_REQUEST", "portalId, cartId, accessToken are required"));
    }

    await assertCartActive({ portalId, cartId, accessToken });

    await db.execute(sql`
      UPDATE cc_reservation_cart_items
      SET status = 'removed', updated_at = now()
      WHERE id = ${cartItemId}::uuid
        AND cart_id = ${String(cartId)}::uuid
    `);

    return res.json(p2Ok({ cartId, removed: true, cartItemId }));
  } catch (e: any) {
    const http = e?.__http || 500;
    return res.status(http).json(e?.ok === false ? e : p2Err("INTERNAL", e?.message || "Unknown error"));
  }
}

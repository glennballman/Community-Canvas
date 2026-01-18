import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { assertCartActive } from "../publicCartAuth";

export async function postPublicCartRefresh(req: Request, res: Response) {
  try {
    const { portalId, cartId, accessToken } = req.body || {};
    if (!portalId || !cartId || !accessToken) return res.status(400).json(p2Err("BAD_REQUEST", "portalId, cartId, accessToken are required"));

    await assertCartActive({ portalId, cartId, accessToken });

    const refreshed = await db.execute(sql`
      UPDATE cc_reservation_carts
      SET expires_at = now() + interval '30 minutes',
          updated_at = now()
      WHERE id = ${String(cartId)}::uuid
      RETURNING expires_at
    `);

    return res.json(p2Ok({ cartId, expiresAt: (refreshed.rows || [])[0]?.expires_at }));
  } catch (e: any) {
    const http = e?.__http || 500;
    return res.status(http).json(e?.ok === false ? e : p2Err("INTERNAL", e?.message || "Unknown error"));
  }
}

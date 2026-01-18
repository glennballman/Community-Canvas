import type { Request, Response } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { assertCartActive } from "../publicCartAuth";

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function postPublicCartSubmit(req: Request, res: Response) {
  try {
    const { portalId, cartId, accessToken } = req.body;
    await assertCartActive({ portalId, cartId, accessToken, lock: true });

    const rotated = newToken();

    await db.execute(sql`
      UPDATE cc_reservation_carts
      SET status = 'submitted',
          submitted_at = now(),
          access_token = ${rotated},
          updated_at = now()
      WHERE id = ${cartId}::uuid
    `);

    return res.json(p2Ok({ cartId, status: "submitted", accessToken: rotated }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

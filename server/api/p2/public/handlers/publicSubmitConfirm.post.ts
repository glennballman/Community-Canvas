import type { Request, Response } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { assertCartActive } from "../publicCartAuth";
import { makeResumeToken } from "../publicToken";

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function makeConfirmationNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RES-${ts}-${rand}`;
}

export async function postPublicSubmitConfirm(req: Request, res: Response) {
  try {
    const { portalId, cartId, accessToken, guestName, guestEmail, guestPhone } = req.body || {};
    if (!portalId || !cartId || !accessToken) {
      return res.status(400).json(p2Err("BAD_REQUEST", "portalId, cartId, accessToken required"));
    }

    await assertCartActive({ portalId, cartId, accessToken, lock: true });

    const rotatedToken = newToken();

    // Get all active cart items
    const itemsRes = await db.execute(sql`
      SELECT * FROM cc_reservation_cart_items
      WHERE cart_id = ${cartId}::uuid
        AND status = 'active'
    `);
    const items = itemsRes.rows || [];

    if (items.length === 0) {
      return res.status(400).json(p2Err("BAD_REQUEST", "No active items in cart"));
    }

    const confirmationNumber = makeConfirmationNumber();

    // Create PMS reservation record
    const pmsRes = await db.execute(sql`
      INSERT INTO cc_pms_reservations (
        portal_id, cart_id, confirmation_number,
        guest_name, guest_email, guest_phone,
        status, created_at, updated_at
      ) VALUES (
        ${portalId}::uuid,
        ${cartId}::uuid,
        ${confirmationNumber},
        ${guestName || 'Guest'},
        ${guestEmail || null},
        ${guestPhone || null},
        'confirmed',
        now(),
        now()
      )
      RETURNING *
    `);
    const reservation = (pmsRes.rows || [])[0];

    // Mark cart as confirmed (skip submitted state) and rotate token
    await db.execute(sql`
      UPDATE cc_reservation_carts
      SET status = 'confirmed',
          submitted_at = now(),
          confirmed_at = now(),
          access_token = ${rotatedToken},
          updated_at = now()
      WHERE id = ${cartId}::uuid
    `);

    // Update all cart items to confirmed
    await db.execute(sql`
      UPDATE cc_reservation_cart_items
      SET status = 'confirmed', updated_at = now()
      WHERE cart_id = ${cartId}::uuid AND status = 'active'
    `);

    const resumeToken = makeResumeToken({ v: 1, cartId, accessToken: rotatedToken });

    return res.json(p2Ok({
      cartId,
      status: "confirmed",
      accessToken: rotatedToken,
      resumeToken,
      confirmationNumber,
      reservation
    }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

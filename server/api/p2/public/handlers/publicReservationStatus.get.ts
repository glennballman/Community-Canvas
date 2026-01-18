import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId } from "../publicHelpers";

export async function getPublicReservationStatus(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.query);
    const confirmationNumber = String(req.query.confirmationNumber || "");

    if (!confirmationNumber) {
      return res.status(400).json(p2Err("BAD_REQUEST", "confirmationNumber required"));
    }

    const resv = await db.execute(sql`
      SELECT r.*, c.status as cart_status
      FROM cc_pms_reservations r
      LEFT JOIN cc_reservation_carts c ON c.id = r.cart_id
      WHERE r.confirmation_number = ${confirmationNumber}
        AND r.portal_id = ${portalId}::uuid
      LIMIT 1
    `);

    const reservation = (resv.rows || [])[0];
    if (!reservation) {
      return res.status(404).json(p2Err("NOT_FOUND", "Reservation not found"));
    }

    // Get cart items if cart exists
    let items: any[] = [];
    if (reservation.cart_id) {
      const itemsRes = await db.execute(sql`
        SELECT * FROM cc_reservation_cart_items
        WHERE cart_id = ${reservation.cart_id}::uuid
        ORDER BY created_at ASC
      `);
      items = itemsRes.rows || [];
    }

    // Get allocations
    const allocRes = await db.execute(sql`
      SELECT a.* FROM cc_reservation_allocations a
      JOIN cc_reservation_cart_items ci ON ci.id = a.reservation_item_id
      WHERE ci.cart_id = ${reservation.cart_id}::uuid
    `);

    return res.json(p2Ok({
      reservation,
      items,
      allocations: allocRes.rows || []
    }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

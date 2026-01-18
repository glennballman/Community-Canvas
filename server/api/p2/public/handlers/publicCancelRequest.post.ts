import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId } from "../publicHelpers";

export async function postPublicCancelRequest(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.body);
    const reservationId = String(req.params.id || "");
    const { reason, message } = req.body || {};

    if (!reservationId) {
      return res.status(400).json(p2Err("BAD_REQUEST", "reservationId required"));
    }

    // Verify reservation exists and belongs to portal
    const resvRes = await db.execute(sql`
      SELECT * FROM cc_pms_reservations
      WHERE id = ${reservationId}::uuid
        AND portal_id = ${portalId}::uuid
      LIMIT 1
    `);

    const reservation = (resvRes.rows || [])[0];
    if (!reservation) {
      return res.status(404).json(p2Err("NOT_FOUND", "Reservation not found"));
    }

    // Update status to cancellation_requested (request-only, no auto-cancel)
    await db.execute(sql`
      UPDATE cc_pms_reservations
      SET status = 'cancellation_requested',
          cancellation_reason = ${reason || null},
          cancellation_message = ${message || null},
          updated_at = now()
      WHERE id = ${reservationId}::uuid
    `);

    return res.json(p2Ok({
      reservationId,
      status: "cancellation_requested",
      message: "Cancellation request submitted. Staff will review and process."
    }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

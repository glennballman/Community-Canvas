import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId } from "../publicHelpers";

export async function postPublicAllocationChangeRequest(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.body);
    const allocationId = String(req.params.id || "");
    const { changeType, requestedChanges, message } = req.body || {};

    if (!allocationId) {
      return res.status(400).json(p2Err("BAD_REQUEST", "allocationId required"));
    }

    // Verify allocation exists and get cart item -> cart -> portal chain
    const allocRes = await db.execute(sql`
      SELECT a.*, ci.cart_id, c.portal_id
      FROM cc_reservation_allocations a
      JOIN cc_reservation_cart_items ci ON ci.id = a.reservation_item_id
      JOIN cc_reservation_carts c ON c.id = ci.cart_id
      WHERE a.id = ${allocationId}::uuid
      LIMIT 1
    `);

    const allocation = (allocRes.rows || [])[0] as any;
    if (!allocation) {
      return res.status(404).json(p2Err("NOT_FOUND", "Allocation not found"));
    }
    if (String(allocation.portal_id) !== portalId) {
      return res.status(403).json(p2Err("UNAUTHORIZED", "Portal mismatch"));
    }

    // Store change request in cart item (request-only, no auto-mutation)
    await db.execute(sql`
      UPDATE cc_reservation_cart_items
      SET change_request_type = ${changeType || null},
          change_request_json = ${JSON.stringify(requestedChanges || {})}::jsonb,
          change_request_message = ${message || null},
          change_requested_at = now(),
          updated_at = now()
      WHERE id = ${allocation.reservation_item_id}::uuid
    `);

    return res.json(p2Ok({
      allocationId,
      status: "change_requested",
      message: "Allocation change request submitted. Staff will review and process."
    }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

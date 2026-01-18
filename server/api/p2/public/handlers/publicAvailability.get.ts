import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId, parseIsoDate, assertOfferDisclosedToPortal } from "../publicHelpers";

export async function getPublicAvailability(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.query);
    const offerId = String(req.query.offerId || "");
    const startAt = parseIsoDate(req.query.startAt);
    const endAt = parseIsoDate(req.query.endAt);
    const quantity = Math.max(1, Number(req.query.quantity || 1));

    if (!offerId || !startAt || !endAt) {
      return res.status(400).json(p2Err("BAD_REQUEST", "offerId, startAt, endAt required"));
    }

    const offerRes = await db.execute(sql`
      SELECT id, tenant_id, facility_id, applies_to_unit_types
      FROM cc_offers
      WHERE id = ${offerId}::uuid
        AND is_active = true
      LIMIT 1
    `);
    const offer = offerRes.rows[0] as any;
    if (!offer) return res.status(404).json(p2Err("NOT_FOUND", "Offer not found"));

    await assertOfferDisclosedToPortal({
      portalId,
      offerTenantId: offer.tenant_id,
      facilityId: offer.facility_id,
    });

    const applies = offer.applies_to_unit_types || [];

    // Aggregated (parking / marina / beds)
    if (applies.length > 0) {
      const capRes = await db.execute(sql`
        WITH units AS (
          SELECT id
          FROM cc_inventory_units
          WHERE tenant_id = ${offer.tenant_id}::uuid
            AND facility_id = ${offer.facility_id}::uuid
            AND is_active = true
            AND unit_type = ANY(${applies}::text[])
        )
        SELECT count(*)::int AS available
        FROM units u
        WHERE NOT EXISTS (
          SELECT 1 FROM cc_reservation_allocations a
          WHERE a.inventory_unit_id = u.id
            AND a.starts_at < ${endAt.toISOString()}::timestamptz
            AND a.ends_at   > ${startAt.toISOString()}::timestamptz
        )
      `);

      const available = (capRes.rows[0] as any)?.available || 0;
      return res.json(p2Ok({
        available,
        requested: quantity,
        ok: available >= quantity
      }));
    }

    // Unit-bound (lodging)
    const unitId = String(req.query.unitId || "");
    if (!unitId) {
      return res.status(400).json(p2Err("BAD_REQUEST", "unitId required for unit-bound offer"));
    }

    const conflict = await db.execute(sql`
      SELECT 1
      FROM cc_unit_calendar
      WHERE unit_id = ${unitId}::uuid
        AND start_at < ${endAt.toISOString()}::timestamptz
        AND end_at   > ${startAt.toISOString()}::timestamptz
      LIMIT 1
    `);

    return res.json(p2Ok({
      available: conflict.rows.length === 0,
      requested: 1,
      ok: conflict.rows.length === 0
    }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { requirePortalId, assertOfferDisclosedToPortal } from "../publicHelpers";

export async function postPublicAvailabilityBatch(req: Request, res: Response) {
  try {
    const portalId = requirePortalId(req.body);
    const items = req.body.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json(p2Err("BAD_REQUEST", "items array required"));
    }

    const results: any[] = [];

    for (const item of items) {
      const { offerId, startAt, endAt, quantity = 1, unitId } = item;

      const offerRes = await db.execute(sql`
        SELECT id, tenant_id, facility_id, applies_to_unit_types
        FROM cc_offers
        WHERE id = ${offerId}::uuid
          AND is_active = true
      `);
      const offer = offerRes.rows[0] as any;
      if (!offer) {
        results.push({ offerId, ok: false, reason: "OFFER_NOT_FOUND" });
        continue;
      }

      await assertOfferDisclosedToPortal({
        portalId,
        offerTenantId: offer.tenant_id,
        facilityId: offer.facility_id,
      });

      const applies = offer.applies_to_unit_types || [];

      if (applies.length > 0) {
        const cap = await db.execute(sql`
          SELECT count(*)::int AS available
          FROM cc_inventory_units u
          WHERE u.tenant_id = ${offer.tenant_id}::uuid
            AND u.facility_id = ${offer.facility_id}::uuid
            AND u.unit_type = ANY(${applies}::text[])
            AND u.is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM cc_reservation_allocations a
              WHERE a.inventory_unit_id = u.id
                AND a.starts_at < ${endAt}::timestamptz
                AND a.ends_at   > ${startAt}::timestamptz
            )
        `);

        const available = (cap.rows[0] as any)?.available || 0;
        results.push({ offerId, available, requested: quantity, ok: available >= quantity });
      } else {
        const conflict = await db.execute(sql`
          SELECT 1 FROM cc_unit_calendar
          WHERE unit_id = ${unitId}::uuid
            AND start_at < ${endAt}::timestamptz
            AND end_at   > ${startAt}::timestamptz
          LIMIT 1
        `);

        results.push({ offerId, available: conflict.rows.length === 0, ok: conflict.rows.length === 0 });
      }
    }

    return res.json(p2Ok({ results }));

  } catch (e: any) {
    return res.status(e?.__http || 500).json(e?.ok === false ? e : p2Err("INTERNAL", e.message));
  }
}

import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../../../../db";
import { p2Err, p2Ok } from "../../p2Envelope";
import { assertCartActive } from "../publicCartAuth";

export async function postPublicCartItems(req: Request, res: Response) {
  try {
    const { portalId, cartId, accessToken, item } = req.body || {};
    if (!portalId || !cartId || !accessToken || !item) {
      return res.status(400).json(p2Err("BAD_REQUEST", "portalId, cartId, accessToken, item are required"));
    }

    await assertCartActive({ portalId, cartId, accessToken });

    const insertRes = await db.execute(sql`
      INSERT INTO cc_reservation_cart_items (
        cart_id, schema_type, item_type, title, description, reservation_mode,
        facility_id, offer_id, unit_id, asset_id, moment_id,
        provider_tenant_id, portal_id,
        external_url, external_reservation_ref,
        provider_name, provider_email, provider_phone,
        start_at, end_at, preferred_time, flexible_window_minutes,
        quantity, party_size, requires_approval, approval_status,
        rate_type, rate_amount,
        subtotal_cents, taxes_cents, total_cents, deposit_required_cents,
        pricing_snapshot, hold_json, intent_json, needs_json,
        dietary_requirements, special_requests,
        weather_json,
        status,
        created_at, updated_at
      ) VALUES (
        ${String(cartId)}::uuid,
        ${item.schemaType || null},
        ${item.itemType || null},
        ${item.title || null},
        ${item.description || null},
        ${item.reservationMode || null},
        ${item.facilityId ? String(item.facilityId) : null}::uuid,
        ${item.offerId ? String(item.offerId) : null}::uuid,
        ${item.unitId ? String(item.unitId) : null}::uuid,
        ${item.assetId ? String(item.assetId) : null}::uuid,
        ${item.momentId ? String(item.momentId) : null}::uuid,
        ${item.providerTenantId ? String(item.providerTenantId) : null}::uuid,
        ${item.portalId ? String(item.portalId) : null}::uuid,
        ${item.externalUrl || null},
        ${item.externalReservationRef || null},
        ${item.providerName || null},
        ${item.providerEmail || null},
        ${item.providerPhone || null},
        ${item.startAt || null}::timestamptz,
        ${item.endAt || null}::timestamptz,
        ${item.preferredTime || null},
        ${item.flexibleWindowMinutes ?? null},
        ${item.quantity ?? 1},
        ${item.partySize ?? null},
        ${item.requiresApproval ?? false},
        ${item.approvalStatus || null},
        ${item.rateType || null},
        ${item.rateAmount || null},
        ${item.subtotalCents ?? 0},
        ${item.taxesCents ?? 0},
        ${item.totalCents ?? 0},
        ${item.depositRequiredCents ?? 0},
        ${JSON.stringify(item.pricingSnapshot || {})}::jsonb,
        ${JSON.stringify(item.holdJson || {})}::jsonb,
        ${JSON.stringify(item.intentJson || {})}::jsonb,
        ${JSON.stringify(item.needsJson || {})}::jsonb,
        ${item.dietaryRequirements || null},
        ${item.specialRequests || null},
        ${JSON.stringify(item.weatherJson || {})}::jsonb,
        'active',
        now(),
        now()
      )
      RETURNING *
    `);

    return res.json(p2Ok({ cartId, cartItem: (insertRes.rows || [])[0] }));
  } catch (e: any) {
    const http = e?.__http || 500;
    return res.status(http).json(e?.ok === false ? e : p2Err("INTERNAL", e?.message || "Unknown error"));
  }
}

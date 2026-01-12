/**
 * V3.3.1 Reservation Service
 * Core reservation workflow with soft holds and unit allocation
 * NOTE: Community Canvas does NOT process payments - only tracks reservations
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { calculateQuote } from './pricingService';

// Types
export interface CreateReservationRequest {
  tenantId: string;
  facilityId: string;
  offerId: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  startAt: Date;
  endAt: Date;
  vesselLengthFt?: number;
  vehicleLengthFt?: number;
  idempotencyKey: string;
  source: 'direct' | 'portal' | 'chamber' | 'partner';
}

export interface ReservationItemResult {
  offerId: string;
  offerName: string;
  unitAssignment?: string;
  totalCents: number;
}

export interface ReservationResult {
  reservationId: string;
  confirmationNumber: string;
  status: string;
  holdType: 'soft' | 'hard';
  holdExpiresAt?: Date;
  items: ReservationItemResult[];
  grandTotalCents: number;
}

/**
 * Generate confirmation number: RES-YYMMDD-NNN
 */
async function generateConfirmationNumber(tenantId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
  const dateOnly = today.toISOString().slice(0, 10);
  
  // Increment daily sequence
  const result = await db.execute(sql`
    INSERT INTO cc_daily_sequences (tenant_id, sequence_date, sequence_type, current_value)
    VALUES (${tenantId}, ${dateOnly}, 'reservation', 1)
    ON CONFLICT (tenant_id, sequence_date, sequence_type)
    DO UPDATE SET current_value = cc_daily_sequences.current_value + 1
    RETURNING current_value
  `);
  
  const seq = result.rows[0]?.current_value as number || 1;
  const seqStr = seq.toString().padStart(3, '0');
  
  return `RES-${dateStr}-${seqStr}`;
}

/**
 * Find available unit for discrete allocation
 */
async function findAvailableUnit(
  tenantId: string,
  facilityId: string,
  startAt: Date,
  endAt: Date,
  unitTypes?: string[]
): Promise<{ id: string; displayLabel: string } | null> {
  // Build unit type filter
  let unitTypeFilter = sql`true`;
  if (unitTypes && unitTypes.length > 0) {
    // Join array into SQL IN clause
    const typesLiteral = unitTypes.map(t => `'${t}'`).join(', ');
    unitTypeFilter = sql.raw(`u.unit_type IN (${typesLiteral})`);
  }
  
  // Find units not already allocated during this period
  const result = await db.execute(sql`
    SELECT u.id, u.display_label
    FROM cc_inventory_units u
    WHERE u.tenant_id = ${tenantId}
      AND u.facility_id = ${facilityId}
      AND u.is_active = true
      AND ${unitTypeFilter}
      AND u.id NOT IN (
        SELECT a.inventory_unit_id
        FROM cc_reservation_allocations a
        JOIN cc_reservation_items ri ON a.reservation_item_id = ri.id
        JOIN cc_reservations r ON ri.reservation_id = r.id
        WHERE ri.status NOT IN ('cancelled', 'no_show', 'checked_out')
          AND r.start_date < ${endAt}
          AND r.end_date > ${startAt}
          AND (a.hold_expires_at IS NULL OR a.hold_expires_at > now())
      )
    ORDER BY u.sort_order, u.display_label
    LIMIT 1
  `);
  
  if (result.rows.length === 0) return null;
  
  return {
    id: result.rows[0].id as string,
    displayLabel: result.rows[0].display_label as string,
  };
}

/**
 * Create a new reservation
 */
export async function createReservation(req: CreateReservationRequest): Promise<ReservationResult> {
  // Check idempotency
  if (req.idempotencyKey) {
    const existing = await db.execute(sql`
      SELECT id, confirmation_number, status, hold_type
      FROM cc_reservations
      WHERE provider_id = ${req.tenantId} AND idempotency_key = ${req.idempotencyKey}
    `);
    
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // Return existing reservation
      return {
        reservationId: row.id as string,
        confirmationNumber: row.confirmation_number as string,
        status: row.status as string,
        holdType: row.hold_type as 'soft' | 'hard',
        items: [],
        grandTotalCents: 0,
      };
    }
  }
  
  // Get offer and determine participation mode
  const offerResult = await db.execute(sql`
    SELECT o.id, o.name, o.participation_mode, o.applies_to_unit_types, f.tenant_id as facility_tenant_id
    FROM cc_offers o
    JOIN cc_facilities f ON o.facility_id = f.id
    WHERE o.id = ${req.offerId} AND o.is_active = true
  `);
  
  if (offerResult.rows.length === 0) {
    throw new Error(`Offer not found: ${req.offerId}`);
  }
  
  const offer = offerResult.rows[0];
  const participationMode = offer.participation_mode as string;
  
  // Determine hold type and status based on participation mode
  const isInstant = participationMode === 'instant_confirm';
  const holdType: 'soft' | 'hard' = isInstant ? 'hard' : 'soft';
  const initialStatus = isInstant ? 'confirmed' : 'pending';
  const holdExpiresAt = isInstant ? null : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Calculate pricing
  const quote = await calculateQuote({
    facilityId: req.facilityId,
    offerId: req.offerId,
    startAt: req.startAt,
    endAt: req.endAt,
    vesselLengthFt: req.vesselLengthFt,
    vehicleLengthFt: req.vehicleLengthFt,
  });
  
  // Generate confirmation number
  const confirmationNumber = await generateConfirmationNumber(req.tenantId);
  
  // Find available unit
  const unitTypes = offer.applies_to_unit_types as string[] | null;
  const availableUnit = await findAvailableUnit(
    req.tenantId,
    req.facilityId,
    req.startAt,
    req.endAt,
    unitTypes || undefined
  );
  
  // Create reservation
  // cc_reservations uses provider_id, asset_id (required), start_date/end_date, and primary_guest_* columns
  // Look up or use the facility's linked asset from cc_assets
  const assetResult = await db.execute(sql`
    SELECT id FROM cc_assets 
    WHERE source_table = 'cc_facilities' AND source_id = ${req.facilityId}
    LIMIT 1
  `);
  
  const assetId = assetResult.rows[0]?.id as string || req.facilityId;
  
  const reservationResult = await db.execute(sql`
    INSERT INTO cc_reservations (
      provider_id, asset_id, confirmation_number, status, source, idempotency_key,
      start_date, end_date, hold_type, hold_expires_at,
      primary_guest_name, primary_guest_email, primary_guest_telephone,
      pricing_snapshot, confirmed_at
    ) VALUES (
      ${req.tenantId}, ${assetId}, ${confirmationNumber}, ${initialStatus}, ${req.source}, ${req.idempotencyKey},
      ${req.startAt}, ${req.endAt}, ${holdType}, ${holdExpiresAt},
      ${req.customerName}, ${req.customerEmail || null}, ${req.customerPhone || null},
      ${JSON.stringify(quote)}, ${isInstant ? new Date() : null}
    )
    RETURNING id
  `);
  
  const reservationId = reservationResult.rows[0].id as string;
  
  // Create reservation item
  const itemResult = await db.execute(sql`
    INSERT INTO cc_reservation_items (
      tenant_id, reservation_id, offer_id, facility_id,
      quantity, unit_id,
      base_price_cents, adjustments_json, subtotal_cents, taxes_json, total_cents,
      length_ft, status
    ) VALUES (
      ${req.tenantId}, ${reservationId}, ${req.offerId}, ${req.facilityId},
      1, ${availableUnit?.id || null},
      ${quote.baseAmountCents}, ${JSON.stringify(quote.adjustments)}, ${quote.subtotalCents}, 
      ${JSON.stringify(quote.taxes)}, ${quote.totalCents},
      ${req.vesselLengthFt || req.vehicleLengthFt || null}, ${initialStatus}
    )
    RETURNING id
  `);
  
  const itemId = itemResult.rows[0].id as string;
  
  // Create allocation if unit was assigned
  if (availableUnit) {
    await db.execute(sql`
      INSERT INTO cc_reservation_allocations (
        tenant_id, reservation_item_id, inventory_unit_id,
        display_label, hold_type, hold_expires_at
      ) VALUES (
        ${req.tenantId}, ${itemId}, ${availableUnit.id},
        ${availableUnit.displayLabel}, ${holdType}, ${holdExpiresAt}
      )
    `);
  }
  
  // Log to activity ledger
  await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id, action, entity_type, entity_id, payload
    ) VALUES (
      ${req.tenantId}, 'reservation.create', 'reservation', ${reservationId},
      ${JSON.stringify({
        confirmationNumber,
        status: initialStatus,
        holdType,
        totalCents: quote.totalCents,
        unitAssignment: availableUnit?.displayLabel,
      })}
    )
  `);
  
  return {
    reservationId,
    confirmationNumber,
    status: initialStatus,
    holdType,
    holdExpiresAt: holdExpiresAt || undefined,
    items: [{
      offerId: req.offerId,
      offerName: offer.name as string,
      unitAssignment: availableUnit?.displayLabel,
      totalCents: quote.totalCents,
    }],
    grandTotalCents: quote.totalCents,
  };
}

/**
 * Confirm a pending reservation (convert soft hold to hard)
 */
export async function confirmReservation(reservationId: string): Promise<ReservationResult> {
  await db.execute(sql`
    UPDATE cc_reservations
    SET status = 'confirmed', hold_type = 'hard', hold_expires_at = NULL, confirmed_at = now()
    WHERE id = ${reservationId} AND status = 'pending'
  `);
  
  await db.execute(sql`
    UPDATE cc_reservation_items
    SET status = 'confirmed'
    WHERE reservation_id = ${reservationId}
  `);
  
  await db.execute(sql`
    UPDATE cc_reservation_allocations
    SET hold_type = 'hard', hold_expires_at = NULL
    WHERE reservation_item_id IN (SELECT id FROM cc_reservation_items WHERE reservation_id = ${reservationId})
  `);
  
  // Get updated reservation
  const result = await db.execute(sql`
    SELECT id, confirmation_number, status, hold_type, provider_id
    FROM cc_reservations WHERE id = ${reservationId}
  `);
  
  if (result.rows.length === 0) {
    throw new Error('Reservation not found');
  }
  
  const row = result.rows[0];
  
  // Log activity
  await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id, action, entity_type, entity_id, payload
    ) VALUES (
      ${row.provider_id}, 'reservation.confirmed', 'reservation', ${reservationId},
      '{"status": "confirmed", "holdType": "hard"}'
    )
  `);
  
  return {
    reservationId: row.id as string,
    confirmationNumber: row.confirmation_number as string,
    status: row.status as string,
    holdType: row.hold_type as 'soft' | 'hard',
    items: [],
    grandTotalCents: 0,
  };
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(reservationId: string, reason?: string): Promise<void> {
  const resResult = await db.execute(sql`
    SELECT provider_id FROM cc_reservations WHERE id = ${reservationId}
  `);
  
  await db.execute(sql`
    UPDATE cc_reservations
    SET status = 'cancelled', cancellation_reason = ${reason || null}
    WHERE id = ${reservationId}
  `);
  
  await db.execute(sql`
    UPDATE cc_reservation_items
    SET status = 'cancelled'
    WHERE reservation_id = ${reservationId}
  `);
  
  // Log activity
  if (resResult.rows.length > 0) {
    await db.execute(sql`
      INSERT INTO cc_activity_ledger (
        tenant_id, action, entity_type, entity_id, payload
      ) VALUES (
        ${resResult.rows[0].provider_id}, 'reservation.cancelled', 'reservation', ${reservationId},
        ${JSON.stringify({ reason: reason || 'user_cancelled' })}
      )
    `);
  }
}

/**
 * Expire soft holds that have passed their expiration time
 */
export async function expireSoftHolds(): Promise<number> {
  // Find and expire soft holds
  const result = await db.execute(sql`
    UPDATE cc_reservations r
    SET status = 'expired'
    FROM cc_reservation_allocations a
    JOIN cc_reservation_items ri ON a.reservation_item_id = ri.id
    WHERE ri.reservation_id = r.id
      AND a.hold_type = 'soft'
      AND a.hold_expires_at IS NOT NULL
      AND a.hold_expires_at < now()
      AND r.status = 'pending'
    RETURNING r.id
  `);
  
  const expiredCount = result.rows.length;
  
  if (expiredCount > 0) {
    // Update items
    await db.execute(sql`
      UPDATE cc_reservation_items
      SET status = 'cancelled'
      WHERE reservation_id IN (
        SELECT id FROM cc_reservations WHERE status = 'expired'
      )
    `);
    
    // Log to activity ledger
    for (const row of result.rows) {
      await db.execute(sql`
        INSERT INTO cc_activity_ledger (
          action, entity_type, entity_id, payload
        ) VALUES (
          'reservation.expired', 'reservation', ${row.id},
          '{"reason": "soft_hold_expired"}'
        )
      `);
    }
  }
  
  return expiredCount;
}

/**
 * Check in a reservation
 */
export async function checkIn(reservationId: string): Promise<void> {
  const resResult = await db.execute(sql`
    SELECT provider_id FROM cc_reservations WHERE id = ${reservationId}
  `);
  
  await db.execute(sql`
    UPDATE cc_reservations
    SET status = 'checked_in', checked_in_at = now()
    WHERE id = ${reservationId} AND status = 'confirmed'
  `);
  
  await db.execute(sql`
    UPDATE cc_reservation_items
    SET status = 'checked_in'
    WHERE reservation_id = ${reservationId}
  `);
  
  // Log activity
  if (resResult.rows.length > 0) {
    await db.execute(sql`
      INSERT INTO cc_activity_ledger (
        tenant_id, action, entity_type, entity_id, payload
      ) VALUES (
        ${resResult.rows[0].provider_id}, 'reservation.checked_in', 'reservation', ${reservationId},
        '{"status": "checked_in"}'
      )
    `);
  }
}

/**
 * Check out a reservation
 */
export async function checkOut(reservationId: string): Promise<void> {
  const resResult = await db.execute(sql`
    SELECT provider_id FROM cc_reservations WHERE id = ${reservationId}
  `);
  
  await db.execute(sql`
    UPDATE cc_reservations
    SET status = 'checked_out', checked_out_at = now()
    WHERE id = ${reservationId} AND status = 'checked_in'
  `);
  
  await db.execute(sql`
    UPDATE cc_reservation_items
    SET status = 'checked_out'
    WHERE reservation_id = ${reservationId}
  `);
  
  // Log activity
  if (resResult.rows.length > 0) {
    await db.execute(sql`
      INSERT INTO cc_activity_ledger (
        tenant_id, action, entity_type, entity_id, payload
      ) VALUES (
        ${resResult.rows[0].provider_id}, 'reservation.checked_out', 'reservation', ${reservationId},
        '{"status": "checked_out"}'
      )
    `);
  }
}

/**
 * Test function - create a parking reservation
 */
export async function testReservation(): Promise<{ success: boolean; result?: ReservationResult; error?: string }> {
  try {
    // Get Save Paradise DAY_PASS offer and facility
    const offerResult = await db.execute(sql`
      SELECT o.id as offer_id, f.id as facility_id
      FROM cc_offers o
      JOIN cc_facilities f ON o.facility_id = f.id
      WHERE o.code = 'DAY_PASS' 
      AND o.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8'
    `);
    
    if (offerResult.rows.length === 0) {
      return { success: false, error: 'DAY_PASS offer not found' };
    }
    
    const { offer_id, facility_id } = offerResult.rows[0] as { offer_id: string; facility_id: string };
    
    const result = await createReservation({
      tenantId: '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
      facilityId: facility_id,
      offerId: offer_id,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      startAt: new Date('2026-07-15'),
      endAt: new Date('2026-07-15'),
      idempotencyKey: `test-${Date.now()}`,
      source: 'direct',
    });
    
    return { success: true, result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

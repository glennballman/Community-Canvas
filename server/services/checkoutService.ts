/**
 * Cart Checkout Service
 * Handles three fulfillment modes:
 * - internal: Creates cc_reservations using V3.3.1 infrastructure
 * - external: Creates cc_partner_reservation_requests for partner fulfillment
 * - public: Adds to itinerary only (no inventory hold)
 */

import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { createReservation } from './reservationService';
import { logActivity } from './activityService';
import { nanoid } from 'nanoid';

// ============ TYPES ============

interface CheckoutRequest {
  cartId: string;
  accessToken: string;
  primaryGuestName?: string;
  primaryGuestEmail?: string;
  primaryGuestPhone?: string;
  paymentMethod?: 'card' | 'cash' | 'etransfer' | 'invoice' | 'bond';
  paymentReference?: string;
  isQuote?: boolean;
  quoteValidDays?: number;
  actorId?: string;
}

interface CheckoutResult {
  success: boolean;
  cartId: string;
  bundleId: string;
  reservations: Array<{
    itemId: string;
    reservationId: string;
    confirmationNumber: string;
    status: string;
    credentialsIssued: boolean;
  }>;
  partnerRequests: Array<{
    itemId: string;
    requestId: string;
    providerName: string;
    status: string;
  }>;
  itineraryItems: Array<{
    itemId: string;
    title: string;
    startAt: Date;
  }>;
  totals: {
    subtotalCents: number;
    taxesCents: number;
    adjustmentsCents: number;
    grandTotalCents: number;
    depositRequiredCents: number;
  };
  quote?: {
    quoteNumber: string;
    validUntil: Date;
  };
  errors: Array<{
    itemId: string;
    error: string;
  }>;
}

// ============ HELPERS ============

function generateBundleId(): string {
  return `BND-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${nanoid(6).toUpperCase()}`;
}

function generateQuoteNumber(): string {
  return `Q-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
}

// ============ CHECKOUT FUNCTIONS ============

export async function checkout(req: CheckoutRequest): Promise<CheckoutResult> {
  // 1. Load and validate cart
  const cartResult = await serviceQuery(`
    SELECT * FROM cc_reservation_carts 
    WHERE id = $1 AND access_token = $2
  `, [req.cartId, req.accessToken]);
  
  const cart = cartResult.rows[0];
  if (!cart) {
    throw new Error('Cart not found or invalid token');
  }
  
  if (cart.status !== 'draft' && cart.status !== 'quote') {
    throw new Error(`Cart is in ${cart.status} status and cannot be checked out`);
  }
  
  // 2. Load cart items
  const itemsResult = await serviceQuery(`
    SELECT * FROM cc_reservation_cart_items 
    WHERE cart_id = $1 
    ORDER BY created_at ASC
  `, [req.cartId]);
  
  const items = itemsResult.rows;
  if (items.length === 0) {
    throw new Error('Cart is empty');
  }
  
  // 3. Load adjustments
  const adjustmentsResult = await serviceQuery(`
    SELECT * FROM cc_reservation_cart_adjustments 
    WHERE cart_id = $1
  `, [req.cartId]);
  
  const adjustments = adjustmentsResult.rows;
  
  // 4. Update cart status to checking_out
  const guestName = req.primaryGuestName || cart.primary_guest_name || 'Guest';
  const guestEmail = req.primaryGuestEmail || cart.primary_guest_email;
  const guestPhone = req.primaryGuestPhone || cart.primary_guest_phone;
  const paymentJson = {
    ...(cart.payment_json || {}),
    method: req.paymentMethod || 'card',
    reference: req.paymentReference
  };
  
  await serviceQuery(`
    UPDATE cc_reservation_carts SET
      status = 'checking_out',
      primary_guest_name = $2,
      primary_guest_email = $3,
      primary_guest_phone = $4,
      payment_json = $5,
      updated_at = now()
    WHERE id = $1
  `, [req.cartId, guestName, guestEmail, guestPhone, JSON.stringify(paymentJson)]);
  
  const bundleId = generateBundleId();
  
  const result: CheckoutResult = {
    success: true,
    cartId: req.cartId,
    bundleId,
    reservations: [],
    partnerRequests: [],
    itineraryItems: [],
    totals: {
      subtotalCents: 0,
      taxesCents: 0,
      adjustmentsCents: 0,
      grandTotalCents: 0,
      depositRequiredCents: 0
    },
    errors: []
  };
  
  // 5. Process each item based on reservation_mode
  for (const item of items) {
    try {
      const reservationMode = item.reservation_mode || 'public';
      
      if (reservationMode === 'internal') {
        // ========== INTERNAL MODE ==========
        // Creates cc_reservations using V3.3.1 infrastructure
        
        if (!item.facility_id || !item.offer_id) {
          throw new Error('Internal items require facilityId and offerId');
        }
        
        const partySize = item.party_size || (cart.party_adults || 1) + (cart.party_children || 0);
        
        const reservation = await createReservation({
          tenantId: item.provider_tenant_id,
          facilityId: item.facility_id,
          offerId: item.offer_id,
          customerName: guestName,
          customerEmail: guestEmail,
          customerPhone: guestPhone,
          startAt: new Date(item.start_at),
          endAt: new Date(item.end_at),
          source: 'portal',
          idempotencyKey: `cart-${req.cartId}-${item.id}`
        });
        
        // Link reservation to cart item
        await serviceQuery(`
          UPDATE cc_reservation_cart_items SET
            reservation_id = $2,
            status = $3,
            updated_at = now()
          WHERE id = $1
        `, [item.id, reservation.reservationId, reservation.status === 'confirmed' ? 'confirmed' : 'reserved']);
        
        result.reservations.push({
          itemId: item.id,
          reservationId: reservation.reservationId,
          confirmationNumber: reservation.confirmationNumber,
          status: reservation.status,
          credentialsIssued: false
        });
        
        result.totals.subtotalCents += item.subtotal_cents || 0;
        result.totals.taxesCents += item.taxes_cents || 0;
        result.totals.depositRequiredCents += item.deposit_required_cents || 0;
        
      } else if (reservationMode === 'external') {
        // ========== EXTERNAL MODE ==========
        // Creates cc_partner_reservation_requests
        
        const partySize = item.party_size || (cart.party_adults || 1) + (cart.party_children || 0);
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
        
        const prResult = await serviceQuery(`
          INSERT INTO cc_partner_reservation_requests (
            cart_id, cart_item_id, portal_id, provider_tenant_id,
            provider_name, provider_email, provider_phone,
            request_type, status, item_type, title,
            requested_start, requested_end, preferred_time,
            party_size, contact_name, contact_email, contact_phone,
            needs_json, dietary_requirements, special_accommodations,
            notes, expires_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 'reservation', 'requested',
            $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          ) RETURNING id
        `, [
          req.cartId,
          item.id,
          cart.portal_id,
          item.provider_tenant_id,
          item.provider_name,
          item.provider_email,
          item.provider_phone,
          item.item_type,
          item.title,
          item.start_at,
          item.end_at,
          item.preferred_time,
          partySize,
          guestName,
          guestEmail,
          guestPhone,
          JSON.stringify(item.needs_json || {}),
          item.dietary_requirements,
          item.special_requests,
          `Reservation via Community Canvas cart ${req.cartId}`,
          expiresAt
        ]);
        
        const requestId = prResult.rows[0].id;
        
        // Link request to cart item
        await serviceQuery(`
          UPDATE cc_reservation_cart_items SET
            partner_request_id = $2,
            status = 'pending_confirmation',
            updated_at = now()
          WHERE id = $1
        `, [item.id, requestId]);
        
        result.partnerRequests.push({
          itemId: item.id,
          requestId,
          providerName: item.provider_name || 'Partner',
          status: 'requested'
        });
        
        // Accumulate totals
        result.totals.subtotalCents += item.subtotal_cents || 0;
        result.totals.taxesCents += item.taxes_cents || 0;
        result.totals.depositRequiredCents += item.deposit_required_cents || 0;
        
        // Log activity
        await logActivity({
          tenantId: cart.tenant_id || 'e0000000-0000-0000-0000-000000000001',
          actorId: req.actorId || undefined,
          action: 'partner_request.created',
          resourceType: 'partner_request',
          resourceId: requestId,
          metadata: { bundleId, providerName: item.provider_name, itemType: item.item_type }
        });
        
      } else {
        // ========== PUBLIC MODE ==========
        // Itinerary only - no inventory, no hold
        
        result.itineraryItems.push({
          itemId: item.id,
          title: item.title,
          startAt: item.start_at
        });
        
        // Update item status - always confirmed for public
        await serviceQuery(`
          UPDATE cc_reservation_cart_items SET
            status = 'confirmed',
            updated_at = now()
          WHERE id = $1
        `, [item.id]);
        
        // Accumulate totals
        result.totals.subtotalCents += item.subtotal_cents || 0;
        result.totals.taxesCents += item.taxes_cents || 0;
        result.totals.depositRequiredCents += item.deposit_required_cents || 0;
      }
      
    } catch (e: any) {
      console.error(`Checkout error for item ${item.id}:`, e);
      result.errors.push({
        itemId: item.id,
        error: e.message
      });
    }
  }
  
  // 6. Calculate adjustments
  result.totals.adjustmentsCents = adjustments.reduce((s: number, a: any) => s + (a.amount_cents || 0), 0);
  result.totals.grandTotalCents = result.totals.subtotalCents + result.totals.taxesCents + result.totals.adjustmentsCents;
  
  // 7. Handle quote mode
  if (req.isQuote) {
    const quoteNumber = generateQuoteNumber();
    const validUntil = new Date(Date.now() + (req.quoteValidDays || 7) * 24 * 60 * 60 * 1000);
    
    const quoteJson = {
      isQuote: true,
      quoteNumber,
      validUntil: validUntil.toISOString(),
      createdAt: new Date().toISOString()
    };
    
    await serviceQuery(`
      UPDATE cc_reservation_carts SET
        status = 'quote',
        quote_json = $2,
        updated_at = now()
      WHERE id = $1
    `, [req.cartId, JSON.stringify(quoteJson)]);
    
    result.quote = { quoteNumber, validUntil };
  } else {
    // 8. Mark cart as submitted/completed
    const finalStatus = result.errors.length > 0 ? 'submitted' : 'completed';
    
    await serviceQuery(`
      UPDATE cc_reservation_carts SET
        status = $2,
        submitted_at = now(),
        completed_at = $3,
        updated_at = now()
      WHERE id = $1
    `, [req.cartId, finalStatus, result.errors.length === 0 ? new Date() : null]);
  }
  
  // 9. Log checkout activity
  await logActivity({
    tenantId: cart.tenant_id || 'e0000000-0000-0000-0000-000000000001',
    actorId: req.actorId || undefined,
    action: 'cart.checkout',
    resourceType: 'cart',
    resourceId: req.cartId,
    metadata: {
      bundleId,
      itemCount: items.length,
      reservationCount: result.reservations.length,
      partnerRequestCount: result.partnerRequests.length,
      itineraryCount: result.itineraryItems.length,
      errorCount: result.errors.length,
      grandTotalCents: result.totals.grandTotalCents
    }
  });
  
  result.success = result.errors.length === 0;
  
  return result;
}

// Convert quote to confirmed reservation
export async function confirmQuote(
  cartId: string, 
  accessToken: string
): Promise<CheckoutResult> {
  const cartResult = await serviceQuery(`
    SELECT * FROM cc_reservation_carts 
    WHERE id = $1 AND access_token = $2
  `, [cartId, accessToken]);
  
  const cart = cartResult.rows[0];
  if (!cart) {
    throw new Error('Cart not found or invalid token');
  }
  
  if (cart.status !== 'quote') {
    throw new Error('Cart is not a quote');
  }
  
  const quoteJson = cart.quote_json as any;
  if (quoteJson?.validUntil && new Date(quoteJson.validUntil) < new Date()) {
    throw new Error('Quote has expired');
  }
  
  // Reset to draft and re-checkout
  await serviceQuery(`
    UPDATE cc_reservation_carts SET status = 'draft', updated_at = now() WHERE id = $1
  `, [cartId]);
  
  return checkout({
    cartId,
    accessToken,
    isQuote: false
  });
}

// Cancel checkout / abandon cart
export async function abandonCart(
  cartId: string, 
  accessToken: string,
  reason?: string
): Promise<void> {
  const cartResult = await serviceQuery(`
    SELECT * FROM cc_reservation_carts 
    WHERE id = $1 AND access_token = $2
  `, [cartId, accessToken]);
  
  const cart = cartResult.rows[0];
  if (!cart) {
    throw new Error('Cart not found or invalid token');
  }
  
  // Cancel any pending reservations
  const itemsResult = await serviceQuery(`
    SELECT * FROM cc_reservation_cart_items WHERE cart_id = $1
  `, [cartId]);
  
  for (const item of itemsResult.rows) {
    if (item.reservation_id) {
      try {
        await serviceQuery(`
          UPDATE cc_reservations SET status = 'cancelled', updated_at = now() WHERE id = $1
        `, [item.reservation_id]);
      } catch (e) {
        console.error('Error cancelling reservation:', e);
      }
    }
    
    if (item.partner_request_id) {
      try {
        await serviceQuery(`
          UPDATE cc_partner_reservation_requests SET status = 'cancelled', updated_at = now() WHERE id = $1
        `, [item.partner_request_id]);
      } catch (e) {
        console.error('Error cancelling partner request:', e);
      }
    }
  }
  
  await serviceQuery(`
    UPDATE cc_reservation_carts SET
      status = 'cancelled',
      notes = $2,
      updated_at = now()
    WHERE id = $1
  `, [cartId, reason ? `Abandoned: ${reason}` : 'Abandoned by user']);
}

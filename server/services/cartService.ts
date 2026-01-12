/**
 * Cart Service - V3.3.1 Cart-First Reservation System
 * Multi-item shopping cart with intent capture, weather awareness, and pricing integration
 */

import { db } from '../db';
import { nanoid } from 'nanoid';
import { sql, eq, and, lt, asc } from 'drizzle-orm';
import { calculateQuote } from './pricingService';
import { 
  cc_reservation_carts, 
  cc_reservation_cart_items, 
  cc_reservation_cart_adjustments,
  cc_weather_trends
} from '@shared/schema';

// ============ TYPES ============

export interface CreateCartRequest {
  portalId?: string;
  portalSlug?: string;
  tenantId?: string;
  tripId?: string;
  source?: 'portal' | 'trip' | 'direct' | 'partner' | 'ai_agent';
  sourceRef?: string;
  entryPoint?: string;
  currency?: string;
  primaryGuestName?: string;
  primaryGuestEmail?: string;
  primaryGuestPhone?: string;
  partyAdults?: number;
  partyChildren?: number;
  partyInfants?: number;
  intent?: Record<string, any>;
  needs?: Record<string, any>;
  payment?: Record<string, any>;
  travel?: Record<string, any>;
}

export interface CartResult {
  cart: any;
  cartToken: string;
  items: any[];
  adjustments: any[];
  totals: CartTotals;
}

export interface CartTotals {
  itemsSubtotalCents: number;
  itemsTaxesCents: number;
  adjustmentsCents: number;
  grandTotalCents: number;
  depositRequiredCents: number;
  itemCount: number;
}

export interface AddItemRequest {
  cartId: string;
  itemType: 'parking' | 'accommodation' | 'charter' | 'activity' | 'meal' | 'rental' | 'equipment' | 'service' | 'transport' | 'venue' | 'other';
  title: string;
  description?: string;
  reservationMode: 'internal' | 'external' | 'public';
  
  facilityId?: string;
  offerId?: string;
  unitId?: string;
  providerTenantId?: string;
  
  externalUrl?: string;
  providerName?: string;
  providerEmail?: string;
  providerPhone?: string;
  
  startAt: Date;
  endAt: Date;
  preferredTime?: string;
  flexibleWindowMinutes?: number;
  
  quantity?: number;
  partySize?: number;
  
  vesselLengthFt?: number;
  vehicleLengthFt?: number;
  
  subtotalCents?: number;
  taxesCents?: number;
  totalCents?: number;
  depositRequiredCents?: number;
  
  dietaryRequirements?: string[];
  specialRequests?: string;
  needsJson?: Record<string, any>;
  intentJson?: Record<string, any>;
}

export interface UpdateItemRequest {
  itemId: string;
  startAt?: Date;
  endAt?: Date;
  quantity?: number;
  partySize?: number;
  specialRequests?: string;
}

// ============ HELPERS ============

function generateCartToken(prefix: string): string {
  const cleanPrefix = (prefix || 'CART').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
  return `${cleanPrefix}-${nanoid(12)}`.toUpperCase();
}

function inferIntent(source: string, partySize: number): Record<string, any> {
  return {
    discovered_via: source,
    confidence: 'exploratory',
    archetype: partySize >= 12 ? 'group' : partySize >= 4 ? 'family' : 'solo',
    timeline_days: 30
  };
}

async function getWeatherContext(locationCode: string, date: Date): Promise<any> {
  const month = date.getMonth() + 1;
  
  const result = await db.select()
    .from(cc_weather_trends)
    .where(and(
      eq(cc_weather_trends.locationCode, locationCode),
      eq(cc_weather_trends.month, month)
    ))
    .limit(1);
  
  return result.length > 0 ? { source: 'trend', ...result[0] } : null;
}

function computeTotals(items: any[], adjustments: any[]): CartTotals {
  const itemsSubtotalCents = items.reduce((s, it) => s + (it.subtotalCents || 0), 0);
  const itemsTaxesCents = items.reduce((s, it) => s + (it.taxesCents || 0), 0);
  const itemsTotal = items.reduce((s, it) => s + (it.totalCents || 0), 0);
  const adjustmentsCents = adjustments.reduce((s, a) => s + (a.amountCents || 0), 0);
  const depositRequiredCents = items.reduce((s, it) => s + (it.depositRequiredCents || 0), 0);
  
  return {
    itemsSubtotalCents,
    itemsTaxesCents,
    adjustmentsCents,
    grandTotalCents: itemsTotal + adjustmentsCents,
    depositRequiredCents,
    itemCount: items.length
  };
}

// ============ CORE FUNCTIONS ============

export async function createCart(req: CreateCartRequest): Promise<CartResult> {
  let portalId = req.portalId;
  let tenantId = req.tenantId;
  
  if (req.portalSlug && !portalId) {
    const portalResult = await db.execute(sql`
      SELECT id, owning_tenant_id FROM cc_portals WHERE slug = ${req.portalSlug} LIMIT 1
    `);
    if (portalResult.rows.length > 0) {
      const portal = portalResult.rows[0] as { id: string; owning_tenant_id: string };
      portalId = portal.id;
      tenantId = tenantId || portal.owning_tenant_id;
    }
  }
  
  const partySize = (req.partyAdults || 1) + (req.partyChildren || 0);
  const token = generateCartToken(req.portalSlug || req.source || 'CART');
  
  const [cart] = await db.insert(cc_reservation_carts).values({
    portalId,
    tenantId,
    tripId: req.tripId,
    accessToken: token,
    currency: req.currency || 'CAD',
    source: req.source || 'portal',
    sourceRef: req.sourceRef,
    entryPoint: req.entryPoint,
    primaryGuestName: req.primaryGuestName,
    primaryGuestEmail: req.primaryGuestEmail,
    primaryGuestPhone: req.primaryGuestPhone,
    partyAdults: req.partyAdults || 1,
    partyChildren: req.partyChildren || 0,
    partyInfants: req.partyInfants || 0,
    intentJson: req.intent || inferIntent(req.source || 'portal', partySize),
    needsJson: req.needs || {},
    paymentJson: req.payment || { method_preference: 'card' },
    travelJson: req.travel || {},
    viralJson: { source: req.source || 'portal' },
    expiresAt: new Date(Date.now() + 45 * 60 * 1000)
  }).returning();
  
  return {
    cart,
    cartToken: token,
    items: [],
    adjustments: [],
    totals: computeTotals([], [])
  };
}

export async function getCart(cartId: string, accessToken?: string): Promise<CartResult | null> {
  let cart;
  
  if (accessToken) {
    const result = await db.select()
      .from(cc_reservation_carts)
      .where(and(
        eq(cc_reservation_carts.id, cartId),
        eq(cc_reservation_carts.accessToken, accessToken)
      ))
      .limit(1);
    cart = result[0];
  } else {
    const result = await db.select()
      .from(cc_reservation_carts)
      .where(eq(cc_reservation_carts.id, cartId))
      .limit(1);
    cart = result[0];
  }
  
  if (!cart) return null;
  
  const items = await db.select()
    .from(cc_reservation_cart_items)
    .where(eq(cc_reservation_cart_items.cartId, cartId))
    .orderBy(asc(cc_reservation_cart_items.createdAt));
  
  const adjustments = await db.select()
    .from(cc_reservation_cart_adjustments)
    .where(eq(cc_reservation_cart_adjustments.cartId, cartId))
    .orderBy(asc(cc_reservation_cart_adjustments.createdAt));
  
  return {
    cart,
    cartToken: cart.accessToken,
    items,
    adjustments,
    totals: computeTotals(items, adjustments)
  };
}

export async function addItem(req: AddItemRequest): Promise<{ item: any; cart: CartResult }> {
  let subtotalCents = req.subtotalCents || 0;
  let taxesCents = req.taxesCents || 0;
  let totalCents = req.totalCents || (subtotalCents + taxesCents);
  let depositRequiredCents = req.depositRequiredCents || Math.round(totalCents * 0.25);
  let pricingSnapshot: Record<string, any> = {};
  let holdJson: Record<string, any> = { status: 'none' };
  
  if (req.reservationMode === 'internal' && req.offerId && req.facilityId) {
    try {
      const quote = await calculateQuote({
        facilityId: req.facilityId,
        offerId: req.offerId,
        startAt: req.startAt,
        endAt: req.endAt,
        vesselLengthFt: req.vesselLengthFt,
        vehicleLengthFt: req.vehicleLengthFt
      });
      
      subtotalCents = quote.subtotalCents;
      taxesCents = quote.taxes.reduce((s, t) => s + t.amountCents, 0);
      totalCents = quote.totalCents;
      depositRequiredCents = Math.round(totalCents * 0.25);
      pricingSnapshot = quote;
      
      holdJson = { status: 'soft', expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
    } catch (e) {
      console.error('Pricing error:', e);
    }
  }
  
  let weatherJson: Record<string, any> = {};
  try {
    const weather = await getWeatherContext('BAMFIELD', req.startAt);
    if (weather) {
      weatherJson = {
        month: req.startAt.getMonth() + 1,
        rainProb: weather.rainProbPercent,
        bestFor: weather.bestFor,
        avoidFor: weather.avoidFor
      };
    }
  } catch (e) {
    // Weather is optional
  }
  
  const [item] = await db.insert(cc_reservation_cart_items).values({
    cartId: req.cartId,
    itemType: req.itemType,
    title: req.title,
    description: req.description,
    reservationMode: req.reservationMode,
    facilityId: req.facilityId,
    offerId: req.offerId,
    unitId: req.unitId,
    providerTenantId: req.providerTenantId,
    externalUrl: req.externalUrl,
    providerName: req.providerName,
    providerEmail: req.providerEmail,
    providerPhone: req.providerPhone,
    startAt: req.startAt,
    endAt: req.endAt,
    preferredTime: req.preferredTime,
    flexibleWindowMinutes: req.flexibleWindowMinutes,
    quantity: req.quantity || 1,
    partySize: req.partySize,
    subtotalCents,
    taxesCents,
    totalCents,
    depositRequiredCents,
    pricingSnapshot,
    holdJson,
    intentJson: req.intentJson || {},
    needsJson: req.needsJson || {},
    dietaryRequirements: req.dietaryRequirements,
    specialRequests: req.specialRequests,
    weatherJson,
    status: 'pending'
  }).returning();
  
  await db.update(cc_reservation_carts)
    .set({ 
      expiresAt: new Date(Date.now() + 45 * 60 * 1000),
      updatedAt: new Date()
    })
    .where(eq(cc_reservation_carts.id, req.cartId));
  
  const cart = await getCart(req.cartId);
  
  return { item, cart: cart! };
}

export async function updateItem(req: UpdateItemRequest): Promise<{ item: any; cart: CartResult }> {
  const updates: Record<string, any> = { updatedAt: new Date() };
  
  if (req.startAt) updates.startAt = req.startAt;
  if (req.endAt) updates.endAt = req.endAt;
  if (req.quantity) updates.quantity = req.quantity;
  if (req.partySize) updates.partySize = req.partySize;
  if (req.specialRequests !== undefined) updates.specialRequests = req.specialRequests;
  
  const existingItems = await db.select()
    .from(cc_reservation_cart_items)
    .where(eq(cc_reservation_cart_items.id, req.itemId))
    .limit(1);
  
  const existingItem = existingItems[0];
  
  if (!existingItem) {
    throw new Error('Item not found');
  }
  
  if ((req.startAt || req.endAt) && existingItem.reservationMode === 'internal' && existingItem.offerId) {
    try {
      const quote = await calculateQuote({
        facilityId: existingItem.facilityId!,
        offerId: existingItem.offerId,
        startAt: req.startAt || existingItem.startAt!,
        endAt: req.endAt || existingItem.endAt!
      });
      
      updates.subtotalCents = quote.subtotalCents;
      updates.taxesCents = quote.taxes.reduce((s, t) => s + t.amountCents, 0);
      updates.totalCents = quote.totalCents;
      updates.pricingSnapshot = quote;
    } catch (e) {
      console.error('Reprice error:', e);
    }
  }
  
  const [item] = await db.update(cc_reservation_cart_items)
    .set(updates)
    .where(eq(cc_reservation_cart_items.id, req.itemId))
    .returning();
  
  const cart = await getCart(existingItem.cartId);
  
  return { item, cart: cart! };
}

export async function removeItem(itemId: string): Promise<CartResult | null> {
  const existingItems = await db.select()
    .from(cc_reservation_cart_items)
    .where(eq(cc_reservation_cart_items.id, itemId))
    .limit(1);
  
  const existingItem = existingItems[0];
  
  if (!existingItem) return null;
  
  await db.delete(cc_reservation_cart_items)
    .where(eq(cc_reservation_cart_items.id, itemId));
  
  return getCart(existingItem.cartId);
}

export async function addAdjustment(
  cartId: string,
  label: string,
  adjustmentType: string,
  amountCents: number,
  itemId?: string
): Promise<CartResult> {
  await db.insert(cc_reservation_cart_adjustments).values({
    cartId,
    label,
    adjustmentType,
    amountCents,
    scope: itemId ? 'item' : 'cart',
    itemId
  });
  
  return (await getCart(cartId))!;
}

export async function updateCartGuest(
  cartId: string,
  updates: {
    primaryGuestName?: string;
    primaryGuestEmail?: string;
    primaryGuestPhone?: string;
    partyAdults?: number;
    partyChildren?: number;
    partyInfants?: number;
    needs?: Record<string, any>;
  }
): Promise<CartResult> {
  const setValues: Record<string, any> = { updatedAt: new Date() };
  
  if (updates.primaryGuestName !== undefined) setValues.primaryGuestName = updates.primaryGuestName;
  if (updates.primaryGuestEmail !== undefined) setValues.primaryGuestEmail = updates.primaryGuestEmail;
  if (updates.primaryGuestPhone !== undefined) setValues.primaryGuestPhone = updates.primaryGuestPhone;
  if (updates.partyAdults !== undefined) setValues.partyAdults = updates.partyAdults;
  if (updates.partyChildren !== undefined) setValues.partyChildren = updates.partyChildren;
  if (updates.partyInfants !== undefined) setValues.partyInfants = updates.partyInfants;
  if (updates.needs !== undefined) setValues.needsJson = updates.needs;
  
  await db.update(cc_reservation_carts)
    .set(setValues)
    .where(eq(cc_reservation_carts.id, cartId));
  
  return (await getCart(cartId))!;
}

export async function expireStaleCartsJob(): Promise<number> {
  const result = await db.update(cc_reservation_carts)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(
      eq(cc_reservation_carts.status, 'draft'),
      lt(cc_reservation_carts.expiresAt, new Date())
    ))
    .returning();
  
  return result.length;
}

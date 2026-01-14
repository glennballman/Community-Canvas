// server/services/transportIntegrationService.ts

import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  cc_reservation_carts, cc_reservation_cart_items, ccTransportConfirmations,
  ccTransportRequests, ccTransportOperators, ccTransportAssets, ccLocations
} from '@shared/schema';
import { 
  createTransportRequest, 
  getTransportRequest,
  confirmRequest 
} from './transportRequestService';
import { getSailingById, checkSailingAvailability } from './sailingService';
import { getLocationByCode } from './locationService';
import { getOperatorByCode } from './operatorService';

// ============ TYPES ============

interface AddTransportToCartRequest {
  cartId: string;
  portalSlug: string;
  
  sailingId?: string;
  operatorCode?: string;
  
  originCode?: string;
  destinationCode?: string;
  
  requestedDate?: Date;
  requestedTime?: string;
  
  passengerCount?: number;
  passengerNames?: string[];
  kayakCount?: number;
  bikeCount?: number;
  freightDescription?: string;
  freightWeightLbs?: number;
  
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  
  specialRequests?: string;
}

interface TransportCartItemResult {
  cartItem: any;
  transportRequest: any;
  sailing?: any;
  quote: {
    passengerFare: number;
    kayakFee: number;
    bikeFee: number;
    freightFee: number;
    total: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
  };
}

// ============ CART INTEGRATION ============

export async function addTransportToCart(
  req: AddTransportToCartRequest
): Promise<TransportCartItemResult> {
  const [cart] = await db.select()
    .from(cc_reservation_carts)
    .where(sql`${cc_reservation_carts.id} = ${req.cartId}`)
    .limit(1);
  
  if (!cart) throw new Error('Cart not found');
  
  let sailingId = req.sailingId;
  let sailing: any = null;
  let operatorId: string | undefined;
  let requestType: 'scheduled' | 'on_demand' = 'scheduled';
  let requestedDate: Date;
  let requestedTime: string | undefined;
  let originLocationId: string | undefined;
  let destinationLocationId: string | undefined;
  
  if (sailingId) {
    const sailingDetails = await getSailingById(sailingId);
    if (!sailingDetails) throw new Error('Sailing not found');
    
    sailing = sailingDetails;
    operatorId = sailingDetails.sailing.operatorId;
    requestedDate = new Date(sailingDetails.sailing.sailingDate);
    requestedTime = sailingDetails.sailing.scheduledDeparture;
    originLocationId = sailingDetails.sailing.originLocationId || undefined;
    destinationLocationId = sailingDetails.sailing.destinationLocationId || undefined;
    
    const availability = await checkSailingAvailability(sailingId, {
      passengers: req.passengerCount,
      kayaks: req.kayakCount,
      freightLbs: req.freightWeightLbs
    });
    
    if (!availability.available) {
      throw new Error(`Insufficient capacity: ${availability.shortfall?.type} - requested ${availability.shortfall?.requested}, available ${availability.shortfall?.available}`);
    }
  } else if (req.operatorCode) {
    requestType = 'on_demand';
    
    const operator = await getOperatorByCode(req.portalSlug, req.operatorCode);
    if (!operator) throw new Error('Operator not found');
    operatorId = operator.id;
    
    if (!req.requestedDate) throw new Error('requestedDate required for on-demand');
    requestedDate = req.requestedDate;
    requestedTime = req.requestedTime;
  } else {
    throw new Error('Either sailingId or operatorCode required');
  }
  
  if (req.originCode) {
    const origin = await getLocationByCode(req.portalSlug, req.originCode);
    if (origin) originLocationId = origin.id;
  }
  
  if (req.destinationCode) {
    const dest = await getLocationByCode(req.portalSlug, req.destinationCode);
    if (dest) destinationLocationId = dest.id;
  }
  
  const guestInfo = (cart as any).guestInfoJson || {};
  const contactName = req.contactName || guestInfo.name || 'Guest';
  const contactPhone = req.contactPhone || guestInfo.phone;
  const contactEmail = req.contactEmail || guestInfo.email;
  
  const transportResult = await createTransportRequest({
    portalSlug: req.portalSlug,
    operatorId,
    sailingId,
    cartId: req.cartId,
    requestType,
    originLocationId,
    destinationLocationId,
    requestedDate,
    requestedTime,
    passengerCount: req.passengerCount || 1,
    passengerNames: req.passengerNames,
    kayakCount: req.kayakCount || 0,
    bikeCount: req.bikeCount || 0,
    freightDescription: req.freightDescription,
    freightWeightLbs: req.freightWeightLbs || 0,
    contactName,
    contactPhone,
    contactEmail,
    specialRequests: req.specialRequests
  });
  
  const quote = calculateTransportQuote(
    req.passengerCount || 1,
    req.kayakCount || 0,
    req.bikeCount || 0,
    req.freightWeightLbs || 0
  );
  
  let originName = 'Origin';
  let destName = 'Destination';
  
  if (originLocationId) {
    const [loc] = await db.select()
      .from(ccLocations)
      .where(sql`${ccLocations.id} = ${originLocationId}`)
      .limit(1);
    if (loc) originName = loc.name;
  }
  
  if (destinationLocationId) {
    const [loc] = await db.select()
      .from(ccLocations)
      .where(sql`${ccLocations.id} = ${destinationLocationId}`)
      .limit(1);
    if (loc) destName = loc.name;
  }
  
  const [cartItem] = await db.insert(cc_reservation_cart_items).values({
    cartId: req.cartId,
    itemType: 'transport',
    title: `Transport: ${originName} → ${destName}`,
    reservationMode: 'internal',
    description: requestType === 'scheduled' 
      ? `Ferry - ${requestedDate.toISOString().split('T')[0]} ${requestedTime}`
      : `Water Taxi - ${requestedDate.toISOString().split('T')[0]}`,
    startAt: requestedDate,
    quantity: req.passengerCount || 1,
    subtotalCents: Math.round(quote.total * 100),
    taxesCents: Math.round(quote.taxAmount * 100),
    totalCents: Math.round(quote.grandTotal * 100),
    transportRequestId: transportResult.request.id,
    transportType: requestType,
    transportDetailsJson: {
      passengers: req.passengerCount || 1,
      passengerNames: req.passengerNames,
      kayaks: req.kayakCount || 0,
      bikes: req.bikeCount || 0,
      freightLbs: req.freightWeightLbs || 0,
      originCode: req.originCode,
      destinationCode: req.destinationCode,
      sailingNumber: sailing?.sailing?.sailingNumber,
      sailingId
    },
    status: 'pending'
  }).returning();
  
  await db.update(ccTransportRequests)
    .set({ cartItemId: cartItem.id })
    .where(sql`${ccTransportRequests.id} = ${transportResult.request.id}`);
  
  return {
    cartItem,
    transportRequest: transportResult.request,
    sailing,
    quote
  };
}

function calculateTransportQuote(
  passengers: number,
  kayaks: number,
  bikes: number,
  freightLbs: number
): {
  passengerFare: number;
  kayakFee: number;
  bikeFee: number;
  freightFee: number;
  total: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
} {
  const passengerFare = passengers * 45;
  const kayakFee = kayaks * 25;
  const bikeFee = bikes * 15;
  const freightFee = Math.ceil(freightLbs * 0.10);
  const total = passengerFare + kayakFee + bikeFee + freightFee;
  const taxRate = 0.05;
  const taxAmount = Math.round(total * taxRate * 100) / 100;
  const grandTotal = total + taxAmount;
  
  return { passengerFare, kayakFee, bikeFee, freightFee, total, taxRate, taxAmount, grandTotal };
}

// ============ CONFIRMATION GENERATION ============

function generateConfirmationNumber(): string {
  return `TRN-${nanoid(6).toUpperCase()}`;
}

function generateQRToken(): string {
  return nanoid(24);
}

export async function issueTransportConfirmation(
  transportRequestId: string,
  options?: {
    reservationId?: string;
    tripId?: string;
  }
): Promise<any> {
  const requestDetails = await getTransportRequest(transportRequestId);
  if (!requestDetails) throw new Error('Transport request not found');
  
  const req = requestDetails.request;
  const sailing = requestDetails.sailing?.sailing;
  
  let operatorName = 'Transport Operator';
  if (req.operatorId) {
    const [operator] = await db.select()
      .from(ccTransportOperators)
      .where(sql`${ccTransportOperators.id} = ${req.operatorId}`)
      .limit(1);
    if (operator) operatorName = operator.name;
  }
  
  let vesselName: string | undefined;
  if (sailing?.assetId) {
    const [asset] = await db.select()
      .from(ccTransportAssets)
      .where(sql`${ccTransportAssets.id} = ${sailing.assetId}`)
      .limit(1);
    if (asset) vesselName = asset.name;
  }
  
  let originName = 'Origin';
  let destinationName = 'Destination';
  
  if (req.originLocationId) {
    const [loc] = await db.select()
      .from(ccLocations)
      .where(sql`${ccLocations.id} = ${req.originLocationId}`)
      .limit(1);
    if (loc) originName = loc.name;
  }
  
  if (req.destinationLocationId) {
    const [loc] = await db.select()
      .from(ccLocations)
      .where(sql`${ccLocations.id} = ${req.destinationLocationId}`)
      .limit(1);
    if (loc) destinationName = loc.name;
  }
  
  const confirmationNumber = generateConfirmationNumber();
  const qrToken = generateQRToken();
  
  const sailingDate = new Date(req.requestedDate);
  const validTo = new Date(sailingDate);
  validTo.setHours(23, 59, 59, 999);
  
  const [confirmation] = await db.insert(ccTransportConfirmations).values({
    transportRequestId,
    reservationId: options?.reservationId,
    cartId: req.cartId,
    tripId: req.tripId || options?.tripId,
    confirmationNumber,
    qrCodeToken: qrToken,
    guestName: req.contactName,
    guestEmail: req.contactEmail,
    guestPhone: req.contactPhone,
    sailingDate: req.requestedDate,
    sailingTime: req.requestedTime || '08:00',
    operatorName,
    vesselName,
    originName,
    destinationName,
    passengerCount: req.passengerCount,
    passengerNames: req.passengerNames,
    kayakCount: req.kayakCount,
    bikeCount: req.bikeCount,
    freightDescription: req.freightDescription,
    totalCad: req.totalCad,
    paymentStatus: req.paymentStatus,
    validTo
  }).returning();
  
  await confirmRequest(transportRequestId, 'system');
  
  return confirmation;
}

export async function getConfirmationByNumber(confirmationNumber: string): Promise<any | null> {
  const [confirmation] = await db.select()
    .from(ccTransportConfirmations)
    .where(eq(ccTransportConfirmations.confirmationNumber, confirmationNumber))
    .limit(1);
  return confirmation || null;
}

export async function getConfirmationByQR(qrToken: string): Promise<any | null> {
  const [confirmation] = await db.select()
    .from(ccTransportConfirmations)
    .where(eq(ccTransportConfirmations.qrCodeToken, qrToken))
    .limit(1);
  return confirmation || null;
}

export async function getConfirmationsForTrip(tripId: string): Promise<any[]> {
  return db.select()
    .from(ccTransportConfirmations)
    .where(sql`${ccTransportConfirmations.tripId} = ${tripId}`);
}

// ============ CHECK-IN VIA QR ============

export async function checkInByQR(qrToken: string): Promise<{
  confirmation: any;
  request: any;
  message: string;
}> {
  const confirmation = await getConfirmationByQR(qrToken);
  if (!confirmation) throw new Error('Invalid QR code');
  
  if (confirmation.status === 'checked_in') {
    return { confirmation, request: null, message: 'Already checked in' };
  }
  
  if (confirmation.status === 'cancelled') {
    throw new Error('Reservation has been cancelled');
  }
  
  const [updated] = await db.update(ccTransportConfirmations)
    .set({
      status: 'checked_in',
      checkedInAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTransportConfirmations.id, confirmation.id))
    .returning();
  
  await db.update(ccTransportRequests)
    .set({
      status: 'checked_in',
      checkedInAt: new Date(),
      updatedAt: new Date()
    })
    .where(sql`${ccTransportRequests.id} = ${confirmation.transportRequestId}`);
  
  const request = await getTransportRequest(confirmation.transportRequestId);
  
  return {
    confirmation: updated,
    request: request?.request,
    message: 'Check-in successful'
  };
}

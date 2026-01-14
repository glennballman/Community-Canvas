import { db } from '../db';
import { eq, and, asc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  ccTransportRequests, ccPortals, ccTransportOperators, ccSailings 
} from '@shared/schema';
import { checkSailingAvailability, getSailingById } from './sailingService';

interface CreateTransportRequest {
  portalSlug?: string;
  operatorId?: string;
  sailingId?: string;
  cartId?: string;
  cartItemId?: string;
  tripId?: string;
  
  requestType: 'scheduled' | 'on_demand' | 'freight_only' | 'charter';
  
  originLocationId?: string;
  destinationLocationId?: string;
  
  requestedDate: Date;
  requestedTime?: string;
  flexibleWindowMinutes?: number;
  
  passengerCount?: number;
  passengerNames?: string[];
  
  freightDescription?: string;
  freightWeightLbs?: number;
  freightPieces?: number;
  freightSpecialHandling?: string[];
  
  kayakCount?: number;
  bikeCount?: number;
  
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  
  needs?: Record<string, any>;
  specialRequests?: string;
}

interface TransportRequestResult {
  request: any;
  sailing?: any;
  waitlisted: boolean;
  message: string;
}

function generateRequestNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `TR-${dateStr}-${suffix}`;
}

async function calculateFare(
  operatorId: string,
  passengers: number,
  freightLbs: number,
  kayaks: number,
  bikes: number
): Promise<{
  quotedFareCad: number;
  freightFeeCad: number;
  kayakFeeCad: number;
  totalCad: number;
}> {
  const [operator] = await db.select()
    .from(ccTransportOperators)
    .where(eq(ccTransportOperators.id, operatorId))
    .limit(1);
  
  const reservationSettings = (operator?.reservationSettingsJson as any) || {};
  
  const baseFare = 45;
  const kayakFee = reservationSettings.kayak_fee_cad || 25;
  const bikeFee = 15;
  const freightPerLb = 0.10;
  
  const quotedFareCad = passengers * baseFare;
  const kayakFeeCad = kayaks * kayakFee;
  const bikeFeeCad = bikes * bikeFee;
  const freightFeeCad = Math.ceil(freightLbs * freightPerLb);
  
  return {
    quotedFareCad,
    freightFeeCad: freightFeeCad + bikeFeeCad,
    kayakFeeCad,
    totalCad: quotedFareCad + freightFeeCad + kayakFeeCad + bikeFeeCad
  };
}

async function updateSailingCapacity(
  sailingId: string,
  amounts: { passengers: number; freightLbs: number; kayaks: number },
  action: 'book' | 'cancel'
): Promise<void> {
  const [sailing] = await db.select()
    .from(ccSailings)
    .where(eq(ccSailings.id, sailingId))
    .limit(1);
  
  if (!sailing) return;
  
  const capacity = (sailing.capacityJson as any) || {};
  const multiplier = action === 'book' ? -1 : 1;
  
  if (capacity.passengers) {
    capacity.passengers.reserved += amounts.passengers * (action === 'book' ? 1 : -1);
    capacity.passengers.available += amounts.passengers * multiplier;
  }
  
  if (capacity.freight_lbs) {
    capacity.freight_lbs.reserved += amounts.freightLbs * (action === 'book' ? 1 : -1);
    capacity.freight_lbs.available += amounts.freightLbs * multiplier;
  }
  
  if (capacity.kayaks) {
    capacity.kayaks.reserved += amounts.kayaks * (action === 'book' ? 1 : -1);
    capacity.kayaks.available += amounts.kayaks * multiplier;
  }
  
  await db.update(ccSailings)
    .set({ capacityJson: capacity, updatedAt: new Date() })
    .where(eq(ccSailings.id, sailingId));
}

export async function createTransportRequest(
  req: CreateTransportRequest
): Promise<TransportRequestResult> {
  let portalId: string | undefined;
  let tenantId: string | undefined;
  
  if (req.portalSlug) {
    const [portal] = await db.select({ id: ccPortals.id, owningTenantId: ccPortals.owningTenantId })
      .from(ccPortals)
      .where(eq(ccPortals.slug, req.portalSlug))
      .limit(1);
    if (!portal) {
      throw new Error('Invalid portal');
    }
    portalId = portal.id;
    tenantId = portal.owningTenantId || undefined;
  }
  
  let operatorId = req.operatorId;
  let sailingDetails: any = null;
  
  if (req.sailingId) {
    sailingDetails = await getSailingById(req.sailingId);
    if (sailingDetails) {
      operatorId = sailingDetails.sailing.operatorId;
      
      if (portalId && operatorId) {
        const [operator] = await db.select({ portalId: ccTransportOperators.portalId })
          .from(ccTransportOperators)
          .where(sql`${ccTransportOperators.id} = ${operatorId}`)
          .limit(1);
        if (!operator || operator.portalId !== portalId) {
          throw new Error('Sailing does not belong to this portal');
        }
      }
    }
  }
  
  if (!operatorId) {
    throw new Error('Operator ID required');
  }
  
  if (portalId && req.operatorId) {
    const [operator] = await db.select({ portalId: ccTransportOperators.portalId })
      .from(ccTransportOperators)
      .where(eq(ccTransportOperators.id, req.operatorId))
      .limit(1);
    if (!operator || operator.portalId !== portalId) {
      throw new Error('Operator does not belong to this portal');
    }
  }
  
  let waitlisted = false;
  if (req.sailingId && req.requestType === 'scheduled') {
    const availability = await checkSailingAvailability(req.sailingId, {
      passengers: req.passengerCount,
      freightLbs: req.freightWeightLbs,
      kayaks: req.kayakCount
    });
    
    if (!availability.available) {
      waitlisted = true;
    }
  }
  
  const pricing = await calculateFare(
    operatorId,
    req.passengerCount || 0,
    req.freightWeightLbs || 0,
    req.kayakCount || 0,
    req.bikeCount || 0
  );
  
  const requestNumber = generateRequestNumber();
  const dateStr = req.requestedDate.toISOString().split('T')[0];
  
  const [request] = await db.insert(ccTransportRequests).values({
    tenantId,
    portalId,
    operatorId,
    sailingId: req.sailingId,
    cartId: req.cartId,
    cartItemId: req.cartItemId,
    tripId: req.tripId,
    requestNumber,
    requestType: req.requestType,
    originLocationId: req.originLocationId,
    destinationLocationId: req.destinationLocationId,
    requestedDate: dateStr,
    requestedTime: req.requestedTime,
    flexibleWindowMinutes: req.flexibleWindowMinutes,
    passengerCount: req.passengerCount || 0,
    passengerNames: req.passengerNames,
    freightDescription: req.freightDescription,
    freightWeightLbs: req.freightWeightLbs || 0,
    freightPieces: req.freightPieces || 0,
    freightSpecialHandling: req.freightSpecialHandling,
    kayakCount: req.kayakCount || 0,
    bikeCount: req.bikeCount || 0,
    contactName: req.contactName,
    contactPhone: req.contactPhone,
    contactEmail: req.contactEmail,
    needsJson: req.needs || {},
    specialRequests: req.specialRequests,
    quotedFareCad: String(pricing.quotedFareCad),
    freightFeeCad: String(pricing.freightFeeCad),
    kayakFeeCad: String(pricing.kayakFeeCad),
    totalCad: String(pricing.totalCad),
    status: waitlisted ? 'waitlisted' : 'requested'
  }).returning();
  
  if (req.sailingId && !waitlisted) {
    await updateSailingCapacity(req.sailingId, {
      passengers: req.passengerCount || 0,
      freightLbs: req.freightWeightLbs || 0,
      kayaks: req.kayakCount || 0
    }, 'book');
  }
  
  return {
    request,
    sailing: sailingDetails,
    waitlisted,
    message: waitlisted 
      ? 'Added to waitlist - sailing is at capacity'
      : 'Transport request created successfully'
  };
}

export async function getTransportRequest(requestId: string): Promise<any | null> {
  const [request] = await db.select()
    .from(ccTransportRequests)
    .where(eq(ccTransportRequests.id, requestId))
    .limit(1);
  
  if (!request) return null;
  
  let sailing = null;
  if (request.sailingId) {
    sailing = await getSailingById(request.sailingId);
  }
  
  return { request, sailing };
}

export async function getTransportRequestByNumber(requestNumber: string): Promise<any | null> {
  const [request] = await db.select()
    .from(ccTransportRequests)
    .where(eq(ccTransportRequests.requestNumber, requestNumber))
    .limit(1);
  
  if (!request) return null;
  
  return getTransportRequest(request.id);
}

export async function getRequestsForSailing(sailingId: string): Promise<any[]> {
  return db.select()
    .from(ccTransportRequests)
    .where(and(
      eq(ccTransportRequests.sailingId, sailingId),
      sql`${ccTransportRequests.status} NOT IN ('cancelled', 'rejected')`
    ))
    .orderBy(asc(ccTransportRequests.createdAt));
}

export async function getRequestsForTrip(tripId: string): Promise<any[]> {
  return db.select()
    .from(ccTransportRequests)
    .where(eq(ccTransportRequests.tripId, tripId))
    .orderBy(asc(ccTransportRequests.requestedDate));
}

export async function confirmRequest(
  requestId: string,
  confirmedBy?: string
): Promise<any> {
  const [request] = await db.select()
    .from(ccTransportRequests)
    .where(eq(ccTransportRequests.id, requestId))
    .limit(1);
  
  if (!request) throw new Error('Request not found');
  
  if (request.status === 'waitlisted' && request.sailingId) {
    await updateSailingCapacity(request.sailingId, {
      passengers: request.passengerCount || 0,
      freightLbs: request.freightWeightLbs || 0,
      kayaks: request.kayakCount || 0
    }, 'book');
  }
  
  const [updated] = await db.update(ccTransportRequests)
    .set({
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy,
      updatedAt: new Date()
    })
    .where(eq(ccTransportRequests.id, requestId))
    .returning();
  
  return updated;
}

export async function checkInRequest(requestId: string): Promise<any> {
  const [updated] = await db.update(ccTransportRequests)
    .set({
      status: 'checked_in',
      checkedInAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTransportRequests.id, requestId))
    .returning();
  
  return updated;
}

export async function boardRequest(requestId: string): Promise<any> {
  const [updated] = await db.update(ccTransportRequests)
    .set({
      status: 'boarded',
      boardedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTransportRequests.id, requestId))
    .returning();
  
  return updated;
}

export async function completeRequest(requestId: string): Promise<any> {
  const [updated] = await db.update(ccTransportRequests)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTransportRequests.id, requestId))
    .returning();
  
  return updated;
}

export async function cancelRequest(
  requestId: string,
  reason?: string
): Promise<any> {
  const [request] = await db.select()
    .from(ccTransportRequests)
    .where(eq(ccTransportRequests.id, requestId))
    .limit(1);
  
  if (!request) throw new Error('Request not found');
  
  if (request.sailingId && ['confirmed', 'requested'].includes(request.status)) {
    await updateSailingCapacity(request.sailingId, {
      passengers: request.passengerCount || 0,
      freightLbs: request.freightWeightLbs || 0,
      kayaks: request.kayakCount || 0
    }, 'cancel');
  }
  
  const [updated] = await db.update(ccTransportRequests)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date()
    })
    .where(eq(ccTransportRequests.id, requestId))
    .returning();
  
  return updated;
}

export async function markNoShow(requestId: string): Promise<any> {
  const [request] = await db.select()
    .from(ccTransportRequests)
    .where(eq(ccTransportRequests.id, requestId))
    .limit(1);
  
  if (!request) throw new Error('Request not found');
  
  if (request.sailingId) {
    await updateSailingCapacity(request.sailingId, {
      passengers: request.passengerCount || 0,
      freightLbs: request.freightWeightLbs || 0,
      kayaks: request.kayakCount || 0
    }, 'cancel');
  }
  
  const [updated] = await db.update(ccTransportRequests)
    .set({
      status: 'no_show',
      updatedAt: new Date()
    })
    .where(eq(ccTransportRequests.id, requestId))
    .returning();
  
  return updated;
}

export async function getSailingManifest(sailingId: string): Promise<{
  sailing: any;
  passengers: { name: string; requestNumber: string; status: string }[];
  totals: {
    passengerCount: number;
    checkedIn: number;
    boarded: number;
    freightLbs: number;
    kayaks: number;
    bikes: number;
  };
}> {
  const sailingDetails = await getSailingById(sailingId);
  const requests = await getRequestsForSailing(sailingId);
  
  const passengers: { name: string; requestNumber: string; status: string }[] = [];
  let passengerCount = 0;
  let checkedIn = 0;
  let boarded = 0;
  let freightLbs = 0;
  let kayaks = 0;
  let bikes = 0;
  
  for (const req of requests) {
    passengerCount += req.passengerCount || 0;
    freightLbs += req.freightWeightLbs || 0;
    kayaks += req.kayakCount || 0;
    bikes += req.bikeCount || 0;
    
    if (req.status === 'checked_in') checkedIn += req.passengerCount || 0;
    if (req.status === 'boarded') boarded += req.passengerCount || 0;
    
    if (req.passengerNames?.length) {
      for (const name of req.passengerNames) {
        passengers.push({
          name,
          requestNumber: req.requestNumber,
          status: req.status
        });
      }
    } else if (req.passengerCount > 0) {
      passengers.push({
        name: req.contactName,
        requestNumber: req.requestNumber,
        status: req.status
      });
    }
  }
  
  return {
    sailing: sailingDetails,
    passengers,
    totals: { passengerCount, checkedIn, boarded, freightLbs, kayaks, bikes }
  };
}

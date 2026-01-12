import { db } from '../db';
import { eq, and, gte, lte, or, asc, sql } from 'drizzle-orm';
import { 
  ccSailingSchedules, ccSailings, ccPortCalls,
  ccTransportOperators, ccTransportAssets, ccPortals, ccLocations
} from '@shared/schema';

interface SailingSearchRequest {
  operatorId?: string;
  operatorCode?: string;
  portalSlug?: string;
  fromDate?: Date;
  toDate?: Date;
  originLocationId?: string;
  destinationLocationId?: string;
  status?: string;
  limit?: number;
}

interface SailingWithPortCalls {
  sailing: any;
  portCalls: any[];
  operator?: any;
  asset?: any;
}

// ============ SCHEDULE FUNCTIONS ============

export async function getSchedules(operatorId: string): Promise<any[]> {
  return db.select()
    .from(ccSailingSchedules)
    .where(and(
      eq(ccSailingSchedules.operatorId, operatorId),
      or(
        eq(ccSailingSchedules.status, 'active'),
        eq(ccSailingSchedules.status, 'seasonal')
      )
    ))
    .orderBy(asc(ccSailingSchedules.departureTime));
}

export async function getActiveScheduleForDate(
  operatorId: string,
  date: Date
): Promise<any[]> {
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();
  
  const schedules = await db.select()
    .from(ccSailingSchedules)
    .where(and(
      eq(ccSailingSchedules.operatorId, operatorId),
      or(
        eq(ccSailingSchedules.status, 'active'),
        eq(ccSailingSchedules.status, 'seasonal')
      )
    ));
  
  return schedules.filter(s => {
    if (!s.daysOfWeek?.includes(dayOfWeek)) return false;
    
    const seasonal = s.seasonalJson as any;
    if (seasonal?.active_months) {
      return seasonal.active_months.includes(month);
    }
    
    return true;
  });
}

// ============ SAILING FUNCTIONS ============

export async function getSailings(req: SailingSearchRequest): Promise<{
  sailings: SailingWithPortCalls[];
  total: number;
}> {
  const conditions: any[] = [];
  
  let operatorId = req.operatorId;
  if (req.operatorCode && req.portalSlug) {
    const [portal] = await db.select({ id: ccPortals.id })
      .from(ccPortals)
      .where(eq(ccPortals.slug, req.portalSlug))
      .limit(1);
    
    if (portal) {
      const [operator] = await db.select({ id: ccTransportOperators.id })
        .from(ccTransportOperators)
        .where(and(
          eq(ccTransportOperators.portalId, portal.id),
          eq(ccTransportOperators.code, req.operatorCode)
        ))
        .limit(1);
      if (operator) operatorId = operator.id;
    }
  }
  
  if (operatorId) {
    conditions.push(eq(ccSailings.operatorId, operatorId));
  }
  
  if (req.fromDate) {
    conditions.push(gte(ccSailings.sailingDate, req.fromDate.toISOString().split('T')[0]));
  }
  
  if (req.toDate) {
    conditions.push(lte(ccSailings.sailingDate, req.toDate.toISOString().split('T')[0]));
  }
  
  if (req.originLocationId) {
    conditions.push(eq(ccSailings.originLocationId, req.originLocationId));
  }
  
  if (req.destinationLocationId) {
    conditions.push(eq(ccSailings.destinationLocationId, req.destinationLocationId));
  }
  
  if (req.status) {
    conditions.push(eq(ccSailings.status, req.status));
  } else {
    conditions.push(sql`${ccSailings.status} NOT IN ('cancelled', 'completed')`);
  }
  
  const sailings = await db.select()
    .from(ccSailings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(ccSailings.sailingDate), asc(ccSailings.scheduledDeparture))
    .limit(req.limit || 50);
  
  const results: SailingWithPortCalls[] = [];
  for (const sailing of sailings) {
    const portCalls = await db.select()
      .from(ccPortCalls)
      .where(eq(ccPortCalls.sailingId, sailing.id))
      .orderBy(asc(ccPortCalls.stopSequence));
    
    results.push({ sailing, portCalls });
  }
  
  return { sailings: results, total: results.length };
}

export async function getSailingById(sailingId: string): Promise<SailingWithPortCalls | null> {
  const [sailing] = await db.select()
    .from(ccSailings)
    .where(eq(ccSailings.id, sailingId))
    .limit(1);
  
  if (!sailing) return null;
  
  const portCalls = await db.select()
    .from(ccPortCalls)
    .where(eq(ccPortCalls.sailingId, sailingId))
    .orderBy(asc(ccPortCalls.stopSequence));
  
  const [operator] = sailing.operatorId 
    ? await db.select().from(ccTransportOperators).where(eq(ccTransportOperators.id, sailing.operatorId)).limit(1)
    : [null];
    
  const [asset] = sailing.assetId
    ? await db.select().from(ccTransportAssets).where(eq(ccTransportAssets.id, sailing.assetId)).limit(1)
    : [null];
  
  return { sailing, portCalls, operator, asset };
}

export async function getSailingByNumber(sailingNumber: string): Promise<SailingWithPortCalls | null> {
  const [sailing] = await db.select()
    .from(ccSailings)
    .where(eq(ccSailings.sailingNumber, sailingNumber))
    .limit(1);
  
  if (!sailing) return null;
  
  return getSailingById(sailing.id);
}

// ============ SAILING STATE TRANSITIONS ============

export async function updateSailingStatus(
  sailingId: string,
  status: string,
  metadata?: { delayMinutes?: number; reason?: string }
): Promise<any> {
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date()
  };
  
  if (status === 'departed') {
    updates.actualDepartureAt = new Date();
  } else if (status === 'arrived' || status === 'completed') {
    updates.actualArrivalAt = new Date();
  } else if (status === 'cancelled') {
    updates.cancelledAt = new Date();
    updates.cancellationReason = metadata?.reason;
  } else if (status === 'delayed') {
    updates.delayMinutes = metadata?.delayMinutes;
    updates.delayReason = metadata?.reason;
  }
  
  const [updated] = await db.update(ccSailings)
    .set(updates)
    .where(eq(ccSailings.id, sailingId))
    .returning();
  
  return updated;
}

export async function updatePortCallStatus(
  portCallId: string,
  status: string,
  operations?: Record<string, any>
): Promise<any> {
  const updates: Record<string, any> = { status };
  
  if (status === 'arrived') {
    updates.actualArrivalAt = new Date();
  } else if (status === 'departed') {
    updates.actualDepartureAt = new Date();
  }
  
  if (operations) {
    updates.operationsJson = operations;
  }
  
  const [updated] = await db.update(ccPortCalls)
    .set(updates)
    .where(eq(ccPortCalls.id, portCallId))
    .returning();
  
  return updated;
}

// ============ AVAILABILITY CHECK ============

export async function checkSailingAvailability(
  sailingId: string,
  request: { passengers?: number; freightLbs?: number; kayaks?: number }
): Promise<{
  available: boolean;
  capacity: any;
  shortfall?: { type: string; requested: number; available: number };
}> {
  const [sailing] = await db.select()
    .from(ccSailings)
    .where(eq(ccSailings.id, sailingId))
    .limit(1);
  
  if (!sailing) {
    return { available: false, capacity: null, shortfall: { type: 'sailing', requested: 0, available: 0 } };
  }
  
  const capacity = sailing.capacityJson as any;
  
  if (request.passengers && capacity.passengers) {
    if (request.passengers > capacity.passengers.available) {
      return {
        available: false,
        capacity,
        shortfall: { 
          type: 'passengers', 
          requested: request.passengers, 
          available: capacity.passengers.available 
        }
      };
    }
  }
  
  if (request.freightLbs && capacity.freight_lbs) {
    if (request.freightLbs > capacity.freight_lbs.available) {
      return {
        available: false,
        capacity,
        shortfall: { 
          type: 'freight_lbs', 
          requested: request.freightLbs, 
          available: capacity.freight_lbs.available 
        }
      };
    }
  }
  
  if (request.kayaks && capacity.kayaks) {
    if (request.kayaks > capacity.kayaks.available) {
      return {
        available: false,
        capacity,
        shortfall: { 
          type: 'kayaks', 
          requested: request.kayaks, 
          available: capacity.kayaks.available 
        }
      };
    }
  }
  
  return { available: true, capacity };
}

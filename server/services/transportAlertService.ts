// server/services/transportAlertService.ts

import { db } from '../db';
import { eq, and, lte, desc, asc, sql } from 'drizzle-orm';
import { ccTransportAlerts, ccPortals, ccSailings, ccTransportOperators, ccTransportAssets, ccLocations, ccPortCalls } from '@shared/schema';
import { getRequestsForSailing } from './transportRequestService';

// ============ TYPES ============

interface CreateAlertRequest {
  portalSlug?: string;
  operatorId: string;
  sailingId?: string;
  locationId?: string;
  alertType: 'delay' | 'cancellation' | 'weather_hold' | 'schedule_change' | 'capacity' | 'operational' | 'emergency' | 'maintenance';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  affectedDate?: Date;
  affectedSailings?: string[];
  delayMinutes?: number;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  source?: string;
  sourceRef?: string;
  expiresAt?: Date;
}

// ============ ALERT FUNCTIONS ============

export async function createTransportAlert(req: CreateAlertRequest): Promise<any> {
  let portalId: string | undefined;
  if (req.portalSlug) {
    const [portal] = await db.select({ id: ccPortals.id })
      .from(ccPortals)
      .where(eq(ccPortals.slug, req.portalSlug))
      .limit(1);
    if (portal) portalId = portal.id;
  }
  
  let affectedRequestCount = 0;
  if (req.sailingId) {
    const requests = await getRequestsForSailing(req.sailingId);
    affectedRequestCount = requests.length;
  }
  
  const [alert] = await db.insert(ccTransportAlerts).values({
    portalId,
    operatorId: req.operatorId,
    sailingId: req.sailingId,
    locationId: req.locationId,
    alertType: req.alertType,
    severity: req.severity,
    title: req.title,
    message: req.message,
    affectedDate: req.affectedDate?.toISOString().split('T')[0],
    affectedSailings: req.affectedSailings,
    delayMinutes: req.delayMinutes,
    actionRequired: req.actionRequired || false,
    actionUrl: req.actionUrl,
    actionLabel: req.actionLabel,
    source: req.source || 'operator',
    sourceRef: req.sourceRef,
    status: 'active',
    affectedRequestCount,
    expiresAt: req.expiresAt
  }).returning();
  
  if (req.sailingId) {
    if (req.alertType === 'delay' && req.delayMinutes) {
      await db.update(ccSailings)
        .set({
          status: 'delayed',
          delayMinutes: req.delayMinutes,
          delayReason: req.message,
          updatedAt: new Date()
        })
        .where(sql`${ccSailings.id} = ${req.sailingId}`);
    } else if (req.alertType === 'cancellation') {
      await db.update(ccSailings)
        .set({
          status: 'cancelled',
          cancellationReason: req.message,
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(sql`${ccSailings.id} = ${req.sailingId}`);
    }
  }
  
  return alert;
}

export async function getActiveAlerts(options?: {
  portalSlug?: string;
  operatorId?: string;
  sailingId?: string;
  severity?: string;
}): Promise<any[]> {
  let conditions = sql`${ccTransportAlerts.status} = 'active'`;
  
  if (options?.portalSlug) {
    const [portal] = await db.select({ id: ccPortals.id })
      .from(ccPortals)
      .where(eq(ccPortals.slug, options.portalSlug))
      .limit(1);
    if (portal) {
      conditions = sql`${conditions} AND ${ccTransportAlerts.portalId} = ${portal.id}`;
    }
  }
  
  if (options?.operatorId) {
    conditions = sql`${conditions} AND ${ccTransportAlerts.operatorId} = ${options.operatorId}`;
  }
  
  if (options?.sailingId) {
    conditions = sql`${conditions} AND ${ccTransportAlerts.sailingId} = ${options.sailingId}`;
  }
  
  if (options?.severity) {
    conditions = sql`${conditions} AND ${ccTransportAlerts.severity} = ${options.severity}`;
  }
  
  return db.select()
    .from(ccTransportAlerts)
    .where(conditions)
    .orderBy(
      desc(sql`CASE ${ccTransportAlerts.severity} 
        WHEN 'emergency' THEN 4 
        WHEN 'critical' THEN 3 
        WHEN 'warning' THEN 2 
        ELSE 1 END`),
      desc(ccTransportAlerts.createdAt)
    );
}

export async function resolveAlert(alertId: string): Promise<any> {
  const [updated] = await db.update(ccTransportAlerts)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      updatedAt: new Date()
    })
    .where(sql`${ccTransportAlerts.id} = ${alertId}`)
    .returning();
  
  return updated;
}

export async function acknowledgeAlert(alertId: string): Promise<any> {
  const [updated] = await db.update(ccTransportAlerts)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      updatedAt: new Date()
    })
    .where(sql`${ccTransportAlerts.id} = ${alertId}`)
    .returning();
  
  return updated;
}

// ============ LIVE DEPARTURE BOARD ============

interface DepartureBoardEntry {
  sailingId: string;
  sailingNumber: string;
  operatorName: string;
  operatorCode: string;
  vesselName?: string;
  
  route: {
    origin: { code: string; name: string };
    destination: { code: string; name: string };
    stops: { code: string; name: string; arrivalTime?: string }[];
  };
  
  scheduledDeparture: string;
  estimatedDeparture?: string;
  actualDeparture?: string;
  
  status: string;
  statusDisplay: string;
  
  capacity: {
    passengers: { available: number; total: number };
    kayaks?: { available: number; total: number };
  };
  
  alerts: {
    type: string;
    severity: string;
    message: string;
  }[];
}

export async function getLiveDepartureBoard(
  portalSlug: string,
  options?: { date?: Date; limit?: number }
): Promise<{
  board: DepartureBoardEntry[];
  lastUpdated: Date;
  activeAlerts: any[];
}> {
  const [portal] = await db.select({ id: ccPortals.id })
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) {
    return { board: [], lastUpdated: new Date(), activeAlerts: [] };
  }
  
  const targetDate = options?.date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const sailings = await db.select()
    .from(ccSailings)
    .where(sql`${ccSailings.sailingDate} = ${dateStr} AND ${ccSailings.status} NOT IN ('completed', 'cancelled')`)
    .orderBy(asc(ccSailings.scheduledDeparture))
    .limit(options?.limit || 20);
  
  const activeAlerts = await getActiveAlerts({ portalSlug });
  
  const board: DepartureBoardEntry[] = [];
  
  for (const sailing of sailings) {
    const [operator] = await db.select()
      .from(ccTransportOperators)
      .where(sql`${ccTransportOperators.id} = ${sailing.operatorId}`)
      .limit(1);
    
    if (!operator || operator.portalId !== portal.id) continue;
    
    let vesselName: string | undefined;
    if (sailing.assetId) {
      const [asset] = await db.select()
        .from(ccTransportAssets)
        .where(sql`${ccTransportAssets.id} = ${sailing.assetId}`)
        .limit(1);
      vesselName = asset?.name;
    }
    
    let origin = { code: '', name: 'TBD' };
    let destination = { code: '', name: 'TBD' };
    
    if (sailing.originLocationId) {
      const [loc] = await db.select()
        .from(ccLocations)
        .where(sql`${ccLocations.id} = ${sailing.originLocationId}`)
        .limit(1);
      if (loc) origin = { code: loc.code || '', name: loc.name };
    }
    
    if (sailing.destinationLocationId) {
      const [loc] = await db.select()
        .from(ccLocations)
        .where(sql`${ccLocations.id} = ${sailing.destinationLocationId}`)
        .limit(1);
      if (loc) destination = { code: loc.code || '', name: loc.name };
    }
    
    const portCalls = await db.select()
      .from(ccPortCalls)
      .where(sql`${ccPortCalls.sailingId} = ${sailing.id}`)
      .orderBy(asc(ccPortCalls.stopSequence));
    
    const stops: { code: string; name: string; arrivalTime?: string }[] = [];
    for (const call of portCalls) {
      const [loc] = await db.select()
        .from(ccLocations)
        .where(sql`${ccLocations.id} = ${call.locationId}`)
        .limit(1);
      if (loc) {
        stops.push({
          code: loc.code || '',
          name: loc.name,
          arrivalTime: call.scheduledArrival || undefined
        });
      }
    }
    
    const sailingAlerts = activeAlerts
      .filter(a => a.sailingId === sailing.id)
      .map(a => ({
        type: a.alertType,
        severity: a.severity,
        message: a.message
      }));
    
    let estimatedDeparture: string | undefined;
    if (sailing.status === 'delayed' && sailing.delayMinutes) {
      const scheduled = new Date(`${dateStr}T${sailing.scheduledDeparture}`);
      scheduled.setMinutes(scheduled.getMinutes() + sailing.delayMinutes);
      estimatedDeparture = scheduled.toTimeString().slice(0, 5);
    }
    
    const statusDisplay = getStatusDisplay(sailing.status || 'scheduled', sailing.delayMinutes);
    
    const capacityJson = sailing.capacityJson as any || {};
    
    board.push({
      sailingId: sailing.id,
      sailingNumber: sailing.sailingNumber || '',
      operatorName: operator.name,
      operatorCode: operator.code || '',
      vesselName,
      route: { origin, destination, stops },
      scheduledDeparture: sailing.scheduledDeparture,
      estimatedDeparture,
      actualDeparture: sailing.actualDepartureAt?.toTimeString().slice(0, 5),
      status: sailing.status || 'scheduled',
      statusDisplay,
      capacity: {
        passengers: {
          available: capacityJson.passengers?.available || 0,
          total: capacityJson.passengers?.total || 0
        },
        kayaks: capacityJson.kayaks ? {
          available: capacityJson.kayaks.available,
          total: capacityJson.kayaks.total
        } : undefined
      },
      alerts: sailingAlerts
    });
  }
  
  return {
    board,
    lastUpdated: new Date(),
    activeAlerts: activeAlerts.filter(a => !a.sailingId)
  };
}

function getStatusDisplay(status: string, delayMinutes?: number | null): string {
  switch (status) {
    case 'scheduled': return 'On Time';
    case 'boarding': return 'Now Boarding';
    case 'departed': return 'Departed';
    case 'delayed': return delayMinutes ? `Delayed ${delayMinutes}min` : 'Delayed';
    case 'cancelled': return 'Cancelled';
    case 'in_transit': return 'In Transit';
    case 'arrived': return 'Arrived';
    default: return status;
  }
}

export async function expireOldAlerts(): Promise<number> {
  const result = await db.update(ccTransportAlerts)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(
      eq(ccTransportAlerts.status, 'active'),
      lte(ccTransportAlerts.expiresAt, new Date())
    ))
    .returning();
  
  return result.length;
}

export async function checkCapacityAlerts(sailingId: string): Promise<any | null> {
  const [sailing] = await db.select()
    .from(ccSailings)
    .where(sql`${ccSailings.id} = ${sailingId}`)
    .limit(1);
  
  if (!sailing) return null;
  
  const capacity = sailing.capacityJson as any;
  if (!capacity?.passengers) return null;
  
  const availablePercent = (capacity.passengers.available / capacity.passengers.total) * 100;
  
  if (availablePercent < 20 && availablePercent > 0) {
    const [existing] = await db.select()
      .from(ccTransportAlerts)
      .where(sql`${ccTransportAlerts.sailingId} = ${sailingId} AND ${ccTransportAlerts.alertType} = 'capacity' AND ${ccTransportAlerts.status} = 'active'`)
      .limit(1);
    
    if (!existing) {
      return createTransportAlert({
        operatorId: sailing.operatorId,
        sailingId,
        alertType: 'capacity',
        severity: availablePercent < 10 ? 'warning' : 'info',
        title: 'Limited Availability',
        message: `Only ${capacity.passengers.available} passenger spots remaining`,
        affectedDate: sailing.sailingDate ? new Date(sailing.sailingDate) : undefined
      });
    }
  }
  
  return null;
}

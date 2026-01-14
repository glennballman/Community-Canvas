import { db } from '../db';
import { eq, and, desc, lte, sql } from 'drizzle-orm';
import { ccTripAlerts, cc_weather_trends } from '@shared/schema';
import { getTrip } from './tripService';

interface CreateAlertRequest {
  tripId: string;
  alertType: 'weather' | 'ferry' | 'flight' | 'road' | 'activity_cancelled' | 'reservation_change' | 'provider_message' | 'emergency' | 'reminder' | 'system';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  relatedItemId?: string;
  relatedItemType?: string;
  affectedDate?: Date;
  source?: 'system' | 'weather_service' | 'ferry_api' | 'provider' | 'staff' | 'auto';
  sourceRef?: string;
  expiresAt?: Date;
}

export async function createAlert(req: CreateAlertRequest): Promise<any> {
  const [alert] = await db.insert(ccTripAlerts).values({
    tripId: req.tripId,
    alertType: req.alertType,
    severity: req.severity,
    title: req.title,
    message: req.message,
    actionRequired: req.actionRequired || false,
    actionUrl: req.actionUrl,
    actionLabel: req.actionLabel,
    relatedItemId: req.relatedItemId,
    relatedItemType: req.relatedItemType,
    affectedDate: req.affectedDate ? req.affectedDate.toISOString().split('T')[0] : undefined,
    source: req.source || 'system',
    sourceRef: req.sourceRef,
    status: 'active',
    expiresAt: req.expiresAt
  }).returning();
  
  return alert;
}

export async function getTripAlerts(
  tripId: string,
  options?: { activeOnly?: boolean; severity?: string }
): Promise<any[]> {
  const conditions = [eq(ccTripAlerts.tripId, tripId)];
  
  if (options?.activeOnly) {
    conditions.push(eq(ccTripAlerts.status, 'active'));
  }
  
  if (options?.severity) {
    conditions.push(eq(ccTripAlerts.severity, options.severity));
  }
  
  const severityOrder = sql`CASE 
    WHEN ${ccTripAlerts.severity} = 'emergency' THEN 0
    WHEN ${ccTripAlerts.severity} = 'critical' THEN 1
    WHEN ${ccTripAlerts.severity} = 'warning' THEN 2
    WHEN ${ccTripAlerts.severity} = 'info' THEN 3
    ELSE 4 END`;
  
  return db.select()
    .from(ccTripAlerts)
    .where(and(...conditions))
    .orderBy(severityOrder, desc(ccTripAlerts.createdAt));
}

export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy?: string
): Promise<any> {
  const [updated] = await db.update(ccTripAlerts)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy
    })
    .where(eq(ccTripAlerts.id, alertId))
    .returning();
  
  return updated;
}

export async function resolveAlert(alertId: string): Promise<any> {
  const [updated] = await db.update(ccTripAlerts)
    .set({
      status: 'resolved',
      resolvedAt: new Date()
    })
    .where(eq(ccTripAlerts.id, alertId))
    .returning();
  
  return updated;
}

export async function dismissAlert(alertId: string): Promise<any> {
  const [updated] = await db.update(ccTripAlerts)
    .set({ status: 'dismissed' })
    .where(eq(ccTripAlerts.id, alertId))
    .returning();
  
  return updated;
}

export async function checkWeatherAlerts(tripAccessCode: string): Promise<any[]> {
  const trip = await getTrip(tripAccessCode);
  if (!trip || !trip.start_date) return [];
  
  const startMonth = new Date(trip.start_date).getMonth() + 1;
  
  const weatherResults = await db.select()
    .from(cc_weather_trends)
    .where(and(
      eq(cc_weather_trends.locationCode, 'BAMFIELD'),
      eq(cc_weather_trends.month, startMonth)
    ))
    .limit(1);
  
  const weather = weatherResults[0];
  if (!weather) return [];
  
  const alerts: any[] = [];
  
  if (weather.rainProbPercent && weather.rainProbPercent > 60) {
    const existingAlerts = await db.select()
      .from(ccTripAlerts)
      .where(and(
        eq(ccTripAlerts.tripId, trip.id),
        eq(ccTripAlerts.alertType, 'weather'),
        eq(ccTripAlerts.status, 'active')
      ))
      .limit(1);
    
    if (existingAlerts.length === 0) {
      const alert = await createAlert({
        tripId: trip.id,
        alertType: 'weather',
        severity: weather.rainProbPercent > 70 ? 'warning' : 'info',
        title: 'Rain Expected During Your Trip',
        message: `There's a ${weather.rainProbPercent}% chance of rain during your visit. ${weather.planningNotes || 'Consider packing rain gear and having indoor backup plans.'}`,
        source: 'weather_service',
        affectedDate: new Date(trip.start_date)
      });
      alerts.push(alert);
    }
  }
  
  return alerts;
}

export async function expireOldAlerts(): Promise<number> {
  const result = await db.update(ccTripAlerts)
    .set({ status: 'expired' })
    .where(and(
      eq(ccTripAlerts.status, 'active'),
      lte(ccTripAlerts.expiresAt, new Date())
    ))
    .returning();
  
  return result.length;
}

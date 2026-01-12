import { db, pool } from '../db';
import { ccPortalMoments, ccMomentAvailability } from '@shared/schema';
import { eq, and, gte, lte, desc, asc, sql, or } from 'drizzle-orm';

interface MomentSearchRequest {
  portalSlug?: string;
  portalId?: string;
  momentType?: string;
  category?: string;
  tags?: string[];
  targetDate?: Date;
  partySize?: number;
  includeWeatherFit?: boolean;
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
}

interface MomentResult {
  moment: any;
  weatherFit?: 'excellent' | 'good' | 'fair' | 'poor';
  weatherWarnings?: string[];
  availability?: {
    date: Date;
    spotsRemaining: number;
    status: string;
  }[];
}

export async function getMoments(req: MomentSearchRequest): Promise<{
  moments: MomentResult[];
  total: number;
  weatherContext?: any;
}> {
  let portalId = req.portalId;
  
  if (req.portalSlug && !portalId) {
    const portalRes = await pool.query(
      `SELECT id FROM cc_portals WHERE slug = $1 LIMIT 1`,
      [req.portalSlug]
    );
    if (portalRes.rows[0]) {
      portalId = portalRes.rows[0].id;
    }
  }
  
  if (!portalId) {
    return { moments: [], total: 0 };
  }
  
  const conditions = [
    eq(ccPortalMoments.portalId, portalId),
    eq(ccPortalMoments.isActive, true)
  ];
  
  if (req.momentType) {
    conditions.push(eq(ccPortalMoments.momentType, req.momentType));
  }
  
  if (req.category) {
    conditions.push(eq(ccPortalMoments.category, req.category));
  }
  
  if (req.featuredOnly) {
    conditions.push(eq(ccPortalMoments.isFeatured, true));
  }
  
  const moments = await db.select()
    .from(ccPortalMoments)
    .where(and(...conditions))
    .orderBy(desc(ccPortalMoments.isFeatured), asc(ccPortalMoments.displayOrder))
    .limit(req.limit || 20)
    .offset(req.offset || 0);
  
  let weatherContext = null;
  if (req.targetDate && req.includeWeatherFit) {
    try {
      const { getWeatherContext } = await import('./recommendationService');
      weatherContext = await getWeatherContext('BAMFIELD', req.targetDate);
    } catch (e) {
    }
  }
  
  const results: MomentResult[] = moments.map(moment => {
    const result: MomentResult = { moment };
    
    if (weatherContext && moment.weatherJson) {
      const weather = moment.weatherJson as any;
      const warnings: string[] = [];
      let fit: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
      
      if (weather.sensitivity === 'critical') {
        if (weather.requires?.wind_max_kph && weatherContext.windAvgKph > weather.requires.wind_max_kph) {
          fit = 'poor';
          warnings.push(`Wind typically ${weatherContext.windAvgKph} kph (max ${weather.requires.wind_max_kph} kph)`);
        }
        if (weather.requires?.rain_max_percent && weatherContext.rainProbPercent > weather.requires.rain_max_percent) {
          fit = fit === 'poor' ? 'poor' : 'fair';
          warnings.push(`${weatherContext.rainProbPercent}% chance of rain`);
        }
      } else if (weather.sensitivity === 'warning') {
        if (weatherContext.rainProbPercent > 50) {
          fit = 'fair';
          warnings.push('Rain likely - have backup plan');
        }
      }
      
      if (weatherContext.bestFor?.some((b: string) => 
        (moment.tags as string[])?.some((t: string) => t.toLowerCase().includes(b.toLowerCase()))
      )) {
        fit = 'excellent';
      }
      
      result.weatherFit = fit;
      result.weatherWarnings = warnings;
    }
    
    if (req.partySize) {
      if (moment.maxParticipants && req.partySize > moment.maxParticipants) {
        result.weatherWarnings = result.weatherWarnings || [];
        result.weatherWarnings.push(`Max ${moment.maxParticipants} participants`);
      }
      if (moment.minParticipants && req.partySize < moment.minParticipants) {
        result.weatherWarnings = result.weatherWarnings || [];
        result.weatherWarnings.push(`Min ${moment.minParticipants} participants required`);
      }
    }
    
    return result;
  });
  
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(ccPortalMoments)
    .where(and(...conditions));
  
  return {
    moments: results,
    total: Number(countResult[0]?.count || 0),
    weatherContext
  };
}

export async function getMomentBySlug(
  portalSlug: string, 
  momentSlug: string
): Promise<MomentResult | null> {
  const portalRes = await pool.query(
    `SELECT id FROM cc_portals WHERE slug = $1 LIMIT 1`,
    [portalSlug]
  );
  
  if (!portalRes.rows[0]) return null;
  const portalId = portalRes.rows[0].id;
  
  const moments = await db.select()
    .from(ccPortalMoments)
    .where(and(
      eq(ccPortalMoments.portalId, portalId),
      eq(ccPortalMoments.slug, momentSlug),
      eq(ccPortalMoments.isActive, true)
    ))
    .limit(1);
  
  if (moments.length === 0) return null;
  
  return { moment: moments[0] };
}

export async function getMomentById(momentId: string): Promise<any | null> {
  const moments = await db.select()
    .from(ccPortalMoments)
    .where(eq(ccPortalMoments.id, momentId))
    .limit(1);
  
  return moments[0] || null;
}

export async function getMomentAvailability(
  momentId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  return db.select()
    .from(ccMomentAvailability)
    .where(and(
      eq(ccMomentAvailability.momentId, momentId),
      gte(ccMomentAvailability.availableDate, startDate.toISOString().split('T')[0]),
      lte(ccMomentAvailability.availableDate, endDate.toISOString().split('T')[0]),
      or(
        eq(ccMomentAvailability.status, 'available'),
        eq(ccMomentAvailability.status, 'limited')
      )
    ))
    .orderBy(asc(ccMomentAvailability.availableDate), asc(ccMomentAvailability.startTime));
}

export async function getCategories(portalSlug: string): Promise<string[]> {
  const portalRes = await pool.query(
    `SELECT id FROM cc_portals WHERE slug = $1 LIMIT 1`,
    [portalSlug]
  );
  
  if (!portalRes.rows[0]) return [];
  const portalId = portalRes.rows[0].id;
  
  const result = await db.selectDistinct({ category: ccPortalMoments.category })
    .from(ccPortalMoments)
    .where(and(
      eq(ccPortalMoments.portalId, portalId),
      eq(ccPortalMoments.isActive, true),
      sql`${ccPortalMoments.category} IS NOT NULL`
    ));
  
  return result.map(r => r.category).filter(Boolean) as string[];
}

export async function addMomentToCart(
  cartId: string,
  momentId: string,
  options: {
    startAt: Date;
    endAt?: Date;
    partySize?: number;
    specialRequests?: string;
  }
): Promise<any> {
  const moment = await getMomentById(momentId);
  
  if (!moment) {
    throw new Error('Moment not found');
  }
  
  const endAt = options.endAt || new Date(options.startAt.getTime() + (moment.durationMinutes || 60) * 60 * 1000);
  
  const priceCents = moment.priceCents || 0;
  const partySize = options.partySize || 1;
  const subtotalCents = moment.pricePer === 'person' ? priceCents * partySize : priceCents;
  const taxesCents = Math.round(subtotalCents * 0.12);
  const totalCents = subtotalCents + taxesCents;
  
  const { addItem } = await import('./cartService');
  
  return addItem({
    cartId,
    itemType: moment.momentType === 'meal' ? 'meal' : 
              moment.momentType === 'rental' ? 'rental' :
              moment.momentType === 'charter' ? 'charter' : 'activity',
    title: moment.title,
    description: moment.subtitle,
    reservationMode: moment.reservationMode as any,
    facilityId: moment.facilityId || undefined,
    offerId: moment.offerId || undefined,
    providerTenantId: moment.tenantId || undefined,
    providerName: moment.providerName || undefined,
    providerEmail: moment.providerEmail || undefined,
    providerPhone: moment.providerPhone || undefined,
    externalUrl: moment.externalBookingUrl || undefined,
    startAt: options.startAt,
    endAt,
    partySize,
    specialRequests: options.specialRequests,
    needsJson: moment.constraintsJson || {}
  });
}

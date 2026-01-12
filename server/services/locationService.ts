import { db } from '../db';
import { eq, and, or, ilike, sql, asc } from 'drizzle-orm';
import { ccLocations, ccPortals } from '@shared/schema';

interface LocationSearchRequest {
  portalSlug?: string;
  portalId?: string;
  locationType?: string;
  authorityType?: string;
  capability?: string;
  query?: string;
  nearLat?: number;
  nearLon?: number;
  radiusKm?: number;
  status?: string;
}

interface LocationResult {
  location: any;
  distance_km?: number;
}

export async function getLocations(req: LocationSearchRequest): Promise<{
  locations: LocationResult[];
  total: number;
}> {
  let portalId = req.portalId;
  
  if (req.portalSlug && !portalId) {
    const [portal] = await db.select({ id: ccPortals.id })
      .from(ccPortals)
      .where(eq(ccPortals.slug, req.portalSlug))
      .limit(1);
    if (portal) portalId = portal.id;
  }
  
  const conditions: any[] = [];
  
  if (portalId) {
    conditions.push(eq(ccLocations.portalId, portalId));
  }
  
  if (req.locationType) {
    conditions.push(eq(ccLocations.locationType, req.locationType));
  }
  
  if (req.authorityType) {
    conditions.push(eq(ccLocations.authorityType, req.authorityType));
  }
  
  if (req.status) {
    conditions.push(eq(ccLocations.status, req.status));
  } else {
    conditions.push(or(
      eq(ccLocations.status, 'active'),
      eq(ccLocations.status, 'seasonal')
    ));
  }
  
  if (req.query) {
    conditions.push(or(
      ilike(ccLocations.name, `%${req.query}%`),
      ilike(ccLocations.code, `%${req.query}%`)
    ));
  }
  
  if (req.capability) {
    conditions.push(
      sql`${ccLocations.stopCapabilities}->>${req.capability} = 'true'`
    );
  }
  
  const locations = await db.select()
    .from(ccLocations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(ccLocations.name));
  
  let results: LocationResult[] = locations.map(loc => ({ location: loc }));
  
  if (req.nearLat && req.nearLon) {
    results = results.map(r => {
      if (r.location.lat && r.location.lon) {
        const distance = haversineDistance(
          req.nearLat!, req.nearLon!,
          Number(r.location.lat), Number(r.location.lon)
        );
        return { ...r, distance_km: Math.round(distance * 10) / 10 };
      }
      return r;
    });
    
    if (req.radiusKm) {
      results = results.filter(r => 
        r.distance_km === undefined || r.distance_km <= req.radiusKm!
      );
    }
    
    results.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
  }
  
  return {
    locations: results,
    total: results.length
  };
}

export async function getLocationByCode(
  portalSlug: string,
  code: string
): Promise<any | null> {
  const [portal] = await db.select({ id: ccPortals.id })
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return null;
  
  const [location] = await db.select()
    .from(ccLocations)
    .where(and(
      eq(ccLocations.portalId, portal.id),
      eq(ccLocations.code, code.toUpperCase())
    ))
    .limit(1);
  
  return location || null;
}

export async function getLocationById(id: string): Promise<any | null> {
  const [location] = await db.select()
    .from(ccLocations)
    .where(eq(ccLocations.id, id))
    .limit(1);
  
  return location || null;
}

export async function getLocationTypes(portalSlug: string): Promise<string[]> {
  const [portal] = await db.select({ id: ccPortals.id })
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return [];
  
  const result = await db.selectDistinct({ type: ccLocations.locationType })
    .from(ccLocations)
    .where(eq(ccLocations.portalId, portal.id));
  
  return result.map(r => r.type).filter(Boolean) as string[];
}

export async function getAuthorities(portalSlug: string): Promise<any[]> {
  const [portal] = await db.select({ id: ccPortals.id })
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return [];
  
  const result = await db.selectDistinct({ 
    type: ccLocations.authorityType,
    name: ccLocations.authorityName
  })
    .from(ccLocations)
    .where(and(
      eq(ccLocations.portalId, portal.id),
      sql`${ccLocations.authorityType} IS NOT NULL`
    ));
  
  return result.filter(r => r.type);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

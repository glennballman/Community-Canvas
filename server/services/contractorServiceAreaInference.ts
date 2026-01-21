/**
 * Contractor Service Area Inference Service - Prompt A2.2
 * 
 * Converts visual clues + GPS + sticky notes + job photos into proposed
 * service coverage. Advisory only - nothing restricts future jobs.
 * 
 * HARD PRINCIPLES:
 * - Advisory only - nothing here restricts future jobs
 * - Everything is editable later
 * - Consent-first - we propose, contractor confirms or adjusts
 * - Never auto-publish to community calendars without confirmation
 * - Multi-origin - coverage proposals from multiple sources
 * - Messy-input tolerant - handles varied contractor uploads
 */

import { pool } from '../db.js';

export type CoverageType = 'zone' | 'portal' | 'radius' | 'route';

export type CoverageSource = 
  | 'identity_enrichment'
  | 'job_photo'
  | 'sticky_note'
  | 'manual'
  | 'service_run_pattern';

export interface RadiusCoverage {
  lat: number;
  lng: number;
  radius_km: number;
}

export interface RouteCoverage {
  from: string;
  to: string;
  buffer_km: number;
}

export interface ZoneCoverage {
  zone_label?: string;
  portal_name?: string;
}

export interface ServiceAreaProposal {
  id: string;
  coverage_type: CoverageType;
  portal_id?: string;
  portal_name?: string;
  zone_id?: string;
  zone_label?: string;
  coverage_payload: RadiusCoverage | RouteCoverage | ZoneCoverage;
  confidence: number;
  source: CoverageSource;
  evidence?: string[];
}

export interface LocationSignal {
  type: 'gps' | 'place_name' | 'address' | 'city';
  value: string | { lat: number; lng: number };
  source: CoverageSource;
  confidence: number;
}

interface ContractorIdentity {
  location_hint?: string;
  company_name?: string;
}

interface InferenceContext {
  contractorProfileId: string;
  tenantId: string;
  portalId?: string;
  identity?: ContractorIdentity;
  ingestionGps?: Array<{ lat: number; lng: number; source_type: string }>;
  placeNames?: string[];
}

/**
 * Collect all location signals from various sources for a contractor
 */
export async function collectLocationSignals(
  contractorProfileId: string,
  tenantId: string
): Promise<LocationSignal[]> {
  const signals: LocationSignal[] = [];
  
  const client = await pool.connect();
  try {
    // 1. Get confirmed identity location hint
    const identityResult = await client.query(`
      SELECT company_location_hint, company_name
      FROM cc_contractor_profiles
      WHERE id = $1
    `, [contractorProfileId]);
    
    if (identityResult.rows[0]?.company_location_hint) {
      signals.push({
        type: 'place_name',
        value: identityResult.rows[0].company_location_hint,
        source: 'identity_enrichment',
        confidence: 0.85
      });
    }
    
    // 2. Get GPS coordinates from ingestions
    const ingestionResult = await client.query(`
      SELECT 
        m->>'url' as url,
        source_type,
        (m->'gps'->>'lat')::float as lat,
        (m->'gps'->>'lng')::float as lng
      FROM cc_ai_ingestions, 
           jsonb_array_elements(media) as m
      WHERE contractor_profile_id = $1
        AND tenant_id = $2
        AND m->'gps' IS NOT NULL
        AND m->'gps'->>'lat' IS NOT NULL
    `, [contractorProfileId, tenantId]);
    
    for (const row of ingestionResult.rows) {
      if (row.lat && row.lng) {
        signals.push({
          type: 'gps',
          value: { lat: row.lat, lng: row.lng },
          source: row.source_type === 'sticky_note' ? 'sticky_note' : 'job_photo',
          confidence: 0.75
        });
      }
    }
    
    // 3. Get place names from sticky notes AI proposals
    const stickyResult = await client.query(`
      SELECT ai_proposed_payload
      FROM cc_ai_ingestions
      WHERE contractor_profile_id = $1
        AND tenant_id = $2
        AND source_type = 'sticky_note'
        AND ai_proposed_payload IS NOT NULL
    `, [contractorProfileId, tenantId]);
    
    for (const row of stickyResult.rows) {
      const payload = row.ai_proposed_payload;
      // Check for place names in various payload structures
      if (payload?.location) {
        signals.push({
          type: 'place_name',
          value: payload.location,
          source: 'sticky_note',
          confidence: 0.70
        });
      }
      if (payload?.city) {
        signals.push({
          type: 'city',
          value: payload.city,
          source: 'sticky_note',
          confidence: 0.65
        });
      }
      if (payload?.address) {
        signals.push({
          type: 'address',
          value: payload.address,
          source: 'sticky_note',
          confidence: 0.60
        });
      }
    }
    
    return signals;
  } finally {
    client.release();
  }
}

/**
 * Cluster GPS points to find common work areas
 */
function clusterGpsPoints(
  points: Array<{ lat: number; lng: number; source: CoverageSource }>
): Array<{ center: { lat: number; lng: number }; radius_km: number; count: number; sources: CoverageSource[] }> {
  if (points.length === 0) return [];
  
  // Simple clustering: find centroid and spread
  // In production, use proper clustering algorithm (DBSCAN, etc.)
  
  const clusters: Array<{ center: { lat: number; lng: number }; radius_km: number; count: number; sources: CoverageSource[] }> = [];
  
  if (points.length === 1) {
    clusters.push({
      center: { lat: points[0].lat, lng: points[0].lng },
      radius_km: 15, // Default radius for single point
      count: 1,
      sources: [points[0].source]
    });
  } else {
    // Calculate centroid
    const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
    const sumLng = points.reduce((sum, p) => sum + p.lng, 0);
    const center = {
      lat: sumLat / points.length,
      lng: sumLng / points.length
    };
    
    // Calculate max distance from centroid (in km, rough approximation)
    let maxDist = 0;
    for (const p of points) {
      const dist = Math.sqrt(
        Math.pow((p.lat - center.lat) * 111, 2) +
        Math.pow((p.lng - center.lng) * 111 * Math.cos(center.lat * Math.PI / 180), 2)
      );
      if (dist > maxDist) maxDist = dist;
    }
    
    clusters.push({
      center,
      radius_km: Math.max(10, Math.min(50, maxDist * 1.2)), // Between 10-50km
      count: points.length,
      sources: Array.from(new Set(points.map(p => p.source)))
    });
  }
  
  return clusters;
}

/**
 * Look up known portals/zones near a location
 * STUB: Returns empty array until portal/zone tables are populated
 */
async function findNearbyPortalsAndZones(
  lat: number,
  lng: number,
  tenantId: string
): Promise<Array<{ type: 'portal' | 'zone'; id: string; name: string; distance_km: number }>> {
  // STUB: In production, query cc_portals and cc_zones tables
  // with spatial queries to find nearby areas
  return [];
}

/**
 * Generate service area proposals from collected signals
 */
export async function proposeServiceAreas(
  contractorProfileId: string,
  tenantId: string,
  portalId?: string
): Promise<ServiceAreaProposal[]> {
  const proposals: ServiceAreaProposal[] = [];
  const signals = await collectLocationSignals(contractorProfileId, tenantId);
  
  // Extract GPS points
  const gpsPoints: Array<{ lat: number; lng: number; source: CoverageSource }> = [];
  for (const signal of signals) {
    if (signal.type === 'gps' && typeof signal.value === 'object' && 'lat' in signal.value) {
      gpsPoints.push({
        lat: signal.value.lat,
        lng: signal.value.lng,
        source: signal.source
      });
    }
  }
  
  // Cluster GPS points into service areas
  const clusters = clusterGpsPoints(gpsPoints);
  
  for (const cluster of clusters) {
    proposals.push({
      id: `radius-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      coverage_type: 'radius',
      coverage_payload: {
        lat: cluster.center.lat,
        lng: cluster.center.lng,
        radius_km: cluster.radius_km
      } as RadiusCoverage,
      confidence: Math.min(0.90, 0.60 + (cluster.count * 0.05)),
      source: cluster.sources[0] || 'job_photo',
      evidence: [`${cluster.count} photo location(s) detected`]
    });
    
    // Check for nearby portals/zones
    const nearbyAreas = await findNearbyPortalsAndZones(
      cluster.center.lat,
      cluster.center.lng,
      tenantId
    );
    
    for (const area of nearbyAreas) {
      proposals.push({
        id: `${area.type}-${area.id}-${Date.now()}`,
        coverage_type: area.type,
        portal_id: area.type === 'portal' ? area.id : undefined,
        portal_name: area.type === 'portal' ? area.name : undefined,
        zone_id: area.type === 'zone' ? area.id : undefined,
        zone_label: area.type === 'zone' ? area.name : undefined,
        coverage_payload: {
          zone_label: area.type === 'zone' ? area.name : undefined,
          portal_name: area.type === 'portal' ? area.name : undefined
        } as ZoneCoverage,
        confidence: Math.max(0.50, 0.80 - (area.distance_km * 0.02)),
        source: cluster.sources[0] || 'job_photo',
        evidence: [`${area.distance_km.toFixed(1)}km from photo location`]
      });
    }
  }
  
  // Add place-name based proposals
  for (const signal of signals) {
    if (signal.type === 'place_name' || signal.type === 'city') {
      const placeName = typeof signal.value === 'string' ? signal.value : '';
      if (placeName) {
        // For now, create a generic radius coverage
        // In production, geocode the place name first
        proposals.push({
          id: `place-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          coverage_type: 'radius',
          coverage_payload: {
            lat: 0, // Would be geocoded
            lng: 0,
            radius_km: 25
          } as RadiusCoverage,
          confidence: signal.confidence,
          source: signal.source,
          evidence: [`Place name: "${placeName}"`]
        });
      }
    }
  }
  
  // Sort by confidence
  proposals.sort((a, b) => b.confidence - a.confidence);
  
  return proposals;
}

/**
 * Save proposals to ingestion record
 */
export async function saveProposalsToIngestion(
  ingestionId: string,
  proposals: ServiceAreaProposal[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE cc_ai_ingestions
      SET 
        proposed_service_areas = $1,
        service_area_status = 'proposed',
        updated_at = now()
      WHERE id = $2
    `, [JSON.stringify(proposals), ingestionId]);
  } finally {
    client.release();
  }
}

/**
 * Confirm selected service areas and save to contractor profile
 */
export async function confirmServiceAreas(
  contractorProfileId: string,
  confirmed: Array<{
    proposal: ServiceAreaProposal;
    is_published: boolean;
  }>
): Promise<string[]> {
  const client = await pool.connect();
  const savedIds: string[] = [];
  
  try {
    for (const { proposal, is_published } of confirmed) {
      const result = await client.query(`
        INSERT INTO cc_contractor_service_areas (
          contractor_profile_id,
          portal_id,
          zone_id,
          coverage_type,
          coverage_payload,
          confidence,
          source,
          is_confirmed,
          is_active,
          is_published,
          confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, $8, now())
        RETURNING id
      `, [
        contractorProfileId,
        proposal.portal_id || null,
        proposal.zone_id || null,
        proposal.coverage_type,
        JSON.stringify(proposal.coverage_payload),
        proposal.confidence,
        proposal.source,
        is_published
      ]);
      
      savedIds.push(result.rows[0].id);
    }
    
    return savedIds;
  } finally {
    client.release();
  }
}

/**
 * Get existing confirmed service areas for a contractor
 */
export async function getContractorServiceAreas(
  contractorProfileId: string
): Promise<Array<{
  id: string;
  coverage_type: CoverageType;
  coverage_payload: any;
  confidence: number;
  source: CoverageSource;
  is_published: boolean;
  confirmed_at: string | null;
}>> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        id,
        coverage_type,
        coverage_payload,
        confidence,
        source,
        is_published,
        confirmed_at
      FROM cc_contractor_service_areas
      WHERE contractor_profile_id = $1
        AND is_active = true
      ORDER BY confirmed_at DESC
    `, [contractorProfileId]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Update publish preference for a service area
 */
export async function updateServiceAreaPublishState(
  serviceAreaId: string,
  isPublished: boolean
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE cc_contractor_service_areas
      SET is_published = $1
      WHERE id = $2
    `, [isPublished, serviceAreaId]);
  } finally {
    client.release();
  }
}

/**
 * Deactivate a service area (soft delete)
 */
export async function deactivateServiceArea(
  serviceAreaId: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE cc_contractor_service_areas
      SET is_active = false
      WHERE id = $1
    `, [serviceAreaId]);
  } finally {
    client.release();
  }
}

/**
 * V3.3.1 Block 10: Availability Service
 * Operator dashboard and public portal availability with disclosure layer
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getDisclosureSignal } from './visibilityService';
import type { 
  OperatorDashboardAvailabilityResponse 
} from '../../shared/types/operatorDashboardAvailability';
import type { 
  PublicPortalAvailabilityResponse 
} from '../../shared/types/publicPortalAvailability';
import type { 
  AvailabilitySignal, 
  ScarcityBand, 
  NextAction 
} from '../../shared/types/availability';

export interface AvailabilityQuery {
  portalSlug: string;
  communityId: string;
  startDate: Date;
  endDate: Date;
  channel: 'internal_ops' | 'chamber_desk' | 'public';
  includeTruthOnly?: boolean;
  includeWebcams?: boolean;
  includeIncidents?: boolean;
  assetTypes?: string[];
  requirements?: {
    partySize?: number;
    boatLengthFt?: number;
    combinedLengthFt?: number;
  };
}

interface FacilityRow {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  tenantId: string;
  tenantName: string;
  latitude: number | null;
  longitude: number | null;
}

interface InventoryUnit {
  unitId: string;
  displayLabel: string;
  unitType: string;
  facilityId: string;
}

interface AllocationInfo {
  inventoryUnitId: string;
  startAt: Date;
  endAt: Date;
}

async function computeTruthSignal(
  facilityId: string,
  unitType: string,
  startDate: Date,
  endDate: Date
): Promise<AvailabilitySignal> {
  const result = await db.execute(sql`
    SELECT iu.id
    FROM cc_inventory_units iu
    WHERE iu.facility_id = ${facilityId}
      AND iu.unit_type = ${unitType}
      AND iu.is_active = true
      AND iu.id NOT IN (
        SELECT a.inventory_unit_id
        FROM cc_allocations a
        WHERE a.status = 'active'
          AND a.start_at < ${endDate.toISOString()}
          AND a.end_at > ${startDate.toISOString()}
      )
  `);
  
  const availableCount = result.rows.length;
  
  if (availableCount === 0) return 'unavailable';
  if (availableCount < 3) return 'limited';
  return 'available';
}

function signalToScarcityBand(signal: AvailabilitySignal): ScarcityBand {
  switch (signal) {
    case 'available': return 'available';
    case 'limited': return 'limited';
    case 'waitlist': return 'scarce';
    case 'call_to_confirm': return 'call_to_confirm';
    case 'unavailable': return 'unavailable';
    default: return 'unavailable';
  }
}

function disclosureToNextAction(
  nextAction: string
): NextAction {
  switch (nextAction) {
    case 'book_now': return 'book_request';
    case 'book_request': return 'book_request';
    case 'call_provider': return 'call_provider';
    case 'waitlist': return 'waitlist';
    default: return 'unavailable';
  }
}

export async function getOperatorAvailability(
  query: AvailabilityQuery
): Promise<OperatorDashboardAvailabilityResponse> {
  const traceId = crypto.randomUUID();
  
  const portalResult = await db.execute(sql`
    SELECT p.id, p.slug, p.owning_tenant_id as community_id
    FROM cc_portals p
    WHERE p.slug = ${query.portalSlug}
    LIMIT 1
  `);
  
  if (portalResult.rows.length === 0) {
    return {
      apiVersion: '3.3',
      traceId,
      portal: {
        id: crypto.randomUUID(),
        slug: query.portalSlug,
        communityId: query.communityId
      },
      window: {
        start: query.startDate.toISOString(),
        end: query.endDate.toISOString()
      },
      granularityMinutes: 1440,
      rows: [],
      disclosurePolicy: {
        mode: 'scarcity_bookable',
        neverExposeCounts: true
      }
    };
  }
  
  const portal = portalResult.rows[0];
  
  const facilitiesResult = await db.execute(sql`
    SELECT 
      f.id as facility_id,
      f.name as facility_name,
      f.facility_type,
      f.tenant_id,
      t.name as tenant_name,
      f.geo_lat as latitude,
      f.geo_lon as longitude
    FROM cc_facilities f
    JOIN cc_tenants t ON t.id = f.tenant_id
    WHERE f.is_active = true
      AND f.community_id = ${query.communityId}::uuid
    ORDER BY t.name, f.name
  `);
  
  const facilities = facilitiesResult.rows as unknown as FacilityRow[];
  
  const rows: OperatorDashboardAvailabilityResponse['rows'] = [];
  const markers: OperatorDashboardAvailabilityResponse['map'] = { markers: [] };
  
  const providerGroups: Record<string, FacilityRow[]> = {};
  for (const f of facilities) {
    const existing = providerGroups[f.tenantId] || [];
    existing.push(f);
    providerGroups[f.tenantId] = existing;
  }
  
  for (const tenantId of Object.keys(providerGroups)) {
    const providerFacilities = providerGroups[tenantId];
    const providerName = providerFacilities[0]?.tenantName || 'Unknown';
    
    const items: OperatorDashboardAvailabilityResponse['rows'][0]['items'] = [];
    const categorySignals: { category: string; availability: AvailabilitySignal; scarcityBand: ScarcityBand }[] = [];
    
    for (const facility of providerFacilities) {
      const truthSignal = await computeTruthSignal(
        facility.facilityId,
        facility.facilityType,
        query.startDate,
        query.endDate
      );
      
      const disclosure = await getDisclosureSignal(
        facility.facilityId,
        truthSignal,
        query.startDate,
        query.endDate
      );
      
      const assetType = mapFacilityTypeToAssetType(facility.facilityType);
      
      const item = {
        assetId: facility.facilityId,
        assetType: assetType as 'lodging' | 'slip' | 'parking' | 'segment' | 'room',
        title: facility.facilityName,
        location: facility.latitude && facility.longitude ? {
          latitude: facility.latitude,
          longitude: facility.longitude
        } : undefined,
        availability: disclosure.disclosedSignal,
        scarcityBand: signalToScarcityBand(disclosure.disclosedSignal),
        confidence: 0.95,
        nextAction: disclosureToNextAction(disclosure.nextAction),
        sourceVisibility: query.includeTruthOnly && disclosure.disclosedSignal !== truthSignal 
          ? 'truth_only' as const
          : 'disclosed' as const,
        truthAvailability: query.channel !== 'public' ? truthSignal : undefined,
      };
      
      items.push(item);
      
      categorySignals.push({
        category: facility.facilityType,
        availability: disclosure.disclosedSignal,
        scarcityBand: signalToScarcityBand(disclosure.disclosedSignal)
      });
    }
    
    if (items.length > 0) {
      rows.push({
        rowId: `provider-${tenantId}`,
        rowType: 'provider',
        providerTenantId: tenantId,
        providerDisplayName: providerName,
        category: providerFacilities[0]?.facilityType || 'mixed',
        items
      });
      
      const firstFacility = providerFacilities.find((f: FacilityRow) => f.latitude && f.longitude);
      if (firstFacility) {
        markers.markers.push({
          markerId: `marker-${tenantId}`,
          providerTenantId: tenantId,
          label: providerName,
          latitude: firstFacility.latitude!,
          longitude: firstFacility.longitude!,
          categorySignals
        });
      }
    }
  }
  
  let incidents: OperatorDashboardAvailabilityResponse['incidents'] = undefined;
  if (query.includeIncidents) {
    const incidentsResult = await db.execute(sql`
      SELECT 
        id, incident_number, status, incident_type, severity,
        latitude, longitude, created_at
      FROM cc_incidents
      WHERE status = 'open'
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    incidents = incidentsResult.rows.map(row => ({
      id: row.id as string,
      incidentNumber: row.incident_number as string,
      status: row.status as string,
      incidentType: row.incident_type as string,
      severity: row.severity as string,
      location: row.latitude && row.longitude ? {
        latitude: row.latitude as number,
        longitude: row.longitude as number
      } : undefined,
      createdAt: (row.created_at as Date).toISOString()
    }));
  }
  
  return {
    apiVersion: '3.3',
    traceId,
    portal: {
      id: portal.id as string,
      slug: portal.slug as string,
      communityId: query.communityId
    },
    window: {
      start: query.startDate.toISOString(),
      end: query.endDate.toISOString()
    },
    filtersEcho: {
      types: query.assetTypes,
      view: 'grid',
      includeTruthOnly: query.includeTruthOnly
    },
    granularityMinutes: 1440,
    rows,
    map: markers,
    incidents,
    disclosurePolicy: {
      mode: 'scarcity_bookable',
      neverExposeCounts: true
    }
  };
}

export async function getPublicAvailability(
  query: AvailabilityQuery
): Promise<PublicPortalAvailabilityResponse> {
  const portalResult = await db.execute(sql`
    SELECT p.id, p.slug, p.owning_tenant_id as community_id
    FROM cc_portals p
    WHERE p.slug = ${query.portalSlug}
    LIMIT 1
  `);
  
  if (portalResult.rows.length === 0) {
    return {
      apiVersion: '3.3',
      portal: {
        id: crypto.randomUUID(),
        slug: query.portalSlug
      },
      window: {
        start: query.startDate.toISOString(),
        end: query.endDate.toISOString()
      },
      results: [],
      granularityMinutes: 1440,
      disclosurePolicy: {
        mode: 'scarcity_bookable',
        neverExposeCounts: true
      }
    };
  }
  
  const portal = portalResult.rows[0];
  const communityId = portal.community_id as string;
  
  const facilitiesResult = await db.execute(sql`
    SELECT 
      f.id as facility_id,
      f.name as facility_name,
      f.facility_type,
      f.tenant_id,
      t.name as tenant_name,
      f.geo_lat as latitude,
      f.geo_lon as longitude
    FROM cc_facilities f
    JOIN cc_tenants t ON t.id = f.tenant_id
    LEFT JOIN cc_asset_visibility_policies vp ON vp.facility_id = f.id
    WHERE f.is_active = true
      AND f.community_id = ${communityId}::uuid
      AND (vp.public_can_show = true OR vp.id IS NULL)
    ORDER BY t.name, f.name
  `);
  
  const facilities = facilitiesResult.rows as unknown as FacilityRow[];
  
  const results: PublicPortalAvailabilityResponse['results'] = [];
  
  for (const facility of facilities) {
    const truthSignal = await computeTruthSignal(
      facility.facilityId,
      facility.facilityType,
      query.startDate,
      query.endDate
    );
    
    const disclosure = await getDisclosureSignal(
      facility.facilityId,
      truthSignal,
      query.startDate,
      query.endDate
    );
    
    const assetType = mapFacilityTypeToAssetType(facility.facilityType);
    if (!['lodging', 'slip', 'parking'].includes(assetType)) continue;
    
    results.push({
      assetId: facility.facilityId,
      assetType: assetType as 'lodging' | 'slip' | 'parking',
      providerTenantId: facility.tenantId,
      providerDisplayName: facility.tenantName,
      title: facility.facilityName,
      availability: disclosure.disclosedSignal,
      scarcityBand: signalToScarcityBand(disclosure.disclosedSignal),
      confidence: 0.95,
      nextAction: disclosureToNextAction(disclosure.nextAction),
      location: facility.latitude && facility.longitude ? {
        latitude: facility.latitude,
        longitude: facility.longitude
      } : undefined
    });
  }
  
  return {
    apiVersion: '3.3',
    portal: {
      id: portal.id as string,
      slug: portal.slug as string
    },
    window: {
      start: query.startDate.toISOString(),
      end: query.endDate.toISOString()
    },
    results,
    granularityMinutes: 1440,
    disclosurePolicy: {
      mode: 'scarcity_bookable',
      neverExposeCounts: true
    }
  };
}

function mapFacilityTypeToAssetType(facilityType: string): string {
  switch (facilityType) {
    case 'parking': return 'parking';
    case 'marina': return 'slip';
    case 'dock': return 'segment';
    case 'accommodation':
    case 'lodging':
    case 'hotel':
    case 'cabin':
      return 'lodging';
    case 'meeting_room':
    case 'conference':
      return 'room';
    default:
      return 'lodging';
  }
}

export async function testOperatorAvailability(): Promise<{
  success: boolean;
  traceId?: string;
  rowCount?: number;
  markerCount?: number;
  hasDisclosurePolicy?: boolean;
  error?: string;
}> {
  try {
    const response = await getOperatorAvailability({
      portalSlug: 'bamfield',
      communityId: '00000000-0000-0000-0000-000000000001',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      channel: 'chamber_desk',
      includeIncidents: true
    });
    
    return {
      success: true,
      traceId: response.traceId,
      rowCount: response.rows.length,
      markerCount: response.map?.markers.length || 0,
      hasDisclosurePolicy: response.disclosurePolicy.neverExposeCounts === true
    };
  } catch (error: any) {
    return {
      success: false,
      error: String(error)
    };
  }
}

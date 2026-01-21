/**
 * A2.3 / Patent CC-11: Route + Coverage + Opportunity Inference Engine
 * 
 * Analyzes contractor's jobsite locations, fleet capabilities, and service areas
 * to identify expansion opportunities:
 * 
 * - Common travel corridors
 * - Under-served community portals
 * - Asset-driven upsells (snow blade, etc.)
 * - Seasonal demand matches
 * 
 * INVENTOR: Glenn Ballman
 */

import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  ccContractorJobsites,
  ccContractorFleet,
  ccContractorServiceAreas,
  ccContractorOpportunities,
  ccContractorProfiles,
  type ContractorOpportunity,
  type ContractorFleet,
  type ContractorJobsite,
} from '@shared/schema';

// ============================================================================
// Types
// ============================================================================

export interface RouteOpportunity {
  opportunityType: 'zone_expansion' | 'asset_upsell' | 'route_corridor' | 'seasonal';
  portalId?: string;
  zoneId?: string;
  reason: string;
  confidence: number;
  details: OpportunityDetails;
}

export interface OpportunityDetails {
  suggestedAsset?: string;
  fitsWith?: string[];
  openRequestsCount?: number;
  distanceFromCurrent?: number;
  demandLevel?: 'low' | 'medium' | 'high';
  seasonalWindow?: string;
  routeCorridor?: {
    from: string;
    to: string;
    midpoints: string[];
  };
}

export interface TravelCorridor {
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
  frequency: number;
  distance: number;
}

export interface FleetCapability {
  hasTruck: boolean;
  hasTrailer: boolean;
  hasVan: boolean;
  truckCount: number;
  trailerCount: number;
  vanCount: number;
  capabilities: string[];
}

// ============================================================================
// Analyze Fleet Capabilities
// ============================================================================

export async function analyzeFleetCapabilities(
  contractorProfileId: string
): Promise<FleetCapability> {
  const fleet = await db.query.ccContractorFleet.findMany({
    where: and(
      eq(ccContractorFleet.contractorProfileId, contractorProfileId),
      eq(ccContractorFleet.isActive, true)
    )
  });
  
  const capability: FleetCapability = {
    hasTruck: false,
    hasTrailer: false,
    hasVan: false,
    truckCount: 0,
    trailerCount: 0,
    vanCount: 0,
    capabilities: []
  };
  
  for (const asset of fleet) {
    if (asset.assetType === 'truck') {
      capability.hasTruck = true;
      capability.truckCount++;
    }
    if (asset.assetType === 'trailer') {
      capability.hasTrailer = true;
      capability.trailerCount++;
    }
    if (asset.assetType === 'van') {
      capability.hasVan = true;
      capability.vanCount++;
    }
    
    // Extract capabilities from asset
    const caps = asset.capabilities as Record<string, boolean> || {};
    for (const [key, value] of Object.entries(caps)) {
      if (value && !capability.capabilities.includes(key)) {
        capability.capabilities.push(key);
      }
    }
  }
  
  return capability;
}

// ============================================================================
// Analyze Jobsite Clusters for Travel Corridors
// ============================================================================

export async function analyzeJobsiteClusters(
  contractorProfileId: string
): Promise<{ clusters: Array<{ lat: number; lng: number; count: number; name: string }>; corridors: TravelCorridor[] }> {
  const jobsites = await db.query.ccContractorJobsites.findMany({
    where: and(
      eq(ccContractorJobsites.contractorProfileId, contractorProfileId),
      eq(ccContractorJobsites.isActive, true)
    )
  });
  
  // Simple clustering: group jobsites by rough location
  const clusters: Array<{ lat: number; lng: number; count: number; name: string }> = [];
  const visited = new Set<string>();
  
  for (const js of jobsites) {
    if (!js.geoLat || !js.geoLng) continue;
    
    const lat = Number(js.geoLat);
    const lng = Number(js.geoLng);
    const key = `${Math.round(lat * 100)},${Math.round(lng * 100)}`;
    
    if (!visited.has(key)) {
      visited.add(key);
      
      // Count jobsites in this cluster (within ~1km)
      const count = jobsites.filter(other => {
        if (!other.geoLat || !other.geoLng) return false;
        const oLat = Number(other.geoLat);
        const oLng = Number(other.geoLng);
        return Math.abs(oLat - lat) < 0.01 && Math.abs(oLng - lng) < 0.01;
      }).length;
      
      // Use proposed address as name, or generate one
      const name = js.proposedAddress || js.confirmedAddress || `Area ${clusters.length + 1}`;
      
      clusters.push({ lat, lng, count, name });
    }
  }
  
  // Identify travel corridors (pairs of clusters that are frequently visited)
  const corridors: TravelCorridor[] = [];
  
  if (clusters.length >= 2) {
    // Sort by count (most visited first)
    clusters.sort((a, b) => b.count - a.count);
    
    // Create corridors between top clusters
    for (let i = 0; i < Math.min(3, clusters.length); i++) {
      for (let j = i + 1; j < Math.min(4, clusters.length); j++) {
        const distance = haversineDistance(
          clusters[i].lat, clusters[i].lng,
          clusters[j].lat, clusters[j].lng
        );
        
        corridors.push({
          from: { lat: clusters[i].lat, lng: clusters[i].lng, name: clusters[i].name },
          to: { lat: clusters[j].lat, lng: clusters[j].lng, name: clusters[j].name },
          frequency: clusters[i].count + clusters[j].count,
          distance
        });
      }
    }
  }
  
  return { clusters, corridors };
}

// ============================================================================
// Haversine Distance (km)
// ============================================================================

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// Asset-Driven Upsell Detection (Core of Patent CC-11)
// ============================================================================

interface AssetUpsell {
  existingAsset: string;
  suggestedAddition: string;
  reason: string;
  potentialServices: string[];
  estimatedDemand: number;
}

function detectAssetUpsells(fleetCapability: FleetCapability): AssetUpsell[] {
  const upsells: AssetUpsell[] = [];
  
  // Truck → Snow Blade
  if (fleetCapability.hasTruck && !fleetCapability.capabilities.includes('snow_blade')) {
    upsells.push({
      existingAsset: 'truck',
      suggestedAddition: 'snow_blade',
      reason: 'You already have a truck. You could offer snow removal.',
      potentialServices: ['Snow Removal', 'Driveway Clearing', 'Commercial Plowing'],
      estimatedDemand: 85 // Stub demand score
    });
  }
  
  // Truck → Trailer (for equipment transport)
  if (fleetCapability.hasTruck && !fleetCapability.hasTrailer) {
    upsells.push({
      existingAsset: 'truck',
      suggestedAddition: 'trailer',
      reason: 'Add a trailer to transport equipment for larger jobs.',
      potentialServices: ['Equipment Transport', 'Bulk Material Delivery', 'Heavy Equipment Moving'],
      estimatedDemand: 65
    });
  }
  
  // Trailer → Enclosed trailer (for secure transport)
  if (fleetCapability.hasTrailer && !fleetCapability.capabilities.includes('enclosed')) {
    upsells.push({
      existingAsset: 'trailer',
      suggestedAddition: 'enclosed_trailer',
      reason: 'An enclosed trailer enables secure tool storage and bad-weather work.',
      potentialServices: ['Mobile Workshop', 'Tool Transport', 'Secure Storage'],
      estimatedDemand: 45
    });
  }
  
  // Van → Ladder Rack
  if (fleetCapability.hasVan && !fleetCapability.capabilities.includes('ladder_rack')) {
    upsells.push({
      existingAsset: 'van',
      suggestedAddition: 'ladder_rack',
      reason: 'A ladder rack expands your service capabilities.',
      potentialServices: ['Roofing', 'Gutter Cleaning', 'Window Services'],
      estimatedDemand: 55
    });
  }
  
  return upsells;
}

// ============================================================================
// Under-Served Zone Detection (Stub - would use real portal/zone data)
// ============================================================================

interface UnderServedZone {
  portalId: string;
  portalName: string;
  zoneId?: string;
  zoneName?: string;
  serviceType: string;
  nearestProviderDistance: number;
  openRequestsCount: number;
  demandLevel: 'low' | 'medium' | 'high';
}

async function detectUnderServedZones(
  contractorProfileId: string,
  fleetCapability: FleetCapability
): Promise<UnderServedZone[]> {
  // Stub: In production, this would query:
  // - cc_portals for nearby community portals
  // - cc_work_requests for unmet demand
  // - cc_contractor_service_areas for existing coverage
  
  const zones: UnderServedZone[] = [];
  
  // Simulate finding under-served areas based on fleet
  if (fleetCapability.hasTruck) {
    zones.push({
      portalId: 'portal_humboldt',
      portalName: 'Humboldt',
      zoneId: 'zone_4',
      zoneName: 'Zone 4',
      serviceType: 'Landscaping',
      nearestProviderDistance: 35,
      openRequestsCount: 14,
      demandLevel: 'high'
    });
  }
  
  if (fleetCapability.hasVan) {
    zones.push({
      portalId: 'portal_yorkton',
      portalName: 'Yorkton',
      serviceType: 'Plumbing',
      nearestProviderDistance: 42,
      openRequestsCount: 8,
      demandLevel: 'medium'
    });
  }
  
  return zones;
}

// ============================================================================
// Seasonal Opportunity Detection
// ============================================================================

interface SeasonalOpportunity {
  season: string;
  serviceTypes: string[];
  peakMonths: string[];
  currentDemand: 'low' | 'medium' | 'high';
}

function detectSeasonalOpportunities(fleetCapability: FleetCapability): SeasonalOpportunity[] {
  const opportunities: SeasonalOpportunity[] = [];
  const month = new Date().getMonth(); // 0-11
  
  // Winter (Nov-Mar) - Snow services
  if (month >= 10 || month <= 2) {
    if (fleetCapability.hasTruck) {
      opportunities.push({
        season: 'Winter',
        serviceTypes: ['Snow Removal', 'Ice Management', 'Driveway Clearing'],
        peakMonths: ['November', 'December', 'January', 'February'],
        currentDemand: 'high'
      });
    }
  }
  
  // Spring (Apr-May) - Cleanup
  if (month >= 3 && month <= 4) {
    opportunities.push({
      season: 'Spring',
      serviceTypes: ['Yard Cleanup', 'Gutter Cleaning', 'Pressure Washing'],
      peakMonths: ['April', 'May'],
      currentDemand: 'high'
    });
  }
  
  // Summer (Jun-Aug) - Landscaping peak
  if (month >= 5 && month <= 7) {
    opportunities.push({
      season: 'Summer',
      serviceTypes: ['Landscaping', 'Lawn Care', 'Deck Building'],
      peakMonths: ['June', 'July', 'August'],
      currentDemand: 'high'
    });
  }
  
  // Fall (Sep-Oct) - Pre-winter prep
  if (month >= 8 && month <= 9) {
    opportunities.push({
      season: 'Fall',
      serviceTypes: ['Leaf Removal', 'Winterization', 'Gutter Cleaning'],
      peakMonths: ['September', 'October'],
      currentDemand: 'medium'
    });
  }
  
  return opportunities;
}

// ============================================================================
// Main Opportunity Inference Engine
// ============================================================================

export interface InferOpportunitiesResult {
  opportunities: RouteOpportunity[];
  fleetCapability: FleetCapability;
  travelCorridors: TravelCorridor[];
  assetUpsells: AssetUpsell[];
  underServedZones: UnderServedZone[];
  seasonalOpportunities: SeasonalOpportunity[];
}

export async function inferOpportunities(
  tenantId: string,
  contractorProfileId: string
): Promise<InferOpportunitiesResult> {
  // Gather all signals in parallel
  const [fleetCapability, jobsiteAnalysis, underServedZones] = await Promise.all([
    analyzeFleetCapabilities(contractorProfileId),
    analyzeJobsiteClusters(contractorProfileId),
    detectUnderServedZones(contractorProfileId, await analyzeFleetCapabilities(contractorProfileId))
  ]);
  
  const assetUpsells = detectAssetUpsells(fleetCapability);
  const seasonalOpportunities = detectSeasonalOpportunities(fleetCapability);
  
  const opportunities: RouteOpportunity[] = [];
  
  // Convert asset upsells to opportunities
  for (const upsell of assetUpsells) {
    opportunities.push({
      opportunityType: 'asset_upsell',
      reason: upsell.reason,
      confidence: Math.min(0.95, upsell.estimatedDemand / 100),
      details: {
        suggestedAsset: upsell.suggestedAddition,
        fitsWith: [upsell.existingAsset],
        demandLevel: upsell.estimatedDemand > 70 ? 'high' : (upsell.estimatedDemand > 40 ? 'medium' : 'low')
      }
    });
  }
  
  // Convert under-served zones to opportunities
  for (const zone of underServedZones) {
    opportunities.push({
      opportunityType: 'zone_expansion',
      portalId: zone.portalId,
      zoneId: zone.zoneId,
      reason: `No ${zone.serviceType.toLowerCase()} provider within ${zone.nearestProviderDistance} min of ${zone.portalName}.`,
      confidence: zone.demandLevel === 'high' ? 0.85 : (zone.demandLevel === 'medium' ? 0.65 : 0.45),
      details: {
        openRequestsCount: zone.openRequestsCount,
        distanceFromCurrent: zone.nearestProviderDistance,
        demandLevel: zone.demandLevel
      }
    });
  }
  
  // Convert travel corridors to route opportunities
  for (const corridor of jobsiteAnalysis.corridors) {
    if (corridor.frequency >= 3 && corridor.distance > 10) {
      opportunities.push({
        opportunityType: 'route_corridor',
        reason: `You frequently travel between ${corridor.from.name} and ${corridor.to.name}. Consider serving areas along this route.`,
        confidence: Math.min(0.80, corridor.frequency / 10),
        details: {
          routeCorridor: {
            from: corridor.from.name,
            to: corridor.to.name,
            midpoints: []
          },
          distanceFromCurrent: corridor.distance
        }
      });
    }
  }
  
  // Convert seasonal opportunities
  for (const seasonal of seasonalOpportunities) {
    opportunities.push({
      opportunityType: 'seasonal',
      reason: `${seasonal.season} is here! High demand for ${seasonal.serviceTypes.slice(0, 2).join(', ')}.`,
      confidence: seasonal.currentDemand === 'high' ? 0.88 : 0.65,
      details: {
        seasonalWindow: seasonal.peakMonths.join(', '),
        demandLevel: seasonal.currentDemand
      }
    });
  }
  
  return {
    opportunities,
    fleetCapability,
    travelCorridors: jobsiteAnalysis.corridors,
    assetUpsells,
    underServedZones,
    seasonalOpportunities
  };
}

// ============================================================================
// Store Opportunities in Database
// ============================================================================

export async function storeOpportunities(
  tenantId: string,
  contractorProfileId: string,
  opportunities: RouteOpportunity[]
): Promise<ContractorOpportunity[]> {
  const stored: ContractorOpportunity[] = [];
  
  for (const opp of opportunities) {
    const [record] = await db.insert(ccContractorOpportunities).values({
      tenantId,
      contractorProfileId,
      opportunityType: opp.opportunityType,
      portalId: opp.portalId,
      zoneId: opp.zoneId,
      reason: opp.reason,
      confidence: String(opp.confidence),
      details: opp.details,
      status: 'proposed',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }).returning();
    
    stored.push(record);
  }
  
  console.log(`[CC-11] Stored ${stored.length} opportunities for contractor ${contractorProfileId}`);
  return stored;
}

// ============================================================================
// Get Pending Opportunities
// ============================================================================

export async function getPendingOpportunities(
  contractorProfileId: string
): Promise<ContractorOpportunity[]> {
  return db.query.ccContractorOpportunities.findMany({
    where: and(
      eq(ccContractorOpportunities.contractorProfileId, contractorProfileId),
      eq(ccContractorOpportunities.status, 'proposed')
    ),
    orderBy: [desc(ccContractorOpportunities.createdAt)]
  });
}

// ============================================================================
// Respond to Opportunity
// ============================================================================

export async function respondToOpportunity(
  opportunityId: string,
  response: 'accepted' | 'dismissed'
): Promise<ContractorOpportunity | null> {
  const [updated] = await db.update(ccContractorOpportunities)
    .set({
      status: response,
      respondedAt: new Date()
    })
    .where(eq(ccContractorOpportunities.id, opportunityId))
    .returning();
  
  return updated || null;
}

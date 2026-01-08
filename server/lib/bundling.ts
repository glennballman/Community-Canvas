// =====================================================================
// BUNDLING INTELLIGENCE
// =====================================================================

import {
  ServiceWithDetails,
  CompatibilityWeights,
  BundleEdgeScore,
  SuggestedBundle
} from '../types/serviceRuns';

// Default weights for compatibility scoring
export const DEFAULT_COMPATIBILITY_WEIGHTS: CompatibilityWeights = {
  mobilization: 30,    // Same mobilization class
  access: 20,          // Shared access requirements
  certification: 20,   // Shared certifications
  sameVisit: 30        // Same category / practical synergy
};

// Known category adjacencies (categories that work well together)
const CATEGORY_ADJACENCIES = new Set([
  'roof-chimney|seasonal-tasks',
  'roof-chimney|pest-wildlife',
  'septic-water|seasonal-tasks',
  'waterfront-marine|seasonal-tasks',
  'grounds-property|safety-cc_inspections',
  'structural-foundations|drainage-water-control',
  'heating-fuel|seasonal-tasks',
  'electrical|seasonal-tasks',
  'drainage-water-control|septic-water'
]);

/**
 * Calculate intersection size of two arrays
 */
function intersectionSize(a: string[], b: string[]): number {
  const setA = new Set(a);
  return b.filter(x => setA.has(x)).length;
}

/**
 * Check if two categories are adjacent (work well together)
 */
function areCategoriesAdjacent(catA: string, catB: string): boolean {
  const key1 = `${catA}|${catB}`;
  const key2 = `${catB}|${catA}`;
  return CATEGORY_ADJACENCIES.has(key1) || CATEGORY_ADJACENCIES.has(key2);
}

/**
 * Score compatibility between two cc_services
 */
export function scoreServicePair(
  a: ServiceWithDetails,
  b: ServiceWithDetails,
  weights: CompatibilityWeights = DEFAULT_COMPATIBILITY_WEIGHTS
): BundleEdgeScore {
  let score = 0;
  const reasons: string[] = [];
  
  // Same mobilization class
  const mobA = a.mobilizationClass?.name;
  const mobB = b.mobilizationClass?.name;
  if (mobA && mobB && mobA === mobB) {
    score += weights.mobilization;
    reasons.push('same mobilization class');
  }
  
  // Shared access requirements
  const accessA = a.accessRequirements.map(ar => ar.name);
  const accessB = b.accessRequirements.map(ar => ar.name);
  const accessOverlap = intersectionSize(accessA, accessB);
  if (accessOverlap > 0) {
    score += Math.min(weights.access, accessOverlap * 10);
    reasons.push('shared access requirements');
  }
  
  // Shared certifications
  const certA = a.certifications.map(c => c.name);
  const certB = b.certifications.map(c => c.name);
  const certOverlap = intersectionSize(certA, certB);
  if (certOverlap > 0) {
    score += Math.min(weights.certification, certOverlap * 10);
    reasons.push('shared certifications/trades');
  }
  
  // Same category or adjacent categories
  const catA = a.category?.slug;
  const catB = b.category?.slug;
  if (catA && catB) {
    if (catA === catB) {
      score += weights.sameVisit;
      reasons.push('same category / same visit synergy');
    } else if (areCategoriesAdjacent(catA, catB)) {
      score += Math.floor(weights.sameVisit * 0.6);
      reasons.push('category adjacency synergy');
    }
  }
  
  // Weather dependency matching
  if (a.weatherDependent === b.weatherDependent) {
    score += 5;
    reasons.push('matching weather dependency');
  }
  
  // Crew size compatibility (similar crew needs)
  const crewDiff = Math.abs(a.crewTypical - b.crewTypical);
  if (crewDiff <= 1) {
    score += 5;
    reasons.push('similar crew requirements');
  }
  
  // Cap at 100
  score = Math.min(100, score);
  
  return {
    serviceASlug: a.slug,
    serviceBSlug: b.slug,
    score,
    reasons
  };
}

/**
 * Build compatibility graph for all cc_services
 */
export function buildCompatibilityGraph(
  services: ServiceWithDetails[],
  weights: CompatibilityWeights = DEFAULT_COMPATIBILITY_WEIGHTS,
  threshold: number = 50
): BundleEdgeScore[] {
  const edges: BundleEdgeScore[] = [];
  
  for (let i = 0; i < services.length; i++) {
    for (let j = i + 1; j < services.length; j++) {
      const edge = scoreServicePair(services[i], services[j], weights);
      if (edge.score >= threshold) {
        edges.push(edge);
      }
    }
  }
  
  return edges;
}

/**
 * Suggest bundles based on compatibility graph
 */
export function suggestBundles(
  services: ServiceWithDetails[],
  edges: BundleEdgeScore[],
  maxBundleSize: number = 8,
  minBundleSize: number = 3
): SuggestedBundle[] {
  // Build adjacency map
  const edgeMap = new Map<string, Map<string, number>>();
  for (const e of edges) {
    if (!edgeMap.has(e.serviceASlug)) edgeMap.set(e.serviceASlug, new Map());
    if (!edgeMap.has(e.serviceBSlug)) edgeMap.set(e.serviceBSlug, new Map());
    edgeMap.get(e.serviceASlug)!.set(e.serviceBSlug, e.score);
    edgeMap.get(e.serviceBSlug)!.set(e.serviceASlug, e.score);
  }
  
  // Rank cc_services by degree (number of compatible services)
  const degrees = cc_services
    .map(s => ({ slug: s.slug, name: s.name, deg: edgeMap.get(s.slug)?.size ?? 0 }))
    .sort((x, y) => y.deg - x.deg);
  
  const remaining = new Set(services.map(s => s.slug));
  const bundles: SuggestedBundle[] = [];
  
  // Greedy bundle building
  for (const seed of degrees) {
    if (!remaining.has(seed.slug) || seed.deg === 0) continue;
    
    const bundle: string[] = [seed.slug];
    remaining.delete(seed.slug);
    
    let totalScore = 0;
    
    while (bundle.length < maxBundleSize) {
      // Find candidate that has strong edges with ALL bundle members
      const candidates = Array.from(remaining)
        .map(slug => {
          let minEdge = Infinity;
          let sumEdge = 0;
          for (const b of bundle) {
            const s = edgeMap.get(slug)?.get(b) ?? 0;
            minEdge = Math.min(minEdge, s);
            sumEdge += s;
          }
          return { slug, minEdge, sumEdge };
        })
        .filter(x => x.minEdge >= 50);  // Must be compatible with all members
      
      if (candidates.length === 0) break;
      
      // Pick candidate with highest total compatibility
      candidates.sort((a, b) => b.sumEdge - a.sumEdge);
      const pick = candidates[0];
      
      bundle.push(pick.slug);
      remaining.delete(pick.slug);
      totalScore += pick.sumEdge;
    }
    
    // Only keep bundles with minimum size
    if (bundle.length >= minBundleSize) {
      const bundleServices = bundle.map(slug => 
        services.find(s => s.slug === slug)?.name ?? slug
      );
      
      bundles.push({
        services: bundle,
        totalScore,
        name: `Bundle: ${bundleServices[0]} + ${bundle.length - 1} more`,
        rationale: `${bundle.length} compatible services with total score ${totalScore}`
      });
    }
  }
  
  return bundles;
}

/**
 * Check if a service is eligible for a run based on seasonality
 */
export function isServiceEligibleForWeek(
  service: ServiceWithDetails,
  climateRegionId: string,
  week: number
): { eligible: boolean; reason: string } {
  const seasonality = service.seasonality.find(s => s.climateRegionId === climateRegionId);
  
  if (!seasonality) {
    return { eligible: true, reason: 'No seasonality restrictions' };
  }
  
  const { earliestWeek, latestWeek, hardStop } = seasonality;
  
  // Handle wrap-around (e.g., week 46 to week 10)
  let inRange: boolean;
  if (earliestWeek <= latestWeek) {
    inRange = week >= earliestWeek && week <= latestWeek;
  } else {
    // Wraps around year end
    inRange = week >= earliestWeek || week <= latestWeek;
  }
  
  if (inRange) {
    return { eligible: true, reason: 'Within seasonal window' };
  }
  
  if (hardStop) {
    return { 
      eligible: false, 
      reason: `Hard stop: only available weeks ${earliestWeek}-${latestWeek}` 
    };
  }
  
  return { 
    eligible: true, 
    reason: `Outside optimal window (${earliestWeek}-${latestWeek}) but can be scheduled` 
  };
}

/**
 * Get current week of year (1-52)
 */
export function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}

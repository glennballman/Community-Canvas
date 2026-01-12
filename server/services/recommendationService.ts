// server/services/recommendationService.ts
// Recommendation engine with weather-aware filtering for cart-first flow

import { serviceQuery } from '../db/tenantDb';

// ============ TYPES ============

interface RecommendationRequest {
  portalSlug?: string;
  portalId?: string;
  locationCode?: string;
  targetDate: Date;
  partyAdults?: number;
  partyChildren?: number;
  partyInfants?: number;
  needs?: {
    dietary?: { allergies?: string[]; restrictions?: string[] };
    accessibility?: { wheelchair?: boolean; limitedMobility?: boolean };
    pets?: { type?: string; count?: number };
  };
  intent?: {
    archetype?: 'family' | 'solo' | 'couple' | 'group' | 'corporate' | 'wedding';
    interests?: string[];
    budget?: 'budget' | 'mid' | 'premium';
  };
  excludeItemTypes?: string[];
  limit?: number;
}

interface RecommendationResult {
  item: {
    id: string;
    type: string;
    title: string;
    description?: string;
    facilityId?: string;
    offerId?: string;
    providerTenantId?: string;
    providerName?: string;
    basePrice?: number;
    currency?: string;
    imageUrl?: string;
  };
  score: number;
  reasons: string[];
  weatherFit: 'excellent' | 'good' | 'fair' | 'poor';
  weatherWarnings: string[];
  partyFit: 'excellent' | 'good' | 'fair' | 'poor';
  accessibilityNotes?: string[];
}

interface WeatherContext {
  month: number;
  avgHighC: number;
  avgLowC: number;
  rainProbPercent: number;
  fogProbPercent: number;
  daylightHours: number;
  bestFor: string[];
  avoidFor: string[];
  planningNotes: string;
}

// ============ WEATHER HELPERS ============

async function getWeatherContext(locationCode: string, date: Date): Promise<WeatherContext | null> {
  const month = date.getMonth() + 1;
  
  const result = await serviceQuery(`
    SELECT * FROM cc_weather_trends 
    WHERE location_code = $1 AND month = $2
    LIMIT 1
  `, [locationCode, month]);
  
  if (result.rows.length === 0) return null;
  
  const r = result.rows[0];
  return {
    month,
    avgHighC: Number(r.avg_high_c) || 15,
    avgLowC: Number(r.avg_low_c) || 8,
    rainProbPercent: r.rain_prob_percent || 50,
    fogProbPercent: r.fog_prob_percent || 20,
    daylightHours: Number(r.daylight_hours) || 12,
    bestFor: r.best_for || [],
    avoidFor: r.avoid_for || [],
    planningNotes: r.planning_notes || ''
  };
}

function assessWeatherFit(
  itemType: string,
  itemTags: string[],
  weather: WeatherContext
): { fit: 'excellent' | 'good' | 'fair' | 'poor'; warnings: string[] } {
  const warnings: string[] = [];
  let score = 50;
  
  const isBestFor = weather.bestFor.some(b => 
    itemTags.some(t => t.toLowerCase().includes(b.toLowerCase())) ||
    itemType.toLowerCase().includes(b.toLowerCase())
  );
  
  const isAvoidFor = weather.avoidFor.some(a => 
    itemTags.some(t => t.toLowerCase().includes(a.toLowerCase())) ||
    itemType.toLowerCase().includes(a.toLowerCase())
  );
  
  if (isBestFor) score += 30;
  if (isAvoidFor) {
    score -= 40;
    warnings.push(`This activity may not be ideal for ${weather.planningNotes}`);
  }
  
  const waterActivities = ['kayaking', 'swimming', 'paddleboard', 'boat', 'fishing'];
  const isWaterActivity = waterActivities.some(w => 
    itemType.toLowerCase().includes(w) || 
    itemTags.some(t => t.toLowerCase().includes(w))
  );
  
  if (isWaterActivity && weather.rainProbPercent > 50) {
    score -= 20;
    warnings.push(`${weather.rainProbPercent}% chance of rain - consider backup plan`);
  }
  
  const outdoorActivities = ['hiking', 'photography', 'whale watching', 'scenic'];
  const isOutdoor = outdoorActivities.some(o => 
    itemType.toLowerCase().includes(o) || 
    itemTags.some(t => t.toLowerCase().includes(o))
  );
  
  if (isOutdoor && weather.fogProbPercent > 30) {
    warnings.push(`${weather.fogProbPercent}% chance of fog - visibility may be limited`);
  }
  
  const indoorActivities = ['meal', 'accommodation', 'spa', 'workshop', 'class'];
  const isIndoor = indoorActivities.some(i => 
    itemType.toLowerCase().includes(i) || 
    itemTags.some(t => t.toLowerCase().includes(i))
  );
  
  if (isIndoor) {
    score += 10;
  }
  
  let fit: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 70) fit = 'excellent';
  else if (score >= 50) fit = 'good';
  else if (score >= 30) fit = 'fair';
  else fit = 'poor';
  
  return { fit, warnings };
}

// ============ PARTY FIT HELPERS ============

function assessPartyFit(
  itemType: string,
  itemConstraints: any,
  partyAdults: number,
  partyChildren: number,
  partyInfants: number
): { fit: 'excellent' | 'good' | 'fair' | 'poor'; notes: string[] } {
  const notes: string[] = [];
  const totalParty = partyAdults + partyChildren + partyInfants;
  let score = 50;
  
  if (itemConstraints?.maxOccupancy && totalParty > itemConstraints.maxOccupancy) {
    return { fit: 'poor', notes: [`Exceeds max capacity of ${itemConstraints.maxOccupancy}`] };
  }
  
  if (partyChildren > 0 || partyInfants > 0) {
    if (itemConstraints?.minAge && itemConstraints.minAge > 0) {
      notes.push(`Minimum age ${itemConstraints.minAge} required`);
      if (partyInfants > 0) score -= 30;
    }
    
    const familyFriendly = ['accommodation', 'meal', 'beach', 'park', 'nature'];
    if (familyFriendly.some(f => itemType.toLowerCase().includes(f))) {
      score += 20;
    }
  }
  
  const adultOnly = ['bar', 'wine', 'brewery', 'nightlife'];
  if (adultOnly.some(a => itemType.toLowerCase().includes(a))) {
    if (partyChildren > 0 || partyInfants > 0) {
      return { fit: 'poor', notes: ['Not suitable for children'] };
    }
  }
  
  if (totalParty === 1) {
    const soloFriendly = ['kayaking', 'hiking', 'photography', 'workshop'];
    if (soloFriendly.some(s => itemType.toLowerCase().includes(s))) {
      score += 15;
    }
  }
  
  if (totalParty >= 6) {
    if (itemConstraints?.groupFriendly) {
      score += 20;
    } else {
      notes.push('Contact provider for group availability');
    }
  }
  
  let fit: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 70) fit = 'excellent';
  else if (score >= 50) fit = 'good';
  else if (score >= 30) fit = 'fair';
  else fit = 'poor';
  
  return { fit, notes };
}

// ============ NEEDS/INTENT FIT HELPERS ============

function assessNeedsFit(
  itemType: string,
  itemConstraints: any,
  needs?: RecommendationRequest['needs']
): { fit: 'excellent' | 'good' | 'fair' | 'poor'; notes: string[] } {
  if (!needs) return { fit: 'good', notes: [] };
  
  const notes: string[] = [];
  let score = 50;
  
  if (needs.accessibility?.wheelchair) {
    if (itemConstraints?.wheelchairAccessible) {
      score += 20;
      notes.push('Wheelchair accessible');
    } else {
      score -= 30;
      notes.push('Wheelchair accessibility unknown - confirm with provider');
    }
  }
  
  if (needs.accessibility?.limitedMobility) {
    const mobilityFriendly = ['accommodation', 'meal', 'spa', 'scenic'];
    const mobilityHard = ['hiking', 'kayaking', 'climbing', 'trail'];
    
    if (mobilityFriendly.some(f => itemType.toLowerCase().includes(f))) {
      score += 15;
    }
    if (mobilityHard.some(h => itemType.toLowerCase().includes(h))) {
      score -= 25;
      notes.push('May be challenging for limited mobility');
    }
  }
  
  if (needs.pets?.count && needs.pets.count > 0) {
    if (itemConstraints?.petsAllowed) {
      score += 15;
      notes.push('Pet friendly');
    } else {
      score -= 20;
      notes.push('Pet policy unknown - confirm with provider');
    }
  }
  
  if (needs.dietary?.allergies?.length || needs.dietary?.restrictions?.length) {
    const foodRelated = ['meal', 'restaurant', 'dining', 'catering', 'food'];
    if (foodRelated.some(f => itemType.toLowerCase().includes(f))) {
      notes.push('Inform provider of dietary requirements');
    }
  }
  
  let fit: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 70) fit = 'excellent';
  else if (score >= 50) fit = 'good';
  else if (score >= 30) fit = 'fair';
  else fit = 'poor';
  
  return { fit, notes };
}

function assessIntentFit(
  itemType: string,
  basePrice: number | undefined,
  intent?: RecommendationRequest['intent']
): { score: number; reasons: string[] } {
  if (!intent) return { score: 0, reasons: [] };
  
  let score = 0;
  const reasons: string[] = [];
  
  if (intent.interests?.length) {
    const matchedInterests = intent.interests.filter(interest => 
      itemType.toLowerCase().includes(interest.toLowerCase())
    );
    if (matchedInterests.length > 0) {
      score += 15 * matchedInterests.length;
      reasons.push(`Matches your interest: ${matchedInterests.join(', ')}`);
    }
  }
  
  if (intent.archetype) {
    const archetypeMatch: Record<string, string[]> = {
      family: ['accommodation', 'beach', 'park', 'nature', 'meal'],
      solo: ['kayaking', 'hiking', 'photography', 'workshop'],
      couple: ['accommodation', 'spa', 'dining', 'scenic', 'romantic'],
      group: ['accommodation', 'meal', 'charter', 'tour'],
      corporate: ['meeting', 'conference', 'accommodation', 'meal'],
      wedding: ['accommodation', 'venue', 'catering', 'charter']
    };
    
    const matches = archetypeMatch[intent.archetype] || [];
    if (matches.some(m => itemType.toLowerCase().includes(m))) {
      score += 10;
      reasons.push(`Great for ${intent.archetype} trips`);
    }
  }
  
  if (intent.budget && basePrice) {
    const budgetThresholds = { budget: 100, mid: 300, premium: Infinity };
    const threshold = budgetThresholds[intent.budget];
    
    if (basePrice <= threshold) {
      score += 10;
    } else if (intent.budget === 'budget') {
      score -= 15;
      reasons.push('May exceed budget');
    }
  }
  
  return { score, reasons };
}

// ============ MAIN RECOMMENDATION FUNCTION ============

export async function getRecommendations(req: RecommendationRequest): Promise<{
  recommendations: RecommendationResult[];
  weatherContext: WeatherContext | null;
  totalFound: number;
}> {
  const limit = req.limit || 10;
  const locationCode = req.locationCode || 'BAMFIELD';
  
  const weather = await getWeatherContext(locationCode, req.targetDate);
  
  let tenantId: string | null = null;
  if (req.portalId) {
    const portalResult = await serviceQuery(`
      SELECT owning_tenant_id FROM cc_portals WHERE id = $1
    `, [req.portalId]);
    if (portalResult.rows.length > 0) {
      tenantId = portalResult.rows[0].owning_tenant_id;
    }
  }
  
  const facilitiesResult = await serviceQuery(`
    SELECT 
      f.id as facility_id,
      f.name as facility_name,
      f.facility_type,
      f.tenant_id,
      f.is_active,
      o.id as offer_id,
      o.name as offer_name,
      o.description as offer_description,
      o.offer_type,
      o.price_cents,
      o.currency,
      o.constraints
    FROM cc_facilities f
    LEFT JOIN cc_offers o ON o.facility_id = f.id AND o.is_active = true
    WHERE f.is_active = true
    ${tenantId ? 'AND f.tenant_id = $1' : ''}
    ORDER BY f.name
  `, tenantId ? [tenantId] : []);
  
  const recommendations: RecommendationResult[] = [];
  
  for (const row of facilitiesResult.rows) {
    if (!row.offer_id) continue;
    
    if (req.excludeItemTypes?.includes(row.facility_type)) continue;
    
    const itemTags = [
      row.facility_type,
      row.offer_type
    ].filter(Boolean);
    
    const weatherAssessment = weather 
      ? assessWeatherFit(row.facility_type || '', itemTags, weather)
      : { fit: 'good' as const, warnings: [] };
    
    const partyAssessment = assessPartyFit(
      row.facility_type || '',
      row.constraints || {},
      req.partyAdults || 1,
      req.partyChildren || 0,
      req.partyInfants || 0
    );
    
    const needsAssessment = assessNeedsFit(
      row.facility_type || '',
      row.constraints || {},
      req.needs
    );
    
    const basePrice = row.price_cents ? row.price_cents / 100 : undefined;
    const intentAssessment = assessIntentFit(row.facility_type || '', basePrice, req.intent);
    
    const weatherScore = { excellent: 40, good: 30, fair: 20, poor: 10 }[weatherAssessment.fit];
    const partyScore = { excellent: 30, good: 20, fair: 10, poor: 5 }[partyAssessment.fit];
    const needsScore = { excellent: 20, good: 15, fair: 10, poor: 0 }[needsAssessment.fit];
    const score = weatherScore + partyScore + needsScore + intentAssessment.score;
    
    const reasons: string[] = [...intentAssessment.reasons];
    if (weatherAssessment.fit === 'excellent') reasons.push('Perfect weather conditions');
    if (partyAssessment.fit === 'excellent') reasons.push('Great for your group');
    if (needsAssessment.fit === 'excellent') reasons.push('Meets your accessibility needs');
    if (weather?.bestFor.some(b => itemTags.some(t => t.toLowerCase().includes(b.toLowerCase())))) {
      reasons.push(`Best time for ${weather.bestFor[0]}`);
    }
    
    recommendations.push({
      item: {
        id: row.offer_id,
        type: row.facility_type || 'activity',
        title: row.offer_name,
        description: row.offer_description,
        facilityId: row.facility_id,
        offerId: row.offer_id,
        providerTenantId: row.tenant_id,
        providerName: row.facility_name,
        basePrice: row.price_cents ? row.price_cents / 100 : undefined,
        currency: row.currency || 'CAD'
      },
      score,
      reasons,
      weatherFit: weatherAssessment.fit,
      weatherWarnings: weatherAssessment.warnings,
      partyFit: partyAssessment.fit,
      accessibilityNotes: [...partyAssessment.notes, ...needsAssessment.notes]
    });
  }
  
  recommendations.sort((a, b) => b.score - a.score);
  
  const limited = recommendations.slice(0, limit);
  
  return {
    recommendations: limited,
    weatherContext: weather,
    totalFound: recommendations.length
  };
}

// ============ WEATHER SUMMARY ============

export async function getWeatherSummary(
  locationCode: string,
  startDate: Date,
  endDate: Date
): Promise<{
  months: WeatherContext[];
  summary: string;
  bestActivities: string[];
  warnings: string[];
}> {
  const startMonth = startDate.getMonth() + 1;
  const endMonth = endDate.getMonth() + 1;
  
  const result = await serviceQuery(`
    SELECT * FROM cc_weather_trends 
    WHERE location_code = $1 
      AND month >= $2 AND month <= $3
    ORDER BY month
  `, [locationCode, startMonth, endMonth]);
  
  const months = result.rows.map(r => ({
    month: r.month,
    avgHighC: Number(r.avg_high_c),
    avgLowC: Number(r.avg_low_c),
    rainProbPercent: r.rain_prob_percent || 0,
    fogProbPercent: r.fog_prob_percent || 0,
    daylightHours: Number(r.daylight_hours),
    bestFor: r.best_for || [],
    avoidFor: r.avoid_for || [],
    planningNotes: r.planning_notes || ''
  }));
  
  const allBestFor = months.flatMap(m => m.bestFor);
  const bestActivities = Array.from(new Set(allBestFor));
  
  const warnings: string[] = [];
  if (months.length > 0) {
    const avgRain = months.reduce((s, m) => s + m.rainProbPercent, 0) / months.length;
    if (avgRain > 50) {
      warnings.push(`High chance of rain (${Math.round(avgRain)}% average) - pack rain gear`);
    }
    
    const avgFog = months.reduce((s, m) => s + m.fogProbPercent, 0) / months.length;
    if (avgFog > 25) {
      warnings.push(`Morning fog common (${Math.round(avgFog)}% chance) - plan activities accordingly`);
    }
  }
  
  const summary = months.length === 1
    ? months[0].planningNotes
    : months.length > 1
    ? `Your trip spans ${months.length} months with varying conditions.`
    : 'No weather data available for this period.';
  
  return { months, summary, bestActivities, warnings };
}

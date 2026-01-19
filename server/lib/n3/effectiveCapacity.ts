/**
 * N3 SERVICE RUN MONITOR + REPLAN ENGINE
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * EffectiveCapacity V1 Evaluator
 * Computes effective capacity per bound surface requirement considering:
 * - Slope (tide-sensitive ramps)
 * - Load (utility power demand)
 * - Wetness (rain probability)
 * - Wind (watercraft stability)
 * - Accessibility (width, grates, steps)
 */

export type EffectiveCapacityResult = {
  surfaceId: string;
  requirementId: string;
  requiredSurfaceType: string;
  timeStart: string;
  timeEnd: string;

  effectiveAreaSqmm?: number;
  effectiveLinearMm?: number;
  effectiveUnitsNormal?: number;
  effectiveUnitsEmergency?: number;
  effectiveContinuousSafeWatts?: number;

  riskScore: number; // 0..1
  reasons: string[];
  mitigations: string[];
  debug?: Record<string, any>;
};

export type ActorProfile = {
  actor_type?: 'human' | 'wheelchair' | 'robot' | 'bike';
  mass_mg?: number;  // Canonical: milligrams (90,000,000 mg = 90 kg)
  width_mm?: number; // Canonical: millimeters
  footprint_mm2?: number;
  traction?: string;
};

export type RequirementDemand = {
  watts_continuous?: number;
  hours?: number;
  device?: string;
  sit_units_requested?: number;
  rowing_required?: boolean;
};

export type RequirementConstraints = {
  no_grates?: boolean;
  min_clear_width_mm?: number;
  max_slope_pct?: number;
};

export type EvaluationSignals = {
  tide?: { height_m?: number };
  weather?: { rain_prob?: number; wind_kph?: number; temp_c?: number };
  utilityNode?: { max_watts?: number; is_shared?: boolean };
};

export type SurfaceMetadata = {
  has_grates?: boolean;
  min_clear_width_mm?: number;
  area_sqmm?: number;
  linear_mm?: number;
  ramp_slope_at_low_tide_pct?: number;
  ramp_slope_at_high_tide_pct?: number;
  low_tide_height_m?: number;
  high_tide_height_m?: number;
  watercraft_type?: 'canoe' | 'kayak';
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export async function evaluateEffectiveCapacityV1(args: {
  portalId: string;
  timeStart: Date;
  timeEnd: Date;
  requirement: {
    id: string;
    requiredSurfaceType: string;
    actorProfile: ActorProfile;
    demand: RequirementDemand;
    requiredConstraints: RequirementConstraints;
    riskTolerance: number;
  };
  surface: {
    id: string;
    surfaceType: string;
    title?: string;
    widthMm?: number;
    lengthMm?: number;
    linearMm?: number;
    areaSqmm?: number;
    metadata?: SurfaceMetadata;
  };
  container?: {
    id: string;
    title?: string;
    hasSteps?: boolean;
    minDoorWidthMm?: number;
    metadata?: Record<string, any>;
  };
  signals: EvaluationSignals;
}): Promise<EffectiveCapacityResult> {
  const { timeStart, timeEnd, requirement, surface, container, signals } = args;
  
  const result: EffectiveCapacityResult = {
    surfaceId: surface.id,
    requirementId: requirement.id,
    requiredSurfaceType: requirement.requiredSurfaceType,
    timeStart: timeStart.toISOString(),
    timeEnd: timeEnd.toISOString(),
    riskScore: 0,
    reasons: [],
    mitigations: [],
    debug: {},
  };

  // Compute condition modifiers
  const rainProb = signals.weather?.rain_prob || 0;
  const wetness = clamp(rainProb, 0, 1);
  const tempC = signals.weather?.temp_c ?? 10;
  const windKph = signals.weather?.wind_kph || 0;
  const tideHeightM = signals.tide?.height_m;

  result.debug = { wetness, tempC, windKph, tideHeightM };

  // Ice risk
  if (tempC <= 0 && wetness > 0.2) {
    result.reasons.push('ICE_RISK');
    result.riskScore += 0.3;
    result.mitigations.push('DEPLOY_SALT_SAND');
  }

  // Route to appropriate evaluator based on required surface type
  switch (requirement.requiredSurfaceType) {
    case 'movement':
      evaluateMovementSurface(result, requirement, surface, container, signals, wetness, tideHeightM);
      break;
    case 'stand':
      evaluateStandSurface(result, requirement, surface, wetness);
      break;
    case 'sit':
      evaluateSitSurface(result, requirement, surface, signals, windKph);
      break;
    case 'utility':
      evaluateUtilitySurface(result, requirement, signals);
      break;
    case 'sleep':
      evaluateSleepSurface(result, requirement, surface);
      break;
    default:
      result.reasons.push('UNKNOWN_SURFACE_TYPE');
      result.riskScore += 0.1;
  }

  // Clamp final risk score
  result.riskScore = clamp(result.riskScore, 0, 1);

  return result;
}

function evaluateMovementSurface(
  result: EffectiveCapacityResult,
  requirement: { actorProfile: ActorProfile; requiredConstraints: RequirementConstraints; riskTolerance: number },
  surface: { metadata?: SurfaceMetadata },
  container: { hasSteps?: boolean; minDoorWidthMm?: number } | undefined,
  signals: EvaluationSignals,
  wetness: number,
  tideHeightM: number | undefined
): void {
  const meta = surface.metadata || {};
  const constraints = requirement.requiredConstraints;
  const actor = requirement.actorProfile;

  // Calculate slope from tide if ramp metadata exists
  let slopePct: number | undefined;
  if (
    meta.ramp_slope_at_low_tide_pct !== undefined &&
    meta.ramp_slope_at_high_tide_pct !== undefined &&
    meta.low_tide_height_m !== undefined &&
    meta.high_tide_height_m !== undefined &&
    tideHeightM !== undefined
  ) {
    const tideNorm = normalize(tideHeightM, meta.low_tide_height_m, meta.high_tide_height_m);
    slopePct = lerp(meta.ramp_slope_at_low_tide_pct, meta.ramp_slope_at_high_tide_pct, tideNorm);
    result.debug!.calculated_slope_pct = slopePct;
    result.debug!.tide_normalized = tideNorm;
  }

  // Check slope constraint
  if (slopePct !== undefined && constraints.max_slope_pct !== undefined) {
    if (slopePct > constraints.max_slope_pct) {
      result.reasons.push('SLOPE_EXCEEDS_MAX');
      result.riskScore += 0.4;
      result.mitigations.push('SHIFT_TO_HIGH_TIDE_WINDOW');
      result.mitigations.push('USE_ALTERNATE_DOCK');
      result.debug!.slope_exceeded_by = slopePct - constraints.max_slope_pct;
    }
  }

  // Check grates
  if (meta.has_grates) {
    if (constraints.no_grates === true) {
      result.reasons.push('GRATES_NOT_ALLOWED');
      result.riskScore += 0.5; // Infeasible
      result.mitigations.push('USE_ALTERNATE_DOCK');
    } else if (wetness > 0.4) {
      result.reasons.push('WET_GRATES');
      result.riskScore += 0.2;
      result.mitigations.push('ADD_NON_SLIP_MATS');
    }
  }

  // Check width constraint
  const surfaceWidth = meta.min_clear_width_mm;
  const requiredWidth = constraints.min_clear_width_mm || actor.width_mm;
  if (surfaceWidth !== undefined && requiredWidth !== undefined) {
    if (surfaceWidth < requiredWidth) {
      result.reasons.push('WIDTH_INSUFFICIENT');
      result.riskScore += 0.5; // Infeasible
      result.mitigations.push('USE_ALTERNATE_DOCK');
    }
  }

  // Check container steps
  if (container?.hasSteps && actor.actor_type === 'wheelchair') {
    result.reasons.push('STEPS_NOT_ACCESSIBLE');
    result.riskScore += 0.5;
    result.mitigations.push('USE_PORTABLE_RAMP');
  }

  // Add wetness risk for movement
  if (wetness > 0.6) {
    result.riskScore += wetness * 0.15;
    result.reasons.push('WET_CONDITIONS');
    result.mitigations.push('ADD_ASSIST_DEVICE');
  }

  // Movement is pass/fail, 1 unit if feasible
  result.effectiveUnitsNormal = result.riskScore < 0.5 ? 1 : 0;
  result.effectiveUnitsEmergency = 1; // Emergency allows higher risk
}

function evaluateStandSurface(
  result: EffectiveCapacityResult,
  requirement: { actorProfile: ActorProfile; requiredConstraints: RequirementConstraints },
  surface: { widthMm?: number; lengthMm?: number; areaSqmm?: number; metadata?: SurfaceMetadata },
  wetness: number
): void {
  const actor = requirement.actorProfile;

  // Calculate area
  let areaSqmm = surface.areaSqmm;
  if (!areaSqmm && surface.widthMm && surface.lengthMm) {
    areaSqmm = surface.widthMm * surface.lengthMm;
  }

  if (areaSqmm) {
    // Safety buffer increases with wetness: 5% to 20%
    const safetyBuffer = 0.05 + wetness * 0.15;
    const effectiveArea = Math.floor(areaSqmm * (1 - safetyBuffer));
    result.effectiveAreaSqmm = effectiveArea;
    result.debug!.safety_buffer = safetyBuffer;

    if (actor.footprint_mm2) {
      result.effectiveUnitsNormal = Math.floor(effectiveArea / actor.footprint_mm2);
      result.effectiveUnitsEmergency = Math.floor(effectiveArea / (actor.footprint_mm2 * 0.7));
    }

    if (wetness > 0.4) {
      result.reasons.push('REDUCED_EFFECTIVE_AREA_WET');
      result.riskScore += wetness * 0.2;
    }
  }
}

function evaluateSitSurface(
  result: EffectiveCapacityResult,
  requirement: { actorProfile: ActorProfile; demand: RequirementDemand },
  surface: { metadata?: SurfaceMetadata },
  signals: EvaluationSignals,
  windKph: number
): void {
  const meta = surface.metadata || {};
  const actor = requirement.actorProfile;
  const demand = requirement.demand;

  // Watercraft wind evaluation
  if (meta.watercraft_type) {
    if (meta.watercraft_type === 'kayak' && windKph > 15) {
      result.reasons.push('KAYAK_WIND_RISK');
      result.riskScore += 0.4;
      result.mitigations.push('POSTPONE_UNTIL_WIND_DROPS');
    }
    if (meta.watercraft_type === 'canoe' && windKph > 25) {
      result.reasons.push('CANOE_WIND_RISK');
      result.riskScore += 0.3;
      result.mitigations.push('POSTPONE_UNTIL_WIND_DROPS');
    }

    // Robot rowing stability
    if (demand.rowing_required && actor.actor_type === 'robot') {
      if (meta.watercraft_type === 'kayak') {
        result.reasons.push('ROBOT_ROWING_UNSTABLE_IN_KAYAK');
        result.riskScore += 0.3;
        result.mitigations.push('USE_CANOE_NOT_KAYAK');
      }
    }

    // Default units for watercraft
    result.effectiveUnitsNormal = meta.watercraft_type === 'canoe' ? 6 : 2;
    result.effectiveUnitsEmergency = meta.watercraft_type === 'canoe' ? 6 : 2;
  } else {
    // Non-watercraft sit surface (restaurant, etc.)
    result.effectiveUnitsNormal = demand.sit_units_requested || 1;
    result.effectiveUnitsEmergency = demand.sit_units_requested || 1;
  }
}

function evaluateUtilitySurface(
  result: EffectiveCapacityResult,
  requirement: { demand: RequirementDemand },
  signals: EvaluationSignals
): void {
  const demand = requirement.demand;
  const utilityNode = signals.utilityNode;

  if (utilityNode?.max_watts) {
    // 80% rule for continuous safe load
    const continuousSafe = Math.floor(utilityNode.max_watts * 0.8);
    result.effectiveContinuousSafeWatts = continuousSafe;
    result.debug!.max_watts = utilityNode.max_watts;
    result.debug!.continuous_safe = continuousSafe;

    if (demand.watts_continuous && demand.watts_continuous > continuousSafe) {
      result.reasons.push('UTILITY_OVER_CONTINUOUS_SAFE_LOAD');
      result.riskScore += 0.4;
      result.mitigations.push('STAGGER_CHARGING');
      result.mitigations.push('USE_BUILDING_POWER_FEED');
      result.debug!.demand_watts = demand.watts_continuous;
      result.debug!.over_by_watts = demand.watts_continuous - continuousSafe;
    }
  }

  result.effectiveUnitsNormal = 1;
  result.effectiveUnitsEmergency = 1;
}

function evaluateSleepSurface(
  result: EffectiveCapacityResult,
  requirement: { actorProfile: ActorProfile },
  surface: { widthMm?: number; lengthMm?: number }
): void {
  // Sleep surfaces are straightforward - just pass through units from surface
  result.effectiveUnitsNormal = 1;
  result.effectiveUnitsEmergency = 1;
}

export function computeRiskFingerprint(result: EffectiveCapacityResult): string {
  const normalized = {
    reasons: result.reasons.sort(),
    riskScore: Math.round(result.riskScore * 1000),
  };
  const str = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

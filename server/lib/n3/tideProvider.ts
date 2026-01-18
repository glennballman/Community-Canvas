/**
 * N3 Tide Provider - Deterministic Signal
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Provides tide predictions for Bamfield and other BC coastal locations.
 * Tide data is deterministic - predicted values are exact.
 */

import { db } from '../../db';
import { ccTidePredictions } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { Segment, SignalFinding, RiskLevel } from './types';

export interface TideRange {
  minHeightM: number;
  maxHeightM: number;
  predictions: Array<{
    ts: Date;
    heightM: number;
  }>;
}

const RAMP_SAFETY_THRESHOLDS = {
  criticalLow: 1.0,
  lowWater: 1.5,
  optimalMin: 2.0,
  optimalMax: 3.5,
  highWater: 4.0,
  criticalHigh: 4.5,
};

export async function getTideRange(
  locationRef: string,
  startTime: Date,
  endTime: Date
): Promise<TideRange | null> {
  const predictions = await db.query.ccTidePredictions.findMany({
    where: and(
      eq(ccTidePredictions.locationRef, locationRef),
      gte(ccTidePredictions.ts, startTime),
      lte(ccTidePredictions.ts, endTime)
    ),
    orderBy: ccTidePredictions.ts,
  });

  if (predictions.length === 0) {
    return null;
  }

  const heights = predictions.map(p => Number(p.heightM));
  
  return {
    minHeightM: Math.min(...heights),
    maxHeightM: Math.max(...heights),
    predictions: predictions.map(p => ({
      ts: p.ts,
      heightM: Number(p.heightM),
    })),
  };
}

export function evaluateRampByTide(
  segment: Segment,
  tideRange: TideRange
): SignalFinding | null {
  if (segment.segmentKind !== 'load' && segment.segmentKind !== 'ride') {
    return null;
  }

  const { minHeightM, maxHeightM } = tideRange;
  
  let riskLevel: RiskLevel = 'none';
  let riskScore = 0;
  let message = '';

  if (minHeightM < RAMP_SAFETY_THRESHOLDS.criticalLow) {
    riskLevel = 'critical';
    riskScore = 1.0;
    message = `Extreme low tide (${minHeightM.toFixed(1)}m) - ramp access blocked`;
  } else if (maxHeightM > RAMP_SAFETY_THRESHOLDS.criticalHigh) {
    riskLevel = 'critical';
    riskScore = 1.0;
    message = `Extreme high tide (${maxHeightM.toFixed(1)}m) - ramp access flooded`;
  } else if (minHeightM < RAMP_SAFETY_THRESHOLDS.lowWater) {
    riskLevel = 'high';
    riskScore = 0.75;
    message = `Low tide warning (${minHeightM.toFixed(1)}m) - limited ramp access`;
  } else if (maxHeightM > RAMP_SAFETY_THRESHOLDS.highWater) {
    riskLevel = 'high';
    riskScore = 0.75;
    message = `High tide warning (${maxHeightM.toFixed(1)}m) - reduced ramp access`;
  } else if (minHeightM < RAMP_SAFETY_THRESHOLDS.optimalMin || maxHeightM > RAMP_SAFETY_THRESHOLDS.optimalMax) {
    riskLevel = 'medium';
    riskScore = 0.4;
    message = `Sub-optimal tide conditions (${minHeightM.toFixed(1)}m - ${maxHeightM.toFixed(1)}m)`;
  } else {
    riskLevel = 'none';
    riskScore = 0;
    message = `Optimal tide conditions (${minHeightM.toFixed(1)}m - ${maxHeightM.toFixed(1)}m)`;
  }

  if (riskLevel === 'none') {
    return null;
  }

  return {
    signalType: 'tide',
    segmentId: segment.id,
    riskLevel,
    riskScore,
    isDeterministic: true,
    message,
    data: {
      minHeightM,
      maxHeightM,
      thresholds: RAMP_SAFETY_THRESHOLDS,
      predictions: tideRange.predictions.slice(0, 10),
    },
  };
}

export function findOptimalTideWindow(
  predictions: Array<{ ts: Date; heightM: number }>,
  durationMinutes: number
): { startsAt: Date; endsAt: Date; avgHeight: number } | null {
  if (predictions.length < 2) {
    return null;
  }

  let bestWindow: { startsAt: Date; endsAt: Date; avgHeight: number } | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < predictions.length - 1; i++) {
    const startPred = predictions[i];
    const endTime = new Date(startPred.ts.getTime() + durationMinutes * 60 * 1000);
    
    const windowPreds = predictions.filter(
      p => p.ts >= startPred.ts && p.ts <= endTime
    );
    
    if (windowPreds.length < 2) continue;

    const avgHeight = windowPreds.reduce((sum, p) => sum + p.heightM, 0) / windowPreds.length;
    const optimalMid = (RAMP_SAFETY_THRESHOLDS.optimalMin + RAMP_SAFETY_THRESHOLDS.optimalMax) / 2;
    const score = Math.abs(avgHeight - optimalMid);

    if (score < bestScore && avgHeight >= RAMP_SAFETY_THRESHOLDS.optimalMin && avgHeight <= RAMP_SAFETY_THRESHOLDS.optimalMax) {
      bestScore = score;
      bestWindow = {
        startsAt: startPred.ts,
        endsAt: endTime,
        avgHeight,
      };
    }
  }

  return bestWindow;
}

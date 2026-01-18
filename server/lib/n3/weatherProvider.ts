/**
 * N3 Weather Normals Provider - Probabilistic Signal
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Provides weather normals (historical averages) for BC locations.
 * Weather predictions are probabilistic - based on historical patterns.
 */

import { db } from '../../db';
import { ccWeatherNormals } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { Segment, SignalFinding, RiskLevel } from './types';

export interface WeatherNormal {
  locationRef: string;
  dayOfYear: number;
  tempLowC: number | null;
  tempHighC: number | null;
  rainProb: number | null;
  fogProb: number | null;
  windProb: number | null;
}

const WEATHER_RISK_THRESHOLDS = {
  rain: {
    low: 0.2,
    medium: 0.5,
    high: 0.75,
    critical: 0.9,
  },
  fog: {
    low: 0.15,
    medium: 0.35,
    high: 0.55,
    critical: 0.75,
  },
  wind: {
    low: 0.2,
    medium: 0.4,
    high: 0.6,
    critical: 0.8,
  },
  temp: {
    freezing: 0,
    coldWarning: 5,
    heatWarning: 30,
  },
};

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export async function getWeatherNormals(
  locationRef: string,
  date: Date
): Promise<WeatherNormal | null> {
  const dayOfYear = getDayOfYear(date);
  
  const normal = await db.query.ccWeatherNormals.findFirst({
    where: and(
      eq(ccWeatherNormals.locationRef, locationRef),
      eq(ccWeatherNormals.dayOfYear, dayOfYear)
    ),
  });

  if (!normal) {
    return null;
  }

  return {
    locationRef: normal.locationRef,
    dayOfYear: normal.dayOfYear,
    tempLowC: normal.tempLowC ? Number(normal.tempLowC) : null,
    tempHighC: normal.tempHighC ? Number(normal.tempHighC) : null,
    rainProb: normal.rainProb ? Number(normal.rainProb) : null,
    fogProb: normal.fogProb ? Number(normal.fogProb) : null,
    windProb: normal.windProb ? Number(normal.windProb) : null,
  };
}

export function evaluateWeatherRisk(
  segment: Segment,
  normals: WeatherNormal
): SignalFinding[] {
  const findings: SignalFinding[] = [];

  if (normals.rainProb !== null) {
    const rainFinding = evaluateProbability(
      segment.id,
      'rain',
      normals.rainProb,
      WEATHER_RISK_THRESHOLDS.rain
    );
    if (rainFinding) findings.push(rainFinding);
  }

  if (normals.fogProb !== null && (segment.segmentKind === 'ride' || segment.segmentKind === 'move')) {
    const fogFinding = evaluateProbability(
      segment.id,
      'fog',
      normals.fogProb,
      WEATHER_RISK_THRESHOLDS.fog
    );
    if (fogFinding) findings.push(fogFinding);
  }

  if (normals.windProb !== null && (segment.segmentKind === 'ride' || segment.segmentKind === 'load')) {
    const windFinding = evaluateProbability(
      segment.id,
      'wind',
      normals.windProb,
      WEATHER_RISK_THRESHOLDS.wind
    );
    if (windFinding) findings.push(windFinding);
  }

  if (normals.tempLowC !== null) {
    const tempFinding = evaluateTemperature(segment.id, normals.tempLowC, normals.tempHighC);
    if (tempFinding) findings.push(tempFinding);
  }

  return findings;
}

function evaluateProbability(
  segmentId: string,
  factor: 'rain' | 'fog' | 'wind',
  probability: number,
  thresholds: { low: number; medium: number; high: number; critical: number }
): SignalFinding | null {
  let riskLevel: RiskLevel;
  let riskScore: number;

  if (probability >= thresholds.critical) {
    riskLevel = 'critical';
    riskScore = 0.9;
  } else if (probability >= thresholds.high) {
    riskLevel = 'high';
    riskScore = 0.7;
  } else if (probability >= thresholds.medium) {
    riskLevel = 'medium';
    riskScore = 0.4;
  } else if (probability >= thresholds.low) {
    riskLevel = 'low';
    riskScore = 0.2;
  } else {
    return null;
  }

  return {
    signalType: 'weather',
    segmentId,
    riskLevel,
    riskScore,
    isDeterministic: false,
    message: `${factor.charAt(0).toUpperCase() + factor.slice(1)} probability: ${(probability * 100).toFixed(0)}%`,
    data: {
      factor,
      probability,
      thresholds,
    },
  };
}

function evaluateTemperature(
  segmentId: string,
  tempLowC: number,
  tempHighC: number | null
): SignalFinding | null {
  let riskLevel: RiskLevel;
  let riskScore: number;
  let message: string;

  if (tempLowC < WEATHER_RISK_THRESHOLDS.temp.freezing) {
    riskLevel = 'high';
    riskScore = 0.6;
    message = `Freezing conditions expected (low: ${tempLowC}C)`;
  } else if (tempLowC < WEATHER_RISK_THRESHOLDS.temp.coldWarning) {
    riskLevel = 'medium';
    riskScore = 0.3;
    message = `Cold conditions expected (low: ${tempLowC}C)`;
  } else if (tempHighC !== null && tempHighC > WEATHER_RISK_THRESHOLDS.temp.heatWarning) {
    riskLevel = 'medium';
    riskScore = 0.3;
    message = `Heat warning (high: ${tempHighC}C)`;
  } else {
    return null;
  }

  return {
    signalType: 'weather',
    segmentId,
    riskLevel,
    riskScore,
    isDeterministic: false,
    message,
    data: {
      factor: 'temperature',
      tempLowC,
      tempHighC,
    },
  };
}

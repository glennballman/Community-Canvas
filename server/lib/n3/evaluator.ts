/**
 * N3 Service Run Evaluator
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Core evaluation engine that:
 * 1. Loads segments for a service run
 * 2. Runs signal evaluators (tide, weather)
 * 3. Computes risk score and fingerprint
 * 4. Generates replan options when risk exceeds thresholds
 */

import { db } from '../../db';
import { ccN3Runs, ccN3Segments, ccMonitorState, ccReplanBundles, ccReplanOptions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import type {
  Segment,
  SignalFinding,
  EvaluationResult,
  RiskFingerprint,
  ReplanOptionDef,
  RiskLevel,
  TimeWindow,
} from './types';
import { getTideRange, evaluateRampByTide, findOptimalTideWindow } from './tideProvider';
import { getWeatherNormals, evaluateWeatherRisk } from './weatherProvider';

const BAMFIELD_LOCATION = 'bamfield-bc';

function parseTimeWindow(data: unknown): TimeWindow | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.earliest && obj.latest) {
    return {
      earliest: new Date(obj.earliest as string),
      latest: new Date(obj.latest as string),
    };
  }
  return null;
}

export async function loadSegments(runId: string): Promise<Segment[]> {
  const segments = await db.query.ccN3Segments.findMany({
    where: eq(ccN3Segments.runId, runId),
  });

  return segments.map(s => ({
    id: s.id,
    runId: s.runId,
    segmentKind: s.segmentKind as Segment['segmentKind'],
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    startWindow: parseTimeWindow(s.startWindow),
    endWindow: parseTimeWindow(s.endWindow),
    locationRef: s.locationRef,
    dependsOnSegmentId: s.dependsOnSegmentId,
    constraints: s.constraints as Record<string, unknown> | null,
  }));
}

export async function evaluateSegmentSignals(segment: Segment): Promise<SignalFinding[]> {
  const findings: SignalFinding[] = [];
  
  const startTime = segment.startsAt || segment.startWindow?.earliest;
  const endTime = segment.endsAt || segment.endWindow?.latest;
  
  if (!startTime || !endTime) {
    return findings;
  }

  const locationRef = segment.locationRef || BAMFIELD_LOCATION;

  const tideRange = await getTideRange(locationRef, startTime, endTime);
  if (tideRange) {
    const tideFinding = evaluateRampByTide(segment, tideRange);
    if (tideFinding) {
      findings.push(tideFinding);
    }
  }

  const normals = await getWeatherNormals(locationRef, startTime);
  if (normals) {
    const weatherFindings = evaluateWeatherRisk(segment, normals);
    findings.push(...weatherFindings);
  }

  return findings;
}

function computeRiskScore(findings: SignalFinding[]): number {
  if (findings.length === 0) return 0;

  let maxScore = 0;
  let sumScore = 0;

  for (const finding of findings) {
    maxScore = Math.max(maxScore, finding.riskScore);
    sumScore += finding.riskScore;
  }

  return Math.min(1, maxScore * 0.7 + (sumScore / findings.length) * 0.3);
}

function computeRiskLevel(score: number): RiskLevel {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  if (score >= 0.15) return 'low';
  return 'none';
}

function computeFingerprint(findings: SignalFinding[]): RiskFingerprint {
  const sortedFindings = [...findings].sort((a, b) => {
    if (a.signalType !== b.signalType) return a.signalType.localeCompare(b.signalType);
    if (a.segmentId !== b.segmentId) return a.segmentId.localeCompare(b.segmentId);
    return b.riskScore - a.riskScore;
  });

  const fingerprintData = sortedFindings.map(f => ({
    type: f.signalType,
    segment: f.segmentId,
    level: f.riskLevel,
    det: f.isDeterministic,
  }));

  const hash = createHash('sha256')
    .update(JSON.stringify(fingerprintData))
    .digest('hex')
    .substring(0, 16);

  return {
    hash,
    findings: sortedFindings,
    timestamp: new Date(),
  };
}

async function generateReplanOptions(
  runId: string,
  segments: Segment[],
  findings: SignalFinding[]
): Promise<ReplanOptionDef[]> {
  const options: ReplanOptionDef[] = [];
  
  const affectedSegmentIds = new Set(findings.map(f => f.segmentId));
  const affectedSegments = segments.filter(s => affectedSegmentIds.has(s.id));

  if (affectedSegments.length === 0) {
    return options;
  }

  const loadSegments = affectedSegments.filter(s => s.segmentKind === 'load' || s.segmentKind === 'ride');
  
  for (const segment of loadSegments) {
    const startTime = segment.startsAt || segment.startWindow?.earliest;
    const endTime = segment.endsAt || segment.endWindow?.latest;
    
    if (!startTime || !endTime) continue;

    const locationRef = segment.locationRef || BAMFIELD_LOCATION;
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (60 * 1000);
    
    const searchStart = new Date(startTime.getTime() - 6 * 60 * 60 * 1000);
    const searchEnd = new Date(endTime.getTime() + 6 * 60 * 60 * 1000);
    
    const tideRange = await getTideRange(locationRef, searchStart, searchEnd);
    
    if (tideRange && tideRange.predictions.length > 0) {
      const optimalWindow = findOptimalTideWindow(tideRange.predictions, durationMinutes);
      
      if (optimalWindow) {
        const timeShift = optimalWindow.startsAt.getTime() - startTime.getTime();
        const shiftHours = timeShift / (60 * 60 * 1000);
        
        if (Math.abs(shiftHours) >= 0.5 && Math.abs(shiftHours) <= 6) {
          options.push({
            rank: options.length + 1,
            label: `Shift ${segment.segmentKind} by ${shiftHours > 0 ? '+' : ''}${shiftHours.toFixed(1)}h for optimal tide`,
            plan: {
              adjustments: [{
                segmentId: segment.id,
                field: 'startsAt',
                oldValue: startTime.toISOString(),
                newValue: optimalWindow.startsAt.toISOString(),
                reason: `Optimal tide window at ${optimalWindow.avgHeight.toFixed(1)}m`,
              }],
              summary: `Reschedule ${segment.segmentKind} segment for optimal tide conditions`,
            },
            validation: {
              isValid: true,
              constraintViolations: [],
              dependencyViolations: [],
            },
            estimatedImpact: {
              riskReduction: 0.6,
              timeChange: shiftHours,
              costChange: 0,
            },
          });
        }
      }
    }
  }

  if (options.length === 0) {
    options.push({
      rank: 1,
      label: 'Acknowledge risk - proceed with caution',
      plan: {
        adjustments: [],
        summary: 'No schedule changes; proceed with heightened awareness and contingency plans',
      },
      validation: {
        isValid: true,
        constraintViolations: [],
        dependencyViolations: [],
      },
      estimatedImpact: {
        riskReduction: 0,
        timeChange: 0,
        costChange: 0,
      },
    });
  }

  options.push({
    rank: options.length + 1,
    label: 'Postpone run - await better conditions',
    plan: {
      adjustments: [{
        segmentId: segments[0]?.id || '',
        field: 'startsAt',
        oldValue: segments[0]?.startsAt?.toISOString() || '',
        newValue: 'TBD - manual reschedule required',
        reason: 'Full postponement due to unfavorable conditions',
      }],
      summary: 'Postpone entire service run until conditions improve',
    },
    validation: {
      isValid: true,
      constraintViolations: [],
      dependencyViolations: [],
    },
    estimatedImpact: {
      riskReduction: 1.0,
      timeChange: 24,
      costChange: 50,
    },
  });

  return options.slice(0, 3);
}

export async function evaluateServiceRun(
  runId: string,
  tenantId: string
): Promise<EvaluationResult> {
  const segments = await loadSegments(runId);
  
  const allFindings: SignalFinding[] = [];
  for (const segment of segments) {
    const segmentFindings = await evaluateSegmentSignals(segment);
    allFindings.push(...segmentFindings);
  }

  const riskScore = computeRiskScore(allFindings);
  const riskLevel = computeRiskLevel(riskScore);
  const fingerprint = computeFingerprint(allFindings);

  const existingState = await db.query.ccMonitorState.findFirst({
    where: eq(ccMonitorState.runId, runId),
  });

  const hasChanged = !existingState?.lastRiskFingerprint || 
    existingState.lastRiskFingerprint !== fingerprint.hash;

  let replanOptions: ReplanOptionDef[] = [];
  if (riskLevel !== 'none' && hasChanged) {
    replanOptions = await generateReplanOptions(runId, segments, allFindings);
  }

  return {
    runId,
    tenantId,
    riskScore,
    riskLevel,
    fingerprint,
    findings: allFindings,
    hasChanged,
    replanOptions,
  };
}

export async function saveEvaluationResult(result: EvaluationResult): Promise<string | null> {
  let bundleId: string | null = null;

  if (result.hasChanged && result.riskLevel !== 'none' && result.replanOptions.length > 0) {
    const [bundle] = await db.insert(ccReplanBundles).values({
      tenantId: result.tenantId,
      runId: result.runId,
      status: 'open',
      reasonCodes: result.findings.map(f => `${f.signalType}:${f.riskLevel}`),
      summary: `${result.findings.length} risk finding(s) detected: ${result.findings.map(f => f.message).join('; ')}`,
      riskDelta: result.riskScore.toFixed(3),
      bundle: {
        fingerprint: result.fingerprint,
        findings: result.findings,
        evaluatedAt: new Date().toISOString(),
      },
    }).returning();

    bundleId = bundle.id;

    for (const option of result.replanOptions) {
      await db.insert(ccReplanOptions).values({
        bundleId: bundle.id,
        rank: option.rank,
        label: option.label,
        plan: option.plan,
        validation: option.validation,
        estimatedImpact: option.estimatedImpact,
      });
    }
  }

  await db.insert(ccMonitorState).values({
    tenantId: result.tenantId,
    runId: result.runId,
    policyId: await getDefaultPolicyId(result.tenantId),
    lastCheckedAt: new Date(),
    nextCheckAt: null,
    lastRiskScore: result.riskScore.toFixed(3),
    lastRiskFingerprint: result.fingerprint.hash,
    lastBundleId: bundleId,
  }).onConflictDoUpdate({
    target: ccMonitorState.runId,
    set: {
      lastCheckedAt: new Date(),
      lastRiskScore: result.riskScore.toFixed(3),
      lastRiskFingerprint: result.fingerprint.hash,
      lastBundleId: bundleId,
    },
  });

  return bundleId;
}

async function getDefaultPolicyId(tenantId: string): Promise<string> {
  const existing = await db.query.ccMonitorPolicies.findFirst({
    where: eq(ccMonitorPolicies.tenantId, tenantId),
  });

  if (existing) return existing.id;

  const [policy] = await db.insert(ccMonitorPolicies).values({
    tenantId,
    name: 'Default Policy',
    cadenceRules: [
      { minDaysOut: 14, maxDaysOut: null, intervalMinutes: 24 * 60 },
      { minDaysOut: 3, maxDaysOut: 14, intervalMinutes: 6 * 60 },
      { minDaysOut: 0, maxDaysOut: 3, intervalMinutes: 30 },
    ],
  }).returning();

  return policy.id;
}

import { ccMonitorPolicies } from '@shared/schema';

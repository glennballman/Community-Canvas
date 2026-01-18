/**
 * N3 SERVICE RUN MONITOR + REPLAN ENGINE
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Core types for signal evaluation, risk fingerprinting, and replan generation
 */

export type SegmentKind = 'move' | 'ride' | 'work' | 'stay' | 'wait' | 'load';

export interface TimeWindow {
  earliest: Date;
  latest: Date;
}

export interface Segment {
  id: string;
  runId: string;
  segmentKind: SegmentKind;
  startsAt: Date | null;
  endsAt: Date | null;
  startWindow: TimeWindow | null;
  endWindow: TimeWindow | null;
  locationRef: string | null;
  dependsOnSegmentId: string | null;
  constraints: Record<string, unknown> | null;
}

export type SignalType = 'tide' | 'weather' | 'road_condition' | 'ferry_schedule';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SignalFinding {
  signalType: SignalType;
  segmentId: string;
  riskLevel: RiskLevel;
  riskScore: number;
  isDeterministic: boolean;
  message: string;
  data: Record<string, unknown>;
}

export interface RiskFingerprint {
  hash: string;
  findings: SignalFinding[];
  timestamp: Date;
}

export interface ReplanOptionPlan {
  adjustments: SegmentAdjustment[];
  summary: string;
}

export interface SegmentAdjustment {
  segmentId: string;
  field: 'startsAt' | 'endsAt' | 'startWindow' | 'endWindow';
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface ReplanValidation {
  isValid: boolean;
  constraintViolations: string[];
  dependencyViolations: string[];
}

export interface ReplanOptionDef {
  rank: number;
  label: string;
  plan: ReplanOptionPlan;
  validation: ReplanValidation;
  estimatedImpact: {
    riskReduction: number;
    timeChange: number;
    costChange: number;
  };
}

export type ActionKind = 'suggest' | 'request' | 'dictate';
export type BundleStatus = 'open' | 'dismissed' | 'actioned';

export interface EvaluationResult {
  runId: string;
  tenantId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  fingerprint: RiskFingerprint;
  findings: SignalFinding[];
  hasChanged: boolean;
  replanOptions: ReplanOptionDef[];
}

export interface CadenceRule {
  minDaysOut: number;
  maxDaysOut: number | null;
  intervalMinutes: number;
}

export const DEFAULT_CADENCE_RULES: CadenceRule[] = [
  { minDaysOut: 14, maxDaysOut: null, intervalMinutes: 24 * 60 },
  { minDaysOut: 3, maxDaysOut: 14, intervalMinutes: 6 * 60 },
  { minDaysOut: 0, maxDaysOut: 3, intervalMinutes: 30 },
];

export interface MonitorPolicyConfig {
  name: string;
  cadenceRules: CadenceRule[];
  enabledSignals: SignalType[];
}

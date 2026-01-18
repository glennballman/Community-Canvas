/**
 * N3 Monitor Scheduler
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Implements cadence-based monitoring schedule:
 * - >14 days out: daily checks
 * - 3-14 days out: every 6 hours
 * - <72 hours: every 30 minutes
 */

import { db } from '../../db';
import { ccN3Runs, ccMonitorState, ccMonitorPolicies } from '@shared/schema';
import { eq, and, lte, isNull, or, sql } from 'drizzle-orm';
import type { CadenceRule } from './types';
import { DEFAULT_CADENCE_RULES } from './types';

export function scheduleNextCheck(
  runStartsAt: Date,
  cadenceRules: CadenceRule[] = DEFAULT_CADENCE_RULES
): Date {
  const now = new Date();
  const daysOut = (runStartsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  const applicableRule = cadenceRules.find(rule => {
    const minMatch = daysOut >= rule.minDaysOut;
    const maxMatch = rule.maxDaysOut === null || daysOut < rule.maxDaysOut;
    return minMatch && maxMatch;
  }) || cadenceRules[cadenceRules.length - 1];

  const nextCheck = new Date(now.getTime() + applicableRule.intervalMinutes * 60 * 1000);
  
  if (nextCheck > runStartsAt) {
    return runStartsAt;
  }

  return nextCheck;
}

export interface RunToMonitor {
  runId: string;
  tenantId: string;
  runName: string;
  startsAt: Date;
  stateId: string | null;
  lastCheckedAt: Date | null;
}

export async function getRunsDueForMonitoring(limit: number = 10): Promise<RunToMonitor[]> {
  const now = new Date();

  const runsWithState = await db
    .select({
      runId: ccN3Runs.id,
      tenantId: ccN3Runs.tenantId,
      runName: ccN3Runs.name,
      startsAt: ccN3Runs.startsAt,
      stateId: ccMonitorState.id,
      lastCheckedAt: ccMonitorState.lastCheckedAt,
      nextCheckAt: ccMonitorState.nextCheckAt,
    })
    .from(ccN3Runs)
    .leftJoin(ccMonitorState, eq(ccN3Runs.id, ccMonitorState.runId))
    .where(
      and(
        eq(ccN3Runs.status, 'scheduled'),
        sql`${ccN3Runs.startsAt} > ${now}`,
        or(
          isNull(ccMonitorState.nextCheckAt),
          lte(ccMonitorState.nextCheckAt, now)
        )
      )
    )
    .limit(limit);

  return runsWithState
    .filter(r => r.startsAt !== null)
    .map(r => ({
      runId: r.runId,
      tenantId: r.tenantId,
      runName: r.runName,
      startsAt: r.startsAt!,
      stateId: r.stateId,
      lastCheckedAt: r.lastCheckedAt,
    }));
}

export async function updateNextCheckTime(
  runId: string,
  startsAt: Date,
  cadenceRules?: CadenceRule[]
): Promise<void> {
  const nextCheck = scheduleNextCheck(startsAt, cadenceRules);

  await db
    .update(ccMonitorState)
    .set({ nextCheckAt: nextCheck })
    .where(eq(ccMonitorState.runId, runId));
}

export async function getCadenceRulesForRun(runId: string): Promise<CadenceRule[]> {
  const state = await db.query.ccMonitorState.findFirst({
    where: eq(ccMonitorState.runId, runId),
  });

  if (!state?.policyId) {
    return DEFAULT_CADENCE_RULES;
  }

  const policy = await db.query.ccMonitorPolicies.findFirst({
    where: eq(ccMonitorPolicies.id, state.policyId),
  });

  if (!policy?.cadenceRules) {
    return DEFAULT_CADENCE_RULES;
  }

  return policy.cadenceRules as CadenceRule[];
}

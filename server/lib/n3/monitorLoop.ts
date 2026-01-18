/**
 * N3 Monitor Loop
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Background job that continuously monitors service runs
 * and generates replan bundles when risk conditions change.
 * 
 * Toggle: ENABLE_SERVICE_RUN_MONITOR=true
 */

import { getRunsDueForMonitoring, updateNextCheckTime, getCadenceRulesForRun } from './scheduler';
import { evaluateServiceRun, saveEvaluationResult } from './evaluator';

const MONITOR_INTERVAL_MS = 60 * 1000;
let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

export function isMonitorEnabled(): boolean {
  return process.env.ENABLE_SERVICE_RUN_MONITOR === 'true';
}

export async function runMonitorCycle(): Promise<{
  checked: number;
  bundlesCreated: number;
  errors: number;
}> {
  const stats = { checked: 0, bundlesCreated: 0, errors: 0 };

  try {
    const runsToCheck = await getRunsDueForMonitoring(10);

    for (const run of runsToCheck) {
      try {
        console.log(`[N3 Monitor] Evaluating run: ${run.runName} (${run.runId})`);
        
        const result = await evaluateServiceRun(run.runId, run.tenantId);
        stats.checked++;

        if (result.hasChanged && result.riskLevel !== 'none') {
          const bundleId = await saveEvaluationResult(result);
          if (bundleId) {
            stats.bundlesCreated++;
            console.log(`[N3 Monitor] Created replan bundle: ${bundleId} for run ${run.runId}`);
          }
        } else {
          await saveEvaluationResult(result);
        }

        const cadenceRules = await getCadenceRulesForRun(run.runId);
        await updateNextCheckTime(run.runId, run.startsAt, cadenceRules);

      } catch (err) {
        stats.errors++;
        console.error(`[N3 Monitor] Error evaluating run ${run.runId}:`, err);
      }
    }

  } catch (err) {
    console.error('[N3 Monitor] Error in monitor cycle:', err);
    stats.errors++;
  }

  return stats;
}

export function startMonitor(): void {
  if (isRunning) {
    console.log('[N3 Monitor] Already running');
    return;
  }

  if (!isMonitorEnabled()) {
    console.log('[N3 Monitor] Disabled (set ENABLE_SERVICE_RUN_MONITOR=true to enable)');
    return;
  }

  isRunning = true;
  console.log('[N3 Monitor] Starting service run monitor loop');

  const tick = async () => {
    if (!isRunning) return;
    
    const stats = await runMonitorCycle();
    console.log(`[N3 Monitor] Cycle complete: checked=${stats.checked}, bundles=${stats.bundlesCreated}, errors=${stats.errors}`);
  };

  tick();

  intervalHandle = setInterval(tick, MONITOR_INTERVAL_MS);
}

export function stopMonitor(): void {
  if (!isRunning) {
    console.log('[N3 Monitor] Not running');
    return;
  }

  isRunning = false;
  
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  console.log('[N3 Monitor] Stopped');
}

export function getMonitorStatus(): {
  isRunning: boolean;
  isEnabled: boolean;
} {
  return {
    isRunning,
    isEnabled: isMonitorEnabled(),
  };
}

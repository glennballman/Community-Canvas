import { serviceQuery } from '../../db/tenantDb';
import { fetchAndStoreUrlSnapshot } from './capture';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 60000; // 1 minute

interface ProcessQueueParams {
  limit?: number;
}

interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  deadlettered: number;
}

export async function processCaptureQueue(params: ProcessQueueParams = {}): Promise<ProcessResult> {
  const { limit = 10 } = params;

  // Pick queued items ready for processing
  const queueResult = await serviceQuery<{
    id: string;
    tenant_id: string;
    run_id: string | null;
    capture_id: string;
    attempt_count: number;
  }>(
    `UPDATE cc_record_capture_queue
     SET status = 'processing'
     WHERE id IN (
       SELECT id FROM cc_record_capture_queue
       WHERE status = 'queued' AND next_attempt_at <= now()
       ORDER BY next_attempt_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, tenant_id, run_id, capture_id, attempt_count`,
    [limit]
  );

  const items = queueResult.rows;
  const result: ProcessResult = {
    processed: items.length,
    succeeded: 0,
    failed: 0,
    deadlettered: 0,
  };

  for (const item of items) {
    try {
      // Get capture details
      const captureResult = await serviceQuery<{
        target_url: string;
        capture_type: string;
        source_id: string | null;
        requested_by_individual_id: string | null;
      }>(
        `SELECT target_url, capture_type, source_id, requested_by_individual_id
         FROM cc_record_captures WHERE id = $1`,
        [item.capture_id]
      );

      if (captureResult.rows.length === 0) {
        // Capture was deleted, mark as done
        await serviceQuery(
          `UPDATE cc_record_capture_queue SET status = 'done' WHERE id = $1`,
          [item.id]
        );
        continue;
      }

      const capture = captureResult.rows[0];

      // Reset capture status before retry
      await serviceQuery(
        `UPDATE cc_record_captures SET status = 'pending', error = null WHERE id = $1`,
        [item.capture_id]
      );

      // Attempt fetch
      const fetchResult = await fetchAndStoreUrlSnapshot({
        tenantId: item.tenant_id,
        runId: item.run_id || undefined,
        url: capture.target_url,
        captureType: capture.capture_type as any,
        requestedBy: capture.requested_by_individual_id || undefined,
        sourceId: capture.source_id || undefined,
        deferIfFail: false, // Don't re-queue
      });

      if (fetchResult.status === 'failed') {
        throw new Error(fetchResult.error?.message || 'Fetch failed');
      }

      // Success
      await serviceQuery(
        `UPDATE cc_record_capture_queue SET status = 'done' WHERE id = $1`,
        [item.id]
      );
      result.succeeded++;
    } catch (err: any) {
      const newAttemptCount = item.attempt_count + 1;

      if (newAttemptCount >= MAX_ATTEMPTS) {
        // Deadletter
        await serviceQuery(
          `UPDATE cc_record_capture_queue 
           SET status = 'deadletter', attempt_count = $2, last_error = $3
           WHERE id = $1`,
          [item.id, newAttemptCount, JSON.stringify({ message: err.message })]
        );
        result.deadlettered++;
      } else {
        // Reschedule with backoff
        const backoffMs = BACKOFF_BASE_MS * Math.pow(2, newAttemptCount - 1);
        const nextAttempt = new Date(Date.now() + backoffMs);

        await serviceQuery(
          `UPDATE cc_record_capture_queue 
           SET status = 'queued', attempt_count = $2, next_attempt_at = $3, last_error = $4
           WHERE id = $1`,
          [item.id, newAttemptCount, nextAttempt, JSON.stringify({ message: err.message })]
        );
        result.failed++;
      }
    }
  }

  return result;
}

export async function getQueueStats(tenantId?: string): Promise<{
  queued: number;
  processing: number;
  done: number;
  deadletter: number;
}> {
  let query = `
    SELECT status, COUNT(*)::int as count
    FROM cc_record_capture_queue
  `;
  const params: any[] = [];

  if (tenantId) {
    query += ` WHERE tenant_id = $1`;
    params.push(tenantId);
  }

  query += ` GROUP BY status`;

  const result = await serviceQuery<{ status: string; count: number }>(query, params);

  const stats = { queued: 0, processing: 0, done: 0, deadletter: 0 };
  for (const row of result.rows) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = row.count;
    }
  }

  return stats;
}

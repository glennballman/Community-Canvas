import { pool } from '../db';
import crypto from 'crypto';
import { PoolClient } from 'pg';

async function withServiceMode<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.tenant_id', '__SERVICE__', true)");
    await client.query("SELECT set_config('app.portal_id', '__SERVICE__', true)");
    await client.query("SELECT set_config('app.individual_id', '__SERVICE__', true)");
    return await fn(client);
  } finally {
    await client.query("SELECT set_config('app.tenant_id', '', false)").catch(() => {});
    await client.query("SELECT set_config('app.portal_id', '', false)").catch(() => {});
    await client.query("SELECT set_config('app.individual_id', '', false)").catch(() => {});
    client.release();
  }
}

function redactPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  
  const redacted = Array.isArray(payload) ? [...payload] : { ...payload };
  const sensitiveFields = ['account_number', 'routing_number', 'token', 'secret', 'password', 'key', 'api_key'];
  
  for (const field of sensitiveFields) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  for (const key of Object.keys(redacted)) {
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPayload(redacted[key]);
    }
  }
  
  return redacted;
}

function computeHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function submitTransferToRTR(
  tenantId: string,
  transferId: string,
  rtrProfileId: string
): Promise<{ success: boolean; providerTransferId?: string; error?: string }> {
  return withServiceMode(async (client) => {
    const transferResult = await client.query(`
      SELECT * FROM cc_rail_transfers
      WHERE id = $1 AND tenant_id = $2
    `, [transferId, tenantId]);

    if (transferResult.rows.length === 0) {
      return { success: false, error: 'Transfer not found' };
    }

    const transfer = transferResult.rows[0];

    if (transfer.provider_transfer_id) {
      return {
        success: true,
        providerTransferId: transfer.provider_transfer_id,
        error: 'Already submitted (idempotent)'
      };
    }

    if (!['created', 'queued'].includes(transfer.status)) {
      return { success: false, error: `Cannot submit transfer in status: ${transfer.status}` };
    }

    const prepareResult = await client.query(`
      SELECT cc_rtr_prepare_payment_request($1, $2, $3) as payload
    `, [tenantId, transferId, rtrProfileId]);

    const canonicalPayload = prepareResult.rows[0].payload;

    const profileResult = await client.query(`
      SELECT * FROM cc_rtr_profiles WHERE id = $1 AND tenant_id = $2
    `, [rtrProfileId, tenantId]);

    if (profileResult.rows.length === 0) {
      return { success: false, error: 'RTR profile not found' };
    }

    const providerTransferId = `RTR_${Date.now()}_${transfer.client_request_id}`;
    const providerStatus = 'ACTC';

    await client.query(`
      SELECT cc_set_rail_provider_refs($1, $2, $3, $4)
    `, [tenantId, transferId, providerTransferId, transfer.client_request_id]);

    await client.query(`
      SELECT cc_append_rail_transfer_event(
        $1, $2, 'submitted', 'submitted', $3, NULL, NULL, $4
      )
    `, [tenantId, transferId, providerStatus, JSON.stringify({ profile_id: rtrProfileId })]);

    await client.query(`
      INSERT INTO cc_external_sync_records (
        tenant_id, external_system, external_object_type, external_object_id,
        local_table, local_id, sync_status, last_synced_at
      ) VALUES (
        $1, 'rtr', 'transfer', $2, 'cc_rail_transfers', $3, 'synced', now()
      )
      ON CONFLICT (tenant_id, external_system, external_object_type, external_object_id)
      DO UPDATE SET last_synced_at = now(), sync_status = 'synced'
    `, [tenantId, providerTransferId, transferId]);

    return { success: true, providerTransferId };
  });
}

export async function ingestRTRWebhook(
  tenantId: string,
  rtrProfileId: string,
  headers: any,
  rawPayload: string
): Promise<{ success: boolean; inboxId?: string; duplicate?: boolean; error?: string }> {
  return withServiceMode(async (client) => {
    const eventHash = computeHash(rawPayload);

    let payload: any;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return { success: false, error: 'Invalid JSON payload' };
    }

    const providerEventId = payload.EventId || payload.event_id || null;

    const headersRedacted = redactPayload(headers);
    const payloadRedacted = redactPayload(payload);

    const ingestResult = await client.query(`
      SELECT cc_rtr_ingest_webhook($1, $2, $3, $4, $5, $6) as inbox_id
    `, [tenantId, rtrProfileId, providerEventId, eventHash,
        JSON.stringify(headersRedacted), JSON.stringify(payloadRedacted)]);

    const inboxId = ingestResult.rows[0].inbox_id;

    const inboxResult = await client.query(`
      SELECT processed_at FROM cc_rtr_webhook_inbox WHERE id = $1
    `, [inboxId]);

    if (inboxResult.rows[0]?.processed_at) {
      return { success: true, inboxId, duplicate: true };
    }

    const providerTransferId = payload.PaymentId || payload.payment_id || payload.transfer_id;
    let transferId: string | null = null;

    if (providerTransferId) {
      const transferResult = await client.query(`
        SELECT id FROM cc_rail_transfers 
        WHERE provider_transfer_id = $1 AND tenant_id = $2
      `, [providerTransferId, tenantId]);

      if (transferResult.rows.length > 0) {
        transferId = transferResult.rows[0].id;
      } else {
        const syncResult = await client.query(`
          SELECT local_id FROM cc_external_sync_records
          WHERE external_system = 'rtr' 
            AND external_object_type = 'transfer'
            AND external_object_id = $1
            AND tenant_id = $2
        `, [providerTransferId, tenantId]);

        if (syncResult.rows.length > 0) {
          transferId = syncResult.rows[0].local_id;
        }
      }
    }

    if (!transferId && payload.ClientRequestId) {
      const clientResult = await client.query(`
        SELECT id FROM cc_rail_transfers 
        WHERE client_request_id = $1 AND tenant_id = $2
      `, [payload.ClientRequestId, tenantId]);

      if (clientResult.rows.length > 0) {
        transferId = clientResult.rows[0].id;
      }
    }

    if (transferId) {
      const eventType = payload.EventType || payload.event_type || payload.Status || 'unknown';
      const statusMapping: Record<string, string> = {
        'ACTC': 'accepted',
        'ACCP': 'accepted',
        'ACSP': 'accepted',
        'ACSC': 'settled',
        'RJCT': 'rejected',
        'CANC': 'cancelled',
        'PDNG': 'submitted',
        'accepted': 'accepted',
        'settled': 'settled',
        'rejected': 'rejected',
        'failed': 'failed',
        'cancelled': 'cancelled'
      };

      const newStatus = statusMapping[eventType] || 'unknown';
      const providerReasonCode = payload.ReasonCode || payload.reason_code || null;
      const providerReasonMessage = payload.ReasonMessage || payload.reason_message || null;

      await client.query(`
        SELECT cc_append_rail_transfer_event(
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `, [tenantId, transferId, eventType, newStatus, eventType,
          providerReasonCode, providerReasonMessage, JSON.stringify({ inbox_id: inboxId })]);

      if (newStatus === 'settled') {
        await processSettledTransfer(client, tenantId, transferId);
      }

      if (['rejected', 'failed', 'cancelled'].includes(newStatus)) {
        await releaseHoldForTransfer(client, tenantId, transferId, newStatus);
      }
    }

    await client.query(`
      UPDATE cc_rtr_webhook_inbox
      SET processed_at = now(), processing_result = 'success'
      WHERE id = $1
    `, [inboxId]);

    return { success: true, inboxId, duplicate: false };
  });
}

async function processSettledTransfer(client: PoolClient, tenantId: string, transferId: string): Promise<void> {
  const transferResult = await client.query(`
    SELECT * FROM cc_rail_transfers WHERE id = $1 AND tenant_id = $2
  `, [transferId, tenantId]);

  if (transferResult.rows.length === 0) return;

  const transfer = transferResult.rows[0];

  const existingEntry = await client.query(`
    SELECT id FROM cc_wallet_entries
    WHERE reference_type = 'rail_transfer' AND reference_id = $1 AND tenant_id = $2
  `, [transferId, tenantId]);

  if (existingEntry.rows.length > 0) {
    console.log(`Wallet entry already exists for transfer ${transferId}`);
    return;
  }

  if (transfer.direction === 'inbound' && transfer.reference_type === 'wallet_topup') {
    const walletAccountId = transfer.reference_id;

    await client.query(`
      SELECT cc_post_wallet_entry(
        $1, $2, 'credit', $3, 'CAD', 'RTR top-up settled', 'rail_transfer', $4, NULL
      )
    `, [tenantId, walletAccountId, transfer.amount_cents, transferId]);

    console.log(`Posted credit for top-up transfer ${transferId}`);

  } else if (transfer.direction === 'outbound' && transfer.reference_type === 'wallet_cashout') {
    const holdId = transfer.reference_id;

    await client.query(`
      SELECT cc_capture_wallet_hold($1, $2, 'RTR cash-out settled', 'rail_transfer', $3)
    `, [tenantId, holdId, transferId]);

    console.log(`Captured hold for cash-out transfer ${transferId}`);
  }
}

async function releaseHoldForTransfer(client: PoolClient, tenantId: string, transferId: string, reason: string): Promise<void> {
  const transferResult = await client.query(`
    SELECT * FROM cc_rail_transfers WHERE id = $1 AND tenant_id = $2
  `, [transferId, tenantId]);

  if (transferResult.rows.length === 0) return;

  const transfer = transferResult.rows[0];

  if (transfer.direction === 'outbound' && transfer.reference_type === 'wallet_cashout') {
    const holdId = transfer.reference_id;

    const holdResult = await client.query(`
      SELECT status FROM cc_wallet_holds WHERE id = $1 AND tenant_id = $2
    `, [holdId, tenantId]);

    if (holdResult.rows[0]?.status === 'active') {
      await client.query(`
        SELECT cc_release_wallet_hold($1, $2, $3)
      `, [tenantId, holdId, `Transfer ${reason}`]);

      console.log(`Released hold ${holdId} for ${reason} transfer ${transferId}`);
    }
  }
}

export async function runReconciliation(tenantId: string, rtrProfileId: string): Promise<void> {
  return withServiceMode(async (client) => {
    const pendingResult = await client.query(`
      SELECT id, provider_transfer_id, status 
      FROM cc_rail_transfers
      WHERE tenant_id = $1 
        AND status NOT IN ('settled', 'rejected', 'failed', 'cancelled', 'expired')
        AND provider_transfer_id IS NOT NULL
    `, [tenantId]);

    for (const transfer of pendingResult.rows) {
      console.log(`Reconciling transfer ${transfer.id} (provider: ${transfer.provider_transfer_id})`);
    }
  });
}

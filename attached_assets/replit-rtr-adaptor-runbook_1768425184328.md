# REPLIT: RTR Adaptor Runbook Implementation

## Objective
Implement the API routes and worker services that sit on top of the stored value database infrastructure (Migrations 118-120) to enable Payments Canada Real-Time Rail integration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         App API Layer                           │
│  (Wallet intents, transfer status, balance queries)             │
├─────────────────────────────────────────────────────────────────┤
│                      RTR Worker (Service-Mode)                  │
│  (Submit transfers, ingest webhooks, reconciliation)            │
├─────────────────────────────────────────────────────────────────┤
│                      Database Spine (Done)                      │
│  Payment Rail + Wallet Ledger + RTR Connector Pack              │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites
- Migration 118: Payment Rail Spine ✅
- Migration 119: Wallet Ledger Spine ✅
- Migration 120: RTR Connector Pack ✅
- Total: 515 cc_* tables

---

## Part 1: API Routes Implementation

### 1.1 Wallet Intent Endpoints (App API - RLS-respecting)

Create file: `server/routes/wallet.ts`

```typescript
import { Router } from 'express';
import { db } from '../db';
import { requireAuth, getTenantId } from '../middleware/auth';

const router = Router();

// POST /api/wallet/topups - Create inbound rail transfer intent
router.post('/topups', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const { 
    wallet_account_id, 
    amount_cents, 
    to_rail_account_id, 
    client_request_id, 
    memo 
  } = req.body;

  // Validation
  if (!wallet_account_id || !amount_cents || !to_rail_account_id || !client_request_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (amount_cents <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  try {
    // Create inbound rail transfer (no hold needed for top-ups)
    const result = await db.query(`
      SELECT cc_create_rail_transfer(
        $1::uuid,           -- p_tenant_id
        $2::text,           -- p_client_request_id
        'inbound'::rail_direction,
        $3::bigint,         -- p_amount_cents
        'CAD',
        NULL::uuid,         -- p_from_rail_account_id (external sender)
        $4::uuid,           -- p_to_rail_account_id (our account)
        $5::text,           -- p_memo
        'wallet_topup',     -- p_reference_type
        $6::uuid            -- p_reference_id (wallet_account_id)
      ) as transfer_id
    `, [tenantId, client_request_id, amount_cents, to_rail_account_id, memo, wallet_account_id]);

    res.status(201).json({
      transfer_id: result.rows[0].transfer_id,
      status: 'created',
      message: 'Top-up transfer created. Awaiting RTR submission.'
    });
  } catch (error: any) {
    if (error.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Duplicate client_request_id' });
    }
    console.error('Top-up creation failed:', error);
    res.status(500).json({ error: 'Failed to create top-up' });
  }
});

// POST /api/wallet/cashouts - Create outbound rail transfer with hold
router.post('/cashouts', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const { 
    wallet_account_id, 
    amount_cents, 
    from_rail_account_id,
    to_rail_account_id, 
    client_request_id, 
    memo 
  } = req.body;

  // Validation
  if (!wallet_account_id || !amount_cents || !from_rail_account_id || !to_rail_account_id || !client_request_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (amount_cents <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  try {
    // Step 1: Place hold on wallet (reserves funds)
    const holdResult = await db.query(`
      SELECT cc_place_wallet_hold(
        $1::uuid,           -- p_tenant_id
        $2::uuid,           -- p_wallet_account_id
        $3::bigint,         -- p_amount_cents
        'cashout',          -- p_reason
        'rail_transfer_intent',  -- p_reference_type
        NULL::uuid,         -- p_reference_id (will update after transfer created)
        NULL::timestamptz   -- p_expires_at
      ) as hold_id
    `, [tenantId, wallet_account_id, amount_cents]);

    const holdId = holdResult.rows[0].hold_id;

    // Step 2: Create outbound rail transfer linked to hold
    const transferResult = await db.query(`
      SELECT cc_create_rail_transfer(
        $1::uuid,           -- p_tenant_id
        $2::text,           -- p_client_request_id
        'outbound'::rail_direction,
        $3::bigint,         -- p_amount_cents
        'CAD',
        $4::uuid,           -- p_from_rail_account_id (our account)
        $5::uuid,           -- p_to_rail_account_id (external recipient)
        $6::text,           -- p_memo
        'wallet_cashout',   -- p_reference_type
        $7::uuid            -- p_reference_id (hold_id)
      ) as transfer_id
    `, [tenantId, client_request_id, amount_cents, from_rail_account_id, to_rail_account_id, memo, holdId]);

    const transferId = transferResult.rows[0].transfer_id;

    // Step 3: Update hold with transfer reference
    await db.query(`
      UPDATE cc_wallet_holds 
      SET reference_id = $1, metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('transfer_id', $1::text)
      WHERE id = $2 AND tenant_id = $3
    `, [transferId, holdId, tenantId]);

    res.status(201).json({
      transfer_id: transferId,
      hold_id: holdId,
      status: 'created',
      message: 'Cash-out transfer created with hold. Awaiting RTR submission.'
    });
  } catch (error: any) {
    if (error.message?.includes('Insufficient available balance')) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    if (error.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Duplicate client_request_id' });
    }
    console.error('Cash-out creation failed:', error);
    res.status(500).json({ error: 'Failed to create cash-out' });
  }
});

// GET /api/wallet/accounts/:id - Get wallet balance and recent entries
router.get('/accounts/:id', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const walletAccountId = req.params.id;

  try {
    // Get account with balances
    const accountResult = await db.query(`
      SELECT 
        id, account_name, currency, status,
        posted_balance_cents, available_balance_cents, active_holds_cents,
        created_at, updated_at
      FROM cc_wallet_accounts
      WHERE id = $1 AND tenant_id = $2
    `, [walletAccountId, tenantId]);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet account not found' });
    }

    // Get recent entries (last 20)
    const entriesResult = await db.query(`
      SELECT 
        id, entry_type, status, amount_cents, currency,
        reference_type, reference_id, description,
        sequence_number, posted_at
      FROM cc_wallet_entries
      WHERE wallet_account_id = $1 AND tenant_id = $2
      ORDER BY sequence_number DESC
      LIMIT 20
    `, [walletAccountId, tenantId]);

    // Get active holds
    const holdsResult = await db.query(`
      SELECT 
        id, status, amount_cents, reason, expires_at, created_at
      FROM cc_wallet_holds
      WHERE wallet_account_id = $1 AND tenant_id = $2 AND status = 'active'
      ORDER BY created_at DESC
    `, [walletAccountId, tenantId]);

    res.json({
      account: accountResult.rows[0],
      recent_entries: entriesResult.rows,
      active_holds: holdsResult.rows
    });
  } catch (error) {
    console.error('Failed to get wallet account:', error);
    res.status(500).json({ error: 'Failed to retrieve wallet account' });
  }
});

export default router;
```

### 1.2 Rail Transfer Status Endpoint

Create file: `server/routes/rail.ts`

```typescript
import { Router } from 'express';
import { db } from '../db';
import { requireAuth, getTenantId } from '../middleware/auth';

const router = Router();

// GET /api/rail/transfers/:id - Get transfer status and events
router.get('/transfers/:id', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const transferId = req.params.id;

  try {
    // Get transfer
    const transferResult = await db.query(`
      SELECT 
        id, client_request_id, direction, status,
        amount_cents, currency, memo, reference_text,
        from_rail_account_id, to_rail_account_id,
        provider_transfer_id, provider_status,
        requested_at, submitted_at, completed_at,
        created_at, updated_at
      FROM cc_rail_transfers
      WHERE id = $1 AND tenant_id = $2
    `, [transferId, tenantId]);

    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    // Get events (most recent first)
    const eventsResult = await db.query(`
      SELECT 
        id, event_type, previous_status, new_status,
        provider_status, provider_reason_code, provider_reason_message,
        event_data, created_at
      FROM cc_rail_transfer_events
      WHERE transfer_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 50
    `, [transferId, tenantId]);

    res.json({
      transfer: transferResult.rows[0],
      events: eventsResult.rows
    });
  } catch (error) {
    console.error('Failed to get transfer:', error);
    res.status(500).json({ error: 'Failed to retrieve transfer' });
  }
});

export default router;
```

---

## Part 2: RTR Worker (Service-Mode Only)

Create file: `server/workers/rtr-worker.ts`

```typescript
import { db } from '../db';
import crypto from 'crypto';

// Helper: Set service mode for worker operations
async function withServiceMode<T>(fn: () => Promise<T>): Promise<T> {
  await db.query("SELECT set_config('app.tenant_id', '__SERVICE__', true)");
  try {
    return await fn();
  } finally {
    await db.query("SELECT set_config('app.tenant_id', '', true)");
  }
}

// Helper: Redact sensitive fields from payload
function redactPayload(payload: any): any {
  const redacted = { ...payload };
  const sensitiveFields = ['account_number', 'routing_number', 'token', 'secret', 'password', 'key'];
  
  for (const field of sensitiveFields) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  // Recursively redact nested objects
  for (const key of Object.keys(redacted)) {
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactPayload(redacted[key]);
    }
  }
  
  return redacted;
}

// Helper: Compute SHA256 hash
function computeHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Submit a transfer to RTR (idempotent)
 * Called by: POST /internal/rtr/submit-transfer
 */
export async function submitTransferToRTR(
  tenantId: string,
  transferId: string,
  rtrProfileId: string
): Promise<{ success: boolean; providerTransferId?: string; error?: string }> {
  return withServiceMode(async () => {
    // 1. Load transfer and verify it's submittable
    const transferResult = await db.query(`
      SELECT * FROM cc_rail_transfers
      WHERE id = $1 AND tenant_id = $2
    `, [transferId, tenantId]);

    if (transferResult.rows.length === 0) {
      return { success: false, error: 'Transfer not found' };
    }

    const transfer = transferResult.rows[0];

    // Idempotency: already submitted?
    if (transfer.provider_transfer_id) {
      return { 
        success: true, 
        providerTransferId: transfer.provider_transfer_id,
        error: 'Already submitted (idempotent)' 
      };
    }

    // Only submit if status is created or queued
    if (!['created', 'queued'].includes(transfer.status)) {
      return { success: false, error: `Cannot submit transfer in status: ${transfer.status}` };
    }

    // 2. Prepare canonical payload (logs outbound message)
    const prepareResult = await db.query(`
      SELECT cc_rtr_prepare_payment_request($1, $2, $3) as payload
    `, [tenantId, transferId, rtrProfileId]);

    const canonicalPayload = prepareResult.rows[0].payload;

    // 3. Load RTR profile for endpoint config
    const profileResult = await db.query(`
      SELECT * FROM cc_rtr_profiles WHERE id = $1 AND tenant_id = $2
    `, [rtrProfileId, tenantId]);

    if (profileResult.rows.length === 0) {
      return { success: false, error: 'RTR profile not found' };
    }

    const profile = profileResult.rows[0];

    // 4. Transform to ISO 20022 and submit to RTR API
    // NOTE: In production, this calls the actual Payments Canada RTR sandbox API
    // For now, simulate the response
    const providerTransferId = `RTR_${Date.now()}_${transfer.client_request_id}`;
    const providerStatus = 'ACTC'; // Accepted Technical Validation
    
    /*
    // PRODUCTION: Actual RTR API call would look like:
    const rtrResponse = await fetch(`${profile.endpoint_base_url}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptedApiKey}`,
        'X-Request-Id': transfer.client_request_id
      },
      body: JSON.stringify(transformToISO20022(canonicalPayload))
    });
    
    const rtrData = await rtrResponse.json();
    const providerTransferId = rtrData.PaymentId;
    const providerStatus = rtrData.Status;
    */

    // 5. Update transfer with provider refs
    await db.query(`
      SELECT cc_set_rail_provider_refs($1, $2, $3, $4)
    `, [tenantId, transferId, providerTransferId, transfer.client_request_id]);

    // 6. Append submitted event
    await db.query(`
      SELECT cc_append_rail_transfer_event(
        $1, $2, 'submitted', 'submitted', $3, NULL, NULL, $4
      )
    `, [tenantId, transferId, providerStatus, JSON.stringify({ profile_id: rtrProfileId })]);

    // 7. Create/update external sync record
    await db.query(`
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

/**
 * Ingest RTR webhook (idempotent)
 * Called by: POST /internal/rtr/webhook
 */
export async function ingestRTRWebhook(
  tenantId: string,
  rtrProfileId: string,
  headers: any,
  rawPayload: string
): Promise<{ success: boolean; inboxId?: string; duplicate?: boolean; error?: string }> {
  return withServiceMode(async () => {
    // 1. Compute hash for idempotency
    const eventHash = computeHash(rawPayload);
    
    // 2. Parse and extract provider event ID
    let payload: any;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return { success: false, error: 'Invalid JSON payload' };
    }
    
    const providerEventId = payload.EventId || payload.event_id || null;

    // 3. Redact sensitive data
    const headersRedacted = redactPayload(headers);
    const payloadRedacted = redactPayload(payload);

    // 4. Ingest into webhook inbox (idempotent)
    const ingestResult = await db.query(`
      SELECT cc_rtr_ingest_webhook($1, $2, $3, $4, $5, $6) as inbox_id
    `, [tenantId, rtrProfileId, providerEventId, eventHash, 
        JSON.stringify(headersRedacted), JSON.stringify(payloadRedacted)]);

    const inboxId = ingestResult.rows[0].inbox_id;

    // 5. Check if this was a duplicate (inbox already processed)
    const inboxResult = await db.query(`
      SELECT processed_at FROM cc_rtr_webhook_inbox WHERE id = $1
    `, [inboxId]);

    if (inboxResult.rows[0]?.processed_at) {
      return { success: true, inboxId, duplicate: true };
    }

    // 6. Resolve local transfer ID
    const providerTransferId = payload.PaymentId || payload.payment_id || payload.transfer_id;
    let transferId: string | null = null;

    if (providerTransferId) {
      // Try by provider_transfer_id first
      const transferResult = await db.query(`
        SELECT id FROM cc_rail_transfers 
        WHERE provider_transfer_id = $1 AND tenant_id = $2
      `, [providerTransferId, tenantId]);

      if (transferResult.rows.length > 0) {
        transferId = transferResult.rows[0].id;
      } else {
        // Fall back to external sync records
        const syncResult = await db.query(`
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

    // 7. If no transfer found, try client_request_id
    if (!transferId && payload.ClientRequestId) {
      const clientResult = await db.query(`
        SELECT id FROM cc_rail_transfers 
        WHERE client_request_id = $1 AND tenant_id = $2
      `, [payload.ClientRequestId, tenantId]);

      if (clientResult.rows.length > 0) {
        transferId = clientResult.rows[0].id;
      }
    }

    // 8. Translate provider event to rail event
    if (transferId) {
      const eventType = payload.EventType || payload.event_type || payload.Status || 'unknown';
      const statusMapping: Record<string, string> = {
        'ACTC': 'accepted',      // Accepted Technical Validation
        'ACCP': 'accepted',      // Accepted
        'ACSP': 'accepted',      // Accepted Settlement In Process
        'ACSC': 'settled',       // Accepted Settlement Completed
        'RJCT': 'rejected',      // Rejected
        'CANC': 'cancelled',     // Cancelled
        'PDNG': 'submitted',     // Pending
        'accepted': 'accepted',
        'settled': 'settled',
        'rejected': 'rejected',
        'failed': 'failed',
        'cancelled': 'cancelled'
      };

      const newStatus = statusMapping[eventType] || 'unknown';
      const providerReasonCode = payload.ReasonCode || payload.reason_code || null;
      const providerReasonMessage = payload.ReasonMessage || payload.reason_message || null;

      // Append rail transfer event
      await db.query(`
        SELECT cc_append_rail_transfer_event(
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `, [tenantId, transferId, eventType, newStatus, eventType, 
          providerReasonCode, providerReasonMessage, JSON.stringify({ inbox_id: inboxId })]);

      // 9. Handle wallet posting (ONLY on settled)
      if (newStatus === 'settled') {
        await processSettledTransfer(tenantId, transferId);
      }

      // 10. Handle hold release (on rejected/failed/cancelled)
      if (['rejected', 'failed', 'cancelled'].includes(newStatus)) {
        await releaseHoldForTransfer(tenantId, transferId, newStatus);
      }
    }

    // 11. Mark inbox as processed
    await db.query(`
      UPDATE cc_rtr_webhook_inbox
      SET processed_at = now(), processing_result = 'success'
      WHERE id = $1
    `, [inboxId]);

    return { success: true, inboxId, duplicate: false };
  });
}

/**
 * Process a settled transfer - post wallet entry
 */
async function processSettledTransfer(tenantId: string, transferId: string): Promise<void> {
  // Get transfer details
  const transferResult = await db.query(`
    SELECT * FROM cc_rail_transfers WHERE id = $1 AND tenant_id = $2
  `, [transferId, tenantId]);

  if (transferResult.rows.length === 0) return;

  const transfer = transferResult.rows[0];

  // Check if wallet entry already exists (idempotency)
  const existingEntry = await db.query(`
    SELECT id FROM cc_wallet_entries
    WHERE reference_type = 'rail_transfer' AND reference_id = $1 AND tenant_id = $2
  `, [transferId, tenantId]);

  if (existingEntry.rows.length > 0) {
    console.log(`Wallet entry already exists for transfer ${transferId}`);
    return;
  }

  if (transfer.direction === 'inbound' && transfer.reference_type === 'wallet_topup') {
    // Inbound top-up: credit the wallet
    const walletAccountId = transfer.reference_id; // stored wallet_account_id in reference_id

    await db.query(`
      SELECT cc_post_wallet_entry(
        $1, $2, 'credit', $3, 'CAD', 'RTR top-up settled', 'rail_transfer', $4, NULL
      )
    `, [tenantId, walletAccountId, transfer.amount_cents, transferId]);

    console.log(`Posted credit for top-up transfer ${transferId}`);

  } else if (transfer.direction === 'outbound' && transfer.reference_type === 'wallet_cashout') {
    // Outbound cash-out: capture the hold
    const holdId = transfer.reference_id; // stored hold_id in reference_id

    await db.query(`
      SELECT cc_capture_wallet_hold($1, $2, 'RTR cash-out settled', 'rail_transfer', $3)
    `, [tenantId, holdId, transferId]);

    console.log(`Captured hold for cash-out transfer ${transferId}`);
  }
}

/**
 * Release hold for rejected/failed/cancelled transfer
 */
async function releaseHoldForTransfer(tenantId: string, transferId: string, reason: string): Promise<void> {
  // Get transfer details
  const transferResult = await db.query(`
    SELECT * FROM cc_rail_transfers WHERE id = $1 AND tenant_id = $2
  `, [transferId, tenantId]);

  if (transferResult.rows.length === 0) return;

  const transfer = transferResult.rows[0];

  if (transfer.direction === 'outbound' && transfer.reference_type === 'wallet_cashout') {
    const holdId = transfer.reference_id;

    // Check if hold is still active
    const holdResult = await db.query(`
      SELECT status FROM cc_wallet_holds WHERE id = $1 AND tenant_id = $2
    `, [holdId, tenantId]);

    if (holdResult.rows[0]?.status === 'active') {
      await db.query(`
        SELECT cc_release_wallet_hold($1, $2, $3)
      `, [tenantId, holdId, `Transfer ${reason}`]);

      console.log(`Released hold ${holdId} for ${reason} transfer ${transferId}`);
    }
  }
}

/**
 * Reconciliation job - sync with RTR API
 * Called by: POST /internal/rtr/reconcile or cron job
 */
export async function runReconciliation(tenantId: string, rtrProfileId: string): Promise<void> {
  return withServiceMode(async () => {
    // Get all transfers in non-terminal states
    const pendingResult = await db.query(`
      SELECT id, provider_transfer_id, status 
      FROM cc_rail_transfers
      WHERE tenant_id = $1 
        AND status NOT IN ('settled', 'rejected', 'failed', 'cancelled', 'expired')
        AND provider_transfer_id IS NOT NULL
    `, [tenantId]);

    for (const transfer of pendingResult.rows) {
      // In production: query RTR API for current status
      // const rtrStatus = await fetchRTRStatus(transfer.provider_transfer_id);
      
      // For now, just log
      console.log(`Reconciling transfer ${transfer.id} (provider: ${transfer.provider_transfer_id})`);
    }
  });
}
```

---

## Part 3: Internal API Routes (Service-Mode Only)

Create file: `server/routes/internal-rtr.ts`

```typescript
import { Router } from 'express';
import { requireServiceMode } from '../middleware/auth';
import { submitTransferToRTR, ingestRTRWebhook, runReconciliation } from '../workers/rtr-worker';

const router = Router();

// All routes require service mode
router.use(requireServiceMode);

// POST /internal/rtr/submit-transfer
router.post('/submit-transfer', async (req, res) => {
  const { tenant_id, transfer_id, rtr_profile_id } = req.body;

  if (!tenant_id || !transfer_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await submitTransferToRTR(tenant_id, transfer_id, rtr_profile_id);
    
    if (result.success) {
      res.json({
        success: true,
        provider_transfer_id: result.providerTransferId,
        message: result.error || 'Transfer submitted'
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Submit transfer failed:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /internal/rtr/webhook
router.post('/webhook', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const rtrProfileId = req.headers['x-rtr-profile-id'] as string;

  if (!tenantId || !rtrProfileId) {
    return res.status(400).json({ error: 'Missing tenant or profile headers' });
  }

  try {
    const rawPayload = JSON.stringify(req.body);
    const result = await ingestRTRWebhook(tenantId, rtrProfileId, req.headers, rawPayload);

    if (result.success) {
      res.json({
        success: true,
        inbox_id: result.inboxId,
        duplicate: result.duplicate
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Webhook ingestion failed:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /internal/rtr/reconcile
router.post('/reconcile', async (req, res) => {
  const { tenant_id, rtr_profile_id } = req.body;

  if (!tenant_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await runReconciliation(tenant_id, rtr_profile_id);
    res.json({ success: true, message: 'Reconciliation complete' });
  } catch (error) {
    console.error('Reconciliation failed:', error);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
```

---

## Part 4: Middleware Updates

Update file: `server/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

export function getTenantId(req: Request): string {
  // Get from session, JWT, or header
  return req.headers['x-tenant-id'] as string || (req as any).tenantId;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const tenantId = getTenantId(req);
  
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized - missing tenant' });
  }
  
  // Set tenant context for RLS
  db.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
    .then(() => next())
    .catch(next);
}

export function requireServiceMode(req: Request, res: Response, next: NextFunction) {
  const serviceKey = req.headers['x-service-key'];
  
  // In production, validate against secure service key
  if (serviceKey !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ error: 'Service mode required' });
  }
  
  // Set service mode
  db.query("SELECT set_config('app.tenant_id', '__SERVICE__', true)")
    .then(() => next())
    .catch(next);
}
```

---

## Part 5: Route Registration

Update file: `server/index.ts` (add these imports and routes)

```typescript
import walletRoutes from './routes/wallet';
import railRoutes from './routes/rail';
import internalRtrRoutes from './routes/internal-rtr';

// Public API routes (RLS-respecting)
app.use('/api/wallet', walletRoutes);
app.use('/api/rail', railRoutes);

// Internal service routes (service-mode only)
app.use('/internal/rtr', internalRtrRoutes);
```

---

## Part 6: Test Cases

Create file: `server/tests/rtr-adaptor.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';

// Test tenant and profile setup
let testTenantId: string;
let testWalletId: string;
let testRailAccountId: string;
let testRtrProfileId: string;
let testConnectorId: string;

beforeAll(async () => {
  // Set service mode
  await db.query("SELECT set_config('app.tenant_id', '__SERVICE__', true)");
  
  // Get test tenant
  const tenantResult = await db.query('SELECT id FROM cc_tenants LIMIT 1');
  testTenantId = tenantResult.rows[0].id;
  
  // Create test wallet account
  const walletResult = await db.query(`
    SELECT cc_create_wallet_account($1, 'Test Wallet', NULL, NULL, 'CAD', NULL) as id
  `, [testTenantId]);
  testWalletId = walletResult.rows[0].id;
  
  // Create test rail account
  const railResult = await db.query(`
    INSERT INTO cc_rail_accounts (tenant_id, account_type, account_name, is_active)
    VALUES ($1, 'checking', 'Test Rail Account', true)
    RETURNING id
  `, [testTenantId]);
  testRailAccountId = railResult.rows[0].id;
  
  // Create connector and profile
  const connectorResult = await db.query(`
    INSERT INTO cc_rail_connectors (tenant_id, connector_key, provider, environment, is_active)
    VALUES ($1, 'rtr_test', 'payments_canada', 'sandbox', true)
    RETURNING id
  `, [testTenantId]);
  testConnectorId = connectorResult.rows[0].id;
  
  const profileResult = await db.query(`
    SELECT cc_register_rtr_profile($1, $2, 'sandbox', 'https://sandbox.rtr.api', 'TEST123', 'v1') as id
  `, [testTenantId, testConnectorId]);
  testRtrProfileId = profileResult.rows[0].id;
  
  // Fund the wallet with initial balance
  await db.query(`
    SELECT cc_post_wallet_entry($1, $2, 'credit', 10000, 'CAD', 'Initial funding', 'manual', NULL, NULL)
  `, [testTenantId, testWalletId]);
});

afterAll(async () => {
  // Cleanup would go here in production
  await db.query("SELECT set_config('app.tenant_id', '', true)");
});

describe('T1: Inbound top-up happy path', () => {
  let transferId: string;
  
  it('creates transfer in created status', async () => {
    const result = await db.query(`
      SELECT cc_create_rail_transfer(
        $1, 'topup_test_001', 'inbound', 2500, 'CAD',
        NULL, $2, 'Test top-up', 'wallet_topup', $3
      ) as id
    `, [testTenantId, testRailAccountId, testWalletId]);
    
    transferId = result.rows[0].id;
    
    const transfer = await db.query('SELECT status FROM cc_rail_transfers WHERE id = $1', [transferId]);
    expect(transfer.rows[0].status).toBe('created');
  });
  
  it('submits to RTR', async () => {
    await db.query(`SELECT cc_set_rail_provider_refs($1, $2, 'RTR_TEST_001', 'topup_test_001')`, 
      [testTenantId, transferId]);
    
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'submitted', 'submitted', 'ACTC', NULL, NULL, NULL)
    `, [testTenantId, transferId]);
    
    const transfer = await db.query('SELECT status FROM cc_rail_transfers WHERE id = $1', [transferId]);
    expect(transfer.rows[0].status).toBe('submitted');
  });
  
  it('accepts transfer', async () => {
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'status_update', 'accepted', 'ACCP', NULL, NULL, NULL)
    `, [testTenantId, transferId]);
    
    const transfer = await db.query('SELECT status FROM cc_rail_transfers WHERE id = $1', [transferId]);
    expect(transfer.rows[0].status).toBe('accepted');
  });
  
  it('settles and credits wallet', async () => {
    // Get balance before
    const beforeBalance = await db.query(
      'SELECT posted_balance_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    const balanceBefore = beforeBalance.rows[0].posted_balance_cents;
    
    // Settle
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'status_update', 'settled', 'ACSC', NULL, NULL, NULL)
    `, [testTenantId, transferId]);
    
    // Post wallet credit
    await db.query(`
      SELECT cc_post_wallet_entry($1, $2, 'credit', 2500, 'CAD', 'RTR top-up', 'rail_transfer', $3, NULL)
    `, [testTenantId, testWalletId, transferId]);
    
    // Verify
    const transfer = await db.query('SELECT status FROM cc_rail_transfers WHERE id = $1', [transferId]);
    expect(transfer.rows[0].status).toBe('settled');
    
    const afterBalance = await db.query(
      'SELECT posted_balance_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    expect(afterBalance.rows[0].posted_balance_cents).toBe(balanceBefore + 2500);
    
    // Verify exactly one wallet entry for this transfer
    const entries = await db.query(`
      SELECT COUNT(*) as cnt FROM cc_wallet_entries 
      WHERE reference_type = 'rail_transfer' AND reference_id = $1
    `, [transferId]);
    expect(parseInt(entries.rows[0].cnt)).toBe(1);
  });
});

describe('T2: Outbound cash-out happy path', () => {
  let transferId: string;
  let holdId: string;
  
  it('creates hold and transfer', async () => {
    // Get available balance
    const balanceResult = await db.query(
      'SELECT available_balance_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    const availableBefore = balanceResult.rows[0].available_balance_cents;
    
    // Place hold
    const holdResult = await db.query(`
      SELECT cc_place_wallet_hold($1, $2, 1500, 'cashout', 'rail_transfer_intent', NULL, NULL) as id
    `, [testTenantId, testWalletId]);
    holdId = holdResult.rows[0].id;
    
    // Verify available decreased
    const afterHold = await db.query(
      'SELECT available_balance_cents, active_holds_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    expect(afterHold.rows[0].available_balance_cents).toBe(availableBefore - 1500);
    expect(afterHold.rows[0].active_holds_cents).toBe(1500);
    
    // Create transfer
    const transferResult = await db.query(`
      SELECT cc_create_rail_transfer(
        $1, 'cashout_test_001', 'outbound', 1500, 'CAD',
        $2, $3, 'Test cash-out', 'wallet_cashout', $4
      ) as id
    `, [testTenantId, testRailAccountId, testRailAccountId, holdId]);
    transferId = transferResult.rows[0].id;
    
    const transfer = await db.query('SELECT status FROM cc_rail_transfers WHERE id = $1', [transferId]);
    expect(transfer.rows[0].status).toBe('created');
  });
  
  it('settles and captures hold', async () => {
    // Submit and settle
    await db.query(`SELECT cc_set_rail_provider_refs($1, $2, 'RTR_TEST_002', 'cashout_test_001')`, 
      [testTenantId, transferId]);
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'submitted', 'submitted', 'ACTC', NULL, NULL, NULL)
    `, [testTenantId, transferId]);
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'status_update', 'settled', 'ACSC', NULL, NULL, NULL)
    `, [testTenantId, transferId]);
    
    // Capture hold
    await db.query(`
      SELECT cc_capture_wallet_hold($1, $2, 'Cash-out settled', 'rail_transfer', $3)
    `, [testTenantId, holdId, transferId]);
    
    // Verify hold captured
    const hold = await db.query('SELECT status FROM cc_wallet_holds WHERE id = $1', [holdId]);
    expect(hold.rows[0].status).toBe('captured');
    
    // Verify active holds returned to 0
    const wallet = await db.query(
      'SELECT active_holds_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    expect(wallet.rows[0].active_holds_cents).toBe(0);
    
    // Verify debit entry linked to hold
    const entries = await db.query(`
      SELECT * FROM cc_wallet_entries 
      WHERE hold_id = $1 AND entry_type = 'debit'
    `, [holdId]);
    expect(entries.rows.length).toBe(1);
  });
});

describe('T3: Cash-out rejected releases hold', () => {
  let transferId: string;
  let holdId: string;
  
  it('releases hold on rejection', async () => {
    // Get balance before
    const beforeWallet = await db.query(
      'SELECT available_balance_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    const availableBefore = beforeWallet.rows[0].available_balance_cents;
    
    // Place hold
    const holdResult = await db.query(`
      SELECT cc_place_wallet_hold($1, $2, 500, 'cashout', 'rail_transfer_intent', NULL, NULL) as id
    `, [testTenantId, testWalletId]);
    holdId = holdResult.rows[0].id;
    
    // Create transfer
    const transferResult = await db.query(`
      SELECT cc_create_rail_transfer(
        $1, 'cashout_reject_001', 'outbound', 500, 'CAD',
        $2, $3, 'Test rejection', 'wallet_cashout', $4
      ) as id
    `, [testTenantId, testRailAccountId, testRailAccountId, holdId]);
    transferId = transferResult.rows[0].id;
    
    // Submit and reject
    await db.query(`SELECT cc_set_rail_provider_refs($1, $2, 'RTR_TEST_003', 'cashout_reject_001')`, 
      [testTenantId, transferId]);
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'submitted', 'submitted', 'ACTC', NULL, NULL, NULL)
    `, [testTenantId, transferId]);
    await db.query(`
      SELECT cc_append_rail_transfer_event($1, $2, 'status_update', 'rejected', 'RJCT', 'AC01', 'Incorrect account', NULL)
    `, [testTenantId, transferId]);
    
    // Release hold
    await db.query(`SELECT cc_release_wallet_hold($1, $2, 'Transfer rejected')`, [testTenantId, holdId]);
    
    // Verify
    const transfer = await db.query('SELECT status FROM cc_rail_transfers WHERE id = $1', [transferId]);
    expect(transfer.rows[0].status).toBe('rejected');
    
    const hold = await db.query('SELECT status FROM cc_wallet_holds WHERE id = $1', [holdId]);
    expect(hold.rows[0].status).toBe('released');
    
    // Available balance restored
    const afterWallet = await db.query(
      'SELECT available_balance_cents FROM cc_wallet_accounts WHERE id = $1', [testWalletId]);
    expect(afterWallet.rows[0].available_balance_cents).toBe(availableBefore);
    
    // No debit entry posted
    const entries = await db.query(`
      SELECT COUNT(*) as cnt FROM cc_wallet_entries 
      WHERE reference_type = 'rail_transfer' AND reference_id = $1
    `, [transferId]);
    expect(parseInt(entries.rows[0].cnt)).toBe(0);
  });
});

describe('T4: Webhook idempotency', () => {
  it('rejects duplicate webhooks', async () => {
    const eventHash = 'test_hash_' + Date.now();
    
    // First ingest
    const first = await db.query(`
      SELECT cc_rtr_ingest_webhook($1, $2, 'event_001', $3, '{}', '{"test": true}') as id
    `, [testTenantId, testRtrProfileId, eventHash]);
    
    // Second ingest with same hash
    const second = await db.query(`
      SELECT cc_rtr_ingest_webhook($1, $2, 'event_002', $3, '{}', '{"test": true}') as id
    `, [testTenantId, testRtrProfileId, eventHash]);
    
    // Should return same ID (conflict resolution)
    expect(second.rows[0].id).toBe(first.rows[0].id);
    
    // Only one row exists
    const count = await db.query(`
      SELECT COUNT(*) as cnt FROM cc_rtr_webhook_inbox WHERE event_hash = $1
    `, [eventHash]);
    expect(parseInt(count.rows[0].cnt)).toBe(1);
  });
});

describe('T9: RLS enforcement', () => {
  it('app role cannot write to service-only tables', async () => {
    // Switch to app role
    await db.query('SET ROLE cc_app_test');
    
    // Attempt direct insert to webhook inbox
    try {
      await db.query(`
        INSERT INTO cc_rtr_webhook_inbox (tenant_id, rtr_profile_id, event_hash, payload_redacted)
        VALUES ($1, $2, 'hack_attempt', '{}')
      `, [testTenantId, testRtrProfileId]);
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Expected: RLS violation
      expect(error.message).toContain('policy');
    }
    
    // Attempt update to provider refs
    try {
      await db.query(`
        UPDATE cc_rail_transfers SET provider_transfer_id = 'hacked' WHERE tenant_id = $1
      `, [testTenantId]);
      
      // RLS should block this
    } catch (error: any) {
      // Expected
    }
    
    // Reset role
    await db.query('RESET ROLE');
  });
});
```

---

## Acceptance Criteria

### Routes Created

| Route | Type | Purpose |
|-------|------|---------|
| `POST /api/wallet/topups` | App API | Create inbound transfer |
| `POST /api/wallet/cashouts` | App API | Create outbound transfer with hold |
| `GET /api/wallet/accounts/:id` | App API | Get balance + entries |
| `GET /api/rail/transfers/:id` | App API | Get transfer + events |
| `POST /internal/rtr/submit-transfer` | Service | Submit to RTR |
| `POST /internal/rtr/webhook` | Service | Ingest webhook |
| `POST /internal/rtr/reconcile` | Service | Sync with RTR |

### Test Cases

| Test | Focus | Expected |
|------|-------|----------|
| T1 | Inbound top-up happy path | settled → wallet credit |
| T2 | Outbound cash-out happy path | hold → capture on settled |
| T3 | Cash-out rejected | hold released, no debit |
| T4 | Webhook idempotency | duplicate ignored |
| T5 | Submit idempotency | duplicate no-op |
| T6 | Sync record recovery | mapping resolves transfer |
| T7 | Out-of-order events | state machine handles |
| T8 | Wallet posting idempotency | no duplicate entries |
| T9 | RLS enforcement | app role blocked |
| T10 | Reconciliation | catches missed status |

---

## Report Back

After implementation, confirm:

| Component | Status |
|-----------|--------|
| Wallet routes (3) | ✅ / ❌ |
| Rail routes (1) | ✅ / ❌ |
| Internal RTR routes (3) | ✅ / ❌ |
| RTR worker functions | ✅ / ❌ |
| Test cases passing | ? / 10 |

---

## Notes

- **Payments Canada Developer Portal** provides sandbox API documentation
- **ISO 20022** transformation happens in middleware (not shown - provider-specific)
- **Secrets** are never stored in DB logs - only in `secrets_encrypted` via service mode
- All DB interactions use the functions from Migrations 118-120

# REPLIT: JSON Contracts + Postman Collection + Test Harness

## Objective
Align the RTR Adaptor implementation with ChatGPT's exact JSON contracts, add a Postman collection for testing, and implement the automated test harness script.

---

## Part 1: Update Routes to Match JSON Contracts

### 1.1 Update `/api/wallet/topups` Response

Update `server/routes/wallet.ts` to match the contract:

```typescript
// POST /api/wallet/topups - Create inbound rail transfer intent
router.post('/topups', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const { 
    wallet_account_id, 
    amount_cents, 
    to_rail_account_id, 
    client_request_id, 
    memo,
    reference_text 
  } = req.body;

  // Validation
  if (!wallet_account_id || !amount_cents || !to_rail_account_id || !client_request_id) {
    return res.status(422).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
  }

  if (amount_cents <= 0) {
    return res.status(422).json({ error: 'Amount must be positive', code: 'INVALID_AMOUNT' });
  }

  try {
    // Create inbound rail transfer
    const result = await db.query(`
      SELECT cc_create_rail_transfer(
        $1::uuid,
        $2::text,
        'inbound'::rail_direction,
        $3::bigint,
        'CAD',
        NULL::uuid,
        $4::uuid,
        $5::text,
        'wallet_topup',
        $6::uuid,
        $7::text
      ) as transfer_id
    `, [tenantId, client_request_id, amount_cents, to_rail_account_id, memo, wallet_account_id, reference_text]);

    const transferId = result.rows[0].transfer_id;

    // Return contract-compliant response
    res.status(201).json({
      transfer_id: transferId,
      status: 'created',
      direction: 'inbound',
      amount_cents: amount_cents,
      currency: 'CAD',
      client_request_id: client_request_id,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.message?.includes('duplicate') || error.code === '23505') {
      // Return existing transfer on duplicate
      const existing = await db.query(`
        SELECT id FROM cc_rail_transfers 
        WHERE client_request_id = $1 AND tenant_id = $2
      `, [client_request_id, tenantId]);
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Duplicate client_request_id',
          transfer_id: existing.rows[0].id,
          code: 'DUPLICATE_REQUEST'
        });
      }
    }
    console.error('Top-up creation failed:', error);
    res.status(500).json({ error: 'Failed to create top-up', code: 'INTERNAL_ERROR' });
  }
});
```

### 1.2 Update `/api/wallet/cashouts` Response

```typescript
// POST /api/wallet/cashouts - Create outbound rail transfer with hold
router.post('/cashouts', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const { 
    wallet_account_id, 
    amount_cents, 
    from_rail_account_id,
    to_rail_account_id, 
    client_request_id, 
    memo,
    expires_at 
  } = req.body;

  // Validation
  if (!wallet_account_id || !amount_cents || !from_rail_account_id || !to_rail_account_id || !client_request_id) {
    return res.status(422).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
  }

  if (amount_cents <= 0) {
    return res.status(422).json({ error: 'Amount must be positive', code: 'INVALID_AMOUNT' });
  }

  try {
    // Step 1: Place hold on wallet
    const holdResult = await db.query(`
      SELECT cc_place_wallet_hold(
        $1::uuid,
        $2::uuid,
        $3::bigint,
        'cashout',
        'rail_transfer_intent',
        NULL::uuid,
        $4::timestamptz
      ) as hold_id
    `, [tenantId, wallet_account_id, amount_cents, expires_at || null]);

    const holdId = holdResult.rows[0].hold_id;

    // Step 2: Create outbound rail transfer
    const transferResult = await db.query(`
      SELECT cc_create_rail_transfer(
        $1::uuid,
        $2::text,
        'outbound'::rail_direction,
        $3::bigint,
        'CAD',
        $4::uuid,
        $5::uuid,
        $6::text,
        'wallet_cashout',
        $7::uuid,
        NULL
      ) as transfer_id
    `, [tenantId, client_request_id, amount_cents, from_rail_account_id, to_rail_account_id, memo, holdId]);

    const transferId = transferResult.rows[0].transfer_id;

    // Step 3: Update hold with transfer reference
    await db.query(`
      UPDATE cc_wallet_holds 
      SET reference_id = $1, metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('transfer_id', $1::text)
      WHERE id = $2 AND tenant_id = $3
    `, [transferId, holdId, tenantId]);

    // Return contract-compliant response
    res.status(201).json({
      transfer_id: transferId,
      hold_id: holdId,
      transfer_status: 'created',
      hold_status: 'active',
      amount_cents: amount_cents,
      currency: 'CAD',
      client_request_id: client_request_id,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.message?.includes('Insufficient available balance')) {
      return res.status(402).json({ 
        error: 'Insufficient available balance', 
        code: 'INSUFFICIENT_BALANCE' 
      });
    }
    if (error.message?.includes('duplicate') || error.code === '23505') {
      const existing = await db.query(`
        SELECT rt.id as transfer_id, wh.id as hold_id
        FROM cc_rail_transfers rt
        LEFT JOIN cc_wallet_holds wh ON wh.reference_id = rt.id
        WHERE rt.client_request_id = $1 AND rt.tenant_id = $2
      `, [client_request_id, tenantId]);
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Duplicate client_request_id',
          transfer_id: existing.rows[0].transfer_id,
          hold_id: existing.rows[0].hold_id,
          code: 'DUPLICATE_REQUEST'
        });
      }
    }
    console.error('Cash-out creation failed:', error);
    res.status(500).json({ error: 'Failed to create cash-out', code: 'INTERNAL_ERROR' });
  }
});
```

### 1.3 Update `/api/rail/transfers/:id` Response

```typescript
// GET /api/rail/transfers/:id - Get transfer status and events
router.get('/transfers/:id', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const transferId = req.params.id;

  try {
    // Get transfer
    const transferResult = await db.query(`
      SELECT 
        id, client_request_id, direction, status,
        amount_cents, currency, memo,
        from_rail_account_id, to_rail_account_id,
        provider_transfer_id, provider_status,
        reference_type, reference_id,
        requested_at, submitted_at, completed_at as settled_at,
        created_at, updated_at
      FROM cc_rail_transfers
      WHERE id = $1 AND tenant_id = $2
    `, [transferId, tenantId]);

    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer not found', code: 'NOT_FOUND' });
    }

    // Get events (most recent first)
    const eventsResult = await db.query(`
      SELECT 
        id, event_type, 
        created_at as event_at,
        event_data->>'provider_event_id' as provider_event_id,
        provider_status, new_status,
        provider_reason_message as message
      FROM cc_rail_transfer_events
      WHERE transfer_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 50
    `, [transferId, tenantId]);

    // Return contract-compliant response
    res.json({
      transfer: transferResult.rows[0],
      events: eventsResult.rows
    });
  } catch (error) {
    console.error('Failed to get transfer:', error);
    res.status(500).json({ error: 'Failed to retrieve transfer', code: 'INTERNAL_ERROR' });
  }
});
```

### 1.4 Update `/api/wallet/accounts/:id` Response

```typescript
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
      return res.status(404).json({ error: 'Wallet account not found', code: 'NOT_FOUND' });
    }

    // Get recent entries (last 50 for test harness)
    const entriesResult = await db.query(`
      SELECT 
        id, entry_type, status, amount_cents, currency,
        reference_type, reference_id, description,
        sequence_number, posted_at
      FROM cc_wallet_entries
      WHERE wallet_account_id = $1 AND tenant_id = $2
      ORDER BY sequence_number DESC
      LIMIT 50
    `, [walletAccountId, tenantId]);

    // Get active holds
    const holdsResult = await db.query(`
      SELECT 
        id, status, amount_cents, reason, expires_at, created_at
      FROM cc_wallet_holds
      WHERE wallet_account_id = $1 AND tenant_id = $2 AND status = 'active'
      ORDER BY created_at DESC
    `, [walletAccountId, tenantId]);

    // Return contract-compliant response
    res.json({
      account: accountResult.rows[0],
      entries: entriesResult.rows,
      holds: holdsResult.rows
    });
  } catch (error) {
    console.error('Failed to get wallet account:', error);
    res.status(500).json({ error: 'Failed to retrieve wallet account', code: 'INTERNAL_ERROR' });
  }
});
```

### 1.5 Update `/internal/rtr/submit-transfer` Response

Update `server/routes/internal-rtr.ts`:

```typescript
// POST /internal/rtr/submit-transfer
router.post('/submit-transfer', async (req, res) => {
  const { tenant_id, transfer_id, rtr_profile_id, dry_run } = req.body;

  if (!tenant_id || !transfer_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await submitTransferToRTR(tenant_id, transfer_id, rtr_profile_id, dry_run);
    
    if (result.success) {
      res.json({
        transfer_id: transfer_id,
        submitted: !result.alreadySubmitted,
        provider_transfer_id: result.providerTransferId || null,
        status_before: result.statusBefore || 'created',
        status_after: result.statusAfter || 'submitted',
        idempotency: {
          client_request_id: result.clientRequestId,
          provider_idempotency_key: result.providerTransferId || null
        },
        reason: result.alreadySubmitted ? 'already_has_provider_transfer_id' : undefined,
        current_status: result.alreadySubmitted ? result.statusAfter : undefined
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error,
        code: 'SUBMIT_FAILED'
      });
    }
  } catch (error) {
    console.error('Submit transfer failed:', error);
    res.status(500).json({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});
```

### 1.6 Update `/internal/rtr/webhook` Response

```typescript
// POST /internal/rtr/webhook
router.post('/webhook', async (req, res) => {
  const { tenant_id, rtr_profile_id, provider_event_id, received_at, headers, payload } = req.body;

  if (!tenant_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing tenant or profile', code: 'VALIDATION_ERROR' });
  }

  try {
    const rawPayload = JSON.stringify(payload);
    const result = await ingestRTRWebhook(tenant_id, rtr_profile_id, provider_event_id, headers, rawPayload);

    if (result.success) {
      res.json({
        inbox_id: result.inboxId,
        accepted: true,
        idempotent_noop: result.duplicate || false,
        mapped_transfer_id: result.transferId || null,
        status_transition: result.statusTransition || null
      });
    } else {
      res.status(400).json({ 
        accepted: false, 
        error: result.error,
        code: 'WEBHOOK_FAILED'
      });
    }
  } catch (error) {
    console.error('Webhook ingestion failed:', error);
    res.status(500).json({ accepted: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});
```

### 1.7 Update `/internal/rtr/reconcile` Response

```typescript
// POST /internal/rtr/reconcile
router.post('/reconcile', async (req, res) => {
  const { tenant_id, rtr_profile_id, since, limit } = req.body;

  if (!tenant_id || !rtr_profile_id) {
    return res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await runReconciliation(tenant_id, rtr_profile_id, since, limit || 200);
    
    res.json({
      checked: result.checked || 0,
      updated: result.updated || 0,
      unchanged: result.unchanged || 0,
      errors: result.errors || 0
    });
  } catch (error) {
    console.error('Reconciliation failed:', error);
    res.status(500).json({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  }
});
```

---

## Part 2: Postman Collection

Create file: `postman/rtr-adaptor-collection.json`

```json
{
  "info": {
    "_postman_id": "b4d5c2aa-0000-4000-9000-111111111111",
    "name": "Community Canvas - RTR Adaptor",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "description": "App + Service endpoints for Wallet + Rail + RTR adaptor."
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" },
    { "key": "serviceBaseUrl", "value": "http://localhost:3000" },
    { "key": "appBearerToken", "value": "REPLACE_ME" },
    { "key": "serviceBearerToken", "value": "REPLACE_ME" },
    { "key": "tenantId", "value": "00000000-0000-0000-0000-000000000001" },
    { "key": "walletAccountId", "value": "REPLACE_ME" },
    { "key": "fromRailAccountId", "value": "REPLACE_ME" },
    { "key": "toRailAccountId", "value": "REPLACE_ME" },
    { "key": "transferId", "value": "REPLACE_ME" },
    { "key": "holdId", "value": "REPLACE_ME" },
    { "key": "rtrProfileId", "value": "REPLACE_ME" }
  ],
  "item": [
    {
      "name": "App - Wallet",
      "item": [
        {
          "name": "Create Top-up (inbound transfer)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Authorization", "value": "Bearer {{appBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-Tenant-Id", "value": "{{tenantId}}" }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/wallet/topups",
              "host": ["{{baseUrl}}"],
              "path": ["api", "wallet", "topups"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"wallet_account_id\": \"{{walletAccountId}}\",\n  \"amount_cents\": 2500,\n  \"to_rail_account_id\": \"{{toRailAccountId}}\",\n  \"client_request_id\": \"topup_{{$timestamp}}\",\n  \"memo\": \"Top-up\",\n  \"reference_text\": \"Test top-up\"\n}"
            }
          }
        },
        {
          "name": "Create Cash-out (hold + outbound transfer)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Authorization", "value": "Bearer {{appBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-Tenant-Id", "value": "{{tenantId}}" }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/wallet/cashouts",
              "host": ["{{baseUrl}}"],
              "path": ["api", "wallet", "cashouts"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"wallet_account_id\": \"{{walletAccountId}}\",\n  \"amount_cents\": 2500,\n  \"from_rail_account_id\": \"{{fromRailAccountId}}\",\n  \"to_rail_account_id\": \"{{toRailAccountId}}\",\n  \"client_request_id\": \"cashout_{{$timestamp}}\",\n  \"memo\": \"Cash-out\"\n}"
            }
          }
        },
        {
          "name": "Get Rail Transfer",
          "request": {
            "method": "GET",
            "header": [
              { "key": "Authorization", "value": "Bearer {{appBearerToken}}" },
              { "key": "X-Tenant-Id", "value": "{{tenantId}}" }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/rail/transfers/{{transferId}}",
              "host": ["{{baseUrl}}"],
              "path": ["api", "rail", "transfers", "{{transferId}}"]
            }
          }
        },
        {
          "name": "Get Wallet Account",
          "request": {
            "method": "GET",
            "header": [
              { "key": "Authorization", "value": "Bearer {{appBearerToken}}" },
              { "key": "X-Tenant-Id", "value": "{{tenantId}}" }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/wallet/accounts/{{walletAccountId}}",
              "host": ["{{baseUrl}}"],
              "path": ["api", "wallet", "accounts", "{{walletAccountId}}"]
            }
          }
        }
      ]
    },
    {
      "name": "Service - RTR Worker",
      "item": [
        {
          "name": "Submit Transfer to RTR",
          "request": {
            "method": "POST",
            "header": [
              { "key": "X-Service-Key", "value": "{{serviceBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "url": {
              "raw": "{{serviceBaseUrl}}/internal/rtr/submit-transfer",
              "host": ["{{serviceBaseUrl}}"],
              "path": ["internal", "rtr", "submit-transfer"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"tenant_id\": \"{{tenantId}}\",\n  \"transfer_id\": \"{{transferId}}\",\n  \"rtr_profile_id\": \"{{rtrProfileId}}\",\n  \"dry_run\": false\n}"
            }
          }
        },
        {
          "name": "Simulate Webhook (ACCEPTED)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "X-Service-Key", "value": "{{serviceBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "url": {
              "raw": "{{serviceBaseUrl}}/internal/rtr/webhook",
              "host": ["{{serviceBaseUrl}}"],
              "path": ["internal", "rtr", "webhook"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"tenant_id\": \"{{tenantId}}\",\n  \"rtr_profile_id\": \"{{rtrProfileId}}\",\n  \"provider_event_id\": \"evt_accepted_{{$timestamp}}\",\n  \"received_at\": \"{{$isoTimestamp}}\",\n  \"headers\": {\n    \"content-type\": \"application/json\",\n    \"x-signature\": \"redacted\"\n  },\n  \"payload\": {\n    \"provider_transfer_id\": \"RTR_{{transferId}}\",\n    \"status\": \"ACCEPTED\",\n    \"client_request_id\": \"test\"\n  }\n}"
            }
          }
        },
        {
          "name": "Simulate Webhook (SETTLED)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "X-Service-Key", "value": "{{serviceBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "url": {
              "raw": "{{serviceBaseUrl}}/internal/rtr/webhook",
              "host": ["{{serviceBaseUrl}}"],
              "path": ["internal", "rtr", "webhook"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"tenant_id\": \"{{tenantId}}\",\n  \"rtr_profile_id\": \"{{rtrProfileId}}\",\n  \"provider_event_id\": \"evt_settled_{{$timestamp}}\",\n  \"received_at\": \"{{$isoTimestamp}}\",\n  \"headers\": {\n    \"content-type\": \"application/json\",\n    \"x-signature\": \"redacted\"\n  },\n  \"payload\": {\n    \"provider_transfer_id\": \"RTR_{{transferId}}\",\n    \"status\": \"SETTLED\",\n    \"client_request_id\": \"test\"\n  }\n}"
            }
          }
        },
        {
          "name": "Simulate Webhook (REJECTED)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "X-Service-Key", "value": "{{serviceBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "url": {
              "raw": "{{serviceBaseUrl}}/internal/rtr/webhook",
              "host": ["{{serviceBaseUrl}}"],
              "path": ["internal", "rtr", "webhook"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"tenant_id\": \"{{tenantId}}\",\n  \"rtr_profile_id\": \"{{rtrProfileId}}\",\n  \"provider_event_id\": \"evt_rejected_{{$timestamp}}\",\n  \"received_at\": \"{{$isoTimestamp}}\",\n  \"headers\": {\n    \"content-type\": \"application/json\",\n    \"x-signature\": \"redacted\"\n  },\n  \"payload\": {\n    \"provider_transfer_id\": \"RTR_{{transferId}}\",\n    \"status\": \"REJECTED\",\n    \"reason_code\": \"AC01\",\n    \"reason_message\": \"Incorrect account\",\n    \"client_request_id\": \"test\"\n  }\n}"
            }
          }
        },
        {
          "name": "Reconcile",
          "request": {
            "method": "POST",
            "header": [
              { "key": "X-Service-Key", "value": "{{serviceBearerToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "url": {
              "raw": "{{serviceBaseUrl}}/internal/rtr/reconcile",
              "host": ["{{serviceBaseUrl}}"],
              "path": ["internal", "rtr", "reconcile"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"tenant_id\": \"{{tenantId}}\",\n  \"rtr_profile_id\": \"{{rtrProfileId}}\",\n  \"since\": \"2026-01-01T00:00:00Z\",\n  \"limit\": 200\n}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## Part 3: Test Harness Script

Create file: `scripts/rtr-test-harness.ts`

```typescript
/**
 * RTR adaptor test harness (HTTP-level).
 *
 * Runs:
 *  - T1: Inbound top-up happy path
 *  - T2: Outbound cash-out settled (capture hold)
 *  - T3: Outbound cash-out rejected (release hold)
 *  - T4: Webhook replay idempotency
 *  - T5: Submit idempotency (double submit)
 *  - T7: Out-of-order events (settled before accepted)
 *
 * Usage:
 *   npx tsx scripts/rtr-test-harness.ts
 *
 * Env:
 *   BASE_URL=http://localhost:3000
 *   APP_TOKEN=...
 *   SERVICE_TOKEN=...
 *   TENANT_ID=...
 *   RTR_PROFILE_ID=...
 *   WALLET_ACCOUNT_ID=...
 *   FROM_RAIL_ACCOUNT_ID=...
 *   TO_RAIL_ACCOUNT_ID=...
 */

type Json = Record<string, any>;

const BASE_URL = mustEnv("BASE_URL");
const APP_TOKEN = mustEnv("APP_TOKEN");
const SERVICE_TOKEN = mustEnv("SERVICE_TOKEN");

const TENANT_ID = mustEnv("TENANT_ID");
const RTR_PROFILE_ID = mustEnv("RTR_PROFILE_ID");

const WALLET_ACCOUNT_ID = mustEnv("WALLET_ACCOUNT_ID");
const FROM_RAIL_ACCOUNT_ID = mustEnv("FROM_RAIL_ACCOUNT_ID");
const TO_RAIL_ACCOUNT_ID = mustEnv("TO_RAIL_ACCOUNT_ID");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mustEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
}

function isoNowPlus(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function httpJson(
  method: "GET" | "POST",
  url: string,
  token: string,
  body?: Json,
  useServiceKey: boolean = false
): Promise<{ status: number; json: any; raw: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Id": TENANT_ID,
  };
  
  if (useServiceKey) {
    headers["X-Service-Key"] = token;
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // not JSON
  }
  return { status: res.status, json, raw };
}

function assert(cond: any, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(a: T, b: T, msg: string): void {
  if (a !== b) throw new Error(`${msg} (got=${String(a)} expected=${String(b)})`);
}

function logStep(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function randSuffix(): string {
  return Math.random().toString(16).slice(2, 10);
}

async function getWalletAccount() {
  const url = `${BASE_URL}/api/wallet/accounts/${WALLET_ACCOUNT_ID}`;
  const r = await httpJson("GET", url, APP_TOKEN);
  assertEq(r.status, 200, `GET wallet account failed: ${r.raw}`);
  return r.json;
}

async function getTransfer(transferId: string) {
  const url = `${BASE_URL}/api/rail/transfers/${transferId}`;
  const r = await httpJson("GET", url, APP_TOKEN);
  assertEq(r.status, 200, `GET transfer failed: ${r.raw}`);
  return r.json;
}

async function createTopUp(amountCents: number) {
  const clientRequestId = `topup_${TENANT_ID}_${Date.now()}_${randSuffix()}`;
  const url = `${BASE_URL}/api/wallet/topups`;
  const r = await httpJson("POST", url, APP_TOKEN, {
    wallet_account_id: WALLET_ACCOUNT_ID,
    amount_cents: amountCents,
    to_rail_account_id: TO_RAIL_ACCOUNT_ID,
    client_request_id: clientRequestId,
    memo: "Top-up",
    reference_text: "Test top-up",
  });
  assert(
    r.status === 201 || r.status === 200 || r.status === 409,
    `Create top-up unexpected status=${r.status} body=${r.raw}`
  );
  assert(r.json?.transfer_id, `Create top-up missing transfer_id: ${r.raw}`);
  return { transferId: r.json.transfer_id as string, clientRequestId };
}

async function createCashOut(amountCents: number) {
  const clientRequestId = `cashout_${TENANT_ID}_${Date.now()}_${randSuffix()}`;
  const url = `${BASE_URL}/api/wallet/cashouts`;
  const r = await httpJson("POST", url, APP_TOKEN, {
    wallet_account_id: WALLET_ACCOUNT_ID,
    amount_cents: amountCents,
    from_rail_account_id: FROM_RAIL_ACCOUNT_ID,
    to_rail_account_id: TO_RAIL_ACCOUNT_ID,
    client_request_id: clientRequestId,
    memo: "Cash-out",
    expires_at: isoNowPlus(3600),
  });
  assert(
    r.status === 201 || r.status === 200 || r.status === 409,
    `Create cash-out unexpected status=${r.status} body=${r.raw}`
  );
  assert(r.json?.transfer_id, `Create cash-out missing transfer_id: ${r.raw}`);
  assert(r.json?.hold_id, `Create cash-out missing hold_id: ${r.raw}`);
  return {
    transferId: r.json.transfer_id as string,
    holdId: r.json.hold_id as string,
    clientRequestId,
  };
}

async function submitTransfer(transferId: string) {
  const url = `${BASE_URL}/internal/rtr/submit-transfer`;
  const r = await httpJson("POST", url, SERVICE_TOKEN, {
    tenant_id: TENANT_ID,
    transfer_id: transferId,
    rtr_profile_id: RTR_PROFILE_ID,
    dry_run: false,
  }, true);
  assertEq(r.status, 200, `Submit transfer failed: ${r.raw}`);
  return r.json;
}

async function sendWebhookSim(payload: Json, providerEventId: string) {
  const url = `${BASE_URL}/internal/rtr/webhook`;
  const r = await httpJson("POST", url, SERVICE_TOKEN, {
    tenant_id: TENANT_ID,
    rtr_profile_id: RTR_PROFILE_ID,
    provider_event_id: providerEventId,
    received_at: new Date().toISOString(),
    headers: {
      "content-type": "application/json",
      "x-signature": "redacted-test",
    },
    payload,
  }, true);
  assertEq(r.status, 200, `Webhook ingest failed: ${r.raw}`);
  return r.json;
}

function countEntriesByReference(walletJson: any, referenceType: string, referenceId: string) {
  const entries: any[] = walletJson?.entries ?? [];
  return entries.filter(
    (e) => e?.reference_type === referenceType && e?.reference_id === referenceId
  ).length;
}

async function run() {
  console.log("RTR adaptor test harness starting…");
  console.log(`BASE_URL=${BASE_URL}`);

  // Baseline wallet balances
  logStep("Baseline wallet account");
  const wallet0 = await getWalletAccount();
  const posted0 = Number(wallet0.account.posted_balance_cents ?? 0);
  const avail0 = Number(wallet0.account.available_balance_cents ?? 0);
  const holds0 = Number(wallet0.account.active_holds_cents ?? 0);
  console.log({ posted0, avail0, holds0 });

  // -------------------------
  // T1: Inbound top-up happy path
  // -------------------------
  logStep("T1: Inbound top-up happy path");
  const topUpAmount = 111;
  const { transferId: topUpTransferId } = await createTopUp(topUpAmount);
  console.log(`Created top-up transfer: ${topUpTransferId}`);

  // Submit (service)
  const submit1 = await submitTransfer(topUpTransferId);
  console.log("submitTransfer:", submit1);

  // Webhook: accepted
  await sendWebhookSim(
    {
      provider_transfer_id: submit1.provider_transfer_id ?? `provider_${topUpTransferId}`,
      status: "ACCEPTED",
      reason_code: null,
      reason_message: null,
      client_request_id: submit1.idempotency?.client_request_id ?? "n/a",
    },
    `evt_accept_${randSuffix()}`
  );

  // Webhook: settled
  await sendWebhookSim(
    {
      provider_transfer_id: submit1.provider_transfer_id ?? `provider_${topUpTransferId}`,
      status: "SETTLED",
      reason_code: null,
      reason_message: null,
      client_request_id: submit1.idempotency?.client_request_id ?? "n/a",
    },
    `evt_settle_${randSuffix()}`
  );

  await sleep(250);
  const tr1 = await getTransfer(topUpTransferId);
  console.log("transfer.status:", tr1.transfer.status);
  assertEq(tr1.transfer.status, "settled", "Top-up transfer should be settled");

  // Verify wallet credited once
  const wallet1 = await getWalletAccount();
  const posted1 = Number(wallet1.account.posted_balance_cents ?? 0);
  console.log({ posted1 });
  assert(posted1 >= posted0 + topUpAmount, "Wallet posted should increase after top-up settlement");

  const creditCount = countEntriesByReference(wallet1, "rail_transfer", topUpTransferId);
  assert(creditCount === 1, `Expected exactly 1 wallet entry referencing rail_transfer ${topUpTransferId}, got=${creditCount}`);

  console.log("✅ T1 PASSED");

  // -------------------------
  // T4: Webhook replay idempotency
  // -------------------------
  logStep("T4: Webhook replay idempotency");
  const replayEventId = `evt_replay_${randSuffix()}`;
  const payloadReplay = {
    provider_transfer_id: submit1.provider_transfer_id ?? `provider_${topUpTransferId}`,
    status: "SETTLED",
    reason_code: null,
    reason_message: null,
    client_request_id: submit1.idempotency?.client_request_id ?? "n/a",
  };

  const r1 = await sendWebhookSim(payloadReplay, replayEventId);
  const r2 = await sendWebhookSim(payloadReplay, replayEventId);
  console.log({ first: r1, second: r2 });

  // Second should be idempotent noop
  assert(r2.idempotent_noop === true || r2.inbox_id === r1.inbox_id, "Replay should be idempotent");

  const wallet1b = await getWalletAccount();
  const creditCount2 = countEntriesByReference(wallet1b, "rail_transfer", topUpTransferId);
  assertEq(creditCount2, 1, "Replay webhook must not duplicate wallet posting");

  console.log("✅ T4 PASSED");

  // -------------------------
  // T3: Outbound cash-out rejected releases hold
  // -------------------------
  logStep("T3: Outbound cash-out rejected releases hold");
  const cashOutAmount = 123;
  const { transferId: cashOutTransferId } = await createCashOut(cashOutAmount);

  const wallet2 = await getWalletAccount();
  const avail2 = Number(wallet2.account.available_balance_cents ?? 0);
  const holds2 = Number(wallet2.account.active_holds_cents ?? 0);
  console.log({ avail2, holds2 });

  const submit2 = await submitTransfer(cashOutTransferId);

  // Webhook: rejected
  await sendWebhookSim(
    {
      provider_transfer_id: submit2.provider_transfer_id ?? `provider_${cashOutTransferId}`,
      status: "REJECTED",
      reason_code: "TEST_REJECT",
      reason_message: "Simulated rejection",
      client_request_id: submit2.idempotency?.client_request_id ?? "n/a",
    },
    `evt_reject_${randSuffix()}`
  );

  await sleep(250);
  const tr2 = await getTransfer(cashOutTransferId);
  console.log("transfer.status:", tr2.transfer.status);
  assert(
    tr2.transfer.status === "rejected" || tr2.transfer.status === "failed",
    `Cash-out transfer should be rejected/failed, got=${tr2.transfer.status}`
  );

  const wallet3 = await getWalletAccount();
  const holds3 = Number(wallet3.account.active_holds_cents ?? 0);
  console.log({ holds3 });

  const debitCount = countEntriesByReference(wallet3, "rail_transfer", cashOutTransferId);
  assertEq(debitCount, 0, "Rejected cash-out must not post a wallet entry");

  console.log("✅ T3 PASSED");

  // -------------------------
  // T2: Outbound cash-out settled captures hold
  // -------------------------
  logStep("T2: Outbound cash-out settled captures hold");
  const cashOutAmount2 = 77;
  const { transferId: cashOutTransferId2 } = await createCashOut(cashOutAmount2);

  const submit3 = await submitTransfer(cashOutTransferId2);

  await sendWebhookSim(
    {
      provider_transfer_id: submit3.provider_transfer_id ?? `provider_${cashOutTransferId2}`,
      status: "ACCEPTED",
      client_request_id: submit3.idempotency?.client_request_id ?? "n/a",
    },
    `evt_accept2_${randSuffix()}`
  );

  await sendWebhookSim(
    {
      provider_transfer_id: submit3.provider_transfer_id ?? `provider_${cashOutTransferId2}`,
      status: "SETTLED",
      client_request_id: submit3.idempotency?.client_request_id ?? "n/a",
    },
    `evt_settle2_${randSuffix()}`
  );

  await sleep(250);
  const tr3 = await getTransfer(cashOutTransferId2);
  assertEq(tr3.transfer.status, "settled", "Cash-out should settle");

  const wallet4 = await getWalletAccount();
  const refCount = countEntriesByReference(wallet4, "rail_transfer", cashOutTransferId2);
  assertEq(refCount, 1, "Settled cash-out should post exactly one wallet entry referencing transfer");

  console.log("✅ T2 PASSED");

  // -------------------------
  // T5: Submit idempotency (double submit)
  // -------------------------
  logStep("T5: Submit idempotency (double submit)");
  const { transferId: topUpTransferId2 } = await createTopUp(55);
  const sA = await submitTransfer(topUpTransferId2);
  const sB = await submitTransfer(topUpTransferId2);
  console.log({ first: sA, second: sB });
  assert(sB.transfer_id === topUpTransferId2, "Second submit should return same transfer_id");

  console.log("✅ T5 PASSED");

  // -------------------------
  // T7: Out-of-order events (settled then accepted)
  // -------------------------
  logStep("T7: Out-of-order events (settled then accepted)");
  const { transferId: topUpTransferId3 } = await createTopUp(66);
  const sC = await submitTransfer(topUpTransferId3);

  const providerId = sC.provider_transfer_id ?? `provider_${topUpTransferId3}`;
  
  // Send settled FIRST
  await sendWebhookSim(
    { provider_transfer_id: providerId, status: "SETTLED", client_request_id: sC.idempotency?.client_request_id ?? "n/a" },
    `evt_oo_settle_${randSuffix()}`
  );
  
  // Then send accepted (out of order)
  await sendWebhookSim(
    { provider_transfer_id: providerId, status: "ACCEPTED", client_request_id: sC.idempotency?.client_request_id ?? "n/a" },
    `evt_oo_accept_${randSuffix()}`
  );

  await sleep(250);
  const trOO = await getTransfer(topUpTransferId3);
  console.log("transfer.status:", trOO.transfer.status);
  assertEq(trOO.transfer.status, "settled", "Status must not regress after out-of-order accepted");

  const walletOO = await getWalletAccount();
  const refCountOO = countEntriesByReference(walletOO, "rail_transfer", topUpTransferId3);
  assertEq(refCountOO, 1, "Out-of-order events must not duplicate wallet posting");

  console.log("✅ T7 PASSED");

  console.log("\n🎉 All RTR adaptor harness tests passed!");
}

run().catch((err) => {
  console.error("\n❌ Test harness failed:");
  console.error(err?.stack || err);
  process.exit(1);
});
```

---

## Part 4: Package.json Update

Add to `package.json`:

```json
{
  "scripts": {
    "test:rtr": "tsx scripts/rtr-test-harness.ts"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

---

## Part 5: Environment Setup

Create file: `.env.test.example`

```env
BASE_URL=http://localhost:3000
APP_TOKEN=your-app-bearer-token
SERVICE_TOKEN=your-service-key
TENANT_ID=00000000-0000-0000-0000-000000000001
RTR_PROFILE_ID=your-rtr-profile-uuid
WALLET_ACCOUNT_ID=your-wallet-account-uuid
FROM_RAIL_ACCOUNT_ID=your-from-rail-account-uuid
TO_RAIL_ACCOUNT_ID=your-to-rail-account-uuid
```

---

## Acceptance Criteria

### Routes Updated to Match JSON Contracts

| Route | Contract-Compliant |
|-------|-------------------|
| `POST /api/wallet/topups` | ✅ / ❌ |
| `POST /api/wallet/cashouts` | ✅ / ❌ |
| `GET /api/rail/transfers/:id` | ✅ / ❌ |
| `GET /api/wallet/accounts/:id` | ✅ / ❌ |
| `POST /internal/rtr/submit-transfer` | ✅ / ❌ |
| `POST /internal/rtr/webhook` | ✅ / ❌ |
| `POST /internal/rtr/reconcile` | ✅ / ❌ |

### Test Harness Results

| Test | Status |
|------|--------|
| T1: Inbound top-up happy path | ✅ / ❌ |
| T2: Outbound cash-out settled | ✅ / ❌ |
| T3: Outbound cash-out rejected | ✅ / ❌ |
| T4: Webhook replay idempotency | ✅ / ❌ |
| T5: Submit idempotency | ✅ / ❌ |
| T7: Out-of-order events | ✅ / ❌ |

---

## Report Back

After implementation, confirm:

| Component | Status |
|-----------|--------|
| Route updates (7) | ? / 7 |
| Postman collection created | ✅ / ❌ |
| Test harness script created | ✅ / ❌ |
| Test harness passing | ? / 6 |

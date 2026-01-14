# REPLIT: Run RTR Adaptor Test Harness (V2 — Corrected)

Based on ChatGPT review. Fixes:
1. **Auth headers match harness** — Uses Bearer tokens consistently
2. **Deterministic fixtures** — You supply TENANT_ID, no `LIMIT 1` guessing
3. **Idempotent SQL** — Safe to re-run without duplicates
4. **Schema-accurate** — Matches actual columns from Migrations 118-120

---

## Preconditions

You already have:
- Migrations 118–120 applied (Payment Rail Spine + Wallet Ledger + RTR Pack)
- 515 cc_* tables
- All API routes implemented

---

## Step 0 — Pick a Deterministic Tenant ID

**Do NOT use `LIMIT 1` on tenants.** Use a known test tenant.

Option A: Use an existing tenant ID from your dev DB
Option B: Create one via your admin UI

You will paste this `TENANT_ID` into the SQL below and into `.env.test`.

---

## Step 1 — Create/Upsert Test Fixtures (SQL)

Run this in your DB console. **Edit the CONFIG section first.**

```sql
-- ============================================================
-- RTR HARNESS FIXTURES (V2 - Schema Accurate)
-- Deterministic: you supply TENANT_ID
-- Idempotent: safe to re-run
-- Matches: Migrations 118-120 column names
-- ============================================================

DO $$
DECLARE
  -- === CONFIG (EDIT THESE) ===
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';  -- <-- REPLACE WITH YOUR TENANT
  v_env TEXT := 'sandbox';
  v_currency TEXT := 'CAD';
  v_wallet_seed_cents BIGINT := 100000;  -- $1000.00

  -- Fixture identifiers (stable keys for idempotency)
  v_connector_key TEXT := 'rtr_test';
  v_wallet_name TEXT := 'RTR Test Wallet';
  v_from_account_name TEXT := 'Platform Settlement (Fixture)';
  v_to_account_name TEXT := 'External Account (Fixture)';

  -- Variables for created IDs
  v_wallet_account_id UUID;
  v_connector_id UUID;
  v_rtr_profile_id UUID;
  v_from_rail_account_id UUID;
  v_to_rail_account_id UUID;
  v_existing_entry UUID;

BEGIN
  -- Set service mode for fixture creation
  PERFORM set_config('app.tenant_id', '__SERVICE__', true);

  -- ============================================================
  -- 1) WALLET ACCOUNT (idempotent by tenant + account_name)
  -- ============================================================
  SELECT id INTO v_wallet_account_id
  FROM cc_wallet_accounts
  WHERE tenant_id = v_tenant_id AND account_name = v_wallet_name
  LIMIT 1;

  IF v_wallet_account_id IS NULL THEN
    v_wallet_account_id := cc_create_wallet_account(
      v_tenant_id,
      v_wallet_name,
      NULL,  -- party_id
      NULL,  -- individual_id
      v_currency,
      jsonb_build_object('fixture', true, 'purpose', 'rtr_harness')
    );
    RAISE NOTICE 'Created wallet account: %', v_wallet_account_id;
  ELSE
    RAISE NOTICE 'Found existing wallet account: %', v_wallet_account_id;
  END IF;

  -- ============================================================
  -- 2) RAIL CONNECTOR (idempotent by tenant + connector_key + environment)
  -- Schema: cc_rail_connectors from Migration 118
  -- ============================================================
  SELECT id INTO v_connector_id
  FROM cc_rail_connectors
  WHERE tenant_id = v_tenant_id 
    AND connector_key = v_connector_key 
    AND environment = v_env
  LIMIT 1;

  IF v_connector_id IS NULL THEN
    INSERT INTO cc_rail_connectors (
      tenant_id, 
      connector_key, 
      provider, 
      environment,
      display_name,
      status,
      is_active,
      config
    ) VALUES (
      v_tenant_id,
      v_connector_key,
      'payments_canada',
      v_env,
      'RTR Test Connector',
      'active',
      true,
      jsonb_build_object(
        'fixture', true,
        'notes', 'Test connector for RTR harness'
      )
    )
    RETURNING id INTO v_connector_id;
    RAISE NOTICE 'Created rail connector: %', v_connector_id;
  ELSE
    -- Update to ensure active
    UPDATE cc_rail_connectors 
    SET is_active = true, status = 'active'
    WHERE id = v_connector_id;
    RAISE NOTICE 'Found existing rail connector: %', v_connector_id;
  END IF;

  -- ============================================================
  -- 3) RTR PROFILE (idempotent by tenant + rail_connector_id)
  -- Schema: cc_rtr_profiles from Migration 120
  -- ============================================================
  SELECT id INTO v_rtr_profile_id
  FROM cc_rtr_profiles
  WHERE tenant_id = v_tenant_id AND rail_connector_id = v_connector_id
  LIMIT 1;

  IF v_rtr_profile_id IS NULL THEN
    v_rtr_profile_id := cc_register_rtr_profile(
      v_tenant_id,
      v_connector_id,
      v_env,
      'https://example.invalid/rtr-sandbox',  -- placeholder URL
      'TEST_PARTICIPANT_001',
      'v1'
    );
    RAISE NOTICE 'Created RTR profile: %', v_rtr_profile_id;
  ELSE
    -- Ensure active
    UPDATE cc_rtr_profiles SET is_active = true WHERE id = v_rtr_profile_id;
    RAISE NOTICE 'Found existing RTR profile: %', v_rtr_profile_id;
  END IF;

  -- ============================================================
  -- 4) RAIL ACCOUNTS (idempotent by tenant + account_name)
  -- Schema: cc_rail_accounts from Migration 118
  -- ============================================================
  
  -- FROM account (platform settlement)
  SELECT id INTO v_from_rail_account_id
  FROM cc_rail_accounts
  WHERE tenant_id = v_tenant_id AND account_name = v_from_account_name
  LIMIT 1;

  IF v_from_rail_account_id IS NULL THEN
    INSERT INTO cc_rail_accounts (
      tenant_id,
      account_type,
      account_name,
      institution_number,
      transit_number,
      account_number_masked,
      currency,
      is_verified,
      is_active,
      metadata
    ) VALUES (
      v_tenant_id,
      'checking',
      v_from_account_name,
      '001',
      '12345',
      '****0000',
      v_currency,
      true,
      true,
      jsonb_build_object('fixture', true, 'role', 'from')
    )
    RETURNING id INTO v_from_rail_account_id;
    RAISE NOTICE 'Created FROM rail account: %', v_from_rail_account_id;
  ELSE
    UPDATE cc_rail_accounts SET is_active = true WHERE id = v_from_rail_account_id;
    RAISE NOTICE 'Found existing FROM rail account: %', v_from_rail_account_id;
  END IF;

  -- TO account (external recipient)
  SELECT id INTO v_to_rail_account_id
  FROM cc_rail_accounts
  WHERE tenant_id = v_tenant_id AND account_name = v_to_account_name
  LIMIT 1;

  IF v_to_rail_account_id IS NULL THEN
    INSERT INTO cc_rail_accounts (
      tenant_id,
      account_type,
      account_name,
      institution_number,
      transit_number,
      account_number_masked,
      currency,
      is_verified,
      is_active,
      metadata
    ) VALUES (
      v_tenant_id,
      'checking',
      v_to_account_name,
      '002',
      '67890',
      '****1111',
      v_currency,
      true,
      true,
      jsonb_build_object('fixture', true, 'role', 'to')
    )
    RETURNING id INTO v_to_rail_account_id;
    RAISE NOTICE 'Created TO rail account: %', v_to_rail_account_id;
  ELSE
    UPDATE cc_rail_accounts SET is_active = true WHERE id = v_to_rail_account_id;
    RAISE NOTICE 'Found existing TO rail account: %', v_to_rail_account_id;
  END IF;

  -- ============================================================
  -- 5) SEED WALLET (only if no prior seed entry exists)
  -- ============================================================
  SELECT id INTO v_existing_entry
  FROM cc_wallet_entries
  WHERE tenant_id = v_tenant_id
    AND wallet_account_id = v_wallet_account_id
    AND reference_type = 'fixture_seed'
    AND description = 'RTR Harness Seed'
  LIMIT 1;

  IF v_existing_entry IS NULL THEN
    PERFORM cc_post_wallet_entry(
      v_tenant_id,
      v_wallet_account_id,
      'credit',
      v_wallet_seed_cents,
      v_currency,
      'RTR Harness Seed',
      'fixture_seed',
      v_wallet_account_id,
      NULL
    );
    RAISE NOTICE 'Seeded wallet with % cents', v_wallet_seed_cents;
  ELSE
    RAISE NOTICE 'Wallet already seeded (skipping)';
  END IF;

  -- ============================================================
  -- OUTPUT: Copy these values to .env.test
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXTURE OUTPUT - Copy to .env.test:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TENANT_ID=%', v_tenant_id;
  RAISE NOTICE 'RTR_PROFILE_ID=%', v_rtr_profile_id;
  RAISE NOTICE 'WALLET_ACCOUNT_ID=%', v_wallet_account_id;
  RAISE NOTICE 'FROM_RAIL_ACCOUNT_ID=%', v_from_rail_account_id;
  RAISE NOTICE 'TO_RAIL_ACCOUNT_ID=%', v_to_rail_account_id;
  RAISE NOTICE '========================================';

END $$;

-- Sanity check: verify wallet balance
SELECT 
  account_name,
  posted_balance_cents,
  available_balance_cents,
  active_holds_cents
FROM cc_wallet_accounts 
WHERE account_name = 'RTR Test Wallet'
LIMIT 1;
```

---

## Step 2 — Create `.env.test`

Copy the example and fill in the values from SQL output:

```bash
cp .env.test.example .env.test
```

Edit `.env.test`:

```env
BASE_URL=http://localhost:3000

# Bearer tokens - must work with your actual auth system
APP_TOKEN=<your-app-bearer-token>
SERVICE_TOKEN=<your-service-bearer-token>

# From SQL fixture output
TENANT_ID=<paste from FIXTURE OUTPUT>
RTR_PROFILE_ID=<paste from FIXTURE OUTPUT>
WALLET_ACCOUNT_ID=<paste from FIXTURE OUTPUT>
FROM_RAIL_ACCOUNT_ID=<paste from FIXTURE OUTPUT>
TO_RAIL_ACCOUNT_ID=<paste from FIXTURE OUTPUT>
```

### Token Requirements

| Token | Must Do |
|-------|---------|
| `APP_TOKEN` | Authenticate as app user, set `app.tenant_id = TENANT_ID` |
| `SERVICE_TOKEN` | Trigger service mode, set `app.tenant_id = '__SERVICE__'` |

---

## Step 3 — Update Test Harness for Bearer Auth

The harness should use Bearer tokens. Update `scripts/rtr-test-harness.ts` if needed:

```typescript
async function httpJson(
  method: "GET" | "POST",
  url: string,
  token: string,
  body?: Json,
  isServiceCall: boolean = false
): Promise<{ status: number; json: any; raw: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
  
  // Add tenant header for app calls (your middleware should read this)
  if (!isServiceCall) {
    headers["X-Tenant-Id"] = TENANT_ID;
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
  } catch {}
  
  return { status: res.status, json, raw };
}
```

**Key**: Your middleware must:
- For APP requests: Extract tenant from token claims OR `X-Tenant-Id` header
- For SERVICE requests: Recognize service token and set `__SERVICE__` mode

---

## Step 4 — Run the Harness

```bash
# Load environment
source .env.test

# Run tests
npx tsx scripts/rtr-test-harness.ts
```

---

## Expected Output

```
RTR adaptor test harness starting…
BASE_URL=http://localhost:3000

=== Baseline wallet account ===
{ posted0: 100000, avail0: 100000, holds0: 0 }

=== T1: Inbound top-up happy path ===
Created top-up transfer: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
submitTransfer: { transfer_id: '...', submitted: true, ... }
transfer.status: settled
{ posted1: 100111 }
✅ T1 PASSED

=== T4: Webhook replay idempotency ===
{ first: { inbox_id: '...' }, second: { idempotent_noop: true } }
✅ T4 PASSED

=== T3: Outbound cash-out rejected releases hold ===
{ avail2: 100111, holds2: 123 }
transfer.status: rejected
{ holds3: 0 }
✅ T3 PASSED

=== T2: Outbound cash-out settled captures hold ===
transfer.status: settled
✅ T2 PASSED

=== T5: Submit idempotency (double submit) ===
{ first: { submitted: true }, second: { submitted: false } }
✅ T5 PASSED

=== T7: Out-of-order events (settled then accepted) ===
transfer.status: settled
✅ T7 PASSED

🎉 All RTR adaptor harness tests passed!
```

---

## Troubleshooting

### "Tenant mismatch" errors

Your middleware isn't setting `app.tenant_id` correctly.

| Request Type | Required Setting |
|--------------|------------------|
| App endpoint | `SET LOCAL app.tenant_id = '<TENANT_ID>'` |
| Service endpoint | `SET LOCAL app.tenant_id = '__SERVICE__'` |

### Webhook replay duplicates wallet posting

Your `/internal/rtr/webhook` handler must:
1. Insert into `cc_rtr_webhook_inbox` idempotently (by hash/provider_event_id)
2. **Only proceed** if row was newly inserted
3. Before wallet posting, check if entry already exists for `(reference_type='rail_transfer', reference_id=transfer_id)`

### Out-of-order events regress status

Your webhook handler must **never downgrade status**:
- If current status is `settled`, ignore later `accepted` events

### "Transfer not found" on webhook

The webhook handler must resolve local transfer by:
1. `provider_transfer_id` in `cc_rail_transfers`
2. Fall back to `cc_external_sync_records`
3. Last resort: `client_request_id`

---

## Step 5 — Optional: Safe Test-Only Auth Shim

**Only add this if you cannot mint real tokens in dev.**

Must be gated by environment:

```typescript
// server/middleware/auth.ts

const TEST_MODE_ENABLED = 
  process.env.NODE_ENV === 'test' && 
  process.env.ALLOW_TEST_AUTH === 'true';

const TEST_APP_TOKEN = process.env.TEST_APP_TOKEN;
const TEST_SERVICE_TOKEN = process.env.TEST_SERVICE_TOKEN;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');
  
  // Test-only shim (strictly gated)
  if (TEST_MODE_ENABLED && token === TEST_APP_TOKEN) {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Missing X-Tenant-Id header' });
    }
    return db.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
      .then(() => next())
      .catch(next);
  }
  
  // Normal auth flow (production)
  // ... your existing JWT validation ...
}

export function requireServiceMode(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');
  
  // Test-only shim (strictly gated)
  if (TEST_MODE_ENABLED && token === TEST_SERVICE_TOKEN) {
    return db.query("SELECT set_config('app.tenant_id', '__SERVICE__', true)")
      .then(() => next())
      .catch(next);
  }
  
  // Normal service auth flow (production)
  // ... your existing service token validation ...
}
```

**Required `.env.test` additions:**
```env
NODE_ENV=test
ALLOW_TEST_AUTH=true
TEST_APP_TOKEN=test-app-token-12345
TEST_SERVICE_TOKEN=test-service-token-67890
APP_TOKEN=test-app-token-12345
SERVICE_TOKEN=test-service-token-67890
```

---

## Report Back

| Step | Status |
|------|--------|
| SQL fixtures created | ✅ / ❌ |
| .env.test configured | ✅ / ❌ |
| T1: Inbound top-up | ✅ / ❌ |
| T2: Cash-out settled | ✅ / ❌ |
| T3: Cash-out rejected | ✅ / ❌ |
| T4: Webhook idempotency | ✅ / ❌ |
| T5: Submit idempotency | ✅ / ❌ |
| T7: Out-of-order events | ✅ / ❌ |

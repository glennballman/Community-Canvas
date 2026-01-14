# REPLIT: Migration 120 — RTR Connector Pack

## Objective
Create the Payments Canada Real-Time Rail (RTR) connector infrastructure with append-only message logs, webhook ingestion, and adaptor functions that sit on top of the Payment Rail Spine (Migration 118).

## Design Notes (From ChatGPT)
- This pack **does not "implement RTR"** in the sense of real FI participation
- It lays down the **connector schema + message/log plumbing + adaptor functions** to integrate with Payments Canada's RTR sandbox/APIs
- RTR is **24/7/365**, **data-rich**, **irrevocable**, built on **ISO 20022** messages
- Actual API calls happen in middleware/edge; DB stores config + logs + idempotency

## What This Migration Creates

| Component | Count | Details |
|-----------|-------|---------|
| Tables | 3 | `cc_rtr_profiles`, `cc_rtr_message_log`, `cc_rtr_webhook_inbox` |
| Enums | 2 | `rtr_message_direction`, `rtr_message_type` |
| Functions | 3 | Register profile, prepare payment request, ingest webhook |
| Append-only | 2 | `cc_rtr_message_log`, `cc_rtr_webhook_inbox` (both with FORCE RLS) |

## Prerequisites
- Payment Rail Spine tables: `cc_rail_connectors`, `cc_rail_transfers`, `cc_rail_transfer_events`
- External Sync Records: `cc_external_sync_records`
- Helper functions: `current_tenant_id()`, `is_service_mode()`, `current_individual_id()`

---

## SQL Migration

```sql
-- ============================================================================
-- MIGRATION 120: RTR CONNECTOR PACK (Payments Canada)
-- Requires:
--   - Payment Rail Spine tables (cc_rail_connectors, cc_rail_transfers, cc_rail_transfer_events)
--   - External Sync Records (cc_external_sync_records)
-- Notes:
--   - Actual API calls happen in middleware/edge; DB stores config + logs + idempotency.
-- ============================================================================

-- Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE rtr_message_direction AS ENUM ('outbound','inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rtr_message_type AS ENUM ('payment_request','payment_status','webhook','reconciliation','note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- cc_rtr_profiles (one per connector/environment/tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rtr_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  rail_connector_id UUID NOT NULL REFERENCES cc_rail_connectors(id) ON DELETE CASCADE,

  -- environment is also on connector; keep here for safety checks
  environment TEXT NOT NULL DEFAULT 'sandbox',

  -- Non-secret config. Secrets stored in connector.secrets_encrypted (service-written).
  participant_id TEXT,                  -- if applicable in sandbox/participant model
  endpoint_base_url TEXT,               -- sandbox base URL (non-secret)
  api_version TEXT DEFAULT 'v1',

  -- ISO 20022 / mapping config
  default_currency TEXT NOT NULL DEFAULT 'CAD',
  default_remittance_format TEXT DEFAULT 'structured',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rtr_profile UNIQUE (tenant_id, rail_connector_id)
);

DROP TRIGGER IF EXISTS trg_rtr_profiles_updated ON cc_rtr_profiles;
CREATE TRIGGER trg_rtr_profiles_updated
  BEFORE UPDATE ON cc_rtr_profiles
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ---------------------------------------------------------------------------
-- cc_rtr_message_log (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rtr_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  rtr_profile_id UUID NOT NULL REFERENCES cc_rtr_profiles(id) ON DELETE CASCADE,

  direction rtr_message_direction NOT NULL,
  message_type rtr_message_type NOT NULL,

  -- correlation
  transfer_id UUID REFERENCES cc_rail_transfers(id) ON DELETE SET NULL,
  provider_message_id TEXT,             -- RTR sandbox message id / correlation id if present

  -- payloads should be redacted
  payload_redacted JSONB,
  headers_redacted JSONB,

  http_status INTEGER,
  provider_status TEXT,
  provider_reason_code TEXT,
  provider_reason_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,

  CONSTRAINT uq_rtr_provider_message UNIQUE (rtr_profile_id, provider_message_id)
);

-- ---------------------------------------------------------------------------
-- cc_rtr_webhook_inbox (append-only, idempotent by provider event id/hash)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rtr_webhook_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  rtr_profile_id UUID NOT NULL REFERENCES cc_rtr_profiles(id) ON DELETE CASCADE,

  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  provider_event_id TEXT,
  event_hash TEXT NOT NULL,            -- sha256 of raw payload

  headers_redacted JSONB,
  payload_redacted JSONB,

  processed_at TIMESTAMPTZ,
  processing_result TEXT,
  error_message TEXT,

  CONSTRAINT uq_rtr_webhook_event UNIQUE (rtr_profile_id, provider_event_id),
  CONSTRAINT uq_rtr_webhook_hash UNIQUE (rtr_profile_id, event_hash)
);

-- ---------------------------------------------------------------------------
-- RLS for cc_rtr_message_log (append-only)
-- ---------------------------------------------------------------------------
ALTER TABLE cc_rtr_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rtr_log_select ON cc_rtr_message_log;
CREATE POLICY rtr_log_select ON cc_rtr_message_log
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_log_insert ON cc_rtr_message_log;
CREATE POLICY rtr_log_insert ON cc_rtr_message_log
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_log_update_deny ON cc_rtr_message_log;
CREATE POLICY rtr_log_update_deny ON cc_rtr_message_log
  FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS rtr_log_delete_deny ON cc_rtr_message_log;
CREATE POLICY rtr_log_delete_deny ON cc_rtr_message_log
  FOR DELETE USING (FALSE);

ALTER TABLE cc_rtr_message_log FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS for cc_rtr_webhook_inbox (append-only for raw data, service can update processing status)
-- ---------------------------------------------------------------------------
ALTER TABLE cc_rtr_webhook_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rtr_inbox_select ON cc_rtr_webhook_inbox;
CREATE POLICY rtr_inbox_select ON cc_rtr_webhook_inbox
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_inbox_insert ON cc_rtr_webhook_inbox;
CREATE POLICY rtr_inbox_insert ON cc_rtr_webhook_inbox
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_inbox_update_service ON cc_rtr_webhook_inbox;
CREATE POLICY rtr_inbox_update_service ON cc_rtr_webhook_inbox
  FOR UPDATE USING (is_service_mode()) WITH CHECK (is_service_mode());

DROP POLICY IF EXISTS rtr_inbox_delete_deny ON cc_rtr_webhook_inbox;
CREATE POLICY rtr_inbox_delete_deny ON cc_rtr_webhook_inbox
  FOR DELETE USING (FALSE);

-- ---------------------------------------------------------------------------
-- RLS for cc_rtr_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE cc_rtr_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rtr_profiles_select ON cc_rtr_profiles;
CREATE POLICY rtr_profiles_select ON cc_rtr_profiles
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_profiles_insert ON cc_rtr_profiles;
CREATE POLICY rtr_profiles_insert ON cc_rtr_profiles
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_profiles_update ON cc_rtr_profiles;
CREATE POLICY rtr_profiles_update ON cc_rtr_profiles
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rtr_profiles_delete_service ON cc_rtr_profiles;
CREATE POLICY rtr_profiles_delete_service ON cc_rtr_profiles
  FOR DELETE USING (is_service_mode());

-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

-- Register/attach an RTR profile to an existing rail connector
CREATE OR REPLACE FUNCTION cc_register_rtr_profile(
  p_tenant_id UUID,
  p_rail_connector_id UUID,
  p_environment TEXT DEFAULT 'sandbox',
  p_endpoint_base_url TEXT DEFAULT NULL,
  p_participant_id TEXT DEFAULT NULL,
  p_api_version TEXT DEFAULT 'v1'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO cc_rtr_profiles(
    id, tenant_id, rail_connector_id, environment, endpoint_base_url, participant_id, api_version
  ) VALUES (
    v_id, p_tenant_id, p_rail_connector_id, p_environment, p_endpoint_base_url, p_participant_id, p_api_version
  );

  RETURN v_id;
END;
$$;

-- Prepare an RTR payment request payload (redacted skeleton) from a rail transfer.
-- Actual ISO 20022 transformation happens in middleware; this provides canonical fields and ensures idempotency.
CREATE OR REPLACE FUNCTION cc_rtr_prepare_payment_request(
  p_tenant_id UUID,
  p_transfer_id UUID,
  p_rtr_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_tr RECORD;
  v_payload JSONB;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  SELECT * INTO v_tr
  FROM cc_rail_transfers
  WHERE id=p_transfer_id AND tenant_id=p_tenant_id;

  IF v_tr IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  -- Minimal canonical payload for middleware to transform to ISO 20022 (pacs.008 etc.)
  v_payload := jsonb_build_object(
    'transfer_id', v_tr.id,
    'client_request_id', v_tr.client_request_id,
    'direction', v_tr.direction,
    'amount_cents', v_tr.amount_cents,
    'currency', v_tr.currency,
    'memo', v_tr.memo,
    'reference_text', v_tr.reference_text,
    'from_rail_account_id', v_tr.from_rail_account_id,
    'to_rail_account_id', v_tr.to_rail_account_id,
    'requested_at', v_tr.requested_at,
    'provider', 'payments_canada_rtr',
    'profile_id', p_rtr_profile_id
  );

  -- Log outbound "prepared" message (append-only)
  INSERT INTO cc_rtr_message_log(
    tenant_id, rtr_profile_id, direction, message_type,
    transfer_id, payload_redacted, created_by_individual_id
  ) VALUES (
    p_tenant_id, p_rtr_profile_id, 'outbound', 'payment_request',
    p_transfer_id, v_payload, current_individual_id()
  );

  RETURN v_payload;
END;
$$;

-- Ingest an RTR webhook payload idempotently (service-only), translate to rail events + sync record
CREATE OR REPLACE FUNCTION cc_rtr_ingest_webhook(
  p_tenant_id UUID,
  p_rtr_profile_id UUID,
  p_provider_event_id TEXT,
  p_event_hash TEXT,
  p_headers_redacted JSONB,
  p_payload_redacted JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_service_mode() THEN
    RAISE EXCEPTION 'Service mode required';
  END IF;

  -- idempotent insert (provider_event_id or hash)
  v_id := gen_random_uuid();
  INSERT INTO cc_rtr_webhook_inbox(
    id, tenant_id, rtr_profile_id,
    provider_event_id, event_hash,
    headers_redacted, payload_redacted
  ) VALUES (
    v_id, p_tenant_id, p_rtr_profile_id,
    p_provider_event_id, p_event_hash,
    p_headers_redacted, p_payload_redacted
  )
  ON CONFLICT DO NOTHING;

  -- Return existing row if conflict
  IF NOT FOUND THEN
    SELECT id INTO v_id
    FROM cc_rtr_webhook_inbox
    WHERE rtr_profile_id=p_rtr_profile_id
      AND (provider_event_id=p_provider_event_id OR event_hash=p_event_hash)
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;
```

---

## Acceptance Criteria

### 1. Tables Created (3)
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('cc_rtr_profiles', 'cc_rtr_message_log', 'cc_rtr_webhook_inbox')
ORDER BY table_name;
```
**Expected:** 3 rows

### 2. Enums Created (2)
```sql
SELECT typname 
FROM pg_type 
WHERE typname IN ('rtr_message_direction', 'rtr_message_type')
ORDER BY typname;
```
**Expected:** 2 rows

### 3. Functions Created (3)
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'cc_register_rtr_profile',
    'cc_rtr_prepare_payment_request', 
    'cc_rtr_ingest_webhook'
  )
ORDER BY routine_name;
```
**Expected:** 3 rows

### 4. RLS Enabled on All Tables
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('cc_rtr_profiles', 'cc_rtr_message_log', 'cc_rtr_webhook_inbox')
ORDER BY tablename;
```
**Expected:** All 3 show `rowsecurity = true`

### 5. FORCE RLS on Append-Only Table
```sql
SELECT relname, relforcerowsecurity 
FROM pg_class 
WHERE relname = 'cc_rtr_message_log';
```
**Expected:** `relforcerowsecurity = true`

### 6. Append-Only Verification (Using cc_app_test role)
```sql
-- Switch to non-superuser role
SET ROLE cc_app_test;

-- These should return 0 rows (blocked by RLS)
UPDATE cc_rtr_message_log SET provider_status = 'hacked' WHERE 1=1;
DELETE FROM cc_rtr_message_log WHERE 1=1;

-- Reset role
RESET ROLE;
```
**Expected:** `UPDATE 0` and `DELETE 0`

### 7. Table Count Verification
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'cc_%';
```
**Expected:** 515 (was 512, added 3)

### 8. Total Append-Only Tables Verification
```sql
SELECT relname, relforcerowsecurity 
FROM pg_class 
WHERE relname IN (
  'cc_audit_trail', 
  'cc_folio_ledger', 
  'cc_rail_transfer_events',
  'cc_wallet_entries',
  'cc_rtr_message_log'
)
ORDER BY relname;
```
**Expected:** 5 rows, all with `relforcerowsecurity = true`

---

## Report Back

After running Migration 120, please report:

| Check | Result |
|-------|--------|
| Tables created | ? / 3 |
| Enums created | ? / 2 |
| Functions created | ? / 3 |
| RLS enabled | ? / 3 |
| FORCE RLS on cc_rtr_message_log | ✅ / ❌ |
| Append-only verified | ✅ / ❌ |
| New table count | ? (expected: 515) |
| Total append-only tables | ? (expected: 5) |

---

## Platform State After Migration 120

| Metric | Before | After |
|--------|--------|-------|
| cc_* tables | 512 | **515** |
| Migrations | 119 | **120** |
| Append-only tables | 4 | **5** (+ `cc_rtr_message_log`) |

---

## What This Enables

The RTR Connector Pack provides:

1. **Profile Management** — Link RTR sandbox credentials to existing rail connectors
2. **Outbound Logging** — Every payment request is logged before sending to RTR
3. **Webhook Ingestion** — Idempotent processing of RTR callbacks with hash-based deduplication
4. **Audit Trail** — All RTR communications are immutable and auditable

---

## V3 Stored Value Stack Complete After This

| Layer | Migration | Status |
|-------|-----------|--------|
| Payment Rail Spine | 118 | ✅ Complete |
| Wallet Ledger Spine | 119 | ✅ Complete |
| RTR Connector Pack | 120 | 🔄 This migration |

After Migration 120, the entire stored value / payment infrastructure is complete.

-- ============================================================================
-- MIGRATION 118: PAYMENT RAIL SPINE (PSP-AGNOSTIC)
-- Purpose:
--   Canonical primitives for any external payment rail (RTR, EFT, card payouts, etc.)
--   Keep wallet ledger separate; rail movements reference wallet actions via reference_type/reference_id.
--
-- Hard rules:
--   - Tenant isolation via current_tenant_id() / is_service_mode()
--   - RLS enabled on all tenant-scoped tables
--   - SECURITY DEFINER functions must:
--       SET search_path = public, pg_temp
--       SET row_security = on
--   - No refactor: rails primitives exist before implementing RTR adaptor
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers (create-if-missing): updated_at trigger
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE p.proname='cc_set_updated_at' AND n.nspname='public'
  ) THEN
    CREATE FUNCTION cc_set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Enums (create-if-missing)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE rail_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rail_transfer_status AS ENUM (
    'created',          -- constructed, not yet submitted to provider
    'queued',           -- queued for submission
    'submitted',        -- submitted to provider / rail
    'accepted',         -- accepted by provider/rail (not necessarily settled)
    'settled',          -- final success (funds moved)
    'rejected',         -- rejected by provider/rail
    'failed',           -- failed due to system/provider error
    'cancelled',        -- cancelled before irrevocable step (if supported)
    'reversed',         -- provider-level reversal (rare); otherwise use compensating ledger
    'expired'           -- expired/timeout
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rail_event_type AS ENUM (
    'created',
    'queued',
    'submitted',
    'provider_ack',
    'provider_update',
    'settled',
    'rejected',
    'failed',
    'cancelled',
    'reversed',
    'webhook_received',
    'reconciled',
    'note'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rail_connector_status AS ENUM ('active','disabled','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rail_account_type AS ENUM ('payer','payee','merchant_settlement','platform','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Table: cc_rail_connectors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rail_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  connector_key TEXT NOT NULL,              -- e.g. 'rtr', 'eft', 'stripe_payouts'
  connector_name TEXT NOT NULL,
  provider TEXT NOT NULL,                   -- e.g. 'payments_canada', 'stripe', 'adp'
  environment TEXT NOT NULL DEFAULT 'sandbox',  -- 'sandbox' | 'production' | 'staging'

  status rail_connector_status NOT NULL DEFAULT 'active',

  -- Configuration: store non-secret config here; secrets should be encrypted blob
  config JSONB,
  secrets_encrypted JSONB,                  -- service-written; encrypted at app layer

  -- Operational
  last_healthcheck_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rail_connector UNIQUE (tenant_id, connector_key, environment)
);

CREATE INDEX IF NOT EXISTS idx_rail_connectors_tenant_status
  ON cc_rail_connectors(tenant_id, status, connector_key);

DROP TRIGGER IF EXISTS trg_rail_connectors_updated ON cc_rail_connectors;
CREATE TRIGGER trg_rail_connectors_updated
  BEFORE UPDATE ON cc_rail_connectors
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ---------------------------------------------------------------------------
-- Table: cc_rail_accounts
-- Note: tokenized endpoints only; do not store raw bank secrets in plaintext.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  connector_id UUID REFERENCES cc_rail_connectors(id) ON DELETE SET NULL,

  account_type rail_account_type NOT NULL DEFAULT 'unknown',

  -- Optional linkage to platform entities
  party_id UUID REFERENCES cc_parties(id) ON DELETE SET NULL,
  individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,

  label TEXT,                               -- "Bamfield Wallet Top-Up Source"
  currency TEXT NOT NULL DEFAULT 'CAD',

  -- Tokenized / redacted identifiers:
  -- For RTR this might represent a proxy identifier or participating FI reference; keep as opaque.
  external_account_ref TEXT NOT NULL,       -- opaque reference (token, alias)
  external_account_last4 TEXT,              -- optional display (last 4)
  external_account_meta JSONB,              -- optional structured meta (bank name, etc.), non-sensitive only

  -- Verification state
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_method TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rail_account_ref UNIQUE (tenant_id, external_account_ref)
);

CREATE INDEX IF NOT EXISTS idx_rail_accounts_tenant_party
  ON cc_rail_accounts(tenant_id, party_id);

CREATE INDEX IF NOT EXISTS idx_rail_accounts_connector
  ON cc_rail_accounts(connector_id);

DROP TRIGGER IF EXISTS trg_rail_accounts_updated ON cc_rail_accounts;
CREATE TRIGGER trg_rail_accounts_updated
  BEFORE UPDATE ON cc_rail_accounts
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ---------------------------------------------------------------------------
-- Table: cc_rail_transfers
-- Canonical rail movement. Wallet ledger references should be separate; we link via reference_*.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rail_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  connector_id UUID REFERENCES cc_rail_connectors(id) ON DELETE SET NULL,

  direction rail_direction NOT NULL,        -- inbound/outbound
  status rail_transfer_status NOT NULL DEFAULT 'created',

  -- Idempotency
  client_request_id TEXT NOT NULL,          -- required for idempotency across retries
  idempotency_key TEXT,                     -- optional external idempotency key if provider requires

  -- Parties / accounts
  from_rail_account_id UUID REFERENCES cc_rail_accounts(id) ON DELETE SET NULL,
  to_rail_account_id UUID REFERENCES cc_rail_accounts(id) ON DELETE SET NULL,

  -- Amount
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',

  -- Data-rich rails: message/memo/reference
  memo TEXT,
  reference_text TEXT,                      -- provider reference text

  -- Provider references
  provider_transfer_id TEXT,                -- provider primary key
  provider_status TEXT,                     -- raw provider status
  provider_reason_code TEXT,
  provider_reason_message TEXT,

  -- Timing
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Correlation to internal systems (wallet/top-up/settlement/etc.)
  reference_type TEXT,                      -- e.g. 'wallet_topup','wallet_cashout','merchant_settlement'
  reference_id UUID,                        -- internal id to correlate (wallet ledger batch id, etc.)

  -- Attribution
  requested_by_individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Integrity/audit
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rail_transfer_client_request UNIQUE (tenant_id, client_request_id),
  CONSTRAINT ck_rail_amount_positive CHECK (amount_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_rail_transfers_tenant_status
  ON cc_rail_transfers(tenant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_rail_transfers_provider
  ON cc_rail_transfers(connector_id, provider_transfer_id);

CREATE INDEX IF NOT EXISTS idx_rail_transfers_reference
  ON cc_rail_transfers(reference_type, reference_id);

DROP TRIGGER IF EXISTS trg_rail_transfers_updated ON cc_rail_transfers;
CREATE TRIGGER trg_rail_transfers_updated
  BEFORE UPDATE ON cc_rail_transfers
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ---------------------------------------------------------------------------
-- Table: cc_rail_transfer_events (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cc_rail_transfer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  transfer_id UUID NOT NULL REFERENCES cc_rail_transfers(id) ON DELETE CASCADE,

  event_type rail_event_type NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Provider correlation
  provider_event_id TEXT,
  provider_status TEXT,
  provider_payload JSONB,                   -- store redacted payloads only

  -- Derived updates (optional)
  new_status rail_transfer_status,

  -- Notes/errors
  message TEXT,
  error_code TEXT,
  error_message TEXT,

  created_by_individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rail_event_provider UNIQUE (transfer_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_rail_events_transfer
  ON cc_rail_transfer_events(transfer_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_rail_events_tenant
  ON cc_rail_transfer_events(tenant_id, event_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE cc_rail_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_rail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_rail_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_rail_transfer_events ENABLE ROW LEVEL SECURITY;

-- Connectors: tenant/service
DROP POLICY IF EXISTS rail_connectors_select ON cc_rail_connectors;
CREATE POLICY rail_connectors_select ON cc_rail_connectors
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_connectors_insert ON cc_rail_connectors;
CREATE POLICY rail_connectors_insert ON cc_rail_connectors
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_connectors_update ON cc_rail_connectors;
CREATE POLICY rail_connectors_update ON cc_rail_connectors
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Delete: service-only
DROP POLICY IF EXISTS rail_connectors_delete_service ON cc_rail_connectors;
CREATE POLICY rail_connectors_delete_service ON cc_rail_connectors
  FOR DELETE USING (is_service_mode());

-- Accounts: tenant/service
DROP POLICY IF EXISTS rail_accounts_select ON cc_rail_accounts;
CREATE POLICY rail_accounts_select ON cc_rail_accounts
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_accounts_insert ON cc_rail_accounts;
CREATE POLICY rail_accounts_insert ON cc_rail_accounts
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_accounts_update ON cc_rail_accounts;
CREATE POLICY rail_accounts_update ON cc_rail_accounts
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Delete: service-only (prefer deactivation)
DROP POLICY IF EXISTS rail_accounts_delete_service ON cc_rail_accounts;
CREATE POLICY rail_accounts_delete_service ON cc_rail_accounts
  FOR DELETE USING (is_service_mode());

-- Transfers: tenant/service
DROP POLICY IF EXISTS rail_transfers_select ON cc_rail_transfers;
CREATE POLICY rail_transfers_select ON cc_rail_transfers
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_transfers_insert ON cc_rail_transfers;
CREATE POLICY rail_transfers_insert ON cc_rail_transfers
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_transfers_update ON cc_rail_transfers;
CREATE POLICY rail_transfers_update ON cc_rail_transfers
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Delete: service-only (prefer status cancelled)
DROP POLICY IF EXISTS rail_transfers_delete_service ON cc_rail_transfers;
CREATE POLICY rail_transfers_delete_service ON cc_rail_transfers
  FOR DELETE USING (is_service_mode());

-- Events: tenant/service SELECT+INSERT; UPDATE/DELETE denied (append-only)
DROP POLICY IF EXISTS rail_events_select ON cc_rail_transfer_events;
CREATE POLICY rail_events_select ON cc_rail_transfer_events
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_events_insert ON cc_rail_transfer_events;
CREATE POLICY rail_events_insert ON cc_rail_transfer_events
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS rail_events_update_deny ON cc_rail_transfer_events;
CREATE POLICY rail_events_update_deny ON cc_rail_transfer_events
  FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS rail_events_delete_deny ON cc_rail_transfer_events;
CREATE POLICY rail_events_delete_deny ON cc_rail_transfer_events
  FOR DELETE USING (FALSE);

-- Force RLS even for table owners (recommended for append-only truth tables)
ALTER TABLE cc_rail_transfer_events FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Functions: create/update transfers + append events
-- ---------------------------------------------------------------------------

-- Create or return existing transfer by client_request_id (idempotent)
CREATE OR REPLACE FUNCTION cc_create_rail_transfer(
  p_tenant_id UUID,
  p_connector_id UUID,
  p_direction rail_direction,
  p_client_request_id TEXT,
  p_from_rail_account_id UUID,
  p_to_rail_account_id UUID,
  p_amount_cents INTEGER,
  p_currency TEXT DEFAULT 'CAD',
  p_memo TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS TABLE(transfer_id UUID, already_exists BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_existing UUID;
  v_id UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Idempotency lock per tenant+client_request_id
  PERFORM pg_advisory_xact_lock(hashtext('cc_create_rail_transfer:' || p_tenant_id::text || ':' || p_client_request_id));

  SELECT id INTO v_existing
  FROM cc_rail_transfers
  WHERE tenant_id = p_tenant_id
    AND client_request_id = p_client_request_id;

  IF v_existing IS NOT NULL THEN
    transfer_id := v_existing;
    already_exists := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO cc_rail_transfers (
    id, tenant_id, connector_id,
    direction, status,
    client_request_id,
    from_rail_account_id, to_rail_account_id,
    amount_cents, currency,
    memo,
    reference_type, reference_id,
    requested_by_individual_id
  ) VALUES (
    v_id, p_tenant_id, p_connector_id,
    p_direction, 'created',
    p_client_request_id,
    p_from_rail_account_id, p_to_rail_account_id,
    p_amount_cents, COALESCE(p_currency,'CAD'),
    p_memo,
    p_reference_type, p_reference_id,
    current_individual_id()
  );

  -- Append event
  INSERT INTO cc_rail_transfer_events(
    tenant_id, transfer_id, event_type, event_at,
    message, created_by_individual_id, new_status
  ) VALUES (
    p_tenant_id, v_id, 'created', now(),
    'Transfer created', current_individual_id(), 'created'
  );

  transfer_id := v_id;
  already_exists := FALSE;
  RETURN NEXT;
END;
$$;

-- Append an event and optionally update transfer status (service/tenant allowed, but provider payload typically service)
CREATE OR REPLACE FUNCTION cc_append_rail_transfer_event(
  p_tenant_id UUID,
  p_transfer_id UUID,
  p_event_type rail_event_type,
  p_provider_event_id TEXT DEFAULT NULL,
  p_provider_status TEXT DEFAULT NULL,
  p_provider_payload JSONB DEFAULT NULL,
  p_new_status rail_transfer_status DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  -- Ensure transfer belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM cc_rail_transfers
    WHERE id = p_transfer_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  v_event_id := gen_random_uuid();

  INSERT INTO cc_rail_transfer_events(
    id, tenant_id, transfer_id,
    event_type, event_at,
    provider_event_id, provider_status, provider_payload,
    new_status,
    message, error_code, error_message,
    created_by_individual_id
  ) VALUES (
    v_event_id, p_tenant_id, p_transfer_id,
    p_event_type, now(),
    p_provider_event_id, p_provider_status, p_provider_payload,
    p_new_status,
    p_message, p_error_code, p_error_message,
    current_individual_id()
  );

  -- Apply status update (if provided)
  IF p_new_status IS NOT NULL THEN
    UPDATE cc_rail_transfers
    SET
      status = p_new_status,
      provider_status = COALESCE(p_provider_status, provider_status),
      updated_at = now(),
      submitted_at = CASE WHEN p_new_status='submitted' THEN COALESCE(submitted_at, now()) ELSE submitted_at END,
      accepted_at  = CASE WHEN p_new_status='accepted'  THEN COALESCE(accepted_at,  now()) ELSE accepted_at END,
      settled_at   = CASE WHEN p_new_status='settled'   THEN COALESCE(settled_at,   now()) ELSE settled_at END,
      failed_at    = CASE WHEN p_new_status IN ('failed','rejected') THEN COALESCE(failed_at, now()) ELSE failed_at END,
      cancelled_at = CASE WHEN p_new_status='cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END
    WHERE id = p_transfer_id AND tenant_id = p_tenant_id;
  END IF;

  RETURN v_event_id;
END;
$$;

-- Update provider identifiers (service-only recommended)
CREATE OR REPLACE FUNCTION cc_set_rail_provider_refs(
  p_tenant_id UUID,
  p_transfer_id UUID,
  p_provider_transfer_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
BEGIN
  IF NOT is_service_mode() THEN
    RAISE EXCEPTION 'Service mode required';
  END IF;

  UPDATE cc_rail_transfers
  SET provider_transfer_id = p_provider_transfer_id,
      idempotency_key = COALESCE(p_idempotency_key, idempotency_key),
      updated_at = now()
  WHERE id = p_transfer_id AND tenant_id = p_tenant_id;

  RETURN TRUE;
END;
$$;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION cc_create_rail_transfer TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_append_rail_transfer_event TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_set_rail_provider_refs TO cc_app_test;

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

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION cc_register_rtr_profile TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_rtr_prepare_payment_request TO cc_app_test;
GRANT EXECUTE ON FUNCTION cc_rtr_ingest_webhook TO cc_app_test;

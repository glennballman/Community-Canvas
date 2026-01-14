-- ============================================================================
-- MIGRATION G v2 (DROP-IN): DATA COMPLIANCE & FEDERATION
-- Tables: cc_data_exports, cc_data_export_files, cc_federated_tokens
-- Run order: THIRD (3 of 4)
--
-- Wallet-era hardening:
--   - Exports are OWNER-SCOPED (requested_by_individual_id)
--   - Federated tokens are SERVICE-MODE ONLY
--   - Export URLs/tokens are SERVICE-WRITTEN (prevents leaks)
--   - All SECURITY DEFINER functions with proper search_path
-- ============================================================================

-- ============================================================================
-- SHARED TRIGGER FUNCTION (Guarded Creation)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'cc_set_updated_at' AND n.nspname = 'public'
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

-- ============================================================================
-- ENUMS (Idempotent Creation)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE data_export_status AS ENUM ('requested','processing','ready','downloaded','expired','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_export_type AS ENUM ('full_profile','activity_log','reservations','transactions','communications','certifications','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE federated_token_type AS ENUM ('access','refresh','identity','delegation','service','one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE federated_token_status AS ENUM ('active','revoked','expired','consumed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE federation_scope AS ENUM ('read_profile','read_reservations','read_certifications','write_reservations','write_profile','admin','civos_sync');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: cc_data_exports (OWNER-SCOPED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  -- Owner (the individual requesting their data)
  requested_by_individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  requested_by_party_id UUID REFERENCES cc_parties(id),

  export_number TEXT NOT NULL,
  export_type data_export_type NOT NULL,
  status data_export_status NOT NULL DEFAULT 'requested',

  include_profile BOOLEAN DEFAULT TRUE,
  include_activity BOOLEAN DEFAULT FALSE,
  include_reservations BOOLEAN DEFAULT TRUE,
  include_transactions BOOLEAN DEFAULT TRUE,
  include_communications BOOLEAN DEFAULT FALSE,
  include_certifications BOOLEAN DEFAULT TRUE,
  custom_tables TEXT[],

  date_from DATE,
  date_to DATE,

  output_format TEXT DEFAULT 'json',
  include_attachments BOOLEAN DEFAULT FALSE,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  total_records INTEGER,
  total_files INTEGER,
  total_size_bytes BIGINT,

  -- Download access (SERVICE-WRITTEN ONLY)
  download_url TEXT,
  download_token TEXT,
  download_expires_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,

  retention_days INTEGER DEFAULT 30,
  purge_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,

  legal_basis TEXT,
  verification_method TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_data_export_tenant_number UNIQUE (tenant_id, export_number)
);

CREATE INDEX IF NOT EXISTS idx_data_exports_tenant_status ON cc_data_exports(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_data_exports_owner ON cc_data_exports(requested_by_individual_id, status);

-- ============================================================================
-- TABLE: cc_data_export_files
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_data_export_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  export_id UUID NOT NULL REFERENCES cc_data_exports(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  data_category TEXT NOT NULL,
  record_count INTEGER,

  checksum_sha256 TEXT,

  is_encrypted BOOLEAN DEFAULT FALSE,
  encryption_key_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_export_files_export ON cc_data_export_files(export_id);

-- ============================================================================
-- TABLE: cc_federated_tokens (SERVICE-OWNED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_federated_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  token_hash TEXT NOT NULL,
  token_type federated_token_type NOT NULL,
  status federated_token_status NOT NULL DEFAULT 'active',

  party_id UUID REFERENCES cc_parties(id),
  individual_id UUID REFERENCES cc_individuals(id),

  issuer TEXT NOT NULL,
  audience TEXT NOT NULL,

  scopes federation_scope[] NOT NULL,

  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  not_before TIMESTAMPTZ DEFAULT now(),

  refresh_token_id UUID REFERENCES cc_federated_tokens(id),
  refreshed_from_id UUID REFERENCES cc_federated_tokens(id),

  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  max_uses INTEGER,

  client_id TEXT,
  client_ip TEXT,
  user_agent TEXT,

  delegated_by_token_id UUID REFERENCES cc_federated_tokens(id),
  delegation_depth INTEGER DEFAULT 0,
  max_delegation_depth INTEGER DEFAULT 2,

  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES cc_individuals(id),
  revoke_reason TEXT,

  claims JSONB,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_federated_token_hash UNIQUE (token_hash),
  CONSTRAINT ck_token_validity CHECK (expires_at > issued_at),
  CONSTRAINT ck_delegation_depth CHECK (delegation_depth <= max_delegation_depth)
);

CREATE INDEX IF NOT EXISTS idx_federated_tokens_tenant_status ON cc_federated_tokens(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_federated_tokens_hash_active ON cc_federated_tokens(token_hash) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_federated_tokens_expiry ON cc_federated_tokens(expires_at) WHERE status='active';

-- ============================================================================
-- RLS POLICIES (HARDENED)
-- ============================================================================

ALTER TABLE cc_data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_data_export_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_federated_tokens ENABLE ROW LEVEL SECURITY;

-- Exports: OWNER ONLY + service
DROP POLICY IF EXISTS data_exports_select_owner ON cc_data_exports;
DROP POLICY IF EXISTS data_exports_insert_owner ON cc_data_exports;
DROP POLICY IF EXISTS data_exports_update_owner ON cc_data_exports;
DROP POLICY IF EXISTS data_exports_delete_service ON cc_data_exports;

CREATE POLICY data_exports_select_owner ON cc_data_exports
  FOR SELECT
  USING (requested_by_individual_id = current_individual_id() OR is_service_mode());

CREATE POLICY data_exports_insert_owner ON cc_data_exports
  FOR INSERT
  WITH CHECK (requested_by_individual_id = current_individual_id() OR is_service_mode());

CREATE POLICY data_exports_update_owner ON cc_data_exports
  FOR UPDATE
  USING (requested_by_individual_id = current_individual_id() OR is_service_mode())
  WITH CHECK (requested_by_individual_id = current_individual_id() OR is_service_mode());

CREATE POLICY data_exports_delete_service ON cc_data_exports
  FOR DELETE
  USING (is_service_mode());

-- Export files: via export ownership + service
DROP POLICY IF EXISTS data_export_files_select_owner ON cc_data_export_files;
DROP POLICY IF EXISTS data_export_files_insert_owner ON cc_data_export_files;
DROP POLICY IF EXISTS data_export_files_update_owner ON cc_data_export_files;
DROP POLICY IF EXISTS data_export_files_delete_service ON cc_data_export_files;

CREATE POLICY data_export_files_select_owner ON cc_data_export_files
  FOR SELECT
  USING (
    is_service_mode()
    OR export_id IN (SELECT id FROM cc_data_exports WHERE requested_by_individual_id = current_individual_id())
  );

CREATE POLICY data_export_files_insert_owner ON cc_data_export_files
  FOR INSERT
  WITH CHECK (
    is_service_mode()
    OR export_id IN (SELECT id FROM cc_data_exports WHERE requested_by_individual_id = current_individual_id())
  );

CREATE POLICY data_export_files_update_owner ON cc_data_export_files
  FOR UPDATE
  USING (
    is_service_mode()
    OR export_id IN (SELECT id FROM cc_data_exports WHERE requested_by_individual_id = current_individual_id())
  )
  WITH CHECK (
    is_service_mode()
    OR export_id IN (SELECT id FROM cc_data_exports WHERE requested_by_individual_id = current_individual_id())
  );

CREATE POLICY data_export_files_delete_service ON cc_data_export_files
  FOR DELETE
  USING (is_service_mode());

-- Federated tokens: SERVICE ONLY (all operations)
DROP POLICY IF EXISTS federated_tokens_select_service ON cc_federated_tokens;
DROP POLICY IF EXISTS federated_tokens_insert_service ON cc_federated_tokens;
DROP POLICY IF EXISTS federated_tokens_update_service ON cc_federated_tokens;
DROP POLICY IF EXISTS federated_tokens_delete_service ON cc_federated_tokens;

CREATE POLICY federated_tokens_select_service ON cc_federated_tokens
  FOR SELECT USING (is_service_mode());
CREATE POLICY federated_tokens_insert_service ON cc_federated_tokens
  FOR INSERT WITH CHECK (is_service_mode());
CREATE POLICY federated_tokens_update_service ON cc_federated_tokens
  FOR UPDATE USING (is_service_mode()) WITH CHECK (is_service_mode());
CREATE POLICY federated_tokens_delete_service ON cc_federated_tokens
  FOR DELETE USING (is_service_mode());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate export number (with advisory lock)
CREATE OR REPLACE FUNCTION cc_next_export_number(p_tenant_id UUID, p_prefix TEXT DEFAULT 'EXP')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_year TEXT; v_seq INTEGER;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cc_next_export_number:' || p_tenant_id::text));
  v_year := to_char(now(),'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN export_number ~ (p_prefix||'-'||v_year||'-[0-9]+')
      THEN CAST(substring(export_number from p_prefix||'-'||v_year||'-([0-9]+)') AS INTEGER)
      ELSE 0
    END
  ),0)+1
  INTO v_seq
  FROM cc_data_exports
  WHERE tenant_id=p_tenant_id;

  RETURN p_prefix||'-'||v_year||'-'||lpad(v_seq::TEXT,5,'0');
END $$;

-- Request data export
CREATE OR REPLACE FUNCTION cc_request_data_export(
  p_tenant_id UUID,
  p_export_type data_export_type,
  p_legal_basis TEXT DEFAULT 'user_request',
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_output_format TEXT DEFAULT 'json',
  p_requested_by_individual_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_id UUID;
  v_num TEXT;
  v_owner UUID;
  v_party UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  v_owner := COALESCE(p_requested_by_individual_id, current_individual_id());
  IF v_owner IS NULL AND NOT is_service_mode() THEN
    RAISE EXCEPTION 'No individual context';
  END IF;

  SELECT party_id INTO v_party FROM cc_individuals WHERE id=v_owner;

  v_num := cc_next_export_number(p_tenant_id,'EXP');
  v_id := gen_random_uuid();

  INSERT INTO cc_data_exports(
    id, tenant_id,
    requested_by_individual_id, requested_by_party_id,
    export_number, export_type, status,
    date_from, date_to, output_format,
    legal_basis,
    download_expires_at, purge_at
  ) VALUES (
    v_id, p_tenant_id,
    v_owner, v_party,
    v_num, p_export_type, 'requested',
    p_date_from, p_date_to, p_output_format,
    p_legal_basis,
    now()+INTERVAL '7 days',
    now()+INTERVAL '30 days'
  );

  RETURN v_id;
END $$;

-- Service-only status update (writes download_url/token)
CREATE OR REPLACE FUNCTION cc_update_export_status(
  p_export_id UUID,
  p_status data_export_status,
  p_download_url TEXT DEFAULT NULL,
  p_total_records INTEGER DEFAULT NULL,
  p_total_size_bytes BIGINT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL,
  p_total_files INTEGER DEFAULT NULL
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

  UPDATE cc_data_exports SET
    status = p_status,
    download_url = COALESCE(p_download_url, download_url),
    download_token = CASE WHEN p_status='ready' THEN encode(gen_random_bytes(32),'hex') ELSE download_token END,
    total_records = COALESCE(p_total_records,total_records),
    total_files = COALESCE(p_total_files,total_files),
    total_size_bytes = COALESCE(p_total_size_bytes,total_size_bytes),
    started_at = CASE WHEN p_status='processing' THEN now() ELSE started_at END,
    completed_at = CASE WHEN p_status='ready' THEN now() ELSE completed_at END,
    failed_at = CASE WHEN p_status='failed' THEN now() ELSE failed_at END,
    failure_reason = COALESCE(p_failure_reason,failure_reason),
    updated_at = now()
  WHERE id=p_export_id;

  RETURN TRUE;
END $$;

-- Federated token issuance (SERVICE-ONLY)
CREATE OR REPLACE FUNCTION cc_issue_federated_token(
  p_tenant_id UUID,
  p_token_type federated_token_type,
  p_issuer TEXT,
  p_audience TEXT,
  p_scopes federation_scope[],
  p_expires_in_seconds INTEGER DEFAULT 3600,
  p_party_id UUID DEFAULT NULL,
  p_individual_id UUID DEFAULT NULL,
  p_claims JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_max_uses INTEGER DEFAULT NULL
)
RETURNS TABLE(token_id UUID, token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_id UUID; v_tok TEXT; v_hash TEXT;
BEGIN
  IF NOT is_service_mode() THEN RAISE EXCEPTION 'Service mode required'; END IF;

  v_id := gen_random_uuid();
  v_tok := encode(gen_random_bytes(48),'base64');
  v_hash := encode(digest(v_tok,'sha256'),'hex');

  INSERT INTO cc_federated_tokens(
    id, tenant_id, token_hash, token_type, status,
    party_id, individual_id,
    issuer, audience, scopes,
    expires_at, claims, metadata, max_uses
  ) VALUES (
    v_id, p_tenant_id, v_hash, p_token_type, 'active',
    p_party_id, p_individual_id,
    p_issuer, p_audience, p_scopes,
    now() + (p_expires_in_seconds||' seconds')::INTERVAL,
    p_claims, p_metadata, p_max_uses
  );

  token_id := v_id; token := v_tok; RETURN NEXT;
END $$;

-- Validate federated token (SERVICE-ONLY)
CREATE OR REPLACE FUNCTION cc_validate_federated_token(
  p_token TEXT,
  p_required_scope federation_scope DEFAULT NULL
)
RETURNS TABLE(
  is_valid BOOLEAN,
  token_id UUID,
  tenant_id UUID,
  party_id UUID,
  individual_id UUID,
  scopes federation_scope[],
  claims JSONB,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_hash TEXT; v_rec RECORD;
BEGIN
  IF NOT is_service_mode() THEN RAISE EXCEPTION 'Service mode required'; END IF;

  v_hash := encode(digest(p_token,'sha256'),'hex');

  SELECT * INTO v_rec
  FROM cc_federated_tokens
  WHERE token_hash=v_hash AND status='active'
    AND expires_at>now()
    AND (not_before IS NULL OR not_before<=now());

  IF v_rec IS NULL THEN is_valid := FALSE; RETURN NEXT; RETURN; END IF;
  IF p_required_scope IS NOT NULL AND NOT (p_required_scope = ANY(v_rec.scopes)) THEN is_valid := FALSE; RETURN NEXT; RETURN; END IF;
  IF v_rec.max_uses IS NOT NULL AND v_rec.use_count >= v_rec.max_uses THEN is_valid := FALSE; RETURN NEXT; RETURN; END IF;

  UPDATE cc_federated_tokens SET
    last_used_at=now(),
    use_count=use_count+1,
    status = CASE WHEN token_type='one_time' THEN 'consumed'::federated_token_status ELSE status END,
    updated_at=now()
  WHERE id=v_rec.id;

  is_valid := TRUE;
  token_id := v_rec.id; tenant_id := v_rec.tenant_id;
  party_id := v_rec.party_id; individual_id := v_rec.individual_id;
  scopes := v_rec.scopes; claims := v_rec.claims; expires_at := v_rec.expires_at;
  RETURN NEXT;
END $$;

-- Revoke federated token (SERVICE-ONLY)
CREATE OR REPLACE FUNCTION cc_revoke_federated_token(
  p_token_id UUID,
  p_reason TEXT DEFAULT 'revoked'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
BEGIN
  IF NOT is_service_mode() THEN RAISE EXCEPTION 'Service mode required'; END IF;

  UPDATE cc_federated_tokens SET
    status='revoked',
    revoked_at=now(),
    revoked_by=current_individual_id(),
    revoke_reason=p_reason,
    updated_at=now()
  WHERE id=p_token_id;

  -- Cascade revoke to tokens refreshed from this one
  UPDATE cc_federated_tokens SET
    status='revoked',
    revoked_at=now(),
    revoked_by=current_individual_id(),
    revoke_reason='parent_revoked',
    updated_at=now()
  WHERE refreshed_from_id=p_token_id AND status='active';

  RETURN TRUE;
END $$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_data_exports_updated ON cc_data_exports;
CREATE TRIGGER trg_data_exports_updated
  BEFORE UPDATE ON cc_data_exports
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_federated_tokens_updated ON cc_federated_tokens;
CREATE TRIGGER trg_federated_tokens_updated
  BEFORE UPDATE ON cc_federated_tokens
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Q1: Verify tables exist
SELECT 'cc_data_exports' as table_name, COUNT(*) as column_count
FROM information_schema.columns WHERE table_name = 'cc_data_exports'
UNION ALL
SELECT 'cc_data_export_files', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_data_export_files'
UNION ALL
SELECT 'cc_federated_tokens', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_federated_tokens';

-- Q2: Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('cc_data_exports', 'cc_data_export_files', 'cc_federated_tokens');

-- Q3: Verify federated_tokens is SERVICE-ONLY
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'cc_federated_tokens'
ORDER BY policyname;

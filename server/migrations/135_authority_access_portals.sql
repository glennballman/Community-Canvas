-- P2.9 Authority / Adjuster Read-Only Portals
-- Migration 135: Authority access grants, scopes, tokens, and events

-- ============================================================
-- 1. cc_authority_access_grants
-- A grant = a scoped share configuration for external parties
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_authority_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  circle_id uuid NULL REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  portal_id uuid NULL REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  grant_type text NOT NULL CHECK (grant_type IN ('adjuster', 'insurer', 'regulator', 'legal', 'contractor_third_party', 'generic')),
  title text NOT NULL,
  description text NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  revoked_at timestamptz NULL,
  revoked_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  revoke_reason text NULL,
  
  expires_at timestamptz NOT NULL,
  max_views int NULL,
  
  require_passcode boolean NOT NULL DEFAULT false,
  passcode_hash text NULL,
  
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_authority_grants_tenant_created 
  ON cc_authority_access_grants(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_authority_grants_tenant_status 
  ON cc_authority_access_grants(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_grants_client_request 
  ON cc_authority_access_grants(tenant_id, client_request_id) 
  WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 2. cc_authority_access_scopes
-- Join table to define what the grant can access
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_authority_access_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES cc_authority_access_grants(id) ON DELETE CASCADE,
  
  scope_type text NOT NULL CHECK (scope_type IN ('evidence_bundle', 'claim', 'claim_dossier', 'evidence_object')),
  scope_id uuid NOT NULL,
  
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  label text NULL,
  notes text NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_scopes_unique 
  ON cc_authority_access_scopes(tenant_id, grant_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_authority_scopes_type_id 
  ON cc_authority_access_scopes(tenant_id, scope_type, scope_id);

-- ============================================================
-- 3. cc_authority_access_tokens
-- Tokens that power public read-only access
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_authority_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES cc_authority_access_grants(id) ON DELETE CASCADE,
  
  token_hash text NOT NULL,
  
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  last_accessed_at timestamptz NULL,
  access_count int NOT NULL DEFAULT 0,
  
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  revoked_at timestamptz NULL,
  revoked_by_individual_id uuid NULL REFERENCES cc_individuals(id) ON DELETE SET NULL,
  revoke_reason text NULL,
  
  expires_at timestamptz NOT NULL,
  
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_tokens_hash 
  ON cc_authority_access_tokens(tenant_id, token_hash);
CREATE INDEX IF NOT EXISTS idx_authority_tokens_grant 
  ON cc_authority_access_tokens(tenant_id, grant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_tokens_client_request 
  ON cc_authority_access_tokens(tenant_id, client_request_id) 
  WHERE client_request_id IS NOT NULL;

-- ============================================================
-- 4. cc_authority_access_events
-- Append-only audit log for all authority access
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_authority_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL,
  token_id uuid NULL,
  
  event_type text NOT NULL CHECK (event_type IN (
    'token_issued', 'token_revoked', 'grant_revoked',
    'access_allowed', 'access_denied', 'passcode_failed',
    'rate_limited', 'download_issued'
  )),
  
  event_at timestamptz NOT NULL DEFAULT now(),
  ip text NULL,
  user_agent text NULL,
  path text NULL,
  
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_authority_events_grant 
  ON cc_authority_access_events(tenant_id, grant_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_authority_events_token 
  ON cc_authority_access_events(tenant_id, token_id, event_at DESC);

-- ============================================================
-- Append-only trigger for events table
-- ============================================================

CREATE OR REPLACE FUNCTION cc_authority_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AUTHORITY_EVENTS_IMMUTABLE: Cannot modify or delete authority access events';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_authority_events_append_only ON cc_authority_access_events;
CREATE TRIGGER trg_authority_events_append_only
  BEFORE UPDATE OR DELETE ON cc_authority_access_events
  FOR EACH ROW
  EXECUTE FUNCTION cc_authority_events_immutable();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE cc_authority_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_authority_access_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_authority_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_authority_access_events ENABLE ROW LEVEL SECURITY;

-- Force RLS on events table (append-only)
ALTER TABLE cc_authority_access_events FORCE ROW LEVEL SECURITY;

-- Grants: tenant members can manage
DROP POLICY IF EXISTS grants_tenant_access ON cc_authority_access_grants;
CREATE POLICY grants_tenant_access ON cc_authority_access_grants
  FOR ALL
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Scopes: tenant members can manage
DROP POLICY IF EXISTS scopes_tenant_access ON cc_authority_access_scopes;
CREATE POLICY scopes_tenant_access ON cc_authority_access_scopes
  FOR ALL
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Tokens: tenant members can manage
DROP POLICY IF EXISTS tokens_tenant_access ON cc_authority_access_tokens;
CREATE POLICY tokens_tenant_access ON cc_authority_access_tokens
  FOR ALL
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Events: insert-only in service mode, read by tenant
DROP POLICY IF EXISTS events_insert_service ON cc_authority_access_events;
CREATE POLICY events_insert_service ON cc_authority_access_events
  FOR INSERT
  WITH CHECK (is_service_mode());

DROP POLICY IF EXISTS events_select_tenant ON cc_authority_access_events;
CREATE POLICY events_select_tenant ON cc_authority_access_events
  FOR SELECT
  USING (
    is_service_mode() OR 
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- ============================================================
-- SECURITY DEFINER Functions for Public Read Access
-- ============================================================

-- Validate token and return access info
CREATE OR REPLACE FUNCTION cc_authority_validate_token(
  p_token text,
  p_passcode text DEFAULT NULL
)
RETURNS TABLE (
  ok boolean,
  tenant_id uuid,
  grant_id uuid,
  token_id uuid,
  expires_at timestamptz,
  scopes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_token_row RECORD;
  v_grant_row RECORD;
  v_now timestamptz := now();
  v_scopes jsonb;
BEGIN
  -- Compute token hash
  v_token_hash := encode(sha256(p_token::bytea), 'hex');
  
  -- Find token (don't leak existence)
  SELECT t.*, g.tenant_id as g_tenant_id, g.status as g_status, 
         g.expires_at as g_expires_at, g.max_views as g_max_views,
         g.require_passcode, g.passcode_hash
  INTO v_token_row
  FROM cc_authority_access_tokens t
  JOIN cc_authority_access_grants g ON g.id = t.grant_id
  WHERE t.token_hash = v_token_hash
  LIMIT 1;
  
  -- Token not found
  IF v_token_row IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check token status
  IF v_token_row.status != 'active' THEN
    -- Log access denied
    INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
    VALUES (v_token_row.g_tenant_id, v_token_row.grant_id, v_token_row.id, 'access_denied', 
            jsonb_build_object('reason', 'token_' || v_token_row.status));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check grant status
  IF v_token_row.g_status != 'active' THEN
    INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
    VALUES (v_token_row.g_tenant_id, v_token_row.grant_id, v_token_row.id, 'access_denied',
            jsonb_build_object('reason', 'grant_' || v_token_row.g_status));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check expiry (use earlier of token or grant expiry)
  IF v_token_row.expires_at < v_now OR v_token_row.g_expires_at < v_now THEN
    -- Auto-expire token
    UPDATE cc_authority_access_tokens SET status = 'expired' WHERE id = v_token_row.id;
    INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
    VALUES (v_token_row.g_tenant_id, v_token_row.grant_id, v_token_row.id, 'access_denied',
            jsonb_build_object('reason', 'expired'));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check max views
  IF v_token_row.g_max_views IS NOT NULL AND v_token_row.access_count >= v_token_row.g_max_views THEN
    INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
    VALUES (v_token_row.g_tenant_id, v_token_row.grant_id, v_token_row.id, 'access_denied',
            jsonb_build_object('reason', 'max_views_exceeded'));
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check passcode if required
  IF v_token_row.require_passcode THEN
    IF p_passcode IS NULL OR 
       v_token_row.passcode_hash IS NULL OR
       v_token_row.passcode_hash != crypt(p_passcode, v_token_row.passcode_hash) THEN
      INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
      VALUES (v_token_row.g_tenant_id, v_token_row.grant_id, v_token_row.id, 'passcode_failed', '{}'::jsonb);
      RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::jsonb;
      RETURN;
    END IF;
  END IF;
  
  -- Get scopes
  SELECT jsonb_agg(jsonb_build_object('scope_type', s.scope_type, 'scope_id', s.scope_id, 'label', s.label))
  INTO v_scopes
  FROM cc_authority_access_scopes s
  WHERE s.grant_id = v_token_row.grant_id;
  
  -- Update access tracking
  UPDATE cc_authority_access_tokens 
  SET access_count = access_count + 1,
      last_accessed_at = v_now
  WHERE id = v_token_row.id;
  
  -- Log access allowed
  INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
  VALUES (v_token_row.g_tenant_id, v_token_row.grant_id, v_token_row.id, 'access_allowed', '{}'::jsonb);
  
  -- Return success
  RETURN QUERY SELECT 
    true,
    v_token_row.g_tenant_id,
    v_token_row.grant_id,
    v_token_row.id,
    LEAST(v_token_row.expires_at, v_token_row.g_expires_at),
    COALESCE(v_scopes, '[]'::jsonb);
END;
$$;

-- Check if scope is allowed for a grant
CREATE OR REPLACE FUNCTION cc_authority_check_scope(
  p_tenant_id uuid,
  p_grant_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cc_authority_access_scopes
    WHERE tenant_id = p_tenant_id
      AND grant_id = p_grant_id
      AND scope_type = p_scope_type
      AND scope_id = p_scope_id
  );
END;
$$;

-- Get bundle manifest (only if scoped)
CREATE OR REPLACE FUNCTION cc_authority_get_bundle_manifest(
  p_tenant_id uuid,
  p_grant_id uuid,
  p_bundle_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  bundle_type text,
  chain_status text,
  sealed_at timestamptz,
  manifest_json jsonb,
  manifest_sha256 text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check scope
  IF NOT cc_authority_check_scope(p_tenant_id, p_grant_id, 'evidence_bundle', p_bundle_id) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT b.id, b.title, b.bundle_type, b.chain_status, b.sealed_at,
         b.manifest_json, b.manifest_sha256, b.metadata
  FROM cc_evidence_bundles b
  WHERE b.id = p_bundle_id AND b.tenant_id = p_tenant_id;
END;
$$;

-- Get dossier (only if scoped)
CREATE OR REPLACE FUNCTION cc_authority_get_dossier(
  p_tenant_id uuid,
  p_grant_id uuid,
  p_dossier_id uuid
)
RETURNS TABLE (
  id uuid,
  claim_id uuid,
  version int,
  dossier_json jsonb,
  dossier_sha256 text,
  assembled_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check scope
  IF NOT cc_authority_check_scope(p_tenant_id, p_grant_id, 'claim_dossier', p_dossier_id) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT d.id, d.claim_id, d.version, d.dossier_json, d.dossier_sha256,
         d.assembled_at, d.metadata
  FROM cc_claim_dossiers d
  WHERE d.id = p_dossier_id AND d.tenant_id = p_tenant_id;
END;
$$;

-- Get evidence object summary (only if scoped)
CREATE OR REPLACE FUNCTION cc_authority_get_evidence_object_summary(
  p_tenant_id uuid,
  p_grant_id uuid,
  p_evidence_id uuid
)
RETURNS TABLE (
  id uuid,
  source_type text,
  title text,
  occurred_at timestamptz,
  created_at timestamptz,
  captured_at timestamptz,
  content_mime text,
  content_bytes bigint,
  content_sha256 text,
  r2_key text,
  url text,
  chain_status text,
  sealed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check scope (direct or via bundle/claim)
  IF NOT (
    cc_authority_check_scope(p_tenant_id, p_grant_id, 'evidence_object', p_evidence_id)
    OR EXISTS (
      SELECT 1 FROM cc_evidence_bundle_items bi
      JOIN cc_authority_access_scopes s ON s.scope_id = bi.bundle_id AND s.scope_type = 'evidence_bundle'
      WHERE bi.evidence_object_id = p_evidence_id
        AND s.tenant_id = p_tenant_id AND s.grant_id = p_grant_id
    )
    OR EXISTS (
      SELECT 1 FROM cc_claim_inputs ci
      JOIN cc_authority_access_scopes s ON s.scope_id = ci.claim_id AND s.scope_type = 'claim'
      WHERE ci.evidence_object_id = p_evidence_id
        AND s.tenant_id = p_tenant_id AND s.grant_id = p_grant_id
    )
  ) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT e.id, e.source_type::text, e.title, e.occurred_at, e.created_at, e.captured_at,
         e.content_mime, e.content_bytes, e.content_sha256,
         e.r2_key, e.url, e.chain_status::text, e.sealed_at
  FROM cc_evidence_objects e
  WHERE e.id = p_evidence_id AND e.tenant_id = p_tenant_id;
END;
$$;

-- List all scoped items as an index
CREATE OR REPLACE FUNCTION cc_authority_list_scope_index(
  p_tenant_id uuid,
  p_grant_id uuid
)
RETURNS TABLE (
  scope_type text,
  scope_id uuid,
  label text,
  title text,
  status text,
  sealed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Bundles
  SELECT s.scope_type, s.scope_id, s.label, b.title, b.chain_status, b.sealed_at
  FROM cc_authority_access_scopes s
  LEFT JOIN cc_evidence_bundles b ON b.id = s.scope_id AND s.scope_type = 'evidence_bundle'
  WHERE s.tenant_id = p_tenant_id AND s.grant_id = p_grant_id AND s.scope_type = 'evidence_bundle'
  
  UNION ALL
  
  -- Claims
  SELECT s.scope_type, s.scope_id, s.label, c.claim_number, c.status, NULL::timestamptz
  FROM cc_authority_access_scopes s
  LEFT JOIN cc_insurance_claims c ON c.id = s.scope_id AND s.scope_type = 'claim'
  WHERE s.tenant_id = p_tenant_id AND s.grant_id = p_grant_id AND s.scope_type = 'claim'
  
  UNION ALL
  
  -- Dossiers
  SELECT s.scope_type, s.scope_id, s.label, 
         'Dossier v' || d.version::text, 
         CASE WHEN d.exported_at IS NOT NULL THEN 'exported' ELSE 'assembled' END,
         d.assembled_at
  FROM cc_authority_access_scopes s
  LEFT JOIN cc_claim_dossiers d ON d.id = s.scope_id AND s.scope_type = 'claim_dossier'
  WHERE s.tenant_id = p_tenant_id AND s.grant_id = p_grant_id AND s.scope_type = 'claim_dossier'
  
  UNION ALL
  
  -- Evidence objects
  SELECT s.scope_type, s.scope_id, s.label, e.title, e.chain_status::text, e.sealed_at
  FROM cc_authority_access_scopes s
  LEFT JOIN cc_evidence_objects e ON e.id = s.scope_id AND s.scope_type = 'evidence_object'
  WHERE s.tenant_id = p_tenant_id AND s.grant_id = p_grant_id AND s.scope_type = 'evidence_object';
END;
$$;

-- Log authority event (for application layer)
CREATE OR REPLACE FUNCTION cc_authority_log_event(
  p_tenant_id uuid,
  p_grant_id uuid,
  p_token_id uuid,
  p_event_type text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_path text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO cc_authority_access_events (
    tenant_id, grant_id, token_id, event_type, ip, user_agent, path, event_payload
  ) VALUES (
    p_tenant_id, p_grant_id, p_token_id, p_event_type, p_ip, p_user_agent, p_path, p_payload
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

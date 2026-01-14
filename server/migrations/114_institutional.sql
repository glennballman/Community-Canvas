-- ============================================================================
-- MIGRATION H v2 (DROP-IN): INSTITUTIONAL
-- Tables: cc_ai_suggestions, cc_external_records, cc_gov_connectors, cc_audit_trail
-- Run order: FIRST (1 of 4)
--
-- Wallet-era hardening:
--   - cc_audit_trail is APPEND-ONLY: UPDATE/DELETE denied
--   - tenant_id NULL rows are SERVICE-ONLY
--   - SECURITY DEFINER functions set search_path = public, pg_temp and row_security = on
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

-- Helper: get current individual id
CREATE OR REPLACE FUNCTION current_individual_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE v UUID;
BEGIN
  BEGIN
    v := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN others THEN
    v := NULL;
  END;
  RETURN v;
END;
$$;

-- ============================================================================
-- ENUMS (Idempotent Creation)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE ai_suggestion_status AS ENUM (
        'pending',
        'accepted',
        'rejected',
        'expired',
        'implemented'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_suggestion_type AS ENUM (
        'job_match',
        'price_optimization',
        'schedule_optimization',
        'maintenance_alert',
        'demand_forecast',
        'resource_allocation',
        'risk_alert',
        'compliance_reminder',
        'content_recommendation',
        'workflow_automation'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE external_record_status AS ENUM (
        'pending_sync',
        'synced',
        'sync_failed',
        'stale',
        'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE gov_connector_status AS ENUM (
        'draft',
        'configured',
        'testing',
        'active',
        'suspended',
        'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action_type AS ENUM (
        'create',
        'read',
        'update',
        'delete',
        'login',
        'logout',
        'export',
        'import',
        'approve',
        'reject',
        'escalate',
        'delegate',
        'revoke',
        'system'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: cc_ai_suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    target_party_id UUID REFERENCES cc_parties(id),
    target_individual_id UUID REFERENCES cc_individuals(id),
    target_role TEXT,
    
    suggestion_type ai_suggestion_type NOT NULL,
    status ai_suggestion_status NOT NULL DEFAULT 'pending',
    
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reasoning TEXT,
    
    confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
    priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
    
    subject_type TEXT,
    subject_id UUID,
    related_ids UUID[],
    
    suggested_action TEXT,
    action_url TEXT,
    action_params JSONB,
    
    estimated_value_cents INTEGER,
    estimated_savings_cents INTEGER,
    
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES cc_individuals(id),
    response_notes TEXT,
    
    implemented_at TIMESTAMPTZ,
    implementation_result JSONB,
    
    model_id TEXT,
    model_version TEXT,
    prompt_hash TEXT,
    
    was_helpful BOOLEAN,
    feedback_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_tenant ON cc_ai_suggestions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_target ON cc_ai_suggestions(target_party_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON cc_ai_suggestions(suggestion_type, priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending ON cc_ai_suggestions(tenant_id, created_at) 
    WHERE status = 'pending';

-- ============================================================================
-- TABLE: cc_external_records
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_external_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT,
    
    local_table TEXT NOT NULL,
    local_id UUID NOT NULL,
    
    status external_record_status NOT NULL DEFAULT 'pending_sync',
    
    external_data JSONB NOT NULL,
    external_data_hash TEXT,
    
    first_synced_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    last_sync_attempt_at TIMESTAMPTZ,
    sync_error TEXT,
    sync_attempts INTEGER DEFAULT 0,
    next_sync_at TIMESTAMPTZ,
    
    data_quality_score INTEGER CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
    validation_errors TEXT[],
    
    provenance JSONB,
    certified_at TIMESTAMPTZ,
    certified_by TEXT,
    
    version INTEGER DEFAULT 1,
    previous_data JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_external_record UNIQUE (tenant_id, source_system, source_id)
);

CREATE INDEX IF NOT EXISTS idx_external_records_tenant ON cc_external_records(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_external_records_source ON cc_external_records(source_system, source_id);
CREATE INDEX IF NOT EXISTS idx_external_records_local ON cc_external_records(local_table, local_id);

-- ============================================================================
-- TABLE: cc_gov_connectors
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_gov_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    status gov_connector_status NOT NULL DEFAULT 'draft',
    
    api_base_url TEXT,
    api_version TEXT,
    auth_type TEXT,
    auth_config JSONB,
    
    data_types TEXT[],
    sync_direction TEXT DEFAULT 'pull',
    
    sync_enabled BOOLEAN DEFAULT FALSE,
    sync_interval_minutes INTEGER DEFAULT 1440,
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    
    health_status TEXT DEFAULT 'unknown',
    last_health_check_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    
    rate_limit_requests INTEGER,
    rate_limit_window_seconds INTEGER,
    current_request_count INTEGER DEFAULT 0,
    rate_limit_reset_at TIMESTAMPTZ,
    
    supported_operations TEXT[],
    data_mapping JSONB,
    
    admin_contact_email TEXT,
    support_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    
    CONSTRAINT uq_gov_connector_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gov_connectors_tenant ON cc_gov_connectors(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_gov_connectors_sync ON cc_gov_connectors(next_sync_at) 
    WHERE sync_enabled = TRUE AND status = 'active';

-- ============================================================================
-- TABLE: cc_audit_trail (APPEND-ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
    
    action_type audit_action_type NOT NULL,
    action_category TEXT,
    action_description TEXT NOT NULL,
    
    actor_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
    actor_party_id UUID REFERENCES cc_parties(id) ON DELETE SET NULL,
    actor_role TEXT,
    actor_ip TEXT,
    actor_user_agent TEXT,
    
    target_type TEXT,
    target_id UUID,
    target_table TEXT,
    
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    request_id TEXT,
    session_id TEXT,
    api_endpoint TEXT,
    
    severity TEXT DEFAULT 'info',
    is_sensitive BOOLEAN DEFAULT FALSE,
    
    retention_days INTEGER DEFAULT 365,
    purge_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant ON cc_audit_trail(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_actor ON cc_audit_trail(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_trail_target ON cc_audit_trail(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON cc_audit_trail(action_type, action_category);
CREATE INDEX IF NOT EXISTS idx_audit_trail_request ON cc_audit_trail(request_id) WHERE request_id IS NOT NULL;

-- ============================================================================
-- RLS POLICIES (HARDENED)
-- ============================================================================

ALTER TABLE cc_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_external_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_gov_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_audit_trail ENABLE ROW LEVEL SECURITY;

-- AI Suggestions: Tenant isolation
DROP POLICY IF EXISTS ai_suggestions_access ON cc_ai_suggestions;
CREATE POLICY ai_suggestions_access ON cc_ai_suggestions
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- External Records: Tenant isolation
DROP POLICY IF EXISTS external_records_access ON cc_external_records;
CREATE POLICY external_records_access ON cc_external_records
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Gov Connectors: Tenant isolation
DROP POLICY IF EXISTS gov_connectors_access ON cc_gov_connectors;
CREATE POLICY gov_connectors_access ON cc_gov_connectors
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- AUDIT TRAIL: APPEND-ONLY (CRITICAL)
DROP POLICY IF EXISTS audit_trail_access ON cc_audit_trail;

-- SELECT: tenant can see own, service can see all, NULL tenant = service only
CREATE POLICY audit_trail_select ON cc_audit_trail
  FOR SELECT
  USING (
    (tenant_id = current_tenant_id())
    OR (tenant_id IS NULL AND is_service_mode())
    OR is_service_mode()
  );

-- INSERT: tenant can insert own, service can insert anything
CREATE POLICY audit_trail_insert ON cc_audit_trail
  FOR INSERT
  WITH CHECK (
    (tenant_id = current_tenant_id())
    OR (tenant_id IS NULL AND is_service_mode())
    OR is_service_mode()
  );

-- UPDATE: DENIED (append-only)
CREATE POLICY audit_trail_update_deny ON cc_audit_trail
  FOR UPDATE
  USING (FALSE);

-- DELETE: DENIED (append-only)
CREATE POLICY audit_trail_delete_deny ON cc_audit_trail
  FOR DELETE
  USING (FALSE);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create AI suggestion
CREATE OR REPLACE FUNCTION cc_create_ai_suggestion(
    p_tenant_id UUID,
    p_suggestion_type ai_suggestion_type,
    p_title TEXT,
    p_description TEXT,
    p_target_party_id UUID DEFAULT NULL,
    p_confidence_score NUMERIC DEFAULT NULL,
    p_subject_type TEXT DEFAULT NULL,
    p_subject_id UUID DEFAULT NULL,
    p_estimated_value_cents INTEGER DEFAULT NULL,
    p_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_suggestion_id UUID;
BEGIN
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_suggestion_id := gen_random_uuid();
    
    INSERT INTO cc_ai_suggestions (
        id, tenant_id, suggestion_type,
        title, description,
        target_party_id, confidence_score,
        subject_type, subject_id,
        estimated_value_cents, valid_until
    ) VALUES (
        v_suggestion_id, p_tenant_id, p_suggestion_type,
        p_title, p_description,
        p_target_party_id, p_confidence_score,
        p_subject_type, p_subject_id,
        p_estimated_value_cents, p_valid_until
    );
    
    RETURN v_suggestion_id;
END;
$$;

-- Respond to AI suggestion
CREATE OR REPLACE FUNCTION cc_respond_to_ai_suggestion(
    p_suggestion_id UUID,
    p_accepted BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_suggestion RECORD;
    v_responder_id UUID;
BEGIN
    SELECT * INTO v_suggestion FROM cc_ai_suggestions WHERE id = p_suggestion_id;
    
    IF v_suggestion IS NULL THEN
        RAISE EXCEPTION 'Suggestion not found';
    END IF;
    
    IF NOT is_service_mode() AND v_suggestion.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_responder_id := current_individual_id();
    
    UPDATE cc_ai_suggestions SET
        status = CASE WHEN p_accepted THEN 'accepted' ELSE 'rejected' END,
        responded_at = now(),
        responded_by = v_responder_id,
        response_notes = p_notes,
        updated_at = now()
    WHERE id = p_suggestion_id;
    
    RETURN TRUE;
END;
$$;

-- Sync external record
CREATE OR REPLACE FUNCTION cc_sync_external_record(
    p_tenant_id UUID,
    p_source_system TEXT,
    p_source_id TEXT,
    p_local_table TEXT,
    p_local_id UUID,
    p_external_data JSONB,
    p_provenance JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_record_id UUID;
    v_data_hash TEXT;
    v_existing RECORD;
BEGIN
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_data_hash := encode(digest(p_external_data::TEXT, 'sha256'), 'hex');
    
    SELECT * INTO v_existing
    FROM cc_external_records
    WHERE tenant_id = p_tenant_id
      AND source_system = p_source_system
      AND source_id = p_source_id;
    
    IF v_existing IS NOT NULL THEN
        UPDATE cc_external_records SET
            local_id = p_local_id,
            external_data = p_external_data,
            external_data_hash = v_data_hash,
            previous_data = CASE 
                WHEN external_data_hash != v_data_hash THEN v_existing.external_data 
                ELSE previous_data 
            END,
            version = CASE 
                WHEN external_data_hash != v_data_hash THEN version + 1 
                ELSE version 
            END,
            status = 'synced',
            last_synced_at = now(),
            last_sync_attempt_at = now(),
            sync_error = NULL,
            provenance = COALESCE(p_provenance, provenance),
            updated_at = now()
        WHERE id = v_existing.id;
        
        RETURN v_existing.id;
    END IF;
    
    v_record_id := gen_random_uuid();
    
    INSERT INTO cc_external_records (
        id, tenant_id,
        source_system, source_id,
        local_table, local_id,
        external_data, external_data_hash,
        status, first_synced_at, last_synced_at, last_sync_attempt_at,
        provenance
    ) VALUES (
        v_record_id, p_tenant_id,
        p_source_system, p_source_id,
        p_local_table, p_local_id,
        p_external_data, v_data_hash,
        'synced', now(), now(), now(),
        p_provenance
    );
    
    RETURN v_record_id;
END;
$$;

-- Log audit event (HARDENED: blocks non-service NULL tenant)
CREATE OR REPLACE FUNCTION cc_log_audit_event(
    p_action_type audit_action_type,
    p_action_description TEXT,
    p_target_type TEXT DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_action_category TEXT DEFAULT 'data',
    p_severity TEXT DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_audit_id UUID;
    v_tenant_id UUID;
    v_actor_id UUID;
    v_party_id UUID;
    v_changed_fields TEXT[];
BEGIN
    -- tenant context may be absent in service workflows; allow only service to write tenant_id NULL
    BEGIN
        v_tenant_id := current_tenant_id();
    EXCEPTION WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;

    IF v_tenant_id IS NULL AND NOT is_service_mode() THEN
        RAISE EXCEPTION 'Tenant context required';
    END IF;

    v_actor_id := current_individual_id();

    IF v_actor_id IS NOT NULL THEN
        SELECT party_id INTO v_party_id FROM cc_individuals WHERE id = v_actor_id;
    ELSE
        v_party_id := NULL;
    END IF;

    IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
        v_changed_fields := ARRAY(
          SELECT key
          FROM jsonb_object_keys(p_new_values) AS key
          WHERE (p_old_values->key) IS DISTINCT FROM (p_new_values->key)
        );
    END IF;

    v_audit_id := gen_random_uuid();

    INSERT INTO cc_audit_trail (
        id, tenant_id,
        action_type, action_category, action_description,
        actor_id, actor_party_id,
        target_type, target_id,
        old_values, new_values, changed_fields,
        severity, purge_at
    ) VALUES (
        v_audit_id, v_tenant_id,
        p_action_type, p_action_category, p_action_description,
        v_actor_id, v_party_id,
        p_target_type, p_target_id,
        p_old_values, p_new_values, v_changed_fields,
        p_severity, now() + INTERVAL '365 days'
    );

    RETURN v_audit_id;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_ai_suggestions_updated ON cc_ai_suggestions;
CREATE TRIGGER trg_ai_suggestions_updated
    BEFORE UPDATE ON cc_ai_suggestions
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_external_records_updated ON cc_external_records;
CREATE TRIGGER trg_external_records_updated
    BEFORE UPDATE ON cc_external_records
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_gov_connectors_updated ON cc_gov_connectors;
CREATE TRIGGER trg_gov_connectors_updated
    BEFORE UPDATE ON cc_gov_connectors
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- NOTE: cc_audit_trail has NO update trigger - it's append-only

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Q1: Verify tables exist
SELECT 'cc_ai_suggestions' as table_name, COUNT(*) as column_count
FROM information_schema.columns WHERE table_name = 'cc_ai_suggestions'
UNION ALL
SELECT 'cc_external_records', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_external_records'
UNION ALL
SELECT 'cc_gov_connectors', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_gov_connectors'
UNION ALL
SELECT 'cc_audit_trail', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_audit_trail';

-- Q2: Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('cc_ai_suggestions', 'cc_external_records', 'cc_gov_connectors', 'cc_audit_trail');

-- Q3: Verify audit trail has append-only policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'cc_audit_trail'
ORDER BY policyname;

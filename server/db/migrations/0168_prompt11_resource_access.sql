-- ============================================================================
-- Migration 0168: PROMPT-11 Resource-Level Authorization
-- PURPOSE: Own/All enforcement with principal ownership + explicit grants
-- AUTH_CONSTITUTION.md governs; fail-closed enforcement
-- ============================================================================

-- ============================================================================
-- PART A: CC_RESOURCE_GRANTS TABLE
-- Explicit resource-level grants for sharing beyond ownership
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_resource_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES cc_principals(id) ON DELETE CASCADE,
    scope_id UUID REFERENCES cc_scopes(id) ON DELETE SET NULL,
    resource_table TEXT NOT NULL,
    resource_id UUID NOT NULL,
    capability_code TEXT REFERENCES cc_capabilities(code) ON DELETE CASCADE,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_principal_id UUID REFERENCES cc_principals(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by_principal_id UUID REFERENCES cc_principals(id) ON DELETE SET NULL,
    CONSTRAINT cc_resource_grants_unique UNIQUE (principal_id, resource_table, resource_id, capability_code)
);

CREATE INDEX IF NOT EXISTS idx_resource_grants_principal ON cc_resource_grants(principal_id);
CREATE INDEX IF NOT EXISTS idx_resource_grants_resource ON cc_resource_grants(resource_table, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_grants_valid ON cc_resource_grants(valid_from, valid_until) WHERE revoked_at IS NULL;

COMMENT ON TABLE cc_resource_grants IS 'PROMPT-11: Explicit resource-level grants beyond ownership';

-- Enable RLS on cc_resource_grants
ALTER TABLE cc_resource_grants ENABLE ROW LEVEL SECURITY;

-- Service mode bypass for cc_resource_grants
CREATE POLICY cc_resource_grants_service_bypass ON cc_resource_grants
    FOR ALL
    USING (is_service_mode())
    WITH CHECK (is_service_mode());

-- ============================================================================
-- PART B: OWNERSHIP COLUMNS ON RESOURCE TABLES
-- Add created_by_principal_id to key tables for ownership enforcement
-- ============================================================================

-- Add created_by_principal_id to cc_work_requests
ALTER TABLE cc_work_requests 
ADD COLUMN IF NOT EXISTS created_by_principal_id UUID REFERENCES cc_principals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_requests_created_by_principal 
ON cc_work_requests(created_by_principal_id);

-- Add created_by_principal_id to cc_n3_runs
ALTER TABLE cc_n3_runs 
ADD COLUMN IF NOT EXISTS created_by_principal_id UUID REFERENCES cc_principals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_n3_runs_created_by_principal 
ON cc_n3_runs(created_by_principal_id);

-- Add created_by_principal_id to cc_reservation_carts
ALTER TABLE cc_reservation_carts 
ADD COLUMN IF NOT EXISTS created_by_principal_id UUID REFERENCES cc_principals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_carts_created_by_principal 
ON cc_reservation_carts(created_by_principal_id);

-- Add created_by_principal_id to cc_pms_reservations
ALTER TABLE cc_pms_reservations 
ADD COLUMN IF NOT EXISTS created_by_principal_id UUID REFERENCES cc_principals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pms_reservations_created_by_principal 
ON cc_pms_reservations(created_by_principal_id);

-- ============================================================================
-- PART C: ENHANCED cc_can_access_resource() FUNCTION
-- Evaluates: ownership + explicit grants + scope ancestry + time bounds
-- ============================================================================

CREATE OR REPLACE FUNCTION cc_can_access_resource(
    p_effective_principal_id UUID,
    p_capability_code TEXT,
    p_scope_id UUID,
    p_resource_table TEXT,
    p_resource_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_owner_principal_id UUID;
    v_has_explicit_grant BOOLEAN := FALSE;
    v_has_capability BOOLEAN := FALSE;
    v_is_own_capability BOOLEAN;
BEGIN
    -- Fail-closed: NULL inputs → deny
    IF p_effective_principal_id IS NULL OR p_capability_code IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if this is an "own" capability pattern
    v_is_own_capability := p_capability_code LIKE '%.own.%';
    
    -- Step 1: Look up resource owner from the appropriate table
    -- Dynamic lookup based on resource_table
    IF p_resource_table = 'cc_work_requests' THEN
        SELECT created_by_principal_id INTO v_owner_principal_id
        FROM cc_work_requests WHERE id = p_resource_id;
    ELSIF p_resource_table = 'cc_n3_runs' THEN
        SELECT created_by_principal_id INTO v_owner_principal_id
        FROM cc_n3_runs WHERE id = p_resource_id;
    ELSIF p_resource_table = 'cc_reservation_carts' THEN
        SELECT created_by_principal_id INTO v_owner_principal_id
        FROM cc_reservation_carts WHERE id = p_resource_id;
    ELSIF p_resource_table = 'cc_pms_reservations' THEN
        SELECT created_by_principal_id INTO v_owner_principal_id
        FROM cc_pms_reservations WHERE id = p_resource_id;
    ELSE
        -- Unknown table - fail closed for safety-critical
        RETURN FALSE;
    END IF;
    
    -- Step 2: Check for explicit resource grant
    SELECT EXISTS (
        SELECT 1 FROM cc_resource_grants
        WHERE principal_id = p_effective_principal_id
          AND resource_table = p_resource_table
          AND resource_id = p_resource_id
          AND (capability_code IS NULL OR capability_code = p_capability_code)
          AND valid_from <= NOW()
          AND (valid_until IS NULL OR valid_until > NOW())
          AND revoked_at IS NULL
    ) INTO v_has_explicit_grant;
    
    -- Explicit grant overrides ownership requirement
    IF v_has_explicit_grant THEN
        RETURN TRUE;
    END IF;
    
    -- Step 3: Check capability via cc_has_capability
    -- For "own" capabilities, pass the owner principal for ownership check
    IF v_is_own_capability THEN
        -- Own capability requires ownership match
        IF v_owner_principal_id IS NULL THEN
            -- No owner recorded, fail closed
            RETURN FALSE;
        END IF;
        
        v_has_capability := cc_has_capability(
            p_effective_principal_id,
            p_capability_code,
            p_scope_id,
            p_resource_id,
            p_resource_table,
            v_owner_principal_id
        );
    ELSE
        -- "all" capability - no ownership requirement
        v_has_capability := cc_has_capability(
            p_effective_principal_id,
            p_capability_code,
            p_scope_id,
            p_resource_id,
            p_resource_table,
            NULL
        );
    END IF;
    
    RETURN v_has_capability;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION cc_can_access_resource IS 'PROMPT-11: Resource access with ownership + grants + scope check';

-- ============================================================================
-- PART D: Helper function for resource scope creation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_resource_scope(
    p_tenant_scope_id UUID,
    p_resource_type_code TEXT,
    p_resource_id UUID
) RETURNS UUID AS $$
DECLARE
    v_scope_id UUID;
    v_tenant_id UUID;
    v_resource_type_scope_id UUID;
    v_parent_path TEXT;
BEGIN
    -- Get tenant_id from tenant scope
    SELECT tenant_id INTO v_tenant_id FROM cc_scopes WHERE id = p_tenant_scope_id;
    IF v_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Ensure resource-type scope exists
    SELECT id, scope_path INTO v_resource_type_scope_id, v_parent_path
    FROM cc_scopes 
    WHERE scope_type = 'resource_type' 
      AND tenant_id = v_tenant_id 
      AND resource_type = p_resource_type_code;
    
    IF v_resource_type_scope_id IS NULL THEN
        -- Create resource-type scope first
        SELECT scope_path INTO v_parent_path FROM cc_scopes WHERE id = p_tenant_scope_id;
        
        INSERT INTO cc_scopes (scope_type, tenant_id, resource_type, parent_scope_id, scope_path)
        VALUES ('resource_type', v_tenant_id, p_resource_type_code, p_tenant_scope_id, 
                v_parent_path || '/type:' || p_resource_type_code)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_resource_type_scope_id;
        
        IF v_resource_type_scope_id IS NULL THEN
            SELECT id INTO v_resource_type_scope_id 
            FROM cc_scopes 
            WHERE scope_type = 'resource_type' 
              AND tenant_id = v_tenant_id 
              AND resource_type = p_resource_type_code;
        END IF;
        
        SELECT scope_path INTO v_parent_path FROM cc_scopes WHERE id = v_resource_type_scope_id;
    END IF;
    
    -- Check for existing resource scope
    SELECT id INTO v_scope_id 
    FROM cc_scopes 
    WHERE scope_type = 'resource' 
      AND tenant_id = v_tenant_id 
      AND resource_type = p_resource_type_code 
      AND resource_id = p_resource_id;
    
    IF v_scope_id IS NOT NULL THEN
        RETURN v_scope_id;
    END IF;
    
    -- Create resource scope
    INSERT INTO cc_scopes (scope_type, tenant_id, resource_type, resource_id, parent_scope_id, scope_path)
    VALUES ('resource', v_tenant_id, p_resource_type_code, p_resource_id, v_resource_type_scope_id,
            v_parent_path || '/res:' || p_resource_id::text)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_scope_id;
    
    IF v_scope_id IS NULL THEN
        SELECT id INTO v_scope_id 
        FROM cc_scopes 
        WHERE scope_type = 'resource' 
          AND tenant_id = v_tenant_id 
          AND resource_type = p_resource_type_code 
          AND resource_id = p_resource_id;
    END IF;
    
    RETURN v_scope_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_resource_scope IS 'PROMPT-11: Idempotent resource scope upsert';

-- ============================================================================
-- PART E: Backfill existing records with NULL ownership (fail-closed)
-- Records without ownership will fail "own" checks - must use explicit grants
-- ============================================================================

-- No backfill needed - NULL created_by_principal_id means:
-- - "own" capabilities will be denied (fail-closed)
-- - "all" capabilities will work if granted
-- - Explicit cc_resource_grants can override

-- ============================================================================
-- Verification queries (for testing, not run in migration)
-- ============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN ('cc_can_access_resource', 'get_or_create_resource_scope');
-- SELECT * FROM cc_resource_grants LIMIT 5;
-- SELECT column_name FROM information_schema.columns WHERE table_name IN ('cc_work_requests', 'cc_n3_runs', 'cc_reservation_carts', 'cc_pms_reservations') AND column_name = 'created_by_principal_id';

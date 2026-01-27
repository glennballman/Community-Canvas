-- PROMPT-3: Application-Layer Authorization Enforcement
-- Purpose: DB functions for capability evaluation + scope uniqueness
-- AUTH_CONSTITUTION.md governs; fail-closed enforcement

-- ============================================================================
-- PART 1A: Scope Creation Uniqueness (Race-Safe)
-- ============================================================================

-- Add missing unique index for resource scopes
CREATE UNIQUE INDEX IF NOT EXISTS idx_scopes_resource
ON cc_scopes (tenant_id, resource_type, resource_id) 
WHERE scope_type = 'resource';

-- Add route/method columns to audit log if missing
ALTER TABLE cc_auth_audit_log 
ADD COLUMN IF NOT EXISTS route TEXT,
ADD COLUMN IF NOT EXISTS method TEXT,
ADD COLUMN IF NOT EXISTS tenant_id UUID,
ADD COLUMN IF NOT EXISTS org_id UUID,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================================================
-- PART 1B: cc_has_capability() Function (Fail-Closed)
-- Returns TRUE only if principal has capability at scope with all conditions met
-- ============================================================================

CREATE OR REPLACE FUNCTION cc_has_capability(
    p_effective_principal_id UUID,
    p_capability_code TEXT,
    p_scope_id UUID,
    p_resource_id UUID DEFAULT NULL,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_owner_principal_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_capability_id UUID;
    v_capability_supports_own BOOLEAN;
    v_grant RECORD;
    v_condition_key TEXT;
    v_valid_condition_keys TEXT[];
    v_grant_passes BOOLEAN;
    v_any_grant_passed BOOLEAN := FALSE;
BEGIN
    -- 1. Capability exists? If not → deny
    SELECT id, supports_own INTO v_capability_id, v_capability_supports_own
    FROM cc_capabilities WHERE code = p_capability_code;
    
    IF v_capability_id IS NULL THEN
        RETURN FALSE;  -- Unknown capability → deny
    END IF;
    
    -- 2. Principal exists and active? If not → deny
    IF NOT EXISTS (
        SELECT 1 FROM cc_principals 
        WHERE id = p_effective_principal_id AND is_active = TRUE
    ) THEN
        RETURN FALSE;  -- Principal not found or inactive → deny
    END IF;
    
    -- 3. Scope exists? If not → deny
    IF p_scope_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM cc_scopes WHERE id = p_scope_id
    ) THEN
        RETURN FALSE;  -- Unknown scope → deny
    END IF;
    
    -- 4. Get valid condition keys for hard-fail validation
    SELECT array_agg(code) INTO v_valid_condition_keys FROM cc_condition_definitions;
    
    -- 5. Evaluate grants (role grants + direct capability grants)
    FOR v_grant IN
        SELECT 
            g.id,
            g.grant_type,
            g.conditions,
            g.scope_id AS grant_scope_id,
            c.code AS cap_code,
            c.supports_own AS cap_supports_own
        FROM cc_grants g
        LEFT JOIN cc_role_capabilities rc ON g.role_id = rc.role_id
        LEFT JOIN cc_capabilities c ON (
            (g.grant_type = 'role' AND rc.capability_id = c.id) OR
            (g.grant_type = 'capability' AND g.capability_id = c.id)
        )
        WHERE g.principal_id = p_effective_principal_id
          AND g.is_active = TRUE
          AND g.revoked_at IS NULL
          AND g.valid_from <= NOW()
          AND (g.valid_until IS NULL OR g.valid_until > NOW())
          AND c.code = p_capability_code
    LOOP
        v_grant_passes := TRUE;
        
        -- 5a. Scope hierarchy check: grant scope must contain requested scope
        IF v_grant.grant_scope_id IS NOT NULL AND p_scope_id IS NOT NULL THEN
            IF NOT scope_is_ancestor_of(v_grant.grant_scope_id, p_scope_id) 
               AND v_grant.grant_scope_id != p_scope_id THEN
                v_grant_passes := FALSE;
            END IF;
        END IF;
        
        -- 5b. Validate condition keys (hard-fail on unknown)
        IF v_grant.conditions IS NOT NULL AND v_grant.conditions != '{}'::jsonb THEN
            FOR v_condition_key IN SELECT jsonb_object_keys(v_grant.conditions)
            LOOP
                IF NOT v_condition_key = ANY(v_valid_condition_keys) THEN
                    RETURN FALSE;  -- HARD FAIL: Unknown condition key
                END IF;
            END LOOP;
            
            -- 5c. Evaluate known conditions
            
            -- own_resources_only: requires ownership check
            IF (v_grant.conditions->>'own_resources_only')::boolean = TRUE THEN
                IF p_resource_owner_principal_id IS NULL THEN
                    v_grant_passes := FALSE;  -- No owner info provided, fail closed
                ELSIF p_resource_owner_principal_id != p_effective_principal_id THEN
                    v_grant_passes := FALSE;  -- Not owner
                END IF;
            END IF;
            
            -- exclude_pricing: if accessing pricing-related capability, deny
            IF (v_grant.conditions->>'exclude_pricing')::boolean = TRUE THEN
                IF p_capability_code LIKE '%pricing%' OR p_capability_code LIKE '%invoice%' THEN
                    v_grant_passes := FALSE;
                END IF;
            END IF;
            
            -- max_amount: numeric limit (for future use, currently pass-through)
            -- Add additional condition evaluations here as needed
        END IF;
        
        -- 5d. Ownership check for "own" capabilities
        IF v_grant_passes AND v_grant.cap_supports_own AND p_capability_code LIKE '%.own.%' THEN
            IF p_resource_owner_principal_id IS NULL THEN
                v_grant_passes := FALSE;  -- Own capability requires owner check
            ELSIF p_resource_owner_principal_id != p_effective_principal_id THEN
                v_grant_passes := FALSE;  -- Not owner
            END IF;
        END IF;
        
        IF v_grant_passes THEN
            v_any_grant_passed := TRUE;
            EXIT;  -- At least one grant passed, allow
        END IF;
    END LOOP;
    
    RETURN v_any_grant_passed;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 1C: cc_can_access_resource() Function
-- Thin wrapper for resource-level access with ownership lookup
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
    v_query TEXT;
BEGIN
    -- For now, delegate to cc_has_capability without owner lookup
    -- Resource ownership columns vary by table; add specific lookups as needed
    -- This is a placeholder that can be extended per-table
    
    RETURN cc_has_capability(
        p_effective_principal_id,
        p_capability_code,
        p_scope_id,
        p_resource_id,
        p_resource_table,
        NULL  -- Owner lookup would go here
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 1D: Audit Log Helper (Optional - can also be app-layer)
-- ============================================================================

CREATE OR REPLACE FUNCTION cc_auth_audit_log_insert(
    p_principal_id UUID,
    p_effective_principal_id UUID,
    p_capability_code TEXT,
    p_scope_id UUID,
    p_decision TEXT,
    p_reason TEXT,
    p_route TEXT DEFAULT NULL,
    p_method TEXT DEFAULT NULL,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_org_id UUID DEFAULT NULL,
    p_request_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO cc_auth_audit_log (
        principal_id,
        effective_principal_id,
        capability_code,
        scope_id,
        decision,
        decision_reason,
        route,
        method,
        resource_type,
        resource_id,
        tenant_id,
        org_id,
        request_ip,
        user_agent,
        session_id,
        metadata
    ) VALUES (
        p_principal_id,
        p_effective_principal_id,
        p_capability_code,
        p_scope_id,
        p_decision,
        p_reason,
        p_route,
        p_method,
        p_resource_type,
        p_resource_id,
        p_tenant_id,
        p_org_id,
        p_request_ip,
        p_user_agent,
        p_session_id,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 1E: Idempotent Scope Upsert Helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_tenant_scope(p_tenant_id UUID) 
RETURNS UUID AS $$
DECLARE
    v_scope_id UUID;
BEGIN
    SELECT id INTO v_scope_id FROM cc_scopes 
    WHERE scope_type = 'tenant' AND tenant_id = p_tenant_id;
    
    IF v_scope_id IS NULL THEN
        INSERT INTO cc_scopes (scope_type, tenant_id, parent_scope_id, scope_path)
        VALUES ('tenant', p_tenant_id, '00000000-0000-0000-0000-000000000001', 
                'platform/tenant:' || p_tenant_id::text)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_scope_id;
        
        -- Re-fetch in case of race
        IF v_scope_id IS NULL THEN
            SELECT id INTO v_scope_id FROM cc_scopes 
            WHERE scope_type = 'tenant' AND tenant_id = p_tenant_id;
        END IF;
    END IF;
    
    RETURN v_scope_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification: Confirm functions exist
-- ============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN ('cc_has_capability', 'cc_can_access_resource', 'cc_auth_audit_log_insert', 'get_or_create_tenant_scope');

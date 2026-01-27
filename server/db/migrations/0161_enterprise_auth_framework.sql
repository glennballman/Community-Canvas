-- ============================================================================
-- Community Canvas V3.5 - Enterprise Authorization Framework V3.1
-- Migration 161: Core Authorization Schema
-- ============================================================================

-- 1. Scope Type Enum (5-Level Hierarchy - MANDATORY)
DO $$ BEGIN
    CREATE TYPE scope_type_enum AS ENUM (
        'platform',       -- Level 0: Global singleton
        'organization',   -- Level 1: Enterprise customer
        'tenant',         -- Level 2: Single property/business
        'resource_type',  -- Level 3: Class of resources
        'resource'        -- Level 4: Specific instance
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Principal Type Enum
DO $$ BEGIN
    CREATE TYPE principal_type_enum AS ENUM (
        'user',           -- Human user
        'service',        -- API/service account
        'machine',        -- Robot/device
        'integration',    -- External system
        'system'          -- Internal system process
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Grant Type Enum
DO $$ BEGIN
    CREATE TYPE grant_type_enum AS ENUM (
        'role',           -- Bundled capabilities
        'capability',     -- Direct capability grant
        'delegation'      -- Temporary delegation
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Principals Table (Single Actor Abstraction)
CREATE TABLE IF NOT EXISTS cc_principals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_type principal_type_enum NOT NULL,
    
    -- Link to existing identity (one of these is set)
    user_id UUID REFERENCES cc_individuals(id),
    tenant_id UUID REFERENCES cc_tenants(id),
    
    -- For services/machines
    service_name TEXT,
    machine_serial TEXT,
    integration_name TEXT,
    
    -- Metadata
    display_name TEXT NOT NULL,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Multi-factor auth
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one identity reference per principal
    CONSTRAINT principal_identity_check CHECK (
        (principal_type = 'user' AND user_id IS NOT NULL) OR
        (principal_type = 'service' AND service_name IS NOT NULL) OR
        (principal_type = 'machine' AND machine_serial IS NOT NULL) OR
        (principal_type = 'integration' AND integration_name IS NOT NULL) OR
        (principal_type = 'system' AND service_name IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_principals_user ON cc_principals(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_principals_service ON cc_principals(service_name) WHERE service_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_principals_machine ON cc_principals(machine_serial) WHERE machine_serial IS NOT NULL;

-- 5. Scopes Table (5-Level Hierarchy - MANDATORY)
CREATE TABLE IF NOT EXISTS cc_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type scope_type_enum NOT NULL,
    parent_scope_id UUID REFERENCES cc_scopes(id),
    
    -- Reference to entity based on type
    organization_id UUID REFERENCES cc_organizations(id),
    tenant_id UUID REFERENCES cc_tenants(id),
    resource_type TEXT,
    resource_id UUID,
    
    -- Path for display/query
    scope_path TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT scope_type_ref_check CHECK (
        (scope_type = 'platform') OR
        (scope_type = 'organization' AND organization_id IS NOT NULL) OR
        (scope_type = 'tenant' AND tenant_id IS NOT NULL) OR
        (scope_type = 'resource_type' AND tenant_id IS NOT NULL AND resource_type IS NOT NULL) OR
        (scope_type = 'resource' AND tenant_id IS NOT NULL AND resource_type IS NOT NULL AND resource_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scopes_platform ON cc_scopes(scope_type) WHERE scope_type = 'platform';
CREATE UNIQUE INDEX IF NOT EXISTS idx_scopes_org ON cc_scopes(organization_id) WHERE scope_type = 'organization';
CREATE UNIQUE INDEX IF NOT EXISTS idx_scopes_tenant ON cc_scopes(tenant_id) WHERE scope_type = 'tenant';
CREATE UNIQUE INDEX IF NOT EXISTS idx_scopes_resource_type ON cc_scopes(tenant_id, resource_type) WHERE scope_type = 'resource_type';
CREATE INDEX IF NOT EXISTS idx_scopes_parent ON cc_scopes(parent_scope_id);

-- Insert platform singleton scope
INSERT INTO cc_scopes (id, scope_type, scope_path)
VALUES ('00000000-0000-0000-0000-000000000001', 'platform', 'platform')
ON CONFLICT DO NOTHING;

-- 5b. Scope Auto-Creation Triggers (5-Level Hierarchy Support)

-- Auto-create scope for organizations (using name - slug not available in cc_organizations)
CREATE OR REPLACE FUNCTION create_scope_for_organization()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO cc_scopes (scope_type, organization_id, parent_scope_id, scope_path)
    VALUES (
        'organization', 
        NEW.id, 
        '00000000-0000-0000-0000-000000000001',
        'platform/org:' || COALESCE(NEW.name, NEW.id::text)
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_scope_for_organization ON cc_organizations;
CREATE TRIGGER trg_create_scope_for_organization
    AFTER INSERT ON cc_organizations
    FOR EACH ROW EXECUTE FUNCTION create_scope_for_organization();

-- Auto-create scope for tenants (no organization_id in current cc_tenants schema - tenants link to platform)
CREATE OR REPLACE FUNCTION create_scope_for_tenant()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO cc_scopes (scope_type, tenant_id, parent_scope_id, scope_path)
    VALUES (
        'tenant',
        NEW.id,
        '00000000-0000-0000-0000-000000000001',
        'platform/tenant:' || COALESCE(NEW.slug, NEW.name, NEW.id::text)
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_scope_for_tenant ON cc_tenants;
CREATE TRIGGER trg_create_scope_for_tenant
    AFTER INSERT ON cc_tenants
    FOR EACH ROW EXECUTE FUNCTION create_scope_for_tenant();

-- 5c. Helper Function: Get or Create Resource-Type Scope
CREATE OR REPLACE FUNCTION get_or_create_resource_type_scope(
    p_tenant_id UUID,
    p_resource_type TEXT
) RETURNS UUID AS $$
DECLARE
    v_scope_id UUID;
    v_tenant_scope_id UUID;
    v_tenant_path TEXT;
BEGIN
    SELECT id INTO v_scope_id
    FROM cc_scopes
    WHERE scope_type = 'resource_type' 
      AND tenant_id = p_tenant_id 
      AND resource_type = p_resource_type;
    
    IF v_scope_id IS NOT NULL THEN
        RETURN v_scope_id;
    END IF;
    
    SELECT id, scope_path INTO v_tenant_scope_id, v_tenant_path
    FROM cc_scopes
    WHERE scope_type = 'tenant' AND tenant_id = p_tenant_id;
    
    IF v_tenant_scope_id IS NULL THEN
        RAISE EXCEPTION 'Tenant scope not found for tenant_id %', p_tenant_id;
    END IF;
    
    INSERT INTO cc_scopes (scope_type, tenant_id, resource_type, parent_scope_id, scope_path)
    VALUES (
        'resource_type',
        p_tenant_id,
        p_resource_type,
        v_tenant_scope_id,
        v_tenant_path || '/' || p_resource_type
    )
    RETURNING id INTO v_scope_id;
    
    RETURN v_scope_id;
END;
$$ LANGUAGE plpgsql;

-- 5d. Helper Function: Get or Create Resource Scope (Level 5)
CREATE OR REPLACE FUNCTION get_or_create_resource_scope(
    p_tenant_id UUID,
    p_resource_type TEXT,
    p_resource_id UUID
) RETURNS UUID AS $$
DECLARE
    v_scope_id UUID;
    v_resource_type_scope_id UUID;
    v_resource_type_path TEXT;
BEGIN
    SELECT id INTO v_scope_id
    FROM cc_scopes
    WHERE scope_type = 'resource' 
      AND tenant_id = p_tenant_id 
      AND resource_type = p_resource_type
      AND resource_id = p_resource_id;
    
    IF v_scope_id IS NOT NULL THEN
        RETURN v_scope_id;
    END IF;
    
    v_resource_type_scope_id := get_or_create_resource_type_scope(p_tenant_id, p_resource_type);
    
    SELECT scope_path INTO v_resource_type_path
    FROM cc_scopes WHERE id = v_resource_type_scope_id;
    
    INSERT INTO cc_scopes (scope_type, tenant_id, resource_type, resource_id, parent_scope_id, scope_path)
    VALUES (
        'resource',
        p_tenant_id,
        p_resource_type,
        p_resource_id,
        v_resource_type_scope_id,
        v_resource_type_path || ':' || p_resource_id::text
    )
    RETURNING id INTO v_scope_id;
    
    RETURN v_scope_id;
END;
$$ LANGUAGE plpgsql;

-- 5e. Helper Function: Check Scope Inheritance (MANDATORY for permission resolution)
CREATE OR REPLACE FUNCTION scope_inherits_from(
    p_child_scope_id UUID,
    p_parent_scope_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_id UUID := p_child_scope_id;
BEGIN
    WHILE v_current_id IS NOT NULL LOOP
        IF v_current_id = p_parent_scope_id THEN
            RETURN TRUE;
        END IF;
        
        SELECT parent_scope_id INTO v_current_id
        FROM cc_scopes WHERE id = v_current_id;
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 5f. Backfill scopes for existing organizations (using name - slug not available)
INSERT INTO cc_scopes (scope_type, organization_id, parent_scope_id, scope_path)
SELECT 
    'organization',
    o.id,
    '00000000-0000-0000-0000-000000000001',
    'platform/org:' || COALESCE(o.name, o.id::text)
FROM cc_organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM cc_scopes s 
    WHERE s.scope_type = 'organization' AND s.organization_id = o.id
)
ON CONFLICT DO NOTHING;

-- 5g. Backfill scopes for existing tenants (tenants link directly to platform - no org relationship in current schema)
INSERT INTO cc_scopes (scope_type, tenant_id, parent_scope_id, scope_path)
SELECT 
    'tenant',
    t.id,
    '00000000-0000-0000-0000-000000000001',
    'platform/tenant:' || COALESCE(t.slug, t.name, t.id::text)
FROM cc_tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM cc_scopes s 
    WHERE s.scope_type = 'tenant' AND s.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- 6. Capabilities Table (CANONICAL DOMAINS ONLY)
CREATE TABLE IF NOT EXISTS cc_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    
    -- Ownership pattern
    supports_own BOOLEAN DEFAULT FALSE,
    
    -- Risk level for audit
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    requires_mfa BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_domain ON cc_capabilities(domain);

-- 7. Roles Table (Convenience Bundles ONLY - Never checked directly)
CREATE TABLE IF NOT EXISTS cc_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Role can be scoped to org or tenant
    organization_id UUID REFERENCES cc_organizations(id),
    tenant_id UUID REFERENCES cc_tenants(id),
    
    -- System roles cannot be modified
    is_system_role BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- External system mapping
    external_system TEXT,
    external_role_code TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT role_code_unique UNIQUE (code, organization_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_org ON cc_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON cc_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_external ON cc_roles(external_system, external_role_code);

-- 8. Role Capabilities (Roles resolve to capabilities)
CREATE TABLE IF NOT EXISTS cc_role_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES cc_roles(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES cc_capabilities(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT role_capability_unique UNIQUE (role_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_role_caps_role ON cc_role_capabilities(role_id);
CREATE INDEX IF NOT EXISTS idx_role_caps_cap ON cc_role_capabilities(capability_id);

-- 9. Grants Table
CREATE TABLE IF NOT EXISTS cc_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES cc_principals(id) ON DELETE CASCADE,
    grant_type grant_type_enum NOT NULL,
    
    -- Either role or capability (not both)
    role_id UUID REFERENCES cc_roles(id) ON DELETE CASCADE,
    capability_id UUID REFERENCES cc_capabilities(id) ON DELETE CASCADE,
    
    -- Scope of this grant (MANDATORY - used in full hierarchy walk)
    scope_id UUID NOT NULL REFERENCES cc_scopes(id),
    
    -- Time bounds
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    
    -- Conditions (JSONB with schema validation)
    conditions JSONB DEFAULT '{}',
    
    -- Grant metadata
    granted_by UUID REFERENCES cc_principals(id),
    granted_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES cc_principals(id),
    revoked_reason TEXT,
    
    CONSTRAINT grant_type_check CHECK (
        (grant_type = 'role' AND role_id IS NOT NULL AND capability_id IS NULL) OR
        (grant_type = 'capability' AND capability_id IS NOT NULL AND role_id IS NULL) OR
        (grant_type = 'delegation')
    )
);

CREATE INDEX IF NOT EXISTS idx_grants_principal ON cc_grants(principal_id);
CREATE INDEX IF NOT EXISTS idx_grants_role ON cc_grants(role_id);
CREATE INDEX IF NOT EXISTS idx_grants_capability ON cc_grants(capability_id);
CREATE INDEX IF NOT EXISTS idx_grants_scope ON cc_grants(scope_id);
CREATE INDEX IF NOT EXISTS idx_grants_active ON cc_grants(principal_id, is_active) WHERE is_active = TRUE;

-- 10. Condition Definitions Registry (Unknown keys cause HARD FAILURE)
CREATE TABLE IF NOT EXISTS cc_condition_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    value_type TEXT NOT NULL CHECK (value_type IN ('boolean', 'integer', 'string', 'string_array', 'object')),
    json_schema JSONB NOT NULL,
    example JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed canonical condition keys
INSERT INTO cc_condition_definitions (code, name, description, value_type, json_schema, example) VALUES
('own_resources_only', 'Own Resources Only', 'Restrict to resources owned by principal', 'boolean', '{"type": "boolean"}', 'true'),
('exclude_pricing', 'Exclude Pricing', 'Hide pricing information', 'boolean', '{"type": "boolean"}', 'true'),
('max_amount_cents', 'Maximum Amount', 'Maximum transaction amount in cents', 'integer', '{"type": "integer", "minimum": 0}', '100000'),
('requires_human_supervision', 'Requires Human Supervision', 'Machine requires active supervisor - MUST HARD-FAIL if unmet', 'boolean', '{"type": "boolean"}', 'true'),
('requires_safety_certification', 'Requires Safety Certification', 'Machine requires valid certification - MUST HARD-FAIL if unmet', 'boolean', '{"type": "boolean"}', 'true'),
('valid_hours', 'Valid Hours', 'Time window when capability is active', 'object', '{"type": "object", "properties": {"start": {"type": "string"}, "end": {"type": "string"}, "timezone": {"type": "string"}}}', '{"start": "09:00", "end": "17:00", "timezone": "America/Vancouver"}'),
('ip_allowlist', 'IP Allowlist', 'Restrict to specific IP addresses', 'string_array', '{"type": "array", "items": {"type": "string"}}', '["192.168.1.0/24"]')
ON CONFLICT (code) DO NOTHING;

-- 11. Condition Validation Function (Unknown keys = HARD FAILURE)
CREATE OR REPLACE FUNCTION validate_capability_conditions(p_conditions JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_key TEXT;
    v_valid_keys TEXT[];
BEGIN
    SELECT array_agg(code) INTO v_valid_keys FROM cc_condition_definitions;
    
    FOR v_key IN SELECT jsonb_object_keys(p_conditions)
    LOOP
        IF NOT v_key = ANY(v_valid_keys) THEN
            RAISE EXCEPTION 'Unknown condition key: %. Valid keys: %. See AUTH_CONSTITUTION.md.', 
                v_key, array_to_string(v_valid_keys, ', ');
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to cc_grants to validate conditions
ALTER TABLE cc_grants DROP CONSTRAINT IF EXISTS valid_conditions;
ALTER TABLE cc_grants ADD CONSTRAINT valid_conditions 
    CHECK (conditions = '{}' OR validate_capability_conditions(conditions));

-- 12. Machine Control Sessions (HARD-FAIL enforcement for machine safety)
CREATE TABLE IF NOT EXISTS cc_machine_control_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_principal_id UUID NOT NULL REFERENCES cc_principals(id),
    supervising_principal_id UUID REFERENCES cc_principals(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    machine_mode TEXT NOT NULL CHECK (machine_mode IN (
        'manual_only', 'teleop', 'supervised_autonomy', 'autonomous'
    )),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paused', 'ended', 'terminated_emergency', 'terminated_timeout'
    )),
    safety_certified BOOLEAN NOT NULL DEFAULT FALSE,
    certification_expires_at TIMESTAMPTZ,
    estop_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_sessions_active ON cc_machine_control_sessions(machine_principal_id, status) WHERE status = 'active';

-- 13. Authorization Audit Log
CREATE TABLE IF NOT EXISTS cc_auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID REFERENCES cc_principals(id),
    capability_code TEXT NOT NULL,
    scope_id UUID REFERENCES cc_scopes(id),
    resource_type TEXT,
    resource_id UUID,
    decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
    decision_reason TEXT,
    request_ip INET,
    user_agent TEXT,
    session_id UUID,
    evaluation_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_principal ON cc_auth_audit_log(principal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_capability ON cc_auth_audit_log(capability_code, created_at DESC);

-- 14. Enable RLS on all auth tables
ALTER TABLE cc_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_condition_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_machine_control_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Service bypass policies
DO $$ BEGIN
    CREATE POLICY cc_principals_service_bypass ON cc_principals FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_scopes_service_bypass ON cc_scopes FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_capabilities_service_bypass ON cc_capabilities FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_roles_service_bypass ON cc_roles FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_role_capabilities_service_bypass ON cc_role_capabilities FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_grants_service_bypass ON cc_grants FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_condition_definitions_service_bypass ON cc_condition_definitions FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_machine_control_sessions_service_bypass ON cc_machine_control_sessions FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY cc_auth_audit_log_service_bypass ON cc_auth_audit_log FOR ALL
        USING (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

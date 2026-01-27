-- PROMPT-3A: Constitutional Corrections
-- Purpose: Fix AUTH_CONSTITUTION.md violations identified in code review
-- MUST RUN BEFORE PROMPT-3 (application layer)

-- ============================================================================
-- VIOLATION 1: cc_principals.tenant_id Column (CRITICAL)
-- Problem: Creates parallel enforcement axis, violates B4 and B1
-- Principals are IDENTITY, not AUTHORIZATION. Tenant binding is via cc_grants.
-- ============================================================================

ALTER TABLE cc_principals DROP COLUMN IF EXISTS tenant_id;

-- ============================================================================
-- VIOLATION 2: Jobber Role Mapping Drift
-- Problem: tenant_admin was missing Jobber external mapping
-- LOCKED MAPPING: Admin→tenant_admin, Manager→operations_supervisor, 
--                 Dispatcher→operations_full, Worker→field_worker_full, 
--                 Limited Worker→field_worker_limited
-- ============================================================================

UPDATE cc_roles 
SET external_system = 'jobber', external_role_code = 'admin'
WHERE code = 'tenant_admin' AND is_system_role = true;

-- ============================================================================
-- VIOLATION 3: cc_organization_members Table
-- Problem: Missing org membership table for 5-level hierarchy
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES cc_organizations(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL REFERENCES cc_principals(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_member_unique UNIQUE (organization_id, principal_id)
);

ALTER TABLE cc_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_organization_members ENABLE ROW LEVEL SECURITY;

-- Service bypass policies
DROP POLICY IF EXISTS cc_organizations_service_bypass ON cc_organizations;
CREATE POLICY cc_organizations_service_bypass ON cc_organizations FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__');

DROP POLICY IF EXISTS cc_organization_members_service_bypass ON cc_organization_members;
CREATE POLICY cc_organization_members_service_bypass ON cc_organization_members FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__');

-- ============================================================================
-- VIOLATION 4: Audit Log Missing effective_principal_id
-- Problem: Must track impersonation per AUTH_CONSTITUTION G1
-- ============================================================================

ALTER TABLE cc_auth_audit_log 
ADD COLUMN IF NOT EXISTS effective_principal_id UUID REFERENCES cc_principals(id);

CREATE INDEX IF NOT EXISTS idx_auth_audit_effective_principal 
ON cc_auth_audit_log(effective_principal_id) 
WHERE effective_principal_id IS NOT NULL;

-- ============================================================================
-- VIOLATION 5: Wire tenant_admin Capabilities for Jobber Admin
-- Problem: tenant_admin was missing capability bundle
-- ============================================================================

INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT 
  (SELECT id FROM cc_roles WHERE code = 'tenant_admin' AND is_system_role = true),
  c.id
FROM cc_capabilities c
WHERE c.domain IN ('service_runs', 'projects', 'bids', 'estimates', 'people', 'team', 'analytics', 'settings', 'tenant', 'reservations')
  OR c.code LIKE '%.all.%'
  OR c.code LIKE '%.read'
  OR c.code LIKE '%.manage'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION SUMMARY (run manually to confirm)
-- ============================================================================
-- 1. cc_principals has NO tenant_id: SELECT column_name FROM information_schema.columns WHERE table_name = 'cc_principals' AND column_name = 'tenant_id';
-- 2. All 5 Jobber roles: SELECT code, external_system, external_role_code FROM cc_roles WHERE external_system = 'jobber';
-- 3. cc_organizations exists: SELECT table_name FROM information_schema.tables WHERE table_name = 'cc_organizations';
-- 4. effective_principal_id in audit: SELECT column_name FROM information_schema.columns WHERE table_name = 'cc_auth_audit_log' AND column_name = 'effective_principal_id';
-- 5. Jobber roles have caps: SELECT r.code, COUNT(rc.id) FROM cc_roles r LEFT JOIN cc_role_capabilities rc ON rc.role_id = r.id WHERE r.external_system = 'jobber' GROUP BY r.code;

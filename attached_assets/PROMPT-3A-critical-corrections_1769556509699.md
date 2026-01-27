# REPLIT PROMPT — PROMPT-3A
## Critical Constitutional Corrections (MUST RUN BEFORE PROMPT-3)

# ⚖️ AUTH WORK ORDER — CONSTITUTIONALLY BOUND (REQUIRED HEADER)

THIS PROMPT IS GOVERNED BY: `AUTH_CONSTITUTION.md`

CONFIRMATION: Your first line must be:
"ACK: AUTH_CONSTITUTION.md governs; proceeding without drift."

---

ROLE: Senior Platform Architect + Authorization Forensic Engineer
MODE: Corrective surgery — fix violations, no scope expansion
AUTHORITY: AUTH_CONSTITUTION.md is supreme

---

## PURPOSE

ChatGPT code review identified **constitutional violations** in PROMPT-2 implementation that MUST be corrected before the application layer can be built.

---

## VIOLATION 1: cc_principals.tenant_id Column (CRITICAL)

**Problem:** `cc_principals` may have a `tenant_id` column, which creates a **parallel enforcement axis** and violates:
- AUTH_CONSTITUTION B4: "No parallel enforcement sources"
- AUTH_CONSTITUTION B1: "All authorization resolves via principal_id"

**Why this is wrong:** Principals are IDENTITY, not AUTHORIZATION. A user principal can have grants in MULTIPLE tenants. Binding a principal to a single tenant defeats multi-tenancy.

**Tenant binding is via:**
- `cc_scopes` (tenant scope exists)
- `cc_grants` (principal has role/capability at that scope)
- `cc_tenant_memberships` (legacy, read-only)

**NOT via:** `cc_principals.tenant_id`

### REQUIRED FIX

```sql
-- Check if violation exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cc_principals' AND column_name = 'tenant_id';

-- If exists, DROP it (principals must not be tenant-bound)
ALTER TABLE cc_principals DROP COLUMN IF EXISTS tenant_id;

-- Verify fix
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cc_principals'
ORDER BY ordinal_position;
```

---

## VIOLATION 2: Jobber Role Mapping Drift

**Problem:** Seeded roles may not match the LOCKED Jobber mapping specification.

**LOCKED MAPPING (EXACT CODES REQUIRED):**

| Jobber Role | CC Role Code | Must Exist |
|-------------|--------------|------------|
| Admin | `tenant_admin` | ✅ |
| Manager | `operations_supervisor` | ✅ |
| Dispatcher | `operations_full` | ✅ |
| Worker | `field_worker_full` | ✅ |
| Limited Worker | `field_worker_limited` | ✅ |

### REQUIRED FIX

```sql
-- 1. Check current roles
SELECT code, name, external_system, external_role_code 
FROM cc_roles 
WHERE is_system_role = true
ORDER BY code;

-- 2. Ensure ALL required Jobber-mapped roles exist with correct codes

-- operations_supervisor (Jobber: Manager)
INSERT INTO cc_roles (code, name, description, is_system_role, external_system, external_role_code)
VALUES ('operations_supervisor', 'Operations Supervisor', 'Manages operations and team (Jobber: Manager)', true, 'jobber', 'manager')
ON CONFLICT (code, organization_id, tenant_id) DO UPDATE SET
  external_system = 'jobber',
  external_role_code = 'manager';

-- operations_full (Jobber: Dispatcher)  
INSERT INTO cc_roles (code, name, description, is_system_role, external_system, external_role_code)
VALUES ('operations_full', 'Operations Full Access', 'Full operations access (Jobber: Dispatcher)', true, 'jobber', 'dispatcher')
ON CONFLICT (code, organization_id, tenant_id) DO UPDATE SET
  external_system = 'jobber',
  external_role_code = 'dispatcher';

-- field_worker_full (Jobber: Worker)
INSERT INTO cc_roles (code, name, description, is_system_role, external_system, external_role_code)
VALUES ('field_worker_full', 'Field Worker Full', 'Full field worker access (Jobber: Worker)', true, 'jobber', 'worker')
ON CONFLICT (code, organization_id, tenant_id) DO UPDATE SET
  external_system = 'jobber',
  external_role_code = 'worker';

-- field_worker_limited (Jobber: Limited Worker)
INSERT INTO cc_roles (code, name, description, is_system_role, external_system, external_role_code)
VALUES ('field_worker_limited', 'Field Worker Limited', 'Limited field worker access (Jobber: Limited Worker)', true, 'jobber', 'limited_worker')
ON CONFLICT (code, organization_id, tenant_id) DO UPDATE SET
  external_system = 'jobber',
  external_role_code = 'limited_worker';

-- tenant_admin (Jobber: Admin) - likely already exists
UPDATE cc_roles 
SET external_system = 'jobber', external_role_code = 'admin'
WHERE code = 'tenant_admin' AND is_system_role = true;

-- 3. Verify mapping
SELECT code, name, external_system, external_role_code 
FROM cc_roles 
WHERE external_system = 'jobber'
ORDER BY code;
```

---

## VIOLATION 3: Missing cc_organizations Table

**Problem:** The 5-level scope hierarchy requires organizations, but `cc_organizations` may not exist or have scopes.

### REQUIRED FIX

```sql
-- 1. Check if cc_organizations exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'cc_organizations'
);

-- 2. Create if missing
CREATE TABLE IF NOT EXISTS cc_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create org membership table if missing
CREATE TABLE IF NOT EXISTS cc_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES cc_organizations(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL REFERENCES cc_principals(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_member_unique UNIQUE (organization_id, principal_id)
);

-- 4. Enable RLS
ALTER TABLE cc_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_organization_members ENABLE ROW LEVEL SECURITY;

-- Service bypass
CREATE POLICY IF NOT EXISTS cc_organizations_service_bypass ON cc_organizations FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__');
CREATE POLICY IF NOT EXISTS cc_organization_members_service_bypass ON cc_organization_members FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__');

-- 5. Create org scope trigger if missing
CREATE OR REPLACE FUNCTION create_scope_for_organization() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cc_scopes (scope_type, organization_id, parent_scope_id, scope_path)
  VALUES (
    'organization', 
    NEW.id, 
    '00000000-0000-0000-0000-000000000001',
    'platform/org:' || COALESCE(NEW.slug, NEW.name, NEW.id::text)
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_scope_for_organization ON cc_organizations;
CREATE TRIGGER trg_create_scope_for_organization
AFTER INSERT ON cc_organizations FOR EACH ROW
EXECUTE FUNCTION create_scope_for_organization();
```

---

## VIOLATION 4: Audit Log Missing effective_principal_id

**Problem:** Audit log must track impersonation via `effective_principal_id` per AUTH_CONSTITUTION G1.

### REQUIRED FIX

```sql
-- Add effective_principal_id if missing
ALTER TABLE cc_auth_audit_log 
ADD COLUMN IF NOT EXISTS effective_principal_id UUID REFERENCES cc_principals(id);

-- Add index for impersonation queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_effective_principal 
ON cc_auth_audit_log(effective_principal_id) 
WHERE effective_principal_id IS NOT NULL;
```

---

## VIOLATION 5: Wire Jobber Role Capabilities

**Problem:** New Jobber-mapped roles may not have capability bundles assigned.

### REQUIRED FIX

```sql
-- Wire operations_supervisor capabilities
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT 
  (SELECT id FROM cc_roles WHERE code = 'operations_supervisor'),
  c.id
FROM cc_capabilities c
WHERE c.domain IN ('service_runs', 'projects', 'bids', 'estimates', 'people', 'team', 'analytics')
  OR c.code LIKE '%.read'
ON CONFLICT DO NOTHING;

-- Wire operations_full capabilities (dispatch focus)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT 
  (SELECT id FROM cc_roles WHERE code = 'operations_full'),
  c.id
FROM cc_capabilities c
WHERE c.domain IN ('service_runs', 'projects', 'bids', 'estimates', 'people')
  OR c.code LIKE '%.read'
  OR c.code LIKE 'service_runs.%'
ON CONFLICT DO NOTHING;

-- Wire field_worker_full capabilities
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT 
  (SELECT id FROM cc_roles WHERE code = 'field_worker_full'),
  c.id
FROM cc_capabilities c
WHERE c.code LIKE '%.own.%'
  OR c.code IN ('team.own.read', 'team.own.update', 'service_runs.own.read', 'service_runs.own.complete', 'projects.own.read', 'projects.own.complete')
ON CONFLICT DO NOTHING;

-- Wire field_worker_limited capabilities (very restricted)
INSERT INTO cc_role_capabilities (role_id, capability_id)
SELECT 
  (SELECT id FROM cc_roles WHERE code = 'field_worker_limited'),
  c.id
FROM cc_capabilities c
WHERE c.code IN ('team.own.read', 'service_runs.own.read', 'service_runs.own.complete')
ON CONFLICT DO NOTHING;

-- Verify role-capability counts
SELECT r.code, COUNT(rc.id) as capability_count
FROM cc_roles r
LEFT JOIN cc_role_capabilities rc ON rc.role_id = r.id
WHERE r.is_system_role = true
GROUP BY r.code
ORDER BY r.code;
```

---

## VERIFICATION QUERIES

Run these to confirm all violations are fixed:

```sql
-- 1. cc_principals has NO tenant_id
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cc_principals' AND column_name = 'tenant_id';
-- Expected: 0 rows

-- 2. All Jobber roles exist with correct codes
SELECT code, external_system, external_role_code 
FROM cc_roles 
WHERE external_system = 'jobber'
ORDER BY code;
-- Expected: 5 rows (tenant_admin, operations_supervisor, operations_full, field_worker_full, field_worker_limited)

-- 3. cc_organizations table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'cc_organizations';
-- Expected: 1 row

-- 4. Audit log has effective_principal_id
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cc_auth_audit_log' AND column_name = 'effective_principal_id';
-- Expected: 1 row

-- 5. Jobber roles have capabilities
SELECT r.code, COUNT(rc.id) as caps
FROM cc_roles r
LEFT JOIN cc_role_capabilities rc ON rc.role_id = r.id
WHERE r.external_system = 'jobber'
GROUP BY r.code
ORDER BY r.code;
-- Expected: All roles have caps > 0
```

---

## DELIVERABLES

You MUST produce:

1. ✅ SQL output confirming `cc_principals` has no `tenant_id` column
2. ✅ SQL output showing all 5 Jobber-mapped roles with correct codes
3. ✅ SQL output confirming `cc_organizations` table exists
4. ✅ SQL output confirming `effective_principal_id` column in audit log
5. ✅ SQL output showing role-capability counts for Jobber roles

---

## SUCCESS CRITERIA

✔ `cc_principals` has NO `tenant_id` column  
✔ All 5 Jobber roles exist with EXACT codes specified  
✔ `cc_organizations` table exists with RLS and scope trigger  
✔ `cc_auth_audit_log` has `effective_principal_id` column  
✔ All Jobber-mapped roles have capability bundles assigned  

**Only proceed to PROMPT-3 (application layer) after ALL verifications pass.**

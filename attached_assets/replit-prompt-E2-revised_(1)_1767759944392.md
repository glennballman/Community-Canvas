# PROMPT E2 (REVISED) — Multi-Portal Foundation

**This prompt uses the existing `portals` system. No separate `brands` table.**

You are working in Community Canvas (multi-tenant SaaS).
Based on the audit, the existing `portals` system already supports one tenant owning multiple portals. We will use **portals as portal instances** (which serve as brand execution contexts for businesses).

## THE MODEL

```
Tenant (1252093 BC LTD) = legal + operational boundary
Portal Instance = customer-facing execution context (functionality + brand identity)

Assets → tenant-level (shared)
Customers, Projects, Work Requests, Bookings → portal-scoped
```

## KEY CONCEPT: Portal Type vs Brand Identity

- **portal_type** = what the portal DOES (capabilities, navigation, features)
- **legal_dba_name** = how it IDENTIFIES (legal name on invoices/contracts)
- **Theme/Copy** = how it LOOKS (already in `portal_theme` and `portal_copy` tables)

For 1252093 BC LTD, we're creating three portals of type `business_service`, each with different legal_dba_name and domains.

## NON-NEGOTIABLE RULES
- DO NOT create a `brands` table. Use `portals` instead.
- DO NOT add `theme_json` to `portals`. Theme already lives in `portal_theme` table.
- Assets remain tenant-level (shared pool). Do NOT add portal_id to unified_assets.
- RLS remains tenant-only. Portal isolation is app-level filtering.
- Provide evidence: files changed, migration(s), and smoke test checklist.

---

## STEP 0 — EVIDENCE READ (Confirm Current State)

Before editing, verify the existing portal infrastructure:

```sql
-- Verify portals table structure
\d portals

-- Verify theme is in separate table
\d portal_theme

-- Check if portal_type already exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'portals' AND column_name IN ('portal_type', 'brand_type', 'legal_dba_name');

-- Check existing portals
SELECT id, owning_tenant_id, name, slug, status FROM portals;

-- Confirm slug is globally unique (not per-tenant)
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'portals' AND constraint_type = 'UNIQUE';
```

Report:
- Current columns on `portals` table
- Whether `portal_type` or `legal_dba_name` already exist
- Confirm slug uniqueness constraint

---

## STEP 1 — EXTEND portals TABLE (Migration)

Add columns to `portals` (if they don't exist):

```sql
-- Add portal_type (NOT brand_type)
-- This represents FUNCTIONALITY, not just branding
ALTER TABLE portals ADD COLUMN IF NOT EXISTS portal_type TEXT 
  DEFAULT 'community' 
  CHECK (portal_type IN (
    'community',        -- News, feeds, directories, announcements
    'facility',         -- Calendar-centric, events, messaging groups
    'jobs',             -- Jobs search, bid, crew formation, contracts
    'marketplace',      -- Tools/rental inventory marketplace
    'business_service', -- Service business portal (quotes, projects, invoices)
    'platform'          -- Platform-level portal
  ));

-- Add legal DBA name for invoice/contract footer
-- e.g., "1252093 BC LTD dba Remote Serve"
ALTER TABLE portals ADD COLUMN IF NOT EXISTS legal_dba_name TEXT;

-- Update existing portals to have portal_type = 'community' if NULL
UPDATE portals SET portal_type = 'community' WHERE portal_type IS NULL;
```

**DO NOT add theme_json to portals** — theme data lives in `portal_theme` table.

Index:
```sql
CREATE INDEX IF NOT EXISTS idx_portals_tenant_type ON portals(owning_tenant_id, portal_type);
```

---

## STEP 2 — PORTAL CONTEXT FOR STAFF

Staff users (Ellen) need a default portal context.

Find where user preferences are stored. Check for:
- `actor_profiles`
- `user_preferences`
- `tenant_memberships`

Add portal preference using the EXISTING pattern:

```sql
-- If actor_profiles exists and is the right place:
ALTER TABLE actor_profiles ADD COLUMN IF NOT EXISTS default_portal_id UUID REFERENCES portals(id);

-- OR if there's a preferences/settings table, use that pattern
```

Requirements:
- Staff can have a default portal context per tenant
- Portal context is used to default forms but can be changed
- If no portal context exists, default to tenant's first active portal
- Pavel (ops) doesn't need a portal context set

---

## STEP 3 — ADD portal_id TO PORTAL-SCOPED TABLES

**CRITICAL: Use staged migration pattern to avoid failures**

### Staged Migration Pattern (for each table):
1. Add column as NULLABLE
2. Backfill existing rows
3. Add NOT NULL constraint
4. Add FK constraint (if not already present)
5. Add indexes

### 3A) Contacts/Customers

Find the canonical contacts table (likely `crm_contacts` or `contacts`).

```sql
-- Step 1: Add nullable column
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS portal_id UUID;

-- Step 2: Backfill existing rows to tenant's first active portal
-- First, ensure each tenant with contacts has at least one portal
-- Then backfill:
UPDATE crm_contacts c
SET portal_id = (
  SELECT p.id FROM portals p 
  WHERE p.owning_tenant_id = c.tenant_id 
    AND p.status = 'active'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE c.portal_id IS NULL;

-- Step 3: Add NOT NULL constraint (only after backfill succeeds)
ALTER TABLE crm_contacts ALTER COLUMN portal_id SET NOT NULL;

-- Step 4: Add FK constraint
ALTER TABLE crm_contacts 
  ADD CONSTRAINT fk_contacts_portal 
  FOREIGN KEY (portal_id) REFERENCES portals(id);

-- Step 5: Add index
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_portal ON crm_contacts(tenant_id, portal_id);
```

### 3B) Projects

```sql
-- Same staged pattern
ALTER TABLE projects ADD COLUMN IF NOT EXISTS portal_id UUID;

UPDATE projects p
SET portal_id = (
  SELECT pt.id FROM portals pt 
  WHERE pt.owning_tenant_id = p.tenant_id 
    AND pt.status = 'active'
  ORDER BY pt.created_at ASC
  LIMIT 1
)
WHERE p.portal_id IS NULL;

ALTER TABLE projects ALTER COLUMN portal_id SET NOT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_projects_portal FOREIGN KEY (portal_id) REFERENCES portals(id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_portal ON projects(tenant_id, portal_id);
```

### 3C) Work Requests

```sql
-- Same staged pattern
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS portal_id UUID;

UPDATE work_requests wr
SET portal_id = (
  SELECT p.id FROM portals p 
  WHERE p.owning_tenant_id = wr.tenant_id 
    AND p.status = 'active'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE wr.portal_id IS NULL;

ALTER TABLE work_requests ALTER COLUMN portal_id SET NOT NULL;
ALTER TABLE work_requests ADD CONSTRAINT fk_work_requests_portal FOREIGN KEY (portal_id) REFERENCES portals(id);
CREATE INDEX IF NOT EXISTS idx_work_requests_tenant_portal ON work_requests(tenant_id, portal_id);
```

### 3D) Bookings (unified_bookings)

```sql
-- Bookings: portal_id is NULLABLE (internal holds may not have portal)
ALTER TABLE unified_bookings ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id);

-- Backfill existing customer bookings if identifiable
-- (May need business logic to determine which were customer vs internal)

-- Index
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_portal ON unified_bookings(tenant_id, portal_id, starts_at);
```

**Server-side guardrail:** Customer booking creation MUST require portal_id (enforced in code, not DB constraint).

---

## STEP 4 — PORTAL-SCOPED COMMERCIAL DATA (FOUNDATION ONLY)

Create tables for portal-specific pricing/products (if they don't exist):

```sql
CREATE TABLE IF NOT EXISTS portal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  default_price DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  cost_per_unit DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Enable RLS (tenant-level isolation). Portal filtering is app-level.

---

## STEP 5 — SEED: 1252093 BC LTD + Portals + Assets

**IMPORTANT:** 
- Do NOT seed users via raw SQL INSERT. Use existing identity/membership patterns.
- Portal slugs are GLOBALLY unique. Check for conflicts first.

### 5A) Create or find tenant

```sql
-- Find or create the tenant
INSERT INTO cc_tenants (id, name, slug, tenant_type)
VALUES (gen_random_uuid(), '1252093 BC LTD', '1252093-bc-ltd', 'business')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
RETURNING id;
```

### 5B) Create portals

```sql
-- Get tenant_id first
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM cc_tenants WHERE slug = '1252093-bc-ltd';
  
  -- Create portals (slugs are globally unique - using descriptive slugs)
  INSERT INTO portals (owning_tenant_id, name, slug, portal_type, legal_dba_name, status)
  VALUES
    (v_tenant_id, 'Enviropaving BC', 'enviropaving', 'business_service', 'Enviropaving BC', 'active'),
    (v_tenant_id, 'Remote Serve', 'remote-serve', 'business_service', 'Remote Serve', 'active'),
    (v_tenant_id, 'Enviro Bright Lights', 'enviro-bright', 'business_service', 'Enviro Bright Lights', 'active')
  ON CONFLICT (slug) DO UPDATE SET
    portal_type = EXCLUDED.portal_type,
    legal_dba_name = EXCLUDED.legal_dba_name;
END $$;
```

### 5C) Create users (USE EXISTING PATTERNS)

**Do not raw INSERT into users table.**

Instead, document what needs to happen:
- Ellen White: admin role on tenant 1252093 BC LTD, default_portal_id = remote-serve
- Pavel: crew/member role on tenant 1252093 BC LTD, no default portal needed

Use the same user creation + tenant membership flow that exists for other tenants.

### 5D) Create assets (tenant-level, NOT portal-level)

```sql
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM cc_tenants WHERE slug = '1252093-bc-ltd';
  
  INSERT INTO unified_assets (tenant_id, name, type, description, metadata, status)
  VALUES
    (v_tenant_id, '2015 Ford F350 Silver', 'vehicle', 
     'Gas, longbox, roof rack, 4WD, seats 6, bumper hitch', 
     '{"fuel": "gas", "bed": "longbox", "features": ["roof_rack", "4wd", "bumper_hitch"], "seats": 6}'::jsonb,
     'active'),
    (v_tenant_id, '2015 Ford F350 Grey', 'vehicle', 
     'Gas, longbox, 4WD, seats 6, bumper hitch',
     '{"fuel": "gas", "bed": "longbox", "features": ["4wd", "bumper_hitch"], "seats": 6}'::jsonb,
     'active'),
    (v_tenant_id, '2012 Ford F350 White', 'vehicle', 
     'Diesel, shortbox, 5th wheel + bumper hitch, 4WD, seats 6',
     '{"fuel": "diesel", "bed": "shortbox", "features": ["5th_wheel_hitch", "bumper_hitch", "4wd"], "seats": 6}'::jsonb,
     'active'),
    (v_tenant_id, '2006 Isuzu 3500 Cube Van', 'vehicle', 
     'Diesel, hydraulic lift 2000 lbs, Crown mortar mixer, 6000 lbs cargo',
     '{"fuel": "diesel", "lift_capacity_lbs": 2000, "cargo_capacity_lbs": 6000, "equipment": ["crown_mortar_mixer"]}'::jsonb,
     'active'),
    (v_tenant_id, 'Green Forklift', 'equipment', 
     'Propane, outdoor rated',
     '{"fuel": "propane", "indoor_only": false}'::jsonb,
     'active'),
    (v_tenant_id, 'Pallet Jack', 'equipment', 
     'Manual pallet jack', '{}'::jsonb,
     'active'),
    (v_tenant_id, '24ft Royal Cargo Cube Trailer', 'trailer', 
     '24 foot enclosed cargo trailer', 
     '{"length_ft": 24, "type": "enclosed"}'::jsonb,
     'active'),
    (v_tenant_id, '18ft Cargo Trailer', 'trailer', 
     '18 foot cargo trailer',
     '{"length_ft": 18}'::jsonb,
     'active'),
    (v_tenant_id, '22ft Flatbed Tandem Trailer', 'trailer', 
     '22 foot flatbed, tandem axle, 10000 lbs capacity',
     '{"length_ft": 22, "type": "flatbed", "axles": "tandem", "capacity_lbs": 10000}'::jsonb,
     'active')
  ON CONFLICT DO NOTHING;
END $$;
```

---

## STEP 6 — UI: PORTAL SELECTOR FOR STAFF

### 6A) Expand Portal Config for business tenants

**Do NOT just "remove the filter."** Instead:

Update `/admin/communities/portals` (PortalConfigPage.tsx):
- Allow business tenants to configure portals they OWN (where `owning_tenant_id = currentTenant`)
- For business tenants, optionally filter to show only `portal_type IN ('business_service')`
- Keep existing community portal config behavior for government tenants

### 6B) Add portal selector in app header

For staff users (not ops-only users like Pavel):
- Add a dropdown showing portals owned by their tenant
- Selecting changes `default_portal_id` (persisted)
- This portal context affects:
  - Work Requests list/create (filtered + default)
  - Projects list/create (filtered + default)
  - Contacts list/create (filtered + default)
  - Bookings create (attaches portal_id)

### 6C) Operations Board (no filtering)

- Shows ALL bookings for the tenant (regardless of portal)
- Displays portal badge/tag on booking blocks if portal_id is set
- Badge should show portal name or abbreviation

---

## STEP 7 — VERIFICATION (PRINT EVIDENCE)

### SQL Evidence

```sql
-- Show portals table with new columns
\d portals

-- Show seeded portals
SELECT id, owning_tenant_id, slug, portal_type, legal_dba_name, status 
FROM portals WHERE owning_tenant_id IS NOT NULL;

-- Show portal_id exists on scoped tables
\d crm_contacts
\d projects
\d work_requests
\d unified_bookings

-- Verify NOT NULL constraints applied (except bookings)
SELECT table_name, column_name, is_nullable 
FROM information_schema.columns 
WHERE column_name = 'portal_id' 
  AND table_name IN ('crm_contacts', 'projects', 'work_requests', 'unified_bookings');

-- Count records with portal_id set
SELECT 'contacts' as tbl, COUNT(*) as total, COUNT(portal_id) as with_portal FROM crm_contacts
UNION ALL
SELECT 'projects', COUNT(*), COUNT(portal_id) FROM projects
UNION ALL
SELECT 'work_requests', COUNT(*), COUNT(portal_id) FROM work_requests;
```

### UI Evidence

- [ ] Ellen can switch portals in header/dropdown
- [ ] Work Requests list filters by selected portal
- [ ] Creating a Work Request attaches correct portal_id
- [ ] Projects list filters by selected portal
- [ ] Operations Board shows ALL bookings (tenant-wide)
- [ ] Bookings show portal badge with portal name

### Code Evidence

- [ ] List files changed
- [ ] Migration filename(s)
- [ ] No raw user INSERTs (used existing patterns)

---

## CRITICAL REMINDERS

1. **Use `portal_type` not `brand_type`** — Portals are functionality-based.

2. **Don't add theme_json to portals** — Theme lives in `portal_theme` table.

3. **Staged migrations** — nullable → backfill → NOT NULL.

4. **Assets remain tenant-level** — No portal_id on unified_assets.

5. **RLS stays tenant-only** — Portal isolation is app-level.

6. **Slug is globally unique** — Two tenants can't both have `enviropaving` slug.

BEGIN.

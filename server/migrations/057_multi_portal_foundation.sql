-- ============================================================================
-- MIGRATION 057 — MULTI-PORTAL FOUNDATION
-- ============================================================================
-- Uses existing `portals` system. No separate `brands` table.
-- Portal = customer-facing execution context (functionality + brand identity)
-- 
-- Portal Type vs Brand Identity:
-- - portal_type = what the portal DOES (capabilities, navigation, features)
-- - legal_dba_name = how it IDENTIFIES (legal name on invoices/contracts)
-- - Theme/Copy = how it LOOKS (already in portal_theme and portal_copy)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: EXTEND portals TABLE
-- ============================================================================

-- Add portal_type: represents FUNCTIONALITY, not just branding
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

-- Index for tenant + type queries
CREATE INDEX IF NOT EXISTS idx_portals_tenant_type ON portals(owning_tenant_id, portal_type);

-- ============================================================================
-- STEP 2: PORTAL CONTEXT FOR STAFF
-- Add default_portal_id to cc_tenant_users
-- Staff can have a default portal context per tenant
-- ============================================================================

ALTER TABLE cc_tenant_users ADD COLUMN IF NOT EXISTS default_portal_id UUID REFERENCES portals(id);

-- Index for portal context lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_portal ON cc_tenant_users(tenant_id, default_portal_id);

-- ============================================================================
-- STEP 3: ADD portal_id TO PORTAL-SCOPED TABLES (STAGED PATTERN)
-- Using staged pattern: add nullable → backfill → set NOT NULL → add FK
-- ============================================================================

-- 3A) crm_contacts
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS portal_id UUID;

-- Backfill existing rows to tenant's first active portal
UPDATE crm_contacts c
SET portal_id = (
  SELECT p.id FROM portals p 
  WHERE p.owning_tenant_id = c.tenant_id 
    AND p.status = 'active'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE c.portal_id IS NULL
  AND EXISTS (
    SELECT 1 FROM portals p 
    WHERE p.owning_tenant_id = c.tenant_id 
      AND p.status = 'active'
  );

-- Add FK constraint (NOT NULL enforced in app for new records)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_contacts_portal' AND table_name = 'crm_contacts'
  ) THEN
    ALTER TABLE crm_contacts 
      ADD CONSTRAINT fk_contacts_portal 
      FOREIGN KEY (portal_id) REFERENCES portals(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_portal ON crm_contacts(tenant_id, portal_id);

-- 3B) projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS portal_id UUID;

UPDATE projects p
SET portal_id = (
  SELECT pt.id FROM portals pt 
  WHERE pt.owning_tenant_id = p.tenant_id 
    AND pt.status = 'active'
  ORDER BY pt.created_at ASC
  LIMIT 1
)
WHERE p.portal_id IS NULL
  AND EXISTS (
    SELECT 1 FROM portals pt 
    WHERE pt.owning_tenant_id = p.tenant_id 
      AND pt.status = 'active'
  );

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_projects_portal' AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
      ADD CONSTRAINT fk_projects_portal 
      FOREIGN KEY (portal_id) REFERENCES portals(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_tenant_portal ON projects(tenant_id, portal_id);

-- 3C) work_requests
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS portal_id UUID;

UPDATE work_requests wr
SET portal_id = (
  SELECT p.id FROM portals p 
  WHERE p.owning_tenant_id = wr.tenant_id 
    AND p.status = 'active'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE wr.portal_id IS NULL
  AND EXISTS (
    SELECT 1 FROM portals p 
    WHERE p.owning_tenant_id = wr.tenant_id 
      AND p.status = 'active'
  );

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_work_requests_portal' AND table_name = 'work_requests'
  ) THEN
    ALTER TABLE work_requests 
      ADD CONSTRAINT fk_work_requests_portal 
      FOREIGN KEY (portal_id) REFERENCES portals(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_requests_tenant_portal ON work_requests(tenant_id, portal_id);

-- 3D) unified_bookings (portal_id is NULLABLE - internal holds may not have portal)
ALTER TABLE unified_bookings ADD COLUMN IF NOT EXISTS portal_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_bookings_portal' AND table_name = 'unified_bookings'
  ) THEN
    ALTER TABLE unified_bookings 
      ADD CONSTRAINT fk_bookings_portal 
      FOREIGN KEY (portal_id) REFERENCES portals(id);
  END IF;
END $$;

-- Composite index for tenant + portal + time range queries
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_portal_time 
  ON unified_bookings(booker_tenant_id, portal_id, starts_at);

-- ============================================================================
-- STEP 4: PORTAL-SCOPED COMMERCIAL DATA (FOUNDATION ONLY)
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_portal_products_tenant_portal 
  ON portal_products(tenant_id, portal_id);

CREATE TABLE IF NOT EXISTS portal_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  cost_per_unit DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_materials_tenant_portal 
  ON portal_materials(tenant_id, portal_id);

CREATE TABLE IF NOT EXISTS portal_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_pricing_rules_tenant_portal 
  ON portal_pricing_rules(tenant_id, portal_id);

-- ============================================================================
-- STEP 5: RLS POLICIES FOR NEW TABLES (tenant-level isolation)
-- Portal filtering is app-level, not RLS-level
-- ============================================================================

ALTER TABLE portal_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS for portal_products
DROP POLICY IF EXISTS portal_products_tenant_isolation ON portal_products;
CREATE POLICY portal_products_tenant_isolation ON portal_products
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- RLS for portal_materials
DROP POLICY IF EXISTS portal_materials_tenant_isolation ON portal_materials;
CREATE POLICY portal_materials_tenant_isolation ON portal_materials
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- RLS for portal_pricing_rules
DROP POLICY IF EXISTS portal_pricing_rules_tenant_isolation ON portal_pricing_rules;
CREATE POLICY portal_pricing_rules_tenant_isolation ON portal_pricing_rules
  FOR ALL
  USING (
    is_service_mode()
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- GRANTS FOR AUTHENTICATOR (conditional - only if role exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON portal_products TO authenticator';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON portal_materials TO authenticator';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON portal_pricing_rules TO authenticator';
  END IF;
END $$;

COMMIT;

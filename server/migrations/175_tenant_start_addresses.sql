-- ============================================================
-- Migration 175: Tenant Start Address Book + cc_n3_runs.start_address_id
-- V3.5 STEP 6.5B - Amazon-style saved start addresses
-- ============================================================

-- B1) Create table: cc_tenant_start_addresses
-- Tenant-level address book for service run departure points

CREATE TABLE cc_tenant_start_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'CA',
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique label per tenant (active addresses only)
CREATE UNIQUE INDEX idx_start_addresses_unique_label 
ON cc_tenant_start_addresses(tenant_id, label) 
WHERE archived_at IS NULL;

-- Standard indexes
CREATE INDEX idx_start_addresses_tenant 
ON cc_tenant_start_addresses(tenant_id);

CREATE INDEX idx_start_addresses_active 
ON cc_tenant_start_addresses(tenant_id) 
WHERE archived_at IS NULL;

CREATE INDEX idx_start_addresses_default 
ON cc_tenant_start_addresses(tenant_id, is_default) 
WHERE archived_at IS NULL AND is_default = true;

-- RLS
ALTER TABLE cc_tenant_start_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_tenant_start_addresses_tenant_isolation 
ON cc_tenant_start_addresses
FOR ALL
USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY cc_tenant_start_addresses_service_bypass 
ON cc_tenant_start_addresses
FOR ALL
USING (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Comments
COMMENT ON TABLE cc_tenant_start_addresses IS 
'Tenant-level saved start addresses (Amazon-style address book). Used for service run departure points. Private, advisory only.';

COMMENT ON COLUMN cc_tenant_start_addresses.label IS 
'Human-readable name: "John''s House", "South Yard", "Marina Dock"';

COMMENT ON COLUMN cc_tenant_start_addresses.is_default IS 
'Single default per tenant. Used as suggestion only, never auto-applied.';

-- ============================================================
-- B2) Extend cc_n3_runs with start_address_id
-- ============================================================

ALTER TABLE cc_n3_runs
ADD COLUMN IF NOT EXISTS start_address_id UUID 
REFERENCES cc_tenant_start_addresses(id);

COMMENT ON COLUMN cc_n3_runs.start_address_id IS 
'Optional run departure address from tenant address book. Does NOT imply person/asset assignment. Advisory only.';

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_n3_runs_start_address 
ON cc_n3_runs(start_address_id) 
WHERE start_address_id IS NOT NULL;

-- ============================================================
-- Grants for tenant access
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_tenant_start_addresses TO authenticated;

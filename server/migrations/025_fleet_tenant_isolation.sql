-- ============================================================================
-- MIGRATION 025 — FLEET TENANT ISOLATION
-- ============================================================================
-- Adds tenant_id columns to vehicle_profiles and trailer_profiles tables
-- Enables RLS with tenant isolation policies.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ADD TENANT_ID COLUMNS
-- ============================================================================

-- Add tenant_id to vehicle_profiles if not exists
DO $$ BEGIN
  ALTER TABLE vehicle_profiles ADD COLUMN tenant_id UUID REFERENCES cc_tenants(id);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Add tenant_id to trailer_profiles if not exists
DO $$ BEGIN
  ALTER TABLE trailer_profiles ADD COLUMN tenant_id UUID REFERENCES cc_tenants(id);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_profiles_tenant_id ON vehicle_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trailer_profiles_tenant_id ON trailer_profiles(tenant_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE vehicle_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailer_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR VEHICLES
-- ============================================================================

-- Allow public read access to vehicle catalog (tenant_id NULL = shared fleet)
-- Tenant-owned vehicles only visible to that tenant
DROP POLICY IF EXISTS vehicle_read_policy ON vehicle_profiles;
CREATE POLICY vehicle_read_policy ON vehicle_profiles
  FOR SELECT
  USING (
    tenant_id IS NULL                          -- Public/shared vehicles
    OR tenant_id = current_tenant_id()         -- Tenant's own vehicles
    OR is_service_mode()                       -- Service mode bypass
  );

-- Only tenant can insert their own vehicles
DROP POLICY IF EXISTS vehicle_tenant_insert ON vehicle_profiles;
CREATE POLICY vehicle_tenant_insert ON vehicle_profiles
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- Only tenant can update their own vehicles
DROP POLICY IF EXISTS vehicle_tenant_update ON vehicle_profiles;
CREATE POLICY vehicle_tenant_update ON vehicle_profiles
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- Only tenant can delete their own vehicles
DROP POLICY IF EXISTS vehicle_tenant_delete ON vehicle_profiles;
CREATE POLICY vehicle_tenant_delete ON vehicle_profiles
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- ============================================================================
-- RLS POLICIES FOR TRAILERS
-- ============================================================================

-- Allow public read access to trailer catalog (tenant_id NULL = shared fleet)
DROP POLICY IF EXISTS trailer_read_policy ON trailer_profiles;
CREATE POLICY trailer_read_policy ON trailer_profiles
  FOR SELECT
  USING (
    tenant_id IS NULL                          -- Public/shared trailers
    OR tenant_id = current_tenant_id()         -- Tenant's own trailers
    OR is_service_mode()                       -- Service mode bypass
  );

-- Only tenant can insert their own trailers
DROP POLICY IF EXISTS trailer_tenant_insert ON trailer_profiles;
CREATE POLICY trailer_tenant_insert ON trailer_profiles
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- Only tenant can update their own trailers
DROP POLICY IF EXISTS trailer_tenant_update ON trailer_profiles;
CREATE POLICY trailer_tenant_update ON trailer_profiles
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- Only tenant can delete their own trailers
DROP POLICY IF EXISTS trailer_tenant_delete ON trailer_profiles;
CREATE POLICY trailer_tenant_delete ON trailer_profiles
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

COMMIT;

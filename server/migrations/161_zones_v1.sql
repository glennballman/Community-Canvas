-- Migration 161: Zones v1
-- First-class zones scoped to portals for organizing Work Requests and Properties

-- Create cc_zones table
CREATE TABLE IF NOT EXISTS cc_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'neighborhood',
  badge_label_resident text,
  badge_label_contractor text,
  badge_label_visitor text,
  theme jsonb NOT NULL DEFAULT '{}',
  access_profile jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(portal_id, key)
);

-- Indexes for cc_zones
CREATE INDEX IF NOT EXISTS idx_cc_zones_tenant_portal ON cc_zones(tenant_id, portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_zones_theme_gin ON cc_zones USING GIN(theme);
CREATE INDEX IF NOT EXISTS idx_cc_zones_access_profile_gin ON cc_zones USING GIN(access_profile);

-- Add zone_id to cc_properties
ALTER TABLE cc_properties ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES cc_zones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cc_properties_tenant_zone ON cc_properties(tenant_id, zone_id);

-- Add zone_id to cc_maintenance_requests
ALTER TABLE cc_maintenance_requests ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES cc_zones(id) ON DELETE SET NULL;

-- Need to get tenant_id for maintenance requests - we don't have it directly, 
-- so we'll create a composite index with portal_id which is available
CREATE INDEX IF NOT EXISTS idx_cc_maintenance_requests_portal_zone ON cc_maintenance_requests(portal_id, zone_id);

-- RLS policies for cc_zones (tenant isolation with service mode bypass)
ALTER TABLE cc_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_zones_tenant_isolation ON cc_zones;
CREATE POLICY cc_zones_tenant_isolation ON cc_zones
  USING (
    is_service_mode() 
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS cc_zones_insert_policy ON cc_zones;
CREATE POLICY cc_zones_insert_policy ON cc_zones
  FOR INSERT
  WITH CHECK (
    is_service_mode() 
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS cc_zones_update_policy ON cc_zones;
CREATE POLICY cc_zones_update_policy ON cc_zones
  FOR UPDATE
  USING (
    is_service_mode() 
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS cc_zones_delete_policy ON cc_zones;
CREATE POLICY cc_zones_delete_policy ON cc_zones
  FOR DELETE
  USING (
    is_service_mode() 
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

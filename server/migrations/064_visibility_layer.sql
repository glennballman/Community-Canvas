-- V3.3.1 Block 01: Truth/Disclosure Layer Schema
-- Creates visibility system that separates:
-- - TRUTH: What ops sees (real inventory)
-- - DISCLOSURE: What public/chamber sees (controlled slice, never counts)

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE cc_channel AS ENUM (
    'internal_ops',
    'chamber_desk',
    'partner',
    'public'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cc_visibility_mode AS ENUM (
    'show_all',
    'show_percentage',
    'show_cap',
    'show_by_rules',
    'hide_all'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cc_asset_visibility_rule_mode AS ENUM (
    'always_show',
    'always_hide',
    'conditional'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cc_participation_mode AS ENUM (
    'inventory_hidden',
    'requests_only',
    'manual_confirm',
    'instant_confirm'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Visibility Profiles - named configurations for disclosure behavior
CREATE TABLE IF NOT EXISTS cc_visibility_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  
  default_mode cc_visibility_mode NOT NULL DEFAULT 'show_all',
  percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
  cap_count INTEGER CHECK (cap_count >= 0),
  
  safety_never_say_no BOOLEAN NOT NULL DEFAULT false,
  surface_set_ttl_minutes INTEGER NOT NULL DEFAULT 1440,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visibility Profile Windows - time-bound channel assignments
CREATE TABLE IF NOT EXISTS cc_visibility_profile_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES cc_visibility_profiles(id) ON DELETE CASCADE,
  
  channel cc_channel NOT NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  
  asset_type VARCHAR(64),
  portal_id UUID REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT cc_visibility_profile_windows_date_check CHECK (window_end >= window_start)
);

-- Asset Groups - logical groupings for bulk visibility rules
CREATE TABLE IF NOT EXISTS cc_asset_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset Group Members - many-to-many link
CREATE TABLE IF NOT EXISTS cc_asset_group_members (
  group_id UUID NOT NULL REFERENCES cc_asset_groups(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES cc_assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, asset_id)
);

-- Asset Visibility Rules - per-asset/group/type visibility overrides
CREATE TABLE IF NOT EXISTS cc_asset_visibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  channel cc_channel NOT NULL,
  
  asset_id UUID REFERENCES cc_assets(id) ON DELETE CASCADE,
  asset_group_id UUID REFERENCES cc_asset_groups(id) ON DELETE CASCADE,
  asset_type VARCHAR(64),
  
  mode cc_asset_visibility_rule_mode NOT NULL,
  condition JSONB,
  priority INTEGER NOT NULL DEFAULT 100,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT cc_asset_visibility_rules_target_check CHECK (
    (asset_id IS NOT NULL)::int + 
    (asset_group_id IS NOT NULL)::int + 
    (asset_type IS NOT NULL)::int = 1
  )
);

-- Disclosure Surface Sets - computed/cached visible asset sets
CREATE TABLE IF NOT EXISTS cc_disclosure_surface_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES cc_visibility_profiles(id) ON DELETE CASCADE,
  channel cc_channel NOT NULL,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  asset_type VARCHAR(64),
  
  surfaced_asset_ids UUID[] NOT NULL,
  
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  
  CONSTRAINT cc_disclosure_surface_sets_date_check CHECK (end_date >= start_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS cc_visibility_profiles_tenant_idx 
  ON cc_visibility_profiles(tenant_id);

CREATE INDEX IF NOT EXISTS cc_visibility_profile_windows_tenant_idx 
  ON cc_visibility_profile_windows(tenant_id);

CREATE INDEX IF NOT EXISTS cc_visibility_profile_windows_profile_idx 
  ON cc_visibility_profile_windows(profile_id);

CREATE INDEX IF NOT EXISTS cc_visibility_profile_windows_channel_dates_idx 
  ON cc_visibility_profile_windows(channel, window_start, window_end);

CREATE INDEX IF NOT EXISTS cc_asset_groups_tenant_idx 
  ON cc_asset_groups(tenant_id);

CREATE INDEX IF NOT EXISTS cc_asset_visibility_rules_tenant_idx 
  ON cc_asset_visibility_rules(tenant_id);

CREATE INDEX IF NOT EXISTS cc_asset_visibility_rules_channel_idx 
  ON cc_asset_visibility_rules(channel);

CREATE INDEX IF NOT EXISTS cc_disclosure_surface_sets_tenant_idx 
  ON cc_disclosure_surface_sets(tenant_id);

CREATE INDEX IF NOT EXISTS cc_disclosure_surface_sets_profile_idx 
  ON cc_disclosure_surface_sets(profile_id);

CREATE INDEX IF NOT EXISTS cc_disclosure_surface_sets_expiry_idx 
  ON cc_disclosure_surface_sets(expires_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_visibility_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_visibility_profile_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_asset_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_asset_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_asset_visibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_disclosure_surface_sets ENABLE ROW LEVEL SECURITY;

-- Visibility Profiles RLS
DROP POLICY IF EXISTS cc_visibility_profiles_tenant_isolation ON cc_visibility_profiles;
CREATE POLICY cc_visibility_profiles_tenant_isolation ON cc_visibility_profiles
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Visibility Profile Windows RLS
DROP POLICY IF EXISTS cc_visibility_profile_windows_tenant_isolation ON cc_visibility_profile_windows;
CREATE POLICY cc_visibility_profile_windows_tenant_isolation ON cc_visibility_profile_windows
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Asset Groups RLS
DROP POLICY IF EXISTS cc_asset_groups_tenant_isolation ON cc_asset_groups;
CREATE POLICY cc_asset_groups_tenant_isolation ON cc_asset_groups
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Asset Group Members RLS (join through group)
DROP POLICY IF EXISTS cc_asset_group_members_tenant_isolation ON cc_asset_group_members;
CREATE POLICY cc_asset_group_members_tenant_isolation ON cc_asset_group_members
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR EXISTS (
      SELECT 1 FROM cc_asset_groups g 
      WHERE g.id = group_id 
      AND g.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- Asset Visibility Rules RLS
DROP POLICY IF EXISTS cc_asset_visibility_rules_tenant_isolation ON cc_asset_visibility_rules;
CREATE POLICY cc_asset_visibility_rules_tenant_isolation ON cc_asset_visibility_rules
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Disclosure Surface Sets RLS
DROP POLICY IF EXISTS cc_disclosure_surface_sets_tenant_isolation ON cc_disclosure_surface_sets;
CREATE POLICY cc_disclosure_surface_sets_tenant_isolation ON cc_disclosure_surface_sets
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_visibility_profiles TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_visibility_profile_windows TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_asset_groups TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_asset_group_members TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_asset_visibility_rules TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_disclosure_surface_sets TO PUBLIC;

-- Migration 053: Capacity + Constraints Model with Child Capabilities
-- Every inventory resource is modeled as Capacity + Constraints
-- Supports child capabilities (e.g., Lucky Lander has a crane capability)

-- ============================================================================
-- PHASE 1: Create enums for status and severity
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE capability_status AS ENUM ('operational', 'inoperable', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE constraint_severity AS ENUM ('info', 'warning', 'blocking');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PHASE 2: Asset Capability Units
-- Child capabilities tied to unified_assets (e.g., Crane, Lift Gate, Room 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_capability_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES cc_tenants(id),
  asset_id UUID NOT NULL REFERENCES unified_assets(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  capability_type TEXT NOT NULL,
  status capability_status NOT NULL DEFAULT 'operational',
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_units_asset ON asset_capability_units(asset_id);
CREATE INDEX IF NOT EXISTS idx_capability_units_tenant ON asset_capability_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capability_units_status ON asset_capability_units(status);

-- ============================================================================
-- PHASE 3: Asset Capacities
-- Key-value storage for capacity attributes (max_weight, max_length, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_capacities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES cc_tenants(id),
  asset_id UUID NOT NULL REFERENCES unified_assets(id) ON DELETE CASCADE,
  capability_unit_id UUID REFERENCES asset_capability_units(id) ON DELETE CASCADE,
  
  key TEXT NOT NULL,
  value_num NUMERIC,
  value_text TEXT,
  unit TEXT,
  applies_to TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_capacities_asset ON asset_capacities(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_capacities_capability ON asset_capacities(capability_unit_id);
CREATE INDEX IF NOT EXISTS idx_asset_capacities_key ON asset_capacities(key);

-- ============================================================================
-- PHASE 4: Asset Constraints
-- Time-bounded constraints that can block bookings
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES cc_tenants(id),
  asset_id UUID NOT NULL REFERENCES unified_assets(id) ON DELETE CASCADE,
  capability_unit_id UUID REFERENCES asset_capability_units(id) ON DELETE CASCADE,
  
  constraint_type TEXT NOT NULL,
  severity constraint_severity NOT NULL DEFAULT 'info',
  details TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_constraints_asset ON asset_constraints(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_constraints_capability ON asset_constraints(capability_unit_id);
CREATE INDEX IF NOT EXISTS idx_asset_constraints_severity ON asset_constraints(severity);
CREATE INDEX IF NOT EXISTS idx_asset_constraints_active ON asset_constraints(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_asset_constraints_time ON asset_constraints(starts_at, ends_at);

-- ============================================================================
-- PHASE 5: RLS Policies
-- ============================================================================

ALTER TABLE asset_capability_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_capacities ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capability_units_tenant_isolation ON asset_capability_units;
CREATE POLICY capability_units_tenant_isolation ON asset_capability_units
  USING (
    is_service_mode() OR 
    tenant_id IS NULL OR 
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS capacities_tenant_isolation ON asset_capacities;
CREATE POLICY capacities_tenant_isolation ON asset_capacities
  USING (
    is_service_mode() OR 
    tenant_id IS NULL OR 
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

DROP POLICY IF EXISTS constraints_tenant_isolation ON asset_constraints;
CREATE POLICY constraints_tenant_isolation ON asset_constraints
  USING (
    is_service_mode() OR 
    tenant_id IS NULL OR 
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- ============================================================================
-- PHASE 6: Helper function to check if resource is bookable
-- ============================================================================

CREATE OR REPLACE FUNCTION is_resource_bookable(
  p_asset_id UUID,
  p_capability_unit_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NOW(),
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  bookable BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  IF p_capability_unit_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM asset_capability_units 
      WHERE id = p_capability_unit_id 
      AND status != 'operational'
    ) THEN
      RETURN QUERY SELECT false, 
        (SELECT 'Capability is ' || status::text FROM asset_capability_units WHERE id = p_capability_unit_id);
      RETURN;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM asset_constraints
      WHERE capability_unit_id = p_capability_unit_id
      AND severity = 'blocking'
      AND active = true
      AND (starts_at IS NULL OR starts_at <= p_end_time)
      AND (ends_at IS NULL OR ends_at >= p_start_time)
    ) THEN
      RETURN QUERY SELECT false,
        (SELECT 'Blocking constraint: ' || constraint_type || ' - ' || COALESCE(details, '')
         FROM asset_constraints 
         WHERE capability_unit_id = p_capability_unit_id
         AND severity = 'blocking' AND active = true
         AND (starts_at IS NULL OR starts_at <= p_end_time)
         AND (ends_at IS NULL OR ends_at >= p_start_time)
         LIMIT 1);
      RETURN;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM asset_constraints
      WHERE asset_id = p_asset_id
      AND capability_unit_id IS NULL
      AND severity = 'blocking'
      AND active = true
      AND (starts_at IS NULL OR starts_at <= p_end_time)
      AND (ends_at IS NULL OR ends_at >= p_start_time)
    ) THEN
      RETURN QUERY SELECT false,
        (SELECT 'Blocking constraint: ' || constraint_type || ' - ' || COALESCE(details, '')
         FROM asset_constraints 
         WHERE asset_id = p_asset_id
         AND capability_unit_id IS NULL
         AND severity = 'blocking' AND active = true
         AND (starts_at IS NULL OR starts_at <= p_end_time)
         AND (ends_at IS NULL OR ends_at >= p_start_time)
         LIMIT 1);
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PHASE 7: Update triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_capability_units_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_capability_units_updated ON asset_capability_units;
CREATE TRIGGER trg_capability_units_updated
  BEFORE UPDATE ON asset_capability_units
  FOR EACH ROW EXECUTE FUNCTION update_capability_units_timestamp();

DROP TRIGGER IF EXISTS trg_capacities_updated ON asset_capacities;
CREATE TRIGGER trg_capacities_updated
  BEFORE UPDATE ON asset_capacities
  FOR EACH ROW EXECUTE FUNCTION update_capability_units_timestamp();

DROP TRIGGER IF EXISTS trg_constraints_updated ON asset_constraints;
CREATE TRIGGER trg_constraints_updated
  BEFORE UPDATE ON asset_constraints
  FOR EACH ROW EXECUTE FUNCTION update_capability_units_timestamp();

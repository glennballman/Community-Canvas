-- V3.3.1 Block 03: Facilities + Inventory Units
-- Unified facility/unit model for Parking + Marina + Lodging

-- ============================================================================
-- ENSURE REQUIRED TENANTS EXIST
-- ============================================================================

INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
VALUES 
  ('00000000-0000-0000-0001-000000000001', 'HFN Marina', 'hfn-marina', 'business', 'active'),
  ('00000000-0000-0000-0002-000000000001', 'Eileen Scott Park', 'eileen-scott-park', 'business', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- cc_facilities - Physical locations with inventory
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id UUID REFERENCES cc_tenants(id),
  
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  facility_type VARCHAR(32) NOT NULL CHECK (facility_type IN ('parking', 'marina', 'lodging', 'rental', 'road_ops')),
  
  address_json JSONB,
  geo_lat NUMERIC(10, 7),
  geo_lon NUMERIC(10, 7),
  boundary_json JSONB,
  
  allocation_mode VARCHAR(32) NOT NULL CHECK (allocation_mode IN ('discrete', 'continuous', 'capacity', 'flex_grid')),
  capacity_unit VARCHAR(32),
  capacity_total INTEGER,
  
  timezone VARCHAR(64) DEFAULT 'America/Vancouver',
  opening_hours JSONB,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, slug)
);

-- ============================================================================
-- cc_inventory_units - Individual bookable units within facilities
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_inventory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES cc_facilities(id) ON DELETE CASCADE,
  
  unit_type VARCHAR(32) NOT NULL,
  display_label VARCHAR(100) NOT NULL,
  
  parent_unit_id UUID REFERENCES cc_inventory_units(id) ON DELETE SET NULL,
  sort_order INTEGER,
  
  length_ft NUMERIC(8, 2),
  width_ft NUMERIC(8, 2),
  depth_ft NUMERIC(8, 2),
  
  capacity_total NUMERIC(10, 2),
  capacity_buffer NUMERIC(10, 2) DEFAULT 0,
  
  constraints JSONB DEFAULT '{}'::jsonb,
  capabilities JSONB DEFAULT '{}'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS cc_facilities_tenant_idx ON cc_facilities(tenant_id);
CREATE INDEX IF NOT EXISTS cc_facilities_community_idx ON cc_facilities(community_id);
CREATE INDEX IF NOT EXISTS cc_facilities_type_idx ON cc_facilities(facility_type);
CREATE INDEX IF NOT EXISTS cc_facilities_slug_idx ON cc_facilities(tenant_id, slug);

CREATE INDEX IF NOT EXISTS cc_inventory_units_tenant_idx ON cc_inventory_units(tenant_id);
CREATE INDEX IF NOT EXISTS cc_inventory_units_facility_idx ON cc_inventory_units(tenant_id, facility_id);
CREATE INDEX IF NOT EXISTS cc_inventory_units_parent_idx ON cc_inventory_units(parent_unit_id);
CREATE INDEX IF NOT EXISTS cc_inventory_units_type_idx ON cc_inventory_units(unit_type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_inventory_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_facilities_tenant_isolation ON cc_facilities;
CREATE POLICY cc_facilities_tenant_isolation ON cc_facilities
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
    OR community_id::text = current_setting('app.tenant_id', true)
  );

DROP POLICY IF EXISTS cc_inventory_units_tenant_isolation ON cc_inventory_units;
CREATE POLICY cc_inventory_units_tenant_isolation ON cc_inventory_units
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_facilities TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_inventory_units TO PUBLIC;

-- ============================================================================
-- SEED DATA - Bamfield Facilities
-- ============================================================================

-- Locked tenant UUIDs:
-- BAMFIELD_COMMUNITY: c0000000-0000-0000-0000-000000000001
-- WOODS_END_LANDING: d0000000-0000-0000-0000-000000000001
-- WOODS_END_MARINA: ff08964d-94b5-4076-850c-2d002e3fd337
-- SAVE_PARADISE_PARKING: 7d8e6df5-bf12-4965-85a9-20b4312ce6c8
-- HFN_MARINA: 00000000-0000-0000-0001-000000000001
-- EILEEN_SCOTT_PARK: 00000000-0000-0000-0002-000000000001

-- 1. Woods End Landing - Main Lodge (7 rooms)
INSERT INTO cc_facilities (tenant_id, community_id, name, slug, facility_type, allocation_mode, capacity_unit, capacity_total, timezone)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Main Lodge',
  'main-lodge',
  'lodging',
  'discrete',
  'room',
  7,
  'America/Vancouver'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 2. Woods End Marina - Main Dock (3 segments, 270 total feet)
INSERT INTO cc_facilities (tenant_id, community_id, name, slug, facility_type, allocation_mode, capacity_unit, capacity_total, timezone)
VALUES (
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  'c0000000-0000-0000-0000-000000000001',
  'Main Dock',
  'main-dock',
  'marina',
  'continuous',
  'feet',
  270,
  'America/Vancouver'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 3. Save Paradise - Main Lot (74 stalls)
INSERT INTO cc_facilities (tenant_id, community_id, name, slug, facility_type, allocation_mode, capacity_unit, capacity_total, timezone)
VALUES (
  '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
  'c0000000-0000-0000-0000-000000000001',
  'Main Lot',
  'main-lot',
  'parking',
  'discrete',
  'stall',
  74,
  'America/Vancouver'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 4. HFN Marina - HFN Dock (12 slips)
INSERT INTO cc_facilities (tenant_id, community_id, name, slug, facility_type, allocation_mode, capacity_unit, capacity_total, timezone)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'HFN Dock',
  'hfn-dock',
  'marina',
  'discrete',
  'slip',
  12,
  'America/Vancouver'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 5. Eileen Scott Park - Gravel Overflow (flex_grid, 3 zone segments)
INSERT INTO cc_facilities (tenant_id, community_id, name, slug, facility_type, allocation_mode, capacity_unit, capacity_total, timezone)
VALUES (
  '00000000-0000-0000-0002-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Gravel Overflow',
  'gravel-overflow',
  'parking',
  'flex_grid',
  'zone_segment',
  3,
  'America/Vancouver'
) ON CONFLICT (tenant_id, slug) DO NOTHING;

-- ============================================================================
-- SEED INVENTORY UNITS
-- ============================================================================

-- Woods End Landing Rooms (7 rooms)
-- Note: Castaway contains Stowaway (parent relationship added after insert)
INSERT INTO cc_inventory_units (tenant_id, facility_id, unit_type, display_label, sort_order, constraints)
SELECT 
  'd0000000-0000-0000-0000-000000000001',
  f.id,
  'room',
  room_name,
  room_order,
  '{}'::jsonb
FROM cc_facilities f,
UNNEST(ARRAY['Woodsman', 'Mariner', 'Beachcomber', 'Homesteader', 'Aviator', 'Castaway', 'Stowaway']) WITH ORDINALITY AS t(room_name, room_order)
WHERE f.slug = 'main-lodge' AND f.tenant_id = 'd0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Set Stowaway's parent to Castaway
UPDATE cc_inventory_units stowaway
SET parent_unit_id = castaway.id
FROM cc_inventory_units castaway
WHERE stowaway.display_label = 'Stowaway' 
  AND castaway.display_label = 'Castaway'
  AND stowaway.tenant_id = 'd0000000-0000-0000-0000-000000000001'
  AND castaway.tenant_id = 'd0000000-0000-0000-0000-000000000001';

-- Woods End Marina Segments (3 segments)
INSERT INTO cc_inventory_units (tenant_id, facility_id, unit_type, display_label, sort_order, capacity_total, length_ft)
SELECT 
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  f.id,
  'segment',
  seg.label,
  seg.sort_order,
  seg.capacity,
  seg.capacity
FROM cc_facilities f,
(VALUES 
  ('Segment A', 1, 50),
  ('Segment B', 2, 50),
  ('Segment C', 3, 170)
) AS seg(label, sort_order, capacity)
WHERE f.slug = 'main-dock' AND f.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337'
ON CONFLICT DO NOTHING;

-- Woods End Marina - Segment C Virtual Slips (6 slips, children of Segment C)
INSERT INTO cc_inventory_units (tenant_id, facility_id, unit_type, display_label, parent_unit_id, sort_order, length_ft)
SELECT 
  'ff08964d-94b5-4076-850c-2d002e3fd337',
  parent.facility_id,
  'slip',
  'C-' || slip_num,
  parent.id,
  slip_num,
  28  -- ~28ft per slip
FROM cc_inventory_units parent,
generate_series(1, 6) AS slip_num
WHERE parent.display_label = 'Segment C' 
  AND parent.tenant_id = 'ff08964d-94b5-4076-850c-2d002e3fd337'
ON CONFLICT DO NOTHING;

-- Save Paradise Stalls (74 stalls)
INSERT INTO cc_inventory_units (tenant_id, facility_id, unit_type, display_label, sort_order)
SELECT 
  '7d8e6df5-bf12-4965-85a9-20b4312ce6c8',
  f.id,
  'stall',
  'Stall ' || stall_num,
  stall_num
FROM cc_facilities f,
generate_series(1, 74) AS stall_num
WHERE f.slug = 'main-lot' AND f.tenant_id = '7d8e6df5-bf12-4965-85a9-20b4312ce6c8'
ON CONFLICT DO NOTHING;

-- HFN Marina Slips (12 slips)
INSERT INTO cc_inventory_units (tenant_id, facility_id, unit_type, display_label, sort_order)
SELECT 
  '00000000-0000-0000-0001-000000000001',
  f.id,
  'slip',
  'Slip ' || slip_num,
  slip_num
FROM cc_facilities f,
generate_series(1, 12) AS slip_num
WHERE f.slug = 'hfn-dock' AND f.tenant_id = '00000000-0000-0000-0001-000000000001'
ON CONFLICT DO NOTHING;

-- Eileen Scott Park Zone Segments (3 segments)
INSERT INTO cc_inventory_units (tenant_id, facility_id, unit_type, display_label, sort_order, capacity_total)
SELECT 
  '00000000-0000-0000-0002-000000000001',
  f.id,
  'zone_segment',
  'Zone ' || UPPER(chr(64 + zone_num)), -- Zone A, Zone B, Zone C
  zone_num,
  20 -- approximate capacity per zone
FROM cc_facilities f,
generate_series(1, 3) AS zone_num
WHERE f.slug = 'gravel-overflow' AND f.tenant_id = '00000000-0000-0000-0002-000000000001'
ON CONFLICT DO NOTHING;

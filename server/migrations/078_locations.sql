BEGIN;

-- ============ LOCATIONS ============
-- Canonical registry of docks, marinas, trailheads, and stops

CREATE TABLE IF NOT EXISTS cc_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  
  location_type text NOT NULL CHECK (location_type IN (
    'dock', 'marina', 'trailhead', 'restaurant', 'lodging', 
    'yard', 'warehouse', 'campsite', 'ferry_terminal', 'seaplane_base', 'other'
  )),
  
  -- Geography
  lat numeric(9,6),
  lon numeric(9,6),
  region varchar DEFAULT 'Barkley Sound',
  timezone varchar DEFAULT 'America/Vancouver',
  
  -- Address (optional for remote locations)
  address_line1 text,
  address_city text,
  address_province varchar DEFAULT 'BC',
  address_postal_code varchar,
  
  -- Authority & eligibility
  authority_type varchar CHECK (authority_type IN (
    'harbour_authority', 'parks_canada', 'first_nation', 
    'municipal', 'provincial', 'private', 'federal'
  )),
  authority_name text,
  authority_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Capabilities (what can happen here)
  stop_capabilities jsonb NOT NULL DEFAULT '{
    "passenger_embark": true,
    "passenger_disembark": true,
    "freight_load": false,
    "freight_unload": false,
    "kayak_landing": false,
    "overnight_moorage": false,
    "fuel_available": false,
    "power_available": false,
    "water_available": false,
    "boat_launch": false
  }'::jsonb,
  
  -- Contact
  contact_name text,
  contact_phone text,
  contact_email text,
  
  -- Operational
  operating_hours_json jsonb DEFAULT '{}'::jsonb,
  
  -- Connections
  connected_locations uuid[],
  travel_time_minutes_json jsonb DEFAULT '{}'::jsonb,
  
  -- CivOS integration
  civos_location_id uuid,
  
  -- Media
  image_url text,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'seasonal', 'closed', 'maintenance')),
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cc_locations_type ON cc_locations(location_type, status);
CREATE INDEX IF NOT EXISTS idx_cc_locations_portal ON cc_locations(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_locations_authority ON cc_locations(authority_type) WHERE authority_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_locations_geo ON cc_locations(lat, lon) WHERE lat IS NOT NULL;

ALTER TABLE cc_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_locations_tenant_isolation ON cc_locations
  FOR ALL
  USING (
    tenant_id IS NULL 
    OR tenant_id::text = current_setting('app.current_tenant', true)
    OR current_setting('app.current_tenant', true) = '__SERVICE__'
  );

-- ============ SEED BAMFIELD LOCATIONS ============

DO $$
DECLARE
  v_portal_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  IF v_portal_id IS NULL THEN
    INSERT INTO cc_portals (slug, name, is_active)
    VALUES ('bamfield', 'Bamfield Community Portal', true)
    RETURNING id INTO v_portal_id;
  END IF;
  
  -- Port Alberni (Lady Rose departure point)
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Port Alberni Harbour Quay', 'PAHQ', 'ferry_terminal',
    49.2339, -124.8050,
    'municipal', 'City of Port Alberni',
    '{"lady_rose_terminal": true, "parking_available": true}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":false,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":true,"boat_launch":false}'::jsonb,
    'Main departure point for MV Frances Barkley'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Bamfield West Government Dock
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'West Government Dock', 'WGD', 'dock',
    48.8337, -125.1361,
    'harbour_authority', 'Bamfield Harbour Authority',
    '{"public_access": true, "time_limit_hours": 4}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":false,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":true,"boat_launch":false}'::jsonb,
    'West side main public dock - Lady Rose stop'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Bamfield East Government Dock  
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'East Government Dock', 'EGD', 'dock',
    48.8342, -125.1289,
    'harbour_authority', 'Bamfield Harbour Authority',
    '{"public_access": true, "time_limit_hours": 4}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":false,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":true,"boat_launch":false}'::jsonb,
    'East side main public dock - near general store'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Grappler Dock (boat launch)
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Grappler Inlet Dock', 'GID', 'dock',
    48.8298, -125.1195,
    'harbour_authority', 'Bamfield Harbour Authority',
    '{"boat_launch_fee": true, "daily_rate_cad": 15}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":true,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":false,"boat_launch":true}'::jsonb,
    'Public boat launch and kayak access'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Sechart (Broken Group staging)
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Sechart Whaling Station', 'SEC', 'dock',
    48.9167, -125.2167,
    'harbour_authority', 'Lady Rose Marine Services',
    '{"broken_group_staging": true, "kayak_rental": true}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":false,"freight_unload":false,"kayak_landing":true,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":false,"boat_launch":false}'::jsonb,
    'Historic whaling station - Broken Group Islands staging'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Ucluelet
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Ucluelet Small Craft Harbour', 'USCH', 'marina',
    48.9419, -125.5467,
    'harbour_authority', 'Ucluelet Harbour Authority',
    '{"transient_moorage": true}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":true,"overnight_moorage":true,"fuel_available":true,"power_available":true,"water_available":true,"boat_launch":true}'::jsonb,
    'Full-service marina - Lady Rose terminus option'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Woods End Marina
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Woods End Marina', 'WEM', 'marina',
    48.8340, -125.1340,
    'private', 'Woods End Marina Ltd',
    '{"reservation_required": true, "guest_priority": true}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":true,"overnight_moorage":true,"fuel_available":false,"power_available":true,"water_available":true,"boat_launch":false}'::jsonb,
    'Private marina - overnight moorage with power'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Pachena Bay (WCT trailhead)
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Pachena Bay Trailhead', 'PBT', 'trailhead',
    48.7833, -125.1167,
    'parks_canada', 'Pacific Rim National Park Reserve',
    '{"permit_required": true, "permit_type": "wct_backcountry", "quota_managed": true}'::jsonb,
    '{"passenger_embark":false,"passenger_disembark":true,"freight_load":false,"freight_unload":false,"kayak_landing":false,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":false,"boat_launch":false}'::jsonb,
    'West Coast Trail southern terminus - Parks Canada permit required'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
  -- Huu-ay-aht First Nation Dock
  INSERT INTO cc_locations (
    portal_id, name, code, location_type, lat, lon,
    authority_type, authority_name, authority_rules,
    stop_capabilities, notes
  ) VALUES (
    v_portal_id, 'Anacla Dock', 'ANA', 'dock',
    48.7917, -125.0917,
    'first_nation', 'Huu-ay-aht First Nations',
    '{"territory_notice": true, "respect_protocols": true}'::jsonb,
    '{"passenger_embark":true,"passenger_disembark":true,"freight_load":true,"freight_unload":true,"kayak_landing":true,"overnight_moorage":false,"fuel_available":false,"power_available":false,"water_available":false,"boat_launch":false}'::jsonb,
    'Huu-ay-aht First Nations territory - Anacla village'
  ) ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now();
  
END $$;

COMMIT;

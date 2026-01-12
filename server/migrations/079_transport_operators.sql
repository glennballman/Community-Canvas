BEGIN;

-- ============ TRANSPORT OPERATORS ============
-- Companies that provide transport services

CREATE TABLE IF NOT EXISTS cc_transport_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Identity
  name text NOT NULL,
  code varchar(10),
  
  operator_type text NOT NULL CHECK (operator_type IN (
    'ferry', 'water_taxi', 'charter', 'freight', 'shuttle', 'seaplane', 'other'
  )),
  
  -- Contact
  contact_name text,
  contact_phone text,
  contact_email text,
  website_url text,
  
  -- Business details
  business_license text,
  insurance_policy text,
  insurance_expiry date,
  
  -- Service area
  service_area_json jsonb DEFAULT '{}'::jsonb,
  
  -- Operating hours
  operating_hours_json jsonb DEFAULT '{}'::jsonb,
  
  -- Booking settings
  booking_settings_json jsonb DEFAULT '{}'::jsonb,
  
  -- Settlement
  settlement_method varchar DEFAULT 'invoice' CHECK (settlement_method IN (
    'stripe', 'invoice', 'etransfer', 'cash', 'account'
  )),
  settlement_account_json jsonb DEFAULT '{}'::jsonb,
  commission_percent numeric(5,2) DEFAULT 0,
  
  -- Integration
  external_booking_url text,
  api_endpoint text,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'seasonal', 'inactive', 'suspended')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cc_transport_ops_type ON cc_transport_operators(operator_type, status);
CREATE INDEX IF NOT EXISTS idx_cc_transport_ops_portal ON cc_transport_operators(portal_id) WHERE portal_id IS NOT NULL;

ALTER TABLE cc_transport_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_transport_operators_tenant_isolation ON cc_transport_operators
  FOR ALL
  USING (
    tenant_id IS NULL 
    OR tenant_id::text = current_setting('app.current_tenant', true)
    OR current_setting('app.current_tenant', true) = '__SERVICE__'
  );

-- ============ TRANSPORT ASSETS (Vessels/Vehicles) ============

CREATE TABLE IF NOT EXISTS cc_transport_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES cc_transport_operators(id) ON DELETE CASCADE,
  
  -- Identity
  name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN (
    'vessel', 'vehicle', 'bus', 'van', 'seaplane', 'other'
  )),
  
  -- Registration
  registration_number text,
  transport_canada_id text,
  hull_number text,
  
  -- Specifications
  specs_json jsonb DEFAULT '{}'::jsonb,
  
  -- Capacity
  capacity_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Capabilities
  capabilities_json jsonb DEFAULT '{}'::jsonb,
  
  -- Safety
  safety_json jsonb DEFAULT '{}'::jsonb,
  
  -- Media
  image_url text,
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN (
    'active', 'maintenance', 'seasonal', 'retired'
  )),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_transport_assets_operator ON cc_transport_assets(operator_id, status);

ALTER TABLE cc_transport_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_transport_assets_access ON cc_transport_assets
  FOR ALL
  USING (true);

-- ============ SEED OPERATORS & VESSELS ============

DO $$
DECLARE
  v_portal_id uuid;
  v_lrms_id uuid;
  v_bewt_id uuid;
  v_bwt_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  -- Lady Rose Marine Services (MV Frances Barkley)
  INSERT INTO cc_transport_operators (
    portal_id, name, code, operator_type,
    contact_phone, contact_email, website_url,
    service_area_json, operating_hours_json, booking_settings_json,
    status
  ) VALUES (
    v_portal_id, 'Lady Rose Marine Services', 'LRMS', 'ferry',
    '250-723-8313', 'info@ladyrosemarine.com', 'https://ladyrosemarine.com',
    '{
      "home_port": "PAHQ",
      "service_locations": ["PAHQ", "SEC", "WGD", "USCH"],
      "routes": [
        {"from": "PAHQ", "to": "SEC", "typical_minutes": 180, "name": "Broken Group"},
        {"from": "PAHQ", "to": "WGD", "typical_minutes": 240, "name": "Bamfield"},
        {"from": "PAHQ", "to": "USCH", "typical_minutes": 300, "name": "Ucluelet"}
      ]
    }'::jsonb,
    '{
      "seasonal": {
        "summer": {"months": [6,7,8,9], "departures": ["08:00"]},
        "shoulder": {"months": [5,10], "departures": ["08:00"], "days": [2,4,6]},
        "winter": {"months": [11,12,1,2,3,4], "departures": ["08:00"], "days": [2,6]}
      }
    }'::jsonb,
    '{
      "advance_booking_hours": 24,
      "cancellation_hours": 48,
      "deposit_percent": 0,
      "accepts_freight": true,
      "accepts_passengers": true,
      "accepts_kayaks": true,
      "kayak_fee_cad": 25
    }'::jsonb,
    'active'
  )
  ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_lrms_id;
  
  -- Bamfield Express Water Taxi
  INSERT INTO cc_transport_operators (
    portal_id, name, code, operator_type,
    contact_phone, contact_email,
    service_area_json, operating_hours_json, booking_settings_json,
    status
  ) VALUES (
    v_portal_id, 'Bamfield Express Water Taxi', 'BEWT', 'water_taxi',
    '250-728-3000', 'bamfieldexpress@gmail.com',
    '{
      "home_port": "WGD",
      "service_locations": ["WGD", "EGD", "GID", "SEC", "ANA", "PBT"],
      "on_demand": true,
      "charter_available": true
    }'::jsonb,
    '{
      "default": {"start": "07:00", "end": "20:00"},
      "on_call_after_hours": true,
      "emergency_available": true
    }'::jsonb,
    '{
      "advance_booking_hours": 2,
      "same_day_available": true,
      "cancellation_hours": 2,
      "deposit_percent": 0,
      "accepts_freight": true,
      "accepts_passengers": true,
      "min_charter_cad": 150
    }'::jsonb,
    'active'
  )
  ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_bewt_id;
  
  -- Broken Island Adventures Water Taxi
  INSERT INTO cc_transport_operators (
    portal_id, name, code, operator_type,
    contact_phone, contact_email,
    service_area_json, operating_hours_json, booking_settings_json,
    status
  ) VALUES (
    v_portal_id, 'Broken Island Adventures', 'BIA', 'water_taxi',
    '250-728-3500', 'info@brokenislandadventures.com',
    '{
      "home_port": "SEC",
      "service_locations": ["SEC", "WGD", "USCH"],
      "specialty": "broken_group_islands",
      "kayak_support": true
    }'::jsonb,
    '{
      "seasonal": {"months": [5,6,7,8,9]},
      "default": {"start": "07:00", "end": "19:00"}
    }'::jsonb,
    '{
      "advance_booking_hours": 24,
      "accepts_freight": false,
      "accepts_passengers": true,
      "kayak_transport": true,
      "camping_drops": true
    }'::jsonb,
    'seasonal'
  )
  ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_bwt_id;
  
  -- MV Frances Barkley (Lady Rose vessel)
  INSERT INTO cc_transport_assets (
    operator_id, name, asset_type,
    registration_number,
    specs_json, capacity_json, capabilities_json, safety_json,
    status
  ) VALUES (
    v_lrms_id, 'MV Frances Barkley', 'vessel',
    'CFN 12345',
    '{
      "length_ft": 128,
      "beam_ft": 26,
      "draft_ft": 8,
      "gross_tonnage": 312,
      "year_built": 1958,
      "manufacturer": "Burrard Dry Dock",
      "home_port": "Port Alberni"
    }'::jsonb,
    '{
      "passengers": 200,
      "crew": 6,
      "freight_lbs": 20000,
      "kayaks": 40,
      "bikes": 20,
      "wheelchairs": 4,
      "vehicle_deck": false
    }'::jsonb,
    '{
      "wheelchair_accessible": true,
      "covered_deck": true,
      "heated_cabin": true,
      "washroom": true,
      "food_service": true,
      "licensed_bar": true,
      "night_running": false,
      "radar": true,
      "ais": true
    }'::jsonb,
    '{
      "life_rafts": 4,
      "life_jackets": 250,
      "epirb": true,
      "last_inspection": "2025-05-15",
      "inspection_authority": "Transport Canada"
    }'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;
  
  -- Water Taxi vessel (BEWT)
  INSERT INTO cc_transport_assets (
    operator_id, name, asset_type,
    specs_json, capacity_json, capabilities_json,
    status
  ) VALUES (
    v_bewt_id, 'Bamfield Express I', 'vessel',
    '{
      "length_ft": 26,
      "beam_ft": 8,
      "year_built": 2018,
      "manufacturer": "Aluminum Marine",
      "engine": "Twin 200hp outboard"
    }'::jsonb,
    '{
      "passengers": 12,
      "crew": 1,
      "freight_lbs": 1500,
      "kayaks": 4,
      "bikes": 2,
      "wheelchairs": 0
    }'::jsonb,
    '{
      "wheelchair_accessible": false,
      "covered": true,
      "heated": false,
      "washroom": false,
      "radar": true,
      "vhf": true
    }'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;
  
  -- Broken Island Adventures vessel
  INSERT INTO cc_transport_assets (
    operator_id, name, asset_type,
    specs_json, capacity_json, capabilities_json,
    status
  ) VALUES (
    v_bwt_id, 'Island Hopper', 'vessel',
    '{
      "length_ft": 32,
      "beam_ft": 10,
      "year_built": 2015,
      "manufacturer": "Lifetimer Boats"
    }'::jsonb,
    '{
      "passengers": 18,
      "crew": 2,
      "freight_lbs": 2000,
      "kayaks": 12,
      "bikes": 0,
      "wheelchairs": 0
    }'::jsonb,
    '{
      "wheelchair_accessible": false,
      "covered": true,
      "kayak_rack": true,
      "camping_gear_storage": true
    }'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;
  
END $$;

COMMIT;

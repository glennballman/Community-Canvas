BEGIN;

-- ============ AUTHORITIES ============
-- Governing bodies that issue permits (Parks Canada, First Nations, etc.)

CREATE TABLE IF NOT EXISTS cc_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  authority_type varchar NOT NULL CHECK (authority_type IN (
    'parks_canada',      -- Federal parks
    'bc_parks',          -- Provincial parks
    'first_nation',      -- First Nations government
    'harbour_authority', -- Local harbour authority
    'municipality',      -- City/town
    'regional_district', -- Regional government
    'provincial',        -- Province of BC
    'federal',           -- Federal (other than parks)
    'private'            -- Private land/facility
  )),
  
  -- Jurisdiction
  jurisdiction_description text,
  jurisdiction_area_json jsonb DEFAULT '{}'::jsonb,
  -- {locations: [uuid], territories: ['Barkley Sound'], 
  --  geographic_bounds: {north: 49.0, south: 48.5, east: -124.5, west: -126.0}}
  
  -- Contact
  contact_name text,
  contact_title text,
  contact_phone text,
  contact_email text,
  website_url text,
  office_address text,
  
  -- Operating info
  office_hours_json jsonb DEFAULT '{}'::jsonb,
  -- {weekdays: {open: '08:30', close: '16:30'}, weekends: false,
  --  seasonal: [{months: [7,8], extended: true}]}
  
  -- Permit processing
  permit_processing_json jsonb DEFAULT '{}'::jsonb,
  -- {typical_days: 3, rush_available: true, rush_fee_cad: 50,
  --  online_applications: true, application_url: '...'}
  
  -- Integration
  api_endpoint text,
  api_key_encrypted text,
  integration_type varchar CHECK (integration_type IN (
    'api', 'email', 'manual', 'portal'
  )),
  
  -- Protocols (for First Nations)
  cultural_protocols_json jsonb DEFAULT '{}'::jsonb,
  -- {territory_acknowledgment: '...', 
  --  required_notices: ['entry', 'camping', 'fishing'],
  --  cultural_sites: [{name: '...', restrictions: '...'}]}
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'seasonal')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(portal_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cc_authorities_type ON cc_authorities(authority_type, status);
CREATE INDEX IF NOT EXISTS idx_cc_authorities_portal ON cc_authorities(portal_id) WHERE portal_id IS NOT NULL;

ALTER TABLE cc_authorities ENABLE ROW LEVEL SECURITY;

-- ============ PERMIT TYPES ============
-- Types of permits each authority can issue

CREATE TABLE IF NOT EXISTS cc_permit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES cc_authorities(id) ON DELETE CASCADE,
  
  -- Identity
  name text NOT NULL,
  code varchar(20),
  description text,
  
  -- Category
  permit_category varchar NOT NULL CHECK (permit_category IN (
    'access',           -- Trail/park access
    'backcountry',      -- Backcountry camping
    'day_use',          -- Day use only
    'fishing',          -- Fishing license
    'hunting',          -- Hunting license
    'commercial',       -- Commercial operation
    'filming',          -- Film/photo permit
    'research',         -- Research permit
    'event',            -- Special event
    'moorage',          -- Boat moorage
    'anchoring',        -- Anchoring permit
    'camping',          -- Campsite reservation
    'fire',             -- Fire permit
    'other'
  )),
  
  -- Requirements
  requirements_json jsonb DEFAULT '{}'::jsonb,
  -- {id_required: true, vessel_registration: false, 
  --  certifications: ['wilderness_first_aid'],
  --  minimum_age: 18, group_size_limit: 12}
  
  -- Pricing
  base_fee_cad numeric(10,2) DEFAULT 0,
  per_person_fee_cad numeric(10,2) DEFAULT 0,
  per_day_fee_cad numeric(10,2) DEFAULT 0,
  per_night_fee_cad numeric(10,2) DEFAULT 0,
  
  -- Booking rules
  booking_rules_json jsonb DEFAULT '{}'::jsonb,
  -- {advance_days_min: 1, advance_days_max: 90,
  --  max_duration_days: 14, quota_managed: true, daily_quota: 50,
  --  reservation_required: true}
  
  -- Validity
  validity_type varchar DEFAULT 'date_range' CHECK (validity_type IN (
    'date_range',   -- Valid for specific dates
    'duration',     -- Valid for X days from issue
    'calendar',     -- Calendar year
    'seasonal'      -- Seasonal (e.g., fishing season)
  )),
  default_validity_days integer DEFAULT 1,
  
  -- Documents
  document_template_url text,
  terms_and_conditions text,
  
  -- Seasonal availability
  seasonal_json jsonb DEFAULT '{}'::jsonb,
  -- {available_months: [5,6,7,8,9,10], 
  --  blackout_dates: ['2026-07-01', '2026-08-01']}
  
  -- Status
  status varchar DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'seasonal')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(authority_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cc_permit_types_authority ON cc_permit_types(authority_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_permit_types_category ON cc_permit_types(permit_category);

ALTER TABLE cc_permit_types ENABLE ROW LEVEL SECURITY;

-- ============ SEED BAMFIELD AUTHORITIES ============

DO $$
DECLARE
  v_portal_id uuid;
  v_parks_id uuid;
  v_hfn_id uuid;
  v_bha_id uuid;
BEGIN
  -- Get Bamfield portal
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  -- Parks Canada - Pacific Rim National Park Reserve
  INSERT INTO cc_authorities (
    portal_id, name, code, authority_type,
    jurisdiction_description,
    contact_phone, contact_email, website_url,
    office_hours_json, permit_processing_json,
    status
  ) VALUES (
    v_portal_id, 'Pacific Rim National Park Reserve', 'PRNPR', 'parks_canada',
    'West Coast Trail, Broken Group Islands, Long Beach Unit',
    '250-726-3500', 'pacrim.info@pc.gc.ca', 'https://parks.canada.ca/pn-np/bc/pacificrim',
    '{"weekdays": {"open": "08:00", "close": "16:30"}, "summer_extended": true}'::jsonb,
    '{"typical_days": 0, "online_applications": true, "reservation_system": "Parks Canada Reservation"}'::jsonb,
    'active'
  )
  ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_parks_id;
  
  -- Huu-ay-aht First Nations
  INSERT INTO cc_authorities (
    portal_id, name, code, authority_type,
    jurisdiction_description,
    contact_phone, contact_email, website_url,
    cultural_protocols_json,
    status
  ) VALUES (
    v_portal_id, 'Huu-ay-aht First Nations', 'HFN', 'first_nation',
    'Traditional territory including Bamfield area, Deer Group Islands, Diana Island',
    '250-728-3414', 'info@huuayaht.org', 'https://huuayaht.org',
    '{
      "territory_acknowledgment": "We acknowledge that we are on the traditional territory of the Huu-ay-aht First Nations",
      "required_notices": ["camping", "commercial_activity", "cultural_sites"],
      "cultural_protocol": "Visitors are asked to respect sacred sites and cultural areas",
      "welcome_figure": true
    }'::jsonb,
    'active'
  )
  ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_hfn_id;
  
  -- Bamfield Harbour Authority
  INSERT INTO cc_authorities (
    portal_id, name, code, authority_type,
    jurisdiction_description,
    contact_phone, contact_email,
    office_hours_json,
    status
  ) VALUES (
    v_portal_id, 'Bamfield Harbour Authority', 'BHA', 'harbour_authority',
    'Bamfield Inlet, government docks, boat launches',
    '250-728-3225', 'bamfieldha@gmail.com',
    '{"weekdays": {"open": "09:00", "close": "17:00"}, "summer": {"open": "08:00", "close": "18:00"}}'::jsonb,
    'active'
  )
  ON CONFLICT (portal_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_bha_id;
  
  -- Parks Canada permit types
  IF v_parks_id IS NOT NULL THEN
    -- West Coast Trail
    INSERT INTO cc_permit_types (
      authority_id, name, code, permit_category, description,
      base_fee_cad, per_person_fee_cad,
      requirements_json, booking_rules_json, seasonal_json,
      status
    ) VALUES (
      v_parks_id, 'West Coast Trail Permit', 'WCT', 'backcountry',
      'Required permit for hiking the 75km West Coast Trail',
      24.50, 127.50,
      '{"id_required": true, "orientation_required": true, "minimum_age": 0, "group_size_limit": 8}'::jsonb,
      '{"advance_days_min": 1, "advance_days_max": 90, "max_duration_days": 10, "quota_managed": true, "daily_quota": 60, "reservation_required": true}'::jsonb,
      '{"available_months": [5,6,7,8,9], "season_start": "May 1", "season_end": "September 30"}'::jsonb,
      'active'
    ) ON CONFLICT (authority_id, code) DO NOTHING;
    
    -- Broken Group Islands
    INSERT INTO cc_permit_types (
      authority_id, name, code, permit_category, description,
      base_fee_cad, per_night_fee_cad,
      requirements_json, booking_rules_json,
      status
    ) VALUES (
      v_parks_id, 'Broken Group Islands Camping', 'BGI', 'backcountry',
      'Backcountry camping permit for Broken Group Islands',
      11.50, 10.00,
      '{"id_required": true, "vessel_required": true, "kayak_experience_recommended": true}'::jsonb,
      '{"advance_days_max": 90, "max_duration_days": 14, "quota_managed": true}'::jsonb,
      'active'
    ) ON CONFLICT (authority_id, code) DO NOTHING;
  END IF;
  
  -- HFN permit types
  IF v_hfn_id IS NOT NULL THEN
    INSERT INTO cc_permit_types (
      authority_id, name, code, permit_category, description,
      base_fee_cad,
      requirements_json,
      status
    ) VALUES (
      v_hfn_id, 'Territory Access Notice', 'TAN', 'access',
      'Acknowledgment of entry into Huu-ay-aht traditional territory',
      0,
      '{"acknowledgment_required": true, "cultural_orientation_available": true}'::jsonb,
      'active'
    ) ON CONFLICT (authority_id, code) DO NOTHING;
    
    INSERT INTO cc_permit_types (
      authority_id, name, code, permit_category, description,
      per_night_fee_cad,
      status
    ) VALUES (
      v_hfn_id, 'Deer Group Camping', 'DGC', 'camping',
      'Camping on Deer Group Islands within HFN territory',
      15.00,
      'active'
    ) ON CONFLICT (authority_id, code) DO NOTHING;
  END IF;
  
  -- Harbour Authority permit types
  IF v_bha_id IS NOT NULL THEN
    INSERT INTO cc_permit_types (
      authority_id, name, code, permit_category, description,
      per_day_fee_cad,
      booking_rules_json,
      status
    ) VALUES (
      v_bha_id, 'Transient Moorage', 'TRM', 'moorage',
      'Short-term moorage at government docks',
      2.00,
      '{"advance_days_min": 0, "max_duration_days": 14}'::jsonb,
      'active'
    ) ON CONFLICT (authority_id, code) DO NOTHING;
    
    INSERT INTO cc_permit_types (
      authority_id, name, code, permit_category, description,
      base_fee_cad,
      status
    ) VALUES (
      v_bha_id, 'Boat Launch Permit', 'BLP', 'day_use',
      'Single-day boat launch access at Grappler',
      15.00,
      'active'
    ) ON CONFLICT (authority_id, code) DO NOTHING;
  END IF;
  
END $$;

COMMIT;

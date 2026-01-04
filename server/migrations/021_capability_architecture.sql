-- Migration 021: Capability-Based Architecture for Work Order Planning
-- 
-- ARCHITECTURE PRINCIPLE:
-- The 270-column staging_properties and 200-column trailer_profiles are GOLD.
-- They contain human-searchable attributes (coffee pot, hot tub, bedding).
-- 
-- We're NOT replacing those. We're adding:
-- 1. assets - lightweight identity layer that links everything
-- 2. asset_capabilities - operational capabilities for work order matching
-- 3. asset_terms - commercial terms
-- 4. asset_availability - weather-aware availability
-- 
-- The source tables REMAIN the source of truth for detailed attributes.

-- ============================================================================
-- PHASE 1A: Core Asset Registry (identity + linking)
-- ============================================================================

-- Lean identity table that links to detailed source tables
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classification
  asset_type TEXT NOT NULL,  -- 'property','spot','trailer','equipment','vehicle','vessel','camp'
  asset_subtype TEXT,        -- 'rv_park','cargo_trailer','skid_steer', etc.
  
  -- CRITICAL: Link to source tables where all the details live
  source_table TEXT NOT NULL,  -- 'staging_properties','trailer_profiles','cc_rental_items', etc.
  source_id TEXT NOT NULL,     -- ID in source table (as text for flexibility)
  
  -- Ownership
  owner_type TEXT DEFAULT 'platform',  -- 'individual','tenant','nation','platform'
  owner_individual_id UUID,
  owner_tenant_id UUID,
  owner_nation_id UUID,  -- for First Nation owned assets
  
  -- Identity
  canvas_id VARCHAR(20) UNIQUE,
  name TEXT NOT NULL,
  slug TEXT,
  
  -- Location (denormalized for geo queries)
  home_community_id UUID,
  region TEXT,
  city TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  geom GEOGRAPHY(POINT, 4326),  -- PostGIS for spatial queries
  
  -- Media (denormalized for listings)
  thumbnail_url TEXT,
  
  -- Scores (denormalized for sorting)
  crew_score INTEGER DEFAULT 0,
  family_score INTEGER DEFAULT 0,
  trucker_score INTEGER DEFAULT 0,
  equestrian_score INTEGER DEFAULT 0,
  overall_rating NUMERIC(3,2),
  review_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active',
  is_verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_type, owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_community ON assets(home_community_id);
CREATE INDEX IF NOT EXISTS idx_assets_geom ON assets USING gist(geom) WHERE geom IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_scores ON assets(crew_score DESC, overall_rating DESC);

-- ============================================================================
-- PHASE 1B: Asset Capabilities (for operational/work order matching)
-- ============================================================================

-- Operational capabilities - NOT for human browsing, for system matching
CREATE TABLE IF NOT EXISTS asset_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  capability_type TEXT NOT NULL,
  -- Standard capability types:
  -- 'sleeping'        - can accommodate people overnight
  -- 'parking'         - can park/store vehicles or trailers  
  -- 'power_supply'    - provides electrical power
  -- 'water_supply'    - provides water
  -- 'waste_handling'  - handles sewage/waste
  -- 'self_contained'  - operates without external hookups
  -- 'cold_weather'    - operates in extreme cold
  -- 'transportable'   - can be moved to site
  -- 'cooking'         - provides food preparation
  -- 'workspace'       - provides work area
  -- 'connectivity'    - provides internet/phone
  -- 'laundry'         - provides laundry facilities
  
  -- Capability parameters (what the capability provides)
  attributes JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- sleeping: { "people": 4, "private_bedrooms": 1, "comfort_days": 21 }
  -- parking: { "max_length_ft": 45, "surface": "gravel", "pull_through": true }
  -- cold_weather: { "min_temp_c": -40, "heating_btu": 30000 }
  -- self_contained: { "days_autonomy": 14, "fresh_water_l": 200 }
  
  -- Constraints (what's required to use this capability)
  constraints JSONB DEFAULT '{}',
  -- Examples:
  -- { "requires_hookup": true }
  -- { "requires_operator_cert": "class_1" }
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_asset ON asset_capabilities(asset_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_type ON asset_capabilities(capability_type);
CREATE INDEX IF NOT EXISTS idx_capabilities_attrs ON asset_capabilities USING gin(attributes);

-- ============================================================================
-- PHASE 1C: Asset Terms (commercial)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  -- Pricing
  rate_hourly NUMERIC,
  rate_half_day NUMERIC,
  rate_daily NUMERIC,
  rate_weekly NUMERIC,
  rate_monthly NUMERIC,
  currency TEXT DEFAULT 'CAD',
  
  -- Fees
  cleaning_fee NUMERIC DEFAULT 0,
  
  -- Deposits
  deposit_required NUMERIC DEFAULT 0,
  deposit_type TEXT DEFAULT 'per_booking',  -- 'per_booking','bond_eligible'
  
  -- Requirements
  waiver_template_ids UUID[],
  min_renter_age INTEGER DEFAULT 18,
  license_required TEXT,
  insurance_required BOOLEAN DEFAULT false,
  
  -- Booking rules
  min_nights INTEGER DEFAULT 1,
  max_nights INTEGER,
  instant_book BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_asset ON asset_terms(asset_id);

-- ============================================================================
-- PHASE 1D: Asset Availability (weather-aware)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  available_from DATE NOT NULL,
  available_until DATE NOT NULL,
  
  -- Location during this window (assets can move)
  location_community_id UUID,
  location_latitude NUMERIC(10,7),
  location_longitude NUMERIC(10,7),
  location_geom GEOGRAPHY(POINT, 4326),
  
  -- Weather constraints
  weather_constraints JSONB DEFAULT '{}',
  -- { "min_temp_c": -20, "ground_condition": ["frozen","dry"] }
  
  -- Access constraints  
  access_constraints JSONB DEFAULT '{}',
  -- { "road_access": true, "barge_schedule": "weekly" }
  
  booking_status TEXT DEFAULT 'available',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_asset ON asset_availability(asset_id);
CREATE INDEX IF NOT EXISTS idx_availability_dates ON asset_availability(available_from, available_until);

-- ============================================================================
-- PHASE 2: Work Orders (authority for jobs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_ref VARCHAR(30) UNIQUE,
  
  -- Location
  community_id UUID NOT NULL,
  site_description TEXT,
  site_latitude NUMERIC(10,7),
  site_longitude NUMERIC(10,7),
  site_geom GEOGRAPHY(POINT, 4326),
  
  -- Job details
  title TEXT NOT NULL,
  description TEXT,
  service_bundle_id UUID,
  scope_of_work TEXT,
  
  -- Customer
  customer_type TEXT,  -- 'individual','tenant','nation','government'
  customer_tenant_id UUID,
  customer_individual_id UUID,
  customer_contact_name TEXT,
  customer_contact_email TEXT,
  customer_contact_phone TEXT,
  
  -- Timing
  weather_window JSONB NOT NULL DEFAULT '{}',
  -- { "earliest_start": "2026-06-15", "latest_end": "2026-08-15", "constraints": {...} }
  estimated_duration_days INTEGER,
  
  -- Crew
  crew_size_min INTEGER DEFAULT 1,
  crew_size_max INTEGER,
  required_certifications TEXT[],
  
  -- Budget
  estimated_cost NUMERIC,
  quoted_price NUMERIC,
  deposit_required NUMERIC,
  deposit_received NUMERIC DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft',
  -- 'draft','planning','bidding','awarded','mobilizing','in_progress','complete','invoiced','paid'
  
  awarded_to_tenant_id UUID,
  awarded_at TIMESTAMPTZ,
  
  -- Bundling (neighbors sharing mobilization)
  is_bundleable BOOLEAN DEFAULT true,
  bundle_id UUID,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Generate work order ref on insert
CREATE OR REPLACE FUNCTION generate_work_order_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.work_order_ref IS NULL THEN
    NEW.work_order_ref := 'WO-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*10000))::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_order_ref ON work_orders;
CREATE TRIGGER trg_work_order_ref BEFORE INSERT ON work_orders
FOR EACH ROW EXECUTE FUNCTION generate_work_order_ref();

CREATE INDEX IF NOT EXISTS idx_work_orders_community ON work_orders(community_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_bundle ON work_orders(bundle_id) WHERE bundle_id IS NOT NULL;

-- ============================================================================
-- PHASE 2B: Work Order Requirements (what capabilities needed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_order_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  requirement_type TEXT NOT NULL,  -- 'accommodation','equipment','transport','material'
  capability_type TEXT,  -- 'sleeping','parking', etc.
  capability_requirements JSONB,  -- { "people": 3, "private_bedrooms": 1 }
  
  quantity INTEGER DEFAULT 1,
  needed_from_day INTEGER DEFAULT 1,
  needed_until_day INTEGER,
  
  -- Fulfillment
  fulfilled_by_asset_id UUID REFERENCES assets(id),
  fulfillment_status TEXT DEFAULT 'needed',  -- 'needed','searching','reserved','confirmed'
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_req_order ON work_order_requirements(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_req_capability ON work_order_requirements(capability_type);

-- ============================================================================
-- PHASE 2C: Work Order Materials (with logistics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_order_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'each',
  
  -- Logistics
  weight_kg NUMERIC,
  volume_m3 NUMERIC,
  transport_modes TEXT[],  -- ['truck','barge','floatplane']
  
  -- Sourcing
  supplier_entity_id UUID,
  supplier_lead_time_days INTEGER,
  order_cutoff_date DATE,
  
  -- Status
  status TEXT DEFAULT 'planned',  -- 'planned','ordered','shipped','received'
  estimated_cost NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_mat_order ON work_order_materials(work_order_id);

-- ============================================================================
-- PHASE 2D: Mobilization Plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS mobilization_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  staging_community_id UUID,
  staging_location TEXT,
  
  travel_segments JSONB,
  -- [{ "from": "Vancouver", "to": "Site", "mode": "barge", "days": 2 }]
  
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  
  risk_factors JSONB DEFAULT '{}',
  readiness_score INTEGER,  -- 0-100
  readiness_blockers TEXT[],
  
  status TEXT DEFAULT 'draft',  -- 'draft','approved','in_transit','on_site','demobilizing','complete'
  estimated_cost NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mob_work_order ON mobilization_plans(work_order_id);

-- ============================================================================
-- PHASE 3: Bonds (unified deposits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_ref VARCHAR(30) UNIQUE,
  
  guarantor_type TEXT NOT NULL,  -- 'individual','tenant','employer_backed'
  guarantor_individual_id UUID,
  guarantor_tenant_id UUID,
  backing_tenant_id UUID,  -- if employer-backed
  
  total_amount NUMERIC NOT NULL,
  max_claim_per_asset NUMERIC,
  currency TEXT DEFAULT 'CAD',
  
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  work_order_id UUID REFERENCES work_orders(id),
  
  payment_method TEXT,
  payment_confirmed_at TIMESTAMPTZ,
  
  amount_claimed NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',  -- 'pending','active','claimed','released','expired'
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generate bond ref on insert
CREATE OR REPLACE FUNCTION generate_bond_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bond_ref IS NULL THEN
    NEW.bond_ref := 'BOND-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*10000))::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bond_ref ON bonds;
CREATE TRIGGER trg_bond_ref BEFORE INSERT ON bonds
FOR EACH ROW EXECUTE FUNCTION generate_bond_ref();

CREATE INDEX IF NOT EXISTS idx_bonds_guarantor ON bonds(guarantor_individual_id);
CREATE INDEX IF NOT EXISTS idx_bonds_work_order ON bonds(work_order_id) WHERE work_order_id IS NOT NULL;

-- ============================================================================
-- PHASE 3B: Bond Claims
-- ============================================================================

CREATE TABLE IF NOT EXISTS bond_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_id UUID NOT NULL REFERENCES bonds(id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  
  claim_type TEXT NOT NULL,  -- 'damage','loss','cleaning','late_return'
  claim_amount NUMERIC NOT NULL,
  description TEXT,
  photos JSONB DEFAULT '[]',
  
  status TEXT DEFAULT 'filed',  -- 'filed','under_review','approved','paid','disputed','rejected'
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_bond ON bond_claims(bond_id);
CREATE INDEX IF NOT EXISTS idx_claims_asset ON bond_claims(asset_id);

-- ============================================================================
-- PHASE 3C: Asset Inspections
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  booking_id UUID,
  work_order_id UUID REFERENCES work_orders(id),
  
  inspection_type TEXT NOT NULL,  -- 'pre_use','post_use','periodic','damage_report'
  inspection_date TIMESTAMPTZ DEFAULT now(),
  
  inspector_individual_id UUID,
  inspector_name TEXT,
  overall_condition TEXT,  -- 'excellent','good','fair','poor','damaged'
  condition_details JSONB DEFAULT '{}',
  photos JSONB DEFAULT '[]',
  damage_noted BOOLEAN DEFAULT false,
  damage_description TEXT,
  
  signature_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspect_asset ON asset_inspections(asset_id);
CREATE INDEX IF NOT EXISTS idx_inspect_work_order ON asset_inspections(work_order_id) WHERE work_order_id IS NOT NULL;

-- ============================================================================
-- PHASE 4: Searchable Assets View (preserves attribute search!)
-- ============================================================================

-- View for searching with ALL attributes from source tables
-- Uses regex validation to safely cast source_id to the correct type per source table
CREATE OR REPLACE VIEW searchable_assets AS
SELECT 
  a.id,
  a.asset_type,
  a.asset_subtype,
  a.source_table,
  a.source_id,
  a.canvas_id,
  a.name,
  a.slug,
  a.owner_type,
  a.owner_individual_id,
  a.owner_tenant_id,
  a.owner_nation_id,
  a.home_community_id,
  a.region,
  a.city,
  a.latitude,
  a.longitude,
  a.geom,
  a.thumbnail_url,
  a.crew_score,
  a.family_score,
  a.trucker_score,
  a.equestrian_score,
  a.overall_rating,
  a.review_count,
  a.status,
  a.is_verified,
  
  -- Commercial terms (joined)
  t.rate_hourly,
  t.rate_half_day,
  t.rate_daily,
  t.rate_weekly,
  t.rate_monthly,
  t.cleaning_fee,
  t.deposit_required,
  t.deposit_type,
  t.min_nights,
  t.max_nights,
  t.instant_book,
  
  -- ALL the detailed attributes from staging_properties (integer id)
  CASE WHEN a.source_table = 'staging_properties' AND a.source_id ~ '^\d+$' THEN
    (SELECT row_to_json(sp.*)::jsonb FROM staging_properties sp WHERE sp.id = a.source_id::integer)
  ELSE NULL END as property_details,
  
  -- ALL the detailed attributes from trailer_profiles (UUID id)
  CASE WHEN a.source_table = 'trailer_profiles' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(tp.*)::jsonb FROM trailer_profiles tp WHERE tp.id = a.source_id::uuid)
  ELSE NULL END as trailer_details,
  
  -- ALL the detailed attributes from cc_rental_items (UUID id)
  CASE WHEN a.source_table = 'cc_rental_items' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(ri.*)::jsonb FROM cc_rental_items ri WHERE ri.id = a.source_id::uuid)
  ELSE NULL END as rental_details,
  
  -- ALL the detailed attributes from cc_vehicles (UUID id)
  CASE WHEN a.source_table = 'cc_vehicles' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(v.*)::jsonb FROM cc_vehicles v WHERE v.id = a.source_id::uuid)
  ELSE NULL END as vehicle_details,
  
  -- ALL the detailed attributes from external_records (UUID id)
  CASE WHEN a.source_table = 'external_records' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(er.*)::jsonb FROM external_records er WHERE er.id = a.source_id::uuid)
  ELSE NULL END as external_details,
  
  -- Aggregated capabilities for quick filtering
  (SELECT jsonb_agg(jsonb_build_object(
    'type', ac.capability_type, 
    'attrs', ac.attributes,
    'constraints', ac.constraints,
    'active', ac.is_active
  ))
   FROM asset_capabilities ac WHERE ac.asset_id = a.id AND ac.is_active = true) as capabilities

FROM assets a
LEFT JOIN asset_terms t ON t.asset_id = a.id
WHERE a.status = 'active';

-- ============================================================================
-- PHASE 5: Search Functions
-- ============================================================================

-- Find assets that can fulfill a capability requirement
CREATE OR REPLACE FUNCTION find_assets_by_capability(
  p_capability_type TEXT,
  p_min_attributes JSONB DEFAULT '{}',  -- e.g., {"people": 3}
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT 100,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  asset_id UUID,
  name TEXT,
  asset_type TEXT,
  capability_attributes JSONB,
  distance_km NUMERIC,
  rate_daily NUMERIC,
  thumbnail_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.asset_type,
    ac.attributes,
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND a.geom IS NOT NULL
      THEN ROUND((ST_Distance(a.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) / 1000)::numeric, 1)
      ELSE NULL
    END,
    t.rate_daily,
    a.thumbnail_url
  FROM assets a
  JOIN asset_capabilities ac ON ac.asset_id = a.id
  LEFT JOIN asset_terms t ON t.asset_id = a.id
  WHERE a.status = 'active'
    AND ac.capability_type = p_capability_type
    AND ac.is_active = true
    -- Check minimum attribute requirements
    AND (p_min_attributes = '{}' OR (
         (NOT p_min_attributes ? 'people' OR (ac.attributes->>'people')::int >= (p_min_attributes->>'people')::int) AND
         (NOT p_min_attributes ? 'private_bedrooms' OR (ac.attributes->>'private_bedrooms')::int >= (p_min_attributes->>'private_bedrooms')::int) AND
         (NOT p_min_attributes ? 'max_length_ft' OR (ac.attributes->>'max_length_ft')::int >= (p_min_attributes->>'max_length_ft')::int) AND
         (NOT p_min_attributes ? 'days_autonomy' OR (ac.attributes->>'days_autonomy')::int >= (p_min_attributes->>'days_autonomy')::int)
    ))
    -- Spatial filter
    AND (
      p_latitude IS NULL 
      OR p_longitude IS NULL 
      OR a.geom IS NULL
      OR ST_DWithin(a.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, p_radius_km * 1000)
    )
  ORDER BY 
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND a.geom IS NOT NULL
      THEN ST_Distance(a.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography)
      ELSE 0
    END,
    t.rate_daily ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Match work order requirements to available assets
CREATE OR REPLACE FUNCTION match_work_order_requirements(
  p_work_order_id UUID
)
RETURNS TABLE (
  requirement_id UUID,
  requirement_type TEXT,
  capability_type TEXT,
  matching_assets JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.requirement_type,
    r.capability_type,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'asset_id', a.id,
        'name', a.name,
        'asset_type', a.asset_type,
        'rate_daily', t.rate_daily,
        'thumbnail_url', a.thumbnail_url,
        'capability_attrs', ac.attributes
      ))
      FROM assets a
      JOIN asset_capabilities ac ON ac.asset_id = a.id
      LEFT JOIN asset_terms t ON t.asset_id = a.id
      WHERE a.status = 'active'
        AND ac.capability_type = r.capability_type
        AND ac.is_active = true
        -- Check requirements match
        AND (r.capability_requirements IS NULL OR (
          (NOT r.capability_requirements ? 'people' OR (ac.attributes->>'people')::int >= (r.capability_requirements->>'people')::int) AND
          (NOT r.capability_requirements ? 'private_bedrooms' OR (ac.attributes->>'private_bedrooms')::int >= (r.capability_requirements->>'private_bedrooms')::int)
        ))
      LIMIT 10
    ) as matching
  FROM work_order_requirements r
  WHERE r.work_order_id = p_work_order_id
    AND r.fulfillment_status = 'needed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 6: Migration Function (from unified_assets)
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_unified_to_capability_architecture()
RETURNS TABLE(assets_created INT, capabilities_created INT, terms_created INT) AS $$
DECLARE
  asset_count INT := 0;
  cap_count INT := 0;
  term_count INT := 0;
  ua RECORD;
  new_asset_id UUID;
BEGIN
  FOR ua IN SELECT * FROM unified_assets WHERE status = 'active' LOOP
    -- Create asset record
    INSERT INTO assets (
      asset_type, asset_subtype, source_table, source_id,
      owner_type, owner_individual_id, owner_tenant_id,
      canvas_id, name, slug,
      home_community_id, region, city, latitude, longitude, geom,
      thumbnail_url,
      crew_score, family_score, trucker_score, equestrian_score,
      overall_rating, review_count,
      status, is_verified
    ) VALUES (
      ua.asset_type, NULL, ua.source_table, ua.source_id,
      ua.owner_type, ua.owner_individual_id, ua.owner_tenant_id,
      ua.canvas_id, ua.name, ua.slug,
      ua.community_id, ua.region, ua.city, ua.latitude, ua.longitude, ua.geom,
      ua.thumbnail_url,
      ua.crew_score, ua.family_score, ua.trucker_score, ua.equestrian_score,
      ua.overall_rating, ua.review_count,
      'active', ua.is_verified
    )
    ON CONFLICT (source_table, source_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO new_asset_id;
    
    asset_count := asset_count + 1;
    
    -- Create sleeping capability if applicable
    IF COALESCE(ua.sleeps_total, 0) > 0 OR ua.is_accommodation THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'sleeping', jsonb_build_object(
        'people', COALESCE(ua.sleeps_total, 0),
        'private_bedrooms', COALESCE(ua.private_bedrooms, 0),
        'bedrooms', COALESCE(ua.bedrooms, 0)
      ))
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create parking capability if applicable
    IF ua.is_parkable_spot THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'parking', jsonb_build_object(
        'max_length_ft', ua.max_vehicle_length_ft,
        'max_height_ft', ua.max_vehicle_height_ft,
        'pull_through', ua.is_pull_through
      ))
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create power capability if applicable
    IF ua.has_power_hookup THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'power_supply', jsonb_build_object(
        'amps', ua.power_amps
      ))
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create water capability if applicable
    IF ua.has_water_hookup THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'water_supply', jsonb_build_object())
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create waste capability if applicable
    IF ua.has_sewer_hookup THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'waste_handling', jsonb_build_object())
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create self-contained capability if applicable
    IF ua.is_self_contained THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'self_contained', jsonb_build_object(
        'days_autonomy', ua.days_self_sufficient,
        'fresh_water_gallons', ua.fresh_water_gallons,
        'gray_water_gallons', ua.gray_water_gallons,
        'black_water_gallons', ua.black_water_gallons
      ))
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create transportable capability for towable assets
    IF ua.is_towable THEN
      INSERT INTO asset_capabilities (asset_id, capability_type, attributes)
      VALUES (new_asset_id, 'transportable', jsonb_build_object(
        'hitch_type', ua.hitch_type,
        'gvwr_lbs', ua.gvwr_lbs,
        'tongue_weight_lbs', ua.tongue_weight_lbs
      ))
      ON CONFLICT DO NOTHING;
      cap_count := cap_count + 1;
    END IF;
    
    -- Create commercial terms
    INSERT INTO asset_terms (
      asset_id,
      rate_hourly, rate_half_day, rate_daily, rate_weekly, rate_monthly,
      currency, deposit_required,
      min_nights
    ) VALUES (
      new_asset_id,
      ua.rate_hourly, ua.rate_half_day, ua.rate_daily, ua.rate_weekly, ua.rate_monthly,
      COALESCE(ua.currency, 'CAD'), COALESCE(ua.deposit_amount, 0),
      COALESCE(ua.min_booking_nights, 1)
    )
    ON CONFLICT DO NOTHING;
    term_count := term_count + 1;
    
  END LOOP;
  
  RETURN QUERY SELECT asset_count, cap_count, term_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE assets IS 'Lean identity table linking to detailed source tables (staging_properties, trailer_profiles, etc.)';
COMMENT ON TABLE asset_capabilities IS 'Operational capabilities for work order matching - NOT for human browsing';
COMMENT ON TABLE asset_terms IS 'Commercial terms: pricing, deposits, booking rules';
COMMENT ON TABLE asset_availability IS 'Weather-aware availability windows with location tracking';
COMMENT ON TABLE work_orders IS 'Authority for jobs with weather windows and capability requirements';
COMMENT ON TABLE work_order_requirements IS 'What capabilities are needed for each work order';
COMMENT ON TABLE work_order_materials IS 'Materials needed with logistics (weight, transport modes)';
COMMENT ON TABLE mobilization_plans IS 'Travel plans to get crew and equipment to site';
COMMENT ON TABLE bonds IS 'Unified security deposits that can cover multiple assets/work orders';
COMMENT ON TABLE bond_claims IS 'Claims against bonds for damage, loss, cleaning, etc.';
COMMENT ON TABLE asset_inspections IS 'Pre/post-use condition documentation with photos';
COMMENT ON VIEW searchable_assets IS 'Full attribute search joining assets to source tables for human-friendly queries';
COMMENT ON FUNCTION find_assets_by_capability IS 'Find assets matching capability requirements (for work order matching)';
COMMENT ON FUNCTION match_work_order_requirements IS 'Match all requirements of a work order to available assets';
COMMENT ON FUNCTION migrate_unified_to_capability_architecture IS 'Migrate data from unified_assets to new capability architecture';

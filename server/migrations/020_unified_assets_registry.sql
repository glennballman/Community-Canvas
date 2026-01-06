-- Migration 020: Unified Assets Registry
-- Unifies all rentable assets (properties, spots, trailers, vehicles, equipment)
-- into a single searchable system with unified bookings and traveler bonds

-- ============================================================================
-- PHASE 1: Create the Unified Assets Registry
-- ============================================================================

-- Table 1: unified_assets - Central registry linking to all existing asset tables
CREATE TABLE IF NOT EXISTS unified_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source Linking (which existing table has the details)
  asset_type VARCHAR(30) NOT NULL,  -- 'property', 'spot', 'trailer', 'vehicle', 'equipment', 'watercraft'
  source_table VARCHAR(50) NOT NULL,  -- 'staging_properties', 'staging_spots', 'trailer_profiles', 'cc_vehicles', 'cc_rental_items'
  source_id TEXT NOT NULL,  -- UUID or INTEGER as text
  
  -- Canonical Identity
  canvas_id VARCHAR(20) UNIQUE,  -- CC-ASSET-XXXXX
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(100),
  
  -- Ownership
  owner_type VARCHAR(20) NOT NULL DEFAULT 'platform',  -- 'individual', 'tenant', 'platform'
  owner_individual_id UUID REFERENCES cc_individuals(id),
  owner_tenant_id UUID REFERENCES cc_tenants(id),
  
  -- Location (denormalized for search)
  community_id UUID,  -- links to sr_communities
  region VARCHAR(100),
  city VARCHAR(100),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  -- geom column removed: using lat/lng with haversine functions (see migration 028)
  location_description TEXT,
  
  -- === ACCOMMODATION CAPABILITY ===
  is_accommodation BOOLEAN DEFAULT false,
  sleeps_total INTEGER,  -- total people that can sleep
  sleeps_comfortably INTEGER,  -- without pull-out couches
  bedrooms INTEGER,
  beds_king INTEGER DEFAULT 0,
  beds_queen INTEGER DEFAULT 0,
  beds_double INTEGER DEFAULT 0,
  beds_single INTEGER DEFAULT 0,
  beds_bunk INTEGER DEFAULT 0,
  beds_sofa INTEGER DEFAULT 0,  -- sofa beds / pull-outs
  
  -- Privacy (critical for crews - Grazi needs private space)
  private_bedrooms INTEGER DEFAULT 0,  -- bedrooms with doors that lock
  has_separate_entrance BOOLEAN DEFAULT false,
  
  -- Bathrooms
  bathrooms_full INTEGER DEFAULT 0,  -- toilet + shower/tub
  bathrooms_half INTEGER DEFAULT 0,  -- toilet only
  has_outdoor_shower BOOLEAN DEFAULT false,
  bathroom_private BOOLEAN DEFAULT false,  -- not shared with other guests
  
  -- === SELF-CONTAINED / BOONDOCKING CAPABILITY ===
  is_self_contained BOOLEAN DEFAULT false,  -- can operate without hookups
  fresh_water_gallons INTEGER,
  gray_water_gallons INTEGER,
  black_water_gallons INTEGER,
  propane_capacity_lbs INTEGER,
  battery_capacity_ah INTEGER,
  solar_watts INTEGER,
  generator_watts INTEGER,
  days_self_sufficient INTEGER,  -- estimated based on tanks/power
  
  -- === PARKING / SPOT CAPABILITY ===
  is_parkable_spot BOOLEAN DEFAULT false,  -- this IS a spot where things park
  can_be_parked BOOLEAN DEFAULT false,  -- this CAN be parked somewhere
  
  -- For spots: what can park here
  spot_length_ft INTEGER,
  spot_width_ft INTEGER,
  spot_surface VARCHAR(50),
  max_vehicle_length_ft INTEGER,
  max_vehicle_height_ft INTEGER,
  max_vehicle_weight_lbs INTEGER,
  is_pull_through BOOLEAN DEFAULT false,
  is_level BOOLEAN DEFAULT true,
  
  -- Hookups available (for spots)
  has_power_hookup BOOLEAN DEFAULT false,
  power_amps INTEGER[],  -- [15, 30, 50]
  has_water_hookup BOOLEAN DEFAULT false,
  has_sewer_hookup BOOLEAN DEFAULT false,
  
  -- Nearby facilities (for spots without their own bathrooms)
  bathroom_distance_meters INTEGER,  -- null if has own bathroom
  shower_distance_meters INTEGER,
  water_fill_distance_meters INTEGER,
  dump_station_distance_meters INTEGER,
  
  -- === TOWABLE / MOBILE ===
  is_towable BOOLEAN DEFAULT false,
  requires_tow_vehicle BOOLEAN DEFAULT false,
  hitch_type VARCHAR(50),
  gvwr_lbs INTEGER,
  tongue_weight_lbs INTEGER,
  
  -- === EQUIPMENT / TOOL ATTRIBUTES ===
  is_equipment BOOLEAN DEFAULT false,
  equipment_category_id UUID,
  brand VARCHAR(100),
  model VARCHAR(100),
  condition VARCHAR(20),
  
  -- === REQUIREMENTS ===
  waiver_template_ids UUID[],  -- which waivers required
  min_renter_age INTEGER DEFAULT 18,
  license_required VARCHAR(50),  -- 'none', 'drivers', 'motorcycle', 'class_1', 'boat'
  certification_required VARCHAR(100),  -- specific cert needed
  insurance_required BOOLEAN DEFAULT false,
  
  -- === PRICING ===
  rate_hourly NUMERIC,
  rate_half_day NUMERIC,
  rate_daily NUMERIC,
  rate_weekly NUMERIC,
  rate_monthly NUMERIC,
  deposit_amount NUMERIC DEFAULT 0,
  cleaning_fee NUMERIC DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'CAD',
  
  -- === AVAILABILITY ===
  is_available BOOLEAN DEFAULT true,
  available_from DATE,
  available_until DATE,
  min_booking_hours INTEGER DEFAULT 1,
  max_booking_days INTEGER,
  booking_lead_time_hours INTEGER DEFAULT 0,
  instant_book BOOLEAN DEFAULT false,
  
  -- === MEDIA ===
  thumbnail_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- === SCORES (denormalized for search) ===
  crew_score INTEGER DEFAULT 0,  -- 0-100
  family_score INTEGER DEFAULT 0,
  trucker_score INTEGER DEFAULT 0,
  equestrian_score INTEGER DEFAULT 0,
  overall_rating NUMERIC(3,2),
  review_count INTEGER DEFAULT 0,
  
  -- === STATUS ===
  status VARCHAR(30) DEFAULT 'active',  -- 'active', 'maintenance', 'retired', 'pending_approval'
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  -- === TIMESTAMPS ===
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicates
  UNIQUE(source_table, source_id)
);

-- Indexes for common searches
CREATE INDEX IF NOT EXISTS idx_unified_assets_type ON unified_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_unified_assets_accommodation ON unified_assets(is_accommodation) WHERE is_accommodation = true;
CREATE INDEX IF NOT EXISTS idx_unified_assets_lat ON unified_assets(latitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_assets_lng ON unified_assets(longitude) WHERE longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_assets_sleeps ON unified_assets(sleeps_total) WHERE sleeps_total > 0;
CREATE INDEX IF NOT EXISTS idx_unified_assets_community ON unified_assets(community_id);
CREATE INDEX IF NOT EXISTS idx_unified_assets_owner ON unified_assets(owner_type, owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_unified_assets_status ON unified_assets(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_unified_assets_parkable ON unified_assets(is_parkable_spot) WHERE is_parkable_spot = true;
CREATE INDEX IF NOT EXISTS idx_unified_assets_towable ON unified_assets(is_towable) WHERE is_towable = true;

-- ============================================================================
-- Table 2: traveler_bonds (Glenn's unified deposit idea)
-- ============================================================================

CREATE TABLE IF NOT EXISTS traveler_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who holds this bond
  individual_id UUID NOT NULL REFERENCES cc_individuals(id),
  
  -- Bond Details
  bond_amount NUMERIC NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',
  status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'active', 'released', 'claimed'
  
  -- Payment
  payment_method VARCHAR(30),  -- 'card_hold', 'etransfer', 'cash', 'company_account'
  payment_reference TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Coverage Period
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  
  -- Linked to work
  service_run_id UUID,  -- if bond is for a specific job
  trip_id UUID,  -- if bond is for a trip
  tenant_id UUID REFERENCES cc_tenants(id),  -- if employer is guaranteeing
  
  -- Claims/Deductions
  claims JSONB DEFAULT '[]',  -- array of {asset_id, amount, reason, date}
  total_claimed NUMERIC DEFAULT 0,
  
  -- Release
  released_at TIMESTAMPTZ,
  released_by UUID,
  release_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traveler_bonds_individual ON traveler_bonds(individual_id);
CREATE INDEX IF NOT EXISTS idx_traveler_bonds_status ON traveler_bonds(status);
CREATE INDEX IF NOT EXISTS idx_traveler_bonds_dates ON traveler_bonds(valid_from, valid_until);

-- ============================================================================
-- Table 3: bond_coverage - Track which bookings are covered by which bond
-- ============================================================================

CREATE TABLE IF NOT EXISTS bond_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_id UUID NOT NULL REFERENCES traveler_bonds(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL,  -- links to unified_bookings
  asset_id UUID NOT NULL REFERENCES unified_assets(id),
  coverage_amount NUMERIC NOT NULL,
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'released', 'claimed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_coverage_bond ON bond_coverage(bond_id);
CREATE INDEX IF NOT EXISTS idx_bond_coverage_booking ON bond_coverage(booking_id);

-- ============================================================================
-- Table 4: unified_bookings
-- ============================================================================

CREATE TABLE IF NOT EXISTS unified_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref VARCHAR(30) DEFAULT 'UB-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random()*10000)::text, 4, '0'),
  
  -- What's being booked
  asset_id UUID NOT NULL REFERENCES unified_assets(id),
  
  -- Who's booking
  booker_individual_id UUID REFERENCES cc_individuals(id),
  booker_tenant_id UUID REFERENCES cc_tenants(id),  -- if company booking
  
  -- Guest Details (may differ from booker)
  primary_guest_name VARCHAR(255) NOT NULL,
  primary_guest_email VARCHAR(255),
  primary_guest_phone VARCHAR(50),
  num_guests INTEGER DEFAULT 1,
  guest_names TEXT[],  -- all guest names
  
  -- Context
  booking_context VARCHAR(30) DEFAULT 'direct',  -- 'direct', 'service_run', 'trip', 'bundle'
  service_run_id UUID,
  trip_id UUID,
  
  -- Dates/Times
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  actual_checkin_at TIMESTAMPTZ,
  actual_checkout_at TIMESTAMPTZ,
  
  -- Pricing
  rate_type VARCHAR(20),  -- 'hourly', 'daily', 'weekly', 'monthly'
  rate_amount NUMERIC,
  nights_or_units INTEGER,
  subtotal NUMERIC,
  cleaning_fee NUMERIC DEFAULT 0,
  service_fee NUMERIC DEFAULT 0,
  taxes NUMERIC DEFAULT 0,
  total NUMERIC,
  
  -- Deposit/Bond
  deposit_required NUMERIC DEFAULT 0,
  bond_id UUID REFERENCES traveler_bonds(id),  -- if covered by bond instead of individual deposit
  deposit_paid BOOLEAN DEFAULT false,
  deposit_returned BOOLEAN DEFAULT false,
  
  -- Requirements Tracking
  waiver_required BOOLEAN DEFAULT false,
  waiver_signed BOOLEAN DEFAULT false,
  waiver_signed_at TIMESTAMPTZ,
  signed_waiver_id UUID,
  
  license_required BOOLEAN DEFAULT false,
  license_verified BOOLEAN DEFAULT false,
  license_document_id UUID,
  
  insurance_required BOOLEAN DEFAULT false,
  insurance_verified BOOLEAN DEFAULT false,
  
  ready_for_use BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show'
  payment_status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'partial', 'paid', 'refunded'
  
  -- Condition Tracking (for equipment/vehicles)
  condition_at_start TEXT,
  condition_at_end TEXT,
  photos_at_start JSONB DEFAULT '[]',
  photos_at_end JSONB DEFAULT '[]',
  damage_reported BOOLEAN DEFAULT false,
  damage_notes TEXT,
  
  -- Communication
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  special_requests TEXT,
  internal_notes TEXT,
  
  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  refund_amount NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_bookings_asset ON unified_bookings(asset_id);
CREATE INDEX IF NOT EXISTS idx_unified_bookings_dates ON unified_bookings(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_unified_bookings_status ON unified_bookings(status);
CREATE INDEX IF NOT EXISTS idx_unified_bookings_booker ON unified_bookings(booker_individual_id);
CREATE INDEX IF NOT EXISTS idx_unified_bookings_context ON unified_bookings(booking_context, service_run_id);
CREATE INDEX IF NOT EXISTS idx_unified_bookings_ref ON unified_bookings(booking_ref);

-- ============================================================================
-- PHASE 2: Create Sync Functions
-- ============================================================================

-- Function to sync staging_properties to unified_assets
CREATE OR REPLACE FUNCTION sync_staging_property_to_unified(property_id INTEGER)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  prop RECORD;
BEGIN
  SELECT * INTO prop FROM staging_properties WHERE id = property_id;
  
  IF prop IS NULL THEN
    RAISE EXCEPTION 'Staging property % not found', property_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    community_id, region, city, latitude, longitude,
    is_accommodation, sleeps_total, bedrooms,
    bathrooms_full,
    is_parkable_spot, spot_length_ft, spot_width_ft,
    max_vehicle_length_ft, max_vehicle_height_ft,
    has_power_hookup, power_amps, has_water_hookup, has_sewer_hookup,
    rate_daily, rate_weekly, rate_monthly,
    crew_score, family_score, trucker_score, equestrian_score,
    overall_rating, review_count,
    thumbnail_url, images, status
  ) VALUES (
    CASE WHEN prop.property_type IN ('rv_park', 'campground', 'parking_lot', 'industrial_yard', 'boondocking') 
         THEN 'spot' ELSE 'property' END,
    'staging_properties', property_id::text,
    prop.name, prop.description, lower(regexp_replace(prop.name, '[^a-zA-Z0-9]+', '-', 'g')),
    NULL, -- community_id needs lookup
    prop.region, prop.city, prop.latitude, prop.longitude,
    -- geom removed: using lat/lng with haversine functions
    COALESCE(prop.beds > 0 OR prop.bedrooms > 0, false),
    COALESCE(prop.max_guests, prop.beds),
    prop.bedrooms,
    COALESCE(prop.bathrooms, 0)::integer,
    prop.property_type IN ('rv_park', 'campground', 'parking_lot', 'industrial_yard', 'boondocking', 'marina'),
    prop.spot_length_ft, prop.spot_width_ft,
    prop.max_vehicle_length_ft, prop.max_vehicle_height_ft,
    prop.has_shore_power, prop.power_amps, prop.has_water_hookup, prop.has_sewer_hookup,
    NULL, NULL, NULL,  -- pricing from staging_pricing table
    prop.crew_score, prop.family_score, prop.trucker_score, prop.equestrian_score,
    prop.overall_rating, prop.review_count,
    prop.thumbnail_url, prop.images, 
    CASE WHEN prop.status = 'active' THEN 'active' ELSE 'pending_approval' END
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    sleeps_total = EXCLUDED.sleeps_total,
    crew_score = EXCLUDED.crew_score,
    overall_rating = EXCLUDED.overall_rating,
    review_count = EXCLUDED.review_count,
    thumbnail_url = EXCLUDED.thumbnail_url,
    images = EXCLUDED.images,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to sync staging_spots to unified_assets
CREATE OR REPLACE FUNCTION sync_staging_spot_to_unified(spot_id INTEGER)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  sp RECORD;
  prop RECORD;
BEGIN
  SELECT s.*, p.latitude, p.longitude, p.region, p.city, p.name as property_name
  INTO sp
  FROM staging_spots s
  LEFT JOIN staging_properties p ON s.property_id = p.id
  WHERE s.id = spot_id;
  
  IF sp IS NULL THEN
    RAISE EXCEPTION 'Staging spot % not found', spot_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    region, city, latitude, longitude,
    is_parkable_spot,
    spot_length_ft, spot_width_ft,
    max_vehicle_length_ft, max_vehicle_height_ft,
    is_pull_through, is_level,
    spot_surface,
    has_power_hookup, power_amps, has_water_hookup, has_sewer_hookup,
    rate_daily, rate_weekly, rate_monthly,
    status
  ) VALUES (
    'spot', 'staging_spots', spot_id::text,
    COALESCE(sp.spot_name, sp.property_name || ' - Spot ' || sp.spot_number),
    sp.notes,
    lower(regexp_replace(COALESCE(sp.spot_name, 'spot-' || spot_id::text), '[^a-zA-Z0-9]+', '-', 'g')),
    sp.region, sp.city, sp.latitude, sp.longitude,
    -- geom removed: using lat/lng with haversine functions
    true,
    COALESCE(sp.length_ft, sp.max_length_ft),
    COALESCE(sp.width_ft, sp.max_width_ft),
    sp.max_length_ft, sp.max_height_ft,
    COALESCE(sp.is_pull_through, false),
    COALESCE(sp.is_level, true),
    sp.surface_type,
    COALESCE(sp.has_power, false),
    CASE WHEN sp.power_amps IS NOT NULL THEN ARRAY[sp.power_amps] ELSE NULL END,
    COALESCE(sp.has_water, false),
    COALESCE(sp.has_sewer, false),
    sp.nightly_rate, sp.weekly_rate, sp.monthly_rate,
    CASE WHEN sp.status = 'available' AND sp.is_available THEN 'active' ELSE 'maintenance' END
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    spot_length_ft = EXCLUDED.spot_length_ft,
    spot_width_ft = EXCLUDED.spot_width_ft,
    rate_daily = EXCLUDED.rate_daily,
    rate_weekly = EXCLUDED.rate_weekly,
    rate_monthly = EXCLUDED.rate_monthly,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to sync trailer_profiles to unified_assets
CREATE OR REPLACE FUNCTION sync_trailer_to_unified(trailer_id UUID)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  t RECORD;
BEGIN
  SELECT * INTO t FROM trailer_profiles WHERE id = trailer_id;
  
  IF t IS NULL THEN
    RAISE EXCEPTION 'Trailer profile % not found', trailer_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description,
    owner_type, owner_tenant_id,
    brand, model,
    -- Accommodation
    is_accommodation,
    sleeps_total,
    sleeps_comfortably,
    bathrooms_full,
    bathroom_private,
    -- Self-contained
    is_self_contained,
    fresh_water_gallons,
    gray_water_gallons,
    black_water_gallons,
    propane_capacity_lbs,
    battery_capacity_ah,
    solar_watts,
    -- Towable
    is_towable, can_be_parked,
    hitch_type, gvwr_lbs, tongue_weight_lbs,
    -- Status
    status,
    thumbnail_url
  ) VALUES (
    'trailer', 'trailer_profiles', trailer_id::text,
    COALESCE(t.nickname, COALESCE(t.make, '') || ' ' || COALESCE(t.model, '')), t.notes,
    COALESCE(t.owner_type, 'tenant'), t.organization_id,
    t.make, t.model,
    -- Is accommodation if has sleeping capacity
    COALESCE(t.is_rv_trailer OR t.has_living_quarters, false),
    COALESCE(t.rv_sleep_capacity, t.lq_sleep_capacity, 0),
    COALESCE(t.lq_bed_count, 0),
    CASE WHEN t.lq_has_bathroom THEN 1 ELSE 0 END,
    true,  -- trailer bathrooms are always private
    -- Self-contained check
    COALESCE(t.fresh_water_gallons > 0 AND t.black_water_gallons > 0, false),
    t.fresh_water_gallons,
    t.gray_water_gallons,
    t.black_water_gallons,
    t.propane_capacity_lbs,
    t.battery_amp_hours,
    t.solar_watts,
    -- Towable
    true, true,
    t.hitch_type, t.gvwr_lbs, t.tongue_weight_lbs,
    CASE t.fleet_status WHEN 'available' THEN 'active' ELSE 'maintenance' END,
    t.primary_photo_url
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    sleeps_total = EXCLUDED.sleeps_total,
    sleeps_comfortably = EXCLUDED.sleeps_comfortably,
    is_self_contained = EXCLUDED.is_self_contained,
    fresh_water_gallons = EXCLUDED.fresh_water_gallons,
    status = EXCLUDED.status,
    thumbnail_url = EXCLUDED.thumbnail_url,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to sync cc_vehicles to unified_assets
CREATE OR REPLACE FUNCTION sync_vehicle_to_unified(vehicle_id UUID)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  v RECORD;
BEGIN
  SELECT * INTO v FROM cc_vehicles WHERE id = vehicle_id;
  
  IF v IS NULL THEN
    RAISE EXCEPTION 'Vehicle % not found', vehicle_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description,
    owner_type, owner_individual_id, owner_tenant_id,
    brand, model,
    -- RV-specific accommodation
    is_accommodation,
    sleeps_total,
    bathrooms_full,
    bathroom_private,
    -- Self-contained for RVs
    is_self_contained,
    fresh_water_gallons,
    gray_water_gallons,
    black_water_gallons,
    propane_capacity_lbs,
    solar_watts,
    generator_watts,
    -- Can be parked but not towable (it's self-propelled)
    can_be_parked,
    is_towable,
    -- Status
    status,
    thumbnail_url
  ) VALUES (
    CASE WHEN v.is_rv THEN 'vehicle_rv' ELSE 'vehicle' END,
    'cc_vehicles', vehicle_id::text,
    COALESCE(v.name, v.year::text || ' ' || COALESCE(v.make, '') || ' ' || COALESCE(v.model, '')),
    v.notes,
    v.owner_type, v.owner_user_id, v.owner_tenant_id,
    v.make, v.model,
    -- RV accommodation
    v.is_rv AND COALESCE(v.slide_outs, 0) > 0,
    CASE WHEN v.is_rv THEN v.passenger_capacity ELSE NULL END,
    CASE WHEN v.is_rv THEN 1 ELSE 0 END,
    true,
    -- Self-contained for RVs
    COALESCE(v.is_rv AND v.fresh_water_capacity_gal > 0, false),
    v.fresh_water_capacity_gal,
    v.gray_water_capacity_gal,
    v.black_water_capacity_gal,
    v.propane_capacity_lbs,
    v.solar_watts,
    v.generator_watts,
    -- Vehicles can be parked
    true,
    false,  -- vehicles are not towable (they tow others)
    CASE v.status WHEN 'available' THEN 'active' ELSE 'maintenance' END,
    v.primary_image_url
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    sleeps_total = EXCLUDED.sleeps_total,
    is_self_contained = EXCLUDED.is_self_contained,
    status = EXCLUDED.status,
    thumbnail_url = EXCLUDED.thumbnail_url,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to sync cc_rental_items to unified_assets
CREATE OR REPLACE FUNCTION sync_rental_item_to_unified(item_id UUID)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  r RECORD;
BEGIN
  SELECT * INTO r FROM cc_rental_items WHERE id = item_id;
  
  IF r IS NULL THEN
    RAISE EXCEPTION 'Rental item % not found', item_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    owner_individual_id, owner_tenant_id,
    owner_type,
    is_equipment, equipment_category_id,
    brand, model, condition,
    rate_hourly, rate_half_day, rate_daily, rate_weekly,
    deposit_amount,
    min_booking_hours,
    status, is_available,
    thumbnail_url, images
  ) VALUES (
    'equipment', 'cc_rental_items', item_id::text,
    r.name, r.description, r.slug,
    r.owner_individual_id, r.owner_tenant_id,
    CASE 
      WHEN r.owner_individual_id IS NOT NULL THEN 'individual'
      WHEN r.owner_tenant_id IS NOT NULL THEN 'tenant'
      ELSE 'platform'
    END,
    true, r.category_id,
    r.brand, r.model, r.condition,
    r.rate_hourly, r.rate_half_day, r.rate_daily, r.rate_weekly,
    r.damage_deposit,
    r.min_rental_hours,
    r.status, r.is_available,
    CASE WHEN jsonb_array_length(r.photos) > 0 THEN r.photos->0->>'url' ELSE NULL END,
    r.photos
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    condition = EXCLUDED.condition,
    rate_hourly = EXCLUDED.rate_hourly,
    rate_daily = EXCLUDED.rate_daily,
    rate_weekly = EXCLUDED.rate_weekly,
    deposit_amount = EXCLUDED.deposit_amount,
    status = EXCLUDED.status,
    is_available = EXCLUDED.is_available,
    thumbnail_url = EXCLUDED.thumbnail_url,
    images = EXCLUDED.images,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Master sync function to sync all existing assets
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_all_assets_to_unified()
RETURNS TABLE(
  source VARCHAR,
  synced_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  prop_count INTEGER := 0;
  prop_errors INTEGER := 0;
  spot_count INTEGER := 0;
  spot_errors INTEGER := 0;
  trailer_count INTEGER := 0;
  trailer_errors INTEGER := 0;
  vehicle_count INTEGER := 0;
  vehicle_errors INTEGER := 0;
  rental_count INTEGER := 0;
  rental_errors INTEGER := 0;
  rec RECORD;
BEGIN
  -- Sync staging_properties
  FOR rec IN SELECT id FROM staging_properties LOOP
    BEGIN
      PERFORM sync_staging_property_to_unified(rec.id);
      prop_count := prop_count + 1;
    EXCEPTION WHEN OTHERS THEN
      prop_errors := prop_errors + 1;
      RAISE NOTICE 'Error syncing property %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  source := 'staging_properties';
  synced_count := prop_count;
  error_count := prop_errors;
  RETURN NEXT;
  
  -- Sync staging_spots
  FOR rec IN SELECT id FROM staging_spots LOOP
    BEGIN
      PERFORM sync_staging_spot_to_unified(rec.id);
      spot_count := spot_count + 1;
    EXCEPTION WHEN OTHERS THEN
      spot_errors := spot_errors + 1;
      RAISE NOTICE 'Error syncing spot %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  source := 'staging_spots';
  synced_count := spot_count;
  error_count := spot_errors;
  RETURN NEXT;
  
  -- Sync trailer_profiles (only ones with sleeping capacity)
  FOR rec IN SELECT id FROM trailer_profiles WHERE is_rv_trailer = true OR has_living_quarters = true LOOP
    BEGIN
      PERFORM sync_trailer_to_unified(rec.id);
      trailer_count := trailer_count + 1;
    EXCEPTION WHEN OTHERS THEN
      trailer_errors := trailer_errors + 1;
      RAISE NOTICE 'Error syncing trailer %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  source := 'trailer_profiles';
  synced_count := trailer_count;
  error_count := trailer_errors;
  RETURN NEXT;
  
  -- Sync cc_vehicles
  FOR rec IN SELECT id FROM cc_vehicles LOOP
    BEGIN
      PERFORM sync_vehicle_to_unified(rec.id);
      vehicle_count := vehicle_count + 1;
    EXCEPTION WHEN OTHERS THEN
      vehicle_errors := vehicle_errors + 1;
      RAISE NOTICE 'Error syncing vehicle %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  source := 'cc_vehicles';
  synced_count := vehicle_count;
  error_count := vehicle_errors;
  RETURN NEXT;
  
  -- Sync cc_rental_items
  FOR rec IN SELECT id FROM cc_rental_items LOOP
    BEGIN
      PERFORM sync_rental_item_to_unified(rec.id);
      rental_count := rental_count + 1;
    EXCEPTION WHEN OTHERS THEN
      rental_errors := rental_errors + 1;
      RAISE NOTICE 'Error syncing rental item %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  source := 'cc_rental_items';
  synced_count := rental_count;
  error_count := rental_errors;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- View: All accommodations (anything that can sleep people)
CREATE OR REPLACE VIEW v_unified_accommodations AS
SELECT 
  ua.*,
  CASE 
    WHEN ua.asset_type = 'property' THEN 'Full Property'
    WHEN ua.asset_type = 'spot' THEN 'Campsite/RV Spot'
    WHEN ua.asset_type = 'trailer' THEN 'Trailer/RV'
    WHEN ua.asset_type = 'vehicle_rv' THEN 'Motorhome'
    ELSE 'Other'
  END as accommodation_type_display
FROM unified_assets ua
WHERE ua.is_accommodation = true
  AND ua.sleeps_total > 0
  AND ua.status = 'active';

-- View: All parking spots (places where you can park trailers/RVs)
CREATE OR REPLACE VIEW v_unified_parking AS
SELECT 
  ua.*,
  CASE 
    WHEN ua.has_power_hookup AND ua.has_water_hookup AND ua.has_sewer_hookup THEN 'Full Hookup'
    WHEN ua.has_power_hookup AND ua.has_water_hookup THEN 'Water/Electric'
    WHEN ua.has_power_hookup THEN 'Electric Only'
    ELSE 'Dry Camping'
  END as hookup_level
FROM unified_assets ua
WHERE ua.is_parkable_spot = true
  AND ua.status = 'active';

-- View: All towable assets (trailers that need a tow vehicle)
CREATE OR REPLACE VIEW v_unified_towables AS
SELECT 
  ua.*,
  CASE 
    WHEN ua.gvwr_lbs <= 3500 THEN 'Light'
    WHEN ua.gvwr_lbs <= 7000 THEN 'Medium'
    WHEN ua.gvwr_lbs <= 14000 THEN 'Heavy'
    ELSE 'Very Heavy'
  END as weight_class
FROM unified_assets ua
WHERE ua.is_towable = true
  AND ua.status = 'active';

-- View: Self-contained assets (can boondock without hookups)
CREATE OR REPLACE VIEW v_unified_self_contained AS
SELECT 
  ua.*,
  -- Estimate days of self-sufficiency based on tank sizes
  CASE 
    WHEN ua.fresh_water_gallons IS NULL THEN 0
    WHEN ua.fresh_water_gallons < 20 THEN 1
    WHEN ua.fresh_water_gallons < 50 THEN 3
    WHEN ua.fresh_water_gallons < 100 THEN 5
    ELSE 7
  END as estimated_days_water,
  CASE 
    WHEN ua.battery_capacity_ah IS NULL THEN 'None'
    WHEN ua.battery_capacity_ah < 100 THEN 'Basic'
    WHEN ua.battery_capacity_ah < 300 THEN 'Good'
    ELSE 'Excellent'
  END as power_capacity_rating
FROM unified_assets ua
WHERE ua.is_self_contained = true
  AND ua.status = 'active';

-- ============================================================================
-- Helper function to search across all assets
-- ============================================================================

CREATE OR REPLACE FUNCTION search_unified_assets(
  p_sleeps_min INTEGER DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_radius_km INTEGER DEFAULT 50,
  p_need_parking BOOLEAN DEFAULT NULL,
  p_max_vehicle_length INTEGER DEFAULT NULL,
  p_need_hookups BOOLEAN DEFAULT NULL,
  p_asset_types TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  asset_type VARCHAR,
  name VARCHAR,
  city VARCHAR,
  region VARCHAR,
  sleeps_total INTEGER,
  is_parkable_spot BOOLEAN,
  max_vehicle_length_ft INTEGER,
  has_power_hookup BOOLEAN,
  has_water_hookup BOOLEAN,
  has_sewer_hookup BOOLEAN,
  rate_daily NUMERIC,
  thumbnail_url TEXT,
  distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  -- Note: This placeholder function uses Euclidean approximation.
  -- Migration 028 replaces this with proper haversine-based geo functions.
  SELECT 
    ua.id,
    ua.asset_type,
    ua.name,
    ua.city,
    ua.region,
    ua.sleeps_total,
    ua.is_parkable_spot,
    ua.max_vehicle_length_ft,
    ua.has_power_hookup,
    ua.has_water_hookup,
    ua.has_sewer_hookup,
    ua.rate_daily,
    ua.thumbnail_url,
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ua.latitude IS NOT NULL AND ua.longitude IS NOT NULL
      THEN ROUND((111.32 * sqrt(power(ua.latitude - p_latitude, 2) + power((ua.longitude - p_longitude) * cos(radians(p_latitude)), 2)))::numeric, 1)
      ELSE NULL
    END as distance_km
  FROM unified_assets ua
  WHERE ua.status = 'active'
    AND (p_sleeps_min IS NULL OR ua.sleeps_total >= p_sleeps_min)
    AND (p_need_parking IS NULL OR ua.is_parkable_spot = p_need_parking)
    AND (p_max_vehicle_length IS NULL OR ua.max_vehicle_length_ft >= p_max_vehicle_length OR ua.max_vehicle_length_ft IS NULL)
    AND (p_need_hookups IS NULL OR (ua.has_power_hookup = true AND ua.has_water_hookup = true))
    AND (p_asset_types IS NULL OR ua.asset_type = ANY(p_asset_types))
    AND (
      p_latitude IS NULL 
      OR p_longitude IS NULL 
      OR ua.latitude IS NULL
      OR (111.32 * sqrt(power(ua.latitude - p_latitude, 2) + power((ua.longitude - p_longitude) * cos(radians(p_latitude)), 2))) <= p_radius_km
    )
  ORDER BY 
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ua.latitude IS NOT NULL AND ua.longitude IS NOT NULL
      THEN (111.32 * sqrt(power(ua.latitude - p_latitude, 2) + power((ua.longitude - p_longitude) * cos(radians(p_latitude)), 2)))
      ELSE 999999
    END,
    ua.crew_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to sync external_records (Airbnb/VRBO listings) to unified_assets
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_external_record_to_unified(record_id UUID)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  r RECORD;
  slug_val VARCHAR(100);
BEGIN
  SELECT * INTO r FROM external_records WHERE id = record_id;
  
  IF r IS NULL THEN
    RAISE EXCEPTION 'External record % not found', record_id;
  END IF;
  
  -- Generate slug and truncate to 100 chars
  slug_val := left(lower(regexp_replace(COALESCE(r.name, 'listing-' || record_id::text), '[^a-zA-Z0-9]+', '-', 'g')), 100);
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    owner_type,
    community_id, region, city, latitude, longitude,
    is_accommodation,
    sleeps_total,
    bedrooms,
    bathrooms_full,
    rate_daily,
    currency,
    overall_rating,
    review_count,
    status,
    is_verified,
    thumbnail_url,
    images
  ) VALUES (
    'property', 'external_records', record_id::text,
    r.name, r.description, slug_val,
    'platform',
    r.community_id, r.region, r.city, r.latitude, r.longitude,
    -- geom removed: using lat/lng with haversine functions
    true,
    COALESCE(r.max_occupancy, 1),
    r.bedrooms,
    COALESCE(r.bathrooms, 0)::integer,
    r.price,
    COALESCE(r.currency, 'CAD'),
    r.rating,
    r.review_count,
    'active',
    false,
    CASE WHEN jsonb_array_length(COALESCE(r.photos, '[]'::jsonb)) > 0 
         THEN r.photos->0->>'url' 
         ELSE NULL END,
    COALESCE(r.photos, '[]'::jsonb)
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sleeps_total = EXCLUDED.sleeps_total,
    bedrooms = EXCLUDED.bedrooms,
    rate_daily = EXCLUDED.rate_daily,
    overall_rating = EXCLUDED.overall_rating,
    review_count = EXCLUDED.review_count,
    thumbnail_url = EXCLUDED.thumbnail_url,
    images = EXCLUDED.images,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE unified_assets IS 'Central registry linking all rentable assets across staging_properties, staging_spots, trailer_profiles, cc_vehicles, cc_rental_items, and external_records';
COMMENT ON TABLE traveler_bonds IS 'Unified security deposits that can cover multiple bookings across different asset types';
COMMENT ON TABLE unified_bookings IS 'Single booking system for all asset types with consistent requirement tracking';
COMMENT ON FUNCTION sync_all_assets_to_unified() IS 'Master function to synchronize all existing assets into unified_assets table';
COMMENT ON FUNCTION search_unified_assets IS 'Multi-criteria search across all asset types with location filtering';
COMMENT ON FUNCTION sync_external_record_to_unified IS 'Sync external records (Airbnb/VRBO) to unified_assets';

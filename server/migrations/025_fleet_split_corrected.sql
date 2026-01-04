-- ============================================================================
-- MIGRATION 025 — FLEET SPLIT: PUBLIC CATALOG vs TENANT-OWNED FLEET (CORRECTED)
-- ============================================================================
-- Purpose:
--   Separate "world objects" (catalog, listings, imports) from tenant-owned
--   operational fleet records to eliminate scoping ambiguity and harden RLS.
--
-- ASSUMPTIONS (verified against actual schema 2026-01-03):
--   - vehicle_profiles.tenant_id exists (UUID, nullable, FK to cc_tenants)
--   - trailer_profiles.tenant_id exists (UUID, nullable, FK to cc_tenants)
--   - vehicle_photos.photo_url (not 'url')
--   - trailer_photos exists with photo_url column
--   - vehicle_profiles.drive_type (not 'drivetrain')
--   - vehicle_profiles.license_plate (not 'plate')
--   - RLS helper function is current_tenant_id() (not app_tenant_id())
--   - sr_communities table exists for home_community_id FK
--
-- Creates:
--   - vehicle_catalog, trailer_catalog (public, no RLS)
--   - catalog_listings (marketplace/scraped postings)
--   - tenant_vehicles, tenant_trailers (RLS-protected)
--   - tenant_vehicle_photos, tenant_trailer_photos (RLS-protected)
--
-- Migrates from existing:
--   - vehicle_profiles (tenant_id IS NULL) -> vehicle_catalog
--   - vehicle_profiles (tenant_id IS NOT NULL) -> tenant_vehicles
--   - trailer_profiles (tenant_id IS NULL) -> trailer_catalog
--   - trailer_profiles (tenant_id IS NOT NULL) -> tenant_trailers
--   - vehicle_photos (for tenant vehicles) -> tenant_vehicle_photos
--   - trailer_photos (for tenant trailers) -> tenant_trailer_photos
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Ensure pgcrypto for gen_random_uuid()
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) PUBLIC CATALOG: vehicle_catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (best-effort; may be partial for marketplace data)
  vin TEXT,
  serial_number TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  trim TEXT,

  -- Normalized characteristics
  vehicle_type TEXT,          -- 'truck','van','suv','car','bus','motorhome'
  vehicle_class TEXT,         -- matches vehicle_profiles.vehicle_class
  drive_type TEXT,            -- '2wd','4wd','awd' (was called drivetrain in orig migration)
  fuel_type TEXT,             -- 'gas','diesel','electric','hybrid'
  
  -- Weight/capacity (metric)
  payload_kg NUMERIC,
  tow_capacity_kg NUMERIC,
  gvwr_kg NUMERIC,

  -- Dimensions (metric)
  length_m NUMERIC,
  height_m NUMERIC,
  width_m NUMERIC,

  -- Source provenance
  source_system TEXT,         -- 'seed','auction','craigslist','facebook','manual'
  source_ref TEXT,            -- listing id / external id
  source_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Media
  thumbnail_url TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Preserve legacy ID for FK resolution
  legacy_vehicle_profile_id UUID,

  CONSTRAINT vehicle_catalog_vin_unique UNIQUE (vin),
  CONSTRAINT vehicle_catalog_source_unique UNIQUE (source_system, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_make_model_year ON vehicle_catalog(make, model, year);
CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_active ON vehicle_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_legacy_id ON vehicle_catalog(legacy_vehicle_profile_id);

COMMENT ON TABLE vehicle_catalog IS 'Public vehicle specifications catalog - no tenant ownership, no RLS';

-- ---------------------------------------------------------------------------
-- 2) PUBLIC CATALOG: trailer_catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trailer_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  serial_number TEXT,
  vin TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,

  trailer_type TEXT,          -- 'rv','cargo','horse','flatbed','toyhauler'
  trailer_type_class TEXT,    -- matches trailer_profiles.trailer_type_class
  hitch_type TEXT,            -- 'bumper','fifth_wheel','gooseneck','ball'
  
  -- Weight (metric)
  dry_weight_kg NUMERIC,
  gvwr_kg NUMERIC,
  
  -- Dimensions (metric)
  length_m NUMERIC,
  height_m NUMERIC,
  width_m NUMERIC,

  -- RV/camping traits (for worker travel planning)
  sleeps INTEGER,
  has_kitchen BOOLEAN,
  has_bathroom BOOLEAN,
  has_shower BOOLEAN,
  power_amps INTEGER,

  -- Source provenance
  source_system TEXT,
  source_ref TEXT,
  source_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Preserve legacy ID
  legacy_trailer_profile_id UUID,

  CONSTRAINT trailer_catalog_serial_unique UNIQUE (serial_number),
  CONSTRAINT trailer_catalog_source_unique UNIQUE (source_system, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_trailer_catalog_make_model_year ON trailer_catalog(make, model, year);
CREATE INDEX IF NOT EXISTS idx_trailer_catalog_active ON trailer_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_trailer_catalog_legacy_id ON trailer_catalog(legacy_trailer_profile_id);

COMMENT ON TABLE trailer_catalog IS 'Public trailer specifications catalog - no tenant ownership, no RLS';

-- ---------------------------------------------------------------------------
-- 3) CATALOG LISTINGS (Craigslist/FB/auction posts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  listing_type TEXT NOT NULL,        -- 'vehicle'|'trailer'|'accommodation'
  vehicle_catalog_id UUID REFERENCES vehicle_catalog(id) ON DELETE SET NULL,
  trailer_catalog_id UUID REFERENCES trailer_catalog(id) ON DELETE SET NULL,

  source_system TEXT NOT NULL,       -- 'craigslist','facebook','auction','dealer','manual'
  source_ref TEXT NOT NULL,          -- listing id
  source_url TEXT,
  title TEXT,
  description TEXT,

  price NUMERIC,
  currency TEXT DEFAULT 'CAD',
  location_text TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),

  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- 'active','sold','expired','removed'

  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT catalog_listings_source_unique UNIQUE (source_system, source_ref),
  CONSTRAINT catalog_listings_type_check CHECK (
    (listing_type = 'vehicle' AND vehicle_catalog_id IS NOT NULL AND trailer_catalog_id IS NULL)
    OR (listing_type = 'trailer' AND trailer_catalog_id IS NOT NULL AND vehicle_catalog_id IS NULL)
    OR (listing_type = 'accommodation')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_listings_status ON catalog_listings(status);
CREATE INDEX IF NOT EXISTS idx_catalog_listings_vehicle ON catalog_listings(vehicle_catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_listings_trailer ON catalog_listings(trailer_catalog_id);

COMMENT ON TABLE catalog_listings IS 'Marketplace listings from scraped sources - links to catalog items';

-- ---------------------------------------------------------------------------
-- 4) TENANT-OWNED: tenant_vehicles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  -- Optional link to catalog identity
  catalog_vehicle_id UUID REFERENCES vehicle_catalog(id) ON DELETE SET NULL,

  -- Operational identity fields (tenant truth)
  nickname TEXT,
  vin TEXT,
  license_plate TEXT,
  province TEXT,
  fleet_number TEXT,

  -- Operational readiness
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active', -- 'active','maintenance','retired'
  
  -- Optional community assignment
  -- NOTE: sr_communities may not exist in all deployments; FK added conditionally below
  home_community_id UUID,

  -- Store operational-specific data (maintenance, gear, insurance references)
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Preserve legacy ID for traceability
  legacy_vehicle_profile_id UUID,

  CONSTRAINT tenant_vehicles_tenant_vin_unique UNIQUE (tenant_id, vin),
  CONSTRAINT tenant_vehicles_tenant_plate_unique UNIQUE (tenant_id, license_plate)
);

CREATE INDEX IF NOT EXISTS idx_tenant_vehicles_tenant ON tenant_vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_vehicles_catalog ON tenant_vehicles(catalog_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tenant_vehicles_legacy ON tenant_vehicles(legacy_vehicle_profile_id);

-- Add FK to sr_communities if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sr_communities') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'tenant_vehicles_home_community_fk'
    ) THEN
      ALTER TABLE tenant_vehicles 
        ADD CONSTRAINT tenant_vehicles_home_community_fk 
        FOREIGN KEY (home_community_id) REFERENCES sr_communities(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE tenant_vehicles IS 'Tenant-owned operational vehicles with RLS enforcement';

-- ---------------------------------------------------------------------------
-- 5) TENANT-OWNED: tenant_trailers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  catalog_trailer_id UUID REFERENCES trailer_catalog(id) ON DELETE SET NULL,

  nickname TEXT,
  serial_number TEXT,
  vin TEXT,
  license_plate TEXT,
  province TEXT,
  fleet_number TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  home_community_id UUID,

  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  legacy_trailer_profile_id UUID,

  CONSTRAINT tenant_trailers_tenant_serial_unique UNIQUE (tenant_id, serial_number),
  CONSTRAINT tenant_trailers_tenant_plate_unique UNIQUE (tenant_id, license_plate)
);

CREATE INDEX IF NOT EXISTS idx_tenant_trailers_tenant ON tenant_trailers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_trailers_catalog ON tenant_trailers(catalog_trailer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_trailers_legacy ON tenant_trailers(legacy_trailer_profile_id);

-- Add FK to sr_communities if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sr_communities') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'tenant_trailers_home_community_fk'
    ) THEN
      ALTER TABLE tenant_trailers 
        ADD CONSTRAINT tenant_trailers_home_community_fk 
        FOREIGN KEY (home_community_id) REFERENCES sr_communities(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE tenant_trailers IS 'Tenant-owned operational trailers with RLS enforcement';

-- ---------------------------------------------------------------------------
-- 6) TENANT-OWNED: tenant_vehicle_photos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  tenant_vehicle_id UUID NOT NULL REFERENCES tenant_vehicles(id) ON DELETE CASCADE,

  photo_url TEXT NOT NULL,
  photo_type TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_vehicle_photos_vehicle ON tenant_vehicle_photos(tenant_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tenant_vehicle_photos_tenant ON tenant_vehicle_photos(tenant_id);

COMMENT ON TABLE tenant_vehicle_photos IS 'Photos for tenant-owned vehicles with RLS';

-- ---------------------------------------------------------------------------
-- 7) TENANT-OWNED: tenant_trailer_photos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_trailer_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  tenant_trailer_id UUID NOT NULL REFERENCES tenant_trailers(id) ON DELETE CASCADE,

  photo_url TEXT NOT NULL,
  photo_type TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_trailer_photos_trailer ON tenant_trailer_photos(tenant_trailer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_trailer_photos_tenant ON tenant_trailer_photos(tenant_id);

COMMENT ON TABLE tenant_trailer_photos IS 'Photos for tenant-owned trailers with RLS';

-- ---------------------------------------------------------------------------
-- 8) DATA MIGRATION: Public vehicles -> vehicle_catalog
-- ---------------------------------------------------------------------------
-- NOTE: Uses actual column names from vehicle_profiles
-- Converts imperial to metric where applicable

INSERT INTO vehicle_catalog (
  legacy_vehicle_profile_id,
  vin,
  make,
  model,
  year,
  vehicle_type,
  vehicle_class,
  drive_type,
  fuel_type,
  payload_kg,
  tow_capacity_kg,
  gvwr_kg,
  length_m,
  height_m,
  width_m,
  source_system,
  source_ref,
  thumbnail_url,
  raw,
  created_at,
  updated_at
)
SELECT
  vp.id,
  vp.vin,
  vp.make,
  vp.model,
  vp.year,
  -- Map vehicle_class to vehicle_type
  CASE 
    WHEN vp.vehicle_class IN ('truck', 'pickup') THEN 'truck'
    WHEN vp.vehicle_class IN ('van', 'cargo_van', 'cube_van') THEN 'van'
    WHEN vp.vehicle_class IN ('suv') THEN 'suv'
    WHEN vp.vehicle_class IN ('sedan', 'coupe') THEN 'car'
    ELSE vp.vehicle_class
  END,
  vp.vehicle_class,
  vp.drive_type,
  vp.fuel_type,
  -- Convert lbs to kg (1 lb = 0.453592 kg)
  CASE WHEN vp.payload_capacity_lbs IS NOT NULL THEN ROUND(vp.payload_capacity_lbs * 0.453592, 1) ELSE NULL END,
  CASE WHEN vp.towing_capacity_lbs IS NOT NULL THEN ROUND(vp.towing_capacity_lbs * 0.453592, 1) ELSE NULL END,
  CASE WHEN vp.gvwr_lbs IS NOT NULL THEN ROUND(vp.gvwr_lbs * 0.453592, 1) ELSE NULL END,
  -- Convert feet to meters (1 ft = 0.3048 m)
  CASE WHEN vp.length_feet IS NOT NULL THEN ROUND(vp.length_feet * 0.3048, 2) ELSE NULL END,
  CASE WHEN vp.height_feet IS NOT NULL THEN ROUND(vp.height_feet * 0.3048, 2) ELSE NULL END,
  CASE WHEN vp.width_feet IS NOT NULL THEN ROUND(vp.width_feet * 0.3048, 2) ELSE NULL END,
  'seed',
  vp.id::text,
  vp.primary_photo_url,
  jsonb_build_object(
    'legacy_id', vp.id,
    'owner_type', vp.owner_type,
    'color', vp.color,
    'passenger_capacity', vp.passenger_capacity
  ),
  COALESCE(vp.created_at, now()),
  COALESCE(vp.updated_at, now())
FROM vehicle_profiles vp
WHERE vp.tenant_id IS NULL
ON CONFLICT (source_system, source_ref) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9) DATA MIGRATION: Tenant vehicles -> tenant_vehicles
-- ---------------------------------------------------------------------------
INSERT INTO tenant_vehicles (
  tenant_id,
  catalog_vehicle_id,
  nickname,
  vin,
  license_plate,
  fleet_number,
  is_active,
  status,
  attributes,
  legacy_vehicle_profile_id,
  created_at,
  updated_at
)
SELECT
  vp.tenant_id,
  vc.id,
  COALESCE(vp.nickname, vp.make || ' ' || vp.model),
  vp.vin,
  vp.license_plate,
  vp.fleet_number,
  COALESCE(vp.paved_road_suitable, true), -- Use as proxy for is_active
  COALESCE(vp.fleet_status, 'active'),
  jsonb_build_object(
    'legacy_vehicle_profile_id', vp.id,
    'owner_type', vp.owner_type,
    'color', vp.color,
    'insurance_company', vp.insurance_company,
    'insurance_policy_number', vp.insurance_policy_number,
    'insurance_expiry', vp.insurance_expiry
  ),
  vp.id,
  COALESCE(vp.created_at, now()),
  COALESCE(vp.updated_at, now())
FROM vehicle_profiles vp
LEFT JOIN vehicle_catalog vc ON vc.legacy_vehicle_profile_id = vp.id
WHERE vp.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, vin) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10) DATA MIGRATION: Public trailers -> trailer_catalog
-- ---------------------------------------------------------------------------
INSERT INTO trailer_catalog (
  legacy_trailer_profile_id,
  serial_number,
  vin,
  make,
  model,
  year,
  trailer_type,
  trailer_type_class,
  hitch_type,
  dry_weight_kg,
  gvwr_kg,
  length_m,
  height_m,
  width_m,
  source_system,
  source_ref,
  thumbnail_url,
  raw,
  created_at,
  updated_at
)
SELECT
  tp.id,
  tp.vin, -- Use VIN as serial if no separate serial
  tp.vin,
  NULL, -- make not in current schema
  NULL, -- model not in current schema
  NULL, -- year not in current schema
  tp.trailer_type,
  tp.trailer_type_class,
  tp.hitch_type,
  CASE WHEN tp.empty_weight_lbs IS NOT NULL THEN ROUND(tp.empty_weight_lbs * 0.453592, 1) ELSE NULL END,
  CASE WHEN tp.gvwr_lbs IS NOT NULL THEN ROUND(tp.gvwr_lbs * 0.453592, 1) ELSE NULL END,
  CASE WHEN tp.length_feet IS NOT NULL THEN ROUND(tp.length_feet * 0.3048, 2) ELSE NULL END,
  CASE WHEN tp.height_feet IS NOT NULL THEN ROUND(tp.height_feet * 0.3048, 2) ELSE NULL END,
  CASE WHEN tp.width_feet IS NOT NULL THEN ROUND(tp.width_feet * 0.3048, 2) ELSE NULL END,
  'seed',
  tp.id::text,
  tp.primary_photo_url,
  jsonb_build_object(
    'legacy_id', tp.id,
    'owner_type', tp.owner_type,
    'color', tp.color,
    'brake_type', tp.brake_type
  ),
  COALESCE(tp.created_at, now()),
  COALESCE(tp.updated_at, now())
FROM trailer_profiles tp
WHERE tp.tenant_id IS NULL
ON CONFLICT (source_system, source_ref) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11) DATA MIGRATION: Tenant trailers -> tenant_trailers
-- ---------------------------------------------------------------------------
INSERT INTO tenant_trailers (
  tenant_id,
  catalog_trailer_id,
  nickname,
  serial_number,
  vin,
  license_plate,
  fleet_number,
  is_active,
  status,
  attributes,
  legacy_trailer_profile_id,
  created_at,
  updated_at
)
SELECT
  tp.tenant_id,
  tc.id,
  tp.nickname,
  tp.vin,
  tp.vin,
  tp.license_plate,
  tp.fleet_number,
  true,
  COALESCE(tp.fleet_status, 'active'),
  jsonb_build_object(
    'legacy_trailer_profile_id', tp.id,
    'owner_type', tp.owner_type,
    'color', tp.color,
    'insurance_company', tp.insurance_company,
    'insurance_policy_number', tp.insurance_policy_number,
    'insurance_expiry', tp.insurance_expiry
  ),
  tp.id,
  COALESCE(tp.created_at, now()),
  COALESCE(tp.updated_at, now())
FROM trailer_profiles tp
LEFT JOIN trailer_catalog tc ON tc.legacy_trailer_profile_id = tp.id
WHERE tp.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, serial_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 12) DATA MIGRATION: vehicle_photos -> tenant_vehicle_photos
-- ---------------------------------------------------------------------------
-- Only migrate photos for tenant-owned vehicles
INSERT INTO tenant_vehicle_photos (
  tenant_id,
  tenant_vehicle_id,
  photo_url,
  photo_type,
  thumbnail_url,
  caption,
  sort_order,
  uploaded_by,
  created_at
)
SELECT
  tv.tenant_id,
  tv.id,
  vph.photo_url,
  vph.photo_type,
  vph.thumbnail_url,
  vph.caption,
  COALESCE(vph.photo_order, 0),
  vph.taken_by,
  COALESCE(vph.created_at, now())
FROM vehicle_photos vph
JOIN tenant_vehicles tv ON tv.legacy_vehicle_profile_id = vph.vehicle_id
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 13) DATA MIGRATION: trailer_photos -> tenant_trailer_photos
-- ---------------------------------------------------------------------------
INSERT INTO tenant_trailer_photos (
  tenant_id,
  tenant_trailer_id,
  photo_url,
  photo_type,
  thumbnail_url,
  caption,
  sort_order,
  created_at
)
SELECT
  tt.tenant_id,
  tt.id,
  tph.photo_url,
  tph.photo_type,
  tph.thumbnail_url,
  tph.caption,
  COALESCE(tph.photo_order, 0),
  COALESCE(tph.created_at, now())
FROM trailer_photos tph
JOIN tenant_trailers tt ON tt.legacy_trailer_profile_id = tph.trailer_id
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 14) RLS POLICIES for tenant-owned tables
-- ---------------------------------------------------------------------------
-- Uses current_tenant_id() which exists in this codebase

ALTER TABLE tenant_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_trailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_trailer_photos ENABLE ROW LEVEL SECURITY;

-- tenant_vehicles policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicles_select') THEN
    CREATE POLICY tenant_vehicles_select ON tenant_vehicles FOR SELECT
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicles_insert') THEN
    CREATE POLICY tenant_vehicles_insert ON tenant_vehicles FOR INSERT
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicles_update') THEN
    CREATE POLICY tenant_vehicles_update ON tenant_vehicles FOR UPDATE
      USING (tenant_id = current_tenant_id() OR is_service_mode())
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicles_delete') THEN
    CREATE POLICY tenant_vehicles_delete ON tenant_vehicles FOR DELETE
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
END $$;

-- tenant_trailers policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailers_select') THEN
    CREATE POLICY tenant_trailers_select ON tenant_trailers FOR SELECT
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailers_insert') THEN
    CREATE POLICY tenant_trailers_insert ON tenant_trailers FOR INSERT
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailers_update') THEN
    CREATE POLICY tenant_trailers_update ON tenant_trailers FOR UPDATE
      USING (tenant_id = current_tenant_id() OR is_service_mode())
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailers_delete') THEN
    CREATE POLICY tenant_trailers_delete ON tenant_trailers FOR DELETE
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
END $$;

-- tenant_vehicle_photos policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicle_photos_select') THEN
    CREATE POLICY tenant_vehicle_photos_select ON tenant_vehicle_photos FOR SELECT
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicle_photos_insert') THEN
    CREATE POLICY tenant_vehicle_photos_insert ON tenant_vehicle_photos FOR INSERT
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicle_photos_update') THEN
    CREATE POLICY tenant_vehicle_photos_update ON tenant_vehicle_photos FOR UPDATE
      USING (tenant_id = current_tenant_id() OR is_service_mode())
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_vehicle_photos_delete') THEN
    CREATE POLICY tenant_vehicle_photos_delete ON tenant_vehicle_photos FOR DELETE
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
END $$;

-- tenant_trailer_photos policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailer_photos_select') THEN
    CREATE POLICY tenant_trailer_photos_select ON tenant_trailer_photos FOR SELECT
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailer_photos_insert') THEN
    CREATE POLICY tenant_trailer_photos_insert ON tenant_trailer_photos FOR INSERT
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailer_photos_update') THEN
    CREATE POLICY tenant_trailer_photos_update ON tenant_trailer_photos FOR UPDATE
      USING (tenant_id = current_tenant_id() OR is_service_mode())
      WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_trailer_photos_delete') THEN
    CREATE POLICY tenant_trailer_photos_delete ON tenant_trailer_photos FOR DELETE
      USING (tenant_id = current_tenant_id() OR is_service_mode());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 15) COMPATIBILITY VIEWS (optional - for gradual migration of API endpoints)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_vehicle_catalog_public AS
SELECT
  vc.id,
  NULL::uuid AS tenant_id,
  vc.vin,
  vc.make,
  vc.model,
  vc.year,
  vc.vehicle_type,
  vc.vehicle_class,
  vc.drive_type,
  vc.fuel_type,
  vc.payload_kg,
  vc.tow_capacity_kg,
  vc.gvwr_kg,
  vc.length_m,
  vc.height_m,
  vc.width_m,
  vc.thumbnail_url,
  vc.source_system,
  vc.source_ref,
  vc.source_url,
  vc.created_at,
  vc.updated_at
FROM vehicle_catalog vc
WHERE vc.is_active = true;

CREATE OR REPLACE VIEW v_trailer_catalog_public AS
SELECT
  tc.id,
  NULL::uuid AS tenant_id,
  tc.serial_number,
  tc.vin,
  tc.make,
  tc.model,
  tc.year,
  tc.trailer_type,
  tc.trailer_type_class,
  tc.hitch_type,
  tc.dry_weight_kg,
  tc.gvwr_kg,
  tc.length_m,
  tc.height_m,
  tc.width_m,
  tc.sleeps,
  tc.has_kitchen,
  tc.has_bathroom,
  tc.has_shower,
  tc.power_amps,
  tc.thumbnail_url,
  tc.source_system,
  tc.source_ref,
  tc.source_url,
  tc.created_at,
  tc.updated_at
FROM trailer_catalog tc
WHERE tc.is_active = true;

COMMIT;

-- ============================================================================
-- END MIGRATION 025 (CORRECTED)
-- ============================================================================

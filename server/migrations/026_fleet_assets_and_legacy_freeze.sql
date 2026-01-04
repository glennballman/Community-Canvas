-- ============================================================================
-- MIGRATION 026 — FLEET ASSETS LINKAGE & LEGACY FREEZE
-- ============================================================================
-- Purpose:
--   1. Add catalog_media table for public catalog media (photos, docs)
--   2. Add asset_id FK to tenant_vehicles and tenant_trailers
--   3. Auto-create assets rows via trigger on tenant_vehicles/tenant_trailers INSERT
--   4. Freeze legacy tables (rename to legacy_*) and preserve read-only views
--
-- Prerequisites:
--   - Migration 025 completed (vehicle_catalog, tenant_vehicles, etc. exist)
--   - assets table exists with required columns
--
-- ASSUMPTIONS:
--   - assets table exists with: id, asset_type, source_table, source_id, 
--     owner_tenant_id, name, tenant_id, status, visibility_scope
--   - vehicle_catalog and trailer_catalog exist from migration 025
--   - current_tenant_id() and is_service_mode() functions exist
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) CATALOG_MEDIA - Public media for catalog items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic link to catalog entities
  media_for TEXT NOT NULL CHECK (media_for IN ('vehicle', 'trailer', 'listing')),
  vehicle_catalog_id UUID REFERENCES vehicle_catalog(id) ON DELETE CASCADE,
  trailer_catalog_id UUID REFERENCES trailer_catalog(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES catalog_listings(id) ON DELETE CASCADE,
  
  -- Media details
  media_type TEXT NOT NULL DEFAULT 'photo', -- 'photo','document','video'
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  
  -- Source tracking
  source_system TEXT, -- 'scrape','upload','import'
  source_ref TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure only one FK is set based on media_for
  CONSTRAINT catalog_media_for_vehicle CHECK (
    media_for != 'vehicle' OR (vehicle_catalog_id IS NOT NULL AND trailer_catalog_id IS NULL AND listing_id IS NULL)
  ),
  CONSTRAINT catalog_media_for_trailer CHECK (
    media_for != 'trailer' OR (trailer_catalog_id IS NOT NULL AND vehicle_catalog_id IS NULL AND listing_id IS NULL)
  ),
  CONSTRAINT catalog_media_for_listing CHECK (
    media_for != 'listing' OR (listing_id IS NOT NULL AND vehicle_catalog_id IS NULL AND trailer_catalog_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_media_vehicle ON catalog_media(vehicle_catalog_id) WHERE vehicle_catalog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_media_trailer ON catalog_media(trailer_catalog_id) WHERE trailer_catalog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_media_listing ON catalog_media(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_media_type ON catalog_media(media_type);

COMMENT ON TABLE catalog_media IS 'Public media (photos, docs, videos) for catalog items - no RLS';

-- ---------------------------------------------------------------------------
-- 2) Add asset_id FK to tenant_vehicles
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_vehicles' AND column_name = 'asset_id'
  ) THEN
    ALTER TABLE tenant_vehicles ADD COLUMN asset_id UUID;
  END IF;
END $$;

-- Add FK constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tenant_vehicles_asset_fk' AND table_name = 'tenant_vehicles'
  ) THEN
    ALTER TABLE tenant_vehicles 
      ADD CONSTRAINT tenant_vehicles_asset_fk 
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_vehicles_asset ON tenant_vehicles(asset_id) WHERE asset_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Add asset_id FK to tenant_trailers
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_trailers' AND column_name = 'asset_id'
  ) THEN
    ALTER TABLE tenant_trailers ADD COLUMN asset_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tenant_trailers_asset_fk' AND table_name = 'tenant_trailers'
  ) THEN
    ALTER TABLE tenant_trailers 
      ADD CONSTRAINT tenant_trailers_asset_fk 
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_trailers_asset ON tenant_trailers(asset_id) WHERE asset_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Trigger function: auto-create asset for tenant_vehicles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tenant_vehicle_create_asset()
RETURNS TRIGGER AS $$
DECLARE
  v_asset_id UUID;
  v_name TEXT;
  v_make TEXT;
  v_model TEXT;
  v_year INTEGER;
BEGIN
  -- Build name from catalog if linked, otherwise use nickname
  IF NEW.catalog_vehicle_id IS NOT NULL THEN
    SELECT make, model, year INTO v_make, v_model, v_year
    FROM vehicle_catalog WHERE id = NEW.catalog_vehicle_id;
    
    v_name := COALESCE(
      NEW.nickname,
      TRIM(CONCAT_WS(' ', v_year::TEXT, v_make, v_model)),
      'Vehicle ' || LEFT(NEW.id::TEXT, 8)
    );
  ELSE
    v_name := COALESCE(
      NEW.nickname,
      'Vehicle ' || LEFT(NEW.id::TEXT, 8)
    );
  END IF;
  
  -- Create asset row
  INSERT INTO assets (
    asset_type,
    asset_subtype,
    source_table,
    source_id,
    owner_type,
    owner_tenant_id,
    tenant_id,
    name,
    status,
    visibility_scope,
    created_at,
    updated_at
  ) VALUES (
    'vehicle',
    'fleet',
    'tenant_vehicles',
    NEW.id::TEXT,
    'tenant',
    NEW.tenant_id,
    NEW.tenant_id,
    v_name,
    CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END,
    'tenant_only', -- Private to tenant
    NOW(),
    NOW()
  )
  RETURNING id INTO v_asset_id;
  
  -- Update the tenant_vehicle with the asset_id
  NEW.asset_id := v_asset_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_tenant_vehicle_create_asset() IS 'Auto-creates an asset row when a tenant_vehicle is inserted';

-- Create trigger (drop first if exists for idempotency)
DROP TRIGGER IF EXISTS trg_tenant_vehicle_create_asset ON tenant_vehicles;
CREATE TRIGGER trg_tenant_vehicle_create_asset
  BEFORE INSERT ON tenant_vehicles
  FOR EACH ROW
  WHEN (NEW.asset_id IS NULL)
  EXECUTE FUNCTION fn_tenant_vehicle_create_asset();

-- ---------------------------------------------------------------------------
-- 5) Trigger function: auto-create asset for tenant_trailers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tenant_trailer_create_asset()
RETURNS TRIGGER AS $$
DECLARE
  v_asset_id UUID;
  v_name TEXT;
  v_make TEXT;
  v_model TEXT;
  v_year INTEGER;
  v_trailer_type TEXT;
BEGIN
  -- Build name from catalog if linked, otherwise use nickname
  IF NEW.catalog_trailer_id IS NOT NULL THEN
    SELECT make, model, year, trailer_type INTO v_make, v_model, v_year, v_trailer_type
    FROM trailer_catalog WHERE id = NEW.catalog_trailer_id;
    
    v_name := COALESCE(
      NEW.nickname,
      TRIM(CONCAT_WS(' ', v_year::TEXT, v_make, v_model)),
      v_trailer_type || ' Trailer',
      'Trailer ' || LEFT(NEW.id::TEXT, 8)
    );
  ELSE
    v_name := COALESCE(
      NEW.nickname,
      'Trailer ' || LEFT(NEW.id::TEXT, 8)
    );
  END IF;
  
  -- Create asset row
  INSERT INTO assets (
    asset_type,
    asset_subtype,
    source_table,
    source_id,
    owner_type,
    owner_tenant_id,
    tenant_id,
    name,
    status,
    visibility_scope,
    created_at,
    updated_at
  ) VALUES (
    'trailer',
    'fleet',
    'tenant_trailers',
    NEW.id::TEXT,
    'tenant',
    NEW.tenant_id,
    NEW.tenant_id,
    v_name,
    CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END,
    'tenant_only',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_asset_id;
  
  NEW.asset_id := v_asset_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_tenant_trailer_create_asset() IS 'Auto-creates an asset row when a tenant_trailer is inserted';

DROP TRIGGER IF EXISTS trg_tenant_trailer_create_asset ON tenant_trailers;
CREATE TRIGGER trg_tenant_trailer_create_asset
  BEFORE INSERT ON tenant_trailers
  FOR EACH ROW
  WHEN (NEW.asset_id IS NULL)
  EXECUTE FUNCTION fn_tenant_trailer_create_asset();

-- ---------------------------------------------------------------------------
-- 6) LEGACY FREEZE: Rename original mixed tables if they still exist
-- ---------------------------------------------------------------------------
-- ASSUMPTION: We preserve data but mark tables as legacy. Views remain for reads.

-- Rename vehicle_profiles -> legacy_vehicle_profiles (if not already renamed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_profiles')
  THEN
    ALTER TABLE vehicle_profiles RENAME TO legacy_vehicle_profiles;
    RAISE NOTICE 'Renamed vehicle_profiles to legacy_vehicle_profiles';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_profiles') THEN
    RAISE NOTICE 'vehicle_profiles exists but legacy_vehicle_profiles also exists - skipping rename';
  ELSE
    RAISE NOTICE 'vehicle_profiles does not exist - already renamed or dropped';
  END IF;
END $$;

-- Rename trailer_profiles -> legacy_trailer_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_trailer_profiles')
  THEN
    ALTER TABLE trailer_profiles RENAME TO legacy_trailer_profiles;
    RAISE NOTICE 'Renamed trailer_profiles to legacy_trailer_profiles';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_profiles') THEN
    RAISE NOTICE 'trailer_profiles exists but legacy_trailer_profiles also exists - skipping rename';
  ELSE
    RAISE NOTICE 'trailer_profiles does not exist - already renamed or dropped';
  END IF;
END $$;

-- Rename vehicle_photos -> legacy_vehicle_photos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_photos')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_photos')
  THEN
    ALTER TABLE vehicle_photos RENAME TO legacy_vehicle_photos;
    RAISE NOTICE 'Renamed vehicle_photos to legacy_vehicle_photos';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_photos') THEN
    RAISE NOTICE 'vehicle_photos exists but legacy_vehicle_photos also exists - skipping rename';
  ELSE
    RAISE NOTICE 'vehicle_photos does not exist - already renamed or dropped';
  END IF;
END $$;

-- Rename trailer_photos -> legacy_trailer_photos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_photos')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_trailer_photos')
  THEN
    ALTER TABLE trailer_photos RENAME TO legacy_trailer_photos;
    RAISE NOTICE 'Renamed trailer_photos to legacy_trailer_photos';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_photos') THEN
    RAISE NOTICE 'trailer_photos exists but legacy_trailer_photos also exists - skipping rename';
  ELSE
    RAISE NOTICE 'trailer_photos does not exist - already renamed or dropped';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) READ-ONLY COMPATIBILITY VIEWS for legacy tables
-- ---------------------------------------------------------------------------
-- These allow old code to continue reading from the original table names

-- View: vehicle_profiles (read-only facade over legacy + catalog)
CREATE OR REPLACE VIEW vehicle_profiles AS
SELECT
  lvp.id,
  lvp.owner_type,
  lvp.owner_id,
  lvp.company_name,
  lvp.year,
  lvp.make,
  lvp.model,
  lvp.license_plate,
  lvp.vin,
  lvp.color,
  lvp.vehicle_class,
  lvp.drive_type,
  lvp.fuel_type,
  lvp.ground_clearance_inches,
  lvp.length_feet,
  lvp.height_feet,
  lvp.width_feet,
  lvp.weight_lbs,
  lvp.towing_capacity_lbs,
  lvp.passenger_capacity,
  lvp.cargo_capacity_cubic_feet,
  lvp.ferry_class,
  lvp.paved_road_suitable,
  lvp.good_gravel_suitable,
  lvp.rough_gravel_suitable,
  lvp.four_x_four_required_suitable,
  lvp.insurance_company,
  lvp.insurance_policy_number,
  lvp.insurance_expiry,
  lvp.created_at,
  lvp.updated_at,
  lvp.registration_expiry,
  lvp.organization_id,
  lvp.is_fleet_vehicle,
  lvp.assigned_driver_id,
  lvp.nickname,
  lvp.fleet_number,
  lvp.fleet_status,
  lvp.assigned_to_id,
  lvp.assigned_to_name,
  lvp.last_check_out,
  lvp.last_check_in,
  lvp.primary_photo_url,
  lvp.tenant_id
FROM legacy_vehicle_profiles lvp;

-- View: trailer_profiles (read-only facade over legacy)
CREATE OR REPLACE VIEW trailer_profiles AS
SELECT
  ltp.id,
  ltp.nickname,
  ltp.fleet_number,
  ltp.owner_type,
  ltp.organization_id,
  ltp.license_plate,
  ltp.registration_expiry,
  ltp.vin,
  ltp.trailer_type,
  ltp.length_feet,
  ltp.width_feet,
  ltp.height_feet,
  ltp.interior_length_feet,
  ltp.interior_width_feet,
  ltp.interior_height_feet,
  ltp.gvwr_lbs,
  ltp.empty_weight_lbs,
  ltp.payload_capacity_lbs,
  ltp.hitch_type,
  ltp.required_ball_size,
  ltp.tongue_weight_lbs,
  ltp.brake_type,
  ltp.wiring_type,
  ltp.gate_type,
  ltp.has_side_door,
  ltp.ramp_weight_capacity_lbs,
  ltp.has_roof_rack,
  ltp.has_tie_downs,
  ltp.tie_down_count,
  ltp.has_interior_lighting,
  ltp.has_electrical_outlets,
  ltp.has_ventilation,
  ltp.floor_type,
  ltp.fleet_status,
  ltp.currently_hitched_to,
  ltp.insurance_company,
  ltp.insurance_policy_number,
  ltp.insurance_expiry,
  ltp.color,
  ltp.primary_photo_url,
  ltp.notes,
  ltp.created_at,
  ltp.updated_at,
  ltp.trailer_type_class,
  ltp.coupler_type,
  ltp.coupler_height_inches,
  ltp.coupler_adjustable,
  ltp.tenant_id
FROM legacy_trailer_profiles ltp;

-- View: vehicle_photos (read-only facade over legacy)
CREATE OR REPLACE VIEW vehicle_photos AS
SELECT
  lvph.id,
  lvph.vehicle_id,
  lvph.photo_type,
  lvph.photo_url,
  lvph.thumbnail_url,
  lvph.photo_order,
  lvph.caption,
  lvph.taken_at,
  lvph.taken_by,
  lvph.created_at
FROM legacy_vehicle_photos lvph;

-- View: trailer_photos (read-only facade over legacy)
CREATE OR REPLACE VIEW trailer_photos AS
SELECT
  ltph.id,
  ltph.trailer_id,
  ltph.photo_type,
  ltph.photo_url,
  ltph.thumbnail_url,
  ltph.photo_order,
  ltph.caption,
  ltph.taken_at,
  ltph.created_at
FROM legacy_trailer_photos ltph;

COMMENT ON VIEW vehicle_profiles IS 'READ-ONLY compatibility view over legacy_vehicle_profiles. Use tenant_vehicles for new tenant data.';
COMMENT ON VIEW trailer_profiles IS 'READ-ONLY compatibility view over legacy_trailer_profiles. Use tenant_trailers for new tenant data.';
COMMENT ON VIEW vehicle_photos IS 'READ-ONLY compatibility view over legacy_vehicle_photos. Use tenant_vehicle_photos for new data.';
COMMENT ON VIEW trailer_photos IS 'READ-ONLY compatibility view over legacy_trailer_photos. Use tenant_trailer_photos for new data.';

-- ---------------------------------------------------------------------------
-- 8) Add INSTEAD OF triggers to make views truly read-only with clear errors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_readonly_view_error()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'This view is READ-ONLY. Use the new tenant_* tables for writes: tenant_vehicles, tenant_trailers, tenant_vehicle_photos, tenant_trailer_photos';
END;
$$ LANGUAGE plpgsql;

-- vehicle_profiles view - read-only
DROP TRIGGER IF EXISTS trg_vehicle_profiles_readonly ON vehicle_profiles;
CREATE TRIGGER trg_vehicle_profiles_readonly
  INSTEAD OF INSERT OR UPDATE OR DELETE ON vehicle_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_readonly_view_error();

-- trailer_profiles view - read-only
DROP TRIGGER IF EXISTS trg_trailer_profiles_readonly ON trailer_profiles;
CREATE TRIGGER trg_trailer_profiles_readonly
  INSTEAD OF INSERT OR UPDATE OR DELETE ON trailer_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_readonly_view_error();

-- vehicle_photos view - read-only
DROP TRIGGER IF EXISTS trg_vehicle_photos_readonly ON vehicle_photos;
CREATE TRIGGER trg_vehicle_photos_readonly
  INSTEAD OF INSERT OR UPDATE OR DELETE ON vehicle_photos
  FOR EACH ROW EXECUTE FUNCTION fn_readonly_view_error();

-- trailer_photos view - read-only
DROP TRIGGER IF EXISTS trg_trailer_photos_readonly ON trailer_photos;
CREATE TRIGGER trg_trailer_photos_readonly
  INSTEAD OF INSERT OR UPDATE OR DELETE ON trailer_photos
  FOR EACH ROW EXECUTE FUNCTION fn_readonly_view_error();

COMMIT;

-- ============================================================================
-- END MIGRATION 026
-- ============================================================================

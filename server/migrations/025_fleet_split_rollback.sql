-- ============================================================================
-- ROLLBACK MIGRATION 025 — FLEET SPLIT
-- ============================================================================
-- Purpose:
--   Safely undo migration 025 by:
--   1. Dropping new tables (if safe) OR renaming to _bak
--   2. Dropping views created
--   3. Leaving original tables intact
--
-- SAFETY:
--   - Only drops tables if they have no data OR all data came from migration
--   - Renames to _bak if data exists that wasn't from migration
--   - Does NOT touch original vehicle_profiles, trailer_profiles, etc.
-- ============================================================================

BEGIN;

\echo 'Starting Migration 025 Rollback...'

-- ---------------------------------------------------------------------------
-- 1) Drop compatibility views (safe - these are just views)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_vehicle_catalog_public CASCADE;
DROP VIEW IF EXISTS v_trailer_catalog_public CASCADE;

\echo 'Dropped compatibility views'

-- ---------------------------------------------------------------------------
-- 2) Handle tenant_vehicle_photos
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM tenant_vehicle_photos;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS tenant_vehicle_photos CASCADE;
    RAISE NOTICE 'Dropped tenant_vehicle_photos (was empty)';
  ELSE
    -- Check if all rows came from migration (have legacy reference in tenant_vehicles)
    IF NOT EXISTS (
      SELECT 1 FROM tenant_vehicle_photos tvp
      WHERE NOT EXISTS (
        SELECT 1 FROM tenant_vehicles tv 
        WHERE tv.id = tvp.tenant_vehicle_id 
          AND tv.legacy_vehicle_profile_id IS NOT NULL
      )
    ) THEN
      DROP TABLE IF EXISTS tenant_vehicle_photos CASCADE;
      RAISE NOTICE 'Dropped tenant_vehicle_photos (all data from migration)';
    ELSE
      ALTER TABLE tenant_vehicle_photos RENAME TO tenant_vehicle_photos_bak;
      RAISE NOTICE 'Renamed tenant_vehicle_photos to tenant_vehicle_photos_bak (has non-migrated data)';
    END IF;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'tenant_vehicle_photos does not exist, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 3) Handle tenant_trailer_photos
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM tenant_trailer_photos;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS tenant_trailer_photos CASCADE;
    RAISE NOTICE 'Dropped tenant_trailer_photos (was empty)';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM tenant_trailer_photos ttp
      WHERE NOT EXISTS (
        SELECT 1 FROM tenant_trailers tt 
        WHERE tt.id = ttp.tenant_trailer_id 
          AND tt.legacy_trailer_profile_id IS NOT NULL
      )
    ) THEN
      DROP TABLE IF EXISTS tenant_trailer_photos CASCADE;
      RAISE NOTICE 'Dropped tenant_trailer_photos (all data from migration)';
    ELSE
      ALTER TABLE tenant_trailer_photos RENAME TO tenant_trailer_photos_bak;
      RAISE NOTICE 'Renamed tenant_trailer_photos to tenant_trailer_photos_bak (has non-migrated data)';
    END IF;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'tenant_trailer_photos does not exist, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 4) Handle tenant_vehicles
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM tenant_vehicles;
  SELECT COUNT(*) INTO migrated_count FROM tenant_vehicles WHERE legacy_vehicle_profile_id IS NOT NULL;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS tenant_vehicles CASCADE;
    RAISE NOTICE 'Dropped tenant_vehicles (was empty)';
  ELSIF row_count = migrated_count THEN
    DROP TABLE IF EXISTS tenant_vehicles CASCADE;
    RAISE NOTICE 'Dropped tenant_vehicles (all data from migration)';
  ELSE
    ALTER TABLE tenant_vehicles RENAME TO tenant_vehicles_bak;
    RAISE NOTICE 'Renamed tenant_vehicles to tenant_vehicles_bak (% non-migrated rows)', row_count - migrated_count;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'tenant_vehicles does not exist, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 5) Handle tenant_trailers
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM tenant_trailers;
  SELECT COUNT(*) INTO migrated_count FROM tenant_trailers WHERE legacy_trailer_profile_id IS NOT NULL;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS tenant_trailers CASCADE;
    RAISE NOTICE 'Dropped tenant_trailers (was empty)';
  ELSIF row_count = migrated_count THEN
    DROP TABLE IF EXISTS tenant_trailers CASCADE;
    RAISE NOTICE 'Dropped tenant_trailers (all data from migration)';
  ELSE
    ALTER TABLE tenant_trailers RENAME TO tenant_trailers_bak;
    RAISE NOTICE 'Renamed tenant_trailers to tenant_trailers_bak (% non-migrated rows)', row_count - migrated_count;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'tenant_trailers does not exist, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 6) Handle catalog_listings
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM catalog_listings;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS catalog_listings CASCADE;
    RAISE NOTICE 'Dropped catalog_listings (was empty)';
  ELSE
    ALTER TABLE catalog_listings RENAME TO catalog_listings_bak;
    RAISE NOTICE 'Renamed catalog_listings to catalog_listings_bak (has % rows)', row_count;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'catalog_listings does not exist, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 7) Handle vehicle_catalog
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM vehicle_catalog;
  SELECT COUNT(*) INTO migrated_count FROM vehicle_catalog WHERE legacy_vehicle_profile_id IS NOT NULL;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS vehicle_catalog CASCADE;
    RAISE NOTICE 'Dropped vehicle_catalog (was empty)';
  ELSIF row_count = migrated_count THEN
    DROP TABLE IF EXISTS vehicle_catalog CASCADE;
    RAISE NOTICE 'Dropped vehicle_catalog (all data from migration)';
  ELSE
    ALTER TABLE vehicle_catalog RENAME TO vehicle_catalog_bak;
    RAISE NOTICE 'Renamed vehicle_catalog to vehicle_catalog_bak (% non-migrated rows)', row_count - migrated_count;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'vehicle_catalog does not exist, skipping';
END $$;

-- ---------------------------------------------------------------------------
-- 8) Handle trailer_catalog
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  row_count INTEGER;
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM trailer_catalog;
  SELECT COUNT(*) INTO migrated_count FROM trailer_catalog WHERE legacy_trailer_profile_id IS NOT NULL;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS trailer_catalog CASCADE;
    RAISE NOTICE 'Dropped trailer_catalog (was empty)';
  ELSIF row_count = migrated_count THEN
    DROP TABLE IF EXISTS trailer_catalog CASCADE;
    RAISE NOTICE 'Dropped trailer_catalog (all data from migration)';
  ELSE
    ALTER TABLE trailer_catalog RENAME TO trailer_catalog_bak;
    RAISE NOTICE 'Renamed trailer_catalog to trailer_catalog_bak (% non-migrated rows)', row_count - migrated_count;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'trailer_catalog does not exist, skipping';
END $$;

COMMIT;

\echo ''
\echo '=============================================='
\echo 'ROLLBACK COMPLETE'
\echo '=============================================='
\echo ''
\echo 'NOTE: Original tables (vehicle_profiles, trailer_profiles, etc.) are UNTOUCHED.'
\echo 'Any _bak tables contain data that was added after migration.'

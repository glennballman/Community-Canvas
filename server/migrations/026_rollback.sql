-- ============================================================================
-- ROLLBACK MIGRATION 026 — FLEET ASSETS & LEGACY FREEZE
-- ============================================================================
-- Purpose:
--   Safely undo migration 026:
--   1. Drop read-only triggers on views
--   2. Drop compatibility views
--   3. Rename legacy_* tables back to original names
--   4. Drop asset triggers and asset_id columns
--   5. Drop catalog_media table
--
-- SAFETY:
--   - Preserves all data in legacy tables
--   - Only drops catalog_media if empty or all data is from migration
-- ============================================================================

BEGIN;

\echo 'Starting Migration 026 Rollback...'

-- ---------------------------------------------------------------------------
-- 1) Drop read-only triggers on views
-- ---------------------------------------------------------------------------
\echo 'Dropping read-only triggers on views...'

DROP TRIGGER IF EXISTS trg_vehicle_profiles_readonly ON vehicle_profiles;
DROP TRIGGER IF EXISTS trg_trailer_profiles_readonly ON trailer_profiles;
DROP TRIGGER IF EXISTS trg_vehicle_photos_readonly ON vehicle_photos;
DROP TRIGGER IF EXISTS trg_trailer_photos_readonly ON trailer_photos;

DROP FUNCTION IF EXISTS fn_readonly_view_error() CASCADE;

\echo 'Dropped read-only triggers'

-- ---------------------------------------------------------------------------
-- 2) Drop compatibility views
-- ---------------------------------------------------------------------------
\echo 'Dropping compatibility views...'

DROP VIEW IF EXISTS vehicle_profiles CASCADE;
DROP VIEW IF EXISTS trailer_profiles CASCADE;
DROP VIEW IF EXISTS vehicle_photos CASCADE;
DROP VIEW IF EXISTS trailer_photos CASCADE;

\echo 'Dropped compatibility views'

-- ---------------------------------------------------------------------------
-- 3) Rename legacy tables back to original names
-- ---------------------------------------------------------------------------
\echo 'Restoring original table names...'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_profiles')
  THEN
    ALTER TABLE legacy_vehicle_profiles RENAME TO vehicle_profiles;
    RAISE NOTICE 'Renamed legacy_vehicle_profiles back to vehicle_profiles';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_trailer_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_profiles')
  THEN
    ALTER TABLE legacy_trailer_profiles RENAME TO trailer_profiles;
    RAISE NOTICE 'Renamed legacy_trailer_profiles back to trailer_profiles';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_photos')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_photos')
  THEN
    ALTER TABLE legacy_vehicle_photos RENAME TO vehicle_photos;
    RAISE NOTICE 'Renamed legacy_vehicle_photos back to vehicle_photos';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_trailer_photos')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_photos')
  THEN
    ALTER TABLE legacy_trailer_photos RENAME TO trailer_photos;
    RAISE NOTICE 'Renamed legacy_trailer_photos back to trailer_photos';
  END IF;
END $$;

\echo 'Restored original table names'

-- ---------------------------------------------------------------------------
-- 4) Drop asset creation triggers
-- ---------------------------------------------------------------------------
\echo 'Dropping asset creation triggers...'

DROP TRIGGER IF EXISTS trg_tenant_vehicle_create_asset ON tenant_vehicles;
DROP TRIGGER IF EXISTS trg_tenant_trailer_create_asset ON tenant_trailers;

DROP FUNCTION IF EXISTS fn_tenant_vehicle_create_asset() CASCADE;
DROP FUNCTION IF EXISTS fn_tenant_trailer_create_asset() CASCADE;

\echo 'Dropped asset creation triggers'

-- ---------------------------------------------------------------------------
-- 5) Remove asset_id columns from tenant tables
-- ---------------------------------------------------------------------------
\echo 'Removing asset_id columns...'

DO $$
BEGIN
  -- First drop the FK constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tenant_vehicles_asset_fk' AND table_name = 'tenant_vehicles'
  ) THEN
    ALTER TABLE tenant_vehicles DROP CONSTRAINT tenant_vehicles_asset_fk;
  END IF;
  
  -- Then drop the column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_vehicles' AND column_name = 'asset_id'
  ) THEN
    ALTER TABLE tenant_vehicles DROP COLUMN asset_id;
    RAISE NOTICE 'Dropped tenant_vehicles.asset_id';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tenant_trailers_asset_fk' AND table_name = 'tenant_trailers'
  ) THEN
    ALTER TABLE tenant_trailers DROP CONSTRAINT tenant_trailers_asset_fk;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_trailers' AND column_name = 'asset_id'
  ) THEN
    ALTER TABLE tenant_trailers DROP COLUMN asset_id;
    RAISE NOTICE 'Dropped tenant_trailers.asset_id';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_tenant_vehicles_asset;
DROP INDEX IF EXISTS idx_tenant_trailers_asset;

\echo 'Removed asset_id columns'

-- ---------------------------------------------------------------------------
-- 6) Handle catalog_media table
-- ---------------------------------------------------------------------------
\echo 'Handling catalog_media table...'

DO $$
DECLARE
  row_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_media') THEN
    RAISE NOTICE 'catalog_media does not exist, skipping';
    RETURN;
  END IF;
  
  SELECT COUNT(*) INTO row_count FROM catalog_media;
  
  IF row_count = 0 THEN
    DROP TABLE IF EXISTS catalog_media CASCADE;
    RAISE NOTICE 'Dropped catalog_media (was empty)';
  ELSE
    ALTER TABLE catalog_media RENAME TO catalog_media_bak;
    RAISE NOTICE 'Renamed catalog_media to catalog_media_bak (has % rows)', row_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) Clean up orphaned assets created by triggers
-- ---------------------------------------------------------------------------
\echo 'Cleaning up orphaned assets...'

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete assets that were auto-created for tenant_vehicles but no longer have a matching vehicle
  DELETE FROM assets 
  WHERE source_table = 'tenant_vehicles' 
    AND NOT EXISTS (
      SELECT 1 FROM tenant_vehicles tv WHERE tv.id::text = assets.source_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % orphaned vehicle assets', deleted_count;
  END IF;
  
  -- Delete assets for tenant_trailers
  DELETE FROM assets 
  WHERE source_table = 'tenant_trailers' 
    AND NOT EXISTS (
      SELECT 1 FROM tenant_trailers tt WHERE tt.id::text = assets.source_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % orphaned trailer assets', deleted_count;
  END IF;
END $$;

COMMIT;

\echo ''
\echo '=============================================='
\echo 'ROLLBACK COMPLETE'
\echo '=============================================='
\echo ''
\echo 'Original tables restored: vehicle_profiles, trailer_profiles, vehicle_photos, trailer_photos'
\echo 'If catalog_media had data, it was renamed to catalog_media_bak'

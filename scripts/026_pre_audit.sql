-- ============================================================================
-- PRE-MIGRATION AUDIT SCRIPT FOR MIGRATION 026
-- Run this BEFORE executing 026_fleet_assets_and_legacy_freeze.sql
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 026 PRE-FLIGHT AUDIT'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Check prerequisite tables from migration 025
-- ---------------------------------------------------------------------------
\echo '=== 1. PREREQUISITE TABLES (from 025) ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_catalog')
    THEN 'PASS: vehicle_catalog exists'
    ELSE 'FAIL: vehicle_catalog MISSING - run migration 025 first'
  END AS vehicle_catalog_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_catalog')
    THEN 'PASS: trailer_catalog exists'
    ELSE 'FAIL: trailer_catalog MISSING - run migration 025 first'
  END AS trailer_catalog_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_vehicles')
    THEN 'PASS: tenant_vehicles exists'
    ELSE 'FAIL: tenant_vehicles MISSING - run migration 025 first'
  END AS tenant_vehicles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_trailers')
    THEN 'PASS: tenant_trailers exists'
    ELSE 'FAIL: tenant_trailers MISSING - run migration 025 first'
  END AS tenant_trailers_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_listings')
    THEN 'PASS: catalog_listings exists'
    ELSE 'FAIL: catalog_listings MISSING - run migration 025 first'
  END AS catalog_listings_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Check assets table exists
-- ---------------------------------------------------------------------------
\echo '=== 2. ASSETS TABLE ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets')
    THEN 'PASS: assets table exists'
    ELSE 'FAIL: assets table MISSING'
  END AS assets_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'source_table'
  )
    THEN 'PASS: assets.source_table exists'
    ELSE 'FAIL: assets.source_table MISSING'
  END AS assets_source_table_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'owner_tenant_id'
  )
    THEN 'PASS: assets.owner_tenant_id exists'
    ELSE 'FAIL: assets.owner_tenant_id MISSING'
  END AS assets_owner_tenant_id_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) Check legacy tables to be renamed
-- ---------------------------------------------------------------------------
\echo '=== 3. LEGACY TABLES TO RENAME ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_profiles')
    THEN 'INFO: vehicle_profiles exists (will be renamed to legacy_vehicle_profiles)'
    ELSE 'INFO: vehicle_profiles does not exist (already renamed or dropped)'
  END AS vehicle_profiles_status;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_profiles')
    THEN 'INFO: trailer_profiles exists (will be renamed to legacy_trailer_profiles)'
    ELSE 'INFO: trailer_profiles does not exist (already renamed or dropped)'
  END AS trailer_profiles_status;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_photos')
    THEN 'INFO: vehicle_photos exists (will be renamed to legacy_vehicle_photos)'
    ELSE 'INFO: vehicle_photos does not exist (already renamed or dropped)'
  END AS vehicle_photos_status;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_photos')
    THEN 'INFO: trailer_photos exists (will be renamed to legacy_trailer_photos)'
    ELSE 'INFO: trailer_photos does not exist (already renamed or dropped)'
  END AS trailer_photos_status;

\echo ''

-- ---------------------------------------------------------------------------
-- 4) Check for existing asset_id columns
-- ---------------------------------------------------------------------------
\echo '=== 4. ASSET_ID COLUMNS (should not exist yet) ==='

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_vehicles' AND column_name = 'asset_id'
  )
    THEN 'INFO: tenant_vehicles.asset_id already exists (will be skipped)'
    ELSE 'OK: tenant_vehicles.asset_id does not exist (will be added)'
  END AS tenant_vehicles_asset_id_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_trailers' AND column_name = 'asset_id'
  )
    THEN 'INFO: tenant_trailers.asset_id already exists (will be skipped)'
    ELSE 'OK: tenant_trailers.asset_id does not exist (will be added)'
  END AS tenant_trailers_asset_id_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 5) Row counts in new tables
-- ---------------------------------------------------------------------------
\echo '=== 5. ROW COUNTS IN NEW TABLES ==='

SELECT 'vehicle_catalog' AS table_name, COUNT(*) AS count FROM vehicle_catalog;
SELECT 'trailer_catalog' AS table_name, COUNT(*) AS count FROM trailer_catalog;
SELECT 'tenant_vehicles' AS table_name, COUNT(*) AS count FROM tenant_vehicles;
SELECT 'tenant_trailers' AS table_name, COUNT(*) AS count FROM tenant_trailers;
SELECT 'assets' AS table_name, COUNT(*) AS count FROM assets;

\echo ''

-- ---------------------------------------------------------------------------
-- 6) Row counts in legacy tables (if exist)
-- ---------------------------------------------------------------------------
\echo '=== 6. ROW COUNTS IN LEGACY TABLES ==='

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_profiles') THEN
    RAISE NOTICE 'vehicle_profiles: % rows', (SELECT COUNT(*) FROM vehicle_profiles);
  ELSE
    RAISE NOTICE 'vehicle_profiles: does not exist';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_profiles') THEN
    RAISE NOTICE 'trailer_profiles: % rows', (SELECT COUNT(*) FROM trailer_profiles);
  ELSE
    RAISE NOTICE 'trailer_profiles: does not exist';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_photos') THEN
    RAISE NOTICE 'vehicle_photos: % rows', (SELECT COUNT(*) FROM vehicle_photos);
  ELSE
    RAISE NOTICE 'vehicle_photos: does not exist';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_photos') THEN
    RAISE NOTICE 'trailer_photos: % rows', (SELECT COUNT(*) FROM trailer_photos);
  ELSE
    RAISE NOTICE 'trailer_photos: does not exist';
  END IF;
END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 7) Check for potential conflicts
-- ---------------------------------------------------------------------------
\echo '=== 7. CONFLICT CHECK ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_media')
    THEN 'WARNING: catalog_media already exists (will be skipped)'
    ELSE 'OK: catalog_media does not exist'
  END AS catalog_media_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_profiles')
    THEN 'WARNING: legacy_vehicle_profiles already exists (rename will be skipped)'
    ELSE 'OK: legacy_vehicle_profiles does not exist'
  END AS legacy_vehicle_profiles_check;

\echo ''
\echo '=============================================='
\echo 'AUDIT COMPLETE'
\echo '=============================================='

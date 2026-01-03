-- ============================================================================
-- PRE-MIGRATION AUDIT SCRIPT FOR MIGRATION 025
-- Run this BEFORE executing 025_fleet_split_corrected.sql
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 025 PRE-FLIGHT AUDIT'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Check prerequisite functions exist
-- ---------------------------------------------------------------------------
\echo '=== 1. PREREQUISITE FUNCTIONS ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant_id')
    THEN 'PASS: current_tenant_id() function exists'
    ELSE 'FAIL: current_tenant_id() function MISSING'
  END AS current_tenant_id_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_mode')
    THEN 'PASS: is_service_mode() function exists'
    ELSE 'FAIL: is_service_mode() function MISSING'
  END AS is_service_mode_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Check source tables exist with expected structure
-- ---------------------------------------------------------------------------
\echo '=== 2. SOURCE TABLE STRUCTURE ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_profiles')
    THEN 'PASS: vehicle_profiles table exists'
    ELSE 'FAIL: vehicle_profiles table MISSING'
  END AS vehicle_profiles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_profiles')
    THEN 'PASS: trailer_profiles table exists'
    ELSE 'FAIL: trailer_profiles table MISSING'
  END AS trailer_profiles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_photos')
    THEN 'PASS: vehicle_photos table exists'
    ELSE 'FAIL: vehicle_photos table MISSING'
  END AS vehicle_photos_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_photos')
    THEN 'PASS: trailer_photos table exists'
    ELSE 'FAIL: trailer_photos table MISSING'
  END AS trailer_photos_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cc_tenants')
    THEN 'PASS: cc_tenants table exists'
    ELSE 'FAIL: cc_tenants table MISSING'
  END AS cc_tenants_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) Check required columns exist
-- ---------------------------------------------------------------------------
\echo '=== 3. REQUIRED COLUMNS ==='

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_profiles' AND column_name = 'tenant_id'
  )
    THEN 'PASS: vehicle_profiles.tenant_id exists'
    ELSE 'FAIL: vehicle_profiles.tenant_id MISSING'
  END AS vp_tenant_id_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trailer_profiles' AND column_name = 'tenant_id'
  )
    THEN 'PASS: trailer_profiles.tenant_id exists'
    ELSE 'FAIL: trailer_profiles.tenant_id MISSING'
  END AS tp_tenant_id_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_photos' AND column_name = 'photo_url'
  )
    THEN 'PASS: vehicle_photos.photo_url exists'
    ELSE 'FAIL: vehicle_photos.photo_url MISSING'
  END AS vph_photo_url_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_profiles' AND column_name = 'drive_type'
  )
    THEN 'PASS: vehicle_profiles.drive_type exists'
    ELSE 'FAIL: vehicle_profiles.drive_type MISSING'
  END AS vp_drive_type_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_profiles' AND column_name = 'license_plate'
  )
    THEN 'PASS: vehicle_profiles.license_plate exists'
    ELSE 'FAIL: vehicle_profiles.license_plate MISSING'
  END AS vp_license_plate_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 4) Row counts in source tables
-- ---------------------------------------------------------------------------
\echo '=== 4. SOURCE TABLE ROW COUNTS ==='

SELECT 'vehicle_profiles' AS table_name, COUNT(*) AS total_rows FROM vehicle_profiles;
SELECT 'trailer_profiles' AS table_name, COUNT(*) AS total_rows FROM trailer_profiles;
SELECT 'vehicle_photos' AS table_name, COUNT(*) AS total_rows FROM vehicle_photos;
SELECT 'trailer_photos' AS table_name, COUNT(*) AS total_rows FROM trailer_photos;

\echo ''

-- ---------------------------------------------------------------------------
-- 5) Tenant ownership distribution
-- ---------------------------------------------------------------------------
\echo '=== 5. TENANT OWNERSHIP DISTRIBUTION ==='

SELECT 
  'vehicle_profiles' AS table_name,
  COUNT(*) AS total,
  COUNT(tenant_id) AS with_tenant,
  COUNT(*) - COUNT(tenant_id) AS without_tenant
FROM vehicle_profiles;

SELECT 
  'trailer_profiles' AS table_name,
  COUNT(*) AS total,
  COUNT(tenant_id) AS with_tenant,
  COUNT(*) - COUNT(tenant_id) AS without_tenant
FROM trailer_profiles;

\echo ''

-- ---------------------------------------------------------------------------
-- 6) Sample tenant-owned rows (if any)
-- ---------------------------------------------------------------------------
\echo '=== 6. SAMPLE TENANT-OWNED VEHICLES (up to 10) ==='

SELECT id, tenant_id, vin, make, model, nickname 
FROM vehicle_profiles 
WHERE tenant_id IS NOT NULL 
LIMIT 10;

\echo ''
\echo '=== 7. SAMPLE TENANT-OWNED TRAILERS (up to 10) ==='

SELECT id, tenant_id, vin, nickname, trailer_type 
FROM trailer_profiles 
WHERE tenant_id IS NOT NULL 
LIMIT 10;

\echo ''

-- ---------------------------------------------------------------------------
-- 8) Sample photos
-- ---------------------------------------------------------------------------
\echo '=== 8. SAMPLE VEHICLE PHOTOS (up to 10) ==='

SELECT id, vehicle_id, photo_type, LEFT(photo_url, 50) AS photo_url_prefix 
FROM vehicle_photos 
LIMIT 10;

\echo ''

-- ---------------------------------------------------------------------------
-- 9) Check for potential conflicts (tables that would be created)
-- ---------------------------------------------------------------------------
\echo '=== 9. CONFLICT CHECK (new tables) ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_catalog')
    THEN 'WARNING: vehicle_catalog already exists (will be skipped)'
    ELSE 'OK: vehicle_catalog does not exist'
  END AS vehicle_catalog_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_catalog')
    THEN 'WARNING: trailer_catalog already exists (will be skipped)'
    ELSE 'OK: trailer_catalog does not exist'
  END AS trailer_catalog_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_vehicles')
    THEN 'WARNING: tenant_vehicles already exists (will be skipped)'
    ELSE 'OK: tenant_vehicles does not exist'
  END AS tenant_vehicles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_trailers')
    THEN 'WARNING: tenant_trailers already exists (will be skipped)'
    ELSE 'OK: tenant_trailers does not exist'
  END AS tenant_trailers_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 10) Primary key type verification
-- ---------------------------------------------------------------------------
\echo '=== 10. PRIMARY KEY TYPES ==='

SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name IN ('vehicle_profiles', 'trailer_profiles', 'vehicle_photos', 'trailer_photos', 'cc_tenants')
  AND column_name = 'id'
ORDER BY table_name;

\echo ''
\echo '=============================================='
\echo 'AUDIT COMPLETE'
\echo '=============================================='

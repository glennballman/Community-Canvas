-- ============================================================================
-- POST-MIGRATION VERIFICATION SCRIPT FOR MIGRATION 025
-- Run this AFTER executing 025_fleet_split_corrected.sql
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 025 POST-FLIGHT VERIFICATION'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Verify new tables exist
-- ---------------------------------------------------------------------------
\echo '=== 1. NEW TABLES CREATED ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_catalog')
    THEN 'PASS: vehicle_catalog exists'
    ELSE 'FAIL: vehicle_catalog MISSING'
  END AS vehicle_catalog_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trailer_catalog')
    THEN 'PASS: trailer_catalog exists'
    ELSE 'FAIL: trailer_catalog MISSING'
  END AS trailer_catalog_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_listings')
    THEN 'PASS: catalog_listings exists'
    ELSE 'FAIL: catalog_listings MISSING'
  END AS catalog_listings_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_vehicles')
    THEN 'PASS: tenant_vehicles exists'
    ELSE 'FAIL: tenant_vehicles MISSING'
  END AS tenant_vehicles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_trailers')
    THEN 'PASS: tenant_trailers exists'
    ELSE 'FAIL: tenant_trailers MISSING'
  END AS tenant_trailers_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_vehicle_photos')
    THEN 'PASS: tenant_vehicle_photos exists'
    ELSE 'FAIL: tenant_vehicle_photos MISSING'
  END AS tenant_vehicle_photos_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_trailer_photos')
    THEN 'PASS: tenant_trailer_photos exists'
    ELSE 'FAIL: tenant_trailer_photos MISSING'
  END AS tenant_trailer_photos_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Row count comparison
-- ---------------------------------------------------------------------------
\echo '=== 2. ROW COUNT COMPARISON ==='

\echo 'Source tables (original):'
SELECT 'vehicle_profiles (total)' AS source, COUNT(*) AS count FROM vehicle_profiles
UNION ALL
SELECT 'vehicle_profiles (no tenant)', COUNT(*) FROM vehicle_profiles WHERE tenant_id IS NULL
UNION ALL
SELECT 'vehicle_profiles (with tenant)', COUNT(*) FROM vehicle_profiles WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 'trailer_profiles (total)', COUNT(*) FROM trailer_profiles
UNION ALL
SELECT 'trailer_profiles (no tenant)', COUNT(*) FROM trailer_profiles WHERE tenant_id IS NULL
UNION ALL
SELECT 'trailer_profiles (with tenant)', COUNT(*) FROM trailer_profiles WHERE tenant_id IS NOT NULL;

\echo ''
\echo 'New tables (migrated):'
SELECT 'vehicle_catalog' AS target, COUNT(*) AS count FROM vehicle_catalog
UNION ALL
SELECT 'tenant_vehicles', COUNT(*) FROM tenant_vehicles
UNION ALL
SELECT 'trailer_catalog', COUNT(*) FROM trailer_catalog
UNION ALL
SELECT 'tenant_trailers', COUNT(*) FROM tenant_trailers
UNION ALL
SELECT 'tenant_vehicle_photos', COUNT(*) FROM tenant_vehicle_photos
UNION ALL
SELECT 'tenant_trailer_photos', COUNT(*) FROM tenant_trailer_photos
UNION ALL
SELECT 'catalog_listings', COUNT(*) FROM catalog_listings;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) Verify data integrity - catalog should match public vehicles
-- ---------------------------------------------------------------------------
\echo '=== 3. DATA INTEGRITY CHECK ==='

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM vehicle_profiles WHERE tenant_id IS NULL) = 
         (SELECT COUNT(*) FROM vehicle_catalog WHERE legacy_vehicle_profile_id IS NOT NULL)
    THEN 'PASS: vehicle_catalog count matches public vehicle_profiles'
    ELSE 'WARN: vehicle_catalog count mismatch (may have conflicts)'
  END AS vehicle_catalog_integrity;

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM vehicle_profiles WHERE tenant_id IS NOT NULL) = 
         (SELECT COUNT(*) FROM tenant_vehicles WHERE legacy_vehicle_profile_id IS NOT NULL)
    THEN 'PASS: tenant_vehicles count matches tenant-owned vehicle_profiles'
    ELSE 'WARN: tenant_vehicles count mismatch (may have conflicts)'
  END AS tenant_vehicles_integrity;

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM trailer_profiles WHERE tenant_id IS NULL) = 
         (SELECT COUNT(*) FROM trailer_catalog WHERE legacy_trailer_profile_id IS NOT NULL)
    THEN 'PASS: trailer_catalog count matches public trailer_profiles'
    ELSE 'WARN: trailer_catalog count mismatch (may have conflicts)'
  END AS trailer_catalog_integrity;

SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM trailer_profiles WHERE tenant_id IS NOT NULL) = 
         (SELECT COUNT(*) FROM tenant_trailers WHERE legacy_trailer_profile_id IS NOT NULL)
    THEN 'PASS: tenant_trailers count matches tenant-owned trailer_profiles'
    ELSE 'WARN: tenant_trailers count mismatch (may have conflicts)'
  END AS tenant_trailers_integrity;

\echo ''

-- ---------------------------------------------------------------------------
-- 4) Verify photos migrated correctly
-- ---------------------------------------------------------------------------
\echo '=== 4. PHOTO MIGRATION CHECK ==='

-- Count photos that should have been migrated (photos for tenant-owned vehicles)
WITH expected_photos AS (
  SELECT COUNT(*) AS cnt
  FROM vehicle_photos vph
  JOIN vehicle_profiles vp ON vp.id = vph.vehicle_id
  WHERE vp.tenant_id IS NOT NULL
)
SELECT 
  CASE 
    WHEN (SELECT cnt FROM expected_photos) = (SELECT COUNT(*) FROM tenant_vehicle_photos)
    THEN 'PASS: tenant_vehicle_photos count matches expected'
    ELSE 'WARN: tenant_vehicle_photos count mismatch. Expected: ' || 
         (SELECT cnt FROM expected_photos)::text || 
         ', Got: ' || (SELECT COUNT(*) FROM tenant_vehicle_photos)::text
  END AS vehicle_photos_check;

WITH expected_trailer_photos AS (
  SELECT COUNT(*) AS cnt
  FROM trailer_photos tph
  JOIN trailer_profiles tp ON tp.id = tph.trailer_id
  WHERE tp.tenant_id IS NOT NULL
)
SELECT 
  CASE 
    WHEN (SELECT cnt FROM expected_trailer_photos) = (SELECT COUNT(*) FROM tenant_trailer_photos)
    THEN 'PASS: tenant_trailer_photos count matches expected'
    ELSE 'WARN: tenant_trailer_photos count mismatch. Expected: ' || 
         (SELECT cnt FROM expected_trailer_photos)::text || 
         ', Got: ' || (SELECT COUNT(*) FROM tenant_trailer_photos)::text
  END AS trailer_photos_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 5) Verify RLS policies exist
-- ---------------------------------------------------------------------------
\echo '=== 5. RLS POLICIES CHECK ==='

SELECT 
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies 
WHERE tablename IN ('tenant_vehicles', 'tenant_trailers', 'tenant_vehicle_photos', 'tenant_trailer_photos')
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ---------------------------------------------------------------------------
-- 6) Verify RLS is enabled
-- ---------------------------------------------------------------------------
\echo '=== 6. RLS ENABLED CHECK ==='

SELECT 
  relname AS table_name,
  CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status
FROM pg_class
WHERE relname IN ('tenant_vehicles', 'tenant_trailers', 'tenant_vehicle_photos', 'tenant_trailer_photos')
ORDER BY relname;

\echo ''

-- ---------------------------------------------------------------------------
-- 7) Verify no tenant data appears in catalog (sanity check)
-- ---------------------------------------------------------------------------
\echo '=== 7. CATALOG ISOLATION CHECK ==='

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM vehicle_catalog vc
      JOIN vehicle_profiles vp ON vp.id = vc.legacy_vehicle_profile_id
      WHERE vp.tenant_id IS NOT NULL
    )
    THEN 'PASS: No tenant-owned vehicles in vehicle_catalog'
    ELSE 'FAIL: Tenant-owned vehicles found in vehicle_catalog!'
  END AS vehicle_catalog_isolation;

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM trailer_catalog tc
      JOIN trailer_profiles tp ON tp.id = tc.legacy_trailer_profile_id
      WHERE tp.tenant_id IS NOT NULL
    )
    THEN 'PASS: No tenant-owned trailers in trailer_catalog'
    ELSE 'FAIL: Tenant-owned trailers found in trailer_catalog!'
  END AS trailer_catalog_isolation;

\echo ''

-- ---------------------------------------------------------------------------
-- 8) Sample data from new tables
-- ---------------------------------------------------------------------------
\echo '=== 8. SAMPLE DATA FROM NEW TABLES ==='

\echo 'vehicle_catalog (first 5):'
SELECT id, vin, make, model, year, vehicle_class, legacy_vehicle_profile_id 
FROM vehicle_catalog 
LIMIT 5;

\echo ''
\echo 'tenant_vehicles (first 5):'
SELECT id, tenant_id, nickname, vin, license_plate, status, legacy_vehicle_profile_id 
FROM tenant_vehicles 
LIMIT 5;

\echo ''
\echo 'trailer_catalog (first 5):'
SELECT id, vin, trailer_type, hitch_type, legacy_trailer_profile_id 
FROM trailer_catalog 
LIMIT 5;

\echo ''
\echo 'tenant_trailers (first 5):'
SELECT id, tenant_id, nickname, vin, license_plate, status, legacy_trailer_profile_id 
FROM tenant_trailers 
LIMIT 5;

\echo ''

-- ---------------------------------------------------------------------------
-- 9) Views created
-- ---------------------------------------------------------------------------
\echo '=== 9. COMPATIBILITY VIEWS ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_vehicle_catalog_public')
    THEN 'PASS: v_vehicle_catalog_public view exists'
    ELSE 'FAIL: v_vehicle_catalog_public view MISSING'
  END AS v_vehicle_catalog_public_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_trailer_catalog_public')
    THEN 'PASS: v_trailer_catalog_public view exists'
    ELSE 'FAIL: v_trailer_catalog_public view MISSING'
  END AS v_trailer_catalog_public_check;

\echo ''
\echo '=============================================='
\echo 'VERIFICATION COMPLETE'
\echo '=============================================='

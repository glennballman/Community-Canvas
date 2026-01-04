-- ============================================================================
-- POST-MIGRATION VERIFICATION SCRIPT FOR MIGRATION 026
-- Run this AFTER executing 026_fleet_assets_and_legacy_freeze.sql
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 026 POST-FLIGHT VERIFICATION'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Verify catalog_media table created
-- ---------------------------------------------------------------------------
\echo '=== 1. CATALOG_MEDIA TABLE ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_media')
    THEN 'PASS: catalog_media exists'
    ELSE 'FAIL: catalog_media MISSING'
  END AS catalog_media_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Verify asset_id columns added
-- ---------------------------------------------------------------------------
\echo '=== 2. ASSET_ID COLUMNS ==='

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_vehicles' AND column_name = 'asset_id'
  )
    THEN 'PASS: tenant_vehicles.asset_id exists'
    ELSE 'FAIL: tenant_vehicles.asset_id MISSING'
  END AS tenant_vehicles_asset_id_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_trailers' AND column_name = 'asset_id'
  )
    THEN 'PASS: tenant_trailers.asset_id exists'
    ELSE 'FAIL: tenant_trailers.asset_id MISSING'
  END AS tenant_trailers_asset_id_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) Verify triggers exist
-- ---------------------------------------------------------------------------
\echo '=== 3. AUTO-ASSET TRIGGERS ==='

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_tenant_vehicle_create_asset'
  )
    THEN 'PASS: trg_tenant_vehicle_create_asset exists'
    ELSE 'FAIL: trg_tenant_vehicle_create_asset MISSING'
  END AS vehicle_trigger_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_tenant_trailer_create_asset'
  )
    THEN 'PASS: trg_tenant_trailer_create_asset exists'
    ELSE 'FAIL: trg_tenant_trailer_create_asset MISSING'
  END AS trailer_trigger_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 4) Verify legacy tables renamed
-- ---------------------------------------------------------------------------
\echo '=== 4. LEGACY TABLE RENAME ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_profiles')
    THEN 'PASS: legacy_vehicle_profiles exists'
    ELSE 'WARN: legacy_vehicle_profiles does not exist'
  END AS legacy_vehicle_profiles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_trailer_profiles')
    THEN 'PASS: legacy_trailer_profiles exists'
    ELSE 'WARN: legacy_trailer_profiles does not exist'
  END AS legacy_trailer_profiles_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_vehicle_photos')
    THEN 'PASS: legacy_vehicle_photos exists'
    ELSE 'WARN: legacy_vehicle_photos does not exist'
  END AS legacy_vehicle_photos_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legacy_trailer_photos')
    THEN 'PASS: legacy_trailer_photos exists'
    ELSE 'WARN: legacy_trailer_photos does not exist'
  END AS legacy_trailer_photos_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 5) Verify compatibility views exist
-- ---------------------------------------------------------------------------
\echo '=== 5. COMPATIBILITY VIEWS ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vehicle_profiles')
    THEN 'PASS: vehicle_profiles view exists'
    ELSE 'FAIL: vehicle_profiles view MISSING'
  END AS vehicle_profiles_view_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'trailer_profiles')
    THEN 'PASS: trailer_profiles view exists'
    ELSE 'FAIL: trailer_profiles view MISSING'
  END AS trailer_profiles_view_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vehicle_photos')
    THEN 'PASS: vehicle_photos view exists'
    ELSE 'FAIL: vehicle_photos view MISSING'
  END AS vehicle_photos_view_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'trailer_photos')
    THEN 'PASS: trailer_photos view exists'
    ELSE 'FAIL: trailer_photos view MISSING'
  END AS trailer_photos_view_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 6) Verify read-only triggers on views
-- ---------------------------------------------------------------------------
\echo '=== 6. READ-ONLY TRIGGERS ON VIEWS ==='

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_vehicle_profiles_readonly'
  )
    THEN 'PASS: trg_vehicle_profiles_readonly exists'
    ELSE 'FAIL: trg_vehicle_profiles_readonly MISSING'
  END AS vehicle_profiles_readonly_check;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_trailer_profiles_readonly'
  )
    THEN 'PASS: trg_trailer_profiles_readonly exists'
    ELSE 'FAIL: trg_trailer_profiles_readonly MISSING'
  END AS trailer_profiles_readonly_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 7) Test trigger: Insert a test tenant vehicle and verify asset created
-- ---------------------------------------------------------------------------
\echo '=== 7. TRIGGER TEST (auto-create asset) ==='

-- Create a test tenant if not exists
DO $$
DECLARE
  v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_test_vehicle_id UUID;
  v_created_asset_id UUID;
BEGIN
  -- Ensure test tenant exists
  INSERT INTO cc_tenants (id, name, slug, tenant_type)
  VALUES (v_test_tenant_id, 'Test Tenant 026', 'test-tenant-026', 'business')
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert test vehicle (trigger should create asset)
  INSERT INTO tenant_vehicles (id, tenant_id, nickname, is_active, status)
  VALUES (gen_random_uuid(), v_test_tenant_id, 'Test Vehicle 026', true, 'active')
  RETURNING id, asset_id INTO v_test_vehicle_id, v_created_asset_id;
  
  IF v_created_asset_id IS NOT NULL THEN
    RAISE NOTICE 'PASS: Trigger created asset_id % for vehicle %', v_created_asset_id, v_test_vehicle_id;
    
    -- Verify asset exists
    IF EXISTS (SELECT 1 FROM assets WHERE id = v_created_asset_id) THEN
      RAISE NOTICE 'PASS: Asset row exists in assets table';
    ELSE
      RAISE NOTICE 'FAIL: Asset row NOT found in assets table';
    END IF;
    
    -- Cleanup
    DELETE FROM tenant_vehicles WHERE id = v_test_vehicle_id;
    DELETE FROM assets WHERE id = v_created_asset_id;
  ELSE
    RAISE NOTICE 'FAIL: Trigger did not create asset_id';
    DELETE FROM tenant_vehicles WHERE id = v_test_vehicle_id;
  END IF;
  
  -- Cleanup test tenant
  DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 8) Row counts
-- ---------------------------------------------------------------------------
\echo '=== 8. ROW COUNTS ==='

SELECT 'catalog_media' AS table_name, COUNT(*) AS count FROM catalog_media;
SELECT 'legacy_vehicle_profiles' AS table_name, COUNT(*) AS count FROM legacy_vehicle_profiles;
SELECT 'legacy_trailer_profiles' AS table_name, COUNT(*) AS count FROM legacy_trailer_profiles;
SELECT 'tenant_vehicles' AS table_name, COUNT(*) AS count FROM tenant_vehicles;
SELECT 'tenant_trailers' AS table_name, COUNT(*) AS count FROM tenant_trailers;
SELECT 'assets (vehicle type)' AS table_name, COUNT(*) AS count FROM assets WHERE asset_type = 'vehicle';
SELECT 'assets (trailer type)' AS table_name, COUNT(*) AS count FROM assets WHERE asset_type = 'trailer';

\echo ''

-- ---------------------------------------------------------------------------
-- 9) Verify views are readable
-- ---------------------------------------------------------------------------
\echo '=== 9. VIEW READABILITY TEST ==='

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM vehicle_profiles;
  RAISE NOTICE 'vehicle_profiles view: % rows readable', v_count;
  
  SELECT COUNT(*) INTO v_count FROM trailer_profiles;
  RAISE NOTICE 'trailer_profiles view: % rows readable', v_count;
  
  SELECT COUNT(*) INTO v_count FROM vehicle_photos;
  RAISE NOTICE 'vehicle_photos view: % rows readable', v_count;
  
  SELECT COUNT(*) INTO v_count FROM trailer_photos;
  RAISE NOTICE 'trailer_photos view: % rows readable', v_count;
END $$;

\echo ''
\echo '=============================================='
\echo 'VERIFICATION COMPLETE'
\echo '=============================================='

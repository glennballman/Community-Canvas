-- ============================================================================
-- MIGRATION 027.1 POST-FLIGHT VERIFICATION
-- Proves:
-- 1) Tenant cannot insert into catalog_claim_events (RLS blocks it)
-- 2) Double-apply attempt fails
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 027.1 POST-FLIGHT VERIFICATION'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Verify RLS policy updated
-- ---------------------------------------------------------------------------
\echo '=== 1. RLS POLICY CHECK ==='

SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'catalog_claim_events' AND policyname = 'claim_events_insert';

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Test: Tenant cannot insert into catalog_claim_events
-- ---------------------------------------------------------------------------
\echo '=== 2. TENANT INSERT BLOCKED TEST ==='

DO $$
DECLARE
  v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_test_vehicle_id UUID;
  v_claim_id UUID;
  v_insert_blocked BOOLEAN := FALSE;
BEGIN
  -- Setup test tenant
  INSERT INTO cc_tenants (id, name, slug, tenant_type)
  VALUES (v_test_tenant_id, 'Test Tenant 027.1', 'test-tenant-027-1', 'business')
  ON CONFLICT (id) DO NOTHING;

  -- Get a vehicle catalog id
  SELECT id INTO v_test_vehicle_id FROM vehicle_catalog WHERE is_active = true LIMIT 1;
  
  IF v_test_vehicle_id IS NULL THEN
    RAISE NOTICE 'SKIP: No active vehicle_catalog entries to test with';
    DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
    RETURN;
  END IF;

  -- Create a claim
  INSERT INTO catalog_claims (id, target_type, claimant, tenant_id, vehicle_catalog_id, status)
  VALUES (gen_random_uuid(), 'vehicle', 'tenant', v_test_tenant_id, v_test_vehicle_id, 'draft')
  RETURNING id INTO v_claim_id;

  -- Set tenant context (simulate tenant session)
  PERFORM set_config('app.current_tenant_id', v_test_tenant_id::TEXT, true);

  -- Attempt to insert into catalog_claim_events as tenant (should fail)
  BEGIN
    INSERT INTO catalog_claim_events (id, claim_id, event_type, payload)
    VALUES (gen_random_uuid(), v_claim_id, 'created', '{}'::jsonb);
    
    RAISE NOTICE 'FAIL: Tenant was able to insert into catalog_claim_events';
  EXCEPTION WHEN insufficient_privilege THEN
    v_insert_blocked := TRUE;
    RAISE NOTICE 'PASS: Tenant INSERT blocked by RLS';
  WHEN OTHERS THEN
    -- Catch other RLS-related errors
    IF SQLERRM LIKE '%violates row-level security%' OR SQLERRM LIKE '%new row violates%' THEN
      v_insert_blocked := TRUE;
      RAISE NOTICE 'PASS: Tenant INSERT blocked by RLS (%)' , SQLERRM;
    ELSE
      RAISE NOTICE 'UNEXPECTED ERROR: %', SQLERRM;
    END IF;
  END;

  -- Reset tenant context
  PERFORM set_config('app.current_tenant_id', '', true);

  -- Cleanup
  DELETE FROM catalog_claims WHERE id = v_claim_id;
  DELETE FROM cc_tenants WHERE id = v_test_tenant_id;

END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) Test: Double-apply attempt fails
-- ---------------------------------------------------------------------------
\echo '=== 3. DOUBLE-APPLY BLOCKED TEST ==='

DO $$
DECLARE
  v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_test_vehicle_id UUID;
  v_claim_id UUID;
  v_created_asset_id UUID;
  v_created_vehicle_id UUID;
  v_double_apply_blocked BOOLEAN := FALSE;
BEGIN
  -- Setup test tenant
  INSERT INTO cc_tenants (id, name, slug, tenant_type)
  VALUES (v_test_tenant_id, 'Test Tenant 027.1', 'test-tenant-027-1', 'business')
  ON CONFLICT (id) DO NOTHING;

  -- Get a vehicle catalog id
  SELECT id INTO v_test_vehicle_id FROM vehicle_catalog WHERE is_active = true LIMIT 1;
  
  IF v_test_vehicle_id IS NULL THEN
    RAISE NOTICE 'SKIP: No active vehicle_catalog entries to test with';
    DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
    RETURN;
  END IF;

  -- Create claim and move to approved
  INSERT INTO catalog_claims (id, target_type, claimant, tenant_id, vehicle_catalog_id, nickname, status)
  VALUES (gen_random_uuid(), 'vehicle', 'tenant', v_test_tenant_id, v_test_vehicle_id, 'Double Apply Test', 'draft')
  RETURNING id INTO v_claim_id;

  -- Transition through to applied
  UPDATE catalog_claims SET status = 'submitted', submitted_at = now() WHERE id = v_claim_id;
  UPDATE catalog_claims SET status = 'under_review', reviewed_at = now() WHERE id = v_claim_id;
  UPDATE catalog_claims SET status = 'approved', decision = 'approve' WHERE id = v_claim_id;
  -- Note: auto-apply trigger runs here

  -- Verify it was applied
  SELECT created_asset_id, created_tenant_vehicle_id 
  INTO v_created_asset_id, v_created_vehicle_id
  FROM catalog_claims WHERE id = v_claim_id;

  IF v_created_asset_id IS NULL THEN
    RAISE NOTICE 'FAIL: First apply did not work';
  ELSE
    RAISE NOTICE 'First apply succeeded: asset_id=%', v_created_asset_id;
  END IF;

  -- Attempt to call fn_apply_catalog_claim again (should fail)
  BEGIN
    PERFORM fn_apply_catalog_claim(v_claim_id);
    RAISE NOTICE 'FAIL: Double-apply was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%already applied%' OR SQLERRM LIKE '%already has applied_at%' THEN
      v_double_apply_blocked := TRUE;
      RAISE NOTICE 'PASS: Double-apply correctly blocked: %', SQLERRM;
    ELSE
      RAISE NOTICE 'UNEXPECTED ERROR: %', SQLERRM;
    END IF;
  END;

  -- Cleanup
  DELETE FROM asset_capabilities WHERE asset_id = v_created_asset_id;
  DELETE FROM catalog_claim_events WHERE claim_id = v_claim_id;
  DELETE FROM catalog_claims WHERE id = v_claim_id;
  DELETE FROM tenant_vehicles WHERE id = v_created_vehicle_id;
  DELETE FROM assets WHERE id = v_created_asset_id;
  DELETE FROM cc_tenants WHERE id = v_test_tenant_id;

END $$;

\echo ''
\echo '=============================================='
\echo 'VERIFICATION COMPLETE'
\echo '=============================================='

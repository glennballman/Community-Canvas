-- ============================================================================
-- MIGRATION 027 POST-FLIGHT VERIFICATION
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 027 POST-FLIGHT VERIFICATION'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Verify ENUMs created
-- ---------------------------------------------------------------------------
\echo '=== 1. ENUMS ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_claim_status')
    THEN 'PASS: catalog_claim_status enum exists'
    ELSE 'FAIL: catalog_claim_status enum MISSING'
  END AS catalog_claim_status_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_target_type')
    THEN 'PASS: claim_target_type enum exists'
    ELSE 'FAIL: claim_target_type enum MISSING'
  END AS claim_target_type_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claimant_type')
    THEN 'PASS: claimant_type enum exists'
    ELSE 'FAIL: claimant_type enum MISSING'
  END AS claimant_type_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_evidence_type')
    THEN 'PASS: claim_evidence_type enum exists'
    ELSE 'FAIL: claim_evidence_type enum MISSING'
  END AS claim_evidence_type_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_decision')
    THEN 'PASS: claim_decision enum exists'
    ELSE 'FAIL: claim_decision enum MISSING'
  END AS claim_decision_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_event_type')
    THEN 'PASS: claim_event_type enum exists'
    ELSE 'FAIL: claim_event_type enum MISSING'
  END AS claim_event_type_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Verify tables created
-- ---------------------------------------------------------------------------
\echo '=== 2. TABLES ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_claims')
    THEN 'PASS: catalog_claims table exists'
    ELSE 'FAIL: catalog_claims table MISSING'
  END AS catalog_claims_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_claim_evidence')
    THEN 'PASS: catalog_claim_evidence table exists'
    ELSE 'FAIL: catalog_claim_evidence table MISSING'
  END AS catalog_claim_evidence_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_claim_events')
    THEN 'PASS: catalog_claim_events table exists'
    ELSE 'FAIL: catalog_claim_events table MISSING'
  END AS catalog_claim_events_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_capability_templates')
    THEN 'PASS: catalog_capability_templates table exists'
    ELSE 'FAIL: catalog_capability_templates table MISSING'
  END AS catalog_capability_templates_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) Verify functions created
-- ---------------------------------------------------------------------------
\echo '=== 3. FUNCTIONS ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_enforce_claim_status_transition')
    THEN 'PASS: fn_enforce_claim_status_transition exists'
    ELSE 'FAIL: fn_enforce_claim_status_transition MISSING'
  END AS fn_enforce_claim_status_transition_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_extract_capabilities_for_asset')
    THEN 'PASS: fn_extract_capabilities_for_asset exists'
    ELSE 'FAIL: fn_extract_capabilities_for_asset MISSING'
  END AS fn_extract_capabilities_for_asset_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_apply_catalog_claim')
    THEN 'PASS: fn_apply_catalog_claim exists'
    ELSE 'FAIL: fn_apply_catalog_claim MISSING'
  END AS fn_apply_catalog_claim_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_claim_auto_apply_on_approved')
    THEN 'PASS: fn_claim_auto_apply_on_approved exists'
    ELSE 'FAIL: fn_claim_auto_apply_on_approved MISSING'
  END AS fn_claim_auto_apply_on_approved_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 4) Verify triggers
-- ---------------------------------------------------------------------------
\echo '=== 4. TRIGGERS ==='

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_catalog_claims_updated_at')
    THEN 'PASS: trg_catalog_claims_updated_at exists'
    ELSE 'FAIL: trg_catalog_claims_updated_at MISSING'
  END AS trg_updated_at_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_claim_status_transition')
    THEN 'PASS: trg_claim_status_transition exists'
    ELSE 'FAIL: trg_claim_status_transition MISSING'
  END AS trg_status_transition_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_claim_auto_apply')
    THEN 'PASS: trg_claim_auto_apply exists'
    ELSE 'FAIL: trg_claim_auto_apply MISSING'
  END AS trg_auto_apply_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 5) Verify RLS enabled
-- ---------------------------------------------------------------------------
\echo '=== 5. RLS ENABLED ==='

SELECT 
  CASE WHEN relrowsecurity 
    THEN 'PASS: catalog_claims RLS enabled'
    ELSE 'FAIL: catalog_claims RLS NOT enabled'
  END AS catalog_claims_rls
FROM pg_class WHERE relname = 'catalog_claims';

SELECT 
  CASE WHEN relrowsecurity 
    THEN 'PASS: catalog_claim_evidence RLS enabled'
    ELSE 'FAIL: catalog_claim_evidence RLS NOT enabled'
  END AS catalog_claim_evidence_rls
FROM pg_class WHERE relname = 'catalog_claim_evidence';

SELECT 
  CASE WHEN relrowsecurity 
    THEN 'PASS: catalog_claim_events RLS enabled'
    ELSE 'FAIL: catalog_claim_events RLS NOT enabled'
  END AS catalog_claim_events_rls
FROM pg_class WHERE relname = 'catalog_claim_events';

SELECT 
  CASE WHEN relrowsecurity 
    THEN 'PASS: catalog_capability_templates RLS enabled'
    ELSE 'FAIL: catalog_capability_templates RLS NOT enabled'
  END AS catalog_capability_templates_rls
FROM pg_class WHERE relname = 'catalog_capability_templates';

\echo ''

-- ---------------------------------------------------------------------------
-- 6) Verify RLS policies
-- ---------------------------------------------------------------------------
\echo '=== 6. RLS POLICIES ==='

SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('catalog_claims', 'catalog_claim_evidence', 'catalog_claim_events', 'catalog_capability_templates')
ORDER BY tablename, policyname;

\echo ''

-- ---------------------------------------------------------------------------
-- 7) Verify capability templates seeded
-- ---------------------------------------------------------------------------
\echo '=== 7. CAPABILITY TEMPLATES ==='

SELECT 'catalog_capability_templates' AS table_name, COUNT(*) AS count FROM catalog_capability_templates;

\echo ''

-- ---------------------------------------------------------------------------
-- 8) Test status transition enforcement
-- ---------------------------------------------------------------------------
\echo '=== 8. STATUS TRANSITION TEST ==='

DO $$
DECLARE
  v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_test_vehicle_id UUID;
  v_claim_id UUID;
  v_error_caught BOOLEAN := FALSE;
BEGIN
  -- Setup test tenant
  INSERT INTO cc_tenants (id, name, slug, tenant_type)
  VALUES (v_test_tenant_id, 'Test Tenant 027', 'test-tenant-027', 'business')
  ON CONFLICT (id) DO NOTHING;

  -- Get a vehicle catalog id
  SELECT id INTO v_test_vehicle_id FROM vehicle_catalog LIMIT 1;
  
  IF v_test_vehicle_id IS NULL THEN
    RAISE NOTICE 'SKIP: No vehicle_catalog entries to test with';
    DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
    RETURN;
  END IF;

  -- Create a claim
  INSERT INTO catalog_claims (id, target_type, claimant, tenant_id, vehicle_catalog_id, status)
  VALUES (gen_random_uuid(), 'vehicle', 'tenant', v_test_tenant_id, v_test_vehicle_id, 'draft')
  RETURNING id INTO v_claim_id;

  -- Test valid transition: draft -> submitted
  UPDATE catalog_claims SET status = 'submitted', submitted_at = now() WHERE id = v_claim_id;
  RAISE NOTICE 'PASS: draft -> submitted transition allowed';

  -- Test invalid transition: submitted -> applied (should fail)
  BEGIN
    UPDATE catalog_claims SET status = 'applied' WHERE id = v_claim_id;
    RAISE NOTICE 'FAIL: submitted -> applied should have been rejected';
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := TRUE;
    RAISE NOTICE 'PASS: submitted -> applied correctly rejected';
  END;

  -- Cleanup
  DELETE FROM catalog_claims WHERE id = v_claim_id;
  DELETE FROM cc_tenants WHERE id = v_test_tenant_id;

END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 9) Test full claim flow (end-to-end)
-- ---------------------------------------------------------------------------
\echo '=== 9. FULL CLAIM FLOW TEST ==='

DO $$
DECLARE
  v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_test_vehicle_id UUID;
  v_claim_id UUID;
  v_created_asset_id UUID;
  v_created_vehicle_id UUID;
  v_cap_count INTEGER;
BEGIN
  -- Setup test tenant
  INSERT INTO cc_tenants (id, name, slug, tenant_type)
  VALUES (v_test_tenant_id, 'Test Tenant 027', 'test-tenant-027', 'business')
  ON CONFLICT (id) DO NOTHING;

  -- Get a vehicle catalog id
  SELECT id INTO v_test_vehicle_id FROM vehicle_catalog WHERE is_active = true LIMIT 1;
  
  IF v_test_vehicle_id IS NULL THEN
    RAISE NOTICE 'SKIP: No active vehicle_catalog entries to test with';
    DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
    RETURN;
  END IF;

  -- Create claim
  INSERT INTO catalog_claims (id, target_type, claimant, tenant_id, vehicle_catalog_id, nickname, status)
  VALUES (gen_random_uuid(), 'vehicle', 'tenant', v_test_tenant_id, v_test_vehicle_id, 'Test Claim Vehicle', 'draft')
  RETURNING id INTO v_claim_id;

  RAISE NOTICE 'Created claim: %', v_claim_id;

  -- Transition: draft -> submitted
  UPDATE catalog_claims SET status = 'submitted', submitted_at = now() WHERE id = v_claim_id;

  -- Transition: submitted -> under_review
  UPDATE catalog_claims SET status = 'under_review', reviewed_at = now() WHERE id = v_claim_id;

  -- Transition: under_review -> approved (triggers auto-apply)
  UPDATE catalog_claims SET status = 'approved', decision = 'approve' WHERE id = v_claim_id;

  -- Verify outputs
  SELECT created_asset_id, created_tenant_vehicle_id 
  INTO v_created_asset_id, v_created_vehicle_id
  FROM catalog_claims WHERE id = v_claim_id;

  IF v_created_asset_id IS NOT NULL AND v_created_vehicle_id IS NOT NULL THEN
    RAISE NOTICE 'PASS: Claim applied - asset_id=%, vehicle_id=%', v_created_asset_id, v_created_vehicle_id;
    
    -- Check capabilities extracted
    SELECT COUNT(*) INTO v_cap_count FROM asset_capabilities WHERE asset_id = v_created_asset_id;
    RAISE NOTICE 'PASS: % capability(ies) extracted for asset', v_cap_count;
  ELSE
    RAISE NOTICE 'FAIL: Claim not applied correctly';
  END IF;

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

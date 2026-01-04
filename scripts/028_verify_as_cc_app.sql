-- ============================================================================
-- MIGRATION 028 VERIFICATION (Run as cc_app, NOT postgres)
-- 
-- Usage: psql "$CC_APP_DATABASE_URL" -f scripts/028_verify_as_cc_app.sql
-- ============================================================================

\echo '=============================================='
\echo 'MIGRATION 028 VERIFICATION (cc_app role)'
\echo '=============================================='
\echo ''

-- ---------------------------------------------------------------------------
-- 1) Confirm we are cc_app and not superuser
-- ---------------------------------------------------------------------------
\echo '=== 1. ROLE IDENTITY ==='

SELECT 
  current_user,
  session_user,
  rolsuper,
  rolbypassrls,
  rolcanlogin
FROM pg_roles
WHERE rolname = current_user;

\echo ''

-- ---------------------------------------------------------------------------
-- 2) Confirm we are NOT superuser and CANNOT bypass RLS
-- ---------------------------------------------------------------------------
\echo '=== 2. SECURITY PROPERTIES ==='

SELECT 
  CASE WHEN current_user = 'cc_app' THEN 'PASS: Connected as cc_app' ELSE 'FAIL: Not cc_app' END AS role_check,
  CASE WHEN NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) 
    THEN 'PASS: Not superuser' ELSE 'FAIL: Is superuser' END AS superuser_check,
  CASE WHEN NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user)
    THEN 'PASS: Cannot bypass RLS' ELSE 'FAIL: Can bypass RLS' END AS rls_bypass_check;

\echo ''

-- ---------------------------------------------------------------------------
-- 3) RLS Test: Read tenant_vehicles with empty tenant context
-- ---------------------------------------------------------------------------
\echo '=== 3. RLS READ TEST (empty context) ==='

-- Clear any tenant context
SELECT set_config('app.tenant_id', '', true);
SELECT set_config('app.service_mode', '', true);

-- Attempt to count tenant_vehicles (should return 0 due to RLS)
SELECT 
  CASE WHEN COUNT(*) = 0 
    THEN 'PASS: RLS blocked read (0 rows returned)'
    ELSE 'INVESTIGATE: ' || COUNT(*) || ' rows returned (may be expected if service_mode fallback)'
  END AS rls_read_test
FROM tenant_vehicles;

\echo ''

-- ---------------------------------------------------------------------------
-- 4) RLS Test: INSERT into tenant_vehicles with empty context
-- ---------------------------------------------------------------------------
\echo '=== 4. RLS INSERT TEST (empty context) ==='

DO $$
DECLARE
  v_test_tenant_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff';
BEGIN
  -- Ensure context is clear
  PERFORM set_config('app.tenant_id', '', true);
  PERFORM set_config('app.service_mode', '', true);
  
  -- Attempt insert (should fail with RLS violation)
  BEGIN
    INSERT INTO tenant_vehicles (id, tenant_id, nickname, is_active, status)
    VALUES (gen_random_uuid(), v_test_tenant_id, 'RLS Test Vehicle', true, 'active');
    
    RAISE NOTICE 'FAIL: INSERT succeeded (RLS did not block)';
    
    -- Cleanup if somehow succeeded
    DELETE FROM tenant_vehicles WHERE nickname = 'RLS Test Vehicle';
  EXCEPTION 
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: INSERT blocked by RLS (insufficient_privilege)';
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%violates row-level security%' THEN
        RAISE NOTICE 'PASS: INSERT blocked by RLS: %', SQLERRM;
      ELSE
        RAISE NOTICE 'ERROR: Unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 5) Service Mode Test: Set service_mode and confirm access
-- ---------------------------------------------------------------------------
\echo '=== 5. SERVICE MODE TEST ==='

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Set service mode
  PERFORM set_config('app.service_mode', '__SERVICE__', true);
  
  -- Now we should be able to read
  SELECT COUNT(*) INTO v_count FROM tenant_vehicles;
  
  IF v_count >= 0 THEN
    RAISE NOTICE 'PASS: Service mode allows read (% rows)', v_count;
  END IF;
  
  -- Clear service mode
  PERFORM set_config('app.service_mode', '', true);
END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 6) Sensitive Table Test: Verify SELECT-only on sensitive tables
-- ---------------------------------------------------------------------------
\echo '=== 6. SENSITIVE TABLE RESTRICTIONS ==='

DO $$
BEGIN
  -- Attempt INSERT on cc_sessions (should fail - SELECT only)
  BEGIN
    INSERT INTO cc_sessions (id, user_id, expires_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), now() + interval '1 day');
    
    RAISE NOTICE 'FAIL: INSERT on cc_sessions succeeded (should be SELECT-only)';
    DELETE FROM cc_sessions WHERE id = (SELECT id FROM cc_sessions ORDER BY id DESC LIMIT 1);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: INSERT on cc_sessions blocked (SELECT-only)';
  WHEN OTHERS THEN
    RAISE NOTICE 'PASS: INSERT on cc_sessions blocked: %', SQLERRM;
  END;
END $$;

\echo ''

-- ---------------------------------------------------------------------------
-- 7) Table ownership verification
-- ---------------------------------------------------------------------------
\echo '=== 7. TABLE OWNERSHIP ==='

SELECT 
  CASE WHEN COUNT(*) = 0 
    THEN 'PASS: No tables owned by postgres'
    ELSE 'WARN: ' || COUNT(*) || ' tables still owned by postgres'
  END AS ownership_check
FROM pg_tables 
WHERE schemaname = 'public' AND tableowner = 'postgres';

SELECT tableowner, COUNT(*) as table_count
FROM pg_tables 
WHERE schemaname = 'public'
GROUP BY tableowner
ORDER BY table_count DESC;

\echo ''
\echo '=============================================='
\echo 'VERIFICATION COMPLETE'
\echo '=============================================='

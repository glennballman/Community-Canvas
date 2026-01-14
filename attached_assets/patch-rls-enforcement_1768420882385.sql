-- ============================================================================
-- PATCH: RLS Enforcement Hardening
-- Purpose:
--   1. Create non-superuser test role for RLS verification
--   2. Add FORCE ROW LEVEL SECURITY to append-only truth tables
-- ============================================================================

-- ============================================================================
-- 1) Create RLS test role (dev/CI only)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_app_test') THEN
    CREATE ROLE cc_app_test LOGIN PASSWORD 'dev_only_change_me';
  END IF;
END $$;

-- Ensure it does NOT bypass RLS
ALTER ROLE cc_app_test NOBYPASSRLS;

-- Grant minimal table access for testing
GRANT USAGE ON SCHEMA public TO cc_app_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cc_app_test;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cc_app_test;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cc_app_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO cc_app_test;

-- ============================================================================
-- 2) FORCE ROW LEVEL SECURITY on append-only truth tables
--    This ensures even table OWNERS respect RLS (superuser still bypasses)
-- ============================================================================

-- Audit trail: immutable record of all system actions
ALTER TABLE cc_audit_trail FORCE ROW LEVEL SECURITY;

-- Folio ledger: immutable accounting entries (from Migration 110)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cc_folio_ledger') THEN
    EXECUTE 'ALTER TABLE cc_folio_ledger FORCE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check FORCE RLS is enabled (relforcerowsecurity = true)
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as force_rls
FROM pg_class
WHERE relname IN ('cc_audit_trail', 'cc_folio_ledger')
ORDER BY relname;

-- Verify test role exists with correct settings
SELECT 
  rolname,
  rolsuper,
  rolbypassrls
FROM pg_roles
WHERE rolname = 'cc_app_test';

-- ============================================================================
-- RLS IMMUTABILITY TEST (run as cc_app_test)
-- ============================================================================
/*
Run these commands to test RLS enforcement:

SET ROLE cc_app_test;

-- Emulate app session context
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000001';
SET LOCAL app.individual_id = '00000000-0000-0000-0000-000000000001';

-- These should fail or return 0 rows (RLS denied)
UPDATE cc_audit_trail SET action_description = 'SHOULD_FAIL';
DELETE FROM cc_audit_trail;

-- Reset back to superuser
RESET ROLE;
*/

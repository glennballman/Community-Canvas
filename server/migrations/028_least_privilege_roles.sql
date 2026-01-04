-- ============================================================================
-- MIGRATION 028 — Least-Privilege Role Setup (Safe)
-- Run as superuser (postgres)
-- 
-- NOTE: cc_app password is NOT set here. Set it via secure ops step.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Create owner role (NOLOGIN - cannot connect, just owns objects)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_owner') THEN
    CREATE ROLE cc_owner NOLOGIN;
    RAISE NOTICE 'Created role: cc_owner';
  ELSE
    RAISE NOTICE 'Role cc_owner already exists';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Create application role (LOGIN, no superuser, no RLS bypass)
--    Password is NOT set here - must be set via secure ops step
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_app') THEN
    CREATE ROLE cc_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    RAISE NOTICE 'Created role: cc_app (NO PASSWORD SET - set via ALTER ROLE)';
  ELSE
    RAISE NOTICE 'Role cc_app already exists';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Grant cc_owner to postgres so we can transfer ownership
-- ---------------------------------------------------------------------------
GRANT cc_owner TO postgres;

-- ---------------------------------------------------------------------------
-- 4) Define sensitive tables that get restricted grants
-- ---------------------------------------------------------------------------
-- These tables contain secrets, tokens, PII, or auth data
-- cc_app gets SELECT only (no INSERT/UPDATE/DELETE) on these

CREATE TEMP TABLE _sensitive_tables (tablename TEXT PRIMARY KEY);
INSERT INTO _sensitive_tables VALUES
  ('cc_identity_documents'),
  ('cc_sessions'),
  ('cc_payment_methods'),
  ('host_sessions'),
  ('staging_host_sessions'),
  ('staging_password_resets'),
  ('staging_sessions'),
  ('worker_verification_events');

-- ---------------------------------------------------------------------------
-- 5) Transfer table ownership to cc_owner
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tableowner = 'postgres'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO cc_owner', r.tablename);
  END LOOP;
  RAISE NOTICE 'Transferred table ownership to cc_owner';
END $$;

-- ---------------------------------------------------------------------------
-- 6) Transfer sequence ownership
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT sequencename FROM pg_sequences 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO cc_owner', r.sequencename);
  END LOOP;
  RAISE NOTICE 'Transferred sequence ownership to cc_owner';
END $$;

-- ---------------------------------------------------------------------------
-- 7) Transfer function ownership
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) OWNER TO cc_owner', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not transfer function %: %', r.proname, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Transferred function ownership to cc_owner';
END $$;

-- ---------------------------------------------------------------------------
-- 8) Transfer view ownership
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT viewname FROM pg_views 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO cc_owner', r.viewname);
  END LOOP;
  RAISE NOTICE 'Transferred view ownership to cc_owner';
END $$;

-- ---------------------------------------------------------------------------
-- 9) Grant schema usage to cc_app
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO cc_app;

-- ---------------------------------------------------------------------------
-- 10) Grant FULL permissions on non-sensitive tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename NOT IN (SELECT tablename FROM _sensitive_tables)
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO cc_app', r.tablename);
  END LOOP;
  RAISE NOTICE 'Granted full CRUD on non-sensitive tables to cc_app';
END $$;

-- ---------------------------------------------------------------------------
-- 11) Grant RESTRICTED permissions on sensitive tables (SELECT only)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT s.tablename 
    FROM _sensitive_tables s
    JOIN pg_tables t ON t.tablename = s.tablename AND t.schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO cc_app', r.tablename);
    RAISE NOTICE 'Granted SELECT-only on sensitive table: %', r.tablename;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 12) Grant sequence permissions
-- ---------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cc_app;

-- ---------------------------------------------------------------------------
-- 13) Grant execute on functions (needed for RLS helper functions)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cc_app;

-- ---------------------------------------------------------------------------
-- 14) Set default privileges for future objects created by cc_owner
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE cc_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cc_app;

ALTER DEFAULT PRIVILEGES FOR ROLE cc_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cc_app;

ALTER DEFAULT PRIVILEGES FOR ROLE cc_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO cc_app;

-- ---------------------------------------------------------------------------
-- 15) Cleanup temp table
-- ---------------------------------------------------------------------------
DROP TABLE _sensitive_tables;

COMMIT;

-- ============================================================================
-- POST-MIGRATION: Verify role properties
-- ============================================================================
SELECT 
  rolname, 
  rolsuper, 
  rolbypassrls, 
  rolcanlogin,
  CASE WHEN rolpassword IS NULL THEN 'NO PASSWORD' ELSE 'HAS PASSWORD' END as password_status
FROM pg_roles 
WHERE rolname IN ('cc_owner', 'cc_app', 'postgres');

-- ============================================================================
-- END MIGRATION 028
-- ============================================================================

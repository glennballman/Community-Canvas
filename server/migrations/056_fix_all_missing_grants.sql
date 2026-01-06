-- Migration: 056_fix_all_missing_grants
-- Fix missing grants for all tables that the parity check identified
-- This ensures cc_app and cc_owner have full CRUD access

-- Asset tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_capacities TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_capacities TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_children TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_children TO cc_owner;

-- Identity/session tables (keeping minimal required access for security)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_identity_documents TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_identity_documents TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_impersonation_events TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_impersonation_events TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_impersonation_logs TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_impersonation_logs TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_impersonation_sessions TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_impersonation_sessions TO cc_owner;

-- Payment methods
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_payment_methods TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_payment_methods TO cc_owner;

-- Platform tables (admin-only but granting for parity)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_platform_sessions TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_platform_sessions TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_platform_staff TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_platform_staff TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_platform_staff_bootstrap_tokens TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_platform_staff_bootstrap_tokens TO cc_owner;

-- Session tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_sessions TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_sessions TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE session TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE session TO cc_owner;

-- Projects and Work Requests (caught by runtime errors)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE projects TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE projects TO cc_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE work_requests TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE work_requests TO cc_owner;

-- CRM tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE crm_contacts TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE crm_contacts TO cc_owner;

-- Grant usage on any sequences for these tables
DO $$
DECLARE
  seq_name text;
BEGIN
  FOR seq_name IN 
    SELECT c.relname 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' 
      AND n.nspname = 'public'
      AND (c.relname LIKE 'asset_%_id_seq' OR c.relname LIKE 'cc_%_id_seq' OR c.relname LIKE 'projects_%_id_seq' OR c.relname LIKE 'work_requests_%_id_seq' OR c.relname LIKE 'crm_%_id_seq')
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO cc_app', seq_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO cc_owner', seq_name);
  END LOOP;
END $$;

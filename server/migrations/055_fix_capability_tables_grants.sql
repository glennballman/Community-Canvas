-- Migration 055: Fix grants for asset_capability_units and asset_constraints tables
-- These tables were created without proper grants for the cc_app role
-- causing "permission denied" errors when querying from the Operations Board

-- Grant permissions on asset_capability_units to cc_app (matches unified_assets pattern)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_capability_units TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_capability_units TO cc_owner;

-- Grant permissions on asset_constraints to cc_app
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_constraints TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_constraints TO cc_owner;

-- Also grant on resource_capacities if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resource_capacities') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE resource_capacities TO cc_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE resource_capacities TO cc_owner';
  END IF;
END $$;

-- Grant on any sequences for these tables
DO $$
BEGIN
  -- Grant usage on any sequences for these tables if they have auto-increment columns
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename LIKE 'asset_capability_units%') THEN
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cc_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cc_owner';
  END IF;
END $$;

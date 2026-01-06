-- Migration 055: Fix grants for capability and schedule tables
-- These tables were created without proper grants for the cc_app role
-- causing "permission denied" errors when querying from the Operations Board

-- Grant permissions on asset_capability_units to cc_app (matches unified_assets pattern)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_capability_units TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_capability_units TO cc_owner;

-- Grant permissions on asset_constraints to cc_app
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_constraints TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE asset_constraints TO cc_owner;

-- Grant permissions on resource_schedule_events to cc_app
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE resource_schedule_events TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE resource_schedule_events TO cc_owner;

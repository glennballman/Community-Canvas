-- Public Sites Foundation Migration
-- Adds site_config to portals for public site rendering

-- 1. Add site_config column to portals
ALTER TABLE portals ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}';

-- Create GIN index for efficient JSONB querying
CREATE INDEX IF NOT EXISTS idx_portals_site_config ON portals USING gin(site_config);

-- 2. Add indexes to existing reservations table for availability queries
CREATE INDEX IF NOT EXISTS idx_reservations_asset_dates ON reservations(asset_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_reservations_portal_id ON reservations(portal_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_booking_ref ON reservations(booking_ref);

-- 3. Add indexes to resource_schedule_events for availability queries
CREATE INDEX IF NOT EXISTS idx_rse_resource_dates ON resource_schedule_events(resource_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_rse_status ON resource_schedule_events(status);

-- 4. Ensure SELECT grants on media tables for public access (RLS policies provide tenant isolation)
-- Note: INSERT/UPDATE/DELETE removed for security - writes require authenticated tenant context
GRANT SELECT ON entity_media TO PUBLIC;
GRANT SELECT ON media TO PUBLIC;

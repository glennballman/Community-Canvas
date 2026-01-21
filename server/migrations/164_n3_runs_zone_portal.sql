-- Migration 164: Add portal_id and zone_id to cc_n3_runs for zone-aware Service Runs
-- Part of Prompt 17 - Service Runs (N3-Only Spine) Zone-Aware Advisory Estimates
-- PATENT CC-01 INVENTOR GLENN BALLMAN

-- Add portal_id for zone scoping
ALTER TABLE cc_n3_runs
ADD COLUMN IF NOT EXISTS portal_id UUID;

CREATE INDEX IF NOT EXISTS idx_cc_n3_runs_portal_id
ON cc_n3_runs(portal_id)
WHERE portal_id IS NOT NULL;

-- Add zone_id with FK to cc_zones
ALTER TABLE cc_n3_runs
ADD COLUMN IF NOT EXISTS zone_id UUID
REFERENCES cc_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cc_n3_runs_zone_id
ON cc_n3_runs(zone_id)
WHERE zone_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN cc_n3_runs.portal_id IS 'Portal scope for zone assignment - required for zone operations';
COMMENT ON COLUMN cc_n3_runs.zone_id IS 'Optional zone for zone-aware advisory pricing estimates';

-- Migration 165: Add default_zone_id to cc_portals for N3 zone defaulting
-- Part of Prompt 18: N3 Service Runs Portal Assignment + Zone Defaults

ALTER TABLE cc_portals
ADD COLUMN IF NOT EXISTS default_zone_id UUID
REFERENCES cc_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cc_portals_default_zone_id
ON cc_portals(default_zone_id)
WHERE default_zone_id IS NOT NULL;

COMMENT ON COLUMN cc_portals.default_zone_id IS 'Default zone for N3 runs created under this portal. Advisory pricing only.';

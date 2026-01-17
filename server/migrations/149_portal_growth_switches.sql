-- Migration 149: Portal Growth Switches
-- Adoption bridge UX for module enablement

-- Table: cc_portal_growth_switches
CREATE TABLE IF NOT EXISTS cc_portal_growth_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL UNIQUE REFERENCES cc_portals(id) ON DELETE CASCADE,
  jobs_enabled BOOLEAN NOT NULL DEFAULT true,
  reservations_state TEXT NOT NULL DEFAULT 'available' 
    CHECK (reservations_state IN ('available', 'request_only', 'enabled')),
  assets_enabled BOOLEAN NOT NULL DEFAULT false,
  service_runs_enabled BOOLEAN NOT NULL DEFAULT false,
  leads_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by_identity_id UUID NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_growth_switches_portal ON cc_portal_growth_switches(portal_id);

-- Enable RLS
ALTER TABLE cc_portal_growth_switches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service bypass
DROP POLICY IF EXISTS growth_switches_service_all ON cc_portal_growth_switches;
CREATE POLICY growth_switches_service_all ON cc_portal_growth_switches
  FOR ALL USING (is_service_mode());

-- Portal staff can SELECT
DROP POLICY IF EXISTS growth_switches_portal_staff_select ON cc_portal_growth_switches;
CREATE POLICY growth_switches_portal_staff_select ON cc_portal_growth_switches
  FOR SELECT USING (
    portal_id = current_setting('app.portal_id', true)::uuid
  );

-- Portal staff can UPDATE
DROP POLICY IF EXISTS growth_switches_portal_staff_update ON cc_portal_growth_switches;
CREATE POLICY growth_switches_portal_staff_update ON cc_portal_growth_switches
  FOR UPDATE USING (
    portal_id = current_setting('app.portal_id', true)::uuid
  );

-- Backfill existing portals
INSERT INTO cc_portal_growth_switches (portal_id)
SELECT id FROM cc_portals
WHERE id NOT IN (SELECT portal_id FROM cc_portal_growth_switches)
ON CONFLICT (portal_id) DO NOTHING;

COMMENT ON TABLE cc_portal_growth_switches IS 'Portal module adoption bridge - tracks which modules are enabled/available';
COMMENT ON COLUMN cc_portal_growth_switches.reservations_state IS 'available=can enable, request_only=must request, enabled=active';

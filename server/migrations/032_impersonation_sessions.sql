-- Migration 032: Platform Staff Impersonation Sessions
-- Enables audited, timeboxed impersonation of tenant contexts by platform staff

BEGIN;

-- 1. Create cc_impersonation_sessions table
CREATE TABLE IF NOT EXISTS cc_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_staff_id UUID NOT NULL REFERENCES cc_platform_staff(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  individual_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index for finding active session by staff member (only one active at a time)
-- Note: Cannot use now() in partial index predicate (not immutable), so we use a regular index
CREATE INDEX IF NOT EXISTS idx_impersonation_active 
  ON cc_impersonation_sessions (platform_staff_id, revoked_at, expires_at)
  WHERE revoked_at IS NULL;

-- 3. Index for audit queries by tenant
CREATE INDEX IF NOT EXISTS idx_impersonation_tenant 
  ON cc_impersonation_sessions (tenant_id, created_at DESC);

-- 4. Index for audit queries by staff
CREATE INDEX IF NOT EXISTS idx_impersonation_staff 
  ON cc_impersonation_sessions (platform_staff_id, created_at DESC);

-- 5. Add impersonation_session_id to catalog_claim_events for audit trail
ALTER TABLE catalog_claim_events 
  ADD COLUMN IF NOT EXISTS impersonation_session_id UUID REFERENCES cc_impersonation_sessions(id) ON DELETE SET NULL;

-- 6. Create function to check for active impersonation session
CREATE OR REPLACE FUNCTION get_active_impersonation(p_staff_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  individual_id UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.tenant_id,
    s.individual_id,
    s.reason,
    s.expires_at,
    s.created_at
  FROM cc_impersonation_sessions s
  WHERE s.platform_staff_id = p_staff_id
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant execute to cc_app role
GRANT EXECUTE ON FUNCTION get_active_impersonation(UUID) TO cc_app;

-- 8. Create impersonation audit event table for detailed tracking
CREATE TABLE IF NOT EXISTS cc_impersonation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonation_session_id UUID NOT NULL REFERENCES cc_impersonation_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'started', 'stopped', 'expired', 'action_taken'
  action_endpoint TEXT,
  action_method VARCHAR(10),
  action_resource_id UUID,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_events_session 
  ON cc_impersonation_events (impersonation_session_id, created_at DESC);

-- 9. RLS policy - impersonation tables are service-mode only (no tenant RLS)
-- Platform staff queries these via serviceQuery, not tenantQuery

-- 10. Grant permissions to cc_app role for impersonation operations
GRANT SELECT, INSERT, UPDATE ON cc_impersonation_sessions TO cc_app;
GRANT SELECT, INSERT ON cc_impersonation_events TO cc_app;

COMMIT;

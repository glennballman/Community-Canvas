-- Migration 033: GUC Bridge for Impersonation
-- Adds token-based authentication for impersonation and SQL helper functions

BEGIN;

-- 1. Add impersonation_token_hash column for secure token validation
-- Token is random opaque string, stored hashed for security
ALTER TABLE cc_impersonation_sessions 
  ADD COLUMN IF NOT EXISTS impersonation_token_hash VARCHAR(128);

-- 2. Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_impersonation_token_hash 
  ON cc_impersonation_sessions (impersonation_token_hash)
  WHERE impersonation_token_hash IS NOT NULL AND revoked_at IS NULL;

-- 3. SQL helper function to get current platform staff ID from GUC
CREATE OR REPLACE FUNCTION current_platform_staff_id()
RETURNS UUID AS $$
DECLARE
  val TEXT;
BEGIN
  val := current_setting('app.platform_staff_id', true);
  IF val IS NULL OR val = '' THEN
    RETURN NULL;
  END IF;
  RETURN val::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. SQL helper function to get current impersonation session ID from GUC
CREATE OR REPLACE FUNCTION current_impersonation_session_id()
RETURNS UUID AS $$
DECLARE
  val TEXT;
BEGIN
  val := current_setting('app.impersonation_session_id', true);
  IF val IS NULL OR val = '' THEN
    RETURN NULL;
  END IF;
  RETURN val::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Helper function to check if current request is via impersonation
CREATE OR REPLACE FUNCTION is_impersonation_mode()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_impersonation_session_id() IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION current_platform_staff_id() TO cc_app;
GRANT EXECUTE ON FUNCTION current_impersonation_session_id() TO cc_app;
GRANT EXECUTE ON FUNCTION is_impersonation_mode() TO cc_app;

-- 7. Function to lookup active impersonation session by token hash
CREATE OR REPLACE FUNCTION get_impersonation_by_token_hash(p_token_hash VARCHAR(128))
RETURNS TABLE (
  id UUID,
  platform_staff_id UUID,
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
    s.platform_staff_id,
    s.tenant_id,
    s.individual_id,
    s.reason,
    s.expires_at,
    s.created_at
  FROM cc_impersonation_sessions s
  WHERE s.impersonation_token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_impersonation_by_token_hash(VARCHAR) TO cc_app;

COMMIT;

-- ============================================================================
-- MIGRATION 181 — INVITATION POLICY TABLES (STEP 11C Phase 2A)
-- ============================================================================
-- Configurable rate limits for stakeholder invitations:
-- - Platform-wide defaults (singleton row)
-- - Per-tenant overrides (NULL = inherit from platform)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PLATFORM INVITE POLICY (singleton row for defaults)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_platform_invite_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE DEFAULT 'default',
  tenant_daily_cap integer NOT NULL DEFAULT 500,
  individual_hourly_cap integer NOT NULL DEFAULT 200,
  per_request_cap integer NOT NULL DEFAULT 50,
  email_send_per_minute integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cc_platform_invite_policy IS 'Platform-wide defaults for invitation rate limits. Singleton row.';
COMMENT ON COLUMN cc_platform_invite_policy.policy_key IS 'Unique key for policy row. Default is "default".';
COMMENT ON COLUMN cc_platform_invite_policy.tenant_daily_cap IS 'Max invitations per tenant per UTC day.';
COMMENT ON COLUMN cc_platform_invite_policy.individual_hourly_cap IS 'Max invitations per individual per hour.';
COMMENT ON COLUMN cc_platform_invite_policy.per_request_cap IS 'Max invitees allowed per single request.';
COMMENT ON COLUMN cc_platform_invite_policy.email_send_per_minute IS 'Soft throttle for email sends per minute.';

-- Seed the default policy row
INSERT INTO cc_platform_invite_policy (policy_key, tenant_daily_cap, individual_hourly_cap, per_request_cap, email_send_per_minute)
VALUES ('default', 500, 200, 50, 60)
ON CONFLICT (policy_key) DO NOTHING;

-- RLS for platform policy: read-only for service mode / platform admins
ALTER TABLE cc_platform_invite_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_platform_invite_policy FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_invite_policy_select ON cc_platform_invite_policy;
CREATE POLICY platform_invite_policy_select ON cc_platform_invite_policy
  FOR SELECT
  USING (is_service_mode() OR true);

DROP POLICY IF EXISTS platform_invite_policy_modify ON cc_platform_invite_policy;
CREATE POLICY platform_invite_policy_modify ON cc_platform_invite_policy
  FOR ALL
  USING (is_service_mode());

-- ============================================================================
-- TENANT INVITE POLICY (per-tenant overrides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_tenant_invite_policy (
  tenant_id uuid PRIMARY KEY REFERENCES cc_tenants(id) ON DELETE CASCADE,
  tenant_daily_cap integer NULL,
  individual_hourly_cap integer NULL,
  per_request_cap integer NULL,
  email_send_per_minute integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cc_tenant_invite_policy IS 'Per-tenant overrides for invitation rate limits. NULL = inherit from platform default.';
COMMENT ON COLUMN cc_tenant_invite_policy.tenant_daily_cap IS 'Override for max invitations per day. NULL = use platform default.';
COMMENT ON COLUMN cc_tenant_invite_policy.individual_hourly_cap IS 'Override for max invitations per hour. NULL = use platform default.';
COMMENT ON COLUMN cc_tenant_invite_policy.per_request_cap IS 'Override for max invitees per request. NULL = use platform default.';
COMMENT ON COLUMN cc_tenant_invite_policy.email_send_per_minute IS 'Override for email throttle. NULL = use platform default.';

-- RLS for tenant policy: tenant can read/write own row, service mode can access all
ALTER TABLE cc_tenant_invite_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_tenant_invite_policy FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_invite_policy_isolation ON cc_tenant_invite_policy;
CREATE POLICY tenant_invite_policy_isolation ON cc_tenant_invite_policy
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_service_mode());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cc_platform_invite_policy_key ON cc_platform_invite_policy(policy_key);
CREATE INDEX IF NOT EXISTS idx_cc_tenant_invite_policy_tenant ON cc_tenant_invite_policy(tenant_id);

COMMIT;

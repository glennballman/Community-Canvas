-- ============================================================================
-- MIGRATION 182 — SKIP EMAIL IF ON-PLATFORM POLICY (STEP 11C Phase 2B-2)
-- ============================================================================
-- Adds skip_email_if_on_platform column to policy tables to control whether
-- on-platform invitees receive email or in-app notification only.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PLATFORM INVITE POLICY — Add skip_email_if_on_platform (default false)
-- ============================================================================

ALTER TABLE cc_platform_invite_policy
ADD COLUMN IF NOT EXISTS skip_email_if_on_platform boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cc_platform_invite_policy.skip_email_if_on_platform IS 
  'When true, on-platform invitees receive in-app notification only (no email). Default false = both channels.';

-- ============================================================================
-- TENANT INVITE POLICY — Add skip_email_if_on_platform (nullable for inheritance)
-- ============================================================================

ALTER TABLE cc_tenant_invite_policy
ADD COLUMN IF NOT EXISTS skip_email_if_on_platform boolean NULL;

COMMENT ON COLUMN cc_tenant_invite_policy.skip_email_if_on_platform IS 
  'Override for skip_email_if_on_platform. NULL = inherit from platform default.';

COMMIT;

-- Migration 142: Future Job Tiering Scaffold
-- Attention + Assistance tiers for job placements (DISABLED by default)
-- This is SCAFFOLD ONLY - no behavioral changes until feature flags enabled

-- ============================================================================
-- STEP A: Create tier enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE job_attention_tier AS ENUM ('standard', 'featured', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_assistance_tier AS ENUM ('none', 'assisted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE job_attention_tier IS 'Job attention/visibility tier: standard (default), featured (+visibility), urgent (highlighted)';
COMMENT ON TYPE job_assistance_tier IS 'Job assistance tier: none (default), assisted (platform help with screening)';

-- ============================================================================
-- STEP B: Add tier columns to cc_paid_publication_intents
-- ============================================================================
ALTER TABLE cc_paid_publication_intents
  ADD COLUMN IF NOT EXISTS attention_tier job_attention_tier NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS assistance_tier job_assistance_tier NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS tier_price_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_currency CHAR(3) NOT NULL DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS tier_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN cc_paid_publication_intents.attention_tier IS 'Attention tier for visibility boost (scaffold, disabled by default)';
COMMENT ON COLUMN cc_paid_publication_intents.assistance_tier IS 'Assistance tier for platform screening help (scaffold, disabled by default)';
COMMENT ON COLUMN cc_paid_publication_intents.tier_price_cents IS 'Incremental price for tier add-ons only (NOT base portal price)';
COMMENT ON COLUMN cc_paid_publication_intents.tier_currency IS 'Currency for tier pricing (ISO 4217)';
COMMENT ON COLUMN cc_paid_publication_intents.tier_metadata IS 'Additional tier configuration and tracking data';

-- ============================================================================
-- STEP C: Create feature flags table
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_feature_flags (
  key TEXT PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'portal', 'tenant')),
  scope_id UUID NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_scope ON cc_feature_flags(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON cc_feature_flags(is_enabled) WHERE is_enabled = true;

COMMENT ON TABLE cc_feature_flags IS 'Feature flags for gradual feature rollout and A/B testing';
COMMENT ON COLUMN cc_feature_flags.key IS 'Unique feature flag identifier (e.g., job_tiers_enabled)';
COMMENT ON COLUMN cc_feature_flags.scope_type IS 'Scope: global (all), portal (specific portal), tenant (specific tenant)';
COMMENT ON COLUMN cc_feature_flags.scope_id IS 'UUID of portal or tenant when scope_type is not global';
COMMENT ON COLUMN cc_feature_flags.config IS 'JSON configuration for the feature (e.g., tier pricing)';

-- RLS for feature flags
ALTER TABLE cc_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_service_all ON cc_feature_flags;
CREATE POLICY feature_flags_service_all ON cc_feature_flags
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS feature_flags_read_global ON cc_feature_flags;
CREATE POLICY feature_flags_read_global ON cc_feature_flags
  FOR SELECT USING (
    scope_type = 'global'
    OR is_service_mode()
    OR (scope_type = 'tenant' AND scope_id::text = current_setting('app.tenant_id', true))
  );

-- ============================================================================
-- STEP D: Seed disabled job_tiers feature flag
-- ============================================================================
INSERT INTO cc_feature_flags (key, is_enabled, scope_type, description, config)
VALUES (
  'job_tiers_enabled',
  false,
  'global',
  'Enable job attention and assistance tiers (featured, urgent, assisted)',
  '{
    "attention_tiers": {
      "featured": {"price_cents_per_day": 100, "label": "Featured Job", "description": "Highlighted in search results"},
      "urgent": {"price_cents_flat": 700, "duration_days": 7, "label": "Urgently Hiring", "description": "Urgent badge for 7 days"}
    },
    "assistance_tiers": {
      "assisted": {"price_cents_per_month": 900, "label": "Assisted Hiring", "description": "Platform screening assistance"}
    }
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STEP E: Migration complete marker
-- ============================================================================
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (142, 'Future job tiering scaffold (disabled by default)', now())
ON CONFLICT DO NOTHING;

-- ONB-03: Guest → Claim → Promote columns
-- Additive columns for workspace claim and promotion tracking

-- Add claim/promote columns to cc_onboarding_workspaces
ALTER TABLE cc_onboarding_workspaces
  ADD COLUMN IF NOT EXISTS claimed_user_id UUID,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promotion_summary JSONB NOT NULL DEFAULT '{}';

-- Add promotion tracking to cc_onboarding_media_objects
ALTER TABLE cc_onboarding_media_objects
  ADD COLUMN IF NOT EXISTS promoted_media_id UUID,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

-- Add promotion tracking to cc_onboarding_items
ALTER TABLE cc_onboarding_items
  ADD COLUMN IF NOT EXISTS promoted_ingestion_id UUID,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

-- Indexes for promotion lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_media_promoted 
  ON cc_onboarding_media_objects(promoted_media_id) 
  WHERE promoted_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_items_promoted 
  ON cc_onboarding_items(promoted_ingestion_id) 
  WHERE promoted_ingestion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_workspaces_claimed 
  ON cc_onboarding_workspaces(claimed_user_id) 
  WHERE claimed_user_id IS NOT NULL;

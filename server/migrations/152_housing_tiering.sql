-- Migration 152: Housing Tiering (Hierarchy + Temp Staging)
-- Part of Bench Depth + Panic Mode + Housing Tiering feature set

-- Add tiering columns to waitlist entries
ALTER TABLE cc_portal_housing_waitlist_entries 
  ADD COLUMN IF NOT EXISTS housing_tier_assigned text NULL
    CHECK (housing_tier_assigned IS NULL OR housing_tier_assigned IN ('premium', 'standard', 'temporary', 'emergency'));

ALTER TABLE cc_portal_housing_waitlist_entries 
  ADD COLUMN IF NOT EXISTS staging_location_note text NULL;

ALTER TABLE cc_portal_housing_waitlist_entries 
  ADD COLUMN IF NOT EXISTS staging_start_date date NULL;

ALTER TABLE cc_portal_housing_waitlist_entries 
  ADD COLUMN IF NOT EXISTS staging_end_date date NULL;

ALTER TABLE cc_portal_housing_waitlist_entries 
  ADD COLUMN IF NOT EXISTS matched_housing_offer_id uuid NULL 
    REFERENCES cc_portal_housing_offers(id) ON DELETE SET NULL;

ALTER TABLE cc_portal_housing_waitlist_entries 
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 0;

-- Index for staging queries
CREATE INDEX IF NOT EXISTS idx_housing_waitlist_staging 
  ON cc_portal_housing_waitlist_entries(portal_id, housing_tier_assigned)
  WHERE housing_tier_assigned IN ('temporary', 'emergency');

CREATE INDEX IF NOT EXISTS idx_housing_waitlist_priority 
  ON cc_portal_housing_waitlist_entries(portal_id, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_housing_waitlist_matched_offer 
  ON cc_portal_housing_waitlist_entries(matched_housing_offer_id)
  WHERE matched_housing_offer_id IS NOT NULL;

-- Add housing tier to offers table
ALTER TABLE cc_portal_housing_offers 
  ADD COLUMN IF NOT EXISTS housing_tier text NOT NULL DEFAULT 'standard'
    CHECK (housing_tier IN ('premium', 'standard', 'temporary', 'emergency'));

-- Index for tier-based offer queries
CREATE INDEX IF NOT EXISTS idx_housing_offers_tier 
  ON cc_portal_housing_offers(portal_id, housing_tier);

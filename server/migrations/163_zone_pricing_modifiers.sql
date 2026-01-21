-- Migration 163: Zone Pricing Modifiers
-- Add pricing_modifiers JSONB column to cc_zones for zone-based pricing effects
-- These are advisory/estimate-only modifiers, not auto-charged

-- Add pricing_modifiers column to cc_zones
ALTER TABLE cc_zones ADD COLUMN IF NOT EXISTS pricing_modifiers jsonb NOT NULL DEFAULT '{}';

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_cc_zones_pricing_modifiers_gin ON cc_zones USING GIN(pricing_modifiers);

-- Add comment documenting the expected structure
COMMENT ON COLUMN cc_zones.pricing_modifiers IS 'Zone pricing modifiers for estimates. Expected keys: contractor_multiplier (number), logistics_surcharge_flat (number), time_risk_multiplier (number), notes (string). All modifiers are advisory only, not auto-charged.';

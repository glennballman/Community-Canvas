-- MIGRATION 054 — Booking Semantics Layer + Child Asset Linkage
-- Date: 2026-01-06
-- 
-- Purpose:
-- 1. Add 'start_end' to booking_mode enum for generic use
-- 2. Add time_granularity_minutes, constraints, capabilities, operational_status to unified_assets
-- 3. Create asset_children table for parent/child capability linkage

-- 1) Add 'start_end' to booking_mode enum
ALTER TYPE booking_mode ADD VALUE IF NOT EXISTS 'start_end';

-- 2) Add booking profile and capability columns to unified_assets
ALTER TABLE unified_assets ADD COLUMN IF NOT EXISTS time_granularity_minutes INTEGER DEFAULT 15;
ALTER TABLE unified_assets ADD COLUMN IF NOT EXISTS constraints JSONB DEFAULT '{}';
ALTER TABLE unified_assets ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]';
ALTER TABLE unified_assets ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) DEFAULT 'operational';

COMMENT ON COLUMN unified_assets.time_granularity_minutes IS 'Booking time precision in minutes (locked to 15 for now)';
COMMENT ON COLUMN unified_assets.constraints IS 'JSONB payload for max_weight_lbs, max_length_ft, pallet_capacity, etc.';
COMMENT ON COLUMN unified_assets.capabilities IS 'JSONB array of freeform capability tags';
COMMENT ON COLUMN unified_assets.operational_status IS 'operational | degraded | out_of_service';

-- 3) Create asset_children table for parent/child relationships
CREATE TABLE IF NOT EXISTS asset_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_asset_id UUID NOT NULL REFERENCES unified_assets(id) ON DELETE CASCADE,
  child_asset_id UUID NOT NULL REFERENCES unified_assets(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'subsystem',
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_asset_id, child_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_children_parent ON asset_children(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_children_child ON asset_children(child_asset_id);

COMMENT ON TABLE asset_children IS 'Links parent assets to child capability units (e.g., crane mounted on truck)';
COMMENT ON COLUMN asset_children.relationship_type IS 'mounted_tool | subsystem | trailer | crane | attachment';
COMMENT ON COLUMN asset_children.is_required IS 'If true, child out-of-service marks parent as degraded automatically';

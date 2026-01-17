-- Migration 151: Portal Candidate Bench (Readiness Layers)
-- Part of Bench Depth + Panic Mode + Housing Tiering feature set

-- Create candidate bench table
CREATE TABLE IF NOT EXISTS cc_portal_candidate_bench (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  individual_id uuid NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  readiness_state text NOT NULL DEFAULT 'prospect'
    CHECK (readiness_state IN ('prospect', 'cleared', 'ready', 'on_site', 'placed', 'inactive')),
  available_from_date date NULL,
  available_to_date date NULL,
  location_note text NULL,
  housing_needed boolean NOT NULL DEFAULT false,
  housing_tier_preference text NULL
    CHECK (housing_tier_preference IS NULL OR housing_tier_preference IN ('premium', 'standard', 'temporary', 'emergency')),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portal_id, individual_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bench_portal_state ON cc_portal_candidate_bench(portal_id, readiness_state);
CREATE INDEX IF NOT EXISTS idx_bench_portal_housing ON cc_portal_candidate_bench(portal_id) WHERE housing_needed = true;
CREATE INDEX IF NOT EXISTS idx_bench_availability ON cc_portal_candidate_bench(portal_id, available_from_date, available_to_date);
CREATE INDEX IF NOT EXISTS idx_bench_activity ON cc_portal_candidate_bench(portal_id, last_activity_at DESC);

-- Enable RLS
ALTER TABLE cc_portal_candidate_bench ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Portal staff can read/write for their portal
CREATE POLICY bench_portal_staff_all ON cc_portal_candidate_bench
  FOR ALL
  USING (
    portal_id = (current_setting('app.portal_id', true))::uuid
    OR is_service_mode()
  )
  WITH CHECK (
    portal_id = (current_setting('app.portal_id', true))::uuid
    OR is_service_mode()
  );

-- Service mode bypass for system operations
CREATE POLICY bench_service_all ON cc_portal_candidate_bench
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

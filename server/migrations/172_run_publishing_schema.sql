------------------------------------------------------------
-- V3.5 STEP 5A: Run Publishing Schema
-- Adds market_mode column and multi-portal publication support
------------------------------------------------------------

-- 1) Add market_mode to cc_n3_runs
-- Controls WHO can attach requests to this run (competition, not visibility)
-- Allowed values: OPEN, INVITE_ONLY, CLOSED
-- TARGETED is demand-side only and MUST NOT be used here

ALTER TABLE cc_n3_runs 
ADD COLUMN IF NOT EXISTS market_mode TEXT DEFAULT 'INVITE_ONLY';

-- Add CHECK constraint for allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'cc_n3_runs_market_mode_check'
  ) THEN
    ALTER TABLE cc_n3_runs
    ADD CONSTRAINT cc_n3_runs_market_mode_check 
    CHECK (market_mode IN ('OPEN', 'INVITE_ONLY', 'CLOSED'));
  END IF;
END $$;

COMMENT ON COLUMN cc_n3_runs.market_mode IS 
'Controls who can attach requests. OPEN=any eligible, INVITE_ONLY=invited only, CLOSED=no new attachments. TARGETED is not valid for runs (supply-side). See docs/TERMINOLOGY_CANON.md';

-- 2) Create multi-portal publication join table
-- Controls WHERE the run is visible (visibility, not competition)

CREATE TABLE IF NOT EXISTS cc_run_portal_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by_party_id UUID REFERENCES cc_parties(id),
  unpublished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, run_id, portal_id)
);

COMMENT ON TABLE cc_run_portal_publications IS 
'Join table for run visibility across multiple portals. Publishing ≠ commitment ≠ attachment. See docs/TERMINOLOGY_CANON.md';

-- 3) Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_run_portal_publications_run_id 
ON cc_run_portal_publications(run_id);

CREATE INDEX IF NOT EXISTS idx_run_portal_publications_portal_id 
ON cc_run_portal_publications(portal_id);

CREATE INDEX IF NOT EXISTS idx_run_portal_publications_tenant_id 
ON cc_run_portal_publications(tenant_id);

CREATE INDEX IF NOT EXISTS idx_run_portal_publications_active
ON cc_run_portal_publications(run_id, portal_id) 
WHERE unpublished_at IS NULL;

-- 4) Enable RLS (match existing cc_* table patterns)
ALTER TABLE cc_run_portal_publications ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cc_run_portal_publications' 
    AND policyname = 'cc_run_portal_publications_tenant_isolation'
  ) THEN
    CREATE POLICY cc_run_portal_publications_tenant_isolation 
    ON cc_run_portal_publications
    FOR ALL
    USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- Service bypass policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cc_run_portal_publications' 
    AND policyname = 'cc_run_portal_publications_service_bypass'
  ) THEN
    CREATE POLICY cc_run_portal_publications_service_bypass 
    ON cc_run_portal_publications
    FOR ALL
    USING (current_setting('app.tenant_id', true) = '__SERVICE__');
  END IF;
END $$;

-- STEP 11C Phase 2C-3: Structured Schedule Proposals
-- Deterministic negotiation primitive for service run schedule changes
-- Append-only event ledger with turn cap enforcement

-- ============================================================
-- A) TABLE: cc_service_run_schedule_proposals
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_service_run_schedule_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  run_id uuid NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  run_tenant_id uuid NOT NULL REFERENCES cc_tenants(id),

  -- who initiated this event
  actor_individual_id uuid NOT NULL REFERENCES cc_individuals(id),
  actor_role text NOT NULL CHECK (actor_role IN ('tenant', 'stakeholder')),

  -- optional linkage to the triggering response/resolution
  response_id uuid NULL REFERENCES cc_service_run_stakeholder_responses(id) ON DELETE SET NULL,
  resolution_id uuid NULL REFERENCES cc_service_run_response_resolutions(id) ON DELETE SET NULL,

  event_type text NOT NULL CHECK (event_type IN ('proposed', 'countered', 'accepted', 'declined')),

  -- proposal window (required for proposed/countered, null for accepted/declined)
  proposed_start timestamptz NULL,
  proposed_end timestamptz NULL,

  note text NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sr_schedprop_run_created
  ON cc_service_run_schedule_proposals(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sr_schedprop_run_event
  ON cc_service_run_schedule_proposals(run_id, event_type);

-- Constraint: proposed window integrity
-- proposed/countered require valid window; accepted/declined must have null window
ALTER TABLE cc_service_run_schedule_proposals
  DROP CONSTRAINT IF EXISTS chk_sr_schedprop_window;

ALTER TABLE cc_service_run_schedule_proposals
  ADD CONSTRAINT chk_sr_schedprop_window
  CHECK (
    (event_type IN ('proposed', 'countered') AND proposed_start IS NOT NULL AND proposed_end IS NOT NULL AND proposed_end > proposed_start)
    OR (event_type IN ('accepted', 'declined') AND proposed_start IS NULL AND proposed_end IS NULL)
  );

-- ============================================================
-- B) RLS POLICIES
-- ============================================================

ALTER TABLE cc_service_run_schedule_proposals ENABLE ROW LEVEL SECURITY;

-- 1) Tenant select: tenant owners see all for their runs
DROP POLICY IF EXISTS sr_schedprop_select_tenant ON cc_service_run_schedule_proposals;
CREATE POLICY sr_schedprop_select_tenant
ON cc_service_run_schedule_proposals
FOR SELECT
USING (run_tenant_id = current_tenant_id());

-- 2) Stakeholder select: stakeholders see events for runs they have access to
DROP POLICY IF EXISTS sr_schedprop_select_stakeholder ON cc_service_run_schedule_proposals;
CREATE POLICY sr_schedprop_select_stakeholder
ON cc_service_run_schedule_proposals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM cc_service_run_stakeholders s
    WHERE s.run_id = cc_service_run_schedule_proposals.run_id
      AND s.stakeholder_individual_id = current_individual_id()
      AND s.revoked_at IS NULL
      AND s.status = 'active'
  )
);

-- 3) Insert policy: tenant or stakeholder can insert
DROP POLICY IF EXISTS sr_schedprop_insert_actor ON cc_service_run_schedule_proposals;
CREATE POLICY sr_schedprop_insert_actor
ON cc_service_run_schedule_proposals
FOR INSERT
WITH CHECK (
  run_tenant_id IS NOT NULL
  AND (
    (actor_role = 'tenant' AND run_tenant_id = current_tenant_id())
    OR
    (actor_role = 'stakeholder' AND EXISTS (
      SELECT 1 FROM cc_service_run_stakeholders s
      WHERE s.run_id = cc_service_run_schedule_proposals.run_id
        AND s.stakeholder_individual_id = current_individual_id()
        AND s.revoked_at IS NULL
        AND s.status = 'active'
    ))
  )
);

-- 4) Service mode bypass
DROP POLICY IF EXISTS sr_schedprop_service_bypass ON cc_service_run_schedule_proposals;
CREATE POLICY sr_schedprop_service_bypass
ON cc_service_run_schedule_proposals
FOR ALL
USING (is_service_mode());

-- ============================================================
-- STEP 11C Phase 2C-3 Complete
-- ============================================================

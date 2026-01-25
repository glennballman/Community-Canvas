-- STEP 11C Phase 2C-1: Stakeholder Responses
-- Append-only table for stakeholder responses (confirm / request_change / question)
-- Patent CC-13 Inventor Glenn Ballman

BEGIN;

CREATE TABLE IF NOT EXISTS cc_service_run_stakeholder_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  run_tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  stakeholder_individual_id uuid NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  response_type text NOT NULL CHECK (response_type IN ('confirm', 'request_change', 'question')),
  message text NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_responses_run ON cc_service_run_stakeholder_responses(run_id, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_stakeholder_responses_individual ON cc_service_run_stakeholder_responses(stakeholder_individual_id, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_stakeholder_responses_tenant ON cc_service_run_stakeholder_responses(run_tenant_id, responded_at DESC);

ALTER TABLE cc_service_run_stakeholder_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stakeholder_select_own ON cc_service_run_stakeholder_responses;
CREATE POLICY stakeholder_select_own ON cc_service_run_stakeholder_responses
  FOR SELECT
  USING (
    stakeholder_individual_id = current_individual_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS stakeholder_insert_own ON cc_service_run_stakeholder_responses;
CREATE POLICY stakeholder_insert_own ON cc_service_run_stakeholder_responses
  FOR INSERT
  WITH CHECK (
    stakeholder_individual_id = current_individual_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS tenant_select_by_run_tenant ON cc_service_run_stakeholder_responses;
CREATE POLICY tenant_select_by_run_tenant ON cc_service_run_stakeholder_responses
  FOR SELECT
  USING (
    run_tenant_id = current_tenant_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS service_mode_all ON cc_service_run_stakeholder_responses;
CREATE POLICY service_mode_all ON cc_service_run_stakeholder_responses
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

COMMIT;

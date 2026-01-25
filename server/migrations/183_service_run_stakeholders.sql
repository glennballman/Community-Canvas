BEGIN;

CREATE TABLE IF NOT EXISTS cc_service_run_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  run_tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  stakeholder_individual_id uuid NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  invite_id uuid NULL REFERENCES cc_invitations(id) ON DELETE SET NULL,
  stakeholder_role text NULL,
  status text NOT NULL DEFAULT 'active',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  revoked_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_run_stakeholder UNIQUE(run_id, stakeholder_individual_id)
);

COMMENT ON TABLE cc_service_run_stakeholders IS 'Stakeholder access grants per service run. Created on invitation claim, revoked on invitation revoke.';
COMMENT ON COLUMN cc_service_run_stakeholders.run_tenant_id IS 'Denormalized tenant ID from cc_n3_runs for RLS policy enforcement';
COMMENT ON COLUMN cc_service_run_stakeholders.status IS 'active or revoked - soft delete pattern for auditability';
COMMENT ON COLUMN cc_service_run_stakeholders.stakeholder_role IS 'Copied from invitation.invitee_role at grant time';

CREATE INDEX IF NOT EXISTS idx_run_stakeholders_run_id ON cc_service_run_stakeholders(run_id);
CREATE INDEX IF NOT EXISTS idx_run_stakeholders_individual ON cc_service_run_stakeholders(stakeholder_individual_id);
CREATE INDEX IF NOT EXISTS idx_run_stakeholders_tenant ON cc_service_run_stakeholders(run_tenant_id);
CREATE INDEX IF NOT EXISTS idx_run_stakeholders_invite ON cc_service_run_stakeholders(invite_id);
CREATE INDEX IF NOT EXISTS idx_run_stakeholders_status ON cc_service_run_stakeholders(status);

ALTER TABLE cc_service_run_stakeholders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stakeholder_self_select ON cc_service_run_stakeholders;
CREATE POLICY stakeholder_self_select ON cc_service_run_stakeholders
  FOR SELECT
  USING (
    stakeholder_individual_id = current_individual_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS run_tenant_select ON cc_service_run_stakeholders;
CREATE POLICY run_tenant_select ON cc_service_run_stakeholders
  FOR SELECT
  USING (
    run_tenant_id = current_tenant_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS run_tenant_update ON cc_service_run_stakeholders;
CREATE POLICY run_tenant_update ON cc_service_run_stakeholders
  FOR UPDATE
  USING (
    run_tenant_id = current_tenant_id()
    OR is_service_mode()
  );

DROP POLICY IF EXISTS service_mode_all ON cc_service_run_stakeholders;
CREATE POLICY service_mode_all ON cc_service_run_stakeholders
  FOR ALL
  USING (is_service_mode());

COMMIT;

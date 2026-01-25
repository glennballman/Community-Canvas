-- Migration 190: Negotiation Policy Audit Trail
-- STEP 11C Phase 2C-8
-- Append-only audit table for negotiation policy resolution
-- Dedupe by request_fingerprint to prevent write amplification

CREATE TABLE IF NOT EXISTS cc_negotiation_policy_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  portal_id uuid,
  run_id uuid NOT NULL,
  actor_individual_id uuid,
  actor_type text NOT NULL,
  negotiation_type text NOT NULL,
  effective_source text NOT NULL,
  effective_policy_id uuid NOT NULL,
  effective_policy_updated_at timestamptz NOT NULL,
  effective_policy_hash text NOT NULL,
  request_fingerprint text NOT NULL,
  CONSTRAINT chk_audit_actor_type CHECK (actor_type IN ('provider', 'stakeholder', 'tenant_admin', 'platform_admin')),
  CONSTRAINT chk_audit_negotiation_type CHECK (negotiation_type IN ('schedule', 'scope', 'pricing')),
  CONSTRAINT chk_audit_effective_source CHECK (effective_source IN ('platform', 'tenant_override'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_negotiation_policy_audit_fingerprint 
  ON cc_negotiation_policy_audit_events(request_fingerprint);

CREATE INDEX IF NOT EXISTS idx_negotiation_policy_audit_run 
  ON cc_negotiation_policy_audit_events(run_id, negotiation_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_negotiation_policy_audit_tenant 
  ON cc_negotiation_policy_audit_events(tenant_id, portal_id, created_at DESC);

ALTER TABLE cc_negotiation_policy_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_negotiation_policy_audit_tenant_read ON cc_negotiation_policy_audit_events
  FOR SELECT
  USING (
    is_service_mode() 
    OR tenant_id = current_setting('cc.tenant_id', true)::uuid
  );

CREATE POLICY rls_negotiation_policy_audit_insert ON cc_negotiation_policy_audit_events
  FOR INSERT
  WITH CHECK (
    is_service_mode()
    OR tenant_id = current_setting('cc.tenant_id', true)::uuid
  );

COMMENT ON TABLE cc_negotiation_policy_audit_events IS 'Append-only audit log for negotiation policy resolutions. Dedupe by request_fingerprint.';

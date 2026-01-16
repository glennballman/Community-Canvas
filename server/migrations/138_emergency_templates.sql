-- P2.12 Emergency Templates + Emergency Circle Mode Hardening
-- Migration 138: Emergency templates, property profiles, runs, scope grants, and events

-- 1) cc_emergency_templates
CREATE TABLE IF NOT EXISTS cc_emergency_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid NULL,
  circle_id uuid NULL,
  template_type text NOT NULL CHECK (template_type IN ('tsunami', 'wildfire', 'power_outage', 'storm', 'medical', 'security', 'evacuation', 'other')),
  title text NOT NULL,
  description text NULL,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  template_json jsonb NOT NULL,
  template_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  sealed_bundle_id uuid NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emergency_templates_tenant_type_status ON cc_emergency_templates (tenant_id, template_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_templates_tenant_type_version ON cc_emergency_templates (tenant_id, template_type, version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_templates_client_request ON cc_emergency_templates (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 2) cc_property_emergency_profiles
CREATE TABLE IF NOT EXISTS cc_property_emergency_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid NULL,
  property_asset_id uuid NULL,
  property_label text NOT NULL,
  address text NULL,
  lat numeric NULL,
  lon numeric NULL,
  hazard_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_property_emergency_profiles_tenant_created ON cc_property_emergency_profiles (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_emergency_profiles_client_request ON cc_property_emergency_profiles (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 3) cc_emergency_runs
CREATE TABLE IF NOT EXISTS cc_emergency_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid NULL,
  circle_id uuid NULL,
  template_id uuid NULL REFERENCES cc_emergency_templates(id) ON DELETE SET NULL,
  property_profile_id uuid NULL REFERENCES cc_property_emergency_profiles(id) ON DELETE SET NULL,
  run_type text NOT NULL CHECK (run_type IN ('tsunami', 'wildfire', 'power_outage', 'storm', 'medical', 'security', 'evacuation', 'other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by_individual_id uuid NULL,
  resolved_at timestamptz NULL,
  resolved_by_individual_id uuid NULL,
  summary text NULL,
  legal_hold_id uuid NULL,
  coordination_bundle_id uuid NULL,
  authority_grant_id uuid NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emergency_runs_tenant_status ON cc_emergency_runs (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_emergency_runs_tenant_started ON cc_emergency_runs (tenant_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_runs_client_request ON cc_emergency_runs (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 4) cc_emergency_scope_grants
CREATE TABLE IF NOT EXISTS cc_emergency_scope_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  circle_id uuid NULL,
  run_id uuid NOT NULL REFERENCES cc_emergency_runs(id) ON DELETE CASCADE,
  grantee_individual_id uuid NOT NULL,
  grant_type text NOT NULL CHECK (grant_type IN ('asset_control', 'tool_access', 'vehicle_access', 'lodging_access', 'communications_interrupt', 'procurement_override', 'gate_access', 'other')),
  scope_json jsonb NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_individual_id uuid NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  revoked_by_individual_id uuid NULL,
  revoke_reason text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emergency_scope_grants_tenant_run ON cc_emergency_scope_grants (tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_emergency_scope_grants_tenant_grantee_status ON cc_emergency_scope_grants (tenant_id, grantee_individual_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emergency_scope_grants_client_request ON cc_emergency_scope_grants (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 5) cc_emergency_run_events
CREATE TABLE IF NOT EXISTS cc_emergency_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES cc_emergency_runs(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('run_started', 'template_bound', 'property_bound', 'scope_granted', 'scope_revoked', 'playbook_exported', 'evidence_attached', 'authority_shared', 'resolved', 'cancelled')),
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_individual_id uuid NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emergency_run_events_tenant_run_at ON cc_emergency_run_events (tenant_id, run_id, event_at DESC);

-- RLS Policies
ALTER TABLE cc_emergency_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_property_emergency_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_emergency_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_emergency_scope_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_emergency_run_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE cc_emergency_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE cc_property_emergency_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE cc_emergency_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE cc_emergency_scope_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE cc_emergency_run_events FORCE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY cc_emergency_templates_tenant_policy ON cc_emergency_templates
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY cc_property_emergency_profiles_tenant_policy ON cc_property_emergency_profiles
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY cc_emergency_runs_tenant_policy ON cc_emergency_runs
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY cc_emergency_scope_grants_tenant_policy ON cc_emergency_scope_grants
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY cc_emergency_run_events_tenant_policy ON cc_emergency_run_events
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

-- Prevent mutation of run events (append-only)
CREATE OR REPLACE FUNCTION cc_prevent_run_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'EMERGENCY_RUN_EVENTS_IMMUTABLE: Cannot update emergency run events';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'EMERGENCY_RUN_EVENTS_IMMUTABLE: Cannot delete emergency run events';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cc_emergency_run_events_immutable
  BEFORE UPDATE OR DELETE ON cc_emergency_run_events
  FOR EACH ROW EXECUTE FUNCTION cc_prevent_run_event_mutation();

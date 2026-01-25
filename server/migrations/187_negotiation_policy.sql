-- STEP 11C Phase 2C-3.0: Deterministic Negotiation Policy Tables
-- Platform-level defaults and tenant-level overrides for negotiation behavior

-- 1. Platform Negotiation Policy (defaults)
CREATE TABLE IF NOT EXISTS cc_platform_negotiation_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  negotiation_type text NOT NULL
    CHECK (negotiation_type IN (
      'schedule',
      'scope',
      'pricing'
    )),

  -- Turn control
  max_turns integer NOT NULL,
  allow_counter boolean NOT NULL DEFAULT true,

  -- Closure rules
  close_on_accept boolean NOT NULL DEFAULT true,
  close_on_decline boolean NOT NULL DEFAULT true,

  -- Who can initiate
  provider_can_initiate boolean NOT NULL DEFAULT true,
  stakeholder_can_initiate boolean NOT NULL DEFAULT true,

  -- Proposal shell integration (future-safe)
  allow_proposal_context boolean NOT NULL DEFAULT false,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (negotiation_type)
);

-- 2. Tenant Negotiation Policy (overrides)
CREATE TABLE IF NOT EXISTS cc_tenant_negotiation_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL REFERENCES cc_tenants(id),

  negotiation_type text NOT NULL
    CHECK (negotiation_type IN (
      'schedule',
      'scope',
      'pricing'
    )),

  -- Overrides (NULL = inherit platform)
  max_turns integer,
  allow_counter boolean,
  close_on_accept boolean,
  close_on_decline boolean,
  provider_can_initiate boolean,
  stakeholder_can_initiate boolean,
  allow_proposal_context boolean,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, negotiation_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_neg_policy_tenant ON cc_tenant_negotiation_policy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_neg_policy_type ON cc_tenant_negotiation_policy(negotiation_type);

-- RLS
ALTER TABLE cc_platform_negotiation_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_tenant_negotiation_policy ENABLE ROW LEVEL SECURITY;

-- Platform policies: service mode only for full access, select for all authenticated
DROP POLICY IF EXISTS platform_policy_service_bypass ON cc_platform_negotiation_policy;
CREATE POLICY platform_policy_service_bypass
ON cc_platform_negotiation_policy
FOR ALL
USING (is_service_mode());

DROP POLICY IF EXISTS platform_policy_select_any ON cc_platform_negotiation_policy;
CREATE POLICY platform_policy_select_any
ON cc_platform_negotiation_policy
FOR SELECT
USING (true);

-- Tenant policies: tenant-scoped access
DROP POLICY IF EXISTS tenant_policy_select ON cc_tenant_negotiation_policy;
CREATE POLICY tenant_policy_select
ON cc_tenant_negotiation_policy
FOR SELECT
USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS tenant_policy_insert ON cc_tenant_negotiation_policy;
CREATE POLICY tenant_policy_insert
ON cc_tenant_negotiation_policy
FOR INSERT
WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS tenant_policy_update ON cc_tenant_negotiation_policy;
CREATE POLICY tenant_policy_update
ON cc_tenant_negotiation_policy
FOR UPDATE
USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS tenant_policy_delete ON cc_tenant_negotiation_policy;
CREATE POLICY tenant_policy_delete
ON cc_tenant_negotiation_policy
FOR DELETE
USING (tenant_id = current_tenant_id() OR is_service_mode());

-- Seed platform defaults
INSERT INTO cc_platform_negotiation_policy
(negotiation_type, max_turns, allow_counter, allow_proposal_context)
VALUES
('schedule', 3, true, false),
('scope', 5, true, true),
('pricing', 5, true, true)
ON CONFLICT (negotiation_type) DO UPDATE SET
  max_turns = EXCLUDED.max_turns,
  allow_counter = EXCLUDED.allow_counter,
  allow_proposal_context = EXCLUDED.allow_proposal_context,
  updated_at = now();

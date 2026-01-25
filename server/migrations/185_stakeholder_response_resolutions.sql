-- Migration: 185_stakeholder_response_resolutions.sql
-- Description: Add append-only resolution table for stakeholder responses
-- Date: 2026-01-25
-- Step: STEP 11C Phase 2C-2

-- Create resolutions table
CREATE TABLE IF NOT EXISTS cc_service_run_response_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  response_id uuid NOT NULL
    REFERENCES cc_service_run_stakeholder_responses(id) ON DELETE CASCADE,

  run_id uuid NOT NULL
    REFERENCES cc_n3_runs(id) ON DELETE CASCADE,

  run_tenant_id uuid NOT NULL
    REFERENCES cc_tenants(id),

  resolver_individual_id uuid NOT NULL
    REFERENCES cc_individuals(id),

  resolution_type text NOT NULL CHECK (
    resolution_type IN ('acknowledged', 'accepted', 'declined', 'proposed_change')
  ),

  message text,

  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_run_response_resolutions_response
  ON cc_service_run_response_resolutions(response_id, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_run_response_resolutions_run
  ON cc_service_run_response_resolutions(run_id);

-- Idempotency guard: prevent double-click spam within same minute
CREATE UNIQUE INDEX IF NOT EXISTS uq_response_resolution_idempotent
ON cc_service_run_response_resolutions (
  response_id,
  resolver_individual_id,
  resolution_type,
  date_trunc('minute', resolved_at)
);

-- RLS
ALTER TABLE cc_service_run_response_resolutions ENABLE ROW LEVEL SECURITY;

-- SELECT: Tenant owners + stakeholders who own the response being resolved
DROP POLICY IF EXISTS resolution_select ON cc_service_run_response_resolutions;
CREATE POLICY resolution_select
ON cc_service_run_response_resolutions
FOR SELECT
USING (
  run_tenant_id = current_tenant_id()
  OR resolver_individual_id = current_individual_id()
  OR EXISTS (
    SELECT 1 FROM cc_service_run_stakeholder_responses sr
    WHERE sr.id = cc_service_run_response_resolutions.response_id
      AND sr.stakeholder_individual_id = current_individual_id()
  )
);

-- INSERT: Tenant owners only (not in service mode)
DROP POLICY IF EXISTS resolution_insert_tenant ON cc_service_run_response_resolutions;
CREATE POLICY resolution_insert_tenant
ON cc_service_run_response_resolutions
FOR INSERT
WITH CHECK (
  run_tenant_id = current_tenant_id()
  AND is_service_mode() = false
);

-- Service mode bypass
DROP POLICY IF EXISTS resolution_service_bypass ON cc_service_run_response_resolutions;
CREATE POLICY resolution_service_bypass
ON cc_service_run_response_resolutions
FOR ALL
USING (is_service_mode());

-- Migration 153: Emergency Replacement Requests (Panic Mode)
-- Part of Bench Depth + Panic Mode + Housing Tiering feature set

-- Create emergency replacement requests table
CREATE TABLE IF NOT EXISTS cc_emergency_replacement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  tenant_id uuid NULL REFERENCES cc_tenants(id) ON DELETE SET NULL,
  job_id uuid NULL REFERENCES cc_jobs(id) ON DELETE SET NULL,
  job_posting_id uuid NULL REFERENCES cc_job_postings(id) ON DELETE SET NULL,
  role_title_snapshot text NOT NULL,
  urgency text NOT NULL DEFAULT 'today'
    CHECK (urgency IN ('now', 'today', 'this_week')),
  start_date date NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'triaging', 'filled', 'cancelled')),
  created_by_identity_id uuid NULL,
  filled_by_bench_id uuid NULL REFERENCES cc_portal_candidate_bench(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emergency_portal_status 
  ON cc_emergency_replacement_requests(portal_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_tenant 
  ON cc_emergency_replacement_requests(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emergency_urgency 
  ON cc_emergency_replacement_requests(portal_id, urgency) WHERE status = 'open';

-- Enable RLS
ALTER TABLE cc_emergency_replacement_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Portal staff can read/write for their portal
CREATE POLICY emergency_portal_staff_all ON cc_emergency_replacement_requests
  FOR ALL
  USING (
    portal_id = (current_setting('app.portal_id', true))::uuid
    OR is_service_mode()
  )
  WITH CHECK (
    portal_id = (current_setting('app.portal_id', true))::uuid
    OR is_service_mode()
  );

-- Service mode bypass
CREATE POLICY emergency_service_all ON cc_emergency_replacement_requests
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

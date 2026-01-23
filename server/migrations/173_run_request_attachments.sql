-- ============================================================================
-- Migration 173: Run Request Attachments (STEP 6)
--
-- Two-phase attachment model: HOLD -> COMMIT
-- Supports linking multiple service requests to a service run
-- ============================================================================

-- STEP 1: Add missing status values to work_request_status enum
-- Required by TERMINOLOGY_CANON.md v2
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'awaiting_commitment';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'unassigned';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'proposed_change';

-- STEP 2: Create attachment status enum
DO $$ BEGIN
  CREATE TYPE cc_run_attachment_status AS ENUM ('HELD', 'COMMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- STEP 3: Create the cc_run_request_attachments join table
CREATE TABLE IF NOT EXISTS cc_run_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES cc_work_requests(id) ON DELETE CASCADE,
  status cc_run_attachment_status NOT NULL DEFAULT 'HELD',
  held_at TIMESTAMPTZ NULL,
  committed_at TIMESTAMPTZ NULL,
  released_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one attachment per tenant/run/request combination
  CONSTRAINT uq_run_request_attachment UNIQUE (tenant_id, run_id, request_id)
);

-- STEP 4: Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_run_request_attachments_tenant_run 
  ON cc_run_request_attachments(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_run_request_attachments_tenant_request 
  ON cc_run_request_attachments(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_run_request_attachments_tenant_run_status 
  ON cc_run_request_attachments(tenant_id, run_id, status);
CREATE INDEX IF NOT EXISTS idx_run_request_attachments_active 
  ON cc_run_request_attachments(tenant_id, run_id) 
  WHERE released_at IS NULL;

-- STEP 5: Enable RLS
ALTER TABLE cc_run_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_run_request_attachments FORCE ROW LEVEL SECURITY;

-- STEP 6: RLS policies
DROP POLICY IF EXISTS run_request_attachments_tenant_isolation ON cc_run_request_attachments;
CREATE POLICY run_request_attachments_tenant_isolation ON cc_run_request_attachments
  FOR ALL
  USING (
    CASE 
      WHEN is_service_mode() THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE 
      WHEN is_service_mode() THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  );

-- STEP 7: Updated_at trigger
CREATE OR REPLACE FUNCTION update_run_request_attachment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_run_request_attachments_updated_at ON cc_run_request_attachments;
CREATE TRIGGER trg_run_request_attachments_updated_at
  BEFORE UPDATE ON cc_run_request_attachments
  FOR EACH ROW EXECUTE FUNCTION update_run_request_attachment_updated_at();

-- STEP 8: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_run_request_attachments TO PUBLIC;

SELECT 'Migration 173: cc_run_request_attachments table created with two-phase attachment model' AS status;

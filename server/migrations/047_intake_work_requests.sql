-- ============================================================================
-- FIX: Rename old work_requests to procurement_requests, create new intake system
-- Migration: 047_intake_work_requests.sql
-- ============================================================================

-- Rename old work_requests (procurement system) to procurement_requests
ALTER TABLE IF EXISTS work_requests RENAME TO procurement_requests;
ALTER TABLE IF EXISTS work_request_invites RENAME TO procurement_request_invites;

-- Update references if they exist
ALTER TABLE IF EXISTS bids RENAME COLUMN work_request_id TO procurement_request_id;
ALTER TABLE IF EXISTS procurement_request_invites RENAME COLUMN work_request_id TO procurement_request_id;

-- Rename indexes
ALTER INDEX IF EXISTS idx_work_requests_tenant RENAME TO idx_procurement_requests_tenant;
ALTER INDEX IF EXISTS idx_work_requests_status RENAME TO idx_procurement_requests_status;
ALTER INDEX IF EXISTS work_requests_portal_id_idx RENAME TO procurement_requests_portal_id_idx;
ALTER INDEX IF EXISTS work_requests_site_coords_idx RENAME TO procurement_requests_site_coords_idx;

-- Drop old policies
DROP POLICY IF EXISTS work_requests_tenant_isolation ON procurement_requests;
DROP POLICY IF EXISTS work_requests_read_policy ON procurement_requests;
DROP POLICY IF EXISTS work_requests_write_policy ON procurement_requests;

-- Create new intake Work Requests table
CREATE TABLE IF NOT EXISTS work_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- The only truly required field: how to reach them
  contact_channel_value VARCHAR(255) NOT NULL,
  contact_channel_type VARCHAR(20) DEFAULT 'phone',
  contact_channel_notes TEXT,
  
  -- Optional contact linking
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES crm_organizations(id) ON DELETE SET NULL,
  
  -- Optional location
  property_id UUID REFERENCES crm_properties(id) ON DELETE SET NULL,
  unit_id UUID,
  location_text VARCHAR(500),
  
  -- The ask (all optional)
  summary TEXT,
  description TEXT,
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal',
  
  -- Source tracking (optional)
  source VARCHAR(50),
  referral_source VARCHAR(255),
  
  -- Status
  status work_request_status DEFAULT 'new',
  
  -- Conversion tracking
  converted_to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  converted_by_actor_id UUID,
  
  -- Closure
  closed_reason VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Multi-hat support
  answering_as_tenant_id UUID REFERENCES cc_tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_work_requests_tenant_status 
  ON work_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_work_requests_channel 
  ON work_requests(contact_channel_value);
CREATE INDEX IF NOT EXISTS idx_work_requests_created 
  ON work_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_requests_contact
  ON work_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_property
  ON work_requests(property_id);

ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_requests_tenant_isolation ON work_requests;
CREATE POLICY work_requests_tenant_isolation ON work_requests
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE 
      WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
      ELSE tenant_id::text = current_setting('app.tenant_id', true)
    END
  );

-- Work Requests updated_at trigger
DROP TRIGGER IF EXISTS trg_work_requests_updated_at ON work_requests;
CREATE TRIGGER trg_work_requests_updated_at
  BEFORE UPDATE ON work_requests
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- Update projects table to reference new work_requests
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_source_work_request_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_source_work_request_id_fkey 
  FOREIGN KEY (source_work_request_id) REFERENCES work_requests(id) ON DELETE SET NULL;

-- Work Request Notes
DROP TABLE IF EXISTS work_request_notes CASCADE;
CREATE TABLE work_request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_request_id UUID NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_request_notes_wr ON work_request_notes(work_request_id);

ALTER TABLE work_request_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_request_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY work_request_notes_tenant_isolation ON work_request_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM work_requests wr 
      WHERE wr.id = work_request_notes.work_request_id
      AND (
        CASE 
          WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
          ELSE wr.tenant_id::text = current_setting('app.tenant_id', true)
        END
      )
    )
  );

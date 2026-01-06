-- ============================================================================
-- Rename procurement enum, create intake work_request_status
-- Migration: 048_rename_enum_create_intake.sql
-- ============================================================================

-- STEP 1: Rename existing work_request_status enum to procurement_request_status
ALTER TYPE work_request_status RENAME TO procurement_request_status;

-- The procurement_requests table (formerly work_requests) already uses this enum
-- No column changes needed since we just renamed the type

-- STEP 2: Create new intake-focused work_request_status enum
DO $$ BEGIN
  CREATE TYPE work_request_status AS ENUM (
    'new',           -- Just came in
    'contacted',     -- We called them back
    'quoted',        -- Sent a quote (before conversion)
    'converted',     -- Became a Project
    'closed',        -- Won't proceed
    'spam'           -- Junk/wrong number
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- STEP 3: Create the new intake work_requests table
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
  converted_to_project_id UUID,
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

-- STEP 4: Add FK to projects table once both tables exist
ALTER TABLE work_requests 
  ADD CONSTRAINT fk_work_requests_project 
  FOREIGN KEY (converted_to_project_id) 
  REFERENCES projects(id) ON DELETE SET NULL;

-- Also update projects to reference the new work_requests
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_source_work_request_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_source_work_request_id_fkey 
  FOREIGN KEY (source_work_request_id) REFERENCES work_requests(id) ON DELETE SET NULL;

-- STEP 5: Indexes
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

-- STEP 6: RLS
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

-- STEP 7: Updated_at trigger
DROP TRIGGER IF EXISTS trg_work_requests_updated_at ON work_requests;
CREATE TRIGGER trg_work_requests_updated_at
  BEFORE UPDATE ON work_requests
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- STEP 8: Work Request Notes table
CREATE TABLE IF NOT EXISTS work_request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_request_id UUID NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_request_notes_wr ON work_request_notes(work_request_id);

ALTER TABLE work_request_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_request_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_request_notes_tenant_isolation ON work_request_notes;
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

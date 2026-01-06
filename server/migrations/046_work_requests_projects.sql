-- ============================================================================
-- WORK REQUESTS + PROJECTS SYSTEM
-- Migration: 046_work_requests_projects.sql
-- 
-- Creates Work Requests inbox and Projects system with proper vocabulary.
-- Renames CRM tables to match spec: Contacts, Properties, Organizations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: Rename CRM tables to match spec vocabulary
-- crm_people -> crm_contacts
-- crm_places -> crm_properties  
-- crm_orgs -> crm_organizations
-- crm_place_photos -> crm_property_photos
-- ----------------------------------------------------------------------------

-- Drop old policies first
DROP POLICY IF EXISTS crm_orgs_tenant_isolation ON crm_orgs;
DROP POLICY IF EXISTS crm_people_tenant_isolation ON crm_people;
DROP POLICY IF EXISTS crm_places_tenant_isolation ON crm_places;
DROP POLICY IF EXISTS crm_place_photos_tenant_isolation ON crm_place_photos;

-- Drop old triggers
DROP TRIGGER IF EXISTS trg_crm_orgs_updated_at ON crm_orgs;
DROP TRIGGER IF EXISTS trg_crm_people_updated_at ON crm_people;
DROP TRIGGER IF EXISTS trg_crm_places_updated_at ON crm_places;

-- Rename tables
ALTER TABLE IF EXISTS crm_orgs RENAME TO crm_organizations;
ALTER TABLE IF EXISTS crm_people RENAME TO crm_contacts;
ALTER TABLE IF EXISTS crm_places RENAME TO crm_properties;
ALTER TABLE IF EXISTS crm_place_photos RENAME TO crm_property_photos;

-- Rename foreign key columns in crm_contacts (was crm_people)
ALTER TABLE crm_contacts RENAME COLUMN org_id TO organization_id;

-- Rename foreign key columns in crm_properties (was crm_places)
ALTER TABLE crm_properties RENAME COLUMN owner_person_id TO owner_contact_id;
ALTER TABLE crm_properties RENAME COLUMN owner_org_id TO owner_organization_id;

-- Rename foreign key column in crm_property_photos (was crm_place_photos)
ALTER TABLE crm_property_photos RENAME COLUMN place_id TO property_id;

-- Rename indexes
ALTER INDEX IF EXISTS idx_crm_orgs_tenant RENAME TO idx_crm_organizations_tenant;
ALTER INDEX IF EXISTS idx_crm_orgs_name RENAME TO idx_crm_organizations_name;
ALTER INDEX IF EXISTS idx_crm_people_tenant RENAME TO idx_crm_contacts_tenant;
ALTER INDEX IF EXISTS idx_crm_people_org RENAME TO idx_crm_contacts_organization;
ALTER INDEX IF EXISTS idx_crm_people_name RENAME TO idx_crm_contacts_name;
ALTER INDEX IF EXISTS idx_crm_places_tenant RENAME TO idx_crm_properties_tenant;
ALTER INDEX IF EXISTS idx_crm_places_owner_person RENAME TO idx_crm_properties_owner_contact;
ALTER INDEX IF EXISTS idx_crm_places_owner_org RENAME TO idx_crm_properties_owner_organization;
ALTER INDEX IF EXISTS idx_crm_places_name RENAME TO idx_crm_properties_name;
ALTER INDEX IF EXISTS idx_crm_place_photos_place RENAME TO idx_crm_property_photos_property;
ALTER INDEX IF EXISTS idx_crm_place_photos_tenant RENAME TO idx_crm_property_photos_tenant;

-- Recreate RLS policies with new table names
CREATE POLICY crm_organizations_tenant_isolation ON crm_organizations
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

CREATE POLICY crm_contacts_tenant_isolation ON crm_contacts
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

CREATE POLICY crm_properties_tenant_isolation ON crm_properties
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

CREATE POLICY crm_property_photos_tenant_isolation ON crm_property_photos
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

-- Recreate triggers with new table names
CREATE TRIGGER trg_crm_organizations_updated_at
  BEFORE UPDATE ON crm_organizations
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER trg_crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER trg_crm_properties_updated_at
  BEFORE UPDATE ON crm_properties
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- ----------------------------------------------------------------------------
-- PART 2: Work Requests (The Intake Inbox)
-- Minimum viable intake: only contact_channel_value is truly required
-- ----------------------------------------------------------------------------

-- Work Request status enum
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
  
  -- Multi-hat support (which tenant is this call for)
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
CREATE TRIGGER trg_work_requests_updated_at
  BEFORE UPDATE ON work_requests
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- ----------------------------------------------------------------------------
-- PART 3: Projects (The Actual Job)
-- A Project is ONE record from first contact to final payment
-- ----------------------------------------------------------------------------

-- Project status enum
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'lead',
    'quote',
    'approved',
    'scheduled',
    'in_progress',
    'completed',
    'invoiced',
    'paid',
    'cancelled',
    'warranty'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Basic info (title is the only required field)
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Customer (optional - can be added later)
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES crm_organizations(id) ON DELETE SET NULL,
  
  -- Location (at least one should exist, but not enforced at DB level)
  property_id UUID REFERENCES crm_properties(id) ON DELETE SET NULL,
  unit_id UUID,
  location_text VARCHAR(500),
  
  -- Status
  status project_status DEFAULT 'lead',
  
  -- Money (simple - line items are separate and optional)
  quoted_amount DECIMAL(12,2),
  final_amount DECIMAL(12,2),
  deposit_required DECIMAL(12,2),
  deposit_received BOOLEAN DEFAULT FALSE,
  deposit_received_at TIMESTAMPTZ,
  
  -- Dates
  quoted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  scheduled_start DATE,
  scheduled_end DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Warranty
  warranty_months INTEGER DEFAULT 12,
  warranty_expires_at DATE,
  warranty_notes TEXT,
  parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Service Run link (optional)
  service_run_id UUID,
  
  -- Source
  source_work_request_id UUID REFERENCES work_requests(id) ON DELETE SET NULL,
  source VARCHAR(50),
  
  -- Settlement (projects can close without invoices)
  settlement_type VARCHAR(30), -- invoiced, paid_platform, paid_external, trade, gift, writeoff, cancelled
  settlement_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update work_requests FK now that projects table exists
ALTER TABLE work_requests 
  ADD CONSTRAINT fk_work_requests_project 
  FOREIGN KEY (converted_to_project_id) 
  REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_scheduled ON projects(tenant_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_projects_source_wr ON projects(source_work_request_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_tenant_isolation ON projects
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

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

-- ----------------------------------------------------------------------------
-- Project Line Items (OPTIONAL - never required)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2),
  total DECIMAL(12,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_line_items_project ON project_line_items(project_id);

ALTER TABLE project_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_line_items FORCE ROW LEVEL SECURITY;

CREATE POLICY project_line_items_tenant_isolation ON project_line_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = project_line_items.project_id
      AND (
        CASE 
          WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
          ELSE p.tenant_id::text = current_setting('app.tenant_id', true)
        END
      )
    )
  );

-- ----------------------------------------------------------------------------
-- Project Scope Snapshots (for change orders)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_scope_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  description TEXT,
  amount DECIMAL(12,2),
  reason VARCHAR(100), -- 'original', 'change_order', 'revision'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_scope_snapshots_project ON project_scope_snapshots(project_id);

ALTER TABLE project_scope_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scope_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY project_scope_snapshots_tenant_isolation ON project_scope_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = project_scope_snapshots.project_id
      AND (
        CASE 
          WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
          ELSE p.tenant_id::text = current_setting('app.tenant_id', true)
        END
      )
    )
  );

-- ----------------------------------------------------------------------------
-- Project Photos (Before / During / After)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  stage VARCHAR(20) NOT NULL CHECK (stage IN ('before', 'during', 'after')),
  
  storage_key VARCHAR(500),
  storage_url VARCHAR(500),
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  
  caption TEXT,
  taken_at TIMESTAMPTZ,
  
  uploaded_by_actor_id UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Evidence metadata
  device_info VARCHAR(255),
  geo_lat DECIMAL(10,7),
  geo_lng DECIMAL(10,7)
);

CREATE INDEX IF NOT EXISTS idx_project_photos_project ON project_photos(project_id, stage);
CREATE INDEX IF NOT EXISTS idx_project_photos_tenant ON project_photos(tenant_id);

ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos FORCE ROW LEVEL SECURITY;

CREATE POLICY project_photos_tenant_isolation ON project_photos
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

-- ----------------------------------------------------------------------------
-- Project Notes (append-only timeline)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note_type VARCHAR(50) DEFAULT 'note',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY project_notes_tenant_isolation ON project_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = project_notes.project_id
      AND (
        CASE 
          WHEN current_setting('app.tenant_id', true) = '__SERVICE__' THEN true
          ELSE p.tenant_id::text = current_setting('app.tenant_id', true)
        END
      )
    )
  );

-- ----------------------------------------------------------------------------
-- Work Request Notes (append-only)
-- ----------------------------------------------------------------------------
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

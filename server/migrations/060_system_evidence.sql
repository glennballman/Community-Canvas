-- Migration 060: System Evidence Ledger
-- 
-- Evidence Rule Enforcement - track what should exist and verify it's accessible.
-- This enables machine-enforceable evidence gates for feature verification.

-- ============================================================================
-- 1) system_evidence - Evidence ledger table
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is this?
  artifact_type TEXT NOT NULL,  -- 'route' | 'table' | 'feed' | 'integration' | 'feature' | 'nav_item'
  artifact_name TEXT NOT NULL,  -- e.g., 'Bookings', 'unified_assets', 'Firecrawl'
  
  -- Evidence details
  evidence_type TEXT NOT NULL,  -- 'nav' | 'registry' | 'data' | 'test' | 'route'
  reference TEXT NOT NULL,      -- URL, route path, table name, test name
  
  -- Ownership
  owner_type TEXT,              -- 'tenant' | 'portal' | 'platform' | 'system'
  owner_id UUID,                -- tenant_id or portal_id if applicable
  
  -- Verification
  is_required BOOLEAN NOT NULL DEFAULT true,  -- Must this exist?
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT DEFAULT 'unknown', -- 'verified' | 'missing' | 'stale' | 'unknown'
  verified_by TEXT,             -- 'system' | 'ai' | 'human'
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (artifact_type, artifact_name, evidence_type)
);

CREATE INDEX IF NOT EXISTS idx_evidence_status ON system_evidence(verification_status);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON system_evidence(artifact_type);
CREATE INDEX IF NOT EXISTS idx_evidence_required ON system_evidence(is_required);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON system_evidence TO PUBLIC;

-- ============================================================================
-- 2) Seed required evidence
-- ============================================================================

-- Core nav items (must always exist in Platform Admin)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required, description)
VALUES
  ('nav_item', 'Dashboard', 'nav', '/app/dashboard', 'system', true, 'Main dashboard'),
  ('nav_item', 'Inventory', 'nav', '/app/inventory', 'system', true, 'Asset inventory'),
  ('nav_item', 'Bookings', 'nav', '/app/bookings', 'system', true, 'Bookings list'),
  ('nav_item', 'Operations', 'nav', '/app/operations', 'system', true, 'Operations board'),
  ('nav_item', 'Work Requests', 'nav', '/app/intake/work-requests', 'system', true, 'Work requests inbox'),
  ('nav_item', 'Projects', 'nav', '/app/projects', 'system', true, 'Projects list'),
  ('nav_item', 'Places', 'nav', '/app/crm/places', 'system', true, 'Places directory'),
  ('nav_item', 'Contacts', 'nav', '/app/crm/people', 'system', true, 'Contacts list'),
  ('nav_item', 'Organizations', 'nav', '/app/crm/orgs', 'system', true, 'Organizations'),
  ('nav_item', 'System Explorer', 'nav', '/admin/system-explorer', 'platform', true, 'Discovery surface - Platform Admin only')
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

-- Core routes (must render)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required)
VALUES
  ('route', '/app/dashboard', 'route', '/app/dashboard', 'system', true),
  ('route', '/app/inventory', 'route', '/app/inventory', 'system', true),
  ('route', '/app/bookings', 'route', '/app/bookings', 'system', true),
  ('route', '/app/operations', 'route', '/app/operations', 'system', true),
  ('route', '/app/intake/work-requests', 'route', '/app/intake/work-requests', 'system', true),
  ('route', '/app/projects', 'route', '/app/projects', 'system', true),
  ('route', '/admin/system-explorer', 'route', '/admin/system-explorer', 'platform', true)
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

-- Core tables (must exist in database)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required)
VALUES
  ('table', 'unified_assets', 'data', 'unified_assets', 'tenant', true),
  ('table', 'unified_bookings', 'data', 'unified_bookings', 'tenant', true),
  ('table', 'work_requests', 'data', 'work_requests', 'tenant', true),
  ('table', 'projects', 'data', 'projects', 'tenant', true),
  ('table', 'crm_contacts', 'data', 'crm_contacts', 'tenant', false),
  ('table', 'portals', 'data', 'portals', 'platform', true),
  ('table', 'entity_presentations', 'data', 'entity_presentations', 'portal', false),
  ('table', 'civos_tenants', 'data', 'civos_tenants', 'platform', true),
  ('table', 'resource_schedule_events', 'data', 'resource_schedule_events', 'tenant', true)
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

-- Known integrations (should be detectable via env vars)
INSERT INTO system_evidence (artifact_type, artifact_name, evidence_type, reference, owner_type, is_required)
VALUES
  ('integration', 'Firecrawl', 'test', 'FIRECRAWL_API_KEY', 'platform', false),
  ('integration', 'Apify', 'test', 'APIFY_API_TOKEN', 'platform', false),
  ('integration', 'Mapbox', 'test', 'MAPBOX_ACCESS_TOKEN', 'platform', false),
  ('integration', 'Jobber', 'test', 'JOBBER_ACCESS_TOKEN', 'platform', false),
  ('integration', 'CompanyCam', 'test', 'COMPANYCAM_ACCESS_TOKEN', 'platform', false)
ON CONFLICT (artifact_type, artifact_name, evidence_type) DO NOTHING;

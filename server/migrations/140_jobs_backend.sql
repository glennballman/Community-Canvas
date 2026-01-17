-- Migration 140: Jobs Backend - Complete distribution, moderation, and public apply infrastructure
-- Additive only. No breaking changes.

-- ============================================================================
-- STEP A: Enum for job posting publication lifecycle
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE job_posting_publish_state AS ENUM (
    'draft', 'pending_review', 'published', 'rejected', 'paused', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP B: Alter cc_job_postings to add moderation + lifecycle columns
-- ============================================================================
ALTER TABLE cc_job_postings 
  ADD COLUMN IF NOT EXISTS publish_state job_posting_publish_state NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_identity_id uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_job_postings_publish_state ON cc_job_postings(publish_state);
CREATE INDEX IF NOT EXISTS idx_job_postings_portal_publish ON cc_job_postings(portal_id, publish_state) WHERE publish_state = 'published';

-- ============================================================================
-- STEP C: Alter cc_jobs to add taxonomy + brand/legal snapshots
-- ============================================================================
ALTER TABLE cc_jobs
  ADD COLUMN IF NOT EXISTS noc_code varchar(10),
  ADD COLUMN IF NOT EXISTS soc_code varchar(10),
  ADD COLUMN IF NOT EXISTS occupational_category text,
  ADD COLUMN IF NOT EXISTS taxonomy jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_tenant_id uuid,
  ADD COLUMN IF NOT EXISTS brand_name_snapshot text,
  ADD COLUMN IF NOT EXISTS legal_party_id uuid,
  ADD COLUMN IF NOT EXISTS legal_name_snapshot text,
  ADD COLUMN IF NOT EXISTS legal_trade_name_snapshot text;

CREATE INDEX IF NOT EXISTS idx_jobs_noc_code ON cc_jobs(noc_code) WHERE noc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_soc_code ON cc_jobs(soc_code) WHERE soc_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_brand_tenant ON cc_jobs(brand_tenant_id) WHERE brand_tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_legal_party ON cc_jobs(legal_party_id) WHERE legal_party_id IS NOT NULL;

-- ============================================================================
-- STEP D: Tenant → legal entity mapping table
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_tenant_legal_entities (
  tenant_id uuid PRIMARY KEY REFERENCES cc_tenants(id) ON DELETE CASCADE,
  legal_party_id uuid NOT NULL REFERENCES cc_parties(id) ON DELETE RESTRICT,
  dba_name_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_legal_entities_party ON cc_tenant_legal_entities(legal_party_id);

-- RLS for cc_tenant_legal_entities
ALTER TABLE cc_tenant_legal_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_legal_entities_tenant_isolation ON cc_tenant_legal_entities;
CREATE POLICY tenant_legal_entities_tenant_isolation ON cc_tenant_legal_entities
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_tenant_id()
  );

-- ============================================================================
-- STEP E: Portal distribution policies table
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_portal_distribution_policies (
  portal_id uuid PRIMARY KEY REFERENCES cc_portals(id) ON DELETE CASCADE,
  is_accepting_job_postings boolean NOT NULL DEFAULT true,
  requires_moderation boolean NOT NULL DEFAULT false,
  accepts_external_postings boolean NOT NULL DEFAULT true,
  pricing_model text NOT NULL DEFAULT 'free',
  price_hint text,
  default_selected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cc_portal_distribution_policies IS 'Portal-level settings for job posting distribution and moderation requirements';

-- RLS for cc_portal_distribution_policies (public read for active portals)
ALTER TABLE cc_portal_distribution_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_dist_policies_public_read ON cc_portal_distribution_policies;
CREATE POLICY portal_dist_policies_public_read ON cc_portal_distribution_policies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS portal_dist_policies_service_manage ON cc_portal_distribution_policies;
CREATE POLICY portal_dist_policies_service_manage ON cc_portal_distribution_policies
  FOR ALL USING (is_service_mode());

-- Seed known portals (idempotent insert)
INSERT INTO cc_portal_distribution_policies (portal_id, requires_moderation, pricing_model, default_selected)
SELECT id, false, 'free', true FROM cc_portals WHERE slug IN ('bamfield', 'west-bamfield', 'east-bamfield')
ON CONFLICT (portal_id) DO NOTHING;

INSERT INTO cc_portal_distribution_policies (portal_id, requires_moderation, pricing_model, default_selected)
SELECT id, true, 'free', true FROM cc_portals WHERE slug = 'canadadirect'
ON CONFLICT (portal_id) DO NOTHING;

-- ============================================================================
-- STEP F: Embed surfaces table
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_embed_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  embed_key_hash text NOT NULL UNIQUE,
  allowed_domains text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embed_surfaces_tenant ON cc_embed_surfaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embed_surfaces_key_hash ON cc_embed_surfaces(embed_key_hash) WHERE is_active = true;

COMMENT ON TABLE cc_embed_surfaces IS 'Tokenized embed keys for widget/iframe job feeds on external websites';

-- RLS for cc_embed_surfaces
ALTER TABLE cc_embed_surfaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS embed_surfaces_tenant_isolation ON cc_embed_surfaces;
CREATE POLICY embed_surfaces_tenant_isolation ON cc_embed_surfaces
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_tenant_id()
  );

-- Job embed publications (which jobs are published to which embed surfaces)
CREATE TABLE IF NOT EXISTS cc_job_embed_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
  embed_surface_id uuid NOT NULL REFERENCES cc_embed_surfaces(id) ON DELETE CASCADE,
  publish_state job_posting_publish_state NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, embed_surface_id)
);

CREATE INDEX IF NOT EXISTS idx_job_embed_pubs_job ON cc_job_embed_publications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_embed_pubs_surface ON cc_job_embed_publications(embed_surface_id);
CREATE INDEX IF NOT EXISTS idx_job_embed_pubs_published ON cc_job_embed_publications(embed_surface_id, publish_state) WHERE publish_state = 'published';

-- RLS for cc_job_embed_publications (NO public read - only via embed API)
ALTER TABLE cc_job_embed_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_embed_pubs_service_only ON cc_job_embed_publications;
CREATE POLICY job_embed_pubs_service_only ON cc_job_embed_publications
  FOR ALL USING (is_service_mode());

-- ============================================================================
-- STEP G: External channel distribution spine
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_job_distribution_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  pricing_model text NOT NULL DEFAULT 'paid',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cc_job_distribution_channels IS 'External job distribution channels (Indeed, LinkedIn, Monster, etc.)';

-- Seed external channels (idempotent)
INSERT INTO cc_job_distribution_channels (provider_key, display_name, pricing_model) VALUES
  ('indeed', 'Indeed', 'paid'),
  ('linkedin', 'LinkedIn', 'paid'),
  ('monster', 'Monster', 'paid')
ON CONFLICT (provider_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS cc_job_channel_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES cc_job_distribution_channels(id) ON DELETE CASCADE,
  publish_state text NOT NULL DEFAULT 'queued',
  external_posting_id text,
  external_posting_url text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_job_channel_pubs_job ON cc_job_channel_publications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_channel_pubs_state ON cc_job_channel_publications(publish_state) WHERE publish_state = 'queued';

COMMENT ON TABLE cc_job_channel_publications IS 'Queue and status tracking for external job distribution';

-- RLS for channel tables (service mode only)
ALTER TABLE cc_job_distribution_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_job_channel_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_dist_channels_public_read ON cc_job_distribution_channels;
CREATE POLICY job_dist_channels_public_read ON cc_job_distribution_channels
  FOR SELECT USING (true);

DROP POLICY IF EXISTS job_channel_pubs_service_only ON cc_job_channel_publications;
CREATE POLICY job_channel_pubs_service_only ON cc_job_channel_publications
  FOR ALL USING (is_service_mode());

-- ============================================================================
-- STEP H: Document templates for employer hiring docs
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_legal_party_id uuid NOT NULL REFERENCES cc_parties(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  name text NOT NULL,
  source_media_id uuid,
  template_payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_owner ON cc_document_templates(owner_legal_party_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON cc_document_templates(template_type);

COMMENT ON TABLE cc_document_templates IS 'Employer document templates for employment offers, agreements, and hiring packets';

-- RLS for document templates
ALTER TABLE cc_document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_templates_service_manage ON cc_document_templates;
CREATE POLICY doc_templates_service_manage ON cc_document_templates
  FOR ALL USING (is_service_mode());

-- ============================================================================
-- STEP I: Public upload session table for anonymous applicant uploads
-- ============================================================================
CREATE TABLE IF NOT EXISTS cc_public_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  job_id uuid REFERENCES cc_jobs(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_upload_sessions_token ON cc_public_upload_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_public_upload_sessions_job ON cc_public_upload_sessions(job_id) WHERE job_id IS NOT NULL;

COMMENT ON TABLE cc_public_upload_sessions IS 'Session tokens for anonymous job applicant file uploads';

CREATE TABLE IF NOT EXISTS cc_public_upload_session_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cc_public_upload_sessions(id) ON DELETE CASCADE,
  media_id uuid,
  f2_key text,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_upload_media_session ON cc_public_upload_session_media(session_id);

COMMENT ON TABLE cc_public_upload_session_media IS 'Media files uploaded during anonymous job application sessions';

-- RLS for upload session tables (service mode only for writes, no public read)
ALTER TABLE cc_public_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_public_upload_session_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pub_upload_sessions_service_only ON cc_public_upload_sessions;
CREATE POLICY pub_upload_sessions_service_only ON cc_public_upload_sessions
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS pub_upload_media_service_only ON cc_public_upload_session_media;
CREATE POLICY pub_upload_media_service_only ON cc_public_upload_session_media
  FOR ALL USING (is_service_mode());

-- ============================================================================
-- STEP J: RLS Updates for cc_job_postings (tighten public read)
-- ============================================================================

-- Drop old public read policy if exists
DROP POLICY IF EXISTS cc_job_postings_public_read ON cc_job_postings;

-- Create new portal-scoped public read policy
CREATE POLICY cc_job_postings_public_read ON cc_job_postings
  FOR SELECT USING (
    publish_state = 'published'
    AND NOT is_hidden
    AND (expires_at IS NULL OR expires_at > now())
    AND portal_id = current_portal_id()
  );

-- Ensure service bypass still exists
DROP POLICY IF EXISTS cc_job_postings_service_bypass ON cc_job_postings;
CREATE POLICY cc_job_postings_service_bypass ON cc_job_postings
  FOR ALL USING (is_service_mode());

-- ============================================================================
-- STEP K: Ingestion tables for URL/upload/AI draft flow
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE job_ingestion_status AS ENUM (
    'pending', 'processing', 'draft_ready', 'approved', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_job_ingestion_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  ingestion_type text NOT NULL,
  source_url text,
  source_media_id uuid,
  ai_prompt text,
  status job_ingestion_status NOT NULL DEFAULT 'pending',
  extracted_data jsonb DEFAULT '{}',
  draft_job_data jsonb DEFAULT '{}',
  error_message text,
  job_id uuid REFERENCES cc_jobs(id) ON DELETE SET NULL,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_ingestion_tenant ON cc_job_ingestion_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_ingestion_status ON cc_job_ingestion_tasks(status);

COMMENT ON TABLE cc_job_ingestion_tasks IS 'Job ingestion pipeline for URL scraping, document upload, and AI draft generation';

-- RLS
ALTER TABLE cc_job_ingestion_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_ingestion_tenant_isolation ON cc_job_ingestion_tasks;
CREATE POLICY job_ingestion_tenant_isolation ON cc_job_ingestion_tasks
  FOR ALL USING (
    is_service_mode() OR tenant_id = current_tenant_id()
  );

-- ============================================================================
-- Done
-- ============================================================================

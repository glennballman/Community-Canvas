-- Migration 059: Entity Presentations + AI Draft Pipeline
-- 
-- Entity Presentations = contextual renderings of canonical entities,
-- owned by a portal/editorial team, not by the entity's tenant.
-- 
-- This enables:
-- - Same entity presented differently across portals (different voice, CTAs)
-- - Editorial content that references tenant inventory without copying
-- - AI-first workflow: evidence pack → outline → draft blocks → validation → publish

-- ============================================================================
-- 1A) entity_presentations - Main presentation table
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  
  -- What is being presented (polymorphic reference)
  entity_type TEXT NOT NULL,           -- 'place'|'org'|'asset'|'experience'|'event'|'collection'|'route'
  entity_id UUID NULL,                 -- nullable for pure editorial / collections
  canonical_tenant_id UUID NULL,       -- tenant owning the canonical entity (attribution only)
  
  -- Presentation identity
  slug TEXT NOT NULL,                  -- unique within portal
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft|published|archived
  visibility TEXT NOT NULL DEFAULT 'public', -- public|unlisted|private
  
  -- What this presentation is "for"
  presentation_type TEXT NOT NULL,     -- 'story'|'guide'|'listing'|'itinerary'|'signal'|'profile'
  voice_profile_id UUID NULL,          -- links to how it should sound/look
  
  -- Structured metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  seasonality JSONB NULL,              -- e.g. {best_months:[9,10,11], offpeak:true}
  cta JSONB NULL,                      -- calls-to-action config
  layout JSONB NULL,                   -- layout template selection
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (portal_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_presentations_portal_status ON entity_presentations(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_presentations_entity ON entity_presentations(entity_type, entity_id);

-- ============================================================================
-- 1B) presentation_blocks - Composable content blocks
-- ============================================================================

CREATE TABLE IF NOT EXISTS presentation_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  block_order INT NOT NULL,
  block_type TEXT NOT NULL,            -- 'hero'|'story'|'gallery'|'facts'|'map'|'cta'|'availability'|'faq'|'quote'|'list'
  block_data JSONB NOT NULL,           -- schema varies per block_type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (presentation_id, block_order)
);

CREATE INDEX IF NOT EXISTS idx_blocks_presentation ON presentation_blocks(presentation_id, block_type);

-- ============================================================================
-- 1C) presentation_versions - Hard versioning for audit + rollback
-- ============================================================================

CREATE TABLE IF NOT EXISTS presentation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  version_num INT NOT NULL,
  change_summary TEXT NULL,
  
  -- Snapshot of rendered structure
  snapshot JSONB NOT NULL,             -- {title, subtitle, blocks:[...], tags, cta, layout, ...}
  
  -- Provenance
  author_type TEXT NOT NULL,           -- 'human'|'ai'|'system'
  author_actor_id UUID NULL,
  ai_run_id UUID NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (presentation_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_versions_presentation ON presentation_versions(presentation_id, created_at DESC);

-- ============================================================================
-- 1D) presentation_sources - Citations/provenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS presentation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,           -- 'tenant_entity'|'feed'|'human_interview'|'web'|'upload'|'note'
  source_ref TEXT NULL,                -- URL or feed id or doc id
  source_payload JSONB NULL,           -- extracted evidence
  reliability_score INT NOT NULL DEFAULT 50,  -- 0-100
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sources_presentation ON presentation_sources(presentation_id);

-- ============================================================================
-- 1E) voice_profiles - How the portal "sounds"
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- 'Bourdain-style reflective', 'Emergency concise'
  guidance JSONB NOT NULL,             -- tone, taboo topics, reading level, structure preferences
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (portal_id, name)
);

-- ============================================================================
-- 1F) presentation_entity_links - For bundles/itineraries/collections
-- ============================================================================

CREATE TABLE IF NOT EXISTS presentation_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES entity_presentations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  canonical_tenant_id UUID NULL,
  role TEXT NULL,                      -- 'featured'|'nearby'|'stop'|'supplier'|'alternate'
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entity_links_presentation ON presentation_entity_links(presentation_id);

-- ============================================================================
-- 1G) ai_runs - AI pipeline audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL,
  presentation_id UUID NOT NULL,
  run_type TEXT NOT NULL,              -- 'evidence_pack'|'outline'|'draft_blocks'|'validation'
  input JSONB NOT NULL,
  output JSONB NULL,
  status TEXT NOT NULL DEFAULT 'completed',  -- 'queued'|'running'|'completed'|'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_presentation ON ai_runs(presentation_id, created_at DESC);

-- ============================================================================
-- HELPER FUNCTION: Safe tenant UUID extraction
-- ============================================================================
-- Returns NULL instead of failing when app.tenant_id is '__SERVICE__' or invalid
CREATE OR REPLACE FUNCTION safe_current_tenant_uuid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tid text;
BEGIN
  tid := current_setting('app.tenant_id', true);
  IF tid IS NULL OR tid = '' OR tid = '__SERVICE__' THEN
    RETURN NULL;
  END IF;
  RETURN tid::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE entity_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- entity_presentations: portal-owned, public reads for published
CREATE POLICY entity_presentations_select ON entity_presentations
  FOR SELECT USING (
    is_service_mode() 
    OR (status = 'published' AND visibility IN ('public', 'unlisted'))
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY entity_presentations_insert ON entity_presentations
  FOR INSERT WITH CHECK (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY entity_presentations_update ON entity_presentations
  FOR UPDATE USING (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY entity_presentations_delete ON entity_presentations
  FOR DELETE USING (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- presentation_blocks: follow parent presentation access
CREATE POLICY presentation_blocks_select ON presentation_blocks
  FOR SELECT USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      WHERE ep.status = 'published' AND ep.visibility IN ('public', 'unlisted')
    )
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY presentation_blocks_modify ON presentation_blocks
  FOR ALL USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- presentation_versions: same as blocks
CREATE POLICY presentation_versions_select ON presentation_versions
  FOR SELECT USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      WHERE ep.status = 'published' AND ep.visibility IN ('public', 'unlisted')
    )
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY presentation_versions_modify ON presentation_versions
  FOR ALL USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- presentation_sources: same as blocks
CREATE POLICY presentation_sources_select ON presentation_sources
  FOR SELECT USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      WHERE ep.status = 'published' AND ep.visibility IN ('public', 'unlisted')
    )
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY presentation_sources_modify ON presentation_sources
  FOR ALL USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- voice_profiles: portal-owned, also allow public reads (needed for presentation JOIN)
CREATE POLICY voice_profiles_select ON voice_profiles
  FOR SELECT USING (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY voice_profiles_modify ON voice_profiles
  FOR ALL USING (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- presentation_entity_links: same as blocks
CREATE POLICY presentation_entity_links_select ON presentation_entity_links
  FOR SELECT USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      WHERE ep.status = 'published' AND ep.visibility IN ('public', 'unlisted')
    )
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY presentation_entity_links_modify ON presentation_entity_links
  FOR ALL USING (
    is_service_mode()
    OR presentation_id IN (
      SELECT ep.id FROM entity_presentations ep
      JOIN portals p ON p.id = ep.portal_id
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- ai_runs: portal-owned
CREATE POLICY ai_runs_select ON ai_runs
  FOR SELECT USING (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

CREATE POLICY ai_runs_modify ON ai_runs
  FOR ALL USING (
    is_service_mode()
    OR portal_id IN (
      SELECT p.id FROM portals p
      WHERE p.owning_tenant_id = safe_current_tenant_uuid()
    )
  );

-- ============================================================================
-- TABLE GRANTS (for direct database access)
-- ============================================================================
-- Grant to public role (used by app's database connection)
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_presentations TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON presentation_blocks TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON presentation_versions TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON presentation_sources TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_profiles TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON presentation_entity_links TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_runs TO public;

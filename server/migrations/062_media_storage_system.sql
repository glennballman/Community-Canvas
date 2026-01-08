-- ============================================================================
-- MIGRATION 062 — MEDIA STORAGE SYSTEM
-- ============================================================================
-- Photos are critical for contractors, accommodations, equipment, job sites.
-- This creates a unified media storage system with:
-- 1. media - Core storage for all images/documents
-- 2. entity_media - Polymorphic links to any entity
-- 3. crawl_media_queue - Queue for downloading crawled images
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE media_type AS ENUM ('image', 'document', 'video');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_purpose') THEN
    CREATE TYPE media_purpose AS ENUM ('hero', 'gallery', 'thumbnail', 'avatar', 'proof', 'document', 'before', 'after', 'logo', 'cover');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_source') THEN
    CREATE TYPE media_source AS ENUM ('upload', 'crawl', 'import', 'ai_generated');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_processing_status') THEN
    CREATE TYPE media_processing_status AS ENUM ('pending', 'processing', 'complete', 'failed');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crawl_media_status') THEN
    CREATE TYPE crawl_media_status AS ENUM ('pending', 'downloading', 'processing', 'complete', 'failed', 'skipped');
  END IF;
END $$;

-- ============================================================================
-- MEDIA TABLE (Core)
-- ============================================================================

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Storage
  storage_key TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  public_url TEXT NOT NULL,
  
  -- File info
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  
  -- Metadata (schema.org ImageObject compatible)
  alt_text TEXT,
  caption TEXT,
  title TEXT,
  
  -- Classification
  media_type media_type NOT NULL DEFAULT 'image',
  purpose media_purpose,
  tags TEXT[] DEFAULT '{}',
  
  -- Source tracking
  source media_source NOT NULL DEFAULT 'upload',
  source_url TEXT,
  crawl_job_id UUID,
  
  -- Processing
  processing_status media_processing_status NOT NULL DEFAULT 'complete',
  variants JSONB DEFAULT '{}',
  
  -- Audit
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_media_tenant ON media(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type, purpose);
CREATE INDEX IF NOT EXISTS idx_media_source ON media(source);
CREATE INDEX IF NOT EXISTS idx_media_processing ON media(processing_status) WHERE processing_status != 'complete';

COMMENT ON TABLE media IS 'Core media storage for images, documents, videos with schema.org ImageObject metadata';

-- ============================================================================
-- ENTITY MEDIA (Polymorphic Links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  
  -- Polymorphic entity reference
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Context
  role TEXT NOT NULL DEFAULT 'gallery',
  sort_order INTEGER DEFAULT 0,
  
  -- Portal-specific (same asset, different hero per portal)
  portal_id UUID REFERENCES portals(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index with COALESCE for nullable portal_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_media_unique 
  ON entity_media(media_id, entity_type, entity_id, role, COALESCE(portal_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_entity_media_entity ON entity_media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_media_portal ON entity_media(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_media_media ON entity_media(media_id);

COMMENT ON TABLE entity_media IS 'Polymorphic links connecting media to any entity (asset, person, organization, etc.)';

-- ============================================================================
-- CRAWL MEDIA QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS crawl_media_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Source
  source_url TEXT NOT NULL,
  source_page_url TEXT,
  crawl_job_id UUID,
  
  -- Target entity
  entity_type TEXT,
  entity_id UUID,
  suggested_role TEXT DEFAULT 'gallery',
  
  -- Processing
  status crawl_media_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  
  -- Metadata from crawl
  suggested_alt_text TEXT,
  page_context TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  UNIQUE(source_url, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_crawl_media_status ON crawl_media_queue(status);
CREATE INDEX IF NOT EXISTS idx_crawl_media_tenant ON crawl_media_queue(tenant_id);

COMMENT ON TABLE crawl_media_queue IS 'Queue for downloading and processing images discovered during web crawling';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_media_queue ENABLE ROW LEVEL SECURITY;

-- Media RLS
DROP POLICY IF EXISTS media_tenant_isolation ON media;
CREATE POLICY media_tenant_isolation ON media
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.current_tenant', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.current_tenant', true) IS NULL THEN false
      ELSE tenant_id = current_setting('app.current_tenant', true)::uuid
    END
  );

-- Entity Media RLS (via media tenant)
DROP POLICY IF EXISTS entity_media_tenant_isolation ON entity_media;
CREATE POLICY entity_media_tenant_isolation ON entity_media
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.current_tenant', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.current_tenant', true) IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM media m 
        WHERE m.id = entity_media.media_id 
        AND m.tenant_id = current_setting('app.current_tenant', true)::uuid
      )
    END
  );

-- Crawl Media Queue RLS
DROP POLICY IF EXISTS crawl_media_queue_tenant_isolation ON crawl_media_queue;
CREATE POLICY crawl_media_queue_tenant_isolation ON crawl_media_queue
  FOR ALL
  USING (
    CASE 
      WHEN current_setting('app.current_tenant', true) = '__SERVICE__' THEN true
      WHEN current_setting('app.current_tenant', true) IS NULL THEN false
      ELSE tenant_id = current_setting('app.current_tenant', true)::uuid
    END
  );

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_entity_media AS
SELECT 
  em.id,
  em.media_id,
  em.entity_type,
  em.entity_id,
  em.role,
  em.sort_order,
  em.portal_id,
  m.public_url,
  m.filename,
  m.mime_type,
  m.width,
  m.height,
  m.alt_text,
  m.caption,
  m.variants,
  m.media_type,
  m.tenant_id
FROM entity_media em
JOIN media m ON m.id = em.media_id;

COMMENT ON VIEW v_entity_media IS 'Denormalized view joining entity_media with media details for efficient queries';

COMMIT;

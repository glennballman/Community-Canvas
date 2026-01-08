-- Migration 061: Articles SEO Enhancement
-- Adds missing SEO columns to articles table and base_url to portals
-- Part of schema.org compliance initiative

-- ============================================================================
-- PHASE 1: Add content_type enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE article_content_type AS ENUM (
    'article',        -- default editorial
    'guide',          -- step-by-step guide
    'howto',          -- instructional HowTo
    'faq',            -- FAQ collection
    'list',           -- top-10, best-of lists
    'news',           -- timely news/updates
    'report',         -- reports/summaries
    'story',          -- narrative storytelling
    'profile'         -- entity profile/spotlight
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PHASE 1: Add SEO columns to articles table
-- ============================================================================

ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS content_type article_content_type DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES cc_users(id),
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add indexes for content_type filtering
CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);
CREATE INDEX IF NOT EXISTS idx_articles_schema_type ON articles(schema_type);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at) WHERE published_at IS NOT NULL;

-- ============================================================================
-- PHASE 2: Add base_url to portals table
-- ============================================================================

ALTER TABLE portals 
  ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Backfill based on slug pattern
UPDATE portals 
SET base_url = 'https://' || slug || '.communitycanvas.ca'
WHERE base_url IS NULL;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO public;
GRANT SELECT ON organizations TO public;

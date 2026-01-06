-- Migration 043: Good News schema permissions and moderation tables
-- Created: 2026-01-06
-- Purpose: Add permissions for AI Queue (Good News) and Flagged Content moderation features
-- Note: Schema and tables may already exist; this migration focuses on permissions

-- Create good_news schema if not exists
CREATE SCHEMA IF NOT EXISTS good_news;

-- Submission status enum - create base or add missing values
DO $$ BEGIN
  CREATE TYPE good_news.submission_status AS ENUM ('pending', 'approved', 'rejected', 'needs_edit', 'declined', 'hidden');
EXCEPTION
  WHEN duplicate_object THEN
    -- Enum exists, add any missing values
    BEGIN
      ALTER TYPE good_news.submission_status ADD VALUE IF NOT EXISTS 'rejected';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE good_news.submission_status ADD VALUE IF NOT EXISTS 'needs_edit';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE good_news.submission_status ADD VALUE IF NOT EXISTS 'declined';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE good_news.submission_status ADD VALUE IF NOT EXISTS 'hidden';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Submissions table (Good News stories) - create only if not exists
CREATE TABLE IF NOT EXISTS good_news.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  submitter_user_id UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  is_visitor BOOLEAN NOT NULL DEFAULT false,
  visitor_identifier TEXT,
  story_raw TEXT NOT NULL,
  story_public TEXT,
  signature_public TEXT DEFAULT 'A grateful neighbor',
  attribution_preference TEXT DEFAULT 'anonymous' CHECK (attribution_preference IN ('anonymous', 'first_name', 'full_name')),
  ai_flagged BOOLEAN DEFAULT false,
  ai_severity TEXT DEFAULT 'low' CHECK (ai_severity IN ('low', 'medium', 'high')),
  ai_reasons JSONB DEFAULT '[]'::jsonb,
  suggested_recipient_text TEXT,
  status good_news.submission_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  visible_from TIMESTAMPTZ,
  visible_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Private attributions
CREATE TABLE IF NOT EXISTS good_news.private_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES good_news.submissions(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email', 'phone', 'username')),
  contact_value TEXT NOT NULL,
  notify_on_publish BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community badges
CREATE TABLE IF NOT EXISTS good_news.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_tenant_id, key)
);

-- Badge awards
CREATE TABLE IF NOT EXISTS good_news.badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES good_news.badges(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES good_news.submissions(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  recipient_text TEXT,
  awarded_by UUID NOT NULL REFERENCES cc_users(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(badge_id, submission_id)
);

-- Create cc_flagged_content table if not exists
-- Status: pending, resolved, dismissed
-- resolution_action: removed, edited, kept, escalated, hidden, dismissed
CREATE TABLE IF NOT EXISTS cc_flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  content_preview TEXT,
  community_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  reason TEXT NOT NULL,
  reason_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT CHECK (resolution_action IN ('removed', 'edited', 'kept', 'escalated', 'hidden', 'dismissed')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cc_portal_configs table if not exists
CREATE TABLE IF NOT EXISTS cc_portal_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE UNIQUE,
  theme JSONB DEFAULT '{}'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  good_news_settings JSONB DEFAULT '{"enabled": true, "require_moderation": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_submissions_community ON good_news.submissions(community_tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON good_news.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON good_news.submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_badges_community ON good_news.badges(community_tenant_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_badge ON good_news.badge_awards(badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_submission ON good_news.badge_awards(submission_id);
CREATE INDEX IF NOT EXISTS idx_flagged_content_community ON cc_flagged_content(community_tenant_id);
CREATE INDEX IF NOT EXISTS idx_flagged_content_status ON cc_flagged_content(status);
CREATE INDEX IF NOT EXISTS idx_flagged_content_created_at ON cc_flagged_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_configs_tenant ON cc_portal_configs(tenant_id);

-- Grant permissions to cc_app role for good_news schema
GRANT USAGE ON SCHEMA good_news TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA good_news TO cc_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA good_news TO cc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA good_news GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA good_news GRANT USAGE, SELECT ON SEQUENCES TO cc_app;

-- Grant permissions on public schema tables to cc_app
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_flagged_content TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cc_portal_configs TO cc_app;

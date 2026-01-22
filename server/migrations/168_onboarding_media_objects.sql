-- ONB-02: Guest photo uploads
-- Media objects captured during guest onboarding (before tenant claim)

CREATE TABLE IF NOT EXISTS cc_onboarding_media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES cc_onboarding_workspaces(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  sha256 TEXT,
  exif_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_media_objects_workspace 
  ON cc_onboarding_media_objects(workspace_id);

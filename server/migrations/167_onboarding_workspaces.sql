-- ONB-01: Guest Onboarding Workspace tables
-- Shareable, resumable onboarding that works WITHOUT login

-- 1) Onboarding Workspaces - token-based guest workspaces
CREATE TABLE IF NOT EXISTS cc_onboarding_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  display_name TEXT,
  company_name TEXT,
  mode_hints JSONB NOT NULL DEFAULT '{}',
  claimed_user_id UUID,
  claimed_tenant_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_workspaces_expires ON cc_onboarding_workspaces(expires_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_workspaces_status ON cc_onboarding_workspaces(status);

-- 2) Onboarding Items - flexible content items within a workspace
CREATE TABLE IF NOT EXISTS cc_onboarding_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES cc_onboarding_workspaces(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'user',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_items_workspace ON cc_onboarding_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_items_type ON cc_onboarding_items(item_type);

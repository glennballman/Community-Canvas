-- ONB-04: Onboarding Ingestion Links + Onboarding Threads
-- Links workspace promotions to tenant-scoped ingestions and threads

-- Link table: maps workspaces to promoted ingestions
CREATE TABLE IF NOT EXISTS cc_onboarding_ingestion_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  ingestion_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_onboarding_ingestion_links_workspace 
    FOREIGN KEY (workspace_id) REFERENCES cc_onboarding_workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_ingestion_links_workspace ON cc_onboarding_ingestion_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_ingestion_links_tenant ON cc_onboarding_ingestion_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_ingestion_links_ingestion ON cc_onboarding_ingestion_links(ingestion_id);

-- Onboarding threads: one thread per workspace+tenant
CREATE TABLE IF NOT EXISTS cc_onboarding_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  thread_id UUID NOT NULL,
  summary_posted_at TIMESTAMPTZ,
  summary_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_onboarding_threads_workspace 
    FOREIGN KEY (workspace_id) REFERENCES cc_onboarding_workspaces(id) ON DELETE CASCADE,
  CONSTRAINT uq_onboarding_threads_workspace_tenant UNIQUE (workspace_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_threads_workspace ON cc_onboarding_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_threads_tenant ON cc_onboarding_threads(tenant_id);

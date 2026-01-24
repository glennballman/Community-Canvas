-- V3.5 STEP 10C: Visibility Edge Management Indexes

-- Drop old indexes if they exist (may have been created without tenant_id)
DROP INDEX IF EXISTS idx_visibility_edges_source;
DROP INDEX IF EXISTS idx_visibility_edges_target;

-- Index for efficient source lookups (tenant-scoped, active only)
CREATE INDEX idx_visibility_edges_source_v2
ON cc_visibility_edges(tenant_id, source_type, source_id)
WHERE archived_at IS NULL;

-- Index for efficient target lookups (tenant-scoped, active only)
CREATE INDEX idx_visibility_edges_target_v2
ON cc_visibility_edges(tenant_id, target_type, target_id)
WHERE archived_at IS NULL;

-- Prevent duplicate active edges (same source→target+direction)
CREATE UNIQUE INDEX IF NOT EXISTS uq_visibility_edges_active
ON cc_visibility_edges(tenant_id, source_type, source_id, target_type, target_id, direction)
WHERE archived_at IS NULL;

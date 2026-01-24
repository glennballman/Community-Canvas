-- V3.5 STEP 10C: Visibility Edge Management Indexes

-- Index for efficient source lookups
CREATE INDEX IF NOT EXISTS idx_visibility_edges_source
ON cc_visibility_edges(tenant_id, source_type, source_id)
WHERE archived_at IS NULL;

-- Index for efficient target lookups
CREATE INDEX IF NOT EXISTS idx_visibility_edges_target
ON cc_visibility_edges(tenant_id, target_type, target_id)
WHERE archived_at IS NULL;

-- Prevent duplicate active edges (same source→target+direction)
CREATE UNIQUE INDEX IF NOT EXISTS uq_visibility_edges_active
ON cc_visibility_edges(tenant_id, source_type, source_id, target_type, target_id, direction)
WHERE archived_at IS NULL;

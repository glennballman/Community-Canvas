-- Migration 176: Portal Anchor Community FK
-- Purpose: Add geo anchor linkage for portals to enable STEP 7 advisory suggestions
-- Date: 2026-01-24

-- 1) Add anchor_community_id FK to portals
ALTER TABLE cc_portals
ADD COLUMN anchor_community_id UUID
REFERENCES cc_sr_communities(id);

COMMENT ON COLUMN cc_portals.anchor_community_id IS
'Geographic anchor for this portal. Links to cc_sr_communities for lat/lng. Used for STEP 7 advisory suggestions (opt-in).';

-- 2) Index for join performance (partial, since nullable)
CREATE INDEX IF NOT EXISTS idx_cc_portals_anchor_community_id
ON cc_portals(anchor_community_id)
WHERE anchor_community_id IS NOT NULL;

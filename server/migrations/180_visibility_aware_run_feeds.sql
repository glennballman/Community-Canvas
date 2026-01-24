-- V3.5 STEP 10E: Visibility-Aware Run Feeds (Read Path Only)
-- Creates functions for recursive effective visibility resolution for runs

-- Function 1: Recursive effective visibility for a run
-- Returns direct + rolled-up visibility targets with provenance
CREATE OR REPLACE FUNCTION resolve_run_effective_visibility_recursive(
  p_run_id UUID,
  max_depth INT DEFAULT 6
)
RETURNS TABLE (
  target_type TEXT,
  target_id UUID,
  source TEXT,
  via_type TEXT,
  via_id UUID,
  depth INT,
  path_nodes TEXT[]
)
LANGUAGE sql
STABLE
AS $$
  WITH run_row AS (
    SELECT id, tenant_id, zone_id
    FROM cc_n3_runs
    WHERE id = p_run_id
  ),
  direct_portals AS (
    SELECT
      'portal'::text AS target_type,
      pub.portal_id  AS target_id,
      'direct'::text AS source,
      NULL::text     AS via_type,
      NULL::uuid     AS via_id,
      NULL::int      AS depth,
      NULL::text[]   AS path_nodes
    FROM cc_run_portal_publications pub
    JOIN run_row r ON r.id = pub.run_id
    WHERE pub.run_id = p_run_id
      AND pub.unpublished_at IS NULL
  ),
  rollup_from_zone AS (
    SELECT
      'portal'::text AS target_type,
      t.target_id    AS target_id,
      'rollup'::text AS source,
      'zone'::text   AS via_type,
      r.zone_id      AS via_id,
      t.depth        AS depth,
      t.path_nodes   AS path_nodes
    FROM run_row r
    JOIN LATERAL resolve_visibility_targets_recursive('zone', r.zone_id, max_depth, false) t
      ON t.target_type = 'portal'
    WHERE r.zone_id IS NOT NULL
  ),
  rollup_from_direct_portals AS (
    SELECT
      'portal'::text AS target_type,
      t.target_id    AS target_id,
      'rollup'::text AS source,
      'portal'::text AS via_type,
      dp.target_id   AS via_id,
      t.depth        AS depth,
      t.path_nodes   AS path_nodes
    FROM direct_portals dp
    JOIN LATERAL resolve_visibility_targets_recursive('portal', dp.target_id, max_depth, false) t
      ON t.target_type = 'portal'
  ),
  combined AS (
    SELECT * FROM direct_portals
    UNION ALL
    SELECT * FROM rollup_from_zone
    UNION ALL
    SELECT * FROM rollup_from_direct_portals
  ),
  ranked AS (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.target_type, c.target_id
        ORDER BY
          CASE WHEN c.source = 'direct' THEN 0 ELSE 1 END,
          COALESCE(c.depth, 0) ASC,
          COALESCE(array_to_string(c.path_nodes, '>'), '') ASC
      ) AS rn
    FROM combined c
  )
  SELECT target_type, target_id, source, via_type, via_id, depth, path_nodes
  FROM ranked
  WHERE rn = 1;
$$;

-- Function 2: Helper to check if a run is visible in a specific portal
CREATE OR REPLACE FUNCTION is_run_visible_in_portal(
  p_run_id UUID,
  p_portal_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resolve_run_effective_visibility_recursive(p_run_id, 6) v
    WHERE v.target_type = 'portal'
      AND v.target_id = p_portal_id
  );
$$;

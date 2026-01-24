-- V3.5 STEP 10D: Recursive Visibility Resolver (Multi-hop)
-- Creates functions for multi-hop visibility traversal with cycle guard

-- Function 1: Raw visibility walk (returns all reachable nodes with paths)
CREATE OR REPLACE FUNCTION resolve_visibility_walk(
  input_type TEXT,
  input_id UUID,
  max_depth INT DEFAULT 6,
  allow_down BOOLEAN DEFAULT false
)
RETURNS TABLE (
  target_type TEXT,
  target_id UUID,
  depth INT,
  path_nodes TEXT[],
  path_edge_ids UUID[]
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE walk AS (
    -- Seed node
    SELECT
      input_type::text AS cur_type,
      input_id::uuid   AS cur_id,
      0                AS depth,
      ARRAY[(input_type || ':' || input_id::text)]::text[] AS visited,
      ARRAY[(input_type || ':' || input_id::text)]::text[] AS path_nodes,
      ARRAY[]::uuid[]  AS path_edge_ids
    UNION ALL
    SELECT
      e.target_type::text,
      e.target_id,
      w.depth + 1,
      w.visited || (e.target_type::text || ':' || e.target_id::text),
      w.path_nodes || (e.target_type::text || ':' || e.target_id::text),
      w.path_edge_ids || e.id
    FROM walk w
    JOIN cc_visibility_edges e
      ON e.archived_at IS NULL
     AND e.source_type::text = w.cur_type
     AND e.source_id = w.cur_id
     AND (
       allow_down
       OR e.direction IN ('up','lateral')
     )
     AND (
       e.tenant_id::text = current_setting('app.tenant_id', true)
       OR current_setting('app.service_mode', true) = 'on'
     )
    WHERE w.depth < LEAST(max_depth, 10)
      AND NOT ((e.target_type::text || ':' || e.target_id::text) = ANY(w.visited))
  )
  SELECT
    cur_type AS target_type,
    cur_id   AS target_id,
    depth,
    path_nodes,
    path_edge_ids
  FROM walk
  WHERE depth > 0;
$$;

-- Function 2: Deduped visibility targets (portal/zone only, deterministic best path)
CREATE OR REPLACE FUNCTION resolve_visibility_targets_recursive(
  input_type TEXT,
  input_id UUID,
  max_depth INT DEFAULT 6,
  allow_down BOOLEAN DEFAULT false
)
RETURNS TABLE (
  target_type TEXT,
  target_id UUID,
  depth INT,
  path_nodes TEXT[],
  path_edge_ids UUID[]
)
LANGUAGE sql
STABLE
AS $$
  WITH raw AS (
    SELECT *
    FROM resolve_visibility_walk(input_type, input_id, max_depth, allow_down)
    WHERE target_type IN ('portal','zone')
  ),
  ranked AS (
    SELECT
      r.*,
      ROW_NUMBER() OVER (
        PARTITION BY r.target_type, r.target_id
        ORDER BY r.depth ASC, array_to_string(r.path_nodes, '>') ASC
      ) AS rn
    FROM raw r
  )
  SELECT target_type, target_id, depth, path_nodes, path_edge_ids
  FROM ranked
  WHERE rn = 1;
$$;

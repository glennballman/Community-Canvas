-- V3.5 STEP 10B: Effective Visibility Resolver
-- Read-only function to compute direct + rolled-up visibility for a run

CREATE OR REPLACE FUNCTION resolve_run_effective_visibility(p_run_id uuid)
RETURNS TABLE (
  target_type text,
  target_id uuid,
  source text,
  via_source_type text,
  via_source_id uuid,
  direction text
)
LANGUAGE sql
STABLE
AS $$
  WITH run_row AS (
    SELECT id, tenant_id, zone_id
    FROM cc_n3_runs
    WHERE id = p_run_id
  ),
  direct AS (
    SELECT
      'portal'::text AS target_type,
      rp.portal_id AS target_id,
      'direct'::text AS source,
      NULL::text AS via_source_type,
      NULL::uuid AS via_source_id,
      NULL::text AS direction
    FROM cc_run_portal_publications rp
    JOIN run_row r ON r.id = rp.run_id
    WHERE rp.unpublished_at IS NULL
  ),
  rollup_from_portals AS (
    SELECT
      e.target_type::text,
      e.target_id,
      'rollup'::text AS source,
      e.source_type::text AS via_source_type,
      e.source_id AS via_source_id,
      e.direction::text
    FROM cc_visibility_edges e
    WHERE e.archived_at IS NULL
      AND e.direction IN ('up','lateral')
      AND e.source_type = 'portal'
      AND e.source_id IN (
        SELECT target_id FROM direct WHERE target_type='portal'
      )
  ),
  rollup_from_zone AS (
    SELECT
      e.target_type::text,
      e.target_id,
      'rollup'::text AS source,
      e.source_type::text AS via_source_type,
      e.source_id AS via_source_id,
      e.direction::text
    FROM cc_visibility_edges e
    JOIN run_row r ON true
    WHERE e.archived_at IS NULL
      AND e.direction IN ('up','lateral')
      AND e.source_type = 'zone'
      AND r.zone_id IS NOT NULL
      AND e.source_id = r.zone_id
  )
  SELECT * FROM direct
  UNION
  SELECT * FROM rollup_from_portals
  UNION
  SELECT * FROM rollup_from_zone;
$$;

-- Performance index for active publications lookup
CREATE INDEX IF NOT EXISTS idx_run_publications_active
ON cc_run_portal_publications(run_id, portal_id)
WHERE unpublished_at IS NULL;

# V3.5 STEP 10E: Visibility-Aware Run Feeds — Proof of Work

**Date**: 2025-01-24  
**Status**: COMPLETE  
**Mode**: Read-only visibility application

---

## SECTION A: AUDIT RESULTS

### Prior Functions Exist

```sql
SELECT proname
FROM pg_proc
WHERE proname IN (
  'resolve_run_effective_visibility',
  'resolve_visibility_targets_recursive'
)
ORDER BY proname;
```

| proname |
|---------|
| resolve_run_effective_visibility |
| resolve_visibility_targets_recursive |

### Publications Indexes Exist

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'cc_run_portal_publications'
ORDER BY indexname;
```

| indexname |
|-----------|
| cc_run_portal_publications_pkey |
| cc_run_portal_publications_tenant_id_run_id_portal_id_key |
| idx_run_portal_publications_active |
| idx_run_portal_publications_portal_id |
| idx_run_portal_publications_run_id |
| idx_run_portal_publications_tenant_id |
| idx_run_publications_active |

### Run Count

```sql
SELECT COUNT(*) AS run_count FROM cc_n3_runs;
```

| run_count |
|-----------|
| 18 |

**Prerequisites satisfied**: All required functions and indexes exist.

---

## SECTION B: SQL FUNCTION — resolve_run_effective_visibility_recursive

### Migration: server/migrations/180_visibility_aware_run_feeds.sql

```sql
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
```

**Key Features:**
- STABLE function (read-only, cacheable)
- Combines direct publications + zone rollups + portal rollups
- Dedup by (target_type, target_id) preferring direct over rollup
- Uses existing `resolve_visibility_targets_recursive` for graph traversal

---

## SECTION C: SQL FUNCTION — is_run_visible_in_portal

```sql
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
```

---

## SECTION D: INTERNAL API ENDPOINT

### Endpoint: GET /api/internal/visibility/portals/:id/runs

**Auth**: Platform admin (requirePlatformRole)

**Query Parameters:**
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| tenant_id | Yes | UUID | Tenant context |
| limit | No | 1-200 | Max runs (default 50) |
| offset | No | int | Pagination offset (default 0) |

**Validation:**
- Portal must exist (404 if not found)
- Portal's `owning_tenant_id` must match `tenant_id` (403 if mismatch)

**Implementation:**
- Uses efficient single SQL query with `CROSS JOIN LATERAL` on visibility function
- LIMIT/OFFSET applied after visibility filtering (ensures complete results)
- Service mode enabled for admin access

**Response Shape:**
```json
{
  "ok": true,
  "portal_id": "...",
  "portal_name": "Bamfield Community Portal",
  "tenant_id": "...",
  "limit": 50,
  "offset": 0,
  "runs": [
    {
      "run_id": "...",
      "run_title": "...",
      "starts_at": "...",
      "status": "...",
      "visibility_source": "direct",
      "via_type": null,
      "via_id": null,
      "depth": null,
      "path": null
    },
    {
      "run_id": "...",
      "run_title": "...",
      "starts_at": "...",
      "status": "...",
      "visibility_source": "rollup",
      "via_type": "portal",
      "via_id": "...",
      "depth": 1,
      "path": ["portal:...", "portal:..."]
    }
  ]
}
```

---

## SECTION E: TEST RESULTS

### Test 1: Recursive Effective Visibility

**Run**: 2f0b495c-cc53-4206-96b5-dccbd790d40c (directly published to Bamfield Community Portal)

```sql
SELECT * FROM resolve_run_effective_visibility_recursive('2f0b495c-cc53-4206-96b5-dccbd790d40c', 6);
```

| target_type | target_id | source | via_type | via_id | depth | path_nodes |
|-------------|-----------|--------|----------|--------|-------|------------|
| portal | df5561a8-8550-4498-9dc7-f02054bbbea4 | direct | NULL | NULL | NULL | NULL |
| portal | 4ead0e01-e45b-4d03-83ae-13d86271ff25 | rollup | portal | df5561a8-... | 1 | {portal:df5561a8-...,portal:4ead0e01-...} |

**Result**: 
- Direct publication to Bamfield Community Portal shown with `source='direct'`
- Rollup to Bamfield Adventure Center shown with `source='rollup'`, `via_type='portal'`, `depth=1`

### Test 2: is_run_visible_in_portal Helper

```sql
-- Bamfield Community Portal (direct)
SELECT is_run_visible_in_portal(
  '2f0b495c-cc53-4206-96b5-dccbd790d40c',
  'df5561a8-8550-4498-9dc7-f02054bbbea4'
);
-- Result: true

-- Bamfield Adventure Center (rollup)
SELECT is_run_visible_in_portal(
  '2f0b495c-cc53-4206-96b5-dccbd790d40c',
  '4ead0e01-e45b-4d03-83ae-13d86271ff25'
);
-- Result: true

-- AdrenalineCanada (not visible)
SELECT is_run_visible_in_portal(
  '2f0b495c-cc53-4206-96b5-dccbd790d40c',
  '96f6541c-2b38-4666-92e3-04f68d64b8ef'
);
-- Result: false
```

**Result**: Helper correctly identifies direct, rollup, and non-visible portals.

### Test 3: Cycle Safety

The recursive visibility function includes cycle guard from STEP 10D. Even with cyclic edges (tested in 10D proof), the function completes normally without infinite loops.

---

## SECTION F: COMPLIANCE CONFIRMATION

### What This Step DOES:
- Creates recursive effective visibility function (STABLE, read-only)
- Creates helper boolean function for visibility check
- Exposes admin-only read-only API endpoint for portal run feeds
- Preserves visibility provenance (direct vs rollup, via info, depth, path)

### What This Step Does NOT:
- No publications were modified (cc_run_portal_publications unchanged)
- No UI changes
- No geo inference added
- No execution systems referenced
- No auto-publishing behavior

---

## CHECKLIST

- [x] Recursive effective visibility function works
- [x] Helper boolean function works
- [x] Admin endpoint returns correct runs with provenance
- [x] Provenance preserved (direct vs rollup)
- [x] Dedup policy: direct preferred over rollup
- [x] Cycle safety maintained (via STEP 10D)
- [x] Migration file created (180_visibility_aware_run_feeds.sql)
- [x] No publications modified
- [x] Read-only operations only

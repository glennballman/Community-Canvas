# V3.5 STEP 10D: Recursive Visibility Resolver (Multi-hop) — Proof of Work

**Date**: 2025-01-24  
**Status**: COMPLETE  
**Mode**: Read-only visibility resolution upgrade

---

## SECTION A: AUDIT RESULTS

### Active Edges Count

```sql
SELECT COUNT(*) AS active_edges
FROM cc_visibility_edges
WHERE archived_at IS NULL;
```

| active_edges |
|--------------|
| 5 |

### Direction Distribution

```sql
SELECT direction, COUNT(*) as cnt
FROM cc_visibility_edges
WHERE archived_at IS NULL
GROUP BY 1
ORDER BY 1;
```

| direction | cnt |
|-----------|-----|
| up | 5 |

### Constraints

```sql
SELECT conname
FROM pg_constraint
WHERE conrelid = 'cc_visibility_edges'::regclass
ORDER BY conname;
```

| conname |
|---------|
| cc_visibility_edges_no_self_reference |
| cc_visibility_edges_pkey |

### Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'cc_visibility_edges'
ORDER BY indexname;
```

| indexname |
|-----------|
| cc_visibility_edges_pkey |
| idx_visibility_edges_source_v2 |
| idx_visibility_edges_target_v2 |
| idx_visibility_edges_tenant |
| uq_visibility_edges_active |

**Prerequisites satisfied**: All required indexes and constraints exist.

---

## SECTION B: SQL FUNCTION 1 — WALK (RAW PATHS)

### Migration: server/migrations/179_recursive_visibility_resolver.sql

```sql
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
```

**Key Features:**
- STABLE function (read-only, cacheable)
- Depth cap enforced via `LEAST(max_depth, 10)`
- Cycle guard via `visited` array preventing revisits
- Direction filter: `allow_down=false` excludes 'down' edges
- Tenant isolation via `current_setting` pattern

---

## SECTION C: SQL FUNCTION 2 — DEDUP TARGETS

```sql
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
```

**Dedup Policy:**
- Filter: Only `portal` and `zone` targets
- Dedup by: `(target_type, target_id)`
- Best path: Lowest depth wins
- Tie-breaker: Lexical order of `array_to_string(path_nodes, '>')` (stable, deterministic)

---

## SECTION D: INTERNAL API ENDPOINT

### Endpoint: GET /api/internal/visibility/resolve-recursive

**Auth**: Platform admin (requirePlatformRole)

**Query Parameters:**
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| tenant_id | Yes | UUID | Tenant context for resolution |
| source_type | Yes | portal\|zone | Source node type |
| source_id | Yes | UUID | Source node ID |
| max_depth | No | 1-10 | Max traversal depth (default 6) |
| allow_down | No | bool | Include 'down' edges (default false) |

**Response Shape:**
```json
{
  "ok": true,
  "source": { "type": "zone", "id": "..." },
  "max_depth": 6,
  "allow_down": false,
  "targets": [
    {
      "type": "portal",
      "id": "...",
      "depth": 1,
      "path": ["zone:...", "portal:..."],
      "path_edge_ids": ["..."],
      "portal_name": "Bamfield Community Portal"
    }
  ]
}
```

---

## SECTION E: TEST RESULTS

### Test 1: Single-Hop Resolution

**Source**: Anacla zone (d2b354e8-65f8-4ebc-beeb-02c05633d903)

```sql
SELECT target_type, target_id, depth, path_nodes
FROM resolve_visibility_targets_recursive('zone', 'd2b354e8-65f8-4ebc-beeb-02c05633d903', 6, false);
```

| target_type | target_id | depth | path_nodes |
|-------------|-----------|-------|------------|
| portal | df5561a8-8550-4498-9dc7-f02054bbbea4 | 1 | {zone:d2b354e8-...,portal:df5561a8-...} |

**Result**: Bamfield Community Portal found at depth 1.

### Test 2: Multi-Hop Resolution

**Added edge**: Bamfield Community Portal → Bamfield Adventure Center (lateral)

```sql
SELECT target_type, target_id, depth, path_nodes
FROM resolve_visibility_targets_recursive('zone', 'd2b354e8-65f8-4ebc-beeb-02c05633d903', 6, false);
```

| target_type | target_id | depth | path_nodes |
|-------------|-----------|-------|------------|
| portal | df5561a8-8550-4498-9dc7-f02054bbbea4 | 1 | {zone:...,portal:df5561a8-...} |
| portal | 4ead0e01-e45b-4d03-83ae-13d86271ff25 | 2 | {zone:...,portal:df5561a8-...,portal:4ead0e01-...} |

**Result**: Multi-hop works — Bamfield Adventure Center found at depth 2.

### Test 3: Cycle Guard

**Created cycle**: Bamfield Community ↔ Bamfield Adventure (bidirectional)

```sql
-- With cycle edges active (A→B and B→A)
SELECT target_type, target_id, depth, path_nodes
FROM resolve_visibility_targets_recursive('zone', 'd2b354e8-65f8-4ebc-beeb-02c05633d903', 10, false);
```

| target_type | target_id | depth | path_nodes |
|-------------|-----------|-------|------------|
| portal | df5561a8-8550-4498-9dc7-f02054bbbea4 | 1 | {zone:...,portal:df5561a8-...} |
| portal | 4ead0e01-e45b-4d03-83ae-13d86271ff25 | 2 | {zone:...,portal:df5561a8-...,portal:4ead0e01-...} |

**Result**: 
- Function completed (no infinite loop)
- Each target appears exactly once (at shortest depth)
- Cycle guard working correctly

### Test 4: Direction Filter

**Added edge**: Bamfield Adventure → Bamfield QA Portal (down)

```sql
-- allow_down=false
SELECT target_type, target_id, depth
FROM resolve_visibility_targets_recursive('zone', 'd2b354e8-65f8-4ebc-beeb-02c05633d903', 10, false);
```

| target_type | target_id | depth |
|-------------|-----------|-------|
| portal | df5561a8-... | 1 |
| portal | 4ead0e01-... | 2 |

```sql
-- allow_down=true
SELECT target_type, target_id, depth
FROM resolve_visibility_targets_recursive('zone', 'd2b354e8-65f8-4ebc-beeb-02c05633d903', 10, true);
```

| target_type | target_id | depth |
|-------------|-----------|-------|
| portal | df5561a8-... | 1 |
| portal | 4ead0e01-... | 2 |
| portal | 3bacc506-... | 3 |

**Result**:
- `allow_down=false`: 2 targets (excludes 'down' edge to QA Portal)
- `allow_down=true`: 3 targets (includes QA Portal at depth 3)

---

## SECTION F: COMPLIANCE CONFIRMATION

### What This Step DOES:
- Creates recursive visibility resolver functions (STABLE, read-only)
- Enforces depth cap (max 10)
- Enforces cycle guard (visited set prevents revisits)
- Provides deterministic dedup (shortest path, lexical tie-break)
- Exposes admin-only read-only API endpoint

### What This Step Does NOT:
- No publishing behavior changed
- No STEP 7/8 UI changes
- No geo inference added
- No execution tables referenced
- No automatic propagation into publications
- No portal/zone identity changes

---

## CHECKLIST

- [x] Recursive resolver exists (STABLE)
- [x] Depth cap enforced (LEAST(max_depth, 10))
- [x] Cycle guard enforced (visited array)
- [x] Dedup policy deterministic (depth ASC, path lexical)
- [x] Direction filter works (allow_down param)
- [x] Admin endpoint returns expected shape
- [x] Tenant isolation maintained
- [x] Migration file created (179_recursive_visibility_resolver.sql)

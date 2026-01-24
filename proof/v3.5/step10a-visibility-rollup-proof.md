# V3.5 STEP 10A: Visibility Rollup Graph Proof

**Date**: 2026-01-24
**Status**: COMPLETE

## Executive Summary

STEP 10A introduces an explicit, auditable, opt-in visibility rollup graph that answers: "If a service run is visible in this place, where else is it allowed to be visible?"

**Core Principles**:
- Visibility is NOT derived from geography, distance, naming, or hierarchy
- Visibility exists ONLY where an explicit relationship is defined
- Identity (portal/zone names) is never modified
- Read-only resolution (v1) - no publishing side-effects

## Table Schema

```sql
CREATE TYPE cc_visibility_edge_direction AS ENUM ('up', 'down', 'lateral');
CREATE TYPE cc_visibility_node_type AS ENUM ('portal', 'zone');

CREATE TABLE cc_visibility_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_type cc_visibility_node_type NOT NULL,
  source_id UUID NOT NULL,
  target_type cc_visibility_node_type NOT NULL,
  target_id UUID NOT NULL,
  direction cc_visibility_edge_direction NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_visibility_edges_tenant ON cc_visibility_edges(tenant_id);
CREATE INDEX idx_visibility_edges_source ON cc_visibility_edges(source_type, source_id);
CREATE INDEX idx_visibility_edges_target ON cc_visibility_edges(target_type, target_id);

-- Hard rule: no self-referential edges
ALTER TABLE cc_visibility_edges 
ADD CONSTRAINT cc_visibility_edges_no_self_reference 
CHECK (source_id != target_id);
```

## RLS Policy

```sql
ALTER TABLE cc_visibility_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON cc_visibility_edges
USING (tenant_id::text = current_setting('app.tenant_id', true) OR is_service_mode());
```

## Resolver Function

```sql
CREATE OR REPLACE FUNCTION resolve_visibility_targets(
  input_type TEXT,
  input_id UUID
)
RETURNS TABLE (
  target_type TEXT,
  target_id UUID
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    target_type::TEXT,
    target_id
  FROM cc_visibility_edges
  WHERE source_type::TEXT = input_type
    AND source_id = input_id
    AND archived_at IS NULL;
$$;
```

## Insert Statements (Explicit)

Each Bamfield zone → Bamfield Community Portal (upward rollup):

```sql
-- Anacla → Bamfield Community Portal
INSERT INTO cc_visibility_edges (tenant_id, source_type, source_id, target_type, target_id, direction, reason)
SELECT z.tenant_id, 'zone', z.id, 'portal', p.id, 'up', 'micro-community rollup'
FROM cc_zones z JOIN cc_portals p ON p.slug = 'bamfield' WHERE z.key = 'anacla';

-- East Bamfield → Bamfield Community Portal
INSERT INTO cc_visibility_edges (tenant_id, source_type, source_id, target_type, target_id, direction, reason)
SELECT z.tenant_id, 'zone', z.id, 'portal', p.id, 'up', 'micro-community rollup'
FROM cc_zones z JOIN cc_portals p ON p.slug = 'bamfield' WHERE z.key = 'east-bamfield';

-- West Bamfield → Bamfield Community Portal
INSERT INTO cc_visibility_edges (tenant_id, source_type, source_id, target_type, target_id, direction, reason)
SELECT z.tenant_id, 'zone', z.id, 'portal', p.id, 'up', 'micro-community rollup'
FROM cc_zones z JOIN cc_portals p ON p.slug = 'bamfield' WHERE z.key = 'west-bamfield';

-- Helby Island → Bamfield Community Portal
INSERT INTO cc_visibility_edges (tenant_id, source_type, source_id, target_type, target_id, direction, reason)
SELECT z.tenant_id, 'zone', z.id, 'portal', p.id, 'up', 'micro-community rollup'
FROM cc_zones z JOIN cc_portals p ON p.slug = 'bamfield' WHERE z.key = 'helby-island';

-- Deer Group → Bamfield Community Portal
INSERT INTO cc_visibility_edges (tenant_id, source_type, source_id, target_type, target_id, direction, reason)
SELECT z.tenant_id, 'zone', z.id, 'portal', p.id, 'up', 'micro-community rollup'
FROM cc_zones z JOIN cc_portals p ON p.slug = 'bamfield' WHERE z.key = 'deer-group';
```

## Complete Edge List

```sql
SELECT source_type, z.name as source_name, z.key as source_key,
       target_type, p.name as target_name, direction, reason
FROM cc_visibility_edges e
JOIN cc_zones z ON z.id = e.source_id
JOIN cc_portals p ON p.id = e.target_id
WHERE e.archived_at IS NULL
ORDER BY z.key;
```

| source_type | source_name | source_key | target_type | target_name | direction | reason |
|------------|-------------|------------|-------------|-------------|-----------|--------|
| zone | Anacla | anacla | portal | Bamfield Community Portal | up | micro-community rollup |
| zone | Deer Group | deer-group | portal | Bamfield Community Portal | up | micro-community rollup |
| zone | East Bamfield | east-bamfield | portal | Bamfield Community Portal | up | micro-community rollup |
| zone | Helby Island | helby-island | portal | Bamfield Community Portal | up | micro-community rollup |
| zone | West Bamfield | west-bamfield | portal | Bamfield Community Portal | up | micro-community rollup |

## Resolver Output

```sql
SELECT * FROM resolve_visibility_targets(
  'zone',
  (SELECT id FROM cc_zones WHERE key = 'anacla')
);
```

| target_type | target_id |
|-------------|-----------|
| portal | df5561a8-8550-4498-9dc7-f02054bbbea4 |

## No Downward Edges Check

```sql
SELECT * FROM cc_visibility_edges WHERE direction = 'down';
```

**Result**: Empty (0 rows) - no unintended downward edges exist.

## Internal API Endpoint

Added to `server/routes/internal.ts`:

```
GET /api/internal/visibility/resolve
  ?source_type=zone
  &source_id=<uuid>
```

Response:
```json
{
  "source": {
    "type": "zone",
    "id": "d2b354e8-65f8-4ebc-beeb-02c05633d903"
  },
  "visible_to": [
    { "type": "portal", "id": "df5561a8-8550-4498-9dc7-f02054bbbea4" }
  ]
}
```

## Direction Semantics

| Direction | Meaning |
|-----------|---------|
| up | Visibility rolls upward (micro-identity → rollup) |
| down | Visibility rolls downward (rare, explicit, opt-in) |
| lateral | Peer visibility (siblings, explicit only) |

## Checklist

- [x] Identity preserved (no portal or zone names changed)
- [x] Visibility explicit (5 edges, all intentional)
- [x] No inference (no geo-based or naming-based edges)
- [x] No automation (no auto-publishing)
- [x] Resolver read-only (no side-effects)
- [x] No publishing behavior changed
- [x] No execution logic referenced
- [x] RLS enabled with tenant isolation

## Files Modified

1. `shared/schema.ts` - Added cc_visibility_edges table definition
2. `server/routes/internal.ts` - Added visibility resolve endpoint

## What This Unlocks

- STEP 10B — Admin-managed visibility rules
- STEP 11 — Market expansion
- STEP 12 — Paid amplification / distribution controls

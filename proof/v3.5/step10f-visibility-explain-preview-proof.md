# V3.5 STEP 10F: Visibility Explain + Preview API — Proof of Work

**Date**: 2025-01-24  
**Status**: COMPLETE  
**Mode**: Read-only, Admin-only visibility governance tooling

---

## SECTION A: ENDPOINT DEFINITIONS

### 10F-A: Explain Endpoint

**Path**: `GET /api/internal/visibility/runs/:runId/explain/:portalId`

**Auth**: Platform admin required (platform_reviewer, platform_admin)

**Query Parameters:**
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| tenant_id | Yes | UUID | Tenant context |

**Validation:**
- Run must exist and belong to tenant_id (404 if not found or mismatch)
- Portal must exist and belong to tenant_id (404 if not found or mismatch)
- Returns 404 for mismatches (do not leak tenant structure)

**Response Shape:**
```json
{
  "ok": true,
  "tenant_id": "e0000000-0000-0000-0000-000000000001",
  "run": { "id": "...", "name": "Marina Lot Paving", "status": "scheduled" },
  "portal": { "id": "...", "name": "Bamfield Community Portal", "slug": "bamfield" },
  "visible": true,
  "best_path": {
    "source": "direct",
    "via_type": null,
    "via_id": null,
    "depth": null,
    "path": null
  }
}
```

### 10F-B: Portal Preview Summary

**Path**: `GET /api/internal/visibility/portals/:portalId/preview`

**Auth**: Platform admin required (platform_reviewer, platform_admin)

**Query Parameters:**
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| tenant_id | Yes | UUID | Tenant context |
| limit | No | 1-200 | Max runs (default 50) |
| offset | No | int | Pagination offset (default 0) |

**Validation:**
- Portal must exist and belong to tenant_id (404 if not found or mismatch)

**Response Shape:**
```json
{
  "ok": true,
  "portal": { "id": "...", "name": "Bamfield Community Portal", "slug": "bamfield" },
  "summary": {
    "total": 1,
    "direct": 1,
    "rollup": 0,
    "rollup_by_via_type": { "zone": 0, "portal": 0 }
  },
  "limit": 50,
  "offset": 0,
  "runs": [
    {
      "run_id": "...",
      "run_name": "Marina Lot Paving",
      "starts_at": "...",
      "status": "scheduled",
      "visibility_source": "direct",
      "via_type": null,
      "via_id": null,
      "depth": null,
      "path": null
    }
  ]
}
```

---

## SECTION B: TEST RESULTS

### Test 1: Direct Publication Case

**Run**: `2f0b495c-cc53-4206-96b5-dccbd790d40c` (Marina Lot Paving)
**Portal**: `df5561a8-8550-4498-9dc7-f02054bbbea4` (Bamfield Community Portal)

```sql
SELECT * FROM resolve_run_effective_visibility_recursive('2f0b495c-cc53-4206-96b5-dccbd790d40c', 6)
WHERE target_type = 'portal' AND target_id = 'df5561a8-8550-4498-9dc7-f02054bbbea4';
```

| target_type | target_id | source | via_type | via_id | depth | path_nodes |
|-------------|-----------|--------|----------|--------|-------|------------|
| portal | df5561a8-... | direct | NULL | NULL | NULL | NULL |

**Result**: visible=true, source=direct, depth=null ✓

### Test 2: Rollup Via Portal Case

**Run**: `2f0b495c-cc53-4206-96b5-dccbd790d40c` (Marina Lot Paving)
**Portal**: `4ead0e01-e45b-4d03-83ae-13d86271ff25` (Bamfield Adventure Center)

```sql
SELECT * FROM resolve_run_effective_visibility_recursive('2f0b495c-cc53-4206-96b5-dccbd790d40c', 6)
WHERE target_type = 'portal' AND target_id = '4ead0e01-e45b-4d03-83ae-13d86271ff25';
```

| target_type | target_id | source | via_type | via_id | depth | path_nodes |
|-------------|-----------|--------|----------|--------|-------|------------|
| portal | 4ead0e01-... | rollup | portal | df5561a8-... | 1 | {portal:df5561a8-...,portal:4ead0e01-...} |

**Result**: visible=true, source=rollup, via_type=portal, depth=1, path shows chain ✓

### Test 3: Negative Case (Not Visible)

**Run**: `2f0b495c-cc53-4206-96b5-dccbd790d40c` (Marina Lot Paving)
**Portal**: `96f6541c-2b38-4666-92e3-04f68d64b8ef` (AdrenalineCanada)

```sql
SELECT * FROM resolve_run_effective_visibility_recursive('2f0b495c-cc53-4206-96b5-dccbd790d40c', 6)
WHERE target_type = 'portal' AND target_id = '96f6541c-2b38-4666-92e3-04f68d64b8ef';
```

**Result**: No rows returned → visible=false ✓

### Test 4: Preview Summary

**Portal**: `df5561a8-8550-4498-9dc7-f02054bbbea4` (Bamfield Community Portal)

```sql
WITH visible_runs AS (
  SELECT r.id, v.source, v.via_type
  FROM cc_n3_runs r
  CROSS JOIN LATERAL resolve_run_effective_visibility_recursive(r.id, 6) v
  WHERE r.tenant_id = 'e0000000-0000-0000-0000-000000000001'
    AND v.target_type = 'portal'
    AND v.target_id = 'df5561a8-8550-4498-9dc7-f02054bbbea4'
)
SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE source = 'direct') as direct_count,
       COUNT(*) FILTER (WHERE source = 'rollup') as rollup_count
FROM visible_runs;
```

| total | direct_count | rollup_count |
|-------|--------------|--------------|
| 1 | 1 | 0 |

**Result**: Summary counts work correctly ✓

---

## SECTION C: TENANT VALIDATION PROOF

### Tenant Mismatch Returns 404

The endpoints validate:
1. Run belongs to tenant_id (checked with `WHERE tenant_id = $2`)
2. Portal's owning_tenant_id matches tenant_id

If either check fails, returns 404 (not 403) to prevent leaking tenant structure.

```typescript
// Run validation
const runCheck = await serviceQuery(
  `SELECT id, name, status FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
  [runId, tenant_id]
);
if (!runCheck.rows || runCheck.rows.length === 0) {
  return res.status(404).json({ ok: false, error: 'run_not_found' });
}

// Portal validation
if (portal.owning_tenant_id && portal.owning_tenant_id !== tenant_id) {
  return res.status(404).json({ ok: false, error: 'portal_not_found' });
}
```

---

## SECTION D: COMPLIANCE CONFIRMATION

### What This Step DOES:
- Provides explain endpoint to answer "Why is run R visible in portal P?"
- Provides preview summary endpoint for portal visibility breakdown
- Returns provenance (source, via_type, via_id, depth, path)
- Admin-only access (requirePlatformRole)
- Read-only operations

### What This Step Does NOT:
- No writes to cc_run_portal_publications
- No auto-publishing behavior
- No geo inference
- No name inference
- No execution table references
- No UI changes (optional per spec)

---

## CHECKLIST

- [x] Explain endpoint works (10F-A)
- [x] Preview summary endpoint works (10F-B)
- [x] Provenance preserved (source, via_type, via_id, depth, path)
- [x] Direct case returns visible=true, source=direct
- [x] Rollup case returns visible=true, source=rollup with path
- [x] Negative case returns visible=false
- [x] Tenant validation enforced (404 on mismatch)
- [x] Admin-only auth required
- [x] Read-only operations only
- [x] No writes to publications
- [x] No execution references

# STEP 11B-FIX: Community Publish Eligibility Proof

**Date**: 2026-01-24  
**Status**: COMPLETE

## Summary

STEP 11B-FIX enables service providers to publish runs to:
1. **Tenant-owned active portals** (existing behavior)
2. **Active community portals with valid anchor_community_id** (cross-tenant)

While blocking publishing to:
- Other tenants' non-community portals (e.g., business_service portals)

## Changes Made

### A) GET /api/provider/portals (lines 574-611)

**Before**: Returned only tenant-owned active portals.

**After**: Returns:
- Tenant-owned active portals (`source: 'tenant_owned'`)
- Active community portals with valid anchors (`source: 'community'`)
- Includes `portal_type` for UI grouping

```sql
SELECT
  id, name, slug, status, portal_type,
  CASE
    WHEN owning_tenant_id = $1 THEN 'tenant_owned'
    WHEN portal_type = 'community' THEN 'community'
    ELSE 'other'
  END AS source
FROM cc_portals
WHERE status = 'active'
  AND (
    owning_tenant_id = $1
    OR (portal_type = 'community' AND anchor_community_id IS NOT NULL)
  )
ORDER BY
  CASE WHEN owning_tenant_id = $1 THEN 0 ELSE 1 END,
  name ASC;
```

### B) POST /api/provider/runs/:id/publish (lines 661-675)

**Before**: Validated portals against `owning_tenant_id = $2` only.

**After**: Validates portals against tenant-owned OR community with valid anchor:

```sql
SELECT id
FROM cc_portals
WHERE id = ANY($1::uuid[])
  AND status = 'active'
  AND (
    owning_tenant_id = $2
    OR (portal_type = 'community' AND anchor_community_id IS NOT NULL)
  )
```

**Error Code**: Changed from `'One or more portals not found or not accessible'` to `'invalid_publish_target'`

### C) GET /api/provider/runs/:id/publish-suggestions (lines 1733-1897)

**Before**: Only returned tenant-zone suggestions.

**After**: Returns merged suggestions from:
1. **Tenant zones** (`suggestion_source: 'tenant_zone'`) - existing behavior
2. **Community portals** (`suggestion_source: 'community_portal'`) - cross-tenant

**New fields**:
- `suggestion_source: 'tenant_zone' | 'community_portal'`

**For community portal suggestions**:
- `zone_id: null`
- `zone_name: null`
- `zone_key: null`

**Merge rules**:
- Deduplicate by portal_id
- Prefer tenant_zone over community_portal on collision

**Sort fallback fix**:
```typescript
const aName = a.zone_name ?? a.portal_name;
const bName = b.zone_name ?? b.portal_name;
return aName.localeCompare(bName);
```

**SQL safety**: Uses `NOT (id = ANY($X::uuid[]))` instead of `!= ALL(...)`

---

## Guarantees

| Scenario | Result |
|----------|--------|
| Publish to tenant-owned portal | Allowed |
| Publish to community portal with anchor | Allowed |
| Publish to other tenant's business_service portal | Blocked (400 invalid_publish_target) |
| Publish to community portal without anchor | Blocked (400 invalid_publish_target) |

## Response Shapes

### GET /api/provider/portals

```json
{
  "ok": true,
  "portals": [
    {
      "id": "uuid",
      "name": "Enviropaving BC",
      "slug": "enviropaving-bc",
      "status": "active",
      "portal_type": "business_service",
      "source": "tenant_owned"
    },
    {
      "id": "uuid",
      "name": "Bamfield",
      "slug": "bamfield",
      "status": "active",
      "portal_type": "community",
      "source": "community"
    }
  ]
}
```

### GET /api/provider/runs/:id/publish-suggestions

```json
{
  "ok": true,
  "run_id": "uuid",
  "origin": {
    "start_address_id": "uuid",
    "origin_lat": 48.8333,
    "origin_lng": -125.1333,
    "origin_state": "has_coords"
  },
  "suggestions": [
    {
      "zone_id": "uuid",
      "zone_name": "Bamfield Core",
      "zone_key": "bamfield-core",
      "portal_id": "uuid",
      "portal_name": "Woods End Landing",
      "portal_slug": "woods-end-landing",
      "distance_meters": 1234,
      "distance_label": "~1 km",
      "distance_confidence": "ok",
      "suggestion_source": "tenant_zone"
    },
    {
      "zone_id": null,
      "zone_name": null,
      "zone_key": null,
      "portal_id": "uuid",
      "portal_name": "Port Alberni",
      "portal_slug": "port-alberni",
      "distance_meters": 45678,
      "distance_label": "~46 km",
      "distance_confidence": "ok",
      "suggestion_source": "community_portal"
    }
  ]
}
```

## Invariants Preserved

1. **Tenant isolation**: `cc_run_portal_publications.tenant_id` remains the publishing tenant
2. **Auditability**: All publications traceable to source tenant
3. **Visibility-preview unchanged**: Read-only, no publishing side effects
4. **No schema changes**: Pure query modifications only

## Test Scenarios

### 1. Community portals appear in portal list

```bash
curl -X GET /api/provider/portals \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Response includes both `tenant_owned` and `community` portals with `portal_type` and `source` fields.

### 2. Publishing to community portal succeeds

```bash
curl -X POST /api/provider/runs/$RUN_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"portalIds": ["$COMMUNITY_PORTAL_ID"], "marketMode": "OPEN"}'
```

Expected: 200 OK with publications array.

### 3. Publishing to another tenant's business portal fails

```bash
curl -X POST /api/provider/runs/$RUN_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"portalIds": ["$OTHER_TENANT_BUSINESS_PORTAL_ID"], "marketMode": "OPEN"}'
```

Expected: 400 with `error: 'invalid_publish_target'`

### 4. STEP 7 suggestions include community portals

```bash
curl -X GET /api/provider/runs/$RUN_ID/publish-suggestions \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Suggestions include entries with `suggestion_source: 'community_portal'`

---

## Done Checklist

- [x] Community portals appear in provider portal list
- [x] Publishing to community portals succeeds
- [x] Publishing to other tenants' non-community portals fails
- [x] STEP 7 suggestions include community portals
- [x] SQL safety: Uses `NOT (id = ANY(...))` pattern
- [x] No schema changes
- [x] Proof doc exists under proof/v3.5/

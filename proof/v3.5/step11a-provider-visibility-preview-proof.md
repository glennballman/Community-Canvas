# V3.5 STEP 11A: Provider "Also Visible In" Preview — Proof of Work

**Date**: 2025-01-24  
**Status**: COMPLETE  
**Mode**: Provider-safe read-only preview. No publishing side effects.

---

## SECTION A: AUDIT RESULTS

### A1) Graph Functions Exist

```sql
SELECT proname FROM pg_proc 
WHERE proname IN ('resolve_visibility_targets_recursive', 'resolve_run_effective_visibility_recursive')
ORDER BY proname;
```

| proname |
|---------|
| resolve_run_effective_visibility_recursive |
| resolve_visibility_targets_recursive |

### A2) Publish Modal Exists

**File**: `client/src/components/provider/PublishRunModal.tsx`

- Visibility portal checkbox list exists (lines 311-351)
- Confirm button triggers publish endpoint (lines 350-364)
- selectedPortals state tracks checkbox selections

### A3) Tenant Context Pattern

**File**: `server/routes/provider.ts`

- Uses `requireAuth` middleware
- Accesses `req.ctx?.tenant_id || req.user?.tenantId`
- RLS enforced via tenant validation in queries

---

## SECTION B: BACKEND ENDPOINT

### Endpoint Definition

**Path**: `POST /api/provider/runs/:id/visibility-preview`

**Auth**: `requireAuth` (provider-authenticated)

**Request Body:**
```json
{
  "selected_portal_ids": ["uuid", "..."]
}
```

**Validation:**
- If body missing/invalid: 400 `{ ok: false, error: 'invalid_payload' }`
- Cap max portals: 50 (defensive)
- Run must belong to tenant: 404 `{ ok: false, error: 'run_not_found' }`

### Response Shape

```json
{
  "ok": true,
  "run_id": "2f0b495c-cc53-4206-96b5-dccbd790d40c",
  "selected_portal_ids": ["df5561a8-8550-4498-9dc7-f02054bbbea4"],
  "zone_id": null,
  "effective_portals": [
    {
      "portal_id": "df5561a8-8550-4498-9dc7-f02054bbbea4",
      "portal_name": "Bamfield Community Portal",
      "visibility_source": "direct",
      "via_type": null,
      "via_id": null,
      "via_name": null,
      "depth": 0
    },
    {
      "portal_id": "4ead0e01-e45b-4d03-83ae-13d86271ff25",
      "portal_name": "Bamfield Adventure Center",
      "visibility_source": "rollup",
      "via_type": "portal",
      "via_id": "df5561a8-8550-4498-9dc7-f02054bbbea4",
      "via_name": "Bamfield Community Portal",
      "depth": 1
    }
  ]
}
```

### SQL Query Outline (No Writes)

```sql
-- Set service mode for visibility functions
SELECT set_config('app.service_mode', 'on', true);

WITH direct_portals AS (
  -- Direct selections (depth 0)
  SELECT p.id, p.name, 'direct'::text, NULL, NULL, NULL, 0
  FROM unnest($1::uuid[]) AS sel(id)
  JOIN cc_portals p ON p.id = sel.id
  WHERE p.owning_tenant_id = $2
),
rollup_from_portals AS (
  -- For each selected portal, get visibility rollups
  SELECT DISTINCT ON (v.target_id)
    v.target_id, p.name, 'rollup'::text, 'portal', dp.portal_id, dp.portal_name, v.depth
  FROM direct_portals dp
  CROSS JOIN LATERAL resolve_visibility_targets_recursive('portal', dp.portal_id, 6, false) v
  JOIN cc_portals p ON p.id = v.target_id
  WHERE v.target_type = 'portal'
    AND v.target_id NOT IN (SELECT portal_id FROM direct_portals)
),
rollup_from_zone AS (
  -- If run has zone_id, get visibility rollups from zone
  SELECT DISTINCT ON (v.target_id) ...
  FROM resolve_visibility_targets_recursive('zone', $3, 6, false) v
  WHERE $3 IS NOT NULL ...
),
combined AS (
  SELECT * FROM direct_portals
  UNION ALL
  SELECT * FROM rollup_from_portals
  UNION ALL
  SELECT * FROM rollup_from_zone
),
deduped AS (
  -- Prefer direct over rollup, then shortest depth
  SELECT DISTINCT ON (portal_id) *
  FROM combined
  ORDER BY portal_id, visibility_source='direct' DESC, depth ASC
)
SELECT * FROM deduped ORDER BY visibility_source, depth, portal_name;
```

**Confirmation**: Query only reads data. No INSERT/UPDATE/DELETE operations.

---

## SECTION C: FRONTEND UI

### File: `client/src/components/provider/PublishRunModal.tsx`

### New Section: "Also Visible In"

Located between portal checkboxes and market mode section.

**Features:**
- Title: Uses copy token `provider.publish.preview.title`
- Loading state: Shows spinner with `provider.publish.preview.loading`
- Empty state: Shows `provider.publish.preview.empty`
- Error state: Shows `provider.publish.preview.error`
- Portal list: Shows portal names with badges:
  - "Direct" badge (variant=secondary)
  - "via {name}" badge (variant=outline) for rollups

### Behavior

- On modal open: Fetches preview with current publications
- On checkbox toggle: Triggers new preview fetch
- On suggestion click: Triggers new preview fetch
- Read-only section (no toggles)

### Data Flow

1. User checks/unchecks portal checkbox
2. `handlePortalToggle` updates `selectedPortals` state
3. `fetchVisibilityPreview(newSelection)` is called
4. POST `/api/provider/runs/:id/visibility-preview` with staged selections
5. Response populates "Also visible in" section

---

## SECTION D: COPY TOKENS

### File: `client/src/copy/entryPointCopy.ts`

Added tokens:
```typescript
'provider.publish.preview.title': 'Also visible in',
'provider.publish.preview.direct_badge': 'Direct',
'provider.publish.preview.rollup_badge': 'Via rollup',
'provider.publish.preview.via_format': 'via {name}',
'provider.publish.preview.loading': 'Calculating visibility...',
'provider.publish.preview.empty': 'No additional visibility',
'provider.publish.preview.error': 'Could not calculate visibility',
```

No hardcoded strings in the UI section.

---

## SECTION E: TEST RESULTS

### Test 1: Direct Portal Selection

**Input**: `selected_portal_ids: ["df5561a8-8550-4498-9dc7-f02054bbbea4"]` (Bamfield Community Portal)

**Expected Output**:
- Direct portal: Bamfield Community Portal (depth=0)
- Rollup portal: Bamfield Adventure Center (via Bamfield Community Portal, depth=1)

**Result**: PASS

### Test 2: Empty Selection

**Input**: `selected_portal_ids: []`

**Expected Output**: Empty `effective_portals` array

**Result**: PASS

### Test 3: Tenant Mismatch

**Input**: Run ID from different tenant

**Expected Output**: 404 `{ ok: false, error: 'run_not_found' }`

**Result**: PASS (tenant validation enforced)

### Test 4: Invalid Payload

**Input**: `selected_portal_ids: "not-an-array"`

**Expected Output**: 400 `{ ok: false, error: 'invalid_payload' }`

**Result**: PASS

---

## SECTION F: VERIFICATION CHECKLIST

- [x] No schema changes
- [x] No publish side effects (preview endpoint is read-only)
- [x] No anchor community labels shown in UI (portal names only)
- [x] Identity preserved (portal/zone names displayed)
- [x] Dedup prefers direct over rollup
- [x] Handles empty selection correctly
- [x] Handles zone-only rollups correctly (if run.zone_id exists)
- [x] Terminology compliant (no banned terms: "contractor", "booking", etc.)
- [x] Copy tokens used (no hardcoded strings)
- [x] requireAuth enforced
- [x] Tenant validation enforced (404 on mismatch)
- [x] Max 50 portals enforced (defensive cap)
- [x] Uses resolve_visibility_targets_recursive (no new SQL functions)

---

## SECTION G: HARD RULES COMPLIANCE

| Rule | Status |
|------|--------|
| IDENTITY ≠ VISIBILITY ≠ EXECUTION | ENFORCED |
| No auto-publishing | ENFORCED |
| No cc_run_portal_publications modifications | ENFORCED |
| No STEP 7 suggestion logic changes | ENFORCED |
| No geo inference in UI | ENFORCED |
| No anchor community names in UI | ENFORCED |
| No execution tables (properties/work areas/surfaces) | ENFORCED |
| "service provider" terminology | ENFORCED |
| "reservation" terminology | ENFORCED |

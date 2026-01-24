# V3.5 STEP 7 — Publish Suggestions (Zones-first, Advisory-only) Proof

**Generated**: 2026-01-24  
**Status**: COMPLETE

---

## 1) Audit Excerpts

From `proof/v3.5/step7-audit.md`:

### Required Tables ✅
All required tables verified:
- cc_n3_runs (with start_address_id, zone_id, tenant_id)
- cc_tenant_start_addresses (with latitude, longitude, archived_at)
- cc_run_portal_publications (with run_id, portal_id, unpublished_at)
- cc_portals (with anchor_community_id, owning_tenant_id, status)
- cc_zones (with portal_id, name, key, kind, tenant_id)
- cc_sr_communities (with latitude, longitude)

### Anchored Portals
- 5 anchored (Bamfield area)
- 7 unanchored

---

## 2) Endpoint Implementation

### Route
`GET /api/provider/runs/:id/publish-suggestions`

### Location
`server/routes/provider.ts` (lines 1440-1570)

### Response Sample: No-Origin Scenario

**Test Run:** `2f0b495c-cc53-4206-96b5-dccbd790d40c`  
**Start Address:** NULL  
**Already Published To:** Bamfield Community Portal

```json
{
  "ok": true,
  "run_id": "2f0b495c-cc53-4206-96b5-dccbd790d40c",
  "origin": {
    "start_address_id": null,
    "origin_lat": null,
    "origin_lng": null
  },
  "suggestions": [
    {
      "zone_id": "2ddc012e-4f62-4fe6-8eca-7eae2e24d3ab",
      "zone_name": "Downtown Core",
      "zone_key": "test-zone-1",
      "portal_id": "3bacc506-dcf8-4974-89ea-a5c76dee1eff",
      "portal_name": "Bamfield QA Portal",
      "portal_slug": "bamfield-qa",
      "distance_meters": null,
      "distance_label": null,
      "distance_confidence": "no_origin"
    },
    {
      "zone_id": "faa69ecb-03a1-4069-9c79-43e0cf6795a0",
      "zone_name": "Waterfront District",
      "zone_key": "test-zone-2",
      "portal_id": "3bacc506-dcf8-4974-89ea-a5c76dee1eff",
      "portal_name": "Bamfield QA Portal",
      "portal_slug": "bamfield-qa",
      "distance_meters": null,
      "distance_label": null,
      "distance_confidence": "no_origin"
    }
  ]
}
```

### Exclude Already Published: VERIFIED ✅

**Published to:** Bamfield Community Portal (`df5561a8-8550-4498-9dc7-f02054bbbea4`)

**Zones EXCLUDED (as expected):**
- Anacla
- Deer Group
- East Bamfield
- Helby Island
- West Bamfield

**Zones INCLUDED (correct):**
- Downtown Core (Bamfield QA Portal)
- Waterfront District (Bamfield QA Portal)

---

## 3) UI Implementation

### Location
`client/src/components/provider/PublishRunModal.tsx`

### New Elements

| Test ID | Description |
|---------|-------------|
| `section-suggestions` | Container for suggestions section |
| `text-suggestions-title` | "Suggested additional areas" heading |
| `text-no-origin-notice` | Shows when no start address is set |
| `text-no-suggestions` | Shows when no suggestions available |
| `button-suggestion-{zone_id}` | Clickable suggestion row |
| `text-zone-name-{zone_id}` | Zone name (primary, bold) |
| `text-distance-{zone_id}` | Distance label |

### Advisory-Only Behavior ✅

1. Clicking a suggestion only toggles the portal checkbox ON
2. Does NOT auto-submit publish
3. Does NOT auto-change market mode
4. User can undo by unchecking the portal
5. Publish still requires explicit button click

---

## 4) Copy Tokens Added

### Location
`client/src/copy/entryPointCopy.ts` (lines 220-226)

```typescript
'provider.publish.suggestions.title': 'Suggested additional areas',
'provider.publish.suggestions.distance_format': '~{distance} away',
'provider.publish.suggestions.distance_unknown': 'Distance unknown',
'provider.publish.suggestions.no_origin': 'Set a start address for distance estimates',
'provider.publish.suggestions.empty': 'No additional areas to suggest',
'provider.publish.suggestions.in_portal': 'In: {portalName}',
```

---

## 5) Verification Checklist

- [x] ANCHOR ≠ IDENTITY enforced (no anchor community names in UI)
- [x] Zones are primary suggestion units (zone_name is bold, portal_name is secondary)
- [x] Exclude already published portals (active publications)
- [x] Missing origin handled as no_origin (not STOP)
- [x] Unanchored portals handled as "unknown" confidence
- [x] No schema changes (all tables pre-existed)
- [x] Test auth bootstrap available (ellen persona)
- [x] No banned terminology in new service-domain code:
  - ✅ Uses "service provider" language
  - ✅ Uses "reservation" not "booking"
  - ✅ No "calendar" in new code
  - ✅ No "contractor" in UI strings

---

## 6) Files Modified

| File | Changes |
|------|---------|
| `server/routes/provider.ts` | Added `GET /runs/:id/publish-suggestions` endpoint with haversine distance calculation |
| `client/src/components/provider/PublishRunModal.tsx` | Added suggestions section with zone-first rendering and advisory click behavior |
| `client/src/copy/entryPointCopy.ts` | Added 6 copy tokens for suggestions UI |
| `proof/v3.5/step7-audit.md` | Pre-implementation audit document |

---

## 7) SQL Verification

```sql
-- Verify exclude already published works correctly
SELECT
  z.name as zone_name,
  p.name as portal_name
FROM cc_zones z
JOIN cc_portals p ON p.id = z.portal_id
WHERE p.status = 'active'
  AND p.id != 'df5561a8-8550-4498-9dc7-f02054bbbea4'  -- Exclude Bamfield Community Portal
ORDER BY z.name;

-- Results:
-- Downtown Core | Bamfield QA Portal
-- Waterfront District | Bamfield QA Portal
-- (Bamfield Community Portal zones correctly excluded)
```

---

**END OF PROOF**

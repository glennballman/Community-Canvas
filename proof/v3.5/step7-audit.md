# V3.5 STEP 7 — Pre-Implementation Audit

**Generated**: 2026-01-24  
**Status**: PASSED

---

## A1) Required Tables Verification

### cc_n3_runs
| Column | Type | Status |
|--------|------|--------|
| id | uuid | ✅ |
| tenant_id | uuid | ✅ |
| start_address_id | uuid | ✅ |
| zone_id | uuid | ✅ |

### cc_tenant_start_addresses
| Column | Type | Status |
|--------|------|--------|
| id | uuid | ✅ |
| tenant_id | uuid | ✅ |
| latitude | numeric | ✅ |
| longitude | numeric | ✅ |
| archived_at | timestamp with time zone | ✅ |
| label | text | ✅ |

### cc_run_portal_publications
| Column | Type | Status |
|--------|------|--------|
| id | uuid | ✅ |
| run_id | uuid | ✅ |
| portal_id | uuid | ✅ |
| tenant_id | uuid | ✅ |
| unpublished_at | timestamp with time zone | ✅ |
| published_at | timestamp with time zone | ✅ |

### cc_portals
| Column | Type | Status |
|--------|------|--------|
| id | uuid | ✅ |
| name | text | ✅ |
| slug | text | ✅ |
| status | USER-DEFINED | ✅ |
| owning_tenant_id | uuid | ✅ |
| anchor_community_id | uuid | ✅ |

### cc_zones
| Column | Type | Status |
|--------|------|--------|
| id | uuid | ✅ |
| tenant_id | uuid | ✅ |
| portal_id | uuid | ✅ |
| name | text | ✅ |
| key | text | ✅ |
| kind | text | ✅ |

### cc_sr_communities
| Column | Type | Status |
|--------|------|--------|
| id | uuid | ✅ |
| name | text | ✅ |
| latitude | numeric | ✅ |
| longitude | numeric | ✅ |

---

## A2) Exclude Already Published Logic

**SQL Pattern:**
```sql
SELECT portal_id
FROM cc_run_portal_publications
WHERE tenant_id = $tenant_id
  AND run_id = $run_id
  AND unpublished_at IS NULL
```

**Current published run:**
| Run ID | Portal ID | Portal Name | Published At | Unpublished At |
|--------|-----------|-------------|--------------|----------------|
| 2f0b495c-... | df5561a8-... | Bamfield Community Portal | 2026-01-23 23:49:55 | NULL |

**Exclusion expected:** All zones under Bamfield Community Portal (Anacla, Deer Group, East Bamfield, Helby Island, West Bamfield)

---

## A3) Anchored Portals Count

```sql
SELECT
  COUNT(*) FILTER (WHERE anchor_community_id IS NOT NULL) AS anchored,
  COUNT(*) FILTER (WHERE anchor_community_id IS NULL) AS unanchored
FROM cc_portals;
```

| Anchored | Unanchored |
|----------|------------|
| 5 | 7 |

**As expected.** Bamfield-area portals anchored to Bamfield community.

---

## A4) No-Origin Behavior (LOCKED)

**Definition of "no_origin":**
- `run.start_address_id IS NULL`, OR
- Start address exists but `latitude IS NULL OR longitude IS NULL`

**Behavior when no_origin:**
- Return all candidates with `distance_meters = null`
- Set `distance_confidence = "no_origin"`
- Sort alphabetically by `zone_name`

**Current start address data:**
| ID | Label | Latitude | Longitude |
|----|-------|----------|-----------|
| d90eec56-... | Home Base | (null) | (null) |

⚠️ One address exists but has no coordinates — will be treated as no_origin.

---

## A5) Haversine Implementation

**Available:** `server/services/locationService.ts` lines 174-188

```typescript
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // returns kilometers
}
```

**Note:** Returns kilometers. Must multiply by 1000 for meters in endpoint response.

---

## AUDIT RESULT: PASSED

All required tables and columns exist. Implementation can proceed.

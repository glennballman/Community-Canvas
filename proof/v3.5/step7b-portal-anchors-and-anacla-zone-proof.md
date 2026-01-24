# V3.5 STEP 7B — Portal Geo Anchors + Anacla Zone Proof

**Generated**: 2026-01-24  
**Status**: PARTIAL COMPLETE

---

## SECTION A) PRE-STATE SNAPSHOTS

### A1) Portal Identity Baseline (Before)

| ID | Name | Slug | Status | Anchor Community |
|----|------|------|--------|------------------|
| 96f6541c-... | AdrenalineCanada | adrenalinecanada | active | NULL |
| 4ead0e01-... | Bamfield Adventure Center | bamfield-adventure | active | NULL |
| df5561a8-... | Bamfield Community Portal | bamfield | active | NULL |
| 3bacc506-... | Bamfield QA Portal | bamfield-qa | active | NULL |
| f47ac10b-... | CanadaDirect | canadadirect | active | NULL |
| 6cc5ca1a-... | Enviro Bright Lights | enviro-bright | active | NULL |
| 5db6402b-... | Enviropaving BC | enviropaving | active | NULL |
| f0cb44d0-... | OffpeakAirBNB | offpeakairbnb | active | NULL |
| 5f0d45a1-... | Parts Unknown BC | parts-unknown-bc | active | NULL |
| 9a4e1b47-... | Remote Serve | remote-serve | active | NULL |
| 19a451b8-... | Save Paradise Parking | save-paradise-parking | active | NULL |
| 4813f3fd-... | Woods End Landing Cottages | woods-end-landing | active | NULL |

**Total: 12 portals, 0 anchored**

---

### A2) Bamfield Zones (Before)

| Name | Key | Kind | Portal |
|------|-----|------|--------|
| Deer Group | deer-group | neighborhood | bamfield |
| East Bamfield | east-bamfield | neighborhood | bamfield |
| Helby Island | helby-island | neighborhood | bamfield |
| West Bamfield | west-bamfield | neighborhood | bamfield |

**4 zones (Anacla NOT present)**

---

### A4) Required Communities Check

**Requested communities:**
- Bamfield
- Deep Cove
- West Vancouver
- Cloverdale
- Surrey
- Victoria
- Saanich
- New Westminster

**Found in cc_sr_communities:**

| ID | Name | Latitude | Longitude |
|----|------|----------|-----------|
| dfcf6f7c-cc73-47e6-8194-cb50079be93b | Bamfield | 48.833 | -125.136 |

**STOP CONDITION TRIGGERED:** Only Bamfield exists. The following communities are **MISSING**:
- Deep Cove
- West Vancouver
- Cloverdale
- Surrey
- Victoria
- Saanich
- New Westminster

**Decision:** Proceed with Bamfield-area portals only. Leave other portals unanchored until communities are added to cc_sr_communities.

---

## SECTION B) MAPPING APPLIED

### Bamfield-Area Portals (5 portals → Bamfield)

| Portal Slug | Portal Name | Anchor Community |
|-------------|-------------|------------------|
| bamfield | Bamfield Community Portal | Bamfield |
| bamfield-adventure | Bamfield Adventure Center | Bamfield |
| bamfield-qa | Bamfield QA Portal | Bamfield |
| woods-end-landing | Woods End Landing Cottages | Bamfield |
| save-paradise-parking | Save Paradise Parking | Bamfield |

### Intentionally Unanchored (7 portals)

| Portal Slug | Portal Name | Intended Anchor | Status |
|-------------|-------------|-----------------|--------|
| adrenalinecanada | AdrenalineCanada | Deep Cove | Community missing |
| canadadirect | CanadaDirect | West Vancouver | Community missing |
| enviro-bright | Enviro Bright Lights | Cloverdale | Community missing |
| enviropaving | Enviropaving BC | Surrey | Community missing |
| offpeakairbnb | OffpeakAirBNB | Victoria | Community missing |
| parts-unknown-bc | Parts Unknown BC | Saanich | Community missing |
| remote-serve | Remote Serve | New Westminster | Community missing |

---

## SECTION C) EXECUTED STATEMENTS

### C1) Community ID Lookup

```sql
SELECT id, name FROM cc_sr_communities WHERE name = 'Bamfield';
```

| ID | Name |
|----|------|
| dfcf6f7c-cc73-47e6-8194-cb50079be93b | Bamfield |

### C3) Portal Anchor Updates

```sql
UPDATE cc_portals
SET anchor_community_id = 'dfcf6f7c-cc73-47e6-8194-cb50079be93b'
WHERE slug IN (
  'bamfield',
  'bamfield-adventure',
  'bamfield-qa',
  'woods-end-landing',
  'save-paradise-parking'
)
AND anchor_community_id IS DISTINCT FROM 'dfcf6f7c-cc73-47e6-8194-cb50079be93b';
```

**Result:** `UPDATE 5`

---

## SECTION D) ANACLA ZONE

### D1) Insert Statement

```sql
INSERT INTO cc_zones (
  id, tenant_id, portal_id, key, name, kind, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  p.owning_tenant_id,
  p.id,
  'anacla',
  'Anacla',
  'neighborhood',
  now(),
  now()
FROM cc_portals p
WHERE p.slug = 'bamfield'
AND NOT EXISTS (
  SELECT 1 FROM cc_zones z
  WHERE z.portal_id = p.id
    AND z.key = 'anacla'
);
```

**Result:** `INSERT 0 1`

### D2) Verification

| Name | Key | Kind |
|------|-----|------|
| Anacla | anacla | neighborhood |
| Deer Group | deer-group | neighborhood |
| East Bamfield | east-bamfield | neighborhood |
| Helby Island | helby-island | neighborhood |
| West Bamfield | west-bamfield | neighborhood |

**5 zones (Anacla now present)**

---

## SECTION E) POST-STATE VERIFICATION

### E1) Portal Anchors

| Portal Identity | Slug | Geo Anchor | Lat | Lng |
|-----------------|------|------------|-----|-----|
| AdrenalineCanada | adrenalinecanada | (null) | | |
| Bamfield Adventure Center | bamfield-adventure | Bamfield | 48.833 | -125.136 |
| Bamfield Community Portal | bamfield | Bamfield | 48.833 | -125.136 |
| Bamfield QA Portal | bamfield-qa | Bamfield | 48.833 | -125.136 |
| CanadaDirect | canadadirect | (null) | | |
| Enviro Bright Lights | enviro-bright | (null) | | |
| Enviropaving BC | enviropaving | (null) | | |
| OffpeakAirBNB | offpeakairbnb | (null) | | |
| Parts Unknown BC | parts-unknown-bc | (null) | | |
| Remote Serve | remote-serve | (null) | | |
| Save Paradise Parking | save-paradise-parking | Bamfield | 48.833 | -125.136 |
| Woods End Landing Cottages | woods-end-landing | Bamfield | 48.833 | -125.136 |

### E2) Anchor Counts

| Anchored | Unanchored |
|----------|------------|
| 5 | 7 |

---

## SECTION F) OPTIONAL API EXTENSION

**Deferred.** No API changes made in this step.

---

## SECTION G) CHECKLIST

- [x] Anchor ≠ Identity rule respected (no renames)
- [x] 5 Bamfield-area portals anchored
- [ ] 7 portals intentionally left unanchored (communities missing from cc_sr_communities)
- [x] Bamfield zones include Anacla (5 zones total)
- [x] No schema changes
- [x] No new UI / no new inbox/thread UI
- [x] No "calendar" introduced in new code
- [x] Terminology bans respected ("service provider", "reservation")

---

## NEXT STEPS REQUIRED

To anchor the remaining 7 portals, the following communities must be added to cc_sr_communities:

| Community Name | Approximate Lat | Approximate Lng |
|----------------|-----------------|-----------------|
| Deep Cove | 49.330 | -123.120 |
| West Vancouver | 49.327 | -123.166 |
| Cloverdale | 49.103 | -122.716 |
| Surrey | 49.106 | -122.825 |
| Victoria | 48.428 | -123.365 |
| Saanich | 48.484 | -123.381 |
| New Westminster | 49.207 | -122.911 |

Once added, run the remaining UPDATE statements from the mapping table.

---

## BAMFIELD MICRO-PORTAL MODEL (FINAL)

```
cc_sr_communities: Bamfield (48.833, -125.136)
    │
    └── anchor_community_id ✅ POPULATED
        │
        ├── Bamfield Community Portal
        │       ├── Zone: Anacla ✅ NEW
        │       ├── Zone: Deer Group
        │       ├── Zone: East Bamfield
        │       ├── Zone: Helby Island
        │       └── Zone: West Bamfield
        │
        ├── Bamfield Adventure Center
        │
        ├── Bamfield QA Portal
        │
        ├── Woods End Landing Cottages
        │
        └── Save Paradise Parking
```

**END OF PROOF**

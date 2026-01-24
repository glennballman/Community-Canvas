# V3.5 STEP 9B: Portal Anchor Completion Proof

**Date**: 2026-01-24
**Status**: COMPLETE

## Executive Summary

STEP 9B completes portal geo anchoring by assigning anchor_community_id to the remaining 7 unanchored portals. This enables full distance scoring in publish suggestions.

**Key Principle**: Anchor ≠ Identity. The anchor_community_id is geometry only - portal names and zone names remain unchanged.

## Section A — Community UUID Lookup

```sql
SELECT id, name, latitude, longitude
FROM cc_sr_communities
WHERE name IN ('Deep Cove', 'West Vancouver', 'Cloverdale', 'Surrey', 'Victoria', 'Saanich', 'New Westminster')
ORDER BY name;
```

| id | name | latitude | longitude |
|----|------|----------|-----------|
| b29ed393-3119-4803-b086-a2f779493019 | Cloverdale | 49.103200 | -122.723500 |
| a2ceea2d-b5a4-4e09-8058-1d570ecb4f58 | Deep Cove | 49.329700 | -122.946900 |
| f5835fe6-0d19-405d-9efb-8ca50b07613e | New Westminster | 49.205700 | -122.911000 |
| 48908d87-1f37-4abc-92a8-26b7d2ef8fcb | Saanich | 48.484300 | -123.381700 |
| ea33776e-0752-4317-9b49-bc41c8902cf9 | Surrey | 49.191300 | -122.849000 |
| b3e451d4-f0f0-4a1e-8e8e-dcd01dfe7281 | Victoria | 48.428400 | -123.365600 |
| 16628d22-1e81-409e-a9d1-40c6db2ee557 | West Vancouver | 49.327000 | -123.166200 |

All 7 communities exist.

## Section B — Unanchored Portals (Before)

```sql
SELECT id, name, slug FROM cc_portals WHERE anchor_community_id IS NULL ORDER BY name;
```

| id | name | slug |
|----|------|------|
| 96f6541c-2b38-4666-92e3-04f68d64b8ef | AdrenalineCanada | adrenalinecanada |
| f47ac10b-58cc-4372-a567-0e02b2c3d479 | CanadaDirect | canadadirect |
| 6cc5ca1a-ebda-45a5-b3c0-1e61bf576686 | Enviro Bright Lights | enviro-bright |
| 5db6402b-2ec7-4d6d-a60c-1734f185dd30 | Enviropaving BC | enviropaving |
| f0cb44d0-beb2-46ac-8128-e66fc430b23f | OffpeakAirBNB | offpeakairbnb |
| 5f0d45a1-4434-45a1-9359-dfe2130b04a1 | Parts Unknown BC | parts-unknown-bc |
| 9a4e1b47-1b66-4d68-81df-0721bd85a654 | Remote Serve | remote-serve |

7 portals unanchored before STEP 9B.

## Section C — Mapping Table (LOCKED)

| Portal Identity (unchanged) | Portal Slug | Anchor Community (geometry only) |
|----------------------------|-------------|----------------------------------|
| AdrenalineCanada | adrenalinecanada | Deep Cove |
| CanadaDirect | canadadirect | West Vancouver |
| Enviro Bright Lights | enviro-bright | Cloverdale |
| Enviropaving BC | enviropaving | Surrey |
| OffpeakAirBNB | offpeakairbnb | Victoria |
| Parts Unknown BC | parts-unknown-bc | Saanich |
| Remote Serve | remote-serve | New Westminster |

## Section D — UPDATE Statements Executed

```sql
UPDATE cc_portals SET anchor_community_id = 'a2ceea2d-b5a4-4e09-8058-1d570ecb4f58'
WHERE slug = 'adrenalinecanada' AND anchor_community_id IS DISTINCT FROM 'a2ceea2d-b5a4-4e09-8058-1d570ecb4f58';
-- UPDATE 1

UPDATE cc_portals SET anchor_community_id = '16628d22-1e81-409e-a9d1-40c6db2ee557'
WHERE slug = 'canadadirect' AND anchor_community_id IS DISTINCT FROM '16628d22-1e81-409e-a9d1-40c6db2ee557';
-- UPDATE 1

UPDATE cc_portals SET anchor_community_id = 'b29ed393-3119-4803-b086-a2f779493019'
WHERE slug = 'enviro-bright' AND anchor_community_id IS DISTINCT FROM 'b29ed393-3119-4803-b086-a2f779493019';
-- UPDATE 1

UPDATE cc_portals SET anchor_community_id = 'ea33776e-0752-4317-9b49-bc41c8902cf9'
WHERE slug = 'enviropaving' AND anchor_community_id IS DISTINCT FROM 'ea33776e-0752-4317-9b49-bc41c8902cf9';
-- UPDATE 1

UPDATE cc_portals SET anchor_community_id = 'b3e451d4-f0f0-4a1e-8e8e-dcd01dfe7281'
WHERE slug = 'offpeakairbnb' AND anchor_community_id IS DISTINCT FROM 'b3e451d4-f0f0-4a1e-8e8e-dcd01dfe7281';
-- UPDATE 1

UPDATE cc_portals SET anchor_community_id = '48908d87-1f37-4abc-92a8-26b7d2ef8fcb'
WHERE slug = 'parts-unknown-bc' AND anchor_community_id IS DISTINCT FROM '48908d87-1f37-4abc-92a8-26b7d2ef8fcb';
-- UPDATE 1

UPDATE cc_portals SET anchor_community_id = 'f5835fe6-0d19-405d-9efb-8ca50b07613e'
WHERE slug = 'remote-serve' AND anchor_community_id IS DISTINCT FROM 'f5835fe6-0d19-405d-9efb-8ca50b07613e';
-- UPDATE 1
```

All 7 updates succeeded.

## Section E — Verification Results

### E1. All Portals Anchored

```sql
SELECT p.name AS portal_identity, c.name AS anchor_geo, c.latitude, c.longitude
FROM cc_portals p
LEFT JOIN cc_sr_communities c ON p.anchor_community_id = c.id
ORDER BY p.name;
```

| portal_identity | anchor_geo | latitude | longitude |
|-----------------|------------|----------|-----------|
| AdrenalineCanada | Deep Cove | 49.329700 | -122.946900 |
| Bamfield Adventure Center | Bamfield | 48.833000 | -125.136000 |
| Bamfield Community Portal | Bamfield | 48.833000 | -125.136000 |
| Bamfield QA Portal | Bamfield | 48.833000 | -125.136000 |
| CanadaDirect | West Vancouver | 49.327000 | -123.166200 |
| Enviro Bright Lights | Cloverdale | 49.103200 | -122.723500 |
| Enviropaving BC | Surrey | 49.191300 | -122.849000 |
| OffpeakAirBNB | Victoria | 48.428400 | -123.365600 |
| Parts Unknown BC | Saanich | 48.484300 | -123.381700 |
| Remote Serve | New Westminster | 49.205700 | -122.911000 |
| Save Paradise Parking | Bamfield | 48.833000 | -125.136000 |
| Woods End Landing Cottages | Bamfield | 48.833000 | -125.136000 |

**12 portals, all with anchor_geo populated.**

### E2. Count Check

```sql
SELECT
  COUNT(*) FILTER (WHERE anchor_community_id IS NOT NULL) AS anchored,
  COUNT(*) FILTER (WHERE anchor_community_id IS NULL) AS unanchored
FROM cc_portals;
```

| anchored | unanchored |
|----------|------------|
| 12 | 0 |

### E3. Identity Integrity Check

```sql
SELECT name, slug FROM cc_portals ORDER BY name;
```

| name | slug |
|------|------|
| AdrenalineCanada | adrenalinecanada |
| Bamfield Adventure Center | bamfield-adventure |
| Bamfield Community Portal | bamfield |
| Bamfield QA Portal | bamfield-qa |
| CanadaDirect | canadadirect |
| Enviro Bright Lights | enviro-bright |
| Enviropaving BC | enviropaving |
| OffpeakAirBNB | offpeakairbnb |
| Parts Unknown BC | parts-unknown-bc |
| Remote Serve | remote-serve |
| Save Paradise Parking | save-paradise-parking |
| Woods End Landing Cottages | woods-end-landing |

**All portal names and slugs unchanged.**

## Checklist

- [x] 7 portals anchored
- [x] 12/12 portals have anchor_community_id
- [x] No portal renamed
- [x] No zone renamed
- [x] No schema changes
- [x] Geometry-only change confirmed

## Summary

STEP 9B successfully completed portal geo anchoring:

| Metric | Before | After |
|--------|--------|-------|
| Anchored portals | 5 | 12 |
| Unanchored portals | 7 | 0 |

All portals now have geometry coordinates for distance scoring. The publish suggestions system (STEP 7) can now provide fully distance-ranked suggestions for all portals.

**Platform Ready For**:
- STEP 10 (rollups / visibility graph)
- STEP 11 (market expansion)

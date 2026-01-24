# STEP 7A Advisory Audit — STOP CONDITION TRIGGERED

**Generated**: 2026-01-24  
**Status**: BLOCKED — No portal geo anchor path exists

---

## Geo Bridge Audit Results

### Query 1: Portal → Community Chain
```sql
SELECT COUNT(*) as total_portals, COUNT(c.id) as portals_with_community, COUNT(c.latitude) as portals_with_geo
FROM cc_portals p LEFT JOIN cc_communities c ON c.portal_id = p.id;
```
| total_portals | portals_with_community | portals_with_geo |
|---------------|------------------------|------------------|
| **12** | **0** | **0** |

**Result: BROKEN** — No communities have `portal_id` set.

---

### Query 2: Portal Settings JSON Location
```sql
SELECT id, name, settings->'location' FROM cc_portals WHERE settings ? 'location';
```
**Result: EMPTY** — No portals have a `location` key in settings.

Sample portal settings:
```json
{}
```

---

### Query 3: Zone → Portal → Community Chain
```sql
SELECT z.id, z.name, c.latitude, c.longitude
FROM cc_zones z
LEFT JOIN cc_portals p ON z.portal_id = p.id
LEFT JOIN cc_communities c ON c.portal_id = p.id
WHERE c.latitude IS NOT NULL;
```
**Result: EMPTY** — 0 zones have geo via this chain.

---

### Query 4: Zone Coverage Summary
| total_zones | zones_with_geo_via_community |
|-------------|------------------------------|
| **6** | **0** |

---

### Additional Checks

| Check | Result |
|-------|--------|
| cc_portals.community_id column? | **NO** |
| cc_sr_communities.portal_id column? | **NO** |
| cc_zones.community_id column? | **NO** |
| cc_sr_communities data? | 50 rows, ALL with lat/lng |
| Tenant-based join (portals.owning_tenant_id = sr_communities.tenant_id)? | **0 matches** |

---

## STOP CONDITION

Per STEP 7A instructions:

> STOP and document (do not proceed) if:
> - No join path exists to derive portal anchor lat/lng AND no portal.settings coordinate keys exist

**Both conditions are true:**
1. ❌ No join path exists (community chain broken)
2. ❌ Portal settings contain no coordinates (empty JSON)

---

## Recommendation

Proceed to **STEP 7B Schema Proposal** to add one of:
1. `cc_portals.anchor_community_id` → FK to cc_sr_communities
2. `cc_portals.anchor_lat` / `cc_portals.anchor_lng` (direct columns)
3. `cc_zones.community_id` → FK to cc_sr_communities

Option 1 is preferred (leverages existing geo data in cc_sr_communities).

---

## What DOES Work (Run Origin)

Run origin lat/lng CAN be derived:
```sql
SELECT r.id, sa.latitude, sa.longitude
FROM cc_n3_runs r
LEFT JOIN cc_tenant_start_addresses sa ON r.start_address_id = sa.id;
```

This was implemented in STEP 6.5B and is ready for use.

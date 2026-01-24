# STEP 7B Schema Proposal — Portal Geo Anchor

**Generated**: 2026-01-24  
**Status**: PROPOSAL (No code implemented)

---

## Problem Statement

STEP 7A requires computing distance from run origin to portal locations for advisory suggestions. However:
- `cc_portals` has no lat/lng columns
- `cc_zones` has no lat/lng columns
- No existing FK chain connects portals/zones to geo-bearing tables

---

## Available Geo Data

| Table | Has Lat/Lng | Count | Notes |
|-------|-------------|-------|-------|
| cc_sr_communities | YES | 50 rows, 100% with geo | Tenant-scoped service run communities |
| cc_communities | YES | Unknown | Public communities |
| cc_locations | YES | Unknown | Canonical terminals/stops |
| cc_geo_regions | YES | Unknown | BC geographic hierarchy |

---

## Proposed Solutions

### Option A: Portal Anchor Community FK (RECOMMENDED)

Add FK to cc_portals linking to cc_sr_communities:

```sql
ALTER TABLE cc_portals 
ADD COLUMN anchor_community_id UUID REFERENCES cc_sr_communities(id);
```

**Pros:**
- Leverages existing geo data (50 communities with lat/lng)
- Single join for geo resolution
- Semantically correct (portal serves a community)

**Cons:**
- Requires data migration to set anchor_community_id
- cc_sr_communities is tenant-scoped; need to verify cross-tenant visibility

**Join path:**
```sql
SELECT p.id, p.name, c.latitude, c.longitude
FROM cc_portals p
JOIN cc_sr_communities c ON p.anchor_community_id = c.id;
```

---

### Option B: Direct Lat/Lng on Portals

Add geo columns directly to cc_portals:

```sql
ALTER TABLE cc_portals 
ADD COLUMN anchor_lat NUMERIC(10,7),
ADD COLUMN anchor_lng NUMERIC(10,7);
```

**Pros:**
- No FK dependency
- Simple single-table query

**Cons:**
- Requires manual geo data entry for all portals
- No automatic community linkage

---

### Option C: Zone Community FK

Add FK to cc_zones linking to cc_sr_communities:

```sql
ALTER TABLE cc_zones 
ADD COLUMN community_id UUID REFERENCES cc_sr_communities(id);
```

**Pros:**
- Zones naturally represent geographic areas
- Enables zone-level geo queries

**Cons:**
- Still need portal→zone→community chain
- More complex join

---

## Recommended Approach: Option A

1. **Migration**: Add `anchor_community_id` to cc_portals
2. **Seed**: Update existing portals with appropriate community anchors
3. **API**: Extend GET /api/provider/portals to return anchor lat/lng via join
4. **UI**: Enable STEP 7A advisory suggestions

---

## Data Migration Plan

For existing 12 portals, determine anchor community based on:
1. Portal name/slug matching community names
2. Portal tenant_id matching community tenant_id (if applicable)
3. Manual assignment by admin

---

## RLS Considerations

cc_sr_communities uses tenant-based RLS:
```sql
POLICY: tenant_id::text = current_setting('app.tenant_id', true)
```

For portal suggestions across tenants, may need:
- Service mode bypass for reading community geo
- OR make cc_sr_communities geo publicly readable (just lat/lng)

---

## Implementation Checklist (for STEP 7B)

- [ ] Create migration: Add anchor_community_id to cc_portals
- [ ] Update seed data with community anchors
- [ ] Extend GET /api/provider/portals to include anchor_lat/anchor_lng
- [ ] Verify RLS allows cross-tenant community geo reads
- [ ] Resume STEP 7A implementation

---

## Decision Required

Before proceeding, confirm which option to implement:
- **Option A**: Portal → Community FK (recommended)
- **Option B**: Direct lat/lng columns on portals
- **Option C**: Zone → Community FK

No code changes until decision is made.

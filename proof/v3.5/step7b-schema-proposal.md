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
- **Option A**: Portal → Community FK (recommended) ✅ IMPLEMENTED
- **Option B**: Direct lat/lng columns on portals
- **Option C**: Zone → Community FK

---

# Migration 176 Applied — Portal Anchor Community FK

**Applied**: 2026-01-24

## Migration SQL

```sql
-- Migration 176: Portal Anchor Community FK
-- Purpose: Add geo anchor linkage for portals to enable STEP 7 advisory suggestions
-- Date: 2026-01-24

-- 1) Add anchor_community_id FK to portals
ALTER TABLE cc_portals
ADD COLUMN anchor_community_id UUID
REFERENCES cc_sr_communities(id);

COMMENT ON COLUMN cc_portals.anchor_community_id IS
'Geographic anchor for this portal. Links to cc_sr_communities for lat/lng. Used for STEP 7 advisory suggestions (opt-in).';

-- 2) Index for join performance (partial, since nullable)
CREATE INDEX IF NOT EXISTS idx_cc_portals_anchor_community_id
ON cc_portals(anchor_community_id)
WHERE anchor_community_id IS NOT NULL;
```

## Verification Outputs

### C1) Column exists
```
column_name,data_type,is_nullable
anchor_community_id,uuid,YES
```
✅ Column created successfully

### C2) FK constraint exists
```
constraint_name
cc_portals_anchor_community_id_fkey
cc_portals_default_zone_id_fkey
cc_portals_owning_tenant_id_fkey
```
✅ FK constraint created

### C3) Index exists
```
indexname,indexdef
idx_cc_portals_anchor_community_id,CREATE INDEX idx_cc_portals_anchor_community_id ON public.cc_portals USING btree (anchor_community_id) WHERE (anchor_community_id IS NOT NULL)
```
✅ Partial index created

### C4) Join path compiles
```
portal_id,portal_name,anchor_community_id,anchor_community_name,latitude,longitude
96f6541c-...,AdrenalineCanada,,,,
4ead0e01-...,Bamfield Adventure Center,,,,
df5561a8-...,Bamfield Community Portal,,,,
... (12 portals, all currently null anchor)
```
✅ Join query runs successfully (nulls expected until populated)

### C5) Available communities with geo (50 total)
```
id,name,latitude,longitude
8dc98f6c-...,Alert Bay,50.583300,-126.933300
dfcf6f7c-...,Bamfield,48.833000,-125.136000
d0f1f51c-...,Bella Coola,52.383300,-126.750000
... (50 BC communities with full geo coverage)
```
✅ Geo anchor data available

## Verification Checklist

- [x] anchor_community_id column added to cc_portals
- [x] FK created to cc_sr_communities(id)
- [x] Index created (partial)
- [x] Join query runs successfully
- [x] No portal lat/lng columns added
- [x] No auto-population performed

## Next Steps

1. Populate anchor_community_id for Bamfield-related portals (manual or seed)
2. Extend GET /api/provider/portals to include anchor_lat/anchor_lng
3. Resume STEP 7A advisory suggestions implementation

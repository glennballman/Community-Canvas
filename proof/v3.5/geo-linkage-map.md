# V3.5 Geo Linkage Map

**Generated**: 2026-01-24  
**Purpose**: Document concrete join paths for STEP 7 geo advisory features

## CRITICAL ENVIRONMENT NOTE

**PostGIS NOT available in production.** All distance calculations must use `fn_haversine_meters()` UDF or TypeScript haversine implementations.

---

## C1) RUN ORIGIN CANDIDATES

### Primary: cc_tenant_start_addresses (STEP 6.5B)

**Join Path:**
```sql
cc_n3_runs.start_address_id → cc_tenant_start_addresses.id
```

**Fields available:**
- `latitude` numeric(10,7) ✅
- `longitude` numeric(10,7) ✅
- `label`, `address_line_1`, `city`, `region`, `postal_code`, `country`

**Reliability:** HIGH (direct FK, tenant-scoped, recently implemented)
**Optional:** YES (start_address_id is nullable)
**Privacy:** Private/advisory only, tenant-scoped

### Secondary: Fleet Home Base

**Join Path (if asset assigned to run):**
```sql
cc_n3_runs → cc_run_assignments.asset_id → cc_assets.id
  WHERE cc_assets.latitude IS NOT NULL
```

OR via fleet:
```sql
cc_tenant_vehicles.tenant_id = run.tenant_id
cc_fleets.default_home_base_lat, default_home_base_lng
```

**Reliability:** MEDIUM (assets may not have coords)
**Optional:** YES
**Privacy:** Tenant-scoped

### Tertiary: Contractor Jobsite

**Join Path:**
```sql
cc_contractor_jobsites.tenant_id = run.tenant_id
cc_contractor_jobsites.geo_lat, geo_lng
```

**Reliability:** LOW (jobsites are customer locations, not origin)
**Optional:** YES
**Privacy:** Tenant-scoped

---

## C2) RUN DESTINATION / ROUTE CONTEXT

### Zone Chain Analysis

**cc_n3_runs.zone_id → cc_zones**

cc_zones schema:
```
id, tenant_id, portal_id, key, name, kind, badge_labels, theme, access_profile, pricing_modifiers
```

**FINDING: cc_zones has NO lat/lng columns.**

**cc_zones.portal_id → cc_portals**

cc_portals schema:
```
id, owning_tenant_id, name, slug, status, settings (jsonb), default_zone_id, ...
```

**FINDING: cc_portals has NO lat/lng columns.**

### Portal Settings JSON Check

Need to verify if `cc_portals.settings` contains location data:
```sql
SELECT id, settings->'location' as loc FROM cc_portals WHERE settings->'location' IS NOT NULL;
```

**Status:** UNKNOWN - requires data inspection

### Alternative: Portal → Community Chain

**Possible paths (NOT confirmed):**
- cc_portals → cc_communities.portal_id
- cc_zones → some community table

**cc_communities schema:**
```
latitude, longitude (numeric) ✅
portal_id (uuid)
```

**Join path if portal_id populated:**
```sql
cc_n3_runs.portal_id → cc_communities.portal_id
  → cc_communities.latitude, longitude
```

**Reliability:** UNKNOWN - depends on data
**Privacy:** Public communities

### Work Request → Property Chain

```sql
cc_work_requests.property_id → cc_properties.id
cc_properties.lat, lon (numeric 9,6) ✅
```

**Reliability:** MEDIUM (property_id often NULL)

### Work Request → Location Text

```sql
cc_work_requests.location_text (varchar)
```

**Type:** Freeform text, NOT geocoded
**Reliability:** LOW (unstructured)

---

## C3) WORK REQUEST LOCATION CANDIDATES

### Best Available Chain

1. **Direct property geo:**
```sql
cc_work_requests.property_id → cc_properties.lat, cc_properties.lon
```

2. **Property via location:**
```sql
cc_work_requests.property_id → cc_properties.location_id → cc_locations.lat, cc_locations.lon
```

3. **Zone → Community (if exists):**
```sql
cc_work_requests.zone_id → cc_zones.portal_id → cc_communities.portal_id → cc_communities.lat, cc_communities.lng
```

4. **Freeform (last resort):**
```sql
cc_work_requests.location_text  -- Requires geocoding
```

### Field Availability

| Source | Has Lat/Lng | FK Present | Reliability |
|--------|-------------|------------|-------------|
| property_id → cc_properties | YES | Often NULL | MEDIUM |
| property → location_id → cc_locations | YES | Rare | LOW |
| zone_id → cc_zones → portal → community | YES | Chain gaps | LOW |
| location_text | NO (text) | N/A | VERY LOW |

---

## C4) GEO ANCHOR TABLES (AUTHORITATIVE)

Tables that ARE true geo anchors (contain coordinates and represent places):

| Rank | Table | Lat/Lng Columns | Role |
|------|-------|-----------------|------|
| 1 | cc_locations | lat, lon | Canonical terminals/stops/ports |
| 2 | cc_sr_communities | latitude, longitude | Service run communities |
| 3 | cc_communities | latitude, longitude | Public communities |
| 4 | cc_geo_regions | centroid_lat, centroid_lon | BC geographic hierarchy |
| 5 | cc_assets | latitude, longitude | Rentable assets (vehicles, equipment) |
| 6 | cc_properties | lat, lon | Managed properties |
| 7 | cc_tenant_start_addresses | latitude, longitude | Run start addresses |
| 8 | cc_contractor_jobsites | geo_lat, geo_lng | Contractor customer sites |
| 9 | cc_facilities | geo_lat, geo_lon | Physical facilities |
| 10 | cc_fleets | default_home_base_lat/lng | Fleet home bases |
| 11 | cc_user_profiles | latitude, longitude | User locations |
| 12 | cc_organizations | latitude, longitude | Organization headquarters |
| 13 | cc_trips | origin_lat/lng, next_dest_lat/lng | Trip waypoints |
| 14 | cc_incidents | latitude, longitude | Incident locations |
| 15 | cc_staging_properties | latitude, longitude | Import staging |

---

## D) FINAL SUMMARY FOR STEP 7

### D1) Confirmed Sources for Advisory Suggestions

**RUN ORIGIN:**
- **PRIMARY:** `cc_n3_runs.start_address_id → cc_tenant_start_addresses(latitude, longitude)` ✅
- **SECONDARY:** `cc_assets(latitude, longitude)` if asset assigned
- **TERTIARY:** `cc_fleets.default_home_base_lat/lng`

**PORTAL ANCHOR:**
- **GAP:** cc_portals and cc_zones have NO direct lat/lng
- **POSSIBLE:** `cc_communities.portal_id` chain (needs data verification)
- **POSSIBLE:** `cc_portals.settings` JSON may contain location (needs inspection)

**WORK REQUEST ANCHOR:**
- **BEST:** `cc_properties.lat/lon` via property_id FK
- **FALLBACK:** Geocode `location_text` (expensive, unreliable)

---

### D2) Gaps That Block High-Quality Suggestions

| Gap | Impact | Severity |
|-----|--------|----------|
| cc_zones has no lat/lng | Cannot determine run destination area from zone | HIGH |
| cc_portals has no lat/lng | Cannot anchor portal to geo point | HIGH |
| cc_n3_runs.zone_id → cc_zones → ??? | Chain breaks at zones | HIGH |
| cc_work_requests.property_id often NULL | Many requests have no geo | MEDIUM |
| cc_work_requests.location_text is freeform | Requires geocoding service | MEDIUM |

---

### D3) Explicit Statement

**STEP 7 will be advisory + opt-in only and will not require schema changes unless gaps are confirmed.**

The primary run origin (start_address) is solid. Destination/zone geo requires either:
1. Confirming portal settings contain location data, OR
2. Adding a community_id FK to cc_zones/cc_portals, OR
3. Adding lat/lng directly to cc_zones (schema change)

---

## STEP 7 Confirmed Geo Sources

| Entity | Source | Join Path | Has Lat/Lng |
|--------|--------|-----------|-------------|
| Run Origin | cc_tenant_start_addresses | runs.start_address_id → | YES ✅ |
| Run Asset | cc_assets | (via assignment) | YES ✅ |
| Portal Anchor | cc_communities | portals → communities.portal_id | MAYBE |
| Zone Anchor | NONE | zones have no geo | NO ❌ |
| Work Request | cc_properties | work_requests.property_id → | YES (if FK set) |

---

## Top 10 Geo Anchor Tables

1. cc_locations (lat, lon) - Transport terminals
2. cc_sr_communities (latitude, longitude) - Service run communities
3. cc_communities (latitude, longitude) - Public communities
4. cc_geo_regions (centroid_lat, centroid_lon) - BC hierarchy
5. cc_assets (latitude, longitude) - Rentable assets
6. cc_properties (lat, lon) - Managed properties
7. cc_tenant_start_addresses (latitude, longitude) - Run origins
8. cc_contractor_jobsites (geo_lat, geo_lng) - Customer sites
9. cc_facilities (geo_lat, geo_lon) - Facilities
10. cc_fleets (default_home_base_lat/lng) - Fleet home bases

---

## Run Origin Join Path (Copy-Paste Ready)

```sql
SELECT 
  r.id as run_id,
  r.name as run_name,
  r.status,
  sa.label as start_address_label,
  sa.address_line_1,
  sa.city,
  sa.region,
  sa.latitude as origin_lat,
  sa.longitude as origin_lng
FROM cc_n3_runs r
LEFT JOIN cc_tenant_start_addresses sa ON r.start_address_id = sa.id
WHERE r.tenant_id = $1;
```

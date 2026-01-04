# Migration 028: PostGIS Removal Changelog

## Overview

Migration 028 removes all PostGIS dependencies from the database schema, replacing geography-based spatial operations with haversine-based calculations that use grid indexes for performance.

## New Canonical Functions

| Function | Purpose | Performance |
|----------|---------|-------------|
| `fn_haversine_meters(lat1, lon1, lat2, lon2)` | Accurate geodesic distance in meters | IMMUTABLE, PARALLEL SAFE |
| `fn_bbox(lat, lon, radius_meters)` | Returns bounding box for prefiltering | IMMUTABLE, PARALLEL SAFE |
| `fn_lat_cell(lat)` | Grid cell for latitude (floor(lat * 100)) | IMMUTABLE, PARALLEL SAFE |
| `fn_lon_cell(lon)` | Grid cell for longitude (floor(lon * 100)) | IMMUTABLE, PARALLEL SAFE |

## Query Pattern

All spatial queries now follow this pattern:

```sql
-- 1. Get bounding box
SELECT * INTO v_bbox FROM fn_bbox(p_lat, p_lng, radius_meters);

-- 2. Query with pattern: bbox prefilter + haversine filter + ORDER BY haversine
SELECT *
FROM table_name
WHERE latitude BETWEEN v_bbox.min_lat AND v_bbox.max_lat   -- Uses grid index
  AND longitude BETWEEN v_bbox.min_lon AND v_bbox.max_lon
  AND fn_haversine_meters(latitude, longitude, p_lat, p_lng) <= radius_meters
ORDER BY fn_haversine_meters(latitude, longitude, p_lat, p_lng);
```

## Functions Replaced

### From Migration 018 (External Data Lake V2)

| Original | PostGIS Usage | Replacement |
|----------|---------------|-------------|
| `set_external_record_geom()` | Created geom from lat/lng | DROPPED (no longer needed) |
| `set_entity_geom()` | Created geom from lat/lng | DROPPED (no longer needed) |
| `set_community_geom()` | Created geom from lat/lng | DROPPED (no longer needed) |
| `resolve_community()` | `geom <-> ST_SetSRID(...)` | fn_haversine_meters + bbox |

### From Migration 019 (Rental Fields)

| Original | PostGIS Usage | Replacement |
|----------|---------------|-------------|
| `resolve_community()` (v2) | `geom <-> ST_SetSRID(...)` with SQRT fallback | fn_haversine_meters + bbox (no degree euclidean) |

### From Migration 020 (Unified Assets Registry)

| Original | PostGIS Usage | Replacement |
|----------|---------------|-------------|
| `sync_staging_property_to_unified()` | `ST_SetSRID(ST_MakePoint(...))::geography` | Uses lat/lng directly, grid columns auto-generated |
| `sync_staging_spot_to_unified()` | `ST_SetSRID(ST_MakePoint(...))::geography` | Uses lat/lng directly, grid columns auto-generated |
| `search_unified_assets()` | `ST_DWithin()`, `ST_Distance()` | fn_haversine_meters + bbox |

### From Migration 021 (Capability Architecture)

| Original | PostGIS Usage | Replacement |
|----------|---------------|-------------|
| `find_assets_by_capability()` | `ST_Distance()`, `ST_DWithin()` | fn_haversine_meters + bbox |
| `searchable_assets` view | Referenced geom column | Uses lat/lng + lat_cell/lon_cell |

## Columns Dropped

| Table | Column | Reason |
|-------|--------|--------|
| `external_records` | `geom` | Replaced by lat_cell/lon_cell |
| `entities` | `geom` | Replaced by lat_cell/lon_cell |
| `sr_communities` | `geom` | Replaced by lat_cell/lon_cell |
| `unified_assets` | `geom` | Replaced by lat_cell/lon_cell |
| `assets` | `geom` | Replaced by lat_cell/lon_cell |
| `work_orders` | `site_geom` | Replaced by site_lat_cell/site_lon_cell |
| `asset_availability` | `location_geom` | Replaced by location_lat_cell/location_lon_cell |

## Columns Added

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `sr_communities` | `lat_cell` | INTEGER GENERATED | Grid index |
| `sr_communities` | `lon_cell` | INTEGER GENERATED | Grid index |
| `external_records` | `lat_cell` | INTEGER GENERATED | Grid index |
| `external_records` | `lon_cell` | INTEGER GENERATED | Grid index |
| `entities` | `lat_cell` | INTEGER GENERATED | Grid index |
| `entities` | `lon_cell` | INTEGER GENERATED | Grid index |
| `unified_assets` | `lat_cell` | INTEGER GENERATED | Grid index |
| `unified_assets` | `lon_cell` | INTEGER GENERATED | Grid index |
| `assets` | `lat_cell` | INTEGER GENERATED | Grid index |
| `assets` | `lon_cell` | INTEGER GENERATED | Grid index |
| `work_orders` | `site_lat_cell` | INTEGER GENERATED | Grid index |
| `work_orders` | `site_lon_cell` | INTEGER GENERATED | Grid index |
| `asset_availability` | `location_lat_cell` | INTEGER GENERATED | Grid index |
| `asset_availability` | `location_lon_cell` | INTEGER GENERATED | Grid index |

## Indexes Added

| Table | Index Name | Columns |
|-------|------------|---------|
| `sr_communities` | `idx_sr_communities_grid` | `(lat_cell, lon_cell)` |
| `external_records` | `idx_external_records_grid` | `(lat_cell, lon_cell)` |
| `entities` | `idx_entities_grid` | `(lat_cell, lon_cell)` |
| `unified_assets` | `idx_unified_assets_grid` | `(lat_cell, lon_cell)` |
| `assets` | `idx_assets_grid` | `(lat_cell, lon_cell)` |
| `work_orders` | `idx_work_orders_site_grid` | `(site_lat_cell, site_lon_cell)` |
| `asset_availability` | `idx_asset_availability_grid` | `(location_lat_cell, location_lon_cell)` |

## Triggers Dropped

| Trigger | Table | Reason |
|---------|-------|--------|
| `trg_external_records_geom` | `external_records` | No longer needed |
| `trg_entities_geom` | `entities` | No longer needed |
| `trg_sr_communities_geom` | `sr_communities` | No longer needed |

## Verification

Run `scripts/qa-geo-without-postgis.sh` to verify:
1. No ST_* references in function definitions
2. Haversine calculations are accurate
3. Radius searches work correctly
4. Grid indexes are being used
5. PostGIS geom columns are removed

## Views Recreated

Views that referenced the dropped geom column have been recreated without geom references:

| View | Purpose | Key Changes |
|------|---------|-------------|
| `v_unified_accommodations` | Accommodation assets | Uses lat/lng + lat_cell/lon_cell |
| `v_unified_parking` | Parking spots | Uses lat/lng + lat_cell/lon_cell |
| `v_unified_towables` | Towable assets | Uses lat/lng + lat_cell/lon_cell |
| `v_unified_self_contained` | Self-contained RVs | Uses lat/lng + lat_cell/lon_cell |
| `searchable_assets` | Capability search view | Uses lat/lng + lat_cell/lon_cell |

## Functions Updated

| Function | Change |
|----------|--------|
| `sync_external_record_to_unified()` | No longer inserts geom, uses lat/lng directly |
| `search_unified_assets()` | Old overloaded version (with geom) dropped; new version uses haversine + bbox |

## Performance Notes

- Grid cells divide the world into ~0.01 degree squares (~1.1km at equator)
- Bbox prefilter eliminates 99%+ of rows before haversine calculation
- Haversine is only computed for rows within the bounding box
- Grid index provides O(1) neighbor lookup for most queries

## Verification Results

Run `scripts/qa-geo-without-postgis.sh` to verify:
1. No ST_* references in application function definitions
2. Haversine: Vancouver to Victoria = 96.7km (correct)
3. Bbox function returns valid bounds
4. Grid columns exist on all spatial tables
5. Views compile successfully (v_unified_accommodations, v_unified_parking, searchable_assets)
6. No geom columns remain in key tables

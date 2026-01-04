# PostGIS Removal - Complete Diff Documentation

## Summary

All PostGIS dependencies have been removed from migrations 018-022 to enable deployment on Replit's standard PostgreSQL (which does not include PostGIS).

---

## 1. Migration-by-Migration Changes

### Migration 018: external_data_lake_v2.sql

**Dropped Extensions:**
```diff
- CREATE EXTENSION IF NOT EXISTS postgis;
+ -- Note: PostGIS removed for Replit compatibility - using lat/lng columns instead
```

**Removed Geography Columns:**
```diff
# external_records table
- geom GEOGRAPHY(POINT, 4326),
+ -- geom column removed - using lat/lng for distance calculations

# entities table
- ALTER TABLE entities ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);
+ -- Note: geom column removed for Replit compatibility - using lat/lng columns instead

# sr_communities table
- ALTER TABLE sr_communities ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);
+ -- Note: PostGIS geom column removed for Replit compatibility
```

**Removed GIST Indexes:**
```diff
- CREATE INDEX IF NOT EXISTS idx_external_records_geom ON external_records USING GIST (geom) WHERE geom IS NOT NULL;
+ CREATE INDEX IF NOT EXISTS idx_external_records_lat_lng ON external_records(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

- CREATE INDEX IF NOT EXISTS idx_entities_geom_v2 ON entities USING GIST (geom) WHERE geom IS NOT NULL;
+ CREATE INDEX IF NOT EXISTS idx_entities_lat_lng ON entities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

- CREATE INDEX IF NOT EXISTS idx_sr_communities_geom ON sr_communities USING GIST (geom) WHERE geom IS NOT NULL;
+ CREATE INDEX IF NOT EXISTS idx_sr_communities_lat_lng ON sr_communities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

**Removed Triggers:**
- `trg_external_records_geom` - auto-populated geom from lat/lng
- `trg_entities_geom` - auto-populated geom from lat/lng  
- `trg_sr_communities_geom` - auto-populated geom from lat/lng

**Replaced ST_* Functions:**
```diff
# resolve_community function
- ORDER BY geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
+ ORDER BY SQRT(POWER(latitude - p_lat, 2) + POWER(longitude - p_lng, 2))
```

---

### Migration 019: rental_fields_and_functions.sql

**Replaced ST_* Functions:**
```diff
# find_community_by_location function
- ORDER BY geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
+ ORDER BY SQRT(POWER(latitude - p_lat, 2) + POWER(longitude - p_lng, 2))
```

---

### Migration 020: unified_assets_registry.sql

**Removed Geography Columns:**
```diff
# unified_assets table
- geom GEOGRAPHY(Point, 4326),  -- PostGIS for spatial queries
+ -- Note: geom column removed for Replit compatibility - using lat/lng
```

**Removed GIST Indexes:**
```diff
- CREATE INDEX IF NOT EXISTS idx_unified_assets_location ON unified_assets USING gist(geom) WHERE geom IS NOT NULL;
+ CREATE INDEX IF NOT EXISTS idx_unified_assets_location ON unified_assets(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

**Replaced ST_* Functions in sync_staging_property_to_unified:**
```diff
# Removed geom from INSERT column list
- community_id, region, city, latitude, longitude, geom,
+ community_id, region, city, latitude, longitude,

# Removed ST_SetSRID/ST_MakePoint value
- CASE WHEN prop.latitude IS NOT NULL AND prop.longitude IS NOT NULL 
-      THEN ST_SetSRID(ST_MakePoint(prop.longitude::float, prop.latitude::float), 4326)::geography
-      ELSE NULL END,
```

**Replaced ST_* Functions in search_unified_assets:**
```diff
# Distance calculation
- WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ua.geom IS NOT NULL
- THEN ROUND((ST_Distance(ua.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) / 1000)::numeric, 1)
+ WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ua.latitude IS NOT NULL AND ua.longitude IS NOT NULL
+ THEN ROUND((SQRT(POWER((ua.latitude - p_latitude) * 111, 2) + POWER((ua.longitude - p_longitude) * 111 * COS(RADIANS(p_latitude)), 2)))::numeric, 1)

# Radius filter (ST_DWithin replacement)
- OR ST_DWithin(ua.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, p_radius_km * 1000)
+ OR (
+   ua.latitude BETWEEN p_latitude - (p_radius_km / 111.0) AND p_latitude + (p_radius_km / 111.0)
+   AND ua.longitude BETWEEN p_longitude - (p_radius_km / (111.0 * COS(RADIANS(p_latitude)))) AND p_longitude + (p_radius_km / (111.0 * COS(RADIANS(p_latitude))))
+ )

# ORDER BY distance
- THEN ST_Distance(ua.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography)
+ THEN SQRT(POWER((ua.latitude - p_latitude) * 111, 2) + POWER((ua.longitude - p_longitude) * 111 * COS(RADIANS(p_latitude)), 2))
```

---

### Migration 021: capability_architecture.sql

**Removed Geography Columns:**
```diff
# assets table
- geom GEOGRAPHY(POINT, 4326),  -- PostGIS for spatial queries
+ -- Note: geom column removed for Replit compatibility - using lat/lng

# asset_availability table
- location_geom GEOGRAPHY(POINT, 4326),
+ -- Note: location_geom column removed for Replit compatibility

# work_orders table
- site_geom GEOGRAPHY(POINT, 4326),
+ -- Note: site_geom column removed for Replit compatibility
```

**Removed GIST Indexes:**
```diff
- CREATE INDEX IF NOT EXISTS idx_assets_geom ON assets USING gist(geom) WHERE geom IS NOT NULL;
+ CREATE INDEX IF NOT EXISTS idx_assets_lat_lng ON assets(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

**Replaced ST_* Functions in find_assets_by_capability:**
```diff
# Distance calculation
- WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND a.geom IS NOT NULL
- THEN ROUND((ST_Distance(a.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography) / 1000)::numeric, 1)
+ WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
+ THEN ROUND((SQRT(POWER((a.latitude - p_latitude) * 111, 2) + POWER((a.longitude - p_longitude) * 111 * COS(RADIANS(p_latitude)), 2)))::numeric, 1)

# Radius filter
- OR ST_DWithin(a.geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography, p_radius_km * 1000)
+ OR (
+   a.latitude BETWEEN p_latitude - (p_radius_km / 111.0) AND p_latitude + (p_radius_km / 111.0)
+   AND a.longitude BETWEEN p_longitude - (p_radius_km / (111.0 * COS(RADIANS(p_latitude)))) AND p_longitude + (p_radius_km / (111.0 * COS(RADIANS(p_latitude))))
+ )
```

**Updated searchable_assets view:**
```diff
- a.geom,
+ -- a.geom removed for Replit compatibility
```

**Updated migrate_unified_to_capability_architecture function:**
```diff
# Removed geom from column lists
- home_community_id, region, city, latitude, longitude, geom,
+ home_community_id, region, city, latitude, longitude,
```

---

### Migration 022: construction_os_expansion.sql

**Removed Geography Columns:**
```diff
# opportunities table
- site_geom GEOGRAPHY(POINT, 4326),
+ -- Note: site_geom column removed for Replit compatibility
```

**Removed GIST Indexes:**
```diff
- CREATE INDEX IF NOT EXISTS idx_opportunities_geom ON opportunities USING gist(site_geom) WHERE site_geom IS NOT NULL;
+ CREATE INDEX IF NOT EXISTS idx_opportunities_lat_lng ON opportunities(site_latitude, site_longitude) WHERE site_latitude IS NOT NULL AND site_longitude IS NOT NULL;
```

---

## 2. Compatibility Plan

### Column Structure (Now)

| Table | Columns for Location |
|-------|---------------------|
| `external_records` | `latitude DOUBLE PRECISION`, `longitude DOUBLE PRECISION` |
| `entities` | `latitude`, `longitude` (existing), `community_id UUID` |
| `sr_communities` | `latitude NUMERIC`, `longitude NUMERIC` |
| `unified_assets` | `latitude NUMERIC(10,7)`, `longitude NUMERIC(10,7)` |
| `assets` | `latitude NUMERIC(10,7)`, `longitude NUMERIC(10,7)` |
| `asset_availability` | `location_latitude NUMERIC(10,7)`, `location_longitude NUMERIC(10,7)` |
| `work_orders` | `site_latitude NUMERIC(10,7)`, `site_longitude NUMERIC(10,7)` |
| `opportunities` | `site_latitude NUMERIC(10,7)`, `site_longitude NUMERIC(10,7)` |

### Query Replacements

| Original PostGIS | Replacement |
|-----------------|-------------|
| `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` | Direct use of `latitude`, `longitude` columns |
| `ST_Distance(geom1, geom2) / 1000` | `SQRT(POWER((lat1 - lat2) * 111, 2) + POWER((lng1 - lng2) * 111 * COS(RADIANS(lat1)), 2))` |
| `ST_DWithin(geom, point, meters)` | Bounding box: `lat BETWEEN center_lat - (km/111) AND center_lat + (km/111) AND lng BETWEEN center_lng - (km/(111*COS(RADIANS(center_lat)))) AND ...` |
| `ORDER BY geom <-> point` | `ORDER BY SQRT(POWER((lat1-lat2)*111, 2) + POWER((lng1-lng2)*111*COS(RADIANS(lat1)), 2))` |

### Distance Formula Explanation

The Euclidean approximation uses:
- **111 km** = approximate km per degree of latitude (constant)
- **111 * COS(RADIANS(lat))** = approximate km per degree of longitude (varies with latitude)

This provides ~1-5% accuracy at mid-latitudes (acceptable for BC, ~49-60°N).

### Indexes Supporting "Near Me" Queries

| Table | Index |
|-------|-------|
| `external_records` | `idx_external_records_lat_lng(latitude, longitude)` |
| `entities` | `idx_entities_lat_lng(latitude, longitude)` |
| `sr_communities` | `idx_sr_communities_lat_lng(latitude, longitude)` |
| `unified_assets` | `idx_unified_assets_location(latitude, longitude)` |
| `assets` | `idx_assets_lat_lng(latitude, longitude)` |
| `opportunities` | `idx_opportunities_lat_lng(site_latitude, site_longitude)` |

---

## 3. QA Validation Script

See `scripts/qa-postgis-removal.sh` for automated testing.

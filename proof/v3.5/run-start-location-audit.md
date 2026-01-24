# Run Start Location - Audit-First Assessment

Date: 2026-01-24
Status: AUDIT COMPLETE - STOP CONDITION MET

## A1) Existing Asset Tables Found

### Search Command
```bash
rg -n "asset" server/
psql "$DATABASE_URL" -c "\d cc_assets"
psql "$DATABASE_URL" -c "\d cc_vehicles"
psql "$DATABASE_URL" -c "\d cc_n3_runs"
```

### cc_assets Table (Unified Assets Registry)

**EXISTS: YES**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| latitude | numeric(10,7) | ✅ Location field |
| longitude | numeric(10,7) | ✅ Location field |
| location_description | text | ✅ Location field |
| region | varchar(100) | Geographic |
| city | varchar(100) | Geographic |
| source_table | varchar(50) | Links to cc_vehicles, etc. |
| source_id | text | Source record ID |

### cc_vehicles Table

**EXISTS: YES**

Location columns: **NONE**

The cc_vehicles table has no explicit location fields like:
- ❌ last_location
- ❌ home_location
- ❌ base_location
- ❌ lat/lng columns

### cc_n3_runs Table (N3 Service Runs)

**EXISTS: YES**

Current columns:
```
id, tenant_id, name, description, status, starts_at, ends_at, 
metadata (jsonb), created_at, updated_at, portal_id, zone_id, market_mode
```

Location columns: **NONE**

Missing:
- ❌ start_location_lat
- ❌ start_location_lng
- ❌ departure_location_id
- ❌ origin_location_id
- ❌ travel_origin

### cc_individuals Table

**EXISTS: YES**

Location-related:
- home_community_id (FK to cc_sr_communities)
- home_country, home_region (text)
- current_community_id (FK to cc_sr_communities)

No address or lat/lng fields.

### Other Run Tables Checked

| Table | Exists | Start Location Column |
|-------|--------|----------------------|
| cc_n3_runs | ✅ | ❌ None |
| cc_service_runs | ✅ | (not checked) |
| coop_service_runs | ❌ Does not exist | N/A |

Note: Migration 039_coop_service_runs.sql defines `travel_origin TEXT` but the table was never created.

---

## A2) Location Canon

### What constitutes an "asset location" today?

1. **cc_assets**: Uses lat/lng (DECIMAL 10,7) + text location_description
   - This is the ONLY asset table with explicit coordinates

2. **cc_vehicles**: No location storage
   - Vehicle locations are NOT tracked in the schema

3. **cc_n3_runs**: No departure/start location
   - Runs have a zone_id (FK to cc_zones) for zone-aware pricing
   - No explicit "where does the contractor depart from" field

### Data Types in Use

| Pattern | Data Type | Example |
|---------|-----------|---------|
| Coordinates | numeric(10,7) | cc_assets.latitude/longitude |
| Location FK | uuid | cc_sailings.origin_location_id → cc_locations |
| Text address | text | cc_freight_manifests via cc_locations join |
| Zone FK | uuid | cc_n3_runs.zone_id → cc_zones |

---

## A3) STOP CONDITIONS EVALUATION

### Required Elements

| Requirement | Found | Notes |
|-------------|-------|-------|
| Asset table | ✅ | cc_assets exists |
| Asset location field | ✅ | latitude, longitude, location_description |
| Safe place to store run start location | ❌ | **NOT FOUND** |

### Analysis

**cc_n3_runs has NO column for "start location" or "departure point".**

The only options to store run start location are:

1. **Add new columns** to cc_n3_runs:
   - `start_location_lat DECIMAL(10,7)`
   - `start_location_lng DECIMAL(10,7)`
   - `start_location_description TEXT`
   - **REQUIRES SCHEMA CHANGE / MIGRATION**

2. **Reference cc_assets**:
   - Add `departure_asset_id UUID REFERENCES cc_assets(id)`
   - Contractor vehicle could be an asset with location
   - **REQUIRES SCHEMA CHANGE / MIGRATION**

3. **Store in metadata JSONB**:
   - `metadata->'start_location'`
   - **UNTYPED, NO VALIDATION, NOT RECOMMENDED**

---

## STOP CONDITION MET

**DO NOT INVENT SCHEMA.**

The audit reveals that there is NO existing safe place to store a "run start location" without creating new schema.

### Missing Schema Elements

1. cc_n3_runs has no start_location columns
2. cc_vehicles has no home_location column
3. No contractor_base_location pattern exists
4. cc_individuals has no address/lat-lng fields

### Recommendation

Before implementing run-start-location feature, the following schema decision is required:

**Option A: Add columns to cc_n3_runs**
```sql
ALTER TABLE cc_n3_runs 
  ADD COLUMN start_location_lat DECIMAL(10,7),
  ADD COLUMN start_location_lng DECIMAL(10,7),
  ADD COLUMN start_location_description TEXT;
```

**Option B: Reference existing location infrastructure**
```sql
ALTER TABLE cc_n3_runs 
  ADD COLUMN departure_location_id UUID REFERENCES cc_locations(id);
```

**Option C: Add home_location to cc_vehicles or tenant settings**
```sql
ALTER TABLE cc_tenants 
  ADD COLUMN base_location_lat DECIMAL(10,7),
  ADD COLUMN base_location_lng DECIMAL(10,7),
  ADD COLUMN base_location_description TEXT;
```

### Action Required

User must choose schema approach before any code is written.

---

## Audit Verification Commands

```bash
# All asset-related tables
rg -n "cc_assets|cc_fleet|cc_vehicles|cc_equipment" server/

# Location column search
rg -n "last_location|home_location|base_location" server/
# Result: Only found in transport_providers.base_location (unrelated)

# Start/origin location patterns
rg -n "start_location|departure_location|origin" server/
# Result: Found in sailings/transport (different domain), not in N3 runs

# Current cc_n3_runs columns
psql "$DATABASE_URL" -c "\d cc_n3_runs"
# Result: No location columns
```

---

## Conclusion

**HALT IMPLEMENTATION** - No safe schema exists for run start location.

Next step: User decision on schema approach (Option A, B, or C above).

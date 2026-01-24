# V3.5 STEP 7C — Micro-Portals + Surface Traversal Audit

**Generated**: 2026-01-24  
**Mode**: AUDIT ONLY — Evidence-first, Zero implementation

---

## SECTION A) MICRO PORTAL + ZONE INVENTORY (FACTS ONLY)

### A1) All Portals (12 total)

| ID | Name | Slug | Status | Owning Tenant | Default Zone | Anchor Community |
|----|------|------|--------|---------------|--------------|------------------|
| 96f6541c-... | AdrenalineCanada | adrenalinecanada | active | (null) | (null) | **NULL** |
| 4ead0e01-... | Bamfield Adventure Center | bamfield-adventure | active | 7ed7da14-... | (null) | **NULL** |
| df5561a8-... | Bamfield Community Portal | bamfield | active | e0000000-... | (null) | **NULL** |
| 3bacc506-... | Bamfield QA Portal | bamfield-qa | active | b0000000-... | (null) | **NULL** |
| f47ac10b-... | CanadaDirect | canadadirect | active | (null) | (null) | **NULL** |
| 6cc5ca1a-... | Enviro Bright Lights | enviro-bright | active | b1252093-... | (null) | **NULL** |
| 5db6402b-... | Enviropaving BC | enviropaving | active | b1252093-... | (null) | **NULL** |
| f0cb44d0-... | OffpeakAirBNB | offpeakairbnb | active | (null) | (null) | **NULL** |
| 5f0d45a1-... | Parts Unknown BC | parts-unknown-bc | active | (null) | (null) | **NULL** |
| 9a4e1b47-... | Remote Serve | remote-serve | active | b1252093-... | (null) | **NULL** |
| 19a451b8-... | Save Paradise Parking | save-paradise-parking | active | 7d8e6df5-... | (null) | **NULL** |
| 4813f3fd-... | Woods End Landing Cottages | woods-end-landing | active | d0000000-... | (null) | **NULL** |

**CRITICAL FINDING:** All 12 portals have `anchor_community_id = NULL`. No geo anchors populated.

---

### A2) Zones Grouped by Portal (6 zones)

| Portal Name | Zone Name | Zone Key | Kind |
|-------------|-----------|----------|------|
| Bamfield Community Portal | Deer Group | deer-group | neighborhood |
| Bamfield Community Portal | East Bamfield | east-bamfield | neighborhood |
| Bamfield Community Portal | Helby Island | helby-island | neighborhood |
| Bamfield Community Portal | West Bamfield | west-bamfield | neighborhood |
| Bamfield QA Portal | Downtown Core | test-zone-1 | neighborhood |
| Bamfield QA Portal | Waterfront District | test-zone-2 | neighborhood |

**Only Bamfield Community Portal has real zones. QA Portal zones are test data.**

---

### A3) Bamfield Micro-Areas Detection

| Type | ID | Name | Key/Slug |
|------|-----|------|----------|
| portal | 4ead0e01-... | Bamfield Adventure Center | bamfield-adventure |
| portal | df5561a8-... | Bamfield Community Portal | bamfield |
| portal | 3bacc506-... | Bamfield QA Portal | bamfield-qa |
| zone | 922782d2-... | East Bamfield | east-bamfield |
| zone | 281b0283-... | Helby Island | helby-island |
| zone | b4a65e6f-... | West Bamfield | west-bamfield |

**Detected micro-areas:**
- ✅ West Bamfield (zone)
- ✅ East Bamfield (zone)
- ✅ Helby Island (zone)
- ✅ Deer Group (zone)
- ❌ **Anacla NOT PRESENT** — Not a zone or portal in the database

---

## SECTION B) "NEARBY / ADJACENT / ROLLUP" MECHANISMS

### B1) Relationship/Adjacency Tables Found

| Table Name | Purpose |
|------------|---------|
| cc_entity_relationships | Entity-to-entity relationships with travel_time and distance |
| cc_relationship_signals | Party A↔B relationship signals (inferred connections) |
| geography_columns | PostGIS metadata (no data; PostGIS not installed) |

---

### B2) cc_entity_relationships Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| from_entity_id | uuid | Source entity |
| to_entity_id | uuid | Target entity |
| relationship_type | varchar | Type (adjacent, serves, depends_on, etc.) |
| is_critical | boolean | Critical path flag |
| is_bidirectional | boolean | Symmetric relationship |
| travel_time_minutes | integer | Travel time estimate |
| distance_km | numeric | Distance between entities |
| conditions | jsonb | Constraints/conditions |
| is_active | boolean | Active status |

**DATA CHECK:** Table is **EMPTY** — no entity relationships populated.

---

### B3) Code Search: Nearby Logic

#### server/services/contractorServiceAreaInference.ts:230-237
```typescript
async function findNearbyPortalsAndZones(
  lat: number, lng: number, tenantId: string
): Promise<Array<{ type: 'portal' | 'zone'; id: string; name: string; distance_km: number }>> {
  // STUB: Returns empty array until portal/zone tables are populated
  return [];
}
```

**FINDING:** The nearby lookup is a **STUB** — returns empty array. Not implemented.

#### server/services/contractorRouteOpportunityEngine.ts:175-197
```typescript
const distance = haversineDistance(lat1, lng1, lat2, lng2);
// Uses TypeScript haversine implementation
```

#### server/services/locationService.ts:174
```typescript
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number
```

#### server/services/entityResolution.ts:28-40
```sql
fn_haversine_meters($2, $3, latitude::double precision, longitude::double precision) <= 5000
```

**FINDING:** System uses `fn_haversine_meters()` UDF and TypeScript implementations for distance. No PostGIS.

---

### B) STOP CONDITION CHECK

> **No explicit adjacency mechanism exists.**  
> Any suggestion must be derived from existing geo anchors + constraints only (advisory).

**Geo anchor status:**
- ✅ `cc_sr_communities` has 50 BC communities with lat/lng
- ❌ `cc_portals.anchor_community_id` is NULL for all portals
- ❌ `cc_zones` has no direct geo columns
- ❌ `cc_entity_relationships` is empty

---

## SECTION C) SURFACE SPINE INVENTORY

### C1) Surface Tables (11 tables)

| Table | Purpose |
|-------|---------|
| cc_surfaces | Core surface definitions (5 types) |
| cc_surface_units | Atomic units within surfaces |
| cc_surface_containers | Container groupings |
| cc_surface_container_members | Container membership |
| cc_surface_claims | Reservation claims |
| cc_surface_tasks | Task assignments |
| cc_surface_utility_bindings | Utility connections |
| cc_n3_surface_requirements | N3 run surface requirements |
| cc_utility_nodes | Utility connection points |
| cc_embed_surfaces | Embedded surface views |
| cc_disclosure_surface_sets | Disclosure groupings |

---

### C2) cc_surfaces Sample Data

| ID | Portal ID | Surface Type | Title |
|----|-----------|--------------|-------|
| e00979ae-... | 00000000-... | sleep | Top Bunk Mattress |
| 1aae69d5-... | 00000000-... | sleep | Bottom Bunk Mattress |
| a692e800-... | 00000000-... | sleep | Sofa Bed Mattress |
| fe71d143-... | 00000000-... | stand | Stall Footprint |
| 14e34332-... | 00000000-... | sit | Table 10 Seating |
| 7176278d-... | 00000000-... | sit | Canoe 1 Hull |
| 2677e689-... | 00000000-... | movement | Dock Ramp Surface |
| 416e4b1d-... | 00000000-... | movement | Boardwalk Grated |
| 47a9644c-... | 00000000-... | stand | Slip A1 Moorage Edge |
| dc065a59-... | 00000000-... | utility | Slip A1 Power Outlet |

**Confirmed 5 surface types:** movement, sit, sleep, stand, utility

---

### C3) Surface Foreign Key Relationships

| From Table | Column | To Table |
|------------|--------|----------|
| cc_surfaces | portal_id | cc_portals |
| cc_surface_units | surface_id | cc_surfaces |
| cc_surface_container_members | surface_id, container_id | cc_surfaces, cc_surface_containers |
| cc_surface_utility_bindings | surface_id, utility_node_id | cc_surfaces, cc_utility_nodes |
| cc_n3_surface_requirements | run_id, segment_id | cc_n3_runs, cc_n3_segments |

**Canonical Traversal Primitives:**
- **StandingSurface** → `surface_type = 'stand'` (stalls, slips, moorage)
- **MovementSurface** → `surface_type = 'movement'` (ramps, boardwalks)
- **SittingSurface** → `surface_type = 'sit'` (seating, boat hulls)
- **SleepingSurface** → `surface_type = 'sleep'` (beds, mattresses)
- **UtilitySurface** → `surface_type = 'utility'` (power outlets)

---

### cc_n3_surface_requirements Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| portal_id | uuid | Portal context |
| run_id | uuid | FK → cc_n3_runs |
| segment_id | uuid | FK → cc_n3_segments |
| surface_id | uuid | Specific surface (optional) |
| container_id | uuid | Container (optional) |
| required_surface_type | varchar | Required type |
| actor_profile | jsonb | Actor requirements (wheelchair, etc.) |
| demand | jsonb | Capacity demand |
| required_constraints | jsonb | Additional constraints |
| risk_tolerance | numeric | Risk threshold |

**N3 runs can specify surface requirements per segment.**

---

## SECTION D) CONSTRAINTS (WEATHER / TIDES / SCHEDULES)

### D1) Constraint Tables (17 tables)

| Table | Purpose |
|-------|---------|
| cc_tide_predictions | Tide height predictions by timestamp |
| cc_weather_normals | Historical weather averages by day-of-year |
| cc_weather_trends | Weather trend data |
| cc_sailing_schedules | Ferry/boat schedules |
| cc_transport_schedules | Transport schedules |
| cc_schedules | General schedules |
| cc_access_constraints | Access restrictions |
| cc_asset_constraints | Asset-level constraints |
| cc_route_constraints | Route-level constraints |
| cc_spatial_constraints | Geo-based constraints |
| cc_sr_constraints | Service run constraints |
| cc_sr_service_constraints | Service-level constraints |
| cc_community_constraint_packs | Community constraint bundles |
| cc_visibility_profile_windows | Visibility time windows |
| cc_resource_schedule_events | Resource scheduling |

---

### D2) cc_tide_predictions Sample

| Location Ref | Timestamp | Height (m) |
|--------------|-----------|------------|
| bamfield-bc | 2026-01-23 17:31 | 3.872 |
| bamfield-bc | 2026-01-23 18:01 | 3.980 |
| bamfield-bc | 2026-01-23 18:31 | 3.994 |
| bamfield-bc | 2026-01-23 19:01 | 3.913 |
| bamfield-bc | 2026-01-23 21:31 | 2.445 |
| bamfield-bc | 2026-01-23 22:01 | 2.071 |

**Tide data exists for Bamfield with 30-minute granularity.**

---

### D3) cc_weather_normals Sample

| Location Ref | Day of Year | Low (°C) | High (°C) | Rain Prob |
|--------------|-------------|----------|-----------|-----------|
| bamfield-bc | 1 | 2.69 | 9.84 | 0.867 |
| bamfield-bc | 2 | 0.42 | 8.00 | 0.869 |
| bamfield-bc | 5 | -0.97 | 6.62 | 0.826 |

**365-day weather normals exist for Bamfield.**

---

### D4) cc_sailing_schedules Sample

| Route Name | Route Code | Days | Departure | Season |
|------------|------------|------|-----------|--------|
| Port Alberni - Bamfield (Summer) | PA-BAM-S | Daily | 08:00 | Jun-Sep |
| Port Alberni - Bamfield (Shoulder) | PA-BAM-SH | Tue/Thu/Sat | 08:00 | May, Oct |
| Port Alberni - Bamfield (Winter) | PA-BAM-W | Tue/Sat | 08:00 | Nov-Apr |

**Ferry/boat schedules exist with seasonal variations.**

---

### D5) N3 Evaluator Tide Logic

**File:** `server/lib/n3/evaluator.ts:198`
```typescript
reason: `Optimal tide window at ${optimalWindow.avgHeight.toFixed(1)}m`,
```

**File:** `server/routes/proposals.ts:971-972`
```typescript
reason: 'Low tide during arrival window',
mitigation: 'Consider shifting arrival to high tide window for easier ramp access',
```

**Tide window optimization is implemented in N3 evaluator.**

---

## SECTION E) WORK AREA / EXECUTION PRECISION

### E1) cc_work_requests Schema (Relevant Columns)

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| tenant_id | uuid | Tenant |
| property_id | uuid | FK → cc_properties |
| zone_id | uuid | FK → cc_zones |
| portal_id | uuid | FK → cc_portals |
| summary | text | Request summary |
| status | enum | Status |
| category | varchar | Service category |
| coordination_intent | boolean | Coordination flag |

**Work requests link to both property (execution) and zone/portal (visibility).**

---

### E2) cc_properties Schema (Geo Columns)

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| portal_id | uuid | Portal context |
| zone_id | uuid | Zone context |
| lat | numeric | Latitude |
| lon | numeric | Longitude |
| address_line1 | text | Street address |
| city | varchar | City |

**Properties have direct lat/lon for execution precision.**

---

### E3) Execution Chain

```
cc_work_requests
    ├── property_id → cc_properties.lat/lon (EXECUTION PRECISION)
    │
    ├── zone_id → cc_zones.portal_id → cc_portals.anchor_community_id → cc_sr_communities (VISIBILITY)
    │                                         ↑
    │                                    (ALL NULL - BROKEN)
    │
    └── portal_id → cc_portals.anchor_community_id → cc_sr_communities (VISIBILITY)
                                  ↑
                             (ALL NULL - BROKEN)
```

---

## SECTION F) STEP 7 "SUGGESTABLE TARGETS" DERIVATION

### F1) Visibility Suggestions Candidate Set

#### Portal IDs (12)

| Portal ID | Name | Anchor Status |
|-----------|------|---------------|
| 96f6541c-... | AdrenalineCanada | ❌ No anchor |
| 4ead0e01-... | Bamfield Adventure Center | ❌ No anchor |
| df5561a8-... | Bamfield Community Portal | ❌ No anchor |
| 3bacc506-... | Bamfield QA Portal | ❌ No anchor |
| f47ac10b-... | CanadaDirect | ❌ No anchor |
| 6cc5ca1a-... | Enviro Bright Lights | ❌ No anchor |
| 5db6402b-... | Enviropaving BC | ❌ No anchor |
| f0cb44d0-... | OffpeakAirBNB | ❌ No anchor |
| 5f0d45a1-... | Parts Unknown BC | ❌ No anchor |
| 9a4e1b47-... | Remote Serve | ❌ No anchor |
| 19a451b8-... | Save Paradise Parking | ❌ No anchor |
| 4813f3fd-... | Woods End Landing Cottages | ❌ No anchor |

#### Zone IDs (6)

| Zone ID | Name | Portal | Has Geo? |
|---------|------|--------|----------|
| 922782d2-... | East Bamfield | Bamfield Community Portal | ❌ Inherits from portal (NULL) |
| b4a65e6f-... | West Bamfield | Bamfield Community Portal | ❌ Inherits from portal (NULL) |
| 281b0283-... | Helby Island | Bamfield Community Portal | ❌ Inherits from portal (NULL) |
| 0e82a592-... | Deer Group | Bamfield Community Portal | ❌ Inherits from portal (NULL) |
| 2ddc012e-... | Downtown Core | Bamfield QA Portal | ❌ Test zone |
| faa69ecb-... | Waterfront District | Bamfield QA Portal | ❌ Test zone |

#### Community Anchors Available (50)

All 50 BC communities in `cc_sr_communities` have lat/lng. Example for Bamfield:
- **ID:** dfcf6f7c-cc73-47e6-8194-cb50079be93b
- **Name:** Bamfield
- **Lat:** 48.833
- **Lng:** -125.136

---

### F2) Execution Complexity Signals

#### Surface Types in Portal Context

| Surface Type | Count | Examples |
|--------------|-------|----------|
| movement | 2+ | Dock Ramp, Boardwalk Grated |
| sit | 3+ | Table Seating, Canoe/Kayak Hulls |
| sleep | 4+ | Bunk Mattresses, Sofa Bed |
| stand | 5+ | Stall Footprint, Slip Moorage Edges |
| utility | 4+ | Power Outlets |

#### Constraint Systems Available

| Constraint Type | Data Available | Join Path |
|-----------------|----------------|-----------|
| Tide predictions | ✅ bamfield-bc | cc_tide_predictions.location_ref |
| Weather normals | ✅ bamfield-bc | cc_weather_normals.location_ref |
| Ferry schedules | ✅ PA-BAM routes | cc_sailing_schedules |
| Route constraints | ✅ work_order_id | cc_route_constraints |
| Surface requirements | ✅ run_id | cc_n3_surface_requirements |

---

## SECTION G) STOP CONDITIONS + QUESTIONS FOR GLENN

### STOP CONDITIONS EVALUATED

| Condition | Status | Evidence |
|-----------|--------|----------|
| No explicit micro-portal adjacency mechanism | ✅ CONFIRMED | cc_entity_relationships is empty |
| Geo anchors insufficient | ✅ CONFIRMED | All portal anchor_community_id = NULL |
| Surface traversal unreferenceable from run | ❌ FALSE | cc_n3_surface_requirements exists |
| Constraints have no join path | ❌ FALSE | location_ref matches, tide/weather work |

### ⚠️ PARTIAL STOP: Geo Anchors Broken

**Cannot compute distances between portals/zones until anchor_community_id is populated.**

---

### QUESTIONS FOR GLENN

1. **Portal Anchor Mapping:** Which community should each portal anchor to?
   - Bamfield Community Portal → Bamfield (dfcf6f7c-...)?
   - Bamfield Adventure Center → Bamfield (dfcf6f7c-...)?
   - Woods End Landing → ?

2. **Zone Geo Model:** Should zones have their own community_id FK, or always inherit from portal?

3. **Anacla Zone:** Should Anacla be added as a zone under Bamfield Community Portal?

4. **Surface Linkage:** Should surfaces link to properties in addition to portals for work area precision?

5. **Suggestion Scope:** For STEP 7 advisory, should suggestions be:
   - (A) Portal-level only (broader reach)
   - (B) Zone-level only (micro-precision)
   - (C) Both with different confidence weights

---

## SECTION H) FINAL SUMMARY

### The Micro-Portal Model (As Implemented)

```
Bamfield Community (cc_sr_communities: 48.833, -125.136)
    │
    └── (anchor_community_id = NULL on all portals) ❌ BROKEN
        │
        ├── Bamfield Community Portal (df5561a8-...)
        │       ├── Zone: West Bamfield (b4a65e6f-...)
        │       ├── Zone: East Bamfield (922782d2-...)
        │       ├── Zone: Helby Island (281b0283-...)
        │       └── Zone: Deer Group (0e82a592-...)
        │
        ├── Bamfield Adventure Center (4ead0e01-...)
        │       └── (no zones)
        │
        └── Bamfield QA Portal (3bacc506-...)
                ├── Zone: Downtown Core (test)
                └── Zone: Waterfront District (test)
```

**Anacla is NOT a zone or portal in the database.**

---

### What "Nearby" Means Today

1. **Explicit Adjacency:** `cc_entity_relationships` exists but is **EMPTY**
2. **Geo-Based:** `findNearbyPortalsAndZones()` is a **STUB** returning empty array
3. **Haversine Functions:** `fn_haversine_meters()` UDF and TypeScript implementations exist
4. **Usable:** Can compute distance between any two lat/lng points

**"Nearby" must be derived from geo anchors + haversine. No explicit adjacency tables populated.**

---

### Surface Traversal Assets

| Asset | Status | Usage |
|-------|--------|-------|
| 5 surface types | ✅ Data exists | movement, sit, sleep, stand, utility |
| Surface → Portal FK | ✅ Working | Surfaces link to portals |
| N3 surface requirements | ✅ Schema exists | Runs can specify surface needs |
| Surface claims | ✅ Schema exists | Reservation system |

---

### Constraint Systems

| System | Status | Data |
|--------|--------|------|
| Tide predictions | ✅ Working | 30-min granularity, bamfield-bc |
| Weather normals | ✅ Working | 365-day coverage, bamfield-bc |
| Ferry schedules | ✅ Working | Seasonal PA-BAM routes |
| N3 evaluator tide logic | ✅ Implemented | Optimal window calculation |

---

### What STEP 7 Can Safely Do Without New Schema

| Capability | Feasible? | Requirements |
|------------|-----------|--------------|
| List portals as suggestion targets | ✅ Yes | None |
| List zones as suggestion targets | ✅ Yes | None |
| Compute distance to targets | ⚠️ PARTIAL | Requires anchor_community_id population |
| Filter by surface capabilities | ✅ Yes | Query cc_surfaces by portal_id |
| Filter by constraint feasibility | ✅ Yes | Query tide/weather by location_ref |
| Show execution complexity signals | ✅ Yes | Surface counts, constraint types |

---

### BLOCKING ISSUE FOR STEP 7 ADVISORY

**Geo anchors must be populated before distance-based suggestions can work.**

Recommended first step:
```sql
UPDATE cc_portals 
SET anchor_community_id = 'dfcf6f7c-cc73-47e6-8194-cb50079be93b'
WHERE slug IN ('bamfield', 'bamfield-adventure', 'bamfield-qa');
```

This links all 3 Bamfield portals to the Bamfield community (48.833, -125.136).

---

**END OF AUDIT**

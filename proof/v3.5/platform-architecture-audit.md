# V3.5 Platform Architecture Audit

**Generated**: 2026-01-24  
**Scope**: Micro-Portals, Communities, Zones, Surfaces, Weather Dependencies

---

## PART 1: MICRO-PORTAL & COMMUNITY ARCHITECTURE

### A1) ALL Portals (12 total)

| ID | Name | Slug | Status | Owning Tenant | Default Zone | Anchor Community |
|----|------|------|--------|---------------|--------------|------------------|
| 96f6541c-... | AdrenalineCanada | adrenalinecanada | active | (null) | (null) | (null) |
| 4ead0e01-... | Bamfield Adventure Center | bamfield-adventure | active | 7ed7da14-... | (null) | (null) |
| df5561a8-... | Bamfield Community Portal | bamfield | active | e0000000-... | (null) | (null) |
| 3bacc506-... | Bamfield QA Portal | bamfield-qa | active | b0000000-... | (null) | (null) |
| f47ac10b-... | CanadaDirect | canadadirect | active | (null) | (null) | (null) |
| 6cc5ca1a-... | Enviro Bright Lights | enviro-bright | active | b1252093-... | (null) | (null) |
| 5db6402b-... | Enviropaving BC | enviropaving | active | b1252093-... | (null) | (null) |
| f0cb44d0-... | OffpeakAirBNB | offpeakairbnb | active | (null) | (null) | (null) |
| 5f0d45a1-... | Parts Unknown BC | parts-unknown-bc | active | (null) | (null) | (null) |
| 9a4e1b47-... | Remote Serve | remote-serve | active | b1252093-... | (null) | (null) |
| 19a451b8-... | Save Paradise Parking | save-paradise-parking | active | 7d8e6df5-... | (null) | (null) |
| 4813f3fd-... | Woods End Landing Cottages | woods-end-landing | active | d0000000-... | (null) | (null) |

**Key Finding:** All 12 portals have `anchor_community_id = NULL`. Migration 176 added the column but data needs population.

---

### A2) ALL Service Run Communities (cc_sr_communities) - 50 total

| Name | Latitude | Longitude |
|------|----------|-----------|
| Alert Bay | 50.5833 | -126.9333 |
| Bamfield | 48.8330 | -125.1360 |
| Bella Coola | 52.3833 | -126.7500 |
| Campbell River | 50.0244 | -125.2475 |
| Comox | 49.6733 | -124.9022 |
| ... (50 BC communities with full geo coverage) |
| Tofino | 49.1530 | -125.9066 |
| Ucluelet | 48.9424 | -125.5466 |
| Zeballos | 49.9833 | -126.8500 |

**All 50 communities have lat/lng populated.**

---

### A3) Public Communities (cc_communities) - 3 total

| Name | Latitude | Longitude | Portal ID |
|------|----------|-----------|-----------|
| Bamfield | (null) | (null) | (null) |
| Tofino | (null) | (null) | (null) |
| Ucluelet | (null) | (null) | (null) |

**Finding:** Public communities lack geo data and portal linkage. cc_sr_communities is the authoritative geo source.

---

### A4) Community Hierarchy

**No parent columns found** in either cc_communities or cc_sr_communities.

---

### A5) Zones per Portal (6 zones)

| Portal | Zone | Key | Kind |
|--------|------|-----|------|
| Bamfield Community Portal | Deer Group | deer-group | neighborhood |
| Bamfield Community Portal | East Bamfield | east-bamfield | neighborhood |
| Bamfield Community Portal | Helby Island | helby-island | neighborhood |
| Bamfield Community Portal | West Bamfield | west-bamfield | neighborhood |
| Bamfield QA Portal | Downtown Core | test-zone-1 | neighborhood |
| Bamfield QA Portal | Waterfront District | test-zone-2 | neighborhood |

**All zones are type "neighborhood".**

---

### A6) Bamfield Area Deep Dive

| Type | Name |
|------|------|
| community | Bamfield |
| portal | Bamfield Adventure Center |
| portal | Bamfield Community Portal |
| portal | Bamfield QA Portal |
| zone | East Bamfield |
| zone | Helby Island |
| zone | West Bamfield |

**Model:** 3 Bamfield portals, 1 Bamfield community (cc_sr_communities), 4 zones within Bamfield Community Portal. No Anacla zone exists yet.

---

## PART 2: SURFACE SPINE ARCHITECTURE

### B1) Surface-Related Tables (18 found)

| Table | Purpose |
|-------|---------|
| cc_surfaces | Core surface definitions |
| cc_surface_units | Atomic units within surfaces |
| cc_surface_containers | Container groupings |
| cc_surface_container_members | Container membership |
| cc_surface_claims | Reservation claims on surfaces |
| cc_surface_tasks | Tasks assigned to surfaces |
| cc_surface_utility_bindings | Utility connections |
| cc_n3_surface_requirements | N3 run surface requirements |
| cc_n3_segments | Run segments (time blocks) |
| cc_route_segments | Road/path segments |
| cc_route_alternatives | Alternative routes |
| cc_route_constraints | Route constraints |
| cc_disclosure_surface_sets | Disclosure groupings |
| cc_embed_surfaces | Embedded surface views |
| cc_trip_route_points | Trip waypoints |
| cc_trip_segment_templates | Trip templates |
| cc_utility_nodes | Utility connection points |

---

### B2) cc_surfaces Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| portal_id | uuid | Owning portal |
| tenant_id | uuid | Tenant (optional) |
| surface_type | varchar | Type category |
| title | varchar | Display name |
| length_mm, width_mm | integer | Dimensions |
| area_sqmm | bigint | Area |
| linear_mm | integer | Linear distance |
| min_clear_width_mm | integer | Accessibility |
| max_slope_pct | numeric | Slope grade |
| has_grates | boolean | Grate hazard |
| surface_tags | text[] | Labels |
| utility_type | varchar | Utility category |
| utility_connector | varchar | Connection type |
| metadata | jsonb | Extended data |

---

### B3) Surface Types (5 types)

| surface_type | Examples |
|--------------|----------|
| **movement** | Dock Ramp Surface, Boardwalk Grated |
| **sit** | Table Seating, Canoe Hull, Kayak Hull |
| **sleep** | Bunk Mattress, Sofa Bed, Floor Zone |
| **stand** | Stall Footprint, Slip Moorage Edge |
| **utility** | Power Outlet (electricity) |

---

### B4) cc_surface_units Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| portal_id | uuid | Owning portal |
| surface_id | uuid | FK → cc_surfaces |
| unit_type | varchar | Type (stall, slip, etc.) |
| unit_index | integer | Position number |
| label | varchar | Display label |
| unit_max_lbs | integer | Weight capacity |
| unit_tags | text[] | Labels |
| metadata | jsonb | Extended data |

---

### B7/B8) Surface Linkage to Work Areas / Properties

**No surface columns found** in cc_work_areas or cc_properties.

Surfaces link via portal_id, not property_id. Work Areas link to Properties, but not directly to Surfaces.

---

## PART 3: ROUTE & PATH ARCHITECTURE

### C1) Route/Path Tables (12 found)

| Table | Purpose |
|-------|---------|
| cc_route_segments | Road segments with geo |
| cc_route_alternatives | Alternative routes |
| cc_route_constraints | Route constraints |
| cc_n3_segments | N3 run time segments |
| cc_trip_route_points | Trip waypoints |
| cc_trip_segment_templates | Trip templates |
| cc_legal_holds | Legal hold (false positive) |
| cc_circle_delegations | Circle delegation (false positive) |

---

### cc_route_segments Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | varchar | PK |
| name | varchar | Segment name |
| start_location_name | varchar | Origin label |
| start_lat, start_lng | numeric | Origin geo |
| end_location_name | varchar | Destination label |
| end_lat, end_lng | numeric | Destination geo |
| distance_km | numeric | Length |
| typical_duration_minutes | integer | Travel time |
| route_type | varchar | Type (road, ferry, etc.) |
| road_surface | varchar | Surface condition |
| highway_numbers | text[] | Highway refs |
| minimum_vehicle_class | varchar | Required vehicle |
| winter_tires_required | boolean | Seasonal requirement |
| chains_may_be_required | boolean | Seasonal requirement |
| high_clearance_recommended | boolean | Vehicle recommendation |
| hazards | text[] | Known hazards |
| conditions_source | varchar | Data source |

---

### cc_n3_segments Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| tenant_id | uuid | Tenant |
| run_id | uuid | FK → cc_n3_runs |
| segment_kind | text | Type (travel, work, wait) |
| starts_at | timestamp | Start time |
| ends_at | timestamp | End time |
| start_window | jsonb | Flexible start |
| end_window | jsonb | Flexible end |
| location_ref | text | Location reference |
| depends_on_segment_id | uuid | Dependency chain |
| constraints | jsonb | Segment constraints |

---

### C3) Route Foreign Keys

| From Table | Column | To Table |
|------------|--------|----------|
| cc_n3_segments | run_id | cc_n3_runs |
| cc_route_alternatives | primary_segment_id | cc_route_segments |
| cc_route_alternatives | alternative_segment_id | cc_route_segments |
| cc_trip_route_points | trip_id | cc_trips |
| cc_trip_segment_templates | trip_id | cc_road_trips |

---

## PART 4: WEATHER & CONSTRAINTS

### D1) Weather/Constraint Tables (17 found)

| Table | Purpose |
|-------|---------|
| cc_weather_normals | Historical weather averages |
| cc_weather_trends | Weather trend data |
| cc_tide_predictions | Tide height predictions |
| cc_sailing_schedules | Ferry schedules |
| cc_transport_schedules | Transport schedules |
| cc_schedules | General schedules |
| cc_access_constraints | Access restrictions |
| cc_asset_constraints | Asset-level constraints |
| cc_community_constraint_packs | Community constraint bundles |
| cc_route_constraints | Route-level constraints |
| cc_spatial_constraints | Geo-based constraints |
| cc_sr_constraints | Service run constraints |
| cc_sr_service_constraints | Service-level constraints |
| cc_visibility_profile_windows | Visibility time windows |
| cc_resource_schedule_events | Resource scheduling |
| cc_contract_payment_schedule | Payment schedules |
| cc_enforcement_fine_schedule | Fine schedules |

---

### cc_weather_normals Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| location_ref | text | Location identifier |
| day_of_year | integer | Day (1-365) |
| temp_low_c | numeric | Min temperature |
| temp_high_c | numeric | Max temperature |
| rain_prob | numeric | Rain probability |
| fog_prob | numeric | Fog probability |
| wind_prob | numeric | Wind probability |

---

### cc_tide_predictions Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| location_ref | text | Location identifier |
| ts | timestamp | Prediction time |
| height_m | numeric | Tide height in meters |

---

### cc_route_constraints Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| work_order_id | uuid | FK to work order |
| constraint_type | text | Type (weather, tide, etc.) |
| description | text | Human description |
| affects_route | text | Affected route |
| valid_from | date | Start date |
| valid_until | date | End date |
| source | text | Data source |
| source_url | text | Source link |
| is_active | boolean | Currently active |

---

## PART 5: WORK AREA PRECISION

### E4) cc_work_areas Schema

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| tenant_id | uuid | Tenant |
| property_id | uuid | FK → cc_properties |
| title | text | Area name |
| description | text | Details |
| tags | text[] | Labels |
| created_by | uuid | Creator |
| created_at | timestamp | Created |
| updated_at | timestamp | Updated |

**Finding:** cc_work_areas is minimal. No surface, access, or utility columns. Links only to properties.

---

### E3) Work Area → Property Chain

**No data returned.** cc_work_areas table is empty.

---

## PART 6: EXISTING SUGGESTION/DISCOVERY SYSTEMS

### F1) Nearby/Suggestion Code

| Location | Feature |
|----------|---------|
| `server/routes/work-requests.ts:995` | `/coordination/suggest-windows` endpoint |
| `server/routes/public-portal.ts:2131` | `/recommendations` weather-aware suggestions |
| `server/routes/public-portal.ts:2192` | `/carts/:cartId/recommend` cart-based suggestions |
| `server/services/contractorRouteOpportunityEngine.ts` | Route opportunity suggestions |
| `server/services/contractorServiceAreaInference.ts:281` | `findNearbyPortalsAndZones()` function |

### F2) Surface Traversal Code

| Location | Feature |
|----------|---------|
| `server/routes/dev-seed-n3.ts:198` | Dock ramp traversal (wheelchair accessible) |
| `server/routes/dev-seed-n3.ts:222` | Boardwalk traversal (walking) |

### F3) Weather Constraint Code

| Location | Feature |
|----------|---------|
| `server/lib/n3/evaluator.ts:198` | Optimal tide window calculation |
| `server/routes/proposals.ts:971` | Tide-sensitive arrival windows |
| `server/migrations/034_collaboration_trust_layer.sql` | Tide window metadata |

---

## PART 7: SUMMARY & QUESTIONS

### 1. SURFACE TAXONOMY

**5 surface types exist:**
- `movement` - Traversable paths (ramps, boardwalks)
- `sit` - Seating surfaces (tables, boat hulls)
- `sleep` - Sleeping surfaces (beds, mattresses)
- `stand` - Standing/parking surfaces (stalls, slips)
- `utility` - Utility connections (power outlets)

**Linkage:** Surfaces link to portals via `portal_id`. No direct property linkage.

---

### 2. TRAVERSAL MODEL

**Run structure:**
- `cc_n3_runs` - Core run record (has `start_address_id`, `zone_id`)
- `cc_n3_segments` - Time blocks within run (segment_kind: travel/work/wait)
- `cc_n3_surface_requirements` - Surface needs for run

**Origin → Destination:**
- Origin: `cc_n3_runs.start_address_id` → `cc_tenant_start_addresses` (lat/lng)
- Destination: `cc_n3_runs.zone_id` → `cc_zones.portal_id` → `cc_portals.anchor_community_id` (NEW, needs population)

---

### 3. CONSTRAINT MODEL

**Weather affects access via:**
- `cc_weather_normals` - Historical averages by day-of-year
- `cc_tide_predictions` - Tide heights by timestamp
- `cc_route_constraints` - Active route restrictions

**Time windows calculated in:**
- `server/lib/n3/evaluator.ts` - N3 evaluator with tide optimization
- `server/routes/work-requests.ts` - Coordination window suggestions

---

### 4. MICRO-PORTAL MODEL

**Bamfield Structure:**
```
cc_sr_communities: Bamfield (48.833, -125.136)
    ├── Portal: Bamfield Community Portal
    │       ├── Zone: East Bamfield
    │       ├── Zone: West Bamfield
    │       ├── Zone: Helby Island
    │       └── Zone: Deer Group
    ├── Portal: Bamfield Adventure Center
    └── Portal: Bamfield QA Portal
```

**"Nearby" definition:**
- `findNearbyPortalsAndZones()` in contractorServiceAreaInference.ts
- Uses haversine distance calculation
- No explicit radius defined (configurable)

---

### 5. QUESTIONS FOR GLENN

1. **Zone Geo Inheritance:** Should zones inherit geo from portal anchor, or should zones have their own community_id FK?

2. **Anacla Zone:** Should Anacla be added as a zone under Bamfield Community Portal?

3. **Surface → Property Linkage:** Is the current portal-only surface model correct, or should surfaces link to properties?

4. **Work Area Surfaces:** Should cc_work_areas have a `surfaces` column to define required surface types for a work area?

5. **Tide Windows:** Is the current tide window logic (optimal height range) sufficient, or do we need boat-specific draft requirements?

6. **Portal Anchor Population:** Which community should each portal anchor to? (Mapping needed)

---

## KEY GAPS IDENTIFIED

| Gap | Impact | Recommended Action |
|-----|--------|-------------------|
| Portal anchors unpopulated | Cannot compute portal distances | Populate anchor_community_id |
| cc_work_areas empty | No precision zones defined | Seed sample data |
| Public communities lack geo | cc_communities has nulls | Use cc_sr_communities only |
| No zone geo | Zones inherit from portal | Document as expected behavior |
| Surface ↔ Property gap | No direct linkage | Clarify model with Glenn |

---

## VERIFIED CHAINS

### Run Origin Chain ✅
```
cc_n3_runs.start_address_id → cc_tenant_start_addresses.latitude/longitude
```

### Run Destination Chain (PENDING)
```
cc_n3_runs.zone_id → cc_zones.portal_id → cc_portals.anchor_community_id → cc_sr_communities.latitude/longitude
```
*Requires anchor_community_id population*

### Surface Unit Chain ✅
```
cc_surface_units.surface_id → cc_surfaces.portal_id → cc_portals
```

### Route Segment Chain ✅
```
cc_route_segments has direct start_lat/lng and end_lat/lng
```

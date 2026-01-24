# V3.5 Geo Inventory - Code Audit

**Generated**: 2026-01-24  
**Purpose**: Identify where coordinates are computed/used in server and client code

## CRITICAL ENVIRONMENT NOTE

**PostGIS NOT available in production.** All distance calculations use:
- `fn_haversine_meters()` SQL UDF
- `haversineDistance()` TypeScript functions
- Grid-cell indexing via `lat_cell`/`lon_cell` integers

---

## B1) Haversine/Distance Calculations

### Server-Side Implementations

**server/services/locationService.ts**
```typescript
// Line 83: Uses haversine for distance
const distance = haversineDistance(...)

// Lines 174-185: Haversine implementation
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Standard haversine formula
}
```

**server/services/entityResolution.ts**
```typescript
// Lines 27-40: Entity matching with haversine
// Uses fn_haversine_meters() UDF instead of PostGIS ST_DWithin
AND fn_haversine_meters($2, $3, latitude::double precision, longitude::double precision) <= 5000
```

**server/services/addressResolutionEngine.ts**
```typescript
// Lines 154, 187: Distance calculations
const distance = calculateDistanceMeters(...)
```

**server/services/contractorRouteOpportunityEngine.ts**
```typescript
// Lines 175, 197: Route opportunity distance
const distance = haversineDistance(lat1, lng1, lat2, lng2)
```

**server/routes/crew.ts**
```typescript
// Lines 238-251: Crew search with haversine
// Uses fn_haversine_meters() for radius filtering
fn_haversine_meters(
  $lat::double precision, $lng::double precision,
  latitude::double precision, longitude::double precision
) <= $radius_meters
```

---

## B2) Location Entity References

### cc_locations Usage

**server/services/transportIntegrationService.ts**
- `originLocationId`, `destinationLocationId` for transport routing
- Queries `ccLocations` table for lat/lon resolution
- Lines 166-177: Fetches origin/destination location geo

**server/routes/transport.ts**
- Lines 280-281: Origin/destination location IDs in transport bookings
- Lines 412-413, 839-840: Location IDs in booking responses
- Lines 851: `consigneeLocationId` for freight

**server/services/transportRequestService.ts**
- Lines 19-20: `originLocationId`, `destinationLocationId` in request interface
- Lines 217-218: Mapping to database fields

---

## B3) API Endpoints Returning Coordinates

### Emergency Routes
**server/routes/emergency.ts:51**
```typescript
lat: z.number().optional(),  // Emergency incident lat
```

### CIVOS Signals
**server/routes/civos.ts:87-88**
```typescript
lat: s.latitude ? parseFloat(s.latitude) : null,
lng: s.longitude ? parseFloat(s.longitude) : null
```

### Public Portal Moments
**server/routes/public-portal.ts:1754-1755**
```typescript
location_lat: moment.location_lat,
location_lng: moment.location_lng,
```

### Staging/Demo Data
**server/routes/staging.ts:824-900**
```typescript
origin: { lat: 49.2827, lng: -123.1207, name: 'Vancouver' },
destination: { lat: 48.4284, lng: -123.3656, name: 'Victoria' },
```

### Transport Routes
**server/routes/transport.ts:1150**
```typescript
lat: b.lat,  // Transport location lat
```

### Command Console
**server/routes/command-console.ts:24-25**
```typescript
lat: 48.83,   // Vancouver Island center
lng: -125.13,
```

### Citations/Enforcement
**server/routes/citations.ts:42, server/routes/enforcement.ts:195**
```typescript
lat: b.lat,
```

### PMS Properties
**server/routes/pms.ts:46**
```typescript
lat: b.lat,
```

---

## B4) Grid-Cell Indexing

Several tables use integer `lat_cell`/`lon_cell` columns for efficient spatial indexing without PostGIS:

| Table | Columns |
|-------|---------|
| cc_assets | lat_cell, lon_cell |
| cc_asset_availability | location_lat_cell, location_lon_cell |
| cc_entities | lat_cell, lon_cell |
| cc_external_records | lat_cell, lon_cell |
| cc_procurement_requests | site_lat_cell, site_lon_cell |
| cc_sr_communities | lat_cell, lon_cell |
| cc_work_orders | site_lat_cell, site_lon_cell |

Grid cells enable fast spatial queries:
```sql
WHERE lat_cell BETWEEN $min_lat_cell AND $max_lat_cell
  AND lon_cell BETWEEN $min_lon_cell AND $max_lon_cell
```

---

## B5) Key Geo Services

| Service | Purpose | Geo Method |
|---------|---------|------------|
| locationService.ts | Location resolution | haversineDistance() |
| entityResolution.ts | Entity matching by proximity | fn_haversine_meters() UDF |
| addressResolutionEngine.ts | Address geocoding/matching | calculateDistanceMeters() |
| contractorRouteOpportunityEngine.ts | Route optimization | haversineDistance() |
| transportIntegrationService.ts | Transport origin/dest lookup | cc_locations FK join |

---

## Summary

1. **No PostGIS dependency** - All geo uses standard numeric columns
2. **Haversine everywhere** - Distance calculations via TypeScript or SQL UDF
3. **Grid-cell optimization** - Integer cells for fast spatial filtering
4. **cc_locations as transport hub** - Primary source for terminal/stop geo
5. **50+ tables with coordinates** - Extensive geo coverage across platform

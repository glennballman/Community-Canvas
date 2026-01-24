# V3.5 STEP 8: Origin Readiness Implementation Proof

**Date**: 2026-01-24
**Status**: COMPLETE

## Overview

STEP 8 implements origin readiness checks for the publish suggestions system. This ensures providers receive accurate distance estimates by validating that their run's start address has valid coordinates.

## Implementation Summary

### 8A: Coordinate Validation (Backend)

**Files Modified**: `server/routes/provider.ts`

Both-or-none validation enforced on:
- POST `/api/provider/start-addresses` (lines 1175-1184)
- PATCH `/api/provider/start-addresses/:id` (lines 1313-1322)

```typescript
// Both-or-none check
const hasLat = body.latitude !== undefined && body.latitude !== null;
const hasLng = body.longitude !== undefined && body.longitude !== null;
if (hasLat !== hasLng) {
  return res.status(400).json({ 
    ok: false, 
    error: 'invalid_coordinates', 
    message: 'Enter both latitude and longitude (or leave both blank)' 
  });
}

// Range validation
if (hasLat && hasLng) {
  if (body.latitude < -90 || body.latitude > 90) {
    return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Latitude must be between -90 and 90' });
  }
  if (body.longitude < -180 || body.longitude > 180) {
    return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Longitude must be between -180 and 180' });
  }
}
```

### 8B: Frontend Coordinate Fields

**Files Modified**: `client/src/components/provider/StartAddressPickerModal.tsx`

- Added latitude and longitude input fields to the address form
- Client-side both-or-none validation matching backend rules
- Numeric range validation (lat: -90 to 90, lng: -180 to 180)

### 8C: Origin State Detection

**Files Modified**: `server/routes/provider.ts` (publish-suggestions endpoint)

Four distance confidence modes:
1. `ok` - Full coordinates available, haversine distance calculated
2. `unknown` - Portal has no anchor community
3. `no_origin` - Run has no start_address_id
4. `no_origin_coords` - Run has start_address but no coordinates

Three origin states returned in response:
- `no_address` - No start_address_id on run
- `has_address_no_coords` - Address exists but missing lat/lng
- `has_coords` - Full coordinates available

```typescript
// Determine origin state for preflight banner
let originState: 'no_address' | 'has_address_no_coords' | 'has_coords' = 'no_address';
if (run?.start_address_id) {
  originState = (origin_lat != null && origin_lng != null) ? 'has_coords' : 'has_address_no_coords';
}

// Response structure
origin: {
  start_address_id: run?.start_address_id || null,
  origin_lat,
  origin_lng,
  origin_state: originState
}
```

### 8D: Preflight Banner UI

**Files Modified**: `client/src/components/provider/PublishRunModal.tsx`

Alert banner shown when `origin_state !== 'has_coords'`:
- Different messages based on origin_state
- CTA button opens StartAddressPickerModal
- Automatic cache invalidation when address modal closes

```tsx
{suggestionsData && suggestionsData.origin.origin_state !== 'has_coords' && (
  <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
    <Navigation className="w-4 h-4 text-amber-600" />
    <AlertDescription>
      <span>
        {suggestionsData.origin.origin_state === 'no_address'
          ? resolve('provider.publish.suggestions.no_origin')
          : resolve('provider.publish.suggestions.no_origin_coords')}
      </span>
      <Button variant="outline" size="sm" onClick={() => setAddressModalOpen(true)}>
        <MapPin className="w-3 h-3 mr-1" />
        {suggestionsData.origin.origin_state === 'no_address'
          ? resolve('provider.publish.preflight.set_address')
          : resolve('provider.publish.preflight.add_coords')}
      </Button>
    </AlertDescription>
  </Alert>
)}
```

### 8E: Copy Tokens

**Files Modified**: `client/src/copy/entryPointCopy.ts`

New tokens added:
```typescript
'provider.publish.suggestions.no_origin_coords': 'Add coordinates to enable distance estimates',
'provider.publish.preflight.set_address': 'Set start address',
'provider.publish.preflight.add_coords': 'Add coordinates',
```

## Test Scenarios

| Origin State | Banner Shown | CTA Text | Distance Confidence |
|-------------|--------------|----------|---------------------|
| no_address | Yes | "Set start address" | no_origin |
| has_address_no_coords | Yes | "Add coordinates" | no_origin_coords |
| has_coords | No | N/A | ok (with distance) or unknown (if portal has no anchor) |

## Confidence Mode Sorting

Suggestions sorted by confidence priority:
1. `ok` - By distance ascending
2. `unknown` - Alphabetically by zone name
3. `no_origin_coords` - Alphabetically by zone name
4. `no_origin` - Alphabetically by zone name

## Verification Queries

```sql
-- Check addresses with coordinates
SELECT id, label, latitude, longitude 
FROM cc_tenant_start_addresses 
WHERE latitude IS NOT NULL;

-- Check run origin states
SELECT r.id, r.start_address_id, a.latitude, a.longitude,
  CASE 
    WHEN r.start_address_id IS NULL THEN 'no_address'
    WHEN a.latitude IS NULL THEN 'has_address_no_coords'
    ELSE 'has_coords'
  END as origin_state
FROM cc_n3_runs r
LEFT JOIN cc_tenant_start_addresses a ON a.id = r.start_address_id;
```

## Files Modified

1. `server/routes/provider.ts` - Backend validation and origin state logic
2. `client/src/components/provider/StartAddressPickerModal.tsx` - Coordinate input fields
3. `client/src/components/provider/PublishRunModal.tsx` - Preflight banner
4. `client/src/copy/entryPointCopy.ts` - New copy tokens

## Status

All STEP 8 requirements implemented and verified:
- [x] Both-or-none coordinate validation (backend + frontend)
- [x] Four confidence modes (ok, unknown, no_origin, no_origin_coords)
- [x] Three origin states (no_address, has_address_no_coords, has_coords)
- [x] Preflight banner with dynamic CTA
- [x] StartAddressPickerModal integration
- [x] Copy tokens for all new UI elements

# AUDIT: Migration 192 - Portal Listings Disclosure Substrate

**Date**: 2026-01-27  
**Status**: ✅ COMPLETE  
**Security Level**: CRITICAL  

## Summary

This audit documents the implementation of the cc_portal_listings table as the canonical disclosure substrate for the Community Canvas V3.5 portal system. Without explicit listing entries, assets are NOT visible or reservable on any portal.

## The Problem

Prior to this migration, the public availability endpoint at `/api/public/cc_portals/:slug/availability` queried `cc_assets` directly using `owner_tenant_id` filtering. This created a security vulnerability where:

1. **All tenant assets were automatically disclosed** on any portal owned by that tenant
2. **No opt-in visibility control** existed for portal-specific inventory management
3. **Asset enumeration attacks** could discover private inventory through tenant association

## The Solution: cc_portal_listings

### Table Schema
```sql
CREATE TABLE cc_portal_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES cc_portals(id),
    asset_id UUID NOT NULL REFERENCES cc_assets(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    visibility TEXT NOT NULL DEFAULT 'public',
    display_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cc_portal_listings_portal_asset_unique UNIQUE (portal_id, asset_id)
);
```

### RLS Policies
- **Service mode bypass**: `is_service_mode()` for system operations
- **Public read**: Only for `is_active = true AND visibility = 'public'`
- **Tenant manage**: Portal owners can manage their listings

## Hardened Endpoints

### 1. GET /api/public/cc_portals/:slug/availability

**Before** (VULNERABLE):
```sql
SELECT id, name, asset_type, ...
FROM cc_assets
WHERE owner_tenant_id = $1 AND status = 'active'
```

**After** (DISCLOSURE-SAFE):
```sql
SELECT a.id, a.name, a.asset_type, ...
FROM cc_portal_listings pl
JOIN cc_assets a ON a.id = pl.asset_id
WHERE pl.portal_id = $1
  AND pl.is_active = true
  AND pl.visibility = 'public'
  AND a.status = 'active'
```

### 2. POST /api/public/cc_portals/:slug/cc_reservations

**Before** (VULNERABLE):
- Validated asset existed and belonged to tenant
- Did NOT verify disclosure status

**After** (DISCLOSURE-SAFE):
```sql
SELECT pl.id, a.id as asset_id, ...
FROM cc_portal_listings pl
JOIN cc_assets a ON a.id = pl.asset_id
WHERE pl.portal_id = $1
  AND pl.asset_id = $2
  AND pl.is_active = true
  AND pl.visibility = 'public'
  AND a.status = 'active'
```

Returns `{"success": false, "error": "not_disclosed"}` for unlisted assets.

## Test Evidence

### Test 1: Empty Listings Return No Assets
```bash
$ curl 'http://localhost:5000/api/public/cc_portals/experience-bamfield/availability?start=2026-02-01&end=2026-02-07'
{
  "success": true,
  "portal": {"id": "eb000000-...", "slug": "experience-bamfield", "name": "Experience Bamfield"},
  "assets": [],
  "summary": {"total": 0, "available": 0, "reserved": 0}
}
```

### Test 2: Reservation Blocked for Undisclosed Assets
```bash
$ curl -X POST 'http://localhost:5000/api/public/cc_portals/experience-bamfield/cc_reservations' \
  -H 'Content-Type: application/json' \
  -d '{"asset_id": "12345678-...", "start": "...", "end": "...", "customer": {...}}'
{
  "success": false,
  "error": "not_disclosed"
}
```

## Security Invariants

1. **Empty cc_portal_listings = Zero disclosure**: Portal shows no assets
2. **Asset enumeration impossible**: Cannot probe for assets via asset_id parameter
3. **Safe error messages**: `not_disclosed` doesn't confirm asset existence
4. **Display ordering**: Operators control listing presentation order

## Files Modified

- `server/migrations/192_portal_listings.sql` - Migration creating table and RLS
- `shared/schema.ts` - Drizzle schema for ccPortalListings
- `server/routes/public-portal.ts` - Hardened availability (line ~1199) and reservation (line ~1436) endpoints

## Compliance

- **C0-STRICT**: Public search only returns disclosed assets ✅
- **C1-A**: Disclosure linkage via portal_id + asset_id ✅
- **V3.5 Direct Flow**: Reserve validates disclosure before insert ✅

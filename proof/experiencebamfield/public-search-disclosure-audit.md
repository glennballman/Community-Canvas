# Public Search Disclosure Audit — Experience Bamfield

**Audit Date:** 2026-01-26  
**Endpoint:** `GET /api/public/cc_portals/:slug/availability`  
**File:** `server/routes/public-portal.ts` lines 1166-1280

## 1. Route Handler Location

```
File: server/routes/public-portal.ts
Lines: 1166-1280
Handler: router.get('/cc_portals/:slug/availability', ...)
```

No external service functions are called. All queries are inline within the handler.

## 2. Disclosure Gates Identified

### 2.1 Portal Scoping (Line 1185-1191)

```sql
SELECT id, name, slug, owning_tenant_id 
FROM cc_portals 
WHERE slug = $1 AND status = 'active'
```

**Gate:** `status = 'active'` — Only active portals can be queried.

### 2.2 Tenant + Asset Filtering (Lines 1197-1217)

```sql
SELECT id, name, asset_type, schema_type, description, thumbnail_url
FROM cc_assets
WHERE owner_tenant_id = $1 
  AND status = 'active'
  AND is_available = true
```

**Gates:**
- `owner_tenant_id = $1` — Assets must belong to the portal's owning tenant
- `status = 'active'` — Only active assets
- `is_available = true` — Only assets marked as available

### 2.3 Additional Optional Filters (Lines 1207-1217)

```sql
-- Optional asset_type filter
AND asset_type = $N

-- Optional asset_id filter  
AND id = $N::uuid
```

These narrow results but do NOT add disclosure restrictions.

## 3. Disclosure Model Analysis

### Current Model

| Field | Table | Purpose |
|-------|-------|---------|
| `status = 'active'` | cc_portals | Portal operational status |
| `status = 'active'` | cc_assets | Asset operational status |
| `is_available = true` | cc_assets | Availability flag |
| `owner_tenant_id` | cc_assets | Tenant ownership scoping |

### What Is Missing

| Missing Check | Risk |
|---------------|------|
| `is_published` field | No explicit publish/draft state |
| Portal-to-Asset linking table | No explicit disclosure per portal |
| Offer/Listing status check | No join to `cc_offers.is_active` |

## 4. Threat Model

### 4.1 Assets with schedules but no published listing

**Status:** ⚠️ POTENTIAL LEAK  
**Reason:** Any asset with `is_available=true` is returned regardless of whether an offer exists.  
**Mitigation:** For Experience Bamfield, operators must set `is_available=false` for unpublished inventory.

### 4.2 Assets attached to tenant but not portal

**Status:** ⚠️ POTENTIAL LEAK  
**Reason:** All assets owned by portal's `owning_tenant_id` are returned, not just assets explicitly linked to this portal.  
**Impact:** If tenant operates multiple portals, all tenant assets appear on all portals.  
**Mitigation:** Experience Bamfield currently has one portal per tenant (Bamfield Community), so this is not an immediate issue.

### 4.3 Internal-only offers

**Status:** ⚠️ NOT CHECKED  
**Reason:** `cc_offers` table is not joined. Offer visibility is not enforced.  
**Mitigation:** Asset-level `is_available` flag serves as proxy disclosure gate.

### 4.4 Mis-scoped portalSlug

**Status:** ✅ BLOCKED  
**Reason:** Portal lookup validates `slug` matches an active portal. Invalid slugs return 404.

### 4.5 Direct assetId lookup via query params

**Status:** ⚠️ POTENTIAL LEAK  
**Reason:** `asset_id` param can query any asset owned by the portal's tenant, bypassing type filtering.  
**Mitigation:** Asset still requires `status='active'` and `is_available=true`.

### 4.6 Reservation/schedule data leakage

**Status:** ✅ ACCEPTABLE  
**Reason:** busy_periods returned contain only date ranges and source type, no guest PII.

## 5. Truth vs Disclosure Architecture

**Current Implementation:** Direct table access with inline filtering.

| Aspect | Assessment |
|--------|------------|
| Uses Truth tables | Yes — `cc_assets`, `cc_reservations`, `cc_resource_schedule_events` |
| Disclosure layer | Inline WHERE clauses only |
| Dedicated disclosure view | No |
| Offer/listing join | No |

The endpoint accesses "truth" tables directly with row-level filtering, rather than using a dedicated disclosure-safe view.

## 6. Experience Bamfield Configuration Status

```sql
-- Portal record
SELECT id, slug, status, owning_tenant_id 
FROM cc_portals 
WHERE slug = 'experience-bamfield';

-- Result: eb000000-0000-0000-0000-000000000001, active, 25a53fc1-...
```

**Current State:**
- Portal is `status = 'active'` ✅
- Portal links to Bamfield Community tenant ✅
- Tenant assets will be disclosed if `is_available = true` ⚠️

## 7. Conclusion

### Safety Rating: CONDITIONALLY SAFE

**Safe to expose publicly** with the following operational requirements:

1. **Operator discipline:** Assets must have `is_available = false` until ready for public disclosure
2. **Single-portal tenant:** Current setup has one portal per tenant, avoiding cross-portal disclosure
3. **No PII in busy_periods:** Reservation data returned is date-only, acceptable for public exposure

### Recommendations for Future Hardening (Out of Scope)

1. Add `is_published` column to `cc_assets` for explicit disclosure control
2. Create `cc_portal_asset_listings` junction table for portal-specific disclosure
3. Join to `cc_offers` to enforce offer-level visibility
4. Consider dedicated disclosure views instead of inline filtering

## 8. Approval to Proceed

**Verdict:** ✅ SAFE to proceed with Prompt C (Search + Results UI)

The endpoint provides adequate disclosure gates for Experience Bamfield's current operational model. Operators control disclosure via `is_available` flag.

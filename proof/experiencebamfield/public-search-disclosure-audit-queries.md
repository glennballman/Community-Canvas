# Public Search Disclosure Audit — SQL Evidence

**Endpoint:** `GET /api/public/cc_portals/:slug/availability`  
**File:** `server/routes/public-portal.ts`

## Query 1: Portal Lookup (Lines 1185-1187)

```sql
SELECT id, name, slug, owning_tenant_id 
FROM cc_portals 
WHERE slug = $1 AND status = 'active'
```

**Disclosure Filter:** `status = 'active'`

## Query 2: Assets Query (Lines 1197-1217)

```sql
SELECT id, name, asset_type, schema_type, description, thumbnail_url
FROM cc_assets
WHERE owner_tenant_id = $1        -- tenant scoping
  AND status = 'active'           -- DISCLOSURE GATE
  AND is_available = true         -- DISCLOSURE GATE
```

**Disclosure Filters:**
- `status = 'active'` — Operational status gate
- `is_available = true` — Availability disclosure gate
- `owner_tenant_id = $1` — Tenant ownership scoping

**Optional Filters (narrow, not disclosure):**
```sql
AND asset_type = $N    -- If asset_type param provided
AND id = $N::uuid      -- If asset_id param provided
```

## Query 3: Reservation Conflicts (Lines 1224-1232)

```sql
SELECT id, start_date, end_date, status
FROM cc_reservations
WHERE asset_id = $1
  AND status NOT IN ('cancelled')
  AND (start_date < $3 AND end_date > $2)
```

**Purpose:** Check for overlapping reservations  
**Data Returned:** Date ranges only (no PII)

## Query 4: Schedule Events (Lines 1235-1243)

```sql
SELECT id, start_date, end_date, status
FROM cc_resource_schedule_events
WHERE resource_id = $1
  AND status NOT IN ('cancelled')
  AND (start_date < $3 AND end_date > $2)
```

**Purpose:** Check for scheduled blocks  
**Data Returned:** Date ranges only (no PII)

## Summary: Disclosure Gates

| Query | Table | Gate Field | Gate Value |
|-------|-------|------------|------------|
| 1 | cc_portals | status | 'active' |
| 2 | cc_assets | status | 'active' |
| 2 | cc_assets | is_available | true |
| 2 | cc_assets | owner_tenant_id | = portal.owning_tenant_id |

## Verification Commands

```bash
# Confirm no additional cart/offer joins in availability endpoint
rg -n "cc_offer|cc_cart|cc_reservation_cart" server/routes/public-portal.ts

# Confirm disclosure filters present
rg -n "is_available|status.*active" server/routes/public-portal.ts | head -20
```

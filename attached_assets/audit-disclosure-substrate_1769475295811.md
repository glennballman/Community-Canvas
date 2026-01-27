# Community Canvas V3.5 — Audit Prompt A1
## Discover Canonical Disclosure Substrate

**Purpose:** Identify if a Portal → Listing/Offer → Asset join path already exists  
**Scope:** READ-ONLY audit. Do not modify any files or tables.

---

## OBJECTIVE

Before wiring disclosure logic, we need to know:

1. **Does a "portal listings" or "published offers" table already exist?**
2. **Is there a generic join path from Portal → [Something] → Asset?**
3. **Where is visibility/disclosure currently enforced (if at all)?**

---

## PHASE 1: Schema Discovery

### 1A: Find All Portal-Related Tables

```sql
-- Find tables that might link portals to assets
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'cc_%'
  AND (
    column_name LIKE '%portal%'
    OR column_name LIKE '%listing%'
    OR column_name LIKE '%offer%'
    OR column_name LIKE '%publish%'
    OR column_name LIKE '%disclosure%'
    OR column_name LIKE '%visibility%'
  )
ORDER BY table_name, ordinal_position;
```

### 1B: Find Tables with Both Portal and Asset References

```sql
-- Tables that could be the join table
SELECT 
  t.table_name,
  array_agg(c.column_name ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'cc_%'
  AND t.table_name IN (
    -- Tables that have BOTH portal_id and asset_id (or similar)
    SELECT DISTINCT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2 ON c1.table_name = c2.table_name
    WHERE c1.table_schema = 'public'
      AND c2.table_schema = 'public'
      AND (c1.column_name LIKE '%portal%' OR c1.column_name = 'portal_id')
      AND (c2.column_name LIKE '%asset%' OR c2.column_name = 'asset_id' 
           OR c2.column_name LIKE '%offer%' OR c2.column_name LIKE '%facility%')
  )
GROUP BY t.table_name;
```

### 1C: List All Candidate Tables

```sql
-- List tables that might be the disclosure substrate
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%listing%'
    OR table_name LIKE '%offer%'
    OR table_name LIKE '%publish%'
    OR table_name LIKE '%catalog%'
    OR table_name LIKE '%moment%'
    OR table_name LIKE '%presentation%'
    OR table_name LIKE '%display%'
  )
ORDER BY table_name;
```

---

## PHASE 2: Examine Known Candidate Tables

Based on prior conversations, these tables might be the substrate:

### 2A: cc_portal_moments (Activities/Experiences)

```sql
-- Check if cc_portal_moments exists and its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cc_portal_moments'
ORDER BY ordinal_position;

-- Check record count and sample
SELECT COUNT(*) as total, 
       COUNT(DISTINCT portal_id) as portals,
       COUNT(DISTINCT asset_id) as assets
FROM cc_portal_moments;

-- Sample join path
SELECT 
  p.slug as portal_slug,
  pm.name as moment_name,
  pm.asset_id,
  a.name as asset_name,
  pm.is_active,
  pm.is_public
FROM cc_portal_moments pm
JOIN cc_portals p ON pm.portal_id = p.id
LEFT JOIN cc_assets a ON pm.asset_id = a.id
LIMIT 5;
```

### 2B: cc_offers (Pricing/Bookable Items)

```sql
-- Check if cc_offers exists and its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cc_offers'
ORDER BY ordinal_position;

-- Check for portal linkage
SELECT COUNT(*) as total,
       COUNT(portal_id) as with_portal,
       COUNT(asset_id) as with_asset,
       COUNT(facility_id) as with_facility
FROM cc_offers;

-- Sample join path
SELECT 
  p.slug as portal_slug,
  o.name as offer_name,
  o.offer_type,
  o.asset_id,
  o.facility_id,
  o.is_active,
  o.is_public
FROM cc_offers o
LEFT JOIN cc_portals p ON o.portal_id = p.id
LIMIT 5;
```

### 2C: cc_portal_offers (Junction Table?)

```sql
-- Check if junction table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cc_portal_offers'
ORDER BY ordinal_position;

-- If exists, sample data
SELECT * FROM cc_portal_offers LIMIT 5;
```

### 2D: cc_portal_facilities (Facility Listings?)

```sql
-- Check if portal-facility junction exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name LIKE 'cc_portal%facil%'
ORDER BY table_name, ordinal_position;

-- Or direct linkage on facilities
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cc_facilities'
  AND column_name LIKE '%portal%';
```

### 2E: cc_catalog_items or cc_inventory_listings

```sql
-- Check for catalog/inventory listing tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE '%catalog%' OR table_name LIKE '%inventory%listing%')
ORDER BY table_name, ordinal_position;
```

---

## PHASE 3: Check Visibility Columns

### 3A: Which Tables Have Visibility/Disclosure Columns?

```sql
-- Find visibility-related columns
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'cc_%'
  AND (
    column_name IN ('is_public', 'is_active', 'is_visible', 'is_disclosed', 
                    'is_listed', 'is_published', 'visibility', 'disclosure_mode',
                    'participation_mode', 'listing_status', 'publish_status')
    OR column_name LIKE '%visible%'
    OR column_name LIKE '%public%'
    OR column_name LIKE '%disclose%'
  )
ORDER BY table_name;
```

### 3B: Check cc_assets for Visibility Columns

```sql
-- What visibility controls exist on assets directly?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cc_assets'
  AND (
    column_name LIKE '%public%'
    OR column_name LIKE '%visible%'
    OR column_name LIKE '%active%'
    OR column_name LIKE '%status%'
    OR column_name LIKE '%available%'
    OR column_name LIKE '%portal%'
  )
ORDER BY ordinal_position;
```

### 3C: Check cc_facilities for Visibility Columns

```sql
-- What visibility controls exist on facilities?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cc_facilities'
  AND (
    column_name LIKE '%public%'
    OR column_name LIKE '%visible%'
    OR column_name LIKE '%active%'
    OR column_name LIKE '%status%'
    OR column_name LIKE '%participation%'
    OR column_name LIKE '%portal%'
  )
ORDER BY ordinal_position;
```

---

## PHASE 4: Trace Current Public Availability Query

### 4A: What Does public-portal.ts Currently Query?

Look at `server/routes/public-portal.ts` around line 1166-1220 and report:

1. Which tables are queried for availability?
2. What WHERE clauses filter visibility?
3. Is there a join to any "listing" or "offer" table?

### 4B: How Does PortalReservePage Get Its Data?

Look at the client component that displays availability and report:
1. What API endpoint does it call?
2. What fields does it expect in the response?

---

## PHASE 5: Generate Substrate Report

Create this summary table:

```
DISCLOSURE SUBSTRATE AUDIT
══════════════════════════════════════════════════════════════

CANDIDATE TABLES FOUND
──────────────────────────────────────────────────────────────
| Table Name              | Has portal_id | Has asset_id | Has visibility | Records |
|-------------------------|---------------|--------------|----------------|---------|
| cc_portal_moments       | ?             | ?            | ?              | ?       |
| cc_offers               | ?             | ?            | ?              | ?       |
| cc_portal_offers        | ?             | ?            | ?              | ?       |
| cc_portal_facilities    | ?             | ?            | ?              | ?       |
| cc_catalog_items        | ?             | ?            | ?              | ?       |
| [other discovered]      | ?             | ?            | ?              | ?       |

VISIBILITY COLUMNS BY TABLE
──────────────────────────────────────────────────────────────
| Table Name       | Column            | Type    | Current Usage |
|------------------|-------------------|---------|---------------|
| cc_assets        | is_available      | boolean | ?             |
| cc_assets        | status            | varchar | ?             |
| cc_facilities    | [columns found]   | ?       | ?             |
| cc_offers        | is_active         | boolean | ?             |
| cc_offers        | is_public         | boolean | ?             |

CURRENT JOIN PATH (Public Availability)
──────────────────────────────────────────────────────────────
public-portal.ts queries:
  Portal (cc_portals)
    → ??? 
      → Assets (cc_assets)

Filtering applied:
  - [list current WHERE clauses]

RECOMMENDED CANONICAL PATH
──────────────────────────────────────────────────────────────
Option A: Use cc_offers as listing substrate
  Portal → cc_offers (with portal_id) → Asset
  Visibility: cc_offers.is_active, cc_offers.is_public
  
Option B: Use cc_portal_moments as listing substrate  
  Portal → cc_portal_moments → Asset
  Visibility: cc_portal_moments.is_active, cc_portal_moments.is_public

Option C: Create new cc_portal_listings table
  Portal → cc_portal_listings (NEW) → Asset
  Visibility: disclosure_mode, participation_mode

RECOMMENDATION: [A / B / C] because [reason]
```

---

## DELIVERABLE

Return the completed substrate report showing:

1. **What tables exist** that could serve as Portal → Asset linkage
2. **Which already have visibility columns** (is_public, is_active, etc.)
3. **The current query path** in public-portal.ts
4. **Your recommendation** for which table to use as the canonical disclosure substrate

**DO NOT CREATE OR MODIFY ANYTHING. This is a read-only audit.**

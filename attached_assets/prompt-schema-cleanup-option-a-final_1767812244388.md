# PROMPT — SCHEMA CLEANUP: RENAME TABLES (OPTION A)

**STOP. Read this entire prompt before starting.**

We have ZERO customer data. This is the ONE time we can make breaking changes for free.

We are NOT creating views. We are NOT creating mapping tables. We are renaming tables directly.

---

## THE PROBLEM

Current table names are inconsistent garbage:

| Current Name | Problem |
|--------------|---------|
| `unified_assets` | "unified_" prefix is meaningless |
| `unified_bookings` | "unified_" prefix is meaningless |
| `crm_contacts` | "crm_" prefix, should be "people" |
| `crm_organizations` | "crm_" prefix |
| `crm_places` | "crm_" prefix |
| `entity_presentations` | "entity_" prefix awkward |

## THE SOLUTION

Rename to schema.org-aligned names:

| Old Name | New Name | Schema.org Type |
|----------|----------|-----------------|
| `unified_assets` | `assets` | Product, Vehicle, Accommodation |
| `unified_bookings` | `reservations` | Reservation |
| `crm_contacts` | `people` | Person |
| `crm_organizations` | `organizations` | Organization |
| `crm_places` | `places` | Place |
| `entity_presentations` | `articles` | Article |

---

## STEP 1 — AUDIT (Report before proceeding)

```sql
-- Confirm tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('unified_assets', 'unified_bookings', 'crm_contacts', 'crm_organizations', 'crm_places', 'entity_presentations');

-- Count rows (should be seed data only)
SELECT 'unified_assets' as tbl, COUNT(*) FROM unified_assets
UNION ALL SELECT 'unified_bookings', COUNT(*) FROM unified_bookings
UNION ALL SELECT 'crm_contacts', COUNT(*) FROM crm_contacts
UNION ALL SELECT 'crm_organizations', COUNT(*) FROM crm_organizations
UNION ALL SELECT 'crm_places', COUNT(*) FROM crm_places
UNION ALL SELECT 'entity_presentations', COUNT(*) FROM entity_presentations;

-- Find foreign key references
SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name IN ('unified_assets', 'unified_bookings', 'crm_contacts', 'crm_organizations', 'crm_places', 'entity_presentations');
```

**REPORT THESE RESULTS BEFORE PROCEEDING.**

---

## STEP 2 — RENAME TABLES

```sql
ALTER TABLE unified_assets RENAME TO assets;
ALTER TABLE unified_bookings RENAME TO reservations;
ALTER TABLE crm_contacts RENAME TO people;
ALTER TABLE crm_organizations RENAME TO organizations;
ALTER TABLE crm_places RENAME TO places;
ALTER TABLE entity_presentations RENAME TO articles;
```

---

## STEP 3 — ADD schema_type COLUMN

```sql
-- Add schema_type column to each table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS schema_type TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS schema_type TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS schema_type TEXT DEFAULT 'Person';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS schema_type TEXT DEFAULT 'Organization';
ALTER TABLE places ADD COLUMN IF NOT EXISTS schema_type TEXT DEFAULT 'Place';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS schema_type TEXT DEFAULT 'Article';
```

---

## STEP 4 — SET schema_type VALUES

```sql
-- Assets: Map asset_type to schema.org types
UPDATE assets SET schema_type = CASE
  WHEN asset_type IN ('vehicle', 'trailer') THEN 'Vehicle'
  WHEN asset_type IN ('room', 'cottage', 'cabin') THEN 'Accommodation'
  WHEN asset_type IN ('slip', 'stall', 'table', 'seat') THEN 'Place'
  ELSE 'Product'
END WHERE schema_type IS NULL;

-- Reservations
UPDATE reservations SET schema_type = 'Reservation' WHERE schema_type IS NULL;
```

---

## STEP 5 — UPDATE ALL CODE REFERENCES

Search and replace in ALL files:

| Search | Replace |
|--------|---------|
| `unified_assets` | `assets` |
| `unified_bookings` | `reservations` |
| `crm_contacts` | `people` |
| `crm_organizations` | `organizations` |
| `crm_places` | `places` |
| `entity_presentations` | `articles` |

**Check these locations:**
- `server/` - all TypeScript files
- `client/` - all React files
- `shared/` - type definitions
- Drizzle schema files
- Route definitions
- API handlers

```bash
# Find all references
grep -r "unified_assets\|unified_bookings\|crm_contacts\|crm_organizations\|crm_places\|entity_presentations" --include="*.ts" --include="*.tsx" .
```

**Report how many files changed.**

---

## STEP 6 — UPDATE SYSTEM EXPLORER

System Explorer must show new table names:

1. Overview tab - update entity cards
2. Data Browser - update dropdown options
3. Evidence Ledger - update table references

```sql
-- Update Evidence Ledger entries
UPDATE system_evidence SET artifact_name = 'assets' WHERE artifact_name = 'unified_assets';
UPDATE system_evidence SET artifact_name = 'reservations' WHERE artifact_name = 'unified_bookings';
UPDATE system_evidence SET artifact_name = 'people' WHERE artifact_name = 'crm_contacts';
UPDATE system_evidence SET artifact_name = 'organizations' WHERE artifact_name = 'crm_organizations';
UPDATE system_evidence SET artifact_name = 'places' WHERE artifact_name = 'crm_places';
UPDATE system_evidence SET artifact_name = 'articles' WHERE artifact_name = 'entity_presentations';
```

---

## STEP 7 — VERIFY

```sql
-- Old tables should NOT exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('unified_assets', 'unified_bookings', 'crm_contacts', 'crm_organizations', 'crm_places', 'entity_presentations');
-- Expected: 0 rows

-- New tables SHOULD exist with schema_type column
SELECT table_name, column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('assets', 'reservations', 'people', 'organizations', 'places', 'articles')
AND column_name = 'schema_type';
-- Expected: 6 rows

-- Data preserved
SELECT 'assets' as tbl, COUNT(*) FROM assets
UNION ALL SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'places', COUNT(*) FROM places
UNION ALL SELECT 'articles', COUNT(*) FROM articles;
```

---

## EVIDENCE REQUIRED

Provide ALL of these or say "NOT COMPLETE":

1. **Audit results** from Step 1
2. **Migration file** with SQL
3. **grep output** showing files found with old names
4. **Files changed count** after replacements
5. **Screenshot** of System Explorer Overview with new names
6. **Screenshot** of Data Browser dropdown with new names
7. **Verification SQL** results from Step 7

---

## DO NOT

- ❌ Do NOT create views (v_people, v_assets, etc.)
- ❌ Do NOT create a semantic_types reference table
- ❌ Do NOT create an entity_semantics mapping table
- ❌ Do NOT create JSON-LD endpoints (not needed yet)
- ❌ Do NOT create triggers for automatic mapping
- ❌ Do NOT leave any old table names anywhere

---

## SUMMARY

**Before:**
```
unified_assets
unified_bookings
crm_contacts
crm_organizations
crm_places
entity_presentations
```

**After:**
```
assets          (with schema_type: Vehicle, Product, Accommodation, Place)
reservations    (with schema_type: Reservation)
people          (with schema_type: Person)
organizations   (with schema_type: Organization)
places          (with schema_type: Place)
articles        (with schema_type: Article)
```

Clean. Simple. Schema.org-aligned. No indirection.

BEGIN.

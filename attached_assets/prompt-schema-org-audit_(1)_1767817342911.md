# PROMPT — SCHEMA.ORG COMPLIANCE AUDIT

Run a comprehensive audit of all data structures against schema.org standards.

---

## AUDIT 1: ASSET TYPES

Query all distinct asset_type values and their schema_type mappings:

```sql
SELECT 
  asset_type,
  schema_type,
  COUNT(*) as count
FROM assets
GROUP BY asset_type, schema_type
ORDER BY count DESC;
```

**Report format:**

| asset_type | current schema_type | correct schema_type | status |
|------------|---------------------|---------------------|--------|
| vehicle | ? | Vehicle | ✅ or ❌ |
| trailer | ? | Vehicle | ✅ or ❌ |
| equipment | ? | Product | ✅ or ❌ |
| room | ? | Room | ✅ or ❌ |
| table | ? | Place | ✅ or ❌ |
| ... | | | |

**Fix any incorrect mappings:**

```sql
-- Example fixes (adjust based on audit results)
UPDATE assets SET schema_type = 'Vehicle' WHERE asset_type IN ('vehicle', 'trailer', 'forklift');
UPDATE assets SET schema_type = 'Product' WHERE asset_type IN ('equipment', 'tool', 'kayak');
UPDATE assets SET schema_type = 'Room' WHERE asset_type = 'room';
UPDATE assets SET schema_type = 'House' WHERE asset_type IN ('cottage', 'cabin');
UPDATE assets SET schema_type = 'Place' WHERE asset_type IN ('table', 'slip', 'stall', 'parking_spot');
UPDATE assets SET schema_type = 'Seat' WHERE asset_type = 'seat';
UPDATE assets SET schema_type = 'CampingPitch' WHERE asset_type = 'camping_pitch';
UPDATE assets SET schema_type = 'BoatOrShip' WHERE asset_type = 'boat';
```

---

## AUDIT 2: ORGANIZATION TYPES

Query all distinct organization types:

```sql
SELECT 
  org_type,
  schema_type,
  COUNT(*) as count
FROM organizations
GROUP BY org_type, schema_type
ORDER BY count DESC;
```

**Correct mappings:**

| org_type | schema_type |
|----------|-------------|
| restaurant | Restaurant |
| hotel | Hotel |
| resort | Resort |
| campground | Campground |
| marina | LocalBusiness |
| government | GovernmentOrganization |
| municipality | GovernmentOrganization |
| first_nation | GovernmentOrganization |
| chamber | Organization |
| business | LocalBusiness |
| contractor | LocalBusiness |
| nonprofit | NGO |

---

## AUDIT 3: PLACE TYPES

Query all distinct place types:

```sql
SELECT 
  place_type,
  schema_type,
  COUNT(*) as count
FROM places
GROUP BY place_type, schema_type
ORDER BY count DESC;
```

**Correct mappings:**

| place_type | schema_type |
|------------|-------------|
| city | City |
| town | City |
| village | City |
| community | Place |
| region | AdministrativeArea |
| province | AdministrativeArea |
| park | Park |
| beach | Beach |
| lake | BodyOfWater |
| mountain | Mountain |
| ferry_terminal | Place |
| airport | Airport |
| tourist_attraction | TouristAttraction |

---

## AUDIT 4: RESERVATION TYPES

Query reservation schema_types:

```sql
SELECT 
  schema_type,
  COUNT(*) as count
FROM reservations
GROUP BY schema_type
ORDER BY count DESC;
```

**Should have context-appropriate types:**
- LodgingReservation (for rooms, cottages)
- FoodEstablishmentReservation (for restaurant tables)
- RentalCarReservation (for vehicles)
- BoatReservation (for boats, kayaks)
- Reservation (generic fallback)

---

## AUDIT 5: COLUMN NAMING

Check for non-standard column names:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  column_name LIKE '%first_name%'
  OR column_name LIKE '%last_name%'
  OR column_name LIKE '%phone%'
  OR column_name LIKE '%lat%'
  OR column_name LIKE '%lng%'
  OR column_name LIKE '%lon%'
  OR column_name LIKE '%desc%'
  OR column_name LIKE '%img%'
  OR column_name LIKE '%pic%'
  OR column_name LIKE '%max_capacity%'
  OR column_name LIKE '%check_in%'
  OR column_name LIKE '%check_out%'
)
ORDER BY table_name, column_name;
```

**Standard names to use:**

| Non-standard | Standard (schema.org) |
|--------------|----------------------|
| first_name | given_name |
| last_name | family_name |
| phone | telephone |
| lat | latitude |
| lng/lon | longitude |
| desc | description |
| img/pic/image | photo |
| max_capacity | occupancy |
| check_in | checkin_time |
| check_out | checkout_time |

---

## AUDIT 6: MISSING schema_type VALUES

Find records without schema_type:

```sql
SELECT 'assets' as table_name, COUNT(*) as missing_count 
FROM assets WHERE schema_type IS NULL
UNION ALL
SELECT 'reservations', COUNT(*) FROM reservations WHERE schema_type IS NULL
UNION ALL
SELECT 'people', COUNT(*) FROM people WHERE schema_type IS NULL
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations WHERE schema_type IS NULL
UNION ALL
SELECT 'places', COUNT(*) FROM places WHERE schema_type IS NULL
UNION ALL
SELECT 'articles', COUNT(*) FROM articles WHERE schema_type IS NULL;
```

**All counts should be 0.** Fix any with NULL values.

---

## AUDIT 7: FOREIGN KEY COLUMN NAMES

Check FK columns for old naming:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  column_name LIKE '%contact_id%'
  OR column_name LIKE '%booking_id%'
  OR column_name LIKE '%inventory_id%'
)
ORDER BY table_name;
```

**Report these for future migration:**
- `contact_id` → `person_id`
- `booking_id` → `reservation_id`

(Note: Don't fix FK columns now - just report them)

---

## AUDIT 8: TABLE INVENTORY

List ALL tables and their schema.org alignment:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Categorize each table:**

| Table | Category | schema.org Type | Status |
|-------|----------|-----------------|--------|
| assets | Content | Product/Vehicle/etc | ✅ |
| reservations | Content | Reservation | ✅ |
| people | Content | Person | ✅ |
| organizations | Content | Organization | ✅ |
| places | Content | Place | ✅ |
| articles | Content | Article | ✅ |
| portals | Infrastructure | N/A | ➖ |
| portal_domains | Infrastructure | N/A | ➖ |
| tenants | Infrastructure | N/A | ➖ |
| users | Infrastructure | N/A | ➖ |
| system_evidence | Infrastructure | N/A | ➖ |
| ... | | | |

---

## AUDIT 9: TRAILER-SPECIFIC DATA

You mentioned trailer data. Check what trailer-specific fields exist:

```sql
-- Get sample trailer record with all columns
SELECT * FROM assets WHERE asset_type = 'trailer' LIMIT 1;

-- Check for trailer-specific columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assets'
ORDER BY ordinal_position;
```

**Report which fields map to schema.org/Vehicle properties:**

| Column | schema.org Property | Status |
|--------|---------------------|--------|
| name | name | ✅ |
| description | description | ✅ |
| ? | vehicleConfiguration | ❓ |
| ? | weightTotal | ❓ |
| ? | cargoVolume | ❓ |
| ? | manufacturer | ❓ |
| ? | model | ❓ |

---

## OUTPUT FORMAT

Produce a complete report:

```
SCHEMA.ORG COMPLIANCE AUDIT
===========================
Date: [timestamp]

ASSET TYPES
-----------
Total distinct types: X
Correctly mapped: X
Needs fix: X (list them)

ORGANIZATION TYPES
------------------
Total distinct types: X
Correctly mapped: X
Needs fix: X (list them)

PLACE TYPES
-----------
Total distinct types: X
Correctly mapped: X
Needs fix: X (list them)

RESERVATION TYPES
-----------------
Total: X
With correct schema_type: X
Missing schema_type: X

COLUMN NAMING
-------------
Non-standard columns found: X
(list each with recommended rename)

FOREIGN KEY COLUMNS (Deferred)
------------------------------
Old naming still in use:
- contact_id in tables: [list]
- booking_id in tables: [list]

MISSING schema_type VALUES
--------------------------
assets: X missing
reservations: X missing
people: X missing
organizations: X missing
places: X missing
articles: X missing

OVERALL STATUS
--------------
✅ Fully compliant: X tables
⚠️ Needs attention: X items
❌ Critical fixes: X items

RECOMMENDED ACTIONS
-------------------
1. [specific action]
2. [specific action]
...
```

---

## EVIDENCE REQUIRED

1. Full audit report as formatted above
2. SQL results for each audit query
3. List of all UPDATE statements executed to fix issues
4. Final verification query showing all schema_type values are set

BEGIN.

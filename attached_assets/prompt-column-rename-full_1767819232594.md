# PROMPT — SCHEMA.ORG COLUMN ALIGNMENT (FULL)

**STOP. This is a major refactor. Read everything first.**

We are fixing ALL non-standard column names to schema.org standards. No deferring.

Zero customer data = zero excuses.

---

## PHASE 1: EXECUTE SCHEMA_TYPE FIXES

First, run these immediately:

```sql
UPDATE assets SET schema_type = 'Accommodation' WHERE asset_type = 'property';
UPDATE assets SET schema_type = 'ParkingFacility' WHERE asset_type = 'parking';
UPDATE assets SET schema_type = 'Place' WHERE asset_type IN ('spot', 'moorage');
UPDATE assets SET schema_type = 'Accommodation' WHERE asset_type = 'accommodation';
UPDATE assets SET schema_type = 'BoatOrShip' WHERE asset_type = 'watercraft';
UPDATE assets SET schema_type = 'Service' WHERE asset_type = 'charter';
```

---

## PHASE 2: AUDIT ALL COLUMNS TO RENAME

Run this query to get the full list:

```sql
SELECT table_name, column_name,
  CASE 
    WHEN column_name = 'first_name' THEN 'given_name'
    WHEN column_name = 'last_name' THEN 'family_name'
    WHEN column_name LIKE '%phone%' AND column_name NOT LIKE '%telephone%' THEN REPLACE(column_name, 'phone', 'telephone')
    WHEN column_name = 'booking_id' THEN 'reservation_id'
    WHEN column_name = 'contact_id' THEN 'person_id'
    WHEN column_name = 'check_in' THEN 'checkin_time'
    WHEN column_name = 'check_out' THEN 'checkout_time'
    WHEN column_name = 'check_in_time' THEN 'checkin_time'
    WHEN column_name = 'check_out_time' THEN 'checkout_time'
    WHEN column_name = 'checkin' THEN 'checkin_time'
    WHEN column_name = 'checkout' THEN 'checkout_time'
    ELSE 'KEEP'
  END as new_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  column_name = 'first_name'
  OR column_name = 'last_name'
  OR column_name LIKE '%phone%'
  OR column_name = 'booking_id'
  OR column_name = 'contact_id'
  OR column_name LIKE '%check_in%'
  OR column_name LIKE '%check_out%'
  OR column_name = 'checkin'
  OR column_name = 'checkout'
)
ORDER BY table_name, column_name;
```

**Report the count before proceeding.**

---

## PHASE 3: COLUMN RENAMES (SQL)

### Rename Pattern
```sql
ALTER TABLE {table_name} RENAME COLUMN {old_name} TO {new_name};
```

### Renames to Execute

#### A. first_name → given_name (all tables)

```sql
-- Get all tables with first_name
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN first_name TO given_name;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'first_name';
```

Execute all generated statements.

#### B. last_name → family_name (all tables)

```sql
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN last_name TO family_name;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'last_name';
```

Execute all generated statements.

#### C. phone → telephone (careful - check column name variations)

```sql
-- Plain 'phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN phone TO telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'phone';

-- 'phone_number' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN phone_number TO telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'phone_number';

-- 'contact_phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN contact_phone TO contact_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'contact_phone';

-- 'primary_phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN primary_phone TO primary_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'primary_phone';

-- 'secondary_phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN secondary_phone TO secondary_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'secondary_phone';

-- 'business_phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN business_phone TO business_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'business_phone';

-- 'mobile_phone' columns  
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN mobile_phone TO mobile_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'mobile_phone';

-- 'home_phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN home_phone TO home_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'home_phone';

-- 'work_phone' columns
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN work_phone TO work_telephone;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'work_phone';
```

Execute all generated statements.

#### D. booking_id → reservation_id (all tables)

```sql
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN booking_id TO reservation_id;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'booking_id';
```

Execute all generated statements.

#### E. contact_id → person_id (all tables)

```sql
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN contact_id TO person_id;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'contact_id';
```

Execute all generated statements.

#### F. check_in/check_out variations → checkin_time/checkout_time

```sql
-- check_in → checkin_time
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN check_in TO checkin_time;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'check_in';

-- check_out → checkout_time
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN check_out TO checkout_time;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'check_out';

-- check_in_time → checkin_time (remove underscore)
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN check_in_time TO checkin_time;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'check_in_time';

-- check_out_time → checkout_time (remove underscore)
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN check_out_time TO checkout_time;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'check_out_time';

-- checkin → checkin_time
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN checkin TO checkin_time;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'checkin';

-- checkout → checkout_time
SELECT 'ALTER TABLE ' || table_name || ' RENAME COLUMN checkout TO checkout_time;'
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'checkout';
```

Execute all generated statements.

---

## PHASE 4: UPDATE ALL CODE REFERENCES

After database renames, update all code:

### Search for old column names

```bash
# Find all references to old column names
grep -r -i "first_name\|last_name\|\.phone\|phone_number\|booking_id\|contact_id\|check_in\|check_out\|checkin\|checkout" \
  --include="*.ts" --include="*.tsx" \
  server/ client/ shared/ \
  | grep -v node_modules \
  | grep -v ".test." \
  | wc -l
```

**Report the count.**

### Global replacements in code

| Search | Replace |
|--------|---------|
| `first_name` | `given_name` |
| `firstName` | `givenName` |
| `last_name` | `family_name` |
| `lastName` | `familyName` |
| `phone_number` | `telephone` |
| `phoneNumber` | `telephone` |
| `.phone` | `.telephone` |
| `booking_id` | `reservation_id` |
| `bookingId` | `reservationId` |
| `contact_id` | `person_id` |
| `contactId` | `personId` |
| `check_in` | `checkin_time` |
| `checkIn` | `checkinTime` |
| `check_out` | `checkout_time` |
| `checkOut` | `checkoutTime` |

**Be careful with:**
- `phone` alone (might be part of other words)
- `contact` alone (only change `contact_id`)
- Type definitions in shared/

### Update TypeScript interfaces

Find and update all type definitions:

```bash
grep -r "interface\|type " shared/ --include="*.ts" | grep -iE "firstName|lastName|phone|bookingId|contactId|checkIn|checkOut"
```

---

## PHASE 5: UPDATE DRIZZLE SCHEMA

If using Drizzle ORM, update schema definitions:

```bash
grep -r "first_name\|last_name\|phone\|booking_id\|contact_id\|check_in\|check_out" server/db/schema* --include="*.ts"
```

Update column definitions to match new names.

---

## PHASE 6: VERIFICATION

### A. Verify no old column names in database

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  column_name = 'first_name'
  OR column_name = 'last_name'
  OR column_name = 'phone'
  OR column_name = 'phone_number'
  OR column_name = 'booking_id'
  OR column_name = 'contact_id'
  OR column_name = 'check_in'
  OR column_name = 'check_out'
)
ORDER BY table_name;
```

**Should return 0 rows.**

### B. Verify no old names in code

```bash
grep -r "first_name\|last_name\|booking_id\|contact_id" --include="*.ts" --include="*.tsx" server/ client/ shared/ | grep -v node_modules | wc -l
```

**Should return 0 (or only comments).**

### C. Application smoke test

1. Start the application
2. Navigate to each major page:
   - Dashboard
   - Assets
   - Reservations
   - People
   - Organizations
   - Messages
   - Settings
3. Verify no errors in console
4. Verify data still displays

---

## PHASE 7: UPDATE EVIDENCE LEDGER

Re-run Evidence Ledger verification to ensure all tracked items still work.

---

## SUMMARY OF CHANGES

| Old | New | Count |
|-----|-----|-------|
| first_name | given_name | ~40 tables |
| last_name | family_name | ~40 tables |
| phone* | telephone* | ~40 tables |
| booking_id | reservation_id | 14 tables |
| contact_id | person_id | 2 tables |
| check_in* | checkin_time | ? tables |
| check_out* | checkout_time | ? tables |

**Total: ~100+ column renames**

---

## EVIDENCE REQUIRED

1. **Phase 1 results** - schema_type UPDATE counts
2. **Phase 2 audit** - Total columns to rename
3. **Phase 3 execution** - Count of ALTER TABLE statements run
4. **Phase 4 code changes** - Files modified count
5. **Phase 6A verification** - SQL query returns 0 rows
6. **Phase 6B verification** - grep returns 0 matches
7. **Phase 6C smoke test** - Screenshot of app working
8. **Final column count** - Query showing new column names exist

---

## ROLLBACK PLAN

If something breaks catastrophically:

```sql
-- Reverse renames (keep this handy)
-- ALTER TABLE {table} RENAME COLUMN given_name TO first_name;
-- etc.
```

But we shouldn't need this - we have no customer data.

---

## DO NOT

- ❌ Do NOT skip any table (including staging/legacy tables)
- ❌ Do NOT leave old column names anywhere
- ❌ Do NOT forget to update TypeScript types
- ❌ Do NOT forget Drizzle schema files

---

BEGIN. Execute all phases in order.

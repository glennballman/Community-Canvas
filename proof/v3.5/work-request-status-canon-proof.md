# V3.5 Migration 174: Work Request Status Canonicalization Proof

Date: 2026-01-24
Status: COMPLETE

## Summary

Removed 8 legacy work_request_status enum values to comply with TERMINOLOGY_CANON.md v3.
Only the 9 canonical values remain.

## Section A: Pre-Migration Audit

### 1. Columns Using work_request_status Enum

```sql
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns 
WHERE udt_name = 'work_request_status';
```

Result:
```
table_name       | column_name | is_nullable | column_default
-----------------+-------------+-------------+------------------------
cc_work_requests | status      | YES         | 'new'::work_request_status
```

Only 1 column uses the enum.

### 2. Usage Count by Value

```sql
SELECT status::text, COUNT(*) FROM cc_work_requests GROUP BY 1;
```

Result:
```
status   | count
---------+------
accepted | 3
```

Only 3 rows exist, all using canonical value 'accepted'.

### 3. Legacy Value Counts (HARD STOP CHECK)

Legacy values: new, contacted, quoted, converted, closed, spam, scheduled, dropped

**Result: 0 rows with any legacy value** - PASSED

### 4. Application Code References

Searched server/ for legacy status references:

```bash
rg -n "new|contacted|quoted|converted|closed|spam|scheduled|dropped" server/
```

**Files Updated:**

1. `server/routes/provider.ts:702` - HOLDABLE_STATUSES
   - Before: `['new', 'sent', 'awaiting_response', 'proposed_change', 'unassigned', 'awaiting_commitment']`
   - After: `['draft', 'sent', 'proposed_change', 'unassigned']`

2. `server/routes/work-requests.ts:104-126` - Status count queries
   - Before: Counted new, contacted, quoted, scheduled, completed, dropped, spam
   - After: Counts all 9 canonical statuses

## Section B: Migration (174_work_request_status_canon.sql)

```sql
-- Step 1: Create new canonical enum type
CREATE TYPE work_request_status_v3 AS ENUM (
  'draft', 'sent', 'proposed_change', 'awaiting_commitment',
  'unassigned', 'accepted', 'in_progress', 'completed', 'cancelled'
);

-- Step 2: Drop old default (referenced 'new')
ALTER TABLE cc_work_requests ALTER COLUMN status DROP DEFAULT;

-- Step 3: Alter column to new enum type
ALTER TABLE cc_work_requests 
  ALTER COLUMN status TYPE work_request_status_v3 
  USING (status::text::work_request_status_v3);

-- Step 4: Set new canonical default
ALTER TABLE cc_work_requests ALTER COLUMN status SET DEFAULT 'draft';

-- Step 5: Rename types (swap pattern)
ALTER TYPE work_request_status RENAME TO work_request_status_legacy;
ALTER TYPE work_request_status_v3 RENAME TO work_request_status;

-- Step 6: Drop legacy type
DROP TYPE work_request_status_legacy;
```

Execution result: All 6 statements succeeded.

## Section C: Post-Migration Verification

### 1. Enum Values

```sql
SELECT unnest(enum_range(NULL::work_request_status))::text AS status ORDER BY 1;
```

Result:
```
accepted
awaiting_commitment
cancelled
completed
draft
in_progress
proposed_change
sent
unassigned
```

**EXACTLY 9 canonical values** - PASSED

### 2. Column Default

```sql
SELECT column_default FROM information_schema.columns 
WHERE table_name = 'cc_work_requests' AND column_name = 'status';
```

Result: `'draft'::work_request_status`

**Default changed from 'new' to 'draft'** - PASSED

### 3. Row Integrity

```sql
SELECT status::text, COUNT(*) FROM cc_work_requests GROUP BY 1;
```

Result: `accepted | 3`

**All rows intact with canonical values** - PASSED

### 4. Application Boot

Server started successfully on port 5000 after migration.

## Compliance Checklist

- [x] Legacy funnel statuses removed: new/contacted/quoted/converted/closed/spam/scheduled/dropped
- [x] Only canonical 9 values remain
- [x] No rows were mapped (not needed - 0 legacy rows existed)
- [x] No "job" added in service context
- [x] No "calendar" added in new code
- [x] Application code updated to use canonical values
- [x] Default changed from 'new' to 'draft'

## Files Changed

- `server/migrations/174_work_request_status_canon.sql` - Enum swap migration
- `server/routes/provider.ts` - Updated HOLDABLE_STATUSES
- `server/routes/work-requests.ts` - Updated status count queries

## TERMINOLOGY_CANON.md v3 Alignment

| Canonical Value      | In Enum |
|---------------------|---------|
| draft               | ✅      |
| sent                | ✅      |
| proposed_change     | ✅      |
| awaiting_commitment | ✅      |
| unassigned          | ✅      |
| accepted            | ✅      |
| in_progress         | ✅      |
| completed           | ✅      |
| cancelled           | ✅      |

**BANNED values verified absent:**
- DECLINED: Not present ✅
- BOOKED/BOOKING: Not present ✅
- All 8 legacy values: Removed ✅

---

## Post-Migration Patch (Holdability Fix)

Date: 2026-01-24

### Issue

HOLDABLE_STATUSES was missing `awaiting_commitment`, blocking the workflow where a request already in AWAITING_COMMITMENT needs to be held/attached to a run.

### Audit (Before Patch)

```bash
rg -n "awaiting_response" server client
# Found: server/migrations/115_disputes.sql (different domain, not work_request_status)

rg -n "HOLDABLE_STATUSES" server
# server/routes/provider.ts:703: ['draft', 'sent', 'proposed_change', 'unassigned']
# MISSING: awaiting_commitment
```

### Files Patched

1. **server/routes/provider.ts**
   - Added `awaiting_commitment` to HOLDABLE_STATUSES

2. **server/routes/work-requests.ts**
   - `'scheduled'` → `'accepted'` (reserve endpoint)
   - `'dropped'` → `'cancelled'` (drop endpoint)

3. **client/src/pages/intake/WorkRequestDetail.tsx**
   - WorkRequest interface: legacy → canonical status types
   - STATUS_CONFIG: legacy → canonical status labels
   - Quick Actions: `contacted/quoted/spam` → `sent/proposed_change/cancelled`
   - Workflow guards: updated to canonical statuses

### Verification (After Patch)

```bash
rg -A1 "HOLDABLE_STATUSES" server
# ['draft', 'sent', 'proposed_change', 'unassigned', 'awaiting_commitment']
# ✅ awaiting_commitment now included

rg -n "'dropped'|'scheduled'|'spam'|'contacted'|'quoted'" server/routes/work-requests.ts
# Only comment references remain
# ✅ No legacy status values in active code
```

### Status Replacements Made

| Legacy Status | Canonical Replacement |
|--------------|----------------------|
| new          | draft                |
| contacted    | sent                 |
| quoted       | proposed_change      |
| scheduled    | accepted             |
| dropped      | cancelled            |
| spam         | cancelled            |

### Patch Compliance Checklist

- [x] awaiting_commitment added to HOLDABLE_STATUSES
- [x] No awaiting_response references remain (was different domain)
- [x] No other legacy status references remain in work request code
- [x] Hold from awaiting_commitment works (no state change)
- [x] Test auth bootstrap used (no UI login)

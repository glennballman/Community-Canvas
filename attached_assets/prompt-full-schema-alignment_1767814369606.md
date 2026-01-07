# PROMPT — SCHEMA ALIGNMENT: NAV + UI + FULL AUDIT

We renamed tables to be schema.org-aligned. Now ALL UI terminology must match.

---

## PART 1: GLOBAL TERMINOLOGY REPLACEMENT

The old terminology is spread throughout the entire application. Fix ALL instances.

### Search and Replace (Global)

| Old Term | New Term | Forms to catch |
|----------|----------|----------------|
| Inventory | Assets | inventory, Inventory, INVENTORY |
| Bookings | Reservations | bookings, Bookings, BOOKINGS |
| Booking | Reservation | booking, Booking, BOOKING |
| Contacts | People | contacts, Contacts, CONTACTS |
| Contact | Person | contact, Contact, CONTACT |
| Conversations | Messages | conversations, Conversations |
| Conversation | Message | conversation, Conversation |

### Run This First

```bash
# Find ALL instances of old terminology
grep -r -i "inventory\|booking\|contact\|conversation" client/src --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."

# Count instances
grep -r -i "inventory\|booking\|contact\|conversation" client/src --include="*.tsx" --include="*.ts" | grep -v node_modules | wc -l
```

**Report the count before making changes.**

### Locations to Check

1. **Navigation** - Left nav labels
2. **Dashboard cards** - "Manage Inventory" → "Manage Assets", "View Bookings" → "View Reservations"
3. **Dashboard stats** - "Active Bookings" → "Active Reservations"
4. **Activity feed** - "New booking:" → "New reservation:", "Booking completed:" → "Reservation completed:"
5. **Page titles** - Every page header
6. **Breadcrumbs** - Navigation trails
7. **Button labels** - "Add Contact" → "Add Person", "New Booking" → "New Reservation"
8. **Empty states** - "No contacts yet" → "No people yet"
9. **Toast messages** - Success/error notifications
10. **Modal titles** - Dialog headers
11. **Form labels** - Input field labels
12. **Table columns** - Column headers
13. **Tooltips** - Hover text
14. **Placeholder text** - Input placeholders
15. **Error messages** - Validation messages

### Exceptions (DO NOT CHANGE)

- `booking_id` in database queries (FK column - fix later)
- `contact_id` in database queries (FK column - fix later)  
- Variable names in code internals (cosmetic - fix later)
- Comments (low priority)

**Focus on user-facing text first.**

---

## PART 2: ROUTE PATH ALIGNMENT

Check if URL paths match new terminology:

| Current Route | Should Be | Priority |
|---------------|-----------|----------|
| `/app/inventory` | `/app/assets` | HIGH - users see this |
| `/app/bookings` | `/app/reservations` | HIGH |
| `/app/contacts` | `/app/people` | HIGH |
| `/app/conversations` | `/app/messages` | HIGH |

If routes use old names, update them AND add redirects from old paths.

---

## PART 3: API ENDPOINT ALIGNMENT

```bash
# Find API routes with old names
grep -r "router\.\|app\." server/routes --include="*.ts" | grep -iE "inventory|booking|contact|conversation"
```

Update endpoints to match:
- `/api/inventory/*` → `/api/assets/*`
- `/api/bookings/*` → `/api/reservations/*`
- `/api/contacts/*` → `/api/people/*`
- `/api/conversations/*` → `/api/messages/*`

---

## PART 4: FULL ALIGNMENT AUDIT

After changes, run comprehensive audit:

### Audit A: Remaining Old Terms

```bash
# Should return 0 user-facing instances
grep -r -i "inventory\|booking\|contact\|conversation" client/src --include="*.tsx" | grep -v "// " | grep -v "/*" | head -20
```

### Audit B: Table to UI Mapping

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

For each table, confirm UI label matches:

| Table | UI Label | Status |
|-------|----------|--------|
| assets | Assets | ✅ or ❌ |
| reservations | Reservations | ✅ or ❌ |
| people | People | ✅ or ❌ |
| organizations | Organizations | ✅ or ❌ |
| places | Places | ✅ or ❌ |
| articles | Articles | ✅ or ❌ |
| projects | Projects | ✅ or ❌ |
| work_requests | Work Requests | ✅ or ❌ |
| portals | Portals | ✅ or ❌ |

### Audit C: Route to Table Mapping

| Route Path | Table | Match? |
|------------|-------|--------|
| /app/assets | assets | ✅ or ❌ |
| /app/reservations | reservations | ✅ or ❌ |
| /app/people | people | ✅ or ❌ |
| ... | ... | ... |

### Audit D: FK Column Names (Note for Later)

```sql
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public'
AND (column_name LIKE '%contact%' OR column_name LIKE '%booking%')
ORDER BY table_name;
```

**Don't fix these now** - just report them for future cleanup.

### Audit E: Type Definitions

```bash
grep -r "interface\|type " shared/ --include="*.ts" | grep -iE "Contact|Booking|Inventory"
```

Report any that need updating.

### Audit F: Evidence Ledger Sync

```sql
-- Verify all tables are in Evidence Ledger
SELECT t.table_name,
  CASE WHEN e.id IS NOT NULL THEN '✅' ELSE '❌' END as tracked
FROM information_schema.tables t
LEFT JOIN system_evidence e ON e.artifact_name = t.table_name AND e.artifact_type = 'table'
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
```

---

## PART 5: ALIGNMENT REPORT

Produce this summary:

```
SCHEMA ALIGNMENT REPORT
=======================
Date: [timestamp]

TERMINOLOGY REPLACEMENT
-----------------------
Files scanned: X
Instances found: X
Instances replaced: X
Files modified: X

NAVIGATION
----------
✅ Assets (was Inventory)
✅ Reservations (was Bookings)
✅ People (was Contacts)
✅ Messages (was Conversations)

ROUTES
------
✅ /app/assets
✅ /app/reservations
✅ /app/people
✅ /app/messages

API ENDPOINTS
-------------
✅ /api/assets/*
✅ /api/reservations/*
✅ /api/people/*
✅ /api/messages/*

TABLES → UI ALIGNMENT
---------------------
[table for each]

DEFERRED ITEMS (fix later)
--------------------------
- FK columns: contact_id, booking_id (requires migration)
- Internal variable names (cosmetic)
- [any others found]

VERIFICATION
------------
Old terms remaining in UI: [should be 0]
```

---

## EVIDENCE REQUIRED

Provide ALL of these:

1. **Initial grep count** - How many instances of old terms found
2. **Files changed list** - All files modified
3. **Final grep count** - Should be 0 (or close) for user-facing code
4. **Screenshot: Dashboard** - Showing "Manage Assets", "View Reservations", "Messages"
5. **Screenshot: Nav** - Showing Assets, Reservations, People, Messages
6. **Screenshot: Activity feed** - Showing "New reservation:" not "New booking:"
7. **Full alignment report** - As formatted above
8. **Deferred items list** - What still needs fixing later

---

## DO NOT

- ❌ Do NOT leave any user-facing "Inventory", "Booking", "Contact", or "Conversation" text
- ❌ Do NOT break existing functionality while renaming
- ❌ Do NOT forget to update route paths
- ❌ Do NOT skip the audit - we need to know what's left

---

## SUMMARY

**User sees:** Assets, Reservations, People, Messages
**Database has:** assets, reservations, people, messages  
**Routes use:** /app/assets, /app/reservations, /app/people, /app/messages
**APIs use:** /api/assets, /api/reservations, /api/people, /api/messages

Everything aligned. No translation layer. No confusion.

BEGIN.

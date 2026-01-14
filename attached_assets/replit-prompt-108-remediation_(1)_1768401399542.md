# PROMPT: Remediation Migration 108 - Terminology + Taxonomy Standards Cleanup

## Objective
Eliminate all drift terms that violate our standards and schema.org-aligned vocabulary: **never use booking/booked; use reservation/reserved.**

## Non-Negotiables

- **Reservation is canonical. Never "booking".**
- Do not touch row data semantics beyond renames
- Migration must be idempotent
- After completion, there must be **zero**:
  - enum labels containing `book*`
  - table names containing `book*`
  - column names containing `book*`
  - repo occurrences of `booking|booked|is_booked|bookings` (except in standards doc and guardrail script)

---

## A) Create migration file

Create: `server/migrations/108_terminology_reservation_cleanup.sql`

### A1) Enum value renames (idempotent)

Use `ALTER TYPE ... RENAME VALUE` wrapped in DO blocks.

**✅ schedule_event_type**
- `booked` → `reserved`

**✅ work_request_status**
- `booked` → `scheduled`

**✅ external_source**
- `booking` → `reservation_platform`

**SQL template (repeat per enum rename):**

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = '<enum_name>'
      AND e.enumlabel = '<old_value>'
  ) THEN
    EXECUTE format('ALTER TYPE %I RENAME VALUE %L TO %L', '<enum_name>', '<old_value>', '<new_value>');
  END IF;
END $$;
```

### A2) Column renames (complete coverage)

You MUST rename every column in public schema whose name contains `book` / `booking` / `booked` / `is_booked`.

**From our scan, these include (minimum list you must cover; add any additional ones you discover via query):**

| Table | Old Column | New Column |
|-------|------------|------------|
| cc_asset_terms | instant_book | instant_reserve |
| cc_assets | instant_book | instant_reserve |
| cc_federation_agreements | allow_booking_requests | allow_reservation_requests |
| cc_operators | accepts_online_booking | accepts_online_reservation |
| cc_permit_types | booking_rules_json | reservation_rules_json |
| cc_portal_moments | advance_booking_days | advance_reservation_days |
| cc_transport_operators | booking_settings_json | reservation_settings_json |
| cc_seasonal_rules | booking_window_days | reservation_window_days |

**Plus any "10+ more" from the scan — do not stop early.**

**Implementation rule:**

Use a dynamic renamer block that:
1. queries information_schema for matching columns
2. maps names to replacements by rules:
   - `instant_book` → `instant_reserve`
   - any `booking` substring → `reservation`
   - any `_booked` or `booked_` substring → `reserved` (rare; prefer explicit mapping)
3. runs `ALTER TABLE ... RENAME COLUMN ...` only if column exists

**Dynamic rename skeleton:**

```sql
DO $$
DECLARE
  r RECORD;
  new_col text;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        column_name ILIKE '%book%'
      )
  LOOP
    new_col := r.column_name;

    -- explicit fixes first
    IF new_col = 'instant_book' THEN new_col := 'instant_reserve'; END IF;

    -- general rule: booking -> reservation
    new_col := regexp_replace(new_col, 'booking', 'reservation', 'gi');
    new_col := regexp_replace(new_col, 'bookings', 'reservations', 'gi');

    -- avoid changing legitimate words like "bookkeeping" if any (very unlikely but safe)
    IF new_col <> r.column_name THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.table_name, r.column_name, new_col);
    END IF;
  END LOOP;
END $$;
```

⚠️ **Before executing rename, ensure no target column already exists (handle conflicts):**
- If `new_col` already exists, skip and log via `RAISE NOTICE`.

### A3) Table renames (if any exist)

Run the same logic for table names containing `book*`.
If any tables include `booking`, rename them to `reservation`.

(If none exist, no-op.)

---

## B) Update Drizzle / TypeScript surfaces (MANDATORY)

### B1) Fix shared/schema.ts

We have known drift at these lines:
**384, 403, 537, 783, 1109, 1494, 1500, 1641, 1756, 2057, 2530, 3690**

Replace any usage of:
- `booking` → `reservation`
- `booked` → `reserved`
- `is_booked` → `is_reserved` (or remove if redundant)

Also update any enum name/value representations to match:
- `schedule_event_type.booked` becomes `reserved`
- `work_request_status.booked` becomes `scheduled`
- `external_source.booking` becomes `reservation_platform`

### B2) Fix any Zod/API contracts using these terms

Search/replace across repo:
- `"booking"` → `"reservation"`
- `"booked"` → `"reserved"`
- `"bookings"` → `"reservations"`
- `"is_booked"` → `"is_reserved"`

**But do NOT rename:**
- historical migration filenames
- third-party references
- docs quoting old text (except update standards doc)

---

## C) Add canonical standards doc (authoritative)

Create: `docs/TERMINOLOGY_STANDARDS.md`

Must include:

### Reservation Canon
- Never use `Booking/Booked/Bookings/Is_Booked`
- Use `Reservation/Reserved/Reservations/Is_Reserved`

### schema.org alignment
- JSON-LD uses `https://schema.org` context (reference existing test)

### Taxonomy standards mapping
- **NAICS**: where stored (tables/columns)
- **UNSPSC**: where stored
- **CSI MasterFormat**: where stored
- **HS Code**: where stored

### "Do not invent internal taxonomies" rule
- store only codes, not new categories

---

## D) Add enforcement guardrail (so drift can't recur)

Add script: `scripts/check-terminology.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# banned terms (case-insensitive)
BANNED='(\bbooking(s)?\b|\bbooked\b|\bis_booked\b)'

# allowlist: standards doc + this script itself
rg -n --hidden --glob '!.git' -i "$BANNED" . \
  | rg -v 'docs/TERMINOLOGY_STANDARDS\.md|scripts/check-terminology\.sh' \
  && { echo "❌ Terminology drift detected"; exit 1; } \
  || echo "✅ Terminology clean"
```

Wire it into `package.json` (or CI):
```json
"scripts": {
  "check:terminology": "bash scripts/check-terminology.sh"
}
```

---

## E) Evidence required (paste back outputs)

After migration + code updates, run and paste:

### E1) DB enum drift check
```sql
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE e.enumlabel ILIKE '%book%'
ORDER BY enum_name, e.enumsortorder;
```
**Expected: 0 rows**

### E2) DB column/table drift check
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND (table_name ILIKE '%book%' OR column_name ILIKE '%book%')
ORDER BY table_name, column_name;
```
**Expected: 0 rows**

### E3) Repo drift check
```bash
rg -n --hidden --glob '!.git' -i '\bbooking(s)?\b|\bbooked\b|\bis_booked\b' .
```
**Expected: 0 matches** (except standards doc + guardrail)

---

## Implementation note

Because Postgres enum value renames and column renames can break cached TS types, run:
- `pnpm lint` / `npm run lint`
- `tsc --noEmit`
- and ensure Drizzle schema compiles

---

## Semantic Mapping Reference

| Enum | Old Value | New Value | Reason |
|------|-----------|-----------|--------|
| `schedule_event_type` | booked | **reserved** | Capacity/availability semantics |
| `work_request_status` | booked | **scheduled** | Workflow lifecycle semantics |
| `external_source` | booking | **reservation_platform** | Source type naming |

**Critical distinction:**
- `reserved` = capacity is allocated (calendar/availability states)
- `scheduled` = operational timing assigned (workflow states)
- Never use `booked` in any context

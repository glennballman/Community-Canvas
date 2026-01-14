-- Migration 108: Terminology Remediation - Booking → Reservation
-- This migration eliminates all drift terms that violate our standards
-- Canon: Never use booking/booked; use reservation/reserved
-- =====================================================================

-- =====================================================================
-- SECTION A: ENUM VALUE RENAMES (idempotent)
-- =====================================================================

-- A1) schedule_event_type: booked → reserved
-- Semantic: capacity is allocated (calendar/availability states)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'schedule_event_type'
      AND e.enumlabel = 'booked'
  ) THEN
    ALTER TYPE schedule_event_type RENAME VALUE 'booked' TO 'reserved';
    RAISE NOTICE 'Renamed schedule_event_type: booked → reserved';
  END IF;
END $$;

-- A2) work_request_status: booked → scheduled
-- Semantic: operational timing assigned (workflow lifecycle states)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'work_request_status'
      AND e.enumlabel = 'booked'
  ) THEN
    ALTER TYPE work_request_status RENAME VALUE 'booked' TO 'scheduled';
    RAISE NOTICE 'Renamed work_request_status: booked → scheduled';
  END IF;
END $$;

-- A3) external_source: booking → reservation_platform
-- Semantic: source type naming for external data ingestion
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'external_source'
      AND e.enumlabel = 'booking'
  ) THEN
    ALTER TYPE external_source RENAME VALUE 'booking' TO 'reservation_platform';
    RAISE NOTICE 'Renamed external_source: booking → reservation_platform';
  END IF;
END $$;

-- =====================================================================
-- SECTION B: COLUMN RENAMES (dynamic with conflict detection)
-- =====================================================================

DO $$
DECLARE
  r RECORD;
  new_col text;
  target_exists boolean;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name ILIKE '%book%'
    ORDER BY table_name, column_name
  LOOP
    new_col := r.column_name;

    -- Explicit mappings first (highest priority)
    IF new_col = 'instant_book' THEN
      new_col := 'instant_reserve';
    ELSIF new_col = 'is_bookable' THEN
      new_col := 'is_reservable';
    ELSIF new_col = 'would_book_again' THEN
      new_col := 'would_reserve_again';
    ELSIF new_col = 'accepts_instant_book' THEN
      new_col := 'accepts_instant_reserve';
    ELSE
      -- General rules: booking -> reservation, bookings -> reservations
      new_col := regexp_replace(new_col, 'bookings', 'reservations', 'gi');
      new_col := regexp_replace(new_col, 'booking', 'reservation', 'gi');
      new_col := regexp_replace(new_col, 'booked', 'reserved', 'gi');
    END IF;

    -- Only rename if changed
    IF new_col <> r.column_name THEN
      -- Check if target column already exists (conflict detection)
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = r.table_name
          AND column_name = new_col
      ) INTO target_exists;

      IF target_exists THEN
        RAISE NOTICE 'SKIP: %.% → % (target already exists)', r.table_name, r.column_name, new_col;
      ELSE
        EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.table_name, r.column_name, new_col);
        RAISE NOTICE 'Renamed: %.% → %', r.table_name, r.column_name, new_col;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- SECTION C: TABLE RENAMES (if any exist)
-- =====================================================================

DO $$
DECLARE
  r RECORD;
  new_table text;
  target_exists boolean;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name ILIKE '%book%'
    ORDER BY table_name
  LOOP
    new_table := r.table_name;

    -- General rules
    new_table := regexp_replace(new_table, 'bookings', 'reservations', 'gi');
    new_table := regexp_replace(new_table, 'booking', 'reservation', 'gi');

    -- Only rename if changed
    IF new_table <> r.table_name THEN
      -- Check if target table already exists
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = new_table
      ) INTO target_exists;

      IF target_exists THEN
        RAISE NOTICE 'SKIP TABLE: % → % (target already exists)', r.table_name, new_table;
      ELSE
        EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.table_name, new_table);
        RAISE NOTICE 'Renamed table: % → %', r.table_name, new_table;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- SECTION D: UPDATE COMMENTS (documentation cleanup)
-- =====================================================================

-- Update schedule_event_type comment
COMMENT ON TYPE schedule_event_type IS 
  'reserved = occupied by reservation, hold = temporary hold, maintenance = unavailable for service, buffer = cleaning/travel/prep time';

-- =====================================================================
-- SECTION E: VERIFICATION QUERIES (run after migration)
-- =====================================================================

-- These are included for documentation; run manually to verify:
-- 
-- E1) Check for remaining enum drift:
-- SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE e.enumlabel ILIKE '%book%';
-- Expected: 0 rows
--
-- E2) Check for remaining column/table drift:
-- SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name ILIKE '%book%' OR column_name ILIKE '%book%');
-- Expected: 0 rows

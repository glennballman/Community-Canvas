BEGIN;

-- ===========================================================================
-- B1.1: Add spatial/plan fields to cc_units
-- ===========================================================================

ALTER TABLE cc_units
  ADD COLUMN IF NOT EXISTS layout_ref text,
  ADD COLUMN IF NOT EXISTS layout_x numeric,
  ADD COLUMN IF NOT EXISTS layout_y numeric,
  ADD COLUMN IF NOT EXISTS layout_rotation numeric,
  ADD COLUMN IF NOT EXISTS layout_shape jsonb,
  ADD COLUMN IF NOT EXISTS layout_bounds jsonb,
  ADD COLUMN IF NOT EXISTS is_public_searchable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS ix_cc_units_property_type
  ON cc_units (property_id, unit_type);

CREATE INDEX IF NOT EXISTS ix_cc_units_property_layout_ref
  ON cc_units (property_id, layout_ref);

CREATE INDEX IF NOT EXISTS ix_cc_units_property_type_sort
  ON cc_units (property_id, unit_type, sort_order);

CREATE INDEX IF NOT EXISTS ix_cc_units_public_searchable
  ON cc_units (is_public_searchable)
  WHERE is_public_searchable = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cc_units_property_type_code
  ON cc_units (property_id, unit_type, code)
  WHERE code IS NOT NULL AND length(trim(code)) > 0;

-- ===========================================================================
-- B1.2: Add time windows to cc_reservation_allocations
-- ===========================================================================

ALTER TABLE cc_reservation_allocations
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS unit_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cc_reservation_allocations_unit'
    AND table_name = 'cc_reservation_allocations'
  ) THEN
    ALTER TABLE cc_reservation_allocations
      ADD CONSTRAINT fk_cc_reservation_allocations_unit
      FOREIGN KEY (unit_id) REFERENCES cc_units(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill time window for existing allocations (critical for correct availability)
UPDATE cc_reservation_allocations a
SET
  starts_at = ci.start_at,
  ends_at   = ci.end_at
FROM cc_reservation_cart_items ci
WHERE a.reservation_item_id = ci.id
  AND (a.starts_at IS NULL OR a.ends_at IS NULL)
  AND ci.start_at IS NOT NULL
  AND ci.end_at IS NOT NULL;

-- Time-window sanity constraint (prevents bad data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ck_cc_reservation_allocations_time_window'
      AND table_name = 'cc_reservation_allocations'
  ) THEN
    ALTER TABLE cc_reservation_allocations
      ADD CONSTRAINT ck_cc_reservation_allocations_time_window
      CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_cc_res_alloc_inventory_time
  ON cc_reservation_allocations (inventory_unit_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS ix_cc_res_alloc_unit_time
  ON cc_reservation_allocations (unit_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS ix_cc_res_alloc_reservation_item
  ON cc_reservation_allocations (reservation_item_id);

-- ===========================================================================
-- B1.3: Detail tables
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cc_parking_unit_details (
  unit_id uuid PRIMARY KEY REFERENCES cc_units(id) ON DELETE CASCADE,
  zone_code text,
  size_class text,
  power_available boolean NOT NULL DEFAULT false,
  covered boolean NOT NULL DEFAULT false,
  accessible boolean NOT NULL DEFAULT false,
  ev_charging boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cc_marina_unit_details (
  unit_id uuid PRIMARY KEY REFERENCES cc_units(id) ON DELETE CASCADE,
  dock_code text,
  dock_side text,
  min_length_ft numeric,
  max_length_ft numeric,
  max_beam_ft numeric,
  max_draft_ft numeric,
  power_service text,
  has_water boolean NOT NULL DEFAULT true,
  has_pump_out boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cc_bed_unit_details (
  unit_id uuid PRIMARY KEY REFERENCES cc_units(id) ON DELETE CASCADE,
  bed_type text,
  privacy_level text,
  linens_provided boolean NOT NULL DEFAULT true,
  accessible boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

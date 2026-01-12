-- V3.3.1 Block 05: Reservations + Reservation Items + Soft Holds
-- Create reservation system with line items and time-limited soft holds

-- ============================================================================
-- cc_reservation_items - Line items within a reservation
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_reservation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES cc_reservations(id) ON DELETE CASCADE,
  
  offer_id UUID NOT NULL REFERENCES cc_offers(id),
  facility_id UUID NOT NULL REFERENCES cc_facilities(id),
  
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_id UUID REFERENCES cc_inventory_units(id),
  
  base_price_cents INTEGER NOT NULL,
  adjustments_json JSONB DEFAULT '[]'::jsonb,
  subtotal_cents INTEGER NOT NULL,
  taxes_json JSONB DEFAULT '[]'::jsonb,
  total_cents INTEGER NOT NULL,
  
  length_ft NUMERIC(8, 2),
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- cc_reservation_allocations - Unit assignments with hold mechanics
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_reservation_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  reservation_item_id UUID NOT NULL REFERENCES cc_reservation_items(id) ON DELETE CASCADE,
  inventory_unit_id UUID NOT NULL REFERENCES cc_inventory_units(id),
  
  allocated_length_ft NUMERIC(8, 2),
  position_start_ft NUMERIC(8, 2),
  
  display_label VARCHAR(100) NOT NULL,
  
  hold_type VARCHAR(10) NOT NULL CHECK (hold_type IN ('soft', 'hard')),
  hold_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- EXTEND cc_reservations
-- ============================================================================

ALTER TABLE cc_reservations 
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hold_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- Add check constraints if not exists
DO $$ BEGIN
  ALTER TABLE cc_reservations 
    ADD CONSTRAINT cc_reservations_source_check 
    CHECK (source IS NULL OR source IN ('direct', 'portal', 'chamber', 'partner', 'import'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cc_reservations 
    ADD CONSTRAINT cc_reservations_hold_type_check 
    CHECK (hold_type IS NULL OR hold_type IN ('soft', 'hard'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS cc_reservation_items_reservation_idx ON cc_reservation_items(reservation_id);
CREATE INDEX IF NOT EXISTS cc_reservation_items_unit_idx ON cc_reservation_items(unit_id);
CREATE INDEX IF NOT EXISTS cc_reservation_items_tenant_idx ON cc_reservation_items(tenant_id);
CREATE INDEX IF NOT EXISTS cc_reservation_items_offer_idx ON cc_reservation_items(offer_id);
CREATE INDEX IF NOT EXISTS cc_reservation_items_status_idx ON cc_reservation_items(status);

CREATE INDEX IF NOT EXISTS cc_reservation_allocations_unit_idx ON cc_reservation_allocations(inventory_unit_id);
CREATE INDEX IF NOT EXISTS cc_reservation_allocations_expires_idx ON cc_reservation_allocations(hold_expires_at) WHERE hold_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS cc_reservation_allocations_item_idx ON cc_reservation_allocations(reservation_item_id);
CREATE INDEX IF NOT EXISTS cc_reservation_allocations_tenant_idx ON cc_reservation_allocations(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS cc_reservations_idempotency_idx 
  ON cc_reservations(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_reservation_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_reservation_items_tenant_isolation ON cc_reservation_items;
CREATE POLICY cc_reservation_items_tenant_isolation ON cc_reservation_items
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

DROP POLICY IF EXISTS cc_reservation_allocations_tenant_isolation ON cc_reservation_allocations;
CREATE POLICY cc_reservation_allocations_tenant_isolation ON cc_reservation_allocations
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_reservation_items TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_reservation_allocations TO PUBLIC;

-- ============================================================================
-- DAILY SEQUENCE TABLE for confirmation numbers
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_daily_sequences (
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  sequence_date DATE NOT NULL,
  sequence_type VARCHAR(32) NOT NULL DEFAULT 'reservation',
  current_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, sequence_date, sequence_type)
);

GRANT SELECT, INSERT, UPDATE ON cc_daily_sequences TO PUBLIC;

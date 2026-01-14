-- ============================================================================
-- MIGRATION A: PMS SPINE (Prompts 14-16 Completion) - CORRECTED
-- cc_folios, cc_folio_ledger, cc_rate_plans
-- Purpose: Replace Cloudbeds for Woods End Landing
-- 
-- FIXES APPLIED:
-- A1: Proper RLS immutability (separate SELECT/INSERT, explicit UPDATE/DELETE deny)
-- A2: Use pgcrypto digest() instead of sha256()
-- A3: Guard cc_set_updated_at() creation to avoid collisions
-- ============================================================================

-- ============================================================================
-- PREREQUISITES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- SHARED TRIGGER FUNCTION (Guarded Creation)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'cc_set_updated_at' AND n.nspname = 'public'
    ) THEN
        CREATE FUNCTION cc_set_updated_at()
        RETURNS TRIGGER AS $fn$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $fn$ LANGUAGE plpgsql;
    END IF;
END $$;

-- ============================================================================
-- ENUMS (Idempotent Creation)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE folio_status AS ENUM (
        'open',           -- Active guest stay
        'checked_out',    -- Guest departed, pending settlement
        'settled',        -- All charges reconciled
        'disputed',       -- Under review
        'void'            -- Cancelled/voided
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE folio_ledger_entry_type AS ENUM (
        'charge',         -- Positive: room, service, damage
        'payment',        -- Negative: payment received
        'adjustment',     -- Correction (positive or negative)
        'reversal',       -- Undo a previous entry
        'tax',            -- Tax charge
        'deposit',        -- Security deposit hold
        'refund'          -- Money returned to guest
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE rate_plan_type AS ENUM (
        'standard',       -- Base rate
        'seasonal',       -- Date-range specific
        'length_stay',    -- Discount for longer stays
        'member',         -- Portal member rate
        'corporate',      -- Business/government rate
        'promotional'     -- Limited-time offer
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE rate_plan_status AS ENUM (
        'draft',
        'active',
        'suspended',
        'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: cc_rate_plans
-- schema.org: PriceSpecification pattern
-- Must exist before cc_folios (foreign key dependency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_rate_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Identity
    code TEXT NOT NULL,                              -- "PEAK-2025", "WEEKLY-DISCOUNT"
    name TEXT NOT NULL,                              -- Human-readable name
    description TEXT,
    
    -- Classification
    plan_type rate_plan_type NOT NULL DEFAULT 'standard',
    status rate_plan_status NOT NULL DEFAULT 'draft',
    
    -- Scope: What does this rate apply to?
    asset_type_id UUID REFERENCES cc_asset_types(id),  -- NULL = all asset types
    facility_id UUID REFERENCES cc_facilities(id),      -- NULL = all facilities
    offer_id UUID REFERENCES cc_offers(id),             -- Link to specific offer
    
    -- Date Range (for seasonal rates)
    valid_from DATE,
    valid_to DATE,
    
    -- Length of Stay Rules
    min_nights INTEGER DEFAULT 1,
    max_nights INTEGER,                              -- NULL = unlimited
    
    -- Pricing
    base_rate_cents INTEGER NOT NULL,                -- Base nightly rate in cents
    currency TEXT NOT NULL DEFAULT 'CAD',
    
    -- Modifiers
    weekend_rate_cents INTEGER,                      -- Override for Fri/Sat
    weekly_discount_pct NUMERIC(5,2) DEFAULT 0,      -- % off for 7+ nights
    monthly_discount_pct NUMERIC(5,2) DEFAULT 0,    -- % off for 28+ nights
    
    -- Restrictions
    requires_membership BOOLEAN DEFAULT FALSE,
    member_plan_id UUID REFERENCES cc_plans(id),     -- Required plan for member rates
    
    -- Priority (higher = checked first)
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES cc_individuals(id),
    
    -- Constraints
    CONSTRAINT uq_rate_plan_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT ck_rate_plan_date_range CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to),
    CONSTRAINT ck_rate_plan_nights CHECK (min_nights >= 1 AND (max_nights IS NULL OR max_nights >= min_nights)),
    CONSTRAINT ck_rate_plan_base_rate CHECK (base_rate_cents > 0)
);

-- Indexes for rate selection queries
CREATE INDEX IF NOT EXISTS idx_rate_plans_tenant_status ON cc_rate_plans(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rate_plans_dates ON cc_rate_plans(valid_from, valid_to) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rate_plans_asset_type ON cc_rate_plans(asset_type_id) WHERE asset_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_plans_facility ON cc_rate_plans(facility_id) WHERE facility_id IS NOT NULL;

-- ============================================================================
-- TABLE: cc_folios
-- schema.org: Invoice pattern (aggregates charges for a stay)
-- One folio per reservation (can have multiple reservations per guest over time)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Identity
    folio_number TEXT NOT NULL,                      -- "WEL-2025-00001" (tenant-specific sequence)
    status folio_status NOT NULL DEFAULT 'open',
    
    -- Guest Information (denormalized for PMS display)
    guest_party_id UUID NOT NULL REFERENCES cc_parties(id),
    guest_name TEXT NOT NULL,                        -- Snapshot at check-in
    guest_email TEXT,
    guest_phone TEXT,
    
    -- Stay Information
    reservation_id UUID REFERENCES cc_reservations(id),
    asset_id UUID REFERENCES cc_assets(id),          -- Room/unit assigned
    facility_id UUID REFERENCES cc_facilities(id),
    
    -- Rate Applied
    rate_plan_id UUID REFERENCES cc_rate_plans(id),
    nightly_rate_cents INTEGER NOT NULL,             -- Locked rate for this stay
    currency TEXT NOT NULL DEFAULT 'CAD',
    
    -- Dates
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    actual_check_in TIMESTAMPTZ,                     -- When they actually arrived
    actual_check_out TIMESTAMPTZ,                    -- When they actually left
    nights_stayed INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
    
    -- Calculated Totals (updated by triggers/functions)
    room_charges_cents INTEGER NOT NULL DEFAULT 0,
    service_charges_cents INTEGER NOT NULL DEFAULT 0,
    tax_charges_cents INTEGER NOT NULL DEFAULT 0,
    payments_received_cents INTEGER NOT NULL DEFAULT 0,
    adjustments_cents INTEGER NOT NULL DEFAULT 0,
    balance_due_cents INTEGER GENERATED ALWAYS AS (
        room_charges_cents + service_charges_cents + tax_charges_cents + adjustments_cents - payments_received_cents
    ) STORED,
    
    -- Deposit/Security
    deposit_required_cents INTEGER DEFAULT 0,
    deposit_collected_cents INTEGER DEFAULT 0,
    
    -- Settlement
    settled_at TIMESTAMPTZ,
    settled_by UUID REFERENCES cc_individuals(id),
    
    -- Notes
    internal_notes TEXT,                             -- Staff only
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES cc_individuals(id),
    
    -- Constraints
    CONSTRAINT uq_folio_tenant_number UNIQUE (tenant_id, folio_number),
    CONSTRAINT ck_folio_dates CHECK (check_out_date > check_in_date)
);

-- Indexes for PMS queries
CREATE INDEX IF NOT EXISTS idx_folios_tenant_status ON cc_folios(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_folios_guest ON cc_folios(guest_party_id);
CREATE INDEX IF NOT EXISTS idx_folios_reservation ON cc_folios(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folios_dates ON cc_folios(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_folios_facility ON cc_folios(facility_id);
CREATE INDEX IF NOT EXISTS idx_folios_open ON cc_folios(tenant_id, check_in_date) WHERE status = 'open';

-- ============================================================================
-- TABLE: cc_folio_ledger
-- IMMUTABLE LEDGER: Never update or delete - only insert reversals
-- schema.org: MonetaryAmount pattern
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_folio_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    folio_id UUID NOT NULL REFERENCES cc_folios(id) ON DELETE CASCADE,
    
    -- Entry Classification
    entry_type folio_ledger_entry_type NOT NULL,
    
    -- Reference (what generated this entry)
    reference_type TEXT,                             -- 'room_night', 'minibar', 'damage', 'manual'
    reference_id UUID,                               -- Link to source record if applicable
    
    -- For reversals: link to original entry
    reverses_entry_id UUID REFERENCES cc_folio_ledger(id),
    
    -- Description
    description TEXT NOT NULL,                       -- "Room charge: Jan 15, 2025"
    
    -- Amount (positive = charge to guest, negative = credit to guest)
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CAD',
    
    -- For tax entries: link to tax rule
    tax_rule_id UUID REFERENCES cc_tax_rules(id),
    tax_rate_pct NUMERIC(5,2),                       -- Snapshot of rate at time of charge
    
    -- Service date (for room nights, the specific night)
    service_date DATE,
    
    -- Who posted this
    posted_by UUID REFERENCES cc_individuals(id),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- External payment reference
    payment_method TEXT,                             -- 'card', 'cash', 'transfer', 'wallet'
    payment_reference TEXT,                          -- Transaction ID from PSP
    
    -- Immutability proof (SHA-256 hash)
    entry_hash TEXT,
    
    -- Sequence within folio (for display order)
    sequence_number INTEGER NOT NULL,
    
    -- Constraints
    CONSTRAINT ck_ledger_reversal CHECK (
        (entry_type = 'reversal' AND reverses_entry_id IS NOT NULL) OR
        (entry_type != 'reversal')
    )
);

-- Indexes for ledger queries
CREATE INDEX IF NOT EXISTS idx_folio_ledger_folio ON cc_folio_ledger(folio_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_folio_ledger_tenant ON cc_folio_ledger(tenant_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_folio_ledger_type ON cc_folio_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_folio_ledger_service_date ON cc_folio_ledger(service_date) WHERE service_date IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_folio_ledger ENABLE ROW LEVEL SECURITY;

-- Rate Plans: Tenant isolation + service mode bypass
DROP POLICY IF EXISTS rate_plans_tenant_isolation ON cc_rate_plans;
CREATE POLICY rate_plans_tenant_isolation ON cc_rate_plans
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Folios: Tenant isolation + service mode bypass
DROP POLICY IF EXISTS folios_tenant_isolation ON cc_folios;
CREATE POLICY folios_tenant_isolation ON cc_folios
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- ============================================================================
-- FOLIO LEDGER RLS: IMMUTABLE (FIX A1)
-- Separate policies for each command - UPDATE and DELETE explicitly denied
-- ============================================================================

-- Drop any existing policies first
DROP POLICY IF EXISTS folio_ledger_tenant_isolation ON cc_folio_ledger;
DROP POLICY IF EXISTS folio_ledger_no_delete ON cc_folio_ledger;
DROP POLICY IF EXISTS folio_ledger_select ON cc_folio_ledger;
DROP POLICY IF EXISTS folio_ledger_insert ON cc_folio_ledger;
DROP POLICY IF EXISTS folio_ledger_update ON cc_folio_ledger;
DROP POLICY IF EXISTS folio_ledger_delete ON cc_folio_ledger;

-- SELECT: Allowed with tenant isolation
CREATE POLICY folio_ledger_select ON cc_folio_ledger
    FOR SELECT
    USING (tenant_id = current_tenant_id() OR is_service_mode());

-- INSERT: Allowed with tenant isolation
CREATE POLICY folio_ledger_insert ON cc_folio_ledger
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- UPDATE: ALWAYS DENIED - Ledger is immutable
CREATE POLICY folio_ledger_update ON cc_folio_ledger
    FOR UPDATE
    USING (FALSE);

-- DELETE: ALWAYS DENIED - Ledger is immutable
CREATE POLICY folio_ledger_delete ON cc_folio_ledger
    FOR DELETE
    USING (FALSE);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate next folio number for tenant
CREATE OR REPLACE FUNCTION cc_next_folio_number(p_tenant_id UUID, p_prefix TEXT DEFAULT 'FOL')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year TEXT;
    v_seq INTEGER;
    v_number TEXT;
BEGIN
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch: cannot generate folio for other tenant';
    END IF;
    
    v_year := to_char(now(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN folio_number ~ (p_prefix || '-' || v_year || '-[0-9]+')
            THEN CAST(substring(folio_number from p_prefix || '-' || v_year || '-([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_seq
    FROM cc_folios
    WHERE tenant_id = p_tenant_id;
    
    v_number := p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
    
    RETURN v_number;
END;
$$;

-- Post ledger entry (maintains immutability) - FIX A2: Use digest()
CREATE OR REPLACE FUNCTION cc_post_folio_entry(
    p_folio_id UUID,
    p_entry_type folio_ledger_entry_type,
    p_description TEXT,
    p_amount_cents INTEGER,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_service_date DATE DEFAULT NULL,
    p_payment_method TEXT DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL,
    p_reverses_entry_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_entry_id UUID;
    v_seq INTEGER;
    v_hash TEXT;
    v_posted_at TIMESTAMPTZ;
BEGIN
    -- Get tenant from folio
    SELECT tenant_id INTO v_tenant_id FROM cc_folios WHERE id = p_folio_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Folio not found: %', p_folio_id;
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch: cannot post to folio in other tenant';
    END IF;
    
    -- Get next sequence number
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
    FROM cc_folio_ledger WHERE folio_id = p_folio_id;
    
    -- Generate entry ID and timestamp
    v_entry_id := gen_random_uuid();
    v_posted_at := now();
    
    -- Create hash for immutability proof using pgcrypto digest() (FIX A2)
    v_hash := encode(
        digest(
            concat_ws('|', 
                v_entry_id::TEXT, 
                p_folio_id::TEXT, 
                p_entry_type::TEXT, 
                p_amount_cents::TEXT, 
                v_posted_at::TEXT
            ),
            'sha256'
        ),
        'hex'
    );
    
    -- Insert entry
    INSERT INTO cc_folio_ledger (
        id, tenant_id, folio_id, entry_type, description, amount_cents,
        reference_type, reference_id, service_date,
        payment_method, payment_reference, reverses_entry_id,
        sequence_number, entry_hash,
        posted_by, posted_at
    ) VALUES (
        v_entry_id, v_tenant_id, p_folio_id, p_entry_type, p_description, p_amount_cents,
        p_reference_type, p_reference_id, p_service_date,
        p_payment_method, p_payment_reference, p_reverses_entry_id,
        v_seq, v_hash,
        CASE WHEN is_service_mode() THEN NULL ELSE current_setting('app.current_user_id', true)::UUID END,
        v_posted_at
    );
    
    -- Update folio totals
    PERFORM cc_recalculate_folio_totals(p_folio_id);
    
    RETURN v_entry_id;
END;
$$;

-- Recalculate folio totals from ledger
CREATE OR REPLACE FUNCTION cc_recalculate_folio_totals(p_folio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_room_charges INTEGER;
    v_service_charges INTEGER;
    v_tax_charges INTEGER;
    v_payments INTEGER;
    v_adjustments INTEGER;
BEGIN
    -- Get tenant from folio
    SELECT tenant_id INTO v_tenant_id FROM cc_folios WHERE id = p_folio_id;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- Calculate totals by entry type
    SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'charge' AND reference_type = 'room_night' THEN amount_cents ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'charge' AND reference_type != 'room_night' THEN amount_cents ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'tax' THEN amount_cents ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type IN ('payment', 'refund') THEN amount_cents ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type IN ('adjustment', 'reversal') THEN amount_cents ELSE 0 END), 0)
    INTO v_room_charges, v_service_charges, v_tax_charges, v_payments, v_adjustments
    FROM cc_folio_ledger
    WHERE folio_id = p_folio_id;
    
    -- Update folio
    UPDATE cc_folios SET
        room_charges_cents = v_room_charges,
        service_charges_cents = v_service_charges,
        tax_charges_cents = v_tax_charges,
        payments_received_cents = ABS(v_payments),  -- Payments are negative in ledger
        adjustments_cents = v_adjustments,
        updated_at = now()
    WHERE id = p_folio_id;
END;
$$;

-- Reverse a ledger entry (the ONLY way to "edit")
CREATE OR REPLACE FUNCTION cc_reverse_folio_entry(
    p_entry_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entry RECORD;
    v_reversal_id UUID;
BEGIN
    -- Get original entry
    SELECT * INTO v_entry FROM cc_folio_ledger WHERE id = p_entry_id;
    
    IF v_entry IS NULL THEN
        RAISE EXCEPTION 'Entry not found: %', p_entry_id;
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_entry.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- Cannot reverse a reversal
    IF v_entry.entry_type = 'reversal' THEN
        RAISE EXCEPTION 'Cannot reverse a reversal entry';
    END IF;
    
    -- Post reversal (negative of original amount)
    v_reversal_id := cc_post_folio_entry(
        v_entry.folio_id,
        'reversal',
        'REVERSAL: ' || v_entry.description || ' - ' || p_reason,
        -v_entry.amount_cents,
        'reversal',
        v_entry.id,
        v_entry.service_date,
        NULL,
        NULL,
        p_entry_id
    );
    
    RETURN v_reversal_id;
END;
$$;

-- Select best rate plan for a stay
CREATE OR REPLACE FUNCTION cc_select_rate_plan(
    p_tenant_id UUID,
    p_asset_type_id UUID,
    p_facility_id UUID,
    p_check_in DATE,
    p_check_out DATE,
    p_member_plan_id UUID DEFAULT NULL
)
RETURNS TABLE(
    rate_plan_id UUID,
    rate_plan_code TEXT,
    nightly_rate_cents INTEGER,
    total_before_tax_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nights INTEGER;
    v_plan RECORD;
    v_nightly INTEGER;
    v_total INTEGER;
BEGIN
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_nights := p_check_out - p_check_in;
    
    -- Find best matching rate plan (highest priority that matches criteria)
    SELECT * INTO v_plan
    FROM cc_rate_plans rp
    WHERE rp.tenant_id = p_tenant_id
      AND rp.status = 'active'
      AND (rp.asset_type_id IS NULL OR rp.asset_type_id = p_asset_type_id)
      AND (rp.facility_id IS NULL OR rp.facility_id = p_facility_id)
      AND (rp.valid_from IS NULL OR rp.valid_from <= p_check_in)
      AND (rp.valid_to IS NULL OR rp.valid_to >= p_check_out)
      AND v_nights >= rp.min_nights
      AND (rp.max_nights IS NULL OR v_nights <= rp.max_nights)
      AND (NOT rp.requires_membership OR rp.member_plan_id = p_member_plan_id)
    ORDER BY rp.priority DESC, rp.base_rate_cents ASC
    LIMIT 1;
    
    IF v_plan IS NULL THEN
        -- No rate found
        RETURN;
    END IF;
    
    -- Calculate nightly rate with any discounts
    v_nightly := v_plan.base_rate_cents;
    
    -- Apply length-of-stay discounts
    IF v_nights >= 28 AND v_plan.monthly_discount_pct > 0 THEN
        v_nightly := v_nightly * (1 - v_plan.monthly_discount_pct / 100);
    ELSIF v_nights >= 7 AND v_plan.weekly_discount_pct > 0 THEN
        v_nightly := v_nightly * (1 - v_plan.weekly_discount_pct / 100);
    END IF;
    
    v_total := v_nightly * v_nights;
    
    rate_plan_id := v_plan.id;
    rate_plan_code := v_plan.code;
    nightly_rate_cents := v_nightly;
    total_before_tax_cents := v_total;
    
    RETURN NEXT;
END;
$$;

-- ============================================================================
-- TRIGGERS (updated_at only)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_rate_plans_updated ON cc_rate_plans;
CREATE TRIGGER trg_rate_plans_updated
    BEFORE UPDATE ON cc_rate_plans
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_folios_updated ON cc_folios;
CREATE TRIGGER trg_folios_updated
    BEFORE UPDATE ON cc_folios
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- NOTE: No trigger on cc_folio_ledger - it is immutable (no updates allowed)

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Query 1: Verify tables exist with correct columns
SELECT 
    'cc_rate_plans' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'cc_rate_plans'
UNION ALL
SELECT 
    'cc_folios',
    COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'cc_folios'
UNION ALL
SELECT 
    'cc_folio_ledger',
    COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'cc_folio_ledger';

-- Query 2: Verify enums created
SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('folio_status', 'folio_ledger_entry_type', 'rate_plan_type', 'rate_plan_status')
GROUP BY typname;

-- Query 3: Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cc_rate_plans', 'cc_folios', 'cc_folio_ledger');

-- Query 4: Verify folio_ledger immutability policies (CRITICAL)
SELECT 
    polname,
    polcmd,
    CASE polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END as command_name,
    pg_get_expr(polqual, polrelid) as using_expr,
    pg_get_expr(polwithcheck, polrelid) as with_check_expr
FROM pg_policy
WHERE polrelid = 'cc_folio_ledger'::regclass
ORDER BY polcmd;

-- Query 5: Verify functions created with SECURITY DEFINER
SELECT proname, prosecdef as security_definer
FROM pg_proc 
WHERE proname IN (
    'cc_next_folio_number',
    'cc_post_folio_entry',
    'cc_recalculate_folio_totals',
    'cc_reverse_folio_entry',
    'cc_select_rate_plan',
    'cc_set_updated_at'
);

-- Query 6: Verify pgcrypto extension is available
SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';

-- Query 7: Test immutability - This should FAIL if RLS is working correctly
-- (Run manually in a non-service-mode session)
-- UPDATE cc_folio_ledger SET description = 'hacked' WHERE id = '00000000-0000-0000-0000-000000000000';
-- DELETE FROM cc_folio_ledger WHERE id = '00000000-0000-0000-0000-000000000000';

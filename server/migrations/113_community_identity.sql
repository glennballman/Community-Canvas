-- ============================================================================
-- MIGRATION 113: COMMUNITY IDENTITY ("Community Wallet")
-- cc_community_identities, cc_community_charges, cc_settlement_batches
--
-- Security model:
-- - cc_community_identities: issuer-only (merchants use verify function)
-- - cc_settlement_batches: verb-specific RLS (merchant can SELECT only)
-- - Ledger integration via issuer_folio_ledger_entry_ids
-- ============================================================================

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
    CREATE TYPE community_identity_status AS ENUM (
        'active',
        'suspended',
        'expired',
        'revoked'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE community_charge_status AS ENUM (
        'pending',
        'authorized',
        'settled',
        'disputed',
        'refunded',
        'void'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_batch_status AS ENUM (
        'open',
        'calculating',
        'pending_approval',
        'approved',
        'processing',
        'completed',
        'failed',
        'void'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE charge_category AS ENUM (
        'accommodation',
        'parking',
        'marina',
        'food_beverage',
        'retail',
        'service',
        'activity',
        'transport',
        'damage',
        'fee',
        'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: cc_community_identities
-- The "Community Wallet" - issued by accommodation providers to guests
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_community_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Issuing tenant (who created - accommodation provider)
    issuing_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Identity holder
    party_id UUID NOT NULL REFERENCES cc_parties(id),
    individual_id UUID REFERENCES cc_individuals(id),
    
    -- Display info
    display_name TEXT NOT NULL,
    
    -- Credentials
    identity_code TEXT NOT NULL,                     -- Unique code for identification
    pin_hash TEXT,                                   -- Hashed PIN for verification
    qr_code_data TEXT,                               -- QR code payload
    
    -- Link to accommodation
    folio_id UUID REFERENCES cc_folios(id),
    reservation_id UUID,                             -- Reference to reservation
    
    -- Status
    status community_identity_status NOT NULL DEFAULT 'active',
    
    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ NOT NULL,
    
    -- Spending controls
    spending_limit_cents INTEGER,                    -- Total spending limit
    daily_limit_cents INTEGER,                       -- Daily spending limit
    single_charge_limit_cents INTEGER,               -- Per-transaction limit
    allowed_categories TEXT[],                       -- Allowed charge categories
    blocked_tenant_ids TEXT[],                       -- Blocked merchants
    
    -- Running totals
    total_charges_cents INTEGER NOT NULL DEFAULT 0,
    total_settled_cents INTEGER NOT NULL DEFAULT 0,
    pending_charges_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Verification settings
    require_pin BOOLEAN DEFAULT FALSE,
    require_pin_above_cents INTEGER,                 -- Require PIN above this amount
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES cc_individuals(id),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES cc_individuals(id),
    revoke_reason TEXT,
    
    -- Constraints
    CONSTRAINT uq_community_identity_code UNIQUE (identity_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_identities_issuer ON cc_community_identities(issuing_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_community_identities_party ON cc_community_identities(party_id);
CREATE INDEX IF NOT EXISTS idx_community_identities_folio ON cc_community_identities(folio_id) WHERE folio_id IS NOT NULL;

-- ============================================================================
-- TABLE: cc_community_charges
-- Charges made against a community identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_community_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity being charged
    community_identity_id UUID NOT NULL REFERENCES cc_community_identities(id) ON DELETE CASCADE,
    
    -- Merchant
    merchant_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Charge identity
    charge_number TEXT NOT NULL,                     -- "CHG-2025-00001"
    status community_charge_status NOT NULL DEFAULT 'pending',
    category charge_category NOT NULL DEFAULT 'other',
    
    -- Details
    description TEXT NOT NULL,
    line_items JSONB,                                -- [{name, qty, unit_price_cents}]
    
    -- Amounts
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    tip_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CAD',
    
    -- Tax breakdown
    tax_breakdown JSONB,                             -- {GST: 500, PST: 700}
    
    -- Verification
    pin_verified BOOLEAN DEFAULT FALSE,
    verified_by_staff BOOLEAN DEFAULT FALSE,
    staff_id UUID REFERENCES cc_individuals(id),
    
    -- Location
    facility_id UUID REFERENCES cc_facilities(id),
    asset_id UUID,                                   -- Could be any asset
    location_description TEXT,
    
    -- POS reference
    terminal_id TEXT,
    pos_reference TEXT,
    
    -- Settlement
    settlement_batch_id UUID,                        -- FK added after table created
    settled_at TIMESTAMPTZ,
    
    -- Dispute
    disputed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMPTZ,
    dispute_resolution TEXT,
    
    -- Refund
    refunded_at TIMESTAMPTZ,
    refund_amount_cents INTEGER,
    refund_reason TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES cc_individuals(id),
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES cc_individuals(id),
    void_reason TEXT,
    
    -- Constraints
    CONSTRAINT uq_charge_merchant_number UNIQUE (merchant_tenant_id, charge_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_charges_identity ON cc_community_charges(community_identity_id);
CREATE INDEX IF NOT EXISTS idx_community_charges_merchant ON cc_community_charges(merchant_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_community_charges_settlement ON cc_community_charges(settlement_batch_id) WHERE settlement_batch_id IS NOT NULL;

-- ============================================================================
-- TABLE: cc_settlement_batches
-- Settlement between issuer (accommodation) and merchant
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    batch_number TEXT NOT NULL,                      -- "STL-2025-00001"
    status settlement_batch_status NOT NULL DEFAULT 'open',
    
    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Tenants
    issuing_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    merchant_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Aggregated amounts
    gross_charges_cents INTEGER NOT NULL DEFAULT 0,
    charge_count INTEGER NOT NULL DEFAULT 0,
    
    -- Fees
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    platform_fee_pct NUMERIC(5,2) DEFAULT 0,
    interchange_fee_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Net settlement
    net_settlement_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Tax summary
    total_tax_collected_cents INTEGER NOT NULL DEFAULT 0,
    tax_summary JSONB,                               -- {GST: 5000, PST: 7000}
    
    -- Approval
    calculated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES cc_individuals(id),
    
    -- Payment
    payment_initiated_at TIMESTAMPTZ,
    payment_completed_at TIMESTAMPTZ,
    payment_reference TEXT,
    payment_method TEXT,
    
    -- Ledger integration
    issuer_folio_ledger_entry_ids UUID[],            -- Links to cc_folio_ledger entries
    issuer_folio_entries JSONB,                      -- Backward compat JSONB
    
    -- Reconciliation
    merchant_received_confirmation BOOLEAN DEFAULT FALSE,
    
    -- Failure
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    
    -- Notes
    internal_notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_settlement_batch_number UNIQUE (batch_number),
    CONSTRAINT uq_settlement_period_tenants UNIQUE (period_start, period_end, issuing_tenant_id, merchant_tenant_id)
);

-- Add FK from cc_community_charges to cc_settlement_batches
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_charges_settlement_batch' 
          AND table_name = 'cc_community_charges'
    ) THEN
        ALTER TABLE cc_community_charges 
        ADD CONSTRAINT fk_charges_settlement_batch 
        FOREIGN KEY (settlement_batch_id) 
        REFERENCES cc_settlement_batches(id);
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlement_batches_issuer ON cc_settlement_batches(issuing_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_merchant ON cc_settlement_batches(merchant_tenant_id, status);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_community_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_community_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_settlement_batches ENABLE ROW LEVEL SECURITY;

-- Community Identities: Issuer-only access (merchants use verify function)
DROP POLICY IF EXISTS community_identities_issuer_only ON cc_community_identities;
CREATE POLICY community_identities_issuer_only ON cc_community_identities
    FOR ALL
    USING (issuing_tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (issuing_tenant_id = current_tenant_id() OR is_service_mode());

-- Community Charges: Both issuer and merchant can access
DROP POLICY IF EXISTS community_charges_tenant_access ON cc_community_charges;
CREATE POLICY community_charges_tenant_access ON cc_community_charges
    FOR ALL
    USING (
        merchant_tenant_id = current_tenant_id() 
        OR EXISTS (
            SELECT 1 FROM cc_community_identities ci 
            WHERE ci.id = community_identity_id 
            AND ci.issuing_tenant_id = current_tenant_id()
        )
        OR is_service_mode()
    )
    WITH CHECK (
        merchant_tenant_id = current_tenant_id() 
        OR is_service_mode()
    );

-- Settlement Batches: Verb-specific policies
-- SELECT: Both issuer and merchant can view
DROP POLICY IF EXISTS settlement_batches_select ON cc_settlement_batches;
CREATE POLICY settlement_batches_select ON cc_settlement_batches
    FOR SELECT
    USING (
        issuing_tenant_id = current_tenant_id() 
        OR merchant_tenant_id = current_tenant_id()
        OR is_service_mode()
    );

-- INSERT/UPDATE: Only issuer or service mode
DROP POLICY IF EXISTS settlement_batches_modify ON cc_settlement_batches;
CREATE POLICY settlement_batches_modify ON cc_settlement_batches
    FOR INSERT
    WITH CHECK (issuing_tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS settlement_batches_update ON cc_settlement_batches;
CREATE POLICY settlement_batches_update ON cc_settlement_batches
    FOR UPDATE
    USING (issuing_tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (issuing_tenant_id = current_tenant_id() OR is_service_mode());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate next charge number for merchant
CREATE OR REPLACE FUNCTION cc_next_charge_number(p_merchant_tenant_id UUID, p_prefix TEXT DEFAULT 'CHG')
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
    v_year := to_char(now(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN charge_number ~ (p_prefix || '-' || v_year || '-[0-9]+')
            THEN CAST(substring(charge_number from p_prefix || '-' || v_year || '-([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_seq
    FROM cc_community_charges
    WHERE merchant_tenant_id = p_merchant_tenant_id;
    
    v_number := p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
    
    RETURN v_number;
END;
$$;

-- Generate next settlement batch number
CREATE OR REPLACE FUNCTION cc_next_settlement_batch_number(p_issuing_tenant_id UUID, p_prefix TEXT DEFAULT 'STL')
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
    v_year := to_char(now(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN batch_number ~ (p_prefix || '-' || v_year || '-[0-9]+')
            THEN CAST(substring(batch_number from p_prefix || '-' || v_year || '-([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_seq
    FROM cc_settlement_batches
    WHERE issuing_tenant_id = p_issuing_tenant_id;
    
    v_number := p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
    
    RETURN v_number;
END;
$$;

-- Verify community identity (for merchants)
CREATE OR REPLACE FUNCTION cc_verify_community_identity(
    p_identity_code TEXT,
    p_pin TEXT DEFAULT NULL
)
RETURNS TABLE(
    identity_id UUID,
    display_name TEXT,
    status community_identity_status,
    is_valid BOOLEAN,
    remaining_limit_cents INTEGER,
    daily_remaining_cents INTEGER,
    allowed_categories TEXT[],
    pin_required BOOLEAN,
    pin_valid BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_identity RECORD;
    v_today_charges INTEGER;
    v_pin_valid BOOLEAN;
    v_error TEXT;
BEGIN
    -- Find identity by code
    SELECT * INTO v_identity
    FROM cc_community_identities
    WHERE identity_code = p_identity_code;
    
    IF v_identity IS NULL THEN
        RETURN QUERY SELECT 
            NULL::UUID, NULL::TEXT, NULL::community_identity_status,
            FALSE, NULL::INTEGER, NULL::INTEGER, NULL::TEXT[],
            FALSE, FALSE, 'Identity not found'::TEXT;
        RETURN;
    END IF;
    
    -- Check status
    IF v_identity.status != 'active' THEN
        v_error := 'Identity is ' || v_identity.status;
    ELSIF now() < v_identity.valid_from THEN
        v_error := 'Identity not yet valid';
    ELSIF now() > v_identity.valid_until THEN
        v_error := 'Identity expired';
    END IF;
    
    -- Calculate today's charges
    SELECT COALESCE(SUM(total_cents), 0) INTO v_today_charges
    FROM cc_community_charges
    WHERE community_identity_id = v_identity.id
      AND DATE(created_at) = CURRENT_DATE
      AND status NOT IN ('void', 'refunded');
    
    -- Check PIN if provided and required
    v_pin_valid := FALSE;
    IF v_identity.pin_hash IS NOT NULL AND p_pin IS NOT NULL THEN
        v_pin_valid := (v_identity.pin_hash = crypt(p_pin, v_identity.pin_hash));
    ELSIF v_identity.pin_hash IS NULL THEN
        v_pin_valid := TRUE; -- No PIN required
    END IF;
    
    RETURN QUERY SELECT 
        v_identity.id,
        v_identity.display_name,
        v_identity.status,
        (v_error IS NULL),
        (v_identity.spending_limit_cents - v_identity.total_charges_cents)::INTEGER,
        (v_identity.daily_limit_cents - v_today_charges)::INTEGER,
        v_identity.allowed_categories,
        (v_identity.require_pin OR (v_identity.require_pin_above_cents IS NOT NULL)),
        v_pin_valid,
        v_error;
END;
$$;

-- Create a charge against a community identity
CREATE OR REPLACE FUNCTION cc_create_community_charge(
    p_identity_code TEXT,
    p_category charge_category,
    p_description TEXT,
    p_subtotal_cents INTEGER,
    p_tax_cents INTEGER DEFAULT 0,
    p_tip_cents INTEGER DEFAULT 0,
    p_line_items JSONB DEFAULT NULL,
    p_pin TEXT DEFAULT NULL,
    p_facility_id UUID DEFAULT NULL,
    p_pos_reference TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_identity RECORD;
    v_merchant_tenant_id UUID;
    v_charge_id UUID;
    v_charge_number TEXT;
    v_total_cents INTEGER;
    v_today_charges INTEGER;
    v_pin_valid BOOLEAN;
BEGIN
    v_merchant_tenant_id := current_tenant_id();
    IF v_merchant_tenant_id IS NULL AND NOT is_service_mode() THEN
        RAISE EXCEPTION 'No tenant context';
    END IF;
    
    -- Get identity
    SELECT * INTO v_identity
    FROM cc_community_identities
    WHERE identity_code = p_identity_code;
    
    IF v_identity IS NULL THEN
        RAISE EXCEPTION 'Identity not found';
    END IF;
    
    -- Validate status
    IF v_identity.status != 'active' THEN
        RAISE EXCEPTION 'Identity is %', v_identity.status;
    END IF;
    IF now() < v_identity.valid_from OR now() > v_identity.valid_until THEN
        RAISE EXCEPTION 'Identity not valid at this time';
    END IF;
    
    -- Check blocked merchants
    IF v_merchant_tenant_id::TEXT = ANY(v_identity.blocked_tenant_ids) THEN
        RAISE EXCEPTION 'Merchant is blocked for this identity';
    END IF;
    
    -- Check category allowed
    IF v_identity.allowed_categories IS NOT NULL 
       AND NOT (p_category::TEXT = ANY(v_identity.allowed_categories)) THEN
        RAISE EXCEPTION 'Category % not allowed', p_category;
    END IF;
    
    v_total_cents := p_subtotal_cents + p_tax_cents + p_tip_cents;
    
    -- Check single charge limit
    IF v_identity.single_charge_limit_cents IS NOT NULL 
       AND v_total_cents > v_identity.single_charge_limit_cents THEN
        RAISE EXCEPTION 'Charge exceeds single transaction limit';
    END IF;
    
    -- Check total spending limit
    IF v_identity.spending_limit_cents IS NOT NULL 
       AND (v_identity.total_charges_cents + v_total_cents) > v_identity.spending_limit_cents THEN
        RAISE EXCEPTION 'Charge would exceed total spending limit';
    END IF;
    
    -- Check daily limit
    IF v_identity.daily_limit_cents IS NOT NULL THEN
        SELECT COALESCE(SUM(total_cents), 0) INTO v_today_charges
        FROM cc_community_charges
        WHERE community_identity_id = v_identity.id
          AND DATE(created_at) = CURRENT_DATE
          AND status NOT IN ('void', 'refunded');
        
        IF (v_today_charges + v_total_cents) > v_identity.daily_limit_cents THEN
            RAISE EXCEPTION 'Charge would exceed daily limit';
        END IF;
    END IF;
    
    -- Check PIN if required
    v_pin_valid := FALSE;
    IF v_identity.require_pin 
       OR (v_identity.require_pin_above_cents IS NOT NULL AND v_total_cents > v_identity.require_pin_above_cents) THEN
        IF p_pin IS NULL THEN
            RAISE EXCEPTION 'PIN required for this transaction';
        END IF;
        IF v_identity.pin_hash IS NULL THEN
            RAISE EXCEPTION 'No PIN configured for this identity';
        END IF;
        IF v_identity.pin_hash != crypt(p_pin, v_identity.pin_hash) THEN
            RAISE EXCEPTION 'Invalid PIN';
        END IF;
        v_pin_valid := TRUE;
    END IF;
    
    -- Generate charge number
    v_charge_number := cc_next_charge_number(v_merchant_tenant_id);
    v_charge_id := gen_random_uuid();
    
    -- Create charge
    INSERT INTO cc_community_charges (
        id, community_identity_id, merchant_tenant_id,
        charge_number, status, category,
        description, line_items,
        subtotal_cents, tax_cents, tip_cents, total_cents,
        pin_verified, facility_id, pos_reference
    ) VALUES (
        v_charge_id, v_identity.id, v_merchant_tenant_id,
        v_charge_number, 'authorized', p_category,
        p_description, p_line_items,
        p_subtotal_cents, p_tax_cents, p_tip_cents, v_total_cents,
        v_pin_valid, p_facility_id, p_pos_reference
    );
    
    -- Update identity totals
    UPDATE cc_community_identities SET
        total_charges_cents = total_charges_cents + v_total_cents,
        pending_charges_cents = pending_charges_cents + v_total_cents,
        updated_at = now()
    WHERE id = v_identity.id;
    
    RETURN v_charge_id;
END;
$$;

-- Void a charge
CREATE OR REPLACE FUNCTION cc_void_community_charge(
    p_charge_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_charge RECORD;
    v_user_id UUID;
BEGIN
    SELECT * INTO v_charge FROM cc_community_charges WHERE id = p_charge_id;
    
    IF v_charge IS NULL THEN
        RAISE EXCEPTION 'Charge not found';
    END IF;
    
    -- Only merchant can void
    IF NOT is_service_mode() AND v_charge.merchant_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Not authorized to void this charge';
    END IF;
    
    IF v_charge.status NOT IN ('pending', 'authorized') THEN
        RAISE EXCEPTION 'Cannot void charge in status %', v_charge.status;
    END IF;
    
    v_user_id := current_setting('app.current_user_id', true)::UUID;
    
    -- Void the charge
    UPDATE cc_community_charges SET
        status = 'void',
        voided_at = now(),
        voided_by = v_user_id,
        void_reason = p_reason,
        updated_at = now()
    WHERE id = p_charge_id;
    
    -- Update identity totals
    UPDATE cc_community_identities SET
        total_charges_cents = total_charges_cents - v_charge.total_cents,
        pending_charges_cents = pending_charges_cents - v_charge.total_cents,
        updated_at = now()
    WHERE id = v_charge.community_identity_id;
    
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_community_identities_updated ON cc_community_identities;
CREATE TRIGGER trg_community_identities_updated
    BEFORE UPDATE ON cc_community_identities
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_community_charges_updated ON cc_community_charges;
CREATE TRIGGER trg_community_charges_updated
    BEFORE UPDATE ON cc_community_charges
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_settlement_batches_updated ON cc_settlement_batches;
CREATE TRIGGER trg_settlement_batches_updated
    BEFORE UPDATE ON cc_settlement_batches
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Query 1: Verify tables exist with correct columns
SELECT 
    'cc_community_identities' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'cc_community_identities'
UNION ALL
SELECT 
    'cc_community_charges',
    COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'cc_community_charges'
UNION ALL
SELECT 
    'cc_settlement_batches',
    COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'cc_settlement_batches';

-- Query 2: Verify enums created
SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('community_identity_status', 'community_charge_status', 'settlement_batch_status', 'charge_category')
GROUP BY typname;

-- Query 3: Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cc_community_identities', 'cc_community_charges', 'cc_settlement_batches');

-- Query 4: Verify functions created
SELECT proname, prosecdef as security_definer
FROM pg_proc 
WHERE proname IN (
    'cc_next_charge_number',
    'cc_next_settlement_batch_number',
    'cc_verify_community_identity',
    'cc_create_community_charge',
    'cc_void_community_charge'
);

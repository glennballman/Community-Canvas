-- ============================================================================
-- MIGRATION B: ENFORCEMENT ACTIONS (Prompt 17 Completion) - CORRECTED
-- cc_enforcement_actions, cc_enforcement_fine_schedule
-- Purpose: Parking/marina violation ticketing system
-- Note: cc_tow_requests already exists - this adds the ticketing layer
-- 
-- FIXES APPLIED:
-- B1: Guard cc_set_updated_at() creation (may already exist from Migration A)
-- ============================================================================

-- ============================================================================
-- SHARED TRIGGER FUNCTION (Guarded Creation) - FIX B1
-- Safe to run even if Migration A already created this
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
    CREATE TYPE enforcement_action_type AS ENUM (
        'warning',           -- First offense, no fine
        'citation',          -- Parking/marina ticket
        'tow_order',         -- Vehicle/vessel tow authorization
        'boot',              -- Wheel boot applied
        'impound',           -- Vehicle/vessel impounded
        'ban',               -- Banned from facility
        'revocation'         -- Access credentials revoked
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE enforcement_status AS ENUM (
        'issued',            -- Action created
        'contested',         -- Owner disputing
        'upheld',            -- Contest denied
        'dismissed',         -- Contest granted
        'paid',              -- Fine paid
        'escalated',         -- Sent to collections
        'void'               -- Cancelled by staff
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE violation_category AS ENUM (
        'parking_expired',        -- Time limit exceeded
        'parking_unauthorized',   -- No valid permit/reservation
        'parking_wrong_space',    -- Parked in wrong designated space
        'parking_fire_lane',      -- Fire lane violation
        'parking_accessible',     -- Accessible space violation
        'marina_overstay',        -- Exceeded reserved time
        'marina_unauthorized',    -- No valid reservation
        'marina_safety',          -- Safety violation
        'facility_damage',        -- Damage to facility
        'facility_rules',         -- General rule violation
        'noise',                  -- Noise complaint
        'other'                   -- Other violation
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: cc_enforcement_actions
-- schema.org: Action pattern with legal/compliance extension
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_enforcement_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Identity
    ticket_number TEXT NOT NULL,                     -- "ENF-2025-00001"
    action_type enforcement_action_type NOT NULL,
    status enforcement_status NOT NULL DEFAULT 'issued',
    
    -- Violation Details
    violation_category violation_category NOT NULL,
    violation_description TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Location
    facility_id UUID REFERENCES cc_facilities(id),
    asset_id UUID REFERENCES cc_assets(id),          -- Specific stall/slip
    location_description TEXT,                       -- "Stall A-15" or "Guest Dock West"
    
    -- Vehicle/Vessel (for parking/marina violations)
    vehicle_plate TEXT,
    vehicle_description TEXT,                        -- "Blue Toyota Tacoma"
    vessel_name TEXT,
    vessel_registration TEXT,
    
    -- Owner/Offender (if known)
    offender_party_id UUID REFERENCES cc_parties(id),
    offender_name TEXT,                              -- May be unknown
    offender_contact TEXT,
    
    -- Reservation context (were they supposed to be here?)
    reservation_id UUID REFERENCES cc_reservations(id),
    was_expired BOOLEAN DEFAULT FALSE,               -- Reservation expired
    was_wrong_space BOOLEAN DEFAULT FALSE,           -- In wrong assigned space
    
    -- Financial
    fine_amount_cents INTEGER DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'CAD',
    due_date DATE,
    paid_amount_cents INTEGER DEFAULT 0,
    paid_at TIMESTAMPTZ,
    
    -- Escalation
    escalated_at TIMESTAMPTZ,
    escalation_reference TEXT,                       -- Collections agency reference
    
    -- Contest/Appeal
    contested_at TIMESTAMPTZ,
    contest_reason TEXT,
    contest_evidence_urls TEXT[],                    -- Links to uploaded evidence
    contest_resolved_at TIMESTAMPTZ,
    contest_resolved_by UUID REFERENCES cc_individuals(id),
    contest_resolution_notes TEXT,
    
    -- Evidence (staff documentation)
    evidence_photo_urls TEXT[],                      -- Photos of violation
    evidence_notes TEXT,
    
    -- Linked Actions
    tow_request_id UUID REFERENCES cc_tow_requests(id),
    previous_action_id UUID REFERENCES cc_enforcement_actions(id),  -- For repeat offenders
    
    -- Credentials affected
    credential_id UUID REFERENCES cc_access_credentials(id),
    credential_revoked BOOLEAN DEFAULT FALSE,
    
    -- Staff
    issued_by UUID REFERENCES cc_individuals(id),
    issued_by_name TEXT,                             -- Snapshot
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES cc_individuals(id),
    void_reason TEXT,
    
    -- Constraints
    CONSTRAINT uq_enforcement_tenant_ticket UNIQUE (tenant_id, ticket_number),
    CONSTRAINT ck_enforcement_void CHECK (
        (status = 'void' AND voided_at IS NOT NULL) OR
        (status != 'void')
    )
);

-- Indexes for enforcement queries
CREATE INDEX IF NOT EXISTS idx_enforcement_tenant_status ON cc_enforcement_actions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_enforcement_facility ON cc_enforcement_actions(facility_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_occurred ON cc_enforcement_actions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_enforcement_vehicle ON cc_enforcement_actions(vehicle_plate) WHERE vehicle_plate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enforcement_offender ON cc_enforcement_actions(offender_party_id) WHERE offender_party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enforcement_unpaid ON cc_enforcement_actions(tenant_id, due_date) 
    WHERE status IN ('issued', 'upheld') AND paid_amount_cents < fine_amount_cents;

-- ============================================================================
-- TABLE: cc_enforcement_fine_schedule
-- Standard fines by violation type (tenant-configurable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_enforcement_fine_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- Violation mapping
    violation_category violation_category NOT NULL,
    action_type enforcement_action_type NOT NULL DEFAULT 'citation',
    
    -- Fine amounts
    first_offense_cents INTEGER NOT NULL DEFAULT 0,
    second_offense_cents INTEGER NOT NULL DEFAULT 0,
    third_offense_cents INTEGER NOT NULL DEFAULT 0,  -- And subsequent
    
    -- Grace period before fine applies (minutes)
    grace_period_minutes INTEGER DEFAULT 0,
    
    -- Due date offset (days from issue)
    due_in_days INTEGER NOT NULL DEFAULT 30,
    
    -- Late fee
    late_fee_cents INTEGER DEFAULT 0,
    late_after_days INTEGER DEFAULT 30,
    
    -- Auto-escalation
    auto_escalate_after_days INTEGER,                -- NULL = no auto-escalate
    
    -- Active period
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_fine_schedule UNIQUE (tenant_id, violation_category, action_type, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_fine_schedule_tenant ON cc_enforcement_fine_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fine_schedule_violation ON cc_enforcement_fine_schedule(violation_category);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_enforcement_fine_schedule ENABLE ROW LEVEL SECURITY;

-- Enforcement Actions: Tenant isolation + service mode bypass
DROP POLICY IF EXISTS enforcement_actions_tenant_isolation ON cc_enforcement_actions;
CREATE POLICY enforcement_actions_tenant_isolation ON cc_enforcement_actions
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Fine Schedule: Tenant isolation + service mode bypass
DROP POLICY IF EXISTS fine_schedule_tenant_isolation ON cc_enforcement_fine_schedule;
CREATE POLICY fine_schedule_tenant_isolation ON cc_enforcement_fine_schedule
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate next ticket number for tenant
CREATE OR REPLACE FUNCTION cc_next_ticket_number(p_tenant_id UUID, p_prefix TEXT DEFAULT 'ENF')
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
        RAISE EXCEPTION 'Tenant mismatch: cannot generate ticket for other tenant';
    END IF;
    
    v_year := to_char(now(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN ticket_number ~ (p_prefix || '-' || v_year || '-[0-9]+')
            THEN CAST(substring(ticket_number from p_prefix || '-' || v_year || '-([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_seq
    FROM cc_enforcement_actions
    WHERE tenant_id = p_tenant_id;
    
    v_number := p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
    
    RETURN v_number;
END;
$$;

-- Issue enforcement action with auto-fine calculation
CREATE OR REPLACE FUNCTION cc_issue_enforcement_action(
    p_tenant_id UUID,
    p_action_type enforcement_action_type,
    p_violation_category violation_category,
    p_violation_description TEXT,
    p_facility_id UUID DEFAULT NULL,
    p_asset_id UUID DEFAULT NULL,
    p_location_description TEXT DEFAULT NULL,
    p_vehicle_plate TEXT DEFAULT NULL,
    p_vehicle_description TEXT DEFAULT NULL,
    p_offender_party_id UUID DEFAULT NULL,
    p_offender_name TEXT DEFAULT NULL,
    p_evidence_photo_urls TEXT[] DEFAULT NULL,
    p_evidence_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_id UUID;
    v_ticket_number TEXT;
    v_fine RECORD;
    v_offense_count INTEGER;
    v_fine_amount INTEGER;
    v_due_date DATE;
    v_issuer_id UUID;
    v_issuer_name TEXT;
BEGIN
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- Generate ticket number
    v_ticket_number := cc_next_ticket_number(p_tenant_id, 'ENF');
    
    -- Get issuer info
    BEGIN
        v_issuer_id := current_setting('app.current_user_id', true)::UUID;
        SELECT display_name INTO v_issuer_name 
        FROM cc_individuals WHERE id = v_issuer_id;
    EXCEPTION WHEN OTHERS THEN
        v_issuer_id := NULL;
        v_issuer_name := 'System';
    END;
    
    -- Count previous offenses for this offender (if known)
    IF p_offender_party_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_offense_count
        FROM cc_enforcement_actions
        WHERE tenant_id = p_tenant_id
          AND offender_party_id = p_offender_party_id
          AND violation_category = p_violation_category
          AND status NOT IN ('dismissed', 'void');
    ELSIF p_vehicle_plate IS NOT NULL THEN
        SELECT COUNT(*) INTO v_offense_count
        FROM cc_enforcement_actions
        WHERE tenant_id = p_tenant_id
          AND vehicle_plate = p_vehicle_plate
          AND violation_category = p_violation_category
          AND status NOT IN ('dismissed', 'void');
    ELSE
        v_offense_count := 0;
    END IF;
    
    -- Get fine schedule
    SELECT * INTO v_fine
    FROM cc_enforcement_fine_schedule
    WHERE tenant_id = p_tenant_id
      AND violation_category = p_violation_category
      AND action_type = p_action_type
      AND effective_from <= CURRENT_DATE
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY effective_from DESC
    LIMIT 1;
    
    -- Calculate fine based on offense count
    IF v_fine IS NOT NULL THEN
        CASE 
            WHEN v_offense_count = 0 THEN v_fine_amount := v_fine.first_offense_cents;
            WHEN v_offense_count = 1 THEN v_fine_amount := v_fine.second_offense_cents;
            ELSE v_fine_amount := v_fine.third_offense_cents;
        END CASE;
        v_due_date := CURRENT_DATE + v_fine.due_in_days;
    ELSE
        v_fine_amount := 0;
        v_due_date := NULL;
    END IF;
    
    -- Create action
    v_action_id := gen_random_uuid();
    
    INSERT INTO cc_enforcement_actions (
        id, tenant_id, ticket_number, action_type, status,
        violation_category, violation_description,
        facility_id, asset_id, location_description,
        vehicle_plate, vehicle_description,
        offender_party_id, offender_name,
        fine_amount_cents, due_date,
        evidence_photo_urls, evidence_notes,
        issued_by, issued_by_name
    ) VALUES (
        v_action_id, p_tenant_id, v_ticket_number, p_action_type, 'issued',
        p_violation_category, p_violation_description,
        p_facility_id, p_asset_id, p_location_description,
        p_vehicle_plate, p_vehicle_description,
        p_offender_party_id, p_offender_name,
        v_fine_amount, v_due_date,
        p_evidence_photo_urls, p_evidence_notes,
        v_issuer_id, v_issuer_name
    );
    
    RETURN v_action_id;
END;
$$;

-- Contest an enforcement action
CREATE OR REPLACE FUNCTION cc_contest_enforcement_action(
    p_action_id UUID,
    p_reason TEXT,
    p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action RECORD;
BEGIN
    SELECT * INTO v_action FROM cc_enforcement_actions WHERE id = p_action_id;
    
    IF v_action IS NULL THEN
        RAISE EXCEPTION 'Enforcement action not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_action.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- Can only contest issued actions
    IF v_action.status != 'issued' THEN
        RAISE EXCEPTION 'Can only contest actions with status "issued"';
    END IF;
    
    UPDATE cc_enforcement_actions SET
        status = 'contested',
        contested_at = now(),
        contest_reason = p_reason,
        contest_evidence_urls = p_evidence_urls,
        updated_at = now()
    WHERE id = p_action_id;
    
    RETURN TRUE;
END;
$$;

-- Resolve a contested action
CREATE OR REPLACE FUNCTION cc_resolve_enforcement_contest(
    p_action_id UUID,
    p_upheld BOOLEAN,
    p_notes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action RECORD;
    v_resolver_id UUID;
BEGIN
    SELECT * INTO v_action FROM cc_enforcement_actions WHERE id = p_action_id;
    
    IF v_action IS NULL THEN
        RAISE EXCEPTION 'Enforcement action not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_action.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    IF v_action.status != 'contested' THEN
        RAISE EXCEPTION 'Action is not in contested status';
    END IF;
    
    BEGIN
        v_resolver_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_resolver_id := NULL;
    END;
    
    UPDATE cc_enforcement_actions SET
        status = CASE WHEN p_upheld THEN 'upheld' ELSE 'dismissed' END,
        contest_resolved_at = now(),
        contest_resolved_by = v_resolver_id,
        contest_resolution_notes = p_notes,
        updated_at = now()
    WHERE id = p_action_id;
    
    RETURN TRUE;
END;
$$;

-- Record payment
CREATE OR REPLACE FUNCTION cc_record_enforcement_payment(
    p_action_id UUID,
    p_amount_cents INTEGER,
    p_payment_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action RECORD;
BEGIN
    SELECT * INTO v_action FROM cc_enforcement_actions WHERE id = p_action_id;
    
    IF v_action IS NULL THEN
        RAISE EXCEPTION 'Enforcement action not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_action.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    IF v_action.status NOT IN ('issued', 'upheld') THEN
        RAISE EXCEPTION 'Cannot pay action with status %', v_action.status;
    END IF;
    
    UPDATE cc_enforcement_actions SET
        paid_amount_cents = paid_amount_cents + p_amount_cents,
        paid_at = CASE WHEN paid_amount_cents + p_amount_cents >= fine_amount_cents THEN now() ELSE paid_at END,
        status = CASE WHEN paid_amount_cents + p_amount_cents >= fine_amount_cents THEN 'paid' ELSE status END,
        updated_at = now()
    WHERE id = p_action_id;
    
    RETURN TRUE;
END;
$$;

-- Void an action
CREATE OR REPLACE FUNCTION cc_void_enforcement_action(
    p_action_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action RECORD;
    v_voider_id UUID;
BEGIN
    SELECT * INTO v_action FROM cc_enforcement_actions WHERE id = p_action_id;
    
    IF v_action IS NULL THEN
        RAISE EXCEPTION 'Enforcement action not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_action.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    IF v_action.status IN ('paid', 'void') THEN
        RAISE EXCEPTION 'Cannot void action with status %', v_action.status;
    END IF;
    
    BEGIN
        v_voider_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_voider_id := NULL;
    END;
    
    UPDATE cc_enforcement_actions SET
        status = 'void',
        voided_at = now(),
        voided_by = v_voider_id,
        void_reason = p_reason,
        updated_at = now()
    WHERE id = p_action_id;
    
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enforcement_actions_updated ON cc_enforcement_actions;
CREATE TRIGGER trg_enforcement_actions_updated
    BEFORE UPDATE ON cc_enforcement_actions
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_fine_schedule_updated ON cc_enforcement_fine_schedule;
CREATE TRIGGER trg_fine_schedule_updated
    BEFORE UPDATE ON cc_enforcement_fine_schedule
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Query 1: Verify tables exist with correct columns
SELECT 
    'cc_enforcement_actions' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'cc_enforcement_actions'
UNION ALL
SELECT 
    'cc_enforcement_fine_schedule',
    COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'cc_enforcement_fine_schedule';

-- Query 2: Verify enums created
SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('enforcement_action_type', 'enforcement_status', 'violation_category')
GROUP BY typname;

-- Query 3: Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cc_enforcement_actions', 'cc_enforcement_fine_schedule');

-- Query 4: Verify functions created
SELECT proname, prosecdef as security_definer
FROM pg_proc 
WHERE proname IN (
    'cc_next_ticket_number',
    'cc_issue_enforcement_action',
    'cc_contest_enforcement_action',
    'cc_resolve_enforcement_contest',
    'cc_record_enforcement_payment',
    'cc_void_enforcement_action'
);

-- Query 5: Verify link to existing cc_tow_requests
SELECT 
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'cc_enforcement_actions' 
           AND column_name = 'tow_request_id') as tow_link_exists;

-- Query 6: Verify no "booking" terminology used (should return 0 rows)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name IN ('cc_enforcement_actions', 'cc_enforcement_fine_schedule')
  AND column_name LIKE '%book%';

-- ============================================================================
-- MIGRATION F v2 (DROP-IN): DISPUTES
-- Tables: cc_disputes, cc_dispute_evidence, cc_dispute_messages
-- Run order: SECOND (2 of 4)
--
-- Hardening:
--   - Verb-split RLS (respondents cannot delete/alter)
--   - subject_type mismatch fixed (nullable)
--   - stats query fixed (no cartesian blow-up)
--   - SECURITY DEFINER functions with proper search_path
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
    CREATE TYPE dispute_status AS ENUM (
        'draft',
        'submitted',
        'under_review',
        'awaiting_response',
        'mediation',
        'escalated',
        'resolved_favor_initiator',
        'resolved_favor_respondent',
        'resolved_compromise',
        'withdrawn',
        'dismissed',
        'expired'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_type AS ENUM (
        'enforcement_appeal',
        'charge_dispute',
        'reservation_issue',
        'service_complaint',
        'damage_claim',
        'refund_request',
        'access_denial',
        'account_issue',
        'harassment',
        'fraud',
        'policy_violation',
        'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_priority AS ENUM (
        'low',
        'medium',
        'high',
        'urgent'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE evidence_type AS ENUM (
        'document',
        'photo',
        'video',
        'audio',
        'screenshot',
        'receipt',
        'contract',
        'communication',
        'witness_statement',
        'system_log',
        'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM (
        'initial_complaint',
        'response',
        'rebuttal',
        'clarification',
        'evidence_submission',
        'admin_note',
        'admin_decision',
        'system_notification',
        'settlement_offer',
        'settlement_response'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: cc_disputes
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    dispute_number TEXT NOT NULL,
    status dispute_status NOT NULL DEFAULT 'draft',
    dispute_type dispute_type NOT NULL,
    priority dispute_priority NOT NULL DEFAULT 'medium',
    
    -- Subject of dispute (NULLABLE - fixed from original)
    subject_type TEXT,
    subject_id UUID,
    subject_description TEXT,
    
    -- Parties
    initiator_party_id UUID NOT NULL REFERENCES cc_parties(id),
    initiator_individual_id UUID REFERENCES cc_individuals(id),
    respondent_party_id UUID REFERENCES cc_parties(id),
    respondent_tenant_id UUID REFERENCES cc_tenants(id),
    
    -- Claim details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    desired_outcome TEXT,
    
    -- Financial aspects
    disputed_amount_cents INTEGER,
    settlement_amount_cents INTEGER,
    currency TEXT DEFAULT 'CAD',
    
    -- Timeline
    submitted_at TIMESTAMPTZ,
    response_deadline TIMESTAMPTZ,
    resolution_deadline TIMESTAMPTZ,
    
    -- Assignment
    assigned_to UUID REFERENCES cc_individuals(id),
    assigned_at TIMESTAMPTZ,
    
    -- Review
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES cc_individuals(id),
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES cc_individuals(id),
    resolution_type TEXT,
    resolution_summary TEXT,
    
    -- Linked records
    incident_id UUID,
    enforcement_action_id UUID,
    community_charge_id UUID,
    reservation_id UUID,
    
    -- Escalation
    escalated_at TIMESTAMPTZ,
    escalated_to TEXT,
    escalation_reason TEXT,
    
    -- Metadata
    tags TEXT[],
    internal_notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    withdrawn_reason TEXT,
    
    CONSTRAINT uq_dispute_tenant_number UNIQUE (tenant_id, dispute_number)
);

CREATE INDEX IF NOT EXISTS idx_disputes_tenant_status ON cc_disputes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator ON cc_disputes(initiator_party_id);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent ON cc_disputes(respondent_party_id) WHERE respondent_party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_assigned ON cc_disputes(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_subject ON cc_disputes(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_disputes_open ON cc_disputes(tenant_id, created_at) 
    WHERE status NOT IN ('resolved_favor_initiator', 'resolved_favor_respondent', 'resolved_compromise', 'withdrawn', 'dismissed', 'expired');

-- ============================================================================
-- TABLE: cc_dispute_evidence
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_dispute_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES cc_disputes(id) ON DELETE CASCADE,
    
    submitted_by UUID NOT NULL REFERENCES cc_individuals(id),
    submitted_by_party_id UUID REFERENCES cc_parties(id),
    
    evidence_type evidence_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes INTEGER,
    mime_type TEXT,
    
    captured_at TIMESTAMPTZ,
    location_description TEXT,
    
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES cc_individuals(id),
    verification_notes TEXT,
    
    is_relevant BOOLEAN DEFAULT TRUE,
    admin_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON cc_dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_submitter ON cc_dispute_evidence(submitted_by);

-- ============================================================================
-- TABLE: cc_dispute_messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_dispute_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES cc_disputes(id) ON DELETE CASCADE,
    
    sender_id UUID NOT NULL REFERENCES cc_individuals(id),
    sender_party_id UUID REFERENCES cc_parties(id),
    sender_role TEXT,
    
    message_type message_type NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    
    is_internal BOOLEAN DEFAULT FALSE,
    visible_to_initiator BOOLEAN DEFAULT TRUE,
    visible_to_respondent BOOLEAN DEFAULT TRUE,
    
    evidence_ids UUID[],
    
    in_reply_to UUID REFERENCES cc_dispute_messages(id),
    requires_response BOOLEAN DEFAULT FALSE,
    response_deadline TIMESTAMPTZ,
    
    read_by_initiator_at TIMESTAMPTZ,
    read_by_respondent_at TIMESTAMPTZ,
    read_by_admin_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ,
    edit_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON cc_dispute_messages(dispute_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender ON cc_dispute_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_unread ON cc_dispute_messages(dispute_id) 
    WHERE read_by_initiator_at IS NULL OR read_by_respondent_at IS NULL;

-- ============================================================================
-- RLS POLICIES (VERB-SPECIFIC - HARDENED)
-- ============================================================================

ALTER TABLE cc_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_dispute_messages ENABLE ROW LEVEL SECURITY;

-- cc_disputes: verb-specific policies
DROP POLICY IF EXISTS disputes_access ON cc_disputes;
DROP POLICY IF EXISTS disputes_select ON cc_disputes;
DROP POLICY IF EXISTS disputes_insert ON cc_disputes;
DROP POLICY IF EXISTS disputes_update ON cc_disputes;
DROP POLICY IF EXISTS disputes_delete_service ON cc_disputes;

CREATE POLICY disputes_select ON cc_disputes
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR respondent_tenant_id = current_tenant_id()
    OR is_service_mode()
  );

CREATE POLICY disputes_insert ON cc_disputes
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY disputes_update ON cc_disputes
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Delete: service-only
CREATE POLICY disputes_delete_service ON cc_disputes
  FOR DELETE
  USING (is_service_mode());

-- cc_dispute_evidence: verb-specific
DROP POLICY IF EXISTS dispute_evidence_access ON cc_dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_select ON cc_dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_insert ON cc_dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_update ON cc_dispute_evidence;
DROP POLICY IF EXISTS dispute_evidence_delete_service ON cc_dispute_evidence;

CREATE POLICY dispute_evidence_select ON cc_dispute_evidence
  FOR SELECT
  USING (
    dispute_id IN (
      SELECT id FROM cc_disputes
      WHERE tenant_id = current_tenant_id()
         OR respondent_tenant_id = current_tenant_id()
    )
    OR is_service_mode()
  );

CREATE POLICY dispute_evidence_insert ON cc_dispute_evidence
  FOR INSERT
  WITH CHECK (
    dispute_id IN (SELECT id FROM cc_disputes WHERE tenant_id = current_tenant_id())
    OR is_service_mode()
  );

CREATE POLICY dispute_evidence_update ON cc_dispute_evidence
  FOR UPDATE
  USING (
    dispute_id IN (SELECT id FROM cc_disputes WHERE tenant_id = current_tenant_id())
    OR is_service_mode()
  )
  WITH CHECK (
    dispute_id IN (SELECT id FROM cc_disputes WHERE tenant_id = current_tenant_id())
    OR is_service_mode()
  );

CREATE POLICY dispute_evidence_delete_service ON cc_dispute_evidence
  FOR DELETE
  USING (is_service_mode());

-- cc_dispute_messages: verb-specific with internal visibility
DROP POLICY IF EXISTS dispute_messages_access ON cc_dispute_messages;
DROP POLICY IF EXISTS dispute_messages_select ON cc_dispute_messages;
DROP POLICY IF EXISTS dispute_messages_insert ON cc_dispute_messages;
DROP POLICY IF EXISTS dispute_messages_update ON cc_dispute_messages;
DROP POLICY IF EXISTS dispute_messages_delete_service ON cc_dispute_messages;

CREATE POLICY dispute_messages_select ON cc_dispute_messages
  FOR SELECT
  USING (
    is_service_mode()
    OR (
      dispute_id IN (
        SELECT id FROM cc_disputes
        WHERE tenant_id = current_tenant_id()
           OR respondent_tenant_id = current_tenant_id()
      )
      AND (is_internal = FALSE)
    )
  );

CREATE POLICY dispute_messages_insert ON cc_dispute_messages
  FOR INSERT
  WITH CHECK (
    dispute_id IN (SELECT id FROM cc_disputes WHERE tenant_id = current_tenant_id())
    OR is_service_mode()
  );

CREATE POLICY dispute_messages_update ON cc_dispute_messages
  FOR UPDATE
  USING (
    dispute_id IN (SELECT id FROM cc_disputes WHERE tenant_id = current_tenant_id())
    OR is_service_mode()
  )
  WITH CHECK (
    dispute_id IN (SELECT id FROM cc_disputes WHERE tenant_id = current_tenant_id())
    OR is_service_mode()
  );

CREATE POLICY dispute_messages_delete_service ON cc_dispute_messages
  FOR DELETE
  USING (is_service_mode());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate dispute number
CREATE OR REPLACE FUNCTION cc_next_dispute_number(p_tenant_id UUID, p_prefix TEXT DEFAULT 'DSP')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_year TEXT;
    v_seq INTEGER;
BEGIN
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_year := to_char(now(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN dispute_number ~ (p_prefix || '-' || v_year || '-[0-9]+')
            THEN CAST(substring(dispute_number from p_prefix || '-' || v_year || '-([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_seq
    FROM cc_disputes
    WHERE tenant_id = p_tenant_id;
    
    RETURN p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
END;
$$;

-- Create a dispute
CREATE OR REPLACE FUNCTION cc_create_dispute(
    p_tenant_id UUID,
    p_dispute_type dispute_type,
    p_initiator_party_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_subject_type TEXT DEFAULT NULL,
    p_subject_id UUID DEFAULT NULL,
    p_disputed_amount_cents INTEGER DEFAULT NULL,
    p_desired_outcome TEXT DEFAULT NULL,
    p_respondent_tenant_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_dispute_id UUID;
    v_dispute_number TEXT;
    v_initiator_individual_id UUID;
    v_response_deadline TIMESTAMPTZ;
BEGIN
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_dispute_number := cc_next_dispute_number(p_tenant_id, 'DSP');
    v_dispute_id := gen_random_uuid();
    
    SELECT id INTO v_initiator_individual_id
    FROM cc_individuals
    WHERE party_id = p_initiator_party_id
    LIMIT 1;
    
    v_response_deadline := now() + INTERVAL '7 days';
    
    INSERT INTO cc_disputes (
        id, tenant_id, dispute_number, dispute_type,
        initiator_party_id, initiator_individual_id,
        respondent_tenant_id,
        title, description, desired_outcome,
        subject_type, subject_id,
        disputed_amount_cents,
        submitted_at, response_deadline
    ) VALUES (
        v_dispute_id, p_tenant_id, v_dispute_number, p_dispute_type,
        p_initiator_party_id, v_initiator_individual_id,
        p_respondent_tenant_id,
        p_title, p_description, p_desired_outcome,
        p_subject_type, p_subject_id,
        p_disputed_amount_cents,
        now(), v_response_deadline
    );
    
    IF v_initiator_individual_id IS NOT NULL THEN
        INSERT INTO cc_dispute_messages (
            dispute_id, sender_id, sender_party_id, sender_role,
            message_type, subject, body
        ) VALUES (
            v_dispute_id, v_initiator_individual_id, p_initiator_party_id, 'initiator',
            'initial_complaint', p_title, p_description
        );
    END IF;
    
    RETURN v_dispute_id;
END;
$$;

-- Submit evidence
CREATE OR REPLACE FUNCTION cc_submit_dispute_evidence(
    p_dispute_id UUID,
    p_evidence_type evidence_type,
    p_title TEXT,
    p_file_url TEXT,
    p_description TEXT DEFAULT NULL,
    p_file_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_evidence_id UUID;
    v_submitter_id UUID;
    v_party_id UUID;
    v_dispute RECORD;
BEGIN
    SELECT * INTO v_dispute FROM cc_disputes WHERE id = p_dispute_id;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'Dispute not found';
    END IF;
    
    IF NOT is_service_mode() AND v_dispute.tenant_id != current_tenant_id() 
       AND v_dispute.respondent_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_submitter_id := current_individual_id();
    IF v_submitter_id IS NOT NULL THEN
        SELECT party_id INTO v_party_id FROM cc_individuals WHERE id = v_submitter_id;
    END IF;
    
    IF v_submitter_id IS NULL THEN
        RAISE EXCEPTION 'Submitter ID required';
    END IF;
    
    v_evidence_id := gen_random_uuid();
    
    INSERT INTO cc_dispute_evidence (
        id, dispute_id, submitted_by, submitted_by_party_id,
        evidence_type, title, description, file_url, file_name
    ) VALUES (
        v_evidence_id, p_dispute_id, v_submitter_id, v_party_id,
        p_evidence_type, p_title, p_description, p_file_url, p_file_name
    );
    
    RETURN v_evidence_id;
END;
$$;

-- Add message to dispute
CREATE OR REPLACE FUNCTION cc_add_dispute_message(
    p_dispute_id UUID,
    p_message_type message_type,
    p_body TEXT,
    p_subject TEXT DEFAULT NULL,
    p_is_internal BOOLEAN DEFAULT FALSE,
    p_in_reply_to UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_message_id UUID;
    v_sender_id UUID;
    v_party_id UUID;
    v_dispute RECORD;
    v_sender_role TEXT;
BEGIN
    SELECT * INTO v_dispute FROM cc_disputes WHERE id = p_dispute_id;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'Dispute not found';
    END IF;
    
    IF NOT is_service_mode() AND v_dispute.tenant_id != current_tenant_id() 
       AND v_dispute.respondent_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_sender_id := current_individual_id();
    IF v_sender_id IS NOT NULL THEN
        SELECT party_id INTO v_party_id FROM cc_individuals WHERE id = v_sender_id;
    END IF;
    
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'Sender ID required';
    END IF;
    
    IF v_party_id = v_dispute.initiator_party_id THEN
        v_sender_role := 'initiator';
    ELSIF v_party_id = v_dispute.respondent_party_id THEN
        v_sender_role := 'respondent';
    ELSE
        v_sender_role := 'admin';
    END IF;
    
    v_message_id := gen_random_uuid();
    
    INSERT INTO cc_dispute_messages (
        id, dispute_id, sender_id, sender_party_id, sender_role,
        message_type, subject, body, is_internal, in_reply_to
    ) VALUES (
        v_message_id, p_dispute_id, v_sender_id, v_party_id, v_sender_role,
        p_message_type, p_subject, p_body, p_is_internal, p_in_reply_to
    );
    
    RETURN v_message_id;
END;
$$;

-- Update dispute status
CREATE OR REPLACE FUNCTION cc_update_dispute_status(
    p_dispute_id UUID,
    p_new_status dispute_status,
    p_resolution_summary TEXT DEFAULT NULL,
    p_settlement_amount_cents INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_dispute RECORD;
    v_resolver_id UUID;
BEGIN
    SELECT * INTO v_dispute FROM cc_disputes WHERE id = p_dispute_id;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'Dispute not found';
    END IF;
    
    IF NOT is_service_mode() AND v_dispute.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_resolver_id := current_individual_id();
    
    UPDATE cc_disputes SET
        status = p_new_status,
        resolution_summary = COALESCE(p_resolution_summary, resolution_summary),
        settlement_amount_cents = COALESCE(p_settlement_amount_cents, settlement_amount_cents),
        resolved_at = CASE 
            WHEN p_new_status IN ('resolved_favor_initiator', 'resolved_favor_respondent', 'resolved_compromise') 
            THEN now() ELSE resolved_at 
        END,
        resolved_by = CASE 
            WHEN p_new_status IN ('resolved_favor_initiator', 'resolved_favor_respondent', 'resolved_compromise') 
            THEN v_resolver_id ELSE resolved_by 
        END,
        withdrawn_at = CASE WHEN p_new_status = 'withdrawn' THEN now() ELSE withdrawn_at END,
        updated_at = now()
    WHERE id = p_dispute_id;
    
    RETURN TRUE;
END;
$$;

-- Assign dispute to admin
CREATE OR REPLACE FUNCTION cc_assign_dispute(
    p_dispute_id UUID,
    p_assignee_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
    v_dispute RECORD;
BEGIN
    SELECT * INTO v_dispute FROM cc_disputes WHERE id = p_dispute_id;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'Dispute not found';
    END IF;
    
    IF NOT is_service_mode() AND v_dispute.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    UPDATE cc_disputes SET
        assigned_to = p_assignee_id,
        assigned_at = now(),
        status = CASE WHEN status = 'submitted' THEN 'under_review' ELSE status END,
        updated_at = now()
    WHERE id = p_dispute_id;
    
    RETURN TRUE;
END;
$$;

-- Get dispute statistics (FIXED: no cartesian blow-up)
CREATE OR REPLACE FUNCTION cc_get_dispute_stats(p_tenant_id UUID)
RETURNS TABLE(
    total_disputes INTEGER,
    open_disputes INTEGER,
    resolved_disputes INTEGER,
    avg_resolution_days NUMERIC,
    disputes_by_type JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
BEGIN
    IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;

    RETURN QUERY
    WITH d AS (
      SELECT *
      FROM cc_disputes
      WHERE tenant_id = p_tenant_id OR respondent_tenant_id = p_tenant_id
    ),
    type_counts AS (
      SELECT dispute_type, COUNT(*)::INT AS cnt
      FROM d
      GROUP BY dispute_type
    )
    SELECT
      (SELECT COUNT(*)::INT FROM d) AS total_disputes,
      (SELECT COUNT(*)::INT FROM d WHERE status NOT IN (
        'resolved_favor_initiator','resolved_favor_respondent','resolved_compromise','withdrawn','dismissed','expired'
      )) AS open_disputes,
      (SELECT COUNT(*)::INT FROM d WHERE status IN (
        'resolved_favor_initiator','resolved_favor_respondent','resolved_compromise'
      )) AS resolved_disputes,
      (SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - submitted_at))/86400)::NUMERIC(10,2)
       FROM d WHERE resolved_at IS NOT NULL AND submitted_at IS NOT NULL) AS avg_resolution_days,
      (SELECT COALESCE(jsonb_object_agg(dispute_type, cnt), '{}'::jsonb) FROM type_counts) AS disputes_by_type;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_disputes_updated ON cc_disputes;
CREATE TRIGGER trg_disputes_updated
    BEFORE UPDATE ON cc_disputes
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_dispute_evidence_updated ON cc_dispute_evidence;
CREATE TRIGGER trg_dispute_evidence_updated
    BEFORE UPDATE ON cc_dispute_evidence
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_dispute_messages_updated ON cc_dispute_messages;
CREATE TRIGGER trg_dispute_messages_updated
    BEFORE UPDATE ON cc_dispute_messages
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Q1: Verify tables exist
SELECT 'cc_disputes' as table_name, COUNT(*) as column_count
FROM information_schema.columns WHERE table_name = 'cc_disputes'
UNION ALL
SELECT 'cc_dispute_evidence', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_dispute_evidence'
UNION ALL
SELECT 'cc_dispute_messages', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_dispute_messages';

-- Q2: Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('cc_disputes', 'cc_dispute_evidence', 'cc_dispute_messages');

-- Q3: Verify verb-specific policies (should see separate SELECT/INSERT/UPDATE/DELETE)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('cc_disputes', 'cc_dispute_evidence', 'cc_dispute_messages')
ORDER BY tablename, cmd;

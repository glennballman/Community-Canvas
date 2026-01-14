-- ============================================================================
-- MIGRATION C: JOBS WEDGE COMPLETION (Prompt 24B Completion) - CORRECTED
-- cc_job_matches, cc_job_applications (ORDER MATTERS!)
-- Purpose: Complete the jobs cold-start wedge for worker recruitment
-- Prerequisite: cc_jobs, cc_job_postings already exist from Prompt 24B
-- 
-- FIXES APPLIED:
-- C1: Create cc_job_matches FIRST, then cc_job_applications (FK ordering)
-- C2: Make applicant_party_id NULLABLE - do not assume cc_individuals.party_id exists
-- C3: Cold-start wedge guard - reject unclaimed jobs (tenant_id IS NULL)
-- ============================================================================

-- ============================================================================
-- SHARED TRIGGER FUNCTION (Guarded Creation)
-- Safe to run even if Migrations A or B already created this
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
    CREATE TYPE job_application_status AS ENUM (
        'draft',             -- Worker started but not submitted
        'submitted',         -- Submitted, awaiting review
        'under_review',      -- Being reviewed by employer
        'shortlisted',       -- Made the short list
        'interview_scheduled', -- Interview set up
        'interviewed',       -- Interview completed
        'offer_extended',    -- Job offer made
        'offer_accepted',    -- Worker accepted
        'offer_declined',    -- Worker declined
        'rejected',          -- Employer rejected
        'withdrawn'          -- Worker withdrew application
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE job_match_source AS ENUM (
        'ai_suggestion',     -- AI-generated match
        'manual',            -- Staff-created match
        'self_match',        -- Worker expressed interest
        'referral',          -- Referred by another user
        'imported'           -- Imported from external system
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE job_match_status AS ENUM (
        'suggested',         -- AI suggested, not yet actioned
        'sent_to_worker',    -- Notification sent to worker
        'sent_to_employer',  -- Notification sent to employer
        'worker_interested', -- Worker expressed interest
        'employer_interested', -- Employer expressed interest
        'mutual_interest',   -- Both parties interested
        'applied',           -- Worker submitted application
        'dismissed_worker',  -- Worker dismissed the match
        'dismissed_employer', -- Employer dismissed the match
        'expired'            -- Match expired without action
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE: cc_job_matches (CREATED FIRST - FIX C1)
-- AI-suggested matches between workers and jobs
-- Supports the "cold start" by proactively connecting supply and demand
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- The match
    job_id UUID NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES cc_job_postings(id),
    worker_party_id UUID REFERENCES cc_parties(id),      -- NULLABLE (FIX C2)
    worker_individual_id UUID NOT NULL REFERENCES cc_individuals(id),
    
    -- Match metadata
    source job_match_source NOT NULL DEFAULT 'ai_suggestion',
    status job_match_status NOT NULL DEFAULT 'suggested',
    
    -- Scoring (for AI matches)
    match_score NUMERIC(5,2),                        -- 0-100 score
    score_breakdown JSONB,                           -- {"skills": 85, "location": 70, "availability": 90}
    
    -- Match reasoning (human-readable)
    match_reasons TEXT[],                            -- ["5+ years carpentry", "Based in Port Alberni", "Available June-August"]
    
    -- Skill alignment
    matched_skills TEXT[],                           -- Skills that matched
    missing_skills TEXT[],                           -- Required skills worker lacks
    bonus_skills TEXT[],                             -- Extra skills worker has
    
    -- Location/logistics match
    worker_location TEXT,
    job_location TEXT,
    distance_km NUMERIC(10,2),
    travel_feasible BOOLEAN,
    travel_notes TEXT,
    
    -- Availability match
    worker_available_from DATE,
    worker_available_to DATE,
    job_start_date DATE,
    job_end_date DATE,
    availability_overlap_days INTEGER,
    
    -- Accommodation match (critical for remote BC)
    worker_needs_accommodation BOOLEAN,
    accommodation_available BOOLEAN,
    accommodation_match_notes TEXT,
    
    -- Wage alignment
    worker_expected_wage_cents INTEGER,
    job_wage_range_min_cents INTEGER,
    job_wage_range_max_cents INTEGER,
    wage_aligned BOOLEAN,
    
    -- Workflow
    sent_to_worker_at TIMESTAMPTZ,
    worker_viewed_at TIMESTAMPTZ,
    worker_responded_at TIMESTAMPTZ,
    worker_response job_match_status,
    
    sent_to_employer_at TIMESTAMPTZ,
    employer_viewed_at TIMESTAMPTZ,
    employer_responded_at TIMESTAMPTZ,
    employer_response job_match_status,
    
    -- Outcome (will reference cc_job_applications after it's created)
    converted_to_application_id UUID,                -- FK added after cc_job_applications exists
    converted_at TIMESTAMPTZ,
    dismissed_reason TEXT,
    expired_at TIMESTAMPTZ,
    
    -- Referrer (if referral source)
    referred_by_party_id UUID REFERENCES cc_parties(id),
    referral_id UUID REFERENCES cc_referrals(id),
    
    -- Created by (for manual matches)
    created_by UUID REFERENCES cc_individuals(id),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_match_job_worker UNIQUE (job_id, worker_individual_id),
    CONSTRAINT ck_match_score CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100))
);

-- Indexes for match queries
CREATE INDEX IF NOT EXISTS idx_matches_tenant_status ON cc_job_matches(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_job ON cc_job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_matches_worker ON cc_job_matches(worker_individual_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON cc_job_matches(match_score DESC NULLS LAST) WHERE status = 'suggested';
CREATE INDEX IF NOT EXISTS idx_matches_pending_worker ON cc_job_matches(worker_individual_id, created_at) 
    WHERE status = 'sent_to_worker';
CREATE INDEX IF NOT EXISTS idx_matches_mutual ON cc_job_matches(tenant_id) 
    WHERE status = 'mutual_interest';

-- ============================================================================
-- TABLE: cc_job_applications (CREATED SECOND - FIX C1)
-- schema.org: JobPosting + ApplyAction pattern
-- Workers apply to specific job postings
-- NOTE: Only for CLAIMED jobs (tenant_id NOT NULL). Unclaimed jobs use cc_job_applicants.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    
    -- What they're applying for
    job_id UUID NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
    job_posting_id UUID NOT NULL REFERENCES cc_job_postings(id) ON DELETE CASCADE,
    
    -- Who is applying
    applicant_party_id UUID REFERENCES cc_parties(id),   -- NULLABLE (FIX C2)
    applicant_individual_id UUID NOT NULL REFERENCES cc_individuals(id),
    
    -- Application Identity
    application_number TEXT NOT NULL,                -- "APP-2025-00001"
    status job_application_status NOT NULL DEFAULT 'draft',
    
    -- Source tracking
    match_id UUID REFERENCES cc_job_matches(id),     -- Now valid - cc_job_matches exists
    referral_id UUID REFERENCES cc_referrals(id),
    source_channel TEXT,                             -- "organic", "match", "referral", "job_board"
    
    -- Application Content
    cover_letter TEXT,
    resume_url TEXT,                                 -- Link to uploaded resume
    portfolio_urls TEXT[],                           -- Links to portfolio items
    
    -- Structured Responses (JSON for flexibility)
    screening_responses JSONB,                       -- Answers to screening questions
    custom_fields JSONB,                             -- Tenant-specific fields
    
    -- Availability
    available_start_date DATE,
    available_end_date DATE,                         -- For seasonal work
    is_flexible_dates BOOLEAN DEFAULT FALSE,
    
    -- Accommodation needs (critical for remote BC)
    needs_accommodation BOOLEAN DEFAULT FALSE,
    accommodation_notes TEXT,
    has_own_transport BOOLEAN DEFAULT FALSE,
    transport_notes TEXT,
    
    -- Wage expectations
    expected_wage_cents INTEGER,
    wage_currency TEXT DEFAULT 'CAD',
    is_wage_negotiable BOOLEAN DEFAULT TRUE,
    
    -- Workflow timestamps
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES cc_individuals(id),
    shortlisted_at TIMESTAMPTZ,
    interview_scheduled_at TIMESTAMPTZ,
    interview_completed_at TIMESTAMPTZ,
    offer_extended_at TIMESTAMPTZ,
    offer_responded_at TIMESTAMPTZ,
    
    -- Outcome
    outcome_notes TEXT,                              -- Why rejected/withdrawn
    hired_at TIMESTAMPTZ,
    
    -- Communication preferences
    preferred_contact_method TEXT DEFAULT 'email',   -- "email", "phone", "sms"
    preferred_contact_time TEXT,                     -- "mornings", "evenings", "anytime"
    
    -- Internal notes (employer only)
    internal_notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uq_application_tenant_number UNIQUE (tenant_id, application_number),
    CONSTRAINT uq_application_one_per_posting UNIQUE (job_posting_id, applicant_individual_id),
    CONSTRAINT ck_application_dates CHECK (available_start_date IS NULL OR available_end_date IS NULL OR available_start_date <= available_end_date)
);

-- Indexes for application queries
CREATE INDEX IF NOT EXISTS idx_applications_tenant_status ON cc_job_applications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON cc_job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_posting ON cc_job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON cc_job_applications(applicant_individual_id);
CREATE INDEX IF NOT EXISTS idx_applications_submitted ON cc_job_applications(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_active ON cc_job_applications(tenant_id, job_posting_id) 
    WHERE status NOT IN ('rejected', 'withdrawn', 'offer_declined');

-- ============================================================================
-- ADD FK FROM cc_job_matches.converted_to_application_id TO cc_job_applications
-- (Now that cc_job_applications exists)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_matches_application' 
          AND table_name = 'cc_job_matches'
    ) THEN
        ALTER TABLE cc_job_matches 
        ADD CONSTRAINT fk_matches_application 
        FOREIGN KEY (converted_to_application_id) 
        REFERENCES cc_job_applications(id);
    END IF;
END $$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_job_matches ENABLE ROW LEVEL SECURITY;

-- Applications: Tenant isolation + service mode bypass
DROP POLICY IF EXISTS applications_tenant_isolation ON cc_job_applications;
CREATE POLICY applications_tenant_isolation ON cc_job_applications
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- Matches: Tenant isolation + service mode bypass
DROP POLICY IF EXISTS matches_tenant_isolation ON cc_job_matches;
CREATE POLICY matches_tenant_isolation ON cc_job_matches
    FOR ALL
    USING (tenant_id = current_tenant_id() OR is_service_mode())
    WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate next application number for tenant
CREATE OR REPLACE FUNCTION cc_next_application_number(p_tenant_id UUID, p_prefix TEXT DEFAULT 'APP')
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
        RAISE EXCEPTION 'Tenant mismatch: cannot generate application number for other tenant';
    END IF;
    
    v_year := to_char(now(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN application_number ~ (p_prefix || '-' || v_year || '-[0-9]+')
            THEN CAST(substring(application_number from p_prefix || '-' || v_year || '-([0-9]+)') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_seq
    FROM cc_job_applications
    WHERE tenant_id = p_tenant_id;
    
    v_number := p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
    
    RETURN v_number;
END;
$$;

-- Submit a job application (FIX C3: Cold-start wedge guard)
CREATE OR REPLACE FUNCTION cc_submit_job_application(
    p_job_posting_id UUID,
    p_applicant_individual_id UUID,
    p_cover_letter TEXT DEFAULT NULL,
    p_resume_url TEXT DEFAULT NULL,
    p_available_start_date DATE DEFAULT NULL,
    p_available_end_date DATE DEFAULT NULL,
    p_needs_accommodation BOOLEAN DEFAULT FALSE,
    p_expected_wage_cents INTEGER DEFAULT NULL,
    p_match_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_posting RECORD;
    v_job_tenant_id UUID;
    v_app_id UUID;
    v_app_number TEXT;
BEGIN
    -- Get posting details and job tenant_id
    SELECT jp.*, j.tenant_id as job_tenant_id
    INTO v_posting
    FROM cc_job_postings jp
    JOIN cc_jobs j ON j.id = jp.job_id
    WHERE jp.id = p_job_posting_id;
    
    IF v_posting IS NULL THEN
        RAISE EXCEPTION 'Job posting not found';
    END IF;
    
    v_job_tenant_id := v_posting.job_tenant_id;
    
    -- =========================================================================
    -- COLD-START WEDGE GUARD (FIX C3)
    -- Unclaimed jobs (tenant_id IS NULL) must use cc_job_applicants instead
    -- =========================================================================
    IF v_job_tenant_id IS NULL THEN
        RAISE EXCEPTION 'JOB_UNCLAIMED_USE_JOB_APPLICANTS: This job has not been claimed by a tenant. Use cc_job_applicants for public marketplace applications.';
    END IF;
    
    -- Tenant mismatch guard (only applies to claimed jobs)
    IF NOT is_service_mode() AND v_job_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- Generate application number
    v_app_number := cc_next_application_number(v_job_tenant_id, 'APP');
    v_app_id := gen_random_uuid();
    
    -- NOTE: applicant_party_id is LEFT NULL (FIX C2)
    -- We do not assume cc_individuals has party_id
    -- Party association can be derived later via memberships/claims if needed
    
    INSERT INTO cc_job_applications (
        id, tenant_id, job_id, job_posting_id,
        applicant_party_id, applicant_individual_id,
        application_number, status,
        match_id, source_channel,
        cover_letter, resume_url,
        available_start_date, available_end_date,
        needs_accommodation, expected_wage_cents,
        submitted_at
    ) VALUES (
        v_app_id, v_job_tenant_id, v_posting.job_id, p_job_posting_id,
        NULL,  -- applicant_party_id left NULL (FIX C2)
        p_applicant_individual_id,
        v_app_number, 'submitted',
        p_match_id, CASE WHEN p_match_id IS NOT NULL THEN 'match' ELSE 'organic' END,
        p_cover_letter, p_resume_url,
        p_available_start_date, p_available_end_date,
        p_needs_accommodation, p_expected_wage_cents,
        now()
    );
    
    -- Update match if this came from a match
    IF p_match_id IS NOT NULL THEN
        UPDATE cc_job_matches SET
            status = 'applied',
            converted_to_application_id = v_app_id,
            converted_at = now(),
            updated_at = now()
        WHERE id = p_match_id;
    END IF;
    
    RETURN v_app_id;
END;
$$;

-- Transition application status
CREATE OR REPLACE FUNCTION cc_transition_application_status(
    p_application_id UUID,
    p_new_status job_application_status,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_app RECORD;
    v_user_id UUID;
BEGIN
    SELECT * INTO v_app FROM cc_job_applications WHERE id = p_application_id;
    
    IF v_app IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_app.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- Get current user
    BEGIN
        v_user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    
    -- Update based on new status
    UPDATE cc_job_applications SET
        status = p_new_status,
        outcome_notes = COALESCE(p_notes, outcome_notes),
        reviewed_at = CASE WHEN p_new_status = 'under_review' THEN now() ELSE reviewed_at END,
        reviewed_by = CASE WHEN p_new_status = 'under_review' THEN v_user_id ELSE reviewed_by END,
        shortlisted_at = CASE WHEN p_new_status = 'shortlisted' THEN now() ELSE shortlisted_at END,
        interview_scheduled_at = CASE WHEN p_new_status = 'interview_scheduled' THEN now() ELSE interview_scheduled_at END,
        interview_completed_at = CASE WHEN p_new_status = 'interviewed' THEN now() ELSE interview_completed_at END,
        offer_extended_at = CASE WHEN p_new_status = 'offer_extended' THEN now() ELSE offer_extended_at END,
        offer_responded_at = CASE WHEN p_new_status IN ('offer_accepted', 'offer_declined') THEN now() ELSE offer_responded_at END,
        hired_at = CASE WHEN p_new_status = 'offer_accepted' THEN now() ELSE hired_at END,
        updated_at = now()
    WHERE id = p_application_id;
    
    RETURN TRUE;
END;
$$;

-- Create an AI match suggestion
CREATE OR REPLACE FUNCTION cc_create_job_match(
    p_job_id UUID,
    p_worker_individual_id UUID,
    p_match_score NUMERIC(5,2) DEFAULT NULL,
    p_score_breakdown JSONB DEFAULT NULL,
    p_match_reasons TEXT[] DEFAULT NULL,
    p_source job_match_source DEFAULT 'ai_suggestion'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job RECORD;
    v_match_id UUID;
BEGIN
    -- Get job details
    SELECT j.*, jp.id as active_posting_id
    INTO v_job
    FROM cc_jobs j
    LEFT JOIN cc_job_postings jp ON jp.job_id = j.id AND jp.status = 'active'
    WHERE j.id = p_job_id;
    
    IF v_job IS NULL THEN
        RAISE EXCEPTION 'Job not found';
    END IF;
    
    -- Cold-start wedge guard: matches only for claimed jobs
    IF v_job.tenant_id IS NULL THEN
        RAISE EXCEPTION 'JOB_UNCLAIMED_USE_JOB_APPLICANTS: Cannot create match for unclaimed job';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_job.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    v_match_id := gen_random_uuid();
    
    -- NOTE: worker_party_id is LEFT NULL (FIX C2)
    INSERT INTO cc_job_matches (
        id, tenant_id, job_id, job_posting_id,
        worker_party_id, worker_individual_id,
        source, status,
        match_score, score_breakdown, match_reasons,
        created_by
    ) VALUES (
        v_match_id, v_job.tenant_id, p_job_id, v_job.active_posting_id,
        NULL,  -- worker_party_id left NULL (FIX C2)
        p_worker_individual_id,
        p_source, 'suggested',
        p_match_score, p_score_breakdown, p_match_reasons,
        CASE WHEN is_service_mode() THEN NULL ELSE current_setting('app.current_user_id', true)::UUID END
    )
    ON CONFLICT (job_id, worker_individual_id) DO UPDATE SET
        match_score = EXCLUDED.match_score,
        score_breakdown = EXCLUDED.score_breakdown,
        match_reasons = EXCLUDED.match_reasons,
        updated_at = now();
    
    RETURN v_match_id;
END;
$$;

-- Worker responds to a match
CREATE OR REPLACE FUNCTION cc_respond_to_match(
    p_match_id UUID,
    p_interested BOOLEAN,
    p_dismiss_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_new_status job_match_status;
BEGIN
    SELECT * INTO v_match FROM cc_job_matches WHERE id = p_match_id;
    
    IF v_match IS NULL THEN
        RAISE EXCEPTION 'Match not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_match.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    IF p_interested THEN
        -- Check if employer already interested
        IF v_match.employer_response = 'employer_interested' THEN
            v_new_status := 'mutual_interest';
        ELSE
            v_new_status := 'worker_interested';
        END IF;
    ELSE
        v_new_status := 'dismissed_worker';
    END IF;
    
    UPDATE cc_job_matches SET
        status = v_new_status,
        worker_responded_at = now(),
        worker_response = v_new_status,
        dismissed_reason = CASE WHEN NOT p_interested THEN p_dismiss_reason ELSE dismissed_reason END,
        updated_at = now()
    WHERE id = p_match_id;
    
    RETURN TRUE;
END;
$$;

-- Employer responds to a match
CREATE OR REPLACE FUNCTION cc_employer_respond_to_match(
    p_match_id UUID,
    p_interested BOOLEAN,
    p_dismiss_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_new_status job_match_status;
BEGIN
    SELECT * INTO v_match FROM cc_job_matches WHERE id = p_match_id;
    
    IF v_match IS NULL THEN
        RAISE EXCEPTION 'Match not found';
    END IF;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_match.tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    IF p_interested THEN
        -- Check if worker already interested
        IF v_match.worker_response = 'worker_interested' THEN
            v_new_status := 'mutual_interest';
        ELSE
            v_new_status := 'employer_interested';
        END IF;
    ELSE
        v_new_status := 'dismissed_employer';
    END IF;
    
    UPDATE cc_job_matches SET
        status = v_new_status,
        employer_responded_at = now(),
        employer_response = v_new_status,
        dismissed_reason = CASE WHEN NOT p_interested THEN p_dismiss_reason ELSE dismissed_reason END,
        updated_at = now()
    WHERE id = p_match_id;
    
    RETURN TRUE;
END;
$$;

-- Get match statistics for a job
CREATE OR REPLACE FUNCTION cc_get_job_match_stats(p_job_id UUID)
RETURNS TABLE(
    total_matches INTEGER,
    suggested_count INTEGER,
    worker_interested_count INTEGER,
    employer_interested_count INTEGER,
    mutual_interest_count INTEGER,
    applied_count INTEGER,
    dismissed_count INTEGER,
    avg_match_score NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM cc_jobs WHERE id = p_job_id;
    
    -- Tenant mismatch guard
    IF NOT is_service_mode() AND v_tenant_id IS NOT NULL AND v_tenant_id != current_tenant_id() THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_matches,
        COUNT(*) FILTER (WHERE status = 'suggested')::INTEGER as suggested_count,
        COUNT(*) FILTER (WHERE status = 'worker_interested')::INTEGER as worker_interested_count,
        COUNT(*) FILTER (WHERE status = 'employer_interested')::INTEGER as employer_interested_count,
        COUNT(*) FILTER (WHERE status = 'mutual_interest')::INTEGER as mutual_interest_count,
        COUNT(*) FILTER (WHERE status = 'applied')::INTEGER as applied_count,
        COUNT(*) FILTER (WHERE status IN ('dismissed_worker', 'dismissed_employer'))::INTEGER as dismissed_count,
        AVG(match_score)::NUMERIC(5,2) as avg_match_score
    FROM cc_job_matches
    WHERE job_id = p_job_id;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_applications_updated ON cc_job_applications;
CREATE TRIGGER trg_applications_updated
    BEFORE UPDATE ON cc_job_applications
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_matches_updated ON cc_job_matches;
CREATE TRIGGER trg_matches_updated
    BEFORE UPDATE ON cc_job_matches
    FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Query 1: Verify tables exist with correct columns
SELECT 
    'cc_job_matches' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'cc_job_matches'
UNION ALL
SELECT 
    'cc_job_applications',
    COUNT(*)
FROM information_schema.columns 
WHERE table_name = 'cc_job_applications';

-- Query 2: Verify enums created
SELECT typname, array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('job_application_status', 'job_match_source', 'job_match_status')
GROUP BY typname;

-- Query 3: Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cc_job_applications', 'cc_job_matches');

-- Query 4: Verify functions created
SELECT proname, prosecdef as security_definer
FROM pg_proc 
WHERE proname IN (
    'cc_next_application_number',
    'cc_submit_job_application',
    'cc_transition_application_status',
    'cc_create_job_match',
    'cc_respond_to_match',
    'cc_employer_respond_to_match',
    'cc_get_job_match_stats'
);

-- Query 5: Verify FK from cc_job_matches to cc_job_applications exists
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'cc_job_matches'
    AND ccu.table_name = 'cc_job_applications';

-- Query 6: Verify applicant_party_id and worker_party_id are NULLABLE (FIX C2)
SELECT 
    table_name, 
    column_name, 
    is_nullable
FROM information_schema.columns 
WHERE (table_name = 'cc_job_applications' AND column_name = 'applicant_party_id')
   OR (table_name = 'cc_job_matches' AND column_name = 'worker_party_id');

-- Query 7: Test cold-start wedge guard (FIX C3)
-- This should fail with 'JOB_UNCLAIMED_USE_JOB_APPLICANTS' error
-- (Run manually with a job that has tenant_id IS NULL)
/*
SELECT cc_submit_job_application(
    'posting-id-for-unclaimed-job'::UUID,
    'worker-individual-id'::UUID
);
*/

-- Query 8: Verify no "booking" terminology used (should return 0 rows)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name IN ('cc_job_applications', 'cc_job_matches')
  AND column_name LIKE '%book%';

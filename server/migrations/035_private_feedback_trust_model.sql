-- ============================================================
-- COMMUNITY CANVAS v2.5 - PRIVATE FEEDBACK & TRUST MODEL
-- Migration 035 - Small-Town Trust (No Public Negatives)
-- ============================================================

-- Philosophy:
-- - Contractors hold power in small towns (scarcity)
-- - No public negative reviews EVER
-- - Private feedback is deletable by contractor
-- - Public reputation = aggregated signals only, no narrative
-- - Serious issues go to internal admin channel

-- ============================================================
-- 1. FEEDBACK ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM (
    'private_note',
    'private_feedback',
    'appreciation',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_category AS ENUM (
    'fraud',
    'safety',
    'harassment',
    'non_payment',
    'abandonment',
    'property_damage',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM (
    'submitted',
    'triage',
    'requesting_info',
    'investigating',
    'resolved_no_action',
    'resolved_action_taken',
    'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. PRIVATE FEEDBACK (Owner → Contractor, Deletable)
-- ============================================================

CREATE TABLE IF NOT EXISTS private_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  conversation_id UUID REFERENCES conversations(id),
  
  from_party_id UUID NOT NULL REFERENCES parties(id),
  from_individual_id UUID REFERENCES cc_individuals(id),
  
  to_party_id UUID NOT NULL REFERENCES parties(id),
  
  feedback_type feedback_type NOT NULL DEFAULT 'private_feedback',
  
  content TEXT NOT NULL,
  
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  timeliness_rating INTEGER CHECK (timeliness_rating BETWEEN 1 AND 5),
  
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  deleted_by_contractor BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  marked_not_constructive BOOLEAN DEFAULT false,
  contractor_response TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_feedback_opportunity_idx ON private_feedback(opportunity_id);
CREATE INDEX IF NOT EXISTS private_feedback_to_party_idx ON private_feedback(to_party_id);
CREATE INDEX IF NOT EXISTS private_feedback_from_party_idx ON private_feedback(from_party_id);
CREATE INDEX IF NOT EXISTS private_feedback_active_idx ON private_feedback(to_party_id) 
  WHERE NOT deleted_by_contractor;

-- ============================================================
-- 3. SERIOUS ISSUE REPORTS (Internal Admin Only)
-- ============================================================

CREATE TABLE IF NOT EXISTS serious_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  opportunity_id UUID REFERENCES opportunities(id),
  conversation_id UUID REFERENCES conversations(id),
  
  reporter_party_id UUID NOT NULL REFERENCES parties(id),
  reporter_individual_id UUID REFERENCES cc_individuals(id),
  
  subject_party_id UUID NOT NULL REFERENCES parties(id),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('contractor', 'owner', 'operator')),
  
  category issue_category NOT NULL,
  description TEXT NOT NULL,
  
  evidence JSONB,
  
  status issue_status NOT NULL DEFAULT 'submitted',
  
  assigned_to TEXT,
  internal_notes TEXT,
  resolution_summary TEXT,
  resolution_date TIMESTAMPTZ,
  
  action_taken TEXT,
  action_date TIMESTAMPTZ,
  
  is_pattern_match BOOLEAN DEFAULT false,
  related_report_ids UUID[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS serious_issues_status_idx ON serious_issue_reports(status);
CREATE INDEX IF NOT EXISTS serious_issues_subject_idx ON serious_issue_reports(subject_party_id);
CREATE INDEX IF NOT EXISTS serious_issues_category_idx ON serious_issue_reports(category);

-- ============================================================
-- 4. PUBLIC APPRECIATION (Positive Only, Opt-In)
-- ============================================================

CREATE TABLE IF NOT EXISTS public_appreciations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  
  from_party_id UUID NOT NULL REFERENCES parties(id),
  from_individual_id UUID REFERENCES cc_individuals(id),
  from_display_name TEXT,
  
  to_party_id UUID NOT NULL REFERENCES parties(id),
  
  content TEXT NOT NULL,
  
  highlights TEXT[],
  
  is_public BOOLEAN DEFAULT false,
  made_public_at TIMESTAMPTZ,
  
  hidden_by_contractor BOOLEAN DEFAULT false,
  hidden_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appreciations_to_party_idx ON public_appreciations(to_party_id);
CREATE INDEX IF NOT EXISTS appreciations_public_idx ON public_appreciations(to_party_id, is_public) 
  WHERE is_public AND NOT hidden_by_contractor;

-- ============================================================
-- 5. CONTRACTOR FEEDBACK PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS contractor_feedback_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) UNIQUE,
  
  accepts_private_feedback BOOLEAN DEFAULT true,
  accepts_appreciation_requests BOOLEAN DEFAULT true,
  
  auto_archive_after_days INTEGER DEFAULT 30,
  
  blocked_party_ids UUID[],
  
  notify_on_feedback BOOLEAN DEFAULT true,
  notify_on_appreciation BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. UPDATE TRUST SIGNALS - NO NARRATIVE COMPLAINTS
-- ============================================================

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS positive_feedback_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_appreciation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_customer_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS years_in_community INTEGER;

COMMENT ON TABLE trust_signals IS 
  'Aggregated metrics only. NO narrative complaints. NO negative review text. Public reputation = patterns, not stories.';

-- ============================================================
-- 7. ADD PAYMENT PREFERENCES TO PARTIES
-- ============================================================

ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS payment_preferences JSONB DEFAULT '{
    "accepts_etransfer": true,
    "accepts_cheque": true,
    "accepts_card": true,
    "card_max_amount": 3000,
    "card_fee_responsibility": "owner",
    "accepts_financing": false,
    "accepts_barter": false,
    "preferred_method": "etransfer"
  }'::jsonb;

COMMENT ON COLUMN parties.payment_preferences IS 
  'Contractor payment preferences. card_max_amount prevents chargeback exposure on large jobs.';

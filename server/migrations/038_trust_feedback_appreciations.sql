-- ============================================================
-- COMMUNITY CANVAS v2.6 - TRUST + FEEDBACK LAYER (SMALL TOWN)
-- Migration 038 - Works with existing trust_signals schema
-- ============================================================

-- Philosophy:
-- - Private feedback can include negatives (contractor inbox)
-- - Public appreciations are POSITIVE-ONLY
-- - Contractor controls what becomes public
-- - No weaponizable metrics by default
-- - Schema enforces "no public negatives"

-- ============================================================
-- 1. VISIBILITY ENUM
-- ============================================================

DO $$ BEGIN
  CREATE TYPE signal_visibility AS ENUM (
    'public',
    'verified_users',
    'parties_only',
    'private'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. FEEDBACK SENTIMENT ENUM
-- ============================================================

DO $$ BEGIN
  CREATE TYPE feedback_sentiment AS ENUM (
    'positive',
    'neutral',
    'issue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. EXTEND EXISTING trust_signals TABLE
-- ============================================================

-- Add contractor-controlled display preferences
ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS display_preferences JSONB DEFAULT '{
    "show_repeat_customers": true,
    "show_public_appreciations": true,
    "show_credentials": true,
    "show_response_time": false,
    "show_years_in_community": true,
    "show_completion_rate": true
  }'::jsonb;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS verified_communities TEXT[];

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS computation_version INTEGER DEFAULT 1;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS jobs_completed INTEGER DEFAULT 0;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS jobs_in_progress INTEGER DEFAULT 0;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS total_unique_customers INTEGER DEFAULT 0;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT false;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS insurance_verified_at TIMESTAMPTZ;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS licenses TEXT[];

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS certifications TEXT[];

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS member_since DATE;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS platform_verified BOOLEAN DEFAULT false;

ALTER TABLE trust_signals
  ADD COLUMN IF NOT EXISTS appreciation_highlights TEXT[];

COMMENT ON COLUMN trust_signals.display_preferences IS
  'Contractor controls what is visible publicly. show_response_time defaults FALSE (weaponizable).';

-- Helpful index
CREATE INDEX IF NOT EXISTS trust_signals_party_model_idx
  ON trust_signals(party_id, model);

-- ============================================================
-- 4. PRIVATE CONTRACTOR FEEDBACK (Can Include Negatives)
-- ============================================================

CREATE TABLE IF NOT EXISTS contractor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,

  -- Who sent feedback
  from_party_id UUID NOT NULL REFERENCES parties(id),
  from_individual_id UUID REFERENCES cc_individuals(id),
  from_display_name TEXT,

  -- Who receives feedback
  to_party_id UUID NOT NULL REFERENCES parties(id),

  -- Content
  sentiment feedback_sentiment NOT NULL DEFAULT 'neutral',
  feedback_text TEXT NOT NULL,

  -- Ratings (optional, private)
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  timeliness_rating INTEGER CHECK (timeliness_rating BETWEEN 1 AND 5),

  -- ALWAYS private to contractor leadership
  visibility signal_visibility NOT NULL DEFAULT 'private',

  -- Contractor controls handling
  is_handled BOOLEAN DEFAULT false,
  handled_at TIMESTAMPTZ,
  handled_by_individual_id UUID REFERENCES cc_individuals(id),
  handler_notes TEXT,

  -- Contractor can archive or delete
  archived_at TIMESTAMPTZ,
  contractor_deleted_at TIMESTAMPTZ,
  contractor_delete_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_feedback_to_idx 
  ON contractor_feedback(to_party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contractor_feedback_conv_idx 
  ON contractor_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS contractor_feedback_sentiment_idx
  ON contractor_feedback(to_party_id, sentiment) WHERE contractor_deleted_at IS NULL;

COMMENT ON TABLE contractor_feedback IS
  'Private feedback inbox to contractor leadership. May include complaints. NEVER public automatically.';

-- ============================================================
-- 5. PUBLIC APPRECIATIONS (Positive-Only, Contractor-Promoted)
-- ============================================================

CREATE TABLE IF NOT EXISTS public_appreciations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source (if promoted from feedback)
  source_feedback_id UUID REFERENCES contractor_feedback(id) ON DELETE SET NULL,

  -- Links
  opportunity_id UUID REFERENCES opportunities(id),
  conversation_id UUID REFERENCES conversations(id),

  -- Who gave appreciation
  from_party_id UUID REFERENCES parties(id),
  from_individual_id UUID REFERENCES cc_individuals(id),
  from_display_name TEXT,

  -- Who receives appreciation
  to_party_id UUID NOT NULL REFERENCES parties(id),

  -- Positive-only public snippet (no names, no addresses, no negatives)
  snippet TEXT NOT NULL DEFAULT '',
  highlights TEXT[],

  -- Contractor controls visibility
  is_public BOOLEAN DEFAULT false,
  hidden_by_contractor BOOLEAN DEFAULT false,
  hidden_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  made_public_at TIMESTAMPTZ
);

-- IDEMPOTENT: Add columns for pre-existing tables (without FKs first)
ALTER TABLE public_appreciations ADD COLUMN IF NOT EXISTS snippet TEXT;
ALTER TABLE public_appreciations ADD COLUMN IF NOT EXISTS source_feedback_id UUID;
ALTER TABLE public_appreciations ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Set default for snippet
ALTER TABLE public_appreciations ALTER COLUMN snippet SET DEFAULT '';

-- Backfill snippet from content column if it exists and snippet is empty
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'public_appreciations' AND column_name = 'content') THEN
    UPDATE public_appreciations SET snippet = content WHERE (snippet IS NULL OR snippet = '') AND content IS NOT NULL;
  END IF;
  -- Set empty string for remaining nulls
  UPDATE public_appreciations SET snippet = '' WHERE snippet IS NULL;
END $$;

-- Add FK constraints if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'public_appreciations_source_feedback_id_fkey' 
                 AND table_name = 'public_appreciations') THEN
    ALTER TABLE public_appreciations 
      ADD CONSTRAINT public_appreciations_source_feedback_id_fkey 
      FOREIGN KEY (source_feedback_id) REFERENCES contractor_feedback(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ENFORCE: Snippet must have content
ALTER TABLE public_appreciations
  DROP CONSTRAINT IF EXISTS public_appreciations_snippet_not_empty;
ALTER TABLE public_appreciations
  ADD CONSTRAINT public_appreciations_snippet_not_empty 
  CHECK (snippet = '' OR length(trim(snippet)) >= 3);

-- ENFORCE: Snippet length limit (no essays)
ALTER TABLE public_appreciations
  DROP CONSTRAINT IF EXISTS public_appreciations_snippet_length;
ALTER TABLE public_appreciations
  ADD CONSTRAINT public_appreciations_snippet_length 
  CHECK (length(snippet) <= 500);

CREATE INDEX IF NOT EXISTS public_appreciations_to_public_idx
  ON public_appreciations(to_party_id) 
  WHERE is_public = true AND hidden_by_contractor = false;

COMMENT ON TABLE public_appreciations IS
  'Positive-only public snippets. Visible only if contractor opts in (is_public=true) and not hidden. NO NEGATIVES EVER.';

-- ============================================================
-- 6. APPRECIATION THEMES (Aggregated Positive Patterns)
-- ============================================================

CREATE TABLE IF NOT EXISTS appreciation_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  party_id UUID NOT NULL REFERENCES parties(id),
  
  theme TEXT NOT NULL,
  mention_count INTEGER DEFAULT 1,
  
  example_snippet TEXT,
  
  last_mentioned_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(party_id, theme)
);

CREATE INDEX IF NOT EXISTS appreciation_themes_party_idx 
  ON appreciation_themes(party_id);

COMMENT ON TABLE appreciation_themes IS
  'Aggregated positive themes only. No negative themes stored. Ever.';

-- ============================================================
-- 7. TRUST SIGNAL HISTORY (For Trends)
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_signal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  party_id UUID NOT NULL REFERENCES parties(id),
  model TEXT NOT NULL DEFAULT 'v1_agg',

  repeat_customer_count INTEGER,
  public_appreciation_count INTEGER,
  positive_feedback_count INTEGER,
  response_time_avg_hours NUMERIC,
  completion_rate NUMERIC,
  years_in_community INTEGER,

  computed_at TIMESTAMPTZ DEFAULT now(),
  computation_version INTEGER DEFAULT 1,
  
  period_end DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS trust_history_party_idx
  ON trust_signal_history(party_id, model, computed_at DESC);

COMMENT ON TABLE trust_signal_history IS
  'Historical snapshots for trend analysis. Never contains narratives or complaints.';

-- ============================================================
-- 8. COMMUNITY VERIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS community_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  party_id UUID NOT NULL REFERENCES parties(id),
  
  community_name TEXT NOT NULL,
  community_type TEXT CHECK (community_type IN (
    'municipality', 'first_nation', 'regional_district', 
    'chamber_of_commerce', 'trade_association', 'informal'
  )),
  
  verified_by_party_id UUID REFERENCES parties(id),
  verified_by_name TEXT,
  verification_method TEXT,
  
  verified_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  verification_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_verifications_party_idx 
  ON community_verifications(party_id) WHERE is_active;

-- ============================================================
-- 9. CREDENTIAL VERIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS credential_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  party_id UUID NOT NULL REFERENCES parties(id),
  
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'business_license', 'trade_license', 'insurance_liability',
    'insurance_wcb', 'red_seal', 'technical_safety_bc',
    'first_aid', 'fall_protection', 'asbestos_awareness',
    'confined_space', 'other'
  )),
  
  credential_name TEXT NOT NULL,
  credential_number TEXT,
  issuing_authority TEXT,
  
  issued_date DATE,
  expiry_date DATE,
  is_current BOOLEAN DEFAULT true,
  
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  verification_url TEXT,
  
  document_url TEXT,
  
  visibility signal_visibility DEFAULT 'public',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credential_verifications_party_idx 
  ON credential_verifications(party_id) WHERE is_current;

-- ============================================================
-- 10. PHILOSOPHY COMMENTS
-- ============================================================

COMMENT ON SCHEMA public IS
  'Community Canvas: Trust = aggregated patterns. Private feedback can include negatives. Public = positive only. Contractor controls visibility.';

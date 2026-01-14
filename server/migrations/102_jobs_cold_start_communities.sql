-- ============================================================
-- MIGRATION 102: JOBS COLD-START WEDGE
-- Part of Prompt 24 - Jobs as First-Class Objects
-- ============================================================

BEGIN;

-- ============================================================
-- 1) COMMUNITIES (Geographic Organization)
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  
  -- Geography
  region_name text,
  province text DEFAULT 'BC',
  country text DEFAULT 'Canada',
  latitude numeric,
  longitude numeric,
  timezone text DEFAULT 'America/Vancouver',
  
  -- Characteristics
  population_estimate integer,
  is_remote boolean DEFAULT false,
  access_notes text,
  
  -- Associated portal (if any)
  portal_id uuid REFERENCES cc_portals(id),
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_communities_slug ON cc_communities(slug);
CREATE INDEX IF NOT EXISTS idx_cc_communities_portal ON cc_communities(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_communities_active ON cc_communities(is_active);
CREATE INDEX IF NOT EXISTS idx_cc_communities_region ON cc_communities(region_name, province);

-- Enable RLS
ALTER TABLE cc_communities ENABLE ROW LEVEL SECURITY;

-- Communities are publicly readable
CREATE POLICY cc_communities_public_read ON cc_communities
  FOR SELECT
  USING (is_active = true);

CREATE POLICY cc_communities_service_bypass ON cc_communities
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- ============================================================
-- 2) JOBS (First-Class, Tenant-Optional)
-- ============================================================

-- Job role categories
DO $$ BEGIN
  CREATE TYPE job_role_category AS ENUM (
    'housekeeping',
    'cook',
    'server',
    'bartender',
    'maintenance',
    'landscaping',
    'marina',
    'dock_attendant',
    'driver',
    'guide',
    'retail',
    'general_labour',
    'skilled_trade',
    'administrative',
    'management',
    'security',
    'childcare',
    'healthcare',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_employment_type AS ENUM (
    'full_time',
    'part_time',
    'seasonal',
    'contract',
    'on_call',
    'temporary'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_urgency AS ENUM (
    'normal',
    'urgent',
    'emergency'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_verification_state AS ENUM (
    'draft',
    'awaiting_employer',
    'verified',
    'rejected',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'open',
    'paused',
    'filled',
    'expired',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  title text NOT NULL,
  slug text,
  role_category job_role_category NOT NULL,
  employment_type job_employment_type NOT NULL,
  
  -- Location
  community_id uuid REFERENCES cc_communities(id),
  location_text text,
  latitude numeric,
  longitude numeric,
  
  -- Work Details
  description text NOT NULL,
  responsibilities text,
  requirements text,
  nice_to_have text,
  
  -- Dates
  start_date date,
  end_date date,
  is_flexible_dates boolean DEFAULT false,
  hours_per_week integer,
  shift_details text,
  
  -- Urgency
  urgency job_urgency NOT NULL DEFAULT 'normal',
  
  -- Housing & Logistics (CRITICAL for rural jobs)
  housing_provided boolean DEFAULT false,
  housing_type text,
  housing_description text,
  rv_friendly boolean DEFAULT false,
  meals_provided boolean DEFAULT false,
  transport_assistance boolean DEFAULT false,
  relocation_assistance boolean DEFAULT false,
  
  -- Compensation (truth layer - may not match disclosure)
  pay_type text,
  pay_min numeric,
  pay_max numeric,
  currency text DEFAULT 'CAD',
  benefits_description text,
  
  -- Disclosure layer (what public sees)
  disclosed_pay_min numeric,
  disclosed_pay_max numeric,
  show_pay boolean DEFAULT true,
  
  -- Provenance & Trust
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  verification_state job_verification_state NOT NULL DEFAULT 'draft',
  disclaimer_text text,
  verified_at timestamptz,
  verified_by_user_id uuid REFERENCES cc_user_profiles(id),
  
  -- Ownership (ALL NULLABLE - this is the key design)
  tenant_id uuid REFERENCES cc_tenants(id),
  operator_id uuid REFERENCES cc_operators(id),
  party_id uuid REFERENCES cc_parties(id),
  portal_id uuid REFERENCES cc_portals(id),
  created_by_user_id uuid REFERENCES cc_user_profiles(id),
  
  -- Lifecycle
  status job_status NOT NULL DEFAULT 'open',
  filled_at timestamptz,
  expires_at timestamptz,
  
  -- Stats
  view_count integer DEFAULT 0,
  application_count integer DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_jobs_community ON cc_jobs(community_id);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_status ON cc_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_verification ON cc_jobs(verification_state);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_role ON cc_jobs(role_category);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_employment ON cc_jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_urgency ON cc_jobs(urgency);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_tenant ON cc_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_operator ON cc_jobs(operator_id);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_portal ON cc_jobs(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_slug ON cc_jobs(slug);
CREATE INDEX IF NOT EXISTS idx_cc_jobs_housing ON cc_jobs(housing_provided) WHERE housing_provided = true;
CREATE INDEX IF NOT EXISTS idx_cc_jobs_open ON cc_jobs(status, urgency) WHERE status = 'open';

-- Enable RLS
ALTER TABLE cc_jobs ENABLE ROW LEVEL SECURITY;

-- Public can read open, verified jobs
CREATE POLICY cc_jobs_public_read ON cc_jobs
  FOR SELECT
  USING (status = 'open' AND verification_state = 'verified');

-- Unverified jobs readable with disclaimer
CREATE POLICY cc_jobs_unverified_read ON cc_jobs
  FOR SELECT
  USING (status = 'open' AND verification_state IN ('draft', 'awaiting_employer'));

-- Tenant can manage their jobs
CREATE POLICY cc_jobs_tenant_manage ON cc_jobs
  FOR ALL
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- Service bypass
CREATE POLICY cc_jobs_service_bypass ON cc_jobs
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- ============================================================
-- 3) JOB POSTINGS (Portal Syndication)
-- Which portals show which jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  
  -- Display options
  is_featured boolean DEFAULT false,
  is_pinned boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  pin_rank integer,
  
  -- Portal-specific overrides
  custom_title text,
  custom_description text,
  
  -- Auto-syndication source
  auto_syndicated boolean DEFAULT false,
  syndication_rule_id uuid,
  
  -- Timestamps
  posted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_job_postings_unique ON cc_job_postings(job_id, portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_job_postings_portal ON cc_job_postings(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_job_postings_featured ON cc_job_postings(portal_id, is_featured) WHERE is_featured = true;

-- Enable RLS
ALTER TABLE cc_job_postings ENABLE ROW LEVEL SECURITY;

-- Public read for visible postings
CREATE POLICY cc_job_postings_public_read ON cc_job_postings
  FOR SELECT
  USING (NOT is_hidden);

-- Service bypass
CREATE POLICY cc_job_postings_service_bypass ON cc_job_postings
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- ============================================================
-- 4) JOB APPLICANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_job_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES cc_jobs(id) ON DELETE CASCADE,
  
  -- Applicant identity (individual_id nullable until onboarded)
  individual_id uuid REFERENCES cc_individuals(id),
  name text NOT NULL,
  email text,
  phone text,
  
  -- Application
  cover_letter text,
  resume_url text,
  resume_media_id uuid,
  
  -- Status
  status text NOT NULL DEFAULT 'applied',
  
  -- Notes
  internal_notes text,
  
  -- Routing (for non-onboarded employers)
  routed_to_email text,
  routed_at timestamptz,
  
  -- Response
  responded_at timestamptz,
  response_type text,
  
  -- Timestamps
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Require email OR phone
  CONSTRAINT applicant_has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cc_job_applicants_job ON cc_job_applicants(job_id);
CREATE INDEX IF NOT EXISTS idx_cc_job_applicants_individual ON cc_job_applicants(individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_job_applicants_status ON cc_job_applicants(status);
CREATE INDEX IF NOT EXISTS idx_cc_job_applicants_email ON cc_job_applicants(email);

-- Enable RLS
ALTER TABLE cc_job_applicants ENABLE ROW LEVEL SECURITY;

-- Job owner can see applicants
CREATE POLICY cc_job_applicants_job_owner ON cc_job_applicants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_jobs j
      WHERE j.id = cc_job_applicants.job_id
        AND j.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- Applicant can see their own (via individual's party)
CREATE POLICY cc_job_applicants_self ON cc_job_applicants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_individuals i
      JOIN cc_parties p ON i.id = cc_job_applicants.individual_id
      WHERE p.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- Service bypass
CREATE POLICY cc_job_applicants_service_bypass ON cc_job_applicants
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- ============================================================
-- 5) SEED INITIAL COMMUNITIES
-- ============================================================

INSERT INTO cc_communities (name, slug, description, region_name, province, is_remote, access_notes)
VALUES 
  ('Bamfield', 'bamfield', 'West Coast fishing village with marine research station', 'Alberni-Clayoquot', 'BC', true, 'Access via gravel road from Port Alberni or water taxi from Ucluelet'),
  ('Tofino', 'tofino', 'Surfing and tourism destination on Vancouver Island''s west coast', 'Alberni-Clayoquot', 'BC', false, 'Paved highway from Port Alberni'),
  ('Ucluelet', 'ucluelet', 'Fishing and tourism community near Pacific Rim National Park', 'Alberni-Clayoquot', 'BC', false, 'Paved highway from Port Alberni')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 6) GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_communities TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_jobs TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_job_postings TO cc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_job_applicants TO cc_app;

COMMIT;

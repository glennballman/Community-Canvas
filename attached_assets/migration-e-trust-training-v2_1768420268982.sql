-- ============================================================================
-- MIGRATION E v2 (DROP-IN): TRUST & TRAINING
-- Tables: cc_certifications, cc_training_modules, cc_training_completions
-- Run order: FOURTH (4 of 4)
--
-- Guardrails:
--   - No gamification (no badges/XP/streaks)
--   - No public RLS policies on base tables
--   - "Public verification" via SECURITY DEFINER functions returning safe subsets
--   - Tenant isolation via current_tenant_id(), is_service_mode()
--   - All SECURITY DEFINER functions with proper search_path
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
  CREATE TYPE certification_status AS ENUM ('draft','pending_verification','verified','rejected','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE certification_verification_method AS ENUM ('self_attested','document_review','issuer_lookup','in_person','third_party_provider','training_auto_issue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE training_module_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE training_completion_status AS ENUM ('in_progress','submitted','passed','failed','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: cc_certifications (individual-owned)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,

  -- What certification is this?
  certification_name TEXT NOT NULL,                 -- "Red Seal Electrician", "WHMIS", "First Aid"
  certification_code TEXT,                          -- optional external code
  code_system TEXT,                                 -- e.g., 'red_seal', 'whmis'
  issuing_body TEXT,                                -- e.g., "SkilledTradesBC", "St. John Ambulance"
  jurisdiction_code TEXT,                           -- e.g., 'CA-BC', 'CA-ON'
  certificate_number TEXT,                          -- SENSITIVE: not exposed via public verification
  credential_url TEXT,                              -- SENSITIVE: could be doc link; not exposed publicly
  document_file_id UUID,                            -- optional link to internal file table

  -- Lifecycle
  status certification_status NOT NULL DEFAULT 'draft',
  issued_at DATE,
  expires_at DATE,

  -- Verification
  verification_method certification_verification_method NOT NULL DEFAULT 'self_attested',
  verified_at TIMESTAMPTZ,
  verified_by_individual_id UUID REFERENCES cc_individuals(id),
  verification_notes TEXT,

  -- Visibility / consent
  is_public BOOLEAN NOT NULL DEFAULT FALSE,          -- controls what public verification can return
  public_label TEXT,                                -- optional "display label" for verification output

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_cert_dates CHECK (
    expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at
  )
);

CREATE INDEX IF NOT EXISTS idx_cert_tenant_individual ON cc_certifications(tenant_id, individual_id);
CREATE INDEX IF NOT EXISTS idx_cert_status ON cc_certifications(tenant_id, status, expires_at);

-- ============================================================================
-- TABLE: cc_training_modules (tenant content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  module_code TEXT NOT NULL,                        -- stable key like "WHMIS-101"
  title TEXT NOT NULL,
  description TEXT,
  status training_module_status NOT NULL DEFAULT 'draft',

  -- Assessment
  has_quiz BOOLEAN NOT NULL DEFAULT FALSE,
  max_score NUMERIC(6,2),
  passing_score NUMERIC(6,2),
  allow_retake BOOLEAN NOT NULL DEFAULT TRUE,

  -- Optional auto-issue certification
  auto_issues_certification BOOLEAN NOT NULL DEFAULT FALSE,
  certification_name TEXT,                          -- if auto_issues_certification
  certification_code TEXT,
  code_system TEXT,
  issuing_body TEXT,
  jurisdiction_code TEXT,
  default_valid_days INTEGER,                       -- set expires_at = completed_date + valid_days

  -- Content refs
  content_ref TEXT,                                 -- URL/path/key to content bundle
  metadata JSONB,

  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_training_module_code UNIQUE (tenant_id, module_code),
  CONSTRAINT ck_scores CHECK (
    (max_score IS NULL OR max_score > 0)
    AND (passing_score IS NULL OR passing_score >= 0)
    AND (max_score IS NULL OR passing_score IS NULL OR passing_score <= max_score)
  )
);

CREATE INDEX IF NOT EXISTS idx_training_modules_status ON cc_training_modules(tenant_id, status);

-- ============================================================================
-- TABLE: cc_training_completions (individual progress/results)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,

  module_id UUID NOT NULL REFERENCES cc_training_modules(id) ON DELETE CASCADE,
  individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,

  status training_completion_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Scores
  score NUMERIC(6,2),
  max_score NUMERIC(6,2),
  passing_score NUMERIC(6,2),
  pass BOOLEAN,

  -- Attempt tracking
  attempt_number INTEGER NOT NULL DEFAULT 1,

  -- Optional linkage
  issued_certification_id UUID REFERENCES cc_certifications(id),

  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_training_completion_attempt UNIQUE (tenant_id, module_id, individual_id, attempt_number),
  CONSTRAINT ck_attempt_number CHECK (attempt_number >= 1)
);

CREATE INDEX IF NOT EXISTS idx_training_completions_owner ON cc_training_completions(tenant_id, individual_id, status);
CREATE INDEX IF NOT EXISTS idx_training_completions_module ON cc_training_completions(tenant_id, module_id, status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_cert_updated ON cc_certifications;
CREATE TRIGGER trg_cert_updated
  BEFORE UPDATE ON cc_certifications
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_training_modules_updated ON cc_training_modules;
CREATE TRIGGER trg_training_modules_updated
  BEFORE UPDATE ON cc_training_modules
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

DROP TRIGGER IF EXISTS trg_training_completions_updated ON cc_training_completions;
CREATE TRIGGER trg_training_completions_updated
  BEFORE UPDATE ON cc_training_completions
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================================
-- RLS POLICIES (NO PUBLIC READ ON BASE TABLES)
-- ============================================================================

ALTER TABLE cc_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_training_completions ENABLE ROW LEVEL SECURITY;

-- Certifications: tenant can see all within tenant; individual owns their own for write
DROP POLICY IF EXISTS cert_owner_select ON cc_certifications;
DROP POLICY IF EXISTS cert_tenant_select ON cc_certifications;
DROP POLICY IF EXISTS cert_owner_insert ON cc_certifications;
DROP POLICY IF EXISTS cert_owner_update ON cc_certifications;
DROP POLICY IF EXISTS cert_delete_service ON cc_certifications;

-- Tenant-wide SELECT (for operational workflows)
CREATE POLICY cert_tenant_select ON cc_certifications
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

-- Owner INSERT (individual can add their own)
CREATE POLICY cert_owner_insert ON cc_certifications
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      individual_id = current_individual_id()
      OR is_service_mode()
    )
  );

-- Owner UPDATE (individual can update their own)
CREATE POLICY cert_owner_update ON cc_certifications
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (individual_id = current_individual_id() OR is_service_mode())
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (individual_id = current_individual_id() OR is_service_mode())
  );

-- Delete: service-only (credentials should be preserved; use revoked status)
CREATE POLICY cert_delete_service ON cc_certifications
  FOR DELETE
  USING (is_service_mode());

-- Training modules: tenant content readable within tenant
DROP POLICY IF EXISTS training_modules_select ON cc_training_modules;
DROP POLICY IF EXISTS training_modules_insert ON cc_training_modules;
DROP POLICY IF EXISTS training_modules_update ON cc_training_modules;
DROP POLICY IF EXISTS training_modules_delete_service ON cc_training_modules;

CREATE POLICY training_modules_select ON cc_training_modules
  FOR SELECT
  USING (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY training_modules_insert ON cc_training_modules
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY training_modules_update ON cc_training_modules
  FOR UPDATE
  USING (tenant_id = current_tenant_id() OR is_service_mode())
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY training_modules_delete_service ON cc_training_modules
  FOR DELETE
  USING (is_service_mode());

-- Training completions: tenant readable, individual owns writes
DROP POLICY IF EXISTS training_completions_select ON cc_training_completions;
DROP POLICY IF EXISTS training_completions_insert ON cc_training_completions;
DROP POLICY IF EXISTS training_completions_update ON cc_training_completions;
DROP POLICY IF EXISTS training_completions_delete_service ON cc_training_completions;

CREATE POLICY training_completions_select ON cc_training_completions
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR is_service_mode()
  );

CREATE POLICY training_completions_insert ON cc_training_completions
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (individual_id = current_individual_id() OR is_service_mode())
  );

CREATE POLICY training_completions_update ON cc_training_completions
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (individual_id = current_individual_id() OR is_service_mode())
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (individual_id = current_individual_id() OR is_service_mode())
  );

CREATE POLICY training_completions_delete_service ON cc_training_completions
  FOR DELETE
  USING (is_service_mode());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Submit certification (self-attested)
CREATE OR REPLACE FUNCTION cc_submit_certification(
  p_tenant_id UUID,
  p_individual_id UUID,
  p_certification_name TEXT,
  p_issuing_body TEXT DEFAULT NULL,
  p_jurisdiction_code TEXT DEFAULT NULL,
  p_certificate_number TEXT DEFAULT NULL,
  p_credential_url TEXT DEFAULT NULL,
  p_issued_at DATE DEFAULT NULL,
  p_expires_at DATE DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT FALSE,
  p_public_label TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF NOT is_service_mode() AND p_individual_id != current_individual_id() THEN
    RAISE EXCEPTION 'Individual mismatch';
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO cc_certifications(
    id, tenant_id, individual_id,
    certification_name, issuing_body, jurisdiction_code,
    certificate_number, credential_url,
    status, verification_method,
    issued_at, expires_at,
    is_public, public_label,
    metadata
  ) VALUES (
    v_id, p_tenant_id, p_individual_id,
    p_certification_name, p_issuing_body, p_jurisdiction_code,
    p_certificate_number, p_credential_url,
    'pending_verification', 'self_attested',
    p_issued_at, p_expires_at,
    COALESCE(p_is_public,FALSE), p_public_label,
    p_metadata
  );

  RETURN v_id;
END;
$$;

-- Verify certification (tenant staff or service)
CREATE OR REPLACE FUNCTION cc_verify_certification(
  p_certification_id UUID,
  p_verification_method certification_verification_method,
  p_status certification_status,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM cc_certifications WHERE id = p_certification_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Certification not found'; END IF;

  IF NOT is_service_mode() AND v_tenant != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  UPDATE cc_certifications SET
    status = p_status,
    verification_method = p_verification_method,
    verified_at = now(),
    verified_by_individual_id = current_individual_id(),
    verification_notes = p_notes,
    updated_at = now()
  WHERE id = p_certification_id;

  RETURN TRUE;
END;
$$;

-- Public verification: SAFE subset only (requires is_public=true)
CREATE OR REPLACE FUNCTION cc_get_public_certification(
  p_certification_id UUID
)
RETURNS TABLE(
  certification_id UUID,
  tenant_id UUID,
  individual_id UUID,
  certification_name TEXT,
  public_label TEXT,
  status certification_status,
  verification_method certification_verification_method,
  verified_at TIMESTAMPTZ,
  issued_at DATE,
  expires_at DATE,
  issuing_body TEXT,
  jurisdiction_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.tenant_id,
    c.individual_id,
    c.certification_name,
    c.public_label,
    c.status,
    c.verification_method,
    c.verified_at,
    c.issued_at,
    c.expires_at,
    c.issuing_body,
    c.jurisdiction_code
  FROM cc_certifications c
  WHERE c.id = p_certification_id
    AND c.is_public = TRUE
    AND c.status IN ('verified','expired','revoked','pending_verification');
END;
$$;

-- Create training module (tenant)
CREATE OR REPLACE FUNCTION cc_create_training_module(
  p_tenant_id UUID,
  p_module_code TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_has_quiz BOOLEAN DEFAULT FALSE,
  p_max_score NUMERIC DEFAULT NULL,
  p_passing_score NUMERIC DEFAULT NULL,
  p_auto_issues_certification BOOLEAN DEFAULT FALSE,
  p_certification_name TEXT DEFAULT NULL,
  p_issuing_body TEXT DEFAULT NULL,
  p_jurisdiction_code TEXT DEFAULT NULL,
  p_default_valid_days INTEGER DEFAULT NULL,
  p_content_ref TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO cc_training_modules(
    id, tenant_id, module_code, title, description,
    status, has_quiz, max_score, passing_score,
    auto_issues_certification, certification_name, issuing_body, jurisdiction_code, default_valid_days,
    content_ref, metadata
  ) VALUES (
    v_id, p_tenant_id, p_module_code, p_title, p_description,
    'draft', p_has_quiz, p_max_score, p_passing_score,
    p_auto_issues_certification, p_certification_name, p_issuing_body, p_jurisdiction_code, p_default_valid_days,
    p_content_ref, p_metadata
  );

  RETURN v_id;
END;
$$;

-- Publish module (tenant)
CREATE OR REPLACE FUNCTION cc_publish_training_module(p_module_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM cc_training_modules WHERE id=p_module_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Module not found'; END IF;

  IF NOT is_service_mode() AND v_tenant != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  UPDATE cc_training_modules SET
    status='published',
    published_at=now(),
    updated_at=now()
  WHERE id=p_module_id;

  RETURN TRUE;
END;
$$;

-- Record completion (with optional auto-issue certification)
CREATE OR REPLACE FUNCTION cc_record_training_completion(
  p_tenant_id UUID,
  p_module_id UUID,
  p_individual_id UUID,
  p_score NUMERIC DEFAULT NULL,
  p_attempt_number INTEGER DEFAULT NULL
)
RETURNS TABLE(
  completion_id UUID,
  completion_status training_completion_status,
  issued_certification_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_mod RECORD;
  v_id UUID;
  v_attempt INT;
  v_pass BOOLEAN;
  v_status training_completion_status;
  v_cert_id UUID;
  v_expires DATE;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  IF NOT is_service_mode() AND p_individual_id != current_individual_id() THEN
    RAISE EXCEPTION 'Individual mismatch';
  END IF;

  SELECT * INTO v_mod FROM cc_training_modules WHERE id=p_module_id AND tenant_id=p_tenant_id;
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Training module not found'; END IF;
  IF v_mod.status != 'published' THEN RAISE EXCEPTION 'Training module not published'; END IF;

  IF p_attempt_number IS NULL THEN
    SELECT COALESCE(MAX(attempt_number),0)+1 INTO v_attempt
    FROM cc_training_completions
    WHERE tenant_id=p_tenant_id AND module_id=p_module_id AND individual_id=p_individual_id;
  ELSE
    v_attempt := p_attempt_number;
  END IF;

  -- Determine pass/fail
  IF v_mod.has_quiz THEN
    IF v_mod.passing_score IS NULL THEN
      v_pass := NULL;
    ELSE
      v_pass := (p_score IS NOT NULL AND p_score >= v_mod.passing_score);
    END IF;
  ELSE
    v_pass := TRUE;
  END IF;

  IF v_pass IS TRUE THEN
    v_status := 'passed';
  ELSIF v_pass IS FALSE THEN
    v_status := 'failed';
  ELSE
    v_status := 'submitted';
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO cc_training_completions(
    id, tenant_id, module_id, individual_id,
    status, started_at, submitted_at, completed_at,
    score, max_score, passing_score, pass,
    attempt_number
  ) VALUES (
    v_id, p_tenant_id, p_module_id, p_individual_id,
    v_status, now(), now(), CASE WHEN v_status IN ('passed','failed') THEN now() ELSE NULL END,
    p_score, v_mod.max_score, v_mod.passing_score, v_pass,
    v_attempt
  );

  -- Auto-issue certification if configured and passed
  v_cert_id := NULL;
  IF v_status = 'passed' AND v_mod.auto_issues_certification = TRUE AND v_mod.certification_name IS NOT NULL THEN
    IF v_mod.default_valid_days IS NOT NULL THEN
      v_expires := (now()::date + (v_mod.default_valid_days || ' days')::interval)::date;
    ELSE
      v_expires := NULL;
    END IF;

    v_cert_id := gen_random_uuid();
    INSERT INTO cc_certifications(
      id, tenant_id, individual_id,
      certification_name, issuing_body, jurisdiction_code,
      status, verification_method,
      issued_at, expires_at,
      is_public, public_label,
      verified_at, verified_by_individual_id,
      metadata
    ) VALUES (
      v_cert_id, p_tenant_id, p_individual_id,
      v_mod.certification_name, v_mod.issuing_body, v_mod.jurisdiction_code,
      'verified', 'training_auto_issue',
      now()::date, v_expires,
      FALSE, NULL,
      now(), NULL,
      jsonb_build_object('source','training_module','module_id',p_module_id,'completion_id',v_id)
    );

    UPDATE cc_training_completions
      SET issued_certification_id = v_cert_id,
          updated_at = now()
    WHERE id = v_id;
  END IF;

  completion_id := v_id;
  completion_status := v_status;
  issued_certification_id := v_cert_id;
  RETURN NEXT;
END;
$$;

-- Compute trust score (non-gamified, risk-weight for matching)
CREATE OR REPLACE FUNCTION cc_compute_individual_trust_score(
  p_tenant_id UUID,
  p_individual_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = on
AS $$
DECLARE
  v_score NUMERIC := 0;
BEGIN
  IF NOT is_service_mode() AND p_tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  -- Weighted sum capped to 100.
  -- NOTE: This is a risk-weight signal for matching and vetting, not "achievement".
  SELECT COALESCE(SUM(
    CASE
      WHEN status != 'verified' THEN 0
      ELSE
        CASE verification_method
          WHEN 'issuer_lookup' THEN 25
          WHEN 'third_party_provider' THEN 22
          WHEN 'document_review' THEN 18
          WHEN 'in_person' THEN 18
          WHEN 'training_auto_issue' THEN 14
          WHEN 'self_attested' THEN 6
          ELSE 0
        END
    END
  ),0)
  INTO v_score
  FROM cc_certifications
  WHERE tenant_id = p_tenant_id
    AND individual_id = p_individual_id
    AND (expires_at IS NULL OR expires_at >= now()::date)
    AND status IN ('verified');

  IF v_score > 100 THEN v_score := 100; END IF;
  RETURN v_score::INT;
END;
$$;

-- ============================================================================
-- ACCEPTANCE QUERIES
-- ============================================================================

-- Q1: Verify tables exist
SELECT 'cc_certifications' as table_name, COUNT(*) as column_count
FROM information_schema.columns WHERE table_name = 'cc_certifications'
UNION ALL
SELECT 'cc_training_modules', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_training_modules'
UNION ALL
SELECT 'cc_training_completions', COUNT(*)
FROM information_schema.columns WHERE table_name = 'cc_training_completions';

-- Q2: Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('cc_certifications', 'cc_training_modules', 'cc_training_completions');

-- Q3: Verify NO public read policy exists on certifications
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'cc_certifications'
ORDER BY policyname;

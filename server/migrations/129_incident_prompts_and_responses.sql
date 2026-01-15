-- ============================================================
-- MIGRATION 129: INCIDENT PROMPTS & RESPONSES
-- Phase A2.1 - Headcount + Location + Acknowledgment
-- "5,000 users in 15 minutes" onboarding vector + incident telemetry
-- ============================================================

-- ============================================================
-- 1) ENUMS (IDEMPOTENT)
-- ============================================================

-- 1.1 Prompt type enum
DO $$ BEGIN
  CREATE TYPE cc_incident_prompt_type_enum AS ENUM (
    'headcount',
    'location',
    'status',
    'acknowledge',
    'freeform',
    'medical_dependency',
    'resource_need'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 Target type enum
DO $$ BEGIN
  CREATE TYPE cc_incident_prompt_target_enum AS ENUM (
    'individual',
    'party',
    'tenant',
    'circle',
    'portal',
    'public_link'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.3 Response channel enum
DO $$ BEGIN
  CREATE TYPE cc_incident_response_channel_enum AS ENUM (
    'web',
    'sms',
    'in_app',
    'operator_entry',
    'api'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.4 Response state enum
DO $$ BEGIN
  CREATE TYPE cc_incident_response_state_enum AS ENUM (
    'submitted',
    'updated',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) TABLE: cc_incident_prompts
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_incident_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant context
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id uuid REFERENCES cc_communities(id) ON DELETE SET NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  circle_id uuid REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  incident_id uuid NOT NULL REFERENCES cc_incidents(id) ON DELETE CASCADE,
  
  -- Prompt definition
  prompt_type cc_incident_prompt_type_enum NOT NULL,
  title text,
  prompt_text text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  
  -- Response schema (for UI + validation)
  options jsonb,
  validation jsonb,
  
  -- Targeting
  target_type cc_incident_prompt_target_enum NOT NULL DEFAULT 'public_link',
  target_individual_id uuid REFERENCES cc_individuals(id) ON DELETE SET NULL,
  target_party_id uuid,  -- cc_parties may not exist yet
  target_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  target_circle_id uuid REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  target_portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  
  -- Public link token (for onboarding)
  public_token_hash text,
  public_token_alg text NOT NULL DEFAULT 'sha256',
  public_token_expires_at timestamptz,
  max_responses integer,
  
  -- Audit
  created_by_individual_id uuid REFERENCES cc_individuals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- ============================================================
-- 2.1 CHECK CONSTRAINTS for target validation
-- ============================================================

ALTER TABLE cc_incident_prompts DROP CONSTRAINT IF EXISTS cc_incident_prompts_target_check;
ALTER TABLE cc_incident_prompts ADD CONSTRAINT cc_incident_prompts_target_check CHECK (
  CASE target_type
    WHEN 'individual' THEN target_individual_id IS NOT NULL
    WHEN 'party' THEN target_party_id IS NOT NULL
    WHEN 'tenant' THEN target_tenant_id IS NOT NULL
    WHEN 'circle' THEN target_circle_id IS NOT NULL
    WHEN 'portal' THEN target_portal_id IS NOT NULL
    WHEN 'public_link' THEN public_token_hash IS NOT NULL
    ELSE false
  END
);

-- ============================================================
-- 2.2 INDEXES for cc_incident_prompts
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cc_incident_prompts_incident 
  ON cc_incident_prompts(incident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_incident_prompts_tenant 
  ON cc_incident_prompts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_incident_prompts_token 
  ON cc_incident_prompts(public_token_hash) 
  WHERE public_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_incident_prompts_expires 
  ON cc_incident_prompts(expires_at) 
  WHERE expires_at IS NOT NULL;

-- ============================================================
-- 2.3 TRIGGER for updated_at
-- ============================================================

DROP TRIGGER IF EXISTS cc_incident_prompts_updated_at ON cc_incident_prompts;
CREATE TRIGGER cc_incident_prompts_updated_at
  BEFORE UPDATE ON cc_incident_prompts
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================
-- 2.4 RLS for cc_incident_prompts
-- ============================================================

ALTER TABLE cc_incident_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_incident_prompts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_incident_prompts_service ON cc_incident_prompts;
CREATE POLICY cc_incident_prompts_service ON cc_incident_prompts
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_incident_prompts_tenant_select ON cc_incident_prompts;
CREATE POLICY cc_incident_prompts_tenant_select ON cc_incident_prompts
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    OR circle_id = current_circle_id()
  );

DROP POLICY IF EXISTS cc_incident_prompts_tenant_insert ON cc_incident_prompts;
CREATE POLICY cc_incident_prompts_tenant_insert ON cc_incident_prompts
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
    AND current_individual_id() IS NOT NULL
  );

DROP POLICY IF EXISTS cc_incident_prompts_tenant_update ON cc_incident_prompts;
CREATE POLICY cc_incident_prompts_tenant_update ON cc_incident_prompts
  FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND current_individual_id() IS NOT NULL
  );

-- ============================================================
-- 3) TABLE: cc_incident_responses
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_incident_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant context (copied from prompt)
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id uuid REFERENCES cc_communities(id) ON DELETE SET NULL,
  portal_id uuid REFERENCES cc_portals(id) ON DELETE SET NULL,
  circle_id uuid REFERENCES cc_coordination_circles(id) ON DELETE SET NULL,
  incident_id uuid NOT NULL REFERENCES cc_incidents(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES cc_incident_prompts(id) ON DELETE CASCADE,
  
  -- Responder identity (nullable for guests)
  respondent_individual_id uuid REFERENCES cc_individuals(id) ON DELETE SET NULL,
  respondent_party_id uuid,  -- cc_parties may not exist yet
  respondent_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  -- Public responder fingerprinting
  public_responder_key text,
  public_token_hash text,
  
  -- Response payload
  response_data jsonb NOT NULL,
  response_channel cc_incident_response_channel_enum NOT NULL DEFAULT 'web',
  state cc_incident_response_state_enum NOT NULL DEFAULT 'submitted',
  
  -- Location fields (first-class)
  location_label text,
  location_lat numeric,
  location_lng numeric,
  location_accuracy_m numeric,
  
  -- Headcount helpers
  adults_count integer,
  children_count integer,
  pets_count integer,
  
  -- Timing
  occurred_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Attribution (for operator_entry)
  entered_by_individual_id uuid REFERENCES cc_individuals(id) ON DELETE SET NULL,
  
  -- Anti-spam
  ip_hash text,
  user_agent_hash text
);

-- ============================================================
-- 3.1 UNIQUE CONSTRAINTS for deduplication
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_incident_responses_individual_dedupe
  ON cc_incident_responses(prompt_id, respondent_individual_id)
  WHERE respondent_individual_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_incident_responses_public_dedupe
  ON cc_incident_responses(prompt_id, public_responder_key)
  WHERE public_responder_key IS NOT NULL;

-- ============================================================
-- 3.2 INDEXES for cc_incident_responses
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cc_incident_responses_incident
  ON cc_incident_responses(incident_id, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_incident_responses_prompt
  ON cc_incident_responses(prompt_id, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_incident_responses_tenant
  ON cc_incident_responses(tenant_id, responded_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_incident_responses_location
  ON cc_incident_responses(location_label)
  WHERE location_label IS NOT NULL;

-- ============================================================
-- 3.3 TRIGGER for updated_at
-- ============================================================

DROP TRIGGER IF EXISTS cc_incident_responses_updated_at ON cc_incident_responses;
CREATE TRIGGER cc_incident_responses_updated_at
  BEFORE UPDATE ON cc_incident_responses
  FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();

-- ============================================================
-- 3.4 RLS for cc_incident_responses
-- ============================================================

ALTER TABLE cc_incident_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_incident_responses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_incident_responses_service ON cc_incident_responses;
CREATE POLICY cc_incident_responses_service ON cc_incident_responses
  FOR ALL USING (is_service_mode());

DROP POLICY IF EXISTS cc_incident_responses_tenant_select ON cc_incident_responses;
CREATE POLICY cc_incident_responses_tenant_select ON cc_incident_responses
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    OR circle_id = current_circle_id()
  );

-- Insert allowed for authenticated users in tenant context
DROP POLICY IF EXISTS cc_incident_responses_tenant_insert ON cc_incident_responses;
CREATE POLICY cc_incident_responses_tenant_insert ON cc_incident_responses
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
  );

-- Update for moderation (voiding)
DROP POLICY IF EXISTS cc_incident_responses_tenant_update ON cc_incident_responses;
CREATE POLICY cc_incident_responses_tenant_update ON cc_incident_responses
  FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND current_individual_id() IS NOT NULL
  );

-- ============================================================
-- 4) SECURITY DEFINER FUNCTION: submit_incident_response_public
-- ============================================================

CREATE OR REPLACE FUNCTION submit_incident_response_public(
  p_prompt_token text,
  p_response_data jsonb,
  p_location_label text DEFAULT NULL,
  p_location_lat numeric DEFAULT NULL,
  p_location_lng numeric DEFAULT NULL,
  p_location_accuracy_m numeric DEFAULT NULL,
  p_adults_count integer DEFAULT NULL,
  p_children_count integer DEFAULT NULL,
  p_pets_count integer DEFAULT NULL,
  p_public_responder_key text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL,
  p_ip_hash text DEFAULT NULL,
  p_user_agent_hash text DEFAULT NULL
)
RETURNS TABLE (
  response_id uuid,
  incident_id uuid,
  prompt_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token_hash text;
  v_prompt RECORD;
  v_response_id uuid;
  v_response_count integer;
BEGIN
  -- Hash the provided token
  v_token_hash := encode(sha256(p_prompt_token::bytea), 'hex');
  
  -- Find the active prompt
  SELECT 
    p.id,
    p.tenant_id,
    p.community_id,
    p.portal_id,
    p.circle_id,
    p.incident_id,
    p.max_responses,
    p.expires_at,
    p.public_token_expires_at,
    p.is_active
  INTO v_prompt
  FROM cc_incident_prompts p
  WHERE p.public_token_hash = v_token_hash
    AND p.is_active = true
  LIMIT 1;
  
  -- Validate prompt exists
  IF v_prompt IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive prompt token';
  END IF;
  
  -- Check expiration
  IF v_prompt.expires_at IS NOT NULL AND v_prompt.expires_at < now() THEN
    RAISE EXCEPTION 'Prompt has expired';
  END IF;
  
  IF v_prompt.public_token_expires_at IS NOT NULL AND v_prompt.public_token_expires_at < now() THEN
    RAISE EXCEPTION 'Token has expired';
  END IF;
  
  -- Check max responses
  IF v_prompt.max_responses IS NOT NULL THEN
    SELECT COUNT(*) INTO v_response_count
    FROM cc_incident_responses r
    WHERE r.prompt_id = v_prompt.id;
    
    IF v_response_count >= v_prompt.max_responses THEN
      RAISE EXCEPTION 'Maximum responses reached for this prompt';
    END IF;
  END IF;
  
  -- Insert response
  INSERT INTO cc_incident_responses (
    tenant_id,
    community_id,
    portal_id,
    circle_id,
    incident_id,
    prompt_id,
    public_responder_key,
    public_token_hash,
    response_data,
    response_channel,
    state,
    location_label,
    location_lat,
    location_lng,
    location_accuracy_m,
    adults_count,
    children_count,
    pets_count,
    occurred_at,
    responded_at,
    ip_hash,
    user_agent_hash
  ) VALUES (
    v_prompt.tenant_id,
    v_prompt.community_id,
    v_prompt.portal_id,
    v_prompt.circle_id,
    v_prompt.incident_id,
    v_prompt.id,
    p_public_responder_key,
    v_token_hash,
    p_response_data,
    'web',
    'submitted',
    p_location_label,
    p_location_lat,
    p_location_lng,
    p_location_accuracy_m,
    p_adults_count,
    p_children_count,
    p_pets_count,
    COALESCE(p_occurred_at, now()),
    now(),
    p_ip_hash,
    p_user_agent_hash
  )
  RETURNING id INTO v_response_id;
  
  RETURN QUERY SELECT v_response_id, v_prompt.incident_id, v_prompt.id;
END;
$$;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION submit_incident_response_public TO PUBLIC;

-- ============================================================
-- 5) GRANTS (same pattern as other migrations)
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON cc_incident_prompts TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON cc_incident_responses TO PUBLIC;

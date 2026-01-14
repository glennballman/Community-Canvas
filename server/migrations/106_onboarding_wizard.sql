-- ============================================================
-- MIGRATION 106: ONBOARDING WIZARD
-- Part of Prompt 27 - Guided First-Run Experience
-- ============================================================

BEGIN;

-- ============================================================
-- 1) ONBOARDING FLOW TYPES
-- Different flows for different entry points
-- ============================================================

DO $$ BEGIN
  CREATE TYPE onboarding_flow_type AS ENUM (
    'generic',              -- No specific context
    'contractor',           -- Contractor signup
    'property_owner',       -- Property/inventory owner
    'pic',                  -- Property Infrastructure Coordinator
    'worker',               -- Worker/crew member
    'coordinator',          -- Chamber desk / coordinator
    'job_claim',            -- Claimed a job posting
    'property_claim',       -- Claimed a property listing
    'invitation_accept',    -- Accepted an invitation
    'portal_join'           -- Joined via portal
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'skipped',
    'abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE step_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped',
    'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) ONBOARDING FLOWS (Templates)
-- Defines what steps each flow contains
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_onboarding_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Flow type
  flow_type onboarding_flow_type NOT NULL,
  actor_type_id uuid REFERENCES cc_actor_types(id),
  
  -- Configuration
  steps jsonb NOT NULL DEFAULT '[]',
  estimated_minutes integer DEFAULT 5,
  
  -- Behavior
  allow_skip boolean DEFAULT true,
  auto_complete_on_first_action boolean DEFAULT true,
  
  -- Status
  is_active boolean DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_onboarding_flows_type ON cc_onboarding_flows(flow_type);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_flows_actor ON cc_onboarding_flows(actor_type_id);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_flows_active ON cc_onboarding_flows(is_active);

-- ============================================================
-- 3) ONBOARDING SESSIONS
-- Tracks a tenant's progress through onboarding
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is onboarding
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  
  -- Which flow
  flow_id uuid REFERENCES cc_onboarding_flows(id),
  flow_type onboarding_flow_type NOT NULL DEFAULT 'generic',
  
  -- Context (how they arrived)
  invitation_id uuid REFERENCES cc_invitations(id),
  claim_link_id uuid REFERENCES cc_claim_links(id),
  portal_id uuid REFERENCES cc_portals(id),
  referrer_tenant_id uuid REFERENCES cc_tenants(id),
  
  -- Entry context
  entry_context jsonb DEFAULT '{}',
  
  -- Progress
  status onboarding_status NOT NULL DEFAULT 'not_started',
  current_step_index integer DEFAULT 0,
  steps_completed integer DEFAULT 0,
  total_steps integer DEFAULT 0,
  
  -- Completion
  completed_at timestamptz,
  skipped_at timestamptz,
  abandoned_at timestamptz,
  
  -- First action tracking
  first_action_type text,
  first_action_at timestamptz,
  first_action_entity_id uuid,
  
  -- Timestamps
  started_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One active session per tenant
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_onboarding_sessions_tenant ON cc_onboarding_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_sessions_status ON cc_onboarding_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_sessions_flow ON cc_onboarding_sessions(flow_id);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_sessions_portal ON cc_onboarding_sessions(portal_id);

-- Enable RLS
ALTER TABLE cc_onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_onboarding_sessions_service_bypass ON cc_onboarding_sessions;
DROP POLICY IF EXISTS cc_onboarding_sessions_tenant_access ON cc_onboarding_sessions;

CREATE POLICY cc_onboarding_sessions_service_bypass ON cc_onboarding_sessions
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY cc_onboarding_sessions_tenant_access ON cc_onboarding_sessions
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================
-- 4) ONBOARDING STEP PROGRESS
-- Tracks completion of individual steps
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_onboarding_step_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cc_onboarding_sessions(id) ON DELETE CASCADE,
  
  -- Step identity
  step_key text NOT NULL,
  step_index integer NOT NULL,
  step_name text,
  
  -- Status
  status step_status NOT NULL DEFAULT 'pending',
  
  -- Completion data
  completed_at timestamptz,
  skipped_at timestamptz,
  completion_data jsonb DEFAULT '{}',
  
  -- Validation
  validation_errors jsonb DEFAULT '[]',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One entry per step per session
  UNIQUE (session_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_cc_onboarding_step_progress_session ON cc_onboarding_step_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_step_progress_status ON cc_onboarding_step_progress(session_id, status);

-- Enable RLS
ALTER TABLE cc_onboarding_step_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_onboarding_step_progress_service_bypass ON cc_onboarding_step_progress;
DROP POLICY IF EXISTS cc_onboarding_step_progress_tenant_access ON cc_onboarding_step_progress;

CREATE POLICY cc_onboarding_step_progress_service_bypass ON cc_onboarding_step_progress
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY cc_onboarding_step_progress_tenant_access ON cc_onboarding_step_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_onboarding_sessions os
      WHERE os.id = cc_onboarding_step_progress.session_id
        AND os.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- 5) ONBOARDING CHECKLISTS
-- Reusable checklist items that can appear across flows
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Categorization
  category text NOT NULL DEFAULT 'setup',
  actor_type_id uuid REFERENCES cc_actor_types(id),
  
  -- Completion criteria
  completion_event text, -- Event that marks this complete
  completion_check_sql text, -- SQL to check if complete
  
  -- UI
  icon text,
  sort_order integer DEFAULT 0,
  
  -- Requirements
  required_for_activation boolean DEFAULT false,
  
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_onboarding_checklist_items_category ON cc_onboarding_checklist_items(category);
CREATE INDEX IF NOT EXISTS idx_cc_onboarding_checklist_items_actor ON cc_onboarding_checklist_items(actor_type_id);

-- ============================================================
-- 6) TENANT CHECKLIST PROGRESS
-- Tracks which checklist items a tenant has completed
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_tenant_checklist_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES cc_onboarding_checklist_items(id) ON DELETE CASCADE,
  
  -- Status
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  
  -- Completion context
  completed_by_user_id uuid,
  completion_entity_id uuid,
  completion_data jsonb DEFAULT '{}',
  
  -- Dismissal (user chose to hide)
  is_dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (tenant_id, checklist_item_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_tenant_checklist_progress_tenant ON cc_tenant_checklist_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_tenant_checklist_progress_completed ON cc_tenant_checklist_progress(tenant_id, is_completed);

-- Enable RLS
ALTER TABLE cc_tenant_checklist_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_tenant_checklist_progress_service_bypass ON cc_tenant_checklist_progress;
DROP POLICY IF EXISTS cc_tenant_checklist_progress_tenant_access ON cc_tenant_checklist_progress;

CREATE POLICY cc_tenant_checklist_progress_service_bypass ON cc_tenant_checklist_progress
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY cc_tenant_checklist_progress_tenant_access ON cc_tenant_checklist_progress
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================
-- 7) HELPER FUNCTION: Start Onboarding Session
-- ============================================================

CREATE OR REPLACE FUNCTION cc_start_onboarding(
  p_tenant_id uuid,
  p_flow_type onboarding_flow_type DEFAULT 'generic',
  p_invitation_id uuid DEFAULT NULL,
  p_claim_link_id uuid DEFAULT NULL,
  p_portal_id uuid DEFAULT NULL,
  p_entry_context jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid;
  v_flow RECORD;
  v_steps jsonb;
  v_step RECORD;
  v_step_index integer := 0;
BEGIN
  -- SECURITY: Prevent tenant spoofing
  IF NOT is_service_mode() AND p_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s onboarding';
  END IF;

  -- Find matching flow template
  SELECT * INTO v_flow
  FROM cc_onboarding_flows
  WHERE flow_type = p_flow_type
    AND is_active = true
  LIMIT 1;
  
  -- Fall back to generic if no specific flow
  IF v_flow IS NULL THEN
    SELECT * INTO v_flow
    FROM cc_onboarding_flows
    WHERE flow_type = 'generic'
      AND is_active = true
    LIMIT 1;
  END IF;
  
  v_steps := COALESCE(v_flow.steps, '[]'::jsonb);
  
  -- Create or update session
  INSERT INTO cc_onboarding_sessions (
    tenant_id,
    flow_id,
    flow_type,
    invitation_id,
    claim_link_id,
    portal_id,
    entry_context,
    status,
    total_steps,
    started_at
  ) VALUES (
    p_tenant_id,
    v_flow.id,
    p_flow_type,
    p_invitation_id,
    p_claim_link_id,
    p_portal_id,
    p_entry_context,
    'in_progress',
    jsonb_array_length(v_steps),
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    flow_type = EXCLUDED.flow_type,
    invitation_id = COALESCE(EXCLUDED.invitation_id, cc_onboarding_sessions.invitation_id),
    claim_link_id = COALESCE(EXCLUDED.claim_link_id, cc_onboarding_sessions.claim_link_id),
    portal_id = COALESCE(EXCLUDED.portal_id, cc_onboarding_sessions.portal_id),
    entry_context = EXCLUDED.entry_context || cc_onboarding_sessions.entry_context,
    status = CASE 
      WHEN cc_onboarding_sessions.status IN ('completed', 'skipped') 
      THEN cc_onboarding_sessions.status 
      ELSE 'in_progress' 
    END,
    total_steps = EXCLUDED.total_steps,
    started_at = COALESCE(cc_onboarding_sessions.started_at, now()),
    updated_at = now()
  RETURNING id INTO v_session_id;
  
  -- Create step progress entries
  FOR v_step IN SELECT * FROM jsonb_array_elements(v_steps) WITH ORDINALITY AS s(step, idx)
  LOOP
    INSERT INTO cc_onboarding_step_progress (
      session_id,
      step_key,
      step_index,
      step_name,
      status
    ) VALUES (
      v_session_id,
      v_step.step->>'key',
      (v_step.idx - 1)::integer,
      v_step.step->>'name',
      'pending'
    )
    ON CONFLICT (session_id, step_key) DO NOTHING;
  END LOOP;
  
  RETURN v_session_id;
END;
$$;

-- ============================================================
-- 8) HELPER FUNCTION: Complete Onboarding Step
-- ============================================================

CREATE OR REPLACE FUNCTION cc_complete_onboarding_step(
  p_tenant_id uuid,
  p_step_key text,
  p_completion_data jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session RECORD;
  v_step RECORD;
  v_next_step_key text;
  v_all_complete boolean;
BEGIN
  -- SECURITY: Prevent tenant spoofing
  IF NOT is_service_mode() AND p_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s onboarding';
  END IF;

  -- Get session
  SELECT * INTO v_session
  FROM cc_onboarding_sessions
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No onboarding session found');
  END IF;
  
  -- Update step
  UPDATE cc_onboarding_step_progress
  SET 
    status = 'completed',
    completed_at = now(),
    completion_data = p_completion_data,
    updated_at = now()
  WHERE session_id = v_session.id
    AND step_key = p_step_key
  RETURNING * INTO v_step;
  
  IF v_step IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Step not found');
  END IF;
  
  -- Update session progress
  UPDATE cc_onboarding_sessions
  SET 
    steps_completed = (
      SELECT COUNT(*) FROM cc_onboarding_step_progress
      WHERE session_id = v_session.id AND status = 'completed'
    ),
    current_step_index = v_step.step_index + 1,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = v_session.id;
  
  -- Check if all steps complete
  SELECT NOT EXISTS (
    SELECT 1 FROM cc_onboarding_step_progress
    WHERE session_id = v_session.id
      AND status NOT IN ('completed', 'skipped')
  ) INTO v_all_complete;
  
  IF v_all_complete THEN
    UPDATE cc_onboarding_sessions
    SET status = 'completed', completed_at = now()
    WHERE id = v_session.id;
  END IF;
  
  -- Get next step
  SELECT step_key INTO v_next_step_key
  FROM cc_onboarding_step_progress
  WHERE session_id = v_session.id
    AND step_index > v_step.step_index
    AND status = 'pending'
  ORDER BY step_index
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'step_completed', p_step_key,
    'next_step', v_next_step_key,
    'all_complete', v_all_complete
  );
END;
$$;

-- ============================================================
-- 9) HELPER FUNCTION: Skip Onboarding
-- ============================================================

CREATE OR REPLACE FUNCTION cc_skip_onboarding(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  -- SECURITY: Prevent tenant spoofing
  IF NOT is_service_mode() AND p_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s onboarding';
  END IF;

  UPDATE cc_onboarding_sessions
  SET 
    status = 'skipped',
    skipped_at = now(),
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND status IN ('not_started', 'in_progress')
  RETURNING id INTO v_session_id;
  
  IF v_session_id IS NOT NULL THEN
    -- Mark all pending steps as skipped
    UPDATE cc_onboarding_step_progress
    SET status = 'skipped', skipped_at = now()
    WHERE session_id = v_session_id
      AND status = 'pending';
  END IF;
  
  RETURN v_session_id IS NOT NULL;
END;
$$;

-- ============================================================
-- 10) HELPER FUNCTION: Get Onboarding Status
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_onboarding_status(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session RECORD;
  v_steps jsonb;
  v_checklist jsonb;
BEGIN
  -- SECURITY: Prevent tenant spoofing (read-only but still sensitive)
  IF NOT is_service_mode() AND p_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: Cannot view another tenant''s onboarding';
  END IF;

  -- Get session
  SELECT * INTO v_session
  FROM cc_onboarding_sessions
  WHERE tenant_id = p_tenant_id;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object(
      'has_session', false,
      'needs_onboarding', true
    );
  END IF;
  
  -- Get step progress
  SELECT jsonb_agg(
    jsonb_build_object(
      'key', step_key,
      'name', step_name,
      'index', step_index,
      'status', status,
      'completed_at', completed_at
    ) ORDER BY step_index
  ) INTO v_steps
  FROM cc_onboarding_step_progress
  WHERE session_id = v_session.id;
  
  -- Get checklist progress
  SELECT jsonb_agg(
    jsonb_build_object(
      'code', ci.code,
      'name', ci.name,
      'category', ci.category,
      'is_completed', COALESCE(tcp.is_completed, false),
      'is_dismissed', COALESCE(tcp.is_dismissed, false)
    ) ORDER BY ci.sort_order
  ) INTO v_checklist
  FROM cc_onboarding_checklist_items ci
  LEFT JOIN cc_tenant_checklist_progress tcp 
    ON tcp.checklist_item_id = ci.id AND tcp.tenant_id = p_tenant_id
  WHERE ci.is_active = true;
  
  RETURN jsonb_build_object(
    'has_session', true,
    'needs_onboarding', v_session.status IN ('not_started', 'in_progress'),
    'session_id', v_session.id,
    'flow_type', v_session.flow_type,
    'status', v_session.status,
    'current_step_index', v_session.current_step_index,
    'steps_completed', v_session.steps_completed,
    'total_steps', v_session.total_steps,
    'progress_percent', CASE 
      WHEN v_session.total_steps > 0 
      THEN ROUND((v_session.steps_completed::numeric / v_session.total_steps) * 100)
      ELSE 100 
    END,
    'steps', COALESCE(v_steps, '[]'),
    'checklist', COALESCE(v_checklist, '[]'),
    'entry_context', v_session.entry_context
  );
END;
$$;

-- ============================================================
-- 11) HELPER FUNCTION: Record First Action
-- ============================================================

CREATE OR REPLACE FUNCTION cc_record_first_action(
  p_tenant_id uuid,
  p_action_type text,
  p_entity_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SECURITY: Prevent tenant spoofing
  IF NOT is_service_mode() AND p_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s onboarding';
  END IF;

  UPDATE cc_onboarding_sessions
  SET 
    first_action_type = COALESCE(first_action_type, p_action_type),
    first_action_at = COALESCE(first_action_at, now()),
    first_action_entity_id = COALESCE(first_action_entity_id, p_entity_id),
    last_activity_at = now(),
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================================
-- 12) SEED ONBOARDING FLOWS
-- ============================================================

-- Generic flow
INSERT INTO cc_onboarding_flows (code, name, flow_type, description, steps)
VALUES (
  'generic',
  'Generic Onboarding',
  'generic',
  'Default onboarding for new accounts',
  '[
    {"key": "welcome", "name": "Welcome", "description": "Introduction to Community Canvas"},
    {"key": "profile", "name": "Complete Profile", "description": "Add your basic information"},
    {"key": "role_select", "name": "Select Your Role", "description": "Choose how you will use the platform"},
    {"key": "first_action", "name": "Take First Action", "description": "Complete your first task"}
  ]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET steps = EXCLUDED.steps, updated_at = now();

-- Contractor flow
INSERT INTO cc_onboarding_flows (code, name, flow_type, actor_type_id, description, steps)
SELECT 
  'contractor',
  'Contractor Onboarding',
  'contractor',
  id,
  'Onboarding for contractors and service providers',
  '[
    {"key": "welcome", "name": "Welcome", "description": "Welcome to Community Canvas for Contractors"},
    {"key": "business_profile", "name": "Business Profile", "description": "Add your company information"},
    {"key": "service_areas", "name": "Service Areas", "description": "Define where you operate"},
    {"key": "capabilities", "name": "Capabilities", "description": "List your services and equipment"},
    {"key": "first_run", "name": "Create First Run", "description": "Post your first service run"}
  ]'::jsonb
FROM cc_actor_types WHERE code = 'CONTRACTOR'
ON CONFLICT (code) DO UPDATE SET steps = EXCLUDED.steps, updated_at = now();

-- Worker flow
INSERT INTO cc_onboarding_flows (code, name, flow_type, actor_type_id, description, steps)
SELECT 
  'worker',
  'Worker Onboarding',
  'worker',
  id,
  'Onboarding for seasonal workers and crew members',
  '[
    {"key": "welcome", "name": "Welcome", "description": "Welcome to Community Canvas"},
    {"key": "profile", "name": "Your Profile", "description": "Tell us about yourself"},
    {"key": "skills", "name": "Skills & Experience", "description": "Add your skills and work history"},
    {"key": "availability", "name": "Availability", "description": "When and where can you work?"},
    {"key": "housing", "name": "Housing Needs", "description": "Do you need accommodation?"},
    {"key": "browse_jobs", "name": "Browse Jobs", "description": "Find opportunities that match your profile"}
  ]'::jsonb
FROM cc_actor_types WHERE code = 'WORKER'
ON CONFLICT (code) DO UPDATE SET steps = EXCLUDED.steps, updated_at = now();

-- Property Owner / Inventory flow
INSERT INTO cc_onboarding_flows (code, name, flow_type, actor_type_id, description, steps)
SELECT 
  'property_owner',
  'Property Owner Onboarding',
  'property_owner',
  id,
  'Onboarding for STR owners and inventory operators',
  '[
    {"key": "welcome", "name": "Welcome", "description": "Welcome to Community Canvas"},
    {"key": "profile", "name": "Owner Profile", "description": "Your contact information"},
    {"key": "first_property", "name": "Add Property", "description": "Add your first property or unit"},
    {"key": "availability", "name": "Set Availability", "description": "Configure your calendar"},
    {"key": "pricing", "name": "Pricing", "description": "Set your rates and policies"}
  ]'::jsonb
FROM cc_actor_types WHERE code = 'INVENTORY'
ON CONFLICT (code) DO UPDATE SET steps = EXCLUDED.steps, updated_at = now();

-- PIC flow
INSERT INTO cc_onboarding_flows (code, name, flow_type, actor_type_id, description, steps)
SELECT 
  'pic',
  'PIC Onboarding',
  'pic',
  id,
  'Onboarding for Property Infrastructure Coordinators',
  '[
    {"key": "welcome", "name": "Welcome", "description": "Welcome to Community Canvas for PICs"},
    {"key": "profile", "name": "Coordinator Profile", "description": "Your business information"},
    {"key": "service_area", "name": "Service Area", "description": "Define your coverage area"},
    {"key": "properties", "name": "Add Properties", "description": "Connect properties you manage"},
    {"key": "team", "name": "Build Team", "description": "Invite workers to your bench"},
    {"key": "first_turnover", "name": "Schedule Turnover", "description": "Schedule your first property turnover"}
  ]'::jsonb
FROM cc_actor_types WHERE code = 'PIC'
ON CONFLICT (code) DO UPDATE SET steps = EXCLUDED.steps, updated_at = now();

-- ============================================================
-- 13) SEED CHECKLIST ITEMS
-- ============================================================

INSERT INTO cc_onboarding_checklist_items (code, name, description, category, completion_event, sort_order, required_for_activation)
VALUES
  ('profile_complete', 'Complete your profile', 'Add your name, contact info, and photo', 'setup', 'profile_updated', 1, true),
  ('role_selected', 'Select your role', 'Choose how you will use Community Canvas', 'setup', 'role_assigned', 2, true),
  ('first_action', 'Take your first action', 'Post a job, apply for work, or list a property', 'activation', 'first_action_recorded', 3, false),
  ('invite_sent', 'Invite someone', 'Grow your network by inviting a colleague', 'growth', 'invitation_sent', 4, false),
  ('calendar_connected', 'Connect your calendar', 'Sync with your external calendar', 'integration', 'calendar_synced', 5, false)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

COMMIT;

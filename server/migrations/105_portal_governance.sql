-- ============================================================
-- MIGRATION 105: PORTAL GOVERNANCE
-- Part of Prompt 26 - Portal Admin & Moderation
-- ============================================================

BEGIN;

-- ============================================================
-- 0) HELPER FUNCTION: current_tenant_id()
-- Canonical way to get tenant context for RLS
-- ============================================================

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.tenant_id', true), '__SERVICE__')::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_service_mode()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true) = '__SERVICE__';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 1) PORTAL ROLE TYPES
-- What roles can someone have on a portal?
-- ============================================================

DO $$ BEGIN
  CREATE TYPE portal_role_type AS ENUM (
    'owner',           -- Full control, can transfer ownership
    'admin',           -- Can manage settings, members, content
    'moderator',       -- Can approve/reject content
    'editor',          -- Can edit portal content (pages, branding)
    'member',          -- Basic portal access
    'guest'            -- Limited read-only access
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'flagged',
    'auto_approved',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_action AS ENUM (
    'approve',
    'reject',
    'flag',
    'unflag',
    'escalate',
    'auto_approve',
    'auto_reject',
    'expire'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) PORTAL MEMBERS
-- Who belongs to which portal, and in what role
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_portal_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  
  -- Member identity (one should be set)
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Role
  role portal_role_type NOT NULL DEFAULT 'member',
  
  -- Permissions (granular overrides)
  can_post_jobs boolean DEFAULT true,
  can_post_listings boolean DEFAULT true,
  can_invite_members boolean DEFAULT false,
  can_moderate boolean DEFAULT false,
  can_edit_settings boolean DEFAULT false,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  
  -- Invitation tracking
  invited_by_member_id uuid REFERENCES cc_portal_members(id),
  invitation_id uuid REFERENCES cc_invitations(id),
  
  -- Metadata
  display_name text,
  bio text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One membership per identity per portal
  CONSTRAINT portal_member_unique_tenant UNIQUE (portal_id, tenant_id),
  CONSTRAINT portal_member_unique_party UNIQUE (portal_id, party_id),
  CONSTRAINT portal_member_unique_individual UNIQUE (portal_id, individual_id),
  
  -- EXACTLY one identity (XOR constraint)
  CONSTRAINT portal_member_exactly_one_identity CHECK (
    (CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN individual_id IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_portal_members_portal ON cc_portal_members(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_portal_members_tenant ON cc_portal_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_portal_members_party ON cc_portal_members(party_id);
CREATE INDEX IF NOT EXISTS idx_cc_portal_members_role ON cc_portal_members(portal_id, role);
CREATE INDEX IF NOT EXISTS idx_cc_portal_members_active ON cc_portal_members(portal_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE cc_portal_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_portal_members_service_bypass ON cc_portal_members;
DROP POLICY IF EXISTS cc_portal_members_admin_manage ON cc_portal_members;
DROP POLICY IF EXISTS cc_portal_members_member_read ON cc_portal_members;

CREATE POLICY cc_portal_members_service_bypass ON cc_portal_members
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Portal admins can manage members
CREATE POLICY cc_portal_members_admin_manage ON cc_portal_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = cc_portal_members.portal_id
        AND pm.tenant_id = current_tenant_id()
        AND pm.role IN ('owner', 'admin')
        AND pm.is_active = true
    )
  );

-- Members can see other members in their portal
CREATE POLICY cc_portal_members_member_read ON cc_portal_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = cc_portal_members.portal_id
        AND pm.tenant_id = current_tenant_id()
        AND pm.is_active = true
    )
  );

-- ============================================================
-- 3) PORTAL SETTINGS
-- Configurable features and branding per portal
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_portal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE UNIQUE,
  
  -- Branding
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#1E40AF',
  custom_css text,
  
  -- Content settings
  auto_approve_jobs boolean DEFAULT false,
  auto_approve_listings boolean DEFAULT false,
  require_verification_for_posting boolean DEFAULT true,
  allow_anonymous_applications boolean DEFAULT true,
  
  -- Moderation settings
  moderation_enabled boolean DEFAULT true,
  silent_rejection boolean DEFAULT true,
  rejection_notification_enabled boolean DEFAULT false,
  auto_expire_days integer DEFAULT 90,
  
  -- Feature flags
  jobs_enabled boolean DEFAULT true,
  listings_enabled boolean DEFAULT true,
  events_enabled boolean DEFAULT false,
  messaging_enabled boolean DEFAULT true,
  reviews_enabled boolean DEFAULT false,
  
  -- Syndication settings
  allow_inbound_syndication boolean DEFAULT true,
  allow_outbound_syndication boolean DEFAULT true,
  syndication_requires_approval boolean DEFAULT true,
  
  -- SEO
  meta_title text,
  meta_description text,
  og_image_url text,
  
  -- Contact
  support_email text,
  support_phone text,
  
  -- Legal
  terms_url text,
  privacy_url text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE cc_portal_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_portal_settings_service_bypass ON cc_portal_settings;
DROP POLICY IF EXISTS cc_portal_settings_public_read ON cc_portal_settings;
DROP POLICY IF EXISTS cc_portal_settings_admin_write ON cc_portal_settings;

CREATE POLICY cc_portal_settings_service_bypass ON cc_portal_settings
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Public can read settings (INTENTIONAL: branding, feature flags, SEO are front-end safe)
-- Sensitive operational data (if any) should go in a separate admin-only table
CREATE POLICY cc_portal_settings_public_read ON cc_portal_settings
  FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY cc_portal_settings_admin_write ON cc_portal_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = cc_portal_settings.portal_id
        AND pm.tenant_id = current_tenant_id()
        AND pm.role IN ('owner', 'admin')
        AND pm.is_active = true
    )
  );

-- ============================================================
-- 4) CONTENT MODERATION QUEUE
-- Universal moderation for jobs, listings, etc.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE moderable_content_type AS ENUM (
    'job',
    'job_posting',
    'listing',
    'event',
    'review',
    'comment',
    'profile',
    'message'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
  
  -- What's being moderated
  content_type moderable_content_type NOT NULL,
  content_id uuid NOT NULL,
  content_snapshot jsonb, -- Snapshot at time of submission
  
  -- Who submitted
  submitted_by_tenant_id uuid REFERENCES cc_tenants(id),
  submitted_by_party_id uuid REFERENCES cc_parties(id),
  submitted_by_individual_id uuid REFERENCES cc_individuals(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  
  -- Status
  status moderation_status NOT NULL DEFAULT 'pending',
  priority integer DEFAULT 0, -- Higher = more urgent
  
  -- Auto-moderation results
  auto_moderation_score numeric,
  auto_moderation_flags jsonb DEFAULT '[]',
  auto_moderation_passed boolean,
  
  -- Manual review
  reviewed_by_member_id uuid REFERENCES cc_portal_members(id),
  reviewed_at timestamptz,
  review_notes text,
  
  -- Rejection details
  rejection_reason text,
  rejection_category text,
  is_silent_rejection boolean DEFAULT true,
  
  -- Expiration
  expires_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Unique content per portal
  UNIQUE (portal_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_moderation_queue_portal ON cc_moderation_queue(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_moderation_queue_status ON cc_moderation_queue(portal_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_moderation_queue_pending ON cc_moderation_queue(portal_id, status, priority DESC) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cc_moderation_queue_content ON cc_moderation_queue(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_cc_moderation_queue_submitter ON cc_moderation_queue(submitted_by_tenant_id);

-- Enable RLS
ALTER TABLE cc_moderation_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_moderation_queue_service_bypass ON cc_moderation_queue;
DROP POLICY IF EXISTS cc_moderation_queue_moderator_access ON cc_moderation_queue;
DROP POLICY IF EXISTS cc_moderation_queue_submitter_read ON cc_moderation_queue;

CREATE POLICY cc_moderation_queue_service_bypass ON cc_moderation_queue
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Moderators can see and manage queue
CREATE POLICY cc_moderation_queue_moderator_access ON cc_moderation_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = cc_moderation_queue.portal_id
        AND pm.tenant_id = current_tenant_id()
        AND (pm.role IN ('owner', 'admin', 'moderator') OR pm.can_moderate = true)
        AND pm.is_active = true
    )
  );

-- Submitter can see their own items
CREATE POLICY cc_moderation_queue_submitter_read ON cc_moderation_queue
  FOR SELECT
  USING (submitted_by_tenant_id = current_tenant_id());

-- ============================================================
-- 5) MODERATION HISTORY
-- Audit trail of all moderation actions
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_moderation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES cc_moderation_queue(id) ON DELETE CASCADE,
  
  -- Action taken
  action moderation_action NOT NULL,
  previous_status moderation_status,
  new_status moderation_status,
  
  -- Who took action
  actor_member_id uuid REFERENCES cc_portal_members(id),
  actor_system boolean DEFAULT false, -- Auto-moderation
  
  -- Details
  reason text,
  notes text,
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_moderation_history_queue ON cc_moderation_history(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_cc_moderation_history_actor ON cc_moderation_history(actor_member_id);
CREATE INDEX IF NOT EXISTS idx_cc_moderation_history_action ON cc_moderation_history(action);

-- Enable RLS
ALTER TABLE cc_moderation_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_moderation_history_service_bypass ON cc_moderation_history;
DROP POLICY IF EXISTS cc_moderation_history_moderator_read ON cc_moderation_history;

CREATE POLICY cc_moderation_history_service_bypass ON cc_moderation_history
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Moderators can see history
CREATE POLICY cc_moderation_history_moderator_read ON cc_moderation_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_moderation_queue mq
      JOIN cc_portal_members pm ON pm.portal_id = mq.portal_id
      WHERE mq.id = cc_moderation_history.queue_item_id
        AND pm.tenant_id = current_tenant_id()
        AND (pm.role IN ('owner', 'admin', 'moderator') OR pm.can_moderate = true)
        AND pm.is_active = true
    )
  );

-- ============================================================
-- 6) HELPER FUNCTION: Submit Content for Moderation
-- SECURITY DEFINER with safe search_path
-- ============================================================

CREATE OR REPLACE FUNCTION cc_submit_for_moderation(
  p_portal_id uuid,
  p_content_type moderable_content_type,
  p_content_id uuid,
  p_content_snapshot jsonb,
  p_submitter_tenant_id uuid DEFAULT NULL,
  p_submitter_party_id uuid DEFAULT NULL,
  p_submitter_individual_id uuid DEFAULT NULL,
  p_priority integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_queue_id uuid;
  v_auto_approve boolean;
  v_settings RECORD;
  v_caller_tenant_id uuid;
BEGIN
  -- Get caller's tenant_id for permission check
  v_caller_tenant_id := current_tenant_id();
  
  -- If not service mode, verify caller has permission to post on this portal
  IF NOT is_service_mode() AND v_caller_tenant_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = p_portal_id
        AND pm.tenant_id = v_caller_tenant_id
        AND pm.is_active = true
        AND (pm.can_post_jobs = true OR pm.can_post_listings = true)
    ) THEN
      RAISE EXCEPTION 'Caller does not have permission to submit content to this portal';
    END IF;
    -- Use caller's tenant_id if not explicitly provided
    p_submitter_tenant_id := COALESCE(p_submitter_tenant_id, v_caller_tenant_id);
  END IF;

  -- Get portal settings
  SELECT * INTO v_settings FROM cc_portal_settings WHERE portal_id = p_portal_id;
  
  -- Check if auto-approve is enabled for this content type
  v_auto_approve := CASE p_content_type
    WHEN 'job' THEN COALESCE(v_settings.auto_approve_jobs, false)
    WHEN 'job_posting' THEN COALESCE(v_settings.auto_approve_jobs, false)
    WHEN 'listing' THEN COALESCE(v_settings.auto_approve_listings, false)
    ELSE false
  END;
  
  -- Insert into queue
  INSERT INTO cc_moderation_queue (
    portal_id,
    content_type,
    content_id,
    content_snapshot,
    submitted_by_tenant_id,
    submitted_by_party_id,
    submitted_by_individual_id,
    status,
    priority,
    expires_at
  ) VALUES (
    p_portal_id,
    p_content_type,
    p_content_id,
    p_content_snapshot,
    p_submitter_tenant_id,
    p_submitter_party_id,
    p_submitter_individual_id,
    CASE WHEN v_auto_approve THEN 'auto_approved' ELSE 'pending' END,
    p_priority,
    now() + (COALESCE(v_settings.auto_expire_days, 90) || ' days')::interval
  )
  ON CONFLICT (portal_id, content_type, content_id) 
  DO UPDATE SET
    content_snapshot = EXCLUDED.content_snapshot,
    status = CASE WHEN v_auto_approve THEN 'auto_approved' ELSE 'pending' END,
    priority = EXCLUDED.priority,
    updated_at = now()
  RETURNING id INTO v_queue_id;
  
  -- Log auto-approval if applicable
  IF v_auto_approve THEN
    INSERT INTO cc_moderation_history (
      queue_item_id, action, new_status, actor_system, reason
    ) VALUES (
      v_queue_id, 'auto_approve', 'auto_approved', true, 'Auto-approved per portal settings'
    );
  END IF;
  
  RETURN v_queue_id;
END;
$$;

-- ============================================================
-- 7) HELPER FUNCTION: Moderate Content
-- SECURITY DEFINER with safe search_path and permission check
-- ============================================================

CREATE OR REPLACE FUNCTION cc_moderate_content(
  p_queue_item_id uuid,
  p_action moderation_action,
  p_actor_member_id uuid,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_silent boolean DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_queue_item RECORD;
  v_new_status moderation_status;
  v_settings RECORD;
  v_caller_tenant_id uuid;
BEGIN
  -- Get caller's tenant_id for permission check
  v_caller_tenant_id := current_tenant_id();
  
  -- Get queue item
  SELECT * INTO v_queue_item FROM cc_moderation_queue WHERE id = p_queue_item_id FOR UPDATE;
  
  IF v_queue_item IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
  END IF;
  
  -- Verify caller has moderation permission (unless service mode)
  IF NOT is_service_mode() AND v_caller_tenant_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = v_queue_item.portal_id
        AND pm.tenant_id = v_caller_tenant_id
        AND (pm.role IN ('owner', 'admin', 'moderator') OR pm.can_moderate = true)
        AND pm.is_active = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Caller does not have moderation permission');
    END IF;
  END IF;
  
  -- Get portal settings for silent rejection default
  SELECT * INTO v_settings FROM cc_portal_settings WHERE portal_id = v_queue_item.portal_id;
  
  -- Determine new status based on action
  v_new_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'flag' THEN 'flagged'
    WHEN 'unflag' THEN 'pending'
    WHEN 'expire' THEN 'expired'
    ELSE v_queue_item.status
  END;
  
  -- Update queue item
  UPDATE cc_moderation_queue
  SET 
    status = v_new_status,
    reviewed_by_member_id = p_actor_member_id,
    reviewed_at = now(),
    review_notes = COALESCE(p_notes, review_notes),
    rejection_reason = CASE WHEN p_action = 'reject' THEN p_reason ELSE rejection_reason END,
    is_silent_rejection = CASE 
      WHEN p_action = 'reject' THEN COALESCE(p_silent, v_settings.silent_rejection, true)
      ELSE is_silent_rejection 
    END,
    updated_at = now()
  WHERE id = p_queue_item_id;
  
  -- Log action
  INSERT INTO cc_moderation_history (
    queue_item_id, action, previous_status, new_status,
    actor_member_id, reason, notes
  ) VALUES (
    p_queue_item_id, p_action, v_queue_item.status, v_new_status,
    p_actor_member_id, p_reason, p_notes
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'queue_item_id', p_queue_item_id,
    'previous_status', v_queue_item.status,
    'new_status', v_new_status
  );
END;
$$;

-- ============================================================
-- 8) HELPER FUNCTION: Check Portal Permission
-- SECURITY DEFINER with safe search_path
-- ============================================================

CREATE OR REPLACE FUNCTION cc_has_portal_permission(
  p_portal_id uuid,
  p_tenant_id uuid,
  p_permission text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member RECORD;
BEGIN
  SELECT * INTO v_member
  FROM cc_portal_members
  WHERE portal_id = p_portal_id
    AND tenant_id = p_tenant_id
    AND is_active = true;
  
  IF v_member IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check role-based permissions
  RETURN CASE p_permission
    WHEN 'owner' THEN v_member.role = 'owner'
    WHEN 'admin' THEN v_member.role IN ('owner', 'admin')
    WHEN 'moderate' THEN v_member.role IN ('owner', 'admin', 'moderator') OR v_member.can_moderate
    WHEN 'edit' THEN v_member.role IN ('owner', 'admin', 'editor') OR v_member.can_edit_settings
    WHEN 'post_jobs' THEN v_member.can_post_jobs
    WHEN 'post_listings' THEN v_member.can_post_listings
    WHEN 'invite' THEN v_member.role IN ('owner', 'admin') OR v_member.can_invite_members
    WHEN 'member' THEN true
    ELSE false
  END;
END;
$$;

-- ============================================================
-- 9) HELPER FUNCTION: Add Portal Member
-- SECURITY DEFINER with safe search_path and permission verification
-- Prevents "add myself as admin" attacks
-- ============================================================

CREATE OR REPLACE FUNCTION cc_add_portal_member(
  p_portal_id uuid,
  p_tenant_id uuid DEFAULT NULL,
  p_party_id uuid DEFAULT NULL,
  p_individual_id uuid DEFAULT NULL,
  p_role portal_role_type DEFAULT 'member',
  p_invited_by_member_id uuid DEFAULT NULL,
  p_invitation_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_caller_tenant_id uuid;
BEGIN
  -- Get caller's tenant_id for permission check
  v_caller_tenant_id := current_tenant_id();
  
  -- If not service mode, verify caller has permission to invite
  IF NOT is_service_mode() AND v_caller_tenant_id IS NOT NULL THEN
    -- Only owners/admins can add members
    IF NOT EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = p_portal_id
        AND pm.tenant_id = v_caller_tenant_id
        AND pm.role IN ('owner', 'admin')
        AND pm.is_active = true
    ) THEN
      RAISE EXCEPTION 'Caller does not have permission to add members to this portal';
    END IF;
    
    -- Non-owners cannot add owners
    IF p_role = 'owner' AND NOT EXISTS (
      SELECT 1 FROM cc_portal_members pm
      WHERE pm.portal_id = p_portal_id
        AND pm.tenant_id = v_caller_tenant_id
        AND pm.role = 'owner'
        AND pm.is_active = true
    ) THEN
      RAISE EXCEPTION 'Only portal owners can add other owners';
    END IF;
  END IF;

  INSERT INTO cc_portal_members (
    portal_id, tenant_id, party_id, individual_id,
    role, invited_by_member_id, invitation_id,
    can_post_jobs, can_post_listings, can_invite_members, can_moderate, can_edit_settings
  ) VALUES (
    p_portal_id, p_tenant_id, p_party_id, p_individual_id,
    p_role, p_invited_by_member_id, p_invitation_id,
    -- Set default permissions based on role
    true, -- can_post_jobs
    true, -- can_post_listings
    p_role IN ('owner', 'admin'), -- can_invite_members
    p_role IN ('owner', 'admin', 'moderator'), -- can_moderate
    p_role IN ('owner', 'admin') -- can_edit_settings
  )
  ON CONFLICT (portal_id, tenant_id) WHERE tenant_id IS NOT NULL
  DO UPDATE SET
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_member_id;
  
  RETURN v_member_id;
END;
$$;

-- ============================================================
-- 10) SEED DEFAULT SETTINGS FOR EXISTING PORTALS
-- ============================================================

INSERT INTO cc_portal_settings (portal_id)
SELECT id FROM cc_portals
WHERE NOT EXISTS (
  SELECT 1 FROM cc_portal_settings WHERE portal_id = cc_portals.id
)
ON CONFLICT DO NOTHING;

COMMIT;

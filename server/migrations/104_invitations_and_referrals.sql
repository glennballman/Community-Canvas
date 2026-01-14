-- ============================================================
-- MIGRATION 104: INVITATIONS & REFERRALS
-- Part of Prompt 25 - Viral Growth Engine
-- ============================================================

BEGIN;

-- ============================================================
-- 1) INVITATION CONTEXT TYPES
-- What can someone be invited to?
-- Idempotent enum creation
-- ============================================================

DO $$ BEGIN
  CREATE TYPE invitation_context_type AS ENUM (
    'job',
    'service_run',
    'property',
    'crew',
    'conversation',
    'portal',
    'community',
    'tenant',
    'standby_pool'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM (
    'pending',
    'sent',
    'viewed',
    'claimed',
    'expired',
    'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invitee_role AS ENUM (
    'employer',
    'worker',
    'property_owner',
    'pic',
    'coordinator',
    'crew_member',
    'guest'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) INVITATIONS (Unified Primitive)
-- Every invitation follows the same pattern
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who sent it
  inviter_tenant_id uuid REFERENCES cc_tenants(id),
  inviter_party_id uuid REFERENCES cc_parties(id),
  inviter_individual_id uuid REFERENCES cc_individuals(id),
  
  -- Context (what are they being invited to)
  context_type invitation_context_type NOT NULL,
  context_id uuid NOT NULL,
  context_name text,
  
  -- Invitee details
  invitee_role invitee_role NOT NULL,
  invitee_email text,
  invitee_phone text,
  invitee_name text,
  
  -- Claim mechanism
  claim_token text UNIQUE NOT NULL,
  claim_token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  
  -- Status
  status invitation_status NOT NULL DEFAULT 'pending',
  
  -- Delivery tracking
  sent_at timestamptz,
  sent_via text,
  viewed_at timestamptz,
  
  -- Claim tracking
  claimed_at timestamptz,
  claimed_by_tenant_id uuid REFERENCES cc_tenants(id),
  claimed_by_party_id uuid REFERENCES cc_parties(id),
  claimed_by_individual_id uuid REFERENCES cc_individuals(id),
  
  -- What was granted on claim
  granted_access_type text,
  granted_actor_type_id uuid REFERENCES cc_actor_types(id),
  
  -- Revocation
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  revocation_reason text,
  is_silent_revocation boolean DEFAULT true,
  
  -- Metadata
  message text,
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Must have email OR phone
  CONSTRAINT invitation_has_contact CHECK (
    invitee_email IS NOT NULL OR invitee_phone IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_invitations_token ON cc_invitations(claim_token);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_context ON cc_invitations(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_inviter_tenant ON cc_invitations(inviter_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_invitee_email ON cc_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_status ON cc_invitations(status);
CREATE INDEX IF NOT EXISTS idx_cc_invitations_pending ON cc_invitations(status, claim_token_expires_at) 
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE cc_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cc_invitations_service_bypass ON cc_invitations
    FOR ALL
    USING (current_setting('app.tenant_id', true) = '__SERVICE__')
    WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY cc_invitations_inviter_read ON cc_invitations
    FOR SELECT
    USING (inviter_tenant_id::text = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY cc_invitations_inviter_write ON cc_invitations
    FOR ALL
    USING (inviter_tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (inviter_tenant_id::text = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3) REFERRALS (Attribution Tracking)
-- Track who brought whom for rewards/analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The invitation that triggered this
  invitation_id uuid REFERENCES cc_invitations(id),
  
  -- Referrer
  referrer_tenant_id uuid REFERENCES cc_tenants(id),
  referrer_party_id uuid REFERENCES cc_parties(id),
  referrer_individual_id uuid REFERENCES cc_individuals(id),
  
  -- Referred (new user/tenant)
  referred_tenant_id uuid REFERENCES cc_tenants(id),
  referred_party_id uuid REFERENCES cc_parties(id),
  referred_individual_id uuid REFERENCES cc_individuals(id),
  
  -- Context
  referral_type text NOT NULL,
  context_type invitation_context_type,
  context_id uuid,
  
  -- Value tracking (for rewards)
  attributed_value numeric DEFAULT 0,
  reward_eligible boolean DEFAULT false,
  reward_paid boolean DEFAULT false,
  reward_paid_at timestamptz,
  reward_amount numeric,
  
  -- Timestamps
  referred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_referrals_referrer ON cc_referrals(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_referrals_referred ON cc_referrals(referred_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_referrals_invitation ON cc_referrals(invitation_id);
CREATE INDEX IF NOT EXISTS idx_cc_referrals_type ON cc_referrals(referral_type);

-- Enable RLS
ALTER TABLE cc_referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cc_referrals_service_bypass ON cc_referrals
    FOR ALL
    USING (current_setting('app.tenant_id', true) = '__SERVICE__')
    WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY cc_referrals_tenant_read ON cc_referrals
    FOR SELECT
    USING (
      referrer_tenant_id::text = current_setting('app.tenant_id', true)
      OR referred_tenant_id::text = current_setting('app.tenant_id', true)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4) CLAIM LINKS (Direct Asset Claims)
-- For claiming jobs, properties, etc. without invitation
-- ============================================================

DO $$ BEGIN
  CREATE TYPE claim_link_type AS ENUM (
    'job',
    'property',
    'business',
    'service_listing',
    'equipment'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE claim_link_status AS ENUM (
    'active',
    'claimed',
    'expired',
    'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_claim_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What can be claimed
  claim_type claim_link_type NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text,
  
  -- Claim token
  token text UNIQUE NOT NULL,
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  
  -- Who can claim (optional restrictions)
  allowed_email_domain text,
  allowed_email text,
  
  -- Verification requirements
  verification_method text DEFAULT 'email',
  requires_document boolean DEFAULT false,
  document_type text,
  
  -- Status
  status claim_link_status NOT NULL DEFAULT 'active',
  
  -- Claim result
  claimed_at timestamptz,
  claimed_by_tenant_id uuid REFERENCES cc_tenants(id),
  claimed_by_party_id uuid REFERENCES cc_parties(id),
  claimed_by_individual_id uuid REFERENCES cc_individuals(id),
  verification_completed_at timestamptz,
  
  -- What happens on claim
  auto_create_tenant boolean DEFAULT false,
  auto_create_operator boolean DEFAULT false,
  auto_assign_role text,
  
  -- Creator
  created_by_tenant_id uuid REFERENCES cc_tenants(id),
  created_by_user_id uuid,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_claim_links_token ON cc_claim_links(token);
CREATE INDEX IF NOT EXISTS idx_cc_claim_links_entity ON cc_claim_links(claim_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cc_claim_links_status ON cc_claim_links(status);
CREATE INDEX IF NOT EXISTS idx_cc_claim_links_active ON cc_claim_links(status, token_expires_at) 
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE cc_claim_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY cc_claim_links_service_bypass ON cc_claim_links
    FOR ALL
    USING (current_setting('app.tenant_id', true) = '__SERVICE__')
    WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NO public read policy - use cc_get_claim_link_public() function instead
-- This prevents token enumeration attacks

DO $$ BEGIN
  CREATE POLICY cc_claim_links_creator_write ON cc_claim_links
    FOR ALL
    USING (created_by_tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (created_by_tenant_id::text = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5) HELPER FUNCTION: Generate Claim Token
-- Creates a secure, URL-safe token (base64url, no padding)
-- ============================================================

CREATE OR REPLACE FUNCTION cc_generate_claim_token()
RETURNS text AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := encode(gen_random_bytes(32), 'base64');
  v_raw := replace(v_raw, '+', '-');
  v_raw := replace(v_raw, '/', '_');
  v_raw := replace(v_raw, '=', '');
  RETURN substring(v_raw from 1 for 43);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6) HELPER FUNCTION: Create Invitation
-- SECURITY DEFINER for service-mode access
-- ============================================================

CREATE OR REPLACE FUNCTION cc_create_invitation(
  p_inviter_tenant_id uuid,
  p_context_type invitation_context_type,
  p_context_id uuid,
  p_context_name text,
  p_invitee_role invitee_role,
  p_invitee_email text DEFAULT NULL,
  p_invitee_phone text DEFAULT NULL,
  p_invitee_name text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_expires_days integer DEFAULT 30,
  p_inviter_party_id uuid DEFAULT NULL,
  p_inviter_individual_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_invitation_id uuid;
  v_token text;
BEGIN
  v_token := cc_generate_claim_token();
  
  INSERT INTO cc_invitations (
    inviter_tenant_id,
    inviter_party_id,
    inviter_individual_id,
    context_type,
    context_id,
    context_name,
    invitee_role,
    invitee_email,
    invitee_phone,
    invitee_name,
    claim_token,
    claim_token_expires_at,
    message,
    status
  ) VALUES (
    p_inviter_tenant_id,
    p_inviter_party_id,
    p_inviter_individual_id,
    p_context_type,
    p_context_id,
    p_context_name,
    p_invitee_role,
    p_invitee_email,
    p_invitee_phone,
    p_invitee_name,
    v_token,
    now() + (p_expires_days || ' days')::interval,
    p_message,
    'pending'
  ) RETURNING id INTO v_invitation_id;
  
  RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7) HELPER FUNCTION: Claim Invitation
-- SECURITY DEFINER: Allows public claimers to claim without RLS blocking
-- ============================================================

CREATE OR REPLACE FUNCTION cc_claim_invitation(
  p_token text,
  p_claimer_tenant_id uuid DEFAULT NULL,
  p_claimer_party_id uuid DEFAULT NULL,
  p_claimer_individual_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_invitation RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_invitation
  FROM cc_invitations
  WHERE claim_token = p_token
    AND status = 'pending'
    AND claim_token_expires_at > now()
  FOR UPDATE;
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation'
    );
  END IF;
  
  UPDATE cc_invitations
  SET 
    status = 'claimed',
    claimed_at = now(),
    claimed_by_tenant_id = p_claimer_tenant_id,
    claimed_by_party_id = p_claimer_party_id,
    claimed_by_individual_id = p_claimer_individual_id,
    updated_at = now()
  WHERE id = v_invitation.id;
  
  INSERT INTO cc_referrals (
    invitation_id,
    referrer_tenant_id,
    referrer_party_id,
    referrer_individual_id,
    referred_tenant_id,
    referred_party_id,
    referred_individual_id,
    referral_type,
    context_type,
    context_id
  ) VALUES (
    v_invitation.id,
    v_invitation.inviter_tenant_id,
    v_invitation.inviter_party_id,
    v_invitation.inviter_individual_id,
    p_claimer_tenant_id,
    p_claimer_party_id,
    p_claimer_individual_id,
    'invitation_claim',
    v_invitation.context_type,
    v_invitation.context_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'context_type', v_invitation.context_type,
    'context_id', v_invitation.context_id,
    'invitee_role', v_invitation.invitee_role,
    'granted_access_type', v_invitation.granted_access_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8) HELPER FUNCTION: Revoke Invitation (Silent)
-- ============================================================

CREATE OR REPLACE FUNCTION cc_revoke_invitation(
  p_invitation_id uuid,
  p_revoked_by_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_silent boolean DEFAULT true
) RETURNS boolean AS $$
BEGIN
  UPDATE cc_invitations
  SET 
    status = 'revoked',
    revoked_at = now(),
    revoked_by_user_id = p_revoked_by_user_id,
    revocation_reason = p_reason,
    is_silent_revocation = p_silent,
    updated_at = now()
  WHERE id = p_invitation_id
    AND status IN ('pending', 'sent', 'viewed', 'claimed');
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9) HELPER FUNCTION: Get Invitation Public Info
-- SECURITY DEFINER: Safe public access to invitation details
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_invitation_public(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT 
    id, context_type, context_id, context_name,
    invitee_role, invitee_name, message,
    status, claim_token_expires_at
  INTO v_invitation
  FROM cc_invitations
  WHERE claim_token = p_token
    AND status = 'pending'
    AND claim_token_expires_at > now();
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  UPDATE cc_invitations
  SET viewed_at = COALESCE(viewed_at, now()), updated_at = now()
  WHERE claim_token = p_token;
  
  RETURN jsonb_build_object(
    'found', true,
    'id', v_invitation.id,
    'context_type', v_invitation.context_type,
    'context_id', v_invitation.context_id,
    'context_name', v_invitation.context_name,
    'invitee_role', v_invitation.invitee_role,
    'invitee_name', v_invitation.invitee_name,
    'message', v_invitation.message,
    'expires_at', v_invitation.claim_token_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10) HELPER FUNCTION: Get Claim Link Public Info
-- SECURITY DEFINER: Safe public access to claim link details
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_claim_link_public(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_link RECORD;
BEGIN
  SELECT 
    id, claim_type, entity_id, entity_name,
    verification_method, requires_document, document_type,
    status, token_expires_at, allowed_email_domain
  INTO v_link
  FROM cc_claim_links
  WHERE token = p_token
    AND status = 'active'
    AND token_expires_at > now();
  
  IF v_link IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  RETURN jsonb_build_object(
    'found', true,
    'id', v_link.id,
    'claim_type', v_link.claim_type,
    'entity_id', v_link.entity_id,
    'entity_name', v_link.entity_name,
    'verification_method', v_link.verification_method,
    'requires_document', v_link.requires_document,
    'document_type', v_link.document_type,
    'expires_at', v_link.token_expires_at,
    'allowed_email_domain', v_link.allowed_email_domain
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11) HELPER FUNCTION: Create Job Claim Link
-- Convenience function for the common job claim case
-- ============================================================

CREATE OR REPLACE FUNCTION cc_create_job_claim_link(
  p_job_id uuid,
  p_allowed_email_domain text DEFAULT NULL,
  p_expires_days integer DEFAULT 90
) RETURNS text AS $$
DECLARE
  v_token text;
  v_job_title text;
BEGIN
  SELECT title INTO v_job_title FROM cc_jobs WHERE id = p_job_id;
  
  IF v_job_title IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  v_token := cc_generate_claim_token();
  
  INSERT INTO cc_claim_links (
    claim_type,
    entity_id,
    entity_name,
    token,
    token_expires_at,
    allowed_email_domain,
    auto_create_operator,
    auto_assign_role
  ) VALUES (
    'job',
    p_job_id,
    v_job_title,
    v_token,
    now() + (p_expires_days || ' days')::interval,
    p_allowed_email_domain,
    true,
    'INVENTORY'
  );
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

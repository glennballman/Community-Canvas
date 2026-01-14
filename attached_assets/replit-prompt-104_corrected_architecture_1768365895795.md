# PROMPT 25: Invitations & Referrals

## ChatGPT Fixes Applied (January 14, 2026)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | RLS blocks public claiming | All claim functions are SECURITY DEFINER, API runs in service mode |
| 2 | Enum creation not idempotent | Wrapped in DO $$ EXCEPTION blocks |
| 3 | Token generator not safe | Proper base64url: replace +/-, strip = |
| 4 | Public read policy leaks tokens | Removed, added cc_get_claim_link_public() function |
| 5 | Inviter only tenant-based | Added inviter_party_id/inviter_individual_id params |
| 6 | granted_role_id wrong reference | Changed to granted_actor_type_id (FK to cc_actor_types) |

## Context
- Previous migrations: 099-103 (Prompt 24 complete)
- This is migration 104
- Builds on Jobs cold-start wedge from Prompt 24

## Objective
Create the invitation and referral system that enables viral growth without sales. Invitations are the primary growth engine - every valuable action should generate natural invitation opportunities.

## Design Principles
1. **Invitations are the product** - Not an afterthought
2. **Work at N=1** - Single user gets value before network density
3. **Silent onboarding** - Claim link → calendar access → no forced profile
4. **Silent revocation** - Access disappears without notification
5. **Context-first** - Invitations are always tied to something valuable (job, service run, property)

---

## Migration: server/migrations/104_invitations_and_referrals.sql

```sql
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
  context_name text, -- Human-readable for emails/UI
  
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
  sent_via text, -- email, sms, link_only
  viewed_at timestamptz,
  
  -- Claim tracking
  claimed_at timestamptz,
  claimed_by_tenant_id uuid REFERENCES cc_tenants(id),
  claimed_by_party_id uuid REFERENCES cc_parties(id),
  claimed_by_individual_id uuid REFERENCES cc_individuals(id),
  
  -- What was granted on claim
  granted_access_type text, -- calendar, messaging, full_account
  granted_actor_type_id uuid REFERENCES cc_actor_types(id),
  
  -- Revocation
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  revocation_reason text,
  is_silent_revocation boolean DEFAULT true,
  
  -- Metadata
  message text, -- Personal message from inviter
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Must have email OR phone
  CONSTRAINT invitation_has_contact CHECK (
    invitee_email IS NOT NULL OR invitee_phone IS NOT NULL
  )
);

CREATE INDEX idx_cc_invitations_token ON cc_invitations(claim_token);
CREATE INDEX idx_cc_invitations_context ON cc_invitations(context_type, context_id);
CREATE INDEX idx_cc_invitations_inviter_tenant ON cc_invitations(inviter_tenant_id);
CREATE INDEX idx_cc_invitations_invitee_email ON cc_invitations(invitee_email);
CREATE INDEX idx_cc_invitations_status ON cc_invitations(status);
CREATE INDEX idx_cc_invitations_pending ON cc_invitations(status, claim_token_expires_at) 
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE cc_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_invitations_service_bypass ON cc_invitations
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Inviter can see their invitations
CREATE POLICY cc_invitations_inviter_read ON cc_invitations
  FOR SELECT
  USING (inviter_tenant_id::text = current_setting('app.tenant_id', true));

-- Inviter can manage their invitations
CREATE POLICY cc_invitations_inviter_write ON cc_invitations
  FOR ALL
  USING (inviter_tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (inviter_tenant_id::text = current_setting('app.tenant_id', true));

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
  referral_type text NOT NULL, -- signup, job_claim, property_claim, etc.
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

CREATE INDEX idx_cc_referrals_referrer ON cc_referrals(referrer_tenant_id);
CREATE INDEX idx_cc_referrals_referred ON cc_referrals(referred_tenant_id);
CREATE INDEX idx_cc_referrals_invitation ON cc_referrals(invitation_id);
CREATE INDEX idx_cc_referrals_type ON cc_referrals(referral_type);

-- Enable RLS
ALTER TABLE cc_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_referrals_service_bypass ON cc_referrals
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

CREATE POLICY cc_referrals_tenant_read ON cc_referrals
  FOR SELECT
  USING (
    referrer_tenant_id::text = current_setting('app.tenant_id', true)
    OR referred_tenant_id::text = current_setting('app.tenant_id', true)
  );

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
  entity_name text, -- Human-readable
  
  -- Claim token
  token text UNIQUE NOT NULL,
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  
  -- Who can claim (optional restrictions)
  allowed_email_domain text, -- e.g., '@hfrn.ca' for HFN jobs
  allowed_email text, -- Specific email only
  
  -- Verification requirements
  verification_method text DEFAULT 'email', -- email, sms, document, admin
  requires_document boolean DEFAULT false,
  document_type text, -- business_license, id, employment_letter
  
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
  auto_assign_role text, -- actor type code
  
  -- Creator
  created_by_tenant_id uuid REFERENCES cc_tenants(id),
  created_by_user_id uuid,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_claim_links_token ON cc_claim_links(token);
CREATE INDEX idx_cc_claim_links_entity ON cc_claim_links(claim_type, entity_id);
CREATE INDEX idx_cc_claim_links_status ON cc_claim_links(status);
CREATE INDEX idx_cc_claim_links_active ON cc_claim_links(status, token_expires_at) 
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE cc_claim_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_claim_links_service_bypass ON cc_claim_links
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- NO public read policy - use cc_get_claim_link_public() function instead
-- This prevents token enumeration attacks

-- Creator can manage their claim links
CREATE POLICY cc_claim_links_creator_write ON cc_claim_links
  FOR ALL
  USING (created_by_tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (created_by_tenant_id::text = current_setting('app.tenant_id', true));

-- ============================================================
-- 5) HELPER FUNCTION: Generate Claim Token
-- Creates a secure, URL-safe token (base64url, no padding)
-- ============================================================

CREATE OR REPLACE FUNCTION cc_generate_claim_token()
RETURNS text AS $$
DECLARE
  v_raw text;
BEGIN
  -- Generate 32 bytes of randomness, encode as base64
  v_raw := encode(gen_random_bytes(32), 'base64');
  
  -- Convert to base64url: replace + with -, / with _, strip = padding
  v_raw := replace(v_raw, '+', '-');
  v_raw := replace(v_raw, '/', '_');
  v_raw := replace(v_raw, '=', '');
  
  -- Return first 43 characters (256 bits = 43 base64url chars)
  RETURN substring(v_raw from 1 for 43);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6) HELPER FUNCTION: Create Invitation
-- Standard way to create invitations
-- Supports tenant, party, or individual as inviter
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
  -- Generate token
  v_token := cc_generate_claim_token();
  
  -- Create invitation
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
-- Process an invitation claim
-- SECURITY DEFINER: Allows public claimers to claim without RLS blocking
-- API should call this in service mode for public claim endpoint
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
  -- Find and lock the invitation
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
  
  -- Update invitation
  UPDATE cc_invitations
  SET 
    status = 'claimed',
    claimed_at = now(),
    claimed_by_tenant_id = p_claimer_tenant_id,
    claimed_by_party_id = p_claimer_party_id,
    claimed_by_individual_id = p_claimer_individual_id,
    updated_at = now()
  WHERE id = v_invitation.id;
  
  -- Create referral record
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
-- Returns only safe columns, no token enumeration possible
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
  
  -- Mark as viewed
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
-- Prevents token enumeration - only returns info for valid token
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
  -- Get job title
  SELECT title INTO v_job_title FROM cc_jobs WHERE id = p_job_id;
  
  IF v_job_title IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  -- Generate token
  v_token := cc_generate_claim_token();
  
  -- Create claim link
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
```

---

## Drizzle Schema: Add to shared/schema.ts

```typescript
// ============================================================
// INVITATIONS (Bundle 104)
// ============================================================

export const invitationContextTypeEnum = pgEnum("invitation_context_type", [
  "job", "service_run", "property", "crew", "conversation", 
  "portal", "community", "tenant", "standby_pool"
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending", "sent", "viewed", "claimed", "expired", "revoked"
]);

export const inviteeRoleEnum = pgEnum("invitee_role", [
  "employer", "worker", "property_owner", "pic", "coordinator", "crew_member", "guest"
]);

export const ccInvitations = pgTable("cc_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Inviter
  inviterTenantId: uuid("inviter_tenant_id").references(() => ccTenants.id),
  inviterPartyId: uuid("inviter_party_id").references(() => ccParties.id),
  inviterIndividualId: uuid("inviter_individual_id").references(() => ccIndividuals.id),
  
  // Context
  contextType: invitationContextTypeEnum("context_type").notNull(),
  contextId: uuid("context_id").notNull(),
  contextName: text("context_name"),
  
  // Invitee
  inviteeRole: inviteeRoleEnum("invitee_role").notNull(),
  inviteeEmail: text("invitee_email"),
  inviteePhone: text("invitee_phone"),
  inviteeName: text("invitee_name"),
  
  // Claim token
  claimToken: text("claim_token").notNull().unique(),
  claimTokenExpiresAt: timestamp("claim_token_expires_at", { withTimezone: true }).notNull(),
  
  // Status
  status: invitationStatusEnum("status").notNull().default("pending"),
  
  // Delivery
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentVia: text("sent_via"),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  
  // Claim result
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedByTenantId: uuid("claimed_by_tenant_id").references(() => ccTenants.id),
  claimedByPartyId: uuid("claimed_by_party_id").references(() => ccParties.id),
  claimedByIndividualId: uuid("claimed_by_individual_id").references(() => ccIndividuals.id),
  
  // Granted access
  grantedAccessType: text("granted_access_type"),
  grantedActorTypeId: uuid("granted_actor_type_id").references(() => ccActorTypes.id),
  
  // Revocation
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: uuid("revoked_by_user_id"),
  revocationReason: text("revocation_reason"),
  isSilentRevocation: boolean("is_silent_revocation").default(true),
  
  // Metadata
  message: text("message"),
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_cc_invitations_token").on(table.claimToken),
  contextIdx: index("idx_cc_invitations_context").on(table.contextType, table.contextId),
  inviterIdx: index("idx_cc_invitations_inviter_tenant").on(table.inviterTenantId),
  statusIdx: index("idx_cc_invitations_status").on(table.status),
}));

export const insertInvitationSchema = createInsertSchema(ccInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  claimToken: true, // Generated by function
});

export type Invitation = typeof ccInvitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

// ============================================================
// REFERRALS (Bundle 104)
// ============================================================

export const ccReferrals = pgTable("cc_referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  invitationId: uuid("invitation_id").references(() => ccInvitations.id),
  
  // Referrer
  referrerTenantId: uuid("referrer_tenant_id").references(() => ccTenants.id),
  referrerPartyId: uuid("referrer_party_id").references(() => ccParties.id),
  referrerIndividualId: uuid("referrer_individual_id").references(() => ccIndividuals.id),
  
  // Referred
  referredTenantId: uuid("referred_tenant_id").references(() => ccTenants.id),
  referredPartyId: uuid("referred_party_id").references(() => ccParties.id),
  referredIndividualId: uuid("referred_individual_id").references(() => ccIndividuals.id),
  
  // Context
  referralType: text("referral_type").notNull(),
  contextType: invitationContextTypeEnum("context_type"),
  contextId: uuid("context_id"),
  
  // Value tracking
  attributedValue: numeric("attributed_value").default("0"),
  rewardEligible: boolean("reward_eligible").default(false),
  rewardPaid: boolean("reward_paid").default(false),
  rewardPaidAt: timestamp("reward_paid_at", { withTimezone: true }),
  rewardAmount: numeric("reward_amount"),
  
  referredAt: timestamp("referred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  referrerIdx: index("idx_cc_referrals_referrer").on(table.referrerTenantId),
  referredIdx: index("idx_cc_referrals_referred").on(table.referredTenantId),
  invitationIdx: index("idx_cc_referrals_invitation").on(table.invitationId),
}));

export type Referral = typeof ccReferrals.$inferSelect;

// ============================================================
// CLAIM LINKS (Bundle 104)
// ============================================================

export const claimLinkTypeEnum = pgEnum("claim_link_type", [
  "job", "property", "business", "service_listing", "equipment"
]);

export const claimLinkStatusEnum = pgEnum("claim_link_status", [
  "active", "claimed", "expired", "revoked"
]);

export const ccClaimLinks = pgTable("cc_claim_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  claimType: claimLinkTypeEnum("claim_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  entityName: text("entity_name"),
  
  token: text("token").notNull().unique(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  
  // Restrictions
  allowedEmailDomain: text("allowed_email_domain"),
  allowedEmail: text("allowed_email"),
  
  // Verification
  verificationMethod: text("verification_method").default("email"),
  requiresDocument: boolean("requires_document").default(false),
  documentType: text("document_type"),
  
  // Status
  status: claimLinkStatusEnum("status").notNull().default("active"),
  
  // Claim result
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedByTenantId: uuid("claimed_by_tenant_id").references(() => ccTenants.id),
  claimedByPartyId: uuid("claimed_by_party_id").references(() => ccParties.id),
  claimedByIndividualId: uuid("claimed_by_individual_id").references(() => ccIndividuals.id),
  verificationCompletedAt: timestamp("verification_completed_at", { withTimezone: true }),
  
  // Auto-actions on claim
  autoCreateTenant: boolean("auto_create_tenant").default(false),
  autoCreateOperator: boolean("auto_create_operator").default(false),
  autoAssignRole: text("auto_assign_role"),
  
  // Creator
  createdByTenantId: uuid("created_by_tenant_id").references(() => ccTenants.id),
  createdByUserId: uuid("created_by_user_id"),
  
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index("idx_cc_claim_links_token").on(table.token),
  entityIdx: index("idx_cc_claim_links_entity").on(table.claimType, table.entityId),
  statusIdx: index("idx_cc_claim_links_status").on(table.status),
}));

export type ClaimLink = typeof ccClaimLinks.$inferSelect;
```

---

## API Routes: server/routes/invitations.ts

```typescript
import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// Create invitation (authenticated)
router.post("/", async (req, res) => {
  const { 
    contextType, contextId, contextName,
    inviteeRole, inviteeEmail, inviteePhone, inviteeName,
    message, expiresDays,
    inviterPartyId, inviterIndividualId
  } = req.body;
  
  if (!req.tenantId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    // Run in service mode since function is SECURITY DEFINER
    await db.execute(sql`SET app.tenant_id = '__SERVICE__'`);
    
    const result = await db.execute(sql`
      SELECT cc_create_invitation(
        ${req.tenantId}::uuid,
        ${contextType}::invitation_context_type,
        ${contextId}::uuid,
        ${contextName},
        ${inviteeRole}::invitee_role,
        ${inviteeEmail},
        ${inviteePhone},
        ${inviteeName},
        ${message},
        ${expiresDays || 30},
        ${inviterPartyId}::uuid,
        ${inviterIndividualId}::uuid
      ) as invitation_id
    `);
    
    // Get the created invitation with token
    const invitation = await db.execute(sql`
      SELECT id, claim_token, context_type, context_id, invitee_role
      FROM cc_invitations
      WHERE id = ${result.rows[0].invitation_id}
    `);
    
    res.json({
      success: true,
      invitation: invitation.rows[0],
      claimUrl: `/claim/${invitation.rows[0].claim_token}`
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// Claim invitation (PUBLIC - uses SECURITY DEFINER function)
router.post("/claim/:token", async (req, res) => {
  const { token } = req.params;
  const { tenantId, partyId, individualId } = req.body;
  
  try {
    // Run in service mode - function handles RLS bypass
    await db.execute(sql`SET app.tenant_id = '__SERVICE__'`);
    
    const result = await db.execute(sql`
      SELECT cc_claim_invitation(
        ${token},
        ${tenantId}::uuid,
        ${partyId}::uuid,
        ${individualId}::uuid
      ) as result
    `);
    
    const claimResult = result.rows[0].result;
    
    if (!claimResult.success) {
      return res.status(400).json(claimResult);
    }
    
    res.json(claimResult);
  } catch (error) {
    res.status(500).json({ error: "Failed to claim invitation" });
  }
});

// Get invitation by token (PUBLIC - uses SECURITY DEFINER function)
router.get("/claim/:token", async (req, res) => {
  const { token } = req.params;
  
  try {
    // Run in service mode
    await db.execute(sql`SET app.tenant_id = '__SERVICE__'`);
    
    const result = await db.execute(sql`
      SELECT cc_get_invitation_public(${token}) as info
    `);
    
    const info = result.rows[0].info;
    
    if (!info.found) {
      return res.status(404).json({ error: "Invitation not found or expired" });
    }
    
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: "Failed to get invitation" });
  }
});

// Get claim link info (PUBLIC - uses SECURITY DEFINER function)
router.get("/claim-link/:token", async (req, res) => {
  const { token } = req.params;
  
  try {
    await db.execute(sql`SET app.tenant_id = '__SERVICE__'`);
    
    const result = await db.execute(sql`
      SELECT cc_get_claim_link_public(${token}) as info
    `);
    
    const info = result.rows[0].info;
    
    if (!info.found) {
      return res.status(404).json({ error: "Claim link not found or expired" });
    }
    
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: "Failed to get claim link" });
  }
});

// Revoke invitation (authenticated)
router.post("/:id/revoke", async (req, res) => {
  const { id } = req.params;
  const { reason, silent } = req.body;
  
  if (!req.tenantId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  await db.execute(sql`SET app.tenant_id = '__SERVICE__'`);
  
  const result = await db.execute(sql`
    SELECT cc_revoke_invitation(
      ${id}::uuid,
      ${req.userId}::uuid,
      ${reason},
      ${silent !== false}
    ) as success
  `);
  
  res.json({ success: result.rows[0].success });
});

// List my invitations (authenticated)
router.get("/", async (req, res) => {
  if (!req.tenantId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Use tenant context for RLS
  await db.execute(sql`SET app.tenant_id = ${req.tenantId}`);
  
  const invitations = await db.execute(sql`
    SELECT 
      id, context_type, context_id, context_name,
      invitee_role, invitee_email, invitee_name,
      status, sent_at, viewed_at, claimed_at,
      created_at
    FROM cc_invitations
    WHERE inviter_tenant_id = ${req.tenantId}::uuid
    ORDER BY created_at DESC
    LIMIT 100
  `);
  
  res.json(invitations.rows);
});

export default router;
```

---

## Acceptance Criteria

1. [ ] Migration 104 runs without errors
2. [ ] cc_invitations table created with all columns and contact constraint
3. [ ] cc_referrals table created for attribution tracking
4. [ ] cc_claim_links table created for direct asset claims
5. [ ] All enums created idempotently (invitation_context_type, invitation_status, invitee_role, claim_link_type, claim_link_status)
6. [ ] Helper functions created (all SECURITY DEFINER where needed):
   - cc_generate_claim_token
   - cc_create_invitation (SECURITY DEFINER)
   - cc_claim_invitation (SECURITY DEFINER)
   - cc_revoke_invitation (SECURITY DEFINER)
   - cc_get_invitation_public (SECURITY DEFINER)
   - cc_get_claim_link_public (SECURITY DEFINER)
   - cc_create_job_claim_link (SECURITY DEFINER)
7. [ ] RLS enabled on all 3 tables
8. [ ] NO public read policy on cc_claim_links (prevents token enumeration)
9. [ ] Inviter can manage their own invitations
10. [ ] Silent revocation works (no notification flag)
11. [ ] cc_invitations.granted_actor_type_id references cc_actor_types (NOT cc_tenant_actor_roles)
12. [ ] Drizzle schema updated and synced

---

## Test Queries

```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('cc_invitations', 'cc_referrals', 'cc_claim_links');

-- Verify enums created
SELECT typname FROM pg_type 
WHERE typname IN (
  'invitation_context_type', 'invitation_status', 'invitee_role',
  'claim_link_type', 'claim_link_status'
);

-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'cc_generate_claim_token', 'cc_create_invitation', 
    'cc_claim_invitation', 'cc_revoke_invitation',
    'cc_get_invitation_public', 'cc_get_claim_link_public',
    'cc_create_job_claim_link'
  );

-- Verify SECURITY DEFINER on key functions
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'cc_create_invitation', 'cc_claim_invitation', 
    'cc_revoke_invitation', 'cc_get_invitation_public',
    'cc_get_claim_link_public', 'cc_create_job_claim_link'
  );
-- security_type should be 'DEFINER' for all

-- Verify NO public read policy on cc_claim_links
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'cc_claim_links'
  AND policyname LIKE '%public%';
-- Should return 0 rows

-- Verify granted_actor_type_id column exists (not granted_role_id)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cc_invitations' 
  AND column_name IN ('granted_actor_type_id', 'granted_role_id');
-- Should only return 'granted_actor_type_id'

-- Test token generation
SELECT cc_generate_claim_token();
-- Should return a 43-character base64url string with no +, /, or = characters

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('cc_invitations', 'cc_referrals', 'cc_claim_links');
```

---

## Cold-Start Integration

With this invitation system, the cold-start flows work:

### Flow 1: Job → Worker
```
1. AI creates job (tenant_id = NULL, verification_state = 'draft')
2. System creates claim link for employer
3. Worker applies to job
4. Employer clicks claim link → verifies → claims job
5. Referral created: system → employer
```

### Flow 2: Contractor → Property Owner
```
1. Contractor creates service run
2. Contractor invites property owner (context_type = 'service_run')
3. Property owner claims invitation → gets calendar access
4. Referral created: contractor → property owner
```

### Flow 3: PIC → Workers
```
1. PIC creates standby pool
2. PIC invites workers (context_type = 'standby_pool')
3. Workers claim → join bench
4. When activated, value event fires
```

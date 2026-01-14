-- ============================================================
-- MIGRATION 099: MESSAGES RLS & CONVERSATION PARTICIPANTS
-- Part of Prompt 24A - Foundation
-- ============================================================

BEGIN;

-- ============================================================
-- 1) CONVERSATION PARTICIPANTS
-- Tracks who can see/participate in a conversation
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES cc_conversations(id) ON DELETE CASCADE,
  
  -- Who is participating (EXACTLY ONE should be set - XOR constraint below)
  party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Role context (what role are they acting as in this conversation)
  actor_role text,
  
  -- Permissions
  can_send boolean NOT NULL DEFAULT true,
  can_see_history boolean NOT NULL DEFAULT true,
  
  -- Status
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- EXACTLY one identity must be set (XOR constraint)
  CONSTRAINT participant_exactly_one_identity CHECK (
    (party_id IS NOT NULL AND individual_id IS NULL) OR
    (party_id IS NULL AND individual_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_conv ON cc_conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_party ON cc_conversation_participants(party_id);
CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_individual ON cc_conversation_participants(individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_active ON cc_conversation_participants(conversation_id, is_active);

-- ============================================================
-- 2) ADD sender_participant_id TO MESSAGES
-- Links message to participant role context
-- ============================================================

ALTER TABLE cc_messages 
ADD COLUMN IF NOT EXISTS sender_participant_id uuid REFERENCES cc_conversation_participants(id);

CREATE INDEX IF NOT EXISTS idx_cc_messages_sender_participant ON cc_messages(sender_participant_id);

-- ============================================================
-- 3) ENABLE RLS ON CONVERSATIONS
-- Uses existing contractor_party_id/owner_party_id columns
-- ============================================================

ALTER TABLE cc_conversations ENABLE ROW LEVEL SECURITY;

-- Service bypass policy (for API operations)
CREATE POLICY cc_conversations_service_bypass ON cc_conversations
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Tenant-based visibility via existing party columns
CREATE POLICY cc_conversations_tenant_read ON cc_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_conversations.contractor_party_id
        AND p.tenant_id::text = current_setting('app.tenant_id', true)
    )
    OR
    EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_conversations.owner_party_id
        AND p.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- ============================================================
-- 4) ENABLE RLS ON MESSAGES
-- Uses conversation's party columns (via join)
-- ============================================================

ALTER TABLE cc_messages ENABLE ROW LEVEL SECURITY;

-- Service bypass policy
CREATE POLICY cc_messages_service_bypass ON cc_messages
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Tenant-based visibility via conversation's party columns
CREATE POLICY cc_messages_tenant_read ON cc_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_conversations c
      JOIN cc_parties p ON p.id = c.contractor_party_id OR p.id = c.owner_party_id
      WHERE c.id = cc_messages.conversation_id
        AND p.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- ============================================================
-- 5) ENABLE RLS ON CONVERSATION PARTICIPANTS
-- Access via conversation's party columns (consistent with messages)
-- ============================================================

ALTER TABLE cc_conversation_participants ENABLE ROW LEVEL SECURITY;

-- Service bypass
CREATE POLICY cc_conversation_participants_service_bypass ON cc_conversation_participants
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Tenant read via conversation's party columns (consistent with other tables)
CREATE POLICY cc_conversation_participants_tenant_read ON cc_conversation_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_conversations c
      JOIN cc_parties p ON p.id = c.contractor_party_id OR p.id = c.owner_party_id
      WHERE c.id = cc_conversation_participants.conversation_id
        AND p.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

-- ============================================================
-- 6) GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_conversation_participants TO cc_app;

COMMIT;

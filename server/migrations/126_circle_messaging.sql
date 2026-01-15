-- ============================================================
-- MIGRATION 126: CIRCLE-AWARE MESSAGING
-- Phase A1 - Extend conversation participants for circle recipients
-- ============================================================

BEGIN;

-- ============================================================
-- 1) PARTICIPANT TYPE ENUM
-- Defines what kind of entity is participating in a conversation
-- ============================================================

DO $$ BEGIN
  CREATE TYPE cc_conversation_participant_type AS ENUM (
    'individual',
    'tenant',
    'circle',
    'portal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) EXTEND cc_conversation_participants
-- Add participant_type and circle_id columns
-- ============================================================

-- Add participant_type column (default 'individual' for backward compatibility)
ALTER TABLE cc_conversation_participants 
ADD COLUMN IF NOT EXISTS participant_type cc_conversation_participant_type NOT NULL DEFAULT 'individual';

-- Add circle_id column for circle participants
ALTER TABLE cc_conversation_participants 
ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES cc_coordination_circles(id) ON DELETE CASCADE;

-- Add tenant_id column for tenant participants (reuse existing if any)
ALTER TABLE cc_conversation_participants 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE;

-- Add portal_id column for portal participants
ALTER TABLE cc_conversation_participants 
ADD COLUMN IF NOT EXISTS portal_id uuid REFERENCES cc_portals(id) ON DELETE CASCADE;

-- Index for circle lookups
CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_circle 
  ON cc_conversation_participants(circle_id) WHERE circle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_type 
  ON cc_conversation_participants(participant_type);

-- ============================================================
-- 3) CONSTRAINTS
-- Ensure correct ID is set based on participant_type
-- ============================================================

-- Drop the old XOR constraint if it exists
ALTER TABLE cc_conversation_participants 
DROP CONSTRAINT IF EXISTS participant_exactly_one_identity;

-- New constraint: exactly one identity based on participant_type
ALTER TABLE cc_conversation_participants 
ADD CONSTRAINT participant_identity_by_type CHECK (
  CASE participant_type
    WHEN 'individual' THEN (individual_id IS NOT NULL AND circle_id IS NULL AND tenant_id IS NULL AND portal_id IS NULL)
    WHEN 'circle' THEN (circle_id IS NOT NULL AND individual_id IS NULL AND tenant_id IS NULL AND portal_id IS NULL)
    WHEN 'tenant' THEN (tenant_id IS NOT NULL AND individual_id IS NULL AND circle_id IS NULL AND portal_id IS NULL)
    WHEN 'portal' THEN (portal_id IS NOT NULL AND individual_id IS NULL AND circle_id IS NULL AND tenant_id IS NULL)
    ELSE FALSE
  END
  -- Allow party_id for legacy participants (backward compat)
  OR party_id IS NOT NULL
);

-- ============================================================
-- 4) CIRCLE-AWARE RLS POLICY
-- Allow circle members to view conversations where their circle participates
-- ============================================================

-- Add circle-based read policy for conversations
DROP POLICY IF EXISTS cc_conversations_circle_read ON cc_conversations;
CREATE POLICY cc_conversations_circle_read ON cc_conversations
  FOR SELECT
  USING (
    current_circle_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM cc_conversation_participants cp
      WHERE cp.conversation_id = cc_conversations.id
        AND cp.participant_type = 'circle'
        AND cp.circle_id = current_circle_id()
        AND cp.is_active = true
    )
  );

-- Add circle-based read policy for messages
DROP POLICY IF EXISTS cc_messages_circle_read ON cc_messages;
CREATE POLICY cc_messages_circle_read ON cc_messages
  FOR SELECT
  USING (
    current_circle_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM cc_conversations c
      JOIN cc_conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.id = cc_messages.conversation_id
        AND cp.participant_type = 'circle'
        AND cp.circle_id = current_circle_id()
        AND cp.is_active = true
    )
  );

-- Add circle-based read policy for conversation participants
DROP POLICY IF EXISTS cc_conversation_participants_circle_read ON cc_conversation_participants;
CREATE POLICY cc_conversation_participants_circle_read ON cc_conversation_participants
  FOR SELECT
  USING (
    current_circle_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM cc_conversation_participants cp2
      WHERE cp2.conversation_id = cc_conversation_participants.conversation_id
        AND cp2.participant_type = 'circle'
        AND cp2.circle_id = current_circle_id()
        AND cp2.is_active = true
    )
  );

-- ============================================================
-- 5) MESSAGE ATTRIBUTION COLUMNS
-- Ensure messages can track circle/portal context
-- ============================================================

-- Add circle_id to messages for attribution
ALTER TABLE cc_messages 
ADD COLUMN IF NOT EXISTS sender_circle_id uuid REFERENCES cc_coordination_circles(id);

ALTER TABLE cc_messages 
ADD COLUMN IF NOT EXISTS sender_portal_id uuid REFERENCES cc_portals(id);

CREATE INDEX IF NOT EXISTS idx_cc_messages_sender_circle 
  ON cc_messages(sender_circle_id) WHERE sender_circle_id IS NOT NULL;

-- ============================================================
-- 6) NOTIFICATION DELIVERIES FOR CIRCLE FAN-OUT
-- Track which individuals received a notification via circle membership
-- ============================================================

-- Add circle attribution to notification deliveries if table exists
DO $$ BEGIN
  ALTER TABLE cc_notification_deliveries 
  ADD COLUMN IF NOT EXISTS via_circle_id uuid REFERENCES cc_coordination_circles(id);
  
  CREATE INDEX IF NOT EXISTS idx_cc_notification_deliveries_via_circle 
    ON cc_notification_deliveries(via_circle_id) WHERE via_circle_id IS NOT NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 6b) NOTIFICATION IDEMPOTENCY CONSTRAINT
-- Prevents duplicate notifications for same context/recipient combo
-- ============================================================

-- Add unique constraint for idempotent notification creation
CREATE UNIQUE INDEX IF NOT EXISTS cc_notifications_context_recipient_unique
  ON cc_notifications(context_type, context_id, recipient_individual_id)
  WHERE context_type IS NOT NULL 
    AND context_id IS NOT NULL 
    AND recipient_individual_id IS NOT NULL;

-- ============================================================
-- 7) HELPER VIEW: EXPANDED CIRCLE PARTICIPANTS
-- For debugging/admin: shows circle members resolved at query time
-- ============================================================

CREATE OR REPLACE VIEW v_conversation_circle_recipients AS
SELECT 
  cp.id as participant_id,
  cp.conversation_id,
  cp.circle_id,
  c.name as circle_name,
  cm.individual_id as recipient_individual_id,
  'member' as recipient_source
FROM cc_conversation_participants cp
JOIN cc_coordination_circles c ON c.id = cp.circle_id
JOIN cc_circle_members cm ON cm.circle_id = c.id
WHERE cp.participant_type = 'circle'
  AND cp.is_active = true
  AND c.status = 'active'
  AND cm.is_active = true

UNION ALL

SELECT 
  cp.id as participant_id,
  cp.conversation_id,
  cp.circle_id,
  c.name as circle_name,
  cd.delegatee_individual_id as recipient_individual_id,
  'delegation' as recipient_source
FROM cc_conversation_participants cp
JOIN cc_coordination_circles c ON c.id = cp.circle_id
JOIN cc_circle_delegations cd ON cd.circle_id = c.id
WHERE cp.participant_type = 'circle'
  AND cp.is_active = true
  AND c.status = 'active'
  AND cd.status = 'active'
  AND cd.delegatee_individual_id IS NOT NULL
  AND (cd.expires_at IS NULL OR cd.expires_at > now());

COMMENT ON VIEW v_conversation_circle_recipients IS 
  'Dynamically resolves circle participants to individual recipients for message fan-out';

COMMIT;

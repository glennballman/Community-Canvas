-- Migration 171: Message Action Blocks
-- V3.5 STEP 1 - Add action_block support to cc_messages
-- SAFE ADDITIVE: No destructive changes to existing data

-- Add action_block columns to cc_messages
ALTER TABLE cc_messages ADD COLUMN IF NOT EXISTS action_block jsonb;
ALTER TABLE cc_messages ADD COLUMN IF NOT EXISTS action_block_updated_at timestamptz;
ALTER TABLE cc_messages ADD COLUMN IF NOT EXISTS action_block_idempotency_key text;

-- Add index for querying messages with action blocks
CREATE INDEX IF NOT EXISTS idx_cc_messages_action_block 
ON cc_messages ((action_block IS NOT NULL)) 
WHERE action_block IS NOT NULL;

-- Add audit event table for action block transitions
CREATE TABLE IF NOT EXISTS cc_message_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES cc_messages(id),
  conversation_id uuid NOT NULL REFERENCES cc_conversations(id),
  actor_party_id uuid,
  actor_individual_id uuid,
  action text NOT NULL,
  from_state text,
  to_state text NOT NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying events by message
CREATE INDEX IF NOT EXISTS idx_cc_message_action_events_message 
ON cc_message_action_events (message_id);

-- Index for querying events by actor
CREATE INDEX IF NOT EXISTS idx_cc_message_action_events_actor 
ON cc_message_action_events (actor_party_id) 
WHERE actor_party_id IS NOT NULL;

-- RLS for action events (tenant-scoped via conversation)
ALTER TABLE cc_message_action_events ENABLE ROW LEVEL SECURITY;

-- Service bypass policy
CREATE POLICY cc_message_action_events_service_bypass ON cc_message_action_events
  FOR ALL USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

-- Tenant read policy (via conversation participants)
CREATE POLICY cc_message_action_events_tenant_read ON cc_message_action_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cc_conversations c
      LEFT JOIN cc_parties p ON (p.id = c.contractor_party_id OR p.id = c.owner_party_id)
      WHERE c.id = cc_message_action_events.conversation_id 
      AND (p.tenant_id)::text = current_setting('app.tenant_id', true)
    )
  );

COMMENT ON TABLE cc_message_action_events IS 'Audit trail for message action block state transitions';
COMMENT ON COLUMN cc_messages.action_block IS 'JSONB containing action block definition (version, domain, type, target_id, state, etc.)';

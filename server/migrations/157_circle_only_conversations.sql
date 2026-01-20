-- Migration 157: Allow circle-only conversations
-- Drop NOT NULL constraints on party columns to enable conversations that exist
-- solely within circles (no contractor or owner party required).

-- Drop NOT NULL on contractor_party_id
ALTER TABLE cc_conversations
  ALTER COLUMN contractor_party_id DROP NOT NULL;

-- Drop NOT NULL on owner_party_id
ALTER TABLE cc_conversations
  ALTER COLUMN owner_party_id DROP NOT NULL;

-- Add composite index for circle conversation lookups
-- (circle_id already has partial index, add composite for better join performance)
CREATE INDEX IF NOT EXISTS idx_cc_conversation_participants_circle_conv
  ON cc_conversation_participants (circle_id, conversation_id)
  WHERE circle_id IS NOT NULL;

-- Add composite index for message retrieval by conversation + time (performance)
CREATE INDEX IF NOT EXISTS idx_cc_messages_conv_created
  ON cc_messages (conversation_id, created_at DESC);

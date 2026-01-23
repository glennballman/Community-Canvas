-- Migration 171: Message Action Blocks
-- V3.5 STEP 1 - Add action_block support to cc_messages
-- SAFE ADDITIVE: No destructive changes to existing data
-- NOTE: Uses existing cc_messages table, does NOT create new storage tables

-- Add action_block columns to cc_messages
ALTER TABLE cc_messages ADD COLUMN IF NOT EXISTS action_block jsonb;
ALTER TABLE cc_messages ADD COLUMN IF NOT EXISTS action_block_updated_at timestamptz;
ALTER TABLE cc_messages ADD COLUMN IF NOT EXISTS action_block_idempotency_key text;

-- Add index for querying messages with action blocks
CREATE INDEX IF NOT EXISTS idx_cc_messages_action_block 
ON cc_messages ((action_block IS NOT NULL)) 
WHERE action_block IS NOT NULL;

-- Index for updated_at queries
CREATE INDEX IF NOT EXISTS idx_cc_messages_action_block_updated 
ON cc_messages (action_block_updated_at DESC) 
WHERE action_block IS NOT NULL;

COMMENT ON COLUMN cc_messages.action_block IS 'JSONB containing ActionBlockV1 definition (version, blockType, domain, target_id, status, payload, etc.)';
COMMENT ON COLUMN cc_messages.action_block_updated_at IS 'Timestamp of last action_block status change';
COMMENT ON COLUMN cc_messages.action_block_idempotency_key IS 'Last applied idempotency key for deduplication';

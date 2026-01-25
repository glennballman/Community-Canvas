-- STEP 11C Phase 2C-4: Add metadata column for proposal context attachments
-- This column stores optional proposal_context references (quote_draft_id, estimate_id, etc.)

ALTER TABLE cc_service_run_schedule_proposals
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

-- Add index for efficient proposal_context queries
CREATE INDEX IF NOT EXISTS idx_sr_schedprop_metadata_ctx 
ON cc_service_run_schedule_proposals ((metadata->'proposal_context'))
WHERE metadata->'proposal_context' IS NOT NULL;

COMMENT ON COLUMN cc_service_run_schedule_proposals.metadata IS 
  'JSONB metadata including optional proposal_context references (quote_draft_id, estimate_id, bid_id, trip_id, selected_scope_option)';

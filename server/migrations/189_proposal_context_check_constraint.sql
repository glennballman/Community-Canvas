-- STEP 11C Phase 2C-6: Add CHECK constraint for proposal_context shape validation
-- Ensures proposal_context is either absent/null or contains only allowed keys with valid values

-- Create a function to validate proposal_context shape (functions CAN use more complex logic)
CREATE OR REPLACE FUNCTION is_valid_proposal_context(metadata jsonb) RETURNS boolean AS $$
DECLARE
  pc jsonb;
  key_list text[];
  allowed_keys text[] := ARRAY['quote_draft_id', 'estimate_id', 'bid_id', 'trip_id', 'selected_scope_option'];
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  curr_key text;
BEGIN
  -- Get proposal_context from metadata
  pc := metadata->'proposal_context';
  
  -- NULL or absent is valid
  IF pc IS NULL OR jsonb_typeof(pc) = 'null' THEN
    RETURN true;
  END IF;
  
  -- Must be an object
  IF jsonb_typeof(pc) != 'object' THEN
    RETURN false;
  END IF;
  
  -- Empty object is valid
  IF pc = '{}'::jsonb THEN
    RETURN true;
  END IF;
  
  -- Get all keys
  SELECT array_agg(json_key) INTO key_list FROM jsonb_object_keys(pc) AS json_key;
  
  -- Check all keys are allowed
  FOREACH curr_key IN ARRAY key_list LOOP
    IF NOT (curr_key = ANY(allowed_keys)) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  -- Validate UUID fields if present
  IF pc->>'quote_draft_id' IS NOT NULL AND NOT (pc->>'quote_draft_id' ~* uuid_pattern) THEN
    RETURN false;
  END IF;
  IF pc->>'estimate_id' IS NOT NULL AND NOT (pc->>'estimate_id' ~* uuid_pattern) THEN
    RETURN false;
  END IF;
  IF pc->>'bid_id' IS NOT NULL AND NOT (pc->>'bid_id' ~* uuid_pattern) THEN
    RETURN false;
  END IF;
  IF pc->>'trip_id' IS NOT NULL AND NOT (pc->>'trip_id' ~* uuid_pattern) THEN
    RETURN false;
  END IF;
  
  -- Validate selected_scope_option length if present
  IF pc->>'selected_scope_option' IS NOT NULL AND length(pc->>'selected_scope_option') > 32 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add the constraint using the function
ALTER TABLE cc_service_run_schedule_proposals
ADD CONSTRAINT chk_proposal_context_shape CHECK (is_valid_proposal_context(metadata)) NOT VALID;

-- Validate the constraint
ALTER TABLE cc_service_run_schedule_proposals VALIDATE CONSTRAINT chk_proposal_context_shape;

COMMENT ON CONSTRAINT chk_proposal_context_shape ON cc_service_run_schedule_proposals IS 
  'Phase 2C-6: Ensures proposal_context contains only allowed keys (quote_draft_id, estimate_id, bid_id, trip_id, selected_scope_option) with valid UUID formats and bounded string length';

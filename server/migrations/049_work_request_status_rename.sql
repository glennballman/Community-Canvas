-- ============================================================================
-- Migration 049: Work Request Status Rename
-- 
-- Changes:
-- 1. Update work_request_status enum:
--    OLD: ('new','contacted','quoted','converted','closed','spam')
--    NEW: ('new','contacted','quoted','booked','completed','dropped','spam')
-- 
-- Mappings:
--    converted -> booked
--    closed -> completed (work done)
--    new status: dropped (won't do)
-- ============================================================================

-- Step 1: Add the new enum values
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'booked';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE work_request_status ADD VALUE IF NOT EXISTS 'dropped';

-- Step 2: Migrate existing data
-- Note: PostgreSQL enums can add values but not remove them easily.
-- We migrate data first, then the old values become unused.

-- Convert 'converted' -> 'booked'
UPDATE work_requests SET status = 'booked' WHERE status = 'converted';

-- Convert 'closed' -> 'completed' (default assumption: closed work was completed)
UPDATE work_requests SET status = 'completed' WHERE status = 'closed';

-- Step 3: Update any related columns
-- Update converted_to_project_id column name context if needed (no change needed, just status)

SELECT 'Migration 049: Work request status enum updated (converted->booked, closed->completed, added dropped)' AS status;

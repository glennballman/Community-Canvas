-- Migration 174: Work Request Status Canonicalization
-- TERMINOLOGY_CANON.md v3 compliance - Remove legacy enum values
-- 
-- AUDIT RESULTS (before migration):
-- - Only 1 column uses enum: cc_work_requests.status
-- - 3 rows exist, all with status='accepted' (canonical)
-- - 0 rows with legacy values (new/contacted/quoted/converted/closed/spam/scheduled/dropped)
-- - DEFAULT was 'new' (legacy) - changed to 'draft' (canonical)

-- Step 1: Create new canonical enum type
CREATE TYPE work_request_status_v3 AS ENUM (
  'draft',
  'sent', 
  'proposed_change',
  'awaiting_commitment',
  'unassigned',
  'accepted',
  'in_progress',
  'completed',
  'cancelled'
);

-- Step 2: Drop the old default (it references 'new' which won't exist in new enum)
ALTER TABLE cc_work_requests ALTER COLUMN status DROP DEFAULT;

-- Step 3: Alter column to use new enum type
-- Safe because audit confirmed no legacy values exist
ALTER TABLE cc_work_requests 
  ALTER COLUMN status TYPE work_request_status_v3 
  USING (status::text::work_request_status_v3);

-- Step 4: Set new canonical default
ALTER TABLE cc_work_requests ALTER COLUMN status SET DEFAULT 'draft'::work_request_status_v3;

-- Step 5: Rename types (swap pattern)
ALTER TYPE work_request_status RENAME TO work_request_status_legacy;
ALTER TYPE work_request_status_v3 RENAME TO work_request_status;

-- Step 6: Drop legacy type
DROP TYPE work_request_status_legacy;

-- Verification comment:
-- After running, verify with:
-- SELECT unnest(enum_range(NULL::work_request_status))::text;
-- Should return exactly 9 canonical values:
-- draft, sent, proposed_change, awaiting_commitment, unassigned, accepted, in_progress, completed, cancelled

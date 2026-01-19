-- Migration 156: Job Application Conversations
-- Enables threaded applicant ↔ operator messaging for job applications
-- Reuses cc_conversations, cc_messages, cc_conversation_participants

-- 0) Make work_request_id nullable to support job-only conversations
ALTER TABLE cc_conversations ALTER COLUMN work_request_id DROP NOT NULL;

-- 1) Add job linkage columns to cc_conversations
ALTER TABLE cc_conversations 
  ADD COLUMN IF NOT EXISTS job_id uuid NULL,
  ADD COLUMN IF NOT EXISTS job_application_id uuid NULL;

-- 2) Add indices for job conversation lookups
CREATE INDEX IF NOT EXISTS idx_cc_conversations_job_id 
  ON cc_conversations(job_id) WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_conversations_job_application_id 
  ON cc_conversations(job_application_id) WHERE job_application_id IS NOT NULL;

-- 3) Unique constraint: one conversation per application
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_conversations_job_application
  ON cc_conversations(job_application_id) 
  WHERE job_application_id IS NOT NULL;

-- 4) Foreign key references (soft - no CASCADE to avoid breaking jobs system)
-- Note: Using DO blocks to make this idempotent

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cc_conversations_job_id_fkey'
  ) THEN
    ALTER TABLE cc_conversations 
      ADD CONSTRAINT cc_conversations_job_id_fkey 
      FOREIGN KEY (job_id) REFERENCES cc_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cc_conversations_job_application_id_fkey'
  ) THEN
    ALTER TABLE cc_conversations 
      ADD CONSTRAINT cc_conversations_job_application_id_fkey 
      FOREIGN KEY (job_application_id) REFERENCES cc_job_applications(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5) RLS Policy Extensions for job application conversations
-- Note: These are additive SELECT policies that do not weaken existing policies

-- Policy: Operators can SELECT job conversations for jobs they own (via tenant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_operator_conversation_select' AND tablename = 'cc_conversations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY job_operator_conversation_select ON cc_conversations
        FOR SELECT
        USING (
          is_service_mode()
          OR (
            job_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM cc_jobs j
              WHERE j.id = cc_conversations.job_id
                AND j.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
          )
        )
    $policy$;
  END IF;
END $$;

-- Policy: Applicants can SELECT conversations where they are the applicant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_applicant_conversation_select' AND tablename = 'cc_conversations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY job_applicant_conversation_select ON cc_conversations
        FOR SELECT
        USING (
          is_service_mode()
          OR (
            job_application_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM cc_job_applications a
              WHERE a.id = cc_conversations.job_application_id
                AND a.applicant_individual_id = current_setting('app.individual_id', true)::uuid
            )
          )
        )
    $policy$;
  END IF;
END $$;

-- Policy: Participant-based SELECT via cc_conversation_participants WITH tenant scoping
-- For job conversations, requires tenant match via job; for work_request, via existing policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'conversation_participant_select' AND tablename = 'cc_conversations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY conversation_participant_select ON cc_conversations
        FOR SELECT
        USING (
          is_service_mode()
          OR (
            EXISTS (
              SELECT 1 FROM cc_conversation_participants cp
              WHERE cp.conversation_id = cc_conversations.id
                AND (
                  cp.individual_id = current_setting('app.individual_id', true)::uuid
                  OR cp.party_id = current_setting('app.party_id', true)::uuid
                )
            )
            AND (
              job_id IS NULL
              OR EXISTS (
                SELECT 1 FROM cc_jobs j
                WHERE j.id = cc_conversations.job_id
                  AND j.tenant_id = current_setting('app.tenant_id', true)::uuid
              )
              OR EXISTS (
                SELECT 1 FROM cc_job_applications a
                WHERE a.id = cc_conversations.job_application_id
                  AND a.applicant_individual_id = current_setting('app.individual_id', true)::uuid
              )
            )
          )
        )
    $policy$;
  END IF;
END $$;

-- Policy: UPDATE only allowed if participant AND tenant-scoped (with CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'conversation_participant_update' AND tablename = 'cc_conversations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY conversation_participant_update ON cc_conversations
        FOR UPDATE
        USING (
          is_service_mode()
          OR (
            EXISTS (
              SELECT 1 FROM cc_conversation_participants cp
              WHERE cp.conversation_id = cc_conversations.id
                AND (
                  cp.individual_id = current_setting('app.individual_id', true)::uuid
                  OR cp.party_id = current_setting('app.party_id', true)::uuid
                )
            )
            AND (
              job_id IS NULL
              OR EXISTS (
                SELECT 1 FROM cc_jobs j
                WHERE j.id = cc_conversations.job_id
                  AND j.tenant_id = current_setting('app.tenant_id', true)::uuid
              )
              OR EXISTS (
                SELECT 1 FROM cc_job_applications a
                WHERE a.id = cc_conversations.job_application_id
                  AND a.applicant_individual_id = current_setting('app.individual_id', true)::uuid
              )
            )
          )
        )
        WITH CHECK (
          is_service_mode()
          OR (
            EXISTS (
              SELECT 1 FROM cc_conversation_participants cp
              WHERE cp.conversation_id = cc_conversations.id
                AND (
                  cp.individual_id = current_setting('app.individual_id', true)::uuid
                  OR cp.party_id = current_setting('app.party_id', true)::uuid
                )
            )
          )
        )
    $policy$;
  END IF;
END $$;

-- Policy: INSERT only via service mode (conversations created via service layer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'conversation_service_insert' AND tablename = 'cc_conversations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY conversation_service_insert ON cc_conversations
        FOR INSERT
        WITH CHECK (is_service_mode())
    $policy$;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE cc_conversations ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN cc_conversations.job_id IS 'Links conversation to a job posting (operator side)';
COMMENT ON COLUMN cc_conversations.job_application_id IS 'Links conversation to a specific application (1:1)';

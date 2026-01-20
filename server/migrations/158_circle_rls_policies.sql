-- Migration 158: Update RLS policies to include circle membership for circle-only conversations
-- 
-- Issue: conversation_participant_select/update policies only check individual_id/party_id,
-- not circle membership. cc_messages_tenant_read joins on party_ids which are now nullable.

-- Helper function to check circle membership (with tenant scoping)
CREATE OR REPLACE FUNCTION is_circle_participant(conv_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cc_conversation_participants cp
    JOIN cc_circle_members cm ON cm.circle_id = cp.circle_id
      AND cm.individual_id = current_setting('app.individual_id', true)::uuid
      AND cm.is_active = true
      AND cm.tenant_id = current_setting('app.tenant_id', true)::uuid
    WHERE cp.conversation_id = conv_id
      AND cp.circle_id IS NOT NULL
      AND cp.is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Update conversation_participant_select to include circle membership
DROP POLICY IF EXISTS conversation_participant_select ON cc_conversations;
CREATE POLICY conversation_participant_select ON cc_conversations
  FOR SELECT
  USING (
    is_service_mode()
    OR (
      (
        -- Direct individual or party participation
        EXISTS (
          SELECT 1 FROM cc_conversation_participants cp
          WHERE cp.conversation_id = cc_conversations.id
            AND (
              cp.individual_id = current_setting('app.individual_id', true)::uuid
              OR cp.party_id = current_setting('app.party_id', true)::uuid
            )
        )
        -- Circle participation (tenant-scoped)
        OR is_circle_participant(cc_conversations.id)
      )
      AND (
        -- Job conversation checks (unchanged)
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
  );

-- Update conversation_participant_update to include circle membership
DROP POLICY IF EXISTS conversation_participant_update ON cc_conversations;
CREATE POLICY conversation_participant_update ON cc_conversations
  FOR UPDATE
  USING (
    is_service_mode()
    OR (
      (
        EXISTS (
          SELECT 1 FROM cc_conversation_participants cp
          WHERE cp.conversation_id = cc_conversations.id
            AND (
              cp.individual_id = current_setting('app.individual_id', true)::uuid
              OR cp.party_id = current_setting('app.party_id', true)::uuid
            )
        )
        OR is_circle_participant(cc_conversations.id)
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
      OR is_circle_participant(cc_conversations.id)
    )
  );

-- Update cc_messages_tenant_read to handle null party_ids (circle-only conversations)
DROP POLICY IF EXISTS cc_messages_tenant_read ON cc_messages;
CREATE POLICY cc_messages_tenant_read ON cc_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM cc_conversations c
      LEFT JOIN cc_parties p ON p.id = c.contractor_party_id OR p.id = c.owner_party_id
      WHERE c.id = cc_messages.conversation_id
        AND (
          -- Party-based access (existing logic, now with LEFT JOIN)
          p.tenant_id::text = current_setting('app.tenant_id', true)
          -- Circle-based access for circle-only conversations
          OR is_circle_participant(c.id)
        )
    )
  );

-- Migration 160: Add participant tenant check to is_circle_participant()
-- Belt-and-suspenders: verify both circle_member AND conversation_participant are tenant-scoped

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
      AND cp.tenant_id = current_setting('app.tenant_id', true)::uuid
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION is_circle_participant(uuid) IS 
  'Returns true if current user (app.individual_id) is an active member of a circle that participates in the given conversation. Enforces tenant isolation on BOTH circle_members AND conversation_participants.';

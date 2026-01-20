-- Migration 159: Harden is_circle_participant() function with explicit search_path
-- Security: SECURITY DEFINER functions should have fixed search_path

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
$$ LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public;

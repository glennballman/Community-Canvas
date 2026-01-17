-- ============================================================
-- MIGRATION 155: EMERGENCY REQUEST NOTIFICATIONS
-- Notification template and function for emergency replacement requests
-- ============================================================

BEGIN;

-- Add notification template for emergency replacement requests
INSERT INTO cc_notification_templates (
  code, name, description, category,
  subject_template, body_template, short_body_template,
  default_channels, default_priority, is_actionable, action_url_template, action_label
) VALUES (
  'emergency_replacement_request',
  'Emergency Replacement Request',
  'Sent to portal staff when a tenant creates an emergency replacement request',
  'job',
  'Emergency replacement request: {{role_title}}',
  'An employer has submitted an emergency replacement request for {{role_title}} with {{urgency}} urgency. Please review and respond.',
  'Emergency: {{role_title}} ({{urgency}})',
  '{in_app}',
  'urgent',
  true,
  '/app/mod/emergency?requestId={{request_id}}',
  'View Request'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  short_body_template = EXCLUDED.short_body_template,
  default_priority = EXCLUDED.default_priority,
  action_url_template = EXCLUDED.action_url_template,
  updated_at = now();

-- Function to notify portal staff about emergency requests
CREATE OR REPLACE FUNCTION cc_notify_portal_staff_emergency(
  p_portal_id uuid,
  p_request_id uuid,
  p_role_title text,
  p_urgency text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff RECORD;
  v_count integer := 0;
  v_template RECORD;
  v_subject text;
  v_body text;
  v_short_body text;
  v_action_url text;
BEGIN
  IF NOT is_service_mode() THEN
    RAISE EXCEPTION 'SERVICE_ONLY: This function can only be called by the server';
  END IF;

  SELECT * INTO v_template
  FROM cc_notification_templates
  WHERE code = 'emergency_replacement_request' AND is_active = true;

  IF v_template IS NULL THEN
    RETURN 0;
  END IF;

  v_subject := replace(replace(v_template.subject_template, '{{role_title}}', p_role_title), '{{urgency}}', p_urgency);
  v_body := replace(replace(v_template.body_template, '{{role_title}}', p_role_title), '{{urgency}}', p_urgency);
  v_short_body := replace(replace(v_template.short_body_template, '{{role_title}}', p_role_title), '{{urgency}}', p_urgency);
  v_action_url := replace(v_template.action_url_template, '{{request_id}}', p_request_id::text);

  FOR v_staff IN
    SELECT DISTINCT ps.individual_id
    FROM cc_portal_staff ps
    WHERE ps.portal_id = p_portal_id
      AND ps.is_active = true
      AND (ps.role IN ('admin', 'moderator', 'staff') OR ps.can_moderate_content = true)
    UNION
    SELECT DISTINCT tm.individual_id
    FROM cc_tenant_memberships tm
    JOIN cc_portals p ON p.tenant_id = tm.tenant_id
    WHERE p.id = p_portal_id
      AND tm.is_active = true
      AND tm.role IN ('admin', 'owner')
  LOOP
    INSERT INTO cc_notifications (
      template_id,
      template_code,
      recipient_individual_id,
      subject,
      body,
      short_body,
      category,
      priority,
      channels,
      context_type,
      context_id,
      context_data,
      action_url,
      action_label,
      status
    ) VALUES (
      v_template.id,
      'emergency_replacement_request',
      v_staff.individual_id,
      v_subject,
      v_body,
      v_short_body,
      'job',
      'urgent',
      v_template.default_channels,
      'emergency_request',
      p_request_id,
      jsonb_build_object(
        'portal_id', p_portal_id,
        'role_title', p_role_title,
        'urgency', p_urgency
      ),
      v_action_url,
      v_template.action_label,
      'pending'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMIT;

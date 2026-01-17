-- Migration 146: Job Application Events + Reply Templates
-- Adds append-only event log for application activity and job-specific templates

-- Event types for job applications
DO $$ BEGIN
  CREATE TYPE job_application_event_type AS ENUM (
    'status_changed',
    'note_added',
    'reply_sent',
    'assigned_to_employer',
    'interview_scheduled',
    'offer_made',
    'document_requested',
    'document_received'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Append-only event log for job applications
CREATE TABLE IF NOT EXISTS cc_job_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES cc_job_applications(id) ON DELETE CASCADE,
  portal_id UUID REFERENCES cc_portals(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES cc_tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES cc_users(id) ON DELETE SET NULL,
  event_type job_application_event_type NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  note TEXT,
  template_code TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_app_events_application ON cc_job_application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_app_events_portal ON cc_job_application_events(portal_id);
CREATE INDEX IF NOT EXISTS idx_app_events_tenant ON cc_job_application_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON cc_job_application_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON cc_job_application_events(event_type);

-- RLS
ALTER TABLE cc_job_application_events ENABLE ROW LEVEL SECURITY;

-- Service bypass
CREATE POLICY app_events_service_bypass ON cc_job_application_events
  FOR ALL USING (is_service_mode());

-- Portal staff can read events for their portal's applications
CREATE POLICY app_events_portal_read ON cc_job_application_events
  FOR SELECT USING (
    portal_id = current_setting('app.portal_id', true)::uuid
  );

-- Tenant can read events for their applications
CREATE POLICY app_events_tenant_read ON cc_job_application_events
  FOR SELECT USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- Add last_activity_at to applications for SLA tracking (if not exists)
ALTER TABLE cc_job_applications 
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS assigned_portal_id UUID REFERENCES cc_portals(id),
  ADD COLUMN IF NOT EXISTS needs_reply BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_applications_last_activity ON cc_job_applications(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_portal ON cc_job_applications(assigned_portal_id);
CREATE INDEX IF NOT EXISTS idx_applications_needs_reply ON cc_job_applications(needs_reply) WHERE needs_reply = true;

-- Insert job/application notification templates
INSERT INTO cc_notification_templates (
  id, code, name, description, category, 
  subject_template, body_template, short_body_template,
  default_channels, default_priority, is_actionable, is_active
) VALUES 
  (
    gen_random_uuid(),
    'job_application_received',
    'Application Received',
    'Sent when a job application is submitted',
    'job',
    'Application Received - {{job_title}}',
    'Hi {{applicant_name}},

Thank you for your interest in the {{job_title}} position with {{employer_name}}.

We have received your application and will review it shortly. You can expect to hear from us within {{response_time}} business days.

Best regards,
{{portal_name}} Team',
    'Application received for {{job_title}}',
    ARRAY['email']::notification_channel[],
    'normal',
    false,
    true
  ),
  (
    gen_random_uuid(),
    'job_application_request_info',
    'Request More Information',
    'Request additional information from applicant',
    'job',
    'Additional Information Needed - {{job_title}}',
    'Hi {{applicant_name}},

Thank you for applying to the {{job_title}} position with {{employer_name}}.

To move forward with your application, we need some additional information:

{{request_details}}

Please reply to this message with the requested information.

Best regards,
{{sender_name}}
{{portal_name}}',
    'More info needed for your application',
    ARRAY['email']::notification_channel[],
    'normal',
    true,
    true
  ),
  (
    gen_random_uuid(),
    'job_application_interview_invite',
    'Interview Invitation',
    'Invite applicant to interview',
    'job',
    'Interview Invitation - {{job_title}}',
    'Hi {{applicant_name}},

Great news! We would like to invite you for an interview for the {{job_title}} position with {{employer_name}}.

Interview Details:
- Date: {{interview_date}}
- Time: {{interview_time}}
- Location: {{interview_location}}
- Format: {{interview_format}}

Please confirm your availability by replying to this message.

Best regards,
{{sender_name}}
{{portal_name}}',
    'Interview invitation for {{job_title}}',
    ARRAY['email']::notification_channel[],
    'high',
    true,
    true
  ),
  (
    gen_random_uuid(),
    'job_application_not_selected',
    'Application Not Selected',
    'Inform applicant they were not selected',
    'job',
    'Update on Your Application - {{job_title}}',
    'Hi {{applicant_name}},

Thank you for your interest in the {{job_title}} position with {{employer_name}}.

After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs.

We encourage you to apply for future openings that match your qualifications.

Best regards,
{{sender_name}}
{{portal_name}}',
    'Update on your {{job_title}} application',
    ARRAY['email']::notification_channel[],
    'normal',
    false,
    true
  ),
  (
    gen_random_uuid(),
    'job_application_housing_followup',
    'Housing Follow-up',
    'Follow up on housing needs',
    'job',
    'Housing Information - {{job_title}}',
    'Hi {{applicant_name}},

We noticed you indicated housing assistance may be needed for the {{job_title}} position.

{{employer_name}} offers the following housing options:
{{housing_details}}

Please let us know if you have any questions about the housing arrangements.

Best regards,
{{sender_name}}
{{portal_name}}',
    'Housing info for {{job_title}}',
    ARRAY['email']::notification_channel[],
    'normal',
    true,
    true
  ),
  (
    gen_random_uuid(),
    'job_application_work_permit_followup',
    'Work Permit Follow-up',
    'Follow up on work authorization',
    'job',
    'Work Authorization Information - {{job_title}}',
    'Hi {{applicant_name}},

Regarding your application for the {{job_title}} position with {{employer_name}}, we need to discuss work authorization requirements.

{{work_permit_details}}

Please reply with your current work authorization status.

Best regards,
{{sender_name}}
{{portal_name}}',
    'Work authorization info for {{job_title}}',
    ARRAY['email']::notification_channel[],
    'normal',
    true,
    true
  )
ON CONFLICT (code) DO NOTHING;

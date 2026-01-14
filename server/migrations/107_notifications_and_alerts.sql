-- ============================================================
-- MIGRATION 107: NOTIFICATIONS & ALERTS
-- Part of Prompt 28 - Multi-Channel Notification System
-- ============================================================

BEGIN;

-- ============================================================
-- 1) NOTIFICATION ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM (
    'in_app',
    'email',
    'sms',
    'push',
    'webhook'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM (
    'pending',
    'queued',
    'sent',
    'delivered',
    'read',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM (
    'system',
    'invitation',
    'job',
    'moderation',
    'onboarding',
    'message',
    'reservation',
    'payment',
    'alert',
    'reminder',
    'marketing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE digest_frequency AS ENUM (
    'immediate',
    'hourly',
    'daily',
    'weekly',
    'never'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) TENANT-INDIVIDUAL SCOPE (Foundational Primitive)
-- Links individuals to tenants for multi-org support
-- Required for party/individual notification recipients
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_tenant_individuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  individual_id uuid NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Context
  role text,
  status text NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT cc_tenant_individuals_unique UNIQUE (tenant_id, individual_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_tenant_individuals_tenant ON cc_tenant_individuals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_tenant_individuals_individual ON cc_tenant_individuals(individual_id);

-- Enable RLS
ALTER TABLE cc_tenant_individuals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_tenant_individuals_service_bypass ON cc_tenant_individuals;
DROP POLICY IF EXISTS cc_tenant_individuals_tenant_scope ON cc_tenant_individuals;

CREATE POLICY cc_tenant_individuals_service_bypass ON cc_tenant_individuals
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY cc_tenant_individuals_tenant_scope ON cc_tenant_individuals
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================
-- 3) NOTIFICATION TEMPLATES
-- Reusable templates for consistent messaging
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Categorization
  category notification_category NOT NULL,
  
  -- Content templates (supports {{variable}} placeholders)
  subject_template text,
  body_template text NOT NULL,
  short_body_template text, -- For SMS/push
  
  -- Channel-specific overrides
  email_template_id text, -- External template ID (SendGrid, etc.)
  sms_template_id text,
  push_template jsonb,
  
  -- Default settings
  default_channels notification_channel[] DEFAULT '{in_app}',
  default_priority notification_priority DEFAULT 'normal',
  
  -- Behavior
  is_actionable boolean DEFAULT false,
  action_url_template text,
  action_label text,
  
  -- Status
  is_active boolean DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_notification_templates_code ON cc_notification_templates(code);
CREATE INDEX IF NOT EXISTS idx_cc_notification_templates_category ON cc_notification_templates(category);

-- ============================================================
-- 4) NOTIFICATION PREFERENCES
-- User/tenant preferences for notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner (one should be set)
  tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Channel preferences
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT true,
  in_app_enabled boolean DEFAULT true,
  
  -- Contact info for delivery
  email_address text,
  phone_number text,
  push_token text,
  
  -- Digest settings
  digest_frequency digest_frequency DEFAULT 'immediate',
  digest_hour integer DEFAULT 9, -- Hour of day for daily digest (0-23)
  digest_day integer DEFAULT 1, -- Day of week for weekly (1=Monday)
  timezone text DEFAULT 'America/Vancouver',
  
  -- Category preferences (which categories to receive)
  enabled_categories notification_category[] DEFAULT '{system,invitation,job,moderation,onboarding,message,reservation,payment,alert,reminder}',
  
  -- Quiet hours
  quiet_hours_enabled boolean DEFAULT false,
  quiet_hours_start time DEFAULT '22:00',
  quiet_hours_end time DEFAULT '07:00',
  
  -- Unsubscribe tracking
  unsubscribed_at timestamptz,
  unsubscribe_reason text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- One preference set per identity
  CONSTRAINT notification_prefs_unique_tenant UNIQUE (tenant_id),
  CONSTRAINT notification_prefs_unique_party UNIQUE (party_id),
  CONSTRAINT notification_prefs_unique_individual UNIQUE (individual_id),
  
  -- Exactly one identity (XOR)
  CONSTRAINT notification_prefs_exactly_one_identity CHECK (
    (CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN individual_id IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_notification_preferences_tenant ON cc_notification_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_notification_preferences_party ON cc_notification_preferences(party_id);
CREATE INDEX IF NOT EXISTS idx_cc_notification_preferences_individual ON cc_notification_preferences(individual_id);

-- Enable RLS
ALTER TABLE cc_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_notification_preferences_service_bypass ON cc_notification_preferences;
DROP POLICY IF EXISTS cc_notification_preferences_tenant_access ON cc_notification_preferences;
DROP POLICY IF EXISTS cc_notification_preferences_party_access ON cc_notification_preferences;
DROP POLICY IF EXISTS cc_notification_preferences_individual_access ON cc_notification_preferences;

CREATE POLICY cc_notification_preferences_service_bypass ON cc_notification_preferences
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can access their own preferences
CREATE POLICY cc_notification_preferences_tenant_access ON cc_notification_preferences
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Tenant can access party preferences if party belongs to tenant
CREATE POLICY cc_notification_preferences_party_access ON cc_notification_preferences
  FOR ALL
  USING (
    party_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_notification_preferences.party_id
        AND p.tenant_id = current_tenant_id()
    )
  );

-- Tenant can access individual preferences if linked via cc_tenant_individuals
CREATE POLICY cc_notification_preferences_individual_access ON cc_notification_preferences
  FOR ALL
  USING (
    individual_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_tenant_individuals ti
      WHERE ti.individual_id = cc_notification_preferences.individual_id
        AND ti.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- 5) NOTIFICATIONS
-- Individual notification instances
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template reference
  template_id uuid REFERENCES cc_notification_templates(id),
  template_code text, -- Denormalized for performance
  
  -- Recipient (one should be set)
  recipient_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  recipient_party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  recipient_individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Content (rendered from template)
  subject text,
  body text NOT NULL,
  short_body text,
  
  -- Categorization
  category notification_category NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',
  
  -- Channels to deliver on
  channels notification_channel[] NOT NULL DEFAULT '{in_app}',
  
  -- Context
  context_type text, -- job, invitation, moderation, etc.
  context_id uuid,
  context_data jsonb DEFAULT '{}',
  
  -- Action
  action_url text,
  action_label text,
  
  -- Sender (optional)
  sender_tenant_id uuid REFERENCES cc_tenants(id),
  sender_name text,
  
  -- Status tracking
  status notification_status NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  scheduled_for timestamptz DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  
  -- Failure tracking
  failure_reason text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  -- Digest tracking
  digest_id uuid, -- If part of a digest batch
  is_digest_eligible boolean DEFAULT true,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Exactly one recipient (XOR)
  CONSTRAINT notification_exactly_one_recipient CHECK (
    (CASE WHEN recipient_tenant_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN recipient_party_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN recipient_individual_id IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_notifications_recipient_tenant ON cc_notifications(recipient_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_notifications_recipient_party ON cc_notifications(recipient_party_id);
CREATE INDEX IF NOT EXISTS idx_cc_notifications_status ON cc_notifications(status);
CREATE INDEX IF NOT EXISTS idx_cc_notifications_category ON cc_notifications(category);
CREATE INDEX IF NOT EXISTS idx_cc_notifications_pending ON cc_notifications(status, scheduled_for) 
  WHERE status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS idx_cc_notifications_unread ON cc_notifications(recipient_tenant_id, status, created_at) 
  WHERE status NOT IN ('read', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_cc_notifications_context ON cc_notifications(context_type, context_id);

-- Enable RLS
ALTER TABLE cc_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_notifications_service_bypass ON cc_notifications;
DROP POLICY IF EXISTS cc_notifications_tenant_recipient ON cc_notifications;
DROP POLICY IF EXISTS cc_notifications_party_recipient ON cc_notifications;
DROP POLICY IF EXISTS cc_notifications_individual_recipient ON cc_notifications;

CREATE POLICY cc_notifications_service_bypass ON cc_notifications
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can access notifications sent to them
CREATE POLICY cc_notifications_tenant_recipient ON cc_notifications
  FOR ALL
  USING (recipient_tenant_id = current_tenant_id())
  WITH CHECK (recipient_tenant_id = current_tenant_id());

-- Tenant can access notifications sent to their parties
CREATE POLICY cc_notifications_party_recipient ON cc_notifications
  FOR SELECT
  USING (
    recipient_party_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_notifications.recipient_party_id
        AND p.tenant_id = current_tenant_id()
    )
  );

-- Tenant can access notifications sent to linked individuals
CREATE POLICY cc_notifications_individual_recipient ON cc_notifications
  FOR SELECT
  USING (
    recipient_individual_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_tenant_individuals ti
      WHERE ti.individual_id = cc_notifications.recipient_individual_id
        AND ti.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- 6) NOTIFICATION DELIVERY LOG
-- Tracks delivery attempts per channel
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES cc_notifications(id) ON DELETE CASCADE,
  
  -- Channel
  channel notification_channel NOT NULL,
  
  -- Delivery details
  recipient_address text, -- Email, phone, device token, etc.
  
  -- Status
  status notification_status NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  attempted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  
  -- Provider details
  provider_name text, -- SendGrid, Twilio, FCM, etc.
  provider_message_id text,
  provider_response jsonb,
  
  -- Failure tracking
  failure_reason text,
  failure_code text,
  is_permanent_failure boolean DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- One delivery attempt per channel per notification
  UNIQUE (notification_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_cc_notification_deliveries_notification ON cc_notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_cc_notification_deliveries_status ON cc_notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_cc_notification_deliveries_provider ON cc_notification_deliveries(provider_message_id);

-- Enable RLS
ALTER TABLE cc_notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_notification_deliveries_service_bypass ON cc_notification_deliveries;
DROP POLICY IF EXISTS cc_notification_deliveries_tenant_access ON cc_notification_deliveries;

CREATE POLICY cc_notification_deliveries_service_bypass ON cc_notification_deliveries
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can see deliveries for their notifications (via any recipient type)
CREATE POLICY cc_notification_deliveries_tenant_access ON cc_notification_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cc_notifications n
      WHERE n.id = cc_notification_deliveries.notification_id
        AND (
          n.recipient_tenant_id = current_tenant_id()
          OR EXISTS (
            SELECT 1 FROM cc_parties p
            WHERE p.id = n.recipient_party_id
              AND p.tenant_id = current_tenant_id()
          )
          OR EXISTS (
            SELECT 1 FROM cc_tenant_individuals ti
            WHERE ti.individual_id = n.recipient_individual_id
              AND ti.tenant_id = current_tenant_id()
          )
        )
    )
  );

-- ============================================================
-- 7) NOTIFICATION DIGESTS
-- Batched notifications for digest delivery
-- ============================================================

CREATE TABLE IF NOT EXISTS cc_notification_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  recipient_tenant_id uuid REFERENCES cc_tenants(id) ON DELETE CASCADE,
  recipient_party_id uuid REFERENCES cc_parties(id) ON DELETE CASCADE,
  recipient_individual_id uuid REFERENCES cc_individuals(id) ON DELETE CASCADE,
  
  -- Digest window
  frequency digest_frequency NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  
  -- Counts
  notification_count integer DEFAULT 0,
  
  -- Status
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  
  -- Content (rendered digest)
  subject text,
  body text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- One digest per recipient per period
  UNIQUE (recipient_tenant_id, frequency, period_start)
);

CREATE INDEX IF NOT EXISTS idx_cc_notification_digests_recipient ON cc_notification_digests(recipient_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_notification_digests_pending ON cc_notification_digests(status, period_end) 
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE cc_notification_digests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS cc_notification_digests_service_bypass ON cc_notification_digests;
DROP POLICY IF EXISTS cc_notification_digests_tenant_access ON cc_notification_digests;
DROP POLICY IF EXISTS cc_notification_digests_party_access ON cc_notification_digests;
DROP POLICY IF EXISTS cc_notification_digests_individual_access ON cc_notification_digests;

CREATE POLICY cc_notification_digests_service_bypass ON cc_notification_digests
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Tenant can see their digests
CREATE POLICY cc_notification_digests_tenant_access ON cc_notification_digests
  FOR SELECT
  USING (recipient_tenant_id = current_tenant_id());

-- Tenant can see party digests
CREATE POLICY cc_notification_digests_party_access ON cc_notification_digests
  FOR SELECT
  USING (
    recipient_party_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_parties p
      WHERE p.id = cc_notification_digests.recipient_party_id
        AND p.tenant_id = current_tenant_id()
    )
  );

-- Tenant can see linked individual digests
CREATE POLICY cc_notification_digests_individual_access ON cc_notification_digests
  FOR SELECT
  USING (
    recipient_individual_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cc_tenant_individuals ti
      WHERE ti.individual_id = cc_notification_digests.recipient_individual_id
        AND ti.tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- 8) HELPER FUNCTION: Create Notification
-- SERVICE-ONLY: Only server can create notifications
-- ============================================================

CREATE OR REPLACE FUNCTION cc_create_notification(
  p_recipient_tenant_id uuid,
  p_template_code text,
  p_context_type text DEFAULT NULL,
  p_context_id uuid DEFAULT NULL,
  p_context_data jsonb DEFAULT '{}',
  p_priority notification_priority DEFAULT 'normal',
  p_scheduled_for timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification_id uuid;
  v_template RECORD;
  v_prefs RECORD;
  v_channels notification_channel[];
  v_subject text;
  v_body text;
  v_short_body text;
  v_action_url text;
  key text;
  value text;
BEGIN
  -- SECURITY: Only server can create notifications
  IF NOT is_service_mode() THEN
    RAISE EXCEPTION 'SERVICE_ONLY: Notifications can only be created by the server';
  END IF;

  -- Get template
  SELECT * INTO v_template
  FROM cc_notification_templates
  WHERE code = p_template_code AND is_active = true;
  
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'TEMPLATE_NOT_FOUND: %', p_template_code;
  END IF;
  
  -- Get recipient preferences
  SELECT * INTO v_prefs
  FROM cc_notification_preferences
  WHERE tenant_id = p_recipient_tenant_id;
  
  -- Determine channels (template default, filtered by preferences)
  IF v_prefs IS NOT NULL THEN
    v_channels := ARRAY(
      SELECT unnest(v_template.default_channels)
      INTERSECT
      SELECT unnest(ARRAY[
        CASE WHEN v_prefs.in_app_enabled THEN 'in_app'::notification_channel END,
        CASE WHEN v_prefs.email_enabled THEN 'email'::notification_channel END,
        CASE WHEN v_prefs.sms_enabled THEN 'sms'::notification_channel END,
        CASE WHEN v_prefs.push_enabled THEN 'push'::notification_channel END
      ])
    );
    
    -- Check if category is enabled
    IF NOT (v_template.category = ANY(v_prefs.enabled_categories)) THEN
      -- Category disabled, only send in-app if enabled
      IF v_prefs.in_app_enabled THEN
        v_channels := ARRAY['in_app'::notification_channel];
      ELSE
        RETURN NULL; -- No channels available
      END IF;
    END IF;
  ELSE
    v_channels := v_template.default_channels;
  END IF;
  
  -- Render templates (simple variable substitution)
  v_subject := v_template.subject_template;
  v_body := v_template.body_template;
  v_short_body := v_template.short_body_template;
  v_action_url := v_template.action_url_template;
  
  -- Replace context variables
  IF p_context_data IS NOT NULL THEN
    FOR key, value IN SELECT * FROM jsonb_each_text(p_context_data)
    LOOP
      v_subject := replace(v_subject, '{{' || key || '}}', value);
      v_body := replace(v_body, '{{' || key || '}}', value);
      v_short_body := replace(v_short_body, '{{' || key || '}}', value);
      v_action_url := replace(v_action_url, '{{' || key || '}}', value);
    END LOOP;
  END IF;
  
  -- Create notification
  INSERT INTO cc_notifications (
    template_id,
    template_code,
    recipient_tenant_id,
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
    scheduled_for,
    is_digest_eligible
  ) VALUES (
    v_template.id,
    p_template_code,
    p_recipient_tenant_id,
    v_subject,
    v_body,
    v_short_body,
    v_template.category,
    p_priority,
    v_channels,
    p_context_type,
    p_context_id,
    p_context_data,
    v_action_url,
    v_template.action_label,
    p_scheduled_for,
    COALESCE(v_prefs.digest_frequency, 'immediate') <> 'immediate'
  )
  RETURNING id INTO v_notification_id;
  
  -- Create delivery records for each channel
  INSERT INTO cc_notification_deliveries (notification_id, channel, recipient_address)
  SELECT 
    v_notification_id,
    unnest(v_channels),
    CASE 
      WHEN unnest(v_channels) = 'email' THEN v_prefs.email_address
      WHEN unnest(v_channels) = 'sms' THEN v_prefs.phone_number
      WHEN unnest(v_channels) = 'push' THEN v_prefs.push_token
      ELSE NULL
    END;
  
  RETURN v_notification_id;
END;
$$;

-- ============================================================
-- 9) HELPER FUNCTION: Mark Notification Read
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_mark_notification_read(
  p_notification_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification RECORD;
BEGIN
  -- Get notification
  SELECT * INTO v_notification
  FROM cc_notifications
  WHERE id = p_notification_id;
  
  IF v_notification IS NULL THEN
    RETURN false;
  END IF;
  
  -- SECURITY: Verify caller has scope over recipient
  IF NOT is_service_mode() THEN
    IF v_notification.recipient_tenant_id IS NOT NULL 
       AND v_notification.recipient_tenant_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s notifications';
    ELSIF v_notification.recipient_party_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties p
        WHERE p.id = v_notification.recipient_party_id
          AND p.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not accessible';
      END IF;
    ELSIF v_notification.recipient_individual_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals ti
        WHERE ti.individual_id = v_notification.recipient_individual_id
          AND ti.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not accessible';
      END IF;
    END IF;
  END IF;

  UPDATE cc_notifications
  SET 
    status = 'read',
    read_at = now(),
    updated_at = now()
  WHERE id = p_notification_id
    AND status NOT IN ('read', 'cancelled');
  
  RETURN FOUND;
END;
$$;

-- ============================================================
-- 10) HELPER FUNCTION: Mark All Notifications Read
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_mark_all_notifications_read(
  p_recipient_type text,
  p_recipient_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  -- SECURITY: Verify caller has scope over recipient
  IF NOT is_service_mode() THEN
    IF p_recipient_type = 'tenant' AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s notifications';
    ELSIF p_recipient_type = 'party' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties p
        WHERE p.id = p_recipient_id AND p.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not accessible';
      END IF;
    ELSIF p_recipient_type = 'individual' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals ti
        WHERE ti.individual_id = p_recipient_id AND ti.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not accessible';
      END IF;
    END IF;
  END IF;

  UPDATE cc_notifications
  SET 
    status = 'read',
    read_at = now(),
    updated_at = now()
  WHERE status NOT IN ('read', 'cancelled')
    AND (
      (p_recipient_type = 'tenant' AND recipient_tenant_id = p_recipient_id)
      OR (p_recipient_type = 'party' AND recipient_party_id = p_recipient_id)
      OR (p_recipient_type = 'individual' AND recipient_individual_id = p_recipient_id)
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 11) HELPER FUNCTION: Get Unread Count
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_unread_notification_count(
  p_recipient_type text,
  p_recipient_id uuid
) RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  -- SECURITY: Verify caller has scope over recipient
  IF NOT is_service_mode() THEN
    IF p_recipient_type = 'tenant' AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot view another tenant''s notifications';
    ELSIF p_recipient_type = 'party' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties p
        WHERE p.id = p_recipient_id AND p.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not accessible';
      END IF;
    ELSIF p_recipient_type = 'individual' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals ti
        WHERE ti.individual_id = p_recipient_id AND ti.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not accessible';
      END IF;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM cc_notifications
  WHERE status NOT IN ('read', 'cancelled')
    AND channels && ARRAY['in_app'::notification_channel]
    AND (
      (p_recipient_type = 'tenant' AND recipient_tenant_id = p_recipient_id)
      OR (p_recipient_type = 'party' AND recipient_party_id = p_recipient_id)
      OR (p_recipient_type = 'individual' AND recipient_individual_id = p_recipient_id)
    );
  
  RETURN v_count;
END;
$$;

-- ============================================================
-- 12) HELPER FUNCTION: Get Notifications
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_get_notifications(
  p_recipient_type text,
  p_recipient_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_category notification_category DEFAULT NULL,
  p_unread_only boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notifications jsonb;
  v_total integer;
  v_unread integer;
BEGIN
  -- SECURITY: Verify caller has scope over recipient
  IF NOT is_service_mode() THEN
    IF p_recipient_type = 'tenant' AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot view another tenant''s notifications';
    ELSIF p_recipient_type = 'party' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties p
        WHERE p.id = p_recipient_id AND p.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not accessible';
      END IF;
    ELSIF p_recipient_type = 'individual' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals ti
        WHERE ti.individual_id = p_recipient_id AND ti.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not accessible';
      END IF;
    END IF;
  END IF;

  -- Get notifications
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'template_code', n.template_code,
      'subject', n.subject,
      'body', n.body,
      'category', n.category,
      'priority', n.priority,
      'status', n.status,
      'action_url', n.action_url,
      'action_label', n.action_label,
      'context_type', n.context_type,
      'context_id', n.context_id,
      'sender_name', n.sender_name,
      'created_at', n.created_at,
      'read_at', n.read_at
    ) ORDER BY n.created_at DESC
  ) INTO v_notifications
  FROM cc_notifications n
  WHERE n.channels && ARRAY['in_app'::notification_channel]
    AND n.status <> 'cancelled'
    AND (p_category IS NULL OR n.category = p_category)
    AND (NOT p_unread_only OR n.status NOT IN ('read'))
    AND (
      (p_recipient_type = 'tenant' AND n.recipient_tenant_id = p_recipient_id)
      OR (p_recipient_type = 'party' AND n.recipient_party_id = p_recipient_id)
      OR (p_recipient_type = 'individual' AND n.recipient_individual_id = p_recipient_id)
    )
  LIMIT p_limit
  OFFSET p_offset;
  
  -- Get counts
  SELECT COUNT(*) INTO v_total
  FROM cc_notifications
  WHERE channels && ARRAY['in_app'::notification_channel]
    AND status <> 'cancelled'
    AND (
      (p_recipient_type = 'tenant' AND recipient_tenant_id = p_recipient_id)
      OR (p_recipient_type = 'party' AND recipient_party_id = p_recipient_id)
      OR (p_recipient_type = 'individual' AND recipient_individual_id = p_recipient_id)
    );
  
  v_unread := cc_get_unread_notification_count(p_recipient_type, p_recipient_id);
  
  RETURN jsonb_build_object(
    'notifications', COALESCE(v_notifications, '[]'),
    'total', v_total,
    'unread', v_unread,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- ============================================================
-- 13) HELPER FUNCTION: Update Notification Preferences
-- Supports tenant/party/individual recipients
-- ============================================================

CREATE OR REPLACE FUNCTION cc_update_notification_preferences(
  p_recipient_type text,
  p_recipient_id uuid,
  p_preferences jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pref_id uuid;
BEGIN
  -- SECURITY: Verify caller has scope over recipient
  IF NOT is_service_mode() THEN
    IF p_recipient_type = 'tenant' AND p_recipient_id <> current_tenant_id() THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Cannot modify another tenant''s preferences';
    ELSIF p_recipient_type = 'party' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_parties p
        WHERE p.id = p_recipient_id AND p.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Party not accessible';
      END IF;
    ELSIF p_recipient_type = 'individual' THEN
      IF NOT EXISTS (
        SELECT 1 FROM cc_tenant_individuals ti
        WHERE ti.individual_id = p_recipient_id AND ti.tenant_id = current_tenant_id()
      ) THEN
        RAISE EXCEPTION 'RECIPIENT_OUT_OF_SCOPE: Individual not accessible';
      END IF;
    END IF;
  END IF;

  -- Build insert based on recipient type
  IF p_recipient_type = 'tenant' THEN
    INSERT INTO cc_notification_preferences (
      tenant_id,
      email_enabled, sms_enabled, push_enabled, in_app_enabled,
      email_address, phone_number,
      digest_frequency, digest_hour, timezone,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    ) VALUES (
      p_recipient_id,
      COALESCE((p_preferences->>'email_enabled')::boolean, true),
      COALESCE((p_preferences->>'sms_enabled')::boolean, false),
      COALESCE((p_preferences->>'push_enabled')::boolean, true),
      COALESCE((p_preferences->>'in_app_enabled')::boolean, true),
      p_preferences->>'email_address',
      p_preferences->>'phone_number',
      COALESCE((p_preferences->>'digest_frequency')::digest_frequency, 'immediate'),
      COALESCE((p_preferences->>'digest_hour')::integer, 9),
      COALESCE(p_preferences->>'timezone', 'America/Vancouver'),
      COALESCE((p_preferences->>'quiet_hours_enabled')::boolean, false),
      COALESCE((p_preferences->>'quiet_hours_start')::time, '22:00'),
      COALESCE((p_preferences->>'quiet_hours_end')::time, '07:00')
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      email_enabled = COALESCE((p_preferences->>'email_enabled')::boolean, cc_notification_preferences.email_enabled),
      sms_enabled = COALESCE((p_preferences->>'sms_enabled')::boolean, cc_notification_preferences.sms_enabled),
      push_enabled = COALESCE((p_preferences->>'push_enabled')::boolean, cc_notification_preferences.push_enabled),
      in_app_enabled = COALESCE((p_preferences->>'in_app_enabled')::boolean, cc_notification_preferences.in_app_enabled),
      email_address = COALESCE(p_preferences->>'email_address', cc_notification_preferences.email_address),
      phone_number = COALESCE(p_preferences->>'phone_number', cc_notification_preferences.phone_number),
      digest_frequency = COALESCE((p_preferences->>'digest_frequency')::digest_frequency, cc_notification_preferences.digest_frequency),
      digest_hour = COALESCE((p_preferences->>'digest_hour')::integer, cc_notification_preferences.digest_hour),
      timezone = COALESCE(p_preferences->>'timezone', cc_notification_preferences.timezone),
      quiet_hours_enabled = COALESCE((p_preferences->>'quiet_hours_enabled')::boolean, cc_notification_preferences.quiet_hours_enabled),
      quiet_hours_start = COALESCE((p_preferences->>'quiet_hours_start')::time, cc_notification_preferences.quiet_hours_start),
      quiet_hours_end = COALESCE((p_preferences->>'quiet_hours_end')::time, cc_notification_preferences.quiet_hours_end),
      updated_at = now()
    RETURNING id INTO v_pref_id;
  ELSIF p_recipient_type = 'party' THEN
    INSERT INTO cc_notification_preferences (
      party_id,
      email_enabled, sms_enabled, push_enabled, in_app_enabled,
      email_address, phone_number,
      digest_frequency, digest_hour, timezone,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    ) VALUES (
      p_recipient_id,
      COALESCE((p_preferences->>'email_enabled')::boolean, true),
      COALESCE((p_preferences->>'sms_enabled')::boolean, false),
      COALESCE((p_preferences->>'push_enabled')::boolean, true),
      COALESCE((p_preferences->>'in_app_enabled')::boolean, true),
      p_preferences->>'email_address',
      p_preferences->>'phone_number',
      COALESCE((p_preferences->>'digest_frequency')::digest_frequency, 'immediate'),
      COALESCE((p_preferences->>'digest_hour')::integer, 9),
      COALESCE(p_preferences->>'timezone', 'America/Vancouver'),
      COALESCE((p_preferences->>'quiet_hours_enabled')::boolean, false),
      COALESCE((p_preferences->>'quiet_hours_start')::time, '22:00'),
      COALESCE((p_preferences->>'quiet_hours_end')::time, '07:00')
    )
    ON CONFLICT (party_id) DO UPDATE SET
      email_enabled = COALESCE((p_preferences->>'email_enabled')::boolean, cc_notification_preferences.email_enabled),
      sms_enabled = COALESCE((p_preferences->>'sms_enabled')::boolean, cc_notification_preferences.sms_enabled),
      push_enabled = COALESCE((p_preferences->>'push_enabled')::boolean, cc_notification_preferences.push_enabled),
      in_app_enabled = COALESCE((p_preferences->>'in_app_enabled')::boolean, cc_notification_preferences.in_app_enabled),
      email_address = COALESCE(p_preferences->>'email_address', cc_notification_preferences.email_address),
      phone_number = COALESCE(p_preferences->>'phone_number', cc_notification_preferences.phone_number),
      digest_frequency = COALESCE((p_preferences->>'digest_frequency')::digest_frequency, cc_notification_preferences.digest_frequency),
      digest_hour = COALESCE((p_preferences->>'digest_hour')::integer, cc_notification_preferences.digest_hour),
      timezone = COALESCE(p_preferences->>'timezone', cc_notification_preferences.timezone),
      quiet_hours_enabled = COALESCE((p_preferences->>'quiet_hours_enabled')::boolean, cc_notification_preferences.quiet_hours_enabled),
      quiet_hours_start = COALESCE((p_preferences->>'quiet_hours_start')::time, cc_notification_preferences.quiet_hours_start),
      quiet_hours_end = COALESCE((p_preferences->>'quiet_hours_end')::time, cc_notification_preferences.quiet_hours_end),
      updated_at = now()
    RETURNING id INTO v_pref_id;
  ELSIF p_recipient_type = 'individual' THEN
    INSERT INTO cc_notification_preferences (
      individual_id,
      email_enabled, sms_enabled, push_enabled, in_app_enabled,
      email_address, phone_number,
      digest_frequency, digest_hour, timezone,
      quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    ) VALUES (
      p_recipient_id,
      COALESCE((p_preferences->>'email_enabled')::boolean, true),
      COALESCE((p_preferences->>'sms_enabled')::boolean, false),
      COALESCE((p_preferences->>'push_enabled')::boolean, true),
      COALESCE((p_preferences->>'in_app_enabled')::boolean, true),
      p_preferences->>'email_address',
      p_preferences->>'phone_number',
      COALESCE((p_preferences->>'digest_frequency')::digest_frequency, 'immediate'),
      COALESCE((p_preferences->>'digest_hour')::integer, 9),
      COALESCE(p_preferences->>'timezone', 'America/Vancouver'),
      COALESCE((p_preferences->>'quiet_hours_enabled')::boolean, false),
      COALESCE((p_preferences->>'quiet_hours_start')::time, '22:00'),
      COALESCE((p_preferences->>'quiet_hours_end')::time, '07:00')
    )
    ON CONFLICT (individual_id) DO UPDATE SET
      email_enabled = COALESCE((p_preferences->>'email_enabled')::boolean, cc_notification_preferences.email_enabled),
      sms_enabled = COALESCE((p_preferences->>'sms_enabled')::boolean, cc_notification_preferences.sms_enabled),
      push_enabled = COALESCE((p_preferences->>'push_enabled')::boolean, cc_notification_preferences.push_enabled),
      in_app_enabled = COALESCE((p_preferences->>'in_app_enabled')::boolean, cc_notification_preferences.in_app_enabled),
      email_address = COALESCE(p_preferences->>'email_address', cc_notification_preferences.email_address),
      phone_number = COALESCE(p_preferences->>'phone_number', cc_notification_preferences.phone_number),
      digest_frequency = COALESCE((p_preferences->>'digest_frequency')::digest_frequency, cc_notification_preferences.digest_frequency),
      digest_hour = COALESCE((p_preferences->>'digest_hour')::integer, cc_notification_preferences.digest_hour),
      timezone = COALESCE(p_preferences->>'timezone', cc_notification_preferences.timezone),
      quiet_hours_enabled = COALESCE((p_preferences->>'quiet_hours_enabled')::boolean, cc_notification_preferences.quiet_hours_enabled),
      quiet_hours_start = COALESCE((p_preferences->>'quiet_hours_start')::time, cc_notification_preferences.quiet_hours_start),
      quiet_hours_end = COALESCE((p_preferences->>'quiet_hours_end')::time, cc_notification_preferences.quiet_hours_end),
      updated_at = now()
    RETURNING id INTO v_pref_id;
  ELSE
    RAISE EXCEPTION 'INVALID_RECIPIENT_TYPE: Must be tenant, party, or individual';
  END IF;
  
  RETURN jsonb_build_object('success', true, 'id', v_pref_id);
END;
$$;

-- ============================================================
-- 14) SEED NOTIFICATION TEMPLATES
-- ============================================================

INSERT INTO cc_notification_templates (code, name, category, subject_template, body_template, short_body_template, default_channels, default_priority, is_actionable, action_url_template, action_label)
VALUES
  -- Invitation notifications
  ('invitation_received', 'Invitation Received', 'invitation',
   'You''ve been invited to {{context_name}}',
   'You''ve received an invitation to join {{context_name}} as a {{invitee_role}}. Click below to accept.',
   'Invitation to {{context_name}}',
   '{in_app,email}', 'normal', true, '/claim/{{claim_token}}', 'Accept Invitation'),
  
  ('invitation_accepted', 'Invitation Accepted', 'invitation',
   '{{invitee_name}} accepted your invitation',
   '{{invitee_name}} has accepted your invitation to {{context_name}}.',
   '{{invitee_name}} accepted',
   '{in_app}', 'normal', true, '/{{context_type}}/{{context_id}}', 'View'),
  
  -- Job notifications
  ('job_application_received', 'New Job Application', 'job',
   'New application for {{job_title}}',
   '{{applicant_name}} has applied for your job posting: {{job_title}}.',
   'New application: {{job_title}}',
   '{in_app,email}', 'normal', true, '/jobs/{{job_id}}/applications', 'View Applications'),
  
  ('job_application_status', 'Application Status Update', 'job',
   'Update on your application for {{job_title}}',
   'Your application for {{job_title}} has been {{status}}.',
   'Application {{status}}: {{job_title}}',
   '{in_app,email}', 'normal', true, '/applications/{{application_id}}', 'View'),
  
  -- Moderation notifications
  ('content_approved', 'Content Approved', 'moderation',
   'Your {{content_type}} has been approved',
   'Your {{content_type}} "{{content_name}}" has been approved and is now live.',
   '{{content_type}} approved',
   '{in_app}', 'normal', true, '/{{content_type}}/{{content_id}}', 'View'),
  
  ('moderation_required', 'Moderation Required', 'moderation',
   'New content requires moderation',
   'A new {{content_type}} from {{submitter_name}} requires moderation.',
   'Moderation needed',
   '{in_app,email}', 'high', true, '/moderation/queue', 'Review'),
  
  -- Onboarding notifications
  ('onboarding_reminder', 'Complete Your Setup', 'onboarding',
   'Complete your {{flow_name}} setup',
   'You''re almost done! Complete your {{flow_name}} setup to unlock all features.',
   'Complete setup',
   '{in_app,email}', 'normal', true, '/onboarding', 'Continue Setup'),
  
  -- System notifications
  ('welcome', 'Welcome', 'system',
   'Welcome to Community Canvas!',
   'Welcome to Community Canvas! We''re excited to have you. Get started by completing your profile.',
   'Welcome!',
   '{in_app,email}', 'normal', true, '/onboarding', 'Get Started'),
  
  ('system_alert', 'System Alert', 'alert',
   '{{alert_title}}',
   '{{alert_message}}',
   '{{alert_title}}',
   '{in_app}', 'high', false, NULL, NULL),
  
  -- Reminder notifications
  ('action_reminder', 'Reminder', 'reminder',
   'Reminder: {{reminder_title}}',
   '{{reminder_message}}',
   '{{reminder_title}}',
   '{in_app,push}', 'normal', true, '{{action_url}}', '{{action_label}}')
ON CONFLICT (code) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  short_body_template = EXCLUDED.short_body_template,
  updated_at = now();

COMMIT;

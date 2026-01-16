-- P2.11: Anonymous Interest Groups + Threshold Triggers
-- Enables class-action style onboarding with anonymity until threshold triggers

-- 1) cc_interest_groups - Group configuration
CREATE TABLE IF NOT EXISTS cc_interest_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid NULL,
  circle_id uuid NULL,
  group_type text NOT NULL CHECK (group_type IN ('class_action', 'insurance_mass_claim', 'regulatory_petition', 'community_issue', 'other')),
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triggered', 'closed')),
  anonymity_mode text NOT NULL DEFAULT 'strict' CHECK (anonymity_mode IN ('strict', 'relaxed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_individual_id uuid NULL,
  triggered_at timestamptz NULL,
  trigger_reason text NULL,
  triggered_bundle_id uuid NULL,
  triggered_hold_id uuid NULL,
  triggered_grant_id uuid NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_interest_groups_tenant_status ON cc_interest_groups(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_interest_groups_tenant_created ON cc_interest_groups(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_groups_client_request ON cc_interest_groups(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- 2) cc_interest_group_triggers - Trigger conditions
CREATE TABLE IF NOT EXISTS cc_interest_group_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES cc_interest_groups(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('headcount', 'geo_quorum', 'time_window', 'composite')),
  params jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interest_group_triggers_group ON cc_interest_group_triggers(tenant_id, group_id);

-- 3) cc_interest_group_signals - Anonymous signals (SENSITIVE)
CREATE TABLE IF NOT EXISTS cc_interest_group_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES cc_interest_groups(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  signal_status text NOT NULL DEFAULT 'active' CHECK (signal_status IN ('active', 'withdrawn')),
  anonymized_handle text NOT NULL,
  contact_channel text NULL,
  contact_encrypted text NULL,
  geo_key text NULL,
  geo_value text NULL,
  proof_evidence_bundle_id uuid NULL,
  signal_hash text NOT NULL,
  client_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_interest_group_signals_group ON cc_interest_group_signals(tenant_id, group_id, submitted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_group_signals_client_request ON cc_interest_group_signals(tenant_id, group_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interest_group_signals_geo ON cc_interest_group_signals(tenant_id, group_id, geo_key, geo_value);

-- 4) cc_interest_group_events - Audit log (append-only)
CREATE TABLE IF NOT EXISTS cc_interest_group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES cc_interest_groups(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('group_created', 'signal_received', 'signal_withdrawn', 'trigger_evaluated', 'triggered', 'closed', 'access_denied')),
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_individual_id uuid NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_interest_group_events_group ON cc_interest_group_events(tenant_id, group_id, event_at DESC);

-- Enable RLS on all tables
ALTER TABLE cc_interest_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_interest_group_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_interest_group_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_interest_group_events ENABLE ROW LEVEL SECURITY;

-- Force RLS on events (append-only audit)
ALTER TABLE cc_interest_group_events FORCE ROW LEVEL SECURITY;

-- RLS Policies for cc_interest_groups
CREATE POLICY interest_groups_service_bypass ON cc_interest_groups
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY interest_groups_tenant_read ON cc_interest_groups
  FOR SELECT
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  );

CREATE POLICY interest_groups_tenant_write ON cc_interest_groups
  FOR INSERT
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  );

CREATE POLICY interest_groups_tenant_update ON cc_interest_groups
  FOR UPDATE
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  );

-- RLS Policies for cc_interest_group_triggers
CREATE POLICY triggers_service_bypass ON cc_interest_group_triggers
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY triggers_tenant_access ON cc_interest_group_triggers
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  );

-- RLS Policies for cc_interest_group_signals (STRICT - no direct reads in strict mode)
CREATE POLICY signals_service_bypass ON cc_interest_group_signals
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

-- Signals can only be read via service mode or aggregation functions
-- No direct tenant read access to protect anonymity

-- RLS Policies for cc_interest_group_events (append-only)
CREATE POLICY events_service_bypass ON cc_interest_group_events
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

CREATE POLICY events_tenant_read ON cc_interest_group_events
  FOR SELECT
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR is_service_mode()
  );

CREATE POLICY events_insert_only ON cc_interest_group_events
  FOR INSERT
  WITH CHECK (is_service_mode());

-- Prevent updates/deletes on events (append-only)
CREATE POLICY events_no_update ON cc_interest_group_events
  FOR UPDATE
  USING (false);

CREATE POLICY events_no_delete ON cc_interest_group_events
  FOR DELETE
  USING (false);

-- SECURITY DEFINER function for public signal submission
CREATE OR REPLACE FUNCTION cc_submit_anonymous_signal(
  p_tenant_id uuid,
  p_group_id uuid,
  p_anonymized_handle text,
  p_signal_hash text,
  p_client_request_id text DEFAULT NULL,
  p_geo_key text DEFAULT NULL,
  p_geo_value text DEFAULT NULL,
  p_contact_channel text DEFAULT NULL,
  p_contact_encrypted text DEFAULT NULL,
  p_proof_bundle_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_signal_id uuid;
  v_existing_id uuid;
BEGIN
  -- Check group exists and is open
  SELECT * INTO v_group
  FROM cc_interest_groups
  WHERE id = p_group_id AND tenant_id = p_tenant_id;
  
  IF v_group IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GROUP_NOT_FOUND');
  END IF;
  
  IF v_group.status != 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GROUP_NOT_OPEN');
  END IF;
  
  -- Idempotency check
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM cc_interest_group_signals
    WHERE tenant_id = p_tenant_id
      AND group_id = p_group_id
      AND client_request_id = p_client_request_id;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'anonymized_handle', p_anonymized_handle, 'idempotent', true);
    END IF;
  END IF;
  
  -- Insert signal
  INSERT INTO cc_interest_group_signals (
    tenant_id, group_id, anonymized_handle, signal_hash,
    client_request_id, geo_key, geo_value,
    contact_channel, contact_encrypted, proof_evidence_bundle_id, metadata
  )
  VALUES (
    p_tenant_id, p_group_id, p_anonymized_handle, p_signal_hash,
    p_client_request_id, p_geo_key, p_geo_value,
    p_contact_channel, p_contact_encrypted, p_proof_bundle_id, p_metadata
  )
  RETURNING id INTO v_signal_id;
  
  -- Log event
  INSERT INTO cc_interest_group_events (
    tenant_id, group_id, event_type, event_payload
  )
  VALUES (
    p_tenant_id, p_group_id, 'signal_received',
    jsonb_build_object('signal_id', v_signal_id, 'has_geo', p_geo_key IS NOT NULL, 'has_proof', p_proof_bundle_id IS NOT NULL)
  );
  
  RETURN jsonb_build_object('ok', true, 'anonymized_handle', p_anonymized_handle);
END;
$$;

-- SECURITY DEFINER function for signal withdrawal (non-enumerable)
CREATE OR REPLACE FUNCTION cc_withdraw_anonymous_signal(
  p_tenant_id uuid,
  p_group_id uuid,
  p_client_request_id text,
  p_anonymized_handle text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  -- Update if exists (non-enumerable: always return ok)
  UPDATE cc_interest_group_signals
  SET signal_status = 'withdrawn'
  WHERE tenant_id = p_tenant_id
    AND group_id = p_group_id
    AND client_request_id = p_client_request_id
    AND anonymized_handle = p_anonymized_handle
    AND signal_status = 'active';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Log event if actually withdrawn
  IF v_updated > 0 THEN
    INSERT INTO cc_interest_group_events (
      tenant_id, group_id, event_type, event_payload
    )
    VALUES (
      p_tenant_id, p_group_id, 'signal_withdrawn',
      jsonb_build_object('anonymized_handle', p_anonymized_handle)
    );
  END IF;
  
  -- Always return ok (anti-enumeration)
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Aggregation function with k-anonymity
CREATE OR REPLACE FUNCTION cc_get_group_aggregates(
  p_tenant_id uuid,
  p_group_id uuid,
  p_k_threshold int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_geo_buckets jsonb;
  v_group record;
BEGIN
  -- Get group
  SELECT * INTO v_group
  FROM cc_interest_groups
  WHERE id = p_group_id AND tenant_id = p_tenant_id;
  
  IF v_group IS NULL THEN
    RETURN jsonb_build_object('error', 'GROUP_NOT_FOUND');
  END IF;
  
  -- Get total active signals
  SELECT COUNT(*) INTO v_total
  FROM cc_interest_group_signals
  WHERE tenant_id = p_tenant_id
    AND group_id = p_group_id
    AND signal_status = 'active';
  
  -- Get geo buckets with k-anonymity
  SELECT jsonb_agg(
    CASE
      WHEN cnt >= p_k_threshold THEN
        jsonb_build_object('geo_key', geo_key, 'geo_value', geo_value, 'count', cnt)
      ELSE
        jsonb_build_object('geo_key', geo_key, 'geo_value', geo_value, 'count', '<' || p_k_threshold::text)
    END
  ) INTO v_geo_buckets
  FROM (
    SELECT geo_key, geo_value, COUNT(*) as cnt
    FROM cc_interest_group_signals
    WHERE tenant_id = p_tenant_id
      AND group_id = p_group_id
      AND signal_status = 'active'
      AND geo_key IS NOT NULL
    GROUP BY geo_key, geo_value
  ) geo;
  
  RETURN jsonb_build_object(
    'total_signals', v_total,
    'geo_buckets', COALESCE(v_geo_buckets, '[]'::jsonb),
    'status', v_group.status,
    'anonymity_mode', v_group.anonymity_mode
  );
END;
$$;

-- Comment on tables
COMMENT ON TABLE cc_interest_groups IS 'P2.11: Anonymous interest group configuration';
COMMENT ON TABLE cc_interest_group_triggers IS 'P2.11: Trigger conditions for interest groups';
COMMENT ON TABLE cc_interest_group_signals IS 'P2.11: Anonymous signals of interest (SENSITIVE)';
COMMENT ON TABLE cc_interest_group_events IS 'P2.11: Append-only audit log for interest groups';

-- ============================================================
-- MIGRATION 103: VALUE EVENTS & LEDGER (FUNCTIONS-ONLY)
-- Part of Prompt 24B/24C - Monetization Infrastructure
-- ============================================================

BEGIN;

-- ============================================================
-- 1) VALUE EVENTS (Billable Moments)
-- Every monetizable moment is logged here
-- ============================================================

DO $$ BEGIN
  CREATE TYPE value_event_type AS ENUM (
    -- Contractor events
    'worker_placed',
    'run_filled',
    'emergency_replacement',
    'materials_routed',
    
    -- Inventory events
    'occupancy_unlocked',
    'bundle_confirmed',
    
    -- Coordinator events
    'cross_tenant_reservation',
    'incident_resolved',
    
    -- PIC events
    'turnover_orchestrated',
    'workforce_cluster',
    'housing_bundle',
    'emergency_coverage',
    
    -- System events
    'subscription_charge',
    'usage_overage',
    'premium_feature',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_value_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event type
  event_type value_event_type NOT NULL,
  event_code text,
  
  -- Who
  tenant_id uuid REFERENCES cc_tenants(id),
  party_id uuid REFERENCES cc_parties(id),
  individual_id uuid REFERENCES cc_individuals(id),
  actor_type_id uuid REFERENCES cc_actor_types(id),
  
  -- Context
  related_entity_type text,
  related_entity_id uuid,
  
  -- Value
  base_amount numeric NOT NULL DEFAULT 0,
  scarcity_multiplier numeric DEFAULT 1.0,
  urgency_multiplier numeric DEFAULT 1.0,
  final_amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'CAD',
  
  -- Billing
  is_billable boolean NOT NULL DEFAULT true,
  is_billed boolean DEFAULT false,
  billed_at timestamptz,
  ledger_entry_id uuid,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  waived boolean DEFAULT false,
  waived_reason text,
  waived_by_user_id uuid REFERENCES cc_user_profiles(id),
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_value_events_tenant ON cc_value_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_value_events_party ON cc_value_events(party_id);
CREATE INDEX IF NOT EXISTS idx_cc_value_events_type ON cc_value_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cc_value_events_status ON cc_value_events(status);
CREATE INDEX IF NOT EXISTS idx_cc_value_events_billable ON cc_value_events(is_billable, is_billed) WHERE is_billable = true;
CREATE INDEX IF NOT EXISTS idx_cc_value_events_occurred ON cc_value_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_cc_value_events_related ON cc_value_events(related_entity_type, related_entity_id);

-- Enable RLS
ALTER TABLE cc_value_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_value_events_service_bypass ON cc_value_events
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

CREATE POLICY cc_value_events_tenant_read ON cc_value_events
  FOR SELECT
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ============================================================
-- 2) LEDGER ENTRIES (Financial Record)
-- Append-only financial ledger
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ledger_entry_type AS ENUM (
    'charge',
    'payment',
    'credit',
    'adjustment',
    'refund',
    'writeoff'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cc_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who
  tenant_id uuid REFERENCES cc_tenants(id),
  party_id uuid REFERENCES cc_parties(id),
  individual_id uuid REFERENCES cc_individuals(id),
  
  -- Entry type
  entry_type ledger_entry_type NOT NULL,
  
  -- Amounts
  amount numeric NOT NULL,
  currency text DEFAULT 'CAD',
  
  -- Description
  description text NOT NULL,
  line_item_code text,
  
  -- Source
  source_type text,
  source_id uuid,
  value_event_id uuid REFERENCES cc_value_events(id),
  
  -- Period
  period_start date,
  period_end date,
  
  -- Invoice reference (for grouping)
  invoice_number text,
  invoice_date date,
  
  -- Payment reference
  payment_method text,
  payment_reference text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps (append-only - no updated_at)
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT ledger_has_owner CHECK (
    tenant_id IS NOT NULL OR party_id IS NOT NULL OR individual_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_tenant ON cc_ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_party ON cc_ledger_entries(party_id);
CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_type ON cc_ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_status ON cc_ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_invoice ON cc_ledger_entries(invoice_number);
CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_value_event ON cc_ledger_entries(value_event_id);
CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_created ON cc_ledger_entries(created_at);

-- Enable RLS
ALTER TABLE cc_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_ledger_entries_service_bypass ON cc_ledger_entries
  FOR ALL
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
  WITH CHECK (current_setting('app.tenant_id', true) = '__SERVICE__');

CREATE POLICY cc_ledger_entries_tenant_read ON cc_ledger_entries
  FOR SELECT
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ============================================================
-- 3) HELPER FUNCTION: cc_has_entitlement
-- Check if tenant has a boolean entitlement
-- ============================================================

CREATE OR REPLACE FUNCTION cc_has_entitlement(
  p_tenant_id uuid,
  p_entitlement_key text
) RETURNS boolean AS $$
DECLARE
  v_result boolean;
BEGIN
  -- Check if tenant has active subscription with this entitlement
  SELECT pe.boolean_value INTO v_result
  FROM cc_subscriptions s
  JOIN cc_plans p ON s.plan_id = p.id
  JOIN cc_plan_entitlements pe ON pe.plan_id = p.id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND pe.entitlement_key = p_entitlement_key
    AND pe.value_type = 'boolean'
  LIMIT 1;
  
  RETURN COALESCE(v_result, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 4) HELPER FUNCTION: cc_entitlement_value
-- Get numeric entitlement value (NULL = unlimited)
-- ============================================================

CREATE OR REPLACE FUNCTION cc_entitlement_value(
  p_tenant_id uuid,
  p_entitlement_key text
) RETURNS integer AS $$
DECLARE
  v_result integer;
BEGIN
  SELECT pe.numeric_value INTO v_result
  FROM cc_subscriptions s
  JOIN cc_plans p ON s.plan_id = p.id
  JOIN cc_plan_entitlements pe ON pe.plan_id = p.id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
    AND pe.entitlement_key = p_entitlement_key
    AND pe.value_type = 'numeric'
  ORDER BY pe.numeric_value DESC NULLS FIRST
  LIMIT 1;
  
  RETURN v_result; -- NULL means unlimited
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 5) HELPER FUNCTION: cc_record_value_event
-- Record a value event and optionally create ledger entry
-- Returns the value_event_id
-- ============================================================

CREATE OR REPLACE FUNCTION cc_record_value_event(
  p_event_type value_event_type,
  p_tenant_id uuid,
  p_actor_type_id uuid,
  p_base_amount numeric,
  p_description text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_scarcity_multiplier numeric DEFAULT 1.0,
  p_urgency_multiplier numeric DEFAULT 1.0,
  p_metadata jsonb DEFAULT '{}',
  p_create_ledger_entry boolean DEFAULT true
) RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
  v_ledger_id uuid;
  v_final_amount numeric;
BEGIN
  -- Calculate final amount
  v_final_amount := p_base_amount * p_scarcity_multiplier * p_urgency_multiplier;
  
  -- Insert value event
  INSERT INTO cc_value_events (
    event_type,
    tenant_id,
    actor_type_id,
    base_amount,
    scarcity_multiplier,
    urgency_multiplier,
    final_amount,
    related_entity_type,
    related_entity_id,
    metadata,
    status
  ) VALUES (
    p_event_type,
    p_tenant_id,
    p_actor_type_id,
    p_base_amount,
    p_scarcity_multiplier,
    p_urgency_multiplier,
    v_final_amount,
    p_related_entity_type,
    p_related_entity_id,
    p_metadata,
    'recorded'
  ) RETURNING id INTO v_event_id;
  
  -- Create ledger entry if requested and amount > 0
  IF p_create_ledger_entry AND v_final_amount > 0 THEN
    INSERT INTO cc_ledger_entries (
      tenant_id,
      entry_type,
      amount,
      description,
      source_type,
      source_id,
      value_event_id,
      status
    ) VALUES (
      p_tenant_id,
      'charge',
      v_final_amount,
      p_description,
      'value_event',
      v_event_id,
      v_event_id,
      'pending'
    ) RETURNING id INTO v_ledger_id;
    
    -- Update value event with ledger reference
    UPDATE cc_value_events 
    SET ledger_entry_id = v_ledger_id,
        is_billed = true,
        billed_at = now()
    WHERE id = v_event_id;
  END IF;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6) HELPER FUNCTION: cc_tenant_balance
-- Get current balance for a tenant
-- ============================================================

CREATE OR REPLACE FUNCTION cc_tenant_balance(p_tenant_id uuid)
RETURNS numeric AS $$
DECLARE
  v_charges numeric;
  v_credits numeric;
BEGIN
  -- Sum all charges
  SELECT COALESCE(SUM(amount), 0) INTO v_charges
  FROM cc_ledger_entries
  WHERE tenant_id = p_tenant_id
    AND entry_type IN ('charge')
    AND status != 'voided';
  
  -- Sum all credits/payments
  SELECT COALESCE(SUM(amount), 0) INTO v_credits
  FROM cc_ledger_entries
  WHERE tenant_id = p_tenant_id
    AND entry_type IN ('payment', 'credit', 'refund', 'adjustment', 'writeoff')
    AND status != 'voided';
  
  RETURN v_charges - v_credits;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 7) GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_value_events TO cc_app;
GRANT SELECT, INSERT ON cc_ledger_entries TO cc_app;
GRANT EXECUTE ON FUNCTION cc_has_entitlement TO cc_app;
GRANT EXECUTE ON FUNCTION cc_entitlement_value TO cc_app;
GRANT EXECUTE ON FUNCTION cc_record_value_event TO cc_app;
GRANT EXECUTE ON FUNCTION cc_tenant_balance TO cc_app;

-- ============================================================
-- 8) COMMENTS
-- ============================================================

COMMENT ON TYPE value_event_type IS '
Event pricing reference (base amounts):
- worker_placed: $75
- run_filled: $35
- emergency_replacement: $200 (supports scarcity multiplier)
- materials_routed: $50
- occupancy_unlocked: 5% of incremental revenue
- bundle_confirmed: $15
- cross_tenant_reservation: $20
- incident_resolved: $50 (supports scarcity multiplier)
- turnover_orchestrated: $10
- workforce_cluster: $250
- housing_bundle: $50
- emergency_coverage: $100 (supports scarcity multiplier)
- subscription_charge: varies by plan
- usage_overage: varies
- premium_feature: varies
';

COMMIT;

-- V3.3.1 Block 02: Participation Mode + Payment Abstraction
-- Creates payment reference tracking (NO payment processing) and federation agreements

-- ============================================================================
-- TABLES
-- ============================================================================

-- Payment References - external payment tracking (CC never processes payments)
CREATE TABLE IF NOT EXISTS cc_payment_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES cc_reservations(id) ON DELETE CASCADE,
  
  provider_name TEXT NOT NULL, -- 'Square', 'Moneris', 'Cash', 'E-Transfer', 'Invoice'
  external_reference TEXT, -- receipt #, confirmation id
  
  amount_cents INTEGER NOT NULL,
  currency CHAR(3) DEFAULT 'CAD',
  
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
  
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES cc_individuals(id),
  notes TEXT
);

-- Federation Agreements - cross-tenant resource sharing
CREATE TABLE IF NOT EXISTS cc_federation_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  provider_tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  consumer_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  scopes TEXT[] NOT NULL DEFAULT '{}',
  
  share_availability BOOLEAN DEFAULT false,
  allow_booking_requests BOOLEAN DEFAULT true,
  allow_incident_ops BOOLEAN DEFAULT false,
  anonymize_public BOOLEAN DEFAULT true,
  requires_provider_confirmation BOOLEAN DEFAULT true,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Ledger - audit trail for all significant actions
CREATE TABLE IF NOT EXISTS cc_activity_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  tenant_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
  community_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  actor_identity_id UUID REFERENCES cc_individuals(id) ON DELETE SET NULL,
  actor_tenant_id UUID REFERENCES cc_tenants(id) ON DELETE SET NULL,
  
  action VARCHAR(128) NOT NULL,
  
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  
  correlation_id UUID,
  
  payload JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- EXTEND cc_assets with participation_mode
-- ============================================================================

ALTER TABLE cc_assets 
  ADD COLUMN IF NOT EXISTS participation_mode cc_participation_mode NOT NULL DEFAULT 'requests_only';

-- ============================================================================
-- EXTEND cc_reservations with payment tracking
-- ============================================================================

-- payment_status already exists, update the check constraint if needed
DO $$ BEGIN
  ALTER TABLE cc_reservations DROP CONSTRAINT IF EXISTS cc_reservations_payment_status_check;
  ALTER TABLE cc_reservations 
    ADD CONSTRAINT cc_reservations_payment_status_check 
    CHECK (payment_status IS NULL OR payment_status IN ('not_applicable', 'unknown', 'pending', 'paid_external', 'invoiced', 'refunded_external', 'paid', 'partial', 'failed', 'refunded', 'waived'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE cc_reservations 
  ADD COLUMN IF NOT EXISTS external_payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bundle_id UUID,
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES cc_tenants(id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS cc_payment_references_tenant_idx 
  ON cc_payment_references(tenant_id);

CREATE INDEX IF NOT EXISTS cc_payment_references_reservation_idx 
  ON cc_payment_references(reservation_id);

CREATE INDEX IF NOT EXISTS cc_federation_agreements_provider_idx 
  ON cc_federation_agreements(provider_tenant_id);

CREATE INDEX IF NOT EXISTS cc_federation_agreements_community_idx 
  ON cc_federation_agreements(community_id);

CREATE INDEX IF NOT EXISTS cc_federation_agreements_consumer_idx 
  ON cc_federation_agreements(consumer_tenant_id);

CREATE INDEX IF NOT EXISTS cc_activity_ledger_tenant_idx 
  ON cc_activity_ledger(tenant_id);

CREATE INDEX IF NOT EXISTS cc_activity_ledger_community_idx 
  ON cc_activity_ledger(community_id);

CREATE INDEX IF NOT EXISTS cc_activity_ledger_entity_idx 
  ON cc_activity_ledger(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS cc_activity_ledger_action_idx 
  ON cc_activity_ledger(action);

CREATE INDEX IF NOT EXISTS cc_activity_ledger_correlation_idx 
  ON cc_activity_ledger(correlation_id);

CREATE INDEX IF NOT EXISTS cc_assets_participation_mode_idx 
  ON cc_assets(participation_mode);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE cc_payment_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_federation_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_activity_ledger ENABLE ROW LEVEL SECURITY;

-- Payment References RLS
DROP POLICY IF EXISTS cc_payment_references_tenant_isolation ON cc_payment_references;
CREATE POLICY cc_payment_references_tenant_isolation ON cc_payment_references
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Federation Agreements RLS (provider OR consumer can see)
DROP POLICY IF EXISTS cc_federation_agreements_tenant_isolation ON cc_federation_agreements;
CREATE POLICY cc_federation_agreements_tenant_isolation ON cc_federation_agreements
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR provider_tenant_id::text = current_setting('app.tenant_id', true)
    OR consumer_tenant_id::text = current_setting('app.tenant_id', true)
    OR community_id::text = current_setting('app.tenant_id', true)
  );

-- Activity Ledger RLS
DROP POLICY IF EXISTS cc_activity_ledger_tenant_isolation ON cc_activity_ledger;
CREATE POLICY cc_activity_ledger_tenant_isolation ON cc_activity_ledger
  FOR ALL
  USING (
    current_setting('app.tenant_id', true) = '__SERVICE__'
    OR tenant_id::text = current_setting('app.tenant_id', true)
    OR community_id::text = current_setting('app.tenant_id', true)
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON cc_payment_references TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_federation_agreements TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_activity_ledger TO PUBLIC;

-- ============================================================================
-- MIGRATION 143: JOB PUBLICATION INTENT - GENERAL LEDGER INTEGRATION
-- Purpose:
--   Link cc_paid_publication_intents to cc_ledger_entries for full accounting
--   Add append-only state transition audit table
--   Enable receipt-grade artifact generation
--
-- Hard rules:
--   - ADDITIVE ONLY - no column drops, no table drops
--   - Tenant isolation via current_tenant_id() / is_service_mode()
--   - RLS enabled on new tables
--   - No changes to hospitality folios or wallet ledger
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) ADD LEDGER LINK COLUMNS TO cc_paid_publication_intents
-- These allow direct navigation from intent to its GL entries
-- ============================================================================

ALTER TABLE cc_paid_publication_intents
  ADD COLUMN IF NOT EXISTS ledger_charge_entry_id UUID REFERENCES cc_ledger_entries(id),
  ADD COLUMN IF NOT EXISTS ledger_payment_entry_id UUID REFERENCES cc_ledger_entries(id),
  ADD COLUMN IF NOT EXISTS ledger_refund_entry_id UUID REFERENCES cc_ledger_entries(id);

COMMENT ON COLUMN cc_paid_publication_intents.ledger_charge_entry_id IS 'GL entry for the charge posted when intent is created';
COMMENT ON COLUMN cc_paid_publication_intents.ledger_payment_entry_id IS 'GL entry for the payment posted when intent is marked paid';
COMMENT ON COLUMN cc_paid_publication_intents.ledger_refund_entry_id IS 'GL entry for the refund posted when intent is refunded';

-- ============================================================================
-- 2) ADD INDEXES TO cc_ledger_entries FOR source_type/source_id LOOKUP
-- Enables efficient querying by reference (paid_publication_intent, etc.)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_source
  ON cc_ledger_entries(source_type, source_id)
  WHERE source_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_ledger_entries_tenant_source
  ON cc_ledger_entries(tenant_id, source_type, source_id)
  WHERE source_type IS NOT NULL;

-- ============================================================================
-- 3) CREATE cc_paid_publication_intent_events (APPEND-ONLY AUDIT)
-- Records every state transition for audit/compliance/receipt
-- ============================================================================

CREATE TABLE IF NOT EXISTS cc_paid_publication_intent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
  intent_id UUID NOT NULL REFERENCES cc_paid_publication_intents(id) ON DELETE CASCADE,
  
  from_status TEXT,
  to_status TEXT NOT NULL,
  
  actor_individual_id UUID REFERENCES cc_individuals(id),
  actor_identity_id UUID,
  
  event_type TEXT NOT NULL,
  note TEXT,
  
  ledger_entry_id UUID REFERENCES cc_ledger_entries(id),
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppi_events_intent ON cc_paid_publication_intent_events(intent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ppi_events_tenant ON cc_paid_publication_intent_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ppi_events_type ON cc_paid_publication_intent_events(event_type);

COMMENT ON TABLE cc_paid_publication_intent_events IS 'Append-only audit log for paid publication intent state transitions';
COMMENT ON COLUMN cc_paid_publication_intent_events.event_type IS 'Event types: intent_created, charge_posted, payment_recorded, refund_processed, status_changed';

-- ============================================================================
-- 4) RLS POLICIES FOR cc_paid_publication_intent_events
-- Append-only: SELECT + INSERT only, no UPDATE/DELETE
-- ============================================================================

ALTER TABLE cc_paid_publication_intent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ppi_events_service_bypass ON cc_paid_publication_intent_events;
CREATE POLICY ppi_events_service_bypass ON cc_paid_publication_intent_events
  FOR ALL
  USING (is_service_mode())
  WITH CHECK (is_service_mode());

DROP POLICY IF EXISTS ppi_events_tenant_select ON cc_paid_publication_intent_events;
CREATE POLICY ppi_events_tenant_select ON cc_paid_publication_intent_events
  FOR SELECT
  USING (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS ppi_events_tenant_insert ON cc_paid_publication_intent_events;
CREATE POLICY ppi_events_tenant_insert ON cc_paid_publication_intent_events
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

DROP POLICY IF EXISTS ppi_events_no_update ON cc_paid_publication_intent_events;
CREATE POLICY ppi_events_no_update ON cc_paid_publication_intent_events
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS ppi_events_no_delete ON cc_paid_publication_intent_events;
CREATE POLICY ppi_events_no_delete ON cc_paid_publication_intent_events
  FOR DELETE
  USING (false);

-- ============================================================================
-- 5) GRANTS
-- ============================================================================

GRANT SELECT, INSERT ON cc_paid_publication_intent_events TO cc_app;

COMMIT;

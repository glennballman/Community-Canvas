-- Migration 029: catalog_claim_events hardening
-- 1. Add tenant_id column for proper RLS and indexing
-- 2. Add CHECK constraint for event integrity
-- 3. Add performance indexes

BEGIN;

-- 1. Add tenant_id column (nullable for existing rows, will be populated from claim)
ALTER TABLE catalog_claim_events 
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Populate tenant_id from existing claims
UPDATE catalog_claim_events e
SET tenant_id = c.tenant_id
FROM catalog_claims c
WHERE e.claim_id = c.id AND e.tenant_id IS NULL;

-- Add FK constraint for tenant_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'catalog_claim_events_tenant_id_fkey'
  ) THEN
    ALTER TABLE catalog_claim_events
      ADD CONSTRAINT catalog_claim_events_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES cc_tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Event integrity CHECK constraint:
-- If claim_id IS NULL, event_type MUST be a service_key_* type
-- This prevents orphan events that aren't security audit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_claim_events_null_claim_requires_service_event'
  ) THEN
    ALTER TABLE catalog_claim_events
      ADD CONSTRAINT chk_claim_events_null_claim_requires_service_event
      CHECK (
        claim_id IS NOT NULL 
        OR event_type IN (
          'service_key_review_start_attempt',
          'service_key_decision_approve_attempt',
          'service_key_decision_reject_attempt'
        )
      );
  END IF;
END $$;

-- 3. Performance indexes

-- Index for tenant timeline queries (tenant dashboard)
CREATE INDEX IF NOT EXISTS idx_claim_events_tenant_time 
  ON catalog_claim_events (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Index for event type analysis (audit queries)
CREATE INDEX IF NOT EXISTS idx_claim_events_type_time 
  ON catalog_claim_events (event_type, created_at DESC);

-- Partial index for claim-specific queries (excludes security-only events)
CREATE INDEX IF NOT EXISTS idx_claim_events_claim_id_partial
  ON catalog_claim_events (claim_id)
  WHERE claim_id IS NOT NULL;

COMMIT;

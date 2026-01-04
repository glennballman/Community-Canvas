-- Migration 031: Add audit columns to catalog_claim_events
-- Required for complete audit trail with IP, user agent, endpoint, and HTTP method

BEGIN;

ALTER TABLE catalog_claim_events 
  ADD COLUMN IF NOT EXISTS ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS endpoint TEXT,
  ADD COLUMN IF NOT EXISTS http_method VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_claim_events_ip 
  ON catalog_claim_events (ip) 
  WHERE ip IS NOT NULL;

COMMIT;

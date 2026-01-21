-- Migration: Add zone_id to cc_work_requests
-- This allows work requests (intake inbox) to be assigned to portal-scoped zones

ALTER TABLE cc_work_requests 
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES cc_zones(id) ON DELETE SET NULL;

-- Index for filtering work requests by zone
CREATE INDEX IF NOT EXISTS idx_cc_work_requests_zone_id ON cc_work_requests(zone_id) WHERE zone_id IS NOT NULL;

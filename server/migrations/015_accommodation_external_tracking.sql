-- Migration 015: Add external tracking to accommodation_properties for Apify sync

ALTER TABLE accommodation_properties ADD COLUMN IF NOT EXISTS 
    external_source TEXT DEFAULT 'apify';
ALTER TABLE accommodation_properties ADD COLUMN IF NOT EXISTS 
    external_id TEXT;
ALTER TABLE accommodation_properties ADD COLUMN IF NOT EXISTS 
    external_url TEXT;
ALTER TABLE accommodation_properties ADD COLUMN IF NOT EXISTS 
    last_synced_at TIMESTAMPTZ;
ALTER TABLE accommodation_properties ADD COLUMN IF NOT EXISTS 
    matched_individual_id UUID REFERENCES cc_individuals(id);
ALTER TABLE accommodation_properties ADD COLUMN IF NOT EXISTS 
    matched_tenant_id UUID REFERENCES cc_tenants(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accommodation_external 
    ON accommodation_properties(external_source, external_id);

-- Migration 192: Portal Listings (Disclosure Substrate)
-- Purpose: Canonical table for portal-specific asset disclosure control
-- Without explicit listing, assets are NOT visible on a portal

-- Create the portal listings table
CREATE TABLE IF NOT EXISTS cc_portal_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_id UUID NOT NULL REFERENCES cc_portals(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES cc_assets(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    visibility TEXT NOT NULL DEFAULT 'public',
    display_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cc_portal_listings_portal_asset_unique UNIQUE (portal_id, asset_id),
    CONSTRAINT cc_portal_listings_visibility_check CHECK (visibility IN ('public', 'hidden'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cc_portal_listings_portal_id ON cc_portal_listings(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_portal_listings_asset_id ON cc_portal_listings(asset_id);
CREATE INDEX IF NOT EXISTS idx_cc_portal_listings_portal_active_visible 
    ON cc_portal_listings(portal_id, is_active, visibility) 
    WHERE is_active = true AND visibility = 'public';

-- Enable RLS
ALTER TABLE cc_portal_listings ENABLE ROW LEVEL SECURITY;

-- Service mode bypass (for system operations)
DROP POLICY IF EXISTS portal_listings_service_all ON cc_portal_listings;
CREATE POLICY portal_listings_service_all ON cc_portal_listings
    FOR ALL USING (is_service_mode());

-- Public read for disclosed listings
DROP POLICY IF EXISTS portal_listings_public_read ON cc_portal_listings;
CREATE POLICY portal_listings_public_read ON cc_portal_listings
    FOR SELECT USING (is_active = true AND visibility = 'public');

-- Tenant manage (portal owners can manage listings)
DROP POLICY IF EXISTS portal_listings_tenant_manage ON cc_portal_listings;
CREATE POLICY portal_listings_tenant_manage ON cc_portal_listings
    FOR ALL USING (
        portal_id IN (
            SELECT id FROM cc_portals 
            WHERE owning_tenant_id = current_setting('app.tenant_id', true)::uuid
        )
    );

COMMENT ON TABLE cc_portal_listings IS 'Disclosure substrate: controls which assets are visible on each portal. Empty = nothing disclosed.';
COMMENT ON COLUMN cc_portal_listings.visibility IS 'public = shown in search results; hidden = not shown but may exist for internal tracking';

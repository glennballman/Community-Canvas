-- =====================================================================
-- Migration 019: Extend external_records for Rental/Product Data + SQL Functions
-- Adds fields needed for STR/equipment/retail without breaking V2 architecture
-- =====================================================================

-- =====================================================================
-- 1) EXTEND external_records WITH RENTAL/PRODUCT FIELDS
-- =====================================================================

-- Pricing
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD';

-- Ratings
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2);
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS review_count INTEGER;

-- Property-specific (STR)
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS max_occupancy INTEGER;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS bathrooms DECIMAL(3,1);
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS beds INTEGER;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS property_type TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]';
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- Host info
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS host_name TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS host_id TEXT;

-- Product-specific (Canadian Tire, Home Depot)
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS in_stock BOOLEAN;

-- Contact fields (extracted, will also go to contact_points with consent=unknown)
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_records_sync_hash ON external_records(sync_hash);
CREATE INDEX IF NOT EXISTS idx_external_records_last_seen ON external_records(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_records_city ON external_records(city);
CREATE INDEX IF NOT EXISTS idx_external_records_property_type ON external_records(property_type) WHERE property_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_records_price ON external_records(price) WHERE price IS NOT NULL;

-- =====================================================================
-- 2) RESOLVE COMMUNITY FUNCTION (PostGIS with fallback)
-- =====================================================================

CREATE OR REPLACE FUNCTION resolve_community(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_city TEXT DEFAULT NULL,
    p_region TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_community_id UUID;
BEGIN
    -- First try exact city match
    IF p_city IS NOT NULL AND p_city != '' THEN
        SELECT id INTO v_community_id
        FROM sr_communities
        WHERE LOWER(name) = LOWER(TRIM(p_city))
        AND (p_region IS NULL OR p_region = '' OR LOWER(region) = LOWER(TRIM(p_region)))
        LIMIT 1;
        
        IF v_community_id IS NOT NULL THEN
            RETURN v_community_id;
        END IF;
    END IF;
    
    -- Fall back to nearest by coordinates using Euclidean distance (no PostGIS)
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        SELECT id INTO v_community_id
        FROM sr_communities
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY SQRT(POWER(latitude - p_lat, 2) + POWER(longitude - p_lng, 2))
        LIMIT 1;
    END IF;
    
    RETURN v_community_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 3) CREATE ENTITY FROM RECORD FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION create_entity_from_record(p_record_id UUID)
RETURNS UUID AS $$
DECLARE
    v_record RECORD;
    v_entity_id UUID;
    v_entity_type_id INTEGER;
BEGIN
    SELECT * INTO v_record FROM external_records WHERE id = p_record_id;
    
    IF v_record IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Map record type to entity_type_id (based on entity_types table)
    -- Using direct mapping since entity_types table uses integer ids
    SELECT et.id INTO v_entity_type_id
    FROM entity_types et
    WHERE LOWER(et.slug) = CASE v_record.record_type::text
        WHEN 'property_listing' THEN 'property'
        WHEN 'host_profile' THEN 'individual'
        WHEN 'equipment_listing' THEN 'equipment'
        WHEN 'service_provider' THEN 'business'
        WHEN 'business_listing' THEN 'business'
        WHEN 'product' THEN 'product'
        WHEN 'person_profile' THEN 'individual'
        WHEN 'poi' THEN 'place'
        ELSE 'other'
    END
    LIMIT 1;
    
    -- Default to 1 if no match
    IF v_entity_type_id IS NULL THEN
        v_entity_type_id := 1;
    END IF;
    
    -- Create entity using the existing schema columns
    INSERT INTO entities (
        entity_type_id,
        name,
        description,
        address_line1,
        city,
        province,
        country,
        latitude,
        longitude,
        community_id
    ) VALUES (
        v_entity_type_id,
        COALESCE(v_record.name, 'Unknown'),
        v_record.description,
        v_record.address,
        v_record.city,
        v_record.region,
        COALESCE(v_record.country, 'Canada'),
        v_record.latitude,
        v_record.longitude,
        v_record.community_id
    )
    RETURNING id INTO v_entity_id;
    
    -- Create accepted link
    INSERT INTO entity_links (external_record_id, entity_id, status, confidence, reasons)
    VALUES (p_record_id, v_entity_id, 'accepted', 1.0, '{"reason": "created_from_record"}'::jsonb);
    
    -- Also create contact point if email exists (with unknown consent)
    IF v_record.contact_email IS NOT NULL AND v_record.contact_email != '' THEN
        INSERT INTO external_contact_points (
            external_record_id,
            contact_type,
            contact_value,
            normalized_value,
            consent,
            do_not_contact
        ) VALUES (
            p_record_id,
            'email',
            v_record.contact_email,
            LOWER(TRIM(v_record.contact_email)),
            'unknown',
            false
        )
        ON CONFLICT (contact_type, normalized_value) DO NOTHING;
    END IF;
    
    -- Create phone contact point if exists
    IF v_record.contact_phone IS NOT NULL AND v_record.contact_phone != '' THEN
        INSERT INTO external_contact_points (
            external_record_id,
            contact_type,
            contact_value,
            normalized_value,
            consent,
            do_not_contact
        ) VALUES (
            p_record_id,
            'phone',
            v_record.contact_phone,
            REGEXP_REPLACE(v_record.contact_phone, '[^0-9]', '', 'g'),
            'unknown',
            false
        )
        ON CONFLICT (contact_type, normalized_value) DO NOTHING;
    END IF;
    
    RETURN v_entity_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 4) VIEWS
-- =====================================================================

-- Dataset sync status dashboard
CREATE OR REPLACE VIEW v_dataset_sync_status AS
SELECT 
    d.id,
    d.name,
    d.slug,
    d.source::text,
    d.record_type::text,
    d.region,
    d.sync_enabled,
    d.last_sync_at,
    d.last_sync_record_count,
    d.last_sync_error,
    (SELECT COUNT(*) FROM external_records WHERE dataset_id = d.id) as total_records,
    (SELECT COUNT(*) FROM external_records er 
     JOIN entity_links el ON el.external_record_id = er.id AND el.status = 'accepted'
     WHERE er.dataset_id = d.id) as resolved_records,
    CASE 
        WHEN d.last_sync_at IS NULL THEN 'Never synced'
        WHEN d.last_sync_at < NOW() - (d.sync_frequency_hours || ' hours')::interval THEN 'Overdue'
        ELSE 'OK'
    END as sync_health
FROM apify_datasets d
ORDER BY d.source, d.name;

-- Entity statistics by source
CREATE OR REPLACE VIEW v_entity_stats AS
SELECT 
    er.source::text,
    er.record_type::text,
    COUNT(DISTINCT er.id) as total_records,
    COUNT(DISTINCT el.entity_id) FILTER (WHERE el.status = 'accepted') as resolved_to_entities,
    COUNT(DISTINCT ec.entity_id) as claimed_entities
FROM external_records er
LEFT JOIN entity_links el ON el.external_record_id = er.id
LEFT JOIN entity_claims ec ON ec.entity_id = el.entity_id
GROUP BY er.source, er.record_type
ORDER BY er.source, er.record_type;

-- Unresolved records needing entity assignment
CREATE OR REPLACE VIEW v_unresolved_records AS
SELECT 
    er.id,
    er.source::text,
    er.record_type::text,
    er.name,
    er.city,
    er.region,
    er.community_id,
    er.price,
    er.rating,
    er.first_seen_at
FROM external_records er
WHERE NOT EXISTS (
    SELECT 1 FROM entity_links el 
    WHERE el.external_record_id = er.id AND el.status = 'accepted'
)
ORDER BY er.first_seen_at DESC;

-- Records with rental details
CREATE OR REPLACE VIEW v_rental_listings AS
SELECT 
    er.id,
    er.source::text,
    er.name,
    er.external_url,
    er.city,
    er.region,
    er.price,
    er.currency,
    er.bedrooms,
    er.bathrooms,
    er.beds,
    er.max_occupancy,
    er.property_type,
    er.rating,
    er.review_count,
    er.host_name,
    er.amenities,
    er.photos,
    er.first_seen_at,
    er.last_seen_at
FROM external_records er
WHERE er.record_type = 'property_listing'
ORDER BY er.last_seen_at DESC;

-- =====================================================================
-- 5) VERIFY
-- =====================================================================

SELECT 'Migration 019: Rental fields and functions applied' as status;

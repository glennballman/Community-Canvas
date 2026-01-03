-- =====================================================================
-- MIGRATION 013: TOOL AVAILABILITY VIEWS & FUNCTIONS
-- =====================================================================

-- 1. Service Tool Requirements (what tools each service needs)
CREATE TABLE IF NOT EXISTS sr_service_tool_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES sr_services(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES sr_tools(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT true,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, tool_id)
);

-- 2. Property Tools (tools available at specific properties)
CREATE TABLE IF NOT EXISTS sr_property_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_address TEXT NOT NULL,
    tool_id UUID NOT NULL REFERENCES sr_tools(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES cc_individuals(id),
    available_to_providers BOOLEAN DEFAULT true,
    usage_fee DECIMAL(10,2) DEFAULT 0,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_address, tool_id)
);

-- 3. Provider Tools (tools owned by service providers/tenants)
CREATE TABLE IF NOT EXISTS sr_provider_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cc_tenants(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES sr_tools(id) ON DELETE CASCADE,
    current_community_id UUID REFERENCES sr_communities(id),
    current_location TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair')),
    is_available_for_rent BOOLEAN DEFAULT false,
    rental_rate_daily DECIMAL(10,2),
    rental_rate_weekly DECIMAL(10,2),
    damage_deposit DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_sr_provider_tools_community ON sr_provider_tools(current_community_id);
CREATE INDEX IF NOT EXISTS idx_sr_property_tools_address ON sr_property_tools(property_address);

-- =====================================================================
-- 4. VIEW: Tools Available for Job (optimized - no Cartesian products)
-- Aggregates tools from individuals, properties, and providers
-- =====================================================================

CREATE OR REPLACE VIEW v_tools_available_for_job AS
-- Individual tools in the service run's community (local tools)
SELECT 
    sr.id as service_run_id,
    sr.community_id,
    c.name as community_name,
    'individual' as source_type,
    cit.individual_id::text as owner_id,
    i.full_name as owner_name,
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    cit.condition,
    cit.available_for_rent,
    cit.rental_rate_daily,
    cit.current_location,
    CASE WHEN cit.current_community_id = sr.community_id THEN true ELSE false END as is_local
FROM cc_individual_tools cit
JOIN sr_tools t ON t.id = cit.tool_id
JOIN cc_individuals i ON i.id = cit.individual_id
JOIN sr_communities c ON c.id = cit.current_community_id
JOIN sr_service_runs sr ON sr.community_id = cit.current_community_id

UNION ALL

-- Individual tools available for rent anywhere (rentable, non-local)
SELECT 
    sr.id as service_run_id,
    sr.community_id,
    c.name as community_name,
    'individual' as source_type,
    cit.individual_id::text as owner_id,
    i.full_name as owner_name,
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    cit.condition,
    cit.available_for_rent,
    cit.rental_rate_daily,
    cit.current_location,
    false as is_local
FROM cc_individual_tools cit
JOIN sr_tools t ON t.id = cit.tool_id
JOIN cc_individuals i ON i.id = cit.individual_id
JOIN sr_communities c ON c.id = cit.current_community_id
CROSS JOIN sr_service_runs sr
WHERE cit.available_for_rent = true
  AND (cit.current_community_id IS NULL OR cit.current_community_id != sr.community_id)

UNION ALL

-- Property tools (always local by definition)
SELECT 
    sr.id as service_run_id,
    sr.community_id,
    c.name as community_name,
    'property' as source_type,
    NULL::text as owner_id,
    spt.property_address as owner_name,
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    spt.condition,
    spt.available_to_providers as available_for_rent,
    spt.usage_fee as rental_rate_daily,
    spt.property_address as current_location,
    true as is_local
FROM sr_property_tools spt
JOIN sr_tools t ON t.id = spt.tool_id
CROSS JOIN sr_service_runs sr
JOIN sr_communities c ON c.id = sr.community_id
WHERE spt.available_to_providers = true

UNION ALL

-- Provider tools in community
SELECT 
    sr.id as service_run_id,
    sr.community_id,
    c.name as community_name,
    'provider' as source_type,
    pt.tenant_id::text as owner_id,
    ten.name as owner_name,
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    pt.condition,
    pt.is_available_for_rent as available_for_rent,
    pt.rental_rate_daily,
    pt.current_location,
    CASE WHEN pt.current_community_id = sr.community_id THEN true ELSE false END as is_local
FROM sr_provider_tools pt
JOIN sr_tools t ON t.id = pt.tool_id
JOIN cc_tenants ten ON ten.id = pt.tenant_id
JOIN sr_communities c ON c.id = pt.current_community_id
JOIN sr_service_runs sr ON sr.community_id = pt.current_community_id
WHERE pt.is_available_for_rent = true;

-- =====================================================================
-- 5. FUNCTION: Check Individual Tools for Run
-- Returns required tools, individual's tools, and available tools in community
-- =====================================================================

CREATE OR REPLACE FUNCTION check_individual_tools_for_run(
    p_individual_id UUID,
    p_service_run_id UUID
) RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'required_tools', COALESCE((
            -- Get tools from bundle items if bundle exists
            SELECT json_agg(DISTINCT json_build_object(
                'tool_id', str.tool_id,
                'tool_name', t.name,
                'is_required', str.is_required
            ))
            FROM sr_service_tool_requirements str
            JOIN sr_tools t ON t.id = str.tool_id
            WHERE EXISTS (
                SELECT 1 FROM sr_bundle_items bi
                JOIN sr_service_runs sr ON sr.bundle_id = bi.bundle_id
                WHERE sr.id = p_service_run_id
                  AND bi.service_id = str.service_id
            )
        ), '[]'::json),
        'individual_tools', COALESCE((
            SELECT json_agg(json_build_object(
                'tool_id', cit.tool_id,
                'tool_name', t.name,
                'condition', cit.condition,
                'location', cit.current_location
            ))
            FROM cc_individual_tools cit
            JOIN sr_tools t ON t.id = cit.tool_id
            WHERE cit.individual_id = p_individual_id
        ), '[]'::json),
        'available_in_community', COALESCE((
            SELECT json_agg(DISTINCT json_build_object(
                'tool_id', v.tool_id,
                'tool_name', v.tool_name,
                'source_type', v.source_type,
                'owner_name', v.owner_name,
                'rental_rate', v.rental_rate_daily,
                'is_local', v.is_local
            ))
            FROM v_tools_available_for_job v
            WHERE v.service_run_id = p_service_run_id
        ), '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 6. FUNCTION: Get Bid Context (comprehensive context for bidding)
-- Returns individual profile, service run details, tool availability, and auth status
-- =====================================================================

CREATE OR REPLACE FUNCTION get_bid_context(
    p_individual_id UUID,
    p_service_run_id UUID
) RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'individual', (
            SELECT json_build_object(
                'id', i.id,
                'name', i.full_name,
                'email', i.email,
                'current_community', (SELECT name FROM sr_communities WHERE id = i.current_community_id),
                'skills', COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', sk.id,
                        'skill', sk.name,
                        'proficiency', isk.proficiency_level,
                        'verified', isk.verified
                    ))
                    FROM cc_individual_skills isk
                    JOIN sr_skills sk ON sk.id = isk.skill_id
                    WHERE isk.individual_id = i.id
                ), '[]'::json),
                'personal_tools', COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', it.id,
                        'tool_id', t.id,
                        'tool', t.name,
                        'location', it.current_location,
                        'community', (SELECT name FROM sr_communities WHERE id = it.current_community_id),
                        'condition', it.condition,
                        'available_for_rent', it.available_for_rent,
                        'rental_rate_daily', it.rental_rate_daily
                    ))
                    FROM cc_individual_tools it
                    JOIN sr_tools t ON t.id = it.tool_id
                    WHERE it.individual_id = i.id
                ), '[]'::json)
            )
            FROM cc_individuals i
            WHERE i.id = p_individual_id
        ),
        'service_run', (
            SELECT json_build_object(
                'id', sr.id,
                'title', sr.title,
                'slug', sr.slug,
                'community_id', c.id,
                'community', c.name,
                'status', sr.status,
                'dates', json_build_object(
                    'start', sr.target_start_date,
                    'end', sr.target_end_date
                ),
                'slots', json_build_object(
                    'current', sr.current_slots,
                    'min', sr.min_slots,
                    'max', sr.max_slots
                ),
                'bundle', (
                    SELECT json_build_object(
                        'id', b.id,
                        'name', b.name,
                        'services', (
                            SELECT json_agg(json_build_object(
                                'service_id', s.id,
                                'name', s.name,
                                'quantity', bi.quantity
                            ))
                            FROM sr_bundle_items bi
                            JOIN sr_services s ON s.id = bi.service_id
                            WHERE bi.bundle_id = b.id
                        )
                    )
                    FROM sr_bundles b WHERE b.id = sr.bundle_id
                ),
                'estimated_mobilization', sr.estimated_mobilization_cost
            )
            FROM sr_service_runs sr
            JOIN sr_communities c ON c.id = sr.community_id
            WHERE sr.id = p_service_run_id
        ),
        'tool_availability', check_individual_tools_for_run(p_individual_id, p_service_run_id),
        'authorization_status', (
            SELECT json_build_object(
                'has_valid_waivers', COALESCE((
                    SELECT bool_and(sw.expires_at IS NULL OR sw.expires_at > NOW())
                    FROM cc_signed_waivers sw
                    WHERE sw.individual_id = p_individual_id
                ), false),
                'has_valid_payment', COALESCE((
                    SELECT bool_or(verified)
                    FROM cc_payment_methods
                    WHERE individual_id = p_individual_id
                ), false),
                'documents', COALESCE((
                    SELECT json_agg(json_build_object(
                        'type', document_type,
                        'verified', verified,
                        'expires_at', expires_at
                    ))
                    FROM cc_identity_documents
                    WHERE individual_id = p_individual_id
                ), '[]'::json)
            )
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- VERIFY
-- =====================================================================

SELECT 'Tool availability tables, views, and functions created' as status;

-- =====================================================================
-- MIGRATION 012: SOVEREIGN INDIVIDUAL PROFILE
-- One identity that travels across all of Community Canvas
-- =====================================================================

-- =====================================================================
-- 0. PREREQUISITE TABLES (sr_skills and sr_tools if not exist)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sr_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    certification_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sr_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    typical_daily_rental DECIMAL(10,2),
    requires_license BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 1. CORE IDENTITY (The "Passport")
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    full_name TEXT NOT NULL,
    preferred_name TEXT DEFAULT '',
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    phone_verified BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    
    photo_url TEXT DEFAULT '',
    photo_verified_at TIMESTAMPTZ,
    
    home_country TEXT DEFAULT 'Canada',
    home_region TEXT DEFAULT '',
    home_community_id UUID REFERENCES sr_communities(id),
    current_community_id UUID REFERENCES sr_communities(id),
    
    languages TEXT[] DEFAULT '{"en"}',
    
    emergency_contact_name TEXT DEFAULT '',
    emergency_contact_phone TEXT DEFAULT '',
    emergency_contact_relationship TEXT DEFAULT '',
    
    profile_complete BOOLEAN DEFAULT false,
    profile_score INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'deactivated')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. IDENTITY DOCUMENTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_identity_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
    
    document_type TEXT NOT NULL CHECK (document_type IN (
        'drivers_license',
        'passport',
        'boat_license',
        'atv_license', 
        'photo_id',
        'work_permit',
        'trade_certificate',
        'insurance_certificate',
        'background_check'
    )),
    
    document_number TEXT DEFAULT '',
    issuing_authority TEXT DEFAULT '',
    issuing_region TEXT DEFAULT '',
    
    issued_at DATE,
    expires_at DATE,
    
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    verification_method TEXT DEFAULT '',
    
    front_image_url TEXT DEFAULT '',
    back_image_url TEXT DEFAULT '',
    
    extracted_data JSONB DEFAULT '{}',
    
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(individual_id, document_type, document_number)
);

CREATE INDEX IF NOT EXISTS idx_cc_identity_docs_individual ON cc_identity_documents(individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_identity_docs_type ON cc_identity_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_cc_identity_docs_expires ON cc_identity_documents(expires_at);

-- =====================================================================
-- 3. WAIVERS & LIABILITY
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_waiver_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    
    activity_types TEXT[] NOT NULL,
    
    waiver_text TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    
    valid_days INTEGER DEFAULT 365,
    requires_witness BOOLEAN DEFAULT false,
    requires_guardian_if_minor BOOLEAN DEFAULT true,
    minimum_age INTEGER DEFAULT 18,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cc_waiver_templates (name, slug, activity_types, waiver_text, valid_days) VALUES
('Watercraft Liability Waiver', 'watercraft-waiver', 
 '{"kayak", "canoe", "paddleboard", "rowboat", "small_boat"}',
 'I acknowledge the inherent risks of watercraft activities including but not limited to capsizing, hypothermia, collision, and drowning. I agree to follow all safety guidelines and wear appropriate safety equipment at all times.', 365),
 
('Motorized Vehicle Waiver', 'motorized-vehicle-waiver',
 '{"atv", "side_by_side", "golf_cart", "ebike", "scooter"}',
 'I acknowledge the risks of operating motorized vehicles including but not limited to collision, rollover, and mechanical failure. I agree to operate within posted speed limits and follow all safety guidelines.', 365),
 
('Power Tool & Equipment Waiver', 'power-tool-waiver',
 '{"power_tools", "ladders", "scaffolding", "pressure_washer", "chainsaw"}',
 'I acknowledge the risks of operating power tools and equipment including but not limited to cuts, burns, falls, and electrical shock. I agree to use appropriate safety equipment and follow all operating instructions.', 365),
 
('General Activity Waiver', 'general-activity-waiver',
 '{"hiking", "fishing", "general_recreation"}',
 'I acknowledge the risks of recreational activities including but not limited to injury, wildlife encounters, and environmental hazards. I agree to follow all safety guidelines and respect the natural environment.', 365)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS cc_signed_waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
    waiver_template_id UUID NOT NULL REFERENCES cc_waiver_templates(id),
    
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature_data TEXT DEFAULT '',
    signature_method TEXT DEFAULT 'typed' CHECK (signature_method IN ('typed', 'drawn', 'digital_certificate')),
    
    signed_from_ip TEXT DEFAULT '',
    signed_from_device TEXT DEFAULT '',
    
    expires_at TIMESTAMPTZ,
    
    guardian_name TEXT DEFAULT '',
    guardian_signature_data TEXT DEFAULT '',
    guardian_relationship TEXT DEFAULT '',
    
    witness_name TEXT DEFAULT '',
    witness_signature_data TEXT DEFAULT '',
    
    notes TEXT DEFAULT '',
    
    UNIQUE(individual_id, waiver_template_id, signed_at)
);

CREATE INDEX IF NOT EXISTS idx_cc_signed_waivers_individual ON cc_signed_waivers(individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_signed_waivers_expires ON cc_signed_waivers(expires_at);

-- =====================================================================
-- 4. PAYMENT METHODS
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
    
    payment_type TEXT NOT NULL CHECK (payment_type IN (
        'credit_card', 'debit_card', 'bank_account', 'paypal', 'crypto_wallet'
    )),
    
    display_name TEXT DEFAULT '',
    last_four TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    
    processor TEXT DEFAULT 'stripe',
    processor_customer_id TEXT DEFAULT '',
    processor_payment_method_id TEXT DEFAULT '',
    
    expires_month INTEGER,
    expires_year INTEGER,
    
    is_default BOOLEAN DEFAULT false,
    
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_payment_methods_individual ON cc_payment_methods(individual_id);

-- =====================================================================
-- 5. INDIVIDUAL CAPABILITIES (Skills + Tools)
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_individual_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES sr_skills(id),
    
    proficiency_level TEXT DEFAULT 'competent' 
        CHECK (proficiency_level IN ('learning', 'competent', 'proficient', 'expert')),
    years_experience INTEGER,
    
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(individual_id, skill_id)
);

CREATE TABLE IF NOT EXISTS cc_individual_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL REFERENCES cc_individuals(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES sr_tools(id),
    
    ownership TEXT DEFAULT 'owned' CHECK (ownership IN ('owned', 'leased', 'borrowed')),
    
    quantity INTEGER DEFAULT 1,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair')),
    
    current_location TEXT DEFAULT '',
    current_community_id UUID REFERENCES sr_communities(id),
    
    available_for_rent BOOLEAN DEFAULT false,
    rental_rate_daily DECIMAL(10,2),
    rental_rate_weekly DECIMAL(10,2),
    damage_deposit DECIMAL(10,2),
    
    photos JSONB DEFAULT '[]',
    
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_individual_tools_individual ON cc_individual_tools(individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_individual_tools_community ON cc_individual_tools(current_community_id);

-- =====================================================================
-- 6. UNIFIED RENTAL EQUIPMENT CATALOG
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_rental_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT 'Package',
    
    required_waiver_slug TEXT REFERENCES cc_waiver_templates(slug),
    
    required_document_type TEXT,
    
    minimum_age INTEGER DEFAULT 18,
    
    sort_order INTEGER DEFAULT 0
);

INSERT INTO cc_rental_categories (name, slug, icon, required_waiver_slug, required_document_type, minimum_age, sort_order) VALUES
('Kayaks & Paddleboards', 'watercraft', 'Sailboat', 'watercraft-waiver', NULL, 16, 10),
('ATVs & Side-by-Sides', 'motorized-recreation', 'Car', 'motorized-vehicle-waiver', 'drivers_license', 18, 20),
('Bicycles & E-Bikes', 'bicycles', 'Bike', 'general-activity-waiver', NULL, 14, 30),
('Boats & Marine', 'boats', 'Ship', 'watercraft-waiver', 'boat_license', 18, 40),
('Tools & Equipment', 'tools', 'Wrench', 'power-tool-waiver', NULL, 18, 50),
('Parking & Storage', 'parking', 'ParkingSquare', NULL, NULL, 18, 60),
('Moorage', 'moorage', 'Anchor', NULL, 'boat_license', 18, 70)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS cc_rental_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    owner_individual_id UUID REFERENCES cc_individuals(id),
    owner_tenant_id UUID REFERENCES cc_tenants(id),
    owner_name TEXT DEFAULT '',
    
    home_community_id UUID REFERENCES sr_communities(id),
    location_name TEXT DEFAULT '',
    location_address TEXT DEFAULT '',
    
    category_id UUID NOT NULL REFERENCES cc_rental_categories(id),
    
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT DEFAULT '',
    
    brand TEXT DEFAULT '',
    model TEXT DEFAULT '',
    year INTEGER,
    color TEXT DEFAULT '',
    size TEXT DEFAULT '',
    capacity INTEGER DEFAULT 1,
    
    included_items JSONB DEFAULT '[]',
    
    condition TEXT DEFAULT 'good',
    
    pricing_model TEXT DEFAULT 'hourly' CHECK (pricing_model IN ('hourly', 'half_day', 'daily', 'weekly', 'flat')),
    rate_hourly DECIMAL(10,2),
    rate_half_day DECIMAL(10,2),
    rate_daily DECIMAL(10,2),
    rate_weekly DECIMAL(10,2),
    
    damage_deposit DECIMAL(10,2) DEFAULT 0,
    
    is_available BOOLEAN DEFAULT true,
    available_from TIME DEFAULT '08:00',
    available_until TIME DEFAULT '20:00',
    
    buffer_minutes INTEGER DEFAULT 15,
    
    min_rental_hours DECIMAL(4,2) DEFAULT 1,
    max_rental_hours DECIMAL(6,2),
    
    photos JSONB DEFAULT '[]',
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'lost')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(owner_individual_id, slug),
    UNIQUE(owner_tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_cc_rental_items_owner_individual ON cc_rental_items(owner_individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_rental_items_owner_tenant ON cc_rental_items(owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_rental_items_community ON cc_rental_items(home_community_id);
CREATE INDEX IF NOT EXISTS idx_cc_rental_items_category ON cc_rental_items(category_id);

-- =====================================================================
-- 7. UNIFIED RENTAL BOOKINGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS cc_rental_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    rental_item_id UUID NOT NULL REFERENCES cc_rental_items(id),
    
    renter_individual_id UUID NOT NULL REFERENCES cc_individuals(id),
    
    booking_context TEXT DEFAULT 'direct' CHECK (booking_context IN (
        'direct',
        'accommodation',
        'service_run',
        'crew_equipment'
    )),
    
    accommodation_booking_id UUID,
    service_run_id UUID REFERENCES sr_service_runs(id),
    service_slot_id UUID REFERENCES sr_service_slots(id),
    
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    actual_checkout_at TIMESTAMPTZ,
    actual_checkin_at TIMESTAMPTZ,
    
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'checked_out', 'active', 
        'returned', 'completed', 'cancelled', 'no_show', 'overdue'
    )),
    
    waiver_valid BOOLEAN DEFAULT false,
    waiver_id UUID REFERENCES cc_signed_waivers(id),
    license_valid BOOLEAN DEFAULT false,
    license_document_id UUID REFERENCES cc_identity_documents(id),
    payment_method_valid BOOLEAN DEFAULT false,
    payment_method_id UUID REFERENCES cc_payment_methods(id),
    
    ready_for_checkout BOOLEAN DEFAULT false,
    
    pricing_model TEXT,
    rate_applied DECIMAL(10,2),
    duration_hours DECIMAL(6,2),
    subtotal DECIMAL(10,2),
    tax DECIMAL(10,2) DEFAULT 0,
    damage_deposit_held DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'authorized', 'captured', 'refunded', 'failed'
    )),
    payment_intent_id TEXT DEFAULT '',
    
    condition_at_checkout TEXT DEFAULT '',
    condition_at_return TEXT DEFAULT '',
    checkout_photos JSONB DEFAULT '[]',
    return_photos JSONB DEFAULT '[]',
    
    damage_reported BOOLEAN DEFAULT false,
    damage_notes TEXT DEFAULT '',
    damage_fee DECIMAL(10,2) DEFAULT 0,
    
    notes TEXT DEFAULT '',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_cc_rental_bookings_item ON cc_rental_bookings(rental_item_id);
CREATE INDEX IF NOT EXISTS idx_cc_rental_bookings_renter ON cc_rental_bookings(renter_individual_id);
CREATE INDEX IF NOT EXISTS idx_cc_rental_bookings_dates ON cc_rental_bookings(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_cc_rental_bookings_status ON cc_rental_bookings(status);
CREATE INDEX IF NOT EXISTS idx_cc_rental_bookings_service_run ON cc_rental_bookings(service_run_id);

-- =====================================================================
-- 8. AUTHORIZATION CHECK VIEW
-- =====================================================================

CREATE OR REPLACE VIEW v_individual_authorizations AS
SELECT 
    i.id as individual_id,
    i.full_name,
    i.email,
    
    i.email_verified,
    i.phone_verified,
    (SELECT bool_or(verified) FROM cc_identity_documents WHERE individual_id = i.id AND document_type = 'photo_id') as photo_id_verified,
    
    (SELECT json_agg(json_build_object(
        'type', document_type,
        'verified', verified,
        'expires_at', expires_at
    )) FROM cc_identity_documents WHERE individual_id = i.id) as documents,
    
    (SELECT json_agg(json_build_object(
        'waiver_slug', wt.slug,
        'activity_types', wt.activity_types,
        'signed_at', sw.signed_at,
        'expires_at', sw.expires_at
    )) FROM cc_signed_waivers sw 
    JOIN cc_waiver_templates wt ON wt.id = sw.waiver_template_id
    WHERE sw.individual_id = i.id AND (sw.expires_at IS NULL OR sw.expires_at > NOW())) as valid_waivers,
    
    (SELECT bool_or(verified) FROM cc_payment_methods WHERE individual_id = i.id) as has_valid_payment,
    
    (SELECT COUNT(*) FROM cc_individual_skills WHERE individual_id = i.id) as skill_count,
    
    (SELECT COUNT(*) FROM cc_individual_tools WHERE individual_id = i.id) as tool_count

FROM cc_individuals i;

-- =====================================================================
-- 9. QUICK CHECKOUT CHECK FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION can_checkout_rental(
    p_individual_id UUID,
    p_rental_item_id UUID
) RETURNS JSON AS $$
DECLARE
    v_category_slug TEXT;
    v_required_waiver TEXT;
    v_required_document TEXT;
    v_min_age INTEGER;
    v_has_waiver BOOLEAN;
    v_has_document BOOLEAN;
    v_has_payment BOOLEAN;
    v_all_clear BOOLEAN;
    v_blockers TEXT[];
BEGIN
    SELECT rc.slug, rc.required_waiver_slug, rc.required_document_type, rc.minimum_age
    INTO v_category_slug, v_required_waiver, v_required_document, v_min_age
    FROM cc_rental_items ri
    JOIN cc_rental_categories rc ON rc.id = ri.category_id
    WHERE ri.id = p_rental_item_id;
    
    v_blockers := '{}';
    
    IF v_required_waiver IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM cc_signed_waivers sw
            JOIN cc_waiver_templates wt ON wt.id = sw.waiver_template_id
            WHERE sw.individual_id = p_individual_id
            AND wt.slug = v_required_waiver
            AND NOT sw.is_expired
        ) INTO v_has_waiver;
        
        IF NOT v_has_waiver THEN
            v_blockers := array_append(v_blockers, 'waiver_required:' || v_required_waiver);
        END IF;
    ELSE
        v_has_waiver := true;
    END IF;
    
    IF v_required_document IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM cc_identity_documents
            WHERE individual_id = p_individual_id
            AND document_type = v_required_document
            AND verified = true
            AND NOT is_expired
        ) INTO v_has_document;
        
        IF NOT v_has_document THEN
            v_blockers := array_append(v_blockers, 'document_required:' || v_required_document);
        END IF;
    ELSE
        v_has_document := true;
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM cc_payment_methods
        WHERE individual_id = p_individual_id
        AND verified = true
        AND NOT is_expired
    ) INTO v_has_payment;
    
    IF NOT v_has_payment THEN
        v_blockers := array_append(v_blockers, 'payment_method_required');
    END IF;
    
    v_all_clear := v_has_waiver AND v_has_document AND v_has_payment;
    
    RETURN json_build_object(
        'can_checkout', v_all_clear,
        'has_waiver', v_has_waiver,
        'has_document', v_has_document,
        'has_payment', v_has_payment,
        'blockers', v_blockers,
        'message', CASE 
            WHEN v_all_clear THEN 'Ready for checkout!'
            ELSE 'Missing requirements: ' || array_to_string(v_blockers, ', ')
        END
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- SEED: Sample Skills
-- =====================================================================

INSERT INTO sr_skills (name, slug, category, certification_required) VALUES
('Painting - Interior', 'painting-interior', 'trades', false),
('Painting - Exterior', 'painting-exterior', 'trades', false),
('Pressure Washing', 'pressure-washing', 'maintenance', false),
('Window Cleaning', 'window-cleaning', 'maintenance', false),
('Lawn Mowing', 'lawn-mowing', 'landscaping', false),
('Hedge Trimming', 'hedge-trimming', 'landscaping', false),
('Tree Pruning', 'tree-pruning', 'landscaping', false),
('Gutter Cleaning', 'gutter-cleaning', 'maintenance', false),
('Deck Staining', 'deck-staining', 'maintenance', false),
('Basic Carpentry', 'basic-carpentry', 'trades', false),
('Plumbing - Basic', 'plumbing-basic', 'trades', false),
('Electrical - Basic', 'electrical-basic', 'trades', true),
('HVAC Maintenance', 'hvac-maintenance', 'trades', true),
('Boat Operation - Small', 'boat-small', 'marine', false),
('Boat Operation - Large', 'boat-large', 'marine', true),
('ATV/UTV Operation', 'atv-operation', 'vehicles', false),
('Chainsaw Operation', 'chainsaw', 'forestry', true),
('First Aid', 'first-aid', 'safety', true),
('CPR', 'cpr', 'safety', true)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- SEED: Sample Tools
-- =====================================================================

INSERT INTO sr_tools (name, slug, category, typical_daily_rental, requires_license) VALUES
('Pressure Washer - Electric', 'pressure-washer-electric', 'cleaning', 50.00, false),
('Pressure Washer - Gas', 'pressure-washer-gas', 'cleaning', 75.00, false),
('Paint Sprayer', 'paint-sprayer', 'painting', 45.00, false),
('Extension Ladder - 24ft', 'ladder-24', 'access', 25.00, false),
('Extension Ladder - 32ft', 'ladder-32', 'access', 35.00, false),
('Scaffolding Set', 'scaffolding', 'access', 75.00, false),
('Chainsaw - 16"', 'chainsaw-16', 'forestry', 45.00, true),
('Chainsaw - 20"', 'chainsaw-20', 'forestry', 55.00, true),
('Hedge Trimmer - Gas', 'hedge-trimmer-gas', 'landscaping', 35.00, false),
('Lawn Mower - Push', 'mower-push', 'landscaping', 30.00, false),
('Lawn Mower - Riding', 'mower-riding', 'landscaping', 85.00, false),
('String Trimmer', 'string-trimmer', 'landscaping', 25.00, false),
('Leaf Blower - Backpack', 'blower-backpack', 'landscaping', 35.00, false),
('Drill/Driver Set', 'drill-driver', 'power-tools', 20.00, false),
('Circular Saw', 'circular-saw', 'power-tools', 25.00, false),
('Miter Saw', 'miter-saw', 'power-tools', 40.00, false),
('Generator - 3500W', 'generator-3500', 'power', 65.00, false),
('Generator - 7500W', 'generator-7500', 'power', 95.00, false),
('Kayak - Single', 'kayak-single', 'watercraft', 45.00, false),
('Kayak - Tandem', 'kayak-tandem', 'watercraft', 65.00, false),
('Paddleboard', 'paddleboard', 'watercraft', 40.00, false),
('ATV', 'atv', 'vehicles', 150.00, true),
('Side-by-Side (UTV)', 'utv', 'vehicles', 200.00, true)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- SEED: Sample Rental Items (Glenn's equipment in Bamfield)
-- =====================================================================

INSERT INTO cc_rental_items (
    owner_name, home_community_id, category_id, name, slug, description,
    brand, capacity, included_items, 
    pricing_model, rate_hourly, rate_half_day, rate_daily,
    damage_deposit
) 
SELECT 
    'Glenn Ballman',
    c.id,
    cat.id,
    'Ocean Kayak - Single',
    'kayak-single-1',
    'Stable sit-on-top kayak, perfect for beginners',
    'Ocean Kayak',
    1,
    '["lifejacket", "paddle", "safety whistle", "dry bag"]'::jsonb,
    'hourly',
    25.00,
    60.00,
    100.00,
    100.00
FROM sr_communities c, cc_rental_categories cat
WHERE c.name = 'Bamfield' 
AND cat.slug = 'watercraft'
AND NOT EXISTS (SELECT 1 FROM cc_rental_items ri WHERE ri.slug = 'kayak-single-1');

INSERT INTO cc_rental_items (
    owner_name, home_community_id, category_id, name, slug, description,
    brand, model, capacity, included_items,
    pricing_model, rate_half_day, rate_daily, rate_weekly,
    damage_deposit
)
SELECT 
    'Glenn Ballman',
    c.id,
    cat.id,
    'Polaris RZR Side-by-Side',
    'rzr-1',
    '4-seat side-by-side, great for exploring logging roads',
    'Polaris',
    'RZR XP 4 1000',
    4,
    '["helmets", "first_aid_kit", "fire_extinguisher", "recovery_strap"]'::jsonb,
    'half_day',
    150.00,
    250.00,
    1200.00,
    500.00
FROM sr_communities c, cc_rental_categories cat
WHERE c.name = 'Bamfield' 
AND cat.slug = 'motorized-recreation'
AND NOT EXISTS (SELECT 1 FROM cc_rental_items ri WHERE ri.slug = 'rzr-1');

INSERT INTO cc_rental_items (
    owner_name, home_community_id, category_id, name, slug, description,
    included_items,
    pricing_model, rate_daily, rate_weekly,
    damage_deposit
)
SELECT 
    'Glenn Ballman',
    c.id,
    cat.id,
    'Covered Parking - West Bamfield',
    'parking-covered-1',
    'Covered parking spot near the dock',
    '["power_outlet"]'::jsonb,
    'daily',
    15.00,
    75.00,
    0
FROM sr_communities c, cc_rental_categories cat
WHERE c.name = 'Bamfield' 
AND cat.slug = 'parking'
AND NOT EXISTS (SELECT 1 FROM cc_rental_items ri WHERE ri.slug = 'parking-covered-1');

-- =====================================================================
-- VERIFY
-- =====================================================================

SELECT 'Sovereign Individual + Unified Rentals schema created' as status;

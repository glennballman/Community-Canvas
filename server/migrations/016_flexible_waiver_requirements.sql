-- =====================================================================
-- FLEXIBLE REQUIREMENTS PER RENTAL ITEM
-- Business owner controls when waivers/documents are required
-- =====================================================================

-- Add requirement timing fields to rental items
ALTER TABLE cc_rental_items 
ADD COLUMN IF NOT EXISTS waiver_requirement TEXT DEFAULT 'at_checkout'
    CHECK (waiver_requirement IN ('none', 'at_booking', 'at_checkout', 'before_use'));

ALTER TABLE cc_rental_items 
ADD COLUMN IF NOT EXISTS document_requirement TEXT DEFAULT 'at_checkout'
    CHECK (document_requirement IN ('none', 'at_booking', 'at_checkout', 'before_use'));

ALTER TABLE cc_rental_items 
ADD COLUMN IF NOT EXISTS payment_requirement TEXT DEFAULT 'at_booking'
    CHECK (payment_requirement IN ('at_booking', 'at_checkout', 'invoice'));

-- Add comments explaining the options
COMMENT ON COLUMN cc_rental_items.waiver_requirement IS 
'none = no waiver needed, at_booking = must sign to book, at_checkout = sign before pickup, before_use = reminder only';

COMMENT ON COLUMN cc_rental_items.document_requirement IS 
'none = no document needed, at_booking = must have to book, at_checkout = show at pickup, before_use = reminder only';

COMMENT ON COLUMN cc_rental_items.payment_requirement IS 
'at_booking = pay to confirm, at_checkout = pay at pickup, invoice = bill later';

-- =====================================================================
-- UPDATE EXISTING ITEMS WITH SENSIBLE DEFAULTS
-- =====================================================================

-- Parking & Moorage: No waivers needed
UPDATE cc_rental_items 
SET waiver_requirement = 'none',
    document_requirement = 'none'
WHERE category_id IN (
    SELECT id FROM cc_rental_categories 
    WHERE slug IN ('parking', 'moorage')
);

-- Watercraft: Waiver at checkout (not blocking booking)
UPDATE cc_rental_items 
SET waiver_requirement = 'at_checkout',
    document_requirement = 'none'
WHERE category_id IN (
    SELECT id FROM cc_rental_categories 
    WHERE slug = 'watercraft'
);

-- ATVs/Side-by-sides: Need driver's license at checkout
UPDATE cc_rental_items 
SET waiver_requirement = 'at_checkout',
    document_requirement = 'at_checkout'
WHERE category_id IN (
    SELECT id FROM cc_rental_categories 
    WHERE slug IN ('motorized-recreation', 'atvs-side-by-sides')
);

-- Bicycles: Waiver at checkout, no document
UPDATE cc_rental_items 
SET waiver_requirement = 'at_checkout',
    document_requirement = 'none'
WHERE category_id IN (
    SELECT id FROM cc_rental_categories 
    WHERE slug IN ('bicycles', 'bicycles-e-bikes')
);

-- Tools: Waiver before use (very flexible)
UPDATE cc_rental_items 
SET waiver_requirement = 'before_use',
    document_requirement = 'none'
WHERE category_id IN (
    SELECT id FROM cc_rental_categories 
    WHERE slug = 'tools'
);

-- =====================================================================
-- UPDATE ELIGIBILITY CHECK FUNCTION
-- Only blocks on requirements set to 'at_booking'
-- =====================================================================

CREATE OR REPLACE FUNCTION can_checkout_unified(
    p_individual_id UUID,
    p_rental_type TEXT,
    p_asset_id UUID
) RETURNS JSON AS $$
DECLARE
    v_required_waiver TEXT;
    v_required_document TEXT;
    v_waiver_requirement TEXT;
    v_document_requirement TEXT;
    v_payment_requirement TEXT;
    v_has_waiver BOOLEAN := true;
    v_has_document BOOLEAN := true;
    v_has_payment BOOLEAN := true;
    v_waiver_needed_now BOOLEAN := false;
    v_document_needed_now BOOLEAN := false;
    v_payment_needed_now BOOLEAN := false;
    v_blockers TEXT[] := '{}';
    v_warnings TEXT[] := '{}';
BEGIN
    -- Get requirements based on rental type
    IF p_rental_type = 'equipment' THEN
        SELECT 
            rc.required_waiver_slug, 
            rc.required_document_type,
            COALESCE(ri.waiver_requirement, 'at_checkout'),
            COALESCE(ri.document_requirement, 'at_checkout'),
            COALESCE(ri.payment_requirement, 'at_booking')
        INTO 
            v_required_waiver, 
            v_required_document,
            v_waiver_requirement,
            v_document_requirement,
            v_payment_requirement
        FROM cc_rental_items ri
        JOIN cc_rental_categories rc ON rc.id = ri.category_id
        WHERE ri.id = p_asset_id;
    ELSE
        -- Accommodations - typically no waivers
        v_required_waiver := NULL;
        v_required_document := NULL;
        v_waiver_requirement := 'none';
        v_document_requirement := 'none';
        v_payment_requirement := 'at_booking';
    END IF;
    
    -- Determine what's needed NOW (at booking time)
    v_waiver_needed_now := v_waiver_requirement = 'at_booking';
    v_document_needed_now := v_document_requirement = 'at_booking';
    v_payment_needed_now := v_payment_requirement = 'at_booking';
    
    -- Check waiver status
    IF v_required_waiver IS NOT NULL AND v_waiver_requirement != 'none' THEN
        SELECT EXISTS(
            SELECT 1 FROM cc_signed_waivers sw
            JOIN cc_waiver_templates wt ON wt.id = sw.waiver_template_id
            WHERE sw.individual_id = p_individual_id
            AND wt.slug = v_required_waiver
            AND (sw.expires_at IS NULL OR sw.expires_at > NOW())
        ) INTO v_has_waiver;
        
        IF NOT v_has_waiver THEN
            IF v_waiver_needed_now THEN
                v_blockers := array_append(v_blockers, 'waiver:' || v_required_waiver);
            ELSE
                v_warnings := array_append(v_warnings, 'waiver_needed_' || v_waiver_requirement || ':' || v_required_waiver);
            END IF;
        END IF;
    END IF;
    
    -- Check document status
    IF v_required_document IS NOT NULL AND v_document_requirement != 'none' THEN
        SELECT EXISTS(
            SELECT 1 FROM cc_identity_documents
            WHERE individual_id = p_individual_id
            AND document_type = v_required_document
            AND verified = true
            AND NOT is_expired
        ) INTO v_has_document;
        
        IF NOT v_has_document THEN
            IF v_document_needed_now THEN
                v_blockers := array_append(v_blockers, 'document:' || v_required_document);
            ELSE
                v_warnings := array_append(v_warnings, 'document_needed_' || v_document_requirement || ':' || v_required_document);
            END IF;
        END IF;
    END IF;
    
    -- Check payment status
    IF v_payment_needed_now THEN
        SELECT EXISTS(
            SELECT 1 FROM cc_payment_methods
            WHERE individual_id = p_individual_id
            AND verified = true
            AND NOT is_expired
        ) INTO v_has_payment;
        
        IF NOT v_has_payment THEN
            v_blockers := array_append(v_blockers, 'payment_method');
        END IF;
    END IF;
    
    -- Ready if no blockers (warnings don't block)
    RETURN json_build_object(
        'ready', array_length(v_blockers, 1) IS NULL OR array_length(v_blockers, 1) = 0,
        'has_waiver', v_has_waiver,
        'has_document', v_has_document,
        'has_payment', v_has_payment,
        'blockers', v_blockers,
        'warnings', v_warnings,
        'requirements', json_build_object(
            'waiver', v_waiver_requirement,
            'document', v_document_requirement,
            'payment', v_payment_requirement
        ),
        'required_waiver', v_required_waiver,
        'required_document', v_required_document
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- ADD PENDING REQUIREMENTS TO BOOKING
-- Track what still needs to be completed
-- =====================================================================

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS waiver_required_by TEXT DEFAULT NULL
    CHECK (waiver_required_by IN ('checkout', 'use', NULL));

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS document_required_by TEXT DEFAULT NULL
    CHECK (document_required_by IN ('checkout', 'use', NULL));

ALTER TABLE cc_rental_bookings
ADD COLUMN IF NOT EXISTS requirements_notes TEXT DEFAULT '';

-- =====================================================================
-- VIEW: Bookings with pending requirements
-- =====================================================================

DROP VIEW IF EXISTS v_bookings_pending_requirements;
CREATE VIEW v_bookings_pending_requirements AS
SELECT 
    b.id as booking_id,
    b.status,
    b.starts_at,
    i.full_name as renter_name,
    i.email as renter_email,
    ri.name as item_name,
    ri.waiver_requirement,
    ri.document_requirement,
    rc.required_waiver_slug,
    rc.required_document_type,
    
    -- Check if waiver is completed
    CASE 
        WHEN ri.waiver_requirement = 'none' THEN true
        WHEN rc.required_waiver_slug IS NULL THEN true
        ELSE EXISTS(
            SELECT 1 FROM cc_signed_waivers sw
            JOIN cc_waiver_templates wt ON wt.id = sw.waiver_template_id
            WHERE sw.individual_id = b.renter_individual_id
            AND wt.slug = rc.required_waiver_slug
            AND (sw.expires_at IS NULL OR sw.expires_at > NOW())
        )
    END as waiver_complete,
    
    -- Check if document is on file
    CASE 
        WHEN ri.document_requirement = 'none' THEN true
        WHEN rc.required_document_type IS NULL THEN true
        ELSE EXISTS(
            SELECT 1 FROM cc_identity_documents
            WHERE individual_id = b.renter_individual_id
            AND document_type = rc.required_document_type
            AND verified = true
        )
    END as document_complete

FROM cc_rental_bookings b
JOIN cc_individuals i ON i.id = b.renter_individual_id
JOIN cc_rental_items ri ON ri.id = b.rental_item_id
JOIN cc_rental_categories rc ON rc.id = ri.category_id
WHERE b.status IN ('pending', 'confirmed', 'checked_out', 'active');

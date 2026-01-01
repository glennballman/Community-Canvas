-- Migration: Add check_driver_trailer_qualification function
-- File: server/migrations/011_driver_qualification_function.sql

-- First, create a composite type for the return value
DROP TYPE IF EXISTS qualification_result CASCADE;
CREATE TYPE qualification_result AS (
    is_qualified BOOLEAN,
    issues TEXT[],
    warnings TEXT[],
    required_endorsements TEXT[]
);

-- Main qualification checking function
CREATE OR REPLACE FUNCTION check_driver_trailer_qualification(
    p_driver_id UUID,
    p_trailer_id UUID,
    p_province VARCHAR(20) DEFAULT 'BC'
)
RETURNS qualification_result AS $$
DECLARE
    v_result qualification_result;
    v_driver RECORD;
    v_trailer RECORD;
    v_trailer_weight_kg NUMERIC;
    v_is_rv_trailer BOOLEAN;
    v_requires_air_brake BOOLEAN;
    v_days_until_license_expiry INTEGER;
    v_days_until_medical_expiry INTEGER;
BEGIN
    -- Initialize result
    v_result.is_qualified := TRUE;
    v_result.issues := ARRAY[]::TEXT[];
    v_result.warnings := ARRAY[]::TEXT[];
    v_result.required_endorsements := ARRAY[]::TEXT[];

    -- Fetch driver data (using 'name' not 'full_name')
    SELECT 
        license_class,
        license_province,
        license_expiry,
        has_air_brake_endorsement,
        has_house_trailer_endorsement,
        has_heavy_trailer_endorsement,
        heavy_trailer_medical_expiry,
        max_trailer_weight_certified_kg,
        fifth_wheel_experience,
        gooseneck_experience,
        horse_trailer_experience,
        boat_launching_experience,
        name
    INTO v_driver
    FROM participant_profiles
    WHERE id = p_driver_id;

    IF NOT FOUND THEN
        v_result.is_qualified := FALSE;
        v_result.issues := array_append(v_result.issues, 'Driver profile not found');
        RETURN v_result;
    END IF;

    -- Fetch trailer data (using 'hitch_type' not 'required_hitch_type')
    SELECT 
        trailer_type,
        gvwr_lbs,
        hitch_type,
        brake_type,
        nickname,
        length_feet
    INTO v_trailer
    FROM trailer_profiles
    WHERE id = p_trailer_id;

    IF NOT FOUND THEN
        v_result.is_qualified := FALSE;
        v_result.issues := array_append(v_result.issues, 'Trailer profile not found');
        RETURN v_result;
    END IF;

    -- Convert trailer weight to kg (1 lb = 0.453592 kg)
    v_trailer_weight_kg := COALESCE(v_trailer.gvwr_lbs, 0) * 0.453592;

    -- Determine if this is an RV-type trailer (matches actual TrailerForm.tsx values)
    v_is_rv_trailer := v_trailer.trailer_type IN (
        'travel_trailer',
        'fifth_wheel_rv',
        'toy_hauler',
        'popup_camper',
        'teardrop',
        'overlander',
        'tiny_home'
    );

    -- Check if trailer has air brakes
    v_requires_air_brake := v_trailer.brake_type = 'air';

    -- ============================================
    -- CHECK 1: License Class Validity
    -- ============================================
    IF v_driver.license_class IS NULL THEN
        v_result.is_qualified := FALSE;
        v_result.issues := array_append(v_result.issues, 'No driver license class on file');
    ELSIF v_driver.license_class IN ('L', 'N') THEN
        v_result.warnings := array_append(v_result.warnings, 
            'Learner/Novice license - towing restrictions may apply. Check ICBC guidelines.');
    END IF;

    -- ============================================
    -- CHECK 2: License Expiry
    -- ============================================
    IF v_driver.license_expiry IS NOT NULL THEN
        v_days_until_license_expiry := v_driver.license_expiry - CURRENT_DATE;
        
        IF v_days_until_license_expiry < 0 THEN
            v_result.is_qualified := FALSE;
            v_result.issues := array_append(v_result.issues, 
                'Driver license EXPIRED on ' || to_char(v_driver.license_expiry, 'Mon DD, YYYY'));
        ELSIF v_days_until_license_expiry < 30 THEN
            v_result.warnings := array_append(v_result.warnings, 
                'Driver license expires in ' || v_days_until_license_expiry || ' days');
        END IF;
    ELSE
        v_result.warnings := array_append(v_result.warnings, 'No license expiry date on file');
    END IF;

    -- ============================================
    -- CHECK 3: BC Weight Thresholds (4,600 kg)
    -- ============================================
    IF p_province = 'BC' AND v_trailer_weight_kg > 4600 THEN
        IF v_is_rv_trailer THEN
            -- RV trailers > 4,600 kg require Code 07 (House Trailer Endorsement)
            IF NOT COALESCE(v_driver.has_house_trailer_endorsement, FALSE) THEN
                v_result.is_qualified := FALSE;
                v_result.issues := array_append(v_result.issues, 
                    'Trailer exceeds 4,600 kg (' || ROUND(v_trailer_weight_kg) || ' kg). BC Code 07 House Trailer Endorsement required.');
                v_result.required_endorsements := array_append(v_result.required_endorsements, 'BC Code 07 - House Trailer');
            END IF;
        ELSE
            -- Non-RV trailers > 4,600 kg require Code 20 (Heavy Trailer Endorsement)
            IF NOT COALESCE(v_driver.has_heavy_trailer_endorsement, FALSE) THEN
                v_result.is_qualified := FALSE;
                v_result.issues := array_append(v_result.issues, 
                    'Trailer exceeds 4,600 kg (' || ROUND(v_trailer_weight_kg) || ' kg). BC Code 20 Heavy Trailer Endorsement required.');
                v_result.required_endorsements := array_append(v_result.required_endorsements, 'BC Code 20 - Heavy Trailer');
            ELSE
                -- Has Code 20 - check medical expiry (required every 3 years)
                IF v_driver.heavy_trailer_medical_expiry IS NOT NULL THEN
                    v_days_until_medical_expiry := v_driver.heavy_trailer_medical_expiry - CURRENT_DATE;
                    
                    IF v_days_until_medical_expiry < 0 THEN
                        v_result.is_qualified := FALSE;
                        v_result.issues := array_append(v_result.issues, 
                            'Heavy trailer medical EXPIRED on ' || to_char(v_driver.heavy_trailer_medical_expiry, 'Mon DD, YYYY'));
                    ELSIF v_days_until_medical_expiry < 60 THEN
                        v_result.warnings := array_append(v_result.warnings, 
                            'Heavy trailer medical expires in ' || v_days_until_medical_expiry || ' days');
                    END IF;
                ELSE
                    v_result.warnings := array_append(v_result.warnings, 
                        'No heavy trailer medical expiry date on file');
                END IF;
            END IF;
        END IF;
    END IF;

    -- ============================================
    -- CHECK 4: Air Brake Endorsement
    -- ============================================
    IF v_requires_air_brake THEN
        IF NOT COALESCE(v_driver.has_air_brake_endorsement, FALSE) THEN
            v_result.is_qualified := FALSE;
            v_result.issues := array_append(v_result.issues, 
                'Trailer has air brakes. Air Brake Endorsement required.');
            v_result.required_endorsements := array_append(v_result.required_endorsements, 'Air Brake Endorsement');
        END IF;
        
        -- Air brakes + over 4,600 kg = Class 1 required
        IF v_trailer_weight_kg > 4600 AND v_driver.license_class NOT IN ('1', '2', '3') THEN
            v_result.is_qualified := FALSE;
            v_result.issues := array_append(v_result.issues, 
                'Air brakes + over 4,600 kg requires Class 1 Commercial License');
            v_result.required_endorsements := array_append(v_result.required_endorsements, 'Class 1 Commercial License');
        END IF;
    END IF;

    -- ============================================
    -- CHECK 5: Hitch Type Experience (Warnings)
    -- ============================================
    IF v_trailer.hitch_type = 'fifth_wheel' THEN
        IF NOT COALESCE(v_driver.fifth_wheel_experience, FALSE) THEN
            v_result.warnings := array_append(v_result.warnings, 
                'Driver has no fifth wheel experience on file. Consider supervised practice.');
        END IF;
    END IF;

    IF v_trailer.hitch_type = 'gooseneck' THEN
        IF NOT COALESCE(v_driver.gooseneck_experience, FALSE) THEN
            v_result.warnings := array_append(v_result.warnings, 
                'Driver has no gooseneck experience on file. Consider supervised practice.');
        END IF;
    END IF;

    -- ============================================
    -- CHECK 6: Special Trailer Types (Warnings)
    -- ============================================
    IF v_trailer.trailer_type = 'horse' OR v_trailer.trailer_type = 'livestock' THEN
        IF NOT COALESCE(v_driver.horse_trailer_experience, FALSE) THEN
            v_result.warnings := array_append(v_result.warnings, 
                'Driver has no horse/livestock trailer experience. Live cargo requires special handling skills.');
        END IF;
    END IF;

    IF v_trailer.trailer_type = 'boat' OR v_trailer.trailer_type = 'pwc' OR v_trailer.trailer_type = 'pontoon' THEN
        IF NOT COALESCE(v_driver.boat_launching_experience, FALSE) THEN
            v_result.warnings := array_append(v_result.warnings, 
                'Driver has no boat launching experience. Ramp backing requires practice.');
        END IF;
    END IF;

    -- ============================================
    -- CHECK 7: Trailer Length (BC max 12.5m / 41 ft)
    -- ============================================
    IF p_province = 'BC' AND COALESCE(v_trailer.length_feet, 0) > 41 THEN
        v_result.is_qualified := FALSE;
        v_result.issues := array_append(v_result.issues, 
            'Trailer length (' || v_trailer.length_feet || ' ft) exceeds BC maximum of 41 ft (12.5m)');
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_driver_trailer_qualification(UUID, UUID, VARCHAR) TO PUBLIC;

-- ============================================
-- HELPER FUNCTION: Get all qualification issues for a driver
-- CORRECTED: Uses organization_id instead of user_id
-- ============================================
CREATE OR REPLACE FUNCTION get_driver_qualification_summary(p_driver_id UUID)
RETURNS TABLE (
    trailer_id UUID,
    trailer_nickname VARCHAR,
    trailer_type VARCHAR,
    is_qualified BOOLEAN,
    issue_count INTEGER,
    warning_count INTEGER,
    primary_issue TEXT
) AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Get driver's organization
    SELECT organization_id INTO v_org_id 
    FROM participant_profiles WHERE id = p_driver_id;
    
    RETURN QUERY
    SELECT 
        t.id AS trailer_id,
        t.nickname AS trailer_nickname,
        t.trailer_type::VARCHAR,
        (check_driver_trailer_qualification(p_driver_id, t.id, 'BC')).is_qualified,
        array_length((check_driver_trailer_qualification(p_driver_id, t.id, 'BC')).issues, 1),
        array_length((check_driver_trailer_qualification(p_driver_id, t.id, 'BC')).warnings, 1),
        (check_driver_trailer_qualification(p_driver_id, t.id, 'BC')).issues[1]
    FROM trailer_profiles t
    WHERE t.organization_id = v_org_id
    ORDER BY t.nickname;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_driver_qualification_summary(UUID) TO PUBLIC;

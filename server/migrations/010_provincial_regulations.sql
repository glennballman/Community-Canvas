-- Migration 010: Provincial Towing Regulations Reference Table
-- Reference data for Canadian provincial towing requirements

CREATE TABLE IF NOT EXISTS provincial_towing_regulations (
  id SERIAL PRIMARY KEY,
  province_code TEXT NOT NULL UNIQUE,
  province_name TEXT NOT NULL,
  
  -- Double Towing Rules
  double_tow_allowed BOOLEAN DEFAULT false,
  double_tow_requirements TEXT,
  double_tow_lead_trailer_type TEXT, -- fifth_wheel, any, none
  double_tow_max_length_m DECIMAL(4,1),
  
  -- Weight Thresholds (kg)
  class_5_max_trailer_kg INTEGER,
  trailer_brake_required_kg INTEGER,
  driver_accessible_brake_kg INTEGER,
  house_trailer_endorsement_threshold_kg INTEGER,
  heavy_trailer_endorsement_threshold_kg INTEGER,
  commercial_license_threshold_kg INTEGER,
  
  -- Length/Width Limits (meters)
  max_motorized_rv_length_m DECIMAL(4,1),
  max_towed_trailer_length_m DECIMAL(4,1),
  max_combination_length_m DECIMAL(4,1),
  max_width_m DECIMAL(3,2),
  
  -- Endorsement Types
  house_trailer_endorsement_code TEXT,
  heavy_trailer_endorsement_code TEXT,
  air_brake_endorsement_code TEXT,
  
  -- Misc
  weigh_scale_threshold_kg INTEGER,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed BC regulations
INSERT INTO provincial_towing_regulations (
  province_code, province_name,
  double_tow_allowed, double_tow_requirements,
  class_5_max_trailer_kg, trailer_brake_required_kg, driver_accessible_brake_kg,
  house_trailer_endorsement_threshold_kg, commercial_license_threshold_kg,
  max_motorized_rv_length_m, max_towed_trailer_length_m, max_combination_length_m, max_width_m,
  house_trailer_endorsement_code, heavy_trailer_endorsement_code, air_brake_endorsement_code,
  weigh_scale_threshold_kg, notes
) VALUES (
  'BC', 'British Columbia',
  false, 'Commercial only with specific endorsement. Car dolly exception.',
  4600, 1400, 2800,
  4600, 4600,
  14.0, 12.5, 20.0, 2.6,
  '07', '20', 'J',
  5500, 'Power unit licensed >5500kg must report to open inspection stations regardless of trailer type'
) ON CONFLICT (province_code) DO NOTHING;

-- Seed Alberta regulations  
INSERT INTO provincial_towing_regulations (
  province_code, province_name,
  double_tow_allowed, double_tow_requirements, double_tow_lead_trailer_type, double_tow_max_length_m,
  class_5_max_trailer_kg, trailer_brake_required_kg,
  max_combination_length_m, max_width_m,
  notes
) VALUES (
  'AB', 'Alberta',
  true, 'Lead trailer must be fifth wheel with 2+ tandem axles. Longer trailer must be first. Hitch must attach to frame of first trailer.',
  'fifth_wheel', 20.0,
  4600, 2000,
  20.0, 2.6,
  'Breakaway device not specifically required but vehicle must be maintained in safe operating condition'
) ON CONFLICT (province_code) DO NOTHING;

-- Seed Saskatchewan
INSERT INTO provincial_towing_regulations (
  province_code, province_name,
  double_tow_allowed, double_tow_lead_trailer_type,
  notes
) VALUES (
  'SK', 'Saskatchewan',
  true, 'fifth_wheel',
  'Fifth wheel lead required for recreational double towing'
) ON CONFLICT (province_code) DO NOTHING;

-- Seed Manitoba
INSERT INTO provincial_towing_regulations (
  province_code, province_name,
  double_tow_allowed, double_tow_lead_trailer_type
) VALUES (
  'MB', 'Manitoba',
  true, 'fifth_wheel'
) ON CONFLICT (province_code) DO NOTHING;

-- Seed Ontario
INSERT INTO provincial_towing_regulations (
  province_code, province_name,
  double_tow_allowed, double_tow_requirements
) VALUES (
  'ON', 'Ontario',
  false, 'Commercial only'
) ON CONFLICT (province_code) DO NOTHING;

-- Seed Quebec
INSERT INTO provincial_towing_regulations (
  province_code, province_name,
  double_tow_allowed, double_tow_requirements
) VALUES (
  'QC', 'Quebec',
  false, 'Not permitted for recreational use'
) ON CONFLICT (province_code) DO NOTHING;

-- Seed Atlantic provinces
INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed) 
VALUES ('NB', 'New Brunswick', false) ON CONFLICT (province_code) DO NOTHING;

INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed) 
VALUES ('NS', 'Nova Scotia', false) ON CONFLICT (province_code) DO NOTHING;

INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed) 
VALUES ('PE', 'Prince Edward Island', false) ON CONFLICT (province_code) DO NOTHING;

INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed) 
VALUES ('NL', 'Newfoundland and Labrador', false) ON CONFLICT (province_code) DO NOTHING;

-- Seed Territories
INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed, notes) 
VALUES ('YT', 'Yukon', true, 'Similar to Alberta rules') ON CONFLICT (province_code) DO NOTHING;

INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed) 
VALUES ('NT', 'Northwest Territories', true) ON CONFLICT (province_code) DO NOTHING;

INSERT INTO provincial_towing_regulations (province_code, province_name, double_tow_allowed) 
VALUES ('NU', 'Nunavut', false) ON CONFLICT (province_code) DO NOTHING;

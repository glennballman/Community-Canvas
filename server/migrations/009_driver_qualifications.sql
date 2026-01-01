-- Migration 009: Driver Qualifications and Towing Experience
-- Adds licensing, endorsements, and experience fields to participant_profiles

-- =============================================
-- LICENSE CLASS & ENDORSEMENTS
-- =============================================

ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS license_class TEXT; -- 1, 2, 3, 4, 5, 6, 7, 8, L, N (BC)
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS license_province TEXT;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS license_expiry DATE;

-- Air Brake Endorsement
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS has_air_brake_endorsement BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS air_brake_endorsement_date DATE;

-- House Trailer Endorsement (BC Code 07)
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS has_house_trailer_endorsement BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS house_trailer_endorsement_date DATE;

-- Heavy Trailer Endorsement (BC Code 20)
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS has_heavy_trailer_endorsement BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS heavy_trailer_endorsement_date DATE;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS heavy_trailer_medical_expiry DATE;

-- =============================================
-- WEIGHT CERTIFICATIONS
-- =============================================

ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS max_trailer_weight_certified_kg INTEGER;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS max_combination_weight_certified_kg INTEGER;

-- =============================================
-- SPECIAL EXPERIENCE FLAGS
-- =============================================

ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS double_tow_experience BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS fifth_wheel_experience BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS gooseneck_experience BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS heavy_equipment_loading_experience BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS horse_trailer_experience BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS livestock_handling_experience BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS boat_launching_experience BOOLEAN DEFAULT false;

-- =============================================
-- TRAINING CERTIFICATIONS
-- =============================================

ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS rv_driving_course_completed BOOLEAN DEFAULT false;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS rv_course_provider TEXT;
ALTER TABLE participant_profiles ADD COLUMN IF NOT EXISTS rv_course_date DATE;

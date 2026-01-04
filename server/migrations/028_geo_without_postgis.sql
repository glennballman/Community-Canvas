-- =====================================================================
-- Migration 028: Remove PostGIS Dependency - Haversine-Based Geo Functions
-- =====================================================================
-- 
-- GOAL: Remove all PostGIS/geography dependencies while maintaining
-- geospatial correctness and performance.
--
-- APPROACH:
-- 1. fn_haversine_meters() - accurate geodesic distance
-- 2. fn_bbox() - bounding box for index-accelerated prefiltering
-- 3. Grid-based indexes (lat_cell, lon_cell) for O(1) neighbor lookup
-- 4. Pattern: bbox prefilter → haversine filter → ORDER BY haversine
--
-- FUNCTIONS REPLACED FROM 018-022:
-- - resolve_community() [018, 019]
-- - find_assets_by_capability() [021]
-- - search_unified_assets() [020]
-- - set_external_record_geom() trigger [018]
-- - set_entity_geom() trigger [018]
-- - set_community_geom() trigger [018]
-- - sync_staging_property_to_unified() [020]
-- - sync_staging_spot_to_unified() [020]
-- =====================================================================

-- =====================================================================
-- PHASE 1: Canonical Distance Functions
-- =====================================================================

-- Haversine distance in meters (IMMUTABLE for index eligibility)
-- Earth radius: 6371000 meters
CREATE OR REPLACE FUNCTION fn_haversine_meters(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 
    CASE 
      WHEN lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN NULL
      ELSE
        2 * 6371000 * asin(sqrt(
          power(sin(radians(lat2 - lat1) / 2), 2) +
          cos(radians(lat1)) * cos(radians(lat2)) *
          power(sin(radians(lon2 - lon1) / 2), 2)
        ))
    END
$$;

-- Bounding box calculator for spatial prefiltering
-- Returns (min_lat, max_lat, min_lon, max_lon) for a given center + radius
CREATE OR REPLACE FUNCTION fn_bbox(
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
) RETURNS TABLE (
  min_lat DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  min_lon DOUBLE PRECISION,
  max_lon DOUBLE PRECISION
)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    lat - (radius_meters / 111320.0),
    lat + (radius_meters / 111320.0),
    lon - (radius_meters / (111320.0 * cos(radians(lat)))),
    lon + (radius_meters / (111320.0 * cos(radians(lat))))
  WHERE lat IS NOT NULL AND lon IS NOT NULL AND radius_meters IS NOT NULL
$$;

-- Grid cell calculator (for spatial index)
CREATE OR REPLACE FUNCTION fn_lat_cell(lat DOUBLE PRECISION)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN lat IS NOT NULL THEN floor(lat * 100)::integer ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION fn_lon_cell(lon DOUBLE PRECISION)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE WHEN lon IS NOT NULL THEN floor(lon * 100)::integer ELSE NULL END
$$;

-- =====================================================================
-- PHASE 2: Add Grid Columns to Location Tables
-- =====================================================================

-- sr_communities grid columns
ALTER TABLE sr_communities ADD COLUMN IF NOT EXISTS lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(latitude)) STORED;
ALTER TABLE sr_communities ADD COLUMN IF NOT EXISTS lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(longitude)) STORED;

CREATE INDEX IF NOT EXISTS idx_sr_communities_grid ON sr_communities(lat_cell, lon_cell) 
  WHERE lat_cell IS NOT NULL AND lon_cell IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sr_communities_lat ON sr_communities(latitude) 
  WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sr_communities_lon ON sr_communities(longitude) 
  WHERE longitude IS NOT NULL;

-- external_records grid columns
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(latitude)) STORED;
ALTER TABLE external_records ADD COLUMN IF NOT EXISTS lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(longitude)) STORED;

CREATE INDEX IF NOT EXISTS idx_external_records_grid ON external_records(lat_cell, lon_cell) 
  WHERE lat_cell IS NOT NULL AND lon_cell IS NOT NULL;

-- entities grid columns
ALTER TABLE entities ADD COLUMN IF NOT EXISTS lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(latitude::double precision)) STORED;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(longitude::double precision)) STORED;

CREATE INDEX IF NOT EXISTS idx_entities_grid ON entities(lat_cell, lon_cell) 
  WHERE lat_cell IS NOT NULL AND lon_cell IS NOT NULL;

-- unified_assets grid columns
ALTER TABLE unified_assets ADD COLUMN IF NOT EXISTS lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(latitude::double precision)) STORED;
ALTER TABLE unified_assets ADD COLUMN IF NOT EXISTS lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(longitude::double precision)) STORED;

CREATE INDEX IF NOT EXISTS idx_unified_assets_grid ON unified_assets(lat_cell, lon_cell) 
  WHERE lat_cell IS NOT NULL AND lon_cell IS NOT NULL;

-- assets (from 021) grid columns
ALTER TABLE assets ADD COLUMN IF NOT EXISTS lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(latitude::double precision)) STORED;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(longitude::double precision)) STORED;

CREATE INDEX IF NOT EXISTS idx_assets_grid ON assets(lat_cell, lon_cell) 
  WHERE lat_cell IS NOT NULL AND lon_cell IS NOT NULL;

-- work_orders site grid columns
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS site_lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(site_latitude::double precision)) STORED;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS site_lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(site_longitude::double precision)) STORED;

CREATE INDEX IF NOT EXISTS idx_work_orders_site_grid ON work_orders(site_lat_cell, site_lon_cell) 
  WHERE site_lat_cell IS NOT NULL AND site_lon_cell IS NOT NULL;

-- asset_availability location grid columns
ALTER TABLE asset_availability ADD COLUMN IF NOT EXISTS location_lat_cell INTEGER 
  GENERATED ALWAYS AS (fn_lat_cell(location_latitude::double precision)) STORED;
ALTER TABLE asset_availability ADD COLUMN IF NOT EXISTS location_lon_cell INTEGER 
  GENERATED ALWAYS AS (fn_lon_cell(location_longitude::double precision)) STORED;

CREATE INDEX IF NOT EXISTS idx_asset_availability_grid ON asset_availability(location_lat_cell, location_lon_cell) 
  WHERE location_lat_cell IS NOT NULL AND location_lon_cell IS NOT NULL;

-- =====================================================================
-- PHASE 3: Drop Dependent Views, Triggers, and Columns
-- =====================================================================

-- First drop dependent views that reference geom columns
DROP VIEW IF EXISTS v_unified_accommodations CASCADE;
DROP VIEW IF EXISTS v_unified_parking CASCADE;
DROP VIEW IF EXISTS v_unified_towables CASCADE;
DROP VIEW IF EXISTS v_unified_self_contained CASCADE;
DROP VIEW IF EXISTS searchable_assets CASCADE;

-- Drop triggers that set geom columns
DROP TRIGGER IF EXISTS trg_external_records_geom ON external_records;
DROP TRIGGER IF EXISTS trg_entities_geom ON entities;
DROP TRIGGER IF EXISTS trg_sr_communities_geom ON sr_communities;

-- Drop trigger functions
DROP FUNCTION IF EXISTS set_external_record_geom();
DROP FUNCTION IF EXISTS set_entity_geom();
DROP FUNCTION IF EXISTS set_community_geom();

-- Drop PostGIS geom columns (CASCADE to handle any remaining dependencies)
ALTER TABLE external_records DROP COLUMN IF EXISTS geom CASCADE;
ALTER TABLE entities DROP COLUMN IF EXISTS geom CASCADE;
ALTER TABLE sr_communities DROP COLUMN IF EXISTS geom CASCADE;
ALTER TABLE unified_assets DROP COLUMN IF EXISTS geom CASCADE;
ALTER TABLE assets DROP COLUMN IF EXISTS geom CASCADE;
ALTER TABLE work_orders DROP COLUMN IF EXISTS site_geom CASCADE;
ALTER TABLE asset_availability DROP COLUMN IF EXISTS location_geom CASCADE;

-- Drop PostGIS indexes
DROP INDEX IF EXISTS idx_external_records_geom;
DROP INDEX IF EXISTS idx_entities_geom_v2;
DROP INDEX IF EXISTS idx_sr_communities_geom;
DROP INDEX IF EXISTS idx_unified_assets_location;
DROP INDEX IF EXISTS idx_assets_geom;

-- =====================================================================
-- PHASE 3B: Recreate views without geom references
-- =====================================================================

-- View: All accommodations (anything that can sleep people)
CREATE OR REPLACE VIEW v_unified_accommodations AS
SELECT 
  ua.id, ua.asset_type, ua.source_table, ua.source_id, ua.canvas_id,
  ua.name, ua.description, ua.slug,
  ua.owner_type, ua.owner_individual_id, ua.owner_tenant_id,
  ua.community_id, ua.region, ua.city, ua.latitude, ua.longitude,
  ua.lat_cell, ua.lon_cell, ua.location_description,
  ua.is_accommodation, ua.sleeps_total, ua.sleeps_comfortably, ua.bedrooms,
  ua.beds_king, ua.beds_queen, ua.beds_double, ua.beds_single, ua.beds_bunk, ua.beds_sofa,
  ua.private_bedrooms, ua.has_separate_entrance,
  ua.bathrooms_full, ua.bathrooms_half, ua.has_outdoor_shower, ua.bathroom_private,
  ua.is_self_contained, ua.fresh_water_gallons, ua.gray_water_gallons, ua.black_water_gallons,
  ua.propane_capacity_lbs, ua.battery_capacity_ah, ua.solar_watts, ua.generator_watts, ua.days_self_sufficient,
  ua.is_parkable_spot, ua.can_be_parked,
  ua.spot_length_ft, ua.spot_width_ft, ua.spot_surface,
  ua.max_vehicle_length_ft, ua.max_vehicle_height_ft, ua.max_vehicle_weight_lbs,
  ua.is_pull_through, ua.is_level,
  ua.has_power_hookup, ua.power_amps, ua.has_water_hookup, ua.has_sewer_hookup,
  ua.bathroom_distance_meters, ua.shower_distance_meters, ua.water_fill_distance_meters, ua.dump_station_distance_meters,
  ua.is_towable, ua.requires_tow_vehicle, ua.hitch_type, ua.gvwr_lbs, ua.tongue_weight_lbs,
  ua.is_equipment, ua.equipment_category_id, ua.brand, ua.model, ua.condition,
  ua.waiver_template_ids, ua.min_renter_age, ua.license_required, ua.certification_required, ua.insurance_required,
  ua.rate_hourly, ua.rate_half_day, ua.rate_daily, ua.rate_weekly, ua.rate_monthly,
  ua.deposit_amount, ua.cleaning_fee, ua.currency,
  ua.is_available, ua.available_from, ua.available_until, ua.min_booking_hours, ua.max_booking_days,
  ua.booking_lead_time_hours, ua.instant_book,
  ua.thumbnail_url, ua.images,
  ua.crew_score, ua.family_score, ua.trucker_score, ua.equestrian_score, ua.overall_rating, ua.review_count,
  ua.status, ua.is_verified, ua.verified_at, ua.created_at, ua.updated_at,
  CASE 
    WHEN ua.asset_type = 'property' THEN 'Full Property'
    WHEN ua.asset_type = 'spot' THEN 'Campsite/RV Spot'
    WHEN ua.asset_type = 'trailer' THEN 'Trailer/RV'
    WHEN ua.asset_type = 'vehicle_rv' THEN 'Motorhome'
    ELSE 'Other'
  END as accommodation_type_display
FROM unified_assets ua
WHERE ua.is_accommodation = true
  AND ua.sleeps_total > 0
  AND ua.status = 'active';

-- View: All parking spots (places where you can park trailers/RVs)
CREATE OR REPLACE VIEW v_unified_parking AS
SELECT 
  ua.id, ua.asset_type, ua.source_table, ua.source_id, ua.canvas_id,
  ua.name, ua.description, ua.slug,
  ua.owner_type, ua.owner_individual_id, ua.owner_tenant_id,
  ua.community_id, ua.region, ua.city, ua.latitude, ua.longitude,
  ua.lat_cell, ua.lon_cell, ua.location_description,
  ua.is_accommodation, ua.sleeps_total, ua.sleeps_comfortably, ua.bedrooms,
  ua.beds_king, ua.beds_queen, ua.beds_double, ua.beds_single, ua.beds_bunk, ua.beds_sofa,
  ua.private_bedrooms, ua.has_separate_entrance,
  ua.bathrooms_full, ua.bathrooms_half, ua.has_outdoor_shower, ua.bathroom_private,
  ua.is_self_contained, ua.fresh_water_gallons, ua.gray_water_gallons, ua.black_water_gallons,
  ua.propane_capacity_lbs, ua.battery_capacity_ah, ua.solar_watts, ua.generator_watts, ua.days_self_sufficient,
  ua.is_parkable_spot, ua.can_be_parked,
  ua.spot_length_ft, ua.spot_width_ft, ua.spot_surface,
  ua.max_vehicle_length_ft, ua.max_vehicle_height_ft, ua.max_vehicle_weight_lbs,
  ua.is_pull_through, ua.is_level,
  ua.has_power_hookup, ua.power_amps, ua.has_water_hookup, ua.has_sewer_hookup,
  ua.bathroom_distance_meters, ua.shower_distance_meters, ua.water_fill_distance_meters, ua.dump_station_distance_meters,
  ua.is_towable, ua.requires_tow_vehicle, ua.hitch_type, ua.gvwr_lbs, ua.tongue_weight_lbs,
  ua.is_equipment, ua.equipment_category_id, ua.brand, ua.model, ua.condition,
  ua.waiver_template_ids, ua.min_renter_age, ua.license_required, ua.certification_required, ua.insurance_required,
  ua.rate_hourly, ua.rate_half_day, ua.rate_daily, ua.rate_weekly, ua.rate_monthly,
  ua.deposit_amount, ua.cleaning_fee, ua.currency,
  ua.is_available, ua.available_from, ua.available_until, ua.min_booking_hours, ua.max_booking_days,
  ua.booking_lead_time_hours, ua.instant_book,
  ua.thumbnail_url, ua.images,
  ua.crew_score, ua.family_score, ua.trucker_score, ua.equestrian_score, ua.overall_rating, ua.review_count,
  ua.status, ua.is_verified, ua.verified_at, ua.created_at, ua.updated_at,
  CASE 
    WHEN ua.has_power_hookup AND ua.has_water_hookup AND ua.has_sewer_hookup THEN 'Full Hookup'
    WHEN ua.has_power_hookup AND ua.has_water_hookup THEN 'Water/Electric'
    WHEN ua.has_power_hookup THEN 'Electric Only'
    ELSE 'Dry Camping'
  END as hookup_level
FROM unified_assets ua
WHERE ua.is_parkable_spot = true
  AND ua.status = 'active';

-- View: All towable assets (trailers that need a tow vehicle)
CREATE OR REPLACE VIEW v_unified_towables AS
SELECT 
  ua.id, ua.asset_type, ua.source_table, ua.source_id, ua.canvas_id,
  ua.name, ua.description, ua.slug,
  ua.owner_type, ua.owner_individual_id, ua.owner_tenant_id,
  ua.community_id, ua.region, ua.city, ua.latitude, ua.longitude,
  ua.lat_cell, ua.lon_cell, ua.location_description,
  ua.is_accommodation, ua.sleeps_total, ua.sleeps_comfortably, ua.bedrooms,
  ua.beds_king, ua.beds_queen, ua.beds_double, ua.beds_single, ua.beds_bunk, ua.beds_sofa,
  ua.private_bedrooms, ua.has_separate_entrance,
  ua.bathrooms_full, ua.bathrooms_half, ua.has_outdoor_shower, ua.bathroom_private,
  ua.is_self_contained, ua.fresh_water_gallons, ua.gray_water_gallons, ua.black_water_gallons,
  ua.propane_capacity_lbs, ua.battery_capacity_ah, ua.solar_watts, ua.generator_watts, ua.days_self_sufficient,
  ua.is_parkable_spot, ua.can_be_parked,
  ua.spot_length_ft, ua.spot_width_ft, ua.spot_surface,
  ua.max_vehicle_length_ft, ua.max_vehicle_height_ft, ua.max_vehicle_weight_lbs,
  ua.is_pull_through, ua.is_level,
  ua.has_power_hookup, ua.power_amps, ua.has_water_hookup, ua.has_sewer_hookup,
  ua.bathroom_distance_meters, ua.shower_distance_meters, ua.water_fill_distance_meters, ua.dump_station_distance_meters,
  ua.is_towable, ua.requires_tow_vehicle, ua.hitch_type, ua.gvwr_lbs, ua.tongue_weight_lbs,
  ua.is_equipment, ua.equipment_category_id, ua.brand, ua.model, ua.condition,
  ua.waiver_template_ids, ua.min_renter_age, ua.license_required, ua.certification_required, ua.insurance_required,
  ua.rate_hourly, ua.rate_half_day, ua.rate_daily, ua.rate_weekly, ua.rate_monthly,
  ua.deposit_amount, ua.cleaning_fee, ua.currency,
  ua.is_available, ua.available_from, ua.available_until, ua.min_booking_hours, ua.max_booking_days,
  ua.booking_lead_time_hours, ua.instant_book,
  ua.thumbnail_url, ua.images,
  ua.crew_score, ua.family_score, ua.trucker_score, ua.equestrian_score, ua.overall_rating, ua.review_count,
  ua.status, ua.is_verified, ua.verified_at, ua.created_at, ua.updated_at,
  CASE 
    WHEN ua.gvwr_lbs <= 3500 THEN 'Light'
    WHEN ua.gvwr_lbs <= 7000 THEN 'Medium'
    WHEN ua.gvwr_lbs <= 14000 THEN 'Heavy'
    ELSE 'Very Heavy'
  END as weight_class
FROM unified_assets ua
WHERE ua.is_towable = true
  AND ua.status = 'active';

-- View: Self-contained assets (can boondock without hookups)
CREATE OR REPLACE VIEW v_unified_self_contained AS
SELECT 
  ua.id, ua.asset_type, ua.source_table, ua.source_id, ua.canvas_id,
  ua.name, ua.description, ua.slug,
  ua.owner_type, ua.owner_individual_id, ua.owner_tenant_id,
  ua.community_id, ua.region, ua.city, ua.latitude, ua.longitude,
  ua.lat_cell, ua.lon_cell, ua.location_description,
  ua.is_accommodation, ua.sleeps_total, ua.sleeps_comfortably, ua.bedrooms,
  ua.beds_king, ua.beds_queen, ua.beds_double, ua.beds_single, ua.beds_bunk, ua.beds_sofa,
  ua.private_bedrooms, ua.has_separate_entrance,
  ua.bathrooms_full, ua.bathrooms_half, ua.has_outdoor_shower, ua.bathroom_private,
  ua.is_self_contained, ua.fresh_water_gallons, ua.gray_water_gallons, ua.black_water_gallons,
  ua.propane_capacity_lbs, ua.battery_capacity_ah, ua.solar_watts, ua.generator_watts, ua.days_self_sufficient,
  ua.is_parkable_spot, ua.can_be_parked,
  ua.spot_length_ft, ua.spot_width_ft, ua.spot_surface,
  ua.max_vehicle_length_ft, ua.max_vehicle_height_ft, ua.max_vehicle_weight_lbs,
  ua.is_pull_through, ua.is_level,
  ua.has_power_hookup, ua.power_amps, ua.has_water_hookup, ua.has_sewer_hookup,
  ua.bathroom_distance_meters, ua.shower_distance_meters, ua.water_fill_distance_meters, ua.dump_station_distance_meters,
  ua.is_towable, ua.requires_tow_vehicle, ua.hitch_type, ua.gvwr_lbs, ua.tongue_weight_lbs,
  ua.is_equipment, ua.equipment_category_id, ua.brand, ua.model, ua.condition,
  ua.waiver_template_ids, ua.min_renter_age, ua.license_required, ua.certification_required, ua.insurance_required,
  ua.rate_hourly, ua.rate_half_day, ua.rate_daily, ua.rate_weekly, ua.rate_monthly,
  ua.deposit_amount, ua.cleaning_fee, ua.currency,
  ua.is_available, ua.available_from, ua.available_until, ua.min_booking_hours, ua.max_booking_days,
  ua.booking_lead_time_hours, ua.instant_book,
  ua.thumbnail_url, ua.images,
  ua.crew_score, ua.family_score, ua.trucker_score, ua.equestrian_score, ua.overall_rating, ua.review_count,
  ua.status, ua.is_verified, ua.verified_at, ua.created_at, ua.updated_at,
  CASE 
    WHEN ua.fresh_water_gallons IS NULL THEN 0
    WHEN ua.fresh_water_gallons < 20 THEN 1
    WHEN ua.fresh_water_gallons < 50 THEN 3
    WHEN ua.fresh_water_gallons < 100 THEN 5
    ELSE 7
  END as estimated_days_water,
  CASE 
    WHEN ua.battery_capacity_ah IS NULL THEN 'None'
    WHEN ua.battery_capacity_ah < 100 THEN 'Basic'
    WHEN ua.battery_capacity_ah < 300 THEN 'Good'
    ELSE 'Excellent'
  END as power_capacity_rating
FROM unified_assets ua
WHERE ua.is_self_contained = true
  AND ua.status = 'active';

-- =====================================================================
-- PHASE 4: Replace resolve_community() [from 018/019]
-- =====================================================================

CREATE OR REPLACE FUNCTION resolve_community(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_city TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_community_id UUID;
  v_bbox RECORD;
  v_search_radius DOUBLE PRECISION := 50000; -- 50km initial
  v_max_radius DOUBLE PRECISION := 500000;   -- 500km max
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
  
  -- Fall back to nearest by coordinates using haversine + bbox
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    -- Expand search radius until we find something
    WHILE v_search_radius <= v_max_radius LOOP
      SELECT * INTO v_bbox FROM fn_bbox(p_lat, p_lng, v_search_radius);
      
      SELECT id INTO v_community_id
      FROM sr_communities
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        -- Bbox prefilter (uses grid index)
        AND latitude BETWEEN v_bbox.min_lat AND v_bbox.max_lat
        AND longitude BETWEEN v_bbox.min_lon AND v_bbox.max_lon
        -- Haversine filter
        AND fn_haversine_meters(latitude, longitude, p_lat, p_lng) <= v_search_radius
      ORDER BY fn_haversine_meters(latitude, longitude, p_lat, p_lng)
      LIMIT 1;
      
      IF v_community_id IS NOT NULL THEN
        RETURN v_community_id;
      END IF;
      
      v_search_radius := v_search_radius * 2;
    END LOOP;
    
    -- Last resort: find absolute nearest (no radius limit)
    SELECT id INTO v_community_id
    FROM sr_communities
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY fn_haversine_meters(latitude, longitude, p_lat, p_lng)
    LIMIT 1;
  END IF;
  
  RETURN v_community_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PHASE 5: Replace find_assets_by_capability() [from 021]
-- =====================================================================

CREATE OR REPLACE FUNCTION find_assets_by_capability(
  p_capability_type TEXT,
  p_min_attributes JSONB DEFAULT '{}',
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT 100,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  asset_id UUID,
  name TEXT,
  asset_type TEXT,
  capability_attributes JSONB,
  distance_km NUMERIC,
  rate_daily NUMERIC,
  thumbnail_url TEXT
) AS $$
DECLARE
  v_bbox RECORD;
  v_radius_m DOUBLE PRECISION;
BEGIN
  v_radius_m := COALESCE(p_radius_km, 100) * 1000;
  
  -- Get bbox if location provided
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT * INTO v_bbox FROM fn_bbox(p_latitude::double precision, p_longitude::double precision, v_radius_m);
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.asset_type,
    ac.attributes,
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND a.latitude IS NOT NULL
      THEN ROUND((fn_haversine_meters(a.latitude::double precision, a.longitude::double precision, 
                                       p_latitude::double precision, p_longitude::double precision) / 1000)::numeric, 1)
      ELSE NULL
    END,
    t.rate_daily,
    a.thumbnail_url
  FROM assets a
  JOIN asset_capabilities ac ON ac.asset_id = a.id
  LEFT JOIN asset_terms t ON t.asset_id = a.id
  WHERE a.status = 'active'
    AND ac.capability_type = p_capability_type
    AND ac.is_active = true
    -- Check minimum attribute requirements
    AND (p_min_attributes = '{}' OR (
         (NOT p_min_attributes ? 'people' OR (ac.attributes->>'people')::int >= (p_min_attributes->>'people')::int) AND
         (NOT p_min_attributes ? 'private_bedrooms' OR (ac.attributes->>'private_bedrooms')::int >= (p_min_attributes->>'private_bedrooms')::int) AND
         (NOT p_min_attributes ? 'max_length_ft' OR (ac.attributes->>'max_length_ft')::int >= (p_min_attributes->>'max_length_ft')::int) AND
         (NOT p_min_attributes ? 'days_autonomy' OR (ac.attributes->>'days_autonomy')::int >= (p_min_attributes->>'days_autonomy')::int)
    ))
    -- Spatial filter: bbox prefilter + haversine
    AND (
      p_latitude IS NULL 
      OR p_longitude IS NULL 
      OR a.latitude IS NULL
      OR (
        -- Bbox prefilter
        a.latitude::double precision BETWEEN v_bbox.min_lat AND v_bbox.max_lat
        AND a.longitude::double precision BETWEEN v_bbox.min_lon AND v_bbox.max_lon
        -- Haversine filter
        AND fn_haversine_meters(a.latitude::double precision, a.longitude::double precision, 
                                 p_latitude::double precision, p_longitude::double precision) <= v_radius_m
      )
    )
  ORDER BY 
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND a.latitude IS NOT NULL
      THEN fn_haversine_meters(a.latitude::double precision, a.longitude::double precision, 
                                p_latitude::double precision, p_longitude::double precision)
      ELSE 0
    END,
    t.rate_daily ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PHASE 6: Replace sync functions [from 020]
-- =====================================================================

-- sync_staging_property_to_unified - remove geom assignment
CREATE OR REPLACE FUNCTION sync_staging_property_to_unified(property_id INTEGER)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  prop RECORD;
BEGIN
  SELECT * INTO prop FROM staging_properties WHERE id = property_id;
  
  IF prop IS NULL THEN
    RAISE EXCEPTION 'Staging property % not found', property_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    community_id, region, city, latitude, longitude,
    is_accommodation, sleeps_total, bedrooms,
    bathrooms_full,
    is_parkable_spot, spot_length_ft, spot_width_ft,
    max_vehicle_length_ft, max_vehicle_height_ft,
    has_power_hookup, power_amps, has_water_hookup, has_sewer_hookup,
    rate_daily, rate_weekly, rate_monthly,
    crew_score, family_score, trucker_score, equestrian_score,
    overall_rating, review_count,
    thumbnail_url, images, status
  ) VALUES (
    CASE WHEN prop.property_type IN ('rv_park', 'campground', 'parking_lot', 'industrial_yard', 'boondocking') 
         THEN 'spot' ELSE 'property' END,
    'staging_properties', property_id::text,
    prop.name, prop.description, lower(regexp_replace(prop.name, '[^a-zA-Z0-9]+', '-', 'g')),
    NULL,
    prop.region, prop.city, prop.latitude, prop.longitude,
    COALESCE(prop.beds > 0 OR prop.bedrooms > 0, false),
    COALESCE(prop.max_guests, prop.beds),
    prop.bedrooms,
    COALESCE(prop.bathrooms, 0)::integer,
    prop.property_type IN ('rv_park', 'campground', 'parking_lot', 'industrial_yard', 'boondocking', 'marina'),
    prop.spot_length_ft, prop.spot_width_ft,
    prop.max_vehicle_length_ft, prop.max_vehicle_height_ft,
    prop.has_shore_power, prop.power_amps, prop.has_water_hookup, prop.has_sewer_hookup,
    NULL, NULL, NULL,
    prop.crew_score, prop.family_score, prop.trucker_score, prop.equestrian_score,
    prop.overall_rating, prop.review_count,
    prop.thumbnail_url, prop.images, 
    CASE WHEN prop.status = 'active' THEN 'active' ELSE 'pending_approval' END
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    sleeps_total = EXCLUDED.sleeps_total,
    crew_score = EXCLUDED.crew_score,
    overall_rating = EXCLUDED.overall_rating,
    review_count = EXCLUDED.review_count,
    thumbnail_url = EXCLUDED.thumbnail_url,
    images = EXCLUDED.images,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- sync_staging_spot_to_unified - remove geom assignment
CREATE OR REPLACE FUNCTION sync_staging_spot_to_unified(spot_id INTEGER)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  sp RECORD;
BEGIN
  SELECT s.*, p.latitude, p.longitude, p.region, p.city, p.name as property_name
  INTO sp
  FROM staging_spots s
  LEFT JOIN staging_properties p ON s.property_id = p.id
  WHERE s.id = spot_id;
  
  IF sp IS NULL THEN
    RAISE EXCEPTION 'Staging spot % not found', spot_id;
  END IF;
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    region, city, latitude, longitude,
    is_parkable_spot,
    spot_length_ft, spot_width_ft,
    max_vehicle_length_ft, max_vehicle_height_ft,
    is_pull_through, is_level,
    spot_surface,
    has_power_hookup, power_amps, has_water_hookup, has_sewer_hookup,
    rate_daily, rate_weekly, rate_monthly,
    status
  ) VALUES (
    'spot', 'staging_spots', spot_id::text,
    COALESCE(sp.spot_name, sp.property_name || ' - Spot ' || sp.spot_number),
    sp.notes,
    lower(regexp_replace(COALESCE(sp.spot_name, 'spot-' || spot_id::text), '[^a-zA-Z0-9]+', '-', 'g')),
    sp.region, sp.city, sp.latitude, sp.longitude,
    true,
    COALESCE(sp.length_ft, sp.max_length_ft),
    COALESCE(sp.width_ft, sp.max_width_ft),
    sp.max_length_ft, sp.max_height_ft,
    COALESCE(sp.is_pull_through, false),
    COALESCE(sp.is_level, true),
    sp.surface_type,
    COALESCE(sp.has_power, false),
    CASE WHEN sp.power_amps IS NOT NULL THEN ARRAY[sp.power_amps] ELSE NULL END,
    COALESCE(sp.has_water, false),
    COALESCE(sp.has_sewer, false),
    sp.nightly_rate, sp.weekly_rate, sp.monthly_rate,
    CASE WHEN sp.status = 'available' AND sp.is_available THEN 'active' ELSE 'maintenance' END
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    spot_length_ft = EXCLUDED.spot_length_ft,
    spot_width_ft = EXCLUDED.spot_width_ft,
    rate_daily = EXCLUDED.rate_daily,
    rate_weekly = EXCLUDED.rate_weekly,
    rate_monthly = EXCLUDED.rate_monthly,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PHASE 7: Replace searchable_assets view [from 021]
-- =====================================================================

CREATE OR REPLACE VIEW searchable_assets AS
SELECT 
  a.id,
  a.asset_type,
  a.asset_subtype,
  a.source_table,
  a.source_id,
  a.canvas_id,
  a.name,
  a.slug,
  a.owner_type,
  a.owner_individual_id,
  a.owner_tenant_id,
  a.owner_nation_id,
  a.home_community_id,
  a.region,
  a.city,
  a.latitude,
  a.longitude,
  a.lat_cell,
  a.lon_cell,
  a.thumbnail_url,
  a.crew_score,
  a.family_score,
  a.trucker_score,
  a.equestrian_score,
  a.overall_rating,
  a.review_count,
  a.status,
  a.is_verified,
  
  -- Commercial terms (joined)
  t.rate_hourly,
  t.rate_half_day,
  t.rate_daily,
  t.rate_weekly,
  t.rate_monthly,
  t.cleaning_fee,
  t.deposit_required,
  t.deposit_type,
  t.min_nights,
  t.max_nights,
  t.instant_book,
  
  -- ALL the detailed attributes from staging_properties (integer id)
  CASE WHEN a.source_table = 'staging_properties' AND a.source_id ~ '^\d+$' THEN
    (SELECT row_to_json(sp.*)::jsonb FROM staging_properties sp WHERE sp.id = a.source_id::integer)
  ELSE NULL END as property_details,
  
  -- ALL the detailed attributes from trailer_profiles (UUID id)
  CASE WHEN a.source_table = 'trailer_profiles' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(tp.*)::jsonb FROM trailer_profiles tp WHERE tp.id = a.source_id::uuid)
  ELSE NULL END as trailer_details,
  
  -- ALL the detailed attributes from cc_rental_items (UUID id)
  CASE WHEN a.source_table = 'cc_rental_items' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(ri.*)::jsonb FROM cc_rental_items ri WHERE ri.id = a.source_id::uuid)
  ELSE NULL END as rental_details,
  
  -- ALL the detailed attributes from cc_vehicles (UUID id)
  CASE WHEN a.source_table = 'cc_vehicles' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(v.*)::jsonb FROM cc_vehicles v WHERE v.id = a.source_id::uuid)
  ELSE NULL END as vehicle_details,
  
  -- ALL the detailed attributes from external_records (UUID id)
  CASE WHEN a.source_table = 'external_records' AND a.source_id ~ '^[0-9a-f]{8}-' THEN
    (SELECT row_to_json(er.*)::jsonb FROM external_records er WHERE er.id = a.source_id::uuid)
  ELSE NULL END as external_details,
  
  -- Aggregated capabilities for quick filtering
  (SELECT jsonb_agg(jsonb_build_object(
    'type', ac.capability_type, 
    'attrs', ac.attributes,
    'constraints', ac.constraints,
    'active', ac.is_active
  ))
   FROM asset_capabilities ac WHERE ac.asset_id = a.id AND ac.is_active = true) as capabilities

FROM assets a
LEFT JOIN asset_terms t ON t.asset_id = a.id
WHERE a.status = 'active';

-- =====================================================================
-- PHASE 8: Convenience function for nearby search
-- =====================================================================

-- Find communities near a point
CREATE OR REPLACE FUNCTION find_community_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 50
) RETURNS TABLE (
  id UUID,
  name TEXT,
  region TEXT,
  distance_km DOUBLE PRECISION
) AS $$
DECLARE
  v_bbox RECORD;
  v_radius_m DOUBLE PRECISION;
BEGIN
  v_radius_m := COALESCE(p_radius_km, 50) * 1000;
  SELECT * INTO v_bbox FROM fn_bbox(p_lat, p_lng, v_radius_m);
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.region,
    ROUND((fn_haversine_meters(c.latitude, c.longitude, p_lat, p_lng) / 1000)::numeric, 2)::double precision
  FROM sr_communities c
  WHERE c.latitude IS NOT NULL 
    AND c.longitude IS NOT NULL
    -- Bbox prefilter
    AND c.latitude BETWEEN v_bbox.min_lat AND v_bbox.max_lat
    AND c.longitude BETWEEN v_bbox.min_lon AND v_bbox.max_lon
    -- Haversine filter
    AND fn_haversine_meters(c.latitude, c.longitude, p_lat, p_lng) <= v_radius_m
  ORDER BY fn_haversine_meters(c.latitude, c.longitude, p_lat, p_lng);
END;
$$ LANGUAGE plpgsql;

-- Drop old overloaded versions of search_unified_assets that use PostGIS
DROP FUNCTION IF EXISTS search_unified_assets(integer, numeric, numeric, integer, boolean, integer, boolean, text[], integer);

-- Search unified assets near a point
CREATE OR REPLACE FUNCTION search_unified_assets(
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 100,
  p_asset_types TEXT[] DEFAULT NULL,
  p_is_accommodation BOOLEAN DEFAULT NULL,
  p_min_sleeps INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  asset_type VARCHAR(30),
  name VARCHAR(255),
  city VARCHAR(100),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  distance_km DOUBLE PRECISION,
  sleeps_total INTEGER,
  rate_daily NUMERIC,
  thumbnail_url TEXT,
  status VARCHAR(30)
) AS $$
DECLARE
  v_bbox RECORD;
  v_radius_m DOUBLE PRECISION;
BEGIN
  v_radius_m := COALESCE(p_radius_km, 100) * 1000;
  
  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    SELECT * INTO v_bbox FROM fn_bbox(p_latitude, p_longitude, v_radius_m);
  END IF;
  
  RETURN QUERY
  SELECT 
    ua.id,
    ua.asset_type,
    ua.name,
    ua.city,
    ua.latitude,
    ua.longitude,
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ua.latitude IS NOT NULL
      THEN ROUND((fn_haversine_meters(ua.latitude::double precision, ua.longitude::double precision, 
                                       p_latitude, p_longitude) / 1000)::numeric, 2)::double precision
      ELSE NULL
    END,
    ua.sleeps_total,
    ua.rate_daily,
    ua.thumbnail_url,
    ua.status
  FROM unified_assets ua
  WHERE ua.status = 'active'
    AND (p_asset_types IS NULL OR ua.asset_type = ANY(p_asset_types))
    AND (p_is_accommodation IS NULL OR ua.is_accommodation = p_is_accommodation)
    AND (p_min_sleeps IS NULL OR ua.sleeps_total >= p_min_sleeps)
    AND (
      p_latitude IS NULL 
      OR p_longitude IS NULL 
      OR ua.latitude IS NULL
      OR (
        -- Bbox prefilter
        ua.latitude::double precision BETWEEN v_bbox.min_lat AND v_bbox.max_lat
        AND ua.longitude::double precision BETWEEN v_bbox.min_lon AND v_bbox.max_lon
        -- Haversine filter
        AND fn_haversine_meters(ua.latitude::double precision, ua.longitude::double precision, 
                                 p_latitude, p_longitude) <= v_radius_m
      )
    )
  ORDER BY 
    CASE 
      WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ua.latitude IS NOT NULL
      THEN fn_haversine_meters(ua.latitude::double precision, ua.longitude::double precision, p_latitude, p_longitude)
      ELSE 0
    END
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PHASE 9: Replace sync_external_record_to_unified [from 020]
-- =====================================================================

CREATE OR REPLACE FUNCTION sync_external_record_to_unified(record_id UUID)
RETURNS UUID AS $$
DECLARE
  asset_uuid UUID;
  r RECORD;
  slug_val VARCHAR(100);
BEGIN
  SELECT * INTO r FROM external_records WHERE id = record_id;
  
  IF r IS NULL THEN
    RAISE EXCEPTION 'External record % not found', record_id;
  END IF;
  
  -- Generate slug and truncate to 100 chars
  slug_val := left(lower(regexp_replace(COALESCE(r.name, 'listing-' || record_id::text), '[^a-zA-Z0-9]+', '-', 'g')), 100);
  
  INSERT INTO unified_assets (
    asset_type, source_table, source_id,
    name, description, slug,
    owner_type,
    community_id, region, city, latitude, longitude,
    is_accommodation,
    sleeps_total,
    bedrooms,
    bathrooms_full,
    rate_daily,
    currency,
    overall_rating,
    review_count,
    status,
    is_verified,
    thumbnail_url,
    images
  ) VALUES (
    'property', 'external_records', record_id::text,
    r.name, r.description, slug_val,
    'platform',
    r.community_id, r.region, r.city, r.latitude, r.longitude,
    true,
    COALESCE(r.max_occupancy, 1),
    r.bedrooms,
    COALESCE(r.bathrooms, 0)::integer,
    r.price,
    COALESCE(r.currency, 'CAD'),
    r.rating,
    r.review_count,
    'active',
    false,
    CASE WHEN jsonb_array_length(COALESCE(r.photos, '[]'::jsonb)) > 0 
         THEN r.photos->0->>'url' 
         ELSE NULL END,
    COALESCE(r.photos, '[]'::jsonb)
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sleeps_total = EXCLUDED.sleeps_total,
    bedrooms = EXCLUDED.bedrooms,
    rate_daily = EXCLUDED.rate_daily,
    overall_rating = EXCLUDED.overall_rating,
    review_count = EXCLUDED.review_count,
    thumbnail_url = EXCLUDED.thumbnail_url,
    images = EXCLUDED.images,
    updated_at = now()
  RETURNING id INTO asset_uuid;
  
  RETURN asset_uuid;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PHASE 10: Remove PostGIS extension reference
-- =====================================================================

-- Note: We don't DROP EXTENSION postgis because it may not have been created
-- The CREATE EXTENSION IF NOT EXISTS in earlier migrations will simply not execute
-- in production since postgis doesn't exist there

-- =====================================================================
-- VERIFY
-- =====================================================================

SELECT 'Migration 028: PostGIS removed, haversine-based geo functions installed' AS status;

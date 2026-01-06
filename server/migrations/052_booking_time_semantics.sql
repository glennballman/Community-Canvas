-- Migration 052: Booking Time Semantics Layer
-- Human-friendly time semantics (check-in/out, arrive/depart, pickup/return)
-- while storing precise 15-minute snapped timestamps

-- Add booking mode type
DO $$ BEGIN
  CREATE TYPE booking_mode AS ENUM ('check_in_out', 'arrive_depart', 'pickup_return');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add duration preset type
DO $$ BEGIN
  CREATE TYPE duration_preset AS ENUM ('half_day_4h', 'full_day_8h', 'overnight_24h', 'nights', 'custom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add booking semantics fields to cc_rental_items
ALTER TABLE cc_rental_items 
  ADD COLUMN IF NOT EXISTS booking_mode booking_mode DEFAULT 'pickup_return',
  ADD COLUMN IF NOT EXISTS default_duration_preset duration_preset,
  ADD COLUMN IF NOT EXISTS default_start_time_local TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS default_end_time_local TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS turnover_buffer_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes INTEGER DEFAULT 0;

-- Add booking semantics fields to unified_assets for consistency
ALTER TABLE unified_assets
  ADD COLUMN IF NOT EXISTS booking_mode booking_mode DEFAULT 'pickup_return',
  ADD COLUMN IF NOT EXISTS default_duration_preset duration_preset,
  ADD COLUMN IF NOT EXISTS default_start_time_local TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS default_end_time_local TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS turnover_buffer_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes INTEGER DEFAULT 0;

-- Set sensible defaults based on asset type / category
-- Rooms/accommodations: check_in_out with 16:00 check-in, 11:00 check-out
UPDATE cc_rental_items ri
SET 
  booking_mode = 'check_in_out',
  default_duration_preset = 'nights',
  default_start_time_local = '16:00',
  default_end_time_local = '11:00',
  turnover_buffer_minutes = 60
FROM cc_rental_categories rc
WHERE ri.category_id = rc.id
  AND rc.slug IN ('accommodations', 'cottages', 'rv-camping');

-- Watercraft/equipment: pickup_return with 09:00 start, half-day default
UPDATE cc_rental_items ri
SET 
  booking_mode = 'pickup_return',
  default_duration_preset = 'half_day_4h',
  default_start_time_local = '09:00',
  default_end_time_local = '17:00',
  turnover_buffer_minutes = 15
FROM cc_rental_categories rc
WHERE ri.category_id = rc.id
  AND rc.slug IN ('watercraft', 'tools', 'bicycles', 'outdoor-recreation');

-- Parking/moorage: arrive_depart with flexible times
UPDATE cc_rental_items ri
SET 
  booking_mode = 'arrive_depart',
  default_duration_preset = 'custom',
  default_start_time_local = '00:00',
  default_end_time_local = '23:45',
  turnover_buffer_minutes = 0
FROM cc_rental_categories rc
WHERE ri.category_id = rc.id
  AND rc.slug IN ('parking', 'moorage');

-- Sync to unified_assets
UPDATE unified_assets ua
SET
  booking_mode = ri.booking_mode,
  default_duration_preset = ri.default_duration_preset,
  default_start_time_local = ri.default_start_time_local,
  default_end_time_local = ri.default_end_time_local,
  turnover_buffer_minutes = ri.turnover_buffer_minutes,
  travel_buffer_minutes = ri.travel_buffer_minutes
FROM cc_rental_items ri
WHERE ua.source_table = 'cc_rental_items' 
  AND ua.source_id = ri.id::text;

-- Add comment for documentation
COMMENT ON COLUMN cc_rental_items.booking_mode IS 'Human-friendly time labels: check_in_out (rooms), arrive_depart (parking), pickup_return (equipment)';
COMMENT ON COLUMN cc_rental_items.default_duration_preset IS 'Default duration: half_day_4h, full_day_8h, overnight_24h, nights, or custom';
COMMENT ON COLUMN cc_rental_items.default_start_time_local IS 'Default start time (check-in, pickup, arrival)';
COMMENT ON COLUMN cc_rental_items.default_end_time_local IS 'Default end time (check-out, return, departure)';
COMMENT ON COLUMN cc_rental_items.turnover_buffer_minutes IS 'Cleaning/prep buffer after each booking';
COMMENT ON COLUMN cc_rental_items.travel_buffer_minutes IS 'Travel/ferry constraint buffer';

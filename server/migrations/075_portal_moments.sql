BEGIN;

-- ============ EXTEND PORTAL MOMENTS ============
-- Add new columns for bookable experiences

-- Add all new columns first
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS slug varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS subtitle varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES cc_tenants(id) ON DELETE SET NULL;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS category varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS gallery_urls text[];
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS available_days integer[];
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS available_start_time time;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS available_end_time time;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS advance_booking_days integer DEFAULT 1;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS max_advance_days integer DEFAULT 90;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS min_participants integer DEFAULT 1;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS max_participants integer;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS min_age integer;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS price_cents integer;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS price_per varchar DEFAULT 'person';
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS currency varchar DEFAULT 'CAD';
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS deposit_percent integer DEFAULT 25;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS reservation_mode varchar DEFAULT 'internal';
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES cc_facilities(id) ON DELETE SET NULL;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES cc_offers(id) ON DELETE SET NULL;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS provider_name varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS provider_email varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS provider_phone varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS external_booking_url text;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS weather_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS constraints_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS schema_type varchar DEFAULT 'Event';
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS seo_title varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS seo_description varchar;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE cc_portal_moments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows
UPDATE cc_portal_moments SET 
  slug = COALESCE(slug, lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))),
  updated_at = COALESCE(updated_at, created_at),
  weather_json = COALESCE(weather_json, '{}'::jsonb),
  constraints_json = COALESCE(constraints_json, '{}'::jsonb),
  is_featured = COALESCE(is_featured, false),
  display_order = COALESCE(display_order, sort_order, 0)
WHERE slug IS NULL OR updated_at IS NULL;

-- Set slug NOT NULL after backfill
ALTER TABLE cc_portal_moments ALTER COLUMN slug SET NOT NULL;

-- Add CHECK constraints for enumerated columns
-- Includes both new bookable types AND legacy moment types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_portal_moments_moment_type_check') THEN
    ALTER TABLE cc_portal_moments ADD CONSTRAINT cc_portal_moments_moment_type_check 
      CHECK (moment_type IN (
        'activity', 'charter', 'tour', 'meal', 'experience', 'rental', 'lesson', 'workshop', 'event', 'package',
        'photo', 'play', 'rainy_day', 'campfire', 'beach', 'stop', 'sunrise', 'sunset'
      ));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_portal_moments_price_per_check') THEN
    ALTER TABLE cc_portal_moments ADD CONSTRAINT cc_portal_moments_price_per_check 
      CHECK (price_per IS NULL OR price_per IN ('person', 'group', 'hour', 'day', 'item'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_portal_moments_reservation_mode_check') THEN
    ALTER TABLE cc_portal_moments ADD CONSTRAINT cc_portal_moments_reservation_mode_check 
      CHECK (reservation_mode IS NULL OR reservation_mode IN ('internal', 'external', 'public'));
  END IF;
END $$;

-- Create unique constraint on portal_id + slug
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cc_portal_moments_portal_id_slug_key') THEN
    ALTER TABLE cc_portal_moments ADD CONSTRAINT cc_portal_moments_portal_id_slug_key UNIQUE (portal_id, slug);
  END IF;
END $$;

-- Create indices
CREATE INDEX IF NOT EXISTS idx_cc_moments_portal ON cc_portal_moments(portal_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cc_moments_type ON cc_portal_moments(portal_id, moment_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_cc_moments_featured ON cc_portal_moments(portal_id, is_featured) WHERE is_active AND is_featured;

-- Enable RLS
ALTER TABLE cc_portal_moments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cc_portal_moments' AND policyname = 'cc_portal_moments_tenant_isolation') THEN
    CREATE POLICY cc_portal_moments_tenant_isolation ON cc_portal_moments
      USING (
        current_setting('app.current_tenant_id', true) = '__SERVICE__'
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
        OR tenant_id IS NULL
      );
  END IF;
END $$;

-- ============ MOMENT AVAILABILITY ============

CREATE TABLE IF NOT EXISTS cc_moment_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id uuid NOT NULL REFERENCES cc_portal_moments(id) ON DELETE CASCADE,
  
  available_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  
  spots_total integer NOT NULL,
  spots_remaining integer NOT NULL,
  
  price_cents_override integer,
  
  status varchar DEFAULT 'available' CHECK (status IN (
    'available', 'limited', 'full', 'cancelled', 'weather_hold'
  )),
  
  notes text,
  weather_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_moment_avail_date ON cc_moment_availability(moment_id, available_date);
CREATE INDEX IF NOT EXISTS idx_cc_moment_avail_status ON cc_moment_availability(moment_id, status, available_date) 
  WHERE status IN ('available', 'limited');

ALTER TABLE cc_moment_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cc_moment_availability' AND policyname = 'cc_moment_availability_read') THEN
    CREATE POLICY cc_moment_availability_read ON cc_moment_availability FOR SELECT USING (true);
  END IF;
END $$;

-- ============ SEED BAMFIELD MOMENTS ============

DO $$
DECLARE
  v_portal_id uuid;
BEGIN
  SELECT id INTO v_portal_id FROM cc_portals WHERE slug = 'bamfield' LIMIT 1;
  
  IF v_portal_id IS NULL THEN
    RAISE NOTICE 'Bamfield portal not found, skipping seed';
    RETURN;
  END IF;
  
  -- Kayaking Experience
  INSERT INTO cc_portal_moments (
    portal_id, slug, title, subtitle, description, moment_type, category, tags,
    duration_minutes, min_participants, max_participants, min_age,
    price_cents, price_per, reservation_mode,
    provider_name, weather_json, constraints_json, is_featured
  ) VALUES (
    v_portal_id, 'kayak-tour', 'Barkley Sound Kayak Tour', 
    'Explore the pristine waters of Barkley Sound',
    'Paddle through calm waters, spot wildlife, and experience the rugged beauty of Vancouver Island''s west coast. Suitable for beginners with basic instruction included.',
    'activity', 'Water Sports', ARRAY['kayaking', 'wildlife', 'beginner-friendly', 'scenic'],
    180, 2, 8, 12,
    12500, 'person', 'external',
    'Bamfield Kayak Adventures',
    '{"sensitivity": "critical", "requires": {"wind_max_kph": 25, "rain_max_percent": 40}}',
    '{"physical_level": "moderate", "swimming_required": true, "wheelchair_accessible": false}',
    true
  ) ON CONFLICT (portal_id, slug) DO UPDATE SET 
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    duration_minutes = EXCLUDED.duration_minutes,
    price_cents = EXCLUDED.price_cents,
    provider_name = EXCLUDED.provider_name,
    weather_json = EXCLUDED.weather_json,
    constraints_json = EXCLUDED.constraints_json,
    is_featured = EXCLUDED.is_featured,
    updated_at = now();
  
  -- Whale Watching
  INSERT INTO cc_portal_moments (
    portal_id, slug, title, subtitle, description, moment_type, category, tags,
    duration_minutes, min_participants, max_participants,
    price_cents, price_per, reservation_mode,
    provider_name, weather_json, is_featured
  ) VALUES (
    v_portal_id, 'whale-watching', 'Pacific Rim Whale Watching',
    'See gray whales, orcas, and marine life',
    'Join our experienced guides on a zodiac tour through the Pacific Rim waters. Peak season March-October for gray whales, year-round for orcas.',
    'charter', 'Wildlife', ARRAY['whales', 'wildlife', 'ocean', 'photography'],
    240, 4, 12,
    18500, 'person', 'external',
    'West Coast Whale Watch',
    '{"sensitivity": "warning", "requires": {"wind_max_kph": 30}}',
    true
  ) ON CONFLICT (portal_id, slug) DO UPDATE SET 
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    duration_minutes = EXCLUDED.duration_minutes,
    price_cents = EXCLUDED.price_cents,
    provider_name = EXCLUDED.provider_name,
    weather_json = EXCLUDED.weather_json,
    is_featured = EXCLUDED.is_featured,
    updated_at = now();
  
  -- Hiking Trail
  INSERT INTO cc_portal_moments (
    portal_id, slug, title, subtitle, description, moment_type, category, tags,
    duration_minutes, min_participants, max_participants,
    price_cents, price_per, reservation_mode,
    weather_json, constraints_json
  ) VALUES (
    v_portal_id, 'west-coast-trail-day', 'West Coast Trail Day Hike',
    'Experience a section of the famous trail',
    'Guided day hike on a scenic section of the West Coast Trail. Learn about local flora, fauna, and First Nations history.',
    'tour', 'Hiking', ARRAY['hiking', 'nature', 'guided', 'forest'],
    360, 2, 10,
    9500, 'person', 'external',
    '{"sensitivity": "warning", "requires": {"rain_max_percent": 60}}',
    '{"physical_level": "challenging", "hiking_boots_required": true}'
  ) ON CONFLICT (portal_id, slug) DO UPDATE SET 
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    duration_minutes = EXCLUDED.duration_minutes,
    price_cents = EXCLUDED.price_cents,
    weather_json = EXCLUDED.weather_json,
    constraints_json = EXCLUDED.constraints_json,
    updated_at = now();
  
  -- Seafood Dinner
  INSERT INTO cc_portal_moments (
    portal_id, slug, title, subtitle, description, moment_type, category, tags,
    duration_minutes, min_participants, max_participants,
    price_cents, price_per, reservation_mode,
    provider_name, constraints_json
  ) VALUES (
    v_portal_id, 'seafood-feast', 'Bamfield Seafood Feast',
    'Fresh-caught local seafood experience',
    'Enjoy the freshest seafood prepared by local chefs. Features salmon, halibut, prawns, and oysters. Dietary accommodations available.',
    'meal', 'Dining', ARRAY['seafood', 'local', 'dinner', 'fresh'],
    120, 2, 20,
    7500, 'person', 'external',
    'Bamfield Lodge Restaurant',
    '{"dietary_accommodations": true}'
  ) ON CONFLICT (portal_id, slug) DO UPDATE SET 
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    duration_minutes = EXCLUDED.duration_minutes,
    price_cents = EXCLUDED.price_cents,
    provider_name = EXCLUDED.provider_name,
    constraints_json = EXCLUDED.constraints_json,
    updated_at = now();
  
  -- Storm Watching (seasonal)
  INSERT INTO cc_portal_moments (
    portal_id, slug, title, subtitle, description, moment_type, category, tags,
    duration_minutes, min_participants, max_participants,
    price_cents, price_per, reservation_mode,
    weather_json
  ) VALUES (
    v_portal_id, 'storm-watching', 'Pacific Storm Watching Experience',
    'Witness the raw power of winter storms',
    'From the safety of our oceanfront viewing area, watch massive Pacific storms crash against the coast. Hot drinks and snacks provided. Available November-February.',
    'experience', 'Nature', ARRAY['storm', 'winter', 'nature', 'photography'],
    180, 1, 20,
    4500, 'person', 'public',
    '{"sensitivity": "none", "best_conditions": {"storm_required": true}}'
  ) ON CONFLICT (portal_id, slug) DO UPDATE SET 
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags,
    duration_minutes = EXCLUDED.duration_minutes,
    price_cents = EXCLUDED.price_cents,
    weather_json = EXCLUDED.weather_json,
    updated_at = now();
  
  RAISE NOTICE 'Seeded 5 Bamfield moments';
END $$;

COMMIT;

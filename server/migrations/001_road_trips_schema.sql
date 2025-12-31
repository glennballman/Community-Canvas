-- =====================================================
-- BC ROAD TRIPS DATABASE SCHEMA
-- Migration: 001_road_trips_schema
-- =====================================================

-- Road Trips table
CREATE TABLE IF NOT EXISTS road_trips (
  id VARCHAR(100) PRIMARY KEY,
  slug VARCHAR(150) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  tagline VARCHAR(500),
  description TEXT,
  
  -- Categorization
  category VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) DEFAULT 'moderate',
  seasons TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Duration
  duration_min_hours INTEGER,
  duration_max_hours INTEGER,
  recommended_days INTEGER DEFAULT 1,
  best_start_time VARCHAR(20),
  
  -- Geography
  region VARCHAR(100),
  start_location_name VARCHAR(255),
  start_location_lat DECIMAL(10, 7),
  start_location_lng DECIMAL(10, 7),
  end_location_name VARCHAR(255),
  end_location_lat DECIMAL(10, 7),
  end_location_lng DECIMAL(10, 7),
  
  -- Estimated Costs
  cost_budget INTEGER DEFAULT 0,
  cost_moderate INTEGER DEFAULT 0,
  cost_comfort INTEGER DEFAULT 0,
  
  -- Media
  hero_image VARCHAR(500),
  
  -- Ratings
  rating DECIMAL(2, 1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Status
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  popularity_score INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Segments table
CREATE TABLE IF NOT EXISTS trip_segments (
  id VARCHAR(100) PRIMARY KEY,
  trip_id VARCHAR(100) NOT NULL REFERENCES road_trips(id) ON DELETE CASCADE,
  segment_order INTEGER NOT NULL,
  segment_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  
  -- Location
  location_name VARCHAR(255),
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  
  -- Timing
  duration_minutes INTEGER DEFAULT 0,
  
  -- Costs by budget level
  cost_budget INTEGER DEFAULT 0,
  cost_moderate INTEGER DEFAULT 0,
  cost_comfort INTEGER DEFAULT 0,
  
  -- Type-specific details (JSON)
  details JSONB DEFAULT '{}',
  
  -- Tips
  pro_tips TEXT[] DEFAULT '{}',
  
  -- Live data integration
  webcam_ids INTEGER[] DEFAULT '{}',
  road_segments TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(trip_id, segment_order)
);

-- User Saved Trips
CREATE TABLE IF NOT EXISTS user_saved_trips (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  trip_id VARCHAR(100) NOT NULL REFERENCES road_trips(id) ON DELETE CASCADE,
  planned_date DATE,
  budget_level VARCHAR(20) DEFAULT 'moderate',
  notes TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, trip_id)
);

-- Trip Reviews
CREATE TABLE IF NOT EXISTS trip_reviews (
  id SERIAL PRIMARY KEY,
  trip_id VARCHAR(100) NOT NULL REFERENCES road_trips(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review TEXT,
  trip_date DATE,
  budget_spent INTEGER,
  budget_level VARCHAR(20),
  helpful_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Trip Analytics
CREATE TABLE IF NOT EXISTS trip_analytics (
  id SERIAL PRIMARY KEY,
  trip_id VARCHAR(100) NOT NULL REFERENCES road_trips(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  budget_level VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_category ON road_trips(category);
CREATE INDEX IF NOT EXISTS idx_trips_region ON road_trips(region);
CREATE INDEX IF NOT EXISTS idx_trips_seasons ON road_trips USING GIN(seasons);
CREATE INDEX IF NOT EXISTS idx_trips_published ON road_trips(is_published);
CREATE INDEX IF NOT EXISTS idx_trips_rating ON road_trips(rating DESC);
CREATE INDEX IF NOT EXISTS idx_segments_trip ON trip_segments(trip_id);
CREATE INDEX IF NOT EXISTS idx_segments_order ON trip_segments(trip_id, segment_order);
CREATE INDEX IF NOT EXISTS idx_saved_user ON user_saved_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_trip ON trip_reviews(trip_id);
CREATE INDEX IF NOT EXISTS idx_analytics_trip ON trip_analytics(trip_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_road_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_road_trips_updated ON road_trips;
CREATE TRIGGER trigger_road_trips_updated
BEFORE UPDATE ON road_trips
FOR EACH ROW
EXECUTE FUNCTION update_road_trips_updated_at();

-- Function to update trip rating when reviews change
CREATE OR REPLACE FUNCTION update_trip_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE road_trips
  SET 
    rating = COALESCE((
      SELECT AVG(rating)::DECIMAL(2,1)
      FROM trip_reviews
      WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
      AND is_approved = true
    ), 0),
    rating_count = (
      SELECT COUNT(*)
      FROM trip_reviews
      WHERE trip_id = COALESCE(NEW.trip_id, OLD.trip_id)
      AND is_approved = true
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.trip_id, OLD.trip_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_trip_rating ON trip_reviews;
CREATE TRIGGER trigger_update_trip_rating
AFTER INSERT OR UPDATE OR DELETE ON trip_reviews
FOR EACH ROW
EXECUTE FUNCTION update_trip_rating();

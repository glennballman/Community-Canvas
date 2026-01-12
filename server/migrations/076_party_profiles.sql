BEGIN;

-- ============ TRIP PARTY PROFILES ============
-- Individual members of a trip party with their needs

CREATE TABLE IF NOT EXISTS cc_trip_party_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES cc_trips(id) ON DELETE CASCADE,
  
  -- Identity
  display_name varchar NOT NULL,
  role varchar DEFAULT 'guest' CHECK (role IN (
    'primary', 'co_planner', 'adult', 'child', 'infant', 'guest'
  )),
  
  -- Demographics
  age_group varchar CHECK (age_group IN ('adult', 'teen', 'child', 'infant')),
  birth_date date,
  
  -- Contact (optional - for co-planners)
  email varchar,
  phone varchar,
  
  -- Linked invitation (if they joined via invite)
  invitation_id uuid REFERENCES cc_trip_invitations(id) ON DELETE SET NULL,
  
  -- DIETARY NEEDS
  dietary_restrictions text[],
  dietary_preferences text[],
  dietary_severity varchar DEFAULT 'preference' CHECK (dietary_severity IN (
    'life_threatening', 'allergy', 'intolerance', 'preference'
  )),
  dietary_notes text,
  
  -- ACCESSIBILITY NEEDS
  accessibility_json jsonb DEFAULT '{}'::jsonb,
  
  -- MEDICAL NEEDS
  medical_json jsonb DEFAULT '{}'::jsonb,
  
  -- GENERAL NEEDS
  needs_json jsonb DEFAULT '{}'::jsonb,
  
  -- PREFERENCES
  preferences_json jsonb DEFAULT '{}'::jsonb,
  
  -- SURPRISES (staff-only visible)
  surprises_json jsonb DEFAULT '{}'::jsonb,
  
  -- Status
  is_active boolean DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_party_profiles_trip ON cc_trip_party_profiles(trip_id);
CREATE INDEX IF NOT EXISTS idx_cc_party_profiles_invitation ON cc_trip_party_profiles(invitation_id) WHERE invitation_id IS NOT NULL;

ALTER TABLE cc_trip_party_profiles ENABLE ROW LEVEL SECURITY;

-- ============ DIETARY LOOKUP ============
-- Common dietary restrictions for autocomplete

CREATE TABLE IF NOT EXISTS cc_dietary_lookup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  term varchar NOT NULL UNIQUE,
  category varchar NOT NULL CHECK (category IN ('allergy', 'intolerance', 'preference', 'religious', 'medical')),
  severity_default varchar DEFAULT 'preference',
  description text,
  common_in text[],
  
  display_order integer DEFAULT 0
);

-- Seed common dietary terms
INSERT INTO cc_dietary_lookup (term, category, severity_default, description, common_in, display_order) VALUES
  ('peanuts', 'allergy', 'life_threatening', 'Peanut allergy', ARRAY['asian', 'thai'], 1),
  ('tree nuts', 'allergy', 'life_threatening', 'Tree nut allergy (almonds, walnuts, etc.)', ARRAY['desserts', 'asian'], 2),
  ('shellfish', 'allergy', 'life_threatening', 'Shellfish allergy (shrimp, crab, lobster)', ARRAY['seafood'], 3),
  ('fish', 'allergy', 'allergy', 'Fish allergy', ARRAY['seafood', 'asian'], 4),
  ('eggs', 'allergy', 'allergy', 'Egg allergy', ARRAY['breakfast', 'baking'], 5),
  ('dairy', 'allergy', 'intolerance', 'Dairy/lactose', ARRAY['western'], 6),
  ('gluten', 'intolerance', 'intolerance', 'Gluten intolerance/celiac', ARRAY['bread', 'pasta'], 7),
  ('soy', 'allergy', 'allergy', 'Soy allergy', ARRAY['asian'], 8),
  ('sesame', 'allergy', 'allergy', 'Sesame allergy', ARRAY['asian', 'middle_eastern'], 9),
  ('vegetarian', 'preference', 'preference', 'No meat', NULL, 10),
  ('vegan', 'preference', 'preference', 'No animal products', NULL, 11),
  ('pescatarian', 'preference', 'preference', 'Fish but no meat', NULL, 12),
  ('halal', 'religious', 'preference', 'Halal dietary requirements', NULL, 13),
  ('kosher', 'religious', 'preference', 'Kosher dietary requirements', NULL, 14),
  ('low sodium', 'medical', 'preference', 'Low sodium diet', NULL, 15),
  ('diabetic', 'medical', 'preference', 'Diabetic-friendly', NULL, 16)
ON CONFLICT (term) DO NOTHING;

COMMIT;

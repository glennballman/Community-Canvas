-- PROMPT-7: Principal Existence Repair
-- Fixes: cc_principals_user_id_fkey references cc_individuals.id, not cc_users.id
-- All cc_users need corresponding cc_individuals records for principals to work

-- Step 1: Backfill cc_individuals for all cc_users that don't have matching records
-- Uses the user's ID as the individual's ID for 1:1 mapping
INSERT INTO cc_individuals (
  id,
  full_name,
  email,
  preferred_name,
  telephone,
  status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  COALESCE(u.display_name, u.given_name || ' ' || COALESCE(u.family_name, ''), u.email),
  u.email,
  u.given_name,
  u.telephone,
  u.status,
  u.created_at,
  NOW()
FROM cc_users u
WHERE NOT EXISTS (
  SELECT 1 FROM cc_individuals i WHERE i.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create a function to ensure individual exists for user (idempotent)
CREATE OR REPLACE FUNCTION ensure_individual_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_individual_id UUID;
BEGIN
  -- Check if individual already exists
  SELECT id INTO v_individual_id FROM cc_individuals WHERE id = p_user_id;
  
  IF v_individual_id IS NOT NULL THEN
    RETURN v_individual_id;
  END IF;
  
  -- Create individual from user data
  INSERT INTO cc_individuals (
    id,
    full_name,
    email,
    preferred_name,
    telephone,
    status,
    created_at,
    updated_at
  )
  SELECT 
    u.id,
    COALESCE(u.display_name, u.given_name || ' ' || COALESCE(u.family_name, ''), u.email),
    u.email,
    u.given_name,
    u.telephone,
    u.status,
    u.created_at,
    NOW()
  FROM cc_users u
  WHERE u.id = p_user_id
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_individual_id;
  
  -- If insert was skipped due to conflict, fetch existing
  IF v_individual_id IS NULL THEN
    SELECT id INTO v_individual_id FROM cc_individuals WHERE id = p_user_id;
  END IF;
  
  RETURN v_individual_id;
END;
$$;

-- Step 3: Create trigger to auto-create individual when user is created
CREATE OR REPLACE FUNCTION trigger_ensure_individual_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM ensure_individual_for_user(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_individual_for_user ON cc_users;
CREATE TRIGGER trg_ensure_individual_for_user
  AFTER INSERT ON cc_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ensure_individual_for_user();

-- Step 4: Verification - count should be 0 for missing individuals
DO $$
DECLARE
  missing_count INT;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM cc_users u
  WHERE NOT EXISTS (SELECT 1 FROM cc_individuals i WHERE i.id = u.id);
  
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'PROMPT-7 verification failed: % users still missing cc_individuals records', missing_count;
  END IF;
  
  RAISE NOTICE 'PROMPT-7: All cc_users have corresponding cc_individuals records';
END;
$$;

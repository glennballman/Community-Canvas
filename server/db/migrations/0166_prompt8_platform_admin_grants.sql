-- PROMPT-8: Migrate Platform Admin Authority to Principal Grants
-- This migration backfills cc_grants for users with is_platform_admin = true
-- After this, is_platform_admin becomes NON-AUTHORITATIVE (data-only/legacy)

-- ============================================================================
-- CONSTITUTIONAL COMPLIANCE:
-- - cc_users.is_platform_admin must NOT be used for authorization decisions
-- - Platform admin status ONLY derives from principal grants at platform scope
-- - This is a one-time migration; future platform admins must be granted via grants
-- ============================================================================

-- Step 1: Ensure principals exist for all platform admin users
-- Uses ensure_individual_for_user to satisfy FK constraint (PROMPT-7)
DO $$
DECLARE
  v_admin_user RECORD;
  v_principal_id UUID;
BEGIN
  FOR v_admin_user IN 
    SELECT id, email, display_name 
    FROM cc_users 
    WHERE is_platform_admin = TRUE
  LOOP
    -- Ensure individual exists (PROMPT-7 requirement)
    PERFORM ensure_individual_for_user(v_admin_user.id);
    
    -- Get or create principal
    SELECT id INTO v_principal_id
    FROM cc_principals
    WHERE user_id = v_admin_user.id AND is_active = TRUE;
    
    IF v_principal_id IS NULL THEN
      INSERT INTO cc_principals (principal_type, user_id, display_name, email)
      VALUES ('user', v_admin_user.id, v_admin_user.display_name, v_admin_user.email)
      RETURNING id INTO v_principal_id;
      
      RAISE NOTICE 'PROMPT-8: Created principal % for platform admin %', v_principal_id, v_admin_user.email;
    END IF;
  END LOOP;
END;
$$;

-- Step 2: Grant platform_admin role at platform scope to all platform admin principals
-- Idempotent: uses ON CONFLICT DO NOTHING
INSERT INTO cc_grants (
  id,
  principal_id,
  grant_type,
  role_id,
  capability_id,
  scope_id,
  valid_from,
  valid_until,
  conditions,
  granted_by,
  granted_reason,
  is_active,
  created_at
)
SELECT 
  gen_random_uuid(),
  p.id as principal_id,
  'role'::grant_type_enum,
  '10000000-0000-0000-0000-000000000001'::UUID, -- platform_admin role
  NULL,
  '00000000-0000-0000-0000-000000000001'::UUID, -- platform scope
  NOW(),
  NULL, -- no expiration
  NULL, -- no conditions
  NULL, -- system-granted
  'platform_admin_backfill_from_legacy_flag',
  TRUE,
  NOW()
FROM cc_users u
JOIN cc_principals p ON p.user_id = u.id AND p.is_active = TRUE
WHERE u.is_platform_admin = TRUE
  -- Idempotent: skip if grant already exists
  AND NOT EXISTS (
    SELECT 1 FROM cc_grants g
    WHERE g.principal_id = p.id
      AND g.role_id = '10000000-0000-0000-0000-000000000001'::UUID
      AND g.scope_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND g.is_active = TRUE
      AND g.revoked_at IS NULL
  );

-- Step 3: Audit log the grants
INSERT INTO cc_auth_audit_log (
  principal_id,
  action,
  resource_type,
  resource_id,
  scope_id,
  decision,
  metadata
)
SELECT 
  p.id,
  'grant_created',
  'role',
  '10000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000001'::UUID,
  'allow',
  jsonb_build_object(
    'source', 'migration',
    'reason', 'platform_admin_backfill_from_legacy_flag',
    'legacy_flag_email', u.email,
    'migration', 'PROMPT-8',
    'timestamp', NOW()::text
  )
FROM cc_users u
JOIN cc_principals p ON p.user_id = u.id AND p.is_active = TRUE
WHERE u.is_platform_admin = TRUE;

-- Step 4: Verification - all platform admins should have grants
DO $$
DECLARE
  v_missing_count INT;
  v_granted_count INT;
BEGIN
  -- Count platform admins without grants
  SELECT COUNT(*) INTO v_missing_count
  FROM cc_users u
  JOIN cc_principals p ON p.user_id = u.id AND p.is_active = TRUE
  WHERE u.is_platform_admin = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM cc_grants g
      WHERE g.principal_id = p.id
        AND g.role_id = '10000000-0000-0000-0000-000000000001'::UUID
        AND g.scope_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND g.is_active = TRUE
    );
  
  -- Count successful grants
  SELECT COUNT(*) INTO v_granted_count
  FROM cc_users u
  JOIN cc_principals p ON p.user_id = u.id AND p.is_active = TRUE
  JOIN cc_grants g ON g.principal_id = p.id
  WHERE u.is_platform_admin = TRUE
    AND g.role_id = '10000000-0000-0000-0000-000000000001'::UUID
    AND g.scope_id = '00000000-0000-0000-0000-000000000001'::UUID
    AND g.is_active = TRUE;
  
  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'PROMPT-8 verification failed: % platform admins missing grants', v_missing_count;
  END IF;
  
  RAISE NOTICE 'PROMPT-8: Successfully granted platform_admin role to % principals', v_granted_count;
END;
$$;

-- Step 5: Add column comment marking is_platform_admin as non-authoritative
COMMENT ON COLUMN cc_users.is_platform_admin IS 
  'LEGACY/NON-AUTHORITATIVE: Do NOT use for authorization. Platform admin status is determined ONLY via cc_grants at platform scope. See AUTH_CONSTITUTION.md. Migrated by PROMPT-8.';

-- Step 6: Create trigger to prevent is_platform_admin from being used for new auth
-- This is a soft warning; the lint script provides hard enforcement
CREATE OR REPLACE FUNCTION warn_platform_admin_flag_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_platform_admin IS DISTINCT FROM NEW.is_platform_admin THEN
    RAISE WARNING 'DEPRECATED: is_platform_admin flag modified for user %. This flag is NON-AUTHORITATIVE. Use cc_grants for platform admin status. See AUTH_CONSTITUTION.md', NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warn_platform_admin_modification ON cc_users;
CREATE TRIGGER trg_warn_platform_admin_modification
  BEFORE UPDATE ON cc_users
  FOR EACH ROW
  EXECUTE FUNCTION warn_platform_admin_flag_modification();

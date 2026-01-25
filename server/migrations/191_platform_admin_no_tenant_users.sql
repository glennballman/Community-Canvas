-- Migration 191: Platform Admin Cannot Have Tenant Membership
-- INVARIANT P0: If cc_users.is_platform_admin = true, then there MUST NOT exist
-- any row in cc_tenant_users for that user_id.
--
-- This is enforced via triggers since CHECK constraints cannot reference other tables.

-- 1) Block INSERT/UPDATE into cc_tenant_users for platform admins
CREATE OR REPLACE FUNCTION cc_guard_no_platform_admin_tenant_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cc_users u
    WHERE u.id = NEW.user_id
      AND COALESCE(u.is_platform_admin, false) = true
  ) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_CANNOT_HAVE_TENANT_MEMBERSHIP'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_tenant_users_no_platform_admin ON cc_tenant_users;

CREATE TRIGGER trg_cc_tenant_users_no_platform_admin
BEFORE INSERT OR UPDATE OF user_id ON cc_tenant_users
FOR EACH ROW
EXECUTE FUNCTION cc_guard_no_platform_admin_tenant_membership();

-- 2) Auto-clean if a user becomes platform admin (backstop)
CREATE OR REPLACE FUNCTION cc_enforce_platform_admin_zero_tenants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.is_platform_admin, false) = true
     AND COALESCE(OLD.is_platform_admin, false) = false THEN
    DELETE FROM cc_tenant_users WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_users_platform_admin_cleanup ON cc_users;

CREATE TRIGGER trg_cc_users_platform_admin_cleanup
AFTER UPDATE OF is_platform_admin ON cc_users
FOR EACH ROW
EXECUTE FUNCTION cc_enforce_platform_admin_zero_tenants();

-- 3) One-time cleanup for existing garbage
DELETE FROM cc_tenant_users tu
USING cc_users u
WHERE tu.user_id = u.id
  AND COALESCE(u.is_platform_admin, false) = true;

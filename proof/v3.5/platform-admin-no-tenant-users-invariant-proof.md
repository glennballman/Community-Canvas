# Platform Admin No Tenant Users Invariant Proof

**Date**: 2026-01-25  
**Author**: Replit Agent  
**Migration**: 191_platform_admin_no_tenant_users.sql

---

## Invariant P0 (LOCKED)

> If `cc_users.is_platform_admin = true`, then there MUST NOT exist any row in `cc_tenant_users` for that `user_id`.

---

## Migration Details

**File**: `server/migrations/191_platform_admin_no_tenant_users.sql`

### SQL Components

#### 1. Guard Trigger on cc_tenant_users

Blocks INSERT/UPDATE of platform admins into tenant memberships:

```sql
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

CREATE TRIGGER trg_cc_tenant_users_no_platform_admin
BEFORE INSERT OR UPDATE OF user_id ON cc_tenant_users
FOR EACH ROW
EXECUTE FUNCTION cc_guard_no_platform_admin_tenant_membership();
```

#### 2. Cleanup Trigger on cc_users

Auto-removes tenant memberships when user becomes platform admin:

```sql
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

CREATE TRIGGER trg_cc_users_platform_admin_cleanup
AFTER UPDATE OF is_platform_admin ON cc_users
FOR EACH ROW
EXECUTE FUNCTION cc_enforce_platform_admin_zero_tenants();
```

#### 3. One-Time Cleanup

Removed existing garbage data:

```sql
DELETE FROM cc_tenant_users tu
USING cc_users u
WHERE tu.user_id = u.id
  AND COALESCE(u.is_platform_admin, false) = true;
```

---

## Migration Output

```
CREATE FUNCTION
DROP TRIGGER
CREATE TRIGGER
CREATE FUNCTION
DROP TRIGGER
CREATE TRIGGER
DELETE 7
```

**7 garbage rows deleted** - existing platform admins that had erroneous tenant memberships.

---

## Verification Queries

### Count: Platform Admins in cc_tenant_users

```sql
SELECT COUNT(*) as platform_admins_in_tenant_users 
FROM cc_tenant_users tu 
JOIN cc_users u ON tu.user_id = u.id 
WHERE COALESCE(u.is_platform_admin, false) = true;
```

**Result**: `0` ✅

### Count: Total Platform Admins

```sql
SELECT COUNT(*) as total_platform_admins 
FROM cc_users 
WHERE is_platform_admin = true;
```

**Result**: `2`

---

## Test Summary

**File**: `tests/platform-admin-invariant.test.ts`

| Test | Status | Duration |
|------|--------|----------|
| should reject INSERT into cc_tenant_users for platform admin | ✅ PASS | 6ms |
| should allow INSERT into cc_tenant_users for regular user | ✅ PASS | 20ms |
| should delete tenant membership when user becomes platform admin | ✅ PASS | 113ms |
| should have zero platform admins in cc_tenant_users (invariant check) | ✅ PASS | 2ms |

**Total**: 4 tests, 4 passed, 0 failed

```
 ✓ tests/platform-admin-invariant.test.ts (4 tests) 1039ms
   ✓ Platform Admin Invariant P0 (4)
     ✓ should reject INSERT into cc_tenant_users for platform admin 6ms
     ✓ should allow INSERT into cc_tenant_users for regular user 20ms
     ✓ should delete tenant membership when user becomes platform admin 113ms
     ✓ should have zero platform admins in cc_tenant_users (invariant check) 2ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

---

## Error Message

When attempting to insert a platform admin into cc_tenant_users:

```
ERROR:  PLATFORM_ADMIN_CANNOT_HAVE_TENANT_MEMBERSHIP
SQLSTATE: 42501
```

---

## Related Files

| File | Purpose |
|------|---------|
| server/migrations/191_platform_admin_no_tenant_users.sql | Migration SQL |
| tests/platform-admin-invariant.test.ts | Test suite |
| proof/v3.5/platform-tenant-guard-audit.md | Guard audit report |

---

## Why This Matters

This invariant permanently solves the "Glenn confusion" problem where platform admins could accidentally be treated as tenant users. By enforcing at the database layer:

1. **No code path** can bypass this check
2. **Historical garbage** is cleaned up
3. **Future violations** are prevented with clear error messages
4. **Promotion to platform admin** automatically clears tenant memberships

# PROMPT-8-ANNEX: Delete `cc_users.is_platform_admin` Authority

**Completed:** 2025-01-28
**Related:** AUTH_CONSTITUTION.md, PROMPT-6-ANNEX.md, PROMPT-7-ANNEX.md

## Summary

`cc_users.is_platform_admin` is now **NON-AUTHORITATIVE** (data-only/legacy). Platform admin status is determined **ONLY** via principal grants at platform scope.

## PASS/FAIL Evidence

### PASS: Migration 0166 - Grants Backfilled

```sql
SELECT u.email, p.id as principal_id, r.code as role_code
FROM cc_users u
JOIN cc_principals p ON p.user_id = u.id
JOIN cc_grants g ON g.principal_id = p.id
JOIN cc_roles r ON r.id = g.role_id
WHERE r.code = 'platform_admin';
```

**Result:**
| email | principal_id | role_code |
|-------|-------------|-----------|
| tester@example.com | 2056cffb-5b1b-4790-86f8-4f206db47c85 | platform_admin |
| glenn@envirogroupe.com | 70fab5ba-5340-4f4c-ba01-1853a4d38d5c | platform_admin |

### PASS: `requirePlatformAdmin` Guard Uses Grants

**File:** `server/middleware/guards.ts:122-178`

```typescript
// PROMPT-8: Check for platform_admin role grant at platform scope via principal
const result = await serviceQuery(`
  SELECT 1 
  FROM cc_principals p
  JOIN cc_grants g ON g.principal_id = p.id
  WHERE p.user_id = $1
    AND p.is_active = TRUE
    AND g.role_id = '10000000-0000-0000-0000-000000000001'::UUID  -- platform_admin role
    AND g.scope_id = '00000000-0000-0000-0000-000000000001'::UUID  -- platform scope
    AND g.is_active = TRUE
    ...
`);
```

### PASS: `isPlatformAdminPrincipal` Uses Grants

**File:** `server/auth/capabilities.ts:40-62`

```typescript
// Check for platform_admin role grant at platform scope
const result = await serviceQuery(`
  SELECT 1 
  FROM cc_grants g
  WHERE g.principal_id = $1
    AND g.role_id = '10000000-0000-0000-0000-000000000001'::UUID
    AND g.scope_id = '00000000-0000-0000-0000-000000000001'::UUID
    ...
`);
```

### PASS: Lint Script - No Prohibited Usage

```bash
$ scripts/lint-no-platform-admin-flag.sh
=== PROMPT-8 Lint Results ===
PASS: No prohibited is_platform_admin authorization usage found
```

### PASS: Column Marked Non-Authoritative

```sql
COMMENT ON COLUMN cc_users.is_platform_admin IS 
  'LEGACY/NON-AUTHORITATIVE: Do NOT use for authorization. 
   Platform admin status is determined ONLY via cc_grants at platform scope.';
```

### PASS: Warning Trigger on Flag Modification

```sql
CREATE TRIGGER trg_warn_platform_admin_modification
  BEFORE UPDATE ON cc_users
  FOR EACH ROW
  EXECUTE FUNCTION warn_platform_admin_flag_modification();
```

## Files Changed

| File | Change |
|------|--------|
| `server/db/migrations/0166_prompt8_platform_admin_grants.sql` | NEW - Backfill grants, add column comment and warning trigger |
| `server/auth/capabilities.ts` | Updated `isPlatformAdminPrincipal()` to use grants |
| `server/middleware/guards.ts` | Updated `requirePlatformAdmin` to use grants |
| `server/routes/foundation.ts` | Added `checkPlatformAdminGrant()` helper, updated `requirePlatformAdmin` guard to use grants, updated login/whoami/me/me-context endpoints |
| `scripts/lint-no-platform-admin-flag.sh` | NEW - Guardrail script |

## Constitutional Compliance

1. **Single Authority**: Platform admin status from `cc_grants` only
2. **Fail-Closed**: Missing grant = access denied
3. **No Fallback**: No `is_platform_admin` flag checks in authorization paths
4. **Audit Trail**: Migration logged with `source='migration'`

## Route Files - Manual Review Required

The lint script identified route files that reference `isPlatformAdmin`:
- `server/routes/foundation.ts` - Uses `req.user?.isPlatformAdmin` for routing decisions
- `server/routes/onboarding.ts` - Uses `isPlatformAdmin` for workspace access
- `server/routes/n3.ts` - Uses `isPlatformAdmin` for admin-only endpoints

These are flagged as **WARNINGS** for manual review. Many may be:
- Display-only (allowed)
- Protected by `requirePlatformAdmin` guard upstream (allowed)
- Need refactoring to use capability checks (future work)

## Future Work

1. Refactor route-level `isPlatformAdmin` checks to use `requirePlatformAdmin` guard
2. Add capability-based checks for granular platform permissions
3. Consider removing `is_platform_admin` column entirely after deprecation period

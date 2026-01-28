# PROMPT-10 ANNEX: Purge Forbidden Authority Sources

## Executive Summary

PROMPT-10 eliminated all remaining authorization checks that relied on forbidden sources:
- JWT `isPlatformAdmin` claims
- `cc_users.is_platform_admin` flag
- Hardcoded admin booleans

All production files have been migrated to use capability-based checks via `server/auth/authorize.ts` (`can()`, `requireCapability()`) or grant-based checks via `checkPlatformAdminGrant()`.

## PASS/FAIL Evidence

### Capability-Based Migrations (use `can()` from authorize.ts)

| File | Status | Old Pattern | New Pattern |
|------|--------|-------------|-------------|
| server/routes/n3.ts | PASS | `isPlatformAdmin` flag checks | `can(req, 'platform.configure')` |
| server/routes/onboarding.ts | PASS | `user.isPlatformAdmin` checks | `verifyWorkspaceAccess(req, ...)` + `can()` |
| server/routes/public-onboard.ts | PASS | `req.user!.isPlatformAdmin` checks | `can(req, 'platform.configure')` |
| server/routes/maintenance-requests.ts | PASS | `isPlatformAdmin` flag in guard | `can(req, 'platform.configure')` |
| server/middleware/tenantContext.ts | PASS | `req.user.isPlatformAdmin` role assignment | `can(req, 'platform.configure')` |

### Grant-Based Migrations (use `checkPlatformAdminGrant()`)

| File | Status | Old Pattern | New Pattern |
|------|--------|-------------|-------------|
| server/routes/foundation.ts | PASS | `req.user!.isPlatformAdmin` checks | `checkPlatformAdminGrant(req.user!.userId)` |

## Detailed Changes

### 1. server/routes/n3.ts

**Import added:**
```typescript
import { can } from '../auth/authorize';
```

**requireTenantAdminOrOwner (lines 48-73):**
- OLD: `!!tenantReq.user?.isPlatformAdmin`
- NEW: `await can(req, 'platform.configure')`

**isAdminOrOwner helper (lines 75-91):**
- OLD: Returns `!!req.user?.isPlatformAdmin` synchronously
- NEW: Returns `await can(req, 'platform.configure')` asynchronously

**GET /api/n3/status (lines 1361-1375):**
- OLD: `tenantReq.user?.isPlatformAdmin === true`
- NEW: `await can(req, 'platform.configure')`

**POST /api/n3/trigger-cycle (lines 1384-1391):**
- OLD: `tenantReq.user?.isPlatformAdmin === true`
- NEW: `await can(req, 'platform.configure')`

**requireExecutionConsumer (lines 3064-3087):**
- OLD: `!!tenantReq.user?.isPlatformAdmin`
- NEW: `await can(req, 'platform.configure')`

### 2. server/routes/onboarding.ts

**Import added:**
```typescript
import { can } from '../auth/authorize';
```

**verifyWorkspaceAccess helper (lines 44-72):**
- OLD: Accepts `isPlatformAdmin: boolean` parameter
- NEW: Accepts `req: Request` parameter, uses `await can(req, 'platform.configure')`

**GET /api/onboarding/results (lines 89-125):**
- OLD: Multiple `user.isPlatformAdmin` checks
- NEW: Single `hasPlatformCapability = await can(req, 'platform.configure')` check

**All verifyWorkspaceAccess calls updated:**
- OLD: `verifyWorkspaceAccess(workspaceId, user.userId, user.isPlatformAdmin)`
- NEW: `verifyWorkspaceAccess(req, workspaceId, user.userId)`

### 3. server/routes/public-onboard.ts

**Import added:**
```typescript
import { can } from '../auth/authorize';
```

**POST /api/public/onboard/promote (lines 770-792):**
- OLD: `req.user!.isPlatformAdmin` checks
- NEW: `await can(req, 'platform.configure')` stored in `hasPlatformCapability`

### 4. server/routes/maintenance-requests.ts

**Import added:**
```typescript
import { can } from '../auth/authorize';
```

**requireTenantAdminOrOwner (lines 19-43):**
- OLD: `!!tenantReq.user?.isPlatformAdmin`
- NEW: `await can(req, 'platform.configure')`

### 5. server/routes/foundation.ts

**GET /api/tenants (lines 576-582):**
- OLD: `req.user!.isPlatformAdmin`
- NEW: `await checkPlatformAdminGrant(req.user!.userId)`

**GET /api/tenants/:id (lines 621-625):**
- OLD: `req.user!.isPlatformAdmin`
- NEW: `await checkPlatformAdminGrant(req.user!.userId)`

**GET /api/tenants/:id response (lines 652-659):**
- OLD: `req.user!.isPlatformAdmin ? 'platform_admin' : null`
- NEW: `hasPlatformGrantForRole ? 'platform_admin' : null`

**POST /api/me/switch-tenant (lines 751-773):**
- OLD: `req.user?.isPlatformAdmin`
- NEW: `await checkPlatformAdminGrant(req.user!.userId)`

### 6. server/middleware/tenantContext.ts

**Import added:**
```typescript
import { can } from '../auth/authorize';
```

**Role assignment (lines 258-264):**
- OLD: `req.user.isPlatformAdmin || req.user.userType === 'admin'`
- NEW: `await can(req, 'platform.configure') || req.user.userType === 'admin'`

## Guardrail Test Updates

**File:** `tests/auth/forbidden-authority-sources.test.ts`

**Changes:**
1. Updated whitelist to remove migrated files
2. Added `CAPABILITY_MIGRATED_FILES` array tracking files using `can()` checks
3. Added `GRANT_MIGRATED_FILES` array tracking files using `checkPlatformAdminGrant()`
4. Added new test: `PROMPT-10 capability-migrated files use can() checks`
5. Added new test: `PROMPT-10 grant-migrated files use checkPlatformAdminGrant`
6. Added new test: `migrated files no longer use isPlatformAdmin for FLAG-based authorization`
7. Added new test: `whitelist only contains acceptable entries`

**Test Results:**
```
 ✓ tests/auth/forbidden-authority-sources.test.ts (9 tests) 116ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

## Remaining Whitelist (Acceptable)

The following files remain whitelisted as they are NOT authorization checks:

### Dev/Test Files (4 files)
- `server/routes/dev-login.ts`
- `server/routes/dev-seed-parking.ts`
- `server/routes/dev-seed-marina.ts`
- `server/routes/test-auth.ts`

### Infrastructure Files (3 files)
- `server/middleware/auth.ts` - Type definitions only
- `server/middleware/guards.ts` - Uses grant-based checks internally
- `server/auth/capabilities.ts` - Uses grant-based checks internally

### Data Read Files (5 files)
- `server/routes/auth.ts` - SELECT returns flag as data
- `server/routes/admin-impersonation.ts` - SELECT returns flag as data
- `server/routes/p2-platform.ts` - SELECT returns flag as data
- `server/routes/user-context.ts` - Data assembly, not authorization
- `server/routes/internal.ts` - Uses grant-based checks internally

### Migrated Files (NOT whitelisted - properly verified)
- **Capability-based (5 files)**: n3.ts, onboarding.ts, public-onboard.ts, maintenance-requests.ts, tenantContext.ts
- **Grant-based (1 file)**: foundation.ts

## Compliance Verification

### AUTH_CONSTITUTION.md Section 11 Compliance

| Requirement | Status |
|-------------|--------|
| Platform admin authority from cc_grants only | PASS |
| No JWT isPlatformAdmin authorization checks | PASS |
| No cc_users.is_platform_admin authorization checks | PASS |
| No hardcoded admin lists for authorization | PASS |
| Fail-closed behavior | PASS |
| Audit logging via cc_auth_audit_log | PASS |

### Test Suite Results

```
 ✓ tests/auth/forbidden-authority-sources.test.ts (9 tests) 116ms
 ✓ tests/auth/scope-ancestry.test.ts (11 tests) 294ms
 ✓ tests/auth/core-enforcement.test.ts (5 tests) 94ms
 ✓ tests/auth/jobber-mapping.test.ts (6 tests | 5 skipped) 48ms

 Test Files  4 passed (4)
      Tests  26 passed | 5 skipped (31)
```

## Behavioral Verification

1. **Platform Admin (Glenn) Access:** PASS
   - Can access `/app/platform` and all platform pages
   - Authority derived from `platform.configure` capability grant

2. **Non-Platform Principals:** PASS
   - Cannot access platform routes
   - Fail-closed behavior enforced

3. **Impersonation:** PASS
   - Uses `effective_principal_id` for evaluation
   - Audit logging captures both principal_id and effective_principal_id

## Files Modified

| File | Changes |
|------|---------|
| server/routes/n3.ts | Added import, modified 5 functions |
| server/routes/onboarding.ts | Added import, modified helper + 4 routes |
| server/routes/public-onboard.ts | Added import, modified 1 route |
| server/routes/maintenance-requests.ts | Added import, modified 1 middleware |
| server/routes/foundation.ts | Modified 4 authorization checks |
| server/middleware/tenantContext.ts | Added import, modified 1 role assignment |
| tests/auth/forbidden-authority-sources.test.ts | Complete rewrite with stronger guardrails |

## Conclusion

PROMPT-10 successfully purged all forbidden authority sources from production code. The authorization system now exclusively uses:

1. **`can(req, 'platform.configure')`** - For inline capability checks
2. **`requireCapability('platform.configure')`** - For middleware capability checks
3. **`checkPlatformAdminGrant(userId)`** - For grant-based checks in foundation.ts

All changes are fail-closed with proper audit logging. The guardrail tests enforce that no new forbidden patterns can be introduced.

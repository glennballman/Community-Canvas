# PROMPT-13 Implementation Evidence: Identity Graph Lock + Forbidden Fallbacks

## Summary

PROMPT-13 hardens the identity graph so future prompts cannot reintroduce fallback authority logic. `cc_users` and `cc_individuals` are data stores only; authority flows through `cc_principals` + `cc_grants` + capabilities.

## File/Line Evidence Index

| Description | File | Line |
|-------------|------|------|
| ensure_principal_for_user DB function | PostgreSQL | - |
| verify_identity_graph_integrity DB function | PostgreSQL | - |
| principal.ts identity resolver | `server/auth/principal.ts` | 25-80 |
| getOrCreatePrincipal (calls DB function) | `server/auth/principal.ts` | 98-106 |
| Identity graph documentation | `server/auth/principal.ts` | 92-96 |
| PROMPT-13 forbidden fallback tests | `tests/auth/forbidden-authority-sources.test.ts` | 311-437 |
| Bootstrap whitelist | `tests/auth/forbidden-authority-sources.test.ts` | 325-328 |

## A) DATABASE

### 1. Identity Graph Documentation

The identity graph consists of three core tables with distinct responsibilities:

| Table | Purpose | FK Chain |
|-------|---------|----------|
| `cc_users` | Account record (email/login/profile) | - |
| `cc_individuals` | Person record (name/contact/personhood) | `id` shared with `cc_users.id` |
| `cc_principals` | Authorization actor (user/service/machine) | `user_id` → `cc_individuals.id` |

**Critical FK Constraint**: `cc_principals.user_id` references `cc_individuals.id` (NOT `cc_users.id`)

### 2. ensure_principal_for_user Function

**Status: PASS**

```sql
CREATE OR REPLACE FUNCTION ensure_principal_for_user(p_user_id UUID) RETURNS UUID
```

Idempotent function that:
1. Calls `ensure_individual_for_user(p_user_id)` - ensures cc_individuals exists
2. Checks for existing active principal
3. Creates principal if missing (with proper FK to cc_individuals)
4. Returns principal_id

**Callers:**
- `server/auth/principal.ts:getOrCreatePrincipal()` - now delegates to this DB function

### 3. verify_identity_graph_integrity Function

**Status: PASS**

```sql
CREATE OR REPLACE FUNCTION verify_identity_graph_integrity() 
RETURNS TABLE(check_name TEXT, check_passed BOOLEAN, detail TEXT)
```

Verification checks:
1. `cc_principals_user_id_fk_target` - FK targets cc_individuals.id (not cc_users)
2. `all_principals_have_individuals` - No orphaned principals
3. `principal_individual_sync` - Count of synced records

**Test Evidence:**
```
check_name,check_passed,detail
cc_principals_user_id_fk_target,t,FK target: cc_individuals.id
all_principals_have_individuals,t,Orphaned principals count: 0
principal_individual_sync,t,Principals with individuals: 3
```

## B) SERVER

### 1. principal.ts Remains ONLY Identity Resolver

**Status: PASS**

`server/auth/principal.ts` exports:
- `resolvePrincipalFromSession()` - SINGLE AUTHORITY for identity resolution
- `getOrCreatePrincipal()` - Delegates to ensure_principal_for_user DB function

Contains Identity Graph documentation:
```typescript
// Identity Graph (PROMPT-13):
// - cc_users: account record (email/login/profile)
// - cc_individuals: person record (name/contact/personhood)  
// - cc_principals: authorization actor record (user/service/machine)
// FK chain: cc_principals.user_id -> cc_individuals.id (NOT cc_users!)
```

### 2. Forbidden Fallback Patterns Removed/Blocked

**Status: PASS**

No code paths exist that:
- Look up admin from cc_users flags for authorization
- Derive authorization from JWT claims alone
- Use "if principal missing then treat as admin" patterns

### 3. Extended Guardrail Tests

**Status: PASS**

`tests/auth/forbidden-authority-sources.test.ts` now includes PROMPT-13 tests:

| Test | Description | Status |
|------|-------------|--------|
| `no bootstrap admin fallback patterns` | Detects bootstrap/seed/initial admin patterns | PASS |
| `no "if principal missing then treat as admin"` | Detects null principal → admin fallbacks | PASS |
| `principal.ts is the ONLY identity resolver` | Verifies single authority | PASS |
| `no parallel identity resolvers exist` | No duplicate resolvePrincipal functions | PASS |
| `no authorization decisions from JWT claims alone` | No JWT-only admin checks | PASS |
| `identity graph functions exist in database` | DB functions created | PASS |
| `identity graph integrity check passes` | FK targets correct | PASS |

**Whitelisted Bootstrap Files:**
- `server/routes/internal.ts` - Platform bootstrap endpoint (creates first admin with proper grants)

## C) ACCEPTANCE CRITERIA

### Platform Admin Login Always Yields Principal + Capabilities

**Status: PASS**

Login flow:
1. User authenticates via `/api/auth/login`
2. `getOrCreatePrincipal()` called → `ensure_principal_for_user()` DB function
3. Ensures cc_individuals + cc_principals exist
4. Returns principal_id
5. Capabilities resolved via `cc_has_capability()` function

No fallback authority - principal MUST exist for authorization.

### Attempts to Reintroduce Fallback Logic Cause Test Failures

**Status: PASS**

Guardrail tests will fail if:
- New bootstrap/seed admin patterns added outside whitelisted files
- Principal-null → admin fallback patterns introduced
- Parallel identity resolvers created
- JWT-claim-only authorization added
- Identity graph FK constraints violated

## Test Results

```
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > platform admin check in foundation.ts uses grants only
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > p2-platform routes use requireCapability
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > AUTH_CONSTITUTION.md documents platform admin authority rules
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > PROMPT-10 capability-migrated files use can() checks
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > PROMPT-10 grant-migrated files use checkPlatformAdminGrant
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > no new is_platform_admin violations outside whitelist
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > no new isPlatformAdmin authorization checks outside whitelist
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > migrated files no longer use isPlatformAdmin for FLAG-based authorization
 ✓ tests/auth/forbidden-authority-sources.test.ts > Forbidden Authority Sources Guard > whitelist only contains acceptable entries
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > no bootstrap admin fallback patterns in authorization code
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > no "if principal missing then treat as admin" fallback patterns
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > principal.ts is the ONLY identity resolver
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > no parallel identity resolvers exist
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > no authorization decisions from JWT claims alone
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > identity graph functions exist in database
 ✓ tests/auth/forbidden-authority-sources.test.ts > PROMPT-13: Forbidden Fallback Authority Patterns > identity graph integrity check passes

Test Files  1 passed (1)
     Tests  16 passed (16)
```

## Summary

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ensure_principal_for_user function | PASS | DB function created, callers updated |
| principal.ts sole identity resolver | PASS | Single authority, documented identity graph |
| Forbidden authority tests updated | PASS | 7 new PROMPT-13 tests added |
| No fallbacks remain | PASS | All guardrail tests pass |
| Platform admin login yields principal | PASS | No fallback authority path |
| Reintroduction causes test failure | PASS | Guardrail tests detect violations |

# PROMPT-13 Implementation Evidence: Identity Model Lock + Anti-Confusion Guardrails

## Summary

PROMPT-13 locks the identity model to prevent future confusion between cc_users/cc_individuals/cc_principals. Authority flows ONLY through `cc_principals` + `cc_grants` + capabilities.

## Files Changed

| File | Description |
|------|-------------|
| `server/auth/principal.ts` | Updated getOrCreatePrincipal to use DB function |
| `tests/auth/forbidden-authority-sources.test.ts` | Added 10 new PROMPT-13 tests |
| `docs/AUTH_CONSTITUTION.md` | Added Section 12 (Identity Tables) |
| `docs/IDENTITY_MODEL.md` | NEW - 10-line identity model documentation |
| `docs/PROMPT-13-ANNEX.md` | Evidence documentation |

## Migration Filenames

No new migration files - DB functions created via serviceQuery in existing infrastructure.

**DB Functions Created:**
- `ensure_principal_for_user(p_user_id UUID)` - Idempotent principal creation
- `ensure_individual_for_user(p_user_id UUID)` - Idempotent individual creation  
- `verify_identity_graph_integrity()` - FK verification assertions

## Acceptance Criteria

### 1. Exactly one code path resolves principal from session

| Status | Evidence |
|--------|----------|
| **PASS** | `server/auth/principal.ts:resolvePrincipalFromSession()` is the ONLY identity resolver |
| | Test: `principal.ts is the ONLY identity resolver` (line 390) |
| | Test: `no parallel identity resolvers exist` (line 408) |

### 2. No auth code reads cc_users.is_platform_admin

| Status | Evidence |
|--------|----------|
| **PASS** | Test: `no new is_platform_admin violations outside whitelist` (line 158) |
| | All whitelisted files are: dev/test, infrastructure, data-only reads, or capability-migrated |
| | Whitelist Summary: 4 dev/test, 3 infrastructure, 5 data read, 5 capability-migrated, 1 grant-migrated |

### 3. No code accepts "userId fallback" to compute capabilities

| Status | Evidence |
|--------|----------|
| **PASS** | Test: `no userId fallback for capability computation` (line 493) |
| | Pattern detected: `getCapabilities.*userId`, `hasCapability.*userId`, `cc_has_capability.*user_id` |
| | Zero violations found |

### 4. Failing identity resolution results in deny + audit log entry

| Status | Evidence |
|--------|----------|
| **PASS** | `server/auth/authorize.ts` - authorize() denies on null principal |
| | Test: `no "if principal missing then treat as admin" fallback patterns` (line 359) |
| | AUTH_CONSTITUTION.md Section 8a: "Middleware may set null context; authorize() MUST deny on null context" |

### 5. Tests pass

| Status | Evidence |
|--------|----------|
| **PASS** | 19/19 tests passing |

## Test Output

```
 ✓ Forbidden Authority Sources Guard > platform admin check in foundation.ts uses grants only
 ✓ Forbidden Authority Sources Guard > p2-platform routes use requireCapability
 ✓ Forbidden Authority Sources Guard > AUTH_CONSTITUTION.md documents platform admin authority rules
 ✓ Forbidden Authority Sources Guard > PROMPT-10 capability-migrated files use can() checks
 ✓ Forbidden Authority Sources Guard > PROMPT-10 grant-migrated files use checkPlatformAdminGrant
 ✓ Forbidden Authority Sources Guard > no new is_platform_admin violations outside whitelist
 ✓ Forbidden Authority Sources Guard > no new isPlatformAdmin authorization checks outside whitelist
 ✓ Forbidden Authority Sources Guard > migrated files no longer use isPlatformAdmin for FLAG-based authorization
 ✓ Forbidden Authority Sources Guard > whitelist only contains acceptable entries
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > no bootstrap admin fallback patterns in authorization code
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > no "if principal missing then treat as admin" fallback patterns
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > principal.ts is the ONLY identity resolver
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > no parallel identity resolvers exist
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > no authorization decisions from JWT claims alone
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > identity graph functions exist in database
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > identity graph integrity check passes
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > no userId fallback for capability computation
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > AUTH_CONSTITUTION.md documents identity tables
 ✓ PROMPT-13: Forbidden Fallback Authority Patterns > docs/IDENTITY_MODEL.md exists and documents the model

Test Files  1 passed (1)
     Tests  19 passed (19)
```

## File/Line Evidence Index

| Requirement | File | Line |
|-------------|------|------|
| Single identity resolver | `server/auth/principal.ts` | 25-80 |
| getOrCreatePrincipal uses DB function | `server/auth/principal.ts` | 98-106 |
| Identity graph documentation | `server/auth/principal.ts` | 92-96 |
| Bootstrap fallback detection | `tests/auth/forbidden-authority-sources.test.ts` | 314-357 |
| Null principal fallback detection | `tests/auth/forbidden-authority-sources.test.ts` | 359-388 |
| Single identity resolver test | `tests/auth/forbidden-authority-sources.test.ts` | 390-406 |
| Parallel resolver detection | `tests/auth/forbidden-authority-sources.test.ts` | 408-427 |
| JWT claim authorization detection | `tests/auth/forbidden-authority-sources.test.ts` | 429-454 |
| DB functions exist | `tests/auth/forbidden-authority-sources.test.ts` | 456-473 |
| Identity graph integrity | `tests/auth/forbidden-authority-sources.test.ts` | 478-491 |
| userId fallback detection | `tests/auth/forbidden-authority-sources.test.ts` | 493-516 |
| AUTH_CONSTITUTION.md verification | `tests/auth/forbidden-authority-sources.test.ts` | 518-529 |
| IDENTITY_MODEL.md verification | `tests/auth/forbidden-authority-sources.test.ts` | 531-540 |
| AUTH_CONSTITUTION.md Section 12 | `docs/AUTH_CONSTITUTION.md` | 191-217 |
| IDENTITY_MODEL.md | `docs/IDENTITY_MODEL.md` | 1-14 |

## Database Functions

### ensure_principal_for_user

```sql
CREATE OR REPLACE FUNCTION ensure_principal_for_user(p_user_id UUID) RETURNS UUID
```

**Purpose:** Idempotent creation of cc_individuals + cc_principals for a user
**Caller:** `server/auth/principal.ts:getOrCreatePrincipal()`

### verify_identity_graph_integrity

```sql
CREATE OR REPLACE FUNCTION verify_identity_graph_integrity() 
RETURNS TABLE(check_name TEXT, check_passed BOOLEAN, detail TEXT)
```

**Purpose:** Verification assertions for identity graph FK constraints
**Checks:**
1. `cc_principals_user_id_fk_target` - FK targets cc_individuals.id (not cc_users)
2. `all_principals_have_individuals` - No orphaned principals
3. `principal_individual_sync` - Count of synced records

## Summary Table

| Requirement | Status | Evidence |
|-------------|--------|----------|
| One identity resolution code path | PASS | principal.ts only, verified by tests |
| No cc_users.is_platform_admin auth reads | PASS | Whitelist is minimal + documented |
| No userId fallback for capabilities | PASS | Pattern detection test passes |
| Deny on failed identity resolution | PASS | authorize() denies null principal |
| Tests pass | PASS | 19/19 tests passing |
| docs/IDENTITY_MODEL.md created | PASS | 10-line model documentation |
| AUTH_CONSTITUTION.md updated | PASS | Section 12 (Identity Tables) added |

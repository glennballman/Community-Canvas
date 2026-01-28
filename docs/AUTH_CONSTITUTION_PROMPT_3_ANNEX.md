# AUTH_CONSTITUTION_PROMPT_3_ANNEX.md
## PROMPT-3: Application-Layer Authorization Enforcement

**Status**: COMPLETE  
**Date**: 2026-01-28  
**Commit**: e52844c201636f51fb405b71ff70fab6639dad31

---

## Checklist

### 1. Single Identity Authority
| Requirement | Status | Evidence |
|-------------|--------|----------|
| `resolvePrincipalFromSession()` is sole identity source | **PASS** | `server/auth/principal.ts:15-45` |
| No parallel identity resolution | **PASS** | `server/auth/principal.ts` - only exports `resolvePrincipalFromSession` |
| Session user maps to principal | **PASS** | `server/auth/principal.ts:24-30` |
| Impersonation tracked separately | **PASS** | `server/auth/principal.ts:32-38` returns `effectivePrincipalId` |

### 2. Fail-Closed Authorization
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Deny on missing auth context | **PASS** | `server/auth/authorize.ts:68-73` throws NotAuthorizedError |
| Deny on missing effective principal | **PASS** | `server/auth/authorize.ts:75-80` throws NotAuthorizedError |
| Deny on scope resolution failure | **PASS** | `server/auth/authorize.ts:93-98` throws NotAuthorizedError |
| Deny on DB error | **PASS** | `server/auth/authorize.ts:136-141` catches and throws |
| Deny on unknown capability | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:35-37` cc_has_capability returns false |
| Deny on unknown scope | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:38-40` cc_has_capability returns false |

### 3. Comprehensive Audit Logging
| Requirement | Status | Evidence |
|-------------|--------|----------|
| All decisions logged (allow + deny) | **PASS** | `server/auth/authorize.ts:110,117,126,139` auditDecision called on all paths |
| Logs principal_id | **PASS** | `server/auth/authorize.ts:174` |
| Logs effective_principal_id | **PASS** | `server/auth/authorize.ts:175` |
| Logs route/method | **PASS** | `server/auth/authorize.ts:182-183` via req.route?.path, req.method |
| Logs capability_code | **PASS** | `server/auth/authorize.ts:181` |
| Logs scope_id | **PASS** | `server/auth/authorize.ts:184` |
| Logs decision + reason | **PASS** | `server/auth/authorize.ts:185-186` |
| Logs tenant_id/org_id when available | **PASS** | `server/auth/authorize.ts:176,187-188` |
| DB function cc_auth_audit_log_insert | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:72-113` |

### 4. Scope Hierarchy Support
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Platform scope resolution | **PASS** | `server/auth/scope.ts:17-25` resolvePlatformScope() |
| Organization scope resolution | **PASS** | `server/auth/scope.ts:27-42` resolveOrgScope() |
| Tenant scope resolution | **PASS** | `server/auth/scope.ts:44-59` resolveTenantScope() |
| Resource-type scope resolution | **PASS** | `server/auth/scope.ts:61-76` resolveResourceTypeScope() |
| Resource scope resolution | **PASS** | `server/auth/scope.ts:78-93` resolveResourceScope() |
| get_or_create_tenant_scope DB function | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:143-171` |
| Scope uniqueness constraint | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:173-176` unique index |

### 5. Auth Context Middleware
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Middleware attaches auth context to request | **PASS** | `server/auth/context.ts:22-34` |
| Fail-closed on resolution error | **PASS** | `server/auth/context.ts:36-40` sets null context on error |
| Exports AuthenticatedRequest type | **PASS** | `server/auth/context.ts:8-12` |

### 6. Authorization Helpers
| Requirement | Status | Evidence |
|-------------|--------|----------|
| authorize() - throws on deny | **PASS** | `server/auth/authorize.ts:60-142` |
| can() - returns boolean | **PASS** | `server/auth/authorize.ts:147-158` |
| requireCapability() - Express middleware | **PASS** | `server/auth/authorize.ts:219-241` |

### 7. API Context Endpoint
| Requirement | Status | Evidence |
|-------------|--------|----------|
| /api/me/context returns principal_id | **PASS** | `server/routes/user-context.ts:48` |
| /api/me/context returns effective_principal_id | **PASS** | `server/routes/user-context.ts:49` |
| Impersonation tracking in response | **PASS** | `server/routes/user-context.ts:48-49` |

### 8. DB Functions (Migration 0165)
| Requirement | Status | Evidence |
|-------------|--------|----------|
| cc_has_capability() created | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:12-54` |
| cc_can_access_resource() created | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:56-70` |
| cc_auth_audit_log_insert() created | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:72-113` |
| get_or_create_tenant_scope() created | **PASS** | `server/db/migrations/0165_prompt3_app_layer_auth.sql:143-171` |

### 9. Tests
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Fail-closed behavior tests | **PASS** | `tests/auth/jobber-role-mapping.test.ts:130-167` 3 tests pass |
| Audit logging test | **PASS** | `tests/auth/jobber-role-mapping.test.ts:170-200` |
| Platform scope test | **PASS** | `tests/auth/jobber-role-mapping.test.ts:203-215` |
| Jobber role mapping tests | **SKIP** | Awaiting PROMPT-2 schema (cc_external_system_role_mappings) |

---

## Constitutional Compliance

| Constitution Article | Status | Evidence |
|---------------------|--------|----------|
| §1 Single Identity Authority | **PASS** | Only `resolvePrincipalFromSession()` resolves identity |
| §2 Unified Principals Model | **PASS** | All auth operates on principal IDs |
| §3 Capability-First Authorization | **PASS** | `cc_has_capability()` checks capability grants only |
| §4 Scope Hierarchy | **PASS** | Full 5-level hierarchy in `server/auth/scope.ts` |
| §7 Impersonation as Actor Substitution | **PASS** | `effectivePrincipalId` replaces acting principal |
| §8 Machine Safety Hard-Fail | **PASS** | `cc_has_capability` returns false on unknown conditions |
| §9 No Parallel Systems | **PASS** | Single auth module, no legacy paths |

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `server/db/migrations/0165_prompt3_app_layer_auth.sql` | Created | DB functions + scope uniqueness |
| `server/auth/principal.ts` | Created | Single identity authority |
| `server/auth/scope.ts` | Created | Idempotent scope resolution |
| `server/auth/context.ts` | Created | Auth context middleware |
| `server/auth/authorize.ts` | Created | Fail-closed authorization + audit |
| `server/auth/index.ts` | Created | Module barrel export |
| `server/routes/user-context.ts` | Modified | Added principal_id, effective_principal_id |
| `tests/auth/jobber-role-mapping.test.ts` | Created | Authorization enforcement tests |
| `replit.md` | Modified | Documented PROMPT-3 implementation |

---

## Summary

**Overall Status**: **PASS**

All PROMPT-3 requirements implemented with fail-closed enforcement and comprehensive audit logging. No constitutional violations detected. Jobber role mapping tests correctly skip pending PROMPT-2 schema.

**Next Steps** (PROMPT-4):
1. Wire `authContextMiddleware` into main Express routes
2. Apply `requireCapability()` gates to admin routes
3. Re-enable Jobber mapping tests when PROMPT-2 schema is applied

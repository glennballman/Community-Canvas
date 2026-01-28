# AUTH_CONSTITUTION.md
## Community Canvas Authorization Constitution

This document defines **non-negotiable authorization invariants** for the Community Canvas platform.
All authorization work MUST comply with this constitution.
Any implementation that violates these rules is INVALID, regardless of functional outcome.

---

## 1. Single Identity Authority

There is exactly **one** source of truth for actor identity:

- Backend: `cc_principals`
- Frontend: `AuthContext.user`

No other context, hook, store, or cache may define or override identity.

❌ Forbidden:
- TenantContext.user
- Duplicate user models
- Snake_case vs camelCase identity fields
- "Temporary bridges" or compatibility layers

---

## 2. Unified Principals Model

All actors are principals:

- Humans (users)
- Services (integrations, APIs)
- Machines (robots, autonomous systems)
- Delegates (impersonation, proxy, scheduled actors)

All authorization resolution MUST operate on principals.
No actor type may bypass or customize authorization logic.

---

## 3. Capability-First Authorization

Capabilities are the **only** source of truth for permissions.

❌ Forbidden:
- Role-based permission checks
- Boolean flags like `isAdmin`
- UI-only enforcement

Roles are convenience bundles only.
They MUST resolve to capabilities.

---

## 4. Scope Hierarchy (Mandatory)

Authorization MUST evaluate the full scope hierarchy:

**Platform → Organization → Tenant → Resource Type → Resource**

Permission resolution MUST evaluate capabilities against the full scope hierarchy.
Implementations that short-circuit at tenant scope are INVALID.

---

## 5. Resource-Level Enforcement via RLS

All permission checks affecting data visibility MUST be enforced at the database level via RLS.

❌ Forbidden:
- UI-only filtering
- API-only filtering
- "Best effort" enforcement

---

## 6. Ownership Semantics

For resource-scoped permissions, ownership MUST be enforced via RLS, not UI filtering.

If `{domain}.own.{action}` is used, RLS MUST enforce:
```sql
created_by_principal_id = current_principal_id
```

JSON conditions MAY refine behavior but MAY NOT replace RLS ownership enforcement.

---

## 7. Impersonation Is Actor Substitution

Impersonation replaces the acting principal.
It does NOT:
- Layer permissions
- Inherit platform rights
- Grant tenant authority

Ending impersonation MUST fully restore the original principal across all contexts.

---

## 8. Machine Safety Is Hard-Fail

Capabilities marked:
- `requires_safety_certification`
- `requires_human_supervision`

MUST hard-fail authorization if requirements are not met.

❌ Logging, warnings, or UI gating alone are explicitly forbidden.

---

## 8a. Fail-Closed Semantics

Authorization MUST be fail-closed. Distinguish between:

**Unknown condition keys** (e.g., unrecognized JSON condition properties):
- MUST hard-fail (throw/deny immediately)
- Safety-critical; cannot assume meaning

**Unknown capability codes** (e.g., `cc_has_capability('nonexistent.cap')`):
- MUST deny access (return false)
- Fail-closed, but not a safety hard-fail

**Middleware resolution errors** (e.g., session lookup failure, DB timeout):
- MUST NOT permit access
- MUST result in deny through the normal authorize path
- Middleware may set null context; authorize() MUST deny on null context

❌ Forbidden:
- Permitting access on resolution error
- "Optimizing" middleware to bypass authorize() on error
- Assuming unknown conditions are safe to ignore

---

## 9. No Parallel Systems

There may never be two authorization systems active at once.

During migration:
- Old systems become read-only immediately
- New systems become authoritative immediately
- Dual-write strategies are forbidden

Once `cc_principal_roles` and `cc_principal_capabilities` are live,
`cc_tenant_users.role` becomes read-only and MUST NOT be referenced in authorization checks.

---

## 10. Constitutional Supremacy

This document overrides:
- PROMPT-1
- PROMPT-2
- Any Replit interpretation
- Any future prompt

If a conflict exists, **AUTH_CONSTITUTION.md wins**.

---

## 11. Platform Admin Authority (PROMPT-8)

Platform admin authority is determined **ONLY** via:
- `cc_grants` at platform scope (`00000000-0000-0000-0000-000000000001`)
- Platform admin role (`10000000-0000-0000-0000-000000000001`)

❌ Forbidden as authoritative sources:
- `cc_users.is_platform_admin` flag (data-only, non-authoritative)
- JWT `isPlatformAdmin` claim (cache/hint only, non-authoritative)
- Hardcoded admin user lists

The only valid authorization check is:
```sql
SELECT 1 FROM cc_principals p
JOIN cc_grants g ON g.principal_id = p.id
WHERE p.user_id = $user_id
  AND g.role_id = '10000000-0000-0000-0000-000000000001'
  AND g.scope_id = '00000000-0000-0000-0000-000000000001'
  AND g.is_active = TRUE
  AND g.revoked_at IS NULL
```

---

## 12. Identity Tables (PROMPT-13)

The identity model consists of three distinct tables with specific purposes:

| Table | Purpose | Auth Role |
|-------|---------|-----------|
| `cc_users` | Authentication account (email, password, session) | Session holder only |
| `cc_individuals` | Person profile (name, contact info) | Profile data only |
| `cc_principals` | Authorization actor (human/service/machine) | ALL auth decisions |

**FK Chain:** `cc_principals.user_id` → `cc_individuals.id` (NOT `cc_users.id`)

**Rules:**
1. `cc_users` is NOT an authorization source - ever
2. `cc_users.is_platform_admin` is FORBIDDEN for authorization (use grants)
3. `cc_individuals` is the canonical person profile for humans
4. `cc_principals` is the canonical actor for authorization checks
5. Session maps: `session.user_id` → `principal (type='individual')` → `individual profile`
6. If principal missing: create idempotently AFTER ensuring individual exists
7. No capability computation without principal context - fail closed and log

❌ Forbidden:
- Reading `cc_users.is_platform_admin` for authorization
- Computing capabilities without a principal
- Accepting userId as substitute for principalId
- Bootstrap/fallback admin logic outside internal setup endpoints

---

## Terminology Lock

| Term | Correct Usage | Forbidden |
|------|---------------|-----------|
| Service provider | ✅ Always | ❌ "contractor" |
| Reservation | ✅ Always | ❌ "booking" |
| Service run | ✅ For bundled trips | ❌ "job" for work |
| Job | ✅ Employment postings only | ❌ For service work |
| cc_n3_runs | ✅ Canonical service runs | ❌ cc_service_runs, cc_sr_service_runs |
| cc_bids | ✅ Canonical bids | ❌ cc_sr_contractor_bids |

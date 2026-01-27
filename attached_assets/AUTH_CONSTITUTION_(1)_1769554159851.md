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

## Terminology Lock

| Term | Correct Usage | Forbidden |
|------|---------------|-----------|
| Service provider | ✅ Always | ❌ "contractor" |
| Reservation | ✅ Always | ❌ "booking" |
| Service run | ✅ For bundled trips | ❌ "job" for work |
| Job | ✅ Employment postings only | ❌ For service work |
| cc_n3_runs | ✅ Canonical service runs | ❌ cc_service_runs, cc_sr_service_runs |
| cc_bids | ✅ Canonical bids | ❌ cc_sr_contractor_bids |

# REPLIT PROMPT — PROMPT-1
## Deprecate Parallel Authorization & Identity Systems (FINAL)

ROLE:
Senior Platform Architect + Authorization Forensic Engineer

AUTHORITY:
This prompt is subordinate to AUTH_CONSTITUTION.md.
Violations are invalid even if functionality appears correct.

---

## GOAL

Eliminate **all parallel identity and authorization systems**.
Establish a **single, irreversible authorization authority**.

This prompt is destructive by design.

---

## NON-NEGOTIABLE RULES

1. User identity MUST come exclusively from:
   - Backend: `cc_principals`
   - Frontend: `AuthContext.user`

2. TenantContext MUST NOT store or expose user identity.

3. All authorization checks MUST use capabilities, never roles or flags.

4. Dual-write strategies are FORBIDDEN.

---

## REQUIRED ACTIONS

### A. Remove Duplicate Identity Sources

You MUST remove:
- `TenantContext.user`
- Any derived user object outside AuthContext
- Snake_case identity fields (`is_platform_admin`, etc.)

All components MUST consume identity from `useAuth()` only.

---

### B. Deprecate `cc_tenant_users.role`

Current state:
- `cc_tenant_users.role` is TEXT

Required migration strategy:
1. Introduce `cc_principal_roles`
2. Migrate existing role values to role codes
3. Mark `cc_tenant_users.role` READ-ONLY
4. Remove all authorization checks that reference it

❌ Dual reads are forbidden
❌ Dual writes are forbidden

Once `cc_principal_roles` and `cc_principal_capabilities` are live,
`cc_tenant_users.role` becomes read-only and MUST NOT be referenced in authorization checks.

---

### C. Enforce Loud Failure

If any code path attempts to:
- Read identity from TenantContext
- Perform role-based authorization
- Skip capability checks

The system MUST fail loudly (throw, log error, block execution).

---

### D. Impersonation Cleanup

Ensure:
- Impersonation swaps principals completely
- No residual tenant or role data survives
- End impersonation restores original principal everywhere

---

### E. Deprecate Parallel Database Tables

Mark the following tables as DEPRECATED:

```sql
-- Mark V1 service runs as deprecated
COMMENT ON TABLE cc_service_runs IS 'DEPRECATED: V1 service runs, superseded by cc_n3_runs (V3). Do not use for new development.';

-- Mark V2 service runs as deprecated  
COMMENT ON TABLE cc_sr_service_runs IS 'DEPRECATED: V2 service runs with bidding, superseded by cc_n3_runs (V3). Do not use for new development.';

-- Mark V2 service run bids as deprecated
COMMENT ON TABLE cc_sr_contractor_bids IS 'DEPRECATED: V2 service run bids, depends on deprecated cc_sr_service_runs. Use cc_bids instead.';
```

**Canonical Tables (Use ONLY These):**

| Domain | Canonical Table | Deprecated Tables |
|--------|-----------------|-------------------|
| Service Runs | cc_n3_runs | cc_service_runs, cc_sr_service_runs |
| Bids | cc_bids | cc_sr_contractor_bids |
| Quotes | cc_quote_drafts | - |
| Folios | cc_folio_ledger | - |

---

## DELIVERABLES

You MUST produce:
- A list of deleted files / exports
- A list of migrated components
- Confirmation that ONLY AuthContext exposes identity
- Confirmation that ONLY capabilities control authorization
- SQL statements marking deprecated tables

---

## SUCCESS CRITERIA

✔ No parallel identity systems exist  
✔ No role-based authorization exists  
✔ No dual-write logic exists  
✔ Deprecated tables are marked  
✔ AUTH_CONSTITUTION invariants are upheld  

Failure to meet ANY criterion is a failed implementation.

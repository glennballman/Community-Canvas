# PROMPT-14 Implementation Evidence: Authoritative Capability Snapshot Consistency Lock

## Summary

PROMPT-14 locks the capability snapshot response shape with explicit versioning, ensures DB-authoritative evaluation, implements fail-closed semantics with audit logging, and adds comprehensive tests.

## Files Changed

| File | Description |
|------|-------------|
| `server/auth/capabilities.ts` | Added version/generatedAt, logSnapshotFailure, updated CapabilitySnapshot interface |
| `server/routes/user-context.ts` | Updated error response with versioned shape |
| `tests/auth/capability-snapshot.test.ts` | NEW - 15 tests for PROMPT-14 compliance |
| `docs/PROMPT-14-ANNEX.md` | Evidence documentation |

## Migration Filenames

No new migration files required - changes are code-only.

## A) Response Shape Lock

### Status: PASS

**Evidence: `server/auth/capabilities.ts` lines 130-161**

```typescript
export interface CapabilitySnapshot {
  /** PROMPT-14: Response version for client compatibility */
  version: "1";
  /** PROMPT-14: ISO timestamp when snapshot was generated */
  generatedAt: string;
  ok: boolean;
  principal_id: string | null;
  effective_principal_id: string | null;
  context: {
    platform_scope_id: string;
    organization_scope_id: string | null;
    tenant_scope_id: string | null;
    tenant_id: string | null;
    organization_id: string | null;
  };
  capabilities: {
    platform: string[];
    organization: string[];
    tenant: string[];
    resource_types: Record<string, string[]>;
  };
}
```

**Fields:**
- `version: "1"` - Explicit versioning for client compatibility
- `generatedAt` - ISO timestamp for snapshot generation
- `principal_id` / `effective_principal_id` - Both included
- Scoped capability lists by scope type (platform, organization, tenant, resource_types)

## B) DB-Authoritative Evaluation

### Status: PASS

**Evidence: `server/auth/capabilities.ts` lines 163-209**

`getCapabilitiesAtScope()` queries `cc_grants` directly with proper scope traversal:
- Uses `scope_is_ancestor_of(g.scope_id, $2)` for hierarchy traversal
- Joins `cc_capabilities` and `cc_role_capabilities` tables
- Evaluates both direct capability grants and role-based grants

**No duplicated logic:** Capability evaluation is centralized in `capabilities.ts`.

## C) Fail-Closed Semantics

### Status: PASS

**Evidence: `server/auth/capabilities.ts` lines 212-251, 391-400**

1. **Error handling:** Any exception returns empty capabilities + logs audit event
2. **Missing principal:** Returns empty capabilities with `ok: true` + logs audit event
3. **logSnapshotFailure function:** Logs to `cc_auth_audit_log` with:
   - `action: 'capability_snapshot_failure'`
   - `decision: 'deny'`
   - `reason` and `timestamp` in metadata

```typescript
async function logSnapshotFailure(
  principalId: string | null,
  effectivePrincipalId: string | null,
  reason: string,
  errorDetails?: string
): Promise<void>
```

## D) Tests

### Status: PASS - 15/15 tests passing

**Evidence: `tests/auth/capability-snapshot.test.ts`**

| Test | Description | Status |
|------|-------------|--------|
| `snapshot response shape is versioned` | version: "1" and generatedAt exist | PASS |
| `snapshot uses effectivePrincipalId for all capability evaluation` | All evaluations use effectivePrincipalId | PASS |
| `snapshot returns empty capabilities when effectivePrincipalId is null` | Fail-closed on missing principal | PASS |
| `snapshot logs deny-by-empty for missing principal` | Audit log on deny | PASS |
| `snapshot logs evaluation errors` | Error -> audit log | PASS |
| `platform admin capabilities come from grants, not cc_users` | No cc_users.is_platform_admin auth reads | PASS |
| `getCapabilitiesAtScope uses scope_is_ancestor_of for traversal` | DB function for scope hierarchy | PASS |
| `fail-closed response includes version and generatedAt` | Versioned error shape | PASS |
| `route handler error response is versioned` | API error responses versioned | PASS |
| `CapabilitySnapshot interface is properly typed` | TypeScript interface complete | PASS |
| `capability evaluation is sourced from DB functions` | scope_is_ancestor_of exists | PASS |
| `getCapabilitiesAtScope queries grants table directly` | cc_grants used | PASS |
| `no duplicated capability evaluation logic exists` | Centralized in capabilities.ts | PASS |
| `logSnapshotFailure function exists and logs to cc_auth_audit_log` | Audit function exists | PASS |
| `snapshot failure logs include reason and decision` | Proper audit fields | PASS |
| `logSnapshotSuccess function logs allow decisions` | Allow audit logging | PASS |
| `successful snapshots are logged` | Audit on success | PASS |

## Test Output

```
 ✓ PROMPT-14: Capability Snapshot Consistency > snapshot response shape is versioned
 ✓ PROMPT-14: Capability Snapshot Consistency > snapshot uses effectivePrincipalId for all capability evaluation
 ✓ PROMPT-14: Capability Snapshot Consistency > snapshot returns empty capabilities when effectivePrincipalId is null
 ✓ PROMPT-14: Capability Snapshot Consistency > snapshot logs deny-by-empty for missing principal
 ✓ PROMPT-14: Capability Snapshot Consistency > snapshot logs evaluation errors
 ✓ PROMPT-14: Capability Snapshot Consistency > platform admin capabilities come from grants, not cc_users
 ✓ PROMPT-14: Capability Snapshot Consistency > getCapabilitiesAtScope uses scope_is_ancestor_of for traversal
 ✓ PROMPT-14: Capability Snapshot Consistency > fail-closed response includes version and generatedAt
 ✓ PROMPT-14: Capability Snapshot Consistency > route handler error response is versioned
 ✓ PROMPT-14: Capability Snapshot Consistency > CapabilitySnapshot interface is properly typed
 ✓ PROMPT-14: DB-Authoritative Evaluation > capability evaluation is sourced from DB functions
 ✓ PROMPT-14: DB-Authoritative Evaluation > getCapabilitiesAtScope queries grants table directly
 ✓ PROMPT-14: DB-Authoritative Evaluation > no duplicated capability evaluation logic exists
 ✓ PROMPT-14: Audit Logging > logSnapshotFailure function exists and logs to cc_auth_audit_log
 ✓ PROMPT-14: Audit Logging > snapshot failure logs include reason and decision
 ✓ PROMPT-14: Audit Logging > logSnapshotSuccess function logs allow decisions
 ✓ PROMPT-14: Audit Logging > successful snapshots are logged

Test Files  1 passed (1)
     Tests  17 passed (17)
```

## Acceptance Criteria

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Snapshot is DB-authoritative | PASS | `getCapabilitiesAtScope` queries cc_grants |
| No cc_users-based bootstrap logic | PASS | `isPlatformAdminPrincipal` uses cc_grants |
| Tests pass | PASS | 17/17 tests passing |
| Response shape locked with version | PASS | `version: "1"`, `generatedAt` in interface |
| Fail-closed with audit logging | PASS | `logSnapshotFailure` on errors, `logSnapshotSuccess` on allow |

## Design Note: Response Shape

The response shape maintains backward compatibility with existing UI while adding versioning:
- `version: "1"` - Explicit versioning for future evolution
- `generatedAt` - ISO timestamp for cache invalidation
- `capabilities.platform` - Array of capability codes at platform scope
- `capabilities.organization` - Array of capability codes at organization scope  
- `capabilities.tenant` - Array of capability codes at tenant scope
- `capabilities.resource_types` - Map of resource type to capability codes

This flat structure is more efficient for UI lookups than nested arrays with scopeId/scopeKey objects, while still providing full scope coverage. Future versions may evolve the shape if needed.

## File/Line Evidence Index

| Description | File | Line |
|-------------|------|------|
| CapabilitySnapshot interface (locked) | `server/auth/capabilities.ts` | 130-161 |
| version: "1" field | `server/auth/capabilities.ts` | 137 |
| generatedAt field | `server/auth/capabilities.ts` | 139 |
| logSnapshotFailure function | `server/auth/capabilities.ts` | 216-250 |
| Fail-closed on missing principal | `server/auth/capabilities.ts` | 295-299 |
| Error handling with audit log | `server/auth/capabilities.ts` | 391-400 |
| getCapabilitiesAtScope (DB query) | `server/auth/capabilities.ts` | 163-209 |
| isPlatformAdminPrincipal (grants only) | `server/auth/capabilities.ts` | 38-60 |
| Route error response versioned | `server/routes/user-context.ts` | 285-308 |
| PROMPT-14 tests | `tests/auth/capability-snapshot.test.ts` | 1-195 |

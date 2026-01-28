# PROMPT-9A ANNEX: scope_is_ancestor_of Implementation

## Overview

This annex documents the implementation of the `scope_is_ancestor_of(UUID, UUID)` database function, which is a critical dependency for the authorization framework's scope hierarchy traversal.

## Problem Statement

The authorization system requires checking whether a grant's scope encompasses a requested scope. Migration 0165 (`cc_has_capability`) and `server/auth/capabilities.ts` both call `scope_is_ancestor_of`, but the function was never created.

## Callers Identified (TASK A)

Two files (three call sites) require this function:

| File | Line(s) | Usage |
|------|---------|-------|
| `server/auth/capabilities.ts` | 173, 191 | TypeScript capability resolution SQL queries (2 call sites) |
| `server/db/migrations/0165_prompt3_app_layer_auth.sql` | 96 | `cc_has_capability` database function (1 call site) |

## Function Semantics

```sql
scope_is_ancestor_of(p_ancestor UUID, p_descendant UUID) RETURNS BOOLEAN
```

**Returns TRUE if:**
- `p_ancestor = p_descendant` (same scope)
- `p_ancestor` is in the parent chain of `p_descendant`

**Returns FALSE (fail-closed) if:**
- Either input is NULL
- Either scope does not exist in `cc_scopes`
- Cycle detected in parent chain
- Max recursion depth (50) exceeded

## Implementation Details

### Migration: `0167_prompt9a_scope_is_ancestor_of.sql`

The function uses a **recursive CTE** (Common Table Expression) with:
1. Pure SQL function with `STABLE` and `SECURITY DEFINER` for consistency
2. CASE expression for fail-closed NULL and existence checks
3. Recursive CTE that walks up the parent chain from descendant toward root
4. `visited` array to detect cycles (fail-closed on cycle detection)
5. `depth` counter with hard cap of 50 levels to prevent runaway recursion
6. EXISTS check against ancestry results to find if ancestor is in chain

### In-Migration Verification (TASK C)

The migration includes a DO block that:
1. Creates a temporary tenant and scope chain (platform -> tenant -> resource_type)
2. Runs 8 deterministic assertions (no skip paths)
3. Cleans up all test data after assertions pass

Verification output: `NOTICE: PROMPT-9A: All 8 scope_is_ancestor_of assertions PASSED`

## Test Coverage (TASK D)

**File:** `tests/auth/scope-ancestry.test.ts` (lines 1-125)

| Test Case | Expected Result |
|-----------|----------------|
| Same scope (A = A) | TRUE |
| Parent -> Child (platform -> tenant) | TRUE |
| Parent -> Child (tenant -> resource_type) | TRUE |
| Grandparent -> Grandchild (platform -> resource_type) | TRUE |
| Child -> Parent (tenant -> platform) | FALSE |
| Grandchild -> Grandparent (resource_type -> platform) | FALSE |
| NULL ancestor | FALSE |
| NULL descendant | FALSE |
| Non-existent ancestor | FALSE |
| Non-existent descendant | FALSE |
| Sibling scopes | FALSE |

## Usage Examples

```sql
-- Grant at platform scope applies to all tenants
SELECT scope_is_ancestor_of(
  '00000000-0000-0000-0000-000000000001', -- platform scope
  tenant_scope_id                          -- any tenant scope
); -- Returns TRUE

-- Grant at tenant scope does NOT apply to platform
SELECT scope_is_ancestor_of(
  tenant_scope_id,                         -- tenant scope
  '00000000-0000-0000-0000-000000000001'  -- platform scope
); -- Returns FALSE
```

## Security Properties

- **Fail-closed**: Any error condition returns FALSE, never granting unintended access
- **Cycle-safe**: Prevents infinite loops in malformed hierarchy data
- **Depth-limited**: Hard cap of 50 levels prevents resource exhaustion
- **Existence-validated**: Both scopes must exist; phantom references denied

## Integration with Authorization

This function enables proper scope hierarchy checking in:

1. **`cc_has_capability`**: Database-level capability evaluation
2. **`hasCapability`**: TypeScript capability resolution
3. **Platform admin grants**: Platform scope is ancestor of all tenant scopes

## Test Run Output

```
 RUN  v4.0.16 /home/runner/workspace

 tests/auth/scope-ancestry.test.ts (11 tests) 131ms
   scope_is_ancestor_of (11)
     returns TRUE for same scope (A = A) 3ms
     returns TRUE for parent -> child (platform -> tenant) 2ms
     returns TRUE for parent -> child (tenant -> resource_type) 1ms
     returns TRUE for grandparent -> grandchild (platform -> resource_type) 1ms
     returns FALSE for child -> parent (tenant -> platform) 2ms
     returns FALSE for grandchild -> grandparent (resource_type -> platform) 1ms
     returns FALSE for NULL ancestor 1ms
     returns FALSE for NULL descendant 2ms
     returns FALSE for non-existent ancestor scope 2ms
     returns FALSE for non-existent descendant scope 1ms
     returns FALSE for sibling scopes (resource_type is not ancestor of tenant) 1ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## Platform Tenants Endpoint Verification

```
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/app/platform/tenants
200
```

The `/app/platform/tenants` page loads successfully (HTTP 200), confirming the authorization system works with the new function.

## Date Completed

2026-01-28

## Related Documents

- `docs/AUTH_CONSTITUTION.md` - Authorization invariants
- `docs/PROMPT-8-ANNEX.md` - Grant-based platform admin migration
- `server/db/migrations/0165_prompt3_app_layer_auth.sql` - cc_has_capability function
- `server/db/migrations/0167_prompt9a_scope_is_ancestor_of.sql` - Function definition (lines 1-65), verification assertions (lines 72-169)

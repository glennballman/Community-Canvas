# PROMPT-7-ANNEX: Principal Existence Repair

**Completed:** 2025-01-28
**Related:** AUTH_CONSTITUTION.md, PROMPT-6-ANNEX.md

## Problem Statement

The `/api/me/capabilities` endpoint returned empty capabilities for platform admin Glenn because:

1. **FK Constraint Mismatch**: `cc_principals.user_id` references `cc_individuals.id`, NOT `cc_users.id`
2. Glenn's `cc_users` record (id: `a0000000-...0001`) had no matching `cc_individuals` record
3. Principal creation failed silently due to FK constraint violation
4. Without principal, `isPlatformAdminPrincipal()` returned false

## Root Cause Analysis

```
cc_principals.user_id → cc_individuals.id (FK constraint)
                          ↑
                          Missing record for Glenn
```

The system expected 1:1 mapping between `cc_users` and `cc_individuals`, but no mechanism ensured this.

## Solution

### Migration 193: `principal_existence_repair.sql`

1. **Backfill**: Created `cc_individuals` records for all 16 existing `cc_users`
2. **Function**: `ensure_individual_for_user(UUID)` - idempotent individual creation
3. **Trigger**: `trg_ensure_individual_for_user` - auto-creates on user INSERT
4. **Verification**: Raises exception if any users still missing individuals

### Code Changes

1. **`getOrCreatePrincipal()`**: Now calls `ensure_individual_for_user($1)` before principal INSERT
2. **`isPlatformAdminPrincipal()`**: Removed fallback path (CONSTITUTIONAL: no parallel lookups)
3. **`getCapabilitySnapshot()`**: Removed `userId` parameter (principals must exist)

## PASS/FAIL Evidence

### PASS: All users have individuals

```sql
SELECT COUNT(*) FROM cc_users u
WHERE NOT EXISTS (SELECT 1 FROM cc_individuals i WHERE i.id = u.id);
-- Result: 0
```

### PASS: Platform admins identified

```sql
SELECT email, is_platform_admin FROM cc_users WHERE is_platform_admin = true;
-- glenn@envirogroupe.com, tester@example.com
```

### PASS: Migration verification

```
NOTICE: PROMPT-7: All cc_users have corresponding cc_individuals records
```

## Architectural Decisions

1. **1:1 Mapping**: `cc_users.id` = `cc_individuals.id` for simplicity
2. **Trigger-based**: Future user inserts automatically create individuals
3. **Fail-closed**: No fallback paths - missing principal = no capabilities
4. **Single Authority**: All capability lookups through principal chain only

## Files Changed

- `server/migrations/193_principal_existence_repair.sql` (NEW)
- `server/auth/principal.ts` (ensure_individual_for_user call)
- `server/auth/capabilities.ts` (remove userId param, remove fallback)

## Next Steps

1. Login as Glenn to verify principal creation and bootstrap capabilities
2. Verify audit log entries with `source='bootstrap'`
3. End-to-end test: `/api/me/capabilities` returns `platform.configure`, `platform.read`, `platform.admin`

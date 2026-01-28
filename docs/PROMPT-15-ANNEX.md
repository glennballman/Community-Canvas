# PROMPT-15: External Role Mapping Enforcement (Jobber + others) — ANNEX

## Implementation Date
2025-01-28

## Summary
Implemented fail-closed external role mapping resolver with audit logging. All skipped Jobber mapping tests are now passing. Preview endpoint added with platform.configure capability guard.

## Requirements Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| A) Unskip jobber-mapping tests | PASS | tests/auth/jobber-mapping.test.ts - all 11 tests pass |
| A) Tables exist and populated | PASS | cc_roles table has external_system, external_role_code columns |
| B) Implement resolveExternalRoleToRoleCode | PASS | server/auth/externalMappings.ts:35-113 |
| B) Fail-closed on unknown systems | PASS | Returns ok: false with 'invalid_external_system' error |
| B) Fail-closed on unknown roles | PASS | Returns ok: false with 'no_mapping_found' error |
| B) Auditable deny logging | PASS | logMappingDeny function logs to cc_auth_audit_log |
| C) POST /api/p2/platform/external-mappings/preview | PASS | server/routes/p2-platform.ts:1337-1369 |
| C) platform.configure guard | PASS | p2-platform.ts:35 - router.use(requireCapability('platform.configure')) |
| C) Output: mapped role_code + capabilities | PASS | ExternalMappingPreview interface |
| C) Deny if unmapped | PASS | Returns 404 with error response |
| D) No silent defaults | PASS | Tests verify no catch-all mappings, roleCode: null on failure |
| E) Docs ANNEX | PASS | This document |

## Test Output

```
 ✓ tests/auth/external-mappings.test.ts > Resolver Implementation > resolveExternalRoleToRoleCode function exists
 ✓ tests/auth/external-mappings.test.ts > Resolver Implementation > resolver returns role_code or deny result
 ✓ tests/auth/external-mappings.test.ts > Resolver Implementation > resolver is fail-closed on unknown systems
 ✓ tests/auth/external-mappings.test.ts > Resolver Implementation > resolver is fail-closed on unknown roles
 ✓ tests/auth/external-mappings.test.ts > Resolver Implementation > resolver logs deny reasons to audit log
 ✓ tests/auth/external-mappings.test.ts > Resolver Implementation > resolver logs allow decisions to audit log
 ✓ tests/auth/external-mappings.test.ts > Preview Endpoint > preview endpoint exists with POST method
 ✓ tests/auth/external-mappings.test.ts > Preview Endpoint > preview endpoint is capability-guarded
 ✓ tests/auth/external-mappings.test.ts > Preview Endpoint > preview endpoint validates inputs
 ✓ tests/auth/external-mappings.test.ts > Preview Endpoint > preview endpoint returns 404 for unmapped roles
 ✓ tests/auth/external-mappings.test.ts > No Silent Defaults > resolver never assigns default role on failure
 ✓ tests/auth/external-mappings.test.ts > No Silent Defaults > database has no catch-all external mappings
 ✓ tests/auth/external-mappings.test.ts > Supported External Systems > jobber system has valid mappings
 ✓ tests/auth/external-mappings.test.ts > Supported External Systems > cloudbeds system has valid mappings
 ✓ tests/auth/external-mappings.test.ts > Supported External Systems > robotics system exists
 ✓ tests/auth/external-mappings.test.ts > Audit Logging > external_role_mapping action type is logged
 ✓ tests/auth/external-mappings.test.ts > Audit Logging > logs include external_system in metadata
 ✓ tests/auth/external-mappings.test.ts > Audit Logging > logs include external_role_code in metadata
 ✓ tests/auth/jobber-mapping.test.ts > Jobber Role Mappings > should have all Jobber role mappings in cc_roles
 ✓ tests/auth/jobber-mapping.test.ts > Jobber Role Mappings > should map Jobber Admin to tenant_admin
 ✓ tests/auth/jobber-mapping.test.ts > Jobber Role Mappings > should map Jobber Manager to operations_supervisor
 ✓ tests/auth/jobber-mapping.test.ts > Jobber Role Mappings > should map Jobber Dispatcher to operations_full
 ✓ tests/auth/jobber-mapping.test.ts > Jobber Role Mappings > should map Jobber Worker to field_worker_full
 ✓ tests/auth/jobber-mapping.test.ts > Jobber Role Mappings > should map Jobber Limited Worker to field_worker_limited
 ✓ tests/auth/jobber-mapping.test.ts > Cloudbeds Role Mappings > should map Cloudbeds front_desk to reservation_manager
 ✓ tests/auth/jobber-mapping.test.ts > Robotics Role Mappings > should have machine_operator role for robotics
 ✓ tests/auth/jobber-mapping.test.ts > Robotics Role Mappings > should have machine_supervisor role for robotics
 ✓ tests/auth/jobber-mapping.test.ts > No Silent Defaults > should not have default fallback mappings
 ✓ tests/auth/jobber-mapping.test.ts > No Silent Defaults > external mappings should not include default assignment

Test Files  2 passed (2)
     Tests  29 passed (29)
```

## File/Line Evidence Index

| Description | File | Line |
|-------------|------|------|
| resolveExternalRoleToRoleCode function | server/auth/externalMappings.ts | 35 |
| Fail-closed on invalid system | server/auth/externalMappings.ts | 44-53 |
| Fail-closed on unknown role | server/auth/externalMappings.ts | 83-91 |
| logMappingDeny function | server/auth/externalMappings.ts | 168 |
| logMappingAllow function | server/auth/externalMappings.ts | 204 |
| Preview endpoint | server/routes/p2-platform.ts | 1337 |
| platform.configure guard | server/routes/p2-platform.ts | 35 |
| ExternalMappingPreview interface | server/auth/externalMappings.ts | 21 |
| Mapping tests (Jobber) | tests/auth/jobber-mapping.test.ts | 31 |
| Resolver tests | tests/auth/external-mappings.test.ts | 1 |

## External Role Mappings (LOCKED)

### Jobber
| External Role | Internal Role Code |
|---------------|-------------------|
| admin | tenant_admin |
| manager | operations_supervisor |
| dispatcher | operations_full |
| worker | field_worker_full |
| limited_worker | field_worker_limited |

### Cloudbeds
| External Role | Internal Role Code |
|---------------|-------------------|
| front_desk | reservation_manager |

### Robotics
| External Role | Internal Role Code |
|---------------|-------------------|
| (system mapped) | machine_operator |
| (system mapped) | machine_supervisor |

## Migrations

No new migrations required. External role mappings are stored in `cc_roles` table using:
- `external_system` column (e.g., 'jobber', 'cloudbeds', 'robotics')
- `external_role_code` column (e.g., 'admin', 'manager', 'worker')

Original migration: `server/db/migrations/0163_seed_auth_roles.sql`

## API Endpoints

### POST /api/p2/platform/external-mappings/preview
- **Guard**: platform.configure capability
- **Input**: `{ external_system, external_role_code }`
- **Output**: `{ ok, externalSystem, externalRoleCode, mappedRoleCode, mappedRoleName, capabilities[], generatedAt }`
- **Error**: Returns 404 with `ok: false` if unmapped

### GET /api/p2/platform/external-mappings/systems
- **Guard**: platform.configure capability
- **Output**: `{ ok, systems[], generatedAt }`

### GET /api/p2/platform/external-mappings/systems/:system
- **Guard**: platform.configure capability
- **Output**: `{ ok, system, mappings[], generatedAt }`

## Security Guarantees

1. **Fail-Closed**: Unmapped roles return `ok: false` with null roleCode - never a default
2. **No Silent Defaults**: Tested that no catch-all mappings exist in database
3. **Capability-Guarded**: All endpoints require `platform.configure`
4. **Auditable**: All allow/deny decisions logged to `cc_auth_audit_log`

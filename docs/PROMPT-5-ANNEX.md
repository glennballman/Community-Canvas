# PROMPT-5 ANNEX: UI Visibility Gating Implementation

**Status**: PASS  
**Completed**: 2026-01-28  
**Architect Review**: Pending

## 1. Executive Summary

PROMPT-5 implements client-side visibility gating for navigation, pages, and action buttons using capability-based authorization. This is **visibility-only** - all actual authorization enforcement occurs on the backend via PROMPT-3 (application-layer auth) and PROMPT-4 (route-level auth).

## 2. Deliverables

### 2.1 Core Files Created/Modified

| File | Type | Description |
|------|------|-------------|
| `client/src/auth/uiAuthorization.ts` | Created | Core `useCanUI()` hook and capability checking logic |
| `client/src/components/auth/NotAuthorized.tsx` | Created | Standard "access denied" display component |
| `client/src/components/auth/RequireCapability.tsx` | Created | Page-level visibility guard wrapper |
| `client/src/components/auth/GatedButton.tsx` | Created | Button-level visibility gating |
| `client/src/components/auth/index.ts` | Created | Export barrel for auth UI components |
| `client/src/layouts/PlatformLayout.tsx` | Modified | Uses `canUI('platform.configure')` for layout gate |
| `client/src/layouts/TenantAppLayout.tsx` | Modified | Passes `canUI` to navigation filter |
| `client/src/lib/routes/v3Nav.ts` | Modified | Added `requiredCapability` field to items/sections |
| `client/src/lib/routes/platformNav.ts` | Modified | Added capability requirements to platform nav |
| `client/src/pages/app/admin/AdminHomePage.tsx` | Modified | Wrapped with `RequireCapability` guard |

### 2.2 New Components

#### useCanUI() Hook
```typescript
import { useCanUI } from '@/auth/uiAuthorization';

const canUI = useCanUI();
if (canUI('platform.configure')) { /* show platform nav */ }
```

#### RequireCapability Wrapper
```typescript
import { RequireCapability } from '@/components/auth';

<RequireCapability capability="tenant.configure">
  <AdminPage />
</RequireCapability>
```

#### GatedButton
```typescript
import { GatedButton } from '@/components/auth';

<GatedButton capability="users.delete" onClick={handleDelete}>
  Delete User
</GatedButton>
```

## 3. Capability Mapping

### 3.1 Platform Capabilities
| Capability | Requirement |
|------------|-------------|
| `platform.configure` | isPlatformAdmin |
| `platform.manage_tenants` | isPlatformAdmin |
| `platform.manage_users` | isPlatformAdmin |
| `platform.impersonate` | isPlatformAdmin |
| `platform.analytics` | isPlatformAdmin |

### 3.2 Tenant Admin Capabilities
| Capability | Requirement |
|------------|-------------|
| `tenant.configure` | owner/admin/manager role |
| `roles.manage` | owner/admin/manager role |
| `settings.manage` | owner/admin/manager role |
| `portals.configure` | owner/admin/manager role |

### 3.3 Tenant Read Capabilities
| Capability | Requirement |
|------------|-------------|
| `tenant.read` | Any membership |
| `folios.read` | Any membership |
| `operations.read` | Any membership |
| `dashboard.read` | Any membership |

## 4. Constitution Compliance

### 4.1 AUTH_CONSTITUTION.md Alignment

| Invariant | Compliance | Evidence |
|-----------|------------|----------|
| §1 Single Identity Authority | PASS | `useCanUI()` uses AuthContext which derives from `/api/me/context` |
| §2 Unified Principals | PASS | No direct role string checks in UI gating |
| §4 Capability-first | PASS | All UI checks use capability codes, not role checks |
| §6 RLS Enforcement | N/A | UI-only, no data access |
| §8a Fail-closed | PASS | `canUI()` returns false on any uncertainty |
| §9 Impersonation | PASS | Uses `isPlatformAdmin` from AuthContext which reflects effective principal |

### 4.2 Prohibited Patterns Scan

```bash
# Scan for canUI gating mutations (FORBIDDEN)
grep -rn "if.*canUI.*{" client/src --include="*.tsx" -A2 | grep -E "(fetch|post|put|patch|delete|mutation)"
# Result: No matches found

# Scan for direct role string checks (FORBIDDEN)
grep -rn "role.*===.*'admin'" client/src/auth --include="*.ts"
# Result: No prohibited patterns
```

## 5. Navigation Updates

### 5.1 v3Nav.ts Sections Updated

| Section | Capability Gate |
|---------|-----------------|
| Admin | `tenant.configure` |
| Platform | `platform.configure` |

### 5.2 platformNav.ts Items Updated

| Item | Capability Gate |
|------|-----------------|
| All Tenants | `platform.manage_tenants` |
| All Users | `platform.manage_users` |
| Impersonation | `platform.impersonate` |
| Analytics | `platform.analytics` |
| System Explorer | `platform.configure` |

## 6. Page-Level Guards

### 6.1 Implementation Pattern

```typescript
// In page component
import { RequireCapability } from '@/components/auth';

export default function AdminPage() {
  return (
    <RequireCapability capability="tenant.configure">
      {/* Page content */}
    </RequireCapability>
  );
}
```

### 6.2 Pages Updated
- `AdminHomePage.tsx` - `tenant.configure`

## 7. Impersonation Integrity

**VERIFIED**: When impersonating, the `isPlatformAdmin` flag in AuthContext reflects the **effective principal's** permissions (from `/api/me/context`), not the original actor. This means:

1. Platform admin impersonating regular user → loses platform nav visibility
2. UI visibility matches actual backend enforcement
3. No privilege escalation possible

## 8. Testing Evidence

### 8.1 Build Status
- Vite build: PASS
- TypeScript compilation: PASS
- No runtime errors

### 8.2 Pattern Verification
- Prohibited patterns scan: PASS (0 violations)
- Capability naming consistency: PASS
- AUTH_CONSTITUTION compliance: PASS

## 9. Architectural Decision: Approximation Approach

### 9.1 Why Approximation?

Full capability evaluation is **server-side only**. The client does not have:
- Complete capability list per principal
- Scope hierarchy resolution
- Resource-level capability checks

Therefore, `canUI()` uses **best-effort approximation** based on available client context:
- `isPlatformAdmin` flag from `/api/me/context`
- Current tenant membership and role

### 9.2 Why This Is Acceptable

1. **UI gating is VISIBILITY-ONLY**, not authorization
2. **Backend always enforces** via `requireCapability()` (PROMPT-3/4)
3. **Users may see UI they can't use**, but can never bypass backend
4. **Fail-closed on uncertainty** - unknown capability returns false

### 9.3 Future Enhancement

When `/api/me/capabilities` endpoint is available:
1. Replace approximation with explicit capability list lookup
2. Prefetch capabilities on auth context load
3. canUI() becomes a simple `capabilities.includes(code)` check

## 10. Known Limitations

1. **UI-Only**: These checks are visibility hints only; backend always authorizes
2. **Approximation**: `canUI()` uses context approximation since full capability evaluation is server-side
3. **Not exhaustive**: Not all pages/buttons are gated yet; this establishes the pattern
4. **Legacy Fields**: Navigation still has tenantRolesAny/platformAdminOnly for backwards compatibility; requiredCapability takes precedence when set

## 11. Next Steps (Future Prompts)

1. Extend `RequireCapability` guards to remaining admin pages
2. Add `GatedButton` to CRUD action buttons throughout the app
3. Implement resource-scoped capability checks when backend supports it
4. Add capability prefetch from `/api/me/capabilities` endpoint

## 12. Verdict

**PASS** - PROMPT-5 successfully implements UI visibility gating with:
- Capability-based `canUI()` hook
- Navigation filtering with `requiredCapability` field
- Page-level `RequireCapability` guards
- Button-level `GatedButton` component
- AUTH_CONSTITUTION.md compliance verified
- No prohibited patterns detected
- Impersonation integrity maintained

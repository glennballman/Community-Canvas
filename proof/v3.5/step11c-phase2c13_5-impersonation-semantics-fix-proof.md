# STEP 11C Phase 2C-13.5: Impersonation Semantics Fix

**Date**: 2026-01-25  
**Status**: COMPLETE

## Problem Statement

Current implementation "Impersonate user" was auto-selecting a tenant when the user had exactly one membership. This violated V3.5 semantics.

## Required Invariants (now enforced)

A) Impersonation has TWO independent dimensions:
   1) `acting_user` (impersonated user identity)
   2) `tenant_context` (selected tenant for operations)

B) "Impersonate Mathew" must ONLY set `acting_user = Mathew`. It MUST NOT set `tenant_context` automatically.

C) If `tenant_context` is null:
   - Tenant nav must not render tenant-scoped sections
   - Tenant-only API calls must not execute
   - UI must show a deterministic "Select tenant to continue" affordance

D) Tenant selection must be explicit via tenant switcher or modal/page shown after impersonation start.

## Implementation Summary

### Server Changes

#### 1. Removed Auto-Selection (admin-impersonation.ts)

**Before:**
```typescript
} else if (memberships.length === 1) {
  selectedTenant = memberships[0];  // Auto-select!
}
```

**After:**
```typescript
// If no tenant_id provided, selectedTenant remains NULL
// This is the correct behavior - tenant must be explicitly chosen
```

#### 2. New Endpoint: POST /api/admin/impersonation/set-tenant

```typescript
router.post('/set-tenant', async (req, res) => {
  const { tenant_id } = req.body;
  
  // Requires active impersonation session
  // Verifies impersonated user has membership in tenant
  // Sets tenant_id in session
  
  res.json({ ok: true, tenant: { id, name, slug, role } });
});
```

#### 3. Status Response Includes Memberships

The `/status` endpoint now returns the impersonated user's memberships for the tenant selection UI:

```json
{
  "ok": true,
  "is_impersonating": true,
  "impersonated_user_id": "...",
  "memberships": [
    { "tenant_id": "...", "tenant_name": "...", "tenant_slug": "...", "role": "..." }
  ],
  "expires_at": "..."
}
```

### Client Changes

#### 1. SelectTenantPage (/app/select-tenant)

New page at `client/src/pages/app/SelectTenantPage.tsx`:
- Displays impersonated user's tenant memberships
- Allows explicit tenant selection via set-tenant endpoint
- Provides "Cancel" option to end impersonation

#### 2. AppRouterSwitch Updates

```typescript
// Case A: Impersonating with no tenant selected - need to pick one
if (impersonation.active && !hasTenant && !isSelectTenantPath) {
  navigate('/app/select-tenant', { replace: true });
  return;
}

// Case B: Impersonating with tenant on platform path - redirect to tenant app
if (impersonation.active && hasTenant && isPlatformPath) {
  navigate('/app', { replace: true });
}
```

#### 3. ImpersonationBanner Updates

Now shows tenant status including null case:
```typescript
{tenant ? (
  <span>Tenant: {tenant.slug || tenant.name}</span>
) : (
  <span style={{ fontStyle: 'italic' }}>Tenant: (none selected)</span>
)}
```

#### 4. ImpersonationConsole Updates

After starting impersonation, navigates to:
- `/app` if tenant was explicitly specified
- `/app/select-tenant` if no tenant specified (new default)

### Route Structure

```
/app
├── /select-tenant          <- NEW: Tenant selection page (impersonation only)
├── /platform/*             <- Platform admin routes
├── /founder/*              <- Founder routes  
└── /* (default)            <- Tenant app routes
```

## Files Changed

### Created
- `client/src/pages/app/SelectTenantPage.tsx`

### Modified
- `server/routes/admin-impersonation.ts` - Removed auto-selection, added set-tenant endpoint
- `client/src/components/routing/AppRouterSwitch.tsx` - Handle null tenant case
- `client/src/components/ImpersonationBanner.tsx` - Show "(none selected)" for null tenant
- `client/src/pages/app/platform/ImpersonationConsole.tsx` - Navigate correctly after start
- `client/src/App.tsx` - Added /app/select-tenant route

## Verification Flow

1. Platform admin clicks "Impersonate" on a user
2. Server starts impersonation with `tenant_id: null`
3. Client refreshes session, sees `impersonation.active=true` but `impersonation.tenant=null`
4. AppRouterSwitch redirects to `/app/select-tenant`
5. User sees list of impersonated user's tenant memberships
6. User clicks on a tenant
7. Client calls POST /api/admin/impersonation/set-tenant
8. Client refreshes session, sees `impersonation.tenant` populated
9. User is redirected to `/app` (tenant shell)

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Impersonation start does NOT auto-set tenant | ✅ |
| New /api/admin/impersonation/set-tenant endpoint | ✅ |
| /app/select-tenant page shows when impersonating with null tenant | ✅ |
| ImpersonationBanner shows "(none selected)" when tenant is null | ✅ |
| No tenant-guessing heuristics | ✅ |
| Consistent routing (react-router-dom throughout /app) | ✅ |
| Platform admin status preserved during impersonation | ✅ |

## Technical Notes

### Authentication During Impersonation
- JWT token contains the REAL user's identity and platform admin status
- Impersonation data is stored in the session, separate from JWT auth
- `requirePlatformAdmin` middleware checks `req.user.isPlatformAdmin` from JWT
- This ensures impersonation endpoints remain accessible to platform admins even during impersonation

### Routing Consistency
All impersonation-related components now use react-router-dom consistently:
- SelectTenantPage
- ImpersonationBanner  
- ImpersonationConsole
- AppRouterSwitch

This matches the App.tsx BrowserRouter for consistent navigation behavior.

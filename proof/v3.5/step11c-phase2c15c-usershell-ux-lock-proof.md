# Phase 2C-15C: UserShell UX Lock + No Forced Tenant Gate

**Date**: January 26, 2026  
**Author**: Platform Engineer  
**Status**: COMPLETE

---

## Summary

This phase locks the UX contract for impersonation: when impersonating a user with `tenant_context=NULL`, the app behaves like "logged in as that user" (UserShell), NOT a forced "Select Tenant" gate.

## UX Contract (LOCKED)

| Scenario | Expected Behavior | Implementation |
|----------|------------------|----------------|
| Impersonated user with memberships, tenant=NULL | /app renders UserShellLayout with "Choose a Place" panel | ✅ AppRouterSwitch branches to UserShellLayout |
| Impersonated user with NO memberships, tenant=NULL | UserShellLayout shows empty state: "No places available" | ✅ UserShellLayout handles this |
| Impersonated user with tenant=selected | TenantAppLayout with impersonation banner + "Back to User Home" | ✅ Implemented |
| No impersonation, regular user | Normal dashboard/home | ✅ Unchanged |

---

## Changes Made

### 1. ImpersonationConsole.tsx - Navigate to /app

**Before:**
```typescript
if (tenantId) {
  navigate('/app');
} else {
  navigate('/app/select-tenant');  // FORCED
}
```

**After:**
```typescript
// Phase 2C-15C: Always navigate to /app, never force /app/select-tenant
// AppRouterSwitch will render UserShellLayout if no tenant is set
navigate('/app');
```

### 2. Server: /api/admin/impersonation/set-tenant - Supports tenant_id=null

**Before:** Required `tenant_id`, returned 400 if null.

**After:**
```typescript
// Phase 2C-15C: If tenant_id is null/undefined, clear tenant context
if (!tenant_id) {
  session.impersonation = {
    ...session.impersonation,
    tenant_id: null,
    tenant_name: null,
    tenant_slug: null,
    tenant_role: null,
  };
  session.current_tenant_id = null;
  session.roles = [];
  return res.json({ ok: true, tenant: null, message: 'Tenant context cleared' });
}
```

### 3. TenantAppLayout.tsx - Impersonation Banner with "Back to User Home"

**Added:**
- Orange impersonation banner when `impersonation.active && currentTenant`
- Shows: "Impersonating {user} in {tenant}"
- "Back to User Home" button that clears tenant context and navigates to /app
- `handleBackToUserHome()` function that calls `/api/admin/impersonation/set-tenant` with `tenant_id: null`

**Fixed:**
- Changed `impersonation.is_impersonating` to `impersonation.active` (3 instances)

### 4. SelectTenantPage.tsx - Documented as Optional

Header updated to clarify:
- This page is OPTIONAL - never forced by router
- Access: Only via direct navigation or "Change Place" links
- NOT automatically shown - UserShellLayout is shown instead at /app

---

## Routing Rules (VERIFIED)

| Rule | Status |
|------|--------|
| /app is stable landing page in all cases | ✅ |
| /app/select-tenant is NEVER an automatic redirect target | ✅ |
| All automatic redirects that force tenant selection removed | ✅ |
| /app/select-tenant only appears via manual navigation | ✅ |

---

## Acceptance Criteria Checklist

| Criterion | Status |
|-----------|--------|
| Glenn platform admin clicks "Impersonate Mathew" → Lands on /app showing UserShell home with Mathew's memberships | ✅ |
| No automatic redirect to /app/select-tenant | ✅ |
| Clicking "Enter" for Woods End Landing sets tenant context and shows Mathew's tenant navigation | ✅ |
| "Back to User Home" clears tenant context but stays impersonating Mathew and returns to UserShell | ✅ |
| Logout works from any state | ✅ |

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `client/src/pages/app/platform/ImpersonationConsole.tsx` | Modified | Always navigate to /app after impersonation start |
| `server/routes/admin-impersonation.ts` | Modified | Support tenant_id=null to clear tenant context |
| `client/src/layouts/TenantAppLayout.tsx` | Modified | Added impersonation banner with "Back to User Home" button; fixed is_impersonating → active |
| `client/src/pages/app/SelectTenantPage.tsx` | Modified | Documented as optional deep-link |

---

## Test Scenarios

1. **Impersonate user with memberships, no tenant specified**
   - Navigate to /app/platform/impersonation
   - Search for and select a user (e.g., Mathew)
   - Click "Impersonate"
   - VERIFY: Lands on /app, showing UserShellLayout with membership list

2. **Enter a tenant from UserShell**
   - From UserShell, click "Enter" on a membership
   - VERIFY: TenantAppLayout appears with impersonation banner

3. **Back to User Home**
   - From TenantAppLayout impersonation banner, click "Back to User Home"
   - VERIFY: Returns to UserShellLayout, impersonation still active

4. **Logout during impersonation**
   - Click Sign Out
   - VERIFY: Session ends, redirected to login

---

## Architecture Invariants Preserved

- Two-dimensional impersonation model: acting_user + tenant_context remain independent
- Tenant selection is a user action, not a router mandate
- UserShellLayout is the home for impersonated users without tenant
- No forced redirects to /app/select-tenant

---

## Proof Complete

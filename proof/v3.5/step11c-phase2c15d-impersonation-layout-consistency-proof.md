# Phase 2C-15D: Impersonation UI Consistency Hardening

**Date**: January 26, 2026  
**Author**: Platform Engineer  
**Status**: COMPLETE

---

## Problem Statement

The UI was showing TenantAppLayout nav + "in <tenant>" banner while `tenant_context` was NULL. This violated the UX contract and created state ambiguity.

## Goal

When `impersonation.active && tenant_context is NULL`:
- ONLY UserShellLayout mounts (chrome + content)
- TenantAppLayout must NOT mount (no tenant nav/modules)
- Banner must never mention any tenant name

---

## Acceptance Invariants

### INVARIANT 1: tenant_context == null

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| No tenant name appears anywhere in header/banner | PASS | Banner only renders when `impersonation.active && currentTenant` |
| Role badge only shows if derived from selected membership (but there is none yet) | PASS | UserShellLayout shows impersonation badge without role |
| Left nav does NOT include Operations/Reservations modules | PASS | TenantAppLayout is unreachable - UserShellLayout renders instead |
| URL may be /app or /app/places — but layout must be UserShellLayout | PASS | AppRouterSwitch intercepts ALL /app/* routes when impersonating without tenant |

### INVARIANT 2: tenant_context != null

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| TenantAppLayout mounts | PASS | Outlet renders TenantAppLayout when tenant is set |
| Tenant nav/modules appear normally | PASS | V3_NAV filters based on hasTenant |
| Banner shows: "Impersonating X in <tenant>" | PASS | Banner at line 814-850 in TenantAppLayout |
| "Back to User Home" clears tenant_context and returns to UserShellLayout | PASS | handleBackToUserHome() calls set-tenant with null |

---

## Routing Branch Logic

### AppRouterSwitch.tsx (Lines 106-121)

```typescript
// Phase 2C-15D: Routes that keep their specialized layouts even during impersonation
const isPlatformPath = location.pathname.startsWith('/app/platform');
const isFounderPath = location.pathname.startsWith('/app/founder');
const isSelectTenantPath = location.pathname.startsWith('/app/select-tenant');

// Phase 2C-15D: INVARIANT - When impersonating without tenant:
// - UserShellLayout renders for ALL /app/* routes (except platform/founder/select-tenant)
// - TenantAppLayout must NOT render (no tenant nav/modules)
// - /app/places now also uses UserShellLayout during impersonation without tenant
const shouldShowUserShell = 
  impersonation.active && 
  !currentTenant &&
  !isPlatformPath &&
  !isFounderPath &&
  !isSelectTenantPath;

if (shouldShowUserShell) {
  return <UserShellLayout />;
}
```

**Key Change**: Removed `!isPlacesPath` from the condition. Now `/app/places` also shows UserShellLayout when impersonating without tenant.

---

## Banner Truth Source

### TenantAppLayout.tsx (Lines 814-850)

```typescript
{impersonation.active && currentTenant && (
  <div data-testid="banner-impersonation">
    <span>
      Impersonating <strong>{impersonation.target_user?.display_name}</strong> 
      {' '} in <strong>{currentTenant.tenant_name}</strong>
    </span>
    <button onClick={handleBackToUserHome}>
      Back to User Home
    </button>
  </div>
)}
```

**Truth Source**: Tenant name is ONLY derived from `currentTenant.tenant_name`, never from:
- First membership
- Last tenant
- Cached value

---

## Clear-Tenant Endpoint (Server)

### server/routes/admin-impersonation.ts (Lines 278-323)

```typescript
router.post('/set-tenant', async (req, res) => {
  const { tenant_id } = req.body;
  
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
});
```

### Whoami Endpoint Response (foundation.ts Lines 215-236)

```typescript
impersonation: isImpersonating ? {
  active: true,
  target_user: { ... },
  tenant: impersonation.tenant_id ? {
    id: impersonation.tenant_id,
    name: impersonation.tenant_name
  } : null,  // Returns null when cleared
  role: impersonation.tenant_role || null,
} : { active: false, ... }
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `client/src/components/routing/AppRouterSwitch.tsx` | Modified | Removed `!isPlacesPath` exception - UserShellLayout now renders for ALL /app/* routes when impersonating without tenant |
| `client/src/layouts/TenantAppLayout.tsx` | Modified | Added Phase 2C-15D invariant warning in dev mode; updated header comment |

---

## Dev Mode Invariant Guard

### TenantAppLayout.tsx (Lines 176-186)

```typescript
// Phase 2C-15D INVARIANT: TenantAppLayout should NOT be reached when
// impersonating without tenant. AppRouterSwitch should intercept this case.
if (import.meta.env.DEV && impersonation.active && !currentTenant && !isNoTenantRoute && !isAtRoot) {
  console.warn(
    '[TenantAppLayout] INVARIANT VIOLATION: Reached TenantAppLayout while impersonating without tenant.',
    { pathname: location.pathname, impersonation: !!impersonation.active, currentTenant: !!currentTenant }
  );
}
```

---

## Test Scenarios

### Test 1: Impersonation active + tenant null → TenantAppLayout not rendered
- Navigate to /app/platform/impersonation
- Impersonate a user
- VERIFY: URL is /app, UserShellLayout is visible
- VERIFY: No "Operations Board" or tenant nav items visible

### Test 2: Impersonation active + tenant null → banner does NOT contain tenant name
- While impersonating without tenant selected
- VERIFY: Header shows "Impersonating: {username}" (no "in {tenant}")

### Test 3: After set-tenant null → banner updates and nav switches to UserShell
- From TenantAppLayout, click "Back to User Home"
- VERIFY: URL is /app, UserShellLayout renders
- VERIFY: Impersonation still active (badge visible)

### Test 4: After selecting tenant → TenantAppLayout rendered and banner includes tenant name
- From UserShellLayout, click "Enter" on a tenant
- VERIFY: TenantAppLayout renders with sidebar
- VERIFY: Banner shows "Impersonating {user} in {tenant}"

---

## Invariant Checklist

| Check | Result |
|-------|--------|
| AppRouterSwitch intercepts impersonation+no-tenant | PASS |
| UserShellLayout renders for /app when impersonating without tenant | PASS |
| UserShellLayout renders for /app/places when impersonating without tenant | PASS |
| TenantAppLayout only reachable when tenant is set | PASS |
| Banner only shows tenant name when currentTenant exists | PASS |
| set-tenant null clears all tenant fields in session | PASS |
| whoami returns tenant: null after clearing | PASS |
| Dev mode warning if TenantAppLayout reached incorrectly | PASS |

---

## Proof Complete

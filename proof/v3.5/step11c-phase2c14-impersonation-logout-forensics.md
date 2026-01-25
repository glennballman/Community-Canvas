# Phase 2C-14: Impersonation + Logout Forensic Audit

**Date**: January 25, 2026  
**Author**: Platform Engineer  
**Status**: FORENSIC ANALYSIS COMPLETE

---

## EXECUTIVE SUMMARY

This audit identifies critical inconsistencies in logout paths and routing precedence that cause authentication confusion and broken logout flows.

---

## 1. Auth/Identity Endpoints Used by Client

### 1.1 Logout Endpoints

| File | Method | Endpoint | Status |
|------|--------|----------|--------|
| `client/src/contexts/AuthContext.tsx:211` | POST | `/api/foundation/auth/logout` | **VALID** - Foundation router handles this |
| `client/src/layouts/PlatformLayout.tsx:80` | GET (href) | `/api/logout` | **BROKEN** - Route does NOT exist |
| `client/src/layouts/FounderLayout.tsx:65` | GET (href) | `/api/logout` | **BROKEN** - Route does NOT exist |

**Root Cause**: PlatformLayout and FounderLayout use `window.location.href = '/api/logout'` which is a non-existent route. The valid auth routes are:
- `/api/foundation/auth/logout` (POST) - foundation.ts
- `/api/auth/logout` (GET/POST) - auth.ts

### 1.2 Identity Endpoints

| File | Method | Endpoint | Purpose | Token Storage |
|------|--------|----------|---------|---------------|
| `AuthContext.tsx:97` | GET | `/api/foundation/auth/whoami` | Session/impersonation check | `localStorage.cc_token` |
| `AuthContext.tsx:143` | GET | `/api/foundation/auth/me` | User + tenants list | `localStorage.cc_token` |
| `AuthContext.tsx:185` | POST | `/api/foundation/auth/login` | Authenticate user | Sets `localStorage.cc_token` |
| `TenantContext.tsx:172` | GET | `/api/me/context` | Full user context + memberships | `localStorage.cc_token` |

### 1.3 Impersonation Endpoints

| File | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| `ImpersonationConsole.tsx:99` | GET | `/api/admin/impersonation/status` | Check current impersonation |
| `ImpersonationConsole.tsx:128` | GET | `/api/admin/impersonation/users?query=X` | Search users to impersonate |
| `ImpersonationConsole.tsx:166` | POST | `/api/admin/impersonation/start` | Start impersonating a user |
| `ImpersonationConsole.tsx:213` | POST | `/api/admin/impersonation/stop` | End impersonation |
| `SelectTenantPage.tsx:73` | POST | `/api/admin/impersonation/set-tenant` | Set tenant context during impersonation |
| `ImpersonationBanner.tsx:79` | POST | `/api/admin/impersonation/stop` | End impersonation (banner button) |
| `TenantContext.tsx:293` | POST | `/api/admin/impersonation/start` | Start impersonation |
| `TenantContext.tsx:325` | POST | `/api/admin/impersonation/stop` | Stop impersonation |

### 1.4 Token/Cookie Management

| Store | Key | Purpose | Cleared By |
|-------|-----|---------|------------|
| localStorage | `cc_token` | JWT auth token | `AuthContext.logout()` |
| localStorage | `cc_view_mode` | UI view mode preference | Never (persists) |
| Cookie | `tenant_sid` | Session ID (tenant routes) | Server on logout |
| Cookie | `platform_sid` | Session ID (/api/internal only) | Server on logout |

---

## 2. Routing Decisions & Competing Redirectors

### 2.1 Route Decision Flow

```
Client Navigation
       │
       ▼
┌─────────────────────┐
│  AppRouterSwitch    │ ◄── SINGLE SOURCE OF TRUTH for /app/* routing
│  (centralized)      │
└─────────────────────┘
       │
       ▼ (based on authReady, impersonation.active, pathname)
       │
       ├── Case A: impersonation.active && !tenant → /app/select-tenant
       ├── Case B: impersonation.active && hasTenant && /app/platform/* → /app
       └── Case C: Normal routing → Outlet (child routes)
              │
              ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  PlatformLayout     │  OR │  TenantAppLayout    │  OR │  FounderLayout      │
│  /app/platform/*    │     │  /app/*             │     │  /app/founder/*     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### 2.2 Who Decides "Platform vs Tenant vs Impersonating"?

**Primary Decision Maker**: `AppRouterSwitch.tsx` (lines 52-94)
- Waits for `authReady = true` before making decisions
- Uses `impersonation.active` and `impersonation.tenant` to determine routing

**Secondary Decision Maker (Guard)**: Each layout has its own guard:
- `PlatformLayout.tsx:74-77`: Checks `user.is_platform_admin`, redirects non-admins to `/app`
- `TenantAppLayout.tsx:126-129`: Checks authentication, redirects to `/login`

### 2.3 Conditions Causing /app/platform to Render During Impersonation

**Identified Issue**: The redirect logic in `AppRouterSwitch` only fires ONCE due to the `hasRedirectedRef` latch:

```typescript
// Line 73-82
if (impersonation.active && !hasTenant && !isSelectTenantPath && !hasRedirectedRef.current) {
  hasRedirectedRef.current = true;  // Latch prevents future redirects
  navigate('/app/select-tenant', { replace: true });
}
```

**Problem**: If a user manually navigates to `/app/platform` AFTER the latch has been set (e.g., via browser back button or URL bar), the redirect won't fire again.

**The latch is reset** when `impersonation.active` changes (line 39-41), but NOT when the user navigates.

### 2.4 Infinite Redirect / URL Flashing Source

**Cause 1**: Multiple competing redirect sources
- `AppRouterSwitch` redirects based on impersonation
- `PlatformLayout` redirects non-admins to `/app`
- `TenantAppLayout` redirects users without tenants to `/app/places`

**Cause 2**: Auth state race condition
- `authReady` becomes true AFTER initial render
- Layouts render loading state, then re-render with redirect logic
- Multiple `useEffect` hooks can fire in sequence

**Cause 3**: No coordination between redirect decisions
- Each layout independently decides to redirect
- No shared state tracking "redirect already in progress"

### 2.5 "Your Places" Entry on Platform Home Panel

**Location**: `client/src/lib/routes/platformNav.ts:51`

```typescript
{ icon: Map, label: 'Your Places', href: '/app/places', testId: 'nav-places-picker', requiresTenantMemberships: true },
```

**Problem**: "Your Places" links to `/app/places` which is NOT a platform route.
- Platform routes are under `/app/platform/*`
- `/app/places` is handled by `TenantAppLayout`
- This causes layout switching when clicking the nav item

**Impact for Glenn (platform-only admin)**:
- Glenn has NO tenant memberships (`hasTenantMemberships = false`)
- The filter in `getPlatformNavSections()` correctly hides this item
- BUT if Glenn somehow sees this link, clicking it would switch layouts unexpectedly

**Verdict**: The `requiresTenantMemberships: true` filter prevents Glenn from seeing it, so this is NOT the cause of confusion. The filter works correctly.

---

## 3. Glenn Canonical User Reproduction

### 3.1 Test Steps

1. Login as Glenn (platform admin)
2. Navigate to `/app/platform/impersonation`
3. Start impersonation of Mathew (user-only)
4. Observe behavior

### 3.2 Expected Behavior

| Step | Expected |
|------|----------|
| After impersonation start | Redirect to `/app/select-tenant` (no tenant selected) |
| Select Mathew's tenant | Redirect to `/app` (tenant app) |
| Platform sidebar | NOT visible (impersonating) |
| Nav matches Mathew | Yes - should show V3_NAV filtered by Mathew's role |
| Impersonation banner | Visible with Mathew's info + tenant |

### 3.3 Observed Behavior (from browser logs)

From logs, we see the following flow:
```
[AppRouterSwitch] Guard eval: {pathname: "/app", authReady: false, impersonationActive: false, navMode: "tenant"}
[AuthContext] refreshSession: complete {impersonationActive: true, durationMs: 112}
[TenantAppLayout] Guard eval: {pathname: "/app", authReady: true, impersonationActive: true, navMode: "impersonating", hasTenant: true}
[PlatformLayout] Guard eval: {pathname: "/app/platform", authReady: true, impersonationActive: true, navMode: "impersonating"}
[AppRouterSwitch] Redirect fired: {from: "/app/platform", to: "/app", reason: "impersonation active on platform path"}
```

**Observation**: The existing impersonation session (from Phase 2C-13.5) has a tenant already set. NEW impersonation sessions should start with null tenant per the fix.

---

## 4. Critical Issues Identified

### ISSUE #1: Broken Logout Routes (CRITICAL)

**Location**: 
- `PlatformLayout.tsx:80`: `window.location.href = '/api/logout'`
- `FounderLayout.tsx:65`: `window.location.href = '/api/logout'`

**Problem**: `/api/logout` does not exist. Valid routes are:
- `/api/foundation/auth/logout` (POST)
- `/api/auth/logout` (GET/POST)

**Fix Required**: Update layouts to use correct logout endpoint

### ISSUE #2: Redirect Latch Prevents Re-Redirect

**Location**: `AppRouterSwitch.tsx:36`

**Problem**: The `hasRedirectedRef` latch prevents subsequent redirects even when user manually navigates to wrong path.

**Fix Required**: Consider resetting latch on pathname change, OR use a different mechanism

### ISSUE #3: Inconsistent Logout Mechanism

**Location**: `AuthContext.tsx:207-230` vs `PlatformLayout.tsx:80`

**Problem**: 
- `AuthContext.logout()` properly clears localStorage, state, and calls server
- `PlatformLayout` uses `window.location.href` which bypasses client state cleanup

**Fix Required**: All layouts should call `AuthContext.logout()` instead of using direct navigation

---

## 5. Recommended Fixes

### Fix 1: Standardize Logout to Use AuthContext

All layouts should use the `logout` function from `AuthContext`:

```typescript
// In layout components
const { logout } = useAuth();

const handleLogout = async () => {
  await logout();
  window.location.href = '/login';
};
```

### Fix 2: Add Fallback /api/logout Route

Add a GET handler at `/api/logout` that redirects to `/login` after clearing session:

```typescript
// In server/routes.ts or appropriate location
app.get('/api/logout', (req, res) => {
  req.session?.destroy(() => {
    res.redirect('/login');
  });
});
```

### Fix 3: Remove Redirect Latch or Improve Logic

Either:
1. Reset latch on `location.pathname` change
2. OR use a URL-based check instead of latch (idempotent)

---

## 6. Server Route Mounting Reference

| Mount Path | Router | Key Endpoints |
|------------|--------|---------------|
| `/api/auth` | `authRouter` | `/login`, `/logout`, `/whoami`, `/register` |
| `/api/foundation` | `foundationRouter` | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/whoami` |
| `/api/admin/impersonation` | `adminImpersonationRouter` | `/start`, `/stop`, `/status`, `/set-tenant`, `/users` |
| `/api/me` | `meRouter` | `/context`, `/portal-preference` |
| `/api/auth-accounts` | `authAccountsRouter` | `/logout`, `/logout-all` |

---

## 7. Invariant Verification Checklist

| Invariant | Status |
|-----------|--------|
| Glenn never in cc_tenant_users | ✅ Enforced by DB trigger |
| Impersonation two dimensions (acting_user, acting_tenant) | ✅ Implemented in Phase 2C-13.5 |
| Impersonation does NOT auto-pick tenant | ✅ Fixed in Phase 2C-13.5 |
| Impersonation active → platform UI not rendered | ⚠️ PARTIAL - Redirect works but latch can interfere |
| Logout always works | ❌ BROKEN - `/api/logout` doesn't exist |

---

## 8. Files Changed Summary

This is a forensic audit - no files changed. Recommended changes in Section 5.

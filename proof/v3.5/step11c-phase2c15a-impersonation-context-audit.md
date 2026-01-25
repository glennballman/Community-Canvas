# Phase 2C-15A: Impersonation & Context Audit

**Date**: January 25, 2026  
**Author**: Platform Engineer  
**Status**: AUDIT COMPLETE (No Behavior Changes)

---

## A) Auth + Context Model Inventory

### A.1 AuthContext State Shape (`client/src/contexts/AuthContext.tsx`)

```typescript
interface User {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    isPlatformAdmin: boolean;
}

interface CCTenant {
    id: string;
    name: string;
    slug: string;
    type: string;
    role: string;
}

interface ImpersonationState {
    active: boolean;
    target_user: {
        id: string;
        email: string;
        display_name: string;
    } | null;
    tenant: {
        id: string;
        slug: string | null;
        name: string;
    } | null;
    role: string | null;
    expires_at: string | null;
}

type NavMode = 'platform_only' | 'tenant' | 'impersonating';

interface AuthContextType {
    user: User | null;
    ccTenants: CCTenant[];
    token: string | null;
    loading: boolean;
    ready: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<boolean>;
    isAuthenticated: boolean;
    isPlatformAdmin: boolean;
    impersonation: ImpersonationState;
    navMode: NavMode;
    hasTenantMemberships: boolean;
}
```

**Key Fields:**
- `user`: Real authenticated user (JWT subject)
- `impersonation.active`: Whether impersonating
- `impersonation.target_user`: The impersonated user identity
- `impersonation.tenant`: Selected tenant context (CAN BE NULL)
- `hasTenantMemberships`: Based on `ccTenants.length > 0`
- `navMode`: Computed from impersonation state and membership count

### A.2 TenantContext State Shape (`client/src/contexts/TenantContext.tsx`)

```typescript
interface User {
  id: string;
  email: string;
  full_name?: string;
  is_platform_admin: boolean;
}

interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_type: 'community' | 'business' | 'government' | 'individual';
  role: string;
  is_primary: boolean;
}

interface ImpersonationState {
  is_impersonating: boolean;
  tenant_id?: string;
  tenant_name?: string;
  tenant_type?: string;
  tenant_role?: string;
  portal_slug?: string;
  expires_at?: string;
}

interface TenantContextValue {
  user: User | null;
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  impersonation: ImpersonationState;
  loading: boolean;
  initialized: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  clearTenant: () => void;
  refreshContext: () => Promise<void>;
  startImpersonation: (tenantId: string, reason?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}
```

**Key Differences from AuthContext:**
- `memberships`: From `/api/me/context`, not JWT
- `currentTenant`: Synthesized from `currentTenantId` + memberships
- `impersonation`: Different shape (uses `is_impersonating` vs `active`)
- **ISSUE**: Impersonation state is duplicated and shaped differently

### A.3 AppRouterSwitch Decision Tree (`client/src/components/routing/AppRouterSwitch.tsx`)

```
if (!authReady) → Show loading spinner

if (impersonation.active && !impersonation.tenant && !isSelectTenantPath) 
  → Redirect to /app/select-tenant

if (impersonation.active && impersonation.tenant && isPlatformPath)
  → Redirect to /app

else → Render Outlet (child routes)
```

**Layout Selection (happens in route config, not AppRouterSwitch):**
- `/app/platform/*` → PlatformLayout
- `/app/founder/*` → FounderLayout  
- `/app/*` (other) → TenantAppLayout

### A.4 ImpersonationBanner Data Source (`client/src/components/ImpersonationBanner.tsx`)

**Data Source:** `useAuth()` → `impersonation`

**Render Rules:**
- Renders only when `impersonation.active === true`
- Shows `target_user.display_name || target_user.email`
- Shows `tenant.slug || tenant.name` (or "(none selected)" if null)
- Shows `role` as badge
- Shows countdown timer based on `expires_at`

### A.5 Tenant Selection Logic

**Route:** `/app/select-tenant` → `SelectTenantPage.tsx`

**How Reached:**
- AppRouterSwitch redirects here when `impersonation.active && !impersonation.tenant`
- Page checks `!impersonation.active` → navigates to `/app/platform`
- Page checks `impersonation.tenant` already set → navigates to `/app`

**Logic:**
1. Fetches memberships from `/api/admin/impersonation/status`
2. Displays list of tenants user can access
3. On select, calls `/api/admin/impersonation/set-tenant`
4. On success, refreshes session and navigates to `/app`

---

## B) API Endpoint Mapping

### B.1 `/api/foundation/auth/whoami`

**Location:** `server/routes/foundation.ts:189`

| Property | Value |
|----------|-------|
| Auth Required | Yes (JWT) |
| Tenant Required | No |
| Role Required | None |
| Returns Impersonation | Yes |
| Returns Memberships | No |

**Response Shape:**
```json
{
  "ok": true,
  "user": {
    "id": "...",
    "email": "...",
    "displayName": "...",
    "isPlatformAdmin": true/false
  },
  "impersonation": {
    "active": true/false,
    "target_user": { "id", "email", "display_name" } | null,
    "tenant": { "id", "slug", "name" } | null,
    "role": "string" | null,
    "expires_at": "ISO date" | null
  }
}
```

### B.2 `/api/me/context`

**Location:** `server/routes/user-context.ts:16`

| Property | Value |
|----------|-------|
| Auth Required | Yes (JWT) |
| Tenant Required | No |
| Role Required | None |
| Returns Impersonation | Yes (different shape) |
| Returns Memberships | Yes |

**Response Shape:**
```json
{
  "user": {
    "id": "...",
    "email": "...",
    "full_name": "...",
    "is_platform_admin": true/false
  },
  "memberships": [
    { "tenant_id", "tenant_name", "tenant_slug", "tenant_type", "role", "is_primary" }
  ],
  "current_tenant_id": "uuid" | null,
  "current_portal": { "id", "name", "slug" } | null,
  "is_impersonating": true/false,
  "impersonated_tenant": { "id", "name", "type", "portal_slug", "role" } | null,
  "impersonation_expires_at": "ISO date" | null
}
```

**ISSUE:** `/api/me/context` returns memberships for the REAL user, not the impersonated user.

### B.3 `/api/admin/impersonation/start`

**Location:** `server/routes/admin-impersonation.ts:111`

| Property | Value |
|----------|-------|
| Auth Required | Yes (JWT) |
| Tenant Required | No |
| Role Required | Platform Admin |
| Returns Impersonation | Yes |
| Returns Memberships | Yes (of impersonated user) |

**Request Body:**
```json
{
  "user_id": "uuid (required)",
  "tenant_id": "uuid (optional)",
  "reason": "string (optional)"
}
```

**Response Shape:**
```json
{
  "ok": true,
  "impersonating": {
    "user_id": "...",
    "user_email": "...",
    "user_name": "...",
    "tenant_id": "..." | null,
    "tenant_name": "..." | null,
    "role": "..." | null
  },
  "memberships": [
    { "tenant_id", "tenant_name", "tenant_slug", "role" }
  ],
  "expires_at": "ISO date"
}
```

### B.4 `/api/admin/impersonation/stop`

**Location:** `server/routes/admin-impersonation.ts:351`

| Property | Value |
|----------|-------|
| Auth Required | Yes (JWT) |
| Tenant Required | No |
| Role Required | Platform Admin |

**Response:** `{ "ok": true }`

### B.5 `/api/admin/impersonation/status`

**Location:** `server/routes/admin-impersonation.ts:395`

| Property | Value |
|----------|-------|
| Auth Required | Yes (JWT) |
| Tenant Required | No |
| Role Required | Platform Admin |
| Returns Impersonation | Yes |
| Returns Memberships | Yes (of impersonated user) |

**Response Shape:**
```json
{
  "ok": true,
  "is_impersonating": true/false,
  "impersonated_user_id": "...",
  "impersonated_user_email": "...",
  "impersonated_user_name": "...",
  "tenant_id": "..." | null,
  "tenant_name": "..." | null,
  "tenant_role": "..." | null,
  "expires_at": "ISO date",
  "memberships": [...]
}
```

### B.6 `/api/admin/impersonation/set-tenant`

**Location:** `server/routes/admin-impersonation.ts:273`

| Property | Value |
|----------|-------|
| Auth Required | Yes (JWT) |
| Tenant Required | No |
| Role Required | Platform Admin |

**Request Body:**
```json
{ "tenant_id": "uuid (required)" }
```

**Response Shape:**
```json
{
  "ok": true,
  "tenant": { "id", "name", "slug", "role" }
}
```

---

## C) Tenant Membership Resolution Rules

### C.1 Where cc_tenant_users is Loaded

**Primary Path:** `server/routes/user-context.ts:39-52`

```sql
SELECT tu.tenant_id, t.name as tenant_name, t.slug as tenant_slug, 
       t.tenant_type, tu.role
FROM cc_tenant_users tu
JOIN cc_tenants t ON t.id = tu.tenant_id
WHERE tu.user_id = $1
  AND t.status = 'active'
  AND tu.status = 'active'
ORDER BY t.tenant_type, t.name ASC
```

**CRITICAL:** This uses `req.user.userId` (the REAL user from JWT), NOT the impersonated user.

### C.2 Glenn (Platform Admin with Zero Memberships)

**Query Result:** Empty array `[]`

**TenantContext Behavior:**
- `memberships = []`
- `currentTenant = null`
- `hasTenantMemberships = false` (in AuthContext, based on ccTenants from login)

**Nav Behavior:**
- `navMode = 'platform_only'` (isPlatformAdmin && !hasTenantMemberships)
- PlatformLayout is shown
- "Your Places" is hidden (requiresTenantMemberships filter)

### C.3 Mathew (User with 2 Memberships) - When Impersonated

**Impersonation Start:**
- `/api/admin/impersonation/start` fetches Mathew's memberships from `cc_tenant_users`
- Returns memberships in response
- Stores in session

**Status Check:**
- `/api/admin/impersonation/status` returns memberships for impersonated user

**SelectTenantPage:**
- Uses `/api/admin/impersonation/status` to get memberships
- Shows Mathew's tenants, NOT Glenn's

### C.4 Role During Impersonation

**Source:** `session.impersonation.tenant_role`

**Set By:**
1. `/api/admin/impersonation/start` - if tenant_id provided
2. `/api/admin/impersonation/set-tenant` - when tenant selected

**Uses:** The impersonated user's actual role from `cc_tenant_users`

**Does NOT "guess" a tenant** - Phase 2C-13.5 fixed this:
- `selectedTenant` remains NULL if no `tenant_id` in request
- Tenant must be explicitly chosen

---

## D) UI Nav Generation Audit

### D.1 V3_NAV Filter Function

**Location:** `client/src/lib/routes/v3Nav.ts`

**Filter Context Inputs:**
```typescript
interface NavFilterContext {
  isAuthenticated: boolean;
  hasTenant: boolean;
  hasPortal: boolean;
  isPlatformAdmin: boolean;
  tenantRole?: string;
  portalRole?: string;
  founderNavEnabled?: boolean;
}
```

### D.2 Behavior When `tenant_id is null`

When `hasTenant = false`:
- Items with `requiresTenant: true` are HIDDEN
- Sections with `requiresTenant: true` are HIDDEN

**Visible Sections with no tenant:**
- Personal (except Dashboard which requires tenant)
- Platform Admin items (if isPlatformAdmin)
- Dev items (in development mode)

### D.3 "Your Places" Configuration

**Location:** `client/src/lib/routes/v3Nav.ts:96`

```typescript
{ 
  icon: Map, 
  label: 'Your Places', 
  href: '/app/places', 
  testId: 'nav-places-picker' 
  // NO requiresTenant - always visible
}
```

**Also in platformNav.ts:51:**
```typescript
{ 
  icon: Map, 
  label: 'Your Places', 
  href: '/app/places', 
  testId: 'nav-places-picker', 
  requiresTenantMemberships: true  // Hidden for Glenn
}
```

---

## E) Key Findings Summary

### Tenant Auto-Selection

**Presence:** FALSE (as of Phase 2C-13.5)

**Where Prevented:**
- `server/routes/admin-impersonation.ts:157` - `selectedTenant = null` if no `tenant_id`
- Comment at line 148-155 documents the invariant

### Effective Identity Fields Used

| Field | Source | Purpose |
|-------|--------|---------|
| `user.id` | JWT/AuthContext | Real user identity |
| `user.isPlatformAdmin` | JWT | Platform permissions |
| `impersonation.active` | Session → whoami | Whether impersonating |
| `impersonation.target_user.id` | Session | Impersonated user |
| `impersonation.tenant.id` | Session | Selected tenant (NULL allowed) |
| `currentTenant` | TenantContext | Synthesized current tenant object |
| `memberships` | /api/me/context | REAL user's memberships |

### Critical Issues Identified

1. **Duplicate Impersonation State** - AuthContext and TenantContext both track impersonation with different shapes
2. **Memberships Source Confusion** - `/api/me/context` returns REAL user's memberships, but impersonation needs IMPERSONATED user's memberships
3. **No UserShell Layout** - When impersonating with no tenant, user is forced to SelectTenantPage (not user-friendly)

---

## Appendix: File Locations

| File | Purpose |
|------|---------|
| `client/src/contexts/AuthContext.tsx` | JWT auth + impersonation state |
| `client/src/contexts/TenantContext.tsx` | Tenant context + memberships |
| `client/src/components/routing/AppRouterSwitch.tsx` | Centralized routing decisions |
| `client/src/components/ImpersonationBanner.tsx` | Impersonation UI indicator |
| `client/src/pages/app/SelectTenantPage.tsx` | Tenant selection during impersonation |
| `client/src/lib/routes/v3Nav.ts` | V3 navigation configuration |
| `client/src/lib/routes/platformNav.ts` | Platform admin navigation |
| `server/routes/foundation.ts` | Auth endpoints (login, logout, whoami, me) |
| `server/routes/user-context.ts` | /api/me/* endpoints |
| `server/routes/admin-impersonation.ts` | Impersonation endpoints |

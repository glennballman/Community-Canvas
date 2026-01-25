# STEP 11C Phase 2C-13.2: Nav Mode Gating + Tenant Shell During Impersonation

## Overview

This document provides proof of implementation for navigation mode gating that ensures platform-only users see the correct navigation and impersonating users are redirected appropriately.

## Problems Addressed

1. **Platform admin sees "Your Places"**: Platform admins with zero tenant memberships were seeing "Your Places" in the platform nav, which was confusing since they have no places.
2. **Platform nav during impersonation**: While impersonating a tenant user, the UI could show platform nav instead of the impersonated user's tenant nav.
3. **No route protection**: Users could access `/app/platform/*` routes while impersonating.

## Implementation Details

### 1. NavMode Computation in AuthContext

**File**: `client/src/contexts/AuthContext.tsx`

Added navMode type and computation:

```typescript
export type NavMode = 'platform_only' | 'tenant' | 'impersonating';

// Computation logic:
const hasTenantMemberships = ccTenants.length > 0;
const isImpersonating = impersonation.active;

const navMode: NavMode = (() => {
    if (isImpersonating) return 'impersonating';
    if (user?.isPlatformAdmin && !hasTenantMemberships) return 'platform_only';
    return 'tenant';
})();
```

**Exported values**:
- `navMode`: The computed navigation mode
- `hasTenantMemberships`: Boolean indicating if user has tenant memberships

### 2. Platform Nav Filtering

**File**: `client/src/lib/routes/platformNav.ts`

Added `requiresTenantMemberships` flag to nav items:

```typescript
export interface PlatformNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  testId: string;
  requiresTenantMemberships?: boolean;  // NEW
}
```

Updated "Your Places" item:
```typescript
{ icon: Map, label: 'Your Places', href: '/app/places', testId: 'nav-places-picker', requiresTenantMemberships: true },
```

Added filter function:
```typescript
export interface PlatformNavFilterContext {
  hasTenantMemberships: boolean;
}

export function getPlatformNavSections(ctx?: PlatformNavFilterContext): PlatformNavSection[] {
  if (!ctx) return PLATFORM_NAV;
  
  return PLATFORM_NAV
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.requiresTenantMemberships && !ctx.hasTenantMemberships) {
          return false;
        }
        return true;
      }),
    }))
    .filter(section => section.items.length > 0);
}
```

### 3. Platform Layout Route Guard

**File**: `client/src/layouts/PlatformLayout.tsx`

Added redirect when impersonating:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Inside component:
const { impersonation, hasTenantMemberships } = useAuth();
const { toast } = useToast();

const sections = getPlatformNavSections({ hasTenantMemberships });

useEffect(() => {
    if (impersonation.active) {
        toast({
            title: 'Impersonation Active',
            description: 'End impersonation to access platform admin.',
            variant: 'destructive',
        });
        navigate('/app');
    }
}, [impersonation.active, navigate, toast]);
```

### 4. Tenant Nav During Impersonation

**File**: `server/routes/user-context.ts`

Updated /api/me/context endpoint to include impersonated role:

```typescript
impersonated_tenant: impersonatedTenant ? {
    id: impersonatedTenant.id,
    name: impersonatedTenant.name,
    type: impersonatedTenant.tenant_type,
    portal_slug: impersonatedTenant.portal_slug || null,
    role: impersonation?.tenant_role || 'tenant_admin',  // NEW: Include actual role
} : null,
```

**File**: `client/src/contexts/TenantContext.tsx`

Updated ImpersonationState interface and currentTenant synthesis:

```typescript
export interface ImpersonationState {
  is_impersonating: boolean;
  tenant_id?: string;
  tenant_name?: string;
  tenant_type?: string;
  tenant_role?: string;  // NEW: Added role field
  portal_slug?: string;
  expires_at?: string;
}

// When synthesizing currentTenant during impersonation:
return {
    tenant_id: impersonation.tenant_id,
    tenant_name: impersonation.tenant_name || 'Unknown Tenant',
    tenant_slug: '',
    tenant_type: (impersonation.tenant_type as TenantMembership['tenant_type']) || 'business',
    role: impersonation.tenant_role || 'tenant_admin',  // Use impersonated user's actual role
    is_primary: false,
};
```

## NavMode Rules Summary

| User Type | isPlatformAdmin | Tenant Memberships | Impersonating | NavMode |
|-----------|-----------------|-------------------|---------------|---------|
| Regular User | false | > 0 | false | tenant |
| Platform Admin | true | > 0 | false | tenant |
| Platform Admin | true | 0 | false | platform_only |
| Any User | any | any | true | impersonating |

## Behavior by NavMode

### platform_only (Glenn Ballman)
- User: `is_platform_admin=true`, `ccTenants.length=0`
- Nav: PLATFORM_NAV without "Your Places"
- Routes: Full access to `/app/platform/*`

### tenant (Sheryl Ferguson)
- User: Has tenant memberships
- Nav: V3_NAV filtered by role
- Routes: Full access to `/app/*`, limited platform access if also admin

### impersonating
- Nav: TenantAppLayout with impersonated tenant's context
- Routes: `/app/platform/*` redirects to `/app` with toast
- Banner: Visible on all pages

## Files Changed

### Server
**user-context.ts**
- Added `role` field to `impersonated_tenant` response
- Role comes from session's `tenant_role` set during impersonation start

### Client
**AuthContext.tsx**
- Added `NavMode` type export
- Added `navMode` and `hasTenantMemberships` to context value
- Computes navMode based on impersonation and memberships

**platformNav.ts**
- Added `requiresTenantMemberships` flag to `PlatformNavItem`
- Updated "Your Places" item with flag
- Added `PlatformNavFilterContext` interface
- Updated `getPlatformNavSections` to filter based on context

**PlatformLayout.tsx**
- Added `useAuth()` import and usage
- Added `useToast()` import and usage
- Passes `hasTenantMemberships` to nav filter
- Added useEffect to redirect when impersonating

**TenantContext.tsx**
- Added `tenant_role` to `ImpersonationState` interface
- Updated currentTenant synthesis to use impersonated role instead of hardcoded 'admin'

## Test Scenarios

1. **Platform-only user**: Login as Glenn Ballman (platform admin, 0 tenant memberships)
   - "Your Places" should NOT appear in left nav
   - All platform sections should be visible

2. **Start impersonation**: From impersonation console, impersonate a tenant user
   - Should redirect to `/app` automatically
   - Should see tenant nav (not platform nav)
   - Impersonation banner should be visible

3. **Visit platform while impersonating**: Try to navigate to `/app/platform/*`
   - Should redirect to `/app`
   - Should show toast: "End impersonation to access platform admin."

4. **Stop impersonation**: Click "Exit Impersonation" in banner
   - Should return to impersonation console
   - Platform nav should be restored

## Conclusion

The navigation mode gating ensures:
1. Platform-only users see appropriate navigation without tenant-related items
2. Impersonating users see the impersonated tenant's navigation
3. Platform routes are protected during impersonation with helpful toast messages

# PROMPT-16: Authorization Coverage Sweep

**Generated**: 2025-01-28  
**Type**: READ-ONLY Audit  
**Status**: No code changes made

---

## Constitutional Compliance Statement

| Compliance Check | Status |
|------------------|--------|
| No authorization logic was modified | CONFIRMED |
| No new authority sources were introduced | CONFIRMED |
| No fallback logic was added | CONFIRMED |
| All findings are observational only | CONFIRMED |

---

## 1. Server Route Authorization Matrix

### Legend

| Authorization Mechanism | Description |
|------------------------|-------------|
| `requireCapability(...)` | Middleware gate using capability code |
| `authorize(...)` | Function-level capability check (throws on deny) |
| `can(...)` | Function-level capability check (returns boolean) |
| `authenticateToken` | JWT-based authentication middleware |
| `requirePlatformAdmin` | Legacy platform admin gate (checks cc_grants) |
| `Explicitly Public` | No auth required (documented) |
| `Service-only` | Service key or internal access only |

### Platform Routes (`/api/p2/platform/*`)

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| p2-platform.ts | ALL | `/api/p2/platform/*` | `authenticateToken` + `requireCapability('platform.configure')` | platform.configure | Platform | Router-level gate (lines 34-35) |
| p2-platform.ts | POST | `/external-mappings/preview` | Inherited from router | platform.configure | Platform | PROMPT-15 endpoint |
| p2-platform.ts | GET | `/external-mappings/systems` | Inherited from router | platform.configure | Platform | PROMPT-15 endpoint |
| p2-platform.ts | GET | `/external-mappings/systems/:system` | Inherited from router | platform.configure | Platform | PROMPT-15 endpoint |
| p2-platform.ts | GET | `/tenants` | Inherited from router | platform.configure | Platform | List all tenants |
| p2-platform.ts | POST | `/tenants` | Inherited from router | platform.configure | Platform | Create tenant |
| p2-platform.ts | GET | `/tenants/:id` | Inherited from router | platform.configure | Platform | Get tenant details |
| p2-platform.ts | PATCH | `/tenants/:id` | Inherited from router | platform.configure | Platform | Update tenant |
| p2-platform.ts | GET | `/users` | Inherited from router | platform.configure | Platform | List all users |
| p2-platform.ts | GET | `/analytics` | Inherited from router | platform.configure | Platform | Platform analytics |

### Admin Routes (Legacy Pattern)

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| admin-tenants.ts | ALL | `/api/admin/tenants/*` | `authenticateToken` + `requirePlatformAdmin` | (Legacy) | Platform | Line 18, checks cc_grants for platform_admin role |
| admin-moderation.ts | ALL | `/api/admin/moderation/*` | `authenticateToken` + `requirePlatformAdmin` | (Legacy) | Platform | Line 8 |
| admin-communities.ts | ALL | `/api/admin/communities/*` | `authenticateToken` + `requirePlatformAdmin` | (Legacy) | Platform | Line 8 |
| admin-inventory.ts | ALL | `/api/admin/inventory/*` | `authenticateToken` + `requirePlatformAdmin` | (Legacy) | Platform | Line 17 |
| admin-impersonation.ts | ALL | `/api/admin/impersonation/*` | `authenticateToken` + `requirePlatformAdmin` | (Legacy) | Platform | Line 20 |
| admin-scm.ts | ALL | `/api/admin/scm/*` | `authenticateToken` + `requirePlatformAdmin` | (Legacy) | Platform | Line 17 |
| admin-feature-flags.ts | ALL | `/api/admin/feature-flags/*` | `requireServiceAuth` | N/A | Service | Line 26, service key auth |

### Tenant-Scoped Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| p2-admin.ts | GET/POST | `/api/p2/admin/*` | `can(req, 'tenant.configure')` | tenant.configure | Tenant | Multiple endpoints, line 49+ |
| p2-zones.ts | GET/POST | `/api/p2/zones/*` | `can(req, 'tenant.configure')` | tenant.configure | Tenant | Line 38 |
| p2-subsystems.ts | GET/POST | `/api/p2/subsystems/*` | `can(req, 'tenant.configure')` | tenant.configure | Tenant | Line 40 |
| p2-work-catalog.ts | GET/POST | `/api/p2/work-catalog/*` | `can(req, 'tenant.configure')` | tenant.configure | Tenant | Line 41 |
| p2-folios.ts | GET | `/api/p2/folios/*` | `can(req, 'folios.read')` | folios.read | Tenant | Line 47 |
| p2-reservations.ts | GET | `/api/p2/reservations` | `can(req, 'reservations.read')` OR `can(req, 'reservations.own.read')` | reservations.read | Tenant | Lines 20-21, own/all pattern |
| p2-reservations.ts | POST | `/api/p2/reservations/:id/check-in` | `can(req, 'reservations.update')` OR `can(req, 'reservations.checkin')` | reservations.checkin | Tenant | Lines 56-57 |
| work-requests.ts | GET/POST | `/api/work-requests/*` | `can(req, 'work_requests.read')` OR `can(req, 'work_requests.own.read')` | work_requests.read | Tenant | Lines 41, 87, own/all pattern |
| tenant-housing.ts | ALL | `/api/tenant-housing/*` | `requireTenantContext` | N/A | Tenant | Line 31, requires tenant context middleware |

### N3/Operations Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| n3.ts | GET/POST | `/api/n3/*` | `can(req, 'platform.configure')` | platform.configure | Platform | Lines 61, 87, 1364, 1384, 3075 |
| schedule.ts | ALL | `/api/schedule/*` | `authenticateToken` + tenant membership check | N/A | Tenant | Lines 12-14, tenant context guard |
| onboarding.ts | GET/POST | `/api/onboarding/*` | `authenticateToken` + `can(req, 'platform.configure')` | platform.configure | Platform | Lines 36, 61, 104 |
| maintenance-requests.ts | GET/POST | `/api/maintenance-requests/*` | `can(req, 'platform.configure')` | platform.configure | Platform | Line 31 |

### Operator Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| operator.ts | GET | `/api/operator/availability` | `authenticateToken` | N/A | User | Line 41, auth only |
| operator.ts | POST | `/api/operator/hold-request` | `authenticateToken` | N/A | User | Line 157 |
| operator.ts | POST | `/api/operator/call-log` | `authenticateToken` | N/A | User | Line 275 |
| operator.ts | POST | `/api/operator/incidents` | `authenticateToken` | N/A | User | Line 385 |
| operator.ts | GET | `/api/operator/incidents` | `authenticateToken` | N/A | User | Line 424 |
| operator.ts | GET | `/api/operator/dashboard/availability/test` | Explicitly Public | N/A | Public | Line 683, test endpoint |
| operator.ts | GET | `/api/operator/credentials/test` | Explicitly Public | N/A | Public | Line 846, test endpoint |

### Contractor Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| contractor-geo.ts | POST | `/api/contractor-geo/resolve` | `authenticateToken` | N/A | User | Line 50 |
| contractor-geo.ts | POST | `/api/contractor-geo/confirm` | `authenticateToken` | N/A | User | Line 203 |
| contractor-geo.ts | POST | `/api/contractor-geo/deny` | `authenticateToken` | N/A | User | Line 321 |
| contractor-geo.ts | POST | `/api/contractor-geo/search` | `authenticateToken` | N/A | User | Line 358 |
| contractor-geo.ts | GET | `/api/contractor-geo/candidates` | `authenticateToken` | N/A | User | Line 390 |
| contractor-ingestions.ts | POST | `/api/contractor-ingestions/` | `authenticateToken` | N/A | User | Line 94 |
| contractor-ingestions.ts | GET | `/api/contractor-ingestions/:id` | `authenticateToken` | N/A | User | Line 169 |
| contractor-ingestions.ts | POST | `/api/contractor-ingestions/:id/confirm` | `authenticateToken` | N/A | User | Line 215 |
| contractor-ingestions.ts | GET | `/api/contractor-ingestions/fleet` | `authenticateToken` | N/A | User | Line 401 |

### Foundation/Auth Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| foundation.ts | GET | `/api/foundation/stats` | `authenticateToken` + `requireCapability('platform.configure')` | platform.configure | Platform | Line 697 |
| foundation.ts | GET | `/api/foundation/me/context` | `authenticateToken` | N/A | User | Line 797 |
| auth.ts | POST | `/api/auth/login` | Explicitly Public | N/A | Public | Rate-limited, no auth required |
| auth.ts | POST | `/api/auth/register` | Explicitly Public | N/A | Public | Rate-limited, no auth required |
| auth.ts | POST | `/api/auth/refresh` | Token-based | N/A | User | Validates refresh token |
| auth.ts | GET | `/api/auth/whoami` | `authenticateToken` | N/A | User | Returns user context |
| auth.ts | POST | `/api/auth/password/change` | `authenticateToken` | N/A | User | Line 593 |
| auth.ts | POST | `/api/auth/password/forgot` | Explicitly Public | N/A | Public | Line 639, email enumeration safe |
| auth.ts | POST | `/api/auth/password/reset` | Token-based | N/A | Public | Reset token validation |
| auth.ts | GET | `/api/auth/sessions` | `authenticateToken` | N/A | User | Line 727 |

### Public Routes (Explicitly Unauthenticated)

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| public-portal.ts | GET | `/api/public/portal-context` | Explicitly Public | N/A | Public | Line 22, returns public portal info only |
| public-portal.ts | GET/POST | `/api/public/cart/*` | Explicitly Public | N/A | Public | Cart operations, no PII |
| public-portal.ts | GET | `/api/public/recommendations` | Explicitly Public | N/A | Public | Public recommendations |
| public-invitations.ts | GET | `/api/public/invitations/:token` | Token-based | N/A | Public | Token provides access |
| public-invitations.ts | POST | `/api/public/invitations/:token/claim` | Token-based | N/A | Public | Claim flow |
| public-onboard.ts | GET/POST | `/api/public/onboard/*` | Explicitly Public | N/A | Public | Onboarding wizard |
| public-event.ts | GET | `/api/public/event/*` | Explicitly Public | N/A | Public | Event quote pages |
| public-jobs.ts | GET | `/api/public/jobs/*` | Explicitly Public | N/A | Public | Public job listings |
| public-portal-conditions.ts | GET | `/api/public/conditions/*` | Explicitly Public | N/A | Public | Condition status |
| civos.ts | GET | `/api/civos/*` | Explicitly Public | N/A | Public | Line 16, CivOS data pull |
| authority.ts | GET | `/p/authority/*` | Explicitly Public | N/A | Public | Line 101, public authority routes |

### Internal/Service Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| internal.ts | POST | `/api/internal/auth/login` | `blockTenantAccess` + `internalRateLimit` | N/A | Service | Lines 48-49, platform staff only |
| internal.ts | ALL | `/api/internal/*` | `requirePlatformRole` | N/A | Service | Platform staff authentication |
| import.ts | ALL | `/api/import/*` | `requireServiceKey` | N/A | Service | Line 20, service key auth |
| internal-rtr.ts | ALL | `/api/internal-rtr/*` | `requireServiceKey` | N/A | Service | Line 24, service key auth |
| moderation-jobs.ts | ALL | `/api/moderation-jobs/*` | `requirePortalStaff` | N/A | Portal | Line 84, portal staff auth |

### PMS Routes (Property Management)

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| pms.ts | POST | `/api/pms/portals/:slug/properties` | Portal context | N/A | Portal | No explicit capability check |
| pms.ts | GET | `/api/pms/portals/:slug/properties` | Portal context | N/A | Portal | No explicit capability check |
| pms.ts | POST | `/api/pms/portals/:slug/reservations` | Portal context | N/A | Portal | No explicit capability check |
| pms.ts | GET | `/api/pms/portals/:slug/reservations` | Portal context | N/A | Portal | No explicit capability check |

### Embeds Routes

| File | Method | Path | Authorization Mechanism | Capability | Scope | Notes |
|------|--------|------|------------------------|------------|-------|-------|
| embeds.ts | GET | `/api/embeds/feed/:embedKey` | Embed key validation | N/A | Public | Line 99, key provides access |
| embeds.ts | GET | `/api/embeds/surfaces` | Authenticated | N/A | User | Line 227 |
| embeds.ts | POST | `/api/embeds/surfaces` | Authenticated | N/A | User | Line 262 |

---

## 2. UI Surface Authorization Matrix

### Pages with Capability Gates

| UI Surface | File | Gating Mechanism | Required Capability | Notes |
|------------|------|------------------|---------------------|-------|
| Admin Home Page | client/src/pages/app/admin/AdminHomePage.tsx | `<RequireCapability />` | tenant.configure | Lines 10, 14, 41 |
| Platform Layout (all routes) | client/src/layouts/PlatformLayout.tsx | `useCanUI()` | (varies by nav item) | Line 51, filters nav items |
| Tenant App Layout (all routes) | client/src/layouts/TenantAppLayout.tsx | `useCanUI()` | (varies by nav item) | Line 90, filters nav items |
| Impersonation Console | client/src/pages/app/platform/ImpersonationConsole.tsx | Nav filter | impersonation.start | Via platformNav.ts line 65 |
| Users Management | client/src/pages/app/platform/UsersManagement.tsx | Nav filter | platform.users.manage | Via platformNav.ts line 64 |
| Analytics Page | client/src/pages/app/platform/AnalyticsPage.tsx | Nav filter | analytics.view | Via platformNav.ts line 66 |
| System Explorer | client/src/pages/app/SystemExplorerPage.tsx | Nav filter | platform.configure | Via platformNav.ts line 67 |

### Navigation Configs

| Navigation Config | File | Gating Mechanism | Notes |
|-------------------|------|------------------|-------|
| Platform Nav | client/src/lib/routes/platformNav.ts | `requiredCapability` on items/sections | Lines 36-44, 60-84 |
| V3 Nav | client/src/lib/routes/v3Nav.ts | `requiredCapability` on items/sections | Lines 59-75 |

### Navigation Filter Implementation

| Component | File | Gating Mechanism | Notes |
|-----------|------|------------------|-------|
| Platform Layout Nav | client/src/layouts/PlatformLayout.tsx | `canUI(item.requiredCapability)` | Filters nav items via useCanUI() |
| Tenant App Layout Nav | client/src/layouts/TenantAppLayout.tsx | `canUI(item.requiredCapability)` | Filters nav items via useCanUI() |

### Components with Capability Gates

| Component | File | Gating Mechanism | Notes |
|-----------|------|------------------|-------|
| RequireCapability | client/src/components/auth/RequireCapability.tsx | `useCanUI()` | Wrapper for page-level gates |
| GatedButton | client/src/components/auth/GatedButton.tsx | `useCanUI()` | Button visibility based on capability |

### UI Authorization Hook

| Hook | File | Description |
|------|------|-------------|
| useCanUI | client/src/auth/uiAuthorization.ts | Central UI capability check, uses /api/me/capabilities snapshot |

---

## 3. Coverage Gaps & Risk Report

### HIGH Risk Gaps

| Gap Type | Location | Risk Level | Recommendation |
|----------|----------|------------|----------------|
| PMS routes lack capability checks | server/routes/pms.ts | HIGH | Add `can(req, 'reservations.manage')` or similar capability gates |
| Operator routes auth-only | server/routes/operator.ts | MEDIUM-HIGH | Consider adding capability checks beyond auth (e.g., `can(req, 'operations.manage')`) |

### MEDIUM Risk Gaps

| Gap Type | Location | Risk Level | Recommendation |
|----------|----------|------------|----------------|
| Contractor routes auth-only | server/routes/contractor-*.ts | MEDIUM | Auth sufficient if routes are user-scoped; document intent |
| Schedule routes auth-only | server/routes/schedule.ts | MEDIUM | Has tenant context check but no capability; document if intentional |
| Some pages rely on backend denial | Multiple | MEDIUM | Add `<RequireCapability>` wrappers for consistency |

### LOW Risk Gaps

| Gap Type | Location | Risk Level | Recommendation |
|----------|----------|------------|----------------|
| Legacy requirePlatformAdmin pattern | admin-*.ts files | LOW | Already checks cc_grants for platform_admin role; migrate to requireCapability for consistency |
| Test endpoints public | operator.ts lines 683, 846 | LOW | Document or remove in production |

### Observations

1. **Router-level gates are authoritative**: Routes like p2-platform.ts use `router.use(requireCapability(...))` which gates ALL child routes correctly.

2. **Capability snapshot is used for UI**: The `useCanUI()` hook in `client/src/auth/uiAuthorization.ts` uses `/api/me/capabilities` as the single source of truth (PROMPT-6 compliance).

3. **Navigation configs have capability requirements**: Both `platformNav.ts` and `v3Nav.ts` have `requiredCapability` fields that are respected by layout components.

4. **Own/All pattern is implemented**: Routes like `work-requests.ts` and `p2-reservations.ts` correctly implement the own/all capability pattern for resource-scoped access.

5. **Public routes are documented**: Files like `public-portal.ts`, `public-invitations.ts`, `civos.ts`, and `authority.ts` have clear comments indicating public access intent.

6. **Service routes use service keys**: `internal.ts`, `import.ts`, `internal-rtr.ts` correctly use service key authentication.

### Legacy Patterns (Technical Debt)

| Pattern | Location | Notes |
|---------|----------|-------|
| `requirePlatformAdmin` | Multiple admin-*.ts files | Uses `checkPlatformAdminGrant()` which queries cc_grants - compliant but not using `requireCapability()` syntax |
| `isPlatformAdmin` flag | Multiple locations | Read from session, but authorization uses grants (PROMPT-8/10 compliant) |

---

## Summary

| Category | Count |
|----------|-------|
| Total Server Route Files Analyzed | 90+ |
| Routes with Capability Gates | 50+ |
| Routes with Auth-Only Gates | 30+ |
| Explicitly Public Routes | 25+ |
| Service-Only Routes | 10+ |
| UI Pages with Capability Gates | 10+ |
| HIGH Risk Gaps | 1 (PMS routes) |
| MEDIUM Risk Gaps | 3 |
| LOW Risk Gaps | 3 |

---

## Files Modified

**NONE** - This was a READ-ONLY audit.

# Deprecation Audit: /api/admin/* and /admin Namespace

**Date**: 2026-01-25  
**Auditor**: Replit Agent  
**Mode**: Read-only analysis (no code changes)

---

## Executive Summary

| Namespace | Status | Verdict |
|-----------|--------|---------|
| `/admin` (UI route) | 410 Gone | ✅ Deprecated - already disabled |
| `/app/admin/*` (UI routes) | Active V3.5 | ⚠️ Confusing name, but TENANT admin (not deprecated) |
| `/api/admin/*` (API routes) | Active V3.5 | ⚠️ Required - used by platform features |
| `/app/platform/*` (UI routes) | Active V3.5 | ✅ Current platform admin surface |

**Critical Finding**: The `/api/admin/*` namespace is **NOT deprecated** - it's actively used by V3.5 platform admin features. However, it creates naming confusion with the deprecated `/admin` UI route.

---

## A) Server Mount Inventory (Truth Table)

### Active /api/admin/* Mounts (server/routes.ts)

| Line | Mount Prefix | Router File | Purpose | Guard |
|------|--------------|-------------|---------|-------|
| 534 | /api/admin/impersonation | admin-impersonation.ts | Platform tenant impersonation | requirePlatformAdmin |
| 537 | /api/admin/tenants | admin-tenants.ts | Platform tenant management | requirePlatformAdmin |
| 540 | /api/admin/communities | admin-communities.ts | Platform community management | requirePlatformAdmin |
| 543 | /api/admin/moderation | admin-moderation.ts | Content moderation | requirePlatformAdmin |
| 546 | /api/admin/inventory | admin-inventory.ts | System-wide inventory | requirePlatformAdmin |
| 549 | /api/admin/scm | admin-scm.ts | SCM certification | requirePlatformAdmin |
| 555 | /api/admin/system-explorer | system-explorer.ts | Platform debug tools | requirePlatformAdmin |
| 558 | /api/admin/qa | qa.ts | QA testing endpoints | requirePlatformAdmin |

### Inline /api/admin/* Routes (server/routes.ts)

| Line | Route | Purpose |
|------|-------|---------|
| 640 | GET /api/admin/presentations | Redirect to /api/admin/cc_articles |
| 641 | GET /api/admin/cc_articles | Article listings |
| 1512 | GET /api/admin/chamber-audit | Chamber audit data |
| 1634 | GET /api/admin/chamber-progress | Chamber progress data |
| 1698 | GET /api/admin/chamber-progress/summary | Progress summary |
| 1709 | GET /api/admin/chamber-overrides | Chamber overrides |
| 1719 | PUT /api/admin/chamber-overrides/:id | Update chamber override |

### /api/p2/admin/* Mounts

| Line | Mount Prefix | Purpose |
|------|--------------|---------|
| 388 | /api/p2/admin | P2 admin router |
| 510 | /api/p2/admin/portals | Portal admin |
| 552 | /api/p2/admin/feature-flags | Feature flags |

### Deprecated /admin UI Route

| Line | Route | Handler |
|------|-------|---------|
| 192 | /admin | 410 Gone - "This admin interface has been permanently retired" |

---

## B) Client Route Inventory

### /admin (Top-level) - DEPRECATED

**Status**: Server returns 410 Gone  
**Client Code**: `client/src/App.tsx:646` still has route definition using `PlatformAdminLayout`

```tsx
<Route path="/admin" element={<PlatformAdminLayout />}>
  ...child routes...
</Route>
```

**Verdict**: Dead code - server blocks access with 410.

### /app/admin/* (Tenant Admin) - ACTIVE V3.5

**Status**: Active, serves tenant administration  
**Layout**: Nested under TenantAppLayout (`/app/*`)

| Route | Component | Purpose |
|-------|-----------|---------|
| /app/admin | AdminHomePage | Tenant admin home |
| /app/admin/roles | AdminRolesPage | Tenant role management |
| /app/admin/settings | AdminSettingsPage | Tenant settings |
| /app/admin/folios | FoliosListPage | Tenant folios |
| /app/admin/usage | UsageSummaryPage | Tenant usage stats |
| /app/admin/certifications | CertificationsPage | Tenant certifications |
| /app/admin/portals | PortalsPage | Tenant portal config |
| /app/admin/tenants | TenantsPageApp | Tenant sub-tenants |

**Verdict**: NOT deprecated - these are tenant admin routes under `/app/*` tree.

### /app/platform/* (Platform Admin) - ACTIVE V3.5

**Status**: Current platform admin surface  
**Layout**: PlatformLayout

| Route | Purpose |
|-------|---------|
| /app/platform | Platform home |
| /app/platform/tenants | All tenants list |
| /app/platform/analytics | Platform analytics |
| /app/platform/system-explorer | System debug |
| /app/platform/users | Platform user management |
| /app/platform/settings | Platform settings |

**Verdict**: This is the V3.5 platform admin UI.

---

## C) Reference Graph: Who Calls /api/admin/*

### Runtime Dependencies (ACTIVE)

| Caller File | API Endpoint | Classification |
|-------------|--------------|----------------|
| client/src/contexts/TenantContext.tsx:291 | /api/admin/impersonation/start | **runtime dependency** |
| client/src/contexts/TenantContext.tsx:323 | /api/admin/impersonation/stop | **runtime dependency** |
| client/src/pages/AdminChambers.tsx:566 | /api/admin/chamber-progress | **runtime dependency** |
| client/src/pages/AdminChambers.tsx:576 | /api/admin/chamber-overrides | **runtime dependency** |
| client/src/pages/app/SystemExplorerPage.tsx:156 | /api/admin/system-explorer/overview | **runtime dependency** |
| client/src/pages/app/SystemExplorerPage.tsx:160 | /api/admin/system-explorer/table/* | **runtime dependency** |
| client/src/pages/app/SystemExplorerPage.tsx:165 | /api/admin/system-explorer/evidence/status | **runtime dependency** |
| client/src/pages/app/admin/CertificationsPage.tsx | /api/admin/scm/latest-p2-operator-cert | **runtime dependency** |
| client/src/lib/api/admin/useLatestP2OperatorCert.ts:66 | /api/admin/scm/latest-p2-operator-cert | **runtime dependency** |
| client/src/pages/admin/ImpersonationConsole.tsx:71 | /api/admin/tenants | **runtime dependency** (legacy page) |
| client/src/pages/admin/PortalConfigPage.tsx:76 | /api/admin/communities | **runtime dependency** (legacy page) |
| client/src/pages/admin/AdminInventory.tsx:86 | /api/admin/inventory | **runtime dependency** (legacy page) |
| client/src/pages/admin/CommunitiesPage.tsx:46 | /api/admin/communities | **runtime dependency** (legacy page) |
| client/src/pages/admin/AIQueuePage.tsx:50 | /api/admin/moderation/submissions | **runtime dependency** (legacy page) |
| client/src/pages/admin/ArticlesPage.tsx:34 | /api/admin/articles | **runtime dependency** (legacy page) |

### Test-Only Dependencies

| Caller File | API Endpoint | Classification |
|-------------|--------------|----------------|
| scripts/qa-smoke-test.ts:92 | /api/admin/system-explorer/evidence/verify | **test-only** |
| scripts/qa-smoke-test.ts:276 | /api/admin/system-explorer/table/snapshots | **test-only** |
| scripts/qa-smoke-test.ts:399 | /api/admin/system-explorer/overview | **test-only** |
| scripts/qa-smoke-test.ts:402 | /api/admin/system-explorer/evidence/status | **test-only** |

### Legacy Links (client/src/pages/admin/*)

| File | Status |
|------|--------|
| AdminInventory.tsx | Legacy page under deprecated /admin |
| AIQueuePage.tsx | Legacy page under deprecated /admin |
| ArticlesPage.tsx | Legacy page under deprecated /admin |
| CivOSDashboard.tsx | Legacy page under deprecated /admin |
| CommunitiesPage.tsx | Legacy page under deprecated /admin |
| DataImport.tsx | Legacy page under deprecated /admin |
| FlaggedContentPage.tsx | Legacy page under deprecated /admin |
| ImpersonationConsole.tsx | Legacy page under deprecated /admin |
| PortalConfigPage.tsx | Legacy page under deprecated /admin |
| SeedCommunitiesPage.tsx | Legacy page under deprecated /admin |
| TenantsManagement.tsx | Legacy page under deprecated /admin |
| UsersManagement.tsx | Legacy page under deprecated /admin |

**Note**: These pages are mounted under the deprecated `/admin` route tree (PlatformAdminLayout), which returns 410. They call active `/api/admin/*` endpoints but are themselves unreachable.

---

## D) Conclusions

### 1. /admin UI Route
**Status**: ✅ **Deprecated - Safe to Remove Client Code**

The server already returns 410 Gone for `/admin`. The client-side route definitions and components in `client/src/pages/admin/*` are dead code that could be removed.

### 2. /api/admin/* API Endpoints
**Status**: ⚠️ **Required - Must Keep for V3.5**

These endpoints are actively called by:
- V3.5 platform features (`SystemExplorerPage`, `CertificationsPage`)
- Tenant impersonation system (`TenantContext`)
- Legacy admin pages (dead but APIs are shared)

**Recommendation**: Rename to `/api/platform/*` for consistency with V3.5 architecture, but this requires migration coordination.

### 3. /app/admin/* UI Routes
**Status**: ✅ **Active V3.5 - NOT Deprecated**

Despite the confusing "admin" in the path, these are TENANT admin routes under the `/app/*` tree, not platform admin routes. They serve tenant settings, roles, folios, etc.

### 4. /app/platform/* UI Routes
**Status**: ✅ **Active V3.5 - Current Platform Admin**

This is the canonical V3.5 platform admin surface.

---

## E) Recommended Deprecation Strategy

### Phase 1: Clean Dead Client Code (Safe Now)
- Remove `client/src/pages/admin/*` directory (14 files)
- Remove `/admin` route tree from `client/src/App.tsx` (lines 646-663)
- Remove `PlatformAdminLayout.tsx`
- These are already unreachable due to server 410

### Phase 2: API Namespace Migration (Future)
If namespace clarity is desired:
1. Create new routes under `/api/platform/*` 
2. Add deprecation warnings to `/api/admin/*` (HTTP 299 or custom header)
3. Update all client callers to use new paths
4. After migration period, redirect `/api/admin/*` → `/api/platform/*`

### NOT Recommended
- Do NOT remove `/api/admin/*` endpoints - they are actively used
- Do NOT remove `/app/admin/*` routes - these are tenant admin (V3.5)

---

## F) Files Summary

### Dead Code (Safe to Remove)
```
client/src/pages/admin/AdminInventory.tsx
client/src/pages/admin/AIQueuePage.tsx
client/src/pages/admin/ArticlesPage.tsx
client/src/pages/admin/CivOSDashboard.tsx
client/src/pages/admin/CommunitiesPage.tsx
client/src/pages/admin/DataImport.tsx
client/src/pages/admin/FlaggedContentPage.tsx
client/src/pages/admin/ImpersonationConsole.tsx
client/src/pages/admin/PortalConfigPage.tsx
client/src/pages/admin/SeedCommunitiesPage.tsx
client/src/pages/admin/TenantsManagement.tsx
client/src/pages/admin/UsersManagement.tsx
client/src/layouts/PlatformAdminLayout.tsx
client/src/pages/AdminLayout.tsx
client/src/pages/AdminHome.tsx
client/src/pages/AdminChambers.tsx
```

### Active Code (Do Not Remove)
```
server/routes/admin-*.ts (all files)
server/routes/system-explorer.ts
client/src/pages/app/admin/*.tsx
client/src/pages/app/platform/*.tsx
client/src/lib/api/admin/*.ts
```

# NAVIGATION HOOKUP SELF-AUDIT

## Instructions for Replit

This is a self-directed audit. You will:
1. Inventory all existing pages and components
2. Map each navigation item to its target
3. Identify and fix gaps
4. Verify each connection works
5. Report results

**Work autonomously. Only stop if you encounter a blocking issue that requires a decision.**

---

# PHASE 1: INVENTORY

## 1.1 Scan Existing Pages

Search the codebase and create a complete inventory.

```bash
# Find all page components
find client/src/pages -name "*.tsx" -type f

# Find all route definitions
grep -r "Route path=" client/src/App.tsx
grep -r "Route path=" client/src/routes

# Find orphaned components (pages that exist but may not be routed)
find client/src -name "*.tsx" | xargs grep -l "export.*function\|export default"
```

Create a table:

| File Path | Component Name | Current Route | Status |
|-----------|---------------|---------------|--------|
| client/src/pages/admin/AIQueue.tsx | AIQueue | /admin/moderation/ai-queue | ? |
| ... | ... | ... | ... |

## 1.2 Scan Navigation Definitions

Find all navigation items defined in layouts:

```bash
# In TenantAppLayout.tsx
grep -A2 "href:" client/src/layouts/TenantAppLayout.tsx

# In PlatformAdminLayout.tsx  
grep -A2 "href:" client/src/layouts/PlatformAdminLayout.tsx
```

Create a table of all nav items:

| Layout | Section | Label | href | Target Component |
|--------|---------|-------|------|------------------|
| PlatformAdminLayout | OVERVIEW | Dashboard | /admin | AdminDashboard |
| PlatformAdminLayout | TENANTS & USERS | Tenants | /admin/tenants | TenantsPage |
| PlatformAdminLayout | MODERATION | AI Queue | /admin/moderation/ai-queue | ? |
| TenantAppLayout | Community | Availability | /app/availability | ? |
| ... | ... | ... | ... | ... |

---

# PHASE 2: GAP ANALYSIS

## 2.1 Identify Missing Connections

For each navigation item, check:

1. **Route exists?** — Is there a `<Route path="...">` for this href?
2. **Component exists?** — Does the target component exist?
3. **Component imported?** — Is it imported in App.tsx?
4. **Component functional?** — Does it render without errors?

Mark each as:
- ✅ CONNECTED — Route exists, component exists, working
- ⚠️ PLACEHOLDER — Route exists, but renders "Coming soon..."
- ❌ BROKEN — Route exists but component missing or errors
- 🔌 ORPHAN — Component exists but no route points to it

## 2.2 Find Orphaned Pages

These are pages that exist in the codebase but aren't accessible via navigation:

```bash
# List all exports from pages directory
grep -r "export default\|export function" client/src/pages --include="*.tsx" | grep -v "test\|spec"
```

Cross-reference with routes in App.tsx. Any page not in a Route is orphaned.

## 2.3 Create Gap Report

```markdown
## Gap Report

### Admin Navigation (/admin/*)
| Nav Item | Status | Action Needed |
|----------|--------|---------------|
| Dashboard | ✅ | None |
| Tenants | ⚠️ PLACEHOLDER | Hook up existing TenantsPage |
| AI Queue | 🔌 ORPHAN | Add route, component exists at /pages/admin/AIQueue.tsx |

### App Navigation - Community (/app/* when tenant_type=community)
| Nav Item | Status | Action Needed |
|----------|--------|---------------|
| Dashboard | ✅ | None |
| Availability | ⚠️ PLACEHOLDER | Hook up existing AvailabilityConsole |
| Service Runs | ⚠️ PLACEHOLDER | Hook up existing ServiceRunsPage |

### App Navigation - Business (/app/* when tenant_type=business)
| Nav Item | Status | Action Needed |
|----------|--------|---------------|
| Catalog | ⚠️ PLACEHOLDER | Hook up existing CatalogPage |
```

---

# PHASE 3: HOOKUP EXECUTION

## 3.1 Rules for Hookup

1. **DO NOT create new pages** — Only connect existing ones
2. **DO NOT modify page content** — Only routing and imports
3. **Preserve existing functionality** — If a page works, don't break it
4. **Use lazy loading** for large pages:
   ```typescript
   const AIQueue = lazy(() => import('./pages/admin/AIQueue'));
   ```

## 3.2 Hookup Process

For each gap identified:

### If status is 🔌 ORPHAN (component exists, no route):

1. Import the component in App.tsx
2. Add the Route element
3. Verify it renders

### If status is ⚠️ PLACEHOLDER (route exists, shows "Coming soon"):

1. Find the actual component that should render
2. Replace placeholder with real import
3. Verify it renders

### If status is ❌ BROKEN:

1. Check console for errors
2. Fix import/export issues
3. Verify it renders

## 3.3 Standard Import Pattern

```typescript
// At top of App.tsx - Lazy load heavy pages
import { lazy, Suspense } from 'react';

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const TenantsPage = lazy(() => import('./pages/admin/Tenants'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const AIQueuePage = lazy(() => import('./pages/admin/AIQueue'));
const FlaggedContentPage = lazy(() => import('./pages/admin/FlaggedContent'));
// ... etc

// Wrap routes in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    ...
  </Routes>
</Suspense>
```

---

# PHASE 4: VERIFICATION

## 4.1 Automated Route Check

After hookup, verify each route loads:

```typescript
// Create a simple test script or manually verify
const ALL_ROUTES = [
  // Admin routes
  '/admin',
  '/admin/tenants',
  '/admin/users',
  '/admin/impersonation',
  '/admin/data/infrastructure',
  '/admin/data/chambers',
  '/admin/data/naics',
  '/admin/data/accommodations',
  '/admin/data/import-export',
  '/admin/communities',
  '/admin/communities/seed',
  '/admin/communities/portals',
  '/admin/moderation/ai-queue',
  '/admin/moderation/flagged',
  '/admin/settings',
  '/admin/logs',
  
  // App routes (need tenant selected)
  '/app',
  '/app/dashboard',
  '/app/availability',
  '/app/service-runs',
  '/app/directory',
  '/app/content',
  '/app/catalog',
  '/app/bookings',
  '/app/customers',
  '/app/conversations',
  '/app/settings',
];
```

## 4.2 Manual Verification Checklist

For each route, verify:
- [ ] Page loads without console errors
- [ ] Correct layout wraps the page (admin layout vs app layout)
- [ ] Navigation highlights the correct item
- [ ] Page title/header matches nav label

## 4.3 Report Format

After verification, report:

```markdown
## Hookup Verification Report

### Completed Connections
| Route | Component | Status |
|-------|-----------|--------|
| /admin/moderation/ai-queue | AIQueuePage | ✅ Working |
| /app/availability | AvailabilityConsole | ✅ Working |

### Still Placeholder (no existing component found)
| Route | Current State | Notes |
|-------|---------------|-------|
| /admin/logs | "Coming soon..." | No LogsPage exists in codebase |

### Issues Found
| Route | Issue | Resolution |
|-------|-------|------------|
| /app/catalog | Import error | Fixed missing export |
```

---

# PHASE 5: CLEANUP

## 5.1 Remove Inline Placeholders

If App.tsx has inline placeholder functions like:

```typescript
function AvailabilityConsole() {
  return <div>Coming soon...</div>;
}
```

Replace with imports to actual pages (if they exist) or move to proper files.

## 5.2 Standardize Page Structure

Ensure all pages follow the pattern:

```typescript
// client/src/pages/admin/AIQueue.tsx
export default function AIQueuePage() {
  return (
    <div style={{ padding: '32px' }}>
      <h1>AI Queue</h1>
      {/* Page content */}
    </div>
  );
}
```

## 5.3 Consolidate Duplicate Pages

If you find multiple versions of the same page (e.g., old and new), keep the most complete one and remove duplicates.

---

# EXECUTION CHECKLIST

Complete these in order:

- [ ] Phase 1.1: Scan existing pages, create inventory table
- [ ] Phase 1.2: Scan navigation definitions, create nav table
- [ ] Phase 2.1-2.3: Gap analysis, create gap report
- [ ] Phase 3: Execute hookups for all identified gaps
- [ ] Phase 4: Verify all routes load correctly
- [ ] Phase 5: Cleanup placeholders and duplicates
- [ ] Final: Post complete verification report

---

# DELIVERABLES

When complete, provide:

1. **Inventory Table** — All pages found in codebase
2. **Gap Report** — What was missing/broken
3. **Actions Taken** — What you connected
4. **Verification Report** — All routes tested with status
5. **Remaining Placeholders** — Routes that still need pages built

---

# IMPORTANT NOTES

- This is a CONNECTION task, not a BUILD task
- Do not create new features
- Do not redesign existing pages
- Do not modify business logic
- Focus only on routing and imports
- If a page doesn't exist, leave it as placeholder and note it in the report

**Begin with Phase 1. Report your inventory before proceeding to Phase 2.**

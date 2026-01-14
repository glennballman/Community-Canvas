# V1 UI Inventory

Generated: January 14, 2026

---

## 1. Route Tree

### Three Route Trees (per App.tsx header)
1. `/c/:slug/*` - Public portal (no auth)
2. `/app/*` - Tenant app (auth required)
3. `/admin/*` - Platform admin (admin only)

### Public Routes (No Auth)

| Route | File | Status |
|-------|------|--------|
| `/p/:portalSlug` | `pages/public/PortalHomePage.tsx` | Working |
| `/p/:portalSlug/reserve` | `pages/public/PortalReservePage.tsx` | Working |
| `/p/:portalSlug/reserve/:assetId` | `pages/public/PortalReservePage.tsx` | Working |
| `/trip/:accessCode` | `pages/public/TripPortalPage.tsx` | Working |
| `/c/:slug` | `layouts/PublicPortalLayout.tsx` | Placeholder |
| `/c/:slug/businesses` | Inline PortalSection | Placeholder |
| `/c/:slug/services` | Inline PortalSection | Placeholder |
| `/c/:slug/stay` | Inline PortalSection | Placeholder |
| `/c/:slug/events` | Inline PortalSection | Placeholder |
| `/c/:slug/about` | Inline PortalSection | Placeholder |
| `/portal/:portalSlug/p/:presentationSlug` | `pages/public/PresentationViewer.tsx` | Working |
| `/login` | `pages/auth/LoginPage.tsx` | Working |

### Tenant App Routes (`/app/*`)

| Route | File | Status |
|-------|------|--------|
| `/app` | `pages/app/TenantPicker.tsx` | Working |
| `/app/dashboard` | `pages/app/Dashboard.tsx` | Working |
| `/app/availability` | `pages/app/community/AvailabilityConsole.tsx` | Working |
| `/app/operations` | `pages/app/operations/OperationsBoard.tsx` | Working |
| `/app/service-runs` | `pages/services/ServiceRuns.tsx` | Working |
| `/app/service-runs/new` | `pages/services/CreateServiceRun.tsx` | Working |
| `/app/service-runs/:slug` | `pages/services/ServiceRunDetail.tsx` | Working |
| `/app/work-requests/:id` | `pages/WorkRequestDetail.tsx` | Working |
| `/app/services` | `pages/services/ServiceDirectory.tsx` | Working |
| `/app/bundles` | `pages/services/BundlesBrowser.tsx` | Working |
| `/app/directory` | `pages/app/community/DirectoryPage.tsx` | Working |
| `/app/content` | `pages/app/community/ContentBrandingPage.tsx` | Working |
| `/app/crm/places` | `pages/crm/PlacesList.tsx` | Working |
| `/app/crm/places/:id` | `pages/crm/PlaceDetail.tsx` | Working |
| `/app/crm/people` | `pages/crm/PeopleList.tsx` | Working |
| `/app/crm/people/:id` | `pages/crm/PersonDetail.tsx` | Working |
| `/app/crm/orgs` | `pages/crm/OrgsList.tsx` | Working |
| `/app/crm/orgs/:id` | `pages/crm/OrgDetail.tsx` | Working |
| `/app/intake/work-requests` | `pages/intake/WorkRequestsList.tsx` | Working |
| `/app/intake/work-requests/:id` | `pages/intake/WorkRequestDetail.tsx` | Working |
| `/app/projects` | `pages/projects/ProjectsList.tsx` | Working |
| `/app/projects/new` | `pages/projects/CreateProject.tsx` | Working |
| `/app/projects/:id` | `pages/projects/ProjectDetail.tsx` | Working |
| `/app/assets` | `pages/app/business/InventoryPage.tsx` | Working |
| `/app/assets/:id` | `pages/app/business/InventoryItemDetail.tsx` | Working |
| `/app/reservations` | `pages/app/business/ReservationsPage.tsx` | Working |
| `/app/customers` | `pages/app/business/CustomersPage.tsx` | Working |
| `/app/messages` | `pages/ConversationsPage.tsx` | Working |
| `/app/settings` | `pages/app/SettingsPage.tsx` | Working |
| `/app/inventory` | Redirect → `/app/assets` | Redirect |
| `/app/inventory/:id` | Redirect → `/app/assets/:id` | Redirect |

### Platform Admin Routes (`/admin/*`)

| Route | File | Status |
|-------|------|--------|
| `/admin` | `pages/admin/CivOSDashboard.tsx` (index) | Working |
| `/admin/tenants` | `pages/admin/TenantsManagement.tsx` | Working |
| `/admin/users` | `pages/admin/UsersManagement.tsx` | Working |
| `/admin/impersonation` | `pages/admin/ImpersonationConsole.tsx` | Working |
| `/admin/data/infrastructure` | `pages/AdminInfrastructure.tsx` | Working |
| `/admin/data/chambers` | `pages/AdminChambers.tsx` | Working |
| `/admin/data/naics` | `pages/AdminNAICS.tsx` | Working |
| `/admin/data/accommodations` | `pages/Accommodations.tsx` | Working |
| `/admin/assets` | `pages/admin/AdminInventory.tsx` | Working |
| `/admin/system-explorer` | `pages/app/SystemExplorerPage.tsx` | Working |
| `/admin/articles` | `pages/admin/ArticlesPage.tsx` | Working |
| `/admin/data/import-export` | `pages/admin/DataImport.tsx` | Working |
| `/admin/communities` | `pages/admin/CommunitiesPage.tsx` | Working |
| `/admin/communities/seed` | `pages/admin/SeedCommunitiesPage.tsx` | Working |
| `/admin/communities/portals` | `pages/admin/PortalConfigPage.tsx` | Working |
| `/admin/moderation/ai-queue` | `pages/admin/AIQueuePage.tsx` | Working |
| `/admin/moderation/flagged` | `pages/admin/FlaggedContentPage.tsx` | Working |
| `/admin/settings` | `pages/AdminSettings.tsx` | Working |
| `/admin/logs` | `pages/AdminLogs.tsx` | Working |

### Legacy/Unused Pages (in pages/ but not routed)

| File | Notes |
|------|-------|
| `pages/Dashboard.tsx` | Old dashboard - not used |
| `pages/Documentation.tsx` | Not routed |
| `pages/FleetPage.tsx` | Not routed |
| `pages/host/*` | Host-specific pages - not in main routes |
| `pages/NavigationHub.tsx` | Not routed |
| `pages/rentals/*` | Not routed |
| `pages/staging/*` | Staging pages - not in main routes |
| `pages/TripTimelineDemo.tsx` | Demo page |
| `pages/WorkRequestBoard.tsx` | Old version |

---

## 2. Navigation Structure

### Tenant App Layout
**File:** `client/src/layouts/TenantAppLayout.tsx`

Navigation varies by tenant type:

#### Community/Government Nav (COMMUNITY_NAV)
```
- Dashboard          → /app/dashboard
- Availability       → /app/availability
- Operations         → /app/operations
- Service Runs       → /app/service-runs
- Services           → /app/services
- Bundles            → /app/bundles
- Directory          → /app/directory
- Work Requests      → /app/intake/work-requests
- Projects           → /app/projects
- Places             → /app/crm/places
- People             → /app/crm/people
- Organizations      → /app/crm/orgs
- Content            → /app/content
- Settings           → /app/settings
```

#### Business Nav (BUSINESS_NAV)
```
- Dashboard          → /app/dashboard
- Assets             → /app/assets
- Reservations       → /app/reservations
- Operations         → /app/operations
- Work Requests      → /app/intake/work-requests
- Projects           → /app/projects
- Places             → /app/crm/places
- People             → /app/crm/people
- Organizations      → /app/crm/orgs
- Messages           → /app/messages
- Settings           → /app/settings
```

#### Individual Nav (INDIVIDUAL_NAV)
```
- Dashboard          → /app/dashboard
- Messages           → /app/messages
- Settings           → /app/settings
```

### Platform Admin Layout
**File:** `client/src/layouts/PlatformAdminLayout.tsx`

```
OVERVIEW:
- Dashboard          → /admin

TENANTS & USERS:
- Tenants            → /admin/tenants
- Users              → /admin/users
- Impersonation      → /admin/impersonation

DATA MANAGEMENT:
- Infrastructure     → /admin/data/infrastructure
- Chambers           → /admin/data/chambers
- NAICS              → /admin/data/naics
- Accommodations     → /admin/data/accommodations
- Assets (Audit)     → /admin/assets
- System Explorer    → /admin/system-explorer
- Articles           → /admin/articles
- Import/Export      → /admin/data/import-export

COMMUNITIES:
- All Communities    → /admin/communities
- Seed Communities   → /admin/communities/seed
- Portal Config      → /admin/communities/portals

MODERATION:
- AI Queue           → /admin/moderation/ai-queue
- Flagged Content    → /admin/moderation/flagged

SYSTEM:
- Settings           → /admin/settings
- Logs               → /admin/logs
```

---

## 3. API Endpoints Used

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/api/accommodations` | GET | Accommodations.tsx |
| `/api/accommodations/import` | POST | Accommodations.tsx |
| `/api/accommodations/stats` | GET | Accommodations.tsx |
| `/api/admin/inventory` | GET | AdminInventory.tsx |
| `/api/auth/logout` | GET | TenantAppLayout.tsx |
| `/api/chambers/locations` | GET | AdminNAICS.tsx |
| `/api/config/mapbox-token` | GET | AdminNAICS.tsx |
| `/api/naics/tree` | GET | AdminNAICS.tsx |
| `/api/opportunities` | POST | CreateOpportunityWizard.tsx |
| `/api/tools` | GET | CreateOpportunityWizard.tsx |
| `/api/uploads` | POST | CreateOpportunityWizard.tsx |

**Note:** Many more endpoints exist but are defined dynamically via queryKey patterns. Full API audit needed from server/routes/.

---

## 4. Component Library

### Root Components (`/components/`)

| Component | Type | Purpose |
|-----------|------|---------|
| `app-sidebar.tsx` | sidebar | City Command sidebar (legacy) |
| `AuthModal.tsx` | modal | Authentication modal |
| `DashboardLayout.tsx` | layout | Dashboard wrapper |
| `EmptyState.tsx` | display | Empty state placeholder |
| `ErrorBoundary.tsx` | utility | Error boundary |
| `GeoTree.tsx` | tree | Geographic hierarchy tree |
| `HostLayout.tsx` | layout | Host portal layout |
| `ImpersonationBanner.tsx` | banner | Impersonation warning |
| `MainNav.tsx` | navigation | Main navigation |
| `MobileFilterSheet.tsx` | sheet | Mobile filters |
| `MobileNav.tsx` | navigation | Mobile navigation |
| `PortalSelector.tsx` | selector | Portal/tenant selector |
| `PropertyMap.tsx` | map | Property location map |
| `StatusBadge.tsx` | badge | Status indicator |
| `StatusCard.tsx` | card | Status card |
| `TripRouteMap.tsx` | map | Trip route visualization |
| `UserMenu.tsx` | menu | User dropdown menu |

### UI Components (`/components/ui/`)

| Component | Type |
|-----------|------|
| accordion | ui |
| alert-dialog | ui |
| alert | ui |
| api-error-banner | ui |
| aspect-ratio | ui |
| avatar | ui |
| badge | ui |
| breadcrumb | ui |
| button | ui |
| calendar | ui |
| card | ui |
| carousel | ui |
| chart | ui |
| checkbox | ui |
| collapsible | ui |
| command | ui |
| context-menu | ui |
| dialog | ui |
| drawer | ui |
| dropdown-menu | ui |
| form | ui |
| hover-card | ui |
| input-otp | ui |
| input | ui |
| label | ui |
| menubar | ui |
| navigation-menu | ui |
| pagination | ui |
| popover | ui |
| progress | ui |
| radio-group | ui |
| resizable | ui |
| scroll-area | ui |
| select | ui |
| separator | ui |
| sheet | ui |
| sidebar | ui |
| skeleton | ui |
| slider | ui |
| switch | ui |
| table | ui |
| tabs | ui |
| textarea | ui |
| toast | ui |
| toaster | ui |
| toggle-group | ui |
| toggle | ui |
| tooltip | ui |

### Feature Components

| Directory | Components |
|-----------|------------|
| `/Dashboard/` | DashboardLayout, WebcamGrid, WebcamsTab |
| `/TripPlanning/` | RouteExplorer, SafetyEquipmentChecklist, ParticipantProfileForm, TripTimelineView |
| `/Fleet/` | DriverQualificationsForm |
| `/conversations/` | ConversationView, ConversationList |
| `/accommodations/` | PropertyDetails |
| `/admin/` | Various admin components |
| `/aiAssist/` | AIAssistPanel |
| `/feedback/` | Feedback components |
| `/financing/` | Financing components |
| `/payments/` | Payment components |
| `/schedule/` | ScheduleBoard |
| `/trust/` | Trust/verification components |
| `/widgets/` | Dashboard widgets |
| `/dev/` | DebugPanel |

---

## 5. Shell/Layout Structure

### Layouts Directory
```
client/src/layouts/
├── PlatformAdminLayout.tsx  (9.5KB)
├── PublicPortalLayout.tsx   (10KB)
└── TenantAppLayout.tsx      (22KB)
```

### TenantAppLayout Structure
```
<div style="minHeight: 100vh, backgroundColor: #060b15">
  ├── <aside> Sidebar (256px or 64px collapsed)
  │   ├── Tenant Switcher Dropdown
  │   ├── Navigation Items (varies by tenant type)
  │   ├── User Menu (bottom)
  │   └── "My Places" Link
  │
  └── <main> Content Area
      └── <Outlet /> (renders page component)
```

### PlatformAdminLayout Structure
```
<div style="minHeight: 100vh, backgroundColor: #060b15">
  ├── <aside> Sidebar (256px)
  │   ├── Admin Header
  │   ├── Sectioned Navigation
  │   └── "Back to App" Link
  │
  └── <main> Content Area
      └── <Outlet />
```

### Global Components
- `ImpersonationBanner` - Shows when admin is impersonating a tenant
- `DebugPanel` - DEV ONLY - API monitoring panel

---

## 6. Page Status

| Page | Route | Data Source | Status |
|------|-------|-------------|--------|
| Tenant Picker | `/app` | memberships API | Working |
| Dashboard | `/app/dashboard` | Various | Working |
| Availability | `/app/availability` | schedules API | Working |
| Operations Board | `/app/operations` | operations API | Working |
| Service Runs | `/app/service-runs` | service-runs API | Working |
| Service Directory | `/app/services` | services API | Working |
| Bundles | `/app/bundles` | bundles API | Working |
| Directory | `/app/directory` | directory API | Working |
| Content/Branding | `/app/content` | content API | Working |
| Places List | `/app/crm/places` | places API | Working |
| Place Detail | `/app/crm/places/:id` | places API | Working |
| People List | `/app/crm/people` | people API | Working |
| Person Detail | `/app/crm/people/:id` | people API | Working |
| Orgs List | `/app/crm/orgs` | organizations API | Working |
| Org Detail | `/app/crm/orgs/:id` | organizations API | Working |
| Work Requests | `/app/intake/work-requests` | work-requests API | Working |
| Projects | `/app/projects` | projects API | Working |
| Assets | `/app/assets` | assets/inventory API | Working |
| Reservations | `/app/reservations` | reservations API | Working |
| Customers | `/app/customers` | customers API | Working |
| Messages | `/app/messages` | conversations API | Working |
| Settings | `/app/settings` | settings API | Working |

---

## 7. Role-Based Elements

| Element | Roles Affected | Logic Location |
|---------|----------------|----------------|
| Platform Admin access | `isPlatformAdmin` | AuthContext, TenantContext |
| Admin layout access | `is_platform_admin` | PlatformAdminLayout.tsx |
| Tenant nav items | `tenant_type` | TenantAppLayout.tsx (COMMUNITY_NAV, BUSINESS_NAV, INDIVIDUAL_NAV) |
| Impersonation | `platform_admin` | ImpersonationBanner, TenantContext |
| Conversation roles | `my_role` (owner/contractor) | ConversationsPage.tsx |
| Membership roles | `role` (admin/owner/member) | TenantPicker, Dashboard |
| Role title display | `role_title` | CRM People pages |

### Key Role Checks
```tsx
// Auth Context
isPlatformAdmin: boolean;

// Tenant Context  
role: string; // 'admin', 'owner', 'member'
tenant_type: string; // 'community', 'government', 'business', 'individual'

// Layout Guards
if (!user?.is_platform_admin) { navigate('/app'); }
```

---

## 8. Terminology Violations

### Banned Terms Count

| Term | Count | Action Required |
|------|-------|-----------------|
| `booking` | 3 | MUST FIX → `reservation` |
| `booked` | 5 | MUST FIX → `reserved`/`scheduled` |
| `booker` | 0 | OK |
| `contacts` | 11 | REVIEW → may be OK for context |
| `inventory` | 20+ | REVIEW → use `assets` for rentable items |

### Specific Violations

**booking/booked occurrences:**

| File | Line | Content | Fix |
|------|------|---------|-----|
| `TripPlanning/TripTimelineView.tsx` | type | `'not_booked'` | → `'not_scheduled'` |
| `TripPlanning/TripTimelineView.tsx` | case | `case 'not_booked':` | → `'not_scheduled'` |
| `TripPlanning/TripTimelineView.tsx` | check | `status === 'not_booked'` | → `'not_scheduled'` |
| `accommodations/PropertyDetails.tsx` | link | `'Booking.com'` | OK - external brand name |
| `data/sampleBamfieldTrip.ts` | link | `'manage-booking'` | OK - external URL |
| `data/sampleBamfieldTrip.ts` | status | `'not_booked'` | → `'not_scheduled'` |
| `data/sampleBamfieldTrip.ts` | desc | `'cabins booked'` | → `'cabins reserved'` |

**inventory mentions:**
- Most are file/function names (`InventoryPage.tsx`, `AdminInventory.tsx`)
- Should rename to `AssetsPage.tsx` in V3
- API endpoints should use `/api/assets` not `/api/inventory`

---

## 9. Context Providers

### Provider Hierarchy (App.tsx)
```tsx
<QueryClientProvider>
  <BrowserRouter>
    <AuthProvider>
      <TenantProvider>
        <PortalProvider>
          {/* Routes */}
        </PortalProvider>
      </TenantProvider>
    </AuthProvider>
  </BrowserRouter>
</QueryClientProvider>
```

### Context Files
- `contexts/AuthContext.tsx` - User authentication state
- `contexts/TenantContext.tsx` - Current tenant and memberships
- `contexts/PortalContext.tsx` - Portal configuration

---

## 10. Missing from V3

### Features Not Yet in UI
- [ ] Wallet Overview
- [ ] Payment Rails
- [ ] Stored Value (top-up/cash-out)
- [ ] Permits Management
- [ ] Trip Planning (full version)
- [ ] Capability/Work Order Planning
- [ ] Entity Presentations Editor
- [ ] Operator Onboarding Wizard
- [ ] Multi-Portal Management

### API Routes Not Wired
- `/api/wallet/*`
- `/api/rail/*`
- `/api/permits/*`
- `/api/trips/*`
- `/api/operators/*`
- `/api/presentations/*`

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Routes | 67 |
| Public Routes | 12 |
| Tenant App Routes | 30 |
| Admin Routes | 18 |
| Legacy/Unused Pages | 15+ |
| UI Components | 50+ |
| Feature Components | 30+ |
| Terminology Violations | 8 |
| Layouts | 3 |
| Context Providers | 3 |

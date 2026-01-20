# V3.5 UI Routes Inventory

**Generated:** 2026-01-20  
**Source:** `client/src/App.tsx`, page files

---

## Route Summary

| Category | Count |
|----------|-------|
| Public Routes | 23 |
| Tenant App Routes (/app/*) | 78 |
| Platform Admin Routes (/admin/*) | 17 |
| Dev Routes | 2 |
| **Total** | **120** |

---

## Part 1: Public Routes (No Auth Required)

| Route | Page File | Shell | Guards | Notes |
|-------|-----------|-------|--------|-------|
| `/` | Redirect to `/app` | - | None | Landing redirect |
| `/login` | `pages/auth/LoginPage.tsx` | None | None | Auth entry |
| `/c/:slug` | `pages/portal/CommunityPortalHome.tsx` | PublicPortalLayout | None | Community portal home |
| `/c/:slug/businesses` | PortalSection (inline) | PublicPortalLayout | None | Businesses tab |
| `/c/:slug/services` | PortalSection (inline) | PublicPortalLayout | None | Services tab |
| `/c/:slug/stay` | PortalSection (inline) | PublicPortalLayout | None | Accommodations tab |
| `/c/:slug/events` | PortalSection (inline) | PublicPortalLayout | None | Events tab |
| `/c/:slug/about` | PortalSection (inline) | PublicPortalLayout | None | About tab |
| `/p/:portalSlug` | `pages/public/PortalHomePage.tsx` | None | None | Business portal home |
| `/p/:portalSlug/onboarding` | `pages/public/PortalOnboardingPage.tsx` | None | None | Operator onboarding |
| `/p/:portalSlug/reserve` | `pages/public/PortalReservePage.tsx` | None | None | Public reservation start |
| `/p/:portalSlug/reserve/:assetId` | `pages/public/PortalReservePage.tsx` | None | None | Asset reservation |
| `/p/proposal/:proposalId` | `pages/public/PublicProposalPage.tsx` | None | None | Public proposal view |
| `/p/proposal/:proposalId/pay/:token` | `pages/public/PublicProposalPage.tsx` | None | None | Split-pay view |
| `/trip/:accessCode` | `pages/public/TripPortalPage.tsx` | None | None | Guest trip portal |
| `/b/:portalSlug/jobs` | `pages/public/PortalJobsPage.tsx` | None | None | Public jobs listing |
| `/b/:portalSlug/jobs/:postingId` | `pages/public/PortalJobDetailPage.tsx` | None | None | Job detail view |
| `/b/:portalSlug/jobs/:postingId/apply` | `pages/public/PortalJobApplyPage.tsx` | None | None | Job application form |
| `/b/:portalSlug/apply/:campaignKey` | `pages/public/PortalCampaignApplyPage.tsx` | None | None | Campaign apply |
| `/b/:portalSlug/employers/:employerId` | `pages/public/PortalEmployerPage.tsx` | None | None | Employer profile |
| `/reserve/resume` | `public/pages/ResumePage.tsx` | ReserveShell | None | Resume reservation |
| `/reserve/status/:token` | `public/pages/ReservationStatusPage.tsx` | ReserveShell | None | Reservation status |
| `/reserve/confirmation/:token` | `public/pages/ConfirmationPage.tsx` | ReserveShell | None | Confirmation page |
| `/reserve/:portalSlug/:offerSlug` | `public/pages/OfferLandingPage.tsx` | ReserveShell | None | Offer landing |
| `/reserve/:portalSlug/:offerSlug/start/*` | Multi-step wizard | ReserveShell | None | Reservation flow |
| `/portal/:portalSlug/p/:presentationSlug` | `pages/public/PresentationViewer.tsx` | None | None | Presentation viewer |

---

## Part 2: Tenant App Routes (/app/*)

All routes under `/app/*` use `TenantAppLayout` shell and require authentication.

### Core Navigation

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app` | `pages/app/TenantPicker.tsx` | Auth | Tenant picker (root) |
| `/app/dashboard` | `pages/app/DashboardPage.tsx` | Auth+Tenant | Main dashboard |

### Operations

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/ops` | `pages/app/OpsBoardPage.tsx` | Auth+Tenant | Operations board |
| `/app/ops/housekeeping` | `pages/app/ops/HousekeepingPage.tsx` | Auth+Tenant | Housekeeping tasks |
| `/app/ops/incidents` | `pages/app/ops/IncidentsPage.tsx` | Auth+Tenant | Incidents console |
| `/app/operations` | `pages/app/operations/OperationsBoard.tsx` | Auth+Tenant | Legacy ops board |

### Reservations

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/parking` | `pages/app/ParkingPage.tsx` | Auth+Tenant | Parking overview |
| `/app/parking/plan` | `pages/app/ParkingPlanPage.tsx` | Auth+Tenant | Parking plan view |
| `/app/marina` | `pages/app/MarinaPage.tsx` | Auth+Tenant | Marina overview |
| `/app/marina/plan` | `pages/app/MarinaPlanPage.tsx` | Auth+Tenant | Marina plan view |
| `/app/hospitality` | `pages/app/HospitalityPage.tsx` | Auth+Tenant | Hospitality |
| `/app/reservations` | `pages/app/ReservationsIndexPage.tsx` | Auth+Tenant | Reservations list |
| `/app/reservations/:id` | `pages/app/ReservationDetailPage.tsx` | Auth+Tenant | Reservation detail |
| `/app/proposals/:proposalId` | `pages/app/ProposalDetailPage.tsx` | Auth+Tenant | Proposal detail |

### Jobs (V3.5)

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/jobs` | `pages/app/jobs/JobsIndexPage.tsx` | Auth+Tenant | Jobs index |
| `/app/jobs/new` | `pages/app/jobs/JobEditorPage.tsx` | Auth+Tenant | Create job |
| `/app/jobs/:id/edit` | `pages/app/jobs/JobEditorPage.tsx` | Auth+Tenant | Edit job |
| `/app/jobs/:id/destinations` | `pages/app/jobs/JobDestinationsPage.tsx` | Auth+Tenant | Job destinations |
| `/app/jobs/:jobId/applications` | `pages/app/jobs/JobApplicationsPage.tsx` | Auth+Tenant | Job applications |
| `/app/jobs/:jobId/emergency/:requestId` | `pages/app/jobs/JobEmergencyConfirmationPage.tsx` | Auth+Tenant | Emergency confirm |
| `/app/jobs/payments/pending` | `pages/app/jobs/PendingPaymentsPage.tsx` | Auth+Tenant | Pending payments |
| `/app/jobs/embeds` | `pages/app/jobs/EmbedConfiguratorPage.tsx` | Auth+Tenant | Embed configurator |

### Moderation

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/mod/jobs` | `pages/app/mod/JobsModerationPage.tsx` | Auth+Tenant | Jobs moderation |
| `/app/mod/paid-publications` | `pages/app/mod/PaidPublicationsModerationPage.tsx` | Auth+Tenant | Paid publications |
| `/app/mod/applications` | `pages/app/mod/ApplicationsQueuePage.tsx` | Auth+Tenant | Applications queue |
| `/app/mod/hiring-pulse` | `pages/app/mod/HiringPulsePage.tsx` | Auth+Tenant | Hiring pulse |
| `/app/mod/portals/:portalId/growth` | `pages/app/mod/PortalGrowthPage.tsx` | Auth+Tenant+Portal | Portal growth |
| `/app/mod/portals/:portalId/housing-waitlist` | `pages/app/mod/HousingWaitlistPage.tsx` | Auth+Tenant+Portal | Housing waitlist |
| `/app/mod/housing` | `pages/app/mod/HousingWaitlistPage.tsx` | Auth+Tenant | Housing (no portal) |
| `/app/mod/portals/:portalId/bench` | `pages/app/mod/BenchPage.tsx` | Auth+Tenant+Portal | Bench page |
| `/app/mod/portals/:portalId/emergency` | `pages/app/mod/EmergencyPage.tsx` | Auth+Tenant+Portal | Emergency page |
| `/app/portals/:portalId/housing` | `pages/app/TenantHousingOfferPage.tsx` | Auth+Tenant+Portal | Housing offer |

### Work & Services

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/work-requests` | `pages/intake/WorkRequestsList.tsx` | Auth+Tenant | Work requests list |
| `/app/work-requests/:id` | `pages/WorkRequestDetail.tsx` | Auth+Tenant | Work request detail |
| `/app/services/runs` | `pages/services/ServiceRuns.tsx` | Auth+Tenant | Service runs |
| `/app/services/runs/new` | `pages/services/CreateServiceRun.tsx` | Auth+Tenant | Create service run |
| `/app/services/runs/:slug` | `pages/services/ServiceRunDetail.tsx` | Auth+Tenant | Run detail |
| `/app/services/calendar` | `pages/app/ServiceRunsCalendarPage.tsx` | Auth+Tenant | Calendar view |
| `/app/services` | `pages/services/ServiceDirectory.tsx` | Auth+Tenant | Service directory |
| `/app/bundles` | `pages/services/BundlesBrowser.tsx` | Auth+Tenant | Bundles browser |
| `/app/enforcement` | `pages/app/EnforcementPage.tsx` | Auth+Tenant | Compliance |

### N3 Service Run Monitor (Patent CC-01)

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/n3/attention` | `pages/n3/ServiceRunAttentionPage.tsx` | Auth+Tenant | Attention queue |
| `/app/n3/monitor/:runId` | `pages/n3/ServiceRunMonitorPage.tsx` | Auth+Tenant | Run monitor |

### Assets & Business

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/assets` | `pages/app/business/InventoryPage.tsx` | Auth+Tenant | Assets/Inventory |
| `/app/assets/:id` | `pages/app/business/InventoryItemDetail.tsx` | Auth+Tenant | Asset detail |
| `/app/customers` | `pages/app/business/CustomersPage.tsx` | Auth+Tenant | Customers |
| `/app/availability` | `pages/app/community/AvailabilityConsole.tsx` | Auth+Tenant | Availability console |
| `/app/directory` | `pages/app/community/DirectoryPage.tsx` | Auth+Tenant | Directory |
| `/app/content` | `pages/app/community/ContentBrandingPage.tsx` | Auth+Tenant | Content/branding |

### CRM

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/crm/places` | `pages/crm/PlacesList.tsx` | Auth+Tenant | Places list |
| `/app/crm/places/:id` | `pages/crm/PlaceDetail.tsx` | Auth+Tenant | Place detail |
| `/app/crm/people` | `pages/crm/PeopleList.tsx` | Auth+Tenant | People list |
| `/app/crm/people/:id` | `pages/crm/PersonDetail.tsx` | Auth+Tenant | Person detail |
| `/app/crm/orgs` | `pages/crm/OrgsList.tsx` | Auth+Tenant | Organizations |
| `/app/crm/orgs/:id` | `pages/crm/OrgDetail.tsx` | Auth+Tenant | Org detail |

### Projects

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/projects` | `pages/projects/ProjectsList.tsx` | Auth+Tenant | Projects list |
| `/app/projects/new` | `pages/projects/CreateProject.tsx` | Auth+Tenant | Create project |
| `/app/projects/:id` | `pages/projects/ProjectDetail.tsx` | Auth+Tenant | Project detail |

### Intake

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/intake/work-requests` | `pages/intake/WorkRequestsList.tsx` | Auth+Tenant | Work requests |
| `/app/intake/work-requests/:id` | `pages/intake/WorkRequestDetail.tsx` | Auth+Tenant | Request detail |

### Participant Routes

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/participant/trips` | `pages/app/participant/MyTripsPage.tsx` | Auth+Tenant | My trips |
| `/app/participant/trips/:tripId` | `pages/app/participant/TripDetailPage.tsx` | Auth+Tenant | Trip detail |
| `/app/participant/applications` | `pages/app/participant/MyApplicationsPage.tsx` | Auth+Tenant | My applications |
| `/app/participant/applications/:appId` | `pages/app/participant/ApplicationDetailPage.tsx` | Auth+Tenant | Application detail |

### Fleet (P-UI-15)

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/fleet` | `pages/app/fleet/FleetPage.tsx` | Auth+Tenant | Fleet dashboard |
| `/app/fleet/assets` | `pages/app/fleet/FleetAssetsPage.tsx` | Auth+Tenant | Fleet assets |
| `/app/fleet/assets/:id` | `pages/app/fleet/FleetAssetDetailPage.tsx` | Auth+Tenant | Asset detail |
| `/app/fleet/maintenance` | `pages/app/fleet/FleetMaintenancePage.tsx` | Auth+Tenant | Maintenance |

### Communication

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/messages` | `pages/ConversationsPage.tsx` | Auth+Tenant | Messages |
| `/app/notifications` | `pages/app/NotificationsPage.tsx` | Auth+Tenant | Notifications |
| `/app/circles` | `pages/app/circles/CirclesListPage.tsx` | Auth+Tenant | Circles list |
| `/app/circles/new` | `pages/app/circles/CircleCreatePage.tsx` | Auth+Tenant | Create circle |
| `/app/circles/:circleId` | `pages/app/circles/CircleDetailPage.tsx` | Auth+Tenant | Circle detail |
| `/app/circles/switch` | `pages/app/CirclesPage.tsx` | Auth+Tenant | Circle switcher |
| `/app/settings` | `pages/app/SettingsPage.tsx` | Auth+Tenant | Settings |

### Tenant Admin

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/admin` | `pages/app/admin/AdminHomePage.tsx` | Auth+Tenant+Admin | Admin home |
| `/app/admin/roles` | `pages/app/admin/AdminRolesPage.tsx` | Auth+Tenant+Admin | Role management |
| `/app/admin/settings` | `pages/app/admin/AdminSettingsPage.tsx` | Auth+Tenant+Admin | Portal settings |
| `/app/admin/folios` | `pages/app/admin/FoliosListPage.tsx` | Auth+Tenant+Admin | Folios list |
| `/app/admin/folios/:id` | `pages/app/admin/FolioDetailPage.tsx` | Auth+Tenant+Admin | Folio detail |
| `/app/admin/usage` | `pages/app/admin/UsageSummaryPage.tsx` | Auth+Tenant+Admin | Usage summary |
| `/app/admin/certifications` | `pages/app/admin/CertificationsPage.tsx` | Auth+Tenant+Admin | Certifications |
| `/app/admin/portals` | `pages/app/admin/PortalsPage.tsx` | Auth+Tenant+Admin | Portals |
| `/app/admin/portals/:portalId/appearance` | `pages/app/admin/PortalAppearancePage.tsx` | Auth+Tenant+Admin | Portal appearance |
| `/app/admin/tenants` | `pages/app/admin/TenantsPage.tsx` | Auth+Tenant+Admin | Tenants (sub) |

### Operator

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/operator` | `pages/app/operator/OperatorHomePage.tsx` | Auth+Tenant | Operator home |
| `/app/operator/emergency` | `pages/app/operator/OperatorEmergencyIndexPage.tsx` | Auth+Tenant | Emergency index |
| `/app/operator/emergency/:runId` | `pages/app/operator/OperatorEmergencyRunPage.tsx` | Auth+Tenant | Emergency run |
| `/app/operator/legal` | `pages/app/operator/OperatorLegalHoldsIndexPage.tsx` | Auth+Tenant | Legal holds |
| `/app/operator/legal/:holdId` | `pages/app/operator/OperatorLegalHoldDetailPage.tsx` | Auth+Tenant | Hold detail |
| `/app/operator/insurance` | `pages/app/operator/OperatorInsuranceIndexPage.tsx` | Auth+Tenant | Insurance |
| `/app/operator/insurance/claims/:claimId` | `pages/app/operator/OperatorInsuranceClaimPage.tsx` | Auth+Tenant | Claim detail |
| `/app/operator/disputes` | `pages/app/operator/OperatorDisputesIndexPage.tsx` | Auth+Tenant | Disputes |
| `/app/operator/disputes/:disputeId` | `pages/app/operator/OperatorDisputePage.tsx` | Auth+Tenant | Dispute detail |
| `/app/operator/authority` | `pages/app/operator/OperatorAuthorityIndexPage.tsx` | Auth+Tenant | Authority |
| `/app/operator/authority/grants/:grantId` | `pages/app/operator/OperatorAuthorityGrantPage.tsx` | Auth+Tenant | Grant detail |
| `/app/operator/audit` | `pages/app/operator/OperatorAuditPage.tsx` | Auth+Tenant | Audit |

### Platform Admin (in Tenant Shell)

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/platform/tenants` | `pages/app/platform/TenantsListPage.tsx` | Auth+PlatformAdmin | Tenants list |
| `/app/platform/tenants/:tenantId` | `pages/app/platform/TenantDetailPage.tsx` | Auth+PlatformAdmin | Tenant detail |
| `/app/platform/analytics` | `pages/app/platform/AnalyticsPage.tsx` | Auth+PlatformAdmin | Analytics |

### Dev Routes

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/app/dev/media` | `pages/app/dev/DevMediaPage.tsx` | Auth+Tenant | Media dev tool |

---

## Part 3: Platform Admin Routes (/admin/*)

All routes under `/admin/*` use `PlatformAdminLayout` shell and require `is_platform_admin = true`.

| Route | Page File | Guards | Notes |
|-------|-----------|--------|-------|
| `/admin` | `pages/admin/CivOSDashboard.tsx` | PlatformAdmin | Dashboard |
| `/admin/tenants` | `pages/admin/TenantsManagement.tsx` | PlatformAdmin | Tenants management |
| `/admin/users` | `pages/admin/UsersManagement.tsx` | PlatformAdmin | Users management |
| `/admin/impersonation` | `pages/admin/ImpersonationConsole.tsx` | PlatformAdmin | Impersonation |
| `/admin/data/infrastructure` | `pages/AdminInfrastructure.tsx` | PlatformAdmin | Infrastructure data |
| `/admin/data/chambers` | `pages/AdminChambers.tsx` | PlatformAdmin | Chambers data |
| `/admin/data/naics` | `pages/AdminNAICS.tsx` | PlatformAdmin | NAICS data |
| `/admin/data/accommodations` | `pages/Accommodations.tsx` | PlatformAdmin | Accommodations |
| `/admin/assets` | `pages/admin/AdminInventory.tsx` | PlatformAdmin | Assets audit |
| `/admin/system-explorer` | `pages/app/SystemExplorerPage.tsx` | PlatformAdmin | System explorer |
| `/admin/articles` | `pages/admin/ArticlesPage.tsx` | PlatformAdmin | Articles |
| `/admin/data/import-export` | `pages/admin/DataImport.tsx` | PlatformAdmin | Import/Export |
| `/admin/communities` | `pages/admin/CommunitiesPage.tsx` | PlatformAdmin | Communities |
| `/admin/communities/seed` | `pages/admin/SeedCommunitiesPage.tsx` | PlatformAdmin | Seed communities |
| `/admin/communities/portals` | `pages/admin/PortalConfigPage.tsx` | PlatformAdmin | Portal config |
| `/admin/moderation/ai-queue` | `pages/admin/AIQueuePage.tsx` | PlatformAdmin | AI queue |
| `/admin/moderation/flagged` | `pages/admin/FlaggedContentPage.tsx` | PlatformAdmin | Flagged content |
| `/admin/settings` | `pages/AdminSettings.tsx` | PlatformAdmin | System settings |
| `/admin/logs` | `pages/AdminLogs.tsx` | PlatformAdmin | System logs |

---

## Guard Legend

| Guard | Description |
|-------|-------------|
| None | Public route, no authentication |
| Auth | Authentication required (user logged in) |
| Auth+Tenant | Auth + tenant context required |
| Auth+Tenant+Admin | Auth + tenant + tenant admin role |
| Auth+Tenant+Portal | Auth + tenant + portal context |
| Auth+PlatformAdmin | Auth + is_platform_admin flag |
| PlatformAdmin | Enforced by PlatformAdminLayout |

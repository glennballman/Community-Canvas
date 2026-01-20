# V3.5 Subsystem UI Coverage

**Generated:** 2026-01-20

---

## Subsystem Coverage Summary

| Subsystem | Routes | Nav Entry | Discoverability |
|-----------|--------|-----------|-----------------|
| Reservations | 5 | Partial | Medium |
| Availability/Proposal | 8 | No | Low (public flow) |
| Participant Trips | 2 | V3_NAV only | Low |
| Messaging | 1 | Yes | High |
| Notifications | 1 | V3_NAV only | Low |
| Jobs | 10 | No | Low |
| Service Runs | 4 | Yes (community) | High |
| Work Requests | 3 | Yes | High |
| Assets/Capability | 2 | Yes (business) | High |
| Operations Board | 3 | Partial | Medium |
| Housekeeping | 1 | V3_NAV only | Low |
| Fleet | 4 | V3_NAV only | Low |
| Circles | 4 | No | Low |
| Admin | 9 | Settings link | Low |
| Platform | 3 | V3_NAV only | Low |
| Media | 1 | No | Low (dev only) |

---

## Detailed Subsystem Inventory

### 1. Reservations (Public + Portal)

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/reservations` | ReservationsIndexPage | List reservations |
| `/app/reservations/:id` | ReservationDetailPage | View/manage reservation |
| `/app/parking` | ParkingPage | Parking overview |
| `/app/marina` | MarinaPage | Marina overview |
| `/app/hospitality` | HospitalityPage | Hospitality overview |

**Left-Nav Entry:** 
- BUSINESS_NAV: `/app/reservations` (Reservations)
- V3_NAV: Parking, Marina, Hospitality (not wired)

**Primary CTAs:**
- View reservations: `/app/reservations`
- Create reservation: Via public portal or proposal flow
- View parking occupancy: `/app/parking`

**Missing Discoverability:**
- Parking, Marina, Hospitality routes exist but no active nav items

---

### 2. Availability / Proposal / Hold / Confirm Loop

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/p/:portalSlug/reserve` | PortalReservePage | Public reservation start |
| `/p/proposal/:proposalId` | PublicProposalPage | View proposal |
| `/p/proposal/:proposalId/pay/:token` | PublicProposalPage | Split pay |
| `/app/proposals/:proposalId` | ProposalDetailPage | Operator proposal view |
| `/reserve/:portalSlug/:offerSlug` | OfferLandingPage | Offer landing |
| `/reserve/:portalSlug/:offerSlug/start/*` | Multi-step wizard | Reservation flow |
| `/reserve/status/:token` | ReservationStatusPage | Check status |
| `/reserve/confirmation/:token` | ConfirmationPage | Confirmation |

**Left-Nav Entry:** None (public flow)

**Primary CTAs:**
- Start reservation: `/p/:portalSlug/reserve`
- View proposal: `/p/proposal/:proposalId`
- Pay share: `/p/proposal/:proposalId/pay/:token`

**Missing Discoverability:**
- Internal proposal management only via direct URL

---

### 3. Participant Trips

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/participant/trips` | MyTripsPage | List participant trips |
| `/app/participant/trips/:tripId` | TripDetailPage | Trip detail |

**Left-Nav Entry:** V3_NAV defines but not in active nav

**Primary CTAs:**
- View trips: `/app/participant/trips`
- Trip detail: `/app/participant/trips/:tripId`

**Missing Discoverability:**
- Routes exist but no nav entry in active implementation
- Public trip portal: `/trip/:accessCode` (accessible via link)

---

### 4. Messaging

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/messages` | ConversationsPage | Unified inbox |

**Left-Nav Entry:** 
- BUSINESS_NAV: `/app/messages` (Messages)
- INDIVIDUAL_NAV: `/app/messages` (Messages)

**Primary CTAs:**
- View conversations: `/app/messages`
- Send message: Within conversation

**Missing Discoverability:**
- None - fully discoverable

---

### 5. Notifications

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/notifications` | NotificationsPage | Notification center |

**Left-Nav Entry:** V3_NAV defines but not in active nav

**Primary CTAs:**
- View notifications: `/app/notifications`
- Mark read: Within page

**Missing Discoverability:**
- Route exists but no nav entry in active implementation
- Unread badge shows in Messages nav item

---

### 6. Jobs (V3.5)

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/jobs` | JobsIndexPage | Jobs dashboard |
| `/app/jobs/new` | JobEditorPage | Create job |
| `/app/jobs/:id/edit` | JobEditorPage | Edit job |
| `/app/jobs/:id/destinations` | JobDestinationsPage | Publish destinations |
| `/app/jobs/:jobId/applications` | JobApplicationsPage | View applications |
| `/app/jobs/payments/pending` | PendingPaymentsPage | Pending payments |
| `/app/jobs/embeds` | EmbedConfiguratorPage | Embed configurator |
| `/app/mod/jobs` | JobsModerationPage | Jobs moderation |
| `/app/mod/applications` | ApplicationsQueuePage | Applications queue |
| `/app/mod/hiring-pulse` | HiringPulsePage | Hiring analytics |

**Left-Nav Entry:** V3_NAV defines but not in active nav

**Primary CTAs:**
- List jobs: `/app/jobs`
- Create job: `/app/jobs/new`
- View applications: `/app/jobs/:jobId/applications`

**Missing Discoverability:**
- Entire Jobs subsystem not in active nav
- Only accessible via direct URL

---

### 7. Service Runs

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/services/runs` | ServiceRuns | Service runs list |
| `/app/services/runs/new` | CreateServiceRun | Create run |
| `/app/services/runs/:slug` | ServiceRunDetail | Run detail |
| `/app/services/calendar` | ServiceRunsCalendarPage | Calendar view |

**Left-Nav Entry:** 
- COMMUNITY_NAV: `/app/service-runs` (Service Runs)

**Primary CTAs:**
- List runs: `/app/services/runs`
- Create run: `/app/services/runs/new`
- Calendar: `/app/services/calendar`

**Missing Discoverability:**
- N3 attention queue not linked: `/app/n3/attention`
- N3 monitor not linked: `/app/n3/monitor/:runId`

---

### 8. Work Requests / Procurement

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/work-requests` | WorkRequestsList | Work requests list |
| `/app/work-requests/:id` | WorkRequestDetail | Request detail |
| `/app/intake/work-requests` | WorkRequestsList | Intake inbox |

**Left-Nav Entry:**
- COMMUNITY_NAV: `/app/intake/work-requests` (Work Requests)
- BUSINESS_NAV: `/app/intake/work-requests` (Work Requests)

**Primary CTAs:**
- List requests: `/app/work-requests`
- Request detail: `/app/work-requests/:id`

**Missing Discoverability:**
- None - fully discoverable

---

### 9. Assets / Capability Units

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/assets` | InventoryPage | Assets list |
| `/app/assets/:id` | InventoryItemDetail | Asset detail |

**Left-Nav Entry:**
- BUSINESS_NAV: `/app/assets` (Assets)

**Primary CTAs:**
- List assets: `/app/assets`
- Asset detail: `/app/assets/:id`

**Missing Discoverability:**
- None for business tenants

---

### 10. Operations Board

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/ops` | OpsBoardPage | V3 ops board |
| `/app/operations` | OperationsBoard | Legacy ops board |
| `/app/parking/plan` | ParkingPlanPage | Parking plan view |
| `/app/marina/plan` | MarinaPlanPage | Marina plan view |

**Left-Nav Entry:**
- COMMUNITY_NAV: `/app/operations` (Operations)
- BUSINESS_NAV: `/app/operations` (Operations)
- V3_NAV: `/app/ops` (Operations Board) - not wired

**Primary CTAs:**
- Operations board: `/app/operations`
- Parking plan: `/app/parking/plan`

**Missing Discoverability:**
- V3 ops board (`/app/ops`) not linked
- Plan views only via direct URL

---

### 11. Housekeeping Tasks + Photos

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/ops/housekeeping` | HousekeepingPage | Housekeeping tasks |
| `/app/ops/incidents` | IncidentsPage | Incidents console |

**Left-Nav Entry:** V3_NAV defines but not in active nav

**Primary CTAs:**
- List tasks: `/app/ops/housekeeping`
- Upload photos: Within task detail
- Report incident: `/app/ops/incidents`

**Missing Discoverability:**
- Routes exist but no nav entry
- Photo upload available within task UI

---

### 12. Fleet Manager UX

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/fleet` | FleetPage | Fleet dashboard |
| `/app/fleet/assets` | FleetAssetsPage | Fleet assets |
| `/app/fleet/assets/:id` | FleetAssetDetailPage | Asset detail |
| `/app/fleet/maintenance` | FleetMaintenancePage | Maintenance |

**Left-Nav Entry:** V3_NAV defines but not in active nav

**Primary CTAs:**
- Fleet dashboard: `/app/fleet`
- Create maintenance: `/app/fleet/maintenance`

**Missing Discoverability:**
- Entire Fleet section not in active nav

---

### 13. Circles CRUD + Delegations

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/circles` | CirclesListPage | Circles list |
| `/app/circles/new` | CircleCreatePage | Create circle |
| `/app/circles/:circleId` | CircleDetailPage | Circle detail |
| `/app/circles/switch` | CirclesPage | Circle switcher |

**Left-Nav Entry:** None in active nav

**Primary CTAs:**
- List circles: `/app/circles`
- Create circle: `/app/circles/new`
- Delegate: Within circle detail

**Missing Discoverability:**
- Circles not linked from any nav

---

### 14. Admin (Roles/Settings/Folios)

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/admin` | AdminHomePage | Admin home |
| `/app/admin/roles` | AdminRolesPage | Role management |
| `/app/admin/settings` | AdminSettingsPage | Portal settings |
| `/app/admin/folios` | FoliosListPage | Folios list |
| `/app/admin/folios/:id` | FolioDetailPage | Folio detail |
| `/app/admin/usage` | UsageSummaryPage | Usage summary |
| `/app/admin/certifications` | CertificationsPage | Certifications |
| `/app/admin/portals` | PortalsPage | Portals |
| `/app/admin/tenants` | TenantsPage | Tenants |

**Left-Nav Entry:**
- All tenant navs: `/app/settings` (Settings) - but not admin routes

**Primary CTAs:**
- Admin home: `/app/admin`
- Manage roles: `/app/admin/roles`
- View folios: `/app/admin/folios`

**Missing Discoverability:**
- Admin routes only via direct URL
- Settings link goes to `/app/settings` not `/app/admin`

---

### 15. Platform (Tenants/Analytics/Cert)

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/platform/tenants` | TenantsListPage | Tenants list |
| `/app/platform/tenants/:tenantId` | TenantDetailPage | Tenant detail |
| `/app/platform/analytics` | AnalyticsPage | Analytics + cert status |

**Left-Nav Entry:**
- V3_NAV Platform section (platformAdminOnly) - not wired
- "Platform Admin" link in sidebar footer (for platform admins)

**Primary CTAs:**
- List tenants: `/app/platform/tenants`
- View analytics: `/app/platform/analytics`

**Missing Discoverability:**
- Platform section exists in V3_NAV but sidebar renderer doesn't use V3_NAV

---

### 16. Media (Dev + Embedded)

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/dev/media` | DevMediaPage | Media dev tool |

**Left-Nav Entry:** None

**Primary CTAs:**
- Dev media: `/app/dev/media`

**Missing Discoverability:**
- Dev-only route, not intended for production nav
- Media upload embedded in other UIs (housekeeping, bids)

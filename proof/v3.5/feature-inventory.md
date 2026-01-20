# V3.5 Feature Inventory (Repo-Truth)

**Generated:** 2026-01-20  
**Source:** Server routes, client pages, shared schema

---

## Summary

| Category | API Route Files | UI Pages | DB Tables |
|----------|----------------|----------|-----------|
| Reservations | 6 | 12 | 15+ |
| Operations | 4 | 8 | 8+ |
| Messaging | 3 | 3 | 6 |
| Jobs | 4 | 12 | 8+ |
| Circles | 1 | 4 | 4 |
| Fleet | 1 | 4 | 3 |
| Media | 2 | 1 | 1 |
| Admin | 6 | 9 | 5+ |
| Platform | 3 | 3 | 2 |
| **Total** | **111** | **120+** | **100+** |

---

## 1. Public Reservation Flow

**Subsystem:** Availability → Proposal → Hold → Risk → Invite → Split Pay → Confirm

### UI Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/p/:portalSlug/reserve` | PortalReservePage | Public reservation start |
| `/p/:portalSlug/reserve/:assetId` | PortalReservePage | Asset-specific booking |
| `/reserve/:portalSlug/:offerSlug` | OfferLandingPage | Offer landing page |
| `/reserve/:portalSlug/:offerSlug/start/search` | SearchStep | Date/availability search |
| `/reserve/:portalSlug/:offerSlug/start/details` | DetailsStep | Guest details |
| `/reserve/:portalSlug/:offerSlug/start/review` | ReviewStep | Review cart |
| `/reserve/:portalSlug/:offerSlug/start/confirm` | ConfirmStep | Identity + payment |
| `/reserve/status/:token` | ReservationStatusPage | Check reservation status |
| `/reserve/confirmation/:token` | ConfirmationPage | Confirmation page |
| `/p/proposal/:proposalId` | PublicProposalPage | View proposal |
| `/p/proposal/:proposalId/pay/:token` | PublicProposalPage | Split-pay participant |
| `/trip/:accessCode` | TripPortalPage | Guest trip portal |

### API Endpoints
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/proposals.ts` | 10 | Proposals CRUD + risk + confirm |
| `server/routes/public-portal.ts` | 64 | Public portal APIs |
| `server/routes/pms.ts` | 37 | PMS/booking operations |
| `server/routes/trips.ts` | 5 | Trip access + itinerary |
| `server/routes/participant-trips.ts` | 3 | Participant trip APIs |

### DB Tables
- `cc_reservation_items` - Reservation line items
- `cc_reservation_allocations` - Unit allocations
- `cc_reservation_carts` - Cart state
- `cc_reservation_cart_items` - Cart items
- `cc_reservation_cart_adjustments` - Cart adjustments
- `cc_trip_invitations` - Trip invites
- `cc_proposals` (via proposals.ts) - Proposals
- `cc_proposal_participants` - Split-pay participants
- `cc_proposal_folios` - Proposal folios

### Entry Point
- Public: Portal homepage → "Reserve" button
- Internal: `/app/reservations` → "Create Reservation"

---

## 2. Portal Operations

### 2a. Assets / Inventory

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/assets` | InventoryPage | Assets list |
| `/app/assets/:id` | InventoryItemDetail | Asset detail |
| `/app/availability` | AvailabilityConsole | Availability management |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/internal.ts` | 19 | Internal asset operations |
| `server/routes/admin-inventory.ts` | 1 | Admin asset audit |

**DB Tables:**
- `cc_inventory_units` - Inventory units
- `cc_facilities` - Facilities
- `cc_offers` - Offers/products
- `cc_rate_rules` - Pricing rules
- `cc_tax_rules` - Tax rules

**Entry Point:** Sidebar "Assets" (BUSINESS_NAV)

### 2b. Reservations Management

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/reservations` | ReservationsIndexPage | Reservations list |
| `/app/reservations/:id` | ReservationDetailPage | Reservation detail |
| `/app/proposals/:proposalId` | ProposalDetailPage | Proposal detail |
| `/app/customers` | CustomersPage | Customer list |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/rentals.ts` | 7 | Rental operations |
| `server/routes/pms.ts` | 37 | PMS operations |

**Entry Point:** Sidebar "Reservations" (BUSINESS_NAV)

### 2c. Operations Board

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/ops` | OpsBoardPage | V3 operations board |
| `/app/operations` | OperationsBoard | Legacy operations |
| `/app/parking` | ParkingPage | Parking overview |
| `/app/parking/plan` | ParkingPlanPage | Parking plan view |
| `/app/marina` | MarinaPage | Marina overview |
| `/app/marina/plan` | MarinaPlanPage | Marina plan view |
| `/app/hospitality` | HospitalityPage | Hospitality |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/ops.ts` | 13 | Operations APIs |
| `server/routes/p2-parking.ts` | 3 | Parking APIs |
| `server/routes/p2-marina.ts` | 3 | Marina APIs |

**DB Tables:**
- `cc_surfaces` - V3.5 Surface Spine (Patent CC-02)
- `cc_surface_claims` - Surface claims
- `cc_surface_capacities` - Capacity lenses

**Entry Point:** Sidebar "Operations" (COMMUNITY_NAV/BUSINESS_NAV)

### 2d. Housekeeping

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/ops/housekeeping` | HousekeepingPage | Housekeeping tasks |
| `/app/ops/incidents` | IncidentsPage | Incidents console |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/ops.ts` | Included | Housekeeping operations |

**Entry Point:** Direct URL `/app/ops/housekeeping` (no nav)

### 2e. Service Runs

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/services/runs` | ServiceRuns | Service runs list |
| `/app/services/runs/new` | CreateServiceRun | Create run |
| `/app/services/runs/:slug` | ServiceRunDetail | Run detail |
| `/app/services/calendar` | ServiceRunsCalendarPage | Calendar view |
| `/app/n3/attention` | ServiceRunAttentionPage | N3 attention queue |
| `/app/n3/monitor/:runId` | ServiceRunMonitorPage | N3 run monitor |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/serviceRuns.ts` | 19 | Service run CRUD |
| `server/routes/p2-service-runs.ts` | 3 | P2 service run APIs |
| `server/routes/shared-runs.ts` | 7 | Shared run operations |

**DB Tables:**
- `service_runs` - Service runs
- `service_run_signups` - Signups
- `cc_n3_attention_bundles` - N3 attention (Patent CC-01)
- `cc_n3_evaluations` - N3 evaluations

**Entry Point:** Sidebar "Service Runs" (COMMUNITY_NAV)

### 2f. Work Requests / Procurement

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/work-requests` | WorkRequestsList | Work requests list |
| `/app/work-requests/:id` | WorkRequestDetail | Request detail |
| `/app/intake/work-requests` | WorkRequestsList | Intake view |
| `/app/intake/work-requests/:id` | WorkRequestDetail | Intake detail |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/work-requests.ts` | 8 | Work request CRUD |
| `server/routes/procurement-requests.ts` | 6 | Procurement APIs |
| `server/routes/bids.ts` | 7 | Bidding operations |

**Entry Point:** Sidebar "Work Requests" (COMMUNITY_NAV/BUSINESS_NAV)

---

## 3. Messaging

### 3a. Conversations

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/messages` | ConversationsPage | Unified inbox |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/conversations.ts` | 11 | Conversation CRUD |
| `server/routes/p2-conversations.ts` | 3 | P2 conversation APIs |

**DB Tables:**
- `cc_conversations` - Conversations
- `cc_conversation_participants` - Participants
- `cc_conversation_messages` - Messages

**Features:**
- Mark read
- Redaction (admin)
- Contact unlock
- Threaded replies

**Entry Point:** Sidebar "Messages" (BUSINESS_NAV/INDIVIDUAL_NAV)

### 3b. Notifications

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/notifications` | NotificationsPage | Notification center |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/notifications.ts` | 4 | Notification CRUD |

**DB Tables:**
- `cc_notifications` - Notifications
- `cc_notification_preferences` - User preferences

**Entry Point:** Direct URL `/app/notifications` (badge shows in sidebar)

---

## 4. Jobs (V3.5)

### 4a. Job Postings

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/jobs` | JobsIndexPage | Jobs dashboard |
| `/app/jobs/new` | JobEditorPage | Create job |
| `/app/jobs/:id/edit` | JobEditorPage | Edit job |
| `/app/jobs/:id/destinations` | JobDestinationsPage | Publish destinations |
| `/app/jobs/payments/pending` | PendingPaymentsPage | Pending payments |
| `/app/jobs/embeds` | EmbedConfiguratorPage | Embed configurator |

### 4b. Applications

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/jobs/:jobId/applications` | JobApplicationsPage | Job applications |
| `/app/mod/jobs` | JobsModerationPage | Jobs moderation |
| `/app/mod/applications` | ApplicationsQueuePage | Applications queue |
| `/app/mod/hiring-pulse` | HiringPulsePage | Hiring analytics |

### 4c. Public Jobs Portal

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/b/:portalSlug/jobs` | PortalJobsPage | Public jobs listing |
| `/b/:portalSlug/jobs/:postingId` | PortalJobDetailPage | Job detail |
| `/b/:portalSlug/jobs/:postingId/apply` | PortalJobApplyPage | Application form |
| `/b/:portalSlug/apply/:campaignKey` | PortalCampaignApplyPage | Campaign apply |
| `/b/:portalSlug/employers/:employerId` | PortalEmployerPage | Employer profile |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/jobs.ts` | 20 | Jobs CRUD |
| `server/routes/public-jobs.ts` | 11 | Public jobs APIs |
| `server/routes/moderation-jobs.ts` | 25 | Jobs moderation |
| `server/routes/job-ingestion.ts` | 7 | Job ingestion |

**DB Tables:**
- `cc_job_postings` - Job postings
- `cc_job_applications` - Applications
- `cc_job_application_messages` - Application messages
- `cc_job_destinations` - Publication destinations
- `cc_job_embeds` - Embed configs
- `cc_job_payment_intents` - Payment intents
- `cc_job_publication_ledger` - Publication ledger (GL)

**Entry Point:** Direct URL `/app/jobs` (no nav entry)

---

## 5. Circles

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/circles` | CirclesListPage | Circles list |
| `/app/circles/new` | CircleCreatePage | Create circle |
| `/app/circles/:circleId` | CircleDetailPage | Circle detail |
| `/app/circles/switch` | CirclesPage | Circle switcher |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/p2-circles.ts` | 12 | Circles CRUD |

**DB Tables:**
- `cc_circles` - Circles
- `cc_circle_members` - Members
- `cc_circle_delegations` - Delegations
- `cc_circle_messages` - Circle messages

**Features:**
- CRUD circles
- Add/remove members
- Delegation management
- Circle-scoped messaging

**Entry Point:** Direct URL `/app/circles` (no nav entry)

---

## 6. Fleet

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/fleet` | FleetPage | Fleet dashboard |
| `/app/fleet/assets` | FleetAssetsPage | Fleet assets |
| `/app/fleet/assets/:id` | FleetAssetDetailPage | Asset detail |
| `/app/fleet/maintenance` | FleetMaintenancePage | Maintenance |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/fleet.ts` | 20 | Fleet CRUD |
| `server/routes/vehicles.ts` | 21 | Vehicle operations |

**DB Tables:**
- `cc_fleet_assets` - Fleet assets
- `cc_fleet_maintenance_records` - Maintenance records
- `cc_fleet_trips` - Fleet trips

**Entry Point:** Direct URL `/app/fleet` (no nav entry)

---

## 7. Media

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/dev/media` | DevMediaPage | Media dev tool |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/media.ts` | 7 | Media CRUD |
| `server/routes/uploads.ts` | 1 | Upload operations |

**DB Tables:**
- `cc_media` - Media records

**Features:**
- R2 integration (Cloudflare)
- Presigned URL generation
- Upload completion
- Entity binding
- Gallery support

**Entry Point:** Direct URL `/app/dev/media` (dev only)

---

## 8. Admin (Tenant)

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
| `/app/admin/tenants` | TenantsPage | Sub-tenants |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/p2-admin.ts` | 9 | Admin APIs |
| `server/routes/p2-folios.ts` | 4 | Folios APIs |
| `server/routes/roles.ts` | 12 | Role management |
| `server/routes/admin-portals.ts` | 3 | Portal admin |

**DB Tables:**
- `cc_tenant_roles` - Roles
- `cc_tenant_settings` - Settings
- `cc_folios` - Folios
- `cc_folio_ledger_entries` - Ledger entries
- `cc_portals` - Portals

**Entry Point:** Direct URL `/app/admin` (no nav entry)

---

## 9. Platform Admin

**UI Routes (V3):**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/platform/tenants` | TenantsListPage | Tenants list |
| `/app/platform/tenants/:tenantId` | TenantDetailPage | Tenant detail |
| `/app/platform/analytics` | AnalyticsPage | Analytics + cert status |

**UI Routes (Legacy /admin):**
| Route | Page | Purpose |
|-------|------|---------|
| `/admin` | CivOSDashboard | Platform dashboard |
| `/admin/tenants` | TenantsManagement | Tenants management |
| `/admin/users` | UsersManagement | Users management |
| `/admin/impersonation` | ImpersonationConsole | Impersonation |
| `/admin/system-explorer` | SystemExplorerPage | System explorer |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/p2-platform.ts` | 4 | Platform APIs |
| `server/routes/admin-tenants.ts` | 2 | Tenant admin |
| `server/routes/admin-impersonation.ts` | 3 | Impersonation |
| `server/routes/system-explorer.ts` | 4 | System explorer |
| `server/routes/civos.ts` | 10 | CivOS APIs |

**Entry Point:** 
- V3: Direct URL `/app/platform/*` (for platform admins)
- Legacy: "Platform Admin" link in sidebar footer → `/admin`

---

## 10. Dev Surfaces

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/dev/media` | DevMediaPage | Media dev tool |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/dev-seed-n3.ts` | 2 | N3 seeding |
| `server/routes/dev-seed-marina.ts` | 2 | Marina seeding |
| `server/routes/dev-seed-parking.ts` | 2 | Parking seeding |
| `server/routes/dev-seed-wedding.ts` | 2 | Wedding seeding |
| `server/routes/dev-seed-surfaces.ts` | 2 | Surfaces seeding |
| `server/routes/qa-seed.ts` | 6 | QA seeding |
| `server/routes/qa.ts` | 2 | QA utilities |

**Entry Point:** Direct URL `/app/dev/*` (dev only)

---

## 11. Operator Surfaces

**UI Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/app/operator` | OperatorHomePage | Operator home |
| `/app/operator/emergency` | OperatorEmergencyIndexPage | Emergency index |
| `/app/operator/emergency/:runId` | OperatorEmergencyRunPage | Emergency run |
| `/app/operator/legal` | OperatorLegalHoldsIndexPage | Legal holds |
| `/app/operator/legal/:holdId` | OperatorLegalHoldDetailPage | Hold detail |
| `/app/operator/insurance` | OperatorInsuranceIndexPage | Insurance |
| `/app/operator/insurance/claims/:claimId` | OperatorInsuranceClaimPage | Claim detail |
| `/app/operator/disputes` | OperatorDisputesIndexPage | Disputes |
| `/app/operator/disputes/:disputeId` | OperatorDisputePage | Dispute detail |
| `/app/operator/authority` | OperatorAuthorityIndexPage | Authority |
| `/app/operator/authority/grants/:grantId` | OperatorAuthorityGrantPage | Grant detail |
| `/app/operator/audit` | OperatorAuditPage | Audit |

**API Endpoints:**
| File | Endpoints | Purpose |
|------|-----------|---------|
| `server/routes/operator.ts` | 38 | Operator APIs |
| `server/routes/emergency.ts` | 18 | Emergency APIs |
| `server/routes/drills.ts` | 11 | Drill mode |
| `server/routes/disputes.ts` | 11 | Disputes |
| `server/routes/insurance.ts` | 10 | Insurance |
| `server/routes/legal.ts` | 7 | Legal holds |
| `server/routes/evidence.ts` | 12 | Evidence |
| `server/routes/record-bundles.ts` | 6 | Record bundles |

**Entry Point:** Direct URL `/app/operator` (no nav entry)

---

## Patents Referenced

| Patent ID | Name | Inventor |
|-----------|------|----------|
| CC-01 | N3 Service Run Monitor + Replan Engine | Glenn Ballman |
| CC-02 | V3.5 Surface Spine | Glenn Ballman |

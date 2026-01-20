# V3.5 "How Do I...?" Operator Index

**Generated:** 2026-01-20

---

## Quick Reference Index

### Jobs & Hiring

#### Post a job advertisement
1. Navigate to `/app/jobs` (direct URL - no nav entry)
2. Click "Create Job" or go to `/app/jobs/new`
3. Fill out job details and save
4. Go to `/app/jobs/:id/destinations` to publish to portals

#### View job applicants
1. Navigate to `/app/jobs` (direct URL)
2. Find job in list
3. Click on job to view applications, or go to `/app/jobs/:jobId/applications`
4. Alternative: `/app/mod/applications` for queue view

#### Message a job applicant
1. Go to `/app/jobs/:jobId/applications`
2. Click on applicant
3. Use threaded messaging in application detail
4. Or use `/app/mod/applications/:applicationId` for operator reply

---

### Service Runs & Work

#### Create a service run
1. For community tenants: Navigate via sidebar "Service Runs"
2. Go to `/app/services/runs`
3. Click "Create Run" or go to `/app/services/runs/new`
4. Fill out run details and save

#### Open bidding / collect signups
1. Create a work request or service run
2. Go to run/request detail page
3. Use the bidding/signup functionality within the detail UI
4. Signups visible in run detail

---

### Reservations

#### Create a reservation (manual)
1. For business tenants: Navigate via sidebar "Reservations"
2. Go to `/app/reservations`
3. Alternative: Use proposal flow at `/p/:portalSlug/reserve`
4. Create via asset page or calendar

#### View/manage reservations
1. Navigate via sidebar "Reservations" (business tenants)
2. Go to `/app/reservations`
3. Click reservation for detail view at `/app/reservations/:id`
4. Manage status, notes, and participant details

#### View operations board occupancy
1. Navigate via sidebar "Operations" (community/business tenants)
2. Go to `/app/operations` or `/app/ops`
3. View 15-minute precision scheduling grid
4. For parking: `/app/parking/plan`
5. For marina: `/app/marina/plan`

---

### Messaging

#### Message a contractor
1. Navigate via sidebar "Messages" (business tenants)
2. Go to `/app/messages`
3. Find or start conversation
4. Send message in conversation thread

#### Message a job applicant
1. Go to `/app/jobs/:jobId/applications`
2. Select applicant
3. Use reply functionality in application detail
4. Messages appear in applicant's portal

---

### Media & Photos

#### Upload media to a bid
1. Go to bid/proposal detail page
2. Use media upload component in the detail UI
3. Supports multiple file upload

#### Upload photos to a housekeeping task
1. Go to `/app/ops/housekeeping` (direct URL - no nav)
2. Select task
3. Use before/after photo upload in task detail
4. Photos tied to task record

---

### Fleet Management

#### Manage fleet assets + maintenance
1. Go to `/app/fleet` (direct URL - no nav)
2. View fleet dashboard
3. For assets: `/app/fleet/assets`
4. For maintenance: `/app/fleet/maintenance`
5. Create maintenance record from asset detail

---

### Circles

#### Create a circle + add members + delegate
1. Go to `/app/circles` (direct URL - no nav)
2. Click "Create Circle" or go to `/app/circles/new`
3. Name circle and save
4. Go to circle detail: `/app/circles/:circleId`
5. Add members using "Add Member" action
6. Use "Delegate" action for permission delegation

---

### Admin & Folios

#### View folios + ledger entries
1. Go to `/app/admin/folios` (direct URL - no nav)
2. View folios list
3. Click folio for detail at `/app/admin/folios/:id`
4. Ledger entries shown in folio detail

#### Adjust portal settings
1. Go to `/app/admin/settings` (direct URL)
2. View portal configuration
3. Update branding, features, notifications
4. For appearance: `/app/admin/portals/:portalId/appearance`

---

### Platform Admin

#### View tenants + analytics + cert status
1. Requires `is_platform_admin` flag
2. Option A (Legacy): Click "Platform Admin" in sidebar footer → `/admin`
3. Option B (V3): Go to `/app/platform/tenants` (direct URL)
4. Tenant list with stats: `/app/platform/tenants`
5. Tenant detail: `/app/platform/tenants/:tenantId`
6. Analytics + cert status: `/app/platform/analytics`

---

## URL Quick Reference

| Intent | URL |
|--------|-----|
| Jobs dashboard | `/app/jobs` |
| Create job | `/app/jobs/new` |
| Job applications | `/app/jobs/:id/applications` |
| Service runs | `/app/services/runs` |
| Create service run | `/app/services/runs/new` |
| Reservations | `/app/reservations` |
| Reservation detail | `/app/reservations/:id` |
| Operations board | `/app/ops` |
| Parking plan | `/app/parking/plan` |
| Marina plan | `/app/marina/plan` |
| Messages | `/app/messages` |
| Notifications | `/app/notifications` |
| Housekeeping | `/app/ops/housekeeping` |
| Fleet dashboard | `/app/fleet` |
| Fleet assets | `/app/fleet/assets` |
| Fleet maintenance | `/app/fleet/maintenance` |
| Circles | `/app/circles` |
| Create circle | `/app/circles/new` |
| Admin home | `/app/admin` |
| Roles management | `/app/admin/roles` |
| Portal settings | `/app/admin/settings` |
| Folios | `/app/admin/folios` |
| Usage summary | `/app/admin/usage` |
| Platform tenants | `/app/platform/tenants` |
| Platform analytics | `/app/platform/analytics` |
| My trips | `/app/participant/trips` |
| My applications | `/app/participant/applications` |

---

## Notes on Discoverability

Most V3.5 features are accessible via direct URL but lack nav entries in the active sidebar implementation:

- **Jobs:** No nav entry - use `/app/jobs`
- **Fleet:** No nav entry - use `/app/fleet`
- **Circles:** No nav entry - use `/app/circles`
- **Admin:** Only Settings link - use `/app/admin`
- **Platform:** Footer link + direct URLs
- **Housekeeping:** No nav entry - use `/app/ops/housekeeping`
- **Notifications:** No nav entry - use `/app/notifications`
- **My Trips/Applications:** No nav entry - use `/app/participant/*`

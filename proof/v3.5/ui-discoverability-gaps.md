# V3.5 Discoverability Gaps

**Generated:** 2026-01-20

---

## Summary

| Gap Type | Count |
|----------|-------|
| Routes without nav entry | 42 |
| Nav entries with missing routes | 0 |
| Features requiring unlinked context | 8 |
| Duplicate/confusing labels | 5 |

---

## Part 1: Routes That Exist But Have No Nav Entry

### Critical (Core Features)

| Route | Feature | Impact |
|-------|---------|--------|
| `/app/jobs` | Jobs dashboard | High - entire V3.5 Jobs subsystem hidden |
| `/app/jobs/new` | Create job | High |
| `/app/jobs/:id/edit` | Edit job | High |
| `/app/jobs/:jobId/applications` | Job applications | High |
| `/app/fleet` | Fleet dashboard | High - entire Fleet subsystem hidden |
| `/app/fleet/assets` | Fleet assets | High |
| `/app/fleet/maintenance` | Fleet maintenance | High |
| `/app/circles` | Circles list | Medium |
| `/app/circles/new` | Create circle | Medium |
| `/app/admin` | Admin home | High - admin portal hidden |
| `/app/admin/roles` | Role management | High |
| `/app/admin/folios` | Folios list | High |
| `/app/platform/tenants` | Platform tenants | High - for platform admins |
| `/app/platform/analytics` | Platform analytics | High |

### Medium (Operational Features)

| Route | Feature | Impact |
|-------|---------|--------|
| `/app/ops` | V3 Ops board | Medium - legacy board linked instead |
| `/app/ops/housekeeping` | Housekeeping tasks | Medium |
| `/app/ops/incidents` | Incidents console | Medium |
| `/app/parking` | Parking overview | Medium |
| `/app/parking/plan` | Parking plan view | Medium |
| `/app/marina` | Marina overview | Medium |
| `/app/marina/plan` | Marina plan view | Medium |
| `/app/hospitality` | Hospitality | Medium |
| `/app/notifications` | Notifications | Medium - unread badge exists but no link |
| `/app/n3/attention` | N3 attention queue | Medium |
| `/app/n3/monitor/:runId` | N3 run monitor | Medium |
| `/app/enforcement` | Enforcement | Low |

### Low (Participant Features)

| Route | Feature | Impact |
|-------|---------|--------|
| `/app/participant/trips` | My Trips | Medium - participants can't find trips |
| `/app/participant/trips/:tripId` | Trip detail | Medium |
| `/app/participant/applications` | My Applications | Medium |
| `/app/participant/applications/:appId` | Application detail | Medium |

### Moderation (Operator Features)

| Route | Feature | Impact |
|-------|---------|--------|
| `/app/mod/jobs` | Jobs moderation | Low - operator feature |
| `/app/mod/applications` | Applications queue | Low |
| `/app/mod/hiring-pulse` | Hiring analytics | Low |
| `/app/mod/paid-publications` | Paid publications | Low |
| `/app/jobs/payments/pending` | Pending payments | Low |
| `/app/jobs/embeds` | Embed configurator | Low |

---

## Part 2: Nav Entries That Point to Missing Routes

**None found.** All nav entries have corresponding route definitions.

---

## Part 3: Features Requiring Portal Context (Reachable Only from Tenant Shell)

| Route | Requires | Problem |
|-------|----------|---------|
| `/app/mod/portals/:portalId/growth` | portal_id | Portal selection required first |
| `/app/mod/portals/:portalId/housing-waitlist` | portal_id | Portal selection required first |
| `/app/mod/portals/:portalId/bench` | portal_id | Portal selection required first |
| `/app/mod/portals/:portalId/emergency` | portal_id | Portal selection required first |
| `/app/portals/:portalId/housing` | portal_id | Portal selection required first |
| `/app/admin/portals/:portalId/appearance` | portal_id | Must navigate via portals list |
| `/app/circles/:circleId` | circle_id | Must navigate via circles list |
| `/app/circles/:circleId` | circle_id + tenant_id | Context propagation required |

---

## Part 4: Duplicate or Confusing Labels

### "Operations" vs "Ops Board"

| Label | Route | Source |
|-------|-------|--------|
| Operations | `/app/operations` | COMMUNITY_NAV, BUSINESS_NAV |
| Operations Board | `/app/ops` | V3_NAV |

**Issue:** Two different routes for operations, legacy vs V3.

### "Service Runs" vs "Services" vs "Work Requests"

| Label | Route | Source |
|-------|-------|--------|
| Service Runs | `/app/service-runs` | COMMUNITY_NAV |
| Service Runs | `/app/services/runs` | V3_NAV |
| Services | `/app/services` | COMMUNITY_NAV |
| Work Requests | `/app/work-requests` | V3_NAV |
| Work Requests | `/app/intake/work-requests` | COMMUNITY_NAV |

**Issue:** Multiple paths to similar concepts, legacy vs V3 routing.

### "Jobs" vs "Work Requests"

| Label | Concept | Target User |
|-------|---------|-------------|
| Jobs | Job advertisements/postings | Employers |
| Work Requests | Incoming work/service requests | Contractors |

**Issue:** Terms could be confused - "Jobs" are employment postings, "Work Requests" are service requests.

### "Assets" in Multiple Contexts

| Label | Route | Context |
|-------|-------|---------|
| Assets | `/app/assets` | Business inventory |
| Assets (Audit) | `/admin/assets` | Platform audit |
| Fleet Assets | `/app/fleet/assets` | Fleet vehicles |

**Issue:** "Assets" overloaded across different subsystems.

### "Tenants" in Multiple Contexts

| Label | Route | Context |
|-------|-------|---------|
| Tenants | `/app/admin/tenants` | Tenant admin view |
| Tenants | `/app/platform/tenants` | Platform admin view |
| Tenants | `/admin/tenants` | Legacy platform admin |

**Issue:** Three different "Tenants" pages for different admin levels.

---

## Part 5: Navigation Architecture Issues

### V3_NAV Not Wired

**Problem:** `v3Nav.ts` defines the authoritative V3.5 navigation structure but the sidebar renderer in `TenantAppLayout.tsx` uses separate `COMMUNITY_NAV`, `BUSINESS_NAV`, `INDIVIDUAL_NAV` arrays.

**Impact:** 
- Most V3.5 features not discoverable
- Navigation inconsistent with V3_NAV definition
- platformAdminOnly gating defined but not enforced

### Missing Sidebar Sections

The following V3_NAV sections have no representation in active nav:
- Personal (My Trips, My Applications)
- Fleet
- Compliance
- Admin (full section)
- Platform

### Tenant Type Isolation

**Problem:** Features are siloed by tenant type:
- Jobs not in any tenant nav
- Fleet not in any tenant nav
- Circles not in any tenant nav

---

## Recommendations (No Implementation)

### Priority 1: Wire V3_NAV to Sidebar

Replace tenant-type-specific nav arrays with V3_NAV rendering, applying:
- Section visibility based on tenant type
- platformAdminOnly filtering
- Feature flag gating

### Priority 2: Add Missing Nav Entries

Critical additions:
- Jobs (Work section)
- Fleet (Fleet section)
- Circles (Communication or Admin)
- Participant routes (Personal section)
- Admin routes (Admin section)

### Priority 3: Normalize Labels

- Rename "Operations" to "Ops Board" consistently
- Use `/app/ops/*` as primary ops path
- Deprecate `/app/operations`
- Clarify Jobs vs Work Requests in UI

### Priority 4: Context Guidance

Add breadcrumbs or context indicators for:
- Portal-scoped routes
- Circle-scoped routes
- Admin-only routes

### Priority 5: Role-Based Nav Filtering

Implement nav filtering based on:
- Tenant role (admin, operator, member)
- Portal role (portal_admin, portal_member)
- Platform admin flag

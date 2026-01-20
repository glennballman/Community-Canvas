# Portal Workflow Binding Audit

Generated: 2026-01-20

This document audits each workflow from `workflow-inventory.md` for:
1. Public entry route identification
2. Portal-scoped resolution (portal_id from URL)
3. Branding application
4. Navigation back to portal

---

## Summary

| # | Workflow | Entry Route | Portal-Scoped | Branding | Back Nav | Status |
|---|----------|-------------|---------------|----------|----------|--------|
| 1 | Manual Reservation | `/app/reservations` | N/A (app) | N/A | N/A | App-only |
| 2 | Public Reservation | `/p/:portalSlug/reserve` | YES | YES | YES | PASS |
| 3 | Service Run Lifecycle | `/app/services/runs` | N/A (app) | N/A | N/A | App-only |
| 4 | Work Request Lifecycle | `/app/work-requests` | N/A (app) | N/A | N/A | App-only |
| 5 | Job Posting (Public) | `/b/:portalSlug/jobs` | YES | PARTIAL | YES | NEEDS FIX |
| 6 | Housekeeping Task | `/app/ops/housekeeping` | N/A (app) | N/A | N/A | App-only |
| 7 | Fleet Management | `/app/fleet` | N/A (app) | N/A | N/A | App-only |
| 8 | Circles Management | `/app/circles` | N/A (app) | N/A | N/A | App-only |
| 9 | Messaging | `/app/messages` | N/A (app) | N/A | N/A | App-only |
| 10 | Trip Portal | `/trip/:accessCode` | YES | NO | NO | NEEDS FIX |
| 11 | Public Proposal | `/p/proposal/:proposalId` | NO | NO | NO | NEEDS FIX |
| 12 | Campaign Apply | `/b/:portalSlug/apply/:campaignKey` | YES | PARTIAL | YES | NEEDS FIX |
| 13 | Onboarding | `/p/:portalSlug/onboarding` | YES | YES | YES | PASS |

---

## Detailed Analysis

### Workflow 1: Manual Reservation (Operator)

**Entry Route:** `/app/reservations`

**Analysis:** This is an authenticated app workflow, not a public portal workflow. Portal-scoping, branding, and navigation are handled by the app shell, not the portal layer.

**Verdict:** N/A - App-only workflow

---

### Workflow 2: Public Reservation Conversion

**Entry Route:** `/p/:portalSlug/reserve`

| Check | Status | Details |
|-------|--------|---------|
| Portal-Scoped | YES | `useParams().portalSlug` extracted, used in API calls: `/api/public/cc_portals/${portalSlug}/availability` |
| Branding | YES | Inherits PortalHomePage styling; availability response includes portal context |
| Back Navigation | YES | "Back to Home" button links to `/p/${portalSlug}` in ConfirmationView (line 388) |

**API Endpoints:**
- `GET /api/public/cc_portals/:portalSlug/availability`
- `POST /api/public/cc_portals/:portalSlug/reserve`

**Back Navigation UI:**
- ArrowLeft + "Back" button at line 282-285
- "Back to Home" at line 388-391

**Verdict:** PASS

---

### Workflow 3: Service Run Lifecycle

**Entry Route:** `/app/services/runs`

**Analysis:** Authenticated app workflow. Service runs are tenant-scoped, not portal-scoped. The public display of service runs is embedded in portal home pages via settings (`show_service_runs: true`).

**Verdict:** N/A - App-only workflow

---

### Workflow 4: Work Request Lifecycle

**Entry Route:** `/app/work-requests`

**Analysis:** Authenticated app workflow. Work requests are tenant-scoped.

**Verdict:** N/A - App-only workflow

---

### Workflow 5: Job Posting Lifecycle (Public Side)

**Entry Route:** `/b/:portalSlug/jobs`

| Check | Status | Details |
|-------|--------|---------|
| Portal-Scoped | YES | `useParams().portalSlug` extracted, API: `/b/${portalSlug}/api/public/jobs` |
| Branding | PARTIAL | Uses hardcoded header styling, capitalizes portalSlug as title (line 528). NO portal theme colors applied. |
| Back Navigation | YES | Job detail has ArrowLeft back to `/b/${portalSlug}/jobs` (line 199) |

**Sub-routes:**
- `/b/:portalSlug/jobs/:postingId` - Job detail
- `/b/:portalSlug/jobs/:postingId/apply` - Application form
- `/b/:portalSlug/employers/:employerId` - Employer profile

**Issues Found:**
1. **No portal branding fetch:** PortalJobsPage does NOT fetch portal site_config/theme
2. **Hardcoded styling:** Header uses default theme, not portal colors
3. **Title is slug-based:** Shows `{portalSlug} Jobs` instead of portal brand_name

**Verdict:** NEEDS FIX - Missing portal branding

---

### Workflow 6: Housekeeping Task

**Entry Route:** `/app/ops/housekeeping`

**Analysis:** Authenticated app workflow. Tenant-scoped.

**Verdict:** N/A - App-only workflow

---

### Workflow 7: Fleet Management

**Entry Route:** `/app/fleet`

**Analysis:** Authenticated app workflow. Tenant-scoped.

**Verdict:** N/A - App-only workflow

---

### Workflow 8: Circles Management

**Entry Route:** `/app/circles`

**Analysis:** Authenticated app workflow. Tenant-scoped.

**Verdict:** N/A - App-only workflow

---

### Workflow 9: Messaging & Notifications

**Entry Route:** `/app/messages` and `/app/notifications`

**Analysis:** Authenticated app workflow. Tenant-scoped.

**Verdict:** N/A - App-only workflow

---

### Workflow 10: Trip Portal

**Entry Route:** `/trip/:accessCode`

| Check | Status | Details |
|-------|--------|---------|
| Portal-Scoped | YES | API returns `portal` object with id, name, slug |
| Branding | NO | Uses default app styling. Portal theme not applied. |
| Back Navigation | NO | No link back to portal home. Trip is the destination. |

**API Endpoint:** `GET /api/public/trips/:accessCode`

**Issues Found:**
1. **No portal branding application:** Page renders with default theme, ignores portal.theme
2. **No back-to-portal navigation:** Trip portal is designed as a standalone experience
3. **Portal context available but unused:** API returns portal info but UI doesn't use it for theming

**Verdict:** NEEDS FIX - Portal branding not applied; back navigation missing (though may be by design for trip experience)

---

### Workflow 11: Public Proposal

**Entry Route:** `/p/proposal/:proposalId/:token?`

| Check | Status | Details |
|-------|--------|---------|
| Portal-Scoped | NO | Proposal fetched by ID, no portalSlug in URL. Portal context not resolved. |
| Branding | NO | Uses default app styling. No portal theme. |
| Back Navigation | NO | No navigation back to any portal. |

**API Endpoint:** `GET /api/p2/public/proposals/:proposalId`

**Issues Found:**
1. **Not portal-scoped:** Proposal is accessed by ID, portal context unknown
2. **No branding:** Uses generic styling
3. **No back navigation:** User has no path back to originating portal

**Design Question:** Should proposals be associated with a portal for branding? Currently they are tenant-level.

**Verdict:** NEEDS FIX - No portal scoping or branding

---

### Workflow 12: Campaign Apply

**Entry Route:** `/b/:portalSlug/apply/:campaignKey`

| Check | Status | Details |
|-------|--------|---------|
| Portal-Scoped | YES | `useParams().portalSlug` extracted |
| Branding | PARTIAL | Header shows portal slug. No theme colors fetched. |
| Back Navigation | YES | "Back to Portal" link at line 171: `<Link to={\`/b/${portalSlug}\`}>` |

**Issues Found:**
1. **Partial branding:** Portal slug used for back navigation but no portal theme applied
2. **Back link may 404:** Links to `/b/${portalSlug}` which may not have a landing page (jobs portal uses `/b/:portalSlug/jobs`)

**Verdict:** NEEDS FIX - Missing portal branding; back link target may be wrong

---

### Workflow 13: Onboarding

**Entry Route:** `/p/:portalSlug/onboarding`

| Check | Status | Details |
|-------|--------|---------|
| Portal-Scoped | YES | `useParams().portalSlug` extracted |
| Branding | YES | Fetches portal site data, applies theme |
| Back Navigation | YES | "Back to {brand_name}" button at lines 206-207 |

**API Endpoint:** Uses same portal site data pattern

**Verdict:** PASS

---

## Issues Summary

### Critical Issues (Blocking)

1. **PortalJobsPage:** No portal branding/theme applied
   - File: `client/src/pages/public/PortalJobsPage.tsx`
   - Fix: Fetch `/api/public/cc_portals/${portalSlug}/site` and apply theme to header

2. **PortalCampaignApplyPage:** Back link may 404
   - File: `client/src/pages/public/PortalCampaignApplyPage.tsx`
   - Fix: Change `/b/${portalSlug}` to `/b/${portalSlug}/jobs`

### Medium Issues (UX)

3. **TripPortalPage:** No portal branding
   - File: `client/src/pages/public/TripPortalPage.tsx`
   - Fix: Apply portal theme colors from API response

4. **PublicProposalPage:** Not portal-scoped
   - File: `client/src/pages/public/PublicProposalPage.tsx`
   - Design decision: Should proposals inherit portal branding from their tenant?

### Low Issues (Enhancement)

5. **PortalJobDetailPage:** Uses generic "Jobs" header
   - Could show portal brand_name instead of portalSlug

---

## Recommendations

### Immediate Fixes

1. **Add portal context fetch to PortalJobsPage:**
```tsx
const { data: portalData } = useQuery({
  queryKey: [`/api/public/cc_portals/${portalSlug}/site`],
  enabled: !!portalSlug,
});
// Use portalData.site.theme for header styling
// Use portalData.site.brand_name instead of portalSlug
```

2. **Fix back link in PortalCampaignApplyPage:**
```tsx
// Change from:
<Link to={`/b/${portalSlug}`}>Back to Portal</Link>
// To:
<Link to={`/b/${portalSlug}/jobs`}>Back to Jobs</Link>
```

3. **Apply portal theme in TripPortalPage:**
```tsx
// Portal data is already returned from API
// Apply portal.theme colors to header/buttons
```

### Design Decisions Needed

1. **Proposal branding:** Should proposals show portal branding? This requires:
   - Adding portal_id to proposals schema
   - Fetching portal context in PublicProposalPage
   - Decision: Is proposal tied to a specific portal or tenant-level?

2. **Trip portal back navigation:** Trips are guest experiences - should they have a "back to portal" link or are they standalone?

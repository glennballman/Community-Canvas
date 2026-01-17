# Portal Jobs UI Verification Guide

This document provides test scenarios for verifying the Community Canvas V3.5 Jobs/Labor System portal functionality.

## Routes to Test

### Tenant Dashboard Routes
| Route | Purpose |
|-------|---------|
| `/app/jobs` | Jobs index - list all tenant jobs |
| `/app/jobs/new` | Create new job posting |
| `/app/jobs/:id/edit` | Edit existing job |
| `/app/jobs/:id/destinations` | Manage publish destinations |
| `/app/jobs/payments/pending` | View pending payment intents |
| `/app/jobs/embeds` | Embed configurator |
| `/app/admin/portals` | Portal list |
| `/app/admin/portals/:portalId/appearance` | Portal appearance settings |

### Moderation Routes
| Route | Purpose |
|-------|---------|
| `/app/mod/jobs` | Job posting moderation queue |
| `/app/mod/paid-publications` | Pending payment intents moderation |

### Public Portal Routes
| Route | Purpose |
|-------|---------|
| `/b/:portalSlug/jobs` | Indeed-style job listings |
| `/b/:portalSlug/jobs/:jobId` | Job detail page |
| `/b/:portalSlug/jobs/:jobId/apply` | Anonymous application flow |
| `/b/:portalSlug/employers/:employerId` | Employer profile page |

---

## Test Scenarios

### Scenario 1: CanadaDirect Submit => Pending Review => Published

**Context:** CanadaDirect portal requires moderation before publishing.

**Steps:**
1. Login as tenant with jobs
2. Navigate to `/app/jobs` and click "New Job"
3. Fill out job form with:
   - Title: "Test Driver Position"
   - Employment Type: Full-time
   - Location: "Victoria, BC"
   - Pay: $25-30/hr
4. Save the job
5. Navigate to `/app/jobs/:id/destinations`
6. Check "CanadaDirect" destination
7. Click "Publish"
8. **Expected:** Job goes to `pending_review` state

**Moderation:**
1. Navigate to `/app/mod/jobs`
2. Find the pending job in the queue
3. Review details
4. Click "Approve"
5. **Expected:** Job state changes to `published`

**Verification:**
1. Navigate to `/b/canadadirect/jobs`
2. **Expected:** Job appears in listings
3. Click job card
4. **Expected:** Detail panel shows job info
5. Click "View Full Details"
6. **Expected:** Full job detail page loads

---

### Scenario 2: AdrenalineCanada Publish => Payment Required => Mark Paid

**Context:** AdrenalineCanada charges $29 CAD per posting.

**Steps:**
1. Login as tenant with a job
2. Navigate to `/app/jobs/:id/destinations`
3. Check "AdrenalineCanada" destination
4. Click "Publish"
5. **Expected:** Checkout modal appears showing $29.00 CAD
6. Click "Continue"
7. **Expected:** Redirected to `/app/jobs/payments/pending`
8. **Expected:** Payment intent shows status "Pending"

**Moderation:**
1. Navigate to `/app/mod/paid-publications`
2. Find the pending intent
3. Click "Mark as Paid"
4. Enter PSP reference (optional)
5. Confirm
6. **Expected:** Job publishes to AdrenalineCanada

**Verification:**
1. Navigate to `/b/adrenalinecanada/jobs`
2. **Expected:** Job appears in listings

---

### Scenario 3: Employer Page Shows Only Portal-Scoped Jobs

**Steps:**
1. Navigate to `/b/canadadirect/jobs`
2. Click on an employer name link in a job card
3. **Expected:** Navigate to `/b/canadadirect/employers/:employerId`
4. **Expected:** Employer profile card shows:
   - Employer name
   - Logo (if available)
   - About section (if available)
   - Website link (if available)
5. **Expected:** "Open Positions" section shows only jobs from this employer that are published on CanadaDirect
6. **Expected:** Jobs published on other portals (e.g., AdrenalineCanada) do NOT appear

---

### Scenario 4: Indeed-Style Job List Filters

**Steps:**
1. Navigate to `/b/canadadirect/jobs`
2. **Expected:** 2-column layout (list left, detail right on desktop)
3. Use search bar to filter by keyword
4. Click "Filters" button
5. Set filters:
   - Date Posted: "Last 7 days"
   - Employment Type: "Full-time"
   - Employer: Select specific employer
   - Housing Provided: Toggle on
   - Pay Range: $20-50
6. **Expected:** Job list updates to show matching jobs
7. **Expected:** Filter badges appear above list
8. Click X on a badge to remove that filter
9. **Expected:** Filter removed, list updates

**Deep Linking:**
1. Select a job from the list
2. **Expected:** URL updates with `?job=:jobId`
3. Copy URL and open in new tab
4. **Expected:** Same job is selected

**Mobile Behavior:**
1. Resize browser to mobile width (<768px)
2. **Expected:** Single column layout
3. Tap a job card
4. **Expected:** Navigate to full detail page

---

### Scenario 5: Anonymous Application Flow

**Steps:**
1. Navigate to `/b/canadadirect/jobs/:jobId`
2. Click "Apply Now"
3. **Expected:** Navigate to `/b/canadadirect/jobs/:jobId/apply`
4. Fill out application:
   - Full Name: "Test Applicant"
   - Email: "test@example.com"
   - Phone: "250-555-1234"
5. Upload resume (PDF, max 10MB)
6. Upload photo (optional, JPEG/PNG, max 5MB)
7. Submit application
8. **Expected:** Success message "We received your application"
9. **Expected:** Option to "Apply to more jobs" link back

---

### Scenario 6: Portal Appearance Configuration

**Steps:**
1. Navigate to `/app/admin/portals`
2. Find your portal and click "Appearance" (or navigate to `/app/admin/portals/:portalId/appearance`)
3. Configure:
   - Upload/set logo URL
   - Set primary color
   - Choose nav mode (top/left)
   - Add navigation links (internal + external)
   - Set external site URL for "Back to site" link
   - Toggle "Powered by Community Canvas"
4. Save changes
5. Navigate to `/b/:portalSlug/jobs`
6. **Expected:** Portal displays with configured branding

---

## API Endpoints for curl Testing

### List Public Jobs (Portal-Scoped)
```bash
curl -X GET "http://localhost:5000/b/canadadirect/api/public/jobs"
```

### Get Job Detail
```bash
curl -X GET "http://localhost:5000/b/canadadirect/api/public/jobs/:jobId"
```

### Get Employer Profile
```bash
curl -X GET "http://localhost:5000/b/canadadirect/api/public/employers/:employerId"
```

### Get Portal Settings
```bash
curl -X GET "http://localhost:5000/b/canadadirect/api/public/portal-settings"
```

### Get Moderation Queue (Requires Auth)
```bash
curl -X GET "http://localhost:5000/api/p2/app/mod/jobs?state=pending" \
  -H "Cookie: tenant_sid=..."
```

### Approve Job Posting (Requires Auth)
```bash
curl -X POST "http://localhost:5000/api/p2/app/mod/jobs/:postingId/approve" \
  -H "Cookie: tenant_sid=..."
```

### Get Pending Payment Intents (Requires Auth)
```bash
curl -X GET "http://localhost:5000/api/p2/app/mod/paid-publications/pending" \
  -H "Cookie: tenant_sid=..."
```

### Mark Intent as Paid (Requires Auth)
```bash
curl -X POST "http://localhost:5000/api/p2/app/mod/paid-publications/:intentId/mark-paid" \
  -H "Content-Type: application/json" \
  -H "Cookie: tenant_sid=..." \
  -d '{"pspMethod": "manual", "pspReference": "INV-12345"}'
```

---

## Checklist Summary

| # | Scenario | Status |
|---|----------|--------|
| 1 | CanadaDirect moderation flow | [ ] |
| 2 | AdrenalineCanada paid flow | [ ] |
| 3 | Employer page portal-scoped | [ ] |
| 4 | Indeed-style filters/deep linking | [ ] |
| 5 | Anonymous application | [ ] |
| 6 | Portal appearance config | [ ] |

---

## Notes

- **Portal Pricing:**
  - AdrenalineCanada: $29 CAD per posting (paid)
  - CanadaDirect: Free with moderation required
  - Bamfield: Free, no moderation

- **Terminology:** Never use "book" or "booking" - use "reserve" or "reservation"

- **Data Isolation:** Each portal only shows jobs with `publish_state='published'` for that specific portal

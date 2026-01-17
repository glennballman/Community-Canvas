# Hiring Pulse Verification

## Overview

Hiring Pulse is a lightweight dashboard widget for portal staff to track cold-start health metrics including inbound application volume, response SLA, conversion by stage, and share-ready links.

## Access

- **Route**: `/app/mod/hiring-pulse`
- **Authorization**: Requires portal staff authentication (moderator, admin, or tenant admin/owner)
- **API Endpoint**: `GET /api/p2/app/mod/jobs/hiring-pulse?range=7d|30d`

## Click Path

1. Log in as a portal staff member
2. Navigate to `/app/mod/hiring-pulse` or access via the moderation menu
3. View the Hiring Pulse dashboard

## Expected Metrics

### Summary Cards

| Metric | Description | Source |
|--------|-------------|--------|
| **New Applications** | Count of applications received in selected period | `cc_job_applications.created_at` |
| **Median Response Time** | Median time (minutes) to first staff reply | `cc_job_application_events` (reply_sent) |
| **Needs Reply** | Applications awaiting first response | `status IN ('new','reviewing')` with no reply_sent event |
| **Housing Needed** | Applicants who indicated they need housing | `cc_job_applications.housing_needed = true` |
| **Work Permit Questions** | Applicants with work permit status (not 'not_applicable') | `cc_job_applications.work_permit_status` |

### Conversion by Stage

Bar chart showing application status breakdown:
- `new` - Blue
- `reviewing` - Yellow
- `interviewing` - Purple
- `offered` - Green
- `hired` - Emerald
- `rejected` - Red
- `withdrawn` - Gray

### Top Employers

Top 5 tenants by application volume in the selected period.

### Share Links

Copyable URLs for:
- **Jobs Board**: `/b/{portal_slug}/jobs`
- **Campaign Apply Pages**: `/b/{portal_slug}/apply/{campaign_slug}` (if campaigns exist)

## Range Selection

Toggle between:
- **7 days** (default)
- **30 days**

## Database Queries

All queries are indexed and portal-scoped:
- Uses existing indexes on `cc_job_applications` and `cc_job_postings`
- Joins through `job_posting_id` to filter by `portal_id`
- Event-based SLA uses `cc_job_application_events.application_id` index

## Verification Checklist

- [ ] Page loads at `/app/mod/hiring-pulse`
- [ ] Summary cards display correct counts
- [ ] Range toggle switches between 7d/30d data
- [ ] Status bar chart renders with correct colors
- [ ] Top employers list shows up to 5 tenants
- [ ] Share links copy to clipboard on click
- [ ] Share links open in new tab on external link click
- [ ] Authorization rejects non-staff users
- [ ] Portal scoping prevents cross-portal data access

## API Response Schema

```json
{
  "ok": true,
  "range": "7d",
  "rangeDays": 7,
  "portalName": "CanadaDirect",
  "metrics": {
    "newApplicationsCount": 42,
    "applicationsByStatus": {
      "new": 15,
      "reviewing": 12,
      "interviewing": 8,
      "hired": 5,
      "rejected": 2
    },
    "medianFirstReplyMinutes": 47,
    "needsReplyCount": 8,
    "housingNeededCount": 18,
    "workPermitQuestionsCount": 23,
    "topEmployersByApplications": [
      { "tenantId": "uuid", "tenantName": "Resort Co", "applicationCount": 12 },
      { "tenantId": "uuid", "tenantName": "Hotel Inc", "applicationCount": 8 }
    ]
  },
  "shareLinks": [
    { "label": "Jobs Board", "url": "https://example.com/b/canadadirect/jobs" },
    { "label": "Campaign: Summer Hospitality", "url": "https://example.com/b/canadadirect/apply/summer-hospitality" }
  ]
}
```

## Security Notes

- All endpoints protected by `requirePortalStaff` middleware
- Portal scoping enforced via `ctx.portal_id` in all queries
- No cross-tenant data exposure
- No sensitive applicant PII exposed in metrics (only aggregates)

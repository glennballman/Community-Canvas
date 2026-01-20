# V3.5 Workflow Inventory (End-to-End)

**Generated:** 2026-01-20

---

## Workflow Summary

| # | Workflow | Steps | Status |
|---|----------|-------|--------|
| 1 | Manual Reservation | 6 | Implemented |
| 2 | Public Reservation Conversion | 8 | Implemented |
| 3 | Service Run Lifecycle | 7 | Implemented |
| 4 | Work Request Lifecycle | 7 | Implemented |
| 5 | Job Posting Lifecycle | 8 | Implemented |
| 6 | Housekeeping Task | 6 | Implemented |
| 7 | Fleet Management | 5 | Implemented |
| 8 | Circles Management | 5 | Implemented |
| 9 | Messaging/Notifications | 5 | Implemented |

---

## 1. Create Reservation (Manual/Operator)

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to reservations | `/app/reservations` | Via sidebar (BUSINESS_NAV) |
| 2 | Click "Create Reservation" | `/app/reservations` | Button on list page |
| 3 | Select asset/dates | Modal or new page | Asset picker + date range |
| 4 | Enter guest details | Form | Name, email, phone |
| 5 | Review and confirm | Review step | Pricing summary |
| 6 | View reservation | `/app/reservations/:id` | Confirmation |

**Alternative:** Create via proposal flow at `/app/proposals/:proposalId`

---

## 2. Public Reservation Conversion Loop

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Land on portal | `/p/:portalSlug` | Public portal home |
| 2 | Click "Reserve" | `/p/:portalSlug/reserve` | Start reservation |
| 3 | Search availability | `/reserve/:portal/:offer/start/search` | Date/guest picker |
| 4 | Enter details | `/reserve/:portal/:offer/start/details` | Guest info |
| 5 | Review cart | `/reserve/:portal/:offer/start/review` | Pricing/add-ons |
| 6 | Capture identity | `/reserve/:portal/:offer/start/confirm` | Email/phone |
| 7 | Payment (optional) | Payment modal | Stripe/PSP |
| 8 | Confirmation | `/reserve/confirmation/:token` | Success page |

**Sub-flows:**
- **Split Pay:** Guest receives `/p/proposal/:proposalId/pay/:token` link
- **Invite Others:** Host sends trip invite, guest accesses `/trip/:accessCode`
- **Resume Later:** Guest uses `/reserve/resume` with token

---

## 3. Service Run Lifecycle

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to service runs | `/app/services/runs` | Via sidebar (COMMUNITY_NAV) |
| 2 | Click "Create Run" | `/app/services/runs/new` | Run creation form |
| 3 | Fill details + dates | Form | Service type, dates, capacity |
| 4 | Save and publish | API call | Run saved, visible to contractors |
| 5 | Collect signups | Run detail page | Contractors sign up |
| 6 | Open bidding (optional) | Bidding section | Price competition |
| 7 | Select contractor | Award action | Contractor notified |

**N3 Monitoring:**
- **Attention Queue:** `/app/n3/attention` - Real-time run health
- **Run Monitor:** `/app/n3/monitor/:runId` - Deviation tracking

---

## 4. Work Request Lifecycle

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to work requests | `/app/work-requests` | Via sidebar |
| 2 | Click "Create Request" | New request form | Request creation |
| 3 | Describe work needed | Form | Title, description, budget |
| 4 | Attach media (optional) | Upload component | Photos/docs |
| 5 | Submit for bids | API call | Request visible to contractors |
| 6 | Review bids | Request detail | Compare bids |
| 7 | Message bidders | Conversation thread | Clarify details |
| 8 | Award contractor | Award action | Work begins |

**Bidding Features:**
- Bid comparison table
- Contractor messaging
- Media attachments on bids
- Award with notification

---

## 5. Job Posting Lifecycle

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to jobs | `/app/jobs` | Direct URL (no nav) |
| 2 | Click "Create Job" | `/app/jobs/new` | Job editor |
| 3 | Fill job details | Form | Title, description, requirements |
| 4 | Set compensation | Form | Pay rate, benefits |
| 5 | Publish to destinations | `/app/jobs/:id/destinations` | Select portals |
| 6 | Review applicants | `/app/jobs/:id/applications` | Application list |
| 7 | Message applicant | Application detail | Threaded messaging |
| 8 | Progress status | Status dropdown | Screening → Interview → Offer → Hired |

**Public Side:**
- Job listing: `/b/:portalSlug/jobs`
- Job detail: `/b/:portalSlug/jobs/:postingId`
- Apply: `/b/:portalSlug/jobs/:postingId/apply`

**Moderation:**
- Jobs queue: `/app/mod/jobs`
- Applications queue: `/app/mod/applications`
- Hiring pulse: `/app/mod/hiring-pulse`

---

## 6. Housekeeping Task Workflow

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to housekeeping | `/app/ops/housekeeping` | Direct URL (no nav) |
| 2 | View task list | Task list | Filter by status/unit |
| 3 | Open task detail | Task detail modal | Full task info |
| 4 | Upload "before" photo | Photo upload | Pre-clean state |
| 5 | Complete work | Task actions | Physical work |
| 6 | Upload "after" photo | Photo upload | Post-clean state |
| 7 | Mark complete | Status update | Task closed |

**Issue Reporting:**
- Upload issue photo
- Create incident from task
- Link to `/app/ops/incidents`

---

## 7. Fleet Management Workflow

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to fleet | `/app/fleet` | Direct URL (no nav) |
| 2 | View fleet dashboard | Dashboard | Asset overview |
| 3 | View asset list | `/app/fleet/assets` | All fleet assets |
| 4 | Open asset detail | `/app/fleet/assets/:id` | Asset info |
| 5 | Add maintenance record | Maintenance form | Schedule/log maintenance |
| 6 | View maintenance | `/app/fleet/maintenance` | Upcoming/history |

**Maintenance Types:**
- Scheduled (preventive)
- Unscheduled (repair)
- Inspection
- Registration/compliance

---

## 8. Circles Workflow

**Happy Path:**

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to circles | `/app/circles` | Direct URL (no nav) |
| 2 | Click "Create Circle" | `/app/circles/new` | Circle creation |
| 3 | Name circle + settings | Form | Name, description, type |
| 4 | Add members | Circle detail | Member picker |
| 5 | Set delegations | Delegation section | Permission grants |

**Circle Features:**
- Member management
- Resource sharing
- Delegation chains
- Circle messaging (if enabled)

---

## 9. Messaging & Notifications

### 9a. Messaging Workflow

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | Navigate to messages | `/app/messages` | Via sidebar |
| 2 | View inbox | Conversation list | All conversations |
| 3 | Open conversation | Conversation detail | Message thread |
| 4 | Send message | Compose area | Text + attachments |
| 5 | Mark as read | Automatic | On view |

### 9b. Notifications Workflow

| Step | Action | Route | Notes |
|------|--------|-------|-------|
| 1 | See unread badge | Sidebar | Badge count |
| 2 | Navigate to notifications | `/app/notifications` | Direct URL |
| 3 | View notification list | Notification center | All notifications |
| 4 | Click notification | Target route | Navigate to source |
| 5 | Mark as read | Click or bulk | Clears badge |

**Notification Types:**
- Reservation updates
- Application updates
- Message notifications
- System alerts
- Task assignments

---

## Cross-Cutting Workflows

### Authentication Flow

| Step | Action | Route |
|------|--------|-------|
| 1 | Navigate to app | `/app` |
| 2 | Redirect to login | `/login` |
| 3 | Enter credentials | Login form |
| 4 | Authenticate | API call |
| 5 | Redirect to dashboard | `/app/dashboard` |

### Tenant Selection

| Step | Action | Route |
|------|--------|-------|
| 1 | Authenticated user | `/app` |
| 2 | See tenant picker | TenantPicker |
| 3 | Select tenant | Click tenant |
| 4 | Set context | Context API |
| 5 | Load dashboard | `/app/dashboard` |

### Portal Selection (Multi-Portal)

| Step | Action | Route |
|------|--------|-------|
| 1 | In tenant context | `/app/*` |
| 2 | Open portal selector | Sidebar component |
| 3 | Select portal | Click portal |
| 4 | Set portal context | Context API |
| 5 | Continue work | Portal-scoped UI |

---

## Workflow Gaps

| Workflow | Gap | Impact |
|----------|-----|--------|
| Jobs | No nav entry | Low discoverability |
| Fleet | No nav entry | Low discoverability |
| Circles | No nav entry | Low discoverability |
| Housekeeping | No nav entry | Low discoverability |
| Admin | Only Settings link | Partial discoverability |
| Notifications | No nav entry | Badge visible, link missing |

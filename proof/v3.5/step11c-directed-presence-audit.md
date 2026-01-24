# STEP 11C Audit: Directed Operational Presence — Inventory Report

**Date**: 2026-01-24  
**Mode**: READ-ONLY AUDIT  
**Goal**: Determine what exists for implementing private stakeholder notifications + invitations tied to a service run

---

## A) DATABASE INVENTORY

### A1. Message & Notification Tables

| Table | Purpose |
|-------|---------|
| `cc_notifications` | **PRIMARY** - Full notification system with categories, priorities, channels, templates |
| `cc_notification_deliveries` | Tracks delivery status per channel (email, sms, push) |
| `cc_notification_preferences` | User preferences for channels, digest settings, quiet hours |
| `cc_notification_templates` | Reusable templates with subject/body patterns |
| `cc_messages` | Conversation messages (chat-style, conversation_id foreign key) |
| `cc_run_outreach_campaigns` | **RELEVANT** - Run-specific outreach campaigns with target emails |
| `cc_run_outreach_messages` | **RELEVANT** - Individual outreach messages per campaign |
| `cc_outreach_messages` | Generic outreach messages |
| `cc_reservation_notifications` | Reservation-specific notifications |
| `cc_bid_messages` | Bid conversation messages |
| `cc_dispute_messages` | Dispute conversation messages |

### A2. Invitation / Token Tables

| Table | Purpose | Relevance |
|-------|---------|-----------|
| `cc_invitations` | **PRIMARY** - Universal invitation system | **HIGH** - Has `context_type` enum with `service_run` value |
| `cc_shared_run_invites` | **RELEVANT** - Invites for shared service runs | **HIGH** - Service provider invite model exists |
| `cc_tenant_invitations` | Tenant staff invitations | LOW |
| `cc_trip_invitations` | Trip party invitations | MEDIUM - Similar pattern |
| `cc_federated_tokens` | Cross-tenant federation tokens | LOW |
| `cc_work_disclosure_preview_tokens` | Preview tokens for work disclosures | MEDIUM - Reusable pattern |

### A3. Key Schema: cc_invitations

```sql
id                      uuid PRIMARY KEY
inviter_tenant_id       uuid          -- Who sent the invite
inviter_party_id        uuid          -- Which party sent it
inviter_individual_id   uuid          -- Which user sent it
context_type            enum('job', 'service_run', 'property', 'crew', 'conversation', 'portal', 'community', 'tenant', 'standby_pool')
context_id              uuid          -- The run ID (for service_run context)
context_name            text          -- Display name
invitee_role            enum          -- Role granted on claim
invitee_email           text          -- Email address (external recipient)
invitee_phone           text          -- Phone (external recipient)
invitee_name            text          -- Display name
claim_token             text NOT NULL -- Token for claim URL
claim_token_expires_at  timestamptz   -- Default 30 days
status                  enum('pending', 'sent', 'viewed', 'claimed', 'expired', 'revoked')
sent_at, viewed_at, claimed_at timestamps
message                 text          -- Personal message from inviter
metadata                jsonb         -- Extension point
```

**Key finding**: `context_type = 'service_run'` already exists in the enum!

### A4. Key Schema: cc_shared_run_invites

```sql
id                    uuid PRIMARY KEY
shared_run_id         uuid          -- Links to cc_shared_service_runs
contractor_name       text
contractor_email      text
contractor_telephone  text
invite_token          text          -- Claim token
status                enum('pending', 'sent', 'delivered', 'opened', 'claimed', 'declined', 'bounced')
invited_by_party_id   uuid
sent_at, opened_at, claimed_at timestamps
```

### A5. Contacts / Address Book Tables

| Table | Purpose |
|-------|---------|
| `cc_external_contact_points` | External contacts (email, phone) |
| `cc_crm_properties` | CRM property records |
| `cc_staging_import_batches` | Import batch tracking |
| `cc_staging_import_raw` | Raw import data |

---

## B) BACKEND ROUTES / SERVICES INVENTORY

### B1. Notification Routes (`server/routes/notifications.ts`)

```
GET  /api/notifications           - List notifications (paginated, filterable)
POST /api/notifications/:id/read  - Mark single notification read
POST /api/notifications/read-all  - Mark all notifications read
```

**Auth**: `requireAuth` - Uses individual_id and tenant_id from context.

### B2. Shared Runs Routes (`server/routes/shared-runs.ts`)

**Existing invite endpoints**:
```
POST /api/shared-runs/:id/invite-contractor  - Create contractor invite with token
POST /api/shared-runs/:id/claim              - Claim run with invite_token
POST /api/shared-runs/:id/outreach-campaign  - Create outreach campaign
```

**Key code pattern** (invite creation):
```typescript
const invite_token = randomBytes(16).toString('hex');
await client.query(`
  INSERT INTO cc_shared_run_invites (
    shared_run_id, contractor_name, contractor_email, contractor_telephone,
    contractor_website, source, source_notes, invite_method, invite_token,
    status, invited_by_party_id, invited_by_individual_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
`);
```

### B3. Messaging Service (`server/services/messagingRoutingService.ts`)

**createNotification helper** (line 239):
```typescript
async function createNotification(recipientId: string, viaCircleId?: string): Promise<void> {
  await serviceQuery(`
    INSERT INTO cc_notifications (
      recipient_individual_id, category, priority, channels,
      context_type, context_id, context_data, body, short_body,
      action_url, sender_tenant_id, metadata
    ) VALUES (...)
    ON CONFLICT (context_type, context_id, recipient_individual_id) DO UPDATE SET updated_at = now()
  `);
}
```

### B4. Email Sending

**Finding**: NO email sending service exists.

- No `sendEmail`, `nodemailer`, `postmark`, `sendgrid`, `ses`, `mailgun` imports found
- No SMTP configuration
- Notifications are **in-app only** (`channels: ARRAY['in_app']`)

### B5. Queue/Job System

**Existing patterns**:
- Pipeline scheduler (cron-based) in `server/pipelines/index.ts`
- RTR worker in `server/workers/rtr-worker.ts`
- Records queue worker in `server/lib/records/queueWorker.ts`
- No dedicated notification queue/worker

---

## C) UI INVENTORY

### C1. Notifications Page

**File**: `client/src/pages/app/NotificationsPage.tsx`

```typescript
interface Notification {
  id, subject, body, shortBody, category, priority,
  actionUrl, actionLabel, contextType, contextId,
  status, createdAt, readAt, senderName
}

// Query pattern
useQuery<NotificationsResponse>({
  queryKey: [`/api/notifications?status=${activeTab}&limit=100`],
});
```

### C2. Provider Run Detail Page

**File**: `client/src/pages/app/provider/ProviderRunDetailPage.tsx`

- Already has `PublishRunModal` for portal publishing
- Actions section exists for run-level operations
- **This is the natural place for "Notify Stakeholders" button**

### C3. Existing Invite Components

| Component | Location | Reusable? |
|-----------|----------|-----------|
| `InvitePanel` | `client/src/components/proposals/InvitePanel.tsx` | **YES** - Generic invite form with email/phone, role selection, link copy |
| `ForwardToApproverPanel` | `client/src/components/proposals/` | Pattern reference |

**InvitePanel key features**:
- Contact type toggle (email/phone)
- Role selection dropdown
- Generates invite link via API
- Copy to clipboard functionality
- Uses `inviteProposalMember` API pattern

---

## D) AUTH / IDENTITY / RECIPIENT MODEL

### D1. Recipient Representations

| Type | Tables | Usage |
|------|--------|-------|
| User ID (`individual_id`) | `cc_notifications.recipient_individual_id` | Internal users |
| Tenant ID | `cc_notifications.recipient_tenant_id` | Tenant-wide notifications |
| Email (external) | `cc_invitations.invitee_email` | External stakeholders |
| Phone (external) | `cc_invitations.invitee_phone` | External stakeholders |

### D2. User Lookup by Email

**Finding**: No dedicated "lookup user by email" endpoint. User creation is via:
- Registration flow
- SSO/OAuth
- Invitation claim

### D3. Existing Token Systems

| System | Location | Reusable? |
|--------|----------|-----------|
| `claim_token` | `cc_invitations` | **YES** - 30-day expiry, status tracking |
| `invite_token` | `cc_shared_run_invites` | **YES** - hex token pattern |
| `preview_tokens` | `cc_work_disclosure_preview_tokens` | Pattern reference |
| JWT auth | `server/routes/provider.ts` | Standard pattern |

### D4. Token Verification Middleware

```typescript
// server/routes/provider.ts line 55
const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
```

No dedicated invitation verification middleware - tokens are verified inline in route handlers.

---

## 1) EXISTING BUILDING BLOCKS (Reusable)

### Tables
- **`cc_invitations`** - Already has `context_type = 'service_run'` enum value
- **`cc_notifications`** - Full notification system ready
- **`cc_run_outreach_campaigns`** + `cc_run_outreach_messages` - Run-specific outreach

### Routes/Services
- **`/api/notifications/*`** - Complete notification CRUD
- **`/api/shared-runs/:id/invite-contractor`** - Invite pattern exists
- **`messagingRoutingService.createNotification()`** - Notification insertion helper

### UI Components
- **`InvitePanel`** - Generic invite form (email/phone/role/link)
- **`NotificationsPage`** - Notification list + mark read
- **`ProviderRunDetailPage`** - Has action buttons section

### Plumbing
- Token generation: `randomBytes(16).toString('hex')`
- JWT verification pattern exists
- Invitation status tracking (`pending` → `sent` → `viewed` → `claimed`)

---

## 2) GAPS (What's Missing for STEP 11C)

### DB
- No `cc_run_stakeholder_notifications` or similar run-specific notification tracking
- No link from `cc_n3_runs` to `cc_invitations` (but can use `context_id` foreign key pattern)

### API
- No `/api/provider/runs/:id/notify-stakeholders` endpoint
- No `/api/invitations/claim/:token` public endpoint (inline verification only)
- No email sending service (notifications are in-app only)

### UI
- No "Notify Stakeholders" button on `ProviderRunDetailPage`
- No `NotifyStakeholdersModal` component
- No stakeholder list management for a run

---

## 3) RECOMMENDED MINIMAL IMPLEMENTATION PATH

### Phase 1: Core Plumbing (MVP)

**Step 1**: Create `/api/provider/runs/:id/stakeholder-invites` endpoint
- Create invitation in `cc_invitations` with `context_type = 'service_run'`
- Generate `claim_token`, store `invitee_email`, `message`
- Return claim URL for copy/paste

**Step 2**: Create public claim endpoint `/api/i/:token`
- Verify token in `cc_invitations`
- Update status to `viewed` on load
- Show run context (read-only view)
- Option to claim (creates party membership)

**Step 3**: Create `NotifyStakeholdersModal` component
- Reuse patterns from `InvitePanel`
- Email input + optional message
- Generate and display claim link

**Step 4**: Add "Notify" button to `ProviderRunDetailPage`
- Opens `NotifyStakeholdersModal`
- Shows list of existing stakeholder invitations

### Phase 2: Polish (Post-MVP)

- Email sending integration (Resend/Postmark)
- Notification when invite is viewed/claimed
- Bulk invite from contact list
- Stakeholder role selection

### Best Places to Add

| Feature | Location |
|---------|----------|
| "Notify stakeholders" action | `ProviderRunDetailPage.tsx` action buttons |
| Invitation entry modal | New `NotifyStakeholdersModal.tsx` (copy `InvitePanel` patterns) |
| Acceptance experience | New `/i/:token` route + `InvitationClaimPage.tsx` |

---

## Certification

**STEP 11C AUDIT COMPLETE**

Key finding: The `cc_invitations` table already supports `context_type = 'service_run'`. The implementation path is clear:
1. Use existing invitation infrastructure
2. Add provider-facing endpoints
3. Add public claim experience
4. Wire up UI from existing patterns

Email sending is the only missing infrastructure piece for full "directed presence" - MVP can work with copy/paste links.

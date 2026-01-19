# Community Canvas / CivOS V3.5 Messaging Forensic Inventory

**Generated:** 2026-01-19  
**Scope:** Complete audit of all messaging-related tables, APIs, UI components, and security patterns

---

## DELIVERABLE 1 — DATABASE INVENTORY (Messaging Spine)

### 1.1 Core Messaging Tables

#### cc_conversations
**Owner:** General / Work Requests
**Purpose:** Primary conversation container linking contractors ↔ owners for work requests

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| work_request_id | uuid | FK to cc_work_requests |
| contractor_party_id | uuid | FK to cc_parties |
| owner_party_id | uuid | FK to cc_parties |
| contractor_actor_party_id | uuid | Acting party |
| owner_actor_party_id | uuid | Acting party |
| state | conversation_state | ENUM |
| contact_unlocked | boolean | Contact visibility gate |
| contact_unlock_gate | ENUM | none/prior_relationship/deposit/etc |
| last_message_at | timestamptz | |
| message_count | integer | |
| unread_owner | integer | Unread counter for owner |
| unread_contractor | integer | Unread counter for contractor |

**RLS:** Enabled. Policies: `cc_conversations_service_bypass`, `cc_conversations_tenant_read`
**Indices:** conversation_id, party IDs

---

#### cc_messages
**Owner:** General Messaging
**Purpose:** Individual message records

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| conversation_id | uuid | FK |
| sender_party_id | uuid | Nullable |
| sender_individual_id | uuid | Nullable |
| sender_participant_id | uuid | FK to cc_conversation_participants |
| sender_circle_id | uuid | **FK - Circle messaging support** |
| sender_portal_id | uuid | **FK - Portal scoping** |
| message_type | ENUM | normal/system/etc |
| content | text | |
| structured_data | jsonb | |
| attachments | jsonb | |
| was_redacted | boolean | |
| redacted_content | text | |
| visibility | text | normal/private/etc |
| read_at | timestamptz | |
| created_at | timestamptz | |

**RLS:** Enabled. Policies: `cc_messages_service_bypass`, tenant-scoped read via conversation join
**Indices:** conversation_id, sender_party, sender_individual, sender_participant

---

#### cc_conversation_participants
**Owner:** Circle-aware messaging
**Purpose:** Multi-participant tracking (individuals, parties, circles, tenants, portals)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| conversation_id | uuid | FK |
| participant_type | ENUM | individual/party/circle/tenant/portal |
| party_id | uuid | XOR constraint |
| individual_id | uuid | XOR constraint |
| circle_id | uuid | **Circle participant** |
| tenant_id | uuid | |
| portal_id | uuid | **Portal scoping** |
| actor_role | text | Role context |
| can_send | boolean | |
| can_see_history | boolean | |
| is_active | boolean | |
| joined_at | timestamptz | |
| left_at | timestamptz | |

**Constraint:** XOR - exactly one identity type per row
**Indices:** conversation_id, party_id, individual_id, active status

---

### 1.2 Notification Tables

#### cc_notifications
**Owner:** Notifications
**Purpose:** In-app and multi-channel notification records

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| template_id | uuid | FK to cc_notification_templates |
| template_code | text | |
| recipient_tenant_id | uuid | |
| recipient_party_id | uuid | |
| recipient_individual_id | uuid | |
| subject | text | |
| body | text | |
| category | notification_category | |
| priority | notification_priority | |
| channels | text[] | ["in_app", "email", "sms", "push"] |
| context_type | text | |
| context_id | uuid | |
| context_data | jsonb | |
| action_url | text | |
| status | notification_status | pending/sent/delivered/read/failed |
| sent_at | timestamptz | |
| read_at | timestamptz | |

**Indices:** recipient_tenant, recipient_party, status, category, context

---

#### cc_notification_templates
**Owner:** Notifications
**Purpose:** Reusable notification templates

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| code | text | Unique identifier |
| name | text | |
| category | notification_category | |
| subject_template | text | |
| body_template | text | |
| short_body_template | text | |
| email_template_id | text | |
| sms_template_id | text | |
| push_template | jsonb | |
| default_channels | text[] | |
| default_priority | notification_priority | |
| is_actionable | boolean | |
| action_url_template | text | |

---

#### cc_notification_preferences
**Owner:** Notifications
**Purpose:** User/tenant notification settings

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | Unique |
| party_id | uuid | Unique |
| individual_id | uuid | Unique |
| email_enabled | boolean | |
| sms_enabled | boolean | |
| push_enabled | boolean | |
| in_app_enabled | boolean | |
| digest_frequency | digest_frequency | immediate/daily/weekly |
| timezone | text | |

---

#### cc_notification_deliveries
**Owner:** Notifications
**Purpose:** Per-channel delivery tracking

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| notification_id | uuid | FK |
| channel | notification_channel | |
| status | notification_status | |
| provider_name | text | |
| provider_message_id | text | |
| failure_reason | text | |

---

#### cc_notification_digests
**Owner:** Notifications
**Purpose:** Batched digest notifications

---

### 1.3 Subsystem-Specific Messaging Tables

| Table | Owner | Purpose |
|-------|-------|---------|
| cc_bid_messages | Jobs/Bids | Messages attached to bid workflows |
| cc_dispute_messages | Disputes | Dispute thread messages |
| cc_outreach_messages | Outreach | Customer outreach messages |
| cc_run_outreach_messages | Service Runs | Service run notifications |
| cc_shared_outreach_messages | Shared Runs | Shared service run comms |
| cc_reservation_notifications | Reservations | Reservation status updates |
| cc_staging_host_notifications | Staging | Host staging alerts |
| cc_rtr_message_log | RTR | Real-time relay message log |
| cc_rtr_webhook_inbox | RTR | Inbound webhook messages |
| cc_message_redactions | Moderation | Redaction audit trail |

---

### 1.4 Views

| View | Purpose |
|------|---------|
| v_conversation_circle_recipients | Circle member resolution for fan-out |
| v_notification_stats | Notification metrics aggregation |
| v_pending_notifications | Pending notification queue view |

---

### 1.5 Functions & Triggers

**File:** `server/services/messagingRoutingService.ts`

| Function | Purpose |
|----------|---------|
| `resolveCircleRecipients(circleId)` | Resolves all individuals in a circle (members + delegatees) |
| `getConversationCircleParticipants(conversationId)` | Gets circle participants in a conversation |
| `resolveConversationRecipients(conversationId)` | Resolves all individual recipients (direct + circle) |
| `findOrCreateCircleConversation(...)` | Creates circle conversation with initial message |
| `fanOutMessageToRecipients(conversationId, messageId, senderId)` | Notification fan-out to recipients |

---

## DELIVERABLE 2 — API INVENTORY (All Messaging Endpoints)

### 2.1 Conversations Router (`/api/conversations`)
**File:** `server/routes/conversations.ts`
**Mount:** `/api/conversations`

| Method | Route | Description | Auth | Portal Scope |
|--------|-------|-------------|------|--------------|
| POST | `/circle` | Create circle conversation | Individual + Circle context | Via circle_id |
| POST | `/cc_conversations` | Create work request conversation | Party resolver | Via work_request |
| GET | `/cc_conversations` | List conversations | Party resolver | Via actor party |
| GET | `/cc_conversations/:id` | Get conversation detail | Party resolver | Via party membership |
| GET | `/cc_conversations/:id/contact-status` | Check contact unlock status | Party resolver | N/A |
| POST | `/cc_conversations/:id/cc_messages` | Send message | Party resolver | Via conversation |
| GET | `/cc_conversations/:id/cc_messages` | Get messages | Party resolver | Via conversation |
| PATCH | `/cc_conversations/:id/state` | Update conversation state | Party resolver | Via conversation |
| POST | `/cc_conversations/:id/unlock-contact` | Unlock contact info | Party resolver | Via conversation |
| GET | `/conversations` | Unified conversation list | Session | Via tenant context |

**Contact Redaction:** `redactContactInfo()` applied when `contact_unlocked = false`
**Message Blocking:** `shouldBlockMessage()` prevents PII in pre-unlock messages

---

### 2.2 P2 Conversations Router (`/api/p2/conversations`)
**File:** `server/routes/p2-conversations.ts`
**Mount:** `/api/p2/conversations`

| Method | Route | Description | Auth | Portal Scope |
|--------|-------|-------------|------|--------------|
| GET | `/` | List conversations (tenant-scoped, circle-aware) | Tenant context | Via tenant_id + circle_id |
| GET | `/:id` | Get single conversation with messages | Tenant context | Via tenant or circle |
| POST | `/:id/messages` | Send message | Tenant context | Via conversation |

**Circle Access Validation:** `validateCircleAccess(circleId, tenantId)` checks hub_tenant_id OR membership

---

### 2.3 Dashboard Messaging (`/api/p2/dashboard`)
**File:** `server/routes/p2-dashboard.ts`

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/messages/unread-count` | Get unread message count | Session |

---

### 2.4 Jobs Portal Messaging

**File:** `server/routes/public-jobs.ts`

Jobs applications include a `message` field in the application payload, but there is **NO dedicated job messaging thread system**. Applications are one-way.

**UNCONFIRMED:** No `cc_job_threads` or applicant ↔ operator chat endpoint found.

---

## DELIVERABLE 3 — FRONTEND INVENTORY (UI + Components)

### 3.1 Pages

| Route | File | Renders | Role Gating |
|-------|------|---------|-------------|
| `/app/messages` | `client/src/pages/ConversationsPage.tsx` | ConversationList + ConversationView split pane | Authenticated user |
| `/app/conversations` | Redirect → `/app/messages` | N/A | N/A |

**Missing Pages:**
- ❌ No `/app/inbox` (global unified inbox)
- ❌ No `/app/notifications` (notification center)
- ❌ No `/app/jobs/:id/messages` (job applicant chat)
- ❌ No `/app/circles/:id/messages` (dedicated circle messaging view)

---

### 3.2 Components

**File:** `client/src/components/conversations/`

| Component | Purpose |
|-----------|---------|
| `ConversationList.tsx` | Left pane: lists conversations with filter, unread counts, circle indicator |
| `ConversationView.tsx` | Right pane: message thread with send, contact unlock |
| `ContextIndicator.tsx` | Shows current circle/tenant context |

**Features in ConversationList:**
- Circle conversation creation (`POST /api/conversations/circle`)
- Filter by state (all/interest/quoting/etc.)
- Unread count display per conversation
- Circle context awareness via `useQuery(['/api/me/context'])`

**Features in ConversationView:**
- Message list (oldest → newest)
- Send message form
- Contact unlock button (owner/contractor)
- Message redaction indicator

---

### 3.3 Hooks & Data Fetching

| Pattern | Implementation |
|---------|----------------|
| Conversation list | `api<{ conversations: Conversation[] }>('/api/conversations')` |
| Message fetch | `api.get<{ messages: Message[] }>('/conversations/${id}/messages')` |
| Context | `useQuery<UserContext>({ queryKey: ['/api/me/context'] })` |
| Create circle conv | `useMutation({ mutationFn: apiRequest('POST', '/api/conversations/circle') })` |

**Polling/SSE/WebSocket:** ❌ Not implemented. Messages fetched on mount only.

---

### 3.4 Unread Badge / Counter

**Locations:**
- `client/src/pages/app/DashboardPage.tsx` - calls `/api/p2/dashboard/messages/unread-count`
- `client/src/components/conversations/ConversationList.tsx` - per-conversation `unread_count` field

**Global Unread Badge:** ⚠️ Not displayed in nav sidebar. Counter endpoint exists but no bell/badge UI.

---

## DELIVERABLE 4 — PERMISSIONS / SECURITY MODEL (Portal Isolation Proof)

### 4.1 Portal Scoping

**cc_messages:**
- `sender_portal_id` column (uuid FK)
- `sender_circle_id` column (uuid FK)

**cc_conversation_participants:**
- `portal_id` column (uuid)
- `circle_id` column (uuid)
- `tenant_id` column (uuid)

### 4.2 RLS Policies

**cc_conversations:**
```sql
-- Service bypass
POLICY cc_conversations_service_bypass
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')

-- Tenant read via party membership
POLICY cc_conversations_tenant_read
  USING (
    EXISTS (SELECT 1 FROM cc_parties p WHERE p.id = contractor_party_id AND p.tenant_id::text = current_setting('app.tenant_id'))
    OR EXISTS (SELECT 1 FROM cc_parties p WHERE p.id = owner_party_id AND p.tenant_id::text = current_setting('app.tenant_id'))
  )
```

**cc_messages:**
```sql
POLICY cc_messages_service_bypass
  USING (current_setting('app.tenant_id', true) = '__SERVICE__')
```

### 4.3 Circle Access Validation

**File:** `server/routes/p2-conversations.ts`

```typescript
async function validateCircleAccess(circleId, tenantId): Promise<boolean> {
  // Returns true if:
  // 1. Circle's hub_tenant_id matches tenant, OR
  // 2. Tenant has active membership in circle
}
```

### 4.4 Contact Information Redaction

**File:** `server/lib/contactRedaction.ts`

- `redactContactInfo()` - Strips PII from messages when contact not unlocked
- `shouldBlockMessage()` - Prevents sending messages with phone/email patterns pre-unlock

### 4.5 Anonymization Patterns

- ❌ No anonymization in messaging currently
- ✅ Contact redaction for pre-deposit conversations

---

## DELIVERABLE 5 — FEATURE MATRIX (What Exists vs What's Missing)

| Feature | Status | Evidence |
|---------|--------|----------|
| Inbox List | ✅ | `ConversationList.tsx`, `/api/conversations` |
| Thread View | ✅ | `ConversationView.tsx`, `/api/conversations/:id/messages` |
| Send Message | ✅ | POST `/api/conversations/:id/messages` |
| Mark Read | ⚠️ Partial | `read_at` column exists, no explicit mark-read endpoint |
| Unread Counters | ✅ | `unread_owner`, `unread_contractor` columns, `/messages/unread-count` |
| In-App Notifications | ⚠️ Partial | `cc_notifications` table exists, no UI bell/center |
| Email Notifications | ⚠️ Schema only | `cc_notification_deliveries` supports email channel, no send logic found |
| SMS Notifications | ⚠️ Schema only | Supported in schema, no implementation |
| Push Notifications | ⚠️ Schema only | `push_template` column, no implementation |
| Mentions | ❌ | No `cc_mentions` table or @-mention parsing |
| Attachments | ⚠️ Schema only | `attachments` jsonb column, no upload UI |
| System Messages | ✅ | `message_type = 'system'`, auto-generated on conversation events |
| Search | ❌ | No message search endpoint or UI |
| Moderation / Audit | ✅ | `cc_message_redactions`, `was_redacted` column |
| Circle Messaging | ✅ | `POST /circle`, circle participant tracking, fan-out service |
| Jobs Messaging | ❌ | No applicant ↔ operator thread system |
| Notification Templates | ✅ | `cc_notification_templates` with categories |
| Notification Preferences | ✅ | `cc_notification_preferences` per-user/tenant |

---

## DELIVERABLE 6 — GAP LIST + PRIORITIZED NEXT STEPS

### Missing UI Screens

| Priority | Screen | Route | Notes |
|----------|--------|-------|-------|
| P1 | Notification Center | `/app/notifications` | Display cc_notifications, mark read |
| P1 | Global Unread Badge | Sidebar nav | Show aggregate unread count |
| P2 | Job Application Thread | `/app/jobs/:id/threads/:appId` | Applicant ↔ operator messaging |
| P2 | Circle Message Feed | `/app/circles/:id/messages` | Dedicated circle conversation view |
| P3 | Message Search | `/app/messages?q=` | Full-text search in messages |

### Missing API Endpoints

| Priority | Endpoint | Purpose |
|----------|----------|---------|
| P1 | `POST /api/notifications/:id/read` | Mark notification as read |
| P1 | `GET /api/notifications` | List user's notifications |
| P2 | `POST /api/jobs/:id/threads` | Create job applicant thread |
| P2 | `GET /api/jobs/:id/threads` | List job threads |
| P2 | `POST /api/conversations/:id/mark-read` | Explicit mark-read |
| P3 | `GET /api/messages/search` | Message search |

### Missing Policies/Guards

| Priority | Issue |
|----------|-------|
| P2 | Jobs messaging needs portal_id scoping when implemented |
| P3 | Notification delivery audit trail (who sent, when delivered) |

### UX Gaps

| Priority | Gap | Resolution |
|----------|-----|------------|
| P1 | No polling/realtime updates | Add SSE or WebSocket for message stream |
| P1 | No unread badge in nav | Add badge to "Messages" nav item |
| P2 | No attachment upload UI | Add media picker to message composer |
| P2 | Circle messages not in unified inbox | Merge circle + work_request conversations in list |

---

## STRICT PRIORITY ORDER for V3.5 Role-to-Nav Completion

1. **P1: Notification Center Page** (`/app/notifications`)
   - Add `GET /api/notifications` endpoint
   - Create NotificationsPage.tsx
   - Add nav item with unread badge

2. **P1: Global Unread Badge**
   - Add unread count to sidebar Messages nav item
   - Use existing `/api/p2/dashboard/messages/unread-count`

3. **P2: Mark Read Endpoint**
   - Add `POST /api/conversations/:id/mark-read`
   - Add `POST /api/notifications/:id/read`

4. **P2: Jobs Messaging (if required)**
   - Create cc_job_threads table
   - Create job messaging API endpoints
   - Add thread UI to job detail page

5. **P3: Realtime Updates**
   - Implement SSE stream for new messages
   - Auto-update conversation list on new message

---

## APPENDIX: File Paths Referenced

### Database Schema
- `shared/schema.ts` (lines 3906, 5048-5234)

### Migrations
- `server/migrations/099_messages_rls_and_participants.sql`

### Backend Routes
- `server/routes/conversations.ts` (1022 lines)
- `server/routes/p2-conversations.ts` (470 lines)
- `server/routes/p2-dashboard.ts` (line 101)

### Services
- `server/services/messagingRoutingService.ts` (444 lines)
- `server/lib/contactRedaction.ts`
- `server/lib/partyResolver.ts`

### Frontend Pages
- `client/src/pages/ConversationsPage.tsx` (189 lines)

### Frontend Components
- `client/src/components/conversations/ConversationList.tsx` (320 lines)
- `client/src/components/conversations/ConversationView.tsx` (244 lines)
- `client/src/components/conversations/ContextIndicator.tsx`

### Navigation
- `client/src/lib/routes/v3Nav.ts` - "Messages" nav item at `/app/messages`
- `client/src/App.tsx` - Route registration line 416

---

**END OF INVENTORY**

# Coordination Circles Forensic Audit

**Audit Date:** January 15, 2026  
**Scope:** Existing implementation only - no proposals

---

## Executive Summary

**Finding:** There is NO explicit "Coordination Circle" entity in the Community Canvas codebase. However, several related constructs exist that partially fulfill coordination use cases:

1. **Federation Agreements** - Cross-tenant resource sharing (partially implemented)
2. **Shared Service Runs** - Multi-party coordination for contractor mobilization (implemented)
3. **Portal Members** - Community/portal-level group membership (implemented)
4. **Tenant Switching** - Users can switch between tenant contexts (implemented)
5. **Activity Ledger** - Audit trail with actor attribution (implemented)

The system currently uses **tenant-centric** coordination rather than **circle-centric** coordination.

---

## 1. DATA MODEL & SCHEMA

### 1.1 Tables That COULD Represent Coordination Groups

#### `cc_portal_members` - Portal-level membership
**Purpose:** Tracks membership in a portal (community marketplace)

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| portal_id | uuid | FK to cc_portals |
| tenant_id | uuid | Tenant member (nullable) |
| party_id | uuid | Party member (nullable) |
| individual_id | uuid | Individual member (nullable) |
| role | enum | owner/admin/moderator/member/vendor |
| can_post_jobs | boolean | Permission flag |
| can_post_listings | boolean | Permission flag |
| can_invite_members | boolean | Permission flag |
| can_moderate | boolean | Permission flag |
| can_edit_settings | boolean | Permission flag |
| is_active | boolean | Membership status |
| joined_at | timestamp | When joined |
| display_name | text | Display name in portal context |

**Relation to Coordination Circles:** Portal members COULD act as a Coordination Circle if portal = community coordination hub.

**File:** `shared/schema.ts:4458-4498`

---

#### `cc_federation_agreements` - Cross-tenant resource sharing
**Purpose:** Enables one tenant (consumer) to access another tenant's (provider) resources

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| provider_tenant_id | uuid | Tenant sharing resources |
| community_id | uuid | Community context |
| consumer_tenant_id | uuid | Tenant accessing resources |
| scopes | text[] | Array of scope strings (e.g., "availability:read") |
| share_availability | boolean | Share availability data |
| allow_reservation_requests | boolean | Allow cross-tenant reservations |
| allow_incident_ops | boolean | Allow incident operations |
| anonymize_public | boolean | Anonymize public-facing data |
| requires_provider_confirmation | boolean | Require confirmation for actions |
| status | text | active/inactive |

**Relation to Coordination Circles:** Federation agreements define the **scope** of what a coordination actor (consumer tenant) can do on behalf of providers.

**File:** `shared/schema.ts:772-795`

---

#### `cc_shared_service_runs` - Shared contractor mobilization
**Purpose:** Neighbors coordinate to share contractor mobilization costs

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| tenant_id | uuid | Owning tenant |
| community_id | uuid | Community context |
| trade_category | text | Type of trade |
| contractor_party_id | uuid | Contractor entity |
| status | enum | forming/scheduled/completed |
| current_member_count | integer | Number of participants |
| split_method | enum | How costs are split |
| created_by_party_id | uuid | Who created the run |
| created_by_individual_id | uuid | Individual creator |

**Relation to Coordination Circles:** Shared runs ARE a coordination mechanism - multiple parties joining to share costs.

**File:** Database table `cc_shared_service_runs`

---

#### `cc_shared_run_members` - Participants in shared runs
**Purpose:** Links parties to shared service runs

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| run_id | uuid | FK to cc_shared_service_runs |
| work_request_id | uuid | FK to cc_work_requests |
| owner_party_id | uuid | Member's party |
| owner_individual_id | uuid | Member's individual |
| units | jsonb | What they're contributing |
| status | enum | joined/withdrawn |

**File:** Database table `cc_shared_run_members`

---

#### `cc_activity_ledger` - Audit trail
**Purpose:** Records all significant actions with attribution

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| tenant_id | uuid | Target tenant |
| community_id | uuid | Community context |
| actor_identity_id | uuid | WHO performed the action |
| actor_tenant_id | uuid | WHICH TENANT context actor was in |
| action | varchar | Action type |
| entity_type | varchar | What was acted upon |
| entity_id | uuid | Entity ID |
| correlation_id | uuid | For grouping related actions |
| payload | jsonb | Additional data |

**Relation to Coordination Circles:** This table tracks attribution for cross-tenant actions.

**File:** `shared/schema.ts:798-822`

---

### 1.2 Tables That Do NOT Exist (Conceptually Expected for Coordination Circles)

| Expected Table | Status | Notes |
|----------------|--------|-------|
| `cc_coordination_circles` | ❌ NOT BUILT | No explicit circle entity |
| `cc_circle_members` | ❌ NOT BUILT | No circle membership table |
| `cc_circle_roles` | ❌ NOT BUILT | No circle-specific roles |
| `cc_acting_as` | ❌ NOT BUILT | No "acting as" session table |

---

## 2. AUTHORITY & PERMISSIONS

### 2.1 Permission Checks

#### Federation Scope Checking
**File:** `server/services/federationService.ts:33-49`

```typescript
export async function hasScope(
  ctx: FederationContext,
  targetTenantId: string,
  scope: string
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM cc_federation_agreements
    WHERE provider_tenant_id = ${targetTenantId}
      AND community_id = ${ctx.communityId}
      AND consumer_tenant_id = ${ctx.actorTenantId}
      AND status = 'active'
      AND ${scope} = ANY(scopes)
    LIMIT 1
  `);
  return result.rows.length > 0;
}
```

**Available Scopes:**
- `availability:read` - View federated availability
- `reservation:create` - Make cross-tenant reservations
- (implied from code patterns)

---

#### Actor Context in tenantDb
**File:** `server/db/tenantDb.ts:8-15`

```typescript
export interface ActorContext {
  tenant_id: string;
  portal_id?: string;
  individual_id?: string;
  platform_staff_id?: string;
  impersonation_session_id?: string;
  actor_type: 'tenant' | 'platform' | 'service';
}
```

**How Actor Context is Set:**
1. Session variables set via PostgreSQL `set_config()`
2. RLS policies evaluate `current_setting('app.tenant_id')`
3. Service mode uses `__SERVICE__` sentinel for bypass

---

### 2.2 Role/Scope Logic

#### Portal Member Roles
**File:** `shared/schema.ts` (portalRoleTypeEnum)

```typescript
["owner", "admin", "moderator", "member", "vendor"]
```

#### Portal Member Permissions (Flags)
- `can_post_jobs`
- `can_post_listings`
- `can_invite_members`
- `can_moderate`
- `can_edit_settings`

---

### 2.3 "Acting As" Mechanisms

#### Current Implementation: Tenant Switching
**File:** `client/src/contexts/TenantContext.tsx`

```typescript
const switchTenant = useCallback(async (tenantId: string) => {
  const response = await fetch('/api/me/switch-tenant', {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  });
  // Updates session to new tenant context
});
```

**UI:** TenantPicker page (`client/src/pages/app/TenantPicker.tsx`)

#### Admin Impersonation
**File:** `server/routes/admin-impersonation.ts`

- `POST /api/admin/impersonation/start` - Start impersonating tenant
- `POST /api/admin/impersonation/stop` - Stop impersonation
- `GET /api/admin/impersonation/status` - Get current status

Stores impersonation state in session:
```typescript
session.impersonation = {
  admin_user_id,
  tenant_id,
  started_at
};
```

---

### 2.4 How Attribution is Stored and Audited

#### Activity Ledger Attribution
**File:** `server/services/federationService.ts:155-172`

```typescript
export async function logFederatedAccess(
  ctx: FederationContext,
  targetTenantId: string,
  action: string,
  resourceType: string,
  resourceId: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id,           -- Target tenant
      community_id,        -- Community context
      actor_tenant_id,     -- WHO's tenant initiated
      actor_identity_id,   -- Individual if known
      action,              -- What was done
      entity_type,         -- What type
      entity_id,           -- Which entity
      payload              -- Extra context
    ) VALUES (...)
  `);
}
```

**Answer: How does the system know an action was taken as a Coordination Circle?**

❌ **It doesn't explicitly.** Actions are attributed to:
- `actor_tenant_id` - The tenant context the actor was in
- `actor_identity_id` - The individual performing the action
- `payload.federation: true` - Flag indicating federated action

There is no "acting as Circle X" attribution. The closest is:
- `actor_tenant_id` shows which tenant initiated
- `community_id` shows which community context

---

## 3. MESSAGING & INBOUND ROUTING

### 3.1 Messaging Tables

#### `cc_conversation_participants`
**File:** `shared/schema.ts`

```typescript
export const ccConversationParticipants = pgTable("cc_conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  // ... participant details
});
```

#### Inbound Message Routing
**Status:** ⚠️ PARTIALLY IMPLEMENTED

The system has:
- Conversation participants table
- Notification delivery tracking (`cc_notification_deliveries.provider_message_id`)

The system does NOT have:
- Explicit inbox routing to Coordination Circles
- "Switch hat" UI for message context
- Circle-level inbound call routing

---

### 3.2 UI Entry Points for Messaging

**File:** `client/src/pages/ConversationsPage.tsx`

Routes:
- `/app/messages` - Conversations list and view

**No Circle-specific messaging UI exists.**

---

## 4. INVENTORY & SCHEDULING SURFACES

### 4.1 Federated Availability View
**Status:** ⚠️ PARTIALLY IMPLEMENTED

**File:** `server/services/federationService.ts:74-150`

```typescript
export async function getFederatedFacilities(
  ctx: FederationContext
): Promise<FederatedFacility[]>
```

This function:
1. Gets tenants where actor has `availability:read` scope
2. Queries facilities across those tenants
3. Returns scarcity bands (available/limited/scarce/sold_out)
4. NEVER returns true counts (privacy protection)

**API Route:** `server/routes/community.ts`
- `GET /api/community/:communityId/availability` - Search federated availability
- `GET /api/community/:communityId/facilities` - List federated facilities

---

### 4.2 Cross-Tenant Availability

| Feature | Status | Notes |
|---------|--------|-------|
| View federated facilities | ✅ Implemented | Via federation service |
| Search availability by date | ⚠️ Partial | Basic date filtering |
| Make cross-tenant reservation | ⚠️ Partial | Route exists, needs testing |
| Calendar management | ❌ Not built | No cross-tenant calendar UI |
| Scarcity bands (not counts) | ✅ Implemented | Privacy-preserving |

---

### 4.3 Implementation Classification

| Surface | Classification |
|---------|---------------|
| Federated facility list | ✅ First-class |
| Federated availability search | ⚠️ Partial (backend only) |
| Cross-tenant reservations | ⚠️ Partial |
| Calendar editing | ❌ Tenant-only |
| Coordination circle-specific views | ❌ Not built |

---

## 5. UI & ROUTES

### 5.1 Existing Routes Related to Coordination

| Route | File | Purpose |
|-------|------|---------|
| `/app` | `TenantPicker.tsx` | Select/switch tenant context |
| `/app/service-runs` | `ServiceRuns.tsx` | List service runs |
| `/app/service-runs/new` | `CreateServiceRun.tsx` | Create new run |
| `/app/service-runs/:slug` | `ServiceRunDetail.tsx` | Run details |

### 5.2 Routes That Reference "Coordination"

**None.** No routes use the word "coordination" or "circle".

### 5.3 Navigation Entries

**TenantAppLayout.tsx** navigation varies by tenant type:
- `COMMUNITY_NAV` - For community/government tenants
- `BUSINESS_NAV` - For business tenants
- `INDIVIDUAL_NAV` - For individuals

**No "Coordination Circles" nav item exists.**

### 5.4 Components Related to Coordination

| Component | Purpose | Status |
|-----------|---------|--------|
| `PortalSelector.tsx` | Switch between portals | ✅ Implemented |
| `TenantPicker.tsx` | Switch between tenants | ✅ Implemented |
| `ImpersonationBanner.tsx` | Show impersonation status | ✅ Implemented |

---

## 6. API / EDGE FUNCTIONS

### 6.1 API Routes Operating "On Behalf"

#### Federation Routes
**File:** `server/routes/community.ts`

```
GET  /api/community/:communityId/availability
GET  /api/community/:communityId/facilities
POST /api/community/:communityId/reserve
```

These routes accept a `communityId` context parameter and use `FederationContext` to determine actor permissions.

---

#### Shared Runs Routes
**File:** `server/routes/shared-runs.ts`

```
POST   /api/shared-runs                    - Create shared run
GET    /api/shared-runs                    - List runs
GET    /api/shared-runs/:id                - Get run details
POST   /api/shared-runs/:id/join           - Join a run
POST   /api/shared-runs/:id/withdraw       - Leave a run
PATCH  /api/shared-runs/:id/status         - Update status
```

---

#### Operator Routes with Federation
**File:** `server/routes/operator.ts`

Uses `hasScope()` from federationService to check permissions before allowing cross-tenant operations.

---

### 6.2 Context Parameter Patterns

All routes use one of:
- `req.ctx.tenant_id` - From middleware
- `req.headers['x-tenant-slug']` - Header-based
- `:communityId` URL param - For community-scoped

---

## 7. WHAT IS COMPLETE vs PARTIAL

### ✅ IMPLEMENTED AND USABLE

| Feature | Location |
|---------|----------|
| Tenant switching | TenantContext, TenantPicker |
| Federation agreements (schema) | cc_federation_agreements |
| Federated facility listing | federationService.getFederatedFacilities() |
| Activity ledger attribution | cc_activity_ledger |
| Shared service runs | cc_shared_service_runs, shared-runs.ts |
| Shared run membership | cc_shared_run_members |
| Portal member roles/permissions | cc_portal_members |
| Admin impersonation | admin-impersonation.ts |

### ⚠️ PARTIALLY IMPLEMENTED

| Feature | Status | Missing |
|---------|--------|---------|
| Federated availability search | Backend only | UI |
| Cross-tenant reservations | Route exists | Full flow, testing |
| Portal-based coordination | Schema exists | Coordination workflows |
| Federation scopes | Basic scopes | Fine-grained permissions |

### ❌ PLANNED BUT NOT BUILT

| Feature | Notes |
|---------|-------|
| Explicit Coordination Circle entity | No table, no UI |
| Circle membership management | No dedicated UI |
| "Acting as Circle" context switching | Uses tenant switching instead |
| Circle-specific inbound call routing | Not built |
| Circle calendar overlay | Not built |
| Multi-circle membership UI | Not built |
| Non-admin circle initiation | Limited to shared runs |

---

## 8. CONSTRAINTS & ASSUMPTIONS

### 8.1 Hard-Coded Assumptions That Block Coordination Circles

#### Assumption: One Active Tenant Context
**File:** `server/db/tenantDb.ts`

The system assumes ONE active tenant context at a time via PostgreSQL GUC:
```typescript
await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [ctx.tenant_id]);
```

**Blocking:** A user cannot simultaneously act as multiple circles.

---

#### Assumption: Tenant = Primary Actor
**File:** `server/middleware/tenantContext.ts`

All actions are attributed to a tenant context. There is no "Circle" actor type.

**Blocking:** Actions cannot be attributed to a coordination circle separate from tenant.

---

#### Assumption: Federation is Bilateral (Provider → Consumer)
**File:** `cc_federation_agreements`

Federation agreements are between:
- One provider tenant
- One consumer tenant (or community-wide)

**Blocking:** Multi-party coordination circles with N members require N×(N-1) agreements.

---

#### Assumption: Non-Admin Actors Limited
**Current State:** Only tenant admins/owners can:
- Create federation agreements
- Initiate shared runs
- Make cross-tenant reservations

**Partially Blocking:** Non-admin circle members cannot initiate actions directly.

---

### 8.2 Architectural Patterns That Enable Circles

Despite the above, these patterns support future coordination circles:

1. **Portal Members** - Already has multi-party membership with roles/permissions
2. **Shared Runs** - Already coordinates multiple parties for shared actions
3. **Activity Ledger** - Already supports actor attribution with tenant context
4. **Federation Service** - Already handles cross-tenant authorization
5. **ActorContext** - Already includes `actor_type` field for future circle type

---

## 9. FILE REFERENCES

| Component | File Path |
|-----------|-----------|
| Federation Service | `server/services/federationService.ts` |
| Federation Agreements | `shared/schema.ts:772-795` |
| Activity Ledger | `shared/schema.ts:798-822` |
| Portal Members | `shared/schema.ts:4458-4498` |
| Shared Runs Routes | `server/routes/shared-runs.ts` |
| Tenant Context | `server/middleware/tenantContext.ts` |
| Tenant DB | `server/db/tenantDb.ts` |
| Actor Context | `server/db/tenantDb.ts:8-15` |
| Tenant Picker UI | `client/src/pages/app/TenantPicker.tsx` |
| Tenant Context (Client) | `client/src/contexts/TenantContext.tsx` |
| Admin Impersonation | `server/routes/admin-impersonation.ts` |
| Community Routes | `server/routes/community.ts` |

---

## 10. CONCLUSION

**Coordination Circles as a first-class entity do not exist.** The system uses:

1. **Tenants** as the primary coordination unit
2. **Federation Agreements** for cross-tenant access
3. **Shared Runs** for multi-party cost-sharing coordination
4. **Portal Members** for community-level membership

To implement true Coordination Circles would require:
1. New `cc_circles` and `cc_circle_members` tables
2. ActorContext extended with `circle_id`
3. "Acting as Circle" context switching
4. Circle-attributed activity logging
5. UI for circle management and hat-switching

---

*End of Audit*

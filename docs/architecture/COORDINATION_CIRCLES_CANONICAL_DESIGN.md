# Coordination Circles — Canonical Architecture Design

**Status:** PROPOSED (Build It Right / No Refactor Later)  
**Date:** January 15, 2026  
**Scope:** First-class Coordination Circles implementation for Community Canvas V3

---

## Executive Summary

This document proposes the canonical first-class implementation of Coordination Circles that will scale beyond Bamfield without breaking the platform's core invariants:

1. **PostgreSQL GUC / RLS** remains the security spine
2. **Activity Ledger** remains the attribution spine
3. **Federation Scopes** remain the authorization model (extended)
4. **Portals** remain the membership + surface model

---

## A) CURRENT-STATE CONSTRAINTS

### A.1 One Active Tenant Context (GUC Model)

**File:** `server/db/tenantDb.ts:17-25`

```typescript
async function setSessionVars(client: PoolClient, ctx: TenantContext): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, false)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, false)`, [ctx.individual_id || '']);
  await client.query(`SELECT set_config('app.platform_staff_id', $1, false)`, ['']);
  await client.query(`SELECT set_config('app.impersonation_session_id', $1, false)`, ['']);
}
```

**Enforcement Points:**
- `server/middleware/tenantContext.ts` - Sets context from JWT/session
- `server/db/tenantDb.ts` - Propagates to PostgreSQL GUC
- RLS policies evaluate `current_setting('app.tenant_id')`

**Constraint:** System assumes ONE active tenant context per request.

---

### A.2 Federation Agreement Model (Provider → Consumer)

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

**Table:** `cc_federation_agreements` (shared/schema.ts:772-795)

| Column | Type | Purpose |
|--------|------|---------|
| provider_tenant_id | uuid | Tenant granting access |
| consumer_tenant_id | uuid | Tenant receiving access |
| scopes | text[] | Granted permissions |

**Constraint:** Bilateral (1:1) agreements only. N parties require N×(N-1) agreements.

---

### A.3 Portal Membership Model

**Table:** `cc_portal_members` (shared/schema.ts:4458-4498)

| Column | Type | Purpose |
|--------|------|---------|
| portal_id | uuid | Portal context |
| tenant_id | uuid | Member tenant (nullable) |
| party_id | uuid | Member party (nullable) |
| individual_id | uuid | Member individual (nullable) |
| role | enum | owner/admin/moderator/member/vendor |
| can_post_jobs | boolean | Permission flag |
| can_post_listings | boolean | Permission flag |
| can_invite_members | boolean | Permission flag |
| can_moderate | boolean | Permission flag |

**Reusable:** Portal membership pattern can be extended for circles.

---

### A.4 Activity Ledger Attribution

**Table:** `cc_activity_ledger` (shared/schema.ts:798-822)

| Column | Type | Purpose |
|--------|------|---------|
| tenant_id | uuid | Target tenant |
| community_id | uuid | Community context |
| actor_identity_id | uuid | WHO (human/AI) |
| actor_tenant_id | uuid | WHICH TENANT context |
| action | varchar | Action type |
| entity_type | varchar | What was acted upon |
| entity_id | uuid | Entity ID |
| payload | jsonb | Additional context |

**Gap:** No `circle_id` or `portal_id` columns for coordination attribution.

---

## B) CANONICAL COORDINATION CIRCLE MODEL

### B.1 New Tables Required

#### `cc_coordination_circles` — The Circle Entity

```sql
CREATE TABLE cc_coordination_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  community_id UUID REFERENCES cc_communities(id),
  owning_tenant_id UUID REFERENCES cc_tenants(id),
  portal_id UUID REFERENCES cc_portals(id),
  description TEXT,
  visibility VARCHAR(20) DEFAULT 'private',  -- private, community, public
  status VARCHAR(20) DEFAULT 'active',       -- active, suspended, dissolved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_circle_slug UNIQUE (community_id, slug)
);
```

**Why Required:**
- First-class entity for coordination groups
- Community-scoped but may have owning tenant for admin purposes
- Visibility controls who can discover/join
- Cannot be represented by federation agreements alone

---

#### `cc_circle_members` — Membership Table

```sql
CREATE TABLE cc_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES cc_coordination_circles(id) ON DELETE CASCADE,
  member_type VARCHAR(20) NOT NULL,  -- 'tenant', 'party', 'individual'
  tenant_id UUID REFERENCES cc_tenants(id),
  party_id UUID REFERENCES cc_parties(id),
  individual_id UUID REFERENCES cc_individuals(id),
  role_id UUID REFERENCES cc_circle_roles(id),
  status VARCHAR(20) DEFAULT 'active',  -- active, suspended, left
  can_act_as_circle BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES cc_individuals(id),
  
  CONSTRAINT chk_member_type CHECK (
    (member_type = 'tenant' AND tenant_id IS NOT NULL) OR
    (member_type = 'party' AND party_id IS NOT NULL) OR
    (member_type = 'individual' AND individual_id IS NOT NULL)
  ),
  CONSTRAINT uq_circle_member UNIQUE (circle_id, member_type, COALESCE(tenant_id, party_id, individual_id))
);
```

**Why Required:**
- Supports tenant, party, or individual membership
- Multi-circle membership per user (no unique constraint on individual alone)
- `can_act_as_circle` flag controls who can "wear the hat"
- Role-based permissions via circle_roles

---

#### `cc_circle_roles` — Role Definitions

```sql
CREATE TABLE cc_circle_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID REFERENCES cc_coordination_circles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  can_invite BOOLEAN DEFAULT FALSE,
  can_manage_members BOOLEAN DEFAULT FALSE,
  can_manage_agreements BOOLEAN DEFAULT FALSE,
  can_act_as_circle BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_circle_role_name UNIQUE (circle_id, name)
);
```

**Default Roles (seeded per circle):**
- `coordinator` — Full permissions, can act as circle
- `member` — Basic participation, no admin
- `observer` — View only

**Why Required:**
- Circles need granular permissions beyond tenant roles
- Scopes array allows federation-compatible authorization
- Avoids hardcoding role logic in application

---

#### `cc_circle_delegations` — Partner/Delegate Access (Sheryl Case)

```sql
CREATE TABLE cc_circle_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES cc_coordination_circles(id),
  delegator_tenant_id UUID REFERENCES cc_tenants(id),
  delegator_party_id UUID REFERENCES cc_parties(id),
  delegate_individual_id UUID NOT NULL REFERENCES cc_individuals(id),
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES cc_individuals(id),
  
  CONSTRAINT chk_delegator CHECK (
    delegator_tenant_id IS NOT NULL OR delegator_party_id IS NOT NULL
  )
);
```

**Why Required (Sheryl Case):**
- Sheryl is a business partner, not admin/staff
- Needs cross-tenant reservation visibility + booking ability
- Delegation grants scoped access without tenant membership
- Time-limited via `expires_at`
- Scopes like `['reservation:read', 'reservation:create']`

---

#### `cc_federation_grants` — Hub/Spoke Federation (N-Party)

```sql
CREATE TABLE cc_federation_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type VARCHAR(20) NOT NULL,  -- 'tenant', 'circle', 'portal'
  principal_id UUID NOT NULL,           -- ID of tenant/circle/portal
  target_tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  scopes TEXT[] NOT NULL,
  community_id UUID REFERENCES cc_communities(id),
  requires_confirmation BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_federation_grant UNIQUE (principal_type, principal_id, target_tenant_id)
);
```

**Why Required (Avoid N×N Explosion):**
- Current bilateral model: 10 parties need 90 agreements
- Hub model: 10 parties need 10 grants to circle + circle membership
- Circle becomes the "hub" that holds grants from all participating tenants
- Members inherit access via circle membership

**Migration Path:**
- Keep `cc_federation_agreements` for direct bilateral
- Add `cc_federation_grants` for principal-based (hub/spoke)
- `hasScope()` checks both tables

---

### B.2 Schema Definition (Drizzle ORM)

**File to update:** `shared/schema.ts`

```typescript
// COORDINATION CIRCLES
export const circleVisibilityEnum = pgEnum("circle_visibility", [
  "private", "community", "public"
]);

export const circleStatusEnum = pgEnum("circle_status", [
  "active", "suspended", "dissolved"
]);

export const circleMemberTypeEnum = pgEnum("circle_member_type", [
  "tenant", "party", "individual"
]);

export const ccCoordinationCircles = pgTable("cc_coordination_circles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  communityId: uuid("community_id").references(() => ccCommunities.id),
  owningTenantId: uuid("owning_tenant_id").references(() => ccTenants.id),
  portalId: uuid("portal_id").references(() => ccPortals.id),
  description: text("description"),
  visibility: circleVisibilityEnum("visibility").default("private"),
  status: circleStatusEnum("status").default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("uq_circle_slug").on(table.communityId, table.slug),
}));

export const ccCircleMembers = pgTable("cc_circle_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  circleId: uuid("circle_id").notNull().references(() => ccCoordinationCircles.id, { onDelete: "cascade" }),
  memberType: circleMemberTypeEnum("member_type").notNull(),
  tenantId: uuid("tenant_id").references(() => ccTenants.id),
  partyId: uuid("party_id").references(() => ccParties.id),
  individualId: uuid("individual_id").references(() => ccIndividuals.id),
  roleId: uuid("role_id").references(() => ccCircleRoles.id),
  status: varchar("status", { length: 20 }).default("active"),
  canActAsCircle: boolean("can_act_as_circle").default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  invitedBy: uuid("invited_by").references(() => ccIndividuals.id),
});

export const ccCircleRoles = pgTable("cc_circle_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  circleId: uuid("circle_id").references(() => ccCoordinationCircles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: boolean("is_default").default(false),
  scopes: text("scopes").array().notNull().default([]),
  canInvite: boolean("can_invite").default(false),
  canManageMembers: boolean("can_manage_members").default(false),
  canManageAgreements: boolean("can_manage_agreements").default(false),
  canActAsCircle: boolean("can_act_as_circle").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ccCircleDelegations = pgTable("cc_circle_delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  circleId: uuid("circle_id").notNull().references(() => ccCoordinationCircles.id),
  delegatorTenantId: uuid("delegator_tenant_id").references(() => ccTenants.id),
  delegatorPartyId: uuid("delegator_party_id").references(() => ccParties.id),
  delegateIndividualId: uuid("delegate_individual_id").notNull().references(() => ccIndividuals.id),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => ccIndividuals.id),
});

export const federationPrincipalTypeEnum = pgEnum("federation_principal_type", [
  "tenant", "circle", "portal"
]);

export const ccFederationGrants = pgTable("cc_federation_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  principalType: federationPrincipalTypeEnum("principal_type").notNull(),
  principalId: uuid("principal_id").notNull(),
  targetTenantId: uuid("target_tenant_id").notNull().references(() => ccTenants.id),
  scopes: text("scopes").array().notNull(),
  communityId: uuid("community_id").references(() => ccCommunities.id),
  requiresConfirmation: boolean("requires_confirmation").default(false),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  grantIdx: uniqueIndex("uq_federation_grant").on(table.principalType, table.principalId, table.targetTenantId),
}));
```

---

## C) ACTING-AS CONTEXT (Clean + Auditable)

### C.1 Extended ActorContext

**File to update:** `server/db/tenantDb.ts`

```typescript
export interface ActorContext {
  tenant_id: string;
  portal_id?: string;
  individual_id?: string;
  platform_staff_id?: string;
  impersonation_session_id?: string;
  actor_type: 'tenant' | 'platform' | 'service' | 'circle';  // ADD 'circle'
  circle_id?: string;  // NEW
}
```

### C.2 New GUC: `app.circle_id`

**File to update:** `server/db/tenantDb.ts`

```typescript
async function setSessionVars(client: PoolClient, ctx: TenantContext): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, false)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, false)`, [ctx.individual_id || '']);
  await client.query(`SELECT set_config('app.circle_id', $1, false)`, [ctx.circle_id || '']);  // NEW
  await client.query(`SELECT set_config('app.platform_staff_id', $1, false)`, ['']);
  await client.query(`SELECT set_config('app.impersonation_session_id', $1, false)`, ['']);
}

async function setActorSessionVars(client: PoolClient, actor: ActorContext): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [actor.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, false)`, [actor.portal_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, false)`, [actor.individual_id || '']);
  await client.query(`SELECT set_config('app.circle_id', $1, false)`, [actor.circle_id || '']);  // NEW
  await client.query(`SELECT set_config('app.platform_staff_id', $1, false)`, [actor.platform_staff_id || '']);
  await client.query(`SELECT set_config('app.impersonation_session_id', $1, false)`, [actor.impersonation_session_id || '']);
}
```

### C.3 How Request Chooses Context

**File to update:** `server/middleware/tenantContext.ts`

```typescript
export interface TenantContext {
  domain: string | null;
  portal_id: string | null;
  tenant_id: string | null;
  individual_id: string | null;
  circle_id: string | null;  // NEW
  acting_as: 'tenant' | 'circle' | null;  // NEW
  roles: string[];
  scopes: string[];
}
```

**Context Selection Logic:**

```typescript
// Session stores acting_as preference
interface Session {
  // ... existing fields
  acting_as?: {
    type: 'tenant' | 'circle';
    id: string;
  };
}

// Middleware reads from session
if (req.session?.acting_as?.type === 'circle') {
  ctx.circle_id = req.session.acting_as.id;
  ctx.acting_as = 'circle';
  // Verify user is member with can_act_as_circle = true
} else {
  ctx.acting_as = 'tenant';
}
```

### C.4 RLS Policy Integration

**New RLS pattern for circle-scoped tables:**

```sql
-- Example: Circle members can see their circle's data
CREATE POLICY "circle_member_access" ON cc_circle_resources
  FOR SELECT
  USING (
    circle_id IN (
      SELECT circle_id FROM cc_circle_members
      WHERE (
        individual_id::text = current_setting('app.individual_id', true)
        OR tenant_id::text = current_setting('app.tenant_id', true)
      )
      AND status = 'active'
    )
    OR current_setting('app.circle_id', true) = circle_id::text
  );

-- Acting-as-circle bypasses tenant RLS for circle operations
CREATE POLICY "acting_as_circle" ON cc_federation_grants
  FOR SELECT
  USING (
    principal_type = 'circle' 
    AND principal_id::text = current_setting('app.circle_id', true)
  );
```

### C.5 Context Enforcement Summary

| Context | GUC Set | Used For |
|---------|---------|----------|
| `app.tenant_id` | Always | Tenant-scoped RLS |
| `app.portal_id` | If in portal | Portal-scoped operations |
| `app.individual_id` | If authenticated | Individual attribution |
| `app.circle_id` | If acting-as-circle | Circle-scoped RLS + grants |

---

## D) FEDERATION AT SCALE (Avoid N×N)

### D.1 Current Problem

With bilateral `cc_federation_agreements`:
- 10 tenants = 90 agreements for full mesh
- Adding 1 tenant = 18 new agreements
- Doesn't scale

### D.2 Hub/Spoke Solution

**Circle as Hub:**

```
Provider Tenant A ──┐
Provider Tenant B ──┼──► Circle ◄──── Circle Members
Provider Tenant C ──┘        │
                             │
                             ▼
                    cc_federation_grants
                    (principal_type='circle')
```

**Adding New Provider:**
1. Provider grants scopes to Circle (1 grant)
2. All circle members inherit access

**Adding New Member:**
1. Member joins Circle (1 membership)
2. Inherits all provider grants

### D.3 Updated hasScope Function

**File to update:** `server/services/federationService.ts`

```typescript
export async function hasScope(
  ctx: FederationContext,
  targetTenantId: string,
  scope: string
): Promise<boolean> {
  // 1. Check direct bilateral agreement (existing)
  const bilateral = await db.execute(sql`
    SELECT 1 FROM cc_federation_agreements
    WHERE provider_tenant_id = ${targetTenantId}
      AND community_id = ${ctx.communityId}
      AND consumer_tenant_id = ${ctx.actorTenantId}
      AND status = 'active'
      AND ${scope} = ANY(scopes)
    LIMIT 1
  `);
  if (bilateral.rows.length > 0) return true;

  // 2. Check circle-based grants (NEW)
  if (ctx.circleId) {
    const circleGrant = await db.execute(sql`
      SELECT 1 FROM cc_federation_grants
      WHERE principal_type = 'circle'
        AND principal_id = ${ctx.circleId}
        AND target_tenant_id = ${targetTenantId}
        AND status = 'active'
        AND ${scope} = ANY(scopes)
      LIMIT 1
    `);
    if (circleGrant.rows.length > 0) return true;
  }

  // 3. Check delegation grants (Sheryl case)
  if (ctx.individualId) {
    const delegation = await db.execute(sql`
      SELECT 1 FROM cc_circle_delegations d
      JOIN cc_federation_grants g ON g.principal_type = 'circle' AND g.principal_id = d.circle_id
      WHERE d.delegate_individual_id = ${ctx.individualId}
        AND d.status = 'active'
        AND (d.expires_at IS NULL OR d.expires_at > NOW())
        AND ${scope} = ANY(d.scopes)
        AND g.target_tenant_id = ${targetTenantId}
        AND g.status = 'active'
      LIMIT 1
    `);
    if (delegation.rows.length > 0) return true;
  }

  return false;
}
```

---

## E) SHERYL BUSINESS PARTNER CASE

### E.1 Requirements
- Sheryl is NOT tenant admin/staff
- Needs to see reservations across partner tenants
- Needs to create reservations on their behalf
- No full tenant access

### E.2 Solution: Circle Delegation

**Step 1:** Create coordination circle (e.g., "Bamfield Accommodation Partners")

**Step 2:** Partner tenants grant scopes to circle:
```sql
INSERT INTO cc_federation_grants (principal_type, principal_id, target_tenant_id, scopes)
VALUES 
  ('circle', :circle_id, :lodge_a_tenant_id, ARRAY['reservation:read', 'availability:read']),
  ('circle', :circle_id, :lodge_b_tenant_id, ARRAY['reservation:read', 'availability:read']);
```

**Step 3:** Delegate to Sheryl:
```sql
INSERT INTO cc_circle_delegations (circle_id, delegator_tenant_id, delegate_individual_id, scopes)
VALUES (:circle_id, :bamfield_tourism_tenant, :sheryl_individual_id, 
        ARRAY['reservation:read', 'reservation:create']);
```

**Step 4:** Sheryl can now:
- View reservations across partner tenants (via circle grants + delegation)
- Create reservations (via delegation scope)
- All actions attributed to Sheryl + circle context

### E.3 API Flow

```
Sheryl Request → Check delegation → Get circle grants → Access partner data
                     │                    │
                     ▼                    ▼
              cc_circle_delegations  cc_federation_grants
```

---

## F) MESSAGING & INBOUND ROUTING

### F.1 Circle Inbox

**Option A: Add `circle_id` to existing tables**

```sql
ALTER TABLE cc_conversations ADD COLUMN circle_id UUID REFERENCES cc_coordination_circles(id);
ALTER TABLE cc_conversation_participants ADD COLUMN participating_as VARCHAR(20); -- 'individual', 'tenant', 'circle'
```

**Option B: New circle-specific tables (if needed)**

```sql
CREATE TABLE cc_circle_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES cc_coordination_circles(id),
  conversation_id UUID NOT NULL REFERENCES cc_conversations(id),
  is_read BOOLEAN DEFAULT FALSE,
  assigned_to UUID REFERENCES cc_individuals(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Recommendation:** Option A (simpler, reuses existing infrastructure)

### F.2 Hat-Switching from Inbox

When responding to a message:
1. UI shows "Responding as: [Circle Name]" or "[Tenant Name]"
2. User can switch context before sending
3. Message participant record stores `participating_as`
4. Activity ledger logs circle_id if responding as circle

### F.3 Inbound Routing Rules

```sql
CREATE TABLE cc_circle_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES cc_coordination_circles(id),
  channel VARCHAR(50) NOT NULL,  -- 'email', 'sms', 'call'
  pattern VARCHAR(255),          -- e.g., email pattern to match
  route_to VARCHAR(50) NOT NULL, -- 'inbox', 'member', 'webhook'
  route_target UUID,             -- member ID or webhook ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## G) ACTIVITY LEDGER ATTRIBUTION

### G.1 Schema Updates

**File to update:** `shared/schema.ts` (cc_activity_ledger)

```typescript
export const ccActivityLedger = pgTable("cc_activity_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => ccTenants.id),
  communityId: uuid("community_id").references(() => ccCommunities.id),
  actorIdentityId: uuid("actor_identity_id").references(() => ccIndividuals.id),
  actorTenantId: uuid("actor_tenant_id").references(() => ccTenants.id),
  circleId: uuid("circle_id").references(() => ccCoordinationCircles.id),  // NEW
  portalId: uuid("portal_id").references(() => ccPortals.id),              // NEW
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: uuid("entity_id"),
  correlationId: uuid("correlation_id"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

### G.2 Why Columns vs Payload

| Approach | Pros | Cons |
|----------|------|------|
| **Columns** | Indexable, queryable, type-safe | Schema changes needed |
| **Payload** | Flexible, no migration | Not indexable, no type safety |

**Recommendation:** Use columns for `circle_id` and `portal_id`:
- Enables audit queries: "Show all actions by Circle X"
- Enables RLS: "Only show ledger entries for circles I belong to"
- Enables reporting: "Circle activity summary"

### G.3 Logging Pattern

**File to update:** `server/services/federationService.ts`

```typescript
export async function logActivity(
  ctx: FederationContext,
  action: string,
  entityType: string,
  entityId: string,
  payload?: Record<string, any>
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id,
      community_id,
      actor_identity_id,
      actor_tenant_id,
      circle_id,              -- NEW
      portal_id,              -- NEW
      action,
      entity_type,
      entity_id,
      payload
    ) VALUES (
      ${ctx.targetTenantId},
      ${ctx.communityId},
      ${ctx.individualId},
      ${ctx.actorTenantId},
      ${ctx.circleId},        -- NEW
      ${ctx.portalId},        -- NEW
      ${action},
      ${entityType},
      ${entityId},
      ${JSON.stringify(payload || {})}
    )
  `);
}
```

---

## H) UI IMPLICATIONS (Functional Routes)

### H.1 Required Routes

| Route | Purpose | Priority |
|-------|---------|----------|
| `/app/circles` | List user's circles | P0 |
| `/app/circles/:id` | Circle dashboard | P0 |
| `/app/circles/:id/members` | Manage membership | P0 |
| `/app/circles/:id/agreements` | Manage federation grants | P1 |
| `/app/circles/:id/inbox` | Circle inbox | P1 |
| `/app/circles/new` | Create circle | P0 |

### H.2 UI Components Required

| Component | Purpose |
|-----------|---------|
| `CirclePicker` | Select active circle context |
| `ActingAsIndicator` | Show current context (tenant/circle) |
| `CircleMemberList` | List/manage members |
| `CircleRoleManager` | Define/assign roles |
| `CircleDelegationForm` | Create partner delegations |
| `CircleAgreementList` | View federation grants |

### H.3 Navigation Updates

**File to update:** `client/src/layouts/TenantAppLayout.tsx`

Add to navigation:
```typescript
{
  title: "Coordination",
  icon: Users,
  items: [
    { title: "My Circles", href: "/app/circles" },
    { title: "Circle Inbox", href: "/app/circles/inbox" },
  ]
}
```

---

## I) SUMMARY: DELTA FROM CURRENT STATE

### I.1 New Tables (5)

| Table | File |
|-------|------|
| `cc_coordination_circles` | shared/schema.ts |
| `cc_circle_members` | shared/schema.ts |
| `cc_circle_roles` | shared/schema.ts |
| `cc_circle_delegations` | shared/schema.ts |
| `cc_federation_grants` | shared/schema.ts |

### I.2 Modified Tables (1)

| Table | Changes |
|-------|---------|
| `cc_activity_ledger` | Add `circle_id`, `portal_id` columns |

### I.3 Modified Files

| File | Changes |
|------|---------|
| `shared/schema.ts` | Add 5 tables, 4 enums, update ledger |
| `server/db/tenantDb.ts` | Add `circle_id` to ActorContext, GUC |
| `server/middleware/tenantContext.ts` | Add `circle_id`, `acting_as` to context |
| `server/services/federationService.ts` | Update `hasScope()` for circle grants |
| `client/src/contexts/TenantContext.tsx` | Add circle context |
| `client/src/layouts/TenantAppLayout.tsx` | Add Coordination nav |

### I.4 New Files Required

| File | Purpose |
|------|---------|
| `server/routes/circles.ts` | Circle CRUD + membership API |
| `server/services/circleService.ts` | Circle business logic |
| `client/src/pages/app/Circles.tsx` | Circle list page |
| `client/src/pages/app/CircleDetail.tsx` | Circle dashboard |
| `client/src/components/CirclePicker.tsx` | Context switcher |
| `client/src/components/ActingAsIndicator.tsx` | Context indicator |

### I.5 Unchanged (Reusable)

| Component | Reuse |
|-----------|-------|
| Portal membership pattern | Model for circle membership |
| Federation scope checking | Extend for circle grants |
| Activity ledger logging | Add circle_id attribution |
| Tenant context middleware | Extend for circle context |
| Session management | Add acting_as field |

---

## J) RISKS & MITIGATIONS

### J.1 RLS Complexity

**Risk:** Adding `app.circle_id` GUC increases RLS policy complexity.

**Mitigation:**
- Start with simple policies for circle-specific tables
- Use `is_service_mode()` bypass for internal operations
- Thorough testing with RTR-style test harness

### J.2 Context Confusion

**Risk:** Users confused about which "hat" they're wearing.

**Mitigation:**
- Prominent `ActingAsIndicator` component
- Confirmation dialogs for context-switching
- Clear attribution in activity ledger

### J.3 Migration Path

**Risk:** Existing shared runs may need migration to circle model.

**Mitigation:**
- Shared runs can coexist with circles initially
- Optional migration script to convert runs to circles
- No breaking changes to existing API

### J.4 Performance

**Risk:** Additional joins for circle grant checks.

**Mitigation:**
- Index on `(principal_type, principal_id, target_tenant_id)`
- Cache circle memberships in session
- Denormalize common queries

---

## K) IMPLEMENTATION SEQUENCE

1. **Phase 1: Schema + Backend**
   - Add 5 new tables to schema
   - Add `circle_id` to activity ledger
   - Extend ActorContext with circle_id
   - Add `app.circle_id` GUC
   - Create `circles.ts` routes

2. **Phase 2: Federation Integration**
   - Create `cc_federation_grants` table
   - Update `hasScope()` for circle grants
   - Add delegation checking

3. **Phase 3: UI**
   - Circle list/detail pages
   - CirclePicker component
   - ActingAsIndicator component
   - Membership management UI

4. **Phase 4: Messaging**
   - Add `circle_id` to conversations
   - Circle inbox filtering
   - Hat-switching in compose

---

*End of Canonical Design Document*

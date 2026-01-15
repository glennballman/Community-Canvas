# Circles × Portals Integration Plan

**Date:** January 15, 2026  
**Status:** Planning Only - No Implementation

---

## Goal

Add Coordination Circles (`app.circle_id`) into existing portal domain-routing and tenant context middleware with:

1. Portal resolved via `cc_portal_domains`
2. Tenant resolved via current `tenantContext`
3. Circle context selected by user (or derived) and applied via GUC `app.circle_id`
4. Circle_id cannot be spoofed by clients

---

## 1) WHERE PORTAL_ID IS SET TODAY

### 1.1 Middleware Resolution (Request Context)

**File:** `server/middleware/tenantContext.ts`

| Line | Action | Source |
|------|--------|--------|
| 63-71 | Initialize `req.ctx.portal_id = null` | Default |
| 76-93 | Set `req.ctx.portal_id` from domain lookup | `cc_portal_domains` query |
| 104-123 | Set `req.ctx.portal_id` from `/b/:slug` path | `cc_portals` slug query |
| 185 | Copy to `req.actorContext.portal_id` | Impersonation flow |
| 229 | Copy to `req.actorContext.portal_id` | Session impersonation |

### 1.2 GUC Propagation (Database Session)

**File:** `server/db/tenantDb.ts`

| Line | Function | GUC Set |
|------|----------|---------|
| 21 | `setSessionVars()` | `set_config('app.portal_id', $1, false)` |
| 29 | `setActorSessionVars()` | `set_config('app.portal_id', $1, false)` |
| 37 | `clearSessionVars()` | `set_config('app.portal_id', '', false)` |
| 48 | `setServiceMode()` | `set_config('app.portal_id', '__SERVICE__', false)` |

**File:** `server/db/withRequestContext.ts`

| Line | Function | GUC Set |
|------|----------|---------|
| 35 | `setSessionContext()` | `set_config('app.portal_id', $1, true)` |
| 73 | `withServiceContext()` | `set_config('app.portal_id', '__SERVICE__', true)` |
| 97 | `withServiceContextRead()` | `set_config('app.portal_id', '__SERVICE__', true)` |

**File:** `server/workers/rtr-worker.ts`

| Line | Function | GUC Set |
|------|----------|---------|
| 36 | Worker init | `set_config('app.portal_id', '__SERVICE__', false)` |
| 41 | Worker cleanup | `set_config('app.portal_id', '', false)` |

---

## 2) WHERE TENANT_ID IS SET TODAY

### 2.1 Middleware Resolution (Request Context)

**File:** `server/middleware/tenantContext.ts`

| Line | Action | Source |
|------|--------|--------|
| 66 | Initialize `req.ctx.tenant_id = null` | Default |
| 89 | Set from portal domain | `cc_portals.owning_tenant_id` |
| 114 | Set from portal slug | `cc_portals.owning_tenant_id` |
| 177 | Set from impersonation | `cc_impersonation_sessions.tenant_id` |
| 222 | Set from session impersonation | `session.impersonation.tenant_id` |
| 263-266 | Set from session | `session.current_tenant_id` or `session.tenant_id` |
| 270-272 | Set from session (JWT case) | `session.current_tenant_id` |
| 277-283 | Set from header (dev only) | `X-Tenant-Id` header |

### 2.2 GUC Propagation (Database Session)

**File:** `server/db/tenantDb.ts`

| Line | Function | GUC Set |
|------|----------|---------|
| 20 | `setSessionVars()` | `set_config('app.tenant_id', $1, false)` |
| 28 | `setActorSessionVars()` | `set_config('app.tenant_id', $1, false)` |
| 36 | `clearSessionVars()` | `set_config('app.tenant_id', '', false)` |
| 47 | `setServiceMode()` | `set_config('app.tenant_id', '__SERVICE__', false)` |

**File:** `server/db/withRequestContext.ts`

| Line | Function | GUC Set |
|------|----------|---------|
| 34 | `setSessionContext()` | `set_config('app.tenant_id', $1, true)` |
| 72 | `withServiceContext()` | `set_config('app.tenant_id', '__SERVICE__', true)` |
| 96 | `withServiceContextRead()` | `set_config('app.tenant_id', '__SERVICE__', true)` |

**File:** `server/routes.ts`

| Line | Context | GUC Set |
|------|---------|---------|
| 566 | Transaction | `set_config('app.tenant_id', $1, true)` |
| 760 | Clear | `set_config('app.tenant_id', '', true)` |
| 784 | Transaction | `set_config('app.tenant_id', $1, true)` |
| 788 | Clear | `set_config('app.tenant_id', '', true)` |

---

## 3) PROPOSED LOCATION FOR CIRCLE_ID GUC

### 3.1 Request Context Extension

**File:** `server/middleware/tenantContext.ts`

```typescript
// Line 14-26: Extend TenantContext interface
export interface TenantContext {
  domain: string | null;
  portal_id: string | null;
  portal_slug?: string | null;
  portal_name?: string | null;
  portal_legal_dba_name?: string | null;
  portal_type?: string | null;
  tenant_id: string | null;
  individual_id: string | null;
  roles: string[];
  scopes: string[];
  is_impersonating: boolean;
  circle_id: string | null;        // NEW
  circle_role?: string | null;     // NEW (admin/operator/member)
  acting_as_circle: boolean;       // NEW (flag for circle context)
}

// Line 63-71: Initialize circle fields
req.ctx = {
  ...existing,
  circle_id: null,
  circle_role: null,
  acting_as_circle: false,
};
```

### 3.2 Actor Context Extension

**File:** `server/db/tenantDb.ts`

```typescript
// Line 8-15: Extend ActorContext interface
export interface ActorContext {
  tenant_id: string;
  portal_id?: string;
  individual_id?: string;
  platform_staff_id?: string;
  impersonation_session_id?: string;
  actor_type: 'tenant' | 'platform' | 'service' | 'circle';  // Add 'circle'
  circle_id?: string;                                          // NEW
}
```

### 3.3 GUC Propagation Points

**File:** `server/db/tenantDb.ts`

Add to `setSessionVars()` (after line 24):
```typescript
await client.query(`SELECT set_config('app.circle_id', $1, false)`, [ctx.circle_id || '']);
```

Add to `setActorSessionVars()` (after line 32):
```typescript
await client.query(`SELECT set_config('app.circle_id', $1, false)`, [actor.circle_id || '']);
```

Add to `clearSessionVars()` (after line 40):
```typescript
await client.query(`SELECT set_config('app.circle_id', '', false)`);
```

Add to `setServiceMode()` (after line 49):
```typescript
await client.query(`SELECT set_config('app.circle_id', $1, false)`, [SERVICE_MODE_SENTINEL]);
```

**File:** `server/db/withRequestContext.ts`

Add to `setSessionContext()` (after line 36):
```typescript
await client.query(`SELECT set_config('app.circle_id', $1, true)`, [ctx.circle_id || '']);
```

Add to `withServiceContext()` (after line 74):
```typescript
await client.query(`SELECT set_config('app.circle_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
```

Add to `withServiceContextRead()` (after line 98):
```typescript
await client.query(`SELECT set_config('app.circle_id', $1, true)`, [SERVICE_MODE_SENTINEL]);
```

**File:** `server/workers/rtr-worker.ts`

Add after line 36:
```typescript
await client.query("SELECT set_config('app.circle_id', '__SERVICE__', false)");
```

Add after line 41:
```typescript
await client.query("SELECT set_config('app.circle_id', '', false)").catch(() => {});
```

---

## 4) CIRCLE_ID VALIDATION (ANTI-SPOOFING)

### 4.1 Problem Statement

Client cannot be trusted to set `circle_id`. Must validate:
1. User is a member of the requested circle
2. User's membership is active (not revoked/expired)
3. Circle is active and tenant-allowed

### 4.2 Proposed Validation Middleware

**New File:** `server/middleware/circleContext.ts`

```typescript
import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantContext';
import { serviceQuery } from '../db/tenantDb';

/**
 * Validates and sets circle context from request.
 * 
 * Circle can be specified via:
 * 1. Session: session.current_circle_id (sticky preference)
 * 2. Header: X-Circle-Id (per-request override)
 * 
 * Validation queries cc_circle_members to verify:
 * - Membership exists
 * - Membership is active
 * - Circle is active
 * - Circle belongs to same tenant (or delegation is valid)
 */
export async function circleContext(
  req: TenantRequest, 
  res: Response, 
  next: NextFunction
) {
  // Skip if no user context
  if (!req.ctx.individual_id) {
    return next();
  }

  // Get requested circle_id from session or header
  const session = (req as any).session;
  const headerCircleId = req.headers['x-circle-id'];
  const requestedCircleId = (
    typeof headerCircleId === 'string' ? headerCircleId : null
  ) || session?.current_circle_id || null;

  if (!requestedCircleId) {
    return next();
  }

  // Validate UUID format
  if (!requestedCircleId.match(/^[0-9a-f-]{36}$/i)) {
    return next(); // Invalid format - ignore silently
  }

  try {
    // Validate membership + circle status
    // NOTE: Tables don't exist yet - this is the planned query
    const result = await serviceQuery(`
      SELECT 
        cm.circle_id,
        cm.role,
        c.owning_tenant_id,
        c.status as circle_status
      FROM cc_circle_members cm
      JOIN cc_coordination_circles c ON c.id = cm.circle_id
      WHERE cm.circle_id = $1
        AND cm.individual_id = $2
        AND cm.status = 'active'
        AND c.status = 'active'
      LIMIT 1
    `, [requestedCircleId, req.ctx.individual_id]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      
      // Additional validation: circle must be owned by current tenant
      // OR user must have cross-tenant delegation
      if (row.owning_tenant_id === req.ctx.tenant_id) {
        req.ctx.circle_id = row.circle_id;
        req.ctx.circle_role = row.role;
        req.ctx.acting_as_circle = true;
      } else {
        // Check for cross-tenant delegation (future)
        // For now, deny cross-tenant circle access
        console.warn(`[circleContext] Cross-tenant circle access denied: user=${req.ctx.individual_id} circle=${requestedCircleId}`);
      }
    }
  } catch (err) {
    // Tables may not exist yet - fail silently
    console.error('[circleContext] Validation error (tables may not exist):', err);
  }

  next();
}
```

### 4.3 Middleware Order

**File:** `server/routes.ts` or wherever middleware is chained

```typescript
// Current order (lines ~30-50)
app.use(session(...));
app.use(jwtAuth);
app.use(tenantContext);
app.use(attachTenantDb);

// New order
app.use(session(...));
app.use(jwtAuth);
app.use(tenantContext);
app.use(circleContext);    // NEW - after tenantContext, before attachTenantDb
app.use(attachTenantDb);
```

### 4.4 Cross-Tenant Delegation (Future)

For the "Sheryl case" (partner accessing client tenant's circle):

1. Query `cc_circle_delegations` table
2. Check delegation is active and not expired
3. Check delegation grants match requested circle
4. Set `req.ctx.acting_as_delegate = true`

---

## 5) ACTIVITY LEDGER CAPTURE

### 5.1 Current Schema

**File:** `shared/schema.ts:799-822`

```typescript
export const cc_activity_ledger = pgTable('cc_activity_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  communityId: uuid('community_id'),
  actorIdentityId: uuid('actor_identity_id'),
  actorTenantId: uuid('actor_tenant_id'),
  action: varchar('action', { length: 128 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  correlationId: uuid('correlation_id'),
  payload: jsonb('payload').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Missing columns:** `portal_id`, `circle_id`

### 5.2 Schema Migration Required

**New Migration:** `server/migrations/1XX_activity_ledger_context_columns.sql`

```sql
-- Add portal_id and circle_id columns to activity ledger
ALTER TABLE cc_activity_ledger 
  ADD COLUMN IF NOT EXISTS portal_id uuid,
  ADD COLUMN IF NOT EXISTS circle_id uuid;

-- Optional: Add indexes for filtering by portal/circle
CREATE INDEX IF NOT EXISTS idx_cc_activity_ledger_portal 
  ON cc_activity_ledger(portal_id);
CREATE INDEX IF NOT EXISTS idx_cc_activity_ledger_circle 
  ON cc_activity_ledger(circle_id);
```

### 5.3 Activity Service Update

**File:** `server/services/activityService.ts`

```typescript
// Line 4-13: Extend LogActivityRequest interface
interface LogActivityRequest {
  tenantId: string;
  actorId?: string;
  actorTenantId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
  correlationId?: string;
  portalId?: string;    // NEW
  circleId?: string;    // NEW
}

// Line 28-47: Update INSERT query
export async function logActivity(req: LogActivityRequest): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id, actor_identity_id, actor_tenant_id,
      action, entity_type, entity_id,
      payload, correlation_id,
      portal_id, circle_id          -- NEW columns
    ) VALUES (
      ${req.tenantId},
      ${req.actorId || null},
      ${req.actorTenantId || null},
      ${req.action},
      ${req.resourceType},
      ${req.resourceId},
      ${JSON.stringify(req.metadata || {})}::jsonb,
      ${req.correlationId || null},
      ${req.portalId || null},      -- NEW
      ${req.circleId || null}       -- NEW
    )
    RETURNING id
  `);
  
  return result.rows[0].id as string;
}
```

### 5.4 Context-Aware Helper

**File:** `server/services/activityService.ts` (new function)

```typescript
import { TenantRequest } from '../middleware/tenantContext';

/**
 * Log activity with context from request.
 * Automatically captures tenant_id, portal_id, circle_id, actor_id.
 */
export async function logActivityFromRequest(
  req: TenantRequest,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, any>,
  correlationId?: string
): Promise<string> {
  return logActivity({
    tenantId: req.ctx.tenant_id!,
    actorId: req.ctx.individual_id || undefined,
    actorTenantId: req.ctx.tenant_id || undefined,
    action,
    resourceType,
    resourceId,
    metadata,
    correlationId,
    portalId: req.ctx.portal_id || undefined,
    circleId: req.ctx.circle_id || undefined,
  });
}
```

### 5.5 Call Sites to Update

Services that call `logActivity()` should include portal_id and circle_id:

| File | Line | Notes |
|------|------|-------|
| `server/services/reservationService.ts` | 250, 330, 371, 414, 450, 483 | Pass portal_id from context |
| `server/services/allocationService.ts` | 639 | Pass portal_id from context |
| `server/services/federationService.ts` | 163 | May need circle_id for federation actions |
| `server/services/checkoutService.ts` | 273, 355 | Pass from request context |
| `server/services/businessOperatorService.ts` | 110, 288, 354, 434, 620 | Pass portal_id |
| `server/services/citationService.ts` | 312, 573, 704 | Pass from context |
| `server/services/tripService.ts` | 125, 289, 378 | Pass from context |
| `server/services/accessService.ts` | 131, 397, 425 | Pass from context |
| `server/services/incidentService.ts` | 113, 218 | Pass from context |
| `server/routes/operator.ts` | 656, 740 | Pass from req.ctx |

**Recommendation:** Replace direct `logActivity()` calls with `logActivityFromRequest(req, ...)` to automatically capture context.

---

## 6) SUMMARY OF CHANGES REQUIRED

### Files to Modify

| File | Changes |
|------|---------|
| `server/middleware/tenantContext.ts` | Extend `TenantContext` interface with `circle_id`, `circle_role`, `acting_as_circle` |
| `server/db/tenantDb.ts` | Extend `ActorContext`, add `app.circle_id` to all GUC functions |
| `server/db/withRequestContext.ts` | Add `app.circle_id` to all GUC functions |
| `server/workers/rtr-worker.ts` | Add `app.circle_id` to worker context |
| `shared/schema.ts` | Add `portalId`, `circleId` columns to `cc_activity_ledger` |
| `server/services/activityService.ts` | Add `portalId`, `circleId` params, add `logActivityFromRequest()` |

### New Files Required

| File | Purpose |
|------|---------|
| `server/middleware/circleContext.ts` | Circle validation middleware |
| `server/migrations/1XX_activity_ledger_context_columns.sql` | Add columns to ledger |

### Database Tables Required (from Canonical Design)

| Table | Purpose |
|-------|---------|
| `cc_coordination_circles` | Circle entity |
| `cc_circle_members` | Membership with role |
| `cc_circle_delegations` | Cross-tenant access grants |

---

## 7) SECURITY CONSIDERATIONS

### Client Cannot Spoof

1. **X-Circle-Id header** is validated against `cc_circle_members` - rejected if no active membership
2. **session.current_circle_id** is set server-side only via switch-circle endpoint
3. **GUC app.circle_id** is set from validated `req.ctx.circle_id` only

### Fail Closed

1. If circle tables don't exist, circle_id remains null
2. If validation query fails, circle_id remains null
3. If membership check fails, circle_id remains null

### Cross-Tenant Delegation

1. Only allowed via explicit `cc_circle_delegations` entries
2. Delegation must be active and not expired
3. Delegation grants specific scopes, not full access

---

*End of Integration Plan*

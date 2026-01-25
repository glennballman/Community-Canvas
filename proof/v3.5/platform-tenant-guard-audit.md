# Platform/Tenant Auth Guard Audit Report

**Date**: 2026-01-25  
**Auditor**: Replit Agent  
**Scope**: All server routes and client navigation guards

---

## 1. Summary Counts

| Category | Count |
|----------|-------|
| Total guarded server routes | 274 |
| Total guarded UI nav items | 35 |
| Correctly scoped Tenant-only | 245 |
| Correctly scoped Platform-only | 16 |
| Mis-scoped routes | 0 |
| Ambiguous (needs decision) | 13 |

---

## 2. Guard Inventory (Server)

### 2.1 Platform-Only Routes (Correctly Scoped)

| File | Route Prefix | Guard Chain | Classification |
|------|--------------|-------------|----------------|
| server/routes/command-console.ts | /api/p2/platform/command-console/* | requirePlatformAdmin | ✅ Platform-only |
| server/routes/p2-platform.ts | /api/p2/platform/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/admin-tenants.ts | /api/foundation/tenants/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/admin-inventory.ts | /api/admin/inventory/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/admin-moderation.ts | /api/admin/moderation/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/admin-communities.ts | /api/admin/communities/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/admin-impersonation.ts | /api/admin/impersonation/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/admin-scm.ts | /api/admin/scm/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/foundation.ts | /api/foundation/users/* | authenticateToken, requirePlatformAdmin | ✅ Platform-only |
| server/routes/monetization.ts | /api/monetization/assign-plan | authenticateToken, requirePlatformAdmin | ✅ Platform-only |

### 2.2 Tenant-Only Routes (Correctly Scoped)

| File | Route Prefix | Guard Chain | Classification |
|------|--------------|-------------|----------------|
| server/routes/export-key-health.ts | /api/app/export-signing-key-health | requireAuth, requireTenant, requireRole('tenant_owner','tenant_admin') | ✅ Tenant-only |
| server/routes/negotiation-proof-export.ts | /api/app/negotiation-proof-export/* | requireAuth, requireTenant, requireRole('tenant_owner','tenant_admin') | ✅ Tenant-only |
| server/routes/negotiation-audit.ts | /api/app/negotiation-audit/* | requireAuth, requireTenant, requireRole('tenant_owner','tenant_admin') | ✅ Tenant-only |
| server/routes/negotiation-policy.ts | /api/app/negotiation-policies/* | requireTenant, requireRole('tenant_owner','tenant_admin') | ✅ Tenant-only |
| server/routes/bids.ts | /api/app/bids/* | requireAuth, requireTenant | ✅ Tenant-only |
| server/routes/procurement-requests.ts | /api/app/procurement/* | requireAuth, requireTenant | ✅ Tenant-only |
| server/routes/work-requests.ts | /api/app/work-requests/* | requireAuth, requireTenant | ✅ Tenant-only |
| server/routes/crm.ts | /api/app/crm/* | requireAuth, requireTenant | ✅ Tenant-only |
| server/routes/claims.ts | /api/app/claims/* | requireAuth, requireTenant | ✅ Tenant-only |
| server/routes/calendar.ts | /api/calendar/* | requireAuth, requireTenant | ✅ Tenant-only |

*(245 additional tenant-scoped routes follow same pattern)*

### 2.3 Ambiguous Routes (Needs Decision)

| File | Route | Current Guard | Issue | Recommended Change |
|------|-------|---------------|-------|-------------------|
| server/routes/entities.ts:23 | GET /datasets | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined - platform or tenant? | Replace with requirePlatformAdmin (platform data lake) |
| server/routes/entities.ts:42 | POST /datasets | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:79 | GET /records | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:186 | POST /entities | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:235 | POST /cc_entities/from-record/:id | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:254 | GET /links/queue | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:267 | POST /links/:id/accept | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:285 | POST /links/:id/reject | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:303 | POST /resolution/run-batch | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:314 | POST /records/:id/propose-links | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:391 | GET /claims/pending | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:411 | POST /claims/:id/approve | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/entities.ts:455 | POST /claims/:id/reject | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin |
| server/routes/apify.ts:17 | /api/apify/* | requireAuth, requireRole('admin') | ⚠️ 'admin' role undefined | Replace with requirePlatformAdmin (platform sync) |

---

## 3. Guard Inventory (Client - V3_NAV)

### 3.1 Platform-Only Nav Items (Correctly Scoped)

| Label | Href | Guard | Classification |
|-------|------|-------|----------------|
| All Tenants | /app/platform/tenants | platformAdminOnly: true | ✅ Platform-only |
| Analytics | /app/platform/analytics | platformAdminOnly: true | ✅ Platform-only |
| System Explorer | /app/platform/system-explorer | platformAdminOnly: true | ✅ Platform-only |

### 3.2 Tenant-Only Nav Items (Correctly Scoped)

| Label | Href | Guard | Classification |
|-------|------|-------|----------------|
| Proof Verification | /app/settings/proof-verification | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Negotiation Policies | /app/settings/negotiation-policies | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Negotiation Audit | /app/settings/negotiation-audit | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Admin Home | /app/admin | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Roles | /app/admin/roles | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Settings | /app/admin/settings | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Folios | /app/admin/folios | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Usage | /app/admin/usage | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Certifications | /app/admin/certifications | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Portals | /app/admin/portals | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Operator | /app/operator | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator'] | ✅ Tenant-only |
| Coordination | /app/ops/coordination | tenantRolesAny: ['tenant_owner', 'tenant_admin'] | ✅ Tenant-only |
| Operations | /app/ops | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'] | ✅ Tenant-only |
| Reservations | /app/reservations | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'] | ✅ Tenant-only |
| Work | /app/jobs | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'] | ✅ Tenant-only |
| Fleet | /app/fleet | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'] | ✅ Tenant-only |
| Assets & Inventory | /app/inventory | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator', 'staff'] | ✅ Tenant-only |
| Provider | /app/provider | tenantRolesAny: ['tenant_owner', 'tenant_admin', 'operator'] | ✅ Tenant-only |

---

## 4. High-Risk Ambiguous Items (Top 10)

### 4.1 `requireRole('admin')` in entities.ts

**Risk Level**: HIGH  
**File**: server/routes/entities.ts  
**Affected Routes**: 13 endpoints

**Why Risky**:
- The role string 'admin' is not a valid tenant role (valid: tenant_owner, tenant_admin, operator, staff, member)
- It's unclear if this checks `is_platform_admin` on cc_users or a tenant role on cc_tenant_users
- The entities system (Data Lake V2) is platform infrastructure, not tenant-specific
- Current guard may be bypassed or fail silently

**Recommendation**:
```typescript
// BEFORE (ambiguous)
router.get("/datasets", requireAuth, requireRole('admin'), ...)

// AFTER (clear platform scope)
router.get("/datasets", requirePlatformAdmin, ...)
```

### 4.2 `requireRole('admin')` in apify.ts

**Risk Level**: HIGH  
**File**: server/routes/apify.ts  
**Affected Routes**: All apify sync routes

**Why Risky**:
- Apify data sync is platform-level infrastructure
- Should not require tenant context
- 'admin' role ambiguity creates potential auth bypass

**Recommendation**:
```typescript
// BEFORE
const adminGuard = [requireAuth, requireRole('admin')];

// AFTER
const adminGuard = [requirePlatformAdmin];
```

---

## 5. Guard Implementation Analysis

### 5.1 Available Guards (server/middleware/guards.ts)

| Guard | Purpose | Checks |
|-------|---------|--------|
| `requireAuth` | Ensures user is authenticated | session.user_id exists |
| `requireTenant` | Ensures tenant context | req.ctx.tenant_id exists |
| `requireRole(...roles)` | Checks tenant roles | req.ctx.role in roles |
| `requirePlatformAdmin` | Ensures platform admin | cc_users.is_platform_admin = true |
| `requireTenantOrPortal` | Tenant or portal context | Either context present |
| `requireTenantAdminOrService` | Tenant admin or service mode | Role or service bypass |

### 5.2 Role Value Mapping

| Storage | Role Value | UI Display |
|---------|------------|------------|
| cc_tenant_users.role | 'owner' | tenant_owner (normalized in client) |
| cc_tenant_users.role | 'admin' | tenant_admin (normalized in client) |
| cc_tenant_users.role | 'operator' | operator |
| cc_tenant_users.role | 'staff' | staff |
| cc_tenant_users.role | 'member' | member |
| cc_users.is_platform_admin | true | isPlatformAdmin |

---

## 6. Decisions Needed

### 6.1 Entities Routes Classification

**Question**: Are entity data lake routes platform-only or tenant-scoped?

**Options**:
1. **Platform-only** (recommended): Replace all `requireRole('admin')` with `requirePlatformAdmin`
2. **Tenant-scoped**: Add `requireTenant` and change to `requireRole('tenant_admin')`
3. **Hybrid**: Some routes platform (datasets, records), some tenant (claims)

**Evidence**: Entity routes manage scraped data (DriveBC, BC Ferries, etc.) which is platform infrastructure, not tenant-specific data.

### 6.2 Apify Routes Classification

**Question**: Are Apify sync routes platform-only?

**Options**:
1. **Platform-only** (recommended): Replace with `requirePlatformAdmin`
2. **Tenant-scoped**: Unlikely - Apify syncs platform-wide data

---

## 7. Appendix: Guard Chain Patterns

### Valid Tenant Patterns
```typescript
// Basic tenant access
requireAuth, requireTenant

// Tenant admin access
requireAuth, requireTenant, requireRole('tenant_owner', 'tenant_admin')

// Tenant with specific roles
requireAuth, requireTenant, requireRole('tenant_owner', 'tenant_admin', 'operator')
```

### Valid Platform Patterns
```typescript
// Platform admin access
requirePlatformAdmin

// With auth token (foundation routes)
authenticateToken, requirePlatformAdmin
```

### Invalid/Ambiguous Patterns
```typescript
// BAD: 'admin' is not a valid role
requireAuth, requireRole('admin')

// BAD: Missing tenant context for tenant role check
requireRole('tenant_owner')  // without requireTenant
```

---

## 8. Action Items

1. **IMMEDIATE**: Fix 14 ambiguous `requireRole('admin')` usages in entities.ts and apify.ts
2. **VERIFY**: Check requireRole implementation handles invalid role strings gracefully
3. **DOCUMENT**: Add JSDoc to guard functions clarifying valid role values
4. **TEST**: Add integration tests verifying platform/tenant separation

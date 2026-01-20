# V3.5 Role-to-Nav Visibility Matrix

**Generated:** 2026-01-20

---

## Role Model Overview

### Role Categories

| Category | Roles | Source |
|----------|-------|--------|
| Tenant Roles | owner, admin, operator, member | Tenant membership |
| Portal Roles | portal_admin, portal_member | Portal membership |
| Participant Roles | participant, applicant, guest | Trip/application context |
| Platform Role | is_platform_admin flag | User record |

### Context Requirements

| Context | Description |
|---------|-------------|
| tenant_id | Required for all /app/* routes (except /app root) |
| portal_id | Required for portal-scoped operations |
| circle_id | Required for circle-scoped operations |

---

## Role-Based Visibility

### Guest/Public (Unauthenticated)

**Visible Nav Items:** None (uses horizontal tabs in portal layout)

**Accessible Routes:**
| Route Pattern | Notes |
|---------------|-------|
| `/c/:slug/*` | Community portal with tabs |
| `/p/:portalSlug` | Business portal home |
| `/p/:portalSlug/reserve/*` | Public reservation |
| `/p/proposal/:proposalId` | Public proposal view |
| `/b/:portalSlug/jobs/*` | Public jobs portal |
| `/trip/:accessCode` | Guest trip portal |
| `/reserve/*` | Public reservation flow |
| `/login` | Authentication |

**Required Context:** portal_slug (from URL)

---

### Participant (Authenticated, has trips/applications)

**Visible Nav Items (per V3_NAV - not wired):**
- Dashboard
- My Trips
- My Applications
- Messages
- Notifications

**Active Nav Items (via tenant type):**
- Dependent on tenant type (business/community/individual)

**Accessible Routes:**
| Route | Context Required |
|-------|------------------|
| `/app` | Auth |
| `/app/participant/trips` | Auth + tenant_id |
| `/app/participant/trips/:tripId` | Auth + tenant_id |
| `/app/participant/applications` | Auth + tenant_id |
| `/app/participant/applications/:appId` | Auth + tenant_id |
| `/app/messages` | Auth + tenant_id |
| `/app/notifications` | Auth + tenant_id |

**Required Context:** tenant_id

---

### Host (Asset Owner)

**Visible Nav Items (BUSINESS_NAV):**
- Dashboard
- Assets
- Reservations
- Operations
- Work Requests
- Projects
- Places/People/Orgs (CRM)
- Messages
- Settings

**Accessible Routes:**
| Route | Context Required |
|-------|------------------|
| `/app/assets` | tenant_id |
| `/app/assets/:id` | tenant_id |
| `/app/reservations` | tenant_id |
| `/app/reservations/:id` | tenant_id |
| `/app/proposals/:proposalId` | tenant_id |
| `/app/parking` | tenant_id |
| `/app/marina` | tenant_id |
| `/app/hospitality` | tenant_id |
| `/app/customers` | tenant_id |

**Required Context:** tenant_id (business type)

---

### Operator (Business Operations)

**Visible Nav Items (BUSINESS_NAV + additional routes):**
- All Host routes
- Jobs management
- Moderation routes
- Fleet routes

**Accessible Routes (additional):**
| Route | Context Required |
|-------|------------------|
| `/app/jobs` | tenant_id |
| `/app/jobs/new` | tenant_id |
| `/app/jobs/:id/edit` | tenant_id |
| `/app/jobs/:id/destinations` | tenant_id |
| `/app/jobs/:jobId/applications` | tenant_id |
| `/app/mod/jobs` | tenant_id |
| `/app/mod/applications` | tenant_id |
| `/app/mod/hiring-pulse` | tenant_id |
| `/app/operator` | tenant_id |
| `/app/operator/emergency` | tenant_id |
| `/app/operator/legal` | tenant_id |
| `/app/operator/insurance` | tenant_id |
| `/app/operator/disputes` | tenant_id |
| `/app/operator/authority` | tenant_id |
| `/app/operator/audit` | tenant_id |

**Required Context:** tenant_id

---

### Crew (Field Workers)

**Visible Nav Items (COMMUNITY_NAV subset):**
- Dashboard
- Operations
- Service Runs
- Work Requests

**Accessible Routes:**
| Route | Context Required |
|-------|------------------|
| `/app/ops` | tenant_id |
| `/app/ops/housekeeping` | tenant_id |
| `/app/ops/incidents` | tenant_id |
| `/app/services/runs` | tenant_id |
| `/app/services/runs/:slug` | tenant_id |
| `/app/work-requests` | tenant_id |
| `/app/n3/attention` | tenant_id |
| `/app/n3/monitor/:runId` | tenant_id |

**Required Context:** tenant_id

---

### Fleet Manager

**Visible Nav Items (per V3_NAV - not wired):**
- Fleet Dashboard
- Assets
- Maintenance

**Accessible Routes:**
| Route | Context Required |
|-------|------------------|
| `/app/fleet` | tenant_id |
| `/app/fleet/assets` | tenant_id |
| `/app/fleet/assets/:id` | tenant_id |
| `/app/fleet/maintenance` | tenant_id |

**Required Context:** tenant_id  
**Note:** Fleet routes exist but no nav entry in active implementation

---

### Tenant Admin

**Visible Nav Items (per V3_NAV - not wired):**
- Admin
- Roles
- Settings
- Folios
- Usage
- Certifications
- Operator
- Portals
- Tenants

**Accessible Routes:**
| Route | Context Required |
|-------|------------------|
| `/app/admin` | tenant_id + admin role |
| `/app/admin/roles` | tenant_id + admin role |
| `/app/admin/settings` | tenant_id + admin role |
| `/app/admin/folios` | tenant_id + admin role |
| `/app/admin/folios/:id` | tenant_id + admin role |
| `/app/admin/usage` | tenant_id + admin role |
| `/app/admin/certifications` | tenant_id + admin role |
| `/app/admin/portals` | tenant_id + admin role |
| `/app/admin/portals/:portalId/appearance` | tenant_id + portal_id |
| `/app/admin/tenants` | tenant_id + admin role |
| `/app/circles` | tenant_id + admin role |
| `/app/circles/new` | tenant_id + admin role |
| `/app/circles/:circleId` | tenant_id + circle_id |

**Required Context:** tenant_id + tenant admin role

---

### Platform Admin

**Visible Nav Items (PlatformAdminLayout):**
- Dashboard
- Tenants
- Users
- Impersonation
- Infrastructure
- Chambers
- NAICS
- Accommodations
- Assets (Audit)
- System Explorer
- Articles
- Import/Export
- All Communities
- Seed Communities
- Portal Config
- AI Queue
- Flagged Content
- Settings
- Logs

**Visible Nav Items (V3_NAV Platform section - not wired):**
- Tenants (/app/platform/tenants)
- Analytics (/app/platform/analytics)

**Accessible Routes:**
| Route | Context Required |
|-------|------------------|
| `/admin` | is_platform_admin |
| `/admin/tenants` | is_platform_admin |
| `/admin/users` | is_platform_admin |
| `/admin/impersonation` | is_platform_admin |
| `/admin/data/*` | is_platform_admin |
| `/admin/communities/*` | is_platform_admin |
| `/admin/moderation/*` | is_platform_admin |
| `/admin/settings` | is_platform_admin |
| `/admin/logs` | is_platform_admin |
| `/app/platform/tenants` | is_platform_admin |
| `/app/platform/tenants/:tenantId` | is_platform_admin |
| `/app/platform/analytics` | is_platform_admin |

**Required Context:** is_platform_admin flag on user

---

## Dynamic Gating Conditions

| Condition | Description |
|-----------|-------------|
| Portal Type | Some features only visible for specific portal types |
| Feature Flags | Some nav items gated by feature flags |
| Module Enabled | Some subsystems require module activation |
| Tenant Type | Nav varies by community/business/individual |
| platformAdminOnly | V3_NAV flag for platform admin routes |

---

## Context Propagation

| Context | Set By | Propagated Via |
|---------|--------|----------------|
| tenant_id | TenantPicker / TenantContext | TenantContext provider |
| portal_id | PortalSelector | PortalContext provider |
| circle_id | Circle detail page | URL parameter |
| is_platform_admin | AuthContext | User record |

---

## Summary Matrix

| Role | Nav Source | Context Required | Primary Shell |
|------|------------|------------------|---------------|
| Guest | PublicPortalLayout tabs | portal_slug | PublicPortalLayout |
| Participant | Tenant-type nav | tenant_id | TenantAppLayout |
| Host | BUSINESS_NAV | tenant_id | TenantAppLayout |
| Operator | BUSINESS_NAV | tenant_id | TenantAppLayout |
| Crew | COMMUNITY_NAV | tenant_id | TenantAppLayout |
| Fleet Manager | Not in active nav | tenant_id | TenantAppLayout |
| Tenant Admin | Settings link only | tenant_id + admin | TenantAppLayout |
| Platform Admin | ADMIN_NAV | is_platform_admin | PlatformAdminLayout |

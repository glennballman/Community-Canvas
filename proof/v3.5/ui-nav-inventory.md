# V3.5 Navigation Inventory

**Generated:** 2026-01-20  
**Sources:** `v3Nav.ts`, `TenantAppLayout.tsx`, `PlatformAdminLayout.tsx`, `PublicPortalLayout.tsx`

---

## Navigation Config Sources

| Source | Location | Purpose |
|--------|----------|---------|
| V3_NAV | `client/src/lib/routes/v3Nav.ts` | Authoritative app nav (not fully wired) |
| COMMUNITY_NAV | `client/src/layouts/TenantAppLayout.tsx` | Community tenant nav |
| BUSINESS_NAV | `client/src/layouts/TenantAppLayout.tsx` | Business tenant nav |
| INDIVIDUAL_NAV | `client/src/layouts/TenantAppLayout.tsx` | Individual tenant nav |
| ADMIN_NAV | `client/src/layouts/PlatformAdminLayout.tsx` | Platform admin nav |
| PublicPortalLayout tabs | `client/src/layouts/PublicPortalLayout.tsx` | Public portal tabs |

---

## Part 1: V3_NAV (Authoritative Reference)

**File:** `client/src/lib/routes/v3Nav.ts`  
**Status:** Defined but sidebar renderer uses tenant-type-specific navs

### Personal Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Dashboard | LayoutDashboard | /app | nav-dashboard | None |
| My Trips | Plane | /app/participant/trips | nav-my-trips | None |
| My Applications | FileText | /app/participant/applications | nav-my-applications | None |

### Operations Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Operations Board | Calendar | /app/ops | nav-ops | None |
| Housekeeping | Sparkles | /app/ops/housekeeping | nav-housekeeping | None |
| Incidents | AlertTriangle | /app/ops/incidents | nav-incidents | None |

### Reservations Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Reservations | Calendar | /app/reservations | nav-reservations | None |
| Parking | Car | /app/parking | nav-parking | None |
| Marina | Anchor | /app/marina | nav-marina | None |
| Hospitality | Home | /app/hospitality | nav-hospitality | None |

### Work Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Jobs | Briefcase | /app/jobs | nav-jobs | None |
| Work Requests | ClipboardList | /app/work-requests | nav-work-requests | None |
| Projects | FolderKanban | /app/projects | nav-projects | None |
| Service Runs | Truck | /app/services/runs | nav-service-runs | None |

### Fleet Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Fleet Dashboard | Truck | /app/fleet | nav-fleet | None |
| Assets | Car | /app/fleet/assets | nav-fleet-assets | None |
| Maintenance | Wrench | /app/fleet/maintenance | nav-fleet-maintenance | None |

### Compliance Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Enforcement | ShieldAlert | /app/enforcement | nav-enforcement | None |

### Communication Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Messages | MessageSquare | /app/messages | nav-messages | None |
| Notifications | Bell | /app/notifications | nav-notifications | None |

### Admin Section
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Admin | Settings | /app/admin | nav-admin | None |
| Roles | UserCog | /app/admin/roles | nav-roles | None |
| Settings | Settings | /app/admin/settings | nav-settings | None |
| Folios | Wallet | /app/admin/folios | nav-folios | None |
| Usage | BarChart3 | /app/admin/usage | nav-usage | None |
| Certifications | ShieldCheck | /app/admin/certifications | nav-certifications | None |
| Operator | Building2 | /app/operator | nav-operator | None |
| Portals | Building2 | /app/admin/portals | nav-portals | None |
| Tenants | Users | /app/admin/tenants | nav-tenants | None |

### Platform Section (platformAdminOnly)
| Label | Icon | href | testId | Gating |
|-------|------|------|--------|--------|
| Tenants | Building2 | /app/platform/tenants | nav-platform-tenants | platformAdminOnly |
| Analytics | BarChart3 | /app/platform/analytics | nav-platform-analytics | platformAdminOnly |

---

## Part 2: Tenant App Nav (Active Implementation)

**File:** `client/src/layouts/TenantAppLayout.tsx`

### COMMUNITY_NAV (tenant_type: community | government)

| Label | Icon | href |
|-------|------|------|
| Dashboard | LayoutDashboard | /app/dashboard |
| Availability | Phone | /app/availability |
| Operations | Calendar | /app/operations |
| Service Runs | Wrench | /app/service-runs |
| Services | Briefcase | /app/services |
| Bundles | Layers | /app/bundles |
| Directory | Building2 | /app/directory |
| Work Requests | MessageSquare | /app/intake/work-requests |
| Projects | Briefcase | /app/projects |
| Places | MapPin | /app/crm/places |
| People | Contact | /app/crm/people |
| Organizations | Building2 | /app/crm/orgs |
| Content | Palette | /app/content |
| Settings | Settings | /app/settings |

### BUSINESS_NAV (tenant_type: business)

| Label | Icon | href |
|-------|------|------|
| Dashboard | LayoutDashboard | /app/dashboard |
| Assets | Package | /app/assets |
| Reservations | Calendar | /app/reservations |
| Operations | Calendar | /app/operations |
| Work Requests | MessageSquare | /app/intake/work-requests |
| Projects | Briefcase | /app/projects |
| Places | MapPin | /app/crm/places |
| People | Contact | /app/crm/people |
| Organizations | Building2 | /app/crm/orgs |
| Messages | MessageSquare | /app/messages |
| Settings | Settings | /app/settings |

### INDIVIDUAL_NAV (tenant_type: individual)

| Label | Icon | href |
|-------|------|------|
| Dashboard | LayoutDashboard | /app/dashboard |
| Messages | MessageSquare | /app/messages |
| Settings | Settings | /app/settings |

---

## Part 3: Platform Admin Nav

**File:** `client/src/layouts/PlatformAdminLayout.tsx`  
**Shell:** PlatformAdminLayout (requires is_platform_admin)

### OVERVIEW
| Label | Icon | href |
|-------|------|------|
| Dashboard | LayoutDashboard | /admin |

### TENANTS & USERS
| Label | Icon | href |
|-------|------|------|
| Tenants | Building2 | /admin/tenants |
| Users | Users | /admin/users |
| Impersonation | UserCog | /admin/impersonation |

### DATA MANAGEMENT
| Label | Icon | href |
|-------|------|------|
| Infrastructure | Database | /admin/data/infrastructure |
| Chambers | Landmark | /admin/data/chambers |
| NAICS | FileText | /admin/data/naics |
| Accommodations | Home | /admin/data/accommodations |
| Assets (Audit) | Package | /admin/assets |
| System Explorer | Search | /admin/system-explorer |
| Articles | FileText | /admin/articles |
| Import/Export | FileBox | /admin/data/import-export |

### COMMUNITIES
| Label | Icon | href |
|-------|------|------|
| All Communities | Globe | /admin/communities |
| Seed Communities | Sprout | /admin/communities/seed |
| Portal Config | SettingsIcon | /admin/communities/portals |

### MODERATION
| Label | Icon | href |
|-------|------|------|
| AI Queue | Bot | /admin/moderation/ai-queue |
| Flagged Content | Flag | /admin/moderation/flagged |

### SYSTEM
| Label | Icon | href |
|-------|------|------|
| Settings | Settings | /admin/settings |
| Logs | FileSearch | /admin/logs |

---

## Part 4: Public Portal Nav

**File:** `client/src/layouts/PublicPortalLayout.tsx`  
**Shell:** PublicPortalLayout (no auth)

| Label | href | Condition |
|-------|------|-----------|
| Overview | /c/:slug | Always |
| Businesses | /c/:slug/businesses | config.show_businesses |
| Services | /c/:slug/services | config.show_service_runs |
| Stay | /c/:slug/stay | config.show_accommodations |
| Events | /c/:slug/events | Always |
| About | /c/:slug/about | Always |

---

## Navigation Discrepancies

### V3_NAV vs Active Implementation

| V3_NAV Route | In Active Nav? | Notes |
|--------------|---------------|-------|
| /app/participant/trips | No | Only via direct URL |
| /app/participant/applications | No | Only via direct URL |
| /app/ops | No (community uses /app/operations) | Different path |
| /app/ops/housekeeping | No | Only via direct URL |
| /app/ops/incidents | No | Only via direct URL |
| /app/parking | No | Only via direct URL |
| /app/marina | No | Only via direct URL |
| /app/hospitality | No | Only via direct URL |
| /app/jobs | No | Only via direct URL |
| /app/fleet | No | Only via direct URL |
| /app/fleet/assets | No | Only via direct URL |
| /app/fleet/maintenance | No | Only via direct URL |
| /app/enforcement | No | Only via direct URL |
| /app/notifications | No | Only via direct URL |
| /app/admin | No | Only via direct URL |
| /app/admin/roles | No | Only via direct URL |
| /app/admin/settings | No | Only via direct URL |
| /app/admin/folios | No | Only via direct URL |
| /app/admin/usage | No | Only via direct URL |
| /app/admin/certifications | No | Only via direct URL |
| /app/operator | No | Only via direct URL |
| /app/admin/portals | No | Only via direct URL |
| /app/admin/tenants | No | Only via direct URL |
| /app/platform/tenants | No | Only via direct URL |
| /app/platform/analytics | No | Only via direct URL |

**Finding:** V3_NAV defines the authoritative structure but the sidebar renderer still uses the legacy tenant-type-specific arrays (COMMUNITY_NAV, BUSINESS_NAV, INDIVIDUAL_NAV).

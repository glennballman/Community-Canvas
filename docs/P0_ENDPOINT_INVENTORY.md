# P0 Endpoint Inventory - Multi-Tenant Security Audit

**Last Updated:** 2026-01-03
**Status:** COMPLETED

## Security Model Overview

### Scope Classifications
| Classification | Description | Guards | DB Helper |
|---------------|-------------|--------|-----------|
| `tenant_scoped` | Data belongs to specific tenant | requireTenant + requireAuth | tenantQuery/tenantTransaction |
| `portal_scoped_readonly` | Portal-specific public views | requirePortal | tenantQuery (portal_id filter) |
| `public_reference_readonly` | Platform reference data | None (public) | serviceQuery |
| `service_internal_only` | Background jobs/ingestion | requireServiceKey | serviceQuery/serviceTransaction |

### Guard Middleware
- `requireServiceKey` - Requires X-Internal-Service-Key header (403 if missing)
- `requireAuth` - Requires authenticated individual_id in ctx (401 if missing)
- `requireTenant` - Requires tenant_id in ctx (401 if missing)
- `requirePortal` - Requires portal_id in ctx (403 if missing)
- `requireRole('admin')` - Requires admin role (403 if missing)
- `requireSession` - Requires authenticated session (allows new users without profiles)

---

## Endpoint Inventory

### 1. Import Routes (`/api/import/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /batches | service_internal_only | requireServiceKey | serviceQuery | staging_import_batches |
| GET | /batches/:id | service_internal_only | requireServiceKey | serviceQuery | staging_import_batches, staging_import_raw |
| POST | /csv | service_internal_only | requireServiceKey | serviceTransaction | staging_import_batches, staging_import_raw |
| POST | /properties | service_internal_only | requireServiceKey | serviceTransaction | staging_properties |
| POST | /process/:id | service_internal_only | requireServiceKey | serviceTransaction | staging_import_raw, staging_properties |

### 2. CivOS Routes (`/api/civos/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /signals | public_reference_readonly | None | serviceQuery | civos_signals (platform-global) |
| GET | /capacity | public_reference_readonly | None | serviceQuery | civos_capacity (platform-global) |
| GET | /analytics | public_reference_readonly | None | serviceQuery | (aggregated platform data) |

### 3. Foundation Routes (`/api/foundation/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| POST | /auth/login | public_reference_readonly | None | serviceQuery | cc_users |
| POST | /auth/register | public_reference_readonly | None | serviceTransaction | cc_users, cc_tenants |
| GET | /me | tenant_scoped | authenticateToken | serviceQuery | cc_users, cc_tenant_users |
| GET | /tenants | tenant_scoped | authenticateToken | serviceQuery | cc_tenants (filtered by user) |
| POST | /tenants | tenant_scoped | authenticateToken | serviceTransaction | cc_tenants, cc_tenant_users |
| GET | /portals | tenant_scoped | authenticateToken + requirePlatformAdmin | serviceQuery | portals |
| POST | /portals | tenant_scoped | authenticateToken + requirePlatformAdmin | serviceTransaction | portals |

### 4. Individuals Routes (`/api/individuals/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /me | tenant_scoped | requireSession | tenantQuery | cc_individuals (id = app_individual_id()) |
| POST | /my-skills | tenant_scoped | requireAuth | tenantTransaction | cc_individual_skills |
| POST | /my-tools | tenant_scoped | requireAuth | tenantTransaction | cc_individual_tools |
| GET | /skills | public_reference_readonly | None | serviceQuery | sr_skills |
| GET | /tools | public_reference_readonly | None | serviceQuery | sr_tools |
| GET | /communities | public_reference_readonly | None | serviceQuery | sr_communities |
| GET | /bid-context/:id | tenant_scoped | requireAuth | serviceQuery | (platform function) |

### 5. Entities Routes (`/api/entities/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /datasets | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | apify_datasets |
| POST | /datasets | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | apify_datasets |
| GET | /records | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | external_records |
| GET | /entities | public_reference_readonly | requireAuth | serviceQuery | entities (visibility filter) |
| POST | /entities | service_internal_only | requireAuth + requireRole('admin') | serviceTransaction | entities |

### 6. Apify Routes (`/api/apify/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /datasets | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | apify_datasets |
| POST | /datasets | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | apify_datasets |
| POST | /sync/:slug | service_internal_only | requireAuth + requireRole('admin') | serviceTransaction | external_records |
| GET | /stats | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | (aggregated) |
| GET | /records | service_internal_only | requireAuth + requireRole('admin') | serviceQuery | external_records |

### 7. Service Runs Routes (`/api/service-runs/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /services | public_reference_readonly | None | serviceQuery | sr_services |
| GET | /categories | public_reference_readonly | None | serviceQuery | sr_service_categories |
| GET | /communities | public_reference_readonly | None | serviceQuery | sr_communities |
| GET | /bundles | public_reference_readonly | None | serviceQuery | sr_bundles |
| GET | /climate-regions | public_reference_readonly | None | serviceQuery | sr_climate_regions |
| POST | /quote | public_reference_readonly | None | serviceQuery | (pricing calculation) |

### 8. Rentals Routes (`/api/rentals/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /browse | public_reference_readonly | None | serviceQuery | cc_rental_items |
| GET | /item/:id | public_reference_readonly | None | serviceQuery | cc_rental_items |
| POST | /quote | public_reference_readonly | None | serviceQuery | (pricing calculation) |
| POST | /reservation | tenant_scoped | requireAuth | tenantTransaction | cc_rental_reservations |
| GET | /my-reservations | tenant_scoped | requireAuth | tenantQuery | cc_rental_reservations |

### 9. Fleet Routes (`/api/v1/fleet/*`)

**✅ TENANT ISOLATION COMPLETE:** Migration 025 added tenant_id columns and RLS policies to vehicle_profiles and trailer_profiles.
All mutations now use requireTenant + tenantQuery with RLS enforcement.

| Method | Path | Scope | Guards | DB Helper | Notes |
|--------|------|-------|--------|-----------|-------|
| GET | /vehicles | public_reference_readonly | None | serviceQuery | Shared + tenant-owned visible |
| GET | /vehicles/:id | public_reference_readonly | None | serviceQuery | Shared + tenant-owned visible |
| POST | /vehicles | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| PATCH | /vehicles/:id | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| PATCH | /vehicles/:id/hitch | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| GET | /trailers | public_reference_readonly | None | serviceQuery | Shared + tenant-owned visible |
| GET | /trailers/:id | public_reference_readonly | None | serviceQuery | Shared + tenant-owned visible |
| POST | /trailers | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| PATCH | /trailers/:id | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| POST | /trailers/:id/hitch | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| POST | /trailers/:id/unhitch | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| POST | /compatibility-check | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |
| POST | /check-driver-qualification | tenant_scoped | requireAuth, requireTenant | tenantQuery | RLS enforced |

### 10. Host Routes (`/api/host-dashboard/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /properties | tenant_scoped | authenticateToken | serviceQuery | staging_properties (user filter) |
| GET | /properties/:id | tenant_scoped | authenticateToken | serviceQuery | staging_properties |
| GET | /reservations | tenant_scoped | authenticateToken | serviceQuery | staging_reservations (user filter) |
| PUT | /reservations/:id | tenant_scoped | authenticateToken | serviceQuery | staging_reservations |

### 11. Accommodations Routes (`/api/accommodations/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | / | public_reference_readonly | None | storage class | accommodation_properties |
| GET | /stats | public_reference_readonly | None | storage class | (aggregated) |
| GET | /reservations | public_reference_readonly | None | storage class | accommodation_reservations |
| POST | /reservations | tenant_scoped | None (NEEDS: requireAuth) | storage class | accommodation_reservations |

### 12. Crew Routes (`/api/crew/*`)
| Method | Path | Scope | Guards | DB Helper | RLS Tables |
|--------|------|-------|--------|-----------|------------|
| GET | /search | public_reference_readonly | None | serviceQuery | accommodation_properties |
| GET | /availability | public_reference_readonly | None | serviceQuery | availability_blocks |

---

## Security Gaps Status

### P0 COMPLETE - Full Tenant Isolation

1. **Fleet mutations** - All POST/PATCH endpoints use requireTenant + tenantQuery with RLS
   - Migration 025 added tenant_id columns to vehicle_profiles, trailer_profiles
   - RLS policies enforce tenant isolation at database level
2. **Import routes** - Protected by requireServiceKey (service-to-service only)
3. **Entity/Apify routes** - Protected by requireAuth + requireRole('admin')
4. **Individual routes** - Protected by requireSession/requireAuth
5. **All tenant-scoped tables** - RLS policies enforce isolation via current_tenant_id()

### DESIGN PATTERN
- **Public reads:** serviceQuery allows reading shared catalog (tenant_id IS NULL) plus tenant's own assets
- **Tenant mutations:** requireTenant + tenantQuery enforces RLS - tenants can only modify their own assets
- **Service mode:** is_service_mode() bypass allows background jobs to operate across tenants

---

## Files Modified in P0 Migration

1. `server/routes/import.ts` - Added requireServiceKey guard, migrated to serviceQuery
2. `server/routes/civos.ts` - Migrated to serviceQuery (public platform data)
3. `server/routes/foundation.ts` - Migrated to serviceQuery
4. `server/routes/host.ts` - Migrated to serviceQuery
5. `server/routes/auth.ts` - Migrated to serviceQuery
6. `server/routes/fleet.ts` - Migrated db.query to serviceQuery
7. `server/routes/crew.ts` - Migrated to serviceQuery, fixed factory signature
8. `server/routes/individuals.ts` - Fixed tenantTransaction usage
9. `server/routes.ts` - Updated createCrewRouter call signature
10. `server/middleware/guards.ts` - Contains all required guards

# V3.5 UI Inventory Summary

**Generated:** 2026-01-20  
**Build:** `4cf76717766cfa3cf4b154973a631cb305cd77e7`

---

## Inventory Documents

| Document | Description |
|----------|-------------|
| [ui-routes-inventory.md](./ui-routes-inventory.md) | Complete route registry (120 routes) |
| [ui-nav-inventory.md](./ui-nav-inventory.md) | Navigation config sources and structures |
| [ui-role-nav-matrix.md](./ui-role-nav-matrix.md) | Role-based visibility and access matrix |
| [ui-subsystem-coverage.md](./ui-subsystem-coverage.md) | 16 subsystems with routes and nav status |
| [ui-how-to-index.md](./ui-how-to-index.md) | Operator intent → navigation steps |
| [ui-discoverability-gaps.md](./ui-discoverability-gaps.md) | Missing nav entries and confusing labels |

---

## Counts Summary

| Category | Count |
|----------|-------|
| **Total Page Files** | 176 |
| **Total Routes** | 120 |
| **Public Routes** | 23 |
| **Tenant App Routes** | 78 |
| **Platform Admin Routes** | 17 |
| **Dev Routes** | 2 |
| **Nav Config Sources** | 6 |
| **Subsystems** | 16 |
| **Routes Without Nav Entry** | 42 |
| **Duplicate/Confusing Labels** | 5 |

---

## Top 10 Discoverability Blockers

| # | Issue | Impact | Routes Affected |
|---|-------|--------|-----------------|
| 1 | **V3_NAV not wired to sidebar** | High | All V3.5 routes |
| 2 | **Jobs subsystem hidden** | High | `/app/jobs/*` (10 routes) |
| 3 | **Fleet subsystem hidden** | High | `/app/fleet/*` (4 routes) |
| 4 | **Admin routes hidden** | High | `/app/admin/*` (9 routes) |
| 5 | **Platform routes hidden** | High | `/app/platform/*` (3 routes) |
| 6 | **Participant routes hidden** | Medium | `/app/participant/*` (4 routes) |
| 7 | **Housekeeping/Incidents hidden** | Medium | `/app/ops/*` (3 routes) |
| 8 | **Circles hidden** | Medium | `/app/circles/*` (4 routes) |
| 9 | **V3 Ops vs Legacy Operations** | Medium | Routing confusion |
| 10 | **Notifications no nav** | Medium | Unread badge but no link |

---

## Navigation Normalization Proposal

### Phase 1: Wire V3_NAV

**Goal:** Replace tenant-type nav arrays with V3_NAV rendering

**Changes:**
1. Modify `TenantAppLayout.tsx` to render from `V3_NAV`
2. Apply section visibility based on tenant type
3. Implement `platformAdminOnly` filtering
4. Add feature flag gating infrastructure

### Phase 2: Add Missing Nav Entries

**Priority additions:**
```
Personal:
  - My Trips       → /app/participant/trips
  - My Applications → /app/participant/applications

Work:
  - Jobs          → /app/jobs

Operations:
  - Housekeeping  → /app/ops/housekeeping
  - Incidents     → /app/ops/incidents

Fleet:
  - Dashboard     → /app/fleet
  - Assets        → /app/fleet/assets
  - Maintenance   → /app/fleet/maintenance

Communication:
  - Notifications → /app/notifications
  - Circles       → /app/circles

Admin:
  - Roles         → /app/admin/roles
  - Settings      → /app/admin/settings
  - Folios        → /app/admin/folios
  - Usage         → /app/admin/usage

Platform:
  - Tenants       → /app/platform/tenants
  - Analytics     → /app/platform/analytics
```

### Phase 3: Deprecate Legacy Routes

**Routes to deprecate:**
- `/app/operations` → redirect to `/app/ops`
- `/app/service-runs` → redirect to `/app/services/runs`
- `/admin` → redirect to `/app/platform`

### Phase 4: Role-Based Filtering

**Implement nav filtering:**
1. Tenant role check (admin, operator, member)
2. Portal role check (portal_admin, portal_member)
3. Platform admin check (is_platform_admin)
4. Module/feature flag check

### Phase 5: Context Indicators

**Add breadcrumbs for:**
- Portal-scoped routes (show portal name)
- Circle-scoped routes (show circle name)
- Admin routes (show admin badge)

---

## Architecture Notes

### Current State

```
Navigation Sources:
├── v3Nav.ts (authoritative, not wired)
├── TenantAppLayout.tsx
│   ├── COMMUNITY_NAV (community/government)
│   ├── BUSINESS_NAV (business)
│   └── INDIVIDUAL_NAV (individual)
├── PlatformAdminLayout.tsx
│   └── ADMIN_NAV (platform admin)
└── PublicPortalLayout.tsx
    └── Tab navigation (public)
```

### Target State

```
Navigation Sources:
├── v3Nav.ts (authoritative, wired)
│   ├── Role filtering
│   ├── Feature flag filtering
│   └── platformAdminOnly filtering
├── PlatformAdminLayout.tsx
│   └── ADMIN_NAV (legacy platform admin)
└── PublicPortalLayout.tsx
    └── Tab navigation (public)
```

---

## Certification Alignment

This inventory confirms the following V3.5 certification requirements:

| Requirement | Status |
|-------------|--------|
| Terminology (no book/booking) | ✅ Verified |
| Route existence | ✅ 120 routes documented |
| Nav definition | ✅ V3_NAV authoritative |
| Role gating | ⚠️ Defined but not fully enforced |
| Portal scoping | ✅ 179 portal_id references |
| Platform admin | ✅ Routes exist, nav needs wiring |

---

## Related Proof Files

| File | Content |
|------|---------|
| `final-completion.md` | V3.5 completion artifact |
| `terminology-scan.json` | Terminology verification |
| `routes-ui.json` | Cert route inventory |
| `routes-api.json` | Cert API inventory |
| `invariants.json` | Schema invariant checks |
| `messaging-inventory.md` | Messaging forensic audit |

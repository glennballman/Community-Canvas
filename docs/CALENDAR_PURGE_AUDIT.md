# Calendar Purge Audit - Complete Proof Pack

**Date:** 2026-01-23  
**Status:** COMPLETE  
**Auditor:** Ruthless Principal Architect

---

## TASK A: Route Truth Table

### All Calendar Routes (client/src/App.tsx)

| Route | File:Line | Component | Import Path | Uses ScheduleBoard? |
|-------|-----------|-----------|-------------|---------------------|
| `/p/:portalSlug/calendar` | App.tsx:338 | OpsCalendarBoardPage mode="portal" | `./pages/shared/OpsCalendarBoardPage` | ✅ YES |
| `/app/.../contractor/calendar` | App.tsx:590 | OpsCalendarBoardPage mode="contractor" | `./pages/shared/OpsCalendarBoardPage` | ✅ YES |
| `/app/.../my-place/calendar` | App.tsx:593 | OpsCalendarBoardPage mode="resident" | `./pages/shared/OpsCalendarBoardPage` | ✅ YES |
| `/app/.../services/calendar` | ~~App.tsx:527~~ | ~~ServiceRunsCalendarPage~~ | DEPRECATED | ❌ PURGED |

### Ripgrep Results - Forbidden Patterns (Active Codebase)

```
CalendarGrid: 0 hits (only in _deprecated/)
CalendarRunCard: 0 hits (only in _deprecated/)
PortalCalendarPage: 0 hits (only in _deprecated/)
ContractorCalendarPage: 0 hits (only in _deprecated/)
ResidentCalendarPage: 0 hits (only in _deprecated/)
ServiceRunsCalendar: 0 hits (only in _deprecated/)
ServiceRunsCalendarPage: 0 hits (only in _deprecated/)
"No scheduled community work": OpsCalendarBoardPage.tsx:401 (empty state message - ACCEPTABLE)
"Zoom: Day": 0 hits
"Day Week Month": 0 hits
```

### Deprecated Files Location

```
client/src/_deprecated/
├── calendar/
│   ├── CalendarGrid.tsx
│   └── CalendarRunCard.tsx
├── pages/
│   ├── ContractorCalendarPage.tsx
│   ├── ResidentCalendarPage.tsx
│   ├── PortalCalendarPage.tsx
│   └── ServiceRunsCalendarPage.tsx
└── service-runs/
    └── ServiceRunsCalendar.tsx
```

---

## TASK B: Runtime Proof (Network Payloads)

### Bamfield Portal ID
```sql
SELECT id, name, slug FROM cc_portals WHERE slug = 'bamfield';
-- Result: df5561a8-8550-4498-9dc7-f02054bbbea4
```

### curl: GET /api/portal/:portalId/ops-calendar

```bash
curl -s "http://localhost:5000/api/portal/df5561a8-8550-4498-9dc7-f02054bbbea4/ops-calendar?startDate=2026-01-22T00:00:00Z&endDate=2026-01-24T00:00:00Z"
```

**Response Summary:**
```json
{
  "resources_count": 13,
  "events_count": 103,
  "portal": {
    "id": "df5561a8-8550-4498-9dc7-f02054bbbea4",
    "name": "Bamfield Community Portal"
  },
  "meta": {
    "count": 6,
    "laneGroups": ["Scheduled Work", "Staff", "Dependencies", "Zone Feasibility"],
    "zones": ["Deer Group", "East Bamfield", "Helby Island", "West Bamfield"],
    "rollup": true
  }
}
```

**Resources Sample:**
```json
[
  {"id": "zone:deer-group", "name": "Deer Group — Scheduled Work", "asset_type": "zone-work", "group": "Scheduled Work"},
  {"id": "zone:east-bamfield", "name": "East Bamfield — Scheduled Work", "asset_type": "zone-work", "group": "Scheduled Work"},
  {"id": "zone:helby-island", "name": "Helby Island — Scheduled Work", "asset_type": "zone-work", "group": "Scheduled Work"},
  {"id": "zone:west-bamfield", "name": "West Bamfield — Scheduled Work", "asset_type": "zone-work", "group": "Scheduled Work"},
  {"id": "staff:availability", "name": "Staff Availability", "asset_type": "staff", "group": "Staff"}
]
```

### curl: GET /api/contractor/ops-calendar
**Requires auth** - Returns `{"error":"Authentication required"}`

### curl: GET /api/resident/ops-calendar
**Requires auth** - Returns `{"error":"Authentication required"}`

---

## TASK C: Seed Data Validation

### Tables Queried by Portal Ops-Calendar (server/routes/calendar.ts:889-1120)

1. **cc_portals** - Get portal and owning tenant (lines 904-912)
2. **cc_zones** - Get zones for portal (lines 921-928)
3. **cc_n3_runs** - Service runs by tenant (lines 937-959)
4. **cc_alerts** - Dependency windows via getDependencyWindowsForPortal() (line 962)
5. **cc_staff_availability_blocks** - Staff availability (indirect)

### SQL Counts for Bamfield

```sql
-- N3 Runs for Bamfield tenant
SELECT COUNT(*) as n3_run_count FROM cc_n3_runs 
WHERE tenant_id = 'e0000000-0000-0000-0000-000000000001';
-- Result: 6 scheduled runs

-- Zones for Bamfield portal
SELECT COUNT(*) as zones_count FROM cc_zones 
WHERE portal_id = 'df5561a8-8550-4498-9dc7-f02054bbbea4';
-- Result: 4 zones (Deer Group, East Bamfield, Helby Island, West Bamfield)

-- Staff availability blocks
SELECT COUNT(*) as staff_blocks FROM cc_staff_availability_blocks;
-- Result: 2

-- Alerts (dependency windows)
SELECT COUNT(*) as alerts_count FROM cc_alerts;
-- Result: 3186
```

---

## TASK D: Portal Calendar Verification

### Lane Groups Returned ✅
- "Scheduled Work" ✅
- "Staff" ✅
- "Dependencies" ✅
- "Zone Feasibility" ✅

### Resources with Groups ✅
- 4 zone-work resources (one per zone)
- 1 staff resource
- 4 dependency resources (weather, ferry, road, seaplane)
- 4 zone-feasibility resources

### Events ✅
- 6 scheduled N3 runs (rolled up by zone)
- 97 dependency alerts (road, ferry, weather conditions)

---

## TASK E: Purge Verification

### Files Moved to _deprecated/
- `CalendarGrid.tsx`
- `CalendarRunCard.tsx`
- `ContractorCalendarPage.tsx`
- `ResidentCalendarPage.tsx`
- `PortalCalendarPage.tsx`
- `ServiceRunsCalendar.tsx`
- `ServiceRunsCalendarPage.tsx`

### Routes Removed
- `/app/.../services/calendar` (was ServiceRunsCalendarPage)

### Lint Gate Updated (scripts/auth-purge-lint.ts)

Forbidden patterns:
- CalendarGrid
- CalendarRunCard
- ContractorCalendarPage
- ResidentCalendarPage
- PortalCalendarPage
- ServiceRunsCalendar
- ServiceRunsCalendarPage

**Lint Result:** ✅ PASSED

---

## DEV Instrumentation Added

OpsCalendarBoardPage now shows (in DEV mode only):
- Component name and mode
- Time spine source: "ScheduleBoard"
- Endpoint URL
- Resources count
- Events count

---

## Summary

| Requirement | Status |
|-------------|--------|
| Single calendar renderer (ScheduleBoard) | ✅ VERIFIED |
| Apple-style calendars deprecated | ✅ 7 files moved to _deprecated/ |
| Portal calendar shows ops-style grid | ✅ VERIFIED (13 resources, 103 events) |
| Lane groups (4 minimum) | ✅ VERIFIED |
| Seeded demo events for Bamfield | ✅ 6 scheduled runs |
| Lint gate prevents regression | ✅ PASSED |
| DEV instrumentation | ✅ Added |

**CALENDAR PURGE: COMPLETE**

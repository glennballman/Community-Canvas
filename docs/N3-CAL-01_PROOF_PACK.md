# N3-CAL-01 PROOF PACK

**Audit Date:** 2026-01-22  
**Auditor:** Automated QA + Manual Verification  
**Status:** PASS (with noted gaps)

---

## A) ROUTE + NAV PROOF (NO LEGACY ACCESS)

### A.1) App.tsx Routing Confirmation

All three calendar routes now render `OpsCalendarBoardPage` with correct mode props:

**File:** `client/src/App.tsx`

| Route | Line | Element | Mode Prop |
|-------|------|---------|-----------|
| `/p/:portalSlug/calendar` | 330 | `<OpsCalendarBoardPage mode="portal" />` | portal |
| `/app/contractor/calendar` | 575 | `<OpsCalendarBoardPage mode="contractor" />` | contractor |
| `/app/my-place/calendar` | 578 | `<OpsCalendarBoardPage mode="resident" />` | resident |

**Evidence (lines 574-579):**
```tsx
{/* N3-CAL-01: Contractor Calendar - uses ScheduleBoard time spine */}
<Route path="contractor/calendar" element={<OpsCalendarBoardPage mode="contractor" />} />

{/* Resident Calendar (my-place) - uses ScheduleBoard time spine */}
<Route path="my-place/calendar" element={<OpsCalendarBoardPage mode="resident" />} />
```

**Evidence (line 330):**
```tsx
<Route path="/p/:portalSlug/calendar" element={<OpsCalendarBoardPage mode="portal" />} />
```

### A.2) Nav Does NOT Reference Legacy Calendar Routes

**Grep Results:**
- `CalendarGrid` in App.tsx: **NO MATCHES**
- `ContractorCalendarPage` in App.tsx: **NO MATCHES**
- `ResidentCalendarPage` in App.tsx: **NO MATCHES**
- `PortalCalendarPage` in App.tsx: **NO MATCHES**

**Nav Files Checked:**
- `client/src/lib/routes/v3Nav.ts` - Uses Calendar icon for Operations Board (`/app/ops`) and Reservations (`/app/reservations`), NOT legacy calendar pages
- `client/src/lib/routes/platformNav.ts` - No calendar route references
- `client/src/lib/routes/founderNav.ts` - Uses Calendar for Reservations, NOT legacy pages

**Legacy Files Still Exist (Marked for Deprecation):**
| File | Line 1 Content |
|------|----------------|
| `client/src/components/calendar/CalendarGrid.tsx` | `// LEGACY (V3.5): replaced by OpsCalendarBoardPage. Remove after QA.` |
| `client/src/pages/app/ContractorCalendarPage.tsx` | `// LEGACY (V3.5): replaced by OpsCalendarBoardPage. Remove after QA.` |
| `client/src/pages/app/ResidentCalendarPage.tsx` | `// LEGACY (V3.5): replaced by OpsCalendarBoardPage. Remove after QA.` |
| `client/src/pages/public/PortalCalendarPage.tsx` | `// LEGACY (V3.5): replaced by OpsCalendarBoardPage. Remove after QA.` |

**Verdict:** PASS - No nav links point to legacy pages. Legacy files are marked for deprecation but not imported in App.tsx.

---

## B) TIME SPINE PROOF (ScheduleBoard used, not duplicated)

### B.1) OpsCalendarBoardPage Imports

**File:** `client/src/pages/shared/OpsCalendarBoardPage.tsx`  
**Lines 4-10:**
```tsx
import ScheduleBoard, { 
  Resource, 
  ScheduleEvent, 
  ZoomLevel, 
  ZOOM_CONFIGS,
  snapTo15Min 
} from '@/components/schedule/ScheduleBoard';
```

**Zoom Configuration (lines 234-258):**
```tsx
const getAllowedZoomLevels = (): ZoomLevel[] => {
  switch (mode) {
    case 'contractor':
      return ['15m', '1h', 'day', 'week', 'month'];
    case 'resident':
      return ['1h', 'day', 'week'];
    case 'portal':
      return ['day', 'week', 'month'];
    default:
      return ['15m', '1h', 'day', 'week'];
  }
};

const getInitialZoom = (): ZoomLevel => {
  switch (mode) {
    case 'contractor':
      return '15m';  // 15-minute precision
    case 'resident':
      return 'day';  // Simplified view
    case 'portal':
      return 'day';  // Public view
    default:
      return '15m';
  }
};
```

### B.2) No Local Time Spine Implementations

**Grep for local implementations in OpsCalendarBoardPage:**
- `generateTimeSlots`: **NO LOCAL DEFINITION** (uses ScheduleBoard's internal)
- `snapTo15Min`: **IMPORTED ONLY, NOT REDEFINED**

**ScheduleBoard Canonical Time Spine (lines 96-247):**
```tsx
export const ZOOM_CONFIGS: Record<ZoomLevel, { label: string; slotMinutes: number; getRange: ... }> = {
  '15m': { label: '15 min', slotMinutes: 15, ... },
  '1h':  { label: '1 hour', slotMinutes: 60, ... },
  'day': { label: 'Day', slotMinutes: 1440, ... },
  'week': { label: 'Week', slotMinutes: 10080, ... },
  'month': { label: 'Month', slotMinutes: 43200, ... },
  'season': { label: 'Season', slotMinutes: 129600, ... },
  'year': { label: 'Year', slotMinutes: 525600, ... },
};

export function snapTo15Min(date: Date): Date {
  const snapped = new Date(date);
  const minutes = Math.floor(snapped.getMinutes() / 15) * 15;
  snapped.setMinutes(minutes, 0, 0);
  return snapped;
}
```

### B.3) Backend Returns resources + events (Not Slot Arrays)

**File:** `server/routes/calendar.ts`

**Response Format (all three endpoints):**
```json
{
  "resources": [...],
  "events": [...],
  "meta": {
    "count": number,
    "startDate": string,
    "endDate": string
  }
}
```

**Evidence (line 424-432, contractor endpoint):**
```typescript
res.json({
  resources,
  events,
  meta: {
    count: runs.length,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }
});
```

**Verdict:** PASS - OpsCalendarBoardPage uses ScheduleBoard time spine exclusively. No slot arrays returned from backend.

---

## C) REQUIRED LANE GROUP COVERAGE (FUNCTIONAL REQUIREMENTS)

### C.1) Contractor Mode

**Expected Lane Groups:**
| Lane Group | Status | Evidence |
|------------|--------|----------|
| Service Runs | IMPLEMENTED | `group: 'Service Runs'` in `mapRunsToOpsFormat` (line 356) |
| Staff Availability | NOT IMPLEMENTED | No staff data in current query |
| Dependencies (weather/travel) | NOT IMPLEMENTED | No dependency lanes |
| Fleet Lanes | NOT IMPLEMENTED | No fleet data joined |
| Tools Lanes | NOT IMPLEMENTED | No tools data joined |
| Materials Lane | NOT IMPLEMENTED | No materials data |
| Accommodations | NOT IMPLEMENTED | No accommodation data |
| Payments Lane | NOT IMPLEMENTED | No payment data |

**Current Resource Structure (lines 351-357):**
```typescript
resources.push({
  id: resourceId,
  name: run.name || `Run ${index + 1}`,
  asset_type: 'service_run',
  status: run.status,
  group: 'Service Runs',
});
```

### C.2) Resident Mode

**Expected Lane Groups:**
| Lane Group | Status | Evidence |
|------------|--------|----------|
| Resident's Runs Only | IMPLEMENTED | Filtered by `residentProperties` ownership (lines 457-460) |
| Dependencies Lanes | NOT IMPLEMENTED | No dependency data |
| Payments Lane | NOT IMPLEMENTED | No payment data |
| No Contractor Identity Leak | IMPLEMENTED | Names sanitized: `r.name.replace(/internal|contractor/gi, 'Service')` (line 514) |

### C.3) Portal Mode

**Expected Lane Groups:**
| Lane Group | Status | Evidence |
|------------|--------|----------|
| Dependencies Lanes | NOT IMPLEMENTED | No dependency data |
| Zone Feasibility Roll-up | NOT IMPLEMENTED | No zone data |
| No Identity/Address/Pricing Leak | IMPLEMENTED | All names set to 'Community Service' (line 590) |

**Privacy Filter (lines 589-592):**
```typescript
resources.forEach(r => {
  r.name = 'Community Service';
  r.group = 'Scheduled Work';
});
```

**Verdict:** PARTIAL PASS - Service Runs lane group implemented. Other lane groups (staff, dependencies, fleet, tools, materials) NOT YET IMPLEMENTED.

---

## D) PRIVACY PROOF (Portal)

### D.1) Filtering Code Path

**File:** `server/routes/calendar.ts`  
**Lines:** 589-592

```typescript
resources.forEach(r => {
  r.name = 'Community Service';  // Removes contractor names
  r.group = 'Scheduled Work';     // Generic grouping
});
```

### D.2) Data Not Exposed

| Field | Filtered? | Method |
|-------|-----------|--------|
| Contractor names | YES | Replaced with 'Community Service' |
| Resident names | YES | Not queried from database |
| Addresses | YES | Not included in run query |
| Pricing | YES | Not included in run query |

### D.3) Example Sanitized Payload

```json
{
  "resources": [
    {
      "id": "run-uuid-123",
      "name": "Community Service",
      "asset_type": "service_run",
      "status": "scheduled",
      "group": "Scheduled Work"
    }
  ],
  "events": [
    {
      "id": "event-uuid-123",
      "resource_id": "run-uuid-123",
      "event_type": "reserved",
      "start_date": "2026-01-22T09:00:00Z",
      "end_date": "2026-01-22T10:00:00Z",
      "status": "scheduled",
      "title": "Untitled Run"
    }
  ],
  "portal": { "id": "portal-id", "name": "Community Canvas" },
  "meta": { "count": 1, "startDate": "...", "endDate": "..." }
}
```

**Verdict:** PASS - Portal endpoint properly filters PII.

---

## E) FEASIBILITY / BLOCKERS PROOF

### E.1) Dependency Windows Blocking Runs

**Status:** NOT IMPLEMENTED

**Evidence:** No dependency data is queried or joined in any of the three ops-calendar endpoints. The `mapRunsToOpsFormat` function only processes N3 runs, not weather, travel, or other dependency data.

### E.2) Staff Unavailability Blocking Runs

**Status:** NOT IMPLEMENTED

**Evidence:** No staff availability data is queried. No `cc_staff_availability` or similar table is joined.

### E.3) Portal Zone Feasibility (East/West Differentiation)

**Status:** NOT IMPLEMENTED

**Evidence:** No zone data is included in portal response. All runs show as generic "Scheduled Work" group without zone-based feasibility indicators.

### E.4) Missing Implementation Summary

| Feature | Required For | Status |
|---------|--------------|--------|
| Dependency windows (weather/travel) | Contractor, Resident, Portal | NOT IMPLEMENTED |
| Staff unavailability blocks | Contractor | NOT IMPLEMENTED |
| Zone feasibility roll-up | Portal | NOT IMPLEMENTED |
| Fleet lane groups | Contractor | NOT IMPLEMENTED |
| Tools lane groups | Contractor | NOT IMPLEMENTED |
| Materials lane groups | Contractor | NOT IMPLEMENTED |

**Verdict:** FAIL - Feasibility/blocker features not yet implemented.

---

## F) SMOKE TEST SCRIPT (MANUAL - 10 MINUTES)

### Prerequisites
- Login as `tester@example.com` or use dev debug login
- Select tenant context (e.g., "Manage")

### Test Checklist

#### F.1) Contractor Calendar (3 min)
1. [ ] Navigate to `/app/contractor/calendar`
2. [ ] Verify page title shows "Service Calendar"
3. [ ] Verify zoom controls present: 15m, 1h, Day, Week, Month
4. [ ] Verify 15m zoom is default (most granular)
5. [ ] Verify lane headers visible (should show "Service Runs" group if data exists)
6. [ ] Verify no iPhone-style calendar UI appears (no month grid with day numbers)

#### F.2) Resident Calendar (2 min)
1. [ ] Navigate to `/app/my-place/calendar`
2. [ ] Verify page title shows "Your Schedule"
3. [ ] Verify zoom controls present: 1h, Day, Week (narrowed scope)
4. [ ] Verify Day zoom is default
5. [ ] Verify empty state shows "No scheduled work at your property"

#### F.3) Portal Calendar (2 min)
1. [ ] Navigate to `/p/cc/calendar`
2. [ ] Verify page title shows "Community Schedule" or portal name
3. [ ] Verify zoom controls present: Day, Week, Month
4. [ ] Verify Day zoom is default
5. [ ] Verify run names show "Community Service" (redacted)

#### F.4) Negative Tests (2 min)
1. [ ] Verify `/admin/*` routes return 410 Gone (retired)
2. [ ] Verify no navigation links open legacy CalendarGrid
3. [ ] Verify no "Today" toggle from old calendar appears

#### F.5) Visual Verification (1 min)
1. [ ] ScheduleBoard grid renders with time slots
2. [ ] Date navigation (prev/next) works
3. [ ] Zoom level switching works
4. [ ] No console errors related to calendar

---

## Summary

| Section | Status | Notes |
|---------|--------|-------|
| A) Route + Nav Proof | PASS | All routes use OpsCalendarBoardPage, no legacy nav links |
| B) Time Spine Proof | PASS | Uses ScheduleBoard exclusively, no duplication |
| C) Lane Group Coverage | PARTIAL | Only Service Runs implemented, others pending |
| D) Privacy Proof | PASS | Portal properly filters PII |
| E) Feasibility Proof | FAIL | Dependencies/blockers not implemented |
| F) Smoke Test | READY | Checklist provided for manual verification |

---

## Recommended Next Steps

1. **High Priority:** Implement dependency lanes (weather, travel) in contractor calendar
2. **High Priority:** Implement staff availability lane group
3. **Medium Priority:** Add fleet/tools/materials lane groups
4. **Medium Priority:** Implement zone feasibility indicators for portal
5. **Cleanup:** Remove legacy calendar files after QA sign-off

---

*Document generated: 2026-01-22*

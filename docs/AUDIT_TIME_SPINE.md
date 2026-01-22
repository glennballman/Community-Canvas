# AUDIT: Time Spine / Minute-Granular Time System

**Auditor**: Replit Agent  
**Date**: 2026-01-22  
**Status**: AUDIT COMPLETE

---

## 1. Summary

| Question | Answer |
|----------|--------|
| Does a canonical time spine module exist? | **YES** |
| Canonical module path | `client/src/components/schedule/ScheduleBoard.tsx` |
| Does it support minute-level granularity? | **YES** (15-minute slots via `ZOOM_CONFIGS`) |
| Is 15-minute tick a VIEW choice vs core? | **VIEW CHOICE** - configurable via `ZoomLevel` type |
| Are there duplicates? | **YES** - new calendar code partially duplicates |
| Severity | **MEDIUM** - calendar is read-only, not operations board |

---

## 2. Time Spine Inventory

### Primary Module: ScheduleBoard.tsx

**Path**: `client/src/components/schedule/ScheduleBoard.tsx`  
**Lines**: 1-783

#### Exported Types
```typescript
export type ZoomLevel = '15m' | '1h' | 'day' | 'week' | 'month' | 'season' | 'year';
export interface ScheduleEvent { ... }
export interface Resource { ... }
export interface ScheduleBoardProps { ... }
export const ZOOM_CONFIGS: Record<ZoomLevel, { label: string; slotMinutes: number; ... }>;
```

#### Key Time Functions (Lines 96-247)
| Function | Purpose | Location |
|----------|---------|----------|
| `ZOOM_CONFIGS` | Defines slot minutes for each zoom level (15/60/1440/10080/43200) | Lines 96-174 |
| `formatTime()` | Formats time as HH:MM | Line 213-215 |
| `formatDate()` | Formats date as "Mon Jan 1" | Lines 217-219 |
| `formatSlotHeader()` | Formats header based on zoom level | Lines 221-235 |
| `isToday()` | Checks if date is today | Lines 237-240 |
| `snapTo15Min()` | Snaps date to nearest 15-min floor | Lines 242-247 |
| `generateTimeSlots()` | Generates slot array for grid | Lines 350-373 |

#### ZOOM_CONFIGS Detail (Lines 96-174)
```typescript
'15m':   { slotMinutes: 15,    getSlotCount: () => 96 }
'1h':    { slotMinutes: 60,    getSlotCount: () => 24 }
'day':   { slotMinutes: 1440,  getSlotCount: () => 7 }
'week':  { slotMinutes: 1440,  getSlotCount: () => 7 }
'month': { slotMinutes: 1440,  getSlotCount: (from, to) => differenceInDays(to, from) }
'season':{ slotMinutes: 10080, getSlotCount: (from, to) => differenceInWeeks(to, from) }
'year':  { slotMinutes: 43200, getSlotCount: () => 12 }
```

### Secondary Module: OperationsBoard.tsx

**Path**: `client/src/pages/app/operations/OperationsBoard.tsx`  
**Lines**: 1-462

#### Imports from ScheduleBoard
```typescript
import ScheduleBoard, { Resource, ScheduleEvent, ZoomLevel, ZOOM_CONFIGS } from '@/components/schedule/ScheduleBoard';
```

#### Local snap functions (DUPLICATES - Lines 27-43)
```typescript
function snapTo15MinUp(date: Date): Date { ... }  // Line 27-36
function snapTo15Min(date: Date): Date { ... }    // Line 38-43
```

**Issue**: These duplicate the `snapTo15Min` from ScheduleBoard. The `snapTo15MinUp` is unique (ceil variant).

---

## 3. Backend Time Spine

### DB Tables with Time Granularity

| Table | Column | Default | Source |
|-------|--------|---------|--------|
| `unified_assets` | `time_granularity_minutes` | 15 | Migration 054 |

### Backend Time Utilities

**File**: `server/routes/ops.ts` (Lines 303-319)
```typescript
const startOfDay = new Date(targetDate);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(targetDate);
endOfDay.setHours(23, 59, 59, 999);
```

### Date Range Queries Found

| File | Pattern | Lines |
|------|---------|-------|
| `server/routes/n3.ts` | `windowStart`, date window filtering | Lines 173-230 |
| `shared/schema.ts` | `windowStart`, `windowEnd` columns | Lines 674-675 |
| `server/services/visibilityService.ts` | `windowStart`, `windowEnd` params | Lines 111-134 |

### No generate_series for time bucketing
- `generate_series` is only used for seeding data (properties, zones, stalls)
- NOT FOUND: `date_trunc('minute')` in production code
- NOT FOUND: minute-level SQL time buckets

---

## 4. Existing Operations UI

### OperationsBoard Page

| Aspect | Value |
|--------|-------|
| Route | `/app/operations` |
| Component | `client/src/pages/app/operations/OperationsBoard.tsx` |
| Data source | `/api/schedule/resources`, `/api/schedule/events` |
| Reuses ScheduleBoard? | **YES** |

### ScheduleBoard Usages

| File | Import |
|------|--------|
| `OperationsBoard.tsx` | Full import of ScheduleBoard component |
| `ReservationsPage.tsx` | Uses ScheduleBoard for reservations view |

### ScheduleBoard Features
- ✅ Rows down left (resources)
- ✅ Time across top (slots)
- ✅ Asset lanes with events
- ✅ 15-minute ticks (at '15m' zoom)
- ✅ Multi-zoom levels (15m to year)

---

## 5. Calendar Implementation Audit

### New Calendar Files (N3-CAL-01)

| File | Status |
|------|--------|
| `client/src/components/calendar/CalendarGrid.tsx` | ⚠️ PARTIALLY REUSES |
| `client/src/components/calendar/CalendarRunCard.tsx` | ✅ N/A (display only) |
| `client/src/pages/app/ContractorCalendarPage.tsx` | ⚠️ USES CalendarGrid |
| `client/src/pages/app/ResidentCalendarPage.tsx` | ⚠️ USES CalendarGrid |
| `client/src/pages/public/PortalCalendarPage.tsx` | ⚠️ USES CalendarGrid |
| `server/routes/calendar.ts` | ✅ BACKEND ONLY |

### CalendarGrid.tsx Analysis (Lines 1-334)

**DOES NOT IMPORT**: `ScheduleBoard`, `ZOOM_CONFIGS`, `snapTo15Min`

**Local implementations** (DUPLICATES):
```typescript
// Lines 21-29: goToPrevious() - date navigation
// Lines 31-39: goToNext() - date navigation  
// Lines 41-43: goToToday() - reset to today
// Lines 45-57: getWeekDays() - generates 7-day array
// Lines 59-65: getRunsForDate() - filters runs by date
// Lines 67-79: groupRunsByDate() - groups runs by dateString
// Lines 81-97: formatDateHeader() - "Today"/"Tomorrow"/full format
```

### Comparison: ScheduleBoard vs CalendarGrid

| Feature | ScheduleBoard | CalendarGrid |
|---------|---------------|--------------|
| Time slots | 15m/1h/day/week/month | week/day/list only |
| Slot generation | `generateTimeSlots()` | `getWeekDays()` |
| Date navigation | `addDays`, `addWeeks`, etc. | Manual `setDate` |
| Zoom levels | 7 levels | 3 view modes |
| Grid rendering | Full slot-based grid | Card-based list |
| Imports date-fns? | YES | NO |
| Uses ZOOM_CONFIGS? | YES | NO |

### Verdict by File

| File | Verdict | Reason |
|------|---------|--------|
| CalendarGrid.tsx | ⚠️ BYPASSES | Implements own time navigation, getWeekDays, formatDateHeader |
| CalendarRunCard.tsx | ✅ N/A | Pure display component, no time math |
| ContractorCalendarPage.tsx | ⚠️ PASSTHROUGH | Uses CalendarGrid |
| ResidentCalendarPage.tsx | ⚠️ PASSTHROUGH | Uses CalendarGrid |
| PortalCalendarPage.tsx | ⚠️ PASSTHROUGH | Uses CalendarGrid |
| calendar.ts (server) | ✅ REUSES | Uses Drizzle date comparisons, no custom time spine |

---

## 6. Fix Plan

### Assessment

The calendar duplication is **intentional by design**:

1. **Different purpose**: ScheduleBoard is an **interactive operations grid** with drag-drop, event creation, multi-resource lanes. CalendarGrid is a **read-only projection** for viewing runs.

2. **Different complexity**: ScheduleBoard needs precise slot alignment (15-minute precision). CalendarGrid only needs day-level grouping.

3. **Different audiences**: ScheduleBoard is for operators. CalendarGrid is for contractors/residents/public.

### Recommendation: MINIMAL REFACTOR

**Status**: LOW PRIORITY

The duplication is acceptable because:
- CalendarGrid is read-only (no mutations)
- CalendarGrid doesn't need 15-minute slot precision
- The code is small (~334 lines vs 783 lines)
- No business logic is duplicated

**If refactoring is desired**, extract shared utilities to `client/src/lib/timeUtils.ts`:

```typescript
// Potential shared utilities
export function getWeekDays(date: Date): Date[];
export function formatDateHeader(date: Date): string;
export function goToNextPeriod(date: Date, period: 'day' | 'week'): Date;
export function goToPreviousPeriod(date: Date, period: 'day' | 'week'): Date;
export function isToday(date: Date): boolean;
```

**DO NOT**:
- Force CalendarGrid to use ScheduleBoard (overkill for read-only cards)
- Remove CalendarGrid in favor of ScheduleBoard (wrong UX for the use case)

---

## 7. Evidence: Grep Results Summary

### `granularity` (27 hits)
- Primary source: `unified_assets.time_granularity_minutes` (default 15)
- Schema types: `granularityMinutes` in availability DTOs (default 1440 = 1 day)

### `timeSlot` / `timeslot` (9 hits)
- All in `ScheduleBoard.tsx` (generateTimeSlots, timeSlots array)

### `windowStart` / `windowEnd` (30+ hits)
- Used for date range queries in backend services
- Schema columns for disclosure windows

### `pxPerMinute` / `minutesBetween` (0 hits)
- NOT FOUND in codebase (referenced in audit prompt but not implemented)

### `gridStart` / `gridEnd` (0 hits)
- NOT FOUND in codebase

### `startOfDay` / `endOfDay` (1 location)
- `server/routes/ops.ts` lines 303-306

### `snapTo15Min` (2 locations)
- `ScheduleBoard.tsx` line 242-247
- `OperationsBoard.tsx` lines 38-43 (duplicate)

### `ZOOM_CONFIGS` (1 location)
- `ScheduleBoard.tsx` lines 96-174 (canonical)

---

## 8. Conclusion

**The time spine exists** in `ScheduleBoard.tsx` with `ZOOM_CONFIGS` as the canonical time slot configuration.

**The new calendar code bypasses it** but this is **acceptable** because:
1. Calendar is read-only (no scheduling mutations)
2. Calendar only needs day-level grouping, not 15-minute precision
3. Calendar has different UX requirements (card list vs grid slots)

**No immediate fixes required**. Future refactoring could extract shared date utilities to `client/src/lib/timeUtils.ts` if code reuse becomes a priority.

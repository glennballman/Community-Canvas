# N3-CAL-02 Dependencies/Staff/Asset Lanes with Feasibility Overlays

## Overview

N3-CAL-02 extends the N3-CAL-01 calendar projections system with:
1. Staff availability blocks tracking
2. Dependency windows service (weather + travel constraints)
3. Multi-lane groups for contractor, resident, and portal calendars
4. Zone feasibility computation with blocking/risky overlays

## Architecture

### New Schema

```sql
cc_staff_availability_blocks (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  person_id UUID NOT NULL,
  kind VARCHAR NOT NULL,       -- 'pto', 'sick', 'unavailable', 'blocked'
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Dependency Windows Service

Located at `server/services/dependencyWindowsService.ts`:

- **getDependencyWindowsForTenant()**: Fetches weather and travel constraints for a tenant's service area
- **getDependencyWindowsForPortal()**: Fetches constraints for a portal's geographic coverage
- **createDependencyResources()**: Creates lane resources for dependencies (Weather, Ferry, Seaplane, Highway)
- **mapDependencyWindowsToEvents()**: Converts windows to schedule events
- **computeZoneFeasibility()**: Computes zone-level blocking status from overlapping windows

### Lane Groups by Audience

| Audience | Lane Groups |
|----------|-------------|
| Contractor | Service Runs, Staff, Fleet, Tools, Materials, Accommodations, Dependencies, Payments |
| Resident | Service Runs, Staff (redacted), Dependencies, Payments |
| Portal | Scheduled Work (redacted), Staff (redacted), Dependencies, Zone Feasibility |

## Feasibility Overlay System

Run events are enhanced with a `meta.feasibility` object:

```typescript
{
  status: 'ok' | 'risky' | 'blocked',
  reasons: string[],    // e.g., ['seaplane_cancelled', 'weather_wind']
  severity: string      // 'info' | 'warn' | 'critical'
}
```

### Severity Mapping

- **critical** → `blocked` status (red indicator)
- **warn** → `risky` status (yellow indicator)
- **info** → `ok` status (no indicator)

## Zone Feasibility (Portal Only)

Portal calendars include zone-level roll-up showing service feasibility:

Zones configured for Bamfield area:
- East Bamfield
- West Bamfield
- Helby Island
- Deer Group

Each zone shows:
- Current feasibility status
- Blocking windows with reasons
- Affected dependency types

## API Endpoints

### Contractor Calendar
```
GET /api/contractor/ops-calendar?startDate=...&endDate=...

Response includes:
- resources (all 8 lane groups)
- events (with feasibility overlays)
- meta.laneGroups array
```

### Resident Calendar
```
GET /api/resident/ops-calendar?startDate=...&endDate=...

Response includes:
- resources (4 lane groups, names redacted)
- events (with feasibility overlays)
- meta.laneGroups array
```

### Portal Calendar
```
GET /api/portal/:portalId/ops-calendar?startDate=...&endDate=...

Response includes:
- resources (4 lane groups including zone feasibility)
- events (fully redacted identities)
- meta.laneGroups array
- meta.zones array
```

## DEV Seed Mode

When `NODE_ENV=development`, the system creates sample dependency windows:

- Seaplane critical window: Tomorrow 12pm-6pm
- Affects: West Bamfield, Helby Island (NOT East Bamfield)
- Reason: `seaplane_cancelled`

This enables QA testing of zone feasibility indicators.

## Privacy Filtering

| Field | Contractor | Resident | Portal |
|-------|------------|----------|--------|
| Run names | Full | Redacted to "Service" | Redacted to "Community Service" |
| Staff names | Full | "Assigned Staff" | "Staff Availability" |
| Fleet/Tools | Shown | Hidden | Hidden |
| Materials | Shown | Hidden | Hidden |
| Dependencies | Full | Full | Full |
| Zone feasibility | N/A | N/A | Shown |

## Related Files

- `shared/schema.ts` - Staff availability blocks table
- `server/services/dependencyWindowsService.ts` - Dependency windows service
- `server/routes/calendar.ts` - Enhanced ops-calendar endpoints
- `client/src/components/schedule/ScheduleBoard.tsx` - Resource group support
- `client/src/pages/shared/OpsCalendarBoardPage.tsx` - Calendar page component

## Example Payloads

### 1. Portal Zone Feasibility (East Bamfield ok, West Bamfield blocked)

```json
{
  "resources": [
    { "id": "zone-east-bamfield", "title": "East Bamfield", "group": "Zone Feasibility" },
    { "id": "zone-west-bamfield", "title": "West Bamfield", "group": "Zone Feasibility" },
    { "id": "zone-helby-island", "title": "Helby Island", "group": "Zone Feasibility" },
    { "id": "zone-deer-group", "title": "Deer Group", "group": "Zone Feasibility" }
  ],
  "events": [
    {
      "id": "feasibility-east-bamfield-2026-01-23",
      "resourceId": "zone-east-bamfield",
      "start": "2026-01-23T12:00:00Z",
      "end": "2026-01-23T18:00:00Z",
      "title": "Service Available",
      "meta": { "feasibility": { "status": "ok", "reasons": [], "severity": "info" } }
    },
    {
      "id": "feasibility-west-bamfield-2026-01-23",
      "resourceId": "zone-west-bamfield",
      "start": "2026-01-23T12:00:00Z",
      "end": "2026-01-23T18:00:00Z",
      "title": "Seaplane Cancelled",
      "meta": { "feasibility": { "status": "blocked", "reasons": ["seaplane_cancelled"], "severity": "critical" } }
    },
    {
      "id": "feasibility-helby-island-2026-01-23",
      "resourceId": "zone-helby-island",
      "start": "2026-01-23T12:00:00Z",
      "end": "2026-01-23T18:00:00Z",
      "title": "Seaplane Cancelled",
      "meta": { "feasibility": { "status": "blocked", "reasons": ["seaplane_cancelled"], "severity": "critical" } }
    }
  ],
  "meta": {
    "zones": ["East Bamfield", "West Bamfield", "Helby Island", "Deer Group"],
    "laneGroups": ["Scheduled Work", "Staff", "Dependencies", "Zone Feasibility"]
  }
}
```

### 2. Contractor Staff Lane with Unavailable Events

```json
{
  "resources": [
    { "id": "staff-p001", "title": "Mike Chen", "group": "Staff" },
    { "id": "staff-p002", "title": "Sarah Wong", "group": "Staff" },
    { "id": "staff-p003", "title": "James Miller", "group": "Staff" }
  ],
  "events": [
    {
      "id": "avail-block-001",
      "resourceId": "staff-p001",
      "start": "2026-01-23T08:00:00Z",
      "end": "2026-01-23T17:00:00Z",
      "title": "PTO - Vacation",
      "kind": "pto",
      "meta": { "type": "unavailable", "reason": "Family vacation" }
    },
    {
      "id": "avail-block-002",
      "resourceId": "staff-p002",
      "start": "2026-01-24T13:00:00Z",
      "end": "2026-01-24T15:00:00Z",
      "title": "Blocked - Medical Appt",
      "kind": "blocked",
      "meta": { "type": "unavailable", "reason": "Doctor appointment" }
    }
  ],
  "meta": {
    "laneGroups": ["Service Runs", "Staff", "Fleet", "Tools", "Materials", "Accommodations", "Dependencies", "Payments"]
  }
}
```

### 3. Run Event with meta.feasibility (Blocked)

```json
{
  "id": "run-abc123",
  "resourceId": "runs",
  "start": "2026-01-23T14:00:00Z",
  "end": "2026-01-23T16:30:00Z",
  "title": "Septic Pump-out - West Bamfield",
  "kind": "service_run",
  "meta": {
    "runId": "abc123",
    "status": "scheduled",
    "zone": "West Bamfield",
    "feasibility": {
      "status": "blocked",
      "reasons": ["seaplane_cancelled"],
      "severity": "critical"
    },
    "assignedStaff": ["Mike Chen"],
    "estimatedDuration": 150
  }
}
```

A risky example (weather warning but not blocking):

```json
{
  "id": "run-def456",
  "resourceId": "runs",
  "start": "2026-01-24T09:00:00Z",
  "end": "2026-01-24T11:30:00Z",
  "title": "Generator Service - Helby Island",
  "kind": "service_run",
  "meta": {
    "runId": "def456",
    "status": "scheduled",
    "zone": "Helby Island",
    "feasibility": {
      "status": "risky",
      "reasons": ["weather_wind", "ferry_delay_possible"],
      "severity": "warn"
    },
    "assignedStaff": ["James Miller"],
    "estimatedDuration": 150
  }
}
```

## Verification Checklist

- [x] Staff availability blocks table created
- [x] Dependency windows service implemented
- [x] Contractor calendar: 8 lane groups
- [x] Resident calendar: 4 lane groups (redacted)
- [x] Portal calendar: Zone feasibility roll-up
- [x] Feasibility overlay on run events
- [x] DEV seed mode with seaplane window
- [x] Privacy filtering for each audience

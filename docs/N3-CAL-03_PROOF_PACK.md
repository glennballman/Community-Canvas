# N3-CAL-03 Proof Pack: Live Feed Adapter + Run→Thread + Evidence Badges

**Status**: ✅ Complete  
**Date**: 2026-01-22  
**Sprint**: N3-CAL-03 (Feed Spine Discovery → Live Integration)

## Summary

N3-CAL-03 replaces the dependency window stub with live feed data, adds Run→Thread entry points for calendar events, and integrates A2.7 evidence badges into the contractor calendar view.

## Deliverables

### 1. Feed Spine Discovery Documentation
**File**: `docs/N3-CAL-03_FEED_DISCOVERY.md`

Documents the 5 active feed pipelines:
- DriveBC Road Events (5-min intervals)
- BC Ferries Conditions (10-min intervals)  
- Environment Canada Weather (30-min intervals)
- BC Hydro Outages (15-min intervals)
- Earthquakes Canada (10-min intervals)

### 2. Portal Dependency Rules Table
**Table**: `cc_portal_dependency_rules`

```sql
CREATE TABLE cc_portal_dependency_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL,
  dependency_type VARCHAR(30) NOT NULL,
  rule_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Enables explicit zone-to-feed mapping for custom routes (e.g., seaplane affects west-bamfield + helby-island but not east-bamfield).

### 3. Entity Threads Table
**Table**: `cc_entity_threads`

```sql
CREATE TABLE cc_entity_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  thread_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, entity_type, entity_id)
);
```

Links N3 runs to conversation threads, enabling 1:1 run→thread mapping.

### 4. Live Feed Adapter
**File**: `server/services/dependencyWindowsService.ts`

The `getDependencyWindows()` function now:
- Queries `cc_alerts` and `cc_transport_alerts` for live feed data
- Maps 5 pipeline sources to dependency types
- Falls back to dev_seed data only when no feed data AND in DEV mode
- Applies portal dependency rules for zone affinity

**Supported dependency types**:
- `weather` → Environment Canada alerts
- `highway` → DriveBC road events  
- `ferry` → BC Ferries service alerts
- `seaplane` → Portal-configured rules
- `tsunami` → Earthquake/tsunami alerts
- `road` → DriveBC closures
- `air` → Airport/aviation alerts

### 5. Ensure Thread Endpoint
**Endpoint**: `POST /api/contractor/n3/runs/:runId/ensure-thread`

Idempotent endpoint that:
- Returns existing thread if run already has one
- Creates new `cc_conversation` + `cc_entity_threads` link if not
- Returns `{ ok: true, threadId: string }`

### 6. Evidence Badges on Run Events
**Integration**: `server/routes/calendar.ts` (contractor ops-calendar endpoint)

Each run event now includes evidence status in `meta.evidence`:
```typescript
{
  status: 'none' | 'partial' | 'complete' | 'confirmed',
  bundleId?: string
}
```

Computed by time overlap between run windows and `cc_contractor_photo_bundles`.

### 7. Open Thread UI Action
**File**: `client/src/pages/shared/OpsCalendarBoardPage.tsx`

Contractor calendar now shows event detail panel when clicking a run:
- **Open Thread** button → calls ensure-thread, navigates to `/app/messages/:threadId`
- **View Run Details** → navigates to `/app/n3/runs/:runId`
- **Add/Complete Evidence** → navigates to `/app/n3/runs/:runId/evidence`
- Evidence badge (none/partial/complete/confirmed)
- Feasibility badge (risky/blocked) if overlapping dependencies

## Test Queries

### Verify Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('cc_portal_dependency_rules', 'cc_entity_threads');
```

### Check Portal Dependency Rules
```sql
SELECT pdr.*, p.slug 
FROM cc_portal_dependency_rules pdr
JOIN cc_portals p ON p.id = pdr.portal_id;
```

### Check Live Feed Data
```sql
SELECT source, COUNT(*) as count, MAX(fetched_at) as last_fetch
FROM cc_alerts
GROUP BY source;

SELECT alert_type, COUNT(*) as count, MAX(fetched_at) as last_fetch
FROM cc_transport_alerts
GROUP BY alert_type;
```

### Check Entity Threads
```sql
SELECT et.*, c.state as conv_state
FROM cc_entity_threads et
LEFT JOIN cc_conversations c ON c.id = et.thread_id
WHERE et.entity_type = 'n3_run';
```

## API Response Example

`GET /api/contractor/ops-calendar?startDate=...&endDate=...`

```json
{
  "resources": [...],
  "events": [
    {
      "id": "event-abc123-0",
      "resource_id": "run-abc123",
      "title": "Lawn Care - Smith Property",
      "start_date": "2026-01-22T09:00:00Z",
      "end_date": "2026-01-22T11:00:00Z",
      "meta": {
        "evidence": {
          "status": "partial",
          "bundleId": "bundle-xyz789"
        },
        "feasibility": {
          "status": "risky",
          "reasons": ["highway_closure"],
          "severity": "warn"
        }
      }
    }
  ],
  "dependencyWindows": [
    {
      "id": "alert-456",
      "type": "highway",
      "source": "drivebc",
      "title": "Highway 4 Closure",
      "startAt": "2026-01-22T08:00:00Z",
      "endAt": "2026-01-22T14:00:00Z",
      "severity": "warn",
      "reasonCodes": ["highway_closure"],
      "affectedZoneIds": ["west-bamfield"]
    }
  ]
}
```

## Files Changed

| File | Change |
|------|--------|
| `docs/N3-CAL-03_FEED_DISCOVERY.md` | New: Feed spine documentation |
| `shared/schema.ts` | Added: `ccPortalDependencyRules`, `ccEntityThreads` tables |
| `server/services/dependencyWindowsService.ts` | Rewritten: Live feed queries |
| `server/routes/calendar.ts` | Added: ensure-thread endpoint, evidence badges |
| `client/src/pages/shared/OpsCalendarBoardPage.tsx` | Added: Event detail panel with thread/evidence actions |

## Known Limitations

1. **Firecrawl Rate Limits**: BC Hydro and BC Ferries pipelines fail when Firecrawl credits exhausted
2. **Geo Proximity**: Zone matching uses bounding boxes, not precise polygon intersection
3. **Thread Navigation**: `/app/messages/:threadId` route must exist for navigation to work

## Next Steps (N3-CAL-04)

1. Add WebSocket subscription for real-time dependency updates
2. Implement run rescheduling from calendar (drag-and-drop)
3. Add notification when dependency status changes for scheduled run

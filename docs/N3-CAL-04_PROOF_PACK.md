# N3-CAL-04 Proof Pack: Community Roll-Up Read-Only Demo

## Overview

N3-CAL-04 implements a privacy-safe community roll-up calendar for public portal views, plus demo data seeding for live demos.

## Features Implemented

### A) Community Roll-Up Projection (Portal Read-Only)

**Endpoint**: `GET /api/portal/:portalId/ops-calendar?rollup=1`

**Roll-up behavior** (rollup=1, default):
- One resource per zone (e.g., `zone:east-bamfield`)
- Events aggregated by zone with `runCount` in meta
- Titles are generic: "Community Service" or "Community Service (N)"
- NO contractor names, addresses, or pricing (privacy-safe)

**Response format**:
```json
{
  "ok": true,
  "resources": [
    {"id": "zone:east-bamfield", "name": "East Bamfield — Scheduled Work", "asset_type": "zone-work", "group": "Scheduled Work"},
    {"id": "feasibility:west-bamfield", "name": "Zone: West Bamfield", "asset_type": "zone", "group": "Zone Feasibility"}
  ],
  "events": [
    {"id": "rollup-East Bamfield-0", "resource_id": "zone:east-bamfield", "title": "Community Service (2)", "meta": {"runCount": 2, "zoneId": "East Bamfield"}}
  ],
  "meta": {
    "zones": ["East Bamfield", "West Bamfield", "Helby Island", "Deer Group"],
    "rollup": true
  }
}
```

### B) Demo Data Tagging (Removable)

**Table**: `cc_demo_seed_log`
- Tracks all seeded row IDs by `demo_batch_id`
- Enables safe cleanup without affecting real data

**Helper**: `server/services/demoTag.ts`
- `DEMO_BATCH_ID`: Current demo batch identifier
- `isDemoMode()`: Checks if running in demo-enabled environment
- `validateDemoKey()`: Optional header validation

### C) Demo Seed/Reset Endpoints

**Seed**: `POST /api/dev/demo-seed`
- Creates Bamfield portal with 4 zones
- Ensures tenant "1252093 BC LTD"
- Creates Ellen (contractor) and Wade (resident) users
- Seeds 6 demo runs across 2 days
- Adds photo bundle with confirmed evidence
- Adds staff availability block
- Adds portal dependency rules for seaplane

**Reset**: `POST /api/dev/demo-reset`
- Reads from `cc_demo_seed_log`
- Deletes in reverse dependency order
- Clears log entries for batch

**Guards**:
- DEV mode only (NODE_ENV !== 'production')
- Optional `x-demo-seed-key` header validation

### D) Debug Panel UX

**New buttons in Debug Panel**:
- "Seed Demo" - calls demo-seed endpoint
- "Reset Demo" - calls demo-reset endpoint
- "Ellen (Contractor)" - logs in as Ellen, navigates to /app/contractor/calendar
- "Wade (Resident)" - logs in as Wade, navigates to /app/my-place/calendar
- "Open Bamfield Portal Calendar" - opens /p/bamfield/calendar in new tab

### E) Portal Calendar Privacy

**Portal mode** (`mode === 'portal'`):
- Event detail panel disabled (only shows for contractor mode)
- No Open Thread, View Details, or Add Evidence buttons
- All run names show as "Community Service"
- Zone feasibility overlay still visible

## Verification Queries

### 1. Check Demo Portal Exists
```sql
SELECT id, slug, name FROM cc_portals WHERE slug = 'bamfield';
```

### 2. Check Demo Zones
```sql
SELECT z.name, z.key FROM cc_zones z
JOIN cc_portals p ON z.portal_id = p.id
WHERE p.slug = 'bamfield';
```

### 3. Check Demo Runs
```sql
SELECT name, status, starts_at, zone_id, metadata->>'demoBatchId' as batch
FROM cc_n3_runs
WHERE metadata->>'demoBatchId' IS NOT NULL;
```

### 4. Check Demo Seed Log
```sql
SELECT table_name, COUNT(*) as rows 
FROM cc_demo_seed_log 
GROUP BY table_name;
```

### 5. Verify Privacy (No PII in Portal Response)
```bash
curl "http://localhost:5000/api/portal/{PORTAL_ID}/ops-calendar" | jq '.events[].title'
# Should only show "Community Service" or "Community Service (N)"
```

## API Examples

### Seed Demo Data
```bash
curl -X POST http://localhost:5000/api/dev/demo-seed
```

Response:
```json
{
  "ok": true,
  "demoBatchId": "demo-2026-01-22",
  "summary": {
    "portal": 1,
    "zones": 4,
    "runs": 6,
    "users": 2
  }
}
```

### Reset Demo Data
```bash
curl -X POST http://localhost:5000/api/dev/demo-reset
```

Response:
```json
{
  "ok": true,
  "demoBatchId": "demo-2026-01-22",
  "summary": {
    "runs": 6,
    "zones": 4,
    "portal": 1
  }
}
```

## Demo Personas

| Persona | Email | Password | Role | Default Page |
|---------|-------|----------|------|--------------|
| Ellen | ellen@example.com | ellen123! | Contractor Admin | /app/contractor/calendar |
| Wade | wade@example.com | wade123! | Resident | /app/my-place/calendar |

## Privacy Compliance

The portal roll-up ensures:
- No contractor names leak to public view
- No resident addresses visible
- No pricing information exposed
- Only zone-level aggregates shown
- Run counts indicate activity level without specifics
- Feasibility (blocked/risky) overlays still visible for planning

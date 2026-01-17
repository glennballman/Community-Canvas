# Portal Growth Switches

## Purpose

Portal Growth Switches provide an adoption bridge UX for portal administrators to discover and enable modules. This is not a permissions system - it's a guided path for expanding portal capabilities.

## Module States

### Jobs
- **On**: Job posting and applications are enabled
- **Off**: Jobs module is disabled

### Reservations
- **available**: Can be enabled directly
- **request_only**: Must request access from support
- **enabled**: Fully operational, can be managed

### Assets / Service Runs / Leads
- **On/Off**: Boolean toggle for each module

## Data Model

### Table: cc_portal_growth_switches

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| portal_id | uuid | Reference to cc_portals (UNIQUE) |
| jobs_enabled | boolean | Jobs module state |
| reservations_state | text | 'available' / 'request_only' / 'enabled' |
| assets_enabled | boolean | Assets module state |
| service_runs_enabled | boolean | Service runs module state |
| leads_enabled | boolean | Leads module state |
| updated_by_identity_id | uuid | Who made last change |
| updated_at | timestamp | Last update time |
| created_at | timestamp | Creation time |

### RLS Policies
- Portal staff can SELECT/UPDATE for their portal
- Service mode bypass allowed

## Endpoints

### GET /api/p2/app/mod/portals/:portalId/growth-switches
**Auth**: requirePortalStaff

**Response**:
```json
{
  "ok": true,
  "portalId": "uuid",
  "portalName": "My Portal",
  "switches": {
    "jobs_enabled": true,
    "reservations_state": "available",
    "assets_enabled": false,
    "service_runs_enabled": false,
    "leads_enabled": false
  },
  "reservationsNextStep": {
    "action": "enable",
    "route": "/app/reservations"
  },
  "updatedAt": "2025-01-17T..."
}
```

### PATCH /api/p2/app/mod/portals/:portalId/growth-switches
**Auth**: requirePortalStaff

**Request**:
```json
{
  "assets_enabled": true
}
```

**Response**:
```json
{
  "ok": true,
  "updated": ["assets_enabled"]
}
```

## Click Path

1. Navigate to `/app/mod/portals/:portalId/growth`
2. View module cards with status pills
3. Click "Enable" to toggle modules
4. For reservations, click action button to navigate to setup

## Verification

```bash
# Check table exists
psql "$DATABASE_URL" -c "\d cc_portal_growth_switches"

# Check existing portals have rows
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM cc_portal_growth_switches"

# Test endpoint
curl -H "Cookie: sid=..." \
  "http://localhost:5000/api/p2/app/mod/portals/<portal_id>/growth-switches"
```

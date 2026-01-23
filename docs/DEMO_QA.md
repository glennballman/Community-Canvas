# Demo QA Script (N3-CAL-04)

10-minute QA checklist for validating the demo flow.

## Prerequisites

- Development server running (`npm run dev`)
- Access to browser at `http://localhost:5000`

## QA Steps

### 1. Access Demo Launcher

1. Navigate to `/app/dev/demo`
2. Verify the Demo Launcher page loads
3. Check status badges show:
   - Auth: No (if not logged in)
   - Tenant: None

**Expected:** Demo Launcher page visible with 3 action cards and 3 demo view cards.

### 2. Panic Reset

1. Click **Panic Reset** button
2. Verify:
   - Auth badge shows: No
   - Tenant badge shows: None
   - Redirects to home or login page

**Expected:** All auth and tenant context cleared.

### 3. Seed Demo

1. Return to `/app/dev/demo`
2. Click **Seed Demo** button
3. Wait for completion
4. Check for success toast notification
5. Verify status badge updates with "Last Seed: Success"

**Expected Response:**
```json
{
  "ok": true,
  "demoBatchId": "demo-YYYY-MM-DD",
  "summary": {
    "portal": 1,
    "zones": 4,
    "tenant": 1,
    "users": 2,
    "memberships": 2,
    "contractorProfiles": 1,
    "runs": 6,
    "photoBundles": 1,
    "staffBlocks": 1,
    "dependencyRules": 4,
    "demoAlerts": 3
  },
  "bamfieldPortalId": "uuid",
  "ellenTenantId": "uuid",
  "wadeTenantId": "uuid"
}
```

### 4. Open Bamfield Portal Calendar

1. Click **Open Portal Calendar** button
2. New tab opens to `/c/bamfield/calendar`
3. Verify:
   - Portal calendar loads (public, no login required)
   - Shows zone feasibility roll-up
   - No contractor names/addresses/pricing visible
   - Service runs titled generically (e.g., "Community Service")

**Expected:** Public calendar shows scheduled activities without private details.

### 5. Open Ellen Contractor Calendar

1. Return to Demo Launcher
2. Click **Login as Ellen** button
3. Verify:
   - Automatic login occurs
   - Redirects to `/app/contractor/calendar`
   - Tenant badge shows "1252093 BC LTD" or "Enviropaving" (NOT Bamfield Community)
   - Calendar shows full contractor details:
     - Service Runs lane
     - Staff availability
     - Fleet/Tools lanes
     - Dependencies lane

**Expected:** Ellen sees full contractor calendar for her business tenant.

### 6. Open Wade Resident Calendar

1. Return to Demo Launcher (may need to click Panic Reset first)
2. Click **Login as Wade** button
3. Verify:
   - Automatic login occurs
   - Redirects to `/app/my-place/calendar`
   - Tenant badge shows "Wade Residence" (NOT Bamfield Community)
   - Calendar shows resident-appropriate view:
     - Limited lane groups (4 instead of 8)
     - Staff lanes redacted
     - No contractor names/addresses

**Expected:** Wade sees privacy-filtered resident calendar.

### 7. Verify No Tenant Context Warnings

1. Open Debug Panel (bug icon, bottom right)
2. Check that "Tenant Set" badge is green
3. No red "Tenant context is null" warning appears

**Expected:** Tenant context properly set for all demo views.

## Troubleshooting

### Seed Demo Returns 500

Check the error response for:
- `step`: Which step failed
- `message`: Error details

Common issues:
- Database constraint violations
- Missing enum values

Endpoint to inspect: `POST /api/dev/demo-seed`

### Quick Login Fails

Check:
- User exists in database
- User has tenant membership
- Tenant is active

Endpoint to inspect: `POST /api/dev/login-as`

### Tenant Context Null

Check:
- `/api/dev/set-tenant` was called after login
- localStorage has `cc_tenant_id` set
- Session has `current_tenant_id`

### Ellen Lands in Wrong Tenant

Verify:
- Ellen's membership is to "1252093 BC LTD" tenant, NOT "Bamfield Community"
- Quick login properly finds and sets her business tenant

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dev/demo-seed` | POST | Create demo data |
| `/api/dev/demo-reset` | POST | Delete demo data |
| `/api/dev/login-as` | POST | Login as demo user |
| `/api/dev/set-tenant` | POST | Set tenant context |
| `/api/dev/clear-tenant` | POST | Clear tenant context |
| `/api/me/context` | GET | Get current auth/tenant state |

## Demo Data Structure

```
Bamfield Community Association (community tenant)
└── Bamfield Portal (public portal)
    ├── East Bamfield Zone
    ├── West Bamfield Zone
    ├── Helby Island Zone
    └── Deer Group Zone

1252093 BC LTD (business tenant) - Ellen's tenant
├── Ellen (admin)
├── Contractor Profile (Enviropaving)
├── N3 Service Runs (6 scheduled)
├── Staff Availability Blocks
└── Photo Bundles

Wade Residence (individual tenant) - Wade's tenant
└── Wade (admin)
```

## Success Criteria

- [ ] Seed Demo never 500s; on failure returns ok:false with error+message+step
- [ ] Quick login always sets correct tenant + lands on correct calendar route
- [ ] Demo Launcher provides one-click access to 3 demo views
- [ ] Tenant auto-select never silently picks Bamfield Community for Ellen/Wade
- [ ] Panic Reset always gets user unstuck
- [ ] No "tenant context null" warnings in DebugPanel on demo pages

---

## Portal Calendar Quick Check (2 minutes)

### Step 1: Verify Demo Data Seeded
1. Navigate to `/app/dev/demo`
2. Click **"Seed Demo"** if needed
3. Wait for success toast

### Step 2: Open Bamfield Portal Calendar
1. Navigate to `/p/bamfield/calendar`
2. Verify the DEV banner appears showing:
   - `OpsCalendarBoardPage (mode="portal")`
   - `Time spine: ScheduleBoard`
   - `Endpoint: /api/portal/.../ops-calendar`
   - `Resources: 13` (approximately)
   - `Events: 100+`

### Step 3: Verify Grouped Rows
Confirm the following lane groups are visible:

| Lane Group | Expected Resources |
|------------|-------------------|
| **Scheduled Work** | 4 zones (Deer Group, East Bamfield, Helby Island, West Bamfield) |
| **Staff** | Staff Availability row |
| **Dependencies** | Weather, Ferry, Road, Seaplane rows |
| **Zone Feasibility** | 4 zone feasibility rows |

### Step 4: Verify Events
1. Confirm at least **6 scheduled events** appear in the Scheduled Work section
2. Confirm **dependency alerts** (road conditions, ferry status) appear in Dependencies section
3. Click any event to open the detail panel

### Expected Results
- [ ] DEV banner shows mode="portal" and ScheduleBoard time spine
- [ ] 4 lane groups visible (Scheduled Work, Staff, Dependencies, Zone Feasibility)
- [ ] At least 6 scheduled work events
- [ ] Dependency events (road/ferry alerts) visible
- [ ] Events are clickable with detail panel

### Troubleshooting
- **No events?** Re-run demo seed at `/app/dev/demo`
- **Wrong calendar style?** You should see horizontal time rows, NOT a month grid
- **Endpoint errors?** Check server logs for database connection issues

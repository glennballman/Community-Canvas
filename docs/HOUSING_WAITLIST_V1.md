# Housing Waitlist v1

## Purpose

Housing Waitlist v1 is a controlled resource management system for capturing and routing housing needs. It connects:
- Candidates who need housing (via campaign apply or job applications)
- Coordinators who manage the waitlist queue
- Employers who can declare available housing capacity

This is NOT full housing management - it's a waitlist + routing tool.

## Data Model

### Table: cc_portal_housing_policies

Portal-level housing configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| portal_id | uuid | Reference to cc_portals (UNIQUE) |
| is_enabled | boolean | Whether housing features are enabled |
| disclosure_text | text | Optional disclosure for candidates |
| updated_at | timestamp | Last update time |

### Table: cc_portal_housing_offers

Employer-provided housing capacity signals.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| portal_id | uuid | Reference to cc_portals |
| tenant_id | uuid | Reference to cc_tenants |
| capacity_beds | integer | Number of beds available |
| capacity_rooms | integer | Number of rooms available |
| nightly_cost_min_cents | integer | Minimum nightly cost (optional) |
| nightly_cost_max_cents | integer | Maximum nightly cost (optional) |
| notes | text | Additional details |
| status | text | 'active' / 'paused' |

**Unique constraint**: (portal_id, tenant_id)

### Table: cc_portal_housing_waitlist_entries

Queue of candidates needing housing.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| portal_id | uuid | Reference to cc_portals |
| bundle_id | uuid | Reference to cc_job_application_bundles (nullable) |
| application_id | uuid | Reference to cc_job_applications (nullable) |
| applicant_individual_id | uuid | Reference to cc_individuals (nullable) |
| applicant_name | text | Applicant's name |
| applicant_email | text | Applicant's email |
| preferred_start_date | date | When housing is needed |
| preferred_end_date | date | When housing ends |
| budget_note | text | Budget/cost preferences |
| status | text | 'new' / 'contacted' / 'matched' / 'waitlisted' / 'closed' |
| assigned_to_identity_id | uuid | Staff member handling |
| notes | text | Internal notes |

**Deduplication**: Unique indexes on (portal_id, bundle_id) and (portal_id, application_id)

### RLS Policies
- Portal staff can SELECT/UPDATE all for their portal
- Tenants can read/update their own housing offers
- Tenants CANNOT read waitlist entries (portal-controlled queue)
- Service mode bypass allowed

## Endpoints

### Staff Endpoints

#### GET /api/p2/app/mod/portals/:portalId/housing-waitlist
**Auth**: requirePortalStaff

**Query params**:
- `status`: Filter by status
- `q`: Search name/email
- `limit`: Max results (default 50)
- `offset`: Pagination offset

**Response**:
```json
{
  "ok": true,
  "entries": [{
    "id": "uuid",
    "applicantName": "John Doe",
    "applicantEmail": "john@example.com",
    "status": "new",
    "hoursSinceCreated": 12,
    "bundleId": "uuid"
  }],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

#### PATCH /api/p2/app/mod/housing-waitlist/:id
**Auth**: requirePortalStaff

**Request**:
```json
{
  "status": "contacted",
  "notes": "Called on 2025-01-17"
}
```

### Tenant Endpoints

#### GET /api/p2/app/portals/:portalId/housing-offer
**Auth**: Tenant context required

**Response**:
```json
{
  "ok": true,
  "offer": {
    "id": "uuid",
    "capacityBeds": 4,
    "capacityRooms": 2,
    "status": "active"
  }
}
```

#### PUT /api/p2/app/portals/:portalId/housing-offer
**Auth**: Tenant context required

**Request**:
```json
{
  "capacity_beds": 4,
  "capacity_rooms": 2,
  "nightly_cost_min_cents": 2500,
  "nightly_cost_max_cents": 5000,
  "notes": "Shared kitchen, wifi included",
  "status": "active"
}
```

## Automation Hooks

### Campaign Apply Integration

When a candidate submits a campaign application with `housing_needed=true`:
1. Bundle is created with housing_needed flag
2. Waitlist entry is auto-created with bundle_id
3. Entry appears in staff housing queue

**Deduplication**: ON CONFLICT (portal_id, bundle_id) DO NOTHING

## Click Paths

### Staff: View Housing Queue
1. Navigate to `/app/mod/housing` or `/app/mod/portals/:portalId/housing-waitlist`
2. View list of candidates needing housing
3. Filter by status, search by name/email
4. Update status via dropdown
5. Add notes via expand button

### Tenant: Declare Housing Capacity
1. Navigate to `/app/portals/:portalId/housing`
2. Enter beds/rooms available
3. Optional: cost range and notes
4. Toggle active/paused
5. Save

## Verification

```sql
-- Check tables exist
\d cc_portal_housing_policies
\d cc_portal_housing_offers
\d cc_portal_housing_waitlist_entries

-- Check unique indexes for deduplication
SELECT indexname FROM pg_indexes 
WHERE tablename = 'cc_portal_housing_waitlist_entries' 
  AND indexname LIKE '%unique%';

-- Check RLS is enabled
SELECT relname, relrowsecurity FROM pg_class 
WHERE relname LIKE 'cc_portal_housing%';
```

```bash
# Test staff endpoint
curl -H "Cookie: sid=..." \
  "http://localhost:5000/api/p2/app/mod/portals/<portal_id>/housing-waitlist"

# Test tenant endpoint
curl -H "Cookie: sid=..." \
  "http://localhost:5000/api/p2/app/portals/<portal_id>/housing-offer"
```

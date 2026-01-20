# V3.5 Data Access Pack

Generated: 2026-01-20

Comprehensive inventory of portal data, workflow bindings, and testing URLs for Community Canvas V3.5.

---

## A) Portal Inventory (Live DB Truth)

### Portal Summary

| # | Portal Slug | Type | Tenant | Active | Brand Name | Domains |
|---|-------------|------|--------|--------|------------|---------|
| 1 | adrenalinecanada | community | - | YES | AdrenalineCanada | adrenalinecanada.com (pending) |
| 2 | bamfield | community | Bamfield Community | YES | Bamfield Community | bamfield.communitycanvas.ca (verified) |
| 3 | bamfield-adventure | business_service | Bamfield Adventure Center | YES | Bamfield Adventure Center | bamfieldadventure.com (verified) |
| 4 | bamfield-qa | community | Community Canvas | YES | Bamfield QA Portal | - |
| 5 | canadadirect | community | - | YES | CanadaDirect | - |
| 6 | enviro-bright | business_service | 1252093 BC LTD | YES | Enviro Bright Lights | envirobright.ca (verified), enviro-bright.communitycanvas.ca |
| 7 | enviropaving | business_service | 1252093 BC LTD | YES | Enviropaving BC | enviropaving.ca (verified), enviropaving.communitycanvas.ca |
| 8 | offpeakairbnb | community | - | YES | OffpeakAirBNB | offpeakairbnb.ca (pending) |
| 9 | parts-unknown-bc | experience_editorial | - | YES | Parts Unknown BC | parts-unknown-bc.communitycanvas.ca |
| 10 | remote-serve | business_service | 1252093 BC LTD | YES | Remote Serve | remoteserve.ca (verified), remote-serve.communitycanvas.ca |
| 11 | save-paradise-parking | business_service | Save Paradise Parking | YES | Save Paradise Parking | saveparadiseparking.com (verified) |
| 12 | woods-end-landing | business_service | Woods End Landing | YES | Woods End Landing | woodsendlanding.com (verified) |

### Portal Detail: Community Portals

#### 1. bamfield
```
portal_id: df5561a8-8550-4498-9dc7-f02054bbbea4
portal_slug: bamfield
portal_type: community
owning_tenant_id: e0000000-0000-0000-0000-000000000001
is_active: true
```

**Domain Bindings:**
| Domain | Status | Primary |
|--------|--------|---------|
| bamfield.communitycanvas.ca | verified | YES |

**Branding:**
- brand_name: Bamfield Community
- tagline: Gateway to the Pacific Rim
- theme.primary_color: #0f766e
- theme.secondary_color: #115e59
- theme.accent_color: #f59e0b

**Settings (from settings jsonb):**
- city: Bamfield
- region: Alberni-Clayoquot
- show_alerts: true
- show_ferries: true
- show_weather: true
- show_businesses: true
- show_service_runs: true
- show_accommodations: true
- ferry_routes: ["Bamfield-Port Alberni"]

**Content Counts:**
| Metric | Count |
|--------|-------|
| Job Postings (active/total) | 0 / 0 |
| Reservations (30d/total) | 0 / 0 |
| Articles | 0 |
| Tenant Assets | 0 |

---

#### 2. canadadirect
```
portal_id: f47ac10b-58cc-4372-a567-0e02b2c3d479
portal_slug: canadadirect
portal_type: community
owning_tenant_id: NULL
is_active: true
```

**Domain Bindings:** None configured

**Branding:** No site_config (empty JSON)

**Content Counts:**
| Metric | Count |
|--------|-------|
| Job Postings (active/total) | 0 / 0 |
| Reservations (30d/total) | 0 / 0 |
| Articles | 0 |

---

### Portal Detail: Business Service Portals

#### 3. bamfield-adventure
```
portal_id: 4ead0e01-e45b-4d03-83ae-13d86271ff25
portal_slug: bamfield-adventure
portal_type: business_service
owning_tenant_id: 7ed7da14-b7fb-40af-a69a-ba72c8fe2888
is_active: true
```

**Domain Bindings:**
| Domain | Status | Primary |
|--------|--------|---------|
| bamfieldadventure.com | verified | YES |

**Branding:**
- brand_name: Bamfield Adventure Center
- tagline: Your gateway to West Coast wilderness
- theme.primary_color: #0369a1
- theme.secondary_color: #0284c7
- theme.accent_color: #f97316

**Content Counts:**
| Metric | Count |
|--------|-------|
| Job Postings (active/total) | 0 / 0 |
| Reservations (30d/total) | 0 / 0 |
| Tenant Assets | 34 |

---

#### 4. save-paradise-parking
```
portal_id: 19a451b8-fd3f-4bfa-81cc-93b288c69145
portal_slug: save-paradise-parking
portal_type: business_service
owning_tenant_id: 7d8e6df5-bf12-4965-85a9-20b4312ce6c8
is_active: true
```

**Domain Bindings:**
| Domain | Status | Primary |
|--------|--------|---------|
| saveparadiseparking.com | verified | YES |

**Branding:**
- brand_name: Save Paradise Parking
- tagline: Secure parking at the gateway to Bamfield
- theme.primary_color: #2563eb
- theme.secondary_color: #1e40af
- theme.accent_color: #fbbf24

**Content Counts:**
| Metric | Count |
|--------|-------|
| Job Postings (active/total) | 0 / 0 |
| Reservations (30d/total) | 6 / 6 |
| Tenant Assets | 75 |

---

#### 5. woods-end-landing
```
portal_id: 4813f3fd-02df-47c5-a705-9cfc3ac4d059
portal_slug: woods-end-landing
portal_type: business_service
owning_tenant_id: d0000000-0000-0000-0000-000000000001
is_active: true
```

**Domain Bindings:**
| Domain | Status | Primary |
|--------|--------|---------|
| woodsendlanding.com | verified | YES |

**Branding:**
- brand_name: Woods End Landing
- tagline: Waterfront cottages in the heart of Bamfield
- theme.primary_color: #065f46
- theme.secondary_color: #047857
- theme.accent_color: #fcd34d

**Content Counts:**
| Metric | Count |
|--------|-------|
| Job Postings (active/total) | 0 / 0 |
| Reservations (30d/total) | 0 / 0 |
| Tenant Assets | 7 |

---

### Global Content Counts

| Entity | Total Count |
|--------|-------------|
| Portals | 12 |
| Assets | 5,094 |
| Jobs | 0 |
| Job Postings | 0 |
| Job Applications | 0 |
| Reservations | 6 |
| Service Runs (cc_service_runs) | 3 |
| Service Runs (cc_sr_service_runs) | 2 |
| Trips | 5 |
| Coordination Circles | 1 |
| Conversations | 0 |
| Messages | 0 |
| Articles | 2 |

---

### Service Runs Detail (cc_service_runs)

| ID | Service Type | Region | Date | Status | Slots (filled/total) |
|----|--------------|--------|------|--------|---------------------|
| ff60b5b2-... | Glass Installation & Repair | Bamfield | 2026-01-14 | published | 3/8 |
| e2ad653a-... | Plumbing Services | Bamfield | 2026-01-21 | published | 1/6 |
| afaac65b-... | Electrical Services | Gold River | 2026-01-28 | published | 0/10 |

**Upcoming (from today 2026-01-20):** 2 runs (Plumbing 2026-01-21, Electrical 2026-01-28)

---

### Trips Detail

| Access Code | Status | Group Name | Dates |
|-------------|--------|------------|-------|
| WEL-DEMO01 | confirmed | Johnson Family Adventure | 2026-01-15 to 2026-01-18 |
| WEDDING2026 | held | Wedding Weekend 2026 | 2026-06-15 to 2026-06-18 |
| W9ZB-57YP | planning | Smith Family Reunion | 2026-07-15 to 2026-07-20 |
| CK35-NQ9R | planning | Jones Wedding Party | 2026-08-10 to 2026-08-15 |

---

## B) Bamfield + CanadaDirect Focus Pages

### Bamfield Community Portal Routes

**Primary Testing URLs (slug-based):**
```
/p/bamfield                           # Portal home
/p/bamfield/reserve                   # Reservation flow
/p/bamfield/onboarding                # Operator onboarding
```

**Domain-based equivalents:**
```
https://bamfield.communitycanvas.ca/              # Portal home
https://bamfield.communitycanvas.ca/reserve       # Reservation flow
```

**Service Runs Discovery:**
- Service runs are displayed on Bamfield portal home via settings.show_service_runs = true
- 2 upcoming Bamfield service runs available (Plumbing 2026-01-21, Glass was 2026-01-14)

---

### CanadaDirect Jobs Portal Routes

**Primary Testing URLs (slug-based):**
```
/b/canadadirect/jobs                  # Jobs list
/b/canadadirect/jobs/:postingId       # Job detail
/b/canadadirect/jobs/:postingId/apply # Apply form
/b/canadadirect/employers/:employerId # Employer profile
/b/canadadirect/apply/:campaignKey    # Campaign application
```

**Domain-based equivalents:** None (no domain binding for canadadirect)

**Current Status:**
- 0 active job postings
- 0 total job applications
- Portal has no site_config/branding configured

---

### Trip Portal Routes

```
/trip/WEL-DEMO01      # Johnson Family Adventure (confirmed)
/trip/WEDDING2026     # Wedding Weekend 2026 (held)
```

---

## C) Workflow Binding Verification

### Route Family: /p/:portalSlug/* (Reservation + Onboarding)

| Route | Portal-Scoped | Fetches Site Data | Applies Theme | Back Navigation | Status |
|-------|---------------|-------------------|---------------|-----------------|--------|
| /p/:portalSlug | YES | YES `/api/public/cc_portals/:slug/site` | YES | N/A (home) | PASS |
| /p/:portalSlug/reserve | YES | YES (availability API) | YES (inherits) | YES → `/p/:slug` | PASS |
| /p/:portalSlug/onboarding | YES | YES | YES | YES → `/p/:slug` | PASS |

---

### Route Family: /b/:portalSlug/* (Jobs + Apply)

| Route | Portal-Scoped | Fetches Site Data | Applies Theme | Back Navigation | Status |
|-------|---------------|-------------------|---------------|-----------------|--------|
| /b/:portalSlug/jobs | YES | NO | NO | N/A (list) | NEEDS FIX |
| /b/:portalSlug/jobs/:id | YES | NO | NO | YES → jobs list | NEEDS FIX |
| /b/:portalSlug/jobs/:id/apply | YES | NO | NO | YES → job detail | NEEDS FIX |
| /b/:portalSlug/employers/:id | YES | NO | NO | YES → jobs list | NEEDS FIX |
| /b/:portalSlug/apply/:key | YES | NO | PARTIAL | YES → `/b/:slug` (wrong target) | NEEDS FIX |

**Issues:**
1. PortalJobsPage does not fetch `/api/public/cc_portals/:slug/site`
2. No portal theme colors applied - uses hardcoded styling
3. Campaign apply back link goes to `/b/:slug` which may 404

---

### Route Family: /trip/:accessCode

| Route | Portal-Scoped | Fetches Site Data | Applies Theme | Back Navigation | Status |
|-------|---------------|-------------------|---------------|-----------------|--------|
| /trip/:accessCode | YES (API returns portal) | NO (trip API only) | NO | NO | NEEDS FIX |

**Issues:**
1. API returns portal object but theme not applied
2. No back-to-portal navigation (may be by design)

---

### Route Family: /p/proposal/:proposalId/:token?

| Route | Portal-Scoped | Fetches Site Data | Applies Theme | Back Navigation | Status |
|-------|---------------|-------------------|---------------|-----------------|--------|
| /p/proposal/:id/:token? | NO | NO | NO | NO | NEEDS FIX |

**Issues:**
1. Not portal-scoped at all - proposal accessed by ID only
2. No branding or back navigation

---

### Binding Verification Summary

| Status | Count | Routes |
|--------|-------|--------|
| PASS | 3 | /p/:slug, /p/:slug/reserve, /p/:slug/onboarding |
| NEEDS FIX | 7 | All /b/:slug/*, /trip/:code, /p/proposal/:id |

---

## D) Seed-Readiness Check

### CanadaDirect Jobs Portal

**Current State:** 0 job postings, 0 applications

**Seed Script Suggestion:**

To create 1 job posting + 1 application for CanadaDirect testing:

1. **Create a tenant for the employer** (if needed)
2. **Create a job record** in cc_jobs
3. **Create a job posting** in cc_job_postings linking to canadadirect portal
4. **Create a job application** in cc_job_applications

```sql
-- See Appendix A for full SQL
```

---

### Bamfield Service Runs

**Current State:** 2 upcoming service runs in Bamfield region (Plumbing 2026-01-21, Electrical 2026-01-28)

**Status:** READY - Has upcoming runs with available capacity

---

## Appendix A: SQL Queries Used

### Query 1: Portal Inventory
```sql
SELECT 
  p.id as portal_id,
  p.slug as portal_slug,
  p.portal_type,
  p.owning_tenant_id,
  p.is_active,
  p.name,
  p.legal_dba_name,
  p.site_config,
  p.base_url,
  p.settings
FROM cc_portals p
ORDER BY p.portal_type, p.name;
```

### Query 2: Domain Bindings
```sql
SELECT 
  d.id,
  d.portal_id,
  d.domain,
  d.status,
  d.is_primary,
  p.slug as portal_slug
FROM cc_portal_domains d
JOIN cc_portals p ON d.portal_id = p.id
ORDER BY p.slug, d.is_primary DESC;
```

### Query 3: Job/Reservation Counts per Portal
```sql
SELECT 
  p.id as portal_id,
  p.slug as portal_slug,
  (SELECT COUNT(*) FROM cc_job_postings jp WHERE jp.portal_id = p.id) as total_job_postings,
  (SELECT COUNT(*) FROM cc_job_postings jp WHERE jp.portal_id = p.id AND jp.publish_state = 'published') as active_job_postings,
  (SELECT COUNT(*) FROM cc_reservations r WHERE r.portal_id = p.id) as total_reservations,
  (SELECT COUNT(*) FROM cc_reservations r WHERE r.portal_id = p.id AND r.created_at >= NOW() - INTERVAL '30 days') as reservations_30d
FROM cc_portals p
ORDER BY p.slug;
```

### Query 4: Service Runs
```sql
SELECT id, destination_region, service_type, planned_date, status, total_job_slots, slots_filled
FROM cc_service_runs
ORDER BY planned_date;
```

### Query 5: Trips
```sql
SELECT id, access_code, status, group_name, start_date, end_date 
FROM cc_trips 
ORDER BY created_at DESC;
```

### Query 6: Global Counts
```sql
SELECT COUNT(*) as total_jobs FROM cc_jobs;
SELECT COUNT(*) as total_job_applications FROM cc_job_applications;
SELECT COUNT(*) as total_assets FROM cc_assets;
SELECT COUNT(*) as total_service_runs FROM cc_service_runs;
SELECT COUNT(*) as total_trips FROM cc_trips;
SELECT COUNT(*) as total_circles FROM cc_coordination_circles;
SELECT COUNT(*) as total_conversations FROM cc_conversations;
SELECT COUNT(*) as total_messages FROM cc_messages;
```

---

## Appendix B: Seed Script for CanadaDirect Testing

**Minimum inserts to create 1 job posting + 1 application:**

```sql
-- 1. Create employer tenant (if not using existing)
INSERT INTO cc_tenants (id, name, status)
VALUES (
  'cd000000-0000-0000-0000-000000000001',
  'Test Employer Inc.',
  'active'
);

-- 2. Create party for employer
INSERT INTO cc_parties (id, party_type, tenant_id, display_name)
VALUES (
  'cd000000-0000-0000-0001-000000000001',
  'organization',
  'cd000000-0000-0000-0000-000000000001',
  'Test Employer Inc.'
);

-- 3. Create job
INSERT INTO cc_jobs (
  id, title, slug, role_category, employment_type,
  description, status, brand_tenant_id, brand_name_snapshot
)
VALUES (
  'cd000000-0000-0000-0002-000000000001',
  'Remote Customer Support Specialist',
  'remote-customer-support-specialist',
  'customer_service',
  'full_time',
  'Join our team as a remote customer support specialist...',
  'active',
  'cd000000-0000-0000-0000-000000000001',
  'Test Employer Inc.'
);

-- 4. Create job posting for canadadirect portal
INSERT INTO cc_job_postings (
  id, job_id, portal_id, publish_state, posted_at, expires_at
)
VALUES (
  'cd000000-0000-0000-0003-000000000001',
  'cd000000-0000-0000-0002-000000000001',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479', -- canadadirect portal_id
  'published',
  NOW(),
  NOW() + INTERVAL '30 days'
);

-- 5. Create test applicant individual
INSERT INTO cc_individuals (id, given_name, family_name, email)
VALUES (
  'cd000000-0000-0000-0004-000000000001',
  'Test',
  'Applicant',
  'test.applicant@example.com'
);

-- 6. Create job application
INSERT INTO cc_job_applications (
  id, job_id, job_posting_id, applicant_individual_id,
  status, submitted_at
)
VALUES (
  'cd000000-0000-0000-0005-000000000001',
  'cd000000-0000-0000-0002-000000000001',
  'cd000000-0000-0000-0003-000000000001',
  'cd000000-0000-0000-0004-000000000001',
  'submitted',
  NOW()
);
```

**Alternative: UI Actions**
1. Navigate to `/app/jobs/new` and create a new job posting
2. Assign it to CanadaDirect portal during publication
3. Navigate to `/b/canadadirect/jobs/:id/apply` and submit test application

---

## Appendix C: Seed Script for Bamfield Service Run with Capacity

**Not needed - Bamfield already has 2 upcoming service runs with available capacity:**
- Plumbing Services (2026-01-21): 5 slots available (1/6 filled)
- Electrical Services (2026-01-28): 10 slots available (0/10 filled)

**If additional runs needed:**
```sql
INSERT INTO cc_service_runs (
  id, company_name, service_type, destination_region,
  planned_date, planned_duration_days, total_job_slots, slots_filled,
  crew_size, status, contact_email
)
VALUES (
  gen_random_uuid(),
  'Test Service Provider',
  'HVAC Services',
  'Bamfield',
  CURRENT_DATE + INTERVAL '14 days',
  1,
  8,
  0,
  2,
  'published',
  'test@provider.example.com'
);
```

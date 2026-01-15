# V1 "Jobber + CompanyCam + Cloudbeds Replacement" Forensic Audit

**Date:** 2026-01-15  
**Scope:** Full audit of existing V1 subsystem for reservations, work orders, bids, projects, photos, notes, invoicing

---

## Executive Summary

1. **Projects System Exists**: Full job lifecycle from lead → quote → approved → scheduled → in_progress → completed → invoiced → paid, with photos, notes, line items, change order snapshots
2. **Work Requests Inbox Exists**: Quick-capture intake system ("faster than a sticky note") with conversion to Projects
3. **Bidding System Exists**: Procurement requests (RFP/RFQ system), bid submissions, bid breakdown lines, bid messaging
4. **Rental System Exists**: Categories, items, availability checking, quote generation, reservation carts
5. **Jobber Integration**: API service exists with OAuth, GraphQL queries, job sync - partially implemented
6. **CompanyCam Integration**: API service exists with project/photo sync - partially implemented
7. **R2 Media Storage**: Cloudflare R2 integration for project photos and media uploads
8. **Payment Promises**: Payment milestones, payment events, settlement tracking - implemented
9. **RLS Enforced**: All V1 tables have ENABLE + FORCE ROW LEVEL SECURITY with tenant isolation policies
10. **UI Coverage**: Projects list/detail pages, Work Request board, rental browsing - implemented but scattered

---

## 1. Data Model Map (Tables + Columns)

### 1.1 Work Requests (Intake Inbox)
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `work_requests` | 046 | FORCE | id, tenant_id, contact_channel_value, contact_channel_type, status, summary, description, converted_to_project_id |
| `work_request_notes` | 046 | FORCE | id, work_request_id, content, created_at, created_by_actor_id |

**Status Enum:** `new`, `contacted`, `quoted`, `converted`, `closed`, `spam`

### 1.2 Projects (The Actual Job)
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `projects` | 046 | FORCE | id, tenant_id, title, description, status, quoted_amount, final_amount, deposit_required, scheduled_start, scheduled_end, completed_at, warranty_months |
| `project_line_items` | 046 | FORCE | id, project_id, description, quantity, unit_price, total, sort_order |
| `project_scope_snapshots` | 046 | FORCE | id, project_id, version, description, amount, reason (original/change_order/revision), notes |
| `project_photos` | 046 | FORCE | id, project_id, tenant_id, stage (before/during/after), storage_key, storage_url, caption, geo_lat, geo_lng |
| `project_notes` | 046 | FORCE | id, project_id, note_type, content, created_at, created_by_actor_id |

**Status Enum:** `lead`, `quote`, `approved`, `scheduled`, `in_progress`, `completed`, `invoiced`, `paid`, `cancelled`, `warranty`

### 1.3 Procurement Requests (RFP/Bidding)
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `cc_procurement_requests` | 044+ | YES | id, procurement_request_ref, owner_tenant_id, title, description, scope_of_work, work_category, bid_deadline, expected_start_date, status |
| `cc_bids` | 024+ | YES | id, bid_ref, work_request_id, party_id, bid_amount, proposed_start_date, proposed_duration_days, status, score_overall |
| `cc_bid_breakdown_lines` | various | YES | id, bid_id, line_number, category, description, quantity, unit, unit_price, total_price |
| `cc_bid_messages` | various | YES | id, bid_id, from_party_id, content |

### 1.4 Rentals & Reservations
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `cc_rental_categories` | 012 | - | id, name, slug, icon, required_waiver_slug, minimum_age |
| `cc_rental_items` | 012 | - | id, name, slug, category_id, owner_tenant_id, rate_hourly, rate_daily, rate_weekly, damage_deposit |
| `cc_rental_bookings` | 012 | - | id, rental_item_id, renter_individual_id, starts_at, ends_at, status, service_run_id |
| `cc_reservation_items` | schema.ts | YES | id, facility_id, offer_id, rate_cents, unit_count, tax_rule_id |
| `cc_reservation_allocations` | schema.ts | YES | id, reservation_item_id, inventory_unit_id, allocation_date |
| `cc_reservation_carts` | schema.ts | YES | id, tenant_id, session_id, guest_individual_id, status, expires_at |
| `cc_reservation_cart_items` | schema.ts | YES | id, cart_id, facility_id, offer_id, check_in, check_out, guests_adults |

### 1.5 Payments & Settlement
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `cc_payment_promises` | various | YES | id, conversation_id, payer_party_id, payee_party_id, total_amount, status |
| `cc_payment_milestones` | various | YES | id, payment_promise_id, name, amount, trigger, status |
| `cc_payment_events` | various | YES | id, payment_promise_id, actor_party_id, event_type, amount |
| `cc_payment_references` | schema.ts | YES | id, tenant_id, provider, external_id, amount_cents, currency |

### 1.6 CRM (Contacts, Properties, Organizations)
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `crm_contacts` (was `crm_people`) | 046 | YES | id, tenant_id, given_name, family_name, telephone, email, organization_id |
| `crm_organizations` (was `crm_orgs`) | 046 | YES | id, tenant_id, name |
| `crm_properties` (was `crm_places`) | 046 | YES | id, tenant_id, name, address_line1, owner_contact_id, owner_organization_id |
| `crm_property_photos` | 046 | YES | id, property_id, photo_url |

### 1.7 Parties (Contractor/Owner Identity)
| Table | Migration | RLS | Key Columns |
|-------|-----------|-----|-------------|
| `cc_parties` | various | YES | id, tenant_id, party_type (contractor/owner/...), status, trade_name, primary_contact_email |

---

## 2. API Surface Map (Server Routes)

### 2.1 Projects Routes (`server/routes/projects.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cc_projects` | List projects with status filter |
| GET | `/api/cc_projects/:id` | Get project with photos/notes/line items |
| POST | `/api/cc_projects` | Create new project |
| PUT | `/api/cc_projects/:id` | Update project |
| PUT | `/api/cc_projects/:id/status` | Update project status |
| POST | `/api/cc_projects/:id/photos` | Upload photo (before/during/after) |
| GET | `/api/cc_projects/:id/photos` | Get photos by stage |
| POST | `/api/cc_projects/:id/notes` | Add note |
| GET | `/api/cc_projects/:id/notes` | Get notes |
| POST | `/api/cc_projects/:id/change-order` | Create scope snapshot |
| POST | `/api/cc_projects/:id/line-items` | Add line item |
| GET | `/api/cc_projects/:id/line-items` | Get line items |
| DELETE | `/api/cc_projects/line-items/:id` | Delete line item |

### 2.2 Work Requests Routes (`server/routes/work-requests.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/work-requests` | List work requests with status filter |
| GET | `/api/work-requests/:id` | Get single work request |
| POST | `/api/work-requests` | Create new work request (minimal capture) |
| PUT | `/api/work-requests/:id` | Update work request |
| POST | `/api/work-requests/:id/convert` | Convert to project |
| POST | `/api/work-requests/:id/close` | Close with reason |
| POST | `/api/work-requests/:id/notes` | Add note |
| GET | `/api/work-requests/:id/notes` | Get notes |

### 2.3 Bids Routes (`server/routes/bids.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cc_bids/mine` | Get bids submitted by current party |
| GET | `/api/cc_bids/:id` | Get bid with breakdown lines and messages |
| POST | `/api/cc_bids` | Submit new bid |
| PUT | `/api/cc_bids/:id` | Update bid |
| POST | `/api/cc_bids/:id/withdraw` | Withdraw bid |

### 2.4 Procurement Requests Routes (`server/routes/procurement-requests.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/procurement-requests` | List procurement requests |
| GET | `/api/procurement-requests/:id` | Get single procurement request |
| POST | `/api/procurement-requests` | Create new RFP |
| PUT | `/api/procurement-requests/:id` | Update RFP |
| GET | `/api/procurement-requests/:id/bids` | Get bids for RFP |

### 2.5 Rentals Routes (`server/routes/rentals.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/rentals/browse` | Browse rental items (public) |
| GET | `/api/rentals/:id/quote` | Get quote for rental |
| POST | `/api/rentals/cart/add` | Add item to cart |
| GET | `/api/rentals/cart` | Get current cart |
| POST | `/api/rentals/checkout` | Complete reservation |

### 2.6 Payments Routes (`server/routes/payments.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cc_conversations/:id/payment-promise` | Create payment promise |
| GET | `/api/cc_conversations/:id/payment-promise` | Get payment promise with milestones |
| POST | `/api/payment-milestones/:id/payment-sent` | Record payment sent |
| POST | `/api/payment-milestones/:id/payment-received` | Record payment received |

### 2.7 External Integration Routes (`server/routes.ts`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/integrations/companycam/project/:projectId/photos` | Get CompanyCam photos |
| GET | `/api/v1/integrations/companycam/cc_projects/search` | Search CompanyCam projects |
| GET | `/api/v1/integrations/companycam/cc_projects` | List CompanyCam projects |
| GET | `/api/v1/integrations/jobber/*` | Jobber integration endpoints |

---

## 3. UI Surface Map (Client Routes/Pages)

### 3.1 Implemented Pages
| Path | File | Purpose |
|------|------|---------|
| `/projects` | `client/src/pages/projects/ProjectsList.tsx` | Projects list with status tabs |
| `/projects/:id` | `client/src/pages/projects/ProjectDetail.tsx` | Project detail with photos, notes, line items |
| `/projects/new` | `client/src/pages/projects/CreateProject.tsx` | Create new project |
| `/work-requests` | `client/src/pages/WorkRequestBoard.tsx` | Work requests intake board |
| `/work-requests/:id` | `client/src/pages/WorkRequestDetail.tsx` | Work request detail |
| `/services/runs/:id` | `client/src/pages/services/ServiceRunDetail.tsx` | Service run with bids |
| `/services/runs` | `client/src/pages/services/ServiceRuns.tsx` | Service runs list |

### 3.2 Hooks
| File | Purpose |
|------|---------|
| `client/src/hooks/useCompanyCamPhotos.ts` | Fetch CompanyCam photos |
| `client/src/hooks/useJobberJob.ts` | Fetch Jobber job data |

---

## 4. Workflow Coverage

| Workflow Step | Status | Evidence |
|---------------|--------|----------|
| Lead Capture (Work Request) | ✅ Implemented | `work_requests` table, `/api/work-requests` routes |
| Quote/Estimate | ✅ Implemented | `projects.quoted_amount`, `project_line_items` |
| Customer Approval | ⚠️ Partial | `projects.approved_at` field exists, no signature capture |
| Scheduling | ✅ Implemented | `projects.scheduled_start`, `projects.scheduled_end` |
| In-Progress Tracking | ✅ Implemented | `projects.status = 'in_progress'`, `projects.started_at` |
| Before/During/After Photos | ✅ Implemented | `project_photos` table with `stage` column |
| Notes/Timeline | ✅ Implemented | `project_notes` table |
| Change Orders | ✅ Implemented | `project_scope_snapshots` table with version tracking |
| Completion | ✅ Implemented | `projects.completed_at`, status transitions |
| Invoice Generation | ⚠️ Partial | `projects.invoiced_at` field, no PDF generation |
| Payment Settlement | ✅ Implemented | `cc_payment_promises`, `cc_payment_milestones` |
| Warranty Tracking | ✅ Implemented | `projects.warranty_months`, `projects.warranty_expires_at` |

---

## 5. Integration Hooks

### 5.1 Implemented Integrations
| Integration | Service File | Status |
|-------------|--------------|--------|
| CompanyCam | `server/services/companycam.ts` | ✅ API client, project/photo sync |
| Jobber | `server/services/jobber.ts` | ✅ OAuth, GraphQL, job sync |
| Cloudflare R2 | `server/services/mediaService.ts` | ✅ Upload, presigned URLs |

### 5.2 Environment Variables
- `COMPANYCAM_ACCESS_TOKEN` - CompanyCam API token
- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `JOBBER_ACCESS_TOKEN`, `JOBBER_REFRESH_TOKEN` - Jobber OAuth
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` - Cloudflare R2

### 5.3 Missing Integrations
- Invoice PDF generation
- Accounting export (QuickBooks, Xero)
- Electronic signature capture
- SMS/email notifications for approval workflow

---

## 6. Overlap / Collision Risks with V3

### 6.1 Reservations vs Bookings
| V1 Tables | V3 Tables | Risk | Recommendation |
|-----------|-----------|------|----------------|
| `cc_rental_bookings` | `cc_reservation_items`, `cc_reservation_allocations` | **OVERLAP** - Both track asset reservations | **REFACTOR**: Migrate `cc_rental_bookings` to unified reservation system; deprecate `cc_rental_bookings` |

### 6.2 Jobs Wedge
| V1 Tables | V3 Pattern | Risk | Recommendation |
|-----------|------------|------|----------------|
| `projects`, `work_requests` | Jobs Wedge (planned) | **POTENTIAL OVERLAP** - V1 projects may conflict with V3 jobs architecture | **REUSE**: V1 `projects` table is solid; extend with V3 capabilities rather than replace |

### 6.3 Record Bundles / Notes
| V1 Tables | V3 Tables | Risk | Recommendation |
|-----------|-----------|------|----------------|
| `project_notes`, `work_request_notes` | `cc_contemporaneous_notes`, `cc_record_bundles` | **PARTIAL OVERLAP** - V1 notes are project-scoped; V3 notes support multi-scope | **REUSE + EXTEND**: Keep V1 notes for project context; V3 notes for legal/bundle context |

### 6.4 CAPs / Service Runs
| V1 Pattern | V3 Pattern | Risk | Recommendation |
|------------|------------|------|----------------|
| Service runs with bids | CAPs with capabilities | **ARCHITECTURAL DIFFERENCE** - V1 uses party-based bidding; V3 uses capability matching | **REFACTOR**: Align service runs with CAP architecture; deprecate direct bid-to-service-run pattern |

### 6.5 Photos / Media
| V1 Tables | V3 Tables | Risk | Recommendation |
|-----------|-----------|------|----------------|
| `project_photos` | `cc_media`, `cc_record_bundle_media` | **PARTIAL OVERLAP** - V1 photos are project-scoped; V3 media is multi-purpose | **REUSE**: Keep V1 `project_photos` for job context; use V3 `cc_media` for general storage |

---

## Appendix: Top 20 Files to Read First

1. `server/migrations/046_work_requests_projects.sql` - Core V1 schema
2. `server/routes/projects.ts` - Full projects API
3. `server/routes/work-requests.ts` - Work requests API
4. `server/routes/bids.ts` - Bidding API
5. `server/routes/procurement-requests.ts` - RFP system
6. `server/routes/rentals.ts` - Rentals/availability
7. `server/routes/payments.ts` - Payment promises
8. `server/services/jobber.ts` - Jobber integration
9. `server/services/companycam.ts` - CompanyCam integration
10. `server/services/mediaService.ts` - R2 storage
11. `client/src/pages/projects/ProjectsList.tsx` - Projects UI
12. `client/src/pages/projects/ProjectDetail.tsx` - Project detail UI
13. `client/src/pages/WorkRequestBoard.tsx` - Work requests UI
14. `client/src/pages/WorkRequestDetail.tsx` - Work request detail
15. `client/src/hooks/useJobberJob.ts` - Jobber hook
16. `client/src/hooks/useCompanyCamPhotos.ts` - CompanyCam hook
17. `server/migrations/024_rls_policies.sql` - RLS policies
18. `server/migrations/012_sovereign_individual.sql` - Rental items
19. `shared/schema.ts` - Drizzle schema definitions
20. `server/routes.ts` - Route registration and integration endpoints

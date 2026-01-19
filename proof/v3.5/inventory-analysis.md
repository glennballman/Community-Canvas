# V3.5 AUTHORITATIVE INVENTORY & GAP ANALYSIS
**Version:** V3.5  
**Date:** 2026-01-19  
**Rule:** ADDITIVE ONLY — NO REFACTORS

---

## TASK 1 — INVENTORY (AUTHORITATIVE)

### A) Database Tables (515 cc_* tables)

#### RESERVATIONS SUBSYSTEM (47 tables)
```
cc_reservations                    cc_reservation_allocations
cc_reservation_cart_items          cc_reservation_cart_adjustments
cc_reservation_carts               cc_reservation_items
cc_reservation_notifications       cc_accommodation_reservations
cc_rental_reservations             cc_service_run_reservations
cc_staging_reservations            cc_pms_reservations
cc_transport_reservations          cc_partner_reservation_requests
cc_trips                           cc_trip_alerts
cc_trip_analytics                  cc_trip_handoffs
cc_trip_invitations                cc_trip_itinerary_items
cc_trip_participants               cc_trip_party_profiles
cc_trip_passengers                 cc_trip_permits
cc_trip_reviews                    cc_trip_route_points
cc_trip_segment_templates          cc_trip_timepoints
cc_availability_blocks             cc_asset_availability
cc_catalog_availability            cc_moment_availability
cc_unit_calendar                   cc_rate_plans
cc_rate_rules                      cc_seasonal_rules
cc_staging_pricing                 cc_staging_pricing_overrides
cc_offers                          cc_negotiation_offers
cc_acceptances                     cc_hold_requests
cc_portal_pricing_rules            cc_capacity_policies
cc_monitor_policies                cc_monitor_state
```

#### FOLIOS SUBSYSTEM (5 tables)
```
cc_folios                          cc_folio_ledger
cc_folio_ledger_links              cc_transactions
cc_transaction_lines
```

#### MESSAGING SUBSYSTEM (18 tables)
```
cc_conversations                   cc_conversation_participants
cc_messages                        cc_message_redactions
cc_notifications                   cc_notification_deliveries
cc_notification_digests            cc_notification_preferences
cc_notification_templates          cc_outreach_messages
cc_outreach_campaigns              cc_outreach_templates
cc_outreach_attempts               cc_run_outreach_campaigns
cc_run_outreach_messages           cc_shared_outreach_campaigns
cc_shared_outreach_messages        cc_rtr_message_log
```

#### RECORDS & EVIDENCE SUBSYSTEM (22 tables)
```
cc_record_bundles                  cc_record_bundle_acl
cc_record_bundle_artifacts         cc_record_captures
cc_record_capture_queue            cc_record_sources
cc_evidence_bundles                cc_evidence_bundle_items
cc_evidence_objects                cc_evidence_events
cc_evidence_access_log             cc_contemporaneous_notes
cc_contemporaneous_note_media      cc_external_records
cc_external_sync_records           cc_maintenance_records
cc_defense_packs                   cc_legal_holds
cc_legal_hold_targets              cc_legal_hold_events
cc_system_evidence                 cc_audit_trail
```

#### CIRCLES & FEDERATION SUBSYSTEM (16 tables)
```
cc_coordination_circles            cc_circle_members
cc_circle_roles                    cc_circle_delegations
cc_federation_agreements           cc_federation_grants
cc_federated_tokens                cc_portal_members
cc_portal_memberships              cc_party_memberships
cc_parties                         cc_bundle_members
cc_bundle_opportunities            cc_roles
cc_user_roles                      cc_permissions
```

#### FLEET & ASSETS SUBSYSTEM (42 tables)
```
cc_assets                          cc_asset_availability
cc_asset_capabilities              cc_asset_capability_units
cc_asset_capacities                cc_asset_children
cc_asset_constraints               cc_asset_group_members
cc_asset_groups                    cc_asset_inspections
cc_asset_terms                     cc_asset_visibility_policies
cc_asset_visibility_rules          cc_fleets
cc_fleet_trailer_assignments       cc_fleet_vehicle_assignments
cc_vehicles                        cc_vehicle_assessments
cc_vehicle_catalog                 cc_vehicle_class_specs
cc_vehicle_documents               cc_vehicle_driver_assignments
cc_vehicle_registrations           cc_vehicle_safety_equipment
cc_trailers                        cc_trailer_catalog
cc_trailer_type_specs              cc_tenant_trailers
cc_tenant_trailer_photos           cc_tenant_vehicles
cc_tenant_vehicle_photos           cc_transport_assets
cc_transport_operators             cc_transport_providers
cc_transport_requests              cc_transport_confirmations
cc_transport_alerts                cc_transport_schedules
cc_equipment_types                 cc_equipment_rentals
cc_equipment_assignments           cc_equipment_plans
```

#### SERVICE RUNS SUBSYSTEM (38 tables)
```
cc_service_runs                    cc_service_run_members
cc_service_run_reservations        cc_services
cc_sr_bundles                      cc_sr_bundle_items
cc_sr_bundle_pricing               cc_sr_bundle_seasonality
cc_sr_communities                  cc_sr_community_bundles
cc_sr_run_types                    cc_sr_run_type_services
cc_sr_services                     cc_sr_service_addons
cc_sr_service_categories           cc_sr_service_certifications
cc_sr_service_compatibility        cc_sr_service_constraints
cc_sr_service_dependencies         cc_sr_service_mobilization
cc_sr_service_pricing              cc_sr_service_requirements
cc_sr_service_seasonality          cc_sr_service_slots
cc_sr_service_tool_requirements    cc_sr_service_access_requirements
cc_sr_access_requirements          cc_sr_certifications
cc_sr_climate_regions              cc_sr_constraints
cc_sr_contractor_bids              cc_sr_mobilization_classes
cc_sr_pricing_models               cc_sr_property_tools
cc_sr_provider_tools               cc_sr_requirement_items
cc_sr_requirement_sets             cc_sr_skills
cc_sr_tools
```

#### SURFACES (V3.5 Patent CC-02) (7 tables)
```
cc_surfaces                        cc_surface_units
cc_surface_claims                  cc_surface_containers
cc_surface_container_members       cc_surface_tasks
cc_surface_utility_bindings
```

#### N3 MONITOR (V3.5 Patent CC-01) (5 tables)
```
cc_n3_runs                         cc_n3_segments
cc_n3_surface_requirements         cc_n3_effective_capacity_evaluations
cc_replan_bundles
```

#### CERTIFICATIONS & COMPLIANCE (12 tables)
```
cc_certifications                  cc_compliance_checks
cc_compliance_plans                cc_compliance_rules
cc_training_modules                cc_training_completions
cc_user_qualifications             cc_individual_skills
cc_participant_skills              cc_skill_requirements
cc_credential_verifications        cc_verification_requests
```

#### JOBS & WORK SUBSYSTEM (35 tables)
```
cc_jobs                            cc_job_postings
cc_job_applications                cc_job_applicants
cc_job_application_events          cc_job_application_bundles
cc_job_application_bundle_items    cc_job_matches
cc_job_channel_publications        cc_job_distribution_channels
cc_job_embed_publications          cc_job_ingestion_tasks
cc_work_requests                   cc_work_request_measurements
cc_work_request_media              cc_work_request_notes
cc_work_orders                     cc_work_order_materials
cc_work_order_requirements         cc_projects
cc_project_line_items              cc_project_notes
cc_project_photos                  cc_project_scope_snapshots
cc_bids                            cc_bid_breakdown_lines
cc_bid_messages                    cc_estimates
cc_estimate_versions               cc_estimate_line_items
cc_estimate_allowances             cc_contracts
cc_contract_payment_schedule       cc_schedules
cc_resource_schedule_events
```

#### ENFORCEMENT & DISPUTES (12 tables)
```
cc_enforcement_actions             cc_enforcement_fine_schedule
cc_disputes                        cc_dispute_evidence
cc_dispute_inputs                  cc_dispute_messages
cc_citations                       cc_citation_appeals
cc_violation_history               cc_incidents
cc_incident_actions                cc_incident_reports
```

---

### B) Backend API Routes (104 route files, ~1,174 endpoints)

| Subsystem | Route Files | Endpoints |
|-----------|-------------|-----------|
| **Auth** | auth.ts, authAccounts.ts, hostAuth.ts | ~30 |
| **Reservations** | rentals.ts, accommodations.ts, p2-reservations.ts, trips.ts | ~45 |
| **Proposals** | proposals.ts | ~10 |
| **Folios** | wallet.ts, payments.ts, rail.ts | ~25 |
| **Messaging** | conversations.ts, p2-conversations.ts | ~15 |
| **Records** | records.ts, record-bundles.ts, evidence.ts | ~36 |
| **Circles** | roles.ts | ~4 |
| **Fleet** | fleet.ts, vehicles.ts, transport.ts | ~35 |
| **Service Runs** | serviceRuns.ts, p2-service-runs.ts, shared-runs.ts | ~40 |
| **Surfaces** | surfaces.ts, p2-parking.ts, p2-marina.ts | ~30 |
| **N3** | n3.ts | ~8 |
| **Ops** | ops.ts, media.ts | ~20 |
| **Jobs** | jobs.ts, public-jobs.ts, moderation-jobs.ts, job-ingestion.ts | ~55 |
| **Enforcement** | enforcement.ts, disputes.ts, citations.ts | ~35 |
| **Admin** | admin-*.ts (8 files) | ~41 |
| **Platform** | monetization.ts, internal.ts, system-explorer.ts | ~27 |
| **Entities** | entities.ts, crm.ts, community.ts | ~40 |
| **Operators** | operator.ts, businessOperators.ts | ~45 |
| **Other** | ~25 additional route files | ~200+ |

---

### C) Frontend UI Routes (159 page files)

#### Public Routes (Guest/Unauthenticated)
```
/                                  Landing
/p/:portalSlug                     Portal Home
/p/:portalSlug/reserve             Portal Reserve
/p/:portalSlug/reserve/:assetId    Asset Reserve
/c/:slug                           Community Portal
/c/:slug/businesses                Community Businesses
/c/:slug/services                  Community Services
/c/:slug/stay                      Community Stay
/c/:slug/events                    Community Events
/b/:portalSlug/jobs                Portal Jobs
/b/:portalSlug/jobs/:postingId     Job Detail
/b/:portalSlug/jobs/:postingId/apply  Job Apply
/trip/:accessCode                  Trip Portal
/p/proposal/:proposalId            Public Proposal
/reserve/*                         Public Reserve Flow
```

#### Authenticated App Routes (/app/*)
```
/app                               Tenant Picker
/app/dashboard                     Dashboard
/app/ops                           Operations Board
/app/ops/housekeeping              Housekeeping Tasks
/app/ops/incidents                 Incidents Console
/app/operations                    Operations (legacy)
/app/parking                       Parking Overview
/app/parking/plan                  Parking Plan View
/app/marina                        Marina Overview
/app/marina/plan                   Marina Plan View
/app/hospitality                   Hospitality Dashboard
/app/jobs                          Jobs Index
/app/jobs/new                      Create Job
/app/jobs/:id/edit                 Edit Job
/app/jobs/:id/destinations         Job Destinations
/app/jobs/payments/pending         Pending Payments
/app/jobs/embeds                   Embed Configurator
/app/mod/jobs                      Jobs Moderation
/app/mod/applications              Applications Queue
/app/mod/hiring-pulse              Hiring Pulse
/app/mod/housing                   Housing Moderation
/app/mod/portals/:portalId/bench   Candidate Bench
/app/mod/portals/:portalId/emergency  Emergency Bench
/app/work-requests                 Work Requests
/app/services/runs                 Service Runs
/app/services/runs/new             Create Service Run
/app/services/runs/:slug           Service Run Detail
/app/enforcement                   Enforcement Console
/app/n3/attention                  N3 Attention Queue
/app/n3/monitor/:runId             N3 Monitor Detail
/app/admin                         Admin Home
/app/admin/usage                   Usage Summary
/app/admin/certifications          Certifications
/app/admin/portals                 Portals Management
/app/admin/tenants                 Tenants Management
/app/operator                      Operator Home
/app/operator/emergency            Emergency Index
/app/operator/emergency/:runId     Emergency Run Detail
/app/operator/legal                Legal Holds Index
/app/operator/legal/:holdId        Legal Hold Detail
/app/operator/insurance            Insurance Index
/app/operator/insurance/claims/:id Insurance Claim Detail
/app/operator/disputes             Disputes Index
/app/operator/disputes/:id         Dispute Detail
/app/operator/authority            Authority Index
/app/operator/authority/grants/:id Authority Grant Detail
/app/operator/audit                Operator Audit
/app/availability                  Availability Console
/app/service-runs                  Service Runs (alt)
/app/services                      Services Directory
/app/bundles                       Bundles Browser
/app/directory                     Directory
/app/content                       Content Branding
/app/crm/places                    CRM Places
/app/crm/people                    CRM People
/app/crm/orgs                      CRM Organizations
/app/intake/work-requests          Work Request Intake
/app/projects                      Projects
/app/projects/:id                  Project Detail
/app/assets                        Assets
/app/assets/:id                    Asset Detail
/app/reservations                  Reservations
/app/reservations/:id              Reservation Detail
/app/proposals/:proposalId         Proposal Detail
/app/customers                     Customers
```

---

## TASK 2 — ROLE-TO-NAV MATRIX MAPPING

### Role Definitions
| Role | Description |
|------|-------------|
| **Guest** | Unauthenticated public user |
| **Participant** | Registered user making reservations |
| **Host** | Property/asset owner |
| **Operator** | Business operations staff |
| **Fleet Manager** | Vehicle/trailer fleet manager |
| **Crew** | Field workers/service providers |
| **Admin** | Tenant administrator |
| **Platform Admin** | Super-admin (CivOS staff) |

### Matrix: Expected vs Implemented

#### Guest / Public
| Expected | Route | Status |
|----------|-------|--------|
| Landing Page | / | ✅ Implemented |
| Portal Home | /p/:slug | ✅ Implemented |
| Community Portal | /c/:slug | ✅ Implemented |
| Browse Stays | /c/:slug/stay | ✅ Implemented |
| Browse Services | /c/:slug/services | ✅ Implemented |
| Job Listings | /b/:slug/jobs | ✅ Implemented |
| Job Detail | /b/:slug/jobs/:id | ✅ Implemented |
| Reserve Flow | /reserve/* | ✅ Implemented |
| Proposal View | /p/proposal/:id | ✅ Implemented |
| Trip Portal | /trip/:code | ✅ Implemented |

#### Participant
| Expected | Route | Status |
|----------|-------|--------|
| Dashboard | /app/dashboard | ✅ Implemented |
| My Reservations | /app/reservations | ✅ Implemented |
| Reservation Detail | /app/reservations/:id | ✅ Implemented |
| My Trips | /app/trips | ❌ Missing |
| Trip Detail | /app/trips/:id | ❌ Missing |
| My Messages | /app/messages | ❌ Missing |
| My Profile | /app/profile | ⚠️ Partial (via settings) |
| Apply for Job | /b/:slug/jobs/:id/apply | ✅ Implemented |

#### Host
| Expected | Route | Status |
|----------|-------|--------|
| Host Dashboard | /host/dashboard | ✅ Implemented |
| Properties | /host/properties | ✅ Implemented |
| Property Detail | /host/properties/:id | ✅ Implemented |
| Host Reservations | /host/reservations | ✅ Implemented |
| Host Calendar | /host/calendar | ✅ Implemented |
| Host Settings | /host/settings | ✅ Implemented |
| Host Payouts | /host/payouts | ✅ Implemented |

#### Operator
| Expected | Route | Status |
|----------|-------|--------|
| Operator Home | /app/operator | ✅ Implemented |
| Operations Board | /app/ops | ✅ Implemented |
| Housekeeping | /app/ops/housekeeping | ✅ Implemented |
| Incidents | /app/ops/incidents | ✅ Implemented |
| Parking View | /app/parking | ✅ Implemented |
| Parking Plan | /app/parking/plan | ✅ Implemented |
| Marina View | /app/marina | ✅ Implemented |
| Marina Plan | /app/marina/plan | ✅ Implemented |
| Emergency Runs | /app/operator/emergency | ✅ Implemented |
| Legal Holds | /app/operator/legal | ✅ Implemented |
| Insurance Claims | /app/operator/insurance | ✅ Implemented |
| Disputes | /app/operator/disputes | ✅ Implemented |
| Authority Grants | /app/operator/authority | ✅ Implemented |
| Audit Log | /app/operator/audit | ✅ Implemented |
| Enforcement | /app/enforcement | ✅ Implemented |
| N3 Attention | /app/n3/attention | ✅ Implemented |
| N3 Monitor | /app/n3/monitor/:id | ✅ Implemented |

#### Fleet Manager
| Expected | Route | Status |
|----------|-------|--------|
| Fleet Dashboard | /app/fleet | ❌ Missing |
| Vehicles | /app/fleet/vehicles | ❌ Missing |
| Vehicle Detail | /app/fleet/vehicles/:id | ❌ Missing |
| Trailers | /app/fleet/trailers | ❌ Missing |
| Assignments | /app/fleet/assignments | ❌ Missing |
| Maintenance | /app/fleet/maintenance | ❌ Missing |
| Transport Requests | /app/fleet/transport | ⚠️ Partial (in work-requests) |

#### Crew
| Expected | Route | Status |
|----------|-------|--------|
| Crew Dashboard | /app/crew | ❌ Missing |
| My Assignments | /app/crew/assignments | ❌ Missing |
| Available Shifts | /app/crew/shifts | ❌ Missing |
| Lodging | /app/crew/lodging | ⚠️ Partial (AccommodationSearch) |
| Time Entries | /app/crew/time | ❌ Missing |
| My Skills | /app/crew/skills | ❌ Missing |

#### Admin (Tenant)
| Expected | Route | Status |
|----------|-------|--------|
| Admin Home | /app/admin | ✅ Implemented |
| Usage Summary | /app/admin/usage | ✅ Implemented |
| Certifications | /app/admin/certifications | ✅ Implemented |
| Portals | /app/admin/portals | ✅ Implemented |
| Portal Appearance | /app/admin/portals/:id/appearance | ✅ Implemented |
| Tenants | /app/admin/tenants | ✅ Implemented |
| Users | /app/admin/users | ⚠️ Partial |
| Roles | /app/admin/roles | ❌ Missing |
| Settings | /app/admin/settings | ❌ Missing |
| Billing | /app/admin/billing | ❌ Missing |

#### Platform Admin (Super-Admin)
| Expected | Route | Status |
|----------|-------|--------|
| System Explorer | /app/system-explorer | ✅ Implemented |
| Impersonation | /app/admin/impersonation | ✅ Implemented |
| Feature Flags | /app/admin/feature-flags | ⚠️ Partial (API exists) |
| All Tenants | /platform/tenants | ❌ Missing |
| Platform Billing | /platform/billing | ❌ Missing |
| Platform Analytics | /platform/analytics | ❌ Missing |

---

## TASK 3 — GAP DELTA LIST

### 1. Backend Gaps (Tables exist, insufficient API coverage)

| Subsystem | Tables | Gap | Routes Missing |
|-----------|--------|-----|----------------|
| **Circles** | cc_coordination_circles, cc_circle_members, cc_circle_roles, cc_circle_delegations | Only 4 API endpoints for 7+ tables | GET/POST/DELETE /api/circles/*, delegation CRUD |
| **Fleet** | cc_fleets, cc_fleet_*_assignments (42 tables) | Fleet tables exist, thin API | Full fleet CRUD, assignment management |
| **Crew** | cc_crew_*, cc_lodging_links (8 tables) | Tables exist, no dedicated routes | /api/crew/*, shift management |
| **Time Entries** | cc_time_entries | Table exists, no API | /api/time-entries/* |
| **Folios** | cc_folios, cc_folio_ledger | API partial | Ledger reconciliation, split payments |

### 2. API Gaps (Required routes missing for known UI flows)

| Subsystem | Expected Route | HTTP | Purpose | Status |
|-----------|---------------|------|---------|--------|
| **Circles** | /api/circles | GET | List circles | ❌ Missing |
| **Circles** | /api/circles/:id | GET | Circle detail | ❌ Missing |
| **Circles** | /api/circles/:id/members | GET/POST | Manage members | ❌ Missing |
| **Circles** | /api/circles/:id/delegate | POST | Create delegation | ❌ Missing |
| **Fleet** | /api/fleet/vehicles | GET | List fleet vehicles | ❌ Missing |
| **Fleet** | /api/fleet/trailers | GET | List fleet trailers | ❌ Missing |
| **Fleet** | /api/fleet/assignments | GET/POST | Assignment management | ❌ Missing |
| **Crew** | /api/crew/assignments | GET | My assignments | ❌ Missing |
| **Crew** | /api/crew/shifts | GET | Available shifts | ❌ Missing |
| **Crew** | /api/crew/time | POST | Log time entry | ❌ Missing |
| **Messaging** | /api/messages/inbox | GET | Unified inbox | ⚠️ Partial |
| **Admin** | /api/admin/roles | GET/POST | Role management | ❌ Missing |
| **Platform** | /api/platform/tenants | GET | All tenants (super-admin) | ❌ Missing |

### 3. Frontend/UI Gaps (Required screens missing)

| Role | Missing Page | Expected Route | Priority |
|------|--------------|----------------|----------|
| **Participant** | My Trips | /app/trips | High |
| **Participant** | Trip Detail | /app/trips/:id | High |
| **Participant** | Messages Inbox | /app/messages | High |
| **Crew** | Crew Dashboard | /app/crew | High |
| **Crew** | My Assignments | /app/crew/assignments | High |
| **Crew** | Available Shifts | /app/crew/shifts | Medium |
| **Crew** | Time Entries | /app/crew/time | Medium |
| **Fleet Manager** | Fleet Dashboard | /app/fleet | High |
| **Fleet Manager** | Vehicles List | /app/fleet/vehicles | High |
| **Fleet Manager** | Vehicle Detail | /app/fleet/vehicles/:id | High |
| **Fleet Manager** | Trailers List | /app/fleet/trailers | Medium |
| **Fleet Manager** | Assignments | /app/fleet/assignments | Medium |
| **Fleet Manager** | Maintenance | /app/fleet/maintenance | Medium |
| **Admin** | Roles Management | /app/admin/roles | Medium |
| **Admin** | Settings | /app/admin/settings | Medium |
| **Admin** | Billing | /app/admin/billing | Medium |
| **Platform Admin** | Platform Tenants | /platform/tenants | Low |
| **Platform Admin** | Platform Analytics | /platform/analytics | Low |

### 4. Operator Workflow Gaps

| Workflow | Gap Description | Blocking Components |
|----------|-----------------|---------------------|
| **Circle Delegation** | Cannot delegate authority to circle members | Missing: Circles API, Circles UI |
| **Fleet Assignment** | Cannot assign vehicles/trailers to runs | Missing: Fleet API, Fleet UI |
| **Crew Scheduling** | Cannot schedule crew for service runs | Missing: Crew UI, Shift APIs |
| **Time Tracking** | Cannot log billable time | Missing: Time API, Time UI |
| **Unified Messaging** | No central inbox for all conversations | Missing: Messages UI |
| **Folio Management** | No dedicated folio/ledger UI | Missing: Folios UI |
| **Role Assignment** | Cannot manage custom roles | Missing: Roles API, Roles UI |

---

## TASK 4 — PRIORITIZED COMPLETION PLAN

### Phase P-UI-13: Participant Experience Completion
**Priority: HIGH | Effort: Medium**

1. **P-UI-13a: My Trips Page**
   - Route: /app/trips
   - Tables: cc_trips, cc_trip_participants
   - API: GET /api/trips/mine (exists), UI missing

2. **P-UI-13b: Trip Detail Page**
   - Route: /app/trips/:id
   - Tables: cc_trip_*, cc_trip_itinerary_items
   - API: GET /api/trips/:id (exists), UI missing

3. **P-UI-13c: Messages Inbox**
   - Route: /app/messages
   - Tables: cc_conversations, cc_messages
   - API: Enhance /api/conversations for unified inbox

### Phase P-UI-14: Crew Management Module
**Priority: HIGH | Effort: High**

1. **P-UI-14a: Crew Dashboard**
   - Route: /app/crew
   - Tables: cc_crew_assignments, cc_crew_roles
   - API: GET /api/crew/dashboard

2. **P-UI-14b: Crew Assignments**
   - Route: /app/crew/assignments
   - Tables: cc_crew_assignments
   - API: GET/POST /api/crew/assignments

3. **P-UI-14c: Available Shifts**
   - Route: /app/crew/shifts
   - Tables: cc_service_run_members
   - API: GET /api/crew/shifts

4. **P-UI-14d: Time Entry**
   - Route: /app/crew/time
   - Tables: cc_time_entries
   - API: GET/POST /api/crew/time

### Phase P-UI-15: Fleet Management Module
**Priority: MEDIUM | Effort: High**

1. **P-UI-15a: Fleet Dashboard**
   - Route: /app/fleet
   - Tables: cc_fleets
   - API: GET /api/fleet/summary

2. **P-UI-15b: Vehicles Management**
   - Route: /app/fleet/vehicles, /app/fleet/vehicles/:id
   - Tables: cc_vehicles, cc_fleet_vehicle_assignments
   - API: CRUD /api/fleet/vehicles

3. **P-UI-15c: Trailers Management**
   - Route: /app/fleet/trailers
   - Tables: cc_trailers, cc_fleet_trailer_assignments
   - API: CRUD /api/fleet/trailers

4. **P-UI-15d: Assignments Board**
   - Route: /app/fleet/assignments
   - Tables: cc_fleet_*_assignments
   - API: GET/POST /api/fleet/assignments

5. **P-UI-15e: Maintenance Tracker**
   - Route: /app/fleet/maintenance
   - Tables: cc_maintenance_records, cc_maintenance_requests
   - API: GET/POST /api/fleet/maintenance

### Phase P-UI-16: Circles & Delegation Module
**Priority: MEDIUM | Effort: Medium**

1. **P-UI-16a: Circles Dashboard**
   - Route: /app/circles (exists, enhance)
   - Tables: cc_coordination_circles
   - API: GET /api/circles

2. **P-UI-16b: Circle Detail**
   - Route: /app/circles/:id
   - Tables: cc_circle_members, cc_circle_roles
   - API: GET /api/circles/:id

3. **P-UI-16c: Member Management**
   - Route: /app/circles/:id/members
   - Tables: cc_circle_members
   - API: GET/POST/DELETE /api/circles/:id/members

4. **P-UI-16d: Delegation Management**
   - Route: /app/circles/:id/delegations
   - Tables: cc_circle_delegations
   - API: GET/POST /api/circles/:id/delegations

### Phase P-UI-17: Admin Enhancement
**Priority: LOW | Effort: Medium**

1. **P-UI-17a: Roles Management**
   - Route: /app/admin/roles
   - Tables: cc_roles, cc_permissions
   - API: CRUD /api/admin/roles

2. **P-UI-17b: Settings Page**
   - Route: /app/admin/settings
   - Tables: cc_portal_settings, cc_tenant_*
   - API: GET/PUT /api/admin/settings

3. **P-UI-17c: Folio/Ledger UI**
   - Route: /app/admin/folios
   - Tables: cc_folios, cc_folio_ledger
   - API: Exists, UI missing

### Phase P-UI-18: Platform Admin (Super-Admin)
**Priority: LOW | Effort: Medium**

1. **P-UI-18a: Platform Tenants View**
   - Route: /platform/tenants
   - Tables: cc_tenants
   - API: GET /api/platform/tenants

2. **P-UI-18b: Feature Flags UI**
   - Route: /platform/feature-flags
   - Tables: cc_feature_flags
   - API: Exists, UI missing

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total cc_* Tables | 515 |
| Total Route Files | 104 |
| Total API Endpoints | ~1,174 |
| Total UI Pages | 159 |
| Roles Fully Complete | 3 (Guest, Host, Operator) |
| Roles Partially Complete | 4 (Participant, Admin, Fleet Manager, Crew) |
| Critical UI Gaps | 12 pages |
| Critical API Gaps | 15 endpoints |
| Phases Required | 6 (P-UI-13 through P-UI-18) |

**Patent-Frozen Components (DO NOT MODIFY):**
- CC-01: N3 Service Run Monitor + Replan Engine
- CC-02: V3.5 Surface Spine

---

*Generated: 2026-01-19 | V3.5 Certification Suite*

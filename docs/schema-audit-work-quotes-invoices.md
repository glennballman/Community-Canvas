# Schema Audit: Work Orders, Quotes, and Invoices

**Audit Date:** 2026-01-27  
**Purpose:** Understand how Community Canvas handles work orders, quotes, and invoices for the authorization framework capability domains.

---

## Part 1: Service Runs Analysis

### 1a. cc_service_runs Structure

```sql
column_name                 | data_type              | is_nullable
----------------------------|------------------------|------------
id                          | uuid                   | NO
company_id                  | uuid                   | YES
company_name                | character varying      | NO
service_type                | character varying      | NO
destination_region          | character varying      | NO
planned_date                | date                   | NO
planned_duration_days       | integer                | YES (default 1)
flexible_dates              | boolean                | YES (default false)
date_flexibility_days       | integer                | YES (default 0)
total_job_slots             | integer                | NO
slots_filled                | integer                | YES (default 0)
crew_size                   | integer                | YES
crew_lead_name              | character varying      | YES
vehicle_id                  | uuid                   | YES
vehicle_description         | character varying      | YES
logistics_cost_total        | numeric                | YES
minimum_job_value           | numeric                | YES
status                      | character varying      | YES (default 'planning')
published_at                | timestamp with tz      | YES
confirmed_at                | timestamp with tz      | YES
reservation_deadline        | date                   | YES
contact_email               | character varying      | YES
contact_telephone           | character varying      | YES
reservation_notes           | text                   | YES
created_at                  | timestamp with tz      | YES
updated_at                  | timestamp with tz      | YES
```

**Purpose:** Represents a contractor's planned service trip to a region. Contains slots for individual jobs to bundle together.

### 1b. Service Run Related Tables

```
cc_service_run_members
cc_service_run_reservations
cc_service_run_response_resolutions
cc_service_run_schedule_proposals
cc_service_run_stakeholder_responses
cc_service_run_stakeholders
cc_service_runs
cc_shared_service_runs
cc_sr_service_runs
```

### 1c. cc_sr_* Tables (Service Run Domain)

```
cc_sr_access_requirements       cc_sr_service_access_requirements
cc_sr_bundle_items              cc_sr_service_addons
cc_sr_bundle_pricing            cc_sr_service_categories
cc_sr_bundle_seasonality        cc_sr_service_certifications
cc_sr_bundles                   cc_sr_service_compatibility
cc_sr_certifications            cc_sr_service_constraints
cc_sr_climate_regions           cc_sr_service_dependencies
cc_sr_communities               cc_sr_service_mobilization
cc_sr_community_bundles         cc_sr_service_pricing
cc_sr_constraints               cc_sr_service_requirements
cc_sr_contractor_bids           cc_sr_service_runs
cc_sr_mobilization_classes      cc_sr_service_seasonality
cc_sr_pricing_models            cc_sr_service_slots
cc_sr_property_tools            cc_sr_service_tool_requirements
cc_sr_provider_tools            cc_sr_services
cc_sr_requirement_items         cc_sr_skills
cc_sr_requirement_sets          cc_sr_tools
cc_sr_run_type_services
cc_sr_run_types
```

### 1d. cc_sr_service_runs (The V2 Service Run)

```sql
column_name                 | data_type              | is_nullable
----------------------------|------------------------|------------
id                          | uuid                   | NO
title                       | text                   | NO
slug                        | text                   | NO
description                 | text                   | YES
run_type_id                 | uuid                   | YES
bundle_id                   | uuid                   | YES
community_id                | uuid                   | YES
service_area_description    | text                   | YES
initiator_type              | text                   | NO
initiator_user_id           | uuid                   | YES
initiator_tenant_id         | uuid                   | YES
target_start_date           | date                   | YES
target_end_date             | date                   | YES
flexible_dates              | boolean                | YES
min_slots                   | integer                | YES
max_slots                   | integer                | YES
current_slots               | integer                | YES
status                      | text                   | NO
bidding_opens_at            | timestamp with tz      | YES
bidding_closes_at           | timestamp with tz      | YES
winning_bid_id              | uuid                   | YES
estimated_mobilization_cost | numeric                | YES
mobilization_cost_per_slot  | numeric                | YES
allow_resident_exclusions   | boolean                | YES
require_photos              | boolean                | YES
require_deposit             | boolean                | YES
deposit_amount              | numeric                | YES
cancellation_policy         | text                   | YES
created_at                  | timestamp with tz      | YES
updated_at                  | timestamp with tz      | YES
published_at                | timestamp with tz      | YES
confirmed_at                | timestamp with tz      | YES
completed_at                | timestamp with tz      | YES
```

**Purpose:** V2 Service Run with bidding support. Initiated by community or tenant, contractors bid on it.

---

## Part 2: N3 Runs (V3 Service Runs)

### N3 Tables

```
cc_n3_effective_capacity_evaluations
cc_n3_execution_attestations
cc_n3_execution_contracts
cc_n3_execution_receipts
cc_n3_execution_verifications
cc_n3_run_execution_handoffs
cc_n3_run_maintenance_requests
cc_n3_run_readiness_snapshots
cc_n3_runs
cc_n3_segments
cc_n3_surface_requirements
```

### cc_n3_runs Structure

```sql
column_name         | data_type              | is_nullable
--------------------|------------------------|------------
id                  | uuid                   | NO
tenant_id           | uuid                   | NO
name                | text                   | NO
description         | text                   | YES
status              | text                   | NO
starts_at           | timestamp with tz      | YES
ends_at             | timestamp with tz      | YES
metadata            | jsonb                  | YES
created_at          | timestamp with tz      | NO
updated_at          | timestamp with tz      | NO
portal_id           | uuid                   | YES
zone_id             | uuid                   | YES
market_mode         | text                   | YES
start_address_id    | uuid                   | YES
```

**Purpose:** V3 lightweight service runs for the N3 Service Run Monitor + Replan Engine.

---

## Part 3: Projects Analysis

### cc_projects Structure

```sql
column_name             | data_type              | is_nullable
------------------------|------------------------|------------
id                      | uuid                   | NO
tenant_id               | uuid                   | NO
title                   | character varying      | NO
description             | text                   | YES
person_id               | uuid                   | YES
organization_id         | uuid                   | YES
property_id             | uuid                   | YES
unit_id                 | uuid                   | YES
location_text           | character varying      | YES
status                  | USER-DEFINED           | YES (default 'lead')
quoted_amount           | numeric                | YES
final_amount            | numeric                | YES
deposit_required        | numeric                | YES
deposit_received        | boolean                | YES
deposit_received_at     | timestamp with tz      | YES
quoted_at               | timestamp with tz      | YES
approved_at             | timestamp with tz      | YES
scheduled_start         | date                   | YES
scheduled_end           | date                   | YES
started_at              | timestamp with tz      | YES
completed_at            | timestamp with tz      | YES
invoiced_at             | timestamp with tz      | YES
paid_at                 | timestamp with tz      | YES
warranty_months         | integer                | YES (default 12)
warranty_expires_at     | date                   | YES
warranty_notes          | text                   | YES
parent_project_id       | uuid                   | YES
service_run_id          | uuid                   | YES
source_work_request_id  | uuid                   | YES
source                  | character varying      | YES
settlement_type         | character varying      | YES
settlement_notes        | text                   | YES
created_at              | timestamp with tz      | YES
created_by_actor_id     | uuid                   | NO
updated_at              | timestamp with tz      | YES
portal_id               | uuid                   | NO
csi_division            | character varying      | YES
csi_section             | character varying      | YES
budget                  | numeric                | YES
actual_cost             | numeric                | YES
```

### Project-Related Tables

```
cc_project_line_items
cc_project_notes
cc_project_photos
cc_project_scope_snapshots
cc_projects
```

**Purpose:** Projects are the **tenant-owned work container**. They have:
- Customer linkage (person, organization, property)
- Quoting lifecycle (quoted_amount, quoted_at, approved_at)
- Execution lifecycle (scheduled, started, completed)
- Billing lifecycle (invoiced_at, paid_at)
- Optional service_run_id linkage
- Source work_request_id for lead conversion

---

## Part 4: Work Requests & Work Orders

### Work Request Tables

```
cc_work_request_measurements
cc_work_request_media
cc_work_request_notes
cc_work_requests
```

### cc_work_requests Structure (Lead/Inquiry)

```sql
column_name               | data_type              | is_nullable
--------------------------|------------------------|------------
id                        | uuid                   | NO
tenant_id                 | uuid                   | NO
contact_channel_value     | character varying      | NO
contact_channel_type      | character varying      | YES
contact_channel_notes     | text                   | YES
person_id                 | uuid                   | YES
organization_id           | uuid                   | YES
property_id               | uuid                   | YES
unit_id                   | uuid                   | YES
location_text             | character varying      | YES
summary                   | text                   | YES
description               | text                   | YES
category                  | character varying      | YES
priority                  | character varying      | YES
source                    | character varying      | YES
referral_source           | character varying      | YES
status                    | USER-DEFINED           | YES
converted_to_project_id   | uuid                   | YES
converted_at              | timestamp with tz      | YES
converted_by_actor_id     | uuid                   | YES
closed_reason             | character varying      | YES
created_at                | timestamp with tz      | YES
created_by_actor_id       | uuid                   | NO
updated_at                | timestamp with tz      | YES
answering_as_tenant_id    | uuid                   | YES
portal_id                 | uuid                   | NO
csi_division              | character varying      | YES
csi_section               | character varying      | YES
estimated_cost            | numeric                | YES
actual_cost               | numeric                | YES
zone_id                   | uuid                   | YES
coordination_intent       | boolean                | NO
```

**Purpose:** Work Requests are **inbound leads/inquiries**. They convert to Projects via `converted_to_project_id`.

### Work Order Tables

```
cc_work_order_materials
cc_work_order_requirements
cc_work_orders
```

### cc_work_orders Structure (Community Work Orders)

```sql
column_name                   | data_type              | is_nullable
------------------------------|------------------------|------------
id                            | uuid                   | NO
work_order_ref                | character varying      | YES
community_id                  | uuid                   | NO
site_description              | text                   | YES
site_latitude                 | numeric                | YES
site_longitude                | numeric                | YES
title                         | text                   | NO
description                   | text                   | YES
service_bundle_id             | uuid                   | YES
scope_of_work                 | text                   | YES
customer_type                 | text                   | YES
customer_tenant_id            | uuid                   | YES
customer_individual_id        | uuid                   | YES
customer_contact_name         | text                   | YES
customer_contact_email        | text                   | YES
customer_contact_telephone    | text                   | YES
weather_window                | jsonb                  | NO
estimated_duration_days       | integer                | YES
crew_size_min                 | integer                | YES
crew_size_max                 | integer                | YES
required_certifications       | ARRAY                  | YES
estimated_cost                | numeric                | YES
quoted_price                  | numeric                | YES
deposit_required              | numeric                | YES
deposit_received              | numeric                | YES
status                        | text                   | YES
awarded_to_tenant_id          | uuid                   | YES
awarded_at                    | timestamp with tz      | YES
is_bundleable                 | boolean                | YES
bundle_id                     | uuid                   | YES
created_by                    | uuid                   | YES
created_at                    | timestamp with tz      | YES
updated_at                    | timestamp with tz      | YES
contract_id                   | uuid                   | YES
phase_status                  | USER-DEFINED           | YES
finance_status                | text                   | YES
baseline_estimate_version_id  | uuid                   | YES
work_request_id               | uuid                   | YES
```

**Purpose:** Work Orders are **community-initiated work** that gets awarded to contractors. They have:
- Community ownership (not tenant)
- Bidding/award workflow (awarded_to_tenant_id)
- Contract linkage

---

## Part 5: Quotes/Estimates/Bids

### Quote-Related Tables

```
cc_bid_breakdown_lines
cc_bid_messages
cc_bids
cc_estimate_allowances
cc_estimate_line_items
cc_estimate_versions
cc_estimates
cc_ingestion_quote_links
cc_materials_quotes
cc_quote_drafts
cc_sr_contractor_bids
shared_mobilization_estimates
```

### cc_estimates Structure

```sql
column_name       | data_type              | is_nullable
------------------|------------------------|------------
id                | uuid                   | NO
estimate_ref      | character varying      | YES
work_request_id   | uuid                   | YES
work_order_id     | uuid                   | YES
party_id          | uuid                   | YES
tenant_id         | uuid                   | YES
title             | text                   | NO
description       | text                   | YES
status            | USER-DEFINED           | NO
created_by        | uuid                   | YES
created_at        | timestamp with tz      | YES
updated_at        | timestamp with tz      | YES
```

**Purpose:** Formal estimates for work requests or work orders. Has versioning via `cc_estimate_versions`.

### cc_quote_drafts Structure

```sql
column_name            | data_type              | is_nullable
-----------------------|------------------------|------------
id                     | uuid                   | NO
tenant_id              | uuid                   | YES
contractor_profile_id  | uuid                   | YES
source_ingestion_id    | uuid                   | YES
portal_id              | uuid                   | YES
zone_id                | uuid                   | YES
customer_name          | text                   | YES
customer_phone         | text                   | YES
customer_email         | text                   | YES
address_text           | text                   | YES
geo_lat                | numeric                | YES
geo_lng                | numeric                | YES
category               | character varying      | YES
scope_summary          | text                   | YES
scope_details          | jsonb                  | NO
base_estimate          | numeric                | YES
line_items             | jsonb                  | NO
materials              | jsonb                  | NO
notes                  | text                   | YES
computed_payload       | jsonb                  | NO
status                 | character varying      | NO
conversation_id        | integer                | YES
opportunity_preferences| jsonb                  | NO
source_mode            | character varying      | YES
created_at             | timestamp with tz      | NO
updated_at             | timestamp with tz      | NO
published_at           | timestamp with tz      | YES
archived_at            | timestamp with tz      | YES
```

**Purpose:** Draft quotes from ingestion/AI. Used in A2.5 Event Mode for lead capture.

### cc_bids Structure (Procurement Bids)

```sql
column_name             | data_type              | is_nullable
------------------------|------------------------|------------
id                      | uuid                   | NO
bid_ref                 | character varying      | YES
procurement_request_id  | uuid                   | NO
party_id                | uuid                   | NO
estimate_id             | uuid                   | YES
status                  | USER-DEFINED           | NO
bid_amount              | numeric                | YES
proposed_start_date     | date                   | YES
proposed_duration_days  | integer                | YES
technical_proposal      | text                   | YES
methodology             | text                   | YES
team_composition        | jsonb                  | YES
exceptions              | text                   | YES
clarifications          | text                   | YES
score_technical         | numeric                | YES
score_price             | numeric                | YES
score_overall           | numeric                | YES
evaluation_notes        | text                   | YES
submitted_at            | timestamp with tz      | YES
evaluated_at            | timestamp with tz      | YES
evaluated_by            | uuid                   | YES
created_at              | timestamp with tz      | YES
updated_at              | timestamp with tz      | YES
```

**Purpose:** Formal bids for procurement requests. Has scoring.

---

## Part 6: Invoices/Billing/Financial

### Invoice-Related Tables

```
cc_community_charges
```

Note: There is NO `cc_invoices` table. Invoicing is tracked via:
- `cc_projects.invoiced_at` / `cc_projects.paid_at`
- `cc_folio_ledger` for line-by-line charges

### Wallet/Ledger/Payment Tables

```
cc_activity_ledger
cc_contract_payment_schedule
cc_favor_ledger
cc_financing_repayments
cc_folio_ledger
cc_folio_ledger_links
cc_ledger_entries
cc_payment_events
cc_payment_methods
cc_payment_milestones
cc_payment_promises
cc_payment_references
cc_transaction_lines
cc_transactions
cc_wallet_accounts
cc_wallet_balance_snapshots
cc_wallet_entries
cc_wallet_holds
```

### cc_folio_ledger Structure

```sql
column_name         | data_type              | is_nullable
--------------------|------------------------|------------
id                  | uuid                   | NO
tenant_id           | uuid                   | NO
folio_id            | uuid                   | NO
entry_type          | USER-DEFINED           | NO
reference_type      | text                   | YES
reference_id        | uuid                   | YES
reverses_entry_id   | uuid                   | YES
description         | text                   | NO
amount_cents        | integer                | NO
currency            | text                   | NO
tax_rule_id         | uuid                   | YES
tax_rate_pct        | numeric                | YES
service_date        | date                   | YES
posted_by           | uuid                   | YES
posted_at           | timestamp with tz      | NO
payment_method      | text                   | YES
payment_reference   | text                   | YES
entry_hash          | text                   | YES
sequence_number     | integer                | NO
```

**Entry Types:** charge, payment, adjustment, reversal, tax, deposit, refund

### cc_wallet_accounts Structure

```sql
column_name              | data_type              | is_nullable
-------------------------|------------------------|------------
id                       | uuid                   | NO
tenant_id                | uuid                   | NO
account_name             | text                   | NO
party_id                 | uuid                   | YES
individual_id            | uuid                   | YES
currency                 | text                   | NO
status                   | USER-DEFINED           | NO
posted_balance_cents     | bigint                 | NO
available_balance_cents  | bigint                 | NO
active_holds_cents       | bigint                 | NO
next_sequence_number     | integer                | NO
metadata                 | jsonb                  | YES
created_at               | timestamp with tz      | NO
updated_at               | timestamp with tz      | NO
```

**Purpose:** V3 Stored Value Stack for stored-value/wallet accounting.

---

## Part 7: Reservations ↔ Service Runs

### cc_reservations Links

```sql
service_run_id          | uuid                   | YES
trip_id                 | uuid                   | YES
```

Reservations can optionally link to a service run or trip.

### cc_service_runs Links

No direct reservation linkage in cc_service_runs. The relationship is:
- `cc_service_run_reservations` (junction table)
- `cc_reservations.service_run_id`

---

## Part 8: Assignment/Dispatch Tables

```
cc_contract_payment_schedule
cc_crew_assignments
cc_enforcement_fine_schedule
cc_equipment_assignments
cc_fleet_trailer_assignments
cc_fleet_vehicle_assignments
cc_monetization_plan_assignments
cc_operator_role_assignments
cc_resource_schedule_events
cc_sailing_schedules
cc_schedules
cc_service_run_schedule_proposals
cc_transport_schedules
cc_vehicle_driver_assignments
```

Key assignment tables:
- `cc_crew_assignments` - Crew members to work
- `cc_equipment_assignments` - Equipment to jobs
- `cc_vehicle_driver_assignments` - Drivers to vehicles

---

## Summary: Work Flow Patterns

### Pattern A: Tenant-Initiated Work (Contractor CRM)
```
Work Request → Project → (Line Items, Photos, Notes) → Invoiced → Paid
     ↓
  Estimate
```

### Pattern B: Community-Initiated Work (Marketplace)
```
Work Order → Bids → Award → Contract → Execution
     ↓           ↓
 Estimates    cc_sr_contractor_bids
```

### Pattern C: Service Run Bundling (Shared Services)
```
Service Run → Slots → Reservations (bundled jobs)
     ↓
  cc_sr_service_runs (V2) or cc_n3_runs (V3)
```

### Pattern D: Procurement
```
Procurement Request → Bids → Award → Contract
```

---

## Recommended Capability Domains

Based on this audit, the authorization framework should use these capability domains:

| Domain | Tables | Description |
|--------|--------|-------------|
| `work_requests` | cc_work_requests, cc_work_request_* | Inbound leads/inquiries |
| `projects` | cc_projects, cc_project_* | Tenant-owned work containers |
| `work_orders` | cc_work_orders, cc_work_order_* | Community-issued work |
| `estimates` | cc_estimates, cc_estimate_* | Formal pricing documents |
| `quotes` | cc_quote_drafts, cc_materials_quotes | Draft/informal quotes |
| `bids` | cc_bids, cc_bid_*, cc_sr_contractor_bids | Competitive bids |
| `service_runs` | cc_service_runs, cc_sr_service_runs, cc_n3_runs | Bundled service trips |
| `reservations` | cc_reservations, cc_reservation_* | Bookings/holds |
| `folios` | cc_folio_ledger, cc_folio_* | Guest/customer accounts |
| `wallets` | cc_wallet_accounts, cc_wallet_* | Stored value accounts |
| `payments` | cc_payment_*, cc_transactions | Payment processing |
| `contracts` | cc_contracts, cc_contract_* | Legal agreements |

---

## Key Terminology Findings

1. **No "invoices" table** - Invoicing is a status on Projects (`invoiced_at`)
2. **"Estimates" vs "Quotes"** - Estimates are formal (versioned), Quote Drafts are informal (from ingestion)
3. **"Work Orders" vs "Projects"** - Work Orders are community-owned, Projects are tenant-owned
4. **Three Service Run Systems:**
   - `cc_service_runs` (V1 - simple)
   - `cc_sr_service_runs` (V2 - with bidding)
   - `cc_n3_runs` (V3 - lightweight, for N3 engine)
5. **"Bids" exist in two places:**
   - `cc_bids` - for procurement
   - `cc_sr_contractor_bids` - for service runs

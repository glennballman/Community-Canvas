# Business Logic Audit: Work, Quote, Bid, Contract & Reservation Systems

**Audit Date:** 2026-01-27  
**Purpose:** Understand the BUSINESS PURPOSE of each system, not just technical structure.

---

## Executive Summary

| System | Rows | Status | Purpose |
|--------|------|--------|---------|
| cc_work_orders | 0 | Speculative | Community-issued competitive work |
| cc_procurement_requests | 5 | Active | Formal RFP/bid process for communities |
| cc_bids | 0 | Infrastructure ready | Responses to procurement requests |
| cc_estimates | 0 | Infrastructure ready | Formal versioned pricing documents |
| cc_quote_drafts | 1 | Active | AI/ingestion informal quotes |
| cc_contracts | 0 | Infrastructure ready | Legal agreements from bids |
| cc_work_requests | 0 | Infrastructure ready | Tenant lead/inquiry intake |
| cc_projects | 0 | Infrastructure ready | Tenant work containers |
| cc_reservations | 7 | **Active** | Asset/service bookings |
| cc_communities | 3 | Active | Geographic work areas |

---

## Part 1: Work Orders - What Are They?

### Data Status
- **Rows:** 0 (no data)
- **Code References:** Schema-ready but not actively used

### Structure Analysis
```
community_id           → Links to cc_communities (WHO issues it)
customer_tenant_id     → The beneficiary tenant
customer_individual_id → Or an individual customer
awarded_to_tenant_id   → WHO wins the work
contract_id            → Links to formal contract
work_request_id        → Source lead (optional)
```

### Business Purpose

**Work Orders are COMMUNITY-ISSUED competitive work opportunities.**

The flow is:
1. A **community** (geographic region like Bamfield) creates a work order
2. The work order describes a job at a specific site
3. **Contractors bid** for the work
4. Community **awards** to a contractor (`awarded_to_tenant_id`)
5. A **contract** is created from the award

This is the **marketplace model** where communities act as intermediaries.

### Vs. Procurement Requests

**cc_procurement_requests** appears to be the ACTIVE version of this concept:
- Has 5 rows with real data
- Similar structure (community-issued, bid-based)
- Has `intake_mode` = 'bid' indicating bidding workflow

**Recommendation:** `cc_work_orders` may be a parallel/older design. `cc_procurement_requests` appears more complete and is actively used.

---

## Part 2: Bids vs Estimates - What's the Difference?

### cc_bids (Procurement Response)

**Rows:** 0  
**Links to:** `procurement_request_id` (required), `party_id`, `estimate_id`

```
bid_ref                → Reference number
procurement_request_id → What RFP is this responding to
party_id               → Who is bidding (contractor party)
estimate_id            → Optional linked estimate
bid_amount             → Price offered
technical_proposal     → Proposal text
methodology            → How they'll do it
score_technical        → Evaluation score
score_price            → Evaluation score
status                 → draft/submitted/accepted/rejected
```

**Business Purpose:** A **formal response to an RFP**. Bids are competitive, evaluated, scored, and one gets selected.

### cc_estimates (Pricing Document)

**Rows:** 0  
**Links to:** `work_request_id` OR `work_order_id`, `tenant_id`

```
estimate_ref    → Reference number
work_request_id → For tenant work requests
work_order_id   → For community work orders
tenant_id       → Who created it
status          → draft/submitted/approved/rejected/superseded
```

**Related Tables:**
- `cc_estimate_line_items` - Individual line items
- `cc_estimate_versions` - Version history
- `cc_estimate_allowances` - Contingencies

**Business Purpose:** A **formal pricing document** that can be versioned and approved. Estimates are created by contractors for specific work requests/orders.

### Key Difference

| Aspect | Bid | Estimate |
|--------|-----|----------|
| **Trigger** | Response to RFP | Response to any work |
| **Competition** | Always competitive | May be sole-source |
| **Scoring** | Has evaluation scores | No scoring |
| **Versioning** | One version | Multiple versions |
| **Scope** | Includes technical proposal, methodology | Just pricing |

---

## Part 3: Quote Drafts vs Estimates

### cc_quote_drafts (AI/Ingestion Quotes)

**Rows:** 1 (active!)  

Sample data:
```
customer_name: "Test Customer RBZSbY"
category: "Landscaping"
scope_summary: "Need lawn mowing and hedge trimming"
scope_details: {}
line_items: []
materials: []
status: "draft"
source_mode: "worksite_upload"
```

**Links to:**
- `source_ingestion_id` - From AI ingestion
- `contractor_profile_id` - Which contractor
- `portal_id`, `zone_id` - Location context
- `conversation_id` - Chat thread

**Business Purpose:** **Informal/AI-generated quotes** from the ingestion pipeline. These are:
- Created from sticky notes, photos, conversations
- Unstructured (JSONB for flexibility)
- Used in A2.5 Event Mode for lead capture
- NOT versioned like estimates

### Lifecycle Flow

```
Quote Draft (informal, AI-generated)
    ↓
    (contractor reviews, refines)
    ↓
Estimate (formal, versioned)
    ↓
    (customer approves)
    ↓
Project (work begins)
```

**Quote drafts do NOT directly become estimates.** They are separate systems:
- Quote drafts = **lead capture tool**
- Estimates = **formal pricing documents**

---

## Part 4: Contracts - What Are They?

### cc_contracts Structure

**Rows:** 0  

```
contract_ref              → Reference number
work_request_id           → Source work request (optional)
bid_id                    → Source bid (typically how contracts are created)
owner_tenant_id           → Who owns the work (customer)
contractor_party_id       → Who does the work
contract_type             → Type of contract
contract_value            → Original value
approved_changes          → Change order value
current_value             → Total value
retention_percent         → Holdback percentage
holdback_percent          → Additional holdback
status                    → draft/pending_signature/active/complete/terminated
```

**Related Tables:**
- `cc_contract_payment_schedule` - Payment milestones
- `cc_n3_execution_contracts` - Execution tracking

### Business Purpose

**Contracts are the LEGAL AGREEMENT that results from accepting a bid.**

Flow:
```
Procurement Request → Bid (accepted) → Contract → Execution
```

Contracts formalize:
- Scope of work
- Payment terms
- Start/completion dates
- Warranty terms
- Holdbacks/retention

---

## Part 5: Work Requests → Projects Flow

### cc_work_requests (Lead Intake)

**Rows:** 0  
**Purpose:** Tenant inbound leads/inquiries

```
contact_channel_value → How they contacted (phone, email, etc.)
summary              → Brief description
description          → Full details
category             → Type of work
priority             → Urgency
status               → lead/contacted/quoted/converted/closed
converted_to_project_id → Links to project when converted
```

### cc_projects (Work Container)

**Rows:** 0  
**Purpose:** Tenant-owned work being executed

```
source_work_request_id → Where it came from
quoted_amount          → Price quoted
final_amount           → Actual price
status                 → lead/quoted/approved/scheduled/in_progress/completed/invoiced/paid
invoiced_at            → When invoiced
paid_at                → When paid
```

### Flow

```
Work Request (lead)
    ↓ [convert]
Project (work container)
    ↓
    status: lead → quoted → approved → scheduled → in_progress → completed → invoiced → paid
```

**These ARE different things:**
- **Work Request** = Inbound inquiry (CRM lead)
- **Project** = Active work with full lifecycle

Work requests can be closed without becoming projects (rejected leads).

---

## Part 6: Service Runs → Reservations

### cc_reservations

**Rows:** 7 (active!)  

Sample:
```
confirmation_number: SAV-2026-G5DCP2
asset_id: 16e68c76-...
primary_guest_name: Glenn Tester
start_date: 2026-01-09
end_date: 2026-01-10
status: pending
reservation_context: direct
schema_type: Reservation
```

### Relationship to Service Runs

`cc_reservations.service_run_id` can optionally link a reservation to a service run.

**Business Purpose:**
- **Reservations** = Bookings for assets (accommodations, parking, equipment)
- **Service Runs** = Bundled service trips (contractors visiting remote areas)

When a service run is created, residents can **reserve a slot** on that run. The reservation represents their booking of the contractor's services.

### Service Run Stakeholders

```
cc_service_run_stakeholders
├── run_id (which run)
├── stakeholder_individual_id (who)
├── stakeholder_role (their role)
└── status (active/revoked)
```

**Stakeholders** are people with an interest in a service run:
- Property owners whose properties will be serviced
- Organizers who coordinate the run
- Possibly contractors

---

## Part 7: Communities - What Are They?

### cc_communities

**Rows:** 3 (active!)  

```
id          | name      | slug
------------|-----------|----------
94ff80f1... | Bamfield  | bamfield
12fe1824... | Tofino    | tofino
721d8ec9... | Ucluelet  | ucluelet
```

### Structure

```
name              → Community name
slug              → URL-friendly identifier
region_name       → Geographic region
province          → Province/state
latitude/longitude → Coordinates
is_remote         → Is it remote?
access_notes      → How to get there
portal_id         → Associated portal
```

### What Links to Communities?

```
cc_jobs                 → community_id
cc_activity_events      → community_id
cc_record_bundles       → community_id
cc_contemporaneous_notes→ community_id
cc_incident_prompts     → community_id
cc_incident_responses   → community_id
cc_work_orders          → community_id
cc_procurement_requests → community_id (via owner context)
```

### Business Purpose

**Communities are GEOGRAPHIC SERVICE AREAS** in remote BC locations.

They represent:
- Remote towns/settlements (Bamfield, Tofino, Ucluelet)
- Areas that need coordinated contractor services
- Places where service bundling makes sense due to logistics

**Why would a community "issue" work orders?**

In remote areas, individual homeowners may not have enough work to justify a contractor trip. The **community** acts as an aggregator:
1. Collect work needs from residents
2. Bundle into work orders
3. Put out for competitive bid
4. Award to contractor who will service the community

This is the **shared services** or **community coordination** model.

---

## Part 8: Recommendations

### Truly Separate Domains

| Domain | Tables | Rationale |
|--------|--------|-----------|
| **Reservations** | cc_reservations, cc_reservation_* | Distinct booking lifecycle |
| **Service Runs** | cc_n3_runs, cc_n3_* | Distinct trip/bundling lifecycle |
| **Communities** | cc_communities | Geographic reference data |
| **Wallets** | cc_wallet_accounts, cc_wallet_* | Financial accounting |
| **Folios** | cc_folio_ledger, cc_folios | Guest accounts |

### Lifecycle Stages (Same Domain)

| Domain | Stages | Tables |
|--------|--------|--------|
| **Tenant Work** | Lead → Quote → Project → Invoice | cc_work_requests → cc_quote_drafts/cc_estimates → cc_projects |
| **Community Work** | RFP → Bid → Contract → Execution | cc_procurement_requests → cc_bids → cc_contracts → cc_n3_execution_* |

### Potential Consolidation

| Current State | Recommendation |
|---------------|----------------|
| cc_work_orders + cc_procurement_requests | **Clarify** - may be parallel designs. Procurement has data, work_orders empty. |
| cc_quote_drafts + cc_estimates | **Separate** - different formality levels, both valid |
| cc_bids + cc_sr_contractor_bids | **Consolidate** - use cc_bids, deprecate sr_contractor_bids |

### Authorization Framework Domains

Based on business logic, recommend these capability domains:

```
work_requests   → Tenant lead intake
projects        → Tenant work containers
procurement     → Community RFP process (subsumes work_orders)
bids            → Responses to procurement
estimates       → Formal pricing documents
quotes          → Informal/draft pricing
contracts       → Legal agreements
service_runs    → Bundled trips (N3)
reservations    → Bookings
folios          → Guest accounts
wallets         → Stored value
payments        → Transaction processing
```

---

## Appendix: Active vs. Speculative Systems

### Actively Used (Has Data)
- cc_reservations (7 rows) ✓
- cc_procurement_requests (5 rows) ✓
- cc_communities (3 rows) ✓
- cc_quote_drafts (1 row) ✓
- cc_n3_runs (18 rows) ✓

### Infrastructure Ready (No Data Yet)
- cc_work_orders (0 rows)
- cc_bids (0 rows)
- cc_estimates (0 rows)
- cc_contracts (0 rows)
- cc_work_requests (0 rows)
- cc_projects (0 rows)

### Deprecated (Superseded)
- cc_service_runs (V1) - use cc_n3_runs
- cc_sr_service_runs (V2) - use cc_n3_runs
- cc_sr_contractor_bids - use cc_bids

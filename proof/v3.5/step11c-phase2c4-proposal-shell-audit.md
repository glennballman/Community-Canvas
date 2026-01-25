# STEP 11C Phase 2C-4: Proposal Shell Inventory + Attachment Contract Discovery

**Status**: AUDIT COMPLETE  
**Date**: 2026-01-25  
**Architect**: Senior Platform Architect + QA Gatekeeper

---

## Executive Summary

**CRITICAL FINDING**: The "proposal shell" system described in the requirements (DIY → Hybrid → Fully outsourced columns, line items, labour/materials/logistics rows, on-site tools/materials availability comparison) **does not exist** in the current codebase.

The platform has multiple **distinct** proposal-related systems that each serve different purposes but none implement the comparison shell pattern described.

---

## A) DATABASE INVENTORY

### Search Methodology

1. Queried database for tables matching keywords: `proposal, option, diy, scope, line_item, materials, tools, logistics, transport, bid, quote, compare, shell`
2. Reviewed Drizzle schema (shared/schema.ts) for relevant table definitions
3. Analyzed column structures for "mode" or "type" columns that might indicate DIY/Hybrid/Outsourced patterns

### Candidate Tables Identified

| Table Name | Purpose | Root ID | Notes |
|------------|---------|---------|-------|
| `cc_service_run_schedule_proposals` | Schedule negotiation events | `id` (uuid) | Our Phase 2C-3 implementation |
| `cc_quote_drafts` | A2.5 Event Mode lead→quote flow | `id` (uuid) | Single quote, no comparison |
| `cc_bids` | Procurement bidding | `id` (uuid) | Linked to cc_procurement_requests |
| `cc_estimates` | Estimate container | `id` (uuid) | Multi-version estimates |
| `cc_estimate_line_items` | Estimate line items | `id` (uuid) | FK to estimate_version_id |
| `cc_materials_plans` | Work order materials | `id` (uuid) | FK to work_order_id |
| `cc_materials_quotes` | Supplier quotes | `id` (uuid) | FK to materials_plan_id |
| `cc_replan_options` | N3 replan alternatives | `id` (uuid) | FK to bundle_id |
| `cc_project_line_items` | Project line items | `id` (uuid) | FK to project_id |
| `cc_contractor_tools` | A2.3 tool/material inventory | `id` (uuid) | Service provider assets |
| `cc_sr_tools` | Global tool reference | `id` (uuid) | Reference data |

### Table Schemas

#### cc_service_run_schedule_proposals (Phase 2C-3)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK, gen_random_uuid() |
| tenant_id | uuid | NOT NULL | FK cc_tenants |
| run_id | uuid | NOT NULL | FK cc_service_runs |
| actor_individual_id | uuid | NOT NULL | FK cc_individuals |
| actor_role | text | NOT NULL | 'tenant' or 'stakeholder' |
| event_type | text | NOT NULL | proposed/countered/accepted/declined |
| proposed_date | date | NOT NULL | Proposed schedule date |
| proposed_time_start | time | NULL | Optional time window |
| proposed_time_end | time | NULL | Optional time window |
| notes | text | NULL | Actor notes |
| metadata | jsonb | NOT NULL | `{}` default - **attachment point** |
| created_at | timestamptz | NOT NULL | Event timestamp |

**RLS**: Tenant isolation with stakeholder EXISTS check  
**No scope/line item columns exist**

#### cc_quote_drafts (A2.5 Event Mode)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| tenant_id | uuid | NULL | Optional tenant |
| contractor_profile_id | uuid | NULL | Source service provider |
| source_ingestion_id | uuid | NULL | From ingestion pipeline |
| customer_name/phone/email | text | NULL | Contact info |
| address_text | text | NULL | Work location |
| category | varchar(50) | NULL | Work category |
| scope_summary | text | NULL | Free-form scope |
| scope_details | jsonb | NOT NULL | `{}` default |
| base_estimate | numeric(12,2) | NULL | Single estimate amount |
| line_items | jsonb | NOT NULL | `[]` default - array of items |
| materials | jsonb | NOT NULL | `[]` default - array of materials |
| notes | text | NULL | Internal notes |
| status | varchar(20) | NOT NULL | draft/published/archived |

**RLS**: Not enabled  
**No DIY/Hybrid/Outsourced comparison columns**

#### cc_bids (Procurement)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NOT NULL | PK |
| procurement_request_id | uuid | NOT NULL | FK cc_procurement_requests |
| party_id | uuid | NOT NULL | FK cc_parties |
| estimate_id | uuid | NULL | FK cc_estimates |
| status | bid_status | NOT NULL | Enum type |
| bid_amount | numeric(15,2) | NULL | Single bid amount |
| proposed_start_date | date | NULL | Schedule |
| technical_proposal | text | NULL | Free-form |
| methodology | text | NULL | Free-form |

**RLS**: Party/tenant isolation  
**No comparison columns**

#### cc_estimates + cc_estimate_line_items

Standard estimate system with versions and line items. Each line item has:
- `category`, `description`, `quantity`, `unit`, `unit_cost`, `total_cost`
- `cost_type` (direct, indirect)
- `is_optional` boolean

**No DIY/Hybrid/Outsourced columns**

### DIY/Hybrid/Outsourced Pattern Search

Searched all 665 cc_* tables for columns containing:
- `diy`, `hybrid`, `outsource`, `mode`, `option`, `compare`

**Result**: No tables contain columns for comparing service delivery modes.

---

## B) ROUTES / SERVICES INVENTORY

### Search Patterns

- `proposal`, `shell`, `diy`, `line_item`, `materials`, `tools`, `logistics`

### Relevant Endpoints Found

#### 1. P-UI-08 Proposal API (`server/routes/proposals.ts`)

**Purpose**: Trip-based reservation proposal system with allocations and folios.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/p2/app/proposals/:proposalId` | Authenticated | Proposal detail with allocations |
| POST | `/api/p2/app/proposals/:proposalId/invite` | Authenticated | Create invitation |
| POST | `/api/p2/app/proposals/:proposalId/assign` | Authenticated | Assign units to participant |
| POST | `/api/p2/app/folios/:folioId/pay` | Authenticated | Test payment |
| POST | `/api/p2/app/folios/:folioId/credit` | Authenticated | Issue credit |
| POST | `/api/p2/public/proposals/from-cart` | Public | Create proposal from cart |
| POST | `/api/p2/public/proposals/:id/confirm` | Public | Confirm reservation |
| POST | `/api/p2/public/proposals/:id/release` | Public | Release holds |
| POST | `/api/p2/app/proposals/:id/handoff` | Authenticated | Forward to approver |

**Root Entity**: `cc_trips.id` (proposal_id)  
**No link to work areas or runs**

#### 2. Schedule Proposals (`server/routes/stakeholder-runs.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/runs/:id/schedule-proposals` | Tenant/Stakeholder | Get proposal history + policy |
| POST | `/api/runs/:id/schedule-proposals` | Tenant/Stakeholder | Submit proposal/counter/accept/decline |

**Root Entity**: `cc_service_runs.id` (run_id)  
**Has metadata JSONB column for attachments**

#### 3. Bids (`server/routes/bids.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bids` | Tenant | List bids |
| GET | `/api/bids/:id` | Tenant | Bid detail |
| POST | `/api/bids` | Tenant | Create bid |
| PATCH | `/api/bids/:id` | Tenant | Update bid |

**Root Entity**: `cc_bids.id`  
**Linked to**: `cc_procurement_requests`

#### 4. Tools (`server/routes/tools.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sr/tools` | Service Mode | List global tools |
| GET | `/api/sr/provider-tools` | Tenant | Provider's tools |
| POST | `/api/sr/provider-tools` | Tenant | Add tool to provider |

**Reference data** - Not a proposal shell

### Pattern Analysis

**No "attach to run" or "link to work area" pattern exists** for proposal shells.

The closest pattern is:
- `cc_quote_drafts.source_ingestion_id` → Links to ingestion pipeline
- `cc_bids.procurement_request_id` → Links to procurement requests
- `cc_service_run_schedule_proposals.run_id` → Links to service runs

---

## C) UI INVENTORY

### Search Patterns

- `proposal`, `DIY`, `outsource`, `materials`, `tools`, `logistics`, `compare`

### Relevant Components Found

#### 1. P-UI-09 Proposal Components (`client/src/components/proposals/`)

| Component | Purpose |
|-----------|---------|
| `ProposalHeaderCard.tsx` | Proposal summary header |
| `ParticipantList.tsx` | List participants with roles |
| `AllocationDrilldownDrawer.tsx` | Unit allocation details |
| `FolioSummaryCard.tsx` | Folio balance display |
| `PayYourSharePanel.tsx` | Split payment UI |
| `InvitePanel.tsx` | Send invitations |
| `AssignUnitsPanel.tsx` | Assign units to participants |
| `OperatorCreditPanel.tsx` | Issue credits/refunds |
| `RiskBanner.tsx` | N3 risk advisories |
| `ForwardToApproverPanel.tsx` | Handoff to approver |
| `HoldExpirationBanner.tsx` | Hold expiration warning |

**Entity ID**: `proposalId` (cc_trips.id)  
**Route**: `/app/proposal/:proposalId`

#### 2. Schedule Proposal UI

| File | Purpose |
|------|---------|
| `RunStakeholderViewPage.tsx` | Stakeholder schedule proposal UI |
| `ProviderRunDetailPage.tsx` | Provider schedule proposal UI |

**Entity ID**: `runId` (cc_service_runs.id)  
**Routes**: `/app/runs/:id/stakeholder`, `/app/provider/runs/:id`

#### 3. Quote/Bid Components

| File | Purpose |
|------|---------|
| `EventQuoteDetailPage.tsx` | A2.5 quote draft detail |
| `IngestionReviewPage.tsx` | Review AI-generated data |

**Entity ID**: `quoteDraftId` (cc_quote_drafts.id)

### Components NOT Found

- No "DIY vs Hybrid vs Outsourced" comparison UI
- No "service delivery mode selector"
- No "scope comparison shell"
- No "materials/tools availability matrix"

---

## D) CONTRACT DISCOVERY

### 1. Canonical ID for Negotiation Reference

**Answer**: There is no existing "proposal shell" with comparison columns.

For schedule negotiations, the canonical ID is:
- `cc_service_run_schedule_proposals.id` (uuid) - Individual event
- `cc_service_runs.id` (uuid) - Parent run

For trip-based proposals:
- `cc_trips.id` (uuid) - The proposal container

For procurement:
- `cc_bids.id` (uuid) - Individual bid

### 2. Existing Entity Linkages

| System | Links To |
|--------|----------|
| cc_trips (proposals) | portal_id, tenant_id |
| cc_service_run_schedule_proposals | run_id, tenant_id |
| cc_quote_drafts | contractor_profile_id, portal_id, zone_id, conversation_id |
| cc_bids | procurement_request_id, party_id, estimate_id |
| cc_estimates | work_request_id, work_order_id, party_id, tenant_id |

**No direct link between proposal shells and runs/work areas exists.**

### 3. Cross-Tenant Sharing

| System | Cross-Tenant? | Mechanism |
|--------|---------------|-----------|
| cc_trips | No | portal_id + tenant_id scoped |
| cc_quote_drafts | No | tenant_id nullable but not shareable |
| cc_bids | No | party_id tied to single tenant |
| cc_service_run_schedule_proposals | No | tenant_id + RLS enforced |

**No cross-tenant proposal sharing exists today.**

---

## E) RECOMMENDATION FOR 2C-4 ATTACHMENT (NO IMPLEMENTATION)

### Finding: No Proposal Shell Exists

The described "proposal shell" system with:
- DIY → Hybrid → Fully outsourced columns
- Line items for labour/materials/logistics
- On-site tools/materials availability matrix

**Does not exist in the current codebase.**

### Recommendation Options

#### Option A: Use Schedule Proposal Metadata (Minimal)

Store optional references in existing `cc_service_run_schedule_proposals.metadata` JSONB column:

```json
{
  "proposal_context": {
    "quote_draft_id": "uuid",
    "estimate_id": "uuid",
    "selected_scope_option": "hybrid"
  }
}
```

**Pros**: No schema changes, uses existing column  
**Cons**: Untyped, no FK constraints, no validation

#### Option B: Add Optional Foreign Key Column

Add `scope_context_id` column to `cc_service_run_schedule_proposals`:

```sql
ALTER TABLE cc_service_run_schedule_proposals
ADD COLUMN scope_context_id uuid REFERENCES cc_quote_drafts(id);
```

**Pros**: Typed reference, FK integrity  
**Cons**: Only links to quote_drafts, not estimates/bids

#### Option C: Create Polymorphic Link Table

```sql
CREATE TABLE cc_negotiation_scope_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_proposal_id uuid REFERENCES cc_service_run_schedule_proposals(id),
  entity_type text NOT NULL, -- 'quote_draft', 'estimate', 'bid'
  entity_id uuid NOT NULL,
  attached_at timestamptz NOT NULL DEFAULT now()
);
```

**Pros**: Flexible, supports multiple entity types  
**Cons**: New table, polymorphic pattern complexity

### Recommended Approach

**Option A (Metadata JSONB)** for Phase 2C-4 with these constraints:

1. Use existing `metadata` column on `cc_service_run_schedule_proposals`
2. Define a TypeScript interface for `proposal_context`:
   ```typescript
   interface ScheduleProposalContext {
     quote_draft_id?: string;
     estimate_id?: string;
     scope_option?: 'diy' | 'hybrid' | 'outsourced';
   }
   ```
3. Only attach on `event_type = 'proposed'` (initial proposals)
4. Read-only after creation (append-only audit trail preserved)
5. Guard by `negotiation_policy.allow_proposal_context = true`

**Rationale**:
- No schema changes required
- Uses policy-based feature gating (already implemented)
- Preserves append-only model
- Future monetization: Premium tiers enable richer contexts

### Auditability

The metadata approach maintains auditability because:
1. Schedule proposals are append-only (never updated)
2. Each event has its own metadata snapshot
3. Policy controls whether context is allowed

### Future Monetization

When proposal shell is built:
1. Create `cc_scope_comparison_shells` table with DIY/Hybrid/Outsourced columns
2. Add `shell_id` to metadata schema
3. Enable via `allow_proposal_context = true` (already in policy table)

---

## Certification

| Check | Status |
|-------|--------|
| Database inventory complete | ✅ |
| Routes inventory complete | ✅ |
| UI inventory complete | ✅ |
| Contract discovery complete | ✅ |
| No implementation changes | ✅ |
| No schema changes | ✅ |

**AUDIT CERTIFIED**: Phase 2C-4 inventory complete. Proposal shell system does not exist in current codebase. Recommended attachment via existing metadata JSONB column with policy-based gating.

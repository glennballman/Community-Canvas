# Phase 2C-9: Policy Trace Viewer + Run Audit Panel - Proof Document

## Feature Summary

Community Canvas V3.5 Phase 2C-9 implements a Policy Trace Viewer and Run Audit Panel that provides transparent visibility into which negotiation policies are applied during service run operations.

## Components Implemented

### 1. API Endpoints

**File**: `server/routes/negotiation-audit.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/app/negotiation-audit` | GET | tenant_owner, tenant_admin | Query audit events with multi-criteria filtering |
| `/api/app/runs/:id/negotiation-audit` | GET | tenant_owner, tenant_admin | Get audit events for a specific run |

**Query Parameters**:
- `negotiation_type` - Filter by type (default: schedule)
- `run_id` - Filter by specific run UUID
- `actor_type` - Filter: provider, stakeholder, tenant_admin
- `effective_source` - Filter: platform, tenant_override
- `policy_hash` - Filter by exact hash (64-char SHA-256)
- `date_from` / `date_to` - Date range filtering
- `limit` / `offset` - Pagination (max 200)

**RLS Enforcement**: All queries include `tenant_id = $tenant_id` condition from middleware context.

### 2. UI Components

**PolicyTraceSummary Component** (`client/src/components/PolicyTraceSummary.tsx`)

- UUID masking: First 8 characters + ellipsis (e.g., `a1b2c3d4…`)
- Hash masking: First 8 + last 4 characters (e.g., `a1b2c3d4…ef12`)
- Copy-to-clipboard: Copies full unmasked value
- ID disclosure toggle: User-controlled reveal
- Compact mode: Minimal footprint for run detail pages
- Effective source badge: Platform vs Tenant Override

**NegotiationAuditPage** (`client/src/pages/app/settings/NegotiationAuditPage.tsx`)

- Multi-criteria filter panel
- Paginated results table
- Click-to-navigate to run detail pages
- Hash/ID copy functionality

### 3. Integration Points

**ProviderRunDetailPage** (`client/src/pages/app/provider/ProviderRunDetailPage.tsx`)
- PolicyTraceSummary (compact mode) displayed in run header

**RunStakeholderViewPage** (`client/src/pages/app/runs/RunStakeholderViewPage.tsx`)
- PolicyTraceSummary (compact mode) displayed in stakeholder view

### 4. Navigation

**Route**: `/app/settings/negotiation-audit`  
**Nav Entry**: Admin section, "Negotiation Audit" with FileSearch icon  
**Roles**: tenant_owner, tenant_admin

## Database Schema

**Table**: `cc_negotiation_policy_audit_events`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | FK to tenant (RLS filtered) |
| portal_id | uuid | Optional portal context |
| run_id | uuid | FK to cc_n3_runs |
| actor_type | varchar | provider, stakeholder, tenant_admin |
| actor_tenant_membership_id | uuid | Who performed action |
| negotiation_type | varchar | schedule, reschedule, cancel |
| effective_source | varchar | platform, tenant_override |
| effective_policy_id | uuid | Which policy was applied |
| effective_policy_updated_at | timestamp | Policy version timestamp |
| effective_policy_hash | char(64) | SHA-256 of policy content |
| request_fingerprint | char(64) | Unique request identifier |
| created_at | timestamp | Event timestamp |

**Indexes**:
- `(tenant_id, created_at DESC)`
- `(tenant_id, run_id)`
- `(tenant_id, effective_policy_hash)`
- `UNIQUE (request_fingerprint)`

## Test Coverage

### API Tests (`tests/negotiationAudit.api.test.ts`)

18 tests covering:

**Schema Validation (5 tests)**
- `cc_negotiation_policy_audit_events` table exists
- Table has expected columns
- RLS is enabled on audit table
- tenant_id column exists for RLS filtering
- Hash is 64 characters

**Constraint Validation (2 tests)**
- actor_type constraint allows: provider, stakeholder, tenant_admin
- effective_source constraint allows: platform, tenant_override

**Data Integrity (3 tests)**
- Can insert audit event with all fields
- request_fingerprint enforces uniqueness
- created_at is populated automatically

**Query Performance (1 test)**
- Indexes exist for common query patterns

**Endpoint-Level Tests (7 tests)**
- GET /api/app/negotiation-audit returns 401 without auth
- GET /api/app/negotiation-audit returns paginated results for authenticated tenant
- GET /api/app/negotiation-audit accepts filter parameters
- GET /api/app/runs/:id/negotiation-audit requires auth or returns not found
- GET /api/app/runs/:id/negotiation-audit returns events for specific run
- RLS isolation: tenant A cannot see tenant B events via API

**Test Output (2026-01-25)**
```
✓ tests/negotiationAudit.api.test.ts (18 tests) 181ms
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### UI Tests (`tests/PolicyTraceSummary.ui.test.tsx`)

19 tests covering:

**Rendering (4 tests)**
- renders nothing when trace is null
- renders nothing when trace is undefined
- renders compact view with correct data-testid
- renders full view with correct data-testid

**Masking (2 tests)**
- masks policy hash in display (shows partial: 8+4 pattern)
- does not show raw UUID in default view

**Effective Source Badge (2 tests)**
- shows Platform badge for platform source
- shows Tenant Override badge for tenant_override source

**ID Disclosure (4 tests)**
- shows toggle button for IDs
- hides IDs by default
- shows IDs after toggle
- shows masked effective policy ID when expanded

**Copy Functionality (3 tests)**
- copy hash button exists
- copies full hash value on click
- copies full policy ID on click

**Compact Mode (2 tests)**
- shows hash with copy in compact mode
- copies hash in compact mode

**Display (2 tests)**
- shows relative time for updated_at
- accepts custom title prop

**Test Output (2026-01-25)**
```
✓ tests/PolicyTraceSummary.ui.test.tsx (19 tests) 303ms
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

## Security Considerations

1. **Tenant Isolation**: All queries filtered by tenant_id from authenticated context
2. **Role Guards**: tenant_owner and tenant_admin only
3. **UUID Masking**: Sensitive IDs hidden by default, user-controlled disclosure
4. **Copy Security**: Full values only accessible via explicit copy action

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| API endpoints for querying audit events | DONE |
| Tenant-scoped RLS filtering | DONE |
| Endpoint-level RLS isolation tests | DONE |
| PolicyTraceSummary with masked UUIDs | DONE |
| Copy-to-clipboard (full value) | DONE |
| Integration in provider/stakeholder pages | DONE |
| Settings page with multi-criteria filters | DONE |
| Navigation entry with role guards | DONE |
| API tests passing (schema + endpoint) | 18/18 |
| UI tests passing | 19/19 |

## File Inventory

- `server/routes/negotiation-audit.ts` - API endpoints
- `server/routes.ts` - Route registration
- `client/src/components/PolicyTraceSummary.tsx` - UI component
- `client/src/pages/app/settings/NegotiationAuditPage.tsx` - Settings page
- `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - Provider integration
- `client/src/pages/app/runs/RunStakeholderViewPage.tsx` - Stakeholder integration
- `client/src/App.tsx` - Route registration
- `client/src/nav/v3Nav.ts` - Navigation entry
- `tests/negotiationAudit.api.test.ts` - API tests
- `tests/PolicyTraceSummary.ui.test.tsx` - UI tests

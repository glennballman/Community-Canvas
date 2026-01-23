# V3.5 STEP 6 — Run Attachments Audit

**Date**: 2026-01-23  
**Status**: AUDIT COMPLETE

============================================================
## A1) Service Request Table + Status Column
============================================================

**Table**: `cc_work_requests` (the canonical service request table)

**Current work_request_status enum values**:
```
new, contacted, quoted, converted, closed, spam, scheduled, completed, dropped
```

**TERMINOLOGY_CANON.md v2 Required Statuses**:
```
DRAFT, SENT/AWAITING_RESPONSE, PROPOSED_CHANGE, AWAITING_COMMITMENT, 
UNASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED
```

**GAP IDENTIFIED**:
- AWAITING_COMMITMENT does NOT exist in current schema
- UNASSIGNED does NOT exist
- ACCEPTED does NOT exist  
- IN_PROGRESS does NOT exist
- CANCELLED does NOT exist

**ACTION REQUIRED**: Add missing enum values before implementing attachments.

============================================================
## A2) Existing Run ↔ Request Linkage
============================================================

**Checked**:
- `cc_work_requests.run_id` column: **NOT FOUND**
- `cc_n3_runs.request_ids` array: **NOT FOUND**
- `cc_run_requests` join table: **NOT FOUND**

**Existing related table**: `cc_n3_run_maintenance_requests`
- This is for maintenance requests, NOT general service requests

**FINDING**: NO EXISTING RUN↔REQUEST LINKAGE

**ACTION**: Create new `cc_run_request_attachments` join table.

============================================================
## A3) STEP 5A Table Exists (Visibility Only)
============================================================

**Confirmed**: `cc_run_portal_publications` exists (migration 172)
- Used for visibility (which portals can see a run)
- Contains: tenant_id, run_id, portal_id, published_at, unpublished_at

**CONFIRMED**: This table is for VISIBILITY only.
Will NOT be reused for attachments.

============================================================
## A4) Current Provider Run Detail Response
============================================================

**Current response shape**:
```json
{
  "ok": true,
  "run": {...},
  "attached_requests": [],
  "publications": [...]
}
```

**attached_requests is currently `[]`** because no linkage table exists.

**CONFIRMED**: Response shape includes attached_requests. Will populate from new join table.

============================================================
## A5) MarketMode / Policy Gating Pattern
============================================================

**Location**: `server/policy/marketModePolicy.ts`

**Pattern**: Actions are gated via `useMarketActions()` hook.

**Provider CTAs use action IDs** like:
- `provider.run.publish` (from STEP 5)
- `provider.run.attachment.hold`
- `provider.run.attachment.commit`
- `provider.run.attachment.release`

**CONFIRMED**: Can follow existing pattern for new attachment actions.

============================================================
## STATE TRANSITION GUARD (MANDATORY)
============================================================

SERVICE REQUEST STATE TRANSITIONS (STEP 6):

| From Status            | Action  | To Status            | Allowed |
|------------------------|---------|----------------------|---------|
| SENT                   | HOLD    | AWAITING_COMMITMENT  | YES     |
| AWAITING_RESPONSE      | HOLD    | AWAITING_COMMITMENT  | YES     |
| PROPOSED_CHANGE        | HOLD    | AWAITING_COMMITMENT  | YES     |
| UNASSIGNED             | HOLD    | AWAITING_COMMITMENT  | YES     |
| AWAITING_COMMITMENT    | HOLD    | (no change)          | YES     |
| AWAITING_COMMITMENT    | COMMIT  | ACCEPTED             | YES     |
| AWAITING_COMMITMENT    | RELEASE | UNASSIGNED           | YES     |
| ACCEPTED               | RELEASE | NOT ALLOWED          | NO      |
| IN_PROGRESS            | any     | NOT ALLOWED          | NO      |
| COMPLETED              | any     | NOT ALLOWED          | NO      |
| CANCELLED              | any     | NOT ALLOWED          | NO      |

FORBIDDEN (HARD BLOCK):
- PROPOSED_CHANGE -> ACCEPTED (must go through AWAITING_COMMITMENT)
- SENT -> ACCEPTED (must go through AWAITING_COMMITMENT)
- Any terminal state -> any other state

============================================================
## AUDIT SUMMARY
============================================================

**Blockers**: None (gaps can be resolved additively)

**Required Actions**:
1. Add missing status values to work_request_status enum
2. Create cc_run_request_attachments join table
3. Implement HOLD/COMMIT/RELEASE endpoints with state guard

**PROCEED TO IMPLEMENTATION**: YES

END.

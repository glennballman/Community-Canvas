# V3.5 Run Request Attachments

## Summary

STEP 6 implements a two-phase HOLD→COMMIT model for attaching service requests to service runs. This allows providers to tentatively link work requests to planned runs (HOLD), then finalize the commitment (COMMIT) before execution.

## Implementation Date
2025-01-23

## Database Schema

### Migration 173: cc_run_request_attachments

```sql
-- Join table for run↔request linkage with attachment status
CREATE TABLE cc_run_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES cc_n3_runs(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES cc_work_requests(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES cc_tenants(id),
  status cc_run_attachment_status NOT NULL DEFAULT 'HELD',
  attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  attached_by UUID REFERENCES cc_actors(id),
  UNIQUE(run_id, request_id)
);

-- Status enum
CREATE TYPE cc_run_attachment_status AS ENUM ('HELD', 'COMMITTED');

-- Added missing work_request_status enum values:
-- awaiting_commitment, unassigned, accepted, in_progress, cancelled, sent, draft, proposed_change
```

## API Endpoints

### GET /api/provider/requests
Returns unattached work requests available for attachment.

**Response:**
```json
{
  "ok": true,
  "requests": [
    {
      "id": "uuid",
      "summary": "Request summary",
      "category": "landscaping",
      "status": "new",
      "portal_name": "Bamfield Portal"
    }
  ]
}
```

### POST /api/provider/runs/:id/attachments/hold
Creates a HELD attachment, transitions request to `awaiting_commitment`.

**Request:**
```json
{ "requestId": "uuid" }
```

**Response:**
```json
{
  "ok": true,
  "attachment": {
    "id": "uuid",
    "run_id": "uuid",
    "request_id": "uuid",
    "status": "HELD",
    "attached_at": "2025-01-23T..."
  }
}
```

### POST /api/provider/runs/:id/attachments/commit
Transitions HELD→COMMITTED, request status to `accepted`.

**Response:**
```json
{
  "ok": true,
  "attachment": {
    "status": "COMMITTED",
    "committed_at": "2025-01-23T..."
  }
}
```

### POST /api/provider/runs/:id/attachments/release
Removes HELD attachment, reverts request to `new`.
Returns HTTP 409 if attachment is COMMITTED (guard).

**Success Response:**
```json
{ "ok": true }
```

**Error Response (409):**
```json
{
  "ok": false,
  "error": "error.commitment.release_not_allowed"
}
```

### GET /api/provider/runs/:id
Extended to include `attached_requests` array.

**Response includes:**
```json
{
  "attached_requests": [
    {
      "id": "uuid",
      "request_id": "uuid",
      "status": "COMMITTED",
      "summary": "Request summary",
      "category": "landscaping",
      "attached_at": "2025-01-23T...",
      "committed_at": "2025-01-23T..."
    }
  ]
}
```

## State Transitions

```
Request Status Flow:
new → [HOLD] → awaiting_commitment → [COMMIT] → accepted

Attachment Status Flow:
(none) → [HOLD] → HELD → [COMMIT] → COMMITTED

Guards:
- RELEASE only allowed for HELD attachments
- COMMITTED attachments cannot be released (HTTP 409)
- Terminal request states (in_progress, completed, cancelled) block modification
- Re-attachment: Previously released requests can be re-held (UPSERT pattern)
```

## Frontend Components

### AddRequestsModal
- Located: `client/src/components/provider/AddRequestsModal.tsx`
- Opens from "Add Requests" button on run detail page
- Shows list of unattached requests with HOLD action
- Automatically invalidates queries on successful HOLD

### AttachmentItem (in ProviderRunDetailPage)
- Shows each attached request with status badge
- HELD items show Commit and Release buttons
- COMMITTED items show only status badge (no actions)
- Uses copy tokens for all labels

### ProviderRunDetailPage Updates
- Added "Attached Service Requests" card
- Groups attachments by status (HELD vs COMMITTED)
- Integrated AddRequestsModal via sidebar button

## Copy Tokens

Added 13 tokens under `provider.run.attachments.*`:
- `title` - Section heading
- `empty` - Empty state message
- `add_cta` - Add requests button label
- `held` - Status badge for held attachments
- `committed` - Status badge for committed attachments
- `hold_cta` - Hold button label
- `commit_cta` - Commit button label
- `release_cta` - Release button label
- `hold_success` - Success toast for hold action
- `commit_success` - Success toast for commit action
- `release_success` - Success toast for release action
- `add_modal_title` - Modal title
- `no_requests` - Empty state in modal

## Test Results

```bash
=== TEST 1: GET /api/provider/runs/:id ===
✓ attached_requests array included
✓ Status and metadata fields present

=== TEST 2: GET /api/provider/requests ===
✓ Returns unattached requests only

=== TEST 3: HOLD request ===
✓ Creates HELD attachment
✓ Request transitions to awaiting_commitment

=== TEST 4: RELEASE held request ===
✓ Returns ok: true
✓ Request becomes available again

=== TEST 5: RE-HOLD same request (UPSERT) ===
✓ Works correctly (no duplicate key error)
✓ Returns status: "HELD"

=== TEST 6: COMMIT request ===
✓ Attachment transitions to COMMITTED
✓ Request transitions to accepted

=== TEST 7: RELEASE committed (guard) ===
✓ Returns HTTP 409
✓ Error: error.commitment.release_not_allowed

=== TEST 8: STEP 5 publishing still works ===
✓ Publish endpoint functional
✓ No regression
```

## Files Changed

- `server/migrations/173_run_request_attachments.sql` - Schema
- `server/routes/provider.ts` - API endpoints
- `client/src/components/provider/AddRequestsModal.tsx` - New component
- `client/src/pages/app/provider/ProviderRunDetailPage.tsx` - UI integration
- `client/src/copy/entryPointCopy.ts` - Copy tokens

## Compliance

- ✅ TERMINOLOGY_CANON.md v2 - All status values conform
- ✅ Two-phase model - HOLD before COMMIT
- ✅ State guard - COMMITTED cannot be released
- ✅ RLS enabled on join table
- ✅ Tenant-scoped queries
- ✅ Copy-token layer for all UI strings

# STEP 11C Phase 2C-4: Proposal Context Attachments

## Status: CERTIFIED

## Objective
Enable providers to optionally attach reference documents (quote drafts, estimates, bids, trip reservations, scope options) to schedule proposals during negotiations.

## Completed Work

### 1. Database Schema (Migration 188)
- Added `metadata JSONB` column to `cc_service_run_schedule_proposals` table
- Default value `'{}'::jsonb`
- Supports `proposal_context` with optional keys:
  - `quote_draft_id` (UUID)
  - `estimate_id` (UUID)
  - `bid_id` (UUID)
  - `trip_id` (UUID)
  - `selected_scope_option` (string, max 64 chars)

### 2. Server-Side Implementation

**POST /api/runs/:id/schedule-proposals**
- Added `proposal_context` field validation in Zod schema
- UUID validation for ID fields using regex pattern
- Scope option max length enforcement (64 chars)
- Policy gating via `allow_proposal_context` flag
- Context stored in `metadata` column only for `event_type='proposed'`
- Read-only after creation (immutable)

**GET /api/runs/:id/schedule-proposals**
- Returns `proposal_context` extracted from metadata for each event
- Returns effective `policy` object including `allow_proposal_context` flag

### 3. Provider UI (ProviderRunDetailPage.tsx)
- Added collapsible "Reference Documents" section with Paperclip icon
- Five input fields for optional context:
  - Quote Draft ID (UUID)
  - Estimate ID (UUID)
  - Bid ID (UUID)
  - Trip/Reservation ID (UUID)
  - Scope Option (freeform, 64 char limit)
- Policy-gated: only shown when `allow_proposal_context=true`
- Properly includes context in proposal submission mutation

### 4. Stakeholder UI (RunStakeholderViewPage.tsx)
- Added read-only proposal context display block
- Shows "References attached" badge when context exists
- Lists attached reference types with human-readable labels
- Displays scope option value when present

### 5. Copy Tokens (entryPointCopy.ts)
Added tokens for:
- `provider.schedule_proposals.proposal_context.*` (6 tokens)
- `stakeholder.schedule_proposals.proposal_context.*` (3 tokens)
- `policy.negotiation.allow_proposal_context.*` (2 tokens)

## Key Design Decisions

1. **Metadata Column Pattern**: Uses existing JSONB metadata column instead of dedicated columns, enabling future extensibility without schema changes.

2. **Policy Gating**: Controlled by `allow_proposal_context` flag in negotiation policy system, allowing platform and tenant-level control.

3. **Immutable Attachments**: Context is set only on initial proposal (`event_type='proposed'`) and cannot be modified after creation.

4. **UUID Validation**: Server-side regex validation ensures proper UUID format for ID fields.

5. **Collapsible UI**: Context section is collapsed by default to avoid cluttering the proposal dialog for simple use cases.

## Files Modified
- `server/migrations/188_schedule_proposal_metadata.sql` (NEW)
- `server/routes/stakeholder-runs.ts`
- `client/src/pages/app/provider/ProviderRunDetailPage.tsx`
- `client/src/pages/app/runs/RunStakeholderViewPage.tsx`
- `client/src/copy/entryPointCopy.ts`

## Test Scenarios
1. Provider creates proposal with quote draft ID attached
2. Provider creates proposal with multiple context fields
3. Provider creates proposal without context (backwards compatible)
4. Stakeholder views proposal with context and sees reference badges
5. Policy disabled: context section hidden in provider UI
6. Invalid UUID rejected with 400 error

## Date
January 25, 2026

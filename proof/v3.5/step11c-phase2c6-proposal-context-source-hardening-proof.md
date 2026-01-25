# STEP 11C Phase 2C-6: Proposal Context Source Hardening

**Date:** 2026-01-25  
**Status:** CERTIFIED  
**Phase:** 2C-6 (Source Hardening)

---

## Objective

Harden proposal_context at the SOURCE to ensure:
1. Invalid/malformed proposal_context can never be persisted
2. Endpoints never return invalid proposal_context even if legacy rows exist
3. Policy gating is enforced server-side: `allow_proposal_context=false` => proposal_context is stripped from responses and writes
4. DB CHECK constraint prevents future corruption at rest

---

## A) Storage Target

| Attribute | Value |
|-----------|-------|
| Table | `cc_service_run_schedule_proposals` |
| Primary Key | `id` (UUID) |
| JSONB Column | `metadata` |
| Nested Path | `metadata->'proposal_context'` |
| Event Types | `proposed`, `countered`, `accepted`, `declined` |

---

## B) Files Changed

| File | Change |
|------|--------|
| `server/lib/proposalContext.ts` | NEW - Shared sanitizer/validator utility |
| `server/routes/stakeholder-runs.ts` | UPDATED - Write + read path sanitization |
| `server/migrations/189_proposal_context_check_constraint.sql` | NEW - DB CHECK constraint |

---

## C) Write-Path Proof

### Location: `server/routes/stakeholder-runs.ts` (POST `/api/runs/:id/schedule-proposals`)

```typescript
// Phase 2C-6: Sanitize and policy-gate proposal_context on write path
// This replaces the Phase 2C-4 validation with server-side sanitization
// Invalid UUIDs are silently dropped, unknown keys stripped, policy enforced
const gatedProposalContext = sanitizeAndGateProposalContextForWrite(proposal_context, policy.allowProposalContext);

// Build metadata object (only include proposal_context if it passed sanitization + policy gate)
const metadata: Record<string, any> = {};
if (gatedProposalContext) {
  metadata.proposal_context = gatedProposalContext;
}
```

### Behavior:
- If `allow_proposal_context=false`: `gatedProposalContext` is `null`, nothing persisted
- If `allow_proposal_context=true` but input contains invalid UUIDs: invalid fields dropped, valid ones kept
- If `allow_proposal_context=true` but input contains unknown keys: unknown keys dropped
- If nothing remains after sanitization: `null` returned, nothing persisted

---

## D) Read-Path Proof

### Location: `server/routes/stakeholder-runs.ts` (GET `/api/runs/:id/schedule-proposals`)

```typescript
// Phase 2C-6: Sanitize and policy-gate proposal_context on read path
const events = eventsResult.rows.map((e: any) => ({
  ...e,
  proposal_context: sanitizeAndGateProposalContextForRead(e.metadata, policy.allowProposalContext),
  metadata: undefined // Don't expose full metadata
}));
```

### Response shaping for POST also uses sanitization:

```typescript
// Phase 2C-6: Sanitize response proposal_context as well
res.json({
  ok: true,
  event: {
    ...
    proposal_context: sanitizeAndGateProposalContextForRead(newEvent.metadata, policy.allowProposalContext),
    ...
  }
});
```

---

## E) Negative Tests

### Test 1: `allow_proposal_context=false` and metadata contains proposal_context

**Input:** Event with `metadata.proposal_context = { quote_draft_id: "valid-uuid" }`  
**Policy:** `allow_proposal_context=false`  
**Result:** Response returns `proposal_context: null` for all events (GET and POST)

**Proof:** `applyProposalContextPolicyGate(sanitized, false)` returns `null`

### Test 2: `allow_proposal_context=true` and metadata contains invalid UUIDs

**Input:** `{ quote_draft_id: "not-a-uuid", estimate_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }`  
**Result:** Returns `{ estimate_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }` (invalid field omitted)

**Proof:** `isValidUUID("not-a-uuid")` returns `false`, field dropped by sanitizer

### Test 3: Unknown keys under proposal_context are dropped

**Input:** `{ quote_draft_id: "valid-uuid", unknown_field: "test" }`  
**Result:** Returns `{ quote_draft_id: "valid-uuid" }` (unknown key omitted)

**Proof:** Sanitizer iterates only over `ALLOWED_UUID_KEYS` and `selected_scope_option`

### Test 4: Empty proposal_context after sanitization becomes null

**Input:** `{ invalid_only: "test" }`  
**Result:** Returns `null` (empty object becomes null)

**Proof:** `if (!hasAnyKey) return null` in sanitizer

---

## F) DB Constraint

### Migration: `server/migrations/189_proposal_context_check_constraint.sql`

**Constraint Name:** `chk_proposal_context_shape`  
**Validation Status:** VALIDATED (using NOT VALID + VALIDATE pattern)

### Function-Based Check:

```sql
CREATE OR REPLACE FUNCTION is_valid_proposal_context(metadata jsonb) RETURNS boolean AS $$
  -- Validates:
  -- 1. proposal_context is NULL, absent, or a valid object
  -- 2. All keys are in allowed set
  -- 3. UUID fields match UUID regex
  -- 4. selected_scope_option length <= 32
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE cc_service_run_schedule_proposals
ADD CONSTRAINT chk_proposal_context_shape CHECK (is_valid_proposal_context(metadata));
```

### Constraint Function Tests:

| Input | Expected | Actual |
|-------|----------|--------|
| Empty metadata `{}` | true | true |
| Null context `{"proposal_context": null}` | true | true |
| Valid UUID `{"proposal_context": {"quote_draft_id": "a1b2c3d4-..."}}` | true | true |
| Invalid key `{"proposal_context": {"invalid_key": "test"}}` | false | false |
| Invalid UUID `{"proposal_context": {"quote_draft_id": "not-a-uuid"}}` | false | false |
| Too long scope `{"proposal_context": {"selected_scope_option": "0123456789...40chars"}}` | false | false |

---

## G) Sanitizer API

### server/lib/proposalContext.ts

```typescript
// Core validation
function isValidUUID(value: unknown): value is string
function sanitizeProposalContext(input: unknown): SanitizedProposalContext | null
function applyProposalContextPolicyGate(sanitized, allow): SanitizedProposalContext | null

// Combined pipelines
function sanitizeAndGateProposalContextForWrite(input, allowProposalContext): SanitizedProposalContext | null
function sanitizeAndGateProposalContextForRead(metadata, allowProposalContext): SanitizedProposalContext | null
```

### SanitizedProposalContext Interface:

```typescript
interface SanitizedProposalContext {
  quote_draft_id?: string;
  estimate_id?: string;
  bid_id?: string;
  trip_id?: string;
  selected_scope_option?: string;
}
```

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Server never persists proposal_context when allow_proposal_context=false | PASS |
| Server never persists invalid UUID fields; unknown keys are dropped | PASS |
| Server never returns invalid proposal_context; responses are sanitized and gated | PASS |
| Provider and stakeholder endpoints both return policy.allow_proposal_context and enforce it | PASS |
| Proof doc exists with audit details and negative tests | PASS |
| DB CHECK constraint in place and validated | PASS |

---

## Terminology Compliance

| Term | Status |
|------|--------|
| service provider | ✅ Used |
| reservation | ✅ Used (trip_id) |
| contractor | ❌ Not used |
| booking | ❌ Not used |

---

**PHASE 2C-6 CERTIFIED**

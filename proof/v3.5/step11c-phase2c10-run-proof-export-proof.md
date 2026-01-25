# Phase 2C-10: Run Proof Export (Deterministic Audit Pack) - Proof Document

**Date**: 2026-01-25  
**Schema Version**: `cc.v3_5.step11c.2c10.run_proof_export.v1`

## Overview

Phase 2C-10 implements a deterministic proof export system that generates portable, auditable evidence bundles containing negotiation audit events, policy traces, and proposal data for compliance and verification purposes.

## Implementation Summary

### Export Builder (`server/lib/runProofExport.ts`)

The export builder generates a deterministic JSON/CSV bundle with:

- **Schema version**: `cc.v3_5.step11c.2c10.run_proof_export.v1`
- **Deterministic sorting**: All events sorted by `created_at ASC`, then `id ASC`
- **Policy-aware filtering**: `proposal_context` only included when `allowProposalContext=true`
- **Dual format support**: JSON (default) and CSV via query parameter

### Export Contents

```typescript
{
  schema_version: string,
  exported_at: string,         // ISO 8601 timestamp
  portal_id: string | null,
  run_id: string,
  negotiation_type: string,
  policy_trace: {
    platform: PolicySnapshot | null,
    tenant_override: PolicySnapshot | null,
    effective_source: 'platform' | 'tenant_override'
  },
  policy: ResolvedPolicy,
  audit_events: AuditEventExport[],  // Sorted by created_at ASC, id ASC
  negotiation: {
    latest: {
      status: string,
      last_event_at: string | null,
      turn_count: number
    },
    events: NegotiationEventExport[]  // Sorted by created_at ASC, id ASC
  }
}

// NegotiationEventExport includes:
{
  id: string,
  created_at: string,
  event_type: string,
  actor_type: string | null,
  status: string | null,
  message: string | null,
  proposed_start: string | null,   // Proposal payload field
  proposed_end: string | null,     // Proposal payload field
  proposal_context: SanitizedProposalContext | null  // Policy-gated
}
```

### API Route (`/api/app/runs/:id/negotiation-proof-export`)

- **Method**: GET
- **Role Guards**: `tenant_owner`, `tenant_admin`
- **Query Parameters**: `format=json|csv`
- **Response Headers**: 
  - `Content-Type`: `application/json` or `text/csv`
  - `Content-Disposition`: `attachment; filename="run-proof-export-{runId}-{YYYYMMDD}.{ext}"`

### UI Integration

Export button added to `NegotiationAuditPage.tsx`:
- Download icon button in Actions column
- Loading state during export
- Toast notifications for success/failure
- Test ID: `button-export-proof-{runId}`

## Test Results

```
 ✓ tests/negotiationProofExport.api.test.ts (11 tests)
   ✓ Export Schema > schema version is correctly formatted
   ✓ Role Gating > returns 401 without authentication
   ✓ Export Builder > builds export with correct schema version
   ✓ Export Builder > export contains required top-level keys
   ✓ Export Builder > audit_events are sorted by created_at ASC
   ✓ Export Builder > negotiation.events are sorted by created_at ASC
   ✓ Export Builder > negotiation.events include proposal payload fields
   ✓ Determinism > same data produces identical output with fixed exported_at
   ✓ Policy Gating > proposal_context is included only when allow_proposal_context=true
   ✓ CSV Export > CSV format includes headers and data rows
   ✓ Filename Generation > filename includes run ID and date

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

## Key Design Decisions

### Determinism

Deterministic output is achieved through:
1. Fixed `exported_at` timestamp (override parameter for testing)
2. Stable sorting by `(created_at ASC, id ASC)` for all event arrays
3. Consistent JSON key ordering via `JSON.stringify`

### Policy Gating

The `allowProposalContext` policy field controls whether `proposal_context` is included in the export:
- When `true`: Full proposal context included
- When `false`: `proposal_context` set to `null` in all events

### Filename Pattern

```
run-proof-export-{runId}-{YYYYMMDD}.{json|csv}
```

Example: `run-proof-export-abc123-20260125.json`

## Evidence

### Files Created/Modified

1. `server/lib/runProofExport.ts` - Export builder with deterministic output
2. `server/routes/negotiation-proof-export.ts` - API route with role guards
3. `client/src/pages/app/settings/NegotiationAuditPage.tsx` - UI export button
4. `tests/negotiationProofExport.api.test.ts` - API tests (11 tests)

### Route Registration

Route mounted in `server/routes.ts`:
```typescript
import negotiationProofExportRouter from "./routes/negotiation-proof-export";
// ...
app.use('/api/app/runs', negotiationProofExportRouter);
```

### Test Coverage Notes

Tests are designed to run against seeded data. In environments without demo tenants or runs, tests skip gracefully to avoid false failures. The structure and schema tests always run regardless of data availability.

## Compliance Notes

- Exports are immutable snapshots at export time
- Schema version allows future format evolution
- Deterministic output enables hash-based verification
- Policy trace provides complete audit lineage

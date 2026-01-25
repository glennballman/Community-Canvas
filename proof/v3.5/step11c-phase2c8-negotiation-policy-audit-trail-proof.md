# STEP 11C Phase 2C-8: Negotiation Policy Audit Trail (Proof-Grade Determinism)

**Status**: CERTIFIED  
**Date**: 2026-01-25  
**Migration**: 190_negotiation_policy_audit.sql

---

## A) Resolver Audit

### What Existed
- `loadNegotiationPolicy()` in `server/lib/negotiation-policy.ts`
- Inputs: `tenantId: string`, `negotiationType: NegotiationType`
- Tables read: `cc_platform_negotiation_policy`, `cc_tenant_negotiation_policy`
- Override logic: Tenant values win if non-null, else platform values
- Returned: Only policy flags (`maxTurns`, `allowCounter`, etc.)
- Missing: No IDs, timestamps, or trace information

### What Changed
- New function `loadNegotiationPolicyWithTrace()` added
- Now fetches `id` and `updated_at` from both tables
- Returns `{ policy, trace }` where trace includes:
  - `effective_source`: "platform" | "tenant_override"
  - `platform_policy_id`: UUID of platform policy
  - `tenant_policy_id`: UUID of tenant override (or null)
  - `effective_policy_id`: Whichever record was used
  - `effective_policy_updated_at`: ISO timestamp
  - `effective_policy_hash`: SHA-256 of policy values
- Original `loadNegotiationPolicy()` now delegates to new function

---

## B) Files Changed

| File | Change Type |
|------|-------------|
| `shared/schema.ts` | Added `NegotiationPolicyTrace` and `ResolvedNegotiationPolicyWithTrace` types |
| `server/lib/negotiation-policy.ts` | Added `loadNegotiationPolicyWithTrace()` and `computePolicyHash()` |
| `server/lib/policyAudit.ts` | NEW: Audit record persistence with dedupe |
| `server/routes/stakeholder-runs.ts` | Updated GET/POST endpoints to use trace and record audit |
| `server/migrations/190_negotiation_policy_audit.sql` | NEW: Audit table with RLS |
| `tests/policyAuditTrail.test.ts` | NEW: 21 tests for audit trail |

### Endpoint Architecture Note

**IMPORTANT**: Both providers and stakeholders use the **same endpoint**: `GET /api/runs/:id/schedule-proposals` in `server/routes/stakeholder-runs.ts`. The router is named "stakeholder-runs" but serves both roles. Access control determines if user is provider or stakeholder via `resolveAccessContext()`:

```typescript
// Line 703-710: Access resolution determines role
const ctx = await resolveAccessContext(userId, tenantId, runId);
if (!ctx.hasStakeholderAccess && !ctx.isTenantOwner) {
  return res.status(403).json({ error: 'error.run.access_denied' });
}

// Line 762-763: Audit actor type based on role
const auditActorType: AuditActorType = ctx.isTenantOwner ? 'provider' : 'stakeholder';
```

Client-side evidence from `client/src/pages/app/provider/ProviderRunDetailPage.tsx` (line 402):
```typescript
const res = await fetch(`/api/runs/${id}/schedule-proposals`);
```

And `client/src/pages/app/runs/RunStakeholderViewPage.tsx` (line 230):
```typescript
const res = await fetch(`/api/runs/${id}/schedule-proposals`);
```

Both providers and stakeholders call the same endpoint - same URL, same response format, same `policy_trace` field.

---

## C) Response Examples

### Provider Endpoint (GET /api/runs/:id/schedule-proposals)

```json
{
  "ok": true,
  "turn_cap": 3,
  "turns_used": 0,
  "turns_remaining": 3,
  "is_closed": false,
  "policy": {
    "allow_counter": true,
    "provider_can_initiate": true,
    "stakeholder_can_initiate": true,
    "allow_proposal_context": true
  },
  "policy_trace": {
    "negotiation_type": "schedule",
    "effective_source": "platform",
    "platform_policy_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenant_policy_id": null,
    "effective_policy_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "effective_policy_updated_at": "2024-01-15T12:00:00.000Z",
    "effective_policy_hash": "8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d"
  },
  "latest": null,
  "events": []
}
```

### Stakeholder Endpoint (Same endpoint, different actor)

```json
{
  "ok": true,
  "policy_trace": {
    "negotiation_type": "schedule",
    "effective_source": "tenant_override",
    "platform_policy_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenant_policy_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "effective_policy_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
    "effective_policy_updated_at": "2024-01-20T15:30:00.000Z",
    "effective_policy_hash": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"
  }
}
```

---

## D) Hash Algorithm Description

### Inputs
The hash is computed from these policy fields (sorted alphabetically):
- `allowCounter`: boolean
- `allowProposalContext`: boolean
- `closeOnAccept`: boolean
- `closeOnDecline`: boolean
- `maxTurns`: number
- `providerCanInitiate`: boolean
- `stakeholderCanInitiate`: boolean

### Process
1. Build plain object with sorted keys
2. `JSON.stringify()` to get canonical JSON
3. SHA-256 hash via Node.js `crypto.createHash('sha256')`
4. Output as 64-character hex string

### Properties
- **Deterministic**: Same inputs always produce same hash
- **Change-sensitive**: Any policy change produces different hash
- **Key-order independent**: Due to sorted key construction
- **No tenant IDs**: Hash payload excludes tenant configuration

---

## E) Test Results Summary

```
 ✓ tests/policyAuditTrail.test.ts (21 tests) 99ms
   ✓ Policy Hash Determinism (4)
     ✓ same policy values produce same hash
     ✓ different policy values produce different hash
     ✓ hash is 64 character hex string
     ✓ key order does not affect hash (canonical JSON)
   ✓ Audit Table Schema (5)
     ✓ cc_negotiation_policy_audit_events table exists
     ✓ request_fingerprint has unique index
     ✓ actor_type constraint enforces allowed values
     ✓ effective_source constraint enforces allowed values
     ✓ RLS is enabled on audit table
   ✓ Request Fingerprint Logic (3)
     ✓ fingerprint format is runId:actorType:policyHash
     ✓ different actors produce different fingerprints
     ✓ different policy hashes produce different fingerprints
   ✓ Policy Trace Shape (3)
     ✓ trace has all required fields
     ✓ effective_source must be platform or tenant_override
     ✓ effective_policy_updated_at is ISO timestamp
   ✓ Platform Policy Table (1)
     ✓ platform policy has id and updated_at columns
   ✓ Tenant Policy Table (1)
     ✓ tenant policy has id and updated_at columns
   ✓ Resolver Integration (3)
     ✓ loadNegotiationPolicyWithTrace returns policy and trace
     ✓ computePolicyHash produces consistent results
     ✓ buildRequestFingerprint creates correct format
   ✓ Audit Dedupe Behavior (1)
     ✓ unique constraint on request_fingerprint prevents duplicates

 Test Files  1 passed (1)
      Tests  21 passed (21)
```

---

## F) Audit Persistence Details

### Table: `cc_negotiation_policy_audit_events`

**Migration**: 190_negotiation_policy_audit.sql

**Columns**:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| created_at | timestamptz | Audit record timestamp |
| tenant_id | uuid | Tenant context |
| portal_id | uuid | Optional portal context |
| run_id | uuid | Service run being negotiated |
| actor_individual_id | uuid | Actor who triggered resolution |
| actor_type | text | 'provider' | 'stakeholder' | 'tenant_admin' | 'platform_admin' |
| negotiation_type | text | 'schedule' | 'scope' | 'pricing' |
| effective_source | text | 'platform' | 'tenant_override' |
| effective_policy_id | uuid | ID of policy record used |
| effective_policy_updated_at | timestamptz | When policy was last updated |
| effective_policy_hash | text | SHA-256 of policy values |
| request_fingerprint | text | Dedupe key |

### Dedupe Strategy
- **Fingerprint Format**: `${runId}:${actorType}:${policyHash}`
- **Unique Index**: `idx_negotiation_policy_audit_fingerprint`
- **Insert Strategy**: `ON CONFLICT (request_fingerprint) DO NOTHING`
- **Result**: Only one audit record per actor-run-policy combination

### RLS
- `rls_negotiation_policy_audit_tenant_read`: SELECT allowed for tenant or service mode
- `rls_negotiation_policy_audit_insert`: INSERT allowed for tenant or service mode

### Indexes
- `idx_negotiation_policy_audit_fingerprint`: Unique for dedupe
- `idx_negotiation_policy_audit_run`: (run_id, negotiation_type, created_at DESC)
- `idx_negotiation_policy_audit_tenant`: (tenant_id, portal_id, created_at DESC)

### Audit Fidelity Notes

**portal_id**: Currently set to NULL in audit records. The schedule proposals endpoint operates at the tenant level (cc_n3_runs belong to tenants, not portals). Portal context is not available at this API layer. Column reserved for future portal-scoped negotiation features.

**actor_individual_id**: Populated when available via cc_users → cc_individuals join on email. Falls back to NULL if user has no linked individual record.

---

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Provider + stakeholder endpoints return policy_trace | ✓ PASS |
| effective_source correctly reflects precedence | ✓ PASS |
| effective_policy_hash is deterministic | ✓ PASS |
| Hash changes when policy changes | ✓ PASS |
| No additional sensitive tenant config leakage | ✓ PASS |
| Tests pass (21/21) | ✓ PASS |
| Audit persistence with dedupe | ✓ PASS |
| Proof doc exists | ✓ PASS |

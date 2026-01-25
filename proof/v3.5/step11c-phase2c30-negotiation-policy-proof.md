# STEP 11C Phase 2C-3.0: Deterministic Negotiation Policy Tables

**Status**: CERTIFIED  
**Date**: 2026-01-25  
**Architect**: Senior Platform Architect + QA Gatekeeper

---

## Overview

This phase introduces policy tables for controlling negotiation behavior:
- Platform-level defaults
- Tenant-level overrides
- Server-side enforcement using loaded policies
- No UI changes, no workflow changes

This enables:
- Behavior changes without redeploys
- Future monetization (paid tiers = higher limits)
- Proposal shell integration readiness

---

## A) Database Schema

### 1. Platform Negotiation Policy (Defaults)

```sql
CREATE TABLE cc_platform_negotiation_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_type text NOT NULL
    CHECK (negotiation_type IN ('schedule', 'scope', 'pricing')),
  max_turns integer NOT NULL,
  allow_counter boolean NOT NULL DEFAULT true,
  close_on_accept boolean NOT NULL DEFAULT true,
  close_on_decline boolean NOT NULL DEFAULT true,
  provider_can_initiate boolean NOT NULL DEFAULT true,
  stakeholder_can_initiate boolean NOT NULL DEFAULT true,
  allow_proposal_context boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negotiation_type)
);
```

### 2. Tenant Negotiation Policy (Overrides)

```sql
CREATE TABLE cc_tenant_negotiation_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES cc_tenants(id),
  negotiation_type text NOT NULL
    CHECK (negotiation_type IN ('schedule', 'scope', 'pricing')),
  max_turns integer,
  allow_counter boolean,
  close_on_accept boolean,
  close_on_decline boolean,
  provider_can_initiate boolean,
  stakeholder_can_initiate boolean,
  allow_proposal_context boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, negotiation_type)
);
```

---

## B) Seed Data

```sql
INSERT INTO cc_platform_negotiation_policy
(negotiation_type, max_turns, allow_counter, allow_proposal_context)
VALUES
('schedule', 3, true, false),
('scope', 5, true, true),
('pricing', 5, true, true);
```

### Verified Seed Data

| negotiation_type | max_turns | allow_counter | close_on_accept | close_on_decline | provider_can_initiate | stakeholder_can_initiate | allow_proposal_context |
|------------------|-----------|---------------|-----------------|------------------|----------------------|-------------------------|------------------------|
| pricing          | 5         | true          | true            | true             | true                 | true                    | true                   |
| schedule         | 3         | true          | true            | true             | true                 | true                    | false                  |
| scope            | 5         | true          | true            | true             | true                 | true                    | true                   |

---

## C) RLS Policies

```sql
-- Platform policies: service mode bypass + public select
ALTER TABLE cc_platform_negotiation_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_policy_service_bypass
ON cc_platform_negotiation_policy
FOR ALL USING (is_service_mode());

CREATE POLICY platform_policy_select_any
ON cc_platform_negotiation_policy
FOR SELECT USING (true);

-- Tenant policies: tenant-scoped access
ALTER TABLE cc_tenant_negotiation_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_policy_select
ON cc_tenant_negotiation_policy
FOR SELECT USING (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY tenant_policy_insert
ON cc_tenant_negotiation_policy
FOR INSERT WITH CHECK (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY tenant_policy_update
ON cc_tenant_negotiation_policy
FOR UPDATE USING (tenant_id = current_tenant_id() OR is_service_mode());

CREATE POLICY tenant_policy_delete
ON cc_tenant_negotiation_policy
FOR DELETE USING (tenant_id = current_tenant_id() OR is_service_mode());
```

---

## D) Policy Resolution Function

**File**: `server/lib/negotiation-policy.ts`

```typescript
export async function loadNegotiationPolicy(
  tenantId: string,
  negotiationType: NegotiationType
): Promise<ResolvedNegotiationPolicy> {
  // 1. Load platform defaults
  const platform = await pool.query(
    `SELECT * FROM cc_platform_negotiation_policy WHERE negotiation_type = $1`,
    [negotiationType]
  );

  // 2. Load tenant overrides
  const tenant = await pool.query(
    `SELECT * FROM cc_tenant_negotiation_policy
     WHERE tenant_id = $1 AND negotiation_type = $2`,
    [tenantId, negotiationType]
  );

  // 3. Merge (tenant overrides platform where not null)
  return {
    negotiationType,
    maxTurns: tenant.max_turns ?? platform.max_turns,
    allowCounter: tenant.allow_counter ?? platform.allow_counter,
    closeOnAccept: tenant.close_on_accept ?? platform.close_on_accept,
    closeOnDecline: tenant.close_on_decline ?? platform.close_on_decline,
    providerCanInitiate: tenant.provider_can_initiate ?? platform.provider_can_initiate,
    stakeholderCanInitiate: tenant.stakeholder_can_initiate ?? platform.stakeholder_can_initiate,
    allowProposalContext: tenant.allow_proposal_context ?? platform.allow_proposal_context,
  };
}
```

---

## E) Enforcement Changes (Before/After)

### GET /api/runs/:id/schedule-proposals

**BEFORE** (hardcoded):
```typescript
const TURN_CAP = 3;
const turnsRemaining = Math.max(0, TURN_CAP - turnsUsed);
const isClosed = latestEvent && 
  (latestEvent.event_type === 'accepted' || latestEvent.event_type === 'declined');

res.json({
  turn_cap: TURN_CAP,
  // ...
});
```

**AFTER** (policy-driven):
```typescript
const policy = await loadNegotiationPolicy(runTenantId, 'schedule');
const turnsRemaining = Math.max(0, policy.maxTurns - turnsUsed);
const isClosed = latestEvent && (
  (latestEvent.event_type === 'accepted' && policy.closeOnAccept) ||
  (latestEvent.event_type === 'declined' && policy.closeOnDecline)
);

res.json({
  turn_cap: policy.maxTurns,
  policy: {
    allow_counter: policy.allowCounter,
    provider_can_initiate: policy.providerCanInitiate,
    stakeholder_can_initiate: policy.stakeholderCanInitiate,
    allow_proposal_context: policy.allowProposalContext
  },
  // ...
});
```

### POST /api/runs/:id/schedule-proposals

**BEFORE** (hardcoded):
```typescript
const TURN_CAP = 3;

if (latestEvent && (latestEvent.event_type === 'accepted' || latestEvent.event_type === 'declined')) {
  return res.status(409).json({ error: 'error.negotiation_closed' });
}

if (turnsUsed >= TURN_CAP) {
  return res.status(409).json({ error: 'error.turn_cap_reached' });
}
```

**AFTER** (policy-driven):
```typescript
const policy = await loadNegotiationPolicy(runTenantId, 'schedule');

const validation = validatePolicyEnforcement(
  policy,
  actorRole,
  event_type,
  turnsUsed,
  isClosed
);

if (!validation.valid) {
  return res.status(409).json({ 
    ok: false, 
    error: validation.error,
    message: /* Human-readable message based on error type */
  });
}
```

---

## F) Policy Validation Helper

```typescript
export function validatePolicyEnforcement(
  policy: ResolvedNegotiationPolicy,
  actorRole: 'tenant' | 'stakeholder',
  eventType: 'proposed' | 'countered' | 'accepted' | 'declined',
  turnsUsed: number,
  isClosed: boolean
): { valid: boolean; error?: string } {
  // Check closed state
  if (isClosed) {
    return { valid: false, error: 'error.negotiation.closed' };
  }

  // Check turn cap for proposals/counters
  if ((eventType === 'proposed' || eventType === 'countered') && turnsUsed >= policy.maxTurns) {
    return { valid: false, error: 'error.negotiation.turn_limit_reached' };
  }

  // Check counter allowed
  if (eventType === 'countered' && !policy.allowCounter) {
    return { valid: false, error: 'error.negotiation.counter_not_allowed' };
  }

  // Check initiation permissions
  if (eventType === 'proposed') {
    if (actorRole === 'tenant' && !policy.providerCanInitiate) {
      return { valid: false, error: 'error.negotiation.provider_cannot_initiate' };
    }
    if (actorRole === 'stakeholder' && !policy.stakeholderCanInitiate) {
      return { valid: false, error: 'error.negotiation.stakeholder_cannot_initiate' };
    }
  }

  return { valid: true };
}
```

---

## G) API Response Changes

### GET /api/runs/:id/schedule-proposals now returns:

```json
{
  "ok": true,
  "turn_cap": 3,
  "turns_used": 2,
  "turns_remaining": 1,
  "is_closed": false,
  "policy": {
    "allow_counter": true,
    "provider_can_initiate": true,
    "stakeholder_can_initiate": true,
    "allow_proposal_context": false
  },
  "latest": { ... },
  "events": [ ... ]
}
```

---

## H) Error Codes (Policy-Driven)

| Error Code | Description |
|------------|-------------|
| `error.negotiation.closed` | Negotiation is closed (accepted/declined) |
| `error.negotiation.turn_limit_reached` | Maximum turns exceeded |
| `error.negotiation.counter_not_allowed` | Counter proposals disabled |
| `error.negotiation.provider_cannot_initiate` | Provider initiation disabled |
| `error.negotiation.stakeholder_cannot_initiate` | Stakeholder initiation disabled |

---

## I) Certification Checklist

| Requirement | Status |
|-------------|--------|
| Platform policy table created | ✅ |
| Tenant override table created | ✅ |
| Platform defaults seeded | ✅ |
| RLS policies applied | ✅ |
| Policy resolution function | ✅ |
| GET endpoint uses policy | ✅ |
| POST endpoint uses policy | ✅ |
| Hardcoded TURN_CAP removed | ✅ |
| Hardcoded close checks replaced | ✅ |
| Policy exposed in API response | ✅ |
| No UI changes | ✅ |
| No workflow changes | ✅ |

---

## Files Created/Modified

- `server/migrations/187_negotiation_policy.sql` - NEW
- `shared/schema.ts` - Added policy table schemas and types
- `server/lib/negotiation-policy.ts` - NEW (policy resolution helper)
- `server/routes/stakeholder-runs.ts` - Updated to use policy enforcement

---

**CERTIFIED**: STEP 11C Phase 2C-3.0 complete with policy tables, seed data, and server-side enforcement verified.

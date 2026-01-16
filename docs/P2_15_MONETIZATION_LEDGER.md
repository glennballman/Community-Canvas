# P2.15 Monetization Event Ledger

## Overview

The Monetization Event Ledger provides a comprehensive system for tracking billable actions, enforcing plan-based limits, and supporting future billing integrations. It enables plan-gated features with both hard and soft limits.

## Architecture

### Core Components

1. **cc_monetization_plans** - Global and tenant-specific plan definitions
2. **cc_monetization_plan_assignments** - Links tenants to their active plans
3. **cc_monetization_events** - Append-only ledger of all billable events
4. **cc_monetization_usage_snapshots** - Periodic usage summaries for reporting

### Gating Engine

Located at `server/lib/monetization/gating.ts`, the gating engine provides:

- **Event gate checking**: `checkGate(tenantId, eventType, quantity)`
- **Feature flag checking**: `checkFeature(tenantId, featureKey)`
- **Event recording**: `recordEvent(input, options)` / `recordEventOrThrow(input)`
- **Usage summaries**: `getUsageSummary(tenantId)`
- **Plan assignment**: `assignPlan(tenantId, planKey, assignedBy)`

## Event Types

| Event Type | Subject Type | Description |
|------------|--------------|-------------|
| `emergency_run_started` | emergency_run | New emergency run initiated |
| `emergency_playbook_exported` | emergency_run | Playbook exported to PDF/Word |
| `evidence_bundle_sealed` | evidence_bundle | Evidence bundle sealed with hash |
| `insurance_dossier_assembled` | dossier | Insurance claim dossier created |
| `insurance_dossier_exported` | dossier | Dossier exported to carrier format |
| `defense_pack_assembled` | defense_pack | Legal defense pack created |
| `defense_pack_exported` | defense_pack | Defense pack exported |
| `authority_share_issued` | authority_grant | External access grant created |
| `interest_group_triggered` | interest_group | Anonymous group threshold triggered |
| `record_capture_created` | record_capture | New record captured |
| `offline_sync_batch` | offline_batch | Offline batch synced |

## Default Plans

### Free Plan
- 3 emergency runs/month
- 5 evidence bundles/month
- 2 authority shares/month
- Hard gates: defense_pack_export, insurance_dossier_exported

### Pro Plan
- 50 emergency runs/month
- 100 evidence bundles/month
- 25 authority shares/month
- 20 defense packs/month
- 20 insurance dossiers/month
- All features enabled

### Emergency Plus Plan
- 999 emergency runs/month
- 999 playbook exports/month
- 500 evidence bundles/month
- 100 authority shares/month
- All features enabled

## API Endpoints

### GET /api/monetization/usage
Returns current usage summary for the tenant.

**Response:**
```json
{
  "tenantId": "uuid",
  "periodKey": "2026-01",
  "planKey": "pro",
  "events": {
    "emergency_run_started": {
      "count": 5,
      "limit": 50,
      "remaining": 45,
      "percentUsed": 10
    }
  },
  "features": {
    "anonymous_groups": true,
    "offline_capture": true
  }
}
```

### GET /api/monetization/plan
Returns the active plan for the tenant.

### GET /api/monetization/plans
Returns all available plans (global + tenant-specific).

### POST /api/monetization/check-event
Check if an event is allowed without recording it.

**Request:**
```json
{
  "eventType": "emergency_run_started",
  "quantity": 1
}
```

### POST /api/monetization/check-feature
Check if a feature is enabled for the tenant.

**Request:**
```json
{
  "featureKey": "anonymous_groups"
}
```

### POST /api/monetization/assign-plan
Assign a plan to a tenant (platform admin only).

**Request:**
```json
{
  "tenantId": "uuid",
  "planKey": "pro",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "effectiveTo": "2027-01-01T00:00:00Z"
}
```

## Integration Guide

### Recording Events from Subsystems

```typescript
import { recordEventOrThrow, checkGate } from "../lib/monetization/gating";

// Option 1: Record and throw if blocked
async function startEmergencyRun(tenantId: string, userId: string) {
  // This will throw if limit exceeded
  await recordEventOrThrow({
    tenantId,
    eventType: 'emergency_run_started',
    actorIndividualId: userId,
    subjectType: 'emergency_run',
    metadata: { ... }
  });
  
  // Continue with run creation...
}

// Option 2: Check first, handle gracefully
async function sealEvidenceBundle(tenantId: string, bundleId: string) {
  const check = await checkGate(tenantId, 'evidence_bundle_sealed');
  
  if (!check.allowed) {
    // Return upgrade prompt to user
    return {
      blocked: true,
      reason: check.reason,
      upgradeRequired: check.isHardGate
    };
  }
  
  // Record the event
  await recordEventOrThrow({
    tenantId,
    eventType: 'evidence_bundle_sealed',
    subjectType: 'evidence_bundle',
    subjectId: bundleId
  });
  
  // Continue with sealing...
}
```

### Checking Features

```typescript
import { checkFeature } from "../lib/monetization/gating";

async function createAnonymousGroup(tenantId: string) {
  const { enabled, reason } = await checkFeature(tenantId, 'anonymous_groups');
  
  if (!enabled) {
    throw new Error(reason);
  }
  
  // Continue with creation...
}
```

## Database Schema

### Enums

```sql
CREATE TYPE cc_monetization_plan_status AS ENUM ('active', 'inactive', 'deprecated');

CREATE TYPE cc_monetization_event_type AS ENUM (
  'emergency_run_started',
  'emergency_playbook_exported',
  'evidence_bundle_sealed',
  'insurance_dossier_assembled',
  'insurance_dossier_exported',
  'defense_pack_assembled',
  'defense_pack_exported',
  'authority_share_issued',
  'interest_group_triggered',
  'record_capture_created',
  'offline_sync_batch'
);
```

### Tables

```sql
-- Plans (global when tenant_id IS NULL, tenant-specific otherwise)
CREATE TABLE cc_monetization_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  plan_key text NOT NULL,
  title text NOT NULL,
  description text,
  entitlements jsonb NOT NULL,
  status cc_monetization_plan_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Plan assignments
CREATE TABLE cc_monetization_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES cc_monetization_plans(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'active',
  assigned_by_individual_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Append-only event ledger
CREATE TABLE cc_monetization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  portal_id uuid,
  circle_id uuid,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_individual_id uuid,
  subject_type text,
  subject_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  plan_key text,
  period_key text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  client_request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Usage snapshots for reporting
CREATE TABLE cc_monetization_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES cc_monetization_plans(id),
  period_key text NOT NULL,
  usage jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
```

## RLS Policies

All tables enforce RLS with:
- **is_service_mode()** bypass for internal operations
- Tenant-scoped access for plan assignments, events, and snapshots
- Global plans (tenant_id IS NULL) readable by all tenants

The events table has an append-only trigger that prevents updates/deletes outside service mode.

## Invariants

1. **Append-Only Ledger**: Events cannot be modified or deleted (except in service mode)
2. **Period Keys**: Events are grouped by period (day/week/month/year) for limit enforcement using ISO 8601 week numbering
3. **Plan Precedence**: Tenant-specific plans override global plans
4. **Blocked Events**: Events that exceed limits are still recorded with `blocked=true`
5. **Idempotency**: `client_request_id` prevents duplicate event recording - existing events with same client_request_id are returned instead of creating duplicates

## Security

- **Authentication Required**: All tenant-scoped routes require JWT authentication
- **Tenant Context**: Tenant ID is derived from JWT claims or verified session context, NOT from spoofable headers
- **Platform Admin Override**: Platform admins can query any tenant via `?tenantId=` query param
- **Platform Admin Only**: Plan assignment requires `isPlatformAdmin` flag in JWT
- **Event Type Validation**: Only valid event types are accepted (Zod enum validation)
- **RLS Enforcement**: All tables use row-level security with tenant isolation
- **Idempotency Guarantee**: Unique constraint on (tenant_id, client_request_id) prevents race condition duplicates

## Future Enhancements

1. **Stripe Integration**: Connect plans to Stripe subscription tiers
2. **Usage-Based Billing**: Calculate invoices from event counts
3. **Overage Alerts**: Notify tenants approaching limits
4. **Plan Upgrades**: Self-service plan changes with proration
5. **Circle Pooling**: Share limits across coordination circles

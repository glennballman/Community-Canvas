# P2.7 Legal Hold & Retention Policies

## Overview

The Legal Hold subsystem prevents deletion and mutation of evidence, bundles, and claim dossiers while under legal hold. It provides audit-grade logging and is compatible with existing RLS and GUC context. Enforcement happens at the database trigger level (source of truth) with additional server-side checks.

**Key Principle**: Once a hold is applied, the platform becomes legally defensive by construction.

## Architecture

### Data Model

```
┌─────────────────────────┐
│    cc_legal_holds       │───────────────┐
│   (Hold containers)     │               │
└──────────┬──────────────┘               │
           │ 1:n                          │ 1:n
           ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│  cc_legal_hold_targets  │    │  cc_legal_hold_events   │
│ (What's being held)     │    │ (Append-only audit log) │
└─────────────────────────┘    └─────────────────────────┘

┌─────────────────────────┐
│  cc_retention_policies  │ (Future automation - metadata only)
└─────────────────────────┘
```

### Key Tables

#### cc_legal_holds

A hold container that groups related targets.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Owning tenant |
| circle_id | uuid | Optional circle scope |
| portal_id | uuid | Optional portal scope |
| hold_type | enum | insurance_claim, dispute_defense, class_action, regulatory, litigation, other |
| title | text | Hold title (e.g., "Wildfire 2026") |
| description | text | Detailed description |
| hold_status | enum | active, released |
| released_at | timestamptz | When released |
| release_reason | text | Why released |

#### cc_legal_hold_targets

Targets covered by a hold.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hold_id | uuid | Parent hold |
| target_type | enum | evidence_object, evidence_bundle, claim, claim_dossier, table_scope |
| target_id | uuid | Specific row ID (for row targets) |
| table_name | text | Table name (for table_scope) |
| scope_filter | jsonb | Filter for table_scope (circle_id, portal_id, claim_id) |
| notes | text | Notes about why this target is held |

**Constraint**: Either `target_id` (for specific rows) or `table_name` (for table_scope) must be set.

#### cc_legal_hold_events

Append-only audit log for all hold actions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hold_id | uuid | Parent hold |
| event_type | enum | created, target_added, target_removed, released, access_blocked, export_blocked |
| event_at | timestamptz | When event occurred |
| actor_individual_id | uuid | Who performed the action |
| event_payload | jsonb | Event details |

**Immutability**: This table cannot be updated or deleted (enforced by trigger).

#### cc_retention_policies

Retention rules for future automation.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| policy_scope | enum | evidence, bundles, claims, dossiers, all |
| retain_days | int | Days to retain (null = indefinite) |
| min_severity | text | Minimum severity to retain |

## Protected Tables

The following tables are protected by legal hold enforcement:

| Table | Operations Blocked |
|-------|-------------------|
| cc_evidence_objects | UPDATE, DELETE |
| cc_evidence_bundles | UPDATE, DELETE |
| cc_evidence_bundle_items | UPDATE, DELETE (when parent bundle is held) |
| cc_insurance_claims | DELETE, UPDATE of core fields (status changes allowed) |
| cc_claim_dossiers | UPDATE, DELETE |
| cc_claim_inputs | UPDATE, DELETE (when parent claim is held) |

## Enforcement Mechanism

### Database Function

```sql
cc_is_row_on_active_hold(tenant_id, target_type, target_id) → boolean
```

Returns `true` if:
1. Direct target match: The specific row is targeted by an active hold
2. Scope match: A parent claim is held (for linked evidence/dossiers)

### Triggers

Each protected table has a BEFORE UPDATE/DELETE trigger that:
1. Calls `cc_is_row_on_active_hold()`
2. If true, raises exception `LEGAL_HOLD_ACTIVE`

### Scope-Based Holds

When a **claim** is held, the following are also protected:
- Evidence objects attached to the claim (via cc_claim_inputs)
- Evidence bundles attached to the claim (via cc_claim_inputs)
- Dossiers created for the claim

This means placing a hold on a claim automatically protects all related evidence.

## API Endpoints

### Holds

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/legal/holds` | Create a hold |
| GET | `/api/legal/holds` | List holds (filter by status) |
| GET | `/api/legal/holds/:id` | Get hold with targets and events |
| POST | `/api/legal/holds/:id/targets` | Add target to hold |
| POST | `/api/legal/holds/:id/release` | Release hold with reason |

### Retention Policies

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/legal/retention-policies` | Create policy |
| GET | `/api/legal/retention-policies` | List policies |

## Helper Functions

```typescript
import { 
  assertNotOnHold, 
  isRowOnActiveHold,
  listActiveHoldsForTarget 
} from './lib/legal/holds';

// Check if row is on hold
const onHold = await isRowOnActiveHold(tenantId, 'evidence_object', evidenceId);

// Throw if on hold
await assertNotOnHold({
  tenantId,
  targetType: 'evidence_bundle',
  targetId: bundleId,
});

// List all active holds for a target
const holds = await listActiveHoldsForTarget(tenantId, 'claim', claimId);
```

## Usage Examples

### Creating a Legal Hold

```typescript
const hold = await createLegalHold({
  tenantId: 'tenant-uuid',
  holdType: 'insurance_claim',
  title: 'Wildfire 2026 Claims',
  description: 'Preserve all evidence related to 2026 wildfire claims',
});
```

### Adding Targets to a Hold

```typescript
// Hold specific evidence
await addHoldTarget({
  holdId: hold.id,
  tenantId: 'tenant-uuid',
  targetType: 'evidence_object',
  targetId: evidenceId,
  notes: 'Critical photo evidence',
});

// Hold an entire claim (protects all attached evidence)
await addHoldTarget({
  holdId: hold.id,
  tenantId: 'tenant-uuid',
  targetType: 'claim',
  targetId: claimId,
  notes: 'Full claim preservation',
});
```

### Releasing a Hold

```typescript
await releaseHold({
  holdId: hold.id,
  tenantId: 'tenant-uuid',
  reason: 'Claim settled, litigation complete',
  releasedByIndividualId: userId,
});
```

## Threat Model

### Spoliation Prevention

The legal hold system prevents:
- Accidental deletion of evidence during active litigation
- Modification of sealed evidence content
- Tampering with audit trails

### Audit Trail

Every action is logged:
- Hold creation with who/when/why
- Each target addition with notes
- Release with reason
- Blocked access attempts (if logged at app layer)

### RLS Enforcement

All tables enforce:
- `tenant_id` isolation
- Circle membership for circle-scoped holds
- Service mode bypass for administrative operations

## Testing

16 tests cover:

| Category | Tests |
|----------|-------|
| Hold Creation | 2 |
| Target Addition | 3 |
| Hold Enforcement on Evidence | 2 |
| Hold Release | 3 |
| Bundle Hold Enforcement | 1 |
| Helper Functions | 3 |
| Append-Only Events | 2 |

Run tests:
```bash
npx vitest run tests/legal/holds.test.ts
```

## Files

| File | Description |
|------|-------------|
| `server/migrations/133_legal_hold_retention.sql` | Database migration |
| `server/lib/legal/holds.ts` | Hold management functions |
| `server/lib/legal/retention.ts` | Retention policy functions |
| `server/routes/legal.ts` | API routes |
| `tests/legal/holds.test.ts` | Test suite |

## Integration with P2.5/P2.6

The legal hold system integrates with:
- **P2.5 Evidence Chain-of-Custody**: Protects evidence objects and bundles
- **P2.6 Insurance Claims**: Protects claims, dossiers, and attached inputs

Exports are **allowed** under hold (that's often the purpose), but deletions are forbidden.

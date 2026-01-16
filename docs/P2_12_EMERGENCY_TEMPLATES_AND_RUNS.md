# P2.12 Emergency Templates & Emergency Circle Mode Hardening

## Overview

P2.12 provides emergency management capabilities for handling real-time incidents with:
- Pre-defined emergency templates for various emergency types
- Property-specific emergency profiles with contacts and hazard overrides
- Emergency run lifecycle with automatic legal hold creation
- Temporary scope grants for emergency privilege escalation
- Offline playbook export for low-signal environments
- Integration with P2.5 (Evidence Bundles), P2.7 (Legal Holds), and P2.9 (Authority Sharing)

## Database Schema

### Tables

#### cc_emergency_templates
Pre-defined templates for different emergency types.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant owning the template |
| template_type | text | Type: tsunami, wildfire, power_outage, storm, medical, security, evacuation, other |
| title | text | Human-readable title |
| version | int | Template version number |
| status | text | draft, active, retired |
| template_json | jsonb | Template content (sections, checklists, contacts) |
| template_sha256 | text | Content hash for verification |

#### cc_property_emergency_profiles
Property-specific emergency configurations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant |
| property_label | text | Property identifier |
| address | text | Physical address |
| lat/lon | numeric | Coordinates |
| hazard_overrides | jsonb | Muster points, generator locations, etc. |
| contacts | jsonb | Owner, operator, emergency contacts |
| dependencies | jsonb | Infrastructure dependencies (water, power) |

#### cc_emergency_runs
Active or completed emergency response instances.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant |
| template_id | uuid | Reference to template |
| property_profile_id | uuid | Reference to property profile |
| run_type | text | Emergency type |
| status | text | active, resolved, cancelled |
| legal_hold_id | uuid | Auto-created legal hold |
| coordination_bundle_id | uuid | Sealed evidence bundle |
| authority_grant_id | uuid | P2.9 share (if created) |

#### cc_emergency_scope_grants
Temporary privilege escalation during emergencies.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| run_id | uuid | Parent emergency run |
| grantee_individual_id | uuid | Who receives the grant |
| grant_type | text | asset_control, vehicle_access, procurement_override, etc. |
| scope_json | jsonb | Specific asset IDs or scope details |
| expires_at | timestamptz | Max 72 hours from grant time |
| status | text | active, revoked, expired |

#### cc_emergency_run_events
Immutable append-only event log.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| run_id | uuid | Parent run |
| event_type | text | run_started, template_bound, scope_granted, resolved, etc. |
| event_at | timestamptz | Event timestamp |
| actor_individual_id | uuid | Who triggered the event |
| event_payload | jsonb | Event-specific data |

## API Endpoints

Base path: `/api/emergency`

### Templates

| Method | Path | Description |
|--------|------|-------------|
| POST | /templates | Create new template |
| GET | /templates | List tenant templates |
| GET | /templates/:id | Get template by ID |
| PUT | /templates/:id | Update template |
| POST | /templates/:id/activate | Activate template |

### Property Profiles

| Method | Path | Description |
|--------|------|-------------|
| POST | /properties | Create property profile |
| GET | /properties | List property profiles |
| GET | /properties/:id | Get profile by ID |
| PUT | /properties/:id | Update profile |

### Emergency Runs

| Method | Path | Description |
|--------|------|-------------|
| POST | /runs | Start emergency run |
| GET | /runs | List runs (active by default) |
| GET | /runs/:id | Get run details |
| POST | /runs/:id/resolve | Resolve run |
| POST | /runs/:id/cancel | Cancel run |
| POST | /runs/:id/attach-evidence | Attach evidence to run |
| POST | /runs/:id/share | Create authority share |

### Scope Grants

| Method | Path | Description |
|--------|------|-------------|
| POST | /runs/:runId/grants | Create scope grant |
| DELETE | /grants/:grantId | Revoke grant |

### Playbook Export

| Method | Path | Description |
|--------|------|-------------|
| POST | /runs/:id/playbook | Export offline playbook ZIP |

## Core Functions

### startEmergencyRun()
Starts a new emergency run with automatic:
1. Run record creation
2. Coordination bundle creation (sealed evidence)
3. Legal hold creation with run as target
4. Initial event logging

```typescript
const result = await startEmergencyRun({
  tenantId: '...',
  runType: 'wildfire',
  templateId: '...',
  propertyProfileId: '...',
  summary: 'Smoke detected in north quadrant',
  startedByIndividualId: '...',
});
// result: { runId, bundleId, holdId }
```

### createScopeGrant()
Creates temporary privilege escalation.

```typescript
const grantId = await createScopeGrant({
  tenantId: '...',
  runId: '...',
  granteeIndividualId: '...',
  grantType: 'vehicle_access',
  scopeJson: { vehicle_ids: ['v1', 'v2'] },
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Max 72 hours
  grantedByIndividualId: '...',
});
```

### resolveEmergencyRun()
Resolves an active run, optionally creating an authority share.

```typescript
const result = await resolveEmergencyRun({
  tenantId: '...',
  runId: '...',
  summary: 'Fire contained, minimal damage',
  resolvedByIndividualId: '...',
  autoShare: true, // Creates P2.9 authority share
});
```

### exportPlaybook()
Exports an offline playbook ZIP to R2 storage.

```typescript
const result = await exportPlaybook(tenantId, runId, actorIndividualId);
// result: { r2Key, url, playbookSha256, verificationSha256 }
```

## Scope Grant Types

| Type | Description |
|------|-------------|
| asset_control | Access to specific assets during emergency |
| tool_access | Access to tools/equipment |
| vehicle_access | Authorization to use vehicles |
| lodging_access | Emergency accommodation access |
| communications_interrupt | Authority to interrupt comms |
| procurement_override | Emergency purchasing authority |
| gate_access | Physical access grants |

## Grant TTL Enforcement

- Maximum grant duration: 72 hours
- Grants auto-expire via `expireEmergencyGrants()` sweeper
- Expired grants logged as events

## Event Types

| Event | Description |
|-------|-------------|
| run_started | Emergency run initiated |
| template_bound | Template attached to run |
| property_bound | Property profile attached |
| scope_granted | Privilege escalation created |
| scope_revoked | Grant revoked or expired |
| evidence_attached | Evidence linked to run |
| playbook_exported | Offline playbook generated |
| authority_shared | P2.9 share created |
| resolved | Run completed successfully |
| cancelled | Run cancelled (false alarm) |

## Integration Points

### P2.5 Evidence Bundles
- Coordination bundles created on run start
- Evidence can be attached during run
- Bundles sealed on resolution

### P2.7 Legal Holds
- Legal hold auto-created on run start
- Run and bundle added as hold targets
- Hold released on cancellation

### P2.9 Authority Sharing
- Optional share creation on resolution
- Allows external parties to view run evidence

## Immutability

Emergency run events are protected by database triggers:
- UPDATE operations are blocked
- DELETE operations only allowed via cascade from parent run deletion
- Ensures audit trail integrity

## Offline Playbook

The playbook ZIP contains:
1. `playbook.json` - Complete emergency info
   - Template details
   - Property details
   - Merged contacts
   - Merged checklists
   - Map coordinates
   
2. `verification.json` - Cryptographic verification
   - Playbook SHA256
   - Template SHA256
   - Bundle SHA256

## Testing

Run tests:
```bash
npx vitest run tests/p2.12-emergency.test.ts
```

Test coverage includes:
- Template and profile CRUD
- Run lifecycle (start, resolve, cancel)
- Scope grant creation, validation, revocation, expiry
- Coordination bundle creation
- Event immutability
- Playbook export to R2
- Template/property binding

# P2.18-B Operator Backend Surface

This document describes the operator backend surface for P2 subsystems (Emergency, Insurance, Legal, Dispute operations).

## Overview

The Operator Backend Surface provides role-based access control for operators managing emergency runs, insurance claims, legal holds, and dispute defense packs. All actions are audited via the `cc_operator_events` append-only log.

## Role Keys

| Role Key | Description |
|----------|-------------|
| `emergency_operator` | Can manage emergency runs, grant/revoke scopes, share with authorities |
| `legal_operator` | Can create/manage legal holds, assemble defense packs |
| `insurance_operator` | Can assemble claim dossiers, export and share with adjusters |
| `platform_operator` | Can assign/revoke operator roles, view audit events |

## Database Tables

### cc_operator_roles
Defines available operator roles per tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant this role belongs to |
| role_key | enum | One of: emergency_operator, legal_operator, insurance_operator, platform_operator |
| title | text | Human-readable title |
| description | text | Optional description |

Constraint: unique(tenant_id, role_key)

### cc_operator_role_assignments
Assigns roles to individuals, optionally scoped to a circle.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant context |
| circle_id | uuid | Optional circle scope (null = tenant-wide) |
| individual_id | uuid | User receiving the role |
| role_id | uuid | FK to cc_operator_roles |
| assigned_at | timestamptz | When assigned |
| assigned_by_individual_id | uuid | Who assigned it |
| status | enum | active or revoked |

### cc_operator_events (Audit Log)
Append-only audit log of all operator actions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Tenant context |
| circle_id | uuid | Optional circle context |
| operator_individual_id | uuid | Who performed the action |
| action_key | text | Action identifier (see below) |
| subject_type | text | Type of subject (emergency_run, claim_dossier, etc.) |
| subject_id | uuid | ID of the subject |
| occurred_at | timestamptz | When it happened |
| payload | jsonb | Additional context |

This table has a trigger preventing UPDATE and DELETE operations.

## Action Keys

| Action Key | Role Required | Description |
|------------|---------------|-------------|
| run_start | emergency_operator | Start an emergency run |
| run_resolve | emergency_operator | Resolve an emergency run |
| run_grant_scope | emergency_operator | Grant access scope |
| run_revoke_scope | emergency_operator | Revoke access scope |
| run_export_playbook | emergency_operator | Export run playbook |
| run_generate_record_pack | emergency_operator | Generate evidence bundle |
| run_share_authority | emergency_operator | Share with external authority |
| run_dashboard_view | emergency_operator | View run dashboard |
| claim_assemble | insurance_operator | Assemble claim dossier |
| dossier_export | insurance_operator | Export dossier |
| dossier_share_authority | insurance_operator | Share dossier with adjuster |
| hold_create | legal_operator | Create legal hold |
| hold_add_target | legal_operator | Add target to hold |
| hold_release | legal_operator | Release legal hold |
| dispute_assemble_defense_pack | legal_operator | Assemble defense pack |
| defense_pack_export | legal_operator | Export defense pack |
| defense_pack_share_authority | legal_operator | Share defense pack with authority |

## API Endpoints

All endpoints are under `/api/operator/p2/` and require authentication plus appropriate operator role.

### Headers Required
- `Authorization: Bearer <token>` - JWT auth token
- `x-tenant-id: <uuid>` - Tenant context
- `x-individual-id: <uuid>` - (optional, falls back to auth user)
- `x-circle-id: <uuid>` - (optional, for circle-scoped operations)

### Emergency Operations

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /p2/emergency/runs/start | emergency_operator | Start a new emergency run |
| POST | /p2/emergency/runs/:id/resolve | emergency_operator | Resolve an emergency run |
| POST | /p2/emergency/runs/:id/grant-scope | emergency_operator | Grant access scope |
| POST | /p2/emergency/runs/:id/revoke-scope | emergency_operator | Revoke access scope |
| POST | /p2/emergency/runs/:id/export-playbook | emergency_operator | Export run as playbook |
| POST | /p2/emergency/runs/:id/generate-record-pack | emergency_operator | Create evidence bundle |
| POST | /p2/emergency/runs/:id/share-authority | emergency_operator | Share with external authority |
| GET | /p2/emergency/runs/:id/dashboard | emergency_operator | Get run dashboard JSON |

### Insurance Operations

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /p2/insurance/claims/:id/assemble | insurance_operator | Assemble claim dossier |
| POST | /p2/insurance/dossiers/:id/export | insurance_operator | Export dossier |
| POST | /p2/insurance/dossiers/:id/share-authority | insurance_operator | Share with adjuster |

### Legal Operations

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /p2/legal/holds | legal_operator | Create legal hold |
| POST | /p2/legal/holds/:id/targets | legal_operator | Add target to hold |
| POST | /p2/legal/holds/:id/release | legal_operator | Release hold |

### Dispute Operations

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /p2/disputes/:id/assemble-defense-pack | legal_operator | Assemble defense pack |
| POST | /p2/defense-packs/:id/export | legal_operator | Export defense pack |
| POST | /p2/defense-packs/:id/share-authority | legal_operator | Share with authority |

### Role Management (Platform Operators)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /p2/roles | platform_operator | List tenant operator roles |
| POST | /p2/roles/assign | platform_operator | Assign role to individual |
| GET | /p2/events | platform_operator | Query audit events |

## RLS Policies

All tables have RLS enabled with tenant isolation:
- `cc_operator_roles`: tenant_id matches current tenant
- `cc_operator_role_assignments`: tenant_id matches current tenant
- `cc_operator_events`: tenant_id matches current tenant

Service mode (`is_service_mode()`) bypasses RLS for system operations.

## Future Console UI Mapping

When the operator console UI is built, these endpoints will power:

1. **Emergency Console** - Real-time emergency run management
2. **Insurance Claims Center** - Claim dossier assembly and export
3. **Legal Hold Manager** - Hold creation and target management
4. **Dispute Defense Center** - Defense pack assembly and sharing
5. **Operator Admin** - Role assignment and audit log viewing

## Auth Helper Functions

Located in `server/lib/operator/authz.ts`:

```typescript
// Check if user has operator role
isOperatorRole(roleKey, { tenantId, circleId?, individualId })

// Require operator role (throws 403 if missing)
requireOperatorRole(roleKey, { tenantId, circleId?, individualId })

// Get all operator roles for a user
getOperatorRoles({ tenantId, circleId?, individualId })

// Assign operator role
assignOperatorRole(roleKey, targetIndividualId, context)

// Revoke operator role
revokeOperatorRole(assignmentId, revokedByIndividualId)
```

## Audit Helper Functions

Located in `server/lib/operator/audit.ts`:

```typescript
// Log an operator action
logOperatorEvent({
  tenantId,
  circleId?,
  operatorIndividualId,
  actionKey,
  subjectType,
  subjectId,
  payload?
})

// Query operator events
getOperatorEvents(tenantId, { circleId?, operatorIndividualId?, actionKey?, subjectType?, subjectId?, limit?, offset? })
```

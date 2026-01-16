# P2.6 Insurance Claim Auto-Assembler

## Overview

The Insurance Claim Auto-Assembler is a subsystem that produces carrier-agnostic, defensible claim dossiers from sealed evidence bundles (P2.5). It supports multiple claimants, policies, and properties per tenant/circle while preserving timeline integrity.

## Architecture

### Data Model

```
┌─────────────────────────┐
│   cc_insurance_policies │
│   (Policy records)      │
└──────────┬──────────────┘
           │ 1:n
           ▼
┌─────────────────────────┐
│   cc_insurance_claims   │
│   (Claim case files)    │
└──────────┬──────────────┘
           │ 1:n
           ▼
┌─────────────────────────┐
│     cc_claim_inputs     │◄──── cc_evidence_bundles (P2.5)
│ (Links to sealed        │◄──── cc_evidence_objects (P2.5)
│  evidence)              │
└──────────┬──────────────┘
           │ 1:n
           ▼
┌─────────────────────────┐
│    cc_claim_dossiers    │
│ (Assembled, immutable)  │
└─────────────────────────┘
```

### Key Tables

#### cc_insurance_policies
Represents insurance policy records (not claims).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Owning tenant |
| circle_id | uuid | Optional circle scope |
| policy_type | enum | property, liability, business_interruption, travel, auto, marine, other |
| carrier_name | text | Insurance carrier |
| broker_name | text | Insurance broker |
| policy_number | text | Policy number |
| named_insured | text | Named insured party |
| effective_date | date | Policy start date |
| expiry_date | date | Policy end date |
| coverage_summary | jsonb | Coverage details |
| contacts | jsonb | Adjuster, broker, emergency contacts |

#### cc_insurance_claims
Represents a claim case file.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Owning tenant |
| policy_id | uuid | Optional linked policy |
| claim_type | enum | evacuation, wildfire, flood, tsunami, power_outage, storm, theft, liability, other |
| claim_status | enum | draft, assembled, submitted, under_review, approved, denied, closed |
| title | text | Claim title |
| loss_occurred_at | timestamptz | When loss occurred |
| loss_discovered_at | timestamptz | When loss was discovered |
| reported_at | timestamptz | When reported to carrier |
| claim_number | text | Carrier-assigned number |
| loss_location | jsonb | Location details (address, lat, lon) |
| claimants | jsonb | Array of claimant records |
| summary | text | Narrative summary |

#### cc_claim_inputs
Links claims to sealed evidence bundles or objects.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| claim_id | uuid | Parent claim |
| bundle_id | uuid | Sealed evidence bundle (mutually exclusive with evidence_object_id) |
| bundle_manifest_sha256 | text | Copied at attach time |
| evidence_object_id | uuid | Sealed evidence object (mutually exclusive with bundle_id) |
| evidence_content_sha256 | text | Copied at attach time |
| label | text | Category label |
| notes | text | Attachment notes |

**Constraint**: Exactly one of `bundle_id` or `evidence_object_id` must be set.

#### cc_claim_dossiers
Assembled dossiers (immutable after creation).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| claim_id | uuid | Parent claim |
| dossier_version | int | Version number (increments) |
| dossier_status | enum | assembled, exported, superseded |
| dossier_json | jsonb | Full dossier content |
| dossier_sha256 | text | SHA256 of canonicalized JSON |
| export_artifacts | jsonb | R2 keys of exports |

## Determinism & Hashing Rules

### Canonical JSON Serialization

All JSON content is canonicalized before hashing:
- Object keys sorted alphabetically (recursive)
- Array order preserved
- No whitespace
- Uses `canonicalizeJson()` from P2.5

### Dossier SHA256 Computation

```
dossier_sha256 = sha256Hex(canonicalizeJson(dossier_content_without_hash))
```

The hash is computed on the dossier content before the `dossierSha256` field is added to verification.

### Timeline Sorting

Evidence items are sorted deterministically:
1. `occurred_at` (nulls last)
2. `created_at`
3. `id`

### Evidence Index Grouping

Evidence is categorized by keywords in labels/titles:
- evacuation_orders
- utilities_outages
- media_reports
- photos_videos
- notes_statements
- telemetry_snapshots
- other

Categories are sorted alphabetically; items within categories sorted by ID.

## Dossier Content Structure

```typescript
interface DossierContent {
  cover: {
    claimTitle: string;
    claimType: ClaimType;
    claimStatus: ClaimStatus;
    createdAt: string;
    createdBy: string | null;
    policySummary: object | null;
    claimants: object[];
  };
  lossDetails: {
    occurredAt: string | null;
    discoveredAt: string | null;
    reportedAt: string | null;
    location: object | null;
    summary: string | null;
  };
  timeline: Array<{
    evidenceId: string;
    sourceType: string;
    title: string | null;
    occurredAt: string | null;
    createdAt: string;
    capturedAt: string | null;
    contentSha256: string;
    tipEventHash: string | null;
    pointer: string | null;
    label: string | null;
  }>;
  evidenceIndex: Record<string, Array<{
    evidenceId: string;
    title: string | null;
    contentSha256: string;
  }>>;
  verification: {
    bundleManifestSha256s: string[];
    evidenceContentSha256s: string[];
    dossierSha256: string;
    assemblyAlgorithmVersion: string;
    assembledAt: string;
  };
}
```

## Required Verification Fields

Every dossier includes:
- `bundleManifestSha256s`: All attached bundle manifest hashes
- `evidenceContentSha256s`: All evidence content hashes
- `dossierSha256`: Hash of the complete dossier
- `assemblyAlgorithmVersion`: Currently `claim_dossier_v1`
- `assembledAt`: ISO timestamp of assembly

## API Endpoints

### Policies

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/insurance/policies` | Create policy |
| GET | `/api/insurance/policies` | List policies |

### Claims

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/insurance/claims` | Create claim (draft) |
| GET | `/api/insurance/claims` | List claims |
| GET | `/api/insurance/claims/:id` | Get claim with inputs |
| POST | `/api/insurance/claims/:id/attach` | Attach sealed evidence |
| POST | `/api/insurance/claims/:id/assemble` | Assemble dossier |
| GET | `/api/insurance/claims/:id/dossiers` | List dossier versions |

### Dossiers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/insurance/dossiers/:id` | Get dossier content |
| POST | `/api/insurance/dossiers/:id/export` | Export as zip_json |

## Export Format: zip_json

The `zip_json` export produces a ZIP archive containing:

```
dossier-v{version}.zip
├── dossier.json      # Full dossier content
└── inputs.json       # Attached bundle/evidence references
```

The ZIP is stored in R2 at:
```
insurance-dossiers/{tenant_id}/{claim_id}/{dossier_id}/dossier-v{version}.zip
```

## Validation Rules

### Attachment Rules
1. Only sealed bundles/objects can be attached
2. Duplicate attachments are rejected
3. Exactly one of `bundle_id` or `evidence_object_id` required

### Assembly Rules
1. All attached inputs must still be sealed
2. Creates new version if prior version exists
3. Previous versions marked as superseded
4. Claim status updated to `assembled`

### Immutability Rules
1. `dossier_json` cannot be modified after creation
2. `dossier_sha256` cannot be modified after creation
3. Only `dossier_status` and `export_artifacts` can be updated

## Monetization Hooks

The following events can be tracked for billing:
- `claim_created`: New claim draft created
- `dossier_assembled`: Dossier version assembled
- `dossier_exported`: Dossier exported to R2

These are logged as audit events (no billing implementation in this phase).

## RLS Policies

All tables enforce:
- `tenant_id = current_setting('app.tenant_id')::uuid`
- Circle membership for circle-scoped records
- Service mode bypass via `is_service_mode()`

## Testing

18 tests cover:
- Attach validation (6 tests)
- Deterministic dossier hash (3 tests)
- Dossier versioning (4 tests)
- Claim status updates (1 test)
- Idempotency (1 test)
- Dossier immutability (2 tests)
- Export preparation (1 test)

Run tests:
```bash
npx vitest run tests/insurance/claims.test.ts
```

## Dependencies

- P2.5 Evidence Chain-of-Custody Engine (sealed bundles/objects)
- Cloudflare R2 for export storage
- archiver npm package for ZIP creation

## Files

| File | Description |
|------|-------------|
| `server/migrations/132_insurance_claim_auto_assembler.sql` | Database migration |
| `server/lib/claims/assemble.ts` | Dossier assembly engine |
| `server/routes/insurance.ts` | API routes |
| `tests/insurance/claims.test.ts` | Test suite |

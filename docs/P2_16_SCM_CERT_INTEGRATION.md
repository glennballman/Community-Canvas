# P2.16 SCM Integration + Certification Decision Pack

## Overview

The System Completion Matrix (SCM) Integration provides a unified system for tracking module completion, computing certification status, and generating decision reports for the P2.5-P2.15 Emergency/Legal/Insurance subsystems.

## Module Keys

The following modules are registered in the SCM:

| Module Key | Title | Category |
|------------|-------|----------|
| P2.5_EVIDENCE_CUSTODY | Evidence Chain-of-Custody Engine | emergency_legal_insurance |
| P2.6_INSURANCE_CLAIMS | Insurance Claim Auto-Assembler | emergency_legal_insurance |
| P2.7_LEGAL_HOLDS | Legal Hold & Retention Policies | emergency_legal_insurance |
| P2.8_OFFLINE_SYNC | Offline/Low-Signal Evidence Queue | emergency_legal_insurance |
| P2.9_AUTHORITY_PORTAL | Authority/Adjuster Read-Only Portals | emergency_legal_insurance |
| P2.10_DEFENSE_PACKS | Dispute/Extortion Defense Pack | emergency_legal_insurance |
| P2.11_ANON_INTEREST_GROUPS | Anonymous Interest Groups & Threshold Triggers | emergency_legal_insurance |
| P2.12_EMERGENCY_TEMPLATES_RUNS | Emergency Templates & Runs | emergency_legal_insurance |
| P2.13_PRESERVE_RECORD_PACKS | Preserve Record Generate Pack | emergency_legal_insurance |
| P2.14_CERT_READINESS_QA | Certification Readiness Gate | emergency_legal_insurance |
| P2.15_MONETIZATION_LEDGER | Monetization Event Ledger | emergency_legal_insurance |

## Database Schema

### scm_modules

Registry of all trackable modules with their certification policies.

```sql
CREATE TABLE scm_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'platform',
  certification_policy JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### scm_proof_runs

Stores proof run results (QA status checks, smoke tests, SQL verification).

```sql
CREATE TABLE scm_proof_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,  -- null = platform-wide proof run
  module_key TEXT,
  run_type TEXT NOT NULL CHECK (run_type IN ('qa_status', 'smoke_test', 'sql_verification')),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok BOOLEAN NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  artifact_refs JSONB NOT NULL DEFAULT '[]',
  created_by_individual_id UUID
);
```

### scm_module_overrides

Manual state overrides (built, held, certified).

```sql
CREATE TABLE scm_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  override_state TEXT NOT NULL CHECK (override_state IN ('built', 'held', 'certified')),
  override_reason TEXT,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  set_by_individual_id UUID
);
```

### scm_certification_states

Computed certification states for each module.

```sql
CREATE TABLE scm_certification_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT UNIQUE NOT NULL,
  computed_state TEXT NOT NULL,  -- built | certifiable
  effective_state TEXT NOT NULL, -- built | certifiable | certified | held
  is_built BOOLEAN NOT NULL DEFAULT false,
  is_certifiable BOOLEAN NOT NULL DEFAULT false,
  is_certified BOOLEAN NOT NULL DEFAULT false,
  is_held BOOLEAN NOT NULL DEFAULT false,
  last_qa_status_run_id UUID,
  last_qa_status_ok BOOLEAN,
  last_smoke_test_run_id UUID,
  last_smoke_test_ok BOOLEAN,
  docs_present BOOLEAN NOT NULL DEFAULT false,
  missing_docs JSONB NOT NULL DEFAULT '[]',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Certification Policy Schema

Each module has a certification policy that defines when it becomes certifiable:

```json
{
  "certifiable_when": {
    "qa_status_endpoint_ok": true,
    "smoke_test_script_passed": true,
    "rls_enabled": true,
    "critical_triggers_present": true,
    "docs_present": true
  },
  "proof_artifacts": {
    "qa_status_endpoint": "/api/qa/status",
    "smoke_test_script": "scripts/qa-emergency-legal-insurance-smoke.ts",
    "docs": ["docs/P2_5_EVIDENCE_CHAIN_OF_CUSTODY.md"]
  },
  "default_strategy": "hold_for_flex",
  "allowed_states": ["built", "certifiable", "certified", "held"]
}
```

## Module States

| State | Description |
|-------|-------------|
| `built` | Implemented but proofs not complete |
| `certifiable` | All proofs pass; ready to certify |
| `certified` | Intentionally locked in (manual action) |
| `held` | Intentionally not certifying yet (strategic flexibility) |

## API Endpoints

All endpoints require platform admin authentication or a service key.

### GET /api/scm/modules

List all SCM modules.

### GET /api/scm/modules/:moduleKey

Get a specific module with its current state and latest override.

### GET /api/scm/states

Get computed certification states for all modules.

### POST /api/scm/states/recompute

Force recomputation of all certification states.

### POST /api/scm/proof-runs

Record a new proof run.

```json
{
  "run_type": "smoke_test",
  "ok": true,
  "details": { "steps": [...] },
  "artifact_refs": ["logs/qa-smoke-2026-01-16.txt"]
}
```

### GET /api/scm/proof-runs

List recent proof runs.

Query params:
- `run_type`: Filter by type (qa_status, smoke_test, sql_verification)
- `limit`: Number of results (default 20)

### GET /api/scm/proof-runs/latest/:runType

Get the latest proof run of a specific type.

### POST /api/scm/modules/:moduleKey/set-state

Set a manual override state for a module.

```json
{
  "state": "certified",
  "reason": "Approved for production after security review"
}
```

### GET /api/scm/cert-decision-report

Generate and return the certification decision report as JSON.

## Running Scripts

### Smoke Test

Run the QA smoke test and record the result:

```bash
npx tsx scripts/qa-emergency-legal-insurance-smoke.ts
```

The smoke test automatically POSTs its result to `/api/scm/proof-runs`.

### QA Status Check

Check QA status and optionally record it:

```bash
# Just check
curl http://localhost:5000/api/admin/qa/status

# Check and record
curl "http://localhost:5000/api/admin/qa/status?record=1"
```

### Generate Certification Decision Report

Generate the certification decision report (MD + JSON):

```bash
npx tsx scripts/scm-generate-cert-decision-report.ts
```

Outputs:
- `docs/CERT_DECISION_P2_EMERGENCY_LEGAL_INSURANCE.md`
- `docs/CERT_DECISION_P2_EMERGENCY_LEGAL_INSURANCE.json`

## Override Semantics

Manual overrides take precedence over computed states:

1. **Effective State = Override State** if an override exists
2. **Effective State = Computed State** otherwise

Override states:
- `built`: Reset to built state (clears certification)
- `held`: Mark as intentionally not certified (strategic flexibility)
- `certified`: Lock in as certified (manual approval required)

**Important:** Certification is NEVER automatic. A module can become `certifiable` automatically based on proofs, but transitioning to `certified` requires an explicit manual action.

## What "Certified" Means

When a module is marked as `certified`:

1. Its core invariants are considered **locked**
2. Breaking changes require explicit de-certification
3. It's considered production-ready for its intended purpose
4. Safety-critical modules (P2.5, P2.7, P2.9) should be certified first

## Computation Rules

A module is marked as `certifiable` when:

1. Latest `/api/qa/status` check returns `ok=true`
2. Latest smoke test returns `ok=true`
3. All required documentation files exist
4. (Module-specific) Required triggers/policies exist:
   - P2.7: Legal hold triggers present
   - P2.9: Authority token hash-only confirmed
   - P2.11: K-anonymity enforcement confirmed

## Safety-Critical Modules

The following modules are recommended for immediate certification when certifiable:

- **P2.5_EVIDENCE_CUSTODY**: Core evidence integrity
- **P2.7_LEGAL_HOLDS**: Spoliation prevention
- **P2.9_AUTHORITY_PORTAL**: Secure external access

Other modules default to `HOLD` recommendation even when certifiable.

## Files

| File | Purpose |
|------|---------|
| `server/lib/scm/p2_emergency_legal_insurance.ts` | SCM computation hook |
| `server/routes/scm.ts` | API endpoints |
| `scripts/qa-emergency-legal-insurance-smoke.ts` | Smoke test script |
| `scripts/scm-generate-cert-decision-report.ts` | Report generator |
| `shared/schema.ts` | Database schema definitions |

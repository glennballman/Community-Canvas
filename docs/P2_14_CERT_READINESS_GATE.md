# P2.14 Certification Readiness Gate

## Overview

This document provides a comprehensive certification framework for the Emergency/Legal/Insurance subsystems (P2.5–P2.13). It establishes hard proofs, not summaries, for validating system invariants.

## Module Inventory & Status

| Module | Tables | Endpoints | RLS | Tests | Docs | Status |
|--------|--------|-----------|-----|-------|------|--------|
| P2.5 Evidence Chain | cc_evidence_objects, cc_evidence_events, cc_evidence_bundles, cc_evidence_bundle_items | /api/evidence/* | ✅ | ✅ | ✅ | ✅ |
| P2.6 Claim Dossiers | cc_claims, cc_claim_inputs, cc_claim_dossiers | /api/insurance/* | ✅ | ✅ | ✅ | ✅ |
| P2.7 Legal Holds | cc_legal_holds, cc_legal_hold_targets, cc_legal_hold_events | /api/legal/* | ✅ | ✅ | ✅ | ✅ |
| P2.8 Offline Ingest | cc_offline_sync_sessions, cc_offline_sync_queue, cc_offline_reconcile_log | /api/offline/* | ✅ | ✅ | ✅ | ✅ |
| P2.9 Authority Access | cc_authority_access_grants, cc_authority_access_tokens, cc_authority_access_log | /api/authority/* | ✅ | ✅ | ✅ | ✅ |
| P2.10 Defense Packs | cc_disputes, cc_defense_packs | /api/disputes/* | ✅ | ✅ | ✅ | ✅ |
| P2.11 Interest Groups | cc_interest_groups, cc_interest_group_signals | /api/interest-groups/* | ✅ | ✅ | ✅ | ✅ |
| P2.12 Emergency Runs | cc_emergency_templates, cc_emergency_runs, cc_emergency_run_events, cc_emergency_scope_grants | /api/emergency/* | ✅ | ✅ | ✅ | ✅ |
| P2.13 Preserve Record | cc_record_sources, cc_record_captures, cc_record_capture_queue | /api/records/* | ✅ | ✅ | ✅ | ✅ |

## Non-Negotiable Invariants

### 1. Chain-of-Custody Hash Integrity (P2.5)

**Invariant:** Chain-of-custody event hashes must be deterministically recomputable and match stored values.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #6
- Expected: All `event_sha256` values are 64 characters
- Expected: Events after first have valid `prev_event_sha256`

**Verification Endpoint:** `GET /api/admin/qa/check/evidence_chain_integrity`

**Failure Playbook:**
1. Check `cc_evidence_events` for events missing `event_sha256`
2. Verify `computeEventHash()` in `server/lib/records/capture.ts` matches stored logic
3. Look for manual DB inserts bypassing hash computation

### 2. Sealed Evidence Immutability (P2.5)

**Invariant:** Sealed evidence objects and bundles cannot be mutated.

**Proof Requirements:**
- Trigger: `trg_prevent_sealed_evidence_update` on `cc_evidence_objects`
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #2
- Test: Attempt UPDATE on sealed object → must fail

**Verification Endpoint:** `GET /api/admin/qa/status` (check `legal_hold_triggers_present`)

**Failure Playbook:**
1. Check trigger exists: `\d cc_evidence_objects`
2. Verify trigger function `cc_prevent_sealed_evidence_update()`
3. Check for SECURITY DEFINER bypass patterns

### 3. Legal Hold Blocks Destructive Changes (P2.7)

**Invariant:** Evidence under legal hold cannot be deleted or modified.

**Proof Requirements:**
- Trigger: `trg_legal_hold_evidence_objects` on `cc_evidence_objects`
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #10
- Test: Create hold → target evidence → attempt delete → must fail

**Verification Endpoint:** `GET /api/admin/qa/check/legal_hold_triggers_present`

**Failure Playbook:**
1. Check `cc_legal_hold_targets` for active targets
2. Verify trigger function `cc_enforce_hold_on_evidence_objects()`
3. Check hold status is 'active'

### 4. Dossier/Defense Pack Hash Determinism (P2.6, P2.10)

**Invariant:** Manifest hashes are deterministically computed and stable across regeneration.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #11, #17
- Expected: `manifest_sha256` is 64 characters
- Test: Regenerate dossier → hash unchanged if inputs unchanged

**Failure Playbook:**
1. Check manifest generation includes sorted inputs
2. Verify no timestamps in manifest body (use metadata)
3. Check R2 export matches manifest hash

### 5. Authority Tokens Hash-Only Storage (P2.9)

**Invariant:** Authority access tokens are stored as hashes only. Plain tokens never persisted.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #8
- Expected: Column `token_hash` exists, no `token` column with plaintext
- Verification: `GET /api/admin/qa/check/authority_token_hash_only`

**Failure Playbook:**
1. Check column definitions in `cc_authority_access_tokens`
2. Verify token generation code hashes before storage
3. Check for accidental logging of plain tokens

### 6. Authority Token Expiry Enforcement (P2.9)

**Invariant:** Expired tokens deny access. Expiry is enforced at validation time.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #9
- Test: Create grant with short TTL → wait → access denied

**Failure Playbook:**
1. Check `validateToken()` compares `expires_at` against `NOW()`
2. Verify no caching bypasses expiry check
3. Run expiry sweeper if using background job

### 7. Anonymous Group K-Anonymity (P2.11)

**Invariant:** Individual signals cannot be enumerated. Aggregates hidden when count < 5.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #14, #15
- Expected: `encrypted_contact` column exists
- Expected: No endpoint returns individual signals while group is open
- Expected: Counts < 5 displayed as "hidden" or not disclosed

**Verification Endpoint:** `GET /api/admin/qa/check/anonymous_groups_k_anonymity`

**Failure Playbook:**
1. Check RLS policies on `cc_interest_group_signals`
2. Verify aggregate endpoints don't expose raw counts < 5
3. Check contact encryption key management

### 8. Offline Ingest Idempotency (P2.8)

**Invariant:** Duplicate batch/item submissions are safely deduplicated via client_request_id.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #3, #16
- Expected: Unique constraints on `(tenant_id, client_request_id)` or similar

**Verification Endpoint:** `GET /api/admin/qa/check/idempotency_constraints_present`

**Failure Playbook:**
1. Check unique constraints on queue tables
2. Verify ingest endpoints check for existing client_request_id
3. Test: Submit same batch twice → second is no-op

### 9. Emergency Scope Grant TTL Enforcement (P2.12)

**Invariant:** Emergency scope grants have TTL. Expired grants deny access.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #12
- Expected: `expires_at` and `status` columns exist
- Test: Create grant with short TTL → run sweeper → status = 'expired'

**Verification Endpoint:** `GET /api/admin/qa/check/emergency_scope_grant_ttl`

**Failure Playbook:**
1. Check grant creation sets `expires_at`
2. Verify sweeper function updates status to 'expired'
3. Check access validation rejects expired grants

### 10. Preserve-Record SHA256 + Evidence Creation (P2.13)

**Invariant:** Raw bytes are stored to R2. SHA256 computed from raw bytes. Evidence object created.

**Proof Requirements:**
- SQL Query: See `P2_14_SQL_VERIFICATION_QUERIES.md` #13
- Expected: Captures have `content_sha256` (64 chars) and `evidence_object_id`
- Expected: R2 key follows pattern `record-captures/{tenant}/{capture}/{hash}`

**Verification Endpoint:** `GET /api/admin/qa/check/record_capture_schema`

**Failure Playbook:**
1. Check `fetchAndStoreUrlSnapshot()` stores raw bytes
2. Verify SHA256 computed before any processing
3. Check evidence object creation links to capture

## Runtime Verification

### QA Status Endpoint

```bash
curl -X GET /api/admin/qa/status
```

Response:
```json
{
  "ok": true,
  "checks": [
    { "name": "rls_enabled_critical_tables", "ok": true, "details": {...} },
    { "name": "legal_hold_triggers_present", "ok": true, "details": {...} },
    { "name": "idempotency_constraints_present", "ok": true, "details": {...} },
    { "name": "authority_token_hash_only", "ok": true, "details": {...} },
    { "name": "emergency_scope_grant_ttl", "ok": true, "details": {...} },
    { "name": "evidence_chain_integrity", "ok": true, "details": {...} },
    { "name": "offline_queue_schema", "ok": true, "details": {...} },
    { "name": "anonymous_groups_k_anonymity", "ok": true, "details": {...} },
    { "name": "record_capture_schema", "ok": true, "details": {...} },
    { "name": "claim_dossier_schema", "ok": true, "details": {...} }
  ],
  "timestamp": "2025-01-16T..."
}
```

### Individual Check

```bash
curl -X GET /api/admin/qa/check/rls_enabled_critical_tables
```

## Smoke Test Execution

```bash
npx tsx scripts/qa-emergency-legal-insurance-smoke.ts
```

The smoke test validates each subsystem end-to-end:
1. P2.5 Evidence: Create → seal → verify
2. P2.5 Bundle: Create → add items → seal
3. P2.6 Claim: Create → attach bundle → assemble dossier
4. P2.7 Legal Hold: Create → target → block mutation → release
5. P2.9 Authority: Create grant → issue token → validate → revoke
6. P2.10 Defense Pack: Create dispute → assemble pack → export
7. P2.11 Interest Group: Create → submit signals → trigger at threshold
8. P2.12 Emergency Run: Create template → start run → scope grant TTL
9. P2.13 Preserve Record: Create source → capture URL → generate pack
10. QA Status: Verify all checks pass

## Evidence Requirements

For certification audit, provide:

1. **Screenshot Evidence:**
   - `/api/admin/qa/status` response showing all checks pass
   - Smoke test output showing all steps PASS

2. **SQL Query Results:**
   - All queries from `P2_14_SQL_VERIFICATION_QUERIES.md` executed
   - Results showing expected values

3. **Log Evidence:**
   - Server logs during smoke test
   - Any trigger/function execution logs

4. **Database Snapshots:**
   - Before/after state for mutation tests
   - Evidence of legal hold blocking

## Certification Checklist

- [ ] All modules in inventory show ✅ status
- [ ] `/api/admin/qa/status` returns `ok: true` for all checks
- [ ] Smoke test completes with all PASS
- [ ] SQL verification queries return expected results
- [ ] Documentation artifacts exist:
  - [ ] `docs/P2_14_CERT_READINESS_GATE.md` (this file)
  - [ ] `docs/P2_14_SQL_VERIFICATION_QUERIES.md`
  - [ ] `scripts/qa-emergency-legal-insurance-smoke.ts`
  - [ ] `server/lib/qa/runtimeChecks.ts`
  - [ ] `server/routes/qa.ts`

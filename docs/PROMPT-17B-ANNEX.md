# PROMPT-17B Annex: Operator + Contractor Routes Authorization Lock

**Generated**: 2026-01-28  
**Type**: Targeted Remediation  
**Scope**: server/routes/operator.ts, server/routes/contractor-geo.ts, server/routes/contractor-ingestions.ts

---

## Section 1: Target File List

| File | Route Count | Status |
|------|-------------|--------|
| server/routes/operator.ts | 38 (35 gated + 3 public test) | **PASS** |
| server/routes/contractor-geo.ts | 5 | **PASS** |
| server/routes/contractor-ingestions.ts | 15 | **PASS** |

**Total Routes Modified:** 55 routes now capability-gated

---

## Section 2: Route Inventory Table (Before/After)

### server/routes/operator.ts

| Method | Path | Before | After | Evidence |
|--------|------|--------|-------|----------|
| GET | `/availability` | auth-only | tenant.read | operator.ts:59 |
| POST | `/hold-request` | auth-only | tenant.configure | operator.ts:178 |
| POST | `/call-log` | auth-only | tenant.configure | operator.ts:299 |
| POST | `/incidents` | auth-only | tenant.configure | operator.ts:412 |
| GET | `/incidents` | auth-only | tenant.read | operator.ts:454 |
| GET | `/incidents/:id` | auth-only | tenant.read | operator.ts:483 |
| POST | `/incidents/:id/dispatch` | auth-only | tenant.configure | operator.ts:510 |
| POST | `/incidents/:id/resolve` | auth-only | tenant.configure | operator.ts:539 |
| GET | `/incidents/test/lifecycle` | public | public (test) | N/A |
| GET | `/dashboard/availability` | auth-only | tenant.read | operator.ts:586 |
| POST | `/reservations/bundle` | auth-only | tenant.configure | operator.ts:633 |
| GET | `/dashboard/availability/test` | public | public (test) | N/A |
| POST | `/credentials/validate` | auth-only | tenant.configure | operator.ts:745 |
| POST | `/credentials/:id/revoke` | auth-only | tenant.configure | operator.ts:812 |
| POST | `/credentials/:id/extend` | auth-only | tenant.configure | operator.ts:842 |
| GET | `/reservations/:id/credentials` | auth-only | tenant.read | operator.ts:876 |
| GET | `/credentials/test` | public | public (test) | N/A |
| POST | `/p2/emergency/runs/start` | auth-only | tenant.configure | operator.ts:988 |
| POST | `/p2/emergency/runs/:id/resolve` | auth-only | tenant.configure | operator.ts:1010 |
| POST | `/p2/emergency/runs/:id/grant-scope` | auth-only | tenant.configure | operator.ts:1028 |
| POST | `/p2/emergency/runs/:id/revoke-scope` | auth-only | tenant.configure | operator.ts:1050 |
| POST | `/p2/emergency/runs/:id/export-playbook` | auth-only | tenant.configure | operator.ts:1068 |
| POST | `/p2/emergency/runs/:id/generate-record-pack` | auth-only | tenant.configure | operator.ts:1096 |
| POST | `/p2/emergency/runs/:id/share-authority` | auth-only | tenant.configure | operator.ts:1118 |
| GET | `/p2/emergency/runs/:id/dashboard` | auth-only | tenant.read | operator.ts:1142 |
| POST | `/p2/insurance/claims/:id/assemble` | auth-only | tenant.configure | operator.ts:1174 |
| POST | `/p2/insurance/dossiers/:id/export` | auth-only | tenant.configure | operator.ts:1198 |
| POST | `/p2/insurance/dossiers/:id/share-authority` | auth-only | tenant.configure | operator.ts:1222 |
| POST | `/p2/legal/holds` | auth-only | tenant.configure | operator.ts:1247 |
| POST | `/p2/legal/holds/:id/targets` | auth-only | tenant.configure | operator.ts:1268 |
| POST | `/p2/legal/holds/:id/release` | auth-only | tenant.configure | operator.ts:1291 |
| POST | `/p2/disputes/:id/assemble-defense-pack` | auth-only | tenant.configure | operator.ts:1310 |
| POST | `/p2/defense-packs/:id/export` | auth-only | tenant.configure | operator.ts:1334 |
| POST | `/p2/defense-packs/:id/share-authority` | auth-only | tenant.configure | operator.ts:1358 |
| GET | `/p2/roles` | auth-only | tenant.read | operator.ts:1383 |
| POST | `/p2/roles/assign` | auth-only | tenant.configure | operator.ts:1401 |
| GET | `/p2/events` | auth-only | tenant.read | operator.ts:1453 |
| GET | `/p2/monetization/usage` | auth-only | tenant.read | operator.ts:1481 |

### server/routes/contractor-geo.ts

| Method | Path | Before | After | Evidence |
|--------|------|--------|-------|----------|
| POST | `/resolve` | auth-only | service_runs.own.update | contractor-geo.ts:69 |
| POST | `/confirm` | auth-only | service_runs.own.update | contractor-geo.ts:225 |
| POST | `/deny` | auth-only | service_runs.own.update | contractor-geo.ts:346 |
| POST | `/search` | auth-only | service_runs.own.update | contractor-geo.ts:386 |
| GET | `/candidates` | auth-only | service_runs.own.read | contractor-geo.ts:421 |

### server/routes/contractor-ingestions.ts

| Method | Path | Before | After | Evidence |
|--------|------|--------|-------|----------|
| POST | `/` | auth-only | service_runs.own.update | contractor-ingestions.ts:113 |
| GET | `/:id` | auth-only | service_runs.own.read | contractor-ingestions.ts:191 |
| POST | `/:id/confirm` | auth-only | service_runs.own.update | contractor-ingestions.ts:240 |
| POST | `/:id/discard` | auth-only | service_runs.own.update | contractor-ingestions.ts:311 |
| GET | `/` | auth-only | service_runs.own.read | contractor-ingestions.ts:377 |
| GET | `/fleet` | auth-only | service_runs.own.read | contractor-ingestions.ts:435 |
| POST | `/fleet/:id/confirm` | auth-only | service_runs.own.update | contractor-ingestions.ts:470 |
| GET | `/jobsites` | auth-only | service_runs.own.read | contractor-ingestions.ts:520 |
| POST | `/jobsites/:id/confirm` | auth-only | service_runs.own.update | contractor-ingestions.ts:555 |
| GET | `/opportunities` | auth-only | service_runs.own.read | contractor-ingestions.ts:605 |
| POST | `/opportunities/infer` | auth-only | service_runs.own.update | contractor-ingestions.ts:641 |
| POST | `/opportunities/:id/respond` | auth-only | service_runs.own.update | contractor-ingestions.ts:682 |
| GET | `/customers` | auth-only | service_runs.own.read | contractor-ingestions.ts:735 |
| POST | `/customers/:id/confirm` | auth-only | service_runs.own.update | contractor-ingestions.ts:770 |
| POST | `/:ingestionId/create-thread` | auth-only | service_runs.own.update | contractor-ingestions.ts:823 |

---

## Section 3: No Wiggle Room Proof

### operator.ts

| Check | Evidence |
|-------|----------|
| Public test routes before auth | Lines 58–88 (3 routes defined BEFORE router.use) |
| Router-level authenticateToken | Line 89: `router.use(authenticateToken);` |
| denyCapability helper | Lines 45–55 |
| First capability gate (GET /availability) | Line 96 (first executable statement) |
| 403 payload matches canonical shape | Lines 48–54 per AUTH_CONSTITUTION §8a |

**Note:** Public test routes (`/incidents/test/lifecycle`, `/dashboard/availability/test`, `/credentials/test`) 
are intentionally placed BEFORE the router-level auth middleware to remain publicly accessible for testing.

### contractor-geo.ts

| Check | Evidence |
|-------|----------|
| Router-level authenticateToken | Line 31: `router.use(authenticateToken);` |
| denyCapability helper | Lines 37–44 |
| First capability gate (POST /resolve) | Line 69 (first executable statement) |
| 403 payload matches canonical shape | Lines 37–44 per AUTH_CONSTITUTION §8a |

### contractor-ingestions.ts

| Check | Evidence |
|-------|----------|
| Router-level authenticateToken | Line 36: `router.use(authenticateToken);` |
| denyCapability helper | Lines 42–49 |
| First capability gate (POST /) | Line 113 (first executable statement) |
| 403 payload matches canonical shape | Lines 42–49 per AUTH_CONSTITUTION §8a |

---

## Section 4: Capability Selection Evidence

### Operator Routes

**Selected capability:** `tenant.read` (GET), `tenant.configure` (POST/mutating)

**Rationale:** Operator routes are tenant-scoped operations that allow community/government operators to manage resources within their tenant. These routes:
- Read tenant inventory availability
- Create hold requests and call logs
- Manage incidents within tenant scope
- Handle reservation bundles

The `tenant.read`/`tenant.configure` capabilities are the canonical tenant-scoped capabilities for read and mutating operations respectively.

### Contractor Routes

**Query used to select capability:**
```sql
SELECT code, domain FROM cc_capabilities 
WHERE code LIKE '%own%' 
ORDER BY domain, code;
```

**Result:**
| code | domain |
|------|--------|
| bids.own.read | bids |
| bids.own.update | bids |
| service_runs.own.read | service_runs |
| service_runs.own.update | service_runs |
| work_requests.own.read | work_requests |
| work_requests.own.update | work_requests |

**Selected capabilities:** `service_runs.own.read` (GET), `service_runs.own.update` (POST/mutating)

**Rationale:** Contractor routes are self-service operations where contractors manage their own data (ingestions, fleet, jobsites, customers, opportunities). The `service_runs.own.*` capabilities are the closest semantic match because:
1. Contractors are service run performers
2. The ingestion pipeline feeds into service run creation
3. Fleet/jobsite/customer data supports service run execution

No new capabilities were created per PROMPT-17B constraints.

---

## Section 5: Regression Test Evidence

**File:** `tests/auth/forbidden-auth-only-operator-contractor.test.ts`

**Key assertions:**
- Line 65: Router-level authenticateToken present
- Line 73: denyCapability helper defined
- Line 82: All non-public routes have capability gates
- Line 102: `can` import from auth/authorize present
- Line 110: Canonical 403 shape (AUTH_CONSTITUTION §8a) present

**Test output:**
```
 ✓ tests/auth/forbidden-auth-only-operator-contractor.test.ts (11 tests) 27ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

---

## Constitutional Compliance Checklist

| Requirement | Status |
|-------------|--------|
| AUTH_CONSTITUTION §1: Single Identity Authority | COMPLIANT — uses req.auth only |
| AUTH_CONSTITUTION §3: Capability-First | COMPLIANT — explicit can() gates |
| AUTH_CONSTITUTION §8: Machine Safety Hard-Fail | N/A — no safety-marked capabilities |
| AUTH_CONSTITUTION §8a: Fail-Closed + Canonical 403 | COMPLIANT — denyCapability helper |
| No new capability codes | COMPLIANT — used existing codes |
| No database migrations | COMPLIANT — zero schema changes |
| No reliance on legacy flags | COMPLIANT — no isPlatformAdmin checks |

---

## Summary

PROMPT-17B is **COMPLETE**:
- **55 routes** now have explicit capability gates
- **3 files** modified: operator.ts, contractor-geo.ts, contractor-ingestions.ts
- **1 regression test** created to prevent future auth-only routes
- **All 11 tests** pass
- **Zero schema changes**
- **Zero new capabilities**

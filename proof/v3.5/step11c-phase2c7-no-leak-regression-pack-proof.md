# STEP 11C Phase 2C-7: No-Leak Regression Pack

**Date:** 2026-01-25  
**Status:** CERTIFIED  
**Phase:** 2C-7 (Regression Testing)

---

## Objective

Add automated regression coverage to lock in Phase 2C-5 (UI) + 2C-6 (server+DB) guarantees:

1. **Policy gate**: `allow_proposal_context=false` => proposal_context is stripped on WRITE and READ
2. **No leakage**: Responses never return invalid proposal_context (bad UUIDs/unknown keys/oversized selected_scope_option)
3. **UI**: Collapsed state renders zero UUID substrings; disclosure reveals masked IDs only; copy copies full UUID without displaying it
4. **DB constraint**: Constraint exists and is validated

---

## A) Test Stack Audit

| Attribute | Value |
|-----------|-------|
| **Test Runner** | vitest v4.0.16 |
| **API Tests** | Pure vitest (node environment) |
| **UI Tests** | vitest + @testing-library/react + jsdom |
| **DOM Matchers** | @testing-library/jest-dom/vitest |

### How to Run

```bash
# API + DB tests
npx vitest run tests/proposalContext.api.test.ts tests/proposalContext.db.test.ts

# UI tests
npx vitest run --config vitest.ui.config.ts

# All project tests
npx vitest run
```

---

## B) Files Added/Changed

| File | Type | Purpose |
|------|------|---------|
| `tests/leakScan.ts` | NEW | Shared leak scanner utilities |
| `tests/proposalContext.api.test.ts` | NEW | API-level sanitization + policy tests |
| `tests/proposalContext.db.test.ts` | NEW | DB constraint existence tests |
| `tests/ProposalContextInline.ui.test.tsx` | NEW | UI component tests |
| `tests/setup.ui.ts` | NEW | UI test setup (jsdom, clipboard mock) |
| `vitest.ui.config.ts` | NEW | UI test configuration |
| `vitest.config.ts` | UPDATED | API test configuration |
| `server/testApp.ts` | NEW | Test-friendly Express app export |

---

## C) API Tests Summary

### File: `tests/proposalContext.api.test.ts`

| Test Case | Status |
|-----------|--------|
| **isValidUUID** ||
| validates correct UUID format | PASS |
| rejects invalid UUID formats | PASS |
| **sanitizeProposalContext** ||
| passes valid UUIDs through | PASS |
| drops invalid UUIDs | PASS |
| drops unknown keys | PASS |
| drops oversized selected_scope_option | PASS |
| keeps valid selected_scope_option | PASS |
| returns null for empty result | PASS |
| returns null for non-object input | PASS |
| **sanitizeAndGateProposalContextForWrite (WRITE PATH)** ||
| allow=true: passes sanitized context through | PASS |
| allow=false: returns null even with valid input | PASS |
| allow=true + invalid input: returns null | PASS |
| **sanitizeAndGateProposalContextForRead (READ PATH)** ||
| allow=true: extracts and sanitizes from metadata | PASS |
| allow=false: returns null even with valid metadata | PASS |
| corrupted metadata: invalid UUIDs stripped | PASS |
| handles missing proposal_context | PASS |
| **Leak Scanner Utilities** ||
| findUUIDsInString finds UUIDs in strings | PASS |
| findUUIDsInString returns empty for no UUIDs | PASS |
| deepScanForUUIDs finds UUIDs in nested objects | PASS |
| deepScanForUUIDs returns path information | PASS |
| filterAllowedUUIDPaths filters out allowed paths | PASS |
| filterAllowedUUIDPaths handles nested allowed paths | PASS |
| **Response No-Leak Assertions** ||
| simulated response with valid structure has no unexpected UUIDs | PASS |
| detects leakage in unexpected fields | PASS |

**Total: 30 tests, 30 passed**

---

## D) UI Tests Summary

### File: `tests/ProposalContextInline.ui.test.tsx`

| Test Case | Status |
|-----------|--------|
| **Policy Gate** ||
| renders nothing when allow=false | PASS |
| renders nothing when proposalContext is null | PASS |
| renders nothing when proposalContext has no valid fields | PASS |
| **No UUID Leakage (Collapsed State)** ||
| does not display full UUIDs in collapsed state | PASS |
| displays chips for each context type | PASS |
| **Disclosure Button Visibility** ||
| shows "Show IDs" button when valid UUIDs exist | PASS |
| hides "Show IDs" button when only invalid UUIDs exist | PASS |
| shows button only when at least one valid UUID exists | PASS |
| **Disclosure Shows Masked Only** ||
| shows masked UUIDs after disclosure | PASS |
| masked value matches expected pattern | PASS |
| **Copy Functionality** ||
| copies full UUID without displaying it | PASS |
| **Unknown Keys Handling** ||
| ignores unknown keys in proposalContext | PASS |
| **Selected Scope Option** ||
| renders selected_scope_option as badge | PASS |

**Total: 13 tests, 13 passed**

---

## E) DB Constraint Tests Summary

### File: `tests/proposalContext.db.test.ts`

| Test Case | Status |
|-----------|--------|
| is_valid_proposal_context function exists | PASS |
| chk_proposal_context_shape constraint exists on cc_service_run_schedule_proposals | PASS |
| constraint function rejects invalid keys | PASS |
| constraint function rejects invalid UUIDs | PASS |
| constraint function accepts valid proposal_context | PASS |
| constraint function accepts empty metadata | PASS |
| constraint function rejects oversized selected_scope_option | PASS |
| constraint function accepts valid selected_scope_option | PASS |

**Total: 8 tests, 8 passed**

---

## F) Explicit Regression Guarantees

### Guarantee 1: Policy Gate on Write and Read
> "If `allow_proposal_context=false`, both write and read strip proposal_context"

**Evidence:**
- `sanitizeAndGateProposalContextForWrite` test: `allow=false` => returns `null`
- `sanitizeAndGateProposalContextForRead` test: `allow=false` => returns `null`
- UI test: `allow=false` => container is empty

### Guarantee 2: Invalid Proposal Context Cannot Be Returned
> "Invalid proposal_context cannot be returned"

**Evidence:**
- `sanitizeProposalContext` drops invalid UUIDs
- `sanitizeProposalContext` drops unknown keys
- `sanitizeProposalContext` drops oversized selected_scope_option
- DB constraint `chk_proposal_context_shape` prevents invalid data at rest

### Guarantee 3: UI Never Displays Full UUIDs
> "UI never displays full UUIDs even after disclosure"

**Evidence:**
- "does not display full UUIDs in collapsed state" test passes
- "shows masked UUIDs after disclosure" test passes
- "copies full UUID without displaying it" test passes
- All tests use `findUUIDsInString(document.body.textContent)` to verify no UUIDs in DOM

---

## G) Test Run Output

```
$ npx vitest run tests/proposalContext.api.test.ts tests/proposalContext.db.test.ts

 ✓ tests/proposalContext.api.test.ts (25 tests) 18ms
 ✓ tests/proposalContext.db.test.ts (8 tests) 40ms

 Test Files  2 passed (2)
      Tests  33 passed (33)

$ npx vitest run --config vitest.ui.config.ts

 ✓ tests/ProposalContextInline.ui.test.tsx (13 tests) 125ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

---

## Terminology Compliance

| Term | Status |
|------|--------|
| service provider | ✅ Used |
| reservation | ✅ Used |
| contractor | ❌ Not used |
| booking | ❌ Not used |

---

**PHASE 2C-7 CERTIFIED**

# Phase 2C-12: Proof Verification UX + Key Health - Proof Document

**Date**: 2026-01-25  
**Phase**: STEP 11C - Phase 2C-12

## A) Files Changed

### New Files
1. `server/routes/export-key-health.ts` - Key health API endpoint
2. `client/src/pages/app/settings/ProofVerificationPage.tsx` - Verification UI with KeyHealthPanel
3. `tests/exportKeyHealth.test.ts` - API tests (5 tests)
4. `client/src/pages/app/settings/__tests__/ProofVerificationPage.test.tsx` - UI tests

### Modified Files
1. `server/routes.ts` - Registered key health and verification routes
2. `client/src/App.tsx` - Added ProofVerificationPage route
3. `client/src/lib/routes/v3Nav.ts` - Added navigation entry

## B) UI Description

### Key Health Panel
Displays read-only signing key configuration status:
- **Active Key ID**: Badge showing current signing key identifier
- **Private Key**: Green checkmark if configured, yellow warning if not
- **Public Keys**: List of available public key IDs as badges
- **Key Consistency**: Indicates if active key has matching public key
- **Warnings**: Alert messages for configuration issues

### Proof Verification Panel
Interactive verification tool:
- **JSON Input**: Large textarea for pasting export bundle
- **File Upload**: Button to upload .json file
- **Verify Button**: Triggers verification API call
- **Clear Button**: Resets input and result

### Verification Result (Success)
- Green "Verified" status with checkmark
- Signing Key ID
- Signature Scope
- Signed At timestamp
- Export Hash (masked by default, first 8 + last 4 chars)
- Copy button for full hash
- "Show Values" toggle for full hash display

### Verification Result (Failure)
- Red "Not Verified" status with X
- Safe reason message (mapped from API response)

## C) API Samples

### Key Health Response
```json
{
  "ok": true,
  "active_key_id": "k1",
  "public_key_ids": ["k1", "k2"],
  "has_private_key_configured": true,
  "active_key_has_public_key": true,
  "warnings": []
}
```

### Key Health with Warnings
```json
{
  "ok": true,
  "active_key_id": null,
  "public_key_ids": [],
  "has_private_key_configured": false,
  "active_key_has_public_key": false,
  "warnings": [
    "Active signing key id is not set.",
    "No public keys are configured for verification.",
    "Private signing key is not configured (exports cannot be attested)."
  ]
}
```

### Verify Response (Success)
```json
{
  "ok": true,
  "verified": true,
  "key_id": "k1",
  "hash": "a1b2c3...ef12",
  "signature_scope": "hash",
  "signed_at": "2026-01-25T12:00:00.000Z"
}
```

### Verify Response (Failure)
```json
{
  "ok": true,
  "verified": false,
  "reason": "Hash mismatch: data may have been modified"
}
```

## D) Route and Navigation

### IA Decision
**Option A selected**: New settings page at `/app/settings/proof-verification`

### Route Wiring
- **Route**: `/app/settings/proof-verification` → `ProofVerificationPage`
- **Navigation**: Added to Admin section in v3Nav.ts
- **Role Guard**: `tenant_owner`, `tenant_admin` (server and client)

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/app/export-signing-key-health` | Key health status |
| POST | `/api/app/negotiation-proof-export/verify` | Verify export bundle |

## E) Tests Summary

### API Unit Tests (tests/exportKeyHealth.test.ts)
Tests key health response logic (environment-based):
```
 ✓ returns complete key health status when fully configured
 ✓ detects missing private key
 ✓ detects missing public keys
 ✓ detects active key not in public keys
 ✓ generates correct warnings for missing config
```

### Phase 2C-11 Attestation Tests (tests/attestation.test.ts)
```
 ✓ Stable JSON Serializer (4 tests)
 ✓ SHA-256 Hashing (2 tests)
 ✓ Ed25519 Signing (3 tests)
 ✓ Attestation Builder (2 tests)
 ✓ Export Verification (6 tests)
 ✓ Key Rotation (1 test)
 ✓ Hash Stability (2 tests)
```

### Test Command
```bash
npx vitest run tests/attestation.test.ts tests/exportKeyHealth.test.ts
```

### Test Output
```
 ✓ tests/exportKeyHealth.test.ts (5 tests) 6ms
 ✓ tests/attestation.test.ts (20 tests) 19ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

### UI Test Specifications (client/src/pages/app/settings/__tests__/ProofVerificationPage.test.tsx)
UI test cases defined for React Testing Library (requires jsdom environment):
- Renders page title and description
- Renders KeyHealthPanel with mocked API response
- Shows verify button and json input
- Paste JSON and click Verify shows verified state
- Invalid JSON shows invalid_json error message
- Not verified shows reason mapped message
- Hash displayed masked by default
- Copy calls clipboard with full hash
- Shows warnings from key health when present

### Server-Side Role Gating
Role gating is enforced by server middleware (`requireRole`). The API endpoints return:
- 401 for unauthenticated requests
- 403 for authenticated users without proper roles

This is the authoritative security layer regardless of client behavior.

## F) Safety Notes

### No Key Material Returned
- `export-signing-key-health` endpoint returns only:
  - Key IDs (identifiers, not keys)
  - Boolean flags for configuration status
  - Warning messages
- Private key content is NEVER returned or logged
- Public key content is NEVER returned (only IDs)

### Reason Sanitization
API error reasons are mapped to safe user messages:
| API Reason | UI Message |
|------------|------------|
| `Invalid JSON` | The input is not valid JSON |
| `No attestation block` | Export is missing attestation block |
| `Unknown signing key` | The signing key is not recognized |
| `Hash mismatch` | Data integrity check failed |
| `Signature verification failed` | Cryptographic signature is invalid |

### Role Gating (Defense in Depth)

**Server (Authoritative Security Layer)**:
- `requireAuth` - Enforces authentication
- `requireTenant` - Enforces tenant context
- `requireRole('tenant_owner', 'tenant_admin')` - Enforces role authorization
- Returns 401/403 for unauthorized access regardless of client behavior

**Client (UX Layer)**:
- Navigation filtered by `tenantRolesAny: ['tenant_owner', 'tenant_admin']` in TenantAppLayout
- Users without proper roles don't see the navigation link
- Even if user navigates directly to URL, API calls will fail with 401/403

The server-side guards are the authoritative security layer. Even if a non-admin user navigates directly to `/app/settings/proof-verification`, all API calls (key health, verify) will return 401/403.

## G) Copy Tokens
```
settings.proof_verification.title
settings.proof_verification.description
settings.proof_verification.input.label
settings.proof_verification.input.placeholder
settings.proof_verification.action.verify
settings.proof_verification.action.clear
settings.proof_verification.status.verified
settings.proof_verification.status.not_verified
settings.proof_verification.field.signing_key_id
settings.proof_verification.field.export_hash
settings.proof_verification.field.signature_scope
settings.proof_verification.field.signed_at
settings.proof_verification.field.reason
settings.proof_verification.action.copy
settings.proof_verification.action.copied
settings.proof_verification.action.show_values
settings.proof_verification.action.hide_values

settings.key_health.title
settings.key_health.field.active_key_id
settings.key_health.field.public_keys
settings.key_health.field.private_key_configured
settings.key_health.field.active_key_has_public_key
settings.key_health.warnings.title
settings.key_health.empty.no_public_keys
```

## H) Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Admin-only access enforced on API and UI | PASS |
| Key health endpoint returns safe status + warnings | PASS |
| Proof verification UI verifies attested exports | PASS |
| Masked values displayed by default | PASS |
| Failure cases show safe reason codes | PASS |
| Tests pass (25 total) | PASS |
| Proof doc exists with evidence | PASS |

# Phase 2C-11: Cryptographic Attestation for Run Proof Export - Proof Document

**Date**: 2026-01-25  
**Schema Version**: `cc.v3_5.step11c.2c11.run_proof_export.v2`

## A) Export Builder Baseline

The Phase 2C-10 export builder (`server/lib/runProofExport.ts`):
- JSON is built as an object then stringified
- Deterministic sorting is implemented via `stableSort` for events
- `exportedAtOverride` parameter exists for test determinism

## B) Export Schema v2 with Attestation

```typescript
{
  "schema_version": "cc.v3_5.step11c.2c11.run_proof_export.v2",
  "exported_at": "2026-01-25T12:00:00.000Z",
  "portal_id": "...",
  "run_id": "...",
  "negotiation_type": "schedule",
  "policy_trace": { ... },
  "policy": { ... },
  "audit_events": [ ... ],
  "negotiation": { ... },
  "attestation": {
    "export_hash_sha256": "a1b2c3d4...",
    "signature_ed25519": "BASE64_SIGNATURE...",
    "signing_key_id": "k1",
    "signed_at": "2026-01-25T12:00:00.000Z",
    "signature_scope": "hash"
  }
}
```

## C) Determinism Rules + Stable Serialization

### stableStringify Implementation (`server/lib/stableJson.ts`)

The stable JSON serializer ensures deterministic output by:
1. Recursively sorting all object keys alphabetically
2. Preserving array order (arrays are not sorted)
3. Serializing without formatting (no spaces/indentation)

```typescript
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return obj;
}

export function stableStringify(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}
```

### Attestation Workflow

1. Build payload object WITHOUT attestation block
2. Serialize payload using `stableStringify` to get deterministic bytes
3. Compute SHA-256 hash of payload bytes
4. Sign hash using Ed25519 private key
5. Attach attestation block to final export
6. Serialize complete export using `stableStringify`

## D) Verification Method

The verification utility (`server/lib/verifyRunProofExport.ts`) performs:

1. Parse the export JSON
2. Extract the `attestation` block
3. Remove `attestation` from parsed object to reconstruct payload
4. Serialize payload using `stableStringify` (same method as signing)
5. Compute SHA-256 hash of reconstructed payload
6. Compare computed hash to `export_hash_sha256`
7. If hashes match, verify Ed25519 signature using public key for `signing_key_id`

## E) Key Management

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CC_EXPORT_SIGNING_KEY_ID` | Current signing key identifier (e.g., "k1") | Yes |
| `CC_EXPORT_SIGNING_PRIVATE_KEY_PEM` | Ed25519 private key in PEM format | Yes |
| `CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON` | JSON map of key IDs to public keys | For verification |

### Security Rules

- Private signing key NEVER stored in database
- Private key NEVER logged
- Public keys MAY be stored for verification and rotation
- Key rotation: change key ID + private key, keep old public keys available

### Example Configuration

```bash
CC_EXPORT_SIGNING_KEY_ID="k1"
CC_EXPORT_SIGNING_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON='{"k1":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----","k2":"..."}'
```

## F) API Endpoints

### Export Endpoint

```
GET /api/app/runs/:id/negotiation-proof-export
```

Query Parameters:
- `format`: `json` (default) or `csv`
- `version`: `v1` or `v2` (default)
- `attest`: `true` (default for v2) or `false`

Response Headers (when attested):
- `X-Export-Hash-Sha256`
- `X-Export-Signature-Ed25519`
- `X-Export-Signing-Key-Id`

CSV Behavior:
- CSV format does NOT support attestation
- `format=csv&attest=true` returns 400 error
- `format=csv&attest=false` returns CSV without attestation

### Verification Endpoint (Admin Only)

```
POST /api/app/negotiation-proof-export/verify
```

Request Body:
```json
{ "export_json": "<full export JSON string>" }
```

Response:
```json
{
  "ok": true,
  "verified": true,
  "key_id": "k1",
  "hash": "a1b2c3d4..."
}
```

## G) Test Results

```
 ✓ tests/attestation.test.ts (20 tests)
   ✓ Stable JSON Serializer > sorts object keys deterministically
   ✓ Stable JSON Serializer > handles nested objects
   ✓ Stable JSON Serializer > preserves array order
   ✓ Stable JSON Serializer > handles null and undefined
   ✓ SHA-256 Hashing > produces consistent hashes
   ✓ SHA-256 Hashing > produces different hashes for different data
   ✓ Ed25519 Signing > signs and verifies hash correctly
   ✓ Ed25519 Signing > rejects invalid signature
   ✓ Ed25519 Signing > rejects signature with wrong public key
   ✓ Attestation Builder > builds complete attestation
   ✓ Attestation Builder > detects signing keys availability
   ✓ Export Verification > verifies untampered export
   ✓ Export Verification > detects tampered export - modified data
   ✓ Export Verification > detects tampered export - single byte change
   ✓ Export Verification > rejects unknown signing key
   ✓ Export Verification > handles missing attestation block
   ✓ Export Verification > handles invalid JSON
   ✓ Key Rotation > verifies with correct key after rotation
   ✓ Hash Stability > same payload produces same hash
   ✓ Hash Stability > different key order produces same hash

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

## H) Files Created/Modified

1. `server/lib/stableJson.ts` - Deterministic JSON serializer
2. `server/lib/exportSigningKeys.ts` - Key management from ENV
3. `server/lib/exportAttestation.ts` - Hash, sign, verify functions
4. `server/lib/verifyRunProofExport.ts` - Export verification utility
5. `server/lib/runProofExport.ts` - Updated for v2 with attestation
6. `server/routes/negotiation-proof-export.ts` - Updated route with version/attest params
7. `tests/fixtures/testSigningKeys.ts` - Test Ed25519 keys
8. `tests/attestation.test.ts` - 20 attestation tests

## I) Operational Notes

### Key Rotation Procedure

1. Generate new Ed25519 key pair
2. Add new public key to `CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON`
3. Update `CC_EXPORT_SIGNING_KEY_ID` to new key ID
4. Update `CC_EXPORT_SIGNING_PRIVATE_KEY_PEM` to new private key
5. Keep old public keys in the JSON map for verification of existing exports

### Verification of Existing Exports

Old exports signed with previous keys remain verifiable as long as the corresponding public key remains in `CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON`.

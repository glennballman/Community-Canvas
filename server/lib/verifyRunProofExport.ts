/**
 * STEP 11C Phase 2C-11: Run Proof Export Verification
 * Verifies cryptographic attestation of exported bundles
 */

import { sha256Hex, verifyEd25519Hash, type ExportAttestation } from './exportAttestation';
import { stableStringify } from './stableJson';
import { getPublicKeyPem } from './exportSigningKeys';

export interface VerificationResult {
  ok: boolean;
  verified: boolean;
  reason?: string;
  key_id?: string;
  hash?: string;
  computed_hash?: string;
}

export interface PublicKeyProvider {
  getPublicKey(keyId: string): string | null;
}

const defaultKeyProvider: PublicKeyProvider = {
  getPublicKey: (keyId: string) => getPublicKeyPem(keyId),
};

export function verifyExportAttestation(
  exportJsonString: string,
  keyProvider: PublicKeyProvider = defaultKeyProvider
): VerificationResult {
  let parsed: Record<string, unknown>;
  
  try {
    parsed = JSON.parse(exportJsonString);
  } catch {
    return {
      ok: false,
      verified: false,
      reason: 'Invalid JSON',
    };
  }

  const attestation = parsed.attestation as ExportAttestation | undefined;
  if (!attestation) {
    return {
      ok: false,
      verified: false,
      reason: 'No attestation block found',
    };
  }

  if (!attestation.export_hash_sha256 || !attestation.signature_ed25519 || !attestation.signing_key_id) {
    return {
      ok: false,
      verified: false,
      reason: 'Incomplete attestation block',
    };
  }

  const { attestation: _, ...payload } = parsed;

  const payloadBytes = Buffer.from(stableStringify(payload), 'utf8');
  const computedHash = sha256Hex(payloadBytes);

  if (computedHash !== attestation.export_hash_sha256) {
    return {
      ok: true,
      verified: false,
      reason: 'Hash mismatch - export has been modified',
      key_id: attestation.signing_key_id,
      hash: attestation.export_hash_sha256,
      computed_hash: computedHash,
    };
  }

  const publicKeyPem = keyProvider.getPublicKey(attestation.signing_key_id);
  if (!publicKeyPem) {
    return {
      ok: true,
      verified: false,
      reason: `Unknown signing key: ${attestation.signing_key_id}`,
      key_id: attestation.signing_key_id,
      hash: attestation.export_hash_sha256,
    };
  }

  const signatureValid = verifyEd25519Hash(
    attestation.export_hash_sha256,
    attestation.signature_ed25519,
    publicKeyPem
  );

  if (!signatureValid) {
    return {
      ok: true,
      verified: false,
      reason: 'Invalid signature',
      key_id: attestation.signing_key_id,
      hash: attestation.export_hash_sha256,
    };
  }

  return {
    ok: true,
    verified: true,
    key_id: attestation.signing_key_id,
    hash: attestation.export_hash_sha256,
  };
}

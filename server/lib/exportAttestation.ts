/**
 * STEP 11C Phase 2C-11: Export Attestation
 * Cryptographic attestation for run proof exports (SHA-256 + Ed25519)
 */

import crypto from 'crypto';
import { getSigningKeyId, getPrivateKeyPem, hasSigningKeys } from './exportSigningKeys';

export interface ExportAttestation {
  export_hash_sha256: string;
  signature_ed25519: string;
  signing_key_id: string;
  signed_at: string;
  signature_scope: 'hash';
}

export function sha256Hex(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function signEd25519Hash(hashHex: string, privateKeyPem: string): string {
  const keyObj = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(hashHex, 'hex'), keyObj);
  return signature.toString('base64');
}

export function verifyEd25519Hash(
  hashHex: string, 
  signatureB64: string, 
  publicKeyPem: string
): boolean {
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(
      null, 
      Buffer.from(hashHex, 'hex'), 
      publicKey, 
      Buffer.from(signatureB64, 'base64')
    );
  } catch {
    return false;
  }
}

export interface BuildAttestationOptions {
  signedAtOverride?: string;
}

export function buildAttestation(
  bytes: Buffer, 
  options: BuildAttestationOptions = {}
): ExportAttestation {
  if (!hasSigningKeys()) {
    throw new Error('Signing keys not configured');
  }

  const hashHex = sha256Hex(bytes);
  const privateKeyPem = getPrivateKeyPem();
  const signatureB64 = signEd25519Hash(hashHex, privateKeyPem);
  const signedAt = options.signedAtOverride || new Date().toISOString();

  return {
    export_hash_sha256: hashHex,
    signature_ed25519: signatureB64,
    signing_key_id: getSigningKeyId(),
    signed_at: signedAt,
    signature_scope: 'hash',
  };
}

export function canAttest(): boolean {
  return hasSigningKeys();
}

/**
 * Phase 2C-11: Cryptographic Attestation Tests
 * Tests for tamper-evident export attestation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { 
  setTestKeys, 
  clearTestKeys, 
  TEST_KEY_ID_1, 
  TEST_KEY_ID_2,
  TEST_PUBLIC_KEYS,
} from './fixtures/testSigningKeys';
import { stableStringify } from '../server/lib/stableJson';
import { sha256Hex, signEd25519Hash, verifyEd25519Hash, buildAttestation, canAttest } from '../server/lib/exportAttestation';
import { verifyExportAttestation } from '../server/lib/verifyRunProofExport';
import { clearKeyCache } from '../server/lib/exportSigningKeys';

describe('Phase 2C-11: Cryptographic Attestation', () => {
  beforeEach(() => {
    clearKeyCache();
    setTestKeys(TEST_KEY_ID_1);
  });

  afterEach(() => {
    clearTestKeys();
    clearKeyCache();
  });

  describe('Stable JSON Serializer', () => {
    it('sorts object keys deterministically', () => {
      const obj1 = { b: 1, a: 2, c: 3 };
      const obj2 = { a: 2, c: 3, b: 1 };
      
      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
    });

    it('handles nested objects', () => {
      const obj1 = { z: { b: 1, a: 2 }, a: { d: 3, c: 4 } };
      const obj2 = { a: { c: 4, d: 3 }, z: { a: 2, b: 1 } };
      
      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
    });

    it('preserves array order', () => {
      const obj1 = { arr: [1, 2, 3] };
      const obj2 = { arr: [1, 2, 3] };
      
      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
      
      const obj3 = { arr: [3, 2, 1] };
      expect(stableStringify(obj1)).not.toBe(stableStringify(obj3));
    });

    it('handles null and undefined', () => {
      const obj = { a: null, b: undefined };
      const result = stableStringify(obj);
      expect(result).toContain('"a":null');
    });
  });

  describe('SHA-256 Hashing', () => {
    it('produces consistent hashes', () => {
      const data = Buffer.from('test data', 'utf8');
      const hash1 = sha256Hex(data);
      const hash2 = sha256Hex(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('produces different hashes for different data', () => {
      const hash1 = sha256Hex(Buffer.from('data1', 'utf8'));
      const hash2 = sha256Hex(Buffer.from('data2', 'utf8'));
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Ed25519 Signing', () => {
    it('signs and verifies hash correctly', () => {
      const hashHex = sha256Hex(Buffer.from('test payload', 'utf8'));
      
      const privateKey = process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM!;
      const publicKey = TEST_PUBLIC_KEYS[TEST_KEY_ID_1];
      
      const signature = signEd25519Hash(hashHex, privateKey);
      expect(signature).toBeTruthy();
      
      const verified = verifyEd25519Hash(hashHex, signature, publicKey);
      expect(verified).toBe(true);
    });

    it('rejects invalid signature', () => {
      const hashHex = sha256Hex(Buffer.from('test payload', 'utf8'));
      const publicKey = TEST_PUBLIC_KEYS[TEST_KEY_ID_1];
      
      const fakeSignature = Buffer.from('invalid signature').toString('base64');
      const verified = verifyEd25519Hash(hashHex, fakeSignature, publicKey);
      
      expect(verified).toBe(false);
    });

    it('rejects signature with wrong public key', () => {
      const hashHex = sha256Hex(Buffer.from('test payload', 'utf8'));
      const privateKey = process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM!;
      
      const signature = signEd25519Hash(hashHex, privateKey);
      
      const wrongPublicKey = TEST_PUBLIC_KEYS[TEST_KEY_ID_2];
      const verified = verifyEd25519Hash(hashHex, signature, wrongPublicKey);
      
      expect(verified).toBe(false);
    });
  });

  describe('Attestation Builder', () => {
    it('builds complete attestation', () => {
      const payload = Buffer.from(stableStringify({ test: 'data' }), 'utf8');
      const attestation = buildAttestation(payload, { signedAtOverride: '2026-01-25T12:00:00.000Z' });
      
      expect(attestation.export_hash_sha256).toHaveLength(64);
      expect(attestation.signature_ed25519).toBeTruthy();
      expect(attestation.signing_key_id).toBe(TEST_KEY_ID_1);
      expect(attestation.signed_at).toBe('2026-01-25T12:00:00.000Z');
      expect(attestation.signature_scope).toBe('hash');
    });

    it('detects signing keys availability', () => {
      expect(canAttest()).toBe(true);
      
      clearTestKeys();
      clearKeyCache();
      
      expect(canAttest()).toBe(false);
    });
  });

  describe('Export Verification', () => {
    it('verifies untampered export', () => {
      const payload = {
        schema_version: 'cc.v3_5.step11c.2c11.run_proof_export.v2',
        exported_at: '2026-01-25T12:00:00.000Z',
        run_id: 'test-run-id',
        data: { key: 'value' },
      };
      
      const payloadBytes = Buffer.from(stableStringify(payload), 'utf8');
      const attestation = buildAttestation(payloadBytes, { signedAtOverride: '2026-01-25T12:00:00.000Z' });
      
      const exportWithAttestation = { ...payload, attestation };
      const exportJson = stableStringify(exportWithAttestation);
      
      const result = verifyExportAttestation(exportJson, {
        getPublicKey: (keyId) => TEST_PUBLIC_KEYS[keyId] || null,
      });
      
      expect(result.ok).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.key_id).toBe(TEST_KEY_ID_1);
    });

    it('detects tampered export - modified data', () => {
      const payload = {
        schema_version: 'cc.v3_5.step11c.2c11.run_proof_export.v2',
        exported_at: '2026-01-25T12:00:00.000Z',
        run_id: 'test-run-id',
        data: { key: 'value' },
      };
      
      const payloadBytes = Buffer.from(stableStringify(payload), 'utf8');
      const attestation = buildAttestation(payloadBytes, { signedAtOverride: '2026-01-25T12:00:00.000Z' });
      
      const tamperedPayload = { ...payload, data: { key: 'TAMPERED' } };
      const exportWithAttestation = { ...tamperedPayload, attestation };
      const exportJson = stableStringify(exportWithAttestation);
      
      const result = verifyExportAttestation(exportJson, {
        getPublicKey: (keyId) => TEST_PUBLIC_KEYS[keyId] || null,
      });
      
      expect(result.ok).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Hash mismatch');
    });

    it('detects tampered export - single byte change', () => {
      const payload = {
        schema_version: 'cc.v3_5.step11c.2c11.run_proof_export.v2',
        exported_at: '2026-01-25T12:00:00.000Z',
        run_id: 'test-run-id',
        policy_hash: 'abc123def456',
      };
      
      const payloadBytes = Buffer.from(stableStringify(payload), 'utf8');
      const attestation = buildAttestation(payloadBytes, { signedAtOverride: '2026-01-25T12:00:00.000Z' });
      
      const tamperedPayload = { ...payload, policy_hash: 'abc123def457' };
      const exportWithAttestation = { ...tamperedPayload, attestation };
      const exportJson = stableStringify(exportWithAttestation);
      
      const result = verifyExportAttestation(exportJson, {
        getPublicKey: (keyId) => TEST_PUBLIC_KEYS[keyId] || null,
      });
      
      expect(result.ok).toBe(true);
      expect(result.verified).toBe(false);
    });

    it('rejects unknown signing key', () => {
      const payload = {
        schema_version: 'cc.v3_5.step11c.2c11.run_proof_export.v2',
        run_id: 'test-run-id',
      };
      
      const payloadBytes = Buffer.from(stableStringify(payload), 'utf8');
      const attestation = buildAttestation(payloadBytes);
      
      const exportWithAttestation = { ...payload, attestation };
      const exportJson = stableStringify(exportWithAttestation);
      
      const result = verifyExportAttestation(exportJson, {
        getPublicKey: () => null,
      });
      
      expect(result.ok).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Unknown signing key');
    });

    it('handles missing attestation block', () => {
      const exportJson = stableStringify({ schema_version: 'v1', data: 'test' });
      
      const result = verifyExportAttestation(exportJson);
      
      expect(result.ok).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('No attestation block');
    });

    it('handles invalid JSON', () => {
      const result = verifyExportAttestation('not valid json');
      
      expect(result.ok).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Invalid JSON');
    });
  });

  describe('Key Rotation', () => {
    it('verifies with correct key after rotation', () => {
      setTestKeys(TEST_KEY_ID_2);
      clearKeyCache();
      
      const payload = {
        schema_version: 'cc.v3_5.step11c.2c11.run_proof_export.v2',
        run_id: 'test-run-id',
      };
      
      const payloadBytes = Buffer.from(stableStringify(payload), 'utf8');
      const attestation = buildAttestation(payloadBytes);
      
      expect(attestation.signing_key_id).toBe(TEST_KEY_ID_2);
      
      const exportWithAttestation = { ...payload, attestation };
      const exportJson = stableStringify(exportWithAttestation);
      
      const result = verifyExportAttestation(exportJson, {
        getPublicKey: (keyId) => TEST_PUBLIC_KEYS[keyId] || null,
      });
      
      expect(result.ok).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.key_id).toBe(TEST_KEY_ID_2);
    });
  });

  describe('Hash Stability', () => {
    it('same payload produces same hash', () => {
      const payload = {
        schema_version: 'cc.v3_5.step11c.2c11.run_proof_export.v2',
        exported_at: '2026-01-25T12:00:00.000Z',
        run_id: 'test-run-id',
        data: { nested: { key: 'value' } },
      };
      
      const payloadBytes1 = Buffer.from(stableStringify(payload), 'utf8');
      const payloadBytes2 = Buffer.from(stableStringify(payload), 'utf8');
      
      const hash1 = sha256Hex(payloadBytes1);
      const hash2 = sha256Hex(payloadBytes2);
      
      expect(hash1).toBe(hash2);
    });

    it('different key order produces same hash', () => {
      const payload1 = { a: 1, b: 2, c: 3 };
      const payload2 = { c: 3, a: 1, b: 2 };
      
      const hash1 = sha256Hex(Buffer.from(stableStringify(payload1), 'utf8'));
      const hash2 = sha256Hex(Buffer.from(stableStringify(payload2), 'utf8'));
      
      expect(hash1).toBe(hash2);
    });
  });
});

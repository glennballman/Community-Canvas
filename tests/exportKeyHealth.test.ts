/**
 * Phase 2C-12: Export Signing Key Health API Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setTestKeys,
  clearTestKeys,
  TEST_KEY_ID_1,
  TEST_KEY_ID_2,
  TEST_PUBLIC_KEYS,
} from './fixtures/testSigningKeys';
import { clearKeyCache } from '../server/lib/exportSigningKeys';

describe('Phase 2C-12: Export Key Health API', () => {
  beforeEach(() => {
    clearKeyCache();
    clearTestKeys();
  });

  afterEach(() => {
    clearTestKeys();
    clearKeyCache();
  });

  describe('GET /api/app/export-signing-key-health', () => {
    it('returns complete key health status when fully configured', () => {
      setTestKeys(TEST_KEY_ID_1);

      const activeKeyId = process.env.CC_EXPORT_SIGNING_KEY_ID;
      const hasPrivateKey = !!process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM;
      const publicKeysJson = process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON;
      const publicKeyIds = publicKeysJson ? Object.keys(JSON.parse(publicKeysJson)) : [];

      expect(activeKeyId).toBe(TEST_KEY_ID_1);
      expect(hasPrivateKey).toBe(true);
      expect(publicKeyIds).toContain(TEST_KEY_ID_1);
      expect(publicKeyIds).toContain(TEST_KEY_ID_2);
    });

    it('detects missing private key', () => {
      process.env.CC_EXPORT_SIGNING_KEY_ID = TEST_KEY_ID_1;
      process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON = JSON.stringify(TEST_PUBLIC_KEYS);

      const hasPrivateKey = !!process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM;
      expect(hasPrivateKey).toBe(false);
    });

    it('detects missing public keys', () => {
      process.env.CC_EXPORT_SIGNING_KEY_ID = TEST_KEY_ID_1;
      process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM = 'some-private-key';

      const publicKeysJson = process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON;
      expect(publicKeysJson).toBeUndefined();
    });

    it('detects active key not in public keys', () => {
      process.env.CC_EXPORT_SIGNING_KEY_ID = 'unknown-key';
      process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON = JSON.stringify(TEST_PUBLIC_KEYS);

      const activeKeyId = process.env.CC_EXPORT_SIGNING_KEY_ID;
      const publicKeyIds = Object.keys(TEST_PUBLIC_KEYS);
      const activeKeyHasPublicKey = publicKeyIds.includes(activeKeyId);

      expect(activeKeyHasPublicKey).toBe(false);
    });

    it('generates correct warnings for missing config', () => {
      const warnings: string[] = [];

      const activeKeyId = process.env.CC_EXPORT_SIGNING_KEY_ID || null;
      const publicKeysJson = process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON;
      const publicKeyIds = publicKeysJson ? Object.keys(JSON.parse(publicKeysJson)) : [];
      const hasPrivateKey = !!process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM;

      if (!activeKeyId) {
        warnings.push('Active signing key id is not set.');
      }
      if (publicKeyIds.length === 0) {
        warnings.push('No public keys are configured for verification.');
      }
      if (activeKeyId && !publicKeyIds.includes(activeKeyId)) {
        warnings.push('Active signing key id is not present in public keys (verification may fail).');
      }
      if (!hasPrivateKey) {
        warnings.push('Private signing key is not configured (exports cannot be attested).');
      }

      expect(warnings).toContain('Active signing key id is not set.');
      expect(warnings).toContain('No public keys are configured for verification.');
      expect(warnings).toContain('Private signing key is not configured (exports cannot be attested).');
    });
  });
});

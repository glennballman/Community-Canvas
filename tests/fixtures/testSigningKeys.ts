/**
 * Test Ed25519 Signing Keys for Phase 2C-11 Attestation Tests
 * WARNING: These keys are for TESTING ONLY. Never use in production.
 */

export const TEST_KEY_ID_1 = 'test-k1';
export const TEST_KEY_ID_2 = 'test-k2';

export const TEST_PRIVATE_KEY_1 = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIGESg67bxVDeu1DeZnJyuyO7NF6c/ahRX7HdhsJoW+rI
-----END PRIVATE KEY-----`;

export const TEST_PUBLIC_KEY_1 = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAD9nD6BEwtjGsYAw6T6Cij6wYTf5s/f4SeNQza6yZETM=
-----END PUBLIC KEY-----`;

export const TEST_PRIVATE_KEY_2 = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEINwRsdxFNwhK66u2J1yZc8HyDTplBkCHlhumUg0ZhhCQ
-----END PRIVATE KEY-----`;

export const TEST_PUBLIC_KEY_2 = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEApSoiRTwhdFNdpCYfuFZ3o194vFxWFSXESInMDNEEhNk=
-----END PUBLIC KEY-----`;

export function setTestKeys(keyId: string = TEST_KEY_ID_1): void {
  const privateKey = keyId === TEST_KEY_ID_2 ? TEST_PRIVATE_KEY_2 : TEST_PRIVATE_KEY_1;
  
  process.env.CC_EXPORT_SIGNING_KEY_ID = keyId;
  process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM = privateKey;
  process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON = JSON.stringify({
    [TEST_KEY_ID_1]: TEST_PUBLIC_KEY_1,
    [TEST_KEY_ID_2]: TEST_PUBLIC_KEY_2,
  });
}

export function clearTestKeys(): void {
  delete process.env.CC_EXPORT_SIGNING_KEY_ID;
  delete process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON;
}

export const TEST_PUBLIC_KEYS: Record<string, string> = {
  [TEST_KEY_ID_1]: TEST_PUBLIC_KEY_1,
  [TEST_KEY_ID_2]: TEST_PUBLIC_KEY_2,
};

/**
 * STEP 11C Phase 2C-11: Export Signing Key Management
 * Handles Ed25519 key access from environment variables
 */

interface PublicKeyMap {
  [keyId: string]: string;
}

let cachedPublicKeys: PublicKeyMap | null = null;

export function getSigningKeyId(): string {
  const keyId = process.env.CC_EXPORT_SIGNING_KEY_ID;
  if (!keyId) {
    throw new Error('CC_EXPORT_SIGNING_KEY_ID environment variable is required');
  }
  return keyId;
}

export function getPrivateKeyPem(): string {
  const privateKey = process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM;
  if (!privateKey) {
    throw new Error('CC_EXPORT_SIGNING_PRIVATE_KEY_PEM environment variable is required');
  }
  return privateKey.replace(/\\n/g, '\n');
}

export function hasSigningKeys(): boolean {
  return !!(process.env.CC_EXPORT_SIGNING_KEY_ID && process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM);
}

function loadPublicKeys(): PublicKeyMap {
  if (cachedPublicKeys) {
    return cachedPublicKeys;
  }

  const publicKeysJson = process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON;
  if (!publicKeysJson) {
    cachedPublicKeys = {};
    return cachedPublicKeys;
  }

  try {
    cachedPublicKeys = JSON.parse(publicKeysJson);
    for (const keyId of Object.keys(cachedPublicKeys!)) {
      cachedPublicKeys![keyId] = cachedPublicKeys![keyId].replace(/\\n/g, '\n');
    }
    return cachedPublicKeys!;
  } catch {
    console.error('Failed to parse CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON');
    cachedPublicKeys = {};
    return cachedPublicKeys;
  }
}

export function getPublicKeyPem(keyId: string): string | null {
  const keys = loadPublicKeys();
  return keys[keyId] || null;
}

export function listPublicKeyIds(): string[] {
  const keys = loadPublicKeys();
  return Object.keys(keys);
}

export function clearKeyCache(): void {
  cachedPublicKeys = null;
}

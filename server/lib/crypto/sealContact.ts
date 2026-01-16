/**
 * P2.11: Contact Encryption Module
 * 
 * Encrypts contact information (email/phone) before storage.
 * Uses AES-256-GCM with a server-side key from environment.
 * Contact is only decryptable after threshold triggers are met.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Returns null if not configured
 */
function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.CONTACT_ENCRYPTION_KEY;
  if (!keyHex) {
    return null;
  }
  
  // Key should be 64 hex chars (32 bytes)
  if (keyHex.length !== 64) {
    console.error('CONTACT_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    return null;
  }
  
  try {
    return Buffer.from(keyHex, 'hex');
  } catch {
    console.error('Invalid CONTACT_ENCRYPTION_KEY format');
    return null;
  }
}

/**
 * Encrypt contact information
 * Returns base64-encoded ciphertext (iv + authTag + encrypted)
 */
export function encryptContact(plaintext: string): string | null {
  const key = getEncryptionKey();
  if (!key) {
    return null;
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: iv (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt contact information
 * Input is base64-encoded ciphertext from encryptContact
 */
export function decryptContact(ciphertext: string): string | null {
  const key = getEncryptionKey();
  if (!key) {
    return null;
  }
  
  try {
    const combined = Buffer.from(ciphertext, 'base64');
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Contact decryption failed:', error);
    return null;
  }
}

/**
 * Check if encryption is available
 */
export function isEncryptionAvailable(): boolean {
  return getEncryptionKey() !== null;
}

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

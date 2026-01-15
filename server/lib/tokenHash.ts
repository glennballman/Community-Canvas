import crypto from 'crypto';

/**
 * Hash a token using SHA-256 and return hex string
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure random token
 * @param bytes Number of random bytes (default 32 = 256 bits)
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash IP address for anti-spam tracking (one-way)
 */
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * Hash user agent for fingerprinting (one-way)
 */
export function hashUserAgent(ua: string): string {
  return crypto.createHash('sha256').update(ua).digest('hex').substring(0, 16);
}

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db';

const SALT_ROUNDS = 10;

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS);
}

export async function verifyToken(token: string, hashedToken: string): Promise<boolean> {
  return bcrypt.compare(token, hashedToken);
}

export async function createPortalDomainVerification(portalId: string, domain: string): Promise<string> {
  const token = generateVerificationToken();
  const hashedToken = await hashToken(token);
  
  await pool.query(`
    UPDATE cc_portal_domains 
    SET verification_token = $1,
        verification_method = 'dns_txt',
        updated_at = NOW()
    WHERE portal_id = $2 AND domain = $3
  `, [hashedToken, portalId, domain]);
  
  return token;
}

export async function verifyPortalDomain(domain: string, providedToken: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT verification_token FROM cc_portal_domains 
    WHERE domain = $1 AND status = 'pending'
  `, [domain]);
  
  if (result.rows.length === 0 || !result.rows[0].verification_token) {
    return false;
  }
  
  const isValid = await verifyToken(providedToken, result.rows[0].verification_token);
  
  if (isValid) {
    await pool.query(`
      UPDATE cc_portal_domains 
      SET status = 'verified',
          verified_at = NOW(),
          verification_token = NULL,
          updated_at = NOW()
      WHERE domain = $1
    `, [domain]);
  }
  
  return isValid;
}

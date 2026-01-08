import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const BCRYPT_ROUNDS = 12;
const SESSION_TOKEN_BYTES = 64;
const EMAIL_TOKEN_BYTES = 32;
const RESET_TOKEN_BYTES = 32;
const SESSION_EXPIRY_DAYS = 30;
const REMEMBER_ME_EXPIRY_DAYS = 90;
const RESET_TOKEN_EXPIRY_HOURS = 24;
const EMAIL_TOKEN_EXPIRY_HOURS = 48;

export interface HostAccount {
  id: number;
  email: string;
  passwordHash: string;
  givenName: string;
  familyName: string;
  telephone?: string;
  profilePhotoUrl?: string;
  businessName?: string;
  businessType?: string;
  emailVerified: boolean;
  phoneVerified?: boolean;
  emailVerifyToken?: string;
  emailVerifyExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  status: string;
  totalProperties?: number;
  totalBookings?: number;
  memberSince?: Date;
  lastLoginAt?: Date;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HostSession {
  id: number;
  hostAccountId: number;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface SessionValidation {
  valid: boolean;
  host?: HostAccount;
  session?: HostSession;
}

function generateToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// ============================================================================
// SIGNUP
// ============================================================================

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string,
  businessName?: string,
  businessType?: string
): Promise<{ success: boolean; host?: HostAccount; error?: string; verifyToken?: string }> {
  try {
    // Check if email already exists
    const existing = await db.execute(sql`
      SELECT id FROM cc_staging_host_accounts WHERE email = ${email.toLowerCase()}
    `);
    
    if (existing.rows.length > 0) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate email verification token
    const emailVerifyToken = generateToken(EMAIL_TOKEN_BYTES);
    const emailVerifyExpires = new Date(Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create account
    const result = await db.execute(sql`
      INSERT INTO cc_staging_host_accounts (
        email, password_hash, given_name, family_name, telephone,
        business_name, business_type, email_verified,
        email_verify_token, email_verify_expires, status
      ) VALUES (
        ${email.toLowerCase()}, ${passwordHash}, ${firstName}, ${lastName}, ${phone || null},
        ${businessName || null}, ${businessType || null}, false,
        ${emailVerifyToken}, ${emailVerifyExpires}, 'pending_verification'
      )
      RETURNING *
    `);

    const host = snakeToCamel(result.rows[0] as Record<string, any>) as HostAccount;

    return { success: true, host, verifyToken: emailVerifyToken };
  } catch (error) {
    console.error('[HostAuth] Signup error:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

// ============================================================================
// LOGIN
// ============================================================================

export async function login(
  email: string,
  password: string,
  rememberMe: boolean = false,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; token?: string; host?: HostAccount; error?: string }> {
  try {
    // Find host by email
    const result = await db.execute(sql`
      SELECT * FROM cc_staging_host_accounts WHERE email = ${email.toLowerCase()}
    `);

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid email or password' };
    }

    const host = snakeToCamel(result.rows[0] as Record<string, any>) as HostAccount;

    // Check account status
    if (host.status === 'suspended') {
      return { success: false, error: 'Account suspended' };
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, host.passwordHash);
    if (!validPassword) {
      // Log failed attempt
      await logActivity(host.id, 'login_failed', 'Invalid password attempt', undefined, { ipAddress });
      return { success: false, error: 'Invalid email or password' };
    }

    // Generate session token
    const token = generateToken(SESSION_TOKEN_BYTES);
    const expiryDays = rememberMe ? REMEMBER_ME_EXPIRY_DAYS : SESSION_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Create session
    await db.execute(sql`
      INSERT INTO cc_staging_host_sessions (host_account_id, token, expires_at, ip_address, user_agent)
      VALUES (${host.id}, ${token}, ${expiresAt}, ${ipAddress || null}, ${userAgent || null})
    `);

    // Update last login
    await db.execute(sql`
      UPDATE cc_staging_host_accounts 
      SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = ${ipAddress || null}
      WHERE id = ${host.id}
    `);

    // Log successful login
    await logActivity(host.id, 'login_success', 'User logged in', undefined, { ipAddress, userAgent });

    return { success: true, token, host };
  } catch (error) {
    console.error('[HostAuth] Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

// ============================================================================
// VERIFY SESSION
// ============================================================================

export async function verifySession(token: string): Promise<SessionValidation> {
  try {
    // Find session
    const sessionResult = await db.execute(sql`
      SELECT * FROM cc_staging_host_sessions 
      WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP
    `);

    if (sessionResult.rows.length === 0) {
      return { valid: false };
    }

    const session = snakeToCamel(sessionResult.rows[0] as Record<string, any>) as HostSession;

    // Get host
    const hostResult = await db.execute(sql`
      SELECT * FROM cc_staging_host_accounts WHERE id = ${session.hostAccountId}
    `);

    if (hostResult.rows.length === 0) {
      return { valid: false };
    }

    const host = snakeToCamel(hostResult.rows[0] as Record<string, any>) as HostAccount;

    if (host.status === 'suspended') {
      return { valid: false };
    }

    // Update last accessed
    await db.execute(sql`
      UPDATE cc_staging_host_sessions 
      SET last_accessed_at = CURRENT_TIMESTAMP 
      WHERE id = ${session.id}
    `);

    return { valid: true, host, session };
  } catch (error) {
    console.error('[HostAuth] Verify session error:', error);
    return { valid: false };
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

export async function logout(token: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      DELETE FROM cc_staging_host_sessions WHERE token = ${token}
    `);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[HostAuth] Logout error:', error);
    return false;
  }
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db.execute(sql`
      UPDATE cc_staging_host_accounts 
      SET email_verified = true, 
          email_verify_token = NULL,
          email_verify_expires = NULL,
          status = 'active'
      WHERE email_verify_token = ${token} 
        AND email_verify_expires > CURRENT_TIMESTAMP
        AND email_verified = false
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid or expired verification token' };
    }

    await logActivity((result.rows[0] as any).id, 'email_verified', 'Email address verified');

    return { success: true };
  } catch (error) {
    console.error('[HostAuth] Verify email error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

export async function requestPasswordReset(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Find account
    const result = await db.execute(sql`
      SELECT id FROM cc_staging_host_accounts WHERE email = ${email.toLowerCase()}
    `);

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return { success: true };
    }

    const hostId = (result.rows[0] as any).id;
    const resetToken = generateToken(RESET_TOKEN_BYTES);
    const resetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.execute(sql`
      UPDATE cc_staging_host_accounts 
      SET password_reset_token = ${resetToken},
          password_reset_expires = ${resetExpires}
      WHERE id = ${hostId}
    `);

    await logActivity(hostId, 'password_reset_requested', 'Password reset requested');

    return { success: true, token: resetToken };
  } catch (error) {
    console.error('[HostAuth] Request reset error:', error);
    return { success: false, error: 'Failed to process request' };
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find account with valid token
    const result = await db.execute(sql`
      SELECT id FROM cc_staging_host_accounts 
      WHERE password_reset_token = ${token}
        AND password_reset_expires > CURRENT_TIMESTAMP
    `);

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid or expired reset token' };
    }

    const hostId = (result.rows[0] as any).id;
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and clear token
    await db.execute(sql`
      UPDATE cc_staging_host_accounts 
      SET password_hash = ${passwordHash},
          password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE id = ${hostId}
    `);

    // Invalidate all existing sessions
    await db.execute(sql`
      DELETE FROM cc_staging_host_sessions WHERE host_account_id = ${hostId}
    `);

    await logActivity(hostId, 'password_reset_completed', 'Password was reset');

    return { success: true };
  } catch (error) {
    console.error('[HostAuth] Reset password error:', error);
    return { success: false, error: 'Failed to reset password' };
  }
}

// ============================================================================
// UPDATE PASSWORD (logged in user)
// ============================================================================

export async function updatePassword(
  hostId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current password hash
    const result = await db.execute(sql`
      SELECT password_hash FROM cc_staging_host_accounts WHERE id = ${hostId}
    `);

    if (result.rows.length === 0) {
      return { success: false, error: 'Account not found' };
    }

    const currentHash = (result.rows[0] as any).password_hash;
    const validCurrent = await bcrypt.compare(currentPassword, currentHash);

    if (!validCurrent) {
      await logActivity(hostId, 'password_change_failed', 'Invalid current password');
      return { success: false, error: 'Current password is incorrect' };
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await db.execute(sql`
      UPDATE cc_staging_host_accounts 
      SET password_hash = ${newHash}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${hostId}
    `);

    await logActivity(hostId, 'password_changed', 'Password was changed');

    return { success: true };
  } catch (error) {
    console.error('[HostAuth] Update password error:', error);
    return { success: false, error: 'Failed to update password' };
  }
}

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

export async function logActivity(
  hostId: number,
  action: string,
  description: string,
  propertyId?: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO cc_staging_host_activity_log (host_account_id, action, description, property_id, metadata)
      VALUES (${hostId}, ${action}, ${description}, ${propertyId || null}, ${metadata ? JSON.stringify(metadata) : null})
    `);
  } catch (error) {
    console.error('[HostAuth] Log activity error:', error);
  }
}

// ============================================================================
// GET HOST BY ID
// ============================================================================

export async function getHostById(id: number): Promise<HostAccount | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM cc_staging_host_accounts WHERE id = ${id}
    `);
    
    if (result.rows.length === 0) return null;
    return snakeToCamel(result.rows[0] as Record<string, any>) as HostAccount;
  } catch (error) {
    console.error('[HostAuth] Get host error:', error);
    return null;
  }
}

// ============================================================================
// CLEANUP EXPIRED SESSIONS
// ============================================================================

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.execute(sql`
      DELETE FROM cc_staging_host_sessions WHERE expires_at < CURRENT_TIMESTAMP
    `);
    return result.rowCount ?? 0;
  } catch (error) {
    console.error('[HostAuth] Cleanup error:', error);
    return 0;
  }
}

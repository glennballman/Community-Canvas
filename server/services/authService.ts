import { db } from '../db';
import { 
  ccAuthAccounts, ccAuthSessions, ccPasswordResets, ccPortals 
} from '@shared/schema';
import { eq, and, gt, desc, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  portalSlug?: string;
  signupSource?: string;
  referrerId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface LoginRequest {
  email: string;
  password: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SessionInfo {
  user: any;
  session: any;
  token: string;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function generateToken(): string {
  return nanoid(48);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function registerUser(req: RegisterRequest): Promise<SessionInfo> {
  const existing = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.email, req.email.toLowerCase())
  });
  
  if (existing) {
    throw new Error('Email already registered');
  }
  
  let portalId: string | undefined;
  if (req.portalSlug) {
    const portal = await db.query.ccPortals.findFirst({
      where: eq(ccPortals.slug, req.portalSlug)
    });
    if (portal) portalId = portal.id;
  }
  
  if (req.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  const passwordHash = hashPassword(req.password);
  
  const [user] = await db.insert(ccAuthAccounts).values({
    email: req.email.toLowerCase(),
    passwordHash,
    displayName: req.displayName,
    portalId,
    authProvider: 'email',
    status: 'active',
    signupSource: req.signupSource || 'web',
    signupReferrerId: req.referrerId,
    utmSource: req.utmSource,
    utmMedium: req.utmMedium,
    utmCampaign: req.utmCampaign,
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    termsVersion: '1.0'
  }).returning();
  
  const token = generateToken();
  const refreshToken = generateToken();
  
  const [session] = await db.insert(ccAuthSessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    refreshTokenHash: hashToken(refreshToken),
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    sessionType: 'web',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'active'
  }).returning();
  
  const { passwordHash: _, ...safeUser } = user;
  
  return {
    user: safeUser,
    session,
    token
  };
}

export async function loginUser(req: LoginRequest): Promise<SessionInfo> {
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.email, req.email.toLowerCase())
  });
  
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  if (user.status === 'suspended') {
    throw new Error('Account is suspended');
  }
  
  if (user.status === 'banned') {
    throw new Error('Account is banned');
  }
  
  if (!user.passwordHash) {
    throw new Error('Password login not available for this account');
  }
  
  if (!verifyPassword(req.password, user.passwordHash)) {
    throw new Error('Invalid email or password');
  }
  
  const token = generateToken();
  const refreshToken = generateToken();
  
  const [session] = await db.insert(ccAuthSessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    refreshTokenHash: hashToken(refreshToken),
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    sessionType: 'web',
    deviceName: req.deviceName,
    deviceType: req.deviceType,
    browser: req.browser,
    os: req.os,
    ipAddress: req.ipAddress,
    userAgent: req.userAgent,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'active'
  }).returning();
  
  await db.update(ccAuthAccounts)
    .set({
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      loginCount: (user.loginCount || 0) + 1,
      updatedAt: new Date()
    })
    .where(eq(ccAuthAccounts.id, user.id));
  
  const { passwordHash: _, ...safeUser } = user;
  
  return {
    user: safeUser,
    session,
    token
  };
}

export async function validateSession(token: string): Promise<any | null> {
  const tokenHash = hashToken(token);
  
  const session = await db.query.ccAuthSessions.findFirst({
    where: and(
      eq(ccAuthSessions.tokenHash, tokenHash),
      eq(ccAuthSessions.status, 'active'),
      gt(ccAuthSessions.expiresAt, new Date())
    )
  });
  
  if (!session) return null;
  
  await db.update(ccAuthSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(ccAuthSessions.id, session.id));
  
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.id, session.userId)
  });
  
  if (!user || user.status !== 'active') return null;
  
  await db.update(ccAuthAccounts)
    .set({ lastActiveAt: new Date() })
    .where(eq(ccAuthAccounts.id, user.id));
  
  const { passwordHash: _, ...safeUser } = user;
  
  return { user: safeUser, session };
}

export async function refreshSession(refreshToken: string): Promise<SessionInfo | null> {
  const tokenHash = hashToken(refreshToken);
  
  const session = await db.query.ccAuthSessions.findFirst({
    where: and(
      eq(ccAuthSessions.refreshTokenHash, tokenHash),
      eq(ccAuthSessions.status, 'active'),
      gt(ccAuthSessions.refreshExpiresAt, new Date())
    )
  });
  
  if (!session) return null;
  
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.id, session.userId)
  });
  
  if (!user || user.status !== 'active') return null;
  
  const newToken = generateToken();
  const newRefreshToken = generateToken();
  
  const [updated] = await db.update(ccAuthSessions)
    .set({
      tokenHash: hashToken(newToken),
      refreshTokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date()
    })
    .where(eq(ccAuthSessions.id, session.id))
    .returning();
  
  const { passwordHash: _, ...safeUser } = user;
  
  return {
    user: safeUser,
    session: updated,
    token: newToken
  };
}

export async function logoutSession(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  
  const result = await db.update(ccAuthSessions)
    .set({
      status: 'revoked',
      revokedAt: new Date(),
      revokedReason: 'logout'
    })
    .where(eq(ccAuthSessions.tokenHash, tokenHash))
    .returning();
  
  return result.length > 0;
}

export async function logoutAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const conditions = [
    eq(ccAuthSessions.userId, userId),
    eq(ccAuthSessions.status, 'active')
  ];
  
  if (exceptSessionId) {
    conditions.push(ne(ccAuthSessions.id, exceptSessionId));
  }
  
  const result = await db.update(ccAuthSessions)
    .set({
      status: 'revoked',
      revokedAt: new Date(),
      revokedReason: 'logout_all'
    })
    .where(and(...conditions))
    .returning();
  
  return result.length;
}

export async function getUserSessions(userId: string): Promise<any[]> {
  return db.query.ccAuthSessions.findMany({
    where: and(
      eq(ccAuthSessions.userId, userId),
      eq(ccAuthSessions.status, 'active')
    ),
    orderBy: [desc(ccAuthSessions.lastUsedAt)]
  });
}

export async function requestPasswordReset(
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.email, email.toLowerCase())
  });
  
  if (!user) {
    throw new Error('If this email exists, a reset link will be sent');
  }
  
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  
  await db.insert(ccPasswordResets).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
    ipAddress,
    userAgent,
    status: 'pending'
  });
  
  return { token, expiresAt };
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const tokenHash = hashToken(token);
  
  const reset = await db.query.ccPasswordResets.findFirst({
    where: and(
      eq(ccPasswordResets.tokenHash, tokenHash),
      eq(ccPasswordResets.status, 'pending'),
      gt(ccPasswordResets.expiresAt, new Date())
    )
  });
  
  if (!reset) {
    throw new Error('Invalid or expired reset token');
  }
  
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  const passwordHash = hashPassword(newPassword);
  
  await db.update(ccAuthAccounts)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccAuthAccounts.id, reset.userId));
  
  await db.update(ccPasswordResets)
    .set({
      status: 'used',
      usedAt: new Date()
    })
    .where(eq(ccPasswordResets.id, reset.id));
  
  await logoutAllSessions(reset.userId);
  
  return true;
}

export async function getUserProfile(userId: string): Promise<any | null> {
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.id, userId)
  });
  
  if (!user) return null;
  
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function updateUserProfile(
  userId: string,
  data: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    timezone?: string;
    locale?: string;
    preferences?: any;
    notificationSettings?: any;
  }
): Promise<any> {
  const updates: Record<string, any> = {
    updatedAt: new Date()
  };
  
  if (data.displayName) updates.displayName = data.displayName;
  if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.timezone) updates.timezone = data.timezone;
  if (data.locale) updates.locale = data.locale;
  if (data.preferences) updates.preferencesJson = data.preferences;
  if (data.notificationSettings) updates.notificationSettingsJson = data.notificationSettings;
  
  const [updated] = await db.update(ccAuthAccounts)
    .set(updates)
    .where(eq(ccAuthAccounts.id, userId))
    .returning();
  
  const { passwordHash: _, ...safeUser } = updated;
  return safeUser;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const user = await db.query.ccAuthAccounts.findFirst({
    where: eq(ccAuthAccounts.id, userId)
  });
  
  if (!user || !user.passwordHash) {
    throw new Error('User not found');
  }
  
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw new Error('Current password is incorrect');
  }
  
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }
  
  const passwordHash = hashPassword(newPassword);
  
  await db.update(ccAuthAccounts)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccAuthAccounts.id, userId));
  
  return true;
}

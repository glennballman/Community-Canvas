import { Router, Request, Response, NextFunction } from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import {
  blockTenantAccess,
  requirePlatformRole,
  PlatformStaffRequest,
  createServiceKeyAuditEvent
} from '../middleware/guards';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';
import { hashImpersonationToken, isPepperAvailable } from '../lib/impersonationPepper';

const { Pool } = pg;
const superuserPool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const internalRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  const existing = rateLimitMap.get(ip);
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMITED'
    });
  }
  
  existing.count++;
  next();
};

router.use(internalRateLimit);
router.use(blockTenantAccess);

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }
    
    const result = await superuserPool.query(
      `SELECT id, email, password_hash, full_name, role, is_active 
       FROM cc_platform_staff 
       WHERE email = $1`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    const staff = result.rows[0];
    
    if (!staff.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account disabled'
      });
    }
    
    const passwordValid = await bcrypt.compare(password, staff.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    await superuserPool.query(
      `UPDATE cc_platform_staff SET last_login_at = now() WHERE id = $1`,
      [staff.id]
    );
    
    (req as any).session.platformStaff = {
      id: staff.id,
      email: staff.email,
      full_name: staff.full_name,
      role: staff.role
    };
    
    return res.json({
      success: true,
      staff: {
        id: staff.id,
        email: staff.email,
        full_name: staff.full_name,
        role: staff.role
      }
    });
  } catch (error: any) {
    console.error('Platform login error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: 'Login failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

router.post('/auth/logout', (req: Request, res: Response) => {
  delete (req as any).session.platformStaff;
  return res.json({ success: true });
});

// P0 SECURITY: Exchange foundation JWT for platform session
// This is the ONLY way for platform admins to convert their foundation auth to platform session
// Input: Authorization: Bearer <foundation JWT>
// Output: Sets platform_sid session cookie (HttpOnly, SameSite=Strict, Path=/api/internal)
router.post('/auth/exchange', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization Bearer token required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    // Validate the foundation JWT
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';
    
    interface JWTPayload {
      userId: string;
      email: string;
      isPlatformAdmin: boolean;
      exp?: number;
      iat?: number;
    }
    
    let decoded: JWTPayload;
    try {
      decoded = jwt.default.verify(token, JWT_SECRET) as JWTPayload;
    } catch (jwtError: any) {
      console.log(`[SECURITY] JWT exchange rejected: ${jwtError.message}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Verify the user is a platform admin
    if (!decoded.isPlatformAdmin) {
      console.log(`[SECURITY] JWT exchange rejected: not platform admin (${decoded.email})`);
      return res.status(403).json({
        success: false,
        error: 'Platform admin privileges required',
        code: 'NOT_PLATFORM_ADMIN'
      });
    }
    
    // Fetch the user from cc_users to get their full details
    const userResult = await superuserPool.query(
      `SELECT id, email, given_name, family_name, display_name, is_platform_admin 
       FROM cc_users 
       WHERE id = $1 AND is_platform_admin = true`,
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`[SECURITY] JWT exchange rejected: user not found or not admin (${decoded.userId})`);
      return res.status(403).json({
        success: false,
        error: 'Platform admin user not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const user = userResult.rows[0];
    const displayName = user.display_name || `${user.given_name} ${user.family_name}`.trim() || user.email;
    
    // Set platform staff session
    (req as any).session.platformStaff = {
      id: user.id,
      email: user.email,
      full_name: displayName,
      role: 'platform_admin'
    };
    
    console.log(`[SECURITY] Platform session exchanged for: ${user.email}`);
    
    return res.json({
      success: true,
      staff: {
        id: user.id,
        email: user.email,
        full_name: displayName,
        role: 'platform_admin'
      }
    });
  } catch (error: any) {
    console.error('Platform exchange error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: 'Exchange failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

router.post('/bootstrap/init', async (req: Request, res: Response) => {
  try {
    const existingStaff = await superuserPool.query(
      'SELECT COUNT(*) as count FROM cc_platform_staff WHERE is_active = true'
    );
    
    if (parseInt(existingStaff.rows[0].count) > 0) {
      return res.status(403).json({
        success: false,
        error: 'Bootstrap not allowed - active staff already exist',
        code: 'BOOTSTRAP_DISABLED'
      });
    }
    
    const unclaimedTokens = await superuserPool.query(
      `SELECT COUNT(*) as count FROM cc_platform_staff_bootstrap_tokens 
       WHERE claimed_at IS NULL AND expires_at > now()`
    );
    
    if (parseInt(unclaimedTokens.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: 'Unclaimed bootstrap token already exists',
        code: 'TOKEN_EXISTS'
      });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    await superuserPool.query(
      `INSERT INTO cc_platform_staff_bootstrap_tokens (token_hash, created_by_ip, expires_at)
       VALUES ($1, $2, now() + INTERVAL '1 hour')`,
      [tokenHash, clientIp]
    );
    
    console.log(`[SECURITY] Bootstrap token generated from IP: ${clientIp}`);
    
    return res.json({
      success: true,
      token: token,
      expires_in_seconds: 3600,
      message: 'Use POST /api/internal/bootstrap/claim with this token to create first admin'
    });
  } catch (error: any) {
    console.error('Bootstrap init error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate bootstrap token'
    });
  }
});

const bootstrapClaimSchema = z.object({
  token: z.string().min(64).max(64),
  email: z.string().email(),
  password: z.string().min(12),
  full_name: z.string().min(2).max(255)
});

router.post('/bootstrap/claim', async (req: Request, res: Response) => {
  try {
    const parsed = bootstrapClaimSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: parsed.error.errors
      });
    }
    
    const { token, email, password, full_name } = parsed.data;
    
    // P0 SECURITY: Validate email domain if PLATFORM_ADMIN_EMAIL is configured
    // This ensures platform admins can only use operator-controlled email domains
    const operatorEmail = process.env.PLATFORM_ADMIN_EMAIL;
    if (operatorEmail && process.env.NODE_ENV === 'production') {
      const operatorDomain = operatorEmail.split('@')[1];
      const claimDomain = email.toLowerCase().split('@')[1];
      
      if (claimDomain !== operatorDomain) {
        console.log(`[SECURITY] Bootstrap claim rejected - domain mismatch: ${claimDomain} vs allowed ${operatorDomain}`);
        return res.status(403).json({
          success: false,
          error: `Email must be from domain: ${operatorDomain}`,
          code: 'DOMAIN_NOT_ALLOWED'
        });
      }
    }
    
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const tokenResult = await superuserPool.query(
      `SELECT id, expires_at, claimed_at FROM cc_platform_staff_bootstrap_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid bootstrap token',
        code: 'INVALID_TOKEN'
      });
    }
    
    const tokenRow = tokenResult.rows[0];
    
    if (tokenRow.claimed_at) {
      return res.status(409).json({
        success: false,
        error: 'Token already claimed',
        code: 'TOKEN_CLAIMED'
      });
    }
    
    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const staffResult = await superuserPool.query(
      `INSERT INTO cc_platform_staff (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'platform_admin', true)
       RETURNING id, email, full_name, role`,
      [email.toLowerCase(), passwordHash, full_name]
    );
    
    const newStaff = staffResult.rows[0];
    
    await superuserPool.query(
      `UPDATE cc_platform_staff_bootstrap_tokens 
       SET claimed_at = now(), claimed_by_staff_id = $1
       WHERE id = $2`,
      [newStaff.id, tokenRow.id]
    );
    
    console.log(`[SECURITY] Bootstrap complete - first admin created: ${newStaff.email}`);
    
    return res.json({
      success: true,
      staff: {
        id: newStaff.id,
        email: newStaff.email,
        full_name: newStaff.full_name,
        role: newStaff.role
      },
      message: 'First admin created successfully. You can now login.'
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }
    console.error('Bootstrap claim error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create admin account'
    });
  }
});

router.get('/auth/me', (req: Request, res: Response) => {
  const staffSession = (req as any).session?.platformStaff;
  if (!staffSession?.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }
  return res.json({
    success: true,
    staff: staffSession
  });
});

// ================================================================================
// PLATFORM ADMIN PROFILE MANAGEMENT
// Allows platform admins to update their email and password securely
// ================================================================================

const profileUpdateSchema = z.object({
  email: z.string().email().optional(),
  current_password: z.string().min(1),
  new_password: z.string().min(12).optional(),
  full_name: z.string().min(2).max(255).optional()
}).refine(data => data.email || data.new_password || data.full_name, {
  message: 'At least one field to update is required'
});

router.patch(
  '/admin/profile',
  requirePlatformRole('platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff!.id;
      
      const parsed = profileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.errors
        });
      }
      
      const { email, current_password, new_password, full_name } = parsed.data;
      
      // P0 SECURITY: Validate email domain if PLATFORM_ADMIN_EMAIL is configured
      // Same validation as bootstrap/claim to maintain recoverability invariant
      if (email) {
        const operatorEmail = process.env.PLATFORM_ADMIN_EMAIL;
        if (operatorEmail) {
          const operatorDomain = operatorEmail.toLowerCase().split('@')[1];
          const newDomain = email.toLowerCase().split('@')[1];
          
          if (newDomain !== operatorDomain) {
            console.log(`[SECURITY] Profile email change rejected - domain mismatch: ${newDomain} vs allowed ${operatorDomain}`);
            return res.status(403).json({
              success: false,
              error: `Email must be from domain: ${operatorDomain}`,
              code: 'DOMAIN_NOT_ALLOWED'
            });
          }
        }
      }
      
      const staffResult = await superuserPool.query(
        `SELECT id, email, password_hash, full_name FROM cc_platform_staff WHERE id = $1`,
        [staffId]
      );
      
      if (staffResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Staff account not found',
          code: 'NOT_FOUND'
        });
      }
      
      const staff = staffResult.rows[0];
      const passwordValid = await bcrypt.compare(current_password, staff.password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }
      
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (email && email !== staff.email) {
        updates.push(`email = $${paramIndex++}`);
        values.push(email.toLowerCase());
      }
      
      if (new_password) {
        const newPasswordHash = await bcrypt.hash(new_password, 12);
        updates.push(`password_hash = $${paramIndex++}`);
        values.push(newPasswordHash);
      }
      
      if (full_name && full_name !== staff.full_name) {
        updates.push(`full_name = $${paramIndex++}`);
        values.push(full_name);
      }
      
      if (updates.length === 0) {
        return res.json({
          success: true,
          message: 'No changes made',
          staff: {
            id: staff.id,
            email: staff.email,
            full_name: staff.full_name
          }
        });
      }
      
      updates.push(`updated_at = now()`);
      values.push(staffId);
      
      const updateResult = await superuserPool.query(
        `UPDATE cc_platform_staff 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, full_name, role`,
        values
      );
      
      const updatedStaff = updateResult.rows[0];
      
      (req as any).session.platformStaff = {
        ...platformReq.platformStaff,
        email: updatedStaff.email,
        full_name: updatedStaff.full_name
      };
      
      console.log(`[SECURITY] Platform admin profile updated: ${updatedStaff.email} (changed: ${updates.slice(0, -1).map(u => u.split(' ')[0]).join(', ')})`);
      
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        staff: {
          id: updatedStaff.id,
          email: updatedStaff.email,
          full_name: updatedStaff.full_name,
          role: updatedStaff.role
        }
      });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Email already in use by another account',
          code: 'EMAIL_EXISTS'
        });
      }
      console.error('Profile update error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }
);

router.get(
  '/admin/status',
  requirePlatformRole('platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const result = await superuserPool.query(`
        SELECT 
          COUNT(*) as total_admins,
          COUNT(*) FILTER (WHERE role = 'platform_admin') as platform_admins,
          COUNT(*) FILTER (WHERE is_active = true) as active_accounts
        FROM cc_platform_staff
      `);
      
      const configuredEmail = process.env.PLATFORM_ADMIN_EMAIL;
      const row = result.rows[0];
      
      return res.json({
        success: true,
        stats: {
          total_admins: parseInt(row.total_admins),
          platform_admins: parseInt(row.platform_admins),
          active_accounts: parseInt(row.active_accounts)
        },
        config: {
          operator_email_configured: !!configuredEmail,
          operator_email_domain: configuredEmail ? configuredEmail.split('@')[1] : null
        }
      });
    } catch (error: any) {
      console.error('Admin status error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to get admin status'
      });
    }
  }
);

// ================================================================================
// IMPERSONATION ENDPOINTS
// Allow platform staff to temporarily act as a tenant for support/debugging
// ================================================================================

const impersonateStartSchema = z.object({
  tenant_id: z.string().uuid(),
  individual_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(10).max(500),
  duration_hours: z.number().min(0.5).max(8).default(2)
});

router.post(
  '/impersonate/start',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const platformReq = req as PlatformStaffRequest;
      const parsed = impersonateStartSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.errors
        });
      }
      
      const { tenant_id, individual_id, reason, duration_hours } = parsed.data;
      const staffId = platformReq.platformStaff!.id;
      
      // Check for existing active impersonation
      const existingSession = await serviceQuery(
        `SELECT id FROM cc_impersonation_sessions 
         WHERE platform_staff_id = $1 
           AND revoked_at IS NULL 
           AND expires_at > now()`,
        [staffId]
      );
      
      if (existingSession.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Active impersonation session already exists. Stop it first.',
          code: 'IMPERSONATION_ACTIVE',
          active_session_id: existingSession.rows[0].id
        });
      }
      
      // Verify tenant exists
      const tenantCheck = await serviceQuery(
        `SELECT id, name FROM cc_tenants WHERE id = $1`,
        [tenant_id]
      );
      
      if (tenantCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        });
      }
      
      // If individual_id provided, verify they belong to tenant
      let individualName = null;
      if (individual_id) {
        const individualCheck = await serviceQuery(
          `SELECT i.id, i.full_name FROM cc_individuals i
           JOIN cc_users u ON u.email = i.email
           JOIN cc_tenant_users tu ON tu.user_id = u.id
           WHERE i.id = $1 AND tu.tenant_id = $2`,
          [individual_id, tenant_id]
        );
        
        if (individualCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Individual not found or not a member of this tenant',
            code: 'INDIVIDUAL_NOT_FOUND'
          });
        }
        individualName = individualCheck.rows[0].full_name;
      }
      
      const expiresAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000);
      
      // Fail closed: reject impersonation if pepper is not configured
      if (!isPepperAvailable()) {
        console.error('[SECURITY] Impersonation rejected: IMPERSONATION_PEPPER not configured');
        return res.status(503).json({
          success: false,
          error: 'Impersonation service unavailable',
          code: 'PEPPER_NOT_CONFIGURED'
        });
      }
      
      // Generate secure random token for impersonation cookie
      const impersonationToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashImpersonationToken(impersonationToken);
      
      if (!tokenHash) {
        console.error('[SECURITY] Token hashing failed - pepper may have been cleared');
        return res.status(503).json({
          success: false,
          error: 'Impersonation service unavailable',
          code: 'HASH_FAILED'
        });
      }
      
      // Create impersonation session with token hash
      const sessionResult = await serviceQuery(
        `INSERT INTO cc_impersonation_sessions 
         (platform_staff_id, tenant_id, individual_id, reason, expires_at, impersonation_token_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [staffId, tenant_id, individual_id || null, reason, expiresAt, tokenHash]
      );
      
      const newSession = sessionResult.rows[0];
      
      // Log audit event
      await serviceQuery(
        `INSERT INTO cc_impersonation_events 
         (impersonation_session_id, event_type, ip, user_agent)
         VALUES ($1, 'started', $2, $3)`,
        [
          newSession.id,
          req.ip || req.socket.remoteAddress || 'unknown',
          req.headers['user-agent'] || 'unknown'
        ]
      );
      
      // Set impersonation_sid cookie (path=/ so tenant routes can read it)
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('impersonation_sid', impersonationToken, {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: duration_hours * 60 * 60 * 1000
      });
      
      console.log(`[SECURITY] Impersonation started: staff=${platformReq.platformStaff!.email} tenant=${tenantCheck.rows[0].name} reason="${reason}"`);
      
      return res.json({
        success: true,
        impersonation: {
          id: newSession.id,
          tenant_id,
          tenant_name: tenantCheck.rows[0].name,
          individual_id: individual_id || null,
          individual_name: individualName,
          reason,
          expires_at: expiresAt,
          created_at: newSession.created_at
        }
      });
    } catch (error: any) {
      console.error('Impersonation start error:', error.message, error.stack);
      return res.status(500).json({
        success: false,
        error: 'Failed to start impersonation'
      });
    }
  }
);

router.post(
  '/impersonate/stop',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff!.id;
      
      // Find and revoke active session, clear token hash
      const revokeResult = await serviceQuery(
        `UPDATE cc_impersonation_sessions 
         SET revoked_at = now(), impersonation_token_hash = NULL
         WHERE platform_staff_id = $1 
           AND revoked_at IS NULL 
           AND expires_at > now()
         RETURNING id, tenant_id`,
        [staffId]
      );
      
      if (revokeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No active impersonation session found',
          code: 'NO_ACTIVE_SESSION'
        });
      }
      
      const revokedSession = revokeResult.rows[0];
      
      // Log audit event
      await serviceQuery(
        `INSERT INTO cc_impersonation_events 
         (impersonation_session_id, event_type, ip, user_agent)
         VALUES ($1, 'stopped', $2, $3)`,
        [
          revokedSession.id,
          req.ip || req.socket.remoteAddress || 'unknown',
          req.headers['user-agent'] || 'unknown'
        ]
      );
      
      // Clear impersonation_sid cookie
      res.clearCookie('impersonation_sid', { path: '/' });
      
      console.log(`[SECURITY] Impersonation stopped: staff=${platformReq.platformStaff!.email} session=${revokedSession.id}`);
      
      return res.json({
        success: true,
        message: 'Impersonation session stopped',
        session_id: revokedSession.id
      });
    } catch (error: any) {
      console.error('Impersonation stop error:', error.message, error.stack);
      return res.status(500).json({
        success: false,
        error: 'Failed to stop impersonation'
      });
    }
  }
);

router.get(
  '/impersonate/status',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff!.id;
      
      const sessionResult = await serviceQuery(
        `SELECT 
           s.id,
           s.tenant_id,
           t.name as tenant_name,
           t.tenant_type,
           s.individual_id,
           i.full_name as individual_name,
           s.reason,
           s.expires_at,
           s.created_at
         FROM cc_impersonation_sessions s
         JOIN cc_tenants t ON t.id = s.tenant_id
         LEFT JOIN cc_individuals i ON i.id = s.individual_id
         WHERE s.platform_staff_id = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > now()
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [staffId]
      );
      
      if (sessionResult.rows.length === 0) {
        return res.json({
          success: true,
          active: false,
          impersonation: null
        });
      }
      
      const session = sessionResult.rows[0];
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      const remainingMs = expiresAt.getTime() - now.getTime();
      
      return res.json({
        success: true,
        active: true,
        impersonation: {
          id: session.id,
          tenant_id: session.tenant_id,
          tenant_name: session.tenant_name,
          tenant_type: session.tenant_type,
          individual_id: session.individual_id,
          individual_name: session.individual_name,
          reason: session.reason,
          expires_at: session.expires_at,
          created_at: session.created_at,
          remaining_seconds: Math.max(0, Math.floor(remainingMs / 1000))
        }
      });
    } catch (error: any) {
      console.error('Impersonation status error:', error.message, error.stack);
      return res.status(500).json({
        success: false,
        error: 'Failed to get impersonation status'
      });
    }
  }
);

// Get list of tenants for impersonation selection
router.get(
  '/tenants',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { q, limit = '50', offset = '0' } = req.query;
      
      let query = `
        SELECT 
          t.id,
          t.name,
          t.slug,
          t.tenant_type as type,
          t.created_at,
          (SELECT COUNT(*) FROM cc_tenant_users WHERE tenant_id = t.id) as member_count,
          p.slug as portal_slug
        FROM cc_tenants t
        LEFT JOIN LATERAL (
          SELECT slug FROM cc_portals 
          WHERE owning_tenant_id = t.id AND status = 'active'
          ORDER BY created_at LIMIT 1
        ) p ON true
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIdx = 1;
      
      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (t.name ILIKE $${paramIdx} OR t.slug ILIKE $${paramIdx})`;
        params.push(`%${q.trim()}%`);
        paramIdx++;
      }
      
      query += ` ORDER BY t.name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));
      
      const result = await serviceQuery(query, params);
      
      return res.json({
        success: true,
        tenants: result.rows
      });
    } catch (error: any) {
      console.error('Tenants list error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tenants'
      });
    }
  }
);

// Get individuals for a specific tenant (for impersonation selection)
router.get(
  '/tenants/:tenantId/individuals',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      const result = await serviceQuery(`
        SELECT 
          i.id,
          i.full_name,
          i.email
        FROM cc_individuals i
        JOIN cc_users u ON u.email = i.email
        JOIN cc_tenant_users tu ON tu.user_id = u.id
        WHERE tu.tenant_id = $1
        ORDER BY i.full_name ASC
        LIMIT 100
      `, [tenantId]);
      
      return res.json({
        success: true,
        individuals: result.rows
      });
    } catch (error: any) {
      console.error('Tenant individuals list error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch individuals'
      });
    }
  }
);

const claimsQueueSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'draft']).optional(),
  tenant_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

router.get(
  '/claims/queue',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const platformReq = req as PlatformStaffRequest;
      const parsed = claimsQueueSchema.safeParse(req.query);
      
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: parsed.error.errors
        });
      }
      
      const { status, tenant_id, limit, offset } = parsed.data;
      
      let query = `
        SELECT 
          c.id,
          c.target_type,
          c.claimant,
          c.tenant_id,
          t.name as tenant_name,
          c.individual_id,
          i.full_name as individual_name,
          c.status,
          c.desired_action,
          c.nickname,
          c.submitted_at,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM inventory_claim_evidence WHERE claim_id = c.id) as evidence_count
        FROM inventory_claims c
        LEFT JOIN cc_tenants t ON t.id = c.tenant_id
        LEFT JOIN cc_individuals i ON i.id = c.individual_id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIdx = 1;
      
      if (status) {
        query += ` AND c.status = $${paramIdx++}`;
        params.push(status);
      }
      if (tenant_id) {
        query += ` AND c.tenant_id = $${paramIdx++}`;
        params.push(tenant_id);
      }
      
      query += ` ORDER BY 
        CASE c.status 
          WHEN 'submitted' THEN 1 
          WHEN 'under_review' THEN 2 
          ELSE 3 
        END,
        c.submitted_at DESC NULLS LAST,
        c.created_at DESC`;
      
      query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM inventory_claims c
        WHERE 1=1
        ${status ? `AND c.status = '${status}'` : ''}
        ${tenant_id ? `AND c.tenant_id = '${tenant_id}'` : ''}
      `;
      
      const [claimsResult, countResult] = await Promise.all([
        serviceQuery(query, params),
        serviceQuery(countQuery, [])
      ]);
      
      return res.json({
        success: true,
        claims: claimsResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit,
          offset
        },
        actor: {
          staff_id: platformReq.platformStaff?.id,
          staff_name: platformReq.platformStaff?.full_name
        }
      });
    } catch (error) {
      console.error('Claims queue error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch claims queue'
      });
    }
  }
);

router.get(
  '/claims/:id',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      
      const claimResult = await serviceQuery(
        `SELECT 
          c.*,
          t.name as tenant_name,
          i.full_name as individual_name,
          i.email as individual_email
        FROM inventory_claims c
        LEFT JOIN cc_tenants t ON t.id = c.tenant_id
        LEFT JOIN cc_individuals i ON i.id = c.individual_id
        WHERE c.id = $1`,
        [id]
      );
      
      if (claimResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      const [evidenceResult, eventsResult] = await Promise.all([
        serviceQuery(
          `SELECT id, evidence_type, url, notes, raw, created_at 
           FROM inventory_claim_evidence 
           WHERE claim_id = $1 
           ORDER BY created_at`,
          [id]
        ),
        serviceQuery(
          `SELECT 
            e.id,
            e.event_type,
            e.actor_type,
            e.actor_individual_id,
            e.actor_staff_id,
            e.payload,
            e.created_at,
            i.full_name as actor_individual_name,
            s.full_name as actor_staff_name
           FROM inventory_claim_events e
           LEFT JOIN cc_individuals i ON i.id = e.actor_individual_id
           LEFT JOIN cc_platform_staff s ON s.id = e.actor_staff_id
           WHERE e.claim_id = $1
           ORDER BY e.created_at DESC`,
          [id]
        )
      ]);
      
      return res.json({
        success: true,
        claim: claimResult.rows[0],
        evidence: evidenceResult.rows,
        cc_events: eventsResult.rows,
        actor: {
          staff_id: platformReq.platformStaff?.id,
          staff_name: platformReq.platformStaff?.full_name
        }
      });
    } catch (error) {
      console.error('Claim detail error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch claim'
      });
    }
  }
);

router.post(
  '/claims/:id/review/start',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff?.id;
      const staffName = platformReq.platformStaff?.full_name;
      
      const result = await withServiceTransaction(async (client) => {
        const claimResult = await client.query(
          `SELECT id, status, tenant_id FROM inventory_claims WHERE id = $1 FOR UPDATE`,
          [id]
        );
        
        if (claimResult.rows.length === 0) {
          throw new Error('CLAIM_NOT_FOUND');
        }
        
        const claim = claimResult.rows[0];
        
        if (claim.status !== 'submitted') {
          throw new Error(`INVALID_STATUS:${claim.status}`);
        }
        
        await client.query(
          `UPDATE inventory_claims 
           SET status = 'under_review', 
               reviewed_at = now(),
               updated_at = now()
           WHERE id = $1`,
          [id]
        );
        
        await client.query(
          `INSERT INTO inventory_claim_events 
           (claim_id, tenant_id, event_type, actor_type, actor_staff_id, payload, ip, user_agent, endpoint, http_method)
           VALUES ($1, $2, 'review_started', 'platform', $3, $4, $5, $6, $7, $8)`,
          [
            id,
            claim.tenant_id,
            staffId,
            JSON.stringify({
              reviewer_staff_id: staffId,
              reviewer_name: staffName,
              timestamp: new Date().toISOString()
            }),
            req.ip || req.socket.remoteAddress || 'unknown',
            req.headers['user-agent'] || 'unknown',
            `/api/internal/claims/${id}/review/start`,
            'POST'
          ]
        );
        
        const updatedClaim = await client.query(
          `SELECT * FROM inventory_claims WHERE id = $1`,
          [id]
        );
        
        return updatedClaim.rows[0];
      });
      
      return res.json({
        success: true,
        claim: result,
        actor: {
          staff_id: staffId,
          staff_name: staffName
        }
      });
    } catch (error: any) {
      console.error('Review start error:', error);
      
      if (error.message === 'CLAIM_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      if (error.message?.startsWith('INVALID_STATUS:')) {
        const currentStatus = error.message.split(':')[1];
        return res.status(409).json({
          success: false,
          error: 'Claim must be in submitted status to start review',
          code: 'INVALID_STATUS',
          current_status: currentStatus
        });
      }
      
      if (error.message?.includes('Invalid inventory_claims status transition')) {
        return res.status(409).json({
          success: false,
          error: 'Invalid status transition',
          code: 'INVALID_TRANSITION'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to start review'
      });
    }
  }
);

router.get(
  '/claims/:id/audit',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      
      const claimResult = await serviceQuery(
        `SELECT id, tenant_id, status FROM inventory_claims WHERE id = $1`,
        [id]
      );
      
      if (claimResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      const eventsResult = await serviceQuery(
        `SELECT 
          e.id,
          e.claim_id,
          e.tenant_id,
          e.event_type,
          e.actor_type,
          e.actor_individual_id,
          e.actor_staff_id,
          e.payload,
          e.ip,
          e.user_agent,
          e.endpoint,
          e.http_method,
          e.created_at,
          i.full_name as actor_individual_name,
          i.email as actor_individual_email,
          s.full_name as actor_staff_name,
          s.email as actor_staff_email
         FROM inventory_claim_events e
         LEFT JOIN cc_individuals i ON i.id = e.actor_individual_id
         LEFT JOIN cc_platform_staff s ON s.id = e.actor_staff_id
         WHERE e.claim_id = $1
         ORDER BY e.created_at ASC`,
        [id]
      );
      
      return res.json({
        success: true,
        claim_id: id,
        tenant_id: claimResult.rows[0].tenant_id,
        status: claimResult.rows[0].status,
        cc_events: eventsResult.rows,
        total_events: eventsResult.rows.length,
        actor: {
          staff_id: platformReq.platformStaff?.id,
          staff_name: platformReq.platformStaff?.full_name
        }
      });
    } catch (error) {
      console.error('Audit fetch error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch audit log'
      });
    }
  }
);

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(2000).optional()
});

router.post(
  '/claims/:id/decision',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const platformReq = req as PlatformStaffRequest;
      const staffId = platformReq.platformStaff?.id;
      const staffName = platformReq.platformStaff?.full_name;
      
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.errors
        });
      }
      
      const { decision, reason } = parsed.data;
      
      const result = await withServiceTransaction(async (client) => {
        const claimResult = await client.query(
          `SELECT id, status, tenant_id, target_type FROM inventory_claims WHERE id = $1 FOR UPDATE`,
          [id]
        );
        
        if (claimResult.rows.length === 0) {
          throw new Error('CLAIM_NOT_FOUND');
        }
        
        const claim = claimResult.rows[0];
        
        if (claim.status !== 'under_review') {
          throw new Error(`INVALID_STATUS:${claim.status}`);
        }
        
        const newStatus = decision === 'approve' ? 'approved' : 'rejected';
        
        await client.query(
          `UPDATE inventory_claims 
           SET status = $1, 
               decision = $2,
               decision_reason = $3,
               decided_at = now(),
               reviewed_by_individual_id = NULL,
               updated_at = now()
           WHERE id = $4`,
          [newStatus, decision, reason || null, id]
        );
        
        await client.query(
          `INSERT INTO inventory_claim_events 
           (claim_id, tenant_id, event_type, actor_type, actor_staff_id, payload, ip, user_agent, endpoint, http_method)
           VALUES ($1, $2, $3, 'platform', $4, $5, $6, $7, $8, $9)`,
          [
            id,
            claim.tenant_id,
            decision === 'approve' ? 'approved' : 'rejected',
            staffId,
            JSON.stringify({
              decision,
              reason: reason || null,
              reviewer_staff_id: staffId,
              reviewer_name: staffName,
              timestamp: new Date().toISOString()
            }),
            req.ip || req.socket.remoteAddress || 'unknown',
            req.headers['user-agent'] || 'unknown',
            `/api/internal/claims/${id}/decision`,
            'POST'
          ]
        );
        
        // Note: fn_apply_inventory_claim is automatically called by the 
        // trg_claim_auto_apply trigger when status changes to 'approved'
        // No need to call it manually here
        
        const updatedClaim = await client.query(
          `SELECT * FROM inventory_claims WHERE id = $1`,
          [id]
        );
        
        return updatedClaim.rows[0];
      });
      
      return res.json({
        success: true,
        claim: result,
        actor: {
          staff_id: staffId,
          staff_name: staffName
        }
      });
    } catch (error: any) {
      console.error('Decision error:', error);
      
      if (error.message === 'CLAIM_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Claim not found'
        });
      }
      
      if (error.message?.startsWith('INVALID_STATUS:')) {
        const currentStatus = error.message.split(':')[1];
        return res.status(409).json({
          success: false,
          error: 'Claim must be in under_review status to make decision',
          code: 'INVALID_STATUS',
          current_status: currentStatus
        });
      }
      
      if (error.message?.includes('Invalid inventory_claims status transition')) {
        return res.status(409).json({
          success: false,
          error: 'Invalid status transition',
          code: 'INVALID_TRANSITION'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Decision failed'
      });
    }
  }
);

router.get(
  '/tenants',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const result = await serviceQuery(
        `SELECT id, name, slug, created_at 
         FROM cc_tenants 
         ORDER BY name`,
        []
      );
      
      return res.json({
        success: true,
        tenants: result.rows
      });
    } catch (error) {
      console.error('Tenants list error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tenants'
      });
    }
  }
);

// V3.5 STEP 10A: Visibility Graph Resolution (Read-Only, Proof Only)
// This endpoint exists to prove correctness of visibility edges - not used by UI or publishing
router.get(
  '/visibility/resolve',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { source_type, source_id } = req.query;
      
      if (!source_type || !source_id) {
        return res.status(400).json({
          success: false,
          error: 'source_type and source_id required'
        });
      }
      
      if (!['portal', 'zone'].includes(source_type as string)) {
        return res.status(400).json({
          success: false,
          error: 'source_type must be "portal" or "zone"'
        });
      }
      
      const result = await serviceQuery(
        `SELECT * FROM resolve_visibility_targets($1, $2)`,
        [source_type, source_id]
      );
      
      return res.json({
        source: {
          type: source_type,
          id: source_id
        },
        visible_to: result.rows.map(row => ({
          type: row.target_type,
          id: row.target_id
        }))
      });
    } catch (error) {
      console.error('Visibility resolve error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve visibility'
      });
    }
  }
);

// V3.5 STEP 10B: Effective Visibility for Runs (Read-Only, Proof Only)
// Returns direct publications + rolled-up visibility targets for a run
router.get(
  '/visibility/runs/:id/effective',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const runId = req.params.id;
      
      if (!runId || !/^[0-9a-f-]{36}$/i.test(runId)) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_run_id'
        });
      }
      
      // D1) Tenant validation - verify run exists and belongs to accessible tenant
      const runCheck = await serviceQuery(
        `SELECT id, tenant_id, zone_id FROM cc_n3_runs WHERE id = $1`,
        [runId]
      );
      
      if (!runCheck.rows || runCheck.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: 'run_not_found'
        });
      }
      
      // Call the resolver function
      const visibilityResult = await serviceQuery(
        `SELECT * FROM resolve_run_effective_visibility($1)`,
        [runId]
      );
      
      // Get portal names for direct portals
      const directPortals = visibilityResult.rows.filter(r => r.source === 'direct' && r.target_type === 'portal');
      const portalIds = Array.from(new Set(visibilityResult.rows.filter(r => r.target_type === 'portal').map(r => r.target_id)));
      
      let portalNames: Record<string, string> = {};
      if (portalIds.length > 0) {
        const namesResult = await serviceQuery(
          `SELECT id, name FROM cc_portals WHERE id = ANY($1)`,
          [portalIds]
        );
        portalNames = Object.fromEntries(namesResult.rows.map(r => [r.id, r.name]));
      }
      
      // Dedup by (type, id), preferring 'direct' over 'rollup'
      const seen = new Map<string, any>();
      for (const row of visibilityResult.rows) {
        const key = `${row.target_type}:${row.target_id}`;
        const existing = seen.get(key);
        if (!existing || (row.source === 'direct' && existing.source === 'rollup')) {
          seen.set(key, row);
        }
      }
      
      // Build effective targets with names
      const effectiveTargets = Array.from(seen.values()).map(row => ({
        type: row.target_type,
        id: row.target_id,
        name: row.target_type === 'portal' ? portalNames[row.target_id] : null,
        source: row.source
      }));
      
      // Sort: direct first, then by name
      effectiveTargets.sort((a, b) => {
        if (a.source !== b.source) return a.source === 'direct' ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      
      return res.json({
        ok: true,
        run_id: runId,
        direct_portals: directPortals.map(r => ({
          portal_id: r.target_id,
          portal_name: portalNames[r.target_id]
        })),
        effective_targets: effectiveTargets
      });
    } catch (error) {
      console.error('Run effective visibility error:', error);
      return res.status(500).json({
        ok: false,
        error: 'Failed to resolve effective visibility'
      });
    }
  }
);

// V3.5 STEP 10D: Recursive Visibility Resolver (Multi-hop, Read-Only)
// Returns all reachable visibility targets with depth, path, and provenance
router.get(
  '/visibility/resolve-recursive',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { tenant_id, source_type, source_id, max_depth, allow_down } = req.query;
      
      // Validate required params
      if (!tenant_id || typeof tenant_id !== 'string') {
        return res.status(400).json({
          ok: false,
          error: 'missing_tenant_id'
        });
      }
      
      if (!source_type || !['portal', 'zone'].includes(source_type as string)) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_source_type',
          message: 'source_type must be portal or zone'
        });
      }
      
      if (!source_id || !/^[0-9a-f-]{36}$/i.test(source_id as string)) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_source_id'
        });
      }
      
      // Parse optional params
      const depth = max_depth ? Math.min(Math.max(1, parseInt(max_depth as string, 10) || 6), 10) : 6;
      const includeDown = allow_down === 'true';
      
      // Set tenant context for the function
      await serviceQuery(`SELECT set_config('app.tenant_id', $1, true)`, [tenant_id]);
      await serviceQuery(`SELECT set_config('app.service_mode', 'off', true)`);
      
      // Call the recursive dedup function
      const result = await serviceQuery(
        `SELECT target_type, target_id, depth, path_nodes, path_edge_ids
         FROM resolve_visibility_targets_recursive($1, $2, $3, $4)
         ORDER BY depth ASC, target_type ASC`,
        [source_type, source_id, depth, includeDown]
      );
      
      // Resolve names for portals and zones
      const portalIds = result.rows.filter(r => r.target_type === 'portal').map(r => r.target_id);
      const zoneIds = result.rows.filter(r => r.target_type === 'zone').map(r => r.target_id);
      
      let portalNames: Record<string, string> = {};
      let zoneNames: Record<string, string> = {};
      
      if (portalIds.length > 0) {
        const portalsResult = await serviceQuery(
          `SELECT id, name FROM cc_portals WHERE id = ANY($1)`,
          [portalIds]
        );
        portalNames = Object.fromEntries(portalsResult.rows.map(r => [r.id, r.name]));
      }
      
      if (zoneIds.length > 0) {
        const zonesResult = await serviceQuery(
          `SELECT id, name FROM cc_zones WHERE id = ANY($1)`,
          [zoneIds]
        );
        zoneNames = Object.fromEntries(zonesResult.rows.map(r => [r.id, r.name]));
      }
      
      // Build response with names
      const targets = result.rows.map(row => ({
        type: row.target_type,
        id: row.target_id,
        depth: row.depth,
        path: row.path_nodes,
        path_edge_ids: row.path_edge_ids,
        ...(row.target_type === 'portal' && { portal_name: portalNames[row.target_id] }),
        ...(row.target_type === 'zone' && { zone_name: zoneNames[row.target_id] })
      }));
      
      return res.json({
        ok: true,
        source: { type: source_type, id: source_id },
        max_depth: depth,
        allow_down: includeDown,
        targets
      });
    } catch (error) {
      console.error('Recursive visibility resolve error:', error);
      return res.status(500).json({
        ok: false,
        error: 'Failed to resolve recursive visibility'
      });
    }
  }
);

// V3.5 STEP 10E: Visibility-Aware Run Feeds (Read Path Only)
// Returns runs visible in a specific portal (direct + rollup)
router.get(
  '/visibility/portals/:id/runs',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const portalId = req.params.id;
      const { tenant_id, limit: limitStr, offset: offsetStr } = req.query;
      
      // Validate required params
      if (!tenant_id || typeof tenant_id !== 'string') {
        return res.status(400).json({
          ok: false,
          error: 'missing_tenant_id'
        });
      }
      
      if (!portalId || !/^[0-9a-f-]{36}$/i.test(portalId)) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_portal_id'
        });
      }
      
      // Parse pagination
      const limit = Math.min(Math.max(1, parseInt(limitStr as string, 10) || 50), 200);
      const offset = Math.max(0, parseInt(offsetStr as string, 10) || 0);
      
      // Validate portal exists and belongs to tenant
      const portalCheck = await serviceQuery(
        `SELECT id, name, owning_tenant_id FROM cc_portals WHERE id = $1`,
        [portalId]
      );
      
      if (!portalCheck.rows || portalCheck.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: 'portal_not_found'
        });
      }
      
      const portal = portalCheck.rows[0];
      
      // Validate portal belongs to tenant (or is accessible - for now require match)
      if (portal.owning_tenant_id && portal.owning_tenant_id !== tenant_id) {
        return res.status(403).json({
          ok: false,
          error: 'portal_tenant_mismatch'
        });
      }
      
      // Set service mode for visibility functions (admin tool pattern)
      await serviceQuery(`SELECT set_config('app.service_mode', 'on', true)`);
      
      // Use efficient single query with lateral join for visibility filtering
      // This ensures all visible runs are found regardless of sparsity
      const runsResult = await serviceQuery(
        `WITH visible_runs AS (
          SELECT 
            r.id as run_id,
            r.title as run_title,
            r.starts_at,
            r.status,
            r.created_at,
            v.source as visibility_source,
            v.via_type,
            v.via_id,
            v.depth,
            v.path_nodes
          FROM cc_n3_runs r
          CROSS JOIN LATERAL resolve_run_effective_visibility_recursive(r.id, 6) v
          WHERE r.tenant_id = $1
            AND v.target_type = 'portal'
            AND v.target_id = $2
        )
        SELECT * FROM visible_runs
        ORDER BY COALESCE(starts_at, created_at) DESC
        LIMIT $3 OFFSET $4`,
        [tenant_id, portalId, limit, offset]
      );
      
      const visibleRuns = runsResult.rows.map(row => ({
        run_id: row.run_id,
        run_title: row.run_title,
        starts_at: row.starts_at,
        status: row.status,
        visibility_source: row.visibility_source,
        via_type: row.via_type,
        via_id: row.via_id,
        depth: row.depth,
        path: row.path_nodes
      }));
      
      return res.json({
        ok: true,
        portal_id: portalId,
        portal_name: portal.name,
        tenant_id,
        limit,
        offset,
        runs: visibleRuns
      });
    } catch (error) {
      console.error('Portal runs visibility error:', error);
      return res.status(500).json({
        ok: false,
        error: 'Failed to fetch visible runs'
      });
    }
  }
);

// V3.5 STEP 10C: Visibility Edge Management (Admin CRUD)
// List visibility edges with optional filters
router.get(
  '/visibility/edges',
  requirePlatformRole('platform_reviewer', 'platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { tenant_id, source_type, source_id, target_type, target_id, direction, include_archived } = req.query;
      
      let conditions: string[] = [];
      let params: any[] = [];
      let paramIdx = 1;
      
      // Tenant filtering (optional but recommended for tenant-scoped views)
      if (tenant_id) {
        conditions.push(`e.tenant_id = $${paramIdx++}`);
        params.push(tenant_id);
      }
      if (source_type) {
        conditions.push(`source_type = $${paramIdx++}`);
        params.push(source_type);
      }
      if (source_id) {
        conditions.push(`source_id = $${paramIdx++}`);
        params.push(source_id);
      }
      if (target_type) {
        conditions.push(`target_type = $${paramIdx++}`);
        params.push(target_type);
      }
      if (target_id) {
        conditions.push(`target_id = $${paramIdx++}`);
        params.push(target_id);
      }
      if (direction) {
        conditions.push(`direction = $${paramIdx++}`);
        params.push(direction);
      }
      if (include_archived !== 'true') {
        conditions.push(`archived_at IS NULL`);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const result = await serviceQuery(
        `SELECT e.*, 
                p_src.name as source_portal_name, z_src.name as source_zone_name,
                p_tgt.name as target_portal_name, z_tgt.name as target_zone_name
         FROM cc_visibility_edges e
         LEFT JOIN cc_portals p_src ON e.source_type = 'portal' AND e.source_id = p_src.id
         LEFT JOIN cc_zones z_src ON e.source_type = 'zone' AND e.source_id = z_src.id
         LEFT JOIN cc_portals p_tgt ON e.target_type = 'portal' AND e.target_id = p_tgt.id
         LEFT JOIN cc_zones z_tgt ON e.target_type = 'zone' AND e.target_id = z_tgt.id
         ${whereClause}
         ORDER BY e.created_at DESC`,
        params
      );
      
      return res.json({
        ok: true,
        edges: result.rows.map(e => ({
          id: e.id,
          tenant_id: e.tenant_id,
          source_type: e.source_type,
          source_id: e.source_id,
          source_name: e.source_portal_name || e.source_zone_name,
          target_type: e.target_type,
          target_id: e.target_id,
          target_name: e.target_portal_name || e.target_zone_name,
          direction: e.direction,
          reason: e.reason,
          created_at: e.created_at,
          archived_at: e.archived_at
        }))
      });
    } catch (error) {
      console.error('List visibility edges error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to list edges' });
    }
  }
);

// Create a new visibility edge
router.post(
  '/visibility/edges',
  requirePlatformRole('platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const { tenant_id, source_type, source_id, target_type, target_id, direction, reason } = req.body;
      
      // Validate required fields
      if (!tenant_id || !source_type || !source_id || !target_type || !target_id || !direction) {
        return res.status(400).json({ ok: false, error: 'missing_required_fields' });
      }
      
      // Validate enums
      if (!['portal', 'zone'].includes(source_type)) {
        return res.status(400).json({ ok: false, error: 'invalid_source_type' });
      }
      if (!['portal', 'zone'].includes(target_type)) {
        return res.status(400).json({ ok: false, error: 'invalid_target_type' });
      }
      if (!['up', 'down', 'lateral'].includes(direction)) {
        return res.status(400).json({ ok: false, error: 'invalid_direction' });
      }
      
      // Reject self-referential edges
      if (source_id === target_id) {
        return res.status(400).json({ ok: false, error: 'self_reference_not_allowed' });
      }
      
      // Validate source exists AND belongs to specified tenant
      const sourceTable = source_type === 'portal' ? 'cc_portals' : 'cc_zones';
      const sourceCheck = await serviceQuery(
        `SELECT id, tenant_id FROM ${sourceTable} WHERE id = $1`,
        [source_id]
      );
      if (!sourceCheck.rows || sourceCheck.rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'invalid_source' });
      }
      if (sourceCheck.rows[0].tenant_id !== tenant_id) {
        return res.status(400).json({ ok: false, error: 'source_tenant_mismatch' });
      }
      
      // Validate target exists AND belongs to specified tenant
      const targetTable = target_type === 'portal' ? 'cc_portals' : 'cc_zones';
      const targetCheck = await serviceQuery(
        `SELECT id, tenant_id FROM ${targetTable} WHERE id = $1`,
        [target_id]
      );
      if (!targetCheck.rows || targetCheck.rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'invalid_target' });
      }
      if (targetCheck.rows[0].tenant_id !== tenant_id) {
        return res.status(400).json({ ok: false, error: 'target_tenant_mismatch' });
      }
      
      // Insert the edge (unique index will catch duplicates)
      try {
        const result = await serviceQuery(
          `INSERT INTO cc_visibility_edges 
           (tenant_id, source_type, source_id, target_type, target_id, direction, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [tenant_id, source_type, source_id, target_type, target_id, direction, reason || null]
        );
        
        return res.status(201).json({
          ok: true,
          edge: result.rows[0]
        });
      } catch (insertError: any) {
        if (insertError.code === '23505') { // Unique violation
          return res.status(409).json({ ok: false, error: 'duplicate_edge' });
        }
        throw insertError;
      }
    } catch (error) {
      console.error('Create visibility edge error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to create edge' });
    }
  }
);

// Archive (soft delete) a visibility edge
router.patch(
  '/visibility/edges/:id/archive',
  requirePlatformRole('platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const edgeId = req.params.id;
      const { archived } = req.body;
      
      if (archived !== true) {
        return res.status(400).json({ ok: false, error: 'archived_must_be_true' });
      }
      
      const result = await serviceQuery(
        `UPDATE cc_visibility_edges 
         SET archived_at = COALESCE(archived_at, now())
         WHERE id = $1
         RETURNING *`,
        [edgeId]
      );
      
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'edge_not_found' });
      }
      
      return res.json({
        ok: true,
        edge: result.rows[0]
      });
    } catch (error) {
      console.error('Archive visibility edge error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to archive edge' });
    }
  }
);

// Update a visibility edge (reason or direction only)
router.patch(
  '/visibility/edges/:id',
  requirePlatformRole('platform_admin'),
  async (req: Request, res: Response) => {
    try {
      const edgeId = req.params.id;
      const { reason, direction } = req.body;
      
      // Check edge exists
      const existing = await serviceQuery(
        `SELECT * FROM cc_visibility_edges WHERE id = $1`,
        [edgeId]
      );
      
      if (!existing.rows || existing.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'edge_not_found' });
      }
      
      const edge = existing.rows[0];
      
      // Build update
      let updates: string[] = [];
      let params: any[] = [];
      let paramIdx = 1;
      
      if (reason !== undefined) {
        updates.push(`reason = $${paramIdx++}`);
        params.push(reason);
      }
      
      if (direction !== undefined) {
        if (!['up', 'down', 'lateral'].includes(direction)) {
          return res.status(400).json({ ok: false, error: 'invalid_direction' });
        }
        updates.push(`direction = $${paramIdx++}`);
        params.push(direction);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ ok: false, error: 'no_updates_provided' });
      }
      
      params.push(edgeId);
      
      try {
        const result = await serviceQuery(
          `UPDATE cc_visibility_edges 
           SET ${updates.join(', ')}
           WHERE id = $${paramIdx}
           RETURNING *`,
          params
        );
        
        return res.json({
          ok: true,
          edge: result.rows[0]
        });
      } catch (updateError: any) {
        if (updateError.code === '23505') { // Unique violation
          return res.status(409).json({ ok: false, error: 'duplicate_edge' });
        }
        throw updateError;
      }
    } catch (error) {
      console.error('Update visibility edge error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to update edge' });
    }
  }
);

export default router;

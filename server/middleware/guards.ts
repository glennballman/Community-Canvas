import { Request, Response, NextFunction, RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { TenantRequest } from './tenantContext';

const JWT_SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

interface JWTPayload {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  activeTenantId?: string;
}

// HARDENED: No fallback - if INTERNAL_SERVICE_KEY is not set, service mode is disabled
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

// Timing-safe comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

// HARDENED: Check if request has valid service key
// Returns false if INTERNAL_SERVICE_KEY env var is not set (no fallback)
export function isServiceKeyRequest(req: Request): boolean {
  if (!INTERNAL_SERVICE_KEY) {
    // Service mode disabled when env var not set
    return false;
  }
  const providedKey = req.headers['x-internal-service-key'];
  if (typeof providedKey !== 'string') return false;
  return safeCompare(providedKey, INTERNAL_SERVICE_KEY);
}

// Audit event for service-key access (call this in handlers that accept service key)
export interface ServiceKeyAuditEvent {
  endpoint: string;
  method: string;
  resource_id?: string;
  action: string;
  ip: string;
  user_agent: string;
  timestamp: string;
}

export function createServiceKeyAuditEvent(req: Request, action: string, resourceId?: string): ServiceKeyAuditEvent {
  return {
    endpoint: req.originalUrl,
    method: req.method,
    resource_id: resourceId,
    action,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString()
  };
}

// Guard for internal/service-mode endpoints that should never be exposed publicly
// HARDENED: Requires INTERNAL_SERVICE_KEY env var to be set
export const requireServiceKey: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!isServiceKeyRequest(req)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Internal service access required',
      code: 'SERVICE_ACCESS_REQUIRED'
    });
  }
  next();
};

// Cast to RequestHandler for Express Router compatibility
// UPDATED: Also accepts valid impersonation sessions (platform staff impersonating tenant)
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  
  // Accept if user has individual_id (normal auth)
  if (tenantReq.ctx?.individual_id) {
    return next();
  }
  
  // Also accept if impersonating with valid tenant context
  if (tenantReq.impersonation?.tenant_id && tenantReq.ctx?.tenant_id) {
    return next();
  }
  
  return res.status(401).json({ 
    success: false, 
    error: 'Authentication required',
    code: 'AUTH_REQUIRED'
  });
};

export const requireTenant: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  if (!tenantReq.ctx?.tenant_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED'
    });
  }
  next();
};

/**
 * Session-based platform admin check.
 * Requires user to be authenticated AND have is_platform_admin = true in cc_users.
 * Uses the same session auth as the rest of the app (not JWT).
 */
export const requirePlatformAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  const session = (req as any).session;
  
  // Check for individual_id from context (session-based auth)
  const userId = tenantReq.ctx?.individual_id || session?.userId;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  try {
    // Import pool dynamically to avoid circular dependency
    const { pool } = await import('../db');
    
    // Check if user is platform admin in cc_users
    const result = await pool.query(
      'SELECT is_platform_admin FROM cc_users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!result.rows[0].is_platform_admin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Platform admin access required',
        code: 'FORBIDDEN'
      });
    }
    
    // Set user info on request for downstream handlers
    (req as any).platformUser = {
      id: userId,
      isPlatformAdmin: true
    };
    
    next();
  } catch (error) {
    console.error('[requirePlatformAdmin] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

export const requirePortal: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  if (!tenantReq.ctx?.portal_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Portal context required',
      code: 'PORTAL_REQUIRED'
    });
  }
  next();
};

export const requireTenantOrPortal: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  if (!tenantReq.ctx?.tenant_id && !tenantReq.ctx?.portal_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Tenant or portal context required',
      code: 'CONTEXT_REQUIRED'
    });
  }
  next();
};

// Valid tenant role strings - enforced at route registration time
// Note: 'admin' alone is NOT valid - use 'tenant_admin' for tenant admins
// or requirePlatformAdmin for platform administrators
const VALID_TENANT_ROLES = new Set([
  'tenant_owner',
  'tenant_admin', 
  'operator',
  'staff',
  'member',
  // DB stores 'owner' for tenant_owner, allow for backwards compatibility
  'owner'
]);

export function requireRole(...requiredRoles: string[]): RequestHandler {
  // FAIL FAST: Validate roles at registration time, not request time
  const invalidRoles = requiredRoles.filter(role => !VALID_TENANT_ROLES.has(role));
  if (invalidRoles.length > 0) {
    throw new Error(
      `INVALID_ROLE_GUARD: Invalid role(s) passed to requireRole(): ${invalidRoles.join(', ')}. ` +
      `Valid roles are: ${Array.from(VALID_TENANT_ROLES).join(', ')}. ` +
      `For platform admin access, use requirePlatformAdmin instead.`
    );
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const tenantReq = req as TenantRequest;
    if (!tenantReq.ctx?.individual_id) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = tenantReq.ctx.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ 
        success: false, 
        error: `One of these roles required: ${requiredRoles.join(', ')}`,
        code: 'FORBIDDEN'
      });
    }
    
    next();
  };
}

// Export for testing
export { VALID_TENANT_ROLES };

export function requireScope(...requiredScopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantReq = req as TenantRequest;
    const userScopes = tenantReq.ctx?.scopes || [];
    const hasScope = requiredScopes.every(scope => userScopes.includes(scope));
    
    if (!hasScope) {
      return res.status(403).json({ 
        success: false, 
        error: `Required scopes: ${requiredScopes.join(', ')}`,
        code: 'INSUFFICIENT_SCOPE'
      });
    }
    
    next();
  };
}

export function requireSelfOrAdmin(paramName: string = 'id'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantReq = req as TenantRequest;
    if (!tenantReq.ctx?.individual_id) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const requestedId = req.params[paramName];
    const isAdmin = tenantReq.ctx.roles?.includes('admin');
    const isSelf = tenantReq.ctx.individual_id === requestedId;
    
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: can only access your own data',
        code: 'FORBIDDEN'
      });
    }
    
    next();
  };
}

export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  next();
};

// Require tenant admin role (no service-key bypass)
// P0 HARDENED: Service-key removed per security requirement - use session auth only
export const requireTenantAdminOrService: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  
  // P0 HARDENED: Service-key NO LONGER accepted here - use platform staff session instead
  // Service-key is only valid for /api/jobs/* background automation routes
  
  // Must have authenticated individual
  if (!tenantReq.ctx?.individual_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Must have tenant context
  if (!tenantReq.ctx?.tenant_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED'
    });
  }
  
  // Must be tenant_admin or admin
  const userRoles = tenantReq.ctx.roles || [];
  const hasAdminRole = userRoles.includes('tenant_admin') || userRoles.includes('admin');
  
  if (!hasAdminRole) {
    return res.status(403).json({ 
      success: false, 
      error: 'Tenant admin role required',
      code: 'FORBIDDEN'
    });
  }
  
  next();
};

// Require authenticated session but allow missing individual profile
// Use this for endpoints like /me that need to serve both new and existing users
// Only trusts VERIFIED authentication signals: Passport session or req.user (set by Passport)
export const requireSession: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Method 1: Passport's isAuthenticated() - set after successful deserializeUser
  const isPassportAuth = typeof (req as any).isAuthenticated === 'function' && (req as any).isAuthenticated();
  
  // Method 2: req.user object - set by Passport during session hydration
  // This is a TRUSTED source as Passport validates the session cookie
  const hasUser = !!(req as any).user;
  
  // Method 3: Session userId - set by our session middleware after login
  // This is TRUSTED as express-session validates the session cookie signature
  const hasSessionAuth = !!(req as any).session?.userId;
  
  // SECURITY: Only accept verified authentication signals
  // ctx.individual_id is populated FROM these sources by tenantContext middleware,
  // so checking it directly would be redundant and less secure
  if (!isPassportAuth && !hasUser && !hasSessionAuth) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
};

// ================================================================================
// PLATFORM STAFF AUTH GUARDS
// For internal platform review console - completely separate from tenant auth
// ================================================================================

export interface ImpersonationSession {
  id: string;
  tenant_id: string;
  individual_id: string | null;
  reason: string;
  expires_at: Date;
  created_at: Date;
}

export interface PlatformStaffRequest extends Request {
  platformStaff?: {
    id: string;
    email: string;
    full_name: string;
    role: 'platform_reviewer' | 'platform_admin';
  };
  impersonation?: ImpersonationSession;
}

// Check if request has authenticated platform staff (via separate session store)
export const requirePlatformStaff: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const platformReq = req as PlatformStaffRequest;
  
  // Platform staff session is stored in a separate session key
  const staffSession = (req as any).session?.platformStaff;
  
  if (!staffSession?.id) {
    return res.status(401).json({
      success: false,
      error: 'Platform staff authentication required',
      code: 'PLATFORM_AUTH_REQUIRED'
    });
  }
  
  // Attach staff info to request
  platformReq.platformStaff = staffSession;
  next();
};

// Require specific platform role
// P0 SECURITY HARDENED: ONLY accepts platform staff session (platform_sid cookie)
// Foundation JWTs and session users are NOT accepted directly
// Use POST /api/internal/auth/exchange to convert foundation admin JWT to platform session
export function requirePlatformRole(...requiredRoles: ('platform_reviewer' | 'platform_admin')[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const platformReq = req as PlatformStaffRequest;
    const staffSession = (req as any).session?.platformStaff;
    
    // ONLY accept platform staff session from /api/internal/auth/login or /api/internal/auth/exchange
    // P0 SECURITY: Do NOT accept Authorization Bearer JWT or foundation session directly
    if (!staffSession?.id) {
      return res.status(401).json({
        success: false,
        error: 'Platform staff session required. Use /api/internal/auth/login or /api/internal/auth/exchange',
        code: 'PLATFORM_AUTH_REQUIRED'
      });
    }
    
    if (!requiredRoles.includes(staffSession.role)) {
      return res.status(403).json({
        success: false,
        error: `Platform role required: ${requiredRoles.join(' or ')}`,
        code: 'PLATFORM_ROLE_REQUIRED'
      });
    }
    
    platformReq.platformStaff = staffSession;
    next();
  };
}

// Block tenant/public users from internal routes
// This guard ONLY allows platform staff sessions, rejects everything else
export const blockTenantAccess: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as any;
  
  // Block if request has tenant context (this is a tenant user)
  if (tenantReq.ctx?.tenant_id || tenantReq.ctx?.individual_id) {
    return res.status(403).json({
      success: false,
      error: 'Internal endpoint - tenant access blocked',
      code: 'TENANT_ACCESS_BLOCKED'
    });
  }
  
  // Block if request has service key (internal routes don't use service key)
  if (isServiceKeyRequest(req)) {
    return res.status(403).json({
      success: false,
      error: 'Internal endpoint - service key not accepted',
      code: 'SERVICE_KEY_BLOCKED'
    });
  }
  
  next();
};

// ================================================================================
// P0 HARDENING: Block service-key on tenant API routes
// Service-key MUST NOT grant access to /api/* routes that can mutate tenant data
// Only /api/jobs/* (background automation) may use service-key
// ================================================================================

export const blockServiceKeyOnTenantRoutes: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (isServiceKeyRequest(req)) {
    return res.status(403).json({
      success: false,
      error: 'Service key not accepted on tenant API routes',
      code: 'SERVICE_KEY_BLOCKED'
    });
  }
  next();
};

// ================================================================================
// IMPERSONATION MIDDLEWARE
// Resolves active impersonation session and attaches to request
// ================================================================================

import { serviceQuery } from '../db/tenantDb';

// Resolve active impersonation session for platform staff
// This should be called AFTER requirePlatformStaff
export const resolveImpersonation: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const platformReq = req as PlatformStaffRequest;
  
  if (!platformReq.platformStaff?.id) {
    return next();
  }
  
  try {
    const result = await serviceQuery<{
      id: string;
      tenant_id: string;
      individual_id: string | null;
      reason: string;
      expires_at: Date;
      created_at: Date;
    }>(`
      SELECT id, tenant_id, individual_id, reason, expires_at, created_at
      FROM cc_impersonation_sessions
      WHERE platform_staff_id = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    `, [platformReq.platformStaff.id]);
    
    if (result.rows.length > 0) {
      platformReq.impersonation = result.rows[0];
    }
    
    next();
  } catch (error) {
    console.error('Error resolving impersonation:', error);
    next();
  }
};

// Require active impersonation for accessing tenant resources
export const requireImpersonation: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const platformReq = req as PlatformStaffRequest;
  
  if (!platformReq.platformStaff?.id) {
    return res.status(401).json({
      success: false,
      error: 'Platform staff authentication required',
      code: 'PLATFORM_AUTH_REQUIRED'
    });
  }
  
  if (!platformReq.impersonation) {
    return res.status(403).json({
      success: false,
      error: 'Active impersonation session required to access tenant resources',
      code: 'IMPERSONATION_REQUIRED'
    });
  }
  
  // Check if impersonation has expired (redundant but defensive)
  if (new Date(platformReq.impersonation.expires_at) < new Date()) {
    return res.status(403).json({
      success: false,
      error: 'Impersonation session has expired',
      code: 'IMPERSONATION_EXPIRED'
    });
  }
  
  next();
};

// Block platform staff from tenant endpoints unless impersonating
// Use this on /api/* routes (non-internal) to prevent direct platform staff access
export const blockPlatformStaffWithoutImpersonation: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Check if this is a platform staff session trying to access tenant routes
  const platformSession = (req as any).session?.platformStaff;
  
  if (platformSession?.id) {
    // Platform staff detected - block unless impersonating
    // Note: Impersonation context would be set by impersonation middleware
    const hasImpersonation = !!(req as PlatformStaffRequest).impersonation;
    
    if (!hasImpersonation) {
      return res.status(403).json({
        success: false,
        error: 'Platform staff cannot access tenant endpoints without impersonation',
        code: 'IMPERSONATION_REQUIRED'
      });
    }
  }
  
  next();
};

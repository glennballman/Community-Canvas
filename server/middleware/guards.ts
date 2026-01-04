import { Request, Response, NextFunction, RequestHandler } from 'express';
import { TenantRequest } from './tenantContext';

// Internal service key for background jobs and ingestion routes
// These endpoints must NEVER be reachable from public HTTP without this key
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'dev-internal-key-change-in-prod';

// Guard for internal/service-mode endpoints that should never be exposed publicly
// Requires X-Internal-Service-Key header to match the configured key
export const requireServiceKey: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const providedKey = req.headers['x-internal-service-key'];
  
  if (!providedKey || providedKey !== INTERNAL_SERVICE_KEY) {
    return res.status(403).json({ 
      success: false, 
      error: 'Internal service access required',
      code: 'SERVICE_ACCESS_REQUIRED'
    });
  }
  next();
};

// Cast to RequestHandler for Express Router compatibility
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  if (!tenantReq.ctx?.individual_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
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

export function requireRole(...requiredRoles: string[]): RequestHandler {
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

// Require tenant admin role OR service mode (for platform reviewers)
export const requireTenantAdminOrService: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const tenantReq = req as TenantRequest;
  
  // Check for service key header (platform operations)
  const providedKey = req.headers['x-internal-service-key'];
  const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'dev-internal-key-change-in-prod';
  if (providedKey && providedKey === INTERNAL_SERVICE_KEY) {
    return next();
  }
  
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

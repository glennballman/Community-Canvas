import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantContext';

export function requireAuth(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.ctx?.individual_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

export function requireTenant(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.ctx?.tenant_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED'
    });
  }
  next();
}

export function requirePortal(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.ctx?.portal_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Portal context required',
      code: 'PORTAL_REQUIRED'
    });
  }
  next();
}

export function requireTenantOrPortal(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.ctx?.tenant_id && !req.ctx?.portal_id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Tenant or portal context required',
      code: 'CONTEXT_REQUIRED'
    });
  }
  next();
}

export function requireRole(...requiredRoles: string[]) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.ctx?.individual_id) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = req.ctx.roles || [];
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

export function requireScope(...requiredScopes: string[]) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const userScopes = req.ctx?.scopes || [];
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

export function requireSelfOrAdmin(paramName: string = 'id') {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.ctx?.individual_id) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const requestedId = req.params[paramName];
    const isAdmin = req.ctx.roles?.includes('admin');
    const isSelf = req.ctx.individual_id === requestedId;
    
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

export function optionalAuth(req: TenantRequest, res: Response, next: NextFunction) {
  next();
}

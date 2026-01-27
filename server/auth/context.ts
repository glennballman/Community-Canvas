/**
 * PART 2C: Auth Context Middleware
 * Attaches resolved principal context to req.auth
 * AUTH_CONSTITUTION.md governs; single identity authority
 */

import { Request, Response, NextFunction } from 'express';
import { resolvePrincipalFromSession, PrincipalContext } from './principal';
import { resolveTenantScopeId } from './scope';

export interface AuthContext extends PrincipalContext {
  tenantId: string | null;
  tenantScopeId: string | null;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

/**
 * Middleware that attaches auth context to request
 * Must run after session middleware but before routes
 */
export async function authContextMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    // Resolve principal from session
    const principalContext = await resolvePrincipalFromSession(req);
    
    // Get tenant ID from various sources
    const tenantId = getTenantIdFromRequest(req);
    
    // Resolve tenant scope if tenant is known
    let tenantScopeId: string | null = null;
    if (tenantId) {
      tenantScopeId = await resolveTenantScopeId(tenantId);
    }
    
    // Attach to request
    (req as AuthenticatedRequest).auth = {
      ...principalContext,
      tenantId,
      tenantScopeId,
    };
    
    next();
  } catch (error) {
    console.error('[authContextMiddleware] Error resolving auth context:', error);
    // Fail-closed: attach empty context, let routes decide
    (req as AuthenticatedRequest).auth = {
      principalId: null,
      effectivePrincipalId: null,
      isImpersonating: false,
      userId: null,
      effectiveUserId: null,
      tenantId: null,
      tenantScopeId: null,
    };
    next();
  }
}

/**
 * Extracts tenant ID from request (multiple sources)
 */
function getTenantIdFromRequest(req: Request): string | null {
  // Priority 1: Route param
  if (req.params?.tenantId) {
    return req.params.tenantId;
  }
  
  // Priority 2: Query param
  if (req.query?.tenant_id && typeof req.query.tenant_id === 'string') {
    return req.query.tenant_id;
  }
  
  // Priority 3: TenantRequest context (from existing middleware)
  const tenantReq = req as any;
  if (tenantReq.ctx?.tenant_id) {
    return tenantReq.ctx.tenant_id;
  }
  
  // Priority 4: Session
  const session = (req as any).session;
  if (session?.current_tenant_id) {
    return session.current_tenant_id;
  }
  
  // Priority 5: Impersonation session
  if (tenantReq.impersonation?.tenant_id) {
    return tenantReq.impersonation.tenant_id;
  }
  
  return null;
}

/**
 * Type guard to check if request has auth context
 */
export function hasAuthContext(req: Request): req is AuthenticatedRequest {
  return !!(req as AuthenticatedRequest).auth;
}

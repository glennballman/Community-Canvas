/**
 * PART 3: Authorization Helper (Fail-Closed + Audit)
 * AUTH_CONSTITUTION.md governs; all auth decisions logged
 */

import { Request } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { AuthenticatedRequest, hasAuthContext } from './context';
import { 
  resolvePlatformScopeId, 
  resolveTenantScopeId, 
  resolveResourceTypeScopeId,
  resolveResourceScopeId 
} from './scope';

export class NotAuthorizedError extends Error {
  public readonly capabilityCode: string;
  public readonly scopeId: string | null;
  public readonly reason: string;
  
  constructor(capabilityCode: string, scopeId: string | null, reason: string) {
    super(`Not authorized: ${reason}`);
    this.name = 'NotAuthorizedError';
    this.capabilityCode = capabilityCode;
    this.scopeId = scopeId;
    this.reason = reason;
  }
}

export interface AuthorizeOptions {
  tenantId?: string;
  orgId?: string;
  resourceType?: string;
  resourceId?: string;
  resourceOwnerPrincipalId?: string;
  requireRls?: boolean;
  metadata?: Record<string, any>;
}

export interface AuthorizeResult {
  ok: true;
  scopeId: string;
}

/**
 * Central authorization helper - SINGLE GATE for all app-layer enforcement
 * 
 * Fail-closed behavior:
 * - Missing req.auth → deny
 * - Missing tenantId when capability is tenant-scoped → deny  
 * - Unknown capability → deny
 * - Any DB error → deny + audit reason auth_db_error
 * 
 * Always audits the decision (allow or deny)
 */
export async function authorize(
  req: Request,
  capabilityCode: string,
  options: AuthorizeOptions = {}
): Promise<AuthorizeResult> {
  const startTime = Date.now();
  const route = req.originalUrl || req.url;
  const method = req.method;
  
  // Get auth context
  if (!hasAuthContext(req)) {
    await auditDecision(req, capabilityCode, null, 'deny', 'missing_auth_context', options);
    throw new NotAuthorizedError(capabilityCode, null, 'missing_auth_context');
  }
  
  const authReq = req as AuthenticatedRequest;
  const { principalId, effectivePrincipalId, tenantId: contextTenantId } = authReq.auth;
  
  // Use provided tenantId or fall back to context
  const tenantId = options.tenantId || contextTenantId;
  
  // Fail-closed: No principal
  if (!effectivePrincipalId) {
    await auditDecision(req, capabilityCode, null, 'deny', 'no_effective_principal', options);
    throw new NotAuthorizedError(capabilityCode, null, 'no_effective_principal');
  }
  
  try {
    // Determine the appropriate scope based on capability pattern
    let scopeId: string | null = null;
    
    if (capabilityCode.startsWith('platform.')) {
      // Platform-scoped capability
      scopeId = resolvePlatformScopeId();
    } else if (options.resourceId && options.resourceType && tenantId) {
      // Resource-scoped capability
      scopeId = await resolveResourceScopeId(tenantId, options.resourceType, options.resourceId);
    } else if (options.resourceType && tenantId) {
      // Resource-type scoped capability
      scopeId = await resolveResourceTypeScopeId(tenantId, options.resourceType);
    } else if (tenantId) {
      // Tenant-scoped capability
      scopeId = await resolveTenantScopeId(tenantId);
    } else {
      // No scope can be determined for non-platform capability
      await auditDecision(req, capabilityCode, null, 'deny', 'no_scope_resolved', options);
      throw new NotAuthorizedError(capabilityCode, null, 'no_scope_resolved');
    }
    
    if (!scopeId) {
      await auditDecision(req, capabilityCode, null, 'deny', 'scope_not_found', options);
      throw new NotAuthorizedError(capabilityCode, null, 'scope_not_found');
    }
    
    // Call DB function for capability check
    const result = await serviceQuery(`
      SELECT cc_has_capability($1, $2, $3, $4, $5, $6) as allowed
    `, [
      effectivePrincipalId,
      capabilityCode,
      scopeId,
      options.resourceId || null,
      options.resourceType || null,
      options.resourceOwnerPrincipalId || null,
    ]);
    
    const allowed = result.rows[0]?.allowed === true;
    
    if (allowed) {
      await auditDecision(req, capabilityCode, scopeId, 'allow', 'capability_granted', options, Date.now() - startTime);
      return { ok: true, scopeId };
    } else {
      await auditDecision(req, capabilityCode, scopeId, 'deny', 'capability_not_granted', options, Date.now() - startTime);
      throw new NotAuthorizedError(capabilityCode, scopeId, 'capability_not_granted');
    }
    
  } catch (error) {
    if (error instanceof NotAuthorizedError) {
      throw error;
    }
    
    // DB or other error - fail closed
    console.error('[authorize] Error during authorization:', error);
    await auditDecision(req, capabilityCode, null, 'deny', 'auth_db_error', options);
    throw new NotAuthorizedError(capabilityCode, null, 'auth_db_error');
  }
}

/**
 * Check authorization without throwing - returns boolean
 */
export async function can(
  req: Request,
  capabilityCode: string,
  options: AuthorizeOptions = {}
): Promise<boolean> {
  try {
    await authorize(req, capabilityCode, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Audit decision logging - ALWAYS logs both allow and deny
 */
async function auditDecision(
  req: Request,
  capabilityCode: string,
  scopeId: string | null,
  decision: 'allow' | 'deny',
  reason: string,
  options: AuthorizeOptions,
  evaluationMs?: number
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const principalId = authReq.auth?.principalId || null;
    const effectivePrincipalId = authReq.auth?.effectivePrincipalId || null;
    const tenantId = options.tenantId || authReq.auth?.tenantId || null;
    
    await serviceQuery(`
      SELECT cc_auth_audit_log_insert(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
    `, [
      principalId,
      effectivePrincipalId,
      capabilityCode,
      scopeId,
      decision,
      reason,
      req.originalUrl || req.url,
      req.method,
      options.resourceType || null,
      options.resourceId || null,
      tenantId,
      options.orgId || null,
      req.ip || null,
      req.headers['user-agent'] || null,
      (req as any).session?.id || null,
      JSON.stringify(options.metadata || {}),
    ]);
  } catch (error) {
    // Never fail the request due to audit logging failure
    console.error('[auditDecision] Failed to log audit:', error);
  }
}

/**
 * Middleware factory for route-level gates
 */
export function requireCapability(capabilityCode: string, options: AuthorizeOptions = {}) {
  return async (req: Request, res: any, next: any) => {
    try {
      await authorize(req, capabilityCode, options);
      next();
    } catch (error) {
      if (error instanceof NotAuthorizedError) {
        return res.status(403).json({
          error: 'Forbidden',
          code: 'NOT_AUTHORIZED',
          capability: error.capabilityCode,
          reason: error.reason,
        });
      }
      next(error);
    }
  };
}

/**
 * Require platform admin capability
 */
export function requirePlatformAdmin() {
  return requireCapability('platform.admin');
}

/**
 * Require tenant admin capability
 */
export function requireTenantAdmin(tenantId?: string) {
  return requireCapability('tenant.manage', { tenantId });
}

/**
 * PROMPT-11: Resource Access Helper Options
 */
export interface ResourceAccessOptions {
  capabilityOwn: string;
  capabilityAll: string;
  resourceTable: string;
  resourceId: string;
  tenantId?: string;
}

/**
 * PROMPT-11: Check resource access with own/all pattern
 * Returns true if principal can access the resource via ownership OR all capability
 */
export async function canAccessResource(
  req: Request,
  options: ResourceAccessOptions
): Promise<boolean> {
  if (!hasAuthContext(req)) {
    return false;
  }
  
  const authReq = req as AuthenticatedRequest;
  const { effectivePrincipalId, tenantId: contextTenantId } = authReq.auth;
  const tenantId = options.tenantId || contextTenantId;
  
  if (!effectivePrincipalId || !tenantId) {
    return false;
  }
  
  try {
    const scopeId = await resolveTenantScopeId(tenantId);
    if (!scopeId) {
      return false;
    }
    
    const result = await serviceQuery(`
      SELECT cc_can_access_resource($1, $2, $3, $4, $5) as allowed
    `, [
      effectivePrincipalId,
      options.capabilityAll,
      scopeId,
      options.resourceTable,
      options.resourceId,
    ]);
    
    if (result.rows[0]?.allowed === true) {
      await auditResourceAccess(req, options.capabilityAll, scopeId, 'allow', 'all_capability', options);
      return true;
    }
    
    const ownResult = await serviceQuery(`
      SELECT cc_can_access_resource($1, $2, $3, $4, $5) as allowed
    `, [
      effectivePrincipalId,
      options.capabilityOwn,
      scopeId,
      options.resourceTable,
      options.resourceId,
    ]);
    
    if (ownResult.rows[0]?.allowed === true) {
      await auditResourceAccess(req, options.capabilityOwn, scopeId, 'allow', 'own_capability', options);
      return true;
    }
    
    await auditResourceAccess(req, options.capabilityOwn, scopeId, 'deny', 'no_access', options);
    return false;
  } catch (error) {
    console.error('[canAccessResource] Error:', error);
    return false;
  }
}

/**
 * PROMPT-11: Require resource access middleware
 */
export function requireResourceAccess(
  getOptions: (req: Request) => ResourceAccessOptions | null
) {
  return async (req: Request, res: any, next: any) => {
    const options = getOptions(req);
    
    if (!options) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'RESOURCE_NOT_SPECIFIED',
      });
    }
    
    const allowed = await canAccessResource(req, options);
    
    if (allowed) {
      next();
    } else {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'RESOURCE_ACCESS_DENIED',
        resource: options.resourceTable,
      });
    }
  };
}

/**
 * PROMPT-11: Get resource owner principal ID for a specific resource
 */
export async function getResourceOwnerPrincipalId(
  resourceTable: string,
  resourceId: string
): Promise<string | null> {
  try {
    const result = await serviceQuery(`
      SELECT created_by_principal_id FROM ${resourceTable} WHERE id = $1
    `, [resourceId]);
    return result.rows[0]?.created_by_principal_id || null;
  } catch {
    return null;
  }
}

/**
 * Audit resource access decision
 */
async function auditResourceAccess(
  req: Request,
  capabilityCode: string,
  scopeId: string | null,
  decision: 'allow' | 'deny',
  reason: string,
  options: ResourceAccessOptions
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const principalId = authReq.auth?.principalId || null;
    const effectivePrincipalId = authReq.auth?.effectivePrincipalId || null;
    
    await serviceQuery(`
      SELECT cc_auth_audit_log_insert(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
    `, [
      principalId,
      effectivePrincipalId,
      capabilityCode,
      scopeId,
      decision,
      reason,
      req.originalUrl || req.url,
      req.method,
      options.resourceTable,
      options.resourceId,
      options.tenantId || authReq.auth?.tenantId || null,
      null,
      req.ip || null,
      req.headers['user-agent'] || null,
      (req as any).session?.id || null,
      JSON.stringify({ resource_access: true }),
    ]);
  } catch (error) {
    console.error('[auditResourceAccess] Failed:', error);
  }
}

import { Request, Response, NextFunction } from 'express';
import { Session } from 'express-session';
import crypto from 'crypto';
import { pool } from '../db';
import { ActorContext } from '../db/tenantDb';

interface SessionData extends Session {
  userId?: string;
  roles?: string[];
  tenant_id?: string;
}

export interface TenantContext {
  domain: string | null;
  portal_id: string | null;
  tenant_id: string | null;
  individual_id: string | null;
  roles: string[];
  scopes: string[];
}

export interface ImpersonationSession {
  id: string;
  platform_staff_id: string;
  tenant_id: string;
  individual_id: string | null;
  reason: string;
  expires_at: Date;
  created_at: Date;
}

export interface TenantRequest extends Request {
  ctx: TenantContext;
  impersonation?: ImpersonationSession;
  actorContext?: ActorContext;
  user?: {
    id: string;
    email: string;
    userType?: string;
    isPlatformAdmin?: boolean;
  };
}

export async function tenantContext(req: TenantRequest, res: Response, next: NextFunction) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = req.headers.host || '';
  const rawHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || hostHeader;
  const domain = rawHost.split(':')[0].toLowerCase();

  req.ctx = {
    domain,
    portal_id: null,
    tenant_id: null,
    individual_id: null,
    roles: [],
    scopes: [],
  };

  try {
    const portalResult = await pool.query(`
      SELECT d.portal_id, p.owning_tenant_id
      FROM portal_domains d 
      JOIN portals p ON p.id = d.portal_id
      WHERE d.domain = $1 
        AND d.status IN ('verified', 'active') 
        AND p.status = 'active'
      LIMIT 1
    `, [domain]);

    if (portalResult.rows.length > 0) {
      const row = portalResult.rows[0];
      req.ctx.portal_id = row.portal_id;
      req.ctx.tenant_id = row.owning_tenant_id;
    }
  } catch (err) {
    console.error('[tenantContext] Portal resolution error (tables may not exist yet):', err);
  }

  // Check for impersonation_sid cookie (platform staff impersonating tenant)
  const impersonationToken = (req as any).cookies?.impersonation_sid;
  if (impersonationToken && typeof impersonationToken === 'string' && impersonationToken.length === 64) {
    try {
      const tokenHash = crypto.createHash('sha256').update(impersonationToken).digest('hex');
      const impersonationResult = await pool.query(`
        SELECT id, platform_staff_id, tenant_id, individual_id, reason, expires_at, created_at
        FROM cc_impersonation_sessions
        WHERE impersonation_token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        LIMIT 1
      `, [tokenHash]);

      if (impersonationResult.rows.length > 0) {
        const session = impersonationResult.rows[0];
        req.impersonation = {
          id: session.id,
          platform_staff_id: session.platform_staff_id,
          tenant_id: session.tenant_id,
          individual_id: session.individual_id,
          reason: session.reason,
          expires_at: session.expires_at,
          created_at: session.created_at
        };
        
        // Override tenant context with impersonated tenant
        req.ctx.tenant_id = session.tenant_id;
        req.ctx.individual_id = session.individual_id || null;
        req.ctx.roles = ['impersonator'];
        
        // Set actor context for GUC propagation
        req.actorContext = {
          tenant_id: session.tenant_id,
          portal_id: req.ctx.portal_id || undefined,
          individual_id: session.individual_id || undefined,
          platform_staff_id: session.platform_staff_id,
          impersonation_session_id: session.id,
          actor_type: 'platform'
        };
        
        console.log(`[tenantContext] Impersonation active: staff=${session.platform_staff_id} tenant=${session.tenant_id}`);
      }
    } catch (err) {
      console.error('[tenantContext] Impersonation validation error:', err);
    }
  }

  // Only set user context if NOT impersonating (impersonation takes precedence)
  if (!req.impersonation) {
    if (req.user?.id) {
      req.ctx.individual_id = req.user.id;
      
      if (req.user.isPlatformAdmin || req.user.userType === 'admin') {
        req.ctx.roles = ['admin'];
      } else if (req.user.userType) {
        req.ctx.roles = [req.user.userType];
      }
    }

    const session = (req as any).session as SessionData | undefined;
    if (session?.userId) {
      req.ctx.individual_id = String(session.userId);
      if (session.roles) {
        req.ctx.roles = session.roles;
      }
      if (session.tenant_id) {
        req.ctx.tenant_id = session.tenant_id;
      }
    }
  }

  next();
}

export function getTenantContext(req: Request): TenantContext {
  return (req as TenantRequest).ctx || {
    domain: null,
    portal_id: null,
    tenant_id: null,
    individual_id: null,
    roles: [],
    scopes: [],
  };
}

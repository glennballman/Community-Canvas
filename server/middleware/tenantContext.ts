import { Request, Response, NextFunction } from 'express';
import { Session } from 'express-session';
import { pool } from '../db';

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

export interface TenantRequest extends Request {
  ctx: TenantContext;
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

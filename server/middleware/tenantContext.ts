import { Request, Response, NextFunction } from 'express';
import { Session } from 'express-session';
import { pool } from '../db';
import { ActorContext, serviceQuery } from '../db/tenantDb';
import { hashImpersonationToken, isPepperAvailable } from '../lib/impersonationPepper';

interface SessionData extends Session {
  userId?: string;
  roles?: string[];
  tenant_id?: string;
  current_tenant_id?: string; // Set by switch-tenant endpoint
}

export interface TenantContext {
  domain: string | null;
  portal_id: string | null;
  portal_slug?: string | null;
  portal_name?: string | null;
  portal_legal_dba_name?: string | null;
  portal_type?: string | null;
  tenant_id: string | null;
  individual_id: string | null;
  roles: string[];
  scopes: string[];
  is_impersonating: boolean;
  circle_id: string | null;
  acting_as_circle: boolean;
  circle_role?: string | null;
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
  // PRESERVE: If full context already hydrated (marked by internal flag), skip to avoid re-runs
  // Note: We use a private flag instead of checking portal_id to ensure impersonation/session always runs
  if ((req as any).__tenantContextHydrated) {
    return next();
  }
  (req as any).__tenantContextHydrated = true;
  
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
    is_impersonating: false,
    circle_id: null,
    acting_as_circle: false,
    circle_role: null,
  };

  try {
    // Priority 1: Domain-based portal resolution
    // NOTE: Use serviceQuery to bypass RLS since tenant context isn't established yet
    const portalResult = await serviceQuery(`
      SELECT d.portal_id, p.owning_tenant_id, p.slug, p.name, p.legal_dba_name, p.portal_type
      FROM cc_portal_domains d 
      JOIN cc_portals p ON p.id = d.portal_id
      WHERE d.domain = $1 
        AND d.status IN ('verified', 'active') 
        AND p.status = 'active'
      LIMIT 1
    `, [domain]);

    if (portalResult.rows.length > 0) {
      const row = portalResult.rows[0];
      req.ctx.portal_id = row.portal_id;
      req.ctx.tenant_id = row.owning_tenant_id;
      req.ctx.portal_slug = row.slug;
      req.ctx.portal_name = row.name;
      req.ctx.portal_legal_dba_name = row.legal_dba_name;
      req.ctx.portal_type = row.portal_type;
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[tenantContext] Domain resolved: ${domain} -> portal=${row.slug} tenant=${row.owning_tenant_id}`);
      }
    } else {
      // Priority 2: /b/:slug path prefix for dev (fallback when domain not found)
      const pathMatch = req.path.match(/^\/b\/([^\/]+)/);
      if (pathMatch) {
        const slug = pathMatch[1];
        // NOTE: Use serviceQuery to bypass RLS since tenant context isn't established yet
        const slugResult = await serviceQuery(`
          SELECT id as portal_id, owning_tenant_id, slug, name, legal_dba_name, portal_type
          FROM cc_portals 
          WHERE slug = $1 AND status = 'active'
          LIMIT 1
        `, [slug]);
        
        if (slugResult.rows.length > 0) {
          const row = slugResult.rows[0];
          req.ctx.portal_id = row.portal_id;
          req.ctx.tenant_id = row.owning_tenant_id;
          req.ctx.portal_slug = row.slug;
          req.ctx.portal_name = row.name;
          req.ctx.portal_legal_dba_name = row.legal_dba_name;
          req.ctx.portal_type = row.portal_type;
          
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[tenantContext] Slug resolved: /b/${slug} -> portal=${row.slug} tenant=${row.owning_tenant_id}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[tenantContext] Portal resolution error (tables may not exist yet):', err);
  }

  // Check for impersonation_sid cookie (platform staff impersonating tenant)
  const impersonationToken = (req as any).cookies?.impersonation_sid;
  
  // DEBUG: Log cookie detection for schedule routes
  if (process.env.NODE_ENV !== 'production' && req.url?.includes('/schedule')) {
    console.log('TENANT_CONTEXT_DEBUG', JSON.stringify({
      url: req.url,
      hasCookie: !!impersonationToken,
      cookieLength: impersonationToken?.length || 0,
      pepperAvailable: isPepperAvailable(),
    }));
  }
  
  if (impersonationToken && typeof impersonationToken === 'string' && impersonationToken.length === 64) {
    // Fail closed: if pepper is not available, skip impersonation validation entirely
    if (!isPepperAvailable()) {
      console.warn('[tenantContext] Impersonation cookie present but pepper unavailable - ignoring');
    } else {
      try {
        const tokenHash = hashImpersonationToken(impersonationToken);
        
        // If hashing fails (pepper cleared mid-request), skip impersonation
        if (!tokenHash) {
          console.warn('[tenantContext] Token hashing failed - ignoring impersonation cookie');
        } else {
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
            req.ctx.is_impersonating = true;
            
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
        }
      } catch (err) {
        console.error('[tenantContext] Impersonation validation error:', err);
      }
    }
  }

  // FALLBACK: Check session.impersonation if cookie-based impersonation not found
  // This unifies the two impersonation approaches (session vs cookie)
  if (!req.impersonation) {
    const session = (req as any).session;
    const sessionImpersonation = session?.impersonation;
    
    if (sessionImpersonation?.tenant_id && sessionImpersonation?.expires_at) {
      // Check if session impersonation is still valid
      if (new Date(sessionImpersonation.expires_at) > new Date()) {
        // Synthesize req.impersonation from session data
        req.impersonation = {
          id: 'session-impersonation', // Virtual ID for session-based impersonation
          platform_staff_id: sessionImpersonation.admin_user_id || session?.userId || '',
          tenant_id: sessionImpersonation.tenant_id,
          individual_id: null,
          reason: sessionImpersonation.reason || 'Admin access',
          expires_at: new Date(sessionImpersonation.expires_at),
          created_at: new Date(sessionImpersonation.started_at || Date.now()),
        };
        
        // Override tenant context with impersonated tenant
        req.ctx.tenant_id = sessionImpersonation.tenant_id;
        req.ctx.roles = ['impersonator'];
        req.ctx.is_impersonating = true;
        
        // Set actor context for GUC propagation
        req.actorContext = {
          tenant_id: sessionImpersonation.tenant_id,
          portal_id: req.ctx.portal_id || undefined,
          individual_id: undefined,
          platform_staff_id: sessionImpersonation.admin_user_id || session?.userId,
          impersonation_session_id: 'session-impersonation',
          actor_type: 'platform'
        };
        
        if (process.env.NODE_ENV !== 'production' && req.url?.includes('/schedule')) {
          console.log('[tenantContext] Session-based impersonation active:', sessionImpersonation.tenant_id);
        }
      }
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
      // Check both current_tenant_id (from switch-tenant) and legacy tenant_id
      const sessionTenantId = session.current_tenant_id || session.tenant_id;
      if (sessionTenantId) {
        req.ctx.tenant_id = sessionTenantId;
      }
      
      // Circle context from session (set by switch-circle endpoint)
      const sessionCircleId = (session as any).current_circle_id || (session as any).circle_id;
      if (sessionCircleId && typeof sessionCircleId === 'string' && sessionCircleId.match(/^[0-9a-f-]{36}$/i)) {
        req.ctx.circle_id = sessionCircleId;
        req.ctx.acting_as_circle = true;
      }
    }
    
    // Also check for current_tenant_id even if userId not in session (JWT auth case)
    if (!req.ctx.tenant_id && session?.current_tenant_id) {
      req.ctx.tenant_id = session.current_tenant_id;
    }
    
    // Development/Test mode: Allow X-Tenant-Id header to set tenant context
    // This enables automated testing without full auth flow
    if (!req.ctx.tenant_id && process.env.NODE_ENV !== 'production') {
      const headerTenantId = req.headers['x-tenant-id'];
      if (typeof headerTenantId === 'string' && headerTenantId.match(/^[0-9a-f-]{36}$/i)) {
        req.ctx.tenant_id = headerTenantId;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[tenantContext] Dev mode: X-Tenant-Id header used: ${headerTenantId}`);
        }
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
    is_impersonating: false,
    circle_id: null,
    acting_as_circle: false,
    circle_role: null,
  };
}

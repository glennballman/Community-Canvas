import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { JWT_SECRET } from '../middleware/auth';

const router = Router();

interface JWTPayload {
  userId: string;
  email: string;
  isPlatformAdmin?: boolean;
  activeTenantId?: string;
}

interface AuthRequest extends Request {
  user?: { id: string; tenantId?: string; individualId?: string };
  ctx?: { tenant_id: string | null; individual_id?: string | null };
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const session = (req as any).session;

  if (session?.userId) {
    req.user = req.user ?? { id: session.userId };
    req.user.id = req.user.id ?? session.userId;
    const sessionTenantId = session.current_tenant_id || session.tenant_id;
    if (sessionTenantId && !req.user.tenantId) {
      req.user.tenantId = sessionTenantId;
    }
    return next();
  }

  if (req.user?.id) {
    if (!req.user.tenantId) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
          req.user.tenantId = decoded.activeTenantId;
        } catch (e) {
        }
      }
    }
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      id: decoded.userId,
      tenantId: decoded.activeTenantId
    };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
  }
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * GET /api/runs/:id/view
 * Authenticated stakeholder view of a service run
 * STEP 11C Phase 2B-2.1
 * 
 * Authorization:
 * - Stakeholder with active row in cc_service_run_stakeholders
 * - OR tenant member who owns the run
 */
router.get('/:id/view', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: runId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;
    
    if (!runId || !isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    // Resolve individual_id from user_id
    let individualId: string | null = null;
    const userResult = await pool.query(
      `SELECT i.id FROM cc_users u JOIN cc_individuals i ON lower(u.email) = lower(i.email) WHERE u.id = $1`,
      [userId]
    );
    if (userResult.rows.length > 0) {
      individualId = userResult.rows[0].id;
    }

    // Check stakeholder access first
    let hasStakeholderAccess = false;
    let stakeholderRole: string | null = null;
    let grantedAt: Date | null = null;

    if (individualId) {
      const stakeResult = await pool.query(
        `SELECT stakeholder_role, granted_at
         FROM cc_service_run_stakeholders
         WHERE run_id = $1 
           AND stakeholder_individual_id = $2
           AND status = 'active'`,
        [runId, individualId]
      );
      
      if (stakeResult.rows.length > 0) {
        hasStakeholderAccess = true;
        stakeholderRole = stakeResult.rows[0].stakeholder_role;
        grantedAt = stakeResult.rows[0].granted_at;
      }
    }

    // Check tenant ownership (provider compatibility)
    let isTenantOwner = false;
    if (tenantId) {
      const tenantCheck = await pool.query(
        `SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
        [runId, tenantId]
      );
      isTenantOwner = tenantCheck.rows.length > 0;
    }

    if (!hasStakeholderAccess && !isTenantOwner) {
      return res.status(403).json({ 
        ok: false, 
        error: 'error.run.access_denied',
        message: 'You do not have access to this run'
      });
    }

    // Fetch run details (stakeholder-safe view)
    const runResult = await pool.query(
      `SELECT 
        r.id,
        r.name,
        r.market_mode,
        r.scheduled_date,
        r.scheduled_time,
        r.scheduled_end_time,
        r.run_date,
        r.publishing_state,
        r.status,
        r.tenant_id,
        z.name AS zone_name,
        z.label AS zone_label,
        t.display_name AS tenant_name
       FROM cc_n3_runs r
       LEFT JOIN cc_zones z ON r.zone_id = z.id
       LEFT JOIN cc_tenants t ON r.tenant_id = t.id
       WHERE r.id = $1`,
      [runId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    const run = runResult.rows[0];

    // Build stakeholder-safe response
    const response = {
      ok: true,
      run: {
        id: run.id,
        name: run.name,
        market_mode: run.market_mode,
        scheduled_date: run.scheduled_date,
        scheduled_time: run.scheduled_time,
        scheduled_end_time: run.scheduled_end_time,
        run_date: run.run_date,
        status: run.status,
        publishing_state: run.publishing_state,
        zone_name: run.zone_name || run.zone_label,
        tenant_name: run.tenant_name
      },
      access: {
        type: hasStakeholderAccess ? 'stakeholder' : 'tenant_owner',
        stakeholder_role: stakeholderRole,
        granted_at: grantedAt
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Stakeholder run view error:', error);
    res.status(500).json({ ok: false, error: 'error.run.view_failed' });
  }
});

export default router;

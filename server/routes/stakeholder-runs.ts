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

    // Fetch latest response by this stakeholder (if stakeholder access)
    let latestResponse = null;
    if (individualId) {
      const respResult = await pool.query(
        `SELECT id, response_type, message, responded_at
         FROM cc_service_run_stakeholder_responses
         WHERE run_id = $1 AND stakeholder_individual_id = $2
         ORDER BY responded_at DESC
         LIMIT 1`,
        [runId, individualId]
      );
      if (respResult.rows.length > 0) {
        latestResponse = respResult.rows[0];
      }
    }

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
        granted_at: grantedAt,
        latest_response: latestResponse
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Stakeholder run view error:', error);
    res.status(500).json({ ok: false, error: 'error.run.view_failed' });
  }
});

/**
 * Reusable helper to resolve individualId and check run access
 */
async function resolveAccessContext(
  userId: string,
  tenantId: string | null | undefined,
  runId: string
): Promise<{
  individualId: string | null;
  hasStakeholderAccess: boolean;
  isTenantOwner: boolean;
  runTenantId: string | null;
  runName: string | null;
}> {
  let individualId: string | null = null;
  const userResult = await pool.query(
    `SELECT i.id FROM cc_users u JOIN cc_individuals i ON lower(u.email) = lower(i.email) WHERE u.id = $1`,
    [userId]
  );
  if (userResult.rows.length > 0) {
    individualId = userResult.rows[0].id;
  }

  let hasStakeholderAccess = false;
  if (individualId) {
    const stakeResult = await pool.query(
      `SELECT 1 FROM cc_service_run_stakeholders
       WHERE run_id = $1 AND stakeholder_individual_id = $2 AND status = 'active'`,
      [runId, individualId]
    );
    hasStakeholderAccess = stakeResult.rows.length > 0;
  }

  let isTenantOwner = false;
  let runTenantId: string | null = null;
  let runName: string | null = null;

  const runResult = await pool.query(
    `SELECT tenant_id, name FROM cc_n3_runs WHERE id = $1`,
    [runId]
  );
  if (runResult.rows.length > 0) {
    runTenantId = runResult.rows[0].tenant_id;
    runName = runResult.rows[0].name;
    if (tenantId && runTenantId === tenantId) {
      isTenantOwner = true;
    }
  }

  return { individualId, hasStakeholderAccess, isTenantOwner, runTenantId, runName };
}

const VALID_RESPONSE_TYPES = ['confirm', 'request_change', 'question'] as const;

/**
 * POST /api/runs/:id/respond
 * Submit a stakeholder response (confirm / request_change / question)
 * STEP 11C Phase 2C-1
 */
router.post('/:id/respond', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: runId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!runId || !isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    // Validate request body
    const { response_type, message } = req.body;
    if (!response_type || !VALID_RESPONSE_TYPES.includes(response_type)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.response.invalid_type',
        message: 'response_type must be one of: confirm, request_change, question'
      });
    }

    const trimmedMessage = message?.trim()?.slice(0, 2000) || null;

    // Resolve access context
    const ctx = await resolveAccessContext(userId, tenantId, runId);

    if (!ctx.individualId) {
      return res.status(403).json({ ok: false, error: 'error.auth.no_individual' });
    }

    if (!ctx.hasStakeholderAccess && !ctx.isTenantOwner) {
      return res.status(403).json({ 
        ok: false, 
        error: 'error.run.access_denied',
        message: 'You do not have access to this run'
      });
    }

    if (!ctx.runTenantId) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    // Idempotency check: same response within 60 seconds
    const latestResult = await pool.query(
      `SELECT id, response_type, message, responded_at
       FROM cc_service_run_stakeholder_responses
       WHERE run_id = $1 AND stakeholder_individual_id = $2
       ORDER BY responded_at DESC
       LIMIT 1`,
      [runId, ctx.individualId]
    );

    if (latestResult.rows.length > 0) {
      const latest = latestResult.rows[0];
      const latestMsg = latest.message || '';
      const newMsg = trimmedMessage || '';
      const latestAt = new Date(latest.responded_at).getTime();
      const now = Date.now();
      const withinWindow = (now - latestAt) < 60000;

      if (latest.response_type === response_type && latestMsg === newMsg && withinWindow) {
        return res.json({
          ok: true,
          response: {
            id: latest.id,
            run_id: runId,
            stakeholder_individual_id: ctx.individualId,
            response_type: latest.response_type,
            message: latest.message,
            responded_at: latest.responded_at
          },
          idempotent: true
        });
      }
    }

    // Insert new response
    const insertResult = await pool.query(
      `INSERT INTO cc_service_run_stakeholder_responses 
        (run_id, run_tenant_id, stakeholder_individual_id, response_type, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, response_type, message, responded_at`,
      [runId, ctx.runTenantId, ctx.individualId, response_type, trimmedMessage]
    );

    const newResponse = insertResult.rows[0];

    // Notify run-owning tenant
    const runDisplayName = ctx.runName || 'Service Run';
    try {
      await pool.query(
        `INSERT INTO cc_notifications (
          recipient_tenant_id,
          category,
          priority,
          channels,
          context_type,
          context_id,
          body,
          short_body,
          action_url,
          status
        ) VALUES ($1, 'alert', 'normal', ARRAY['in_app'], 'service_run', $2, $3, $4, $5, 'pending')`,
        [
          ctx.runTenantId,
          runId,
          `A stakeholder responded on "${runDisplayName}".`,
          'New stakeholder response',
          `/app/provider/runs/${runId}`
        ]
      );
    } catch (notifyErr) {
      console.error('Failed to create notification:', notifyErr);
    }

    res.json({
      ok: true,
      response: {
        id: newResponse.id,
        run_id: runId,
        stakeholder_individual_id: ctx.individualId,
        response_type: newResponse.response_type,
        message: newResponse.message,
        responded_at: newResponse.responded_at
      }
    });
  } catch (error: any) {
    console.error('Stakeholder respond error:', error);
    res.status(500).json({ ok: false, error: 'error.response.failed' });
  }
});

/**
 * GET /api/runs/:id/responses
 * List stakeholder responses for a run
 * STEP 11C Phase 2C-1
 * 
 * Stakeholders see only their own responses (RLS enforced)
 * Tenant owners see all responses (tenant_select policy)
 */
router.get('/:id/responses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: runId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!runId || !isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    // Resolve access context
    const ctx = await resolveAccessContext(userId, tenantId, runId);

    if (!ctx.hasStakeholderAccess && !ctx.isTenantOwner) {
      return res.status(403).json({ 
        ok: false, 
        error: 'error.run.access_denied',
        message: 'You do not have access to this run'
      });
    }

    // For stakeholders, they only see their own responses (via RLS)
    // For tenant owners, they see all responses for the run
    let responses;
    if (ctx.isTenantOwner) {
      // Tenant owner: see all responses
      const result = await pool.query(
        `SELECT 
          r.id, r.response_type, r.message, r.responded_at,
          r.stakeholder_individual_id,
          i.name as stakeholder_name,
          i.email as stakeholder_email
         FROM cc_service_run_stakeholder_responses r
         LEFT JOIN cc_individuals i ON r.stakeholder_individual_id = i.id
         WHERE r.run_id = $1
         ORDER BY r.responded_at DESC
         LIMIT 50`,
        [runId]
      );
      responses = result.rows;
    } else {
      // Stakeholder: only their own
      const result = await pool.query(
        `SELECT id, response_type, message, responded_at, stakeholder_individual_id
         FROM cc_service_run_stakeholder_responses
         WHERE run_id = $1 AND stakeholder_individual_id = $2
         ORDER BY responded_at DESC
         LIMIT 50`,
        [runId, ctx.individualId]
      );
      responses = result.rows;
    }

    res.json({ ok: true, responses });
  } catch (error: any) {
    console.error('Stakeholder responses list error:', error);
    res.status(500).json({ ok: false, error: 'error.responses.list_failed' });
  }
});

export default router;

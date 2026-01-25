import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { JWT_SECRET } from '../middleware/auth';
import { loadNegotiationPolicy, validatePolicyEnforcement } from '../lib/negotiation-policy';

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

/**
 * POST /api/runs/:runId/responses/:responseId/resolve
 * Create a resolution for a stakeholder response
 * STEP 11C Phase 2C-2
 * 
 * Auth: requireAuth
 * Authorization: Tenant owner only
 */
router.post('/:runId/responses/:responseId/resolve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { runId, responseId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!runId || !isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }
    if (!responseId || !isValidUUID(responseId)) {
      return res.status(400).json({ ok: false, error: 'error.response.invalid_id' });
    }

    const { resolution_type, message } = req.body;

    const validResolutionTypes = ['acknowledged', 'accepted', 'declined', 'proposed_change'];
    if (!resolution_type || !validResolutionTypes.includes(resolution_type)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.resolution.invalid_type',
        message: `resolution_type must be one of: ${validResolutionTypes.join(', ')}`
      });
    }

    // Resolve individual_id from user_id
    const userResult = await pool.query(
      `SELECT i.id FROM cc_users u JOIN cc_individuals i ON lower(u.email) = lower(i.email) WHERE u.id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(403).json({ ok: false, error: 'error.user.no_individual' });
    }
    const resolverIndividualId = userResult.rows[0].id;

    // Verify tenant owns the run
    const runCheck = await pool.query(
      `SELECT id, tenant_id, name FROM cc_n3_runs WHERE id = $1`,
      [runId]
    );
    if (runCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }
    const run = runCheck.rows[0];
    if (!tenantId || run.tenant_id !== tenantId) {
      return res.status(403).json({ ok: false, error: 'error.run.access_denied' });
    }

    // Verify response exists and belongs to run
    const responseCheck = await pool.query(
      `SELECT id, stakeholder_individual_id FROM cc_service_run_stakeholder_responses WHERE id = $1 AND run_id = $2`,
      [responseId, runId]
    );
    if (responseCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.response.not_found' });
    }
    const response = responseCheck.rows[0];

    // Insert resolution (append-only)
    const trimmedMessage = message?.trim() || null;
    const insertResult = await pool.query(
      `INSERT INTO cc_service_run_response_resolutions 
        (response_id, run_id, run_tenant_id, resolver_individual_id, resolution_type, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, resolution_type, message, resolved_at`,
      [responseId, runId, tenantId, resolverIndividualId, resolution_type, trimmedMessage]
    );

    const newResolution = insertResult.rows[0];

    // Notify stakeholder
    const runDisplayName = run.name || 'Service Run';
    try {
      await pool.query(
        `INSERT INTO cc_notifications (
          recipient_individual_id,
          category,
          priority,
          channels,
          context_type,
          context_id,
          body,
          short_body,
          action_url,
          status
        ) VALUES ($1, 'invitation', 'normal', ARRAY['in_app'], 'service_run', $2, $3, $4, $5, 'pending')`,
        [
          response.stakeholder_individual_id,
          runId,
          `Your response to "${runDisplayName}" has been ${resolution_type.replace('_', ' ')}.`,
          `Response ${resolution_type.replace('_', ' ')}`,
          `/app/runs/${runId}/view`
        ]
      );
    } catch (notifyErr) {
      console.error('Failed to create resolution notification:', notifyErr);
    }

    res.json({
      ok: true,
      resolution: {
        id: newResolution.id,
        response_id: responseId,
        run_id: runId,
        resolver_individual_id: resolverIndividualId,
        resolution_type: newResolution.resolution_type,
        message: newResolution.message,
        resolved_at: newResolution.resolved_at
      }
    });
  } catch (error: any) {
    console.error('Resolution create error:', error);
    // Handle unique constraint violation (idempotency)
    if (error.code === '23505') {
      return res.status(409).json({ 
        ok: false, 
        error: 'error.resolution.duplicate',
        message: 'A similar resolution was just created. Please wait before trying again.'
      });
    }
    res.status(500).json({ ok: false, error: 'error.resolution.failed' });
  }
});

/**
 * GET /api/runs/:runId/resolutions
 * List resolution history for a run
 * STEP 11C Phase 2C-2
 * 
 * Tenant: all resolutions
 * Stakeholder: only resolutions related to their responses
 */
router.get('/:runId/resolutions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { runId } = req.params;
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

    let resolutions;
    if (ctx.isTenantOwner) {
      // Tenant owner: see all resolutions
      const result = await pool.query(
        `SELECT 
          rr.id, rr.response_id, rr.resolution_type, rr.message, rr.resolved_at,
          rr.resolver_individual_id,
          i.name as resolver_name,
          resp.response_type as original_response_type
         FROM cc_service_run_response_resolutions rr
         LEFT JOIN cc_individuals i ON rr.resolver_individual_id = i.id
         LEFT JOIN cc_service_run_stakeholder_responses resp ON rr.response_id = resp.id
         WHERE rr.run_id = $1
         ORDER BY rr.resolved_at DESC
         LIMIT 50`,
        [runId]
      );
      resolutions = result.rows;
    } else {
      // Stakeholder: only resolutions for their own responses
      const result = await pool.query(
        `SELECT 
          rr.id, rr.response_id, rr.resolution_type, rr.message, rr.resolved_at,
          i.name as resolver_name,
          resp.response_type as original_response_type
         FROM cc_service_run_response_resolutions rr
         LEFT JOIN cc_individuals i ON rr.resolver_individual_id = i.id
         LEFT JOIN cc_service_run_stakeholder_responses resp ON rr.response_id = resp.id
         WHERE rr.run_id = $1 AND resp.stakeholder_individual_id = $2
         ORDER BY rr.resolved_at DESC
         LIMIT 50`,
        [runId, ctx.individualId]
      );
      resolutions = result.rows;
    }

    res.json({ ok: true, resolutions });
  } catch (error: any) {
    console.error('Resolutions list error:', error);
    res.status(500).json({ ok: false, error: 'error.resolutions.list_failed' });
  }
});

// ============================================================
// STEP 11C Phase 2C-3: Schedule Proposals
// Deterministic negotiation primitive for service run schedule changes
// ============================================================

const VALID_PROPOSAL_EVENT_TYPES = ['proposed', 'countered', 'accepted', 'declined'] as const;

/**
 * GET /api/runs/:id/schedule-proposals
 * List schedule proposal events for a run with derived latest state
 * STEP 11C Phase 2C-3
 */
router.get('/:id/schedule-proposals', requireAuth, async (req: AuthRequest, res: Response) => {
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

    // Get run tenant_id for policy lookup
    const runCheckResult = await pool.query(
      `SELECT tenant_id FROM cc_n3_runs WHERE id = $1`,
      [runId]
    );
    if (runCheckResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }
    const runTenantId = runCheckResult.rows[0].tenant_id;

    // Load negotiation policy
    const policy = await loadNegotiationPolicy(runTenantId, 'schedule');

    // Fetch all events for this run
    const eventsResult = await pool.query(
      `SELECT 
        sp.id, sp.run_id, sp.actor_individual_id, sp.actor_role,
        sp.response_id, sp.resolution_id, sp.event_type,
        sp.proposed_start, sp.proposed_end, sp.note, sp.metadata, sp.created_at,
        i.name as actor_name
       FROM cc_service_run_schedule_proposals sp
       LEFT JOIN cc_individuals i ON sp.actor_individual_id = i.id
       WHERE sp.run_id = $1
       ORDER BY sp.created_at DESC
       LIMIT 50`,
      [runId]
    );
    // Map events to include proposal_context from metadata
    const events = eventsResult.rows.map((e: any) => ({
      ...e,
      proposal_context: e.metadata?.proposal_context ?? null,
      metadata: undefined // Don't expose full metadata
    }));

    // Derive latest state
    const turnsUsed = events.filter((e: any) => 
      e.event_type === 'proposed' || e.event_type === 'countered'
    ).length;
    const turnsRemaining = Math.max(0, policy.maxTurns - turnsUsed);
    
    const latestEvent = events[0] || null;
    const isClosed = latestEvent && (
      (latestEvent.event_type === 'accepted' && policy.closeOnAccept) ||
      (latestEvent.event_type === 'declined' && policy.closeOnDecline)
    );

    res.json({
      ok: true,
      turn_cap: policy.maxTurns,
      turns_used: turnsUsed,
      turns_remaining: turnsRemaining,
      is_closed: isClosed,
      policy: {
        allow_counter: policy.allowCounter,
        provider_can_initiate: policy.providerCanInitiate,
        stakeholder_can_initiate: policy.stakeholderCanInitiate,
        allow_proposal_context: policy.allowProposalContext
      },
      latest: latestEvent ? {
        id: latestEvent.id,
        event_type: latestEvent.event_type,
        proposed_start: latestEvent.proposed_start,
        proposed_end: latestEvent.proposed_end,
        note: latestEvent.note,
        proposal_context: latestEvent.proposal_context,
        created_at: latestEvent.created_at,
        actor_role: latestEvent.actor_role,
        actor_name: latestEvent.actor_name
      } : null,
      events
    });
  } catch (error: any) {
    console.error('Schedule proposals list error:', error);
    res.status(500).json({ ok: false, error: 'error.schedule_proposals.list_failed' });
  }
});

/**
 * POST /api/runs/:id/schedule-proposals
 * Create a new schedule proposal event
 * STEP 11C Phase 2C-3
 */
router.post('/:id/schedule-proposals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: runId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!runId || !isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    const { event_type, proposed_start, proposed_end, note, response_id, resolution_id, proposal_context } = req.body;

    // Validate event_type
    if (!event_type || !VALID_PROPOSAL_EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'error.schedule_proposal.invalid_event_type',
        message: `event_type must be one of: ${VALID_PROPOSAL_EVENT_TYPES.join(', ')}`
      });
    }

    // Validate window requirements
    if ((event_type === 'proposed' || event_type === 'countered')) {
      if (!proposed_start || !proposed_end) {
        return res.status(400).json({ 
          ok: false, 
          error: 'error.schedule_proposal.window_required',
          message: 'proposed_start and proposed_end are required for proposed/countered events'
        });
      }
      const start = new Date(proposed_start);
      const end = new Date(proposed_end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ 
          ok: false, 
          error: 'error.schedule_proposal.invalid_dates',
          message: 'proposed_start and proposed_end must be valid dates'
        });
      }
      if (end <= start) {
        return res.status(400).json({ 
          ok: false, 
          error: 'error.schedule_proposal.invalid_window',
          message: 'proposed_end must be after proposed_start'
        });
      }
    } else if (event_type === 'accepted' || event_type === 'declined') {
      if (proposed_start || proposed_end) {
        return res.status(400).json({ 
          ok: false, 
          error: 'error.schedule_proposal.no_window_for_decision',
          message: 'accepted/declined events must not include proposed_start/proposed_end'
        });
      }
    }

    // Validate proposal_context if provided (Phase 2C-4)
    const ALLOWED_CONTEXT_KEYS = ['quote_draft_id', 'estimate_id', 'bid_id', 'trip_id', 'selected_scope_option'];
    const UUID_CONTEXT_KEYS = ['quote_draft_id', 'estimate_id', 'bid_id', 'trip_id'];
    let validatedProposalContext: Record<string, string> | null = null;
    
    if (proposal_context && typeof proposal_context === 'object') {
      const contextKeys = Object.keys(proposal_context);
      const unknownKeys = contextKeys.filter(k => !ALLOWED_CONTEXT_KEYS.includes(k));
      
      if (unknownKeys.length > 0) {
        return res.status(400).json({
          ok: false,
          error: 'error.request.invalid_proposal_context',
          message: `Unknown proposal_context keys: ${unknownKeys.join(', ')}`
        });
      }
      
      // Validate UUID fields
      for (const key of UUID_CONTEXT_KEYS) {
        if (proposal_context[key]) {
          if (typeof proposal_context[key] !== 'string' || !isValidUUID(proposal_context[key])) {
            return res.status(400).json({
              ok: false,
              error: 'error.request.invalid_proposal_context',
              message: `${key} must be a valid UUID`
            });
          }
        }
      }
      
      // Validate selected_scope_option length
      if (proposal_context.selected_scope_option) {
        if (typeof proposal_context.selected_scope_option !== 'string') {
          return res.status(400).json({
            ok: false,
            error: 'error.request.invalid_proposal_context',
            message: 'selected_scope_option must be a string'
          });
        }
        if (proposal_context.selected_scope_option.length > 64) {
          return res.status(400).json({
            ok: false,
            error: 'error.request.invalid_proposal_context',
            message: 'selected_scope_option must be 64 characters or less'
          });
        }
      }
      
      // Build validated context (only non-empty values)
      validatedProposalContext = {};
      for (const key of ALLOWED_CONTEXT_KEYS) {
        if (proposal_context[key]) {
          validatedProposalContext[key] = proposal_context[key];
        }
      }
      if (Object.keys(validatedProposalContext).length === 0) {
        validatedProposalContext = null;
      }
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

    // Get actor individual_id
    const userResult = await pool.query(
      `SELECT i.id FROM cc_users u JOIN cc_individuals i ON lower(u.email) = lower(i.email) WHERE u.id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(403).json({ ok: false, error: 'error.user.no_individual' });
    }
    const actorIndividualId = userResult.rows[0].id;

    // Determine actor role
    const actorRole = ctx.isTenantOwner ? 'tenant' : 'stakeholder';

    // Get run tenant_id
    const runResult = await pool.query(
      `SELECT tenant_id, name FROM cc_n3_runs WHERE id = $1`,
      [runId]
    );
    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }
    const runTenantId = runResult.rows[0].tenant_id;
    const runName = runResult.rows[0].name || 'Service Run';

    // Load negotiation policy
    const policy = await loadNegotiationPolicy(runTenantId, 'schedule');

    // Check existing events for turn cap and closed state
    const existingResult = await pool.query(
      `SELECT event_type, created_at
       FROM cc_service_run_schedule_proposals
       WHERE run_id = $1
       ORDER BY created_at DESC`,
      [runId]
    );
    const existingEvents = existingResult.rows;

    // Derive current negotiation state
    const latestEvent = existingEvents[0];
    const isClosed = latestEvent && (
      (latestEvent.event_type === 'accepted' && policy.closeOnAccept) ||
      (latestEvent.event_type === 'declined' && policy.closeOnDecline)
    );
    const turnsUsed = existingEvents.filter((e: any) => 
      e.event_type === 'proposed' || e.event_type === 'countered'
    ).length;

    // Validate against policy
    const validation = validatePolicyEnforcement(
      policy,
      actorRole as 'tenant' | 'stakeholder',
      event_type as 'proposed' | 'countered' | 'accepted' | 'declined',
      turnsUsed,
      isClosed
    );

    if (!validation.valid) {
      return res.status(409).json({ 
        ok: false, 
        error: validation.error,
        message: validation.error === 'error.negotiation.turn_limit_reached' 
          ? `Maximum of ${policy.maxTurns} change proposals reached`
          : validation.error === 'error.negotiation.closed'
          ? 'This negotiation is already closed'
          : validation.error === 'error.negotiation.counter_not_allowed'
          ? 'Counter proposals are not allowed for this negotiation'
          : validation.error === 'error.negotiation.provider_cannot_initiate'
          ? 'Provider cannot initiate this type of negotiation'
          : validation.error === 'error.negotiation.stakeholder_cannot_initiate'
          ? 'Stakeholder cannot initiate this type of negotiation'
          : 'Policy validation failed'
      });
    }

    // Check proposal_context policy (Phase 2C-4)
    if (validatedProposalContext && !policy.allowProposalContext) {
      return res.status(403).json({
        ok: false,
        error: 'error.negotiation.proposal_context_not_allowed',
        message: 'Proposal context attachments are not allowed for this tenant'
      });
    }

    // Build metadata object
    const metadata: Record<string, any> = {};
    if (validatedProposalContext) {
      metadata.proposal_context = validatedProposalContext;
    }

    // Insert the event
    const trimmedNote = note?.trim()?.slice(0, 2000) || null;
    const insertResult = await pool.query(
      `INSERT INTO cc_service_run_schedule_proposals 
        (run_id, run_tenant_id, actor_individual_id, actor_role, 
         response_id, resolution_id, event_type, proposed_start, proposed_end, note, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, event_type, proposed_start, proposed_end, note, metadata, created_at`,
      [
        runId,
        runTenantId,
        actorIndividualId,
        actorRole,
        response_id && isValidUUID(response_id) ? response_id : null,
        resolution_id && isValidUUID(resolution_id) ? resolution_id : null,
        event_type,
        (event_type === 'proposed' || event_type === 'countered') ? new Date(proposed_start) : null,
        (event_type === 'proposed' || event_type === 'countered') ? new Date(proposed_end) : null,
        trimmedNote,
        JSON.stringify(metadata)
      ]
    );

    const newEvent = insertResult.rows[0];

    // Send notifications
    try {
      if (actorRole === 'tenant') {
        // Notify stakeholders who have responded
        const stakeholdersResult = await pool.query(
          `SELECT DISTINCT stakeholder_individual_id
           FROM cc_service_run_stakeholder_responses
           WHERE run_id = $1`,
          [runId]
        );
        for (const row of stakeholdersResult.rows) {
          await pool.query(
            `INSERT INTO cc_notifications (
              recipient_individual_id,
              category,
              priority,
              channels,
              context_type,
              context_id,
              body,
              short_body,
              action_url,
              status
            ) VALUES ($1, 'invitation', 'normal', ARRAY['in_app'], 'service_run', $2, $3, $4, $5, 'pending')`,
            [
              row.stakeholder_individual_id,
              runId,
              `Schedule ${event_type} for "${runName}"`,
              `Schedule ${event_type}`,
              `/app/runs/${runId}/view`
            ]
          );
        }
      } else {
        // Stakeholder action - notify tenant
        // Find tenant owner individual_id (simplified - notify first individual linked to tenant)
        const tenantMembersResult = await pool.query(
          `SELECT pm.individual_id
           FROM cc_portal_memberships pm
           JOIN cc_portals p ON pm.portal_id = p.id
           WHERE p.tenant_id = $1
           LIMIT 1`,
          [runTenantId]
        );
        for (const row of tenantMembersResult.rows) {
          await pool.query(
            `INSERT INTO cc_notifications (
              recipient_individual_id,
              category,
              priority,
              channels,
              context_type,
              context_id,
              body,
              short_body,
              action_url,
              status
            ) VALUES ($1, 'invitation', 'normal', ARRAY['in_app'], 'service_run', $2, $3, $4, $5, 'pending')`,
            [
              row.individual_id,
              runId,
              `Stakeholder ${event_type} schedule for "${runName}"`,
              `Schedule ${event_type}`,
              `/app/provider/runs/${runId}`
            ]
          );
        }
      }
    } catch (notifyErr) {
      console.error('Failed to create schedule proposal notification:', notifyErr);
    }

    res.json({
      ok: true,
      event: {
        id: newEvent.id,
        event_type: newEvent.event_type,
        proposed_start: newEvent.proposed_start,
        proposed_end: newEvent.proposed_end,
        note: newEvent.note,
        proposal_context: newEvent.metadata?.proposal_context ?? null,
        created_at: newEvent.created_at,
        actor_role: actorRole
      }
    });
  } catch (error: any) {
    console.error('Schedule proposal create error:', error);
    res.status(500).json({ ok: false, error: 'error.schedule_proposal.create_failed' });
  }
});

export default router;

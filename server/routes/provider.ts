/**
 * Provider Routes - Service Provider Experience Phase 1
 * 
 * API endpoints for provider inbox and request actions.
 * Uses parameterized queries to prevent SQL injection.
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { pool } from '../db';
import type { TenantRequest } from '../middleware/tenantContext';
import { JWT_SECRET } from '../middleware/auth';
import { sendEmail, isEmailEnabled } from '../services/emailService';
import {
  invitationCreated,
  invitationResent,
  invitationRevoked,
  getClaimUrl,
} from '../services/emailTemplates/invitationTemplates';

// ============================================================
// STEP 11C Phase 2A: In-memory rate limit tracking
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const tenantDailyLimits = new Map<string, RateLimitEntry>();
const individualHourlyLimits = new Map<string, RateLimitEntry>();
const emailMinuteLimits = new Map<string, RateLimitEntry>();

function getUTCDay(): string {
  return new Date().toISOString().split('T')[0];
}

function getUTCHour(): string {
  const d = new Date();
  return `${d.toISOString().split('T')[0]}T${d.getUTCHours().toString().padStart(2, '0')}`;
}

function getUTCMinute(): string {
  const d = new Date();
  return `${d.toISOString().split(':')[0]}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

function checkAndIncrementLimit(
  map: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  resetPeriodMs: number,
  incrementBy: number = 1
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = map.get(key);
  
  if (!entry || now >= entry.resetAt) {
    map.set(key, { count: incrementBy, resetAt: now + resetPeriodMs });
    return { allowed: true, remaining: limit - incrementBy };
  }
  
  if (entry.count + incrementBy > limit) {
    return { allowed: false, remaining: limit - entry.count };
  }
  
  entry.count += incrementBy;
  return { allowed: true, remaining: limit - entry.count };
}

interface EffectivePolicy {
  tenantDailyCap: number;
  individualHourlyCap: number;
  perRequestCap: number;
  emailSendPerMinute: number;
  skipEmailIfOnPlatform: boolean;
}

async function loadEffectivePolicy(tenantId: string): Promise<EffectivePolicy | null> {
  try {
    const platformResult = await pool.query(
      `SELECT tenant_daily_cap, individual_hourly_cap, per_request_cap, email_send_per_minute, skip_email_if_on_platform
       FROM cc_platform_invite_policy WHERE policy_key = 'default'`
    );
    
    if (platformResult.rows.length === 0) {
      console.error('[InvitePolicy] Platform policy not found');
      return null;
    }
    
    const platform = platformResult.rows[0];
    
    const tenantResult = await pool.query(
      `SELECT tenant_daily_cap, individual_hourly_cap, per_request_cap, email_send_per_minute, skip_email_if_on_platform
       FROM cc_tenant_invite_policy WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const tenantOverride = tenantResult.rows[0] || {};
    
    return {
      tenantDailyCap: tenantOverride.tenant_daily_cap ?? platform.tenant_daily_cap,
      individualHourlyCap: tenantOverride.individual_hourly_cap ?? platform.individual_hourly_cap,
      perRequestCap: tenantOverride.per_request_cap ?? platform.per_request_cap,
      emailSendPerMinute: tenantOverride.email_send_per_minute ?? platform.email_send_per_minute,
      skipEmailIfOnPlatform: tenantOverride.skip_email_if_on_platform ?? platform.skip_email_if_on_platform ?? false,
    };
  } catch (error) {
    console.error('[InvitePolicy] Failed to load policy:', error);
    return null;
  }
}

async function createInviteNotification(
  recipientIndividualId: string,
  category: string,
  body: string,
  shortBody: string,
  contextType: string,
  contextId: string,
  actionUrl: string
): Promise<void> {
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
      ) VALUES ($1, $2, 'normal', ARRAY['in_app'], $3, $4, $5, $6, $7, 'pending')`,
      [recipientIndividualId, category, contextType, contextId, body, shortBody, actionUrl]
    );
  } catch (error) {
    console.error('[InviteNotification] Failed to create notification:', error);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 ? local[0] + '***' + local.slice(-1) : '***';
  return `${maskedLocal}@${domain}`;
}

const router = Router();

interface JWTPayload {
  userId: string;
  email: string;
  isPlatformAdmin?: boolean;
  activeTenantId?: string;
}

interface AuthRequest extends Request {
  user?: { id: string; tenantId?: string };
  ctx?: { tenant_id: string | null };
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const session = (req as any).session;

  // Session-based auth support (dev-demo login, tenant switching)
  if (session?.userId) {
    // Ensure req.user is populated for downstream code that expects it
    req.user = req.user ?? { id: session.userId };
    req.user.id = req.user.id ?? session.userId;

    // Populate tenantId from session if available (supports tenant switching)
    const sessionTenantId = session.current_tenant_id || session.tenant_id;
    if (sessionTenantId && !req.user.tenantId) {
      req.user.tenantId = sessionTenantId;
    }

    return next();
  }

  // If req.user already populated (e.g., optionalAuth from JWT), allow through
  if (req.user?.id) {
    // Try to get tenantId from JWT if not already set
    if (!req.user.tenantId) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
          req.user.tenantId = decoded.activeTenantId;
        } catch (e) {
          // Token invalid but user exists from other auth - continue
        }
      }
    }
    return next();
  }

  // JWT bearer fallback - decode from Authorization header
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

router.get('/inbox', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const filter = req.query.filter as string || 'pending';
    const search = (req.query.search as string || '').trim();

    let statusCondition = '';
    switch (filter) {
      case 'pending':
        statusCondition = `AND sr.status IN ('SENT', 'AWAITING_RESPONSE')`;
        break;
      case 'proposed':
        statusCondition = `AND sr.status = 'PROPOSED_CHANGE'`;
        break;
      case 'accepted':
        statusCondition = `AND sr.status = 'ACCEPTED'`;
        break;
      default:
        statusCondition = '';
    }

    const searchCondition = search 
      ? `AND (sr.title ILIKE $2 OR sr.description ILIKE $2)`
      : '';

    const params: any[] = [userId];
    if (search) params.push(`%${search}%`);

    const query = `
      SELECT 
        sr.id,
        COALESCE(sr.status, 'AWAITING_RESPONSE') as status,
        COALESCE(sr.market_mode, 'TARGETED') as market_mode,
        COALESCE(sr.visibility, 'PRIVATE') as visibility,
        COALESCE(sr.title, sr.summary, 'Service Request') as title,
        sr.description,
        sr.preferred_date,
        sr.preferred_time_start,
        sr.preferred_time_end,
        COALESCE(p.display_name, p.given_name || ' ' || COALESCE(p.family_name, '')) as requester_name,
        EXISTS (
          SELECT 1 FROM cc_service_proposals sp 
          WHERE sp.request_id = sr.id AND sp.status = 'pending'
        ) as has_active_proposal,
        sr.created_at,
        sr.updated_at
      FROM cc_service_requests sr
      LEFT JOIN cc_people p ON sr.requester_person_id = p.id
      WHERE sr.assigned_provider_person_id = $1
        ${statusCondition}
        ${searchCondition}
      ORDER BY sr.updated_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, params);

    const countsResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('SENT', 'AWAITING_RESPONSE')) as pending,
        COUNT(*) FILTER (WHERE status = 'PROPOSED_CHANGE') as proposed,
        COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted
      FROM cc_service_requests
      WHERE assigned_provider_person_id = $1
    `, [userId]);

    const counts = countsResult.rows[0] || { pending: 0, proposed: 0, accepted: 0 };

    res.json({
      ok: true,
      requests: result.rows,
      counts: {
        pending: Number(counts.pending || 0),
        proposed: Number(counts.proposed || 0),
        accepted: Number(counts.accepted || 0),
      }
    });
  } catch (error: any) {
    console.error('Provider inbox error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch inbox' });
  }
});

router.get('/requests/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    if (!isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Invalid request ID' });
    }

    const result = await pool.query(`
      SELECT 
        sr.id,
        COALESCE(sr.status, 'AWAITING_RESPONSE') as status,
        COALESCE(sr.market_mode, 'TARGETED') as market_mode,
        COALESCE(sr.visibility, 'PRIVATE') as visibility,
        COALESCE(sr.title, sr.summary, 'Service Request') as title,
        sr.description,
        sr.preferred_date,
        sr.preferred_time_start,
        sr.preferred_time_end,
        sr.location_text,
        sr.notes,
        sr.thread_id,
        COALESCE(p.display_name, p.given_name || ' ' || COALESCE(p.family_name, '')) as requester_name,
        p.email as requester_email,
        EXISTS (
          SELECT 1 FROM cc_service_proposals sp 
          WHERE sp.request_id = sr.id AND sp.status = 'pending'
        ) as has_active_proposal,
        sr.created_at,
        sr.updated_at
      FROM cc_service_requests sr
      LEFT JOIN cc_people p ON sr.requester_person_id = p.id
      WHERE sr.id = $1 AND sr.assigned_provider_person_id = $2
    `, [requestId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Request not found' });
    }

    res.json({ ok: true, request: result.rows[0] });
  } catch (error: any) {
    console.error('Provider request detail error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch request' });
  }
});

router.post('/requests/:id/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;

    if (!isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Invalid request ID' });
    }

    const verifyResult = await pool.query(`
      SELECT id, status, thread_id FROM cc_service_requests 
      WHERE id = $1 AND assigned_provider_person_id = $2
    `, [requestId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Request not found' });
    }

    const currentStatus = verifyResult.rows[0].status as string;
    const threadId = verifyResult.rows[0].thread_id;

    if (!['SENT', 'AWAITING_RESPONSE'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, error: 'Request cannot be accepted in current state' });
    }

    await pool.query(`
      UPDATE cc_service_requests 
      SET status = 'ACCEPTED', updated_at = NOW()
      WHERE id = $1
    `, [requestId]);

    if (threadId) {
      await pool.query(`
        INSERT INTO cc_messages (id, thread_id, sender_person_id, content, message_type, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'Request has been accepted.', 'system', NOW())
      `, [threadId, userId]);
    }

    res.json({ ok: true, message: 'Request accepted' });
  } catch (error: any) {
    console.error('Accept request error:', error);
    res.status(500).json({ ok: false, error: 'Failed to accept request' });
  }
});

router.post('/requests/:id/propose', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;
    const { proposed_date, proposed_time_start, proposed_time_end, note } = req.body;

    if (!isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Invalid request ID' });
    }

    const verifyResult = await pool.query(`
      SELECT id, status, thread_id FROM cc_service_requests 
      WHERE id = $1 AND assigned_provider_person_id = $2
    `, [requestId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Request not found' });
    }

    const currentStatus = verifyResult.rows[0].status as string;
    const threadId = verifyResult.rows[0].thread_id;

    if (!['SENT', 'AWAITING_RESPONSE'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, error: 'Proposal cannot be submitted in current state' });
    }

    const proposalResult = await pool.query(`
      INSERT INTO cc_service_proposals (
        id, request_id, provider_person_id, proposed_date, proposed_time_start, 
        proposed_time_end, note, status, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', NOW()
      ) RETURNING id
    `, [requestId, userId, proposed_date || null, proposed_time_start || null, proposed_time_end || null, note || null]);

    await pool.query(`
      UPDATE cc_service_requests 
      SET status = 'PROPOSED_CHANGE', updated_at = NOW()
      WHERE id = $1
    `, [requestId]);

    const messageContent = note 
      ? `Proposed change: ${note}` 
      : 'A change has been proposed for this request.';
    
    if (threadId) {
      await pool.query(`
        INSERT INTO cc_messages (id, thread_id, sender_person_id, content, message_type, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'proposal', NOW())
      `, [threadId, userId, messageContent]);
    }

    res.json({ ok: true, message: 'Proposal submitted', proposalId: proposalResult.rows[0]?.id });
  } catch (error: any) {
    console.error('Propose change error:', error);
    res.status(500).json({ ok: false, error: 'Failed to submit proposal' });
  }
});

router.post('/requests/:id/decline', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requestId = req.params.id;
    const { reason } = req.body;

    if (!isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Invalid request ID' });
    }

    const verifyResult = await pool.query(`
      SELECT id, status, thread_id FROM cc_service_requests 
      WHERE id = $1 AND assigned_provider_person_id = $2
    `, [requestId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Request not found' });
    }

    const currentStatus = verifyResult.rows[0].status as string;
    const threadId = verifyResult.rows[0].thread_id;

    if (!['SENT', 'AWAITING_RESPONSE'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, error: 'Request cannot be declined in current state' });
    }

    await pool.query(`
      UPDATE cc_service_requests 
      SET status = 'UNASSIGNED', assigned_provider_person_id = NULL, updated_at = NOW()
      WHERE id = $1
    `, [requestId]);

    const messageContent = reason 
      ? `Request declined: ${reason}` 
      : 'Request has been declined by the provider.';
    
    if (threadId) {
      await pool.query(`
        INSERT INTO cc_messages (id, thread_id, sender_person_id, content, message_type, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 'system', NOW())
      `, [threadId, userId, messageContent]);
    }

    res.json({ ok: true, message: 'Request declined' });
  } catch (error: any) {
    console.error('Decline request error:', error);
    res.status(500).json({ ok: false, error: 'Failed to decline request' });
  }
});

router.get('/runs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    const filter = req.query.filter as string || 'all';
    const search = (req.query.search as string || '').trim();

    let statusCondition = '';
    switch (filter) {
      case 'scheduled':
        statusCondition = `AND r.status = 'scheduled'`;
        break;
      case 'in_progress':
        statusCondition = `AND r.status = 'in_progress'`;
        break;
      case 'completed':
        statusCondition = `AND r.status = 'completed'`;
        break;
      default:
        statusCondition = '';
    }

    const searchCondition = search 
      ? `AND (r.name ILIKE $2 OR r.description ILIKE $2)`
      : '';

    const params: any[] = [tenantId];
    if (search) params.push(`%${search}%`);

    const query = `
      SELECT 
        r.id,
        r.name as title,
        r.description,
        r.status,
        r.starts_at,
        r.ends_at,
        r.portal_id,
        r.zone_id,
        r.metadata,
        r.created_at,
        r.updated_at,
        p.name as portal_name,
        z.name as zone_name,
        0 as requests_attached
      FROM cc_n3_runs r
      LEFT JOIN cc_portals p ON r.portal_id = p.id
      LEFT JOIN cc_zones z ON r.zone_id = z.id
      WHERE r.tenant_id = $1
        ${statusCondition}
        ${searchCondition}
      ORDER BY r.starts_at DESC NULLS LAST, r.created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, params);

    res.json({ 
      ok: true, 
      runs: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        zone_id: row.zone_id,
        zone_name: row.zone_name,
        requests_attached: row.requests_attached,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    });
  } catch (error: any) {
    console.error('Provider runs list error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch runs' });
  }
});

router.get('/runs/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    const result = await pool.query(`
      SELECT 
        r.id,
        r.name as title,
        r.description,
        r.status,
        r.market_mode,
        r.starts_at,
        r.ends_at,
        r.portal_id,
        r.zone_id,
        r.start_address_id,
        r.metadata,
        r.created_at,
        r.updated_at,
        p.name as portal_name,
        z.name as zone_name,
        sa.label as start_address_label,
        sa.city as start_address_city,
        sa.region as start_address_region
      FROM cc_n3_runs r
      LEFT JOIN cc_portals p ON r.portal_id = p.id
      LEFT JOIN cc_zones z ON r.zone_id = z.id
      LEFT JOIN cc_tenant_start_addresses sa ON r.start_address_id = sa.id
      WHERE r.id = $1 AND r.tenant_id = $2
    `, [runId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }

    const run = result.rows[0];

    const publicationsResult = await pool.query(`
      SELECT 
        rpp.portal_id,
        p.name as portal_name,
        rpp.published_at
      FROM cc_run_portal_publications rpp
      JOIN cc_portals p ON rpp.portal_id = p.id
      WHERE rpp.run_id = $1 AND rpp.tenant_id = $2 AND rpp.unpublished_at IS NULL
      ORDER BY rpp.published_at DESC
    `, [runId, tenantId]);

    const attachmentsResult = await pool.query(`
      SELECT 
        a.id as attachment_id,
        a.request_id,
        a.status,
        a.held_at,
        a.committed_at,
        a.released_at,
        wr.summary,
        wr.description,
        wr.category,
        wr.priority,
        wr.status as request_status,
        wr.location_text,
        wr.created_at as request_created_at
      FROM cc_run_request_attachments a
      JOIN cc_work_requests wr ON a.request_id = wr.id
      WHERE a.run_id = $1 AND a.tenant_id = $2 AND a.released_at IS NULL
      ORDER BY a.status DESC, a.created_at ASC
    `, [runId, tenantId]);

    res.json({ 
      ok: true, 
      run: {
        id: run.id,
        title: run.title,
        description: run.description,
        status: run.status,
        market_mode: run.market_mode || 'INVITE_ONLY',
        starts_at: run.starts_at,
        ends_at: run.ends_at,
        portal_id: run.portal_id,
        portal_name: run.portal_name,
        zone_id: run.zone_id,
        zone_name: run.zone_name,
        start_address_id: run.start_address_id,
        start_address_label: run.start_address_label,
        start_address_city: run.start_address_city,
        start_address_region: run.start_address_region,
        metadata: run.metadata,
        created_at: run.created_at,
        updated_at: run.updated_at
      },
      attached_requests: attachmentsResult.rows.map(row => ({
        attachment_id: row.attachment_id,
        request_id: row.request_id,
        status: row.status,
        held_at: row.held_at,
        committed_at: row.committed_at,
        released_at: row.released_at,
        request_summary: {
          summary: row.summary,
          description: row.description,
          category: row.category,
          priority: row.priority,
          status: row.request_status,
          location_text: row.location_text,
          created_at: row.request_created_at
        }
      })),
      publications: publicationsResult.rows.map(row => ({
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        published_at: row.published_at
      }))
    });
  } catch (error: any) {
    console.error('Provider run detail error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch run' });
  }
});

// STEP 11B-FIX: Include tenant-owned AND community portals with valid anchors
router.get('/portals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    const result = await pool.query(`
      SELECT
        id,
        name,
        slug,
        status,
        portal_type,
        CASE
          WHEN owning_tenant_id = $1 THEN 'tenant_owned'
          WHEN portal_type = 'community' THEN 'community'
          ELSE 'other'
        END AS source
      FROM cc_portals
      WHERE status = 'active'
        AND (
          owning_tenant_id = $1
          OR (portal_type = 'community' AND anchor_community_id IS NOT NULL)
        )
      ORDER BY
        CASE WHEN owning_tenant_id = $1 THEN 0 ELSE 1 END,
        name ASC
    `, [tenantId]);

    res.json({ ok: true, portals: result.rows });
  } catch (error: any) {
    console.error('Provider portals error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch portals' });
  }
});

router.post('/runs/:id/publish', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { portalIds, marketMode } = req.body;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    if (marketMode === 'TARGETED') {
      return res.status(400).json({ 
        ok: false, 
        error: 'TARGETED is not valid for runs. Use OPEN, INVITE_ONLY, or CLOSED.' 
      });
    }

    const validModes = ['OPEN', 'INVITE_ONLY', 'CLOSED'];
    if (!validModes.includes(marketMode)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid market mode. Must be one of: ${validModes.join(', ')}` 
      });
    }

    if (!Array.isArray(portalIds) || portalIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one portal ID is required' });
    }

    for (const portalId of portalIds) {
      if (!isValidUUID(portalId)) {
        return res.status(400).json({ ok: false, error: `Invalid portal ID: ${portalId}` });
      }
    }

    const runResult = await pool.query(`
      SELECT id, tenant_id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }

    // STEP 11B-FIX: Allow publishing to tenant-owned OR community portals with valid anchors
    const portalsResult = await pool.query(`
      SELECT id
      FROM cc_portals
      WHERE id = ANY($1::uuid[])
        AND status = 'active'
        AND (
          owning_tenant_id = $2
          OR (portal_type = 'community' AND anchor_community_id IS NOT NULL)
        )
    `, [portalIds, tenantId]);

    if (portalsResult.rows.length !== portalIds.length) {
      return res.status(400).json({ ok: false, error: 'invalid_publish_target' });
    }

    await pool.query(`
      UPDATE cc_n3_runs SET market_mode = $1, updated_at = now() WHERE id = $2
    `, [marketMode, runId]);

    for (const portalId of portalIds) {
      await pool.query(`
        INSERT INTO cc_run_portal_publications (tenant_id, run_id, portal_id, published_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (tenant_id, run_id, portal_id) 
        DO UPDATE SET unpublished_at = NULL, published_at = now()
      `, [tenantId, runId, portalId]);
    }

    await pool.query(`
      UPDATE cc_run_portal_publications 
      SET unpublished_at = now() 
      WHERE run_id = $1 AND tenant_id = $2 AND portal_id != ALL($3::uuid[]) AND unpublished_at IS NULL
    `, [runId, tenantId, portalIds]);

    const publicationsResult = await pool.query(`
      SELECT rpp.portal_id, p.name as portal_name, rpp.published_at
      FROM cc_run_portal_publications rpp
      JOIN cc_portals p ON rpp.portal_id = p.id
      WHERE rpp.run_id = $1 AND rpp.tenant_id = $2 AND rpp.unpublished_at IS NULL
    `, [runId, tenantId]);

    res.json({
      ok: true,
      runId,
      marketMode,
      publications: publicationsResult.rows.map(row => ({
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        published_at: row.published_at
      }))
    });
  } catch (error: any) {
    console.error('Provider publish run error:', error);
    res.status(500).json({ ok: false, error: 'Failed to publish run' });
  }
});

// V3.5 STEP 11A: Provider Visibility Preview (Read-Only, No Publishing Side Effects)
// Answers: "Given my staged checkbox selections, where will this run ALSO be visible?"
router.post('/runs/:id/visibility-preview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { selected_portal_ids } = req.body;

    // Validate tenant context
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'Tenant context required' });
    }

    // Validate run ID format
    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'invalid_payload' });
    }

    // Validate payload
    if (!Array.isArray(selected_portal_ids)) {
      return res.status(400).json({ ok: false, error: 'invalid_payload' });
    }

    // Cap max portals (defensive)
    if (selected_portal_ids.length > 50) {
      return res.status(400).json({ ok: false, error: 'invalid_payload' });
    }

    // Validate all portal IDs are UUIDs
    for (const portalId of selected_portal_ids) {
      if (typeof portalId !== 'string' || !isValidUUID(portalId)) {
        return res.status(400).json({ ok: false, error: 'invalid_payload' });
      }
    }

    // Load run and verify tenant ownership
    const runResult = await pool.query(`
      SELECT id, tenant_id, zone_id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'run_not_found' });
    }

    const run = runResult.rows[0];

    // If no portals selected and no zone, return empty
    if (selected_portal_ids.length === 0 && !run.zone_id) {
      return res.json({
        ok: true,
        run_id: runId,
        selected_portal_ids: [],
        zone_id: null,
        effective_portals: []
      });
    }

    // Enable service mode for visibility functions (provider query pattern)
    await pool.query(`SELECT set_config('app.service_mode', 'on', true)`);

    // Compute effective visibility using CTE query
    // This combines:
    // 1. Direct portals (from selected_portal_ids)
    // 2. Rollups from each selected portal via visibility graph
    // 3. Rollups from run.zone_id if present
    const previewResult = await pool.query(`
      WITH direct_portals AS (
        -- Direct selections (depth 0)
        SELECT 
          p.id as portal_id,
          p.name as portal_name,
          'direct'::text as visibility_source,
          NULL::text as via_type,
          NULL::uuid as via_id,
          NULL::text as via_name,
          0 as depth
        FROM unnest($1::uuid[]) AS sel(id)
        JOIN cc_portals p ON p.id = sel.id
        WHERE p.owning_tenant_id = $2
      ),
      rollup_from_portals AS (
        -- For each selected portal, get visibility rollups
        SELECT DISTINCT ON (v.target_id)
          v.target_id as portal_id,
          p.name as portal_name,
          'rollup'::text as visibility_source,
          'portal'::text as via_type,
          dp.portal_id as via_id,
          dp.portal_name as via_name,
          v.depth
        FROM direct_portals dp
        CROSS JOIN LATERAL resolve_visibility_targets_recursive('portal', dp.portal_id, 6, false) v
        JOIN cc_portals p ON p.id = v.target_id
        WHERE v.target_type = 'portal'
          AND v.target_id NOT IN (SELECT portal_id FROM direct_portals)
        ORDER BY v.target_id, v.depth ASC
      ),
      rollup_from_zone AS (
        -- If run has zone_id, get visibility rollups from zone
        SELECT DISTINCT ON (v.target_id)
          v.target_id as portal_id,
          p.name as portal_name,
          'rollup'::text as visibility_source,
          'zone'::text as via_type,
          $3::uuid as via_id,
          z.name as via_name,
          v.depth
        FROM resolve_visibility_targets_recursive('zone', $3::uuid, 6, false) v
        JOIN cc_portals p ON p.id = v.target_id
        LEFT JOIN cc_zones z ON z.id = $3
        WHERE $3 IS NOT NULL
          AND v.target_type = 'portal'
          AND v.target_id NOT IN (SELECT portal_id FROM direct_portals)
        ORDER BY v.target_id, v.depth ASC
      ),
      combined AS (
        SELECT * FROM direct_portals
        UNION ALL
        SELECT * FROM rollup_from_portals
        UNION ALL
        SELECT * FROM rollup_from_zone
      ),
      deduped AS (
        -- Dedup: prefer direct over rollup, then shortest depth
        SELECT DISTINCT ON (portal_id)
          portal_id,
          portal_name,
          visibility_source,
          via_type,
          via_id,
          via_name,
          depth
        FROM combined
        ORDER BY portal_id, 
          CASE WHEN visibility_source = 'direct' THEN 0 ELSE 1 END,
          depth ASC
      )
      SELECT * FROM deduped
      ORDER BY 
        CASE WHEN visibility_source = 'direct' THEN 0 ELSE 1 END,
        depth ASC,
        portal_name ASC
    `, [selected_portal_ids, tenantId, run.zone_id]);

    return res.json({
      ok: true,
      run_id: runId,
      selected_portal_ids,
      zone_id: run.zone_id,
      effective_portals: previewResult.rows.map(row => ({
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        visibility_source: row.visibility_source,
        via_type: row.via_type,
        via_id: row.via_id,
        via_name: row.via_name,
        depth: row.depth
      }))
    });
  } catch (error: any) {
    console.error('Provider visibility preview error:', error);
    res.status(500).json({ ok: false, error: 'Failed to calculate visibility preview' });
  }
});

router.post('/runs/:id/unpublish', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { portalIds } = req.body;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    if (!Array.isArray(portalIds) || portalIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one portal ID is required' });
    }

    const runResult = await pool.query(`
      SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }

    await pool.query(`
      UPDATE cc_run_portal_publications 
      SET unpublished_at = now() 
      WHERE run_id = $1 AND tenant_id = $2 AND portal_id = ANY($3::uuid[])
    `, [runId, tenantId, portalIds]);

    const publicationsResult = await pool.query(`
      SELECT rpp.portal_id, p.name as portal_name, rpp.published_at
      FROM cc_run_portal_publications rpp
      JOIN cc_portals p ON rpp.portal_id = p.id
      WHERE rpp.run_id = $1 AND rpp.tenant_id = $2 AND rpp.unpublished_at IS NULL
    `, [runId, tenantId]);

    res.json({
      ok: true,
      runId,
      publications: publicationsResult.rows.map(row => ({
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        published_at: row.published_at
      }))
    });
  } catch (error: any) {
    console.error('Provider unpublish run error:', error);
    res.status(500).json({ ok: false, error: 'Failed to unpublish run' });
  }
});

// ============================================================================
// V3.5 STEP 6: Run Request Attachments (HOLD / COMMIT / RELEASE)
// ============================================================================

// State Transition Guard - defines valid request status transitions
// Canonical statuses from TERMINOLOGY_CANON.md v3 that can be held
const HOLDABLE_STATUSES = ['draft', 'sent', 'proposed_change', 'unassigned', 'awaiting_commitment'];
const TERMINAL_STATUSES = ['in_progress', 'completed', 'cancelled'];

// GET /api/provider/requests - List holdable service requests for the tenant
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    // Return requests that can be held (not already attached and not in terminal states)
    const result = await pool.query(`
      SELECT 
        wr.id,
        wr.summary,
        wr.description,
        wr.category,
        wr.priority,
        wr.status,
        wr.location_text,
        wr.created_at,
        p.name as portal_name
      FROM cc_work_requests wr
      LEFT JOIN cc_portals p ON p.id = wr.portal_id
      WHERE wr.tenant_id = $1 
        AND wr.status NOT IN ('completed', 'cancelled', 'in_progress', 'awaiting_commitment', 'accepted')
        AND NOT EXISTS (
          SELECT 1 FROM cc_run_request_attachments a 
          WHERE a.request_id = wr.id AND a.released_at IS NULL
        )
      ORDER BY wr.created_at DESC
      LIMIT 100
    `, [tenantId]);

    res.json({ 
      ok: true, 
      requests: result.rows.map(row => ({
        id: row.id,
        summary: row.summary,
        description: row.description,
        category: row.category,
        priority: row.priority,
        status: row.status,
        location_text: row.location_text,
        created_at: row.created_at,
        portal_name: row.portal_name
      }))
    });
  } catch (error: any) {
    console.error('Provider requests list error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch requests' });
  }
});

// POST /api/provider/runs/:id/attachments/hold - Attach a request in HELD state
router.post('/runs/:id/attachments/hold', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { requestId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    if (!requestId || !isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Valid request ID is required' });
    }

    // Verify run ownership
    const runResult = await pool.query(`
      SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    // Verify request exists and belongs to tenant
    const requestResult = await pool.query(`
      SELECT id, status FROM cc_work_requests WHERE id = $1 AND tenant_id = $2
    `, [requestId, tenantId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.request.not_found' });
    }

    const currentStatus = requestResult.rows[0].status;

    // State transition guard: check if request is holdable
    if (TERMINAL_STATUSES.includes(currentStatus)) {
      return res.status(409).json({ 
        ok: false, 
        error: 'error.request.invalid_state',
        message: `Cannot hold request in ${currentStatus} state`
      });
    }

    if (currentStatus === 'accepted') {
      return res.status(409).json({ 
        ok: false, 
        error: 'error.attachment.not_holdable',
        message: 'Request is already accepted and cannot be held'
      });
    }

    // Check if already attached to a run (any run)
    const existingAttachment = await pool.query(`
      SELECT id, run_id, status FROM cc_run_request_attachments 
      WHERE request_id = $1 AND tenant_id = $2 AND released_at IS NULL
    `, [requestId, tenantId]);

    if (existingAttachment.rows.length > 0) {
      const existing = existingAttachment.rows[0];
      if (existing.run_id === runId) {
        // Already attached to this run - just return success
        return res.json({ 
          ok: true, 
          message: 'Request already attached to this run',
          attachment: { 
            request_id: requestId, 
            status: existing.status 
          }
        });
      } else {
        return res.status(409).json({ 
          ok: false, 
          error: 'error.attachment.exists',
          message: 'Request is already attached to another run'
        });
      }
    }

    // Create attachment in HELD state (or reset a previously released attachment)
    const attachResult = await pool.query(`
      INSERT INTO cc_run_request_attachments (tenant_id, run_id, request_id, status, held_at)
      VALUES ($1, $2, $3, 'HELD', now())
      ON CONFLICT (tenant_id, run_id, request_id) 
      DO UPDATE SET status = 'HELD', held_at = now(), released_at = NULL, committed_at = NULL
      RETURNING id, status, held_at
    `, [tenantId, runId, requestId]);

    // Transition request to AWAITING_COMMITMENT if not already
    if (currentStatus !== 'awaiting_commitment') {
      await pool.query(`
        UPDATE cc_work_requests SET status = 'awaiting_commitment', updated_at = now()
        WHERE id = $1
      `, [requestId]);
    }

    res.json({
      ok: true,
      attachment: {
        id: attachResult.rows[0].id,
        request_id: requestId,
        status: attachResult.rows[0].status,
        held_at: attachResult.rows[0].held_at
      }
    });
  } catch (error: any) {
    console.error('Provider hold attachment error:', error);
    res.status(500).json({ ok: false, error: 'Failed to hold request' });
  }
});

// POST /api/provider/runs/:id/attachments/commit - Commit a held attachment
router.post('/runs/:id/attachments/commit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { requestId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    if (!requestId || !isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Valid request ID is required' });
    }

    // Verify run ownership
    const runResult = await pool.query(`
      SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    // Find the attachment
    const attachmentResult = await pool.query(`
      SELECT id, status FROM cc_run_request_attachments 
      WHERE run_id = $1 AND request_id = $2 AND tenant_id = $3 AND released_at IS NULL
    `, [runId, requestId, tenantId]);

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.attachment.not_found' });
    }

    const attachment = attachmentResult.rows[0];

    if (attachment.status === 'COMMITTED') {
      return res.json({ 
        ok: true, 
        message: 'Request already committed',
        attachment: { request_id: requestId, status: 'COMMITTED' }
      });
    }

    if (attachment.status !== 'HELD') {
      return res.status(409).json({ 
        ok: false, 
        error: 'error.attachment.not_committable',
        message: 'Only HELD attachments can be committed'
      });
    }

    // Check request is in AWAITING_COMMITMENT state
    const requestResult = await pool.query(`
      SELECT status FROM cc_work_requests WHERE id = $1
    `, [requestId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.request.not_found' });
    }

    const requestStatus = requestResult.rows[0].status;
    if (requestStatus !== 'awaiting_commitment') {
      return res.status(409).json({ 
        ok: false, 
        error: 'error.request.invalid_state',
        message: `Cannot commit from ${requestStatus} state. Must be awaiting_commitment.`
      });
    }

    // Update attachment to COMMITTED
    await pool.query(`
      UPDATE cc_run_request_attachments 
      SET status = 'COMMITTED', committed_at = now(), updated_at = now()
      WHERE id = $1
    `, [attachment.id]);

    // Transition request to ACCEPTED
    await pool.query(`
      UPDATE cc_work_requests SET status = 'accepted', updated_at = now()
      WHERE id = $1
    `, [requestId]);

    res.json({
      ok: true,
      attachment: {
        request_id: requestId,
        status: 'COMMITTED',
        committed_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Provider commit attachment error:', error);
    res.status(500).json({ ok: false, error: 'Failed to commit request' });
  }
});

// POST /api/provider/runs/:id/attachments/release - Release a held attachment
router.post('/runs/:id/attachments/release', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const runId = req.params.id;
    const { requestId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run ID' });
    }

    if (!requestId || !isValidUUID(requestId)) {
      return res.status(400).json({ ok: false, error: 'Valid request ID is required' });
    }

    // Verify run ownership
    const runResult = await pool.query(`
      SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    // Find the attachment
    const attachmentResult = await pool.query(`
      SELECT id, status FROM cc_run_request_attachments 
      WHERE run_id = $1 AND request_id = $2 AND tenant_id = $3 AND released_at IS NULL
    `, [runId, requestId, tenantId]);

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.attachment.not_found' });
    }

    const attachment = attachmentResult.rows[0];

    // HARD BLOCK: Cannot release COMMITTED attachments
    if (attachment.status === 'COMMITTED') {
      return res.status(409).json({ 
        ok: false, 
        error: 'error.commitment.release_not_allowed',
        message: 'Committed attachments cannot be released'
      });
    }

    // Release the attachment
    await pool.query(`
      UPDATE cc_run_request_attachments 
      SET released_at = now(), updated_at = now()
      WHERE id = $1
    `, [attachment.id]);

    // Transition request to UNASSIGNED
    await pool.query(`
      UPDATE cc_work_requests SET status = 'unassigned', updated_at = now()
      WHERE id = $1
    `, [requestId]);

    res.json({
      ok: true,
      attachment: {
        request_id: requestId,
        released_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Provider release attachment error:', error);
    res.status(500).json({ ok: false, error: 'Failed to release request' });
  }
});

// ============================================================
// START ADDRESS BOOK ENDPOINTS (STEP 6.5B)
// ============================================================

// C1) GET /api/provider/start-addresses - List active start addresses
router.get('/start-addresses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
    }

    const result = await pool.query(`
      SELECT 
        id, label, address_line_1, address_line_2, city, region, 
        postal_code, country, latitude, longitude, notes, is_default,
        created_at, updated_at
      FROM cc_tenant_start_addresses
      WHERE tenant_id = $1 AND archived_at IS NULL
      ORDER BY is_default DESC, label ASC
    `, [tenantId]);

    res.json({
      ok: true,
      startAddresses: result.rows.map(row => ({
        id: row.id,
        label: row.label,
        address_line_1: row.address_line_1,
        address_line_2: row.address_line_2,
        city: row.city,
        region: row.region,
        postal_code: row.postal_code,
        country: row.country,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        notes: row.notes,
        is_default: row.is_default
      }))
    });
  } catch (error: any) {
    console.error('Get start addresses error:', error);
    res.status(500).json({ ok: false, error: 'Failed to load start addresses' });
  }
});

// C2) POST /api/provider/start-addresses - Create a start address
router.post('/start-addresses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
    }

    const {
      label,
      address_line_1,
      address_line_2,
      city,
      region,
      postal_code,
      country = 'CA',
      latitude,
      longitude,
      notes,
      is_default = false
    } = req.body;

    // Validate label
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'error.request.invalid', message: 'Label is required' });
    }

    // V3.5 STEP 8: Validate coordinates (both-or-none rule)
    const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLng = longitude !== undefined && longitude !== null && longitude !== '';
    if (hasLat !== hasLng) {
      return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Enter both latitude and longitude (or leave both blank)' });
    }
    if (hasLat && hasLng) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Latitude must be between -90 and 90' });
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Longitude must be between -180 and 180' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If is_default, clear other defaults
      if (is_default) {
        await client.query(`
          UPDATE cc_tenant_start_addresses 
          SET is_default = false, updated_at = now()
          WHERE tenant_id = $1 AND is_default = true AND archived_at IS NULL
        `, [tenantId]);
      }

      // Insert new address
      const result = await client.query(`
        INSERT INTO cc_tenant_start_addresses (
          tenant_id, label, address_line_1, address_line_2, city, region,
          postal_code, country, latitude, longitude, notes, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, label, address_line_1, address_line_2, city, region,
          postal_code, country, latitude, longitude, notes, is_default
      `, [
        tenantId, label.trim(), address_line_1 || null, address_line_2 || null,
        city || null, region || null, postal_code || null, country,
        latitude || null, longitude || null, notes || null, is_default
      ]);

      await client.query('COMMIT');

      const row = result.rows[0];
      res.json({
        ok: true,
        startAddress: {
          id: row.id,
          label: row.label,
          address_line_1: row.address_line_1,
          address_line_2: row.address_line_2,
          city: row.city,
          region: row.region,
          postal_code: row.postal_code,
          country: row.country,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          notes: row.notes,
          is_default: row.is_default
        }
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      // Check for unique constraint violation
      if (err.code === '23505' && err.constraint?.includes('label')) {
        return res.status(409).json({ ok: false, error: 'error.start_address.label_exists' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Create start address error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create start address' });
  }
});

// C3) PATCH /api/provider/start-addresses/:id - Update a start address
router.patch('/start-addresses/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
    }

    const addressId = req.params.id;
    if (!isValidUUID(addressId)) {
      return res.status(400).json({ ok: false, error: 'error.request.invalid' });
    }

    // Verify ownership
    const existing = await pool.query(`
      SELECT id FROM cc_tenant_start_addresses WHERE id = $1 AND tenant_id = $2
    `, [addressId, tenantId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.start_address.not_found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const {
      label,
      address_line_1,
      address_line_2,
      city,
      region,
      postal_code,
      latitude,
      longitude,
      notes,
      is_default,
      archived_at
    } = req.body;

    if (label !== undefined) {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ ok: false, error: 'error.request.invalid', message: 'Label cannot be empty' });
      }
      updates.push(`label = $${paramCount++}`);
      values.push(label.trim());
    }
    if (address_line_1 !== undefined) { updates.push(`address_line_1 = $${paramCount++}`); values.push(address_line_1); }
    if (address_line_2 !== undefined) { updates.push(`address_line_2 = $${paramCount++}`); values.push(address_line_2); }
    if (city !== undefined) { updates.push(`city = $${paramCount++}`); values.push(city); }
    if (region !== undefined) { updates.push(`region = $${paramCount++}`); values.push(region); }
    if (postal_code !== undefined) { updates.push(`postal_code = $${paramCount++}`); values.push(postal_code); }
    
    // V3.5 STEP 8: Validate coordinates (both-or-none rule)
    // When updating, both must be provided together or both must be cleared
    const latProvided = latitude !== undefined;
    const lngProvided = longitude !== undefined;
    if (latProvided || lngProvided) {
      // If either is provided, enforce both-or-none on the provided values
      const hasLat = latitude !== null && latitude !== '';
      const hasLng = longitude !== null && longitude !== '';
      if (hasLat !== hasLng) {
        return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Enter both latitude and longitude (or leave both blank)' });
      }
      if (hasLat && hasLng) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Latitude must be between -90 and 90' });
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'Longitude must be between -180 and 180' });
        }
      }
    }
    
    if (latitude !== undefined) { updates.push(`latitude = $${paramCount++}`); values.push(latitude === '' ? null : latitude); }
    if (longitude !== undefined) { updates.push(`longitude = $${paramCount++}`); values.push(longitude === '' ? null : longitude); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
    if (archived_at !== undefined) { 
      updates.push(`archived_at = $${paramCount++}`); 
      values.push(archived_at === null ? null : new Date(archived_at)); 
    }

    if (updates.length === 0 && is_default === undefined) {
      return res.status(400).json({ ok: false, error: 'error.request.invalid', message: 'No fields to update' });
    }

    updates.push('updated_at = now()');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Handle is_default toggle
      if (is_default === true) {
        await client.query(`
          UPDATE cc_tenant_start_addresses 
          SET is_default = false, updated_at = now()
          WHERE tenant_id = $1 AND is_default = true AND archived_at IS NULL AND id != $2
        `, [tenantId, addressId]);
        updates.push(`is_default = true`);
      } else if (is_default === false) {
        updates.push(`is_default = false`);
      }

      values.push(addressId);
      values.push(tenantId);

      const result = await client.query(`
        UPDATE cc_tenant_start_addresses 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
        RETURNING id, label, address_line_1, address_line_2, city, region,
          postal_code, country, latitude, longitude, notes, is_default, archived_at
      `, values);

      await client.query('COMMIT');

      const row = result.rows[0];
      res.json({
        ok: true,
        startAddress: {
          id: row.id,
          label: row.label,
          address_line_1: row.address_line_1,
          address_line_2: row.address_line_2,
          city: row.city,
          region: row.region,
          postal_code: row.postal_code,
          country: row.country,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          notes: row.notes,
          is_default: row.is_default,
          archived_at: row.archived_at
        }
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505' && err.constraint?.includes('label')) {
        return res.status(409).json({ ok: false, error: 'error.start_address.label_exists' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Update start address error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update start address' });
  }
});

// C4) PATCH /api/provider/runs/:id/start-address - Set/clear run start address
router.patch('/runs/:id/start-address', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
    }

    const runId = req.params.id;
    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.request.invalid' });
    }

    const { startAddressId } = req.body;

    // Verify run belongs to tenant
    const runResult = await pool.query(`
      SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    // If startAddressId is provided, verify it exists and belongs to tenant
    if (startAddressId !== null && startAddressId !== undefined) {
      if (!isValidUUID(startAddressId)) {
        return res.status(400).json({ ok: false, error: 'error.request.invalid' });
      }

      const addressResult = await pool.query(`
        SELECT id, archived_at FROM cc_tenant_start_addresses 
        WHERE id = $1 AND tenant_id = $2
      `, [startAddressId, tenantId]);

      if (addressResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'error.start_address.not_found' });
      }

      if (addressResult.rows[0].archived_at) {
        return res.status(409).json({ ok: false, error: 'error.start_address.archived' });
      }
    }

    // Update run
    await pool.query(`
      UPDATE cc_n3_runs SET start_address_id = $1, updated_at = now()
      WHERE id = $2
    `, [startAddressId || null, runId]);

    res.json({
      ok: true,
      runId,
      startAddressId: startAddressId || null
    });
  } catch (error: any) {
    console.error('Set run start address error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update run start address' });
  }
});

// Haversine distance calculation (returns kilometers)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// STEP 7: GET /api/provider/runs/:id/publish-suggestions - Zone-first suggestions for publishing
router.get('/runs/:id/publish-suggestions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'error.auth.unauthenticated' });
    }

    const runId = req.params.id;
    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.request.invalid' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    // 1) Load run and verify tenant ownership
    const runResult = await pool.query(`
      SELECT id, tenant_id, start_address_id
      FROM cc_n3_runs
      WHERE id = $1 AND tenant_id = $2
    `, [runId, tenantId]);

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    const run = runResult.rows[0];

    // 2) Load origin lat/lng if start_address_id exists
    // V3.5 STEP 8: Track three origin states: no_address, has_address_no_coords, has_coords
    let originLat: number | null = null;
    let originLng: number | null = null;
    let originState: 'no_address' | 'has_address_no_coords' | 'has_coords' = 'no_address';

    if (run.start_address_id) {
      const addrResult = await pool.query(`
        SELECT latitude, longitude
        FROM cc_tenant_start_addresses
        WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL
      `, [run.start_address_id, tenantId]);

      if (addrResult.rows.length > 0) {
        const addr = addrResult.rows[0];
        if (addr.latitude != null && addr.longitude != null) {
          originLat = parseFloat(addr.latitude);
          originLng = parseFloat(addr.longitude);
          originState = 'has_coords';
        } else {
          originState = 'has_address_no_coords';
        }
      }
    }

    // 3) Get already published portals for this run
    const publishedResult = await pool.query(`
      SELECT portal_id
      FROM cc_run_portal_publications
      WHERE tenant_id = $1 AND run_id = $2 AND unpublished_at IS NULL
    `, [tenantId, runId]);

    const publishedPortalIds = publishedResult.rows.map(r => r.portal_id);

    // 4) Query candidate zones (zones-first) - tenant-owned portals
    // STEP 11B-FIX: Exclude already published using NOT (id = ANY(...))
    let tenantZonesQuery = `
      SELECT
        z.id as zone_id,
        z.name as zone_name,
        z.key as zone_key,
        p.id as portal_id,
        p.name as portal_name,
        p.slug as portal_slug,
        p.anchor_community_id,
        c.latitude as anchor_lat,
        c.longitude as anchor_lng
      FROM cc_zones z
      JOIN cc_portals p ON p.id = z.portal_id
      LEFT JOIN cc_sr_communities c ON c.id = p.anchor_community_id
      WHERE z.tenant_id = $1
        AND p.owning_tenant_id = $1
        AND p.status = 'active'
    `;

    const tenantZonesParams: any[] = [tenantId];

    if (publishedPortalIds.length > 0) {
      tenantZonesQuery += ` AND NOT (p.id = ANY($2::uuid[]))`;
      tenantZonesParams.push(publishedPortalIds);
    }

    const tenantZonesResult = await pool.query(tenantZonesQuery, tenantZonesParams);

    // STEP 11B-FIX: Query community portals (cross-tenant)
    let communityPortalsQuery = `
      SELECT
        p.id as portal_id,
        p.name as portal_name,
        p.slug as portal_slug,
        p.anchor_community_id,
        c.latitude as anchor_lat,
        c.longitude as anchor_lng
      FROM cc_portals p
      LEFT JOIN cc_sr_communities c ON c.id = p.anchor_community_id
      WHERE p.portal_type = 'community'
        AND p.status = 'active'
        AND p.anchor_community_id IS NOT NULL
        AND p.owning_tenant_id != $1
    `;

    const communityParams: any[] = [tenantId];

    if (publishedPortalIds.length > 0) {
      communityPortalsQuery += ` AND NOT (p.id = ANY($2::uuid[]))`;
      communityParams.push(publishedPortalIds);
    }

    const communityPortalsResult = await pool.query(communityPortalsQuery, communityParams);

    // 5) Compute distance and confidence for each candidate
    // V3.5 STEP 8: Added 'no_origin_coords' confidence mode
    // STEP 11B-FIX: Added suggestion_source field
    interface Suggestion {
      zone_id: string | null;
      zone_name: string | null;
      zone_key: string | null;
      portal_id: string;
      portal_name: string;
      portal_slug: string;
      distance_meters: number | null;
      distance_label: string | null;
      distance_confidence: 'ok' | 'unknown' | 'no_origin' | 'no_origin_coords';
      suggestion_source: 'tenant_zone' | 'community_portal';
    }

    // Helper to compute distance fields
    const computeDistance = (row: any): { distance_meters: number | null; distance_label: string | null; distance_confidence: 'ok' | 'unknown' | 'no_origin' | 'no_origin_coords' } => {
      let distance_meters: number | null = null;
      let distance_label: string | null = null;
      let distance_confidence: 'ok' | 'unknown' | 'no_origin' | 'no_origin_coords' = 'no_origin';

      if (originState === 'no_address') {
        distance_confidence = 'no_origin';
      } else if (originState === 'has_address_no_coords') {
        distance_confidence = 'no_origin_coords';
      } else if (row.anchor_lat == null || row.anchor_lng == null) {
        distance_confidence = 'unknown';
      } else {
        const anchorLat = parseFloat(row.anchor_lat);
        const anchorLng = parseFloat(row.anchor_lng);
        const distanceKm = haversineDistance(originLat!, originLng!, anchorLat, anchorLng);
        distance_meters = Math.round(distanceKm * 1000);
        distance_label = `~${Math.round(distanceKm)} km`;
        distance_confidence = 'ok';
      }

      return { distance_meters, distance_label, distance_confidence };
    };

    // Map tenant zone suggestions
    const tenantZoneSuggestions: Suggestion[] = tenantZonesResult.rows.map(row => {
      const dist = computeDistance(row);
      return {
        zone_id: row.zone_id,
        zone_name: row.zone_name,
        zone_key: row.zone_key,
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        portal_slug: row.portal_slug,
        distance_meters: dist.distance_meters,
        distance_label: dist.distance_label,
        distance_confidence: dist.distance_confidence,
        suggestion_source: 'tenant_zone' as const
      };
    });

    // Map community portal suggestions
    const communityPortalSuggestions: Suggestion[] = communityPortalsResult.rows.map(row => {
      const dist = computeDistance(row);
      return {
        zone_id: null,
        zone_name: null,
        zone_key: null,
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        portal_slug: row.portal_slug,
        distance_meters: dist.distance_meters,
        distance_label: dist.distance_label,
        distance_confidence: dist.distance_confidence,
        suggestion_source: 'community_portal' as const
      };
    });

    // STEP 11B-FIX: Merge and deduplicate (prefer tenant_zone over community_portal)
    const seenPortalIds = new Set<string>();
    const suggestions: Suggestion[] = [];

    // Add tenant zone suggestions first (they take priority)
    for (const s of tenantZoneSuggestions) {
      if (!seenPortalIds.has(s.portal_id)) {
        seenPortalIds.add(s.portal_id);
        suggestions.push(s);
      }
    }

    // Add community portal suggestions if not already present
    for (const s of communityPortalSuggestions) {
      if (!seenPortalIds.has(s.portal_id)) {
        seenPortalIds.add(s.portal_id);
        suggestions.push(s);
      }
    }

    // 6) Sort: ok by distance ascending, then unknown/no_origin/no_origin_coords alphabetically
    // STEP 11B-FIX: Fixed sort fallback for null zone_name
    suggestions.sort((a, b) => {
      // Priority: ok < unknown < no_origin_coords < no_origin
      const confidenceOrder: Record<string, number> = { ok: 0, unknown: 1, no_origin_coords: 2, no_origin: 3 };
      const aOrder = confidenceOrder[a.distance_confidence];
      const bOrder = confidenceOrder[b.distance_confidence];

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // Within same confidence
      if (a.distance_confidence === 'ok' && b.distance_confidence === 'ok') {
        return (a.distance_meters || 0) - (b.distance_meters || 0);
      }

      // STEP 11B-FIX: Alphabetical by zone_name OR portal_name (fallback for community portals)
      const aName = a.zone_name ?? a.portal_name;
      const bName = b.zone_name ?? b.portal_name;
      return aName.localeCompare(bName);
    });

    // 7) Apply limit
    const limitedSuggestions = suggestions.slice(0, limit);

    res.json({
      ok: true,
      run_id: runId,
      origin: {
        start_address_id: run.start_address_id || null,
        origin_lat: originLat,
        origin_lng: originLng,
        origin_state: originState  // V3.5 STEP 8: 'no_address' | 'has_address_no_coords' | 'has_coords'
      },
      suggestions: limitedSuggestions
    });
  } catch (error: any) {
    console.error('Publish suggestions error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get publish suggestions' });
  }
});

// ============================================================
// STEP 11C: Directed Operational Presence - Stakeholder Invites
// ============================================================

/**
 * POST /api/provider/runs/:id/stakeholder-invites
 * Create stakeholder invitations for a run (private ops notifications)
 * STEP 11C Phase 2A: Includes policy-aware rate limits and email delivery
 */
router.post('/runs/:id/stakeholder-invites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const runId = req.params.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'error.auth.no_tenant' });
    }

    const { invitees } = req.body;

    if (!Array.isArray(invitees) || invitees.length === 0) {
      return res.status(400).json({ ok: false, error: 'error.notify.invitees_required' });
    }

    const policy = await loadEffectivePolicy(tenantId);
    if (!policy) {
      return res.status(400).json({ ok: false, error: 'error.invite.policy_missing' });
    }

    if (invitees.length > policy.perRequestCap) {
      return res.status(429).json({
        ok: false,
        error: 'error.invite.rate_limited',
        scope: 'per_request',
        limit: policy.perRequestCap,
        requested: invitees.length
      });
    }

    const tenantDayKey = `${tenantId}:${getUTCDay()}`;
    const tenantCheck = checkAndIncrementLimit(
      tenantDailyLimits,
      tenantDayKey,
      policy.tenantDailyCap,
      24 * 60 * 60 * 1000,
      invitees.length
    );

    if (!tenantCheck.allowed) {
      return res.status(429).json({
        ok: false,
        error: 'error.invite.rate_limited',
        scope: 'tenant_daily',
        limit: policy.tenantDailyCap,
        remaining: tenantCheck.remaining
      });
    }

    const individualHourKey = `${userId}:${getUTCHour()}`;
    const individualCheck = checkAndIncrementLimit(
      individualHourlyLimits,
      individualHourKey,
      policy.individualHourlyCap,
      60 * 60 * 1000,
      invitees.length
    );

    if (!individualCheck.allowed) {
      tenantDailyLimits.get(tenantDayKey)!.count -= invitees.length;
      return res.status(429).json({
        ok: false,
        error: 'error.invite.rate_limited',
        scope: 'individual_hourly',
        limit: policy.individualHourlyCap,
        remaining: individualCheck.remaining
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const inv of invitees) {
      if (!inv.email || !emailRegex.test(inv.email)) {
        return res.status(400).json({ ok: false, error: 'error.notify.invalid_email' });
      }
      if (inv.name && inv.name.length > 200) {
        return res.status(400).json({ ok: false, error: 'error.notify.name_too_long' });
      }
      if (inv.message && inv.message.length > 1000) {
        return res.status(400).json({ ok: false, error: 'error.notify.message_too_long' });
      }
    }

    const runResult = await pool.query(
      `SELECT id, tenant_id, name FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
      [runId, tenantId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    const run = runResult.rows[0];
    const runName = run.name || 'Service Run';

    const inviterResult = await pool.query(
      `SELECT display_name, email FROM cc_individuals WHERE id = $1`,
      [userId]
    );
    const inviterName = inviterResult.rows[0]?.display_name || inviterResult.rows[0]?.email || 'Service Provider';

    // Batch lookup individuals by email for on-platform detection
    const normalizedEmails = invitees.map((inv: any) => inv.email.toLowerCase().trim());
    const individualsResult = await pool.query(
      `SELECT id, lower(email) AS email, full_name AS display_name
       FROM cc_individuals
       WHERE lower(email) = ANY($1::text[])`,
      [normalizedEmails]
    );
    const individualsByEmail = new Map<string, { id: string; displayName: string | null }>();
    for (const row of individualsResult.rows) {
      individualsByEmail.set(row.email, { id: row.id, displayName: row.display_name || null });
    }

    const createdInvitations: any[] = [];
    let emailsSent = 0;
    let emailsSkipped = 0;
    let inAppSent = 0;

    const emailMinuteKey = `${tenantId}:${getUTCMinute()}`;

    for (const inv of invitees) {
      const claimToken = randomBytes(16).toString('hex');
      const claimUrl = getClaimUrl(claimToken);

      const insertResult = await pool.query(
        `INSERT INTO cc_invitations (
          inviter_tenant_id,
          inviter_individual_id,
          context_type,
          context_id,
          context_name,
          invitee_email,
          invitee_name,
          invitee_role,
          claim_token,
          claim_token_expires_at,
          status,
          sent_at,
          sent_via,
          message,
          metadata
        ) VALUES ($1, $2, 'service_run', $3, $4, $5, $6, 'crew', $7, now() + interval '30 days', 'sent', now(), $8, $9, $10)
        RETURNING id, invitee_email, invitee_name, status, claim_token, claim_token_expires_at`,
        [
          tenantId,
          userId,
          runId,
          runName,
          inv.email,
          inv.name || null,
          claimToken,
          'link',
          inv.message || null,
          JSON.stringify({ kind: 'stakeholder_invite', created_from: 'provider_run', version: 2 })
        ]
      );

      const created = insertResult.rows[0];
      const inviteeEmailLower = inv.email.toLowerCase().trim();
      const onPlatformMatch = individualsByEmail.get(inviteeEmailLower);
      const isOnPlatform = !!onPlatformMatch;
      const inviteeIndividualId = onPlatformMatch?.id || null;

      let emailDelivered = false;
      let inAppDelivered = false;
      let deliveryChannel: 'email' | 'in_app' | 'both' | 'link' = 'link';

      // If on-platform, create in-app notification to invitee
      if (isOnPlatform && inviteeIndividualId) {
        await createInviteNotification(
          inviteeIndividualId,
          'invitation',
          `You've been invited to view "${runName}".`,
          'New invitation',
          'invitation',
          created.id,
          `/i/${claimToken}`
        );
        inAppDelivered = true;
        inAppSent++;
      }

      // Determine if we should send email
      const shouldSendEmail = !isOnPlatform || !policy.skipEmailIfOnPlatform;

      if (shouldSendEmail) {
        const emailCheck = checkAndIncrementLimit(
          emailMinuteLimits,
          emailMinuteKey,
          policy.emailSendPerMinute,
          60 * 1000
        );

        if (emailCheck.allowed && isEmailEnabled()) {
          const template = invitationCreated({
            runName,
            inviterName,
            claimUrl,
            token: claimToken
          });

          const emailResult = await sendEmail({
            to: inv.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            metadata: { invitationId: created.id, runId }
          });

          if (emailResult.sent) {
            emailDelivered = true;
            emailsSent++;
          } else {
            emailsSkipped++;
          }
        } else {
          emailsSkipped++;
        }
      }

      // Determine delivery channel and update sent_via
      if (inAppDelivered && emailDelivered) {
        deliveryChannel = 'both';
      } else if (inAppDelivered) {
        deliveryChannel = 'in_app';
      } else if (emailDelivered) {
        deliveryChannel = 'email';
      } else {
        deliveryChannel = 'link';
      }

      await pool.query(
        `UPDATE cc_invitations SET sent_via = $2 WHERE id = $1`,
        [created.id, deliveryChannel]
      );

      createdInvitations.push({
        id: created.id,
        invitee_email: created.invitee_email,
        invitee_name: created.invitee_name,
        status: created.status,
        claim_token_expires_at: created.claim_token_expires_at,
        claim_url: `/i/${created.claim_token}`,
        email_delivered: emailDelivered,
        on_platform: isOnPlatform,
        invitee_individual_id: inviteeIndividualId,
        delivery_channel: deliveryChannel
      });
    }

    await createInviteNotification(
      userId,
      'invitation',
      `You created ${createdInvitations.length} invitation(s) for "${runName}"`,
      `${createdInvitations.length} invite(s) created`,
      'service_run',
      runId,
      `/app/provider/runs/${runId}`
    );

    res.json({
      ok: true,
      run_id: runId,
      invitations: createdInvitations,
      emails_sent: emailsSent,
      emails_skipped: emailsSkipped,
      in_app_sent: inAppSent,
      email_enabled: isEmailEnabled(),
      skip_email_if_on_platform: policy.skipEmailIfOnPlatform
    });
  } catch (error: any) {
    console.error('Create stakeholder invites error:', error);
    res.status(500).json({ ok: false, error: 'error.notify.create_failed' });
  }
});

/**
 * GET /api/provider/runs/:id/stakeholder-invites
 * List existing stakeholder invitations for a run
 */
router.get('/runs/:id/stakeholder-invites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const runId = req.params.id;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;

    if (!isValidUUID(runId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'error.auth.no_tenant' });
    }

    const runResult = await pool.query(
      `SELECT id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
      [runId, tenantId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    const invitationsResult = await pool.query(
      `SELECT 
        id,
        invitee_email,
        invitee_name,
        status,
        sent_at,
        sent_via,
        viewed_at,
        claimed_at,
        claim_token,
        claim_token_expires_at,
        revoked_at,
        revocation_reason
      FROM cc_invitations
      WHERE context_type = 'service_run'
        AND context_id = $1
        AND inviter_tenant_id = $2
      ORDER BY created_at DESC`,
      [runId, tenantId]
    );

    res.json({
      ok: true,
      run_id: runId,
      invitations: invitationsResult.rows.map(row => ({
        id: row.id,
        invitee_email: row.invitee_email,
        invitee_name: row.invitee_name,
        status: row.status,
        sent_at: row.sent_at,
        sent_via: row.sent_via,
        viewed_at: row.viewed_at,
        claimed_at: row.claimed_at,
        claim_url: `/i/${row.claim_token}`,
        claim_token_expires_at: row.claim_token_expires_at,
        revoked_at: row.revoked_at,
        revocation_reason: row.revocation_reason
      }))
    });
  } catch (error: any) {
    console.error('List stakeholder invites error:', error);
    res.status(500).json({ ok: false, error: 'error.notify.list_failed' });
  }
});

/**
 * POST /api/provider/runs/:runId/stakeholder-invites/:inviteId/revoke
 * Revoke a stakeholder invitation
 * STEP 11C Phase 2A
 */
router.post('/runs/:runId/stakeholder-invites/:inviteId/revoke', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { runId, inviteId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!isValidUUID(runId) || !isValidUUID(inviteId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'error.auth.no_tenant' });
    }

    const { reason, silent } = req.body;
    const isSilent = silent !== false;

    const runResult = await pool.query(
      `SELECT id, name FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
      [runId, tenantId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    const runName = runResult.rows[0].name || 'Service Run';

    const inviteResult = await pool.query(
      `SELECT id, invitee_email, status, inviter_individual_id
       FROM cc_invitations
       WHERE id = $1 AND context_id = $2 AND inviter_tenant_id = $3`,
      [inviteId, runId, tenantId]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.invite.not_found' });
    }

    const invite = inviteResult.rows[0];

    if (invite.status === 'revoked') {
      return res.status(400).json({ ok: false, error: 'error.invite.already_revoked' });
    }

    await pool.query(
      `UPDATE cc_invitations
       SET status = 'revoked',
           revoked_at = now(),
           revoked_by_user_id = $1,
           revocation_reason = $2,
           is_silent_revocation = $3,
           updated_at = now()
       WHERE id = $4`,
      [userId, reason || null, isSilent, inviteId]
    );

    await createInviteNotification(
      invite.inviter_individual_id,
      'invitation',
      `Invitation for "${runName}" was revoked`,
      'Invitation revoked',
      'invitation',
      inviteId,
      `/app/provider/runs/${runId}`
    );

    if (!isSilent && invite.invitee_email && isEmailEnabled()) {
      const inviterResult = await pool.query(
        `SELECT display_name, email FROM cc_individuals WHERE id = $1`,
        [userId]
      );
      const inviterName = inviterResult.rows[0]?.display_name || inviterResult.rows[0]?.email || 'Service Provider';

      const template = invitationRevoked({ runName, inviterName });
      await sendEmail({
        to: invite.invitee_email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        metadata: { invitationId: inviteId, runId, action: 'revoke' }
      });
    }

    res.json({ 
      ok: true, 
      message: 'Invitation revoked',
      revoked_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Revoke stakeholder invite error:', error);
    res.status(500).json({ ok: false, error: 'error.invite.revoke_failed' });
  }
});

/**
 * POST /api/provider/runs/:runId/stakeholder-invites/:inviteId/resend
 * Resend a stakeholder invitation (refresh token if expired)
 * STEP 11C Phase 2A
 */
router.post('/runs/:runId/stakeholder-invites/:inviteId/resend', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { runId, inviteId } = req.params;
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;
    const userId = req.user!.id;

    if (!isValidUUID(runId) || !isValidUUID(inviteId)) {
      return res.status(400).json({ ok: false, error: 'error.run.invalid_id' });
    }

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'error.auth.no_tenant' });
    }

    const runResult = await pool.query(
      `SELECT id, name FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
      [runId, tenantId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.run.not_found' });
    }

    const runName = runResult.rows[0].name || 'Service Run';

    const inviteResult = await pool.query(
      `SELECT id, invitee_email, invitee_name, status, claim_token, claim_token_expires_at, inviter_individual_id
       FROM cc_invitations
       WHERE id = $1 AND context_id = $2 AND inviter_tenant_id = $3`,
      [inviteId, runId, tenantId]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'error.invite.not_found' });
    }

    const invite = inviteResult.rows[0];

    if (invite.status === 'revoked') {
      return res.status(400).json({ ok: false, error: 'error.invite.is_revoked' });
    }

    if (invite.status === 'claimed') {
      return res.status(400).json({ ok: false, error: 'error.invite.already_claimed' });
    }

    const tokenExpired = new Date(invite.claim_token_expires_at) < new Date();
    let claimToken = invite.claim_token;

    if (tokenExpired || invite.status === 'expired') {
      claimToken = randomBytes(16).toString('hex');
    }

    await pool.query(
      `UPDATE cc_invitations
       SET status = 'sent',
           sent_at = now(),
           sent_via = 'link',
           claim_token = $1,
           claim_token_expires_at = now() + interval '30 days',
           updated_at = now()
       WHERE id = $2`,
      [claimToken, inviteId]
    );

    const claimUrl = getClaimUrl(claimToken);
    let emailDelivered = false;

    if (invite.invitee_email && isEmailEnabled()) {
      const inviterResult = await pool.query(
        `SELECT display_name, email FROM cc_individuals WHERE id = $1`,
        [userId]
      );
      const inviterName = inviterResult.rows[0]?.display_name || inviterResult.rows[0]?.email || 'Service Provider';

      const template = invitationResent({ runName, inviterName, claimUrl, token: claimToken });
      const emailResult = await sendEmail({
        to: invite.invitee_email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        metadata: { invitationId: inviteId, runId, action: 'resend' }
      });

      if (emailResult.sent) {
        emailDelivered = true;
        await pool.query(
          `UPDATE cc_invitations SET sent_via = 'email' WHERE id = $1`,
          [inviteId]
        );
      }
    }

    await createInviteNotification(
      invite.inviter_individual_id,
      'invitation',
      `Invitation reminder sent for "${runName}"`,
      'Invitation resent',
      'invitation',
      inviteId,
      `/app/provider/runs/${runId}`
    );

    res.json({
      ok: true,
      message: 'Invitation resent',
      claim_url: `/i/${claimToken}`,
      email_delivered: emailDelivered
    });
  } catch (error: any) {
    console.error('Resend stakeholder invite error:', error);
    res.status(500).json({ ok: false, error: 'error.invite.resend_failed' });
  }
});

/**
 * POST /api/provider/identity/email-lookup
 * Batch email existence check for bulk invite flow
 * STEP 11C Phase 2B-1: Returns cc_individuals matches for provided emails
 */
router.post('/identity/email-lookup', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ ok: false, error: 'error.identity.emails_required' });
    }

    if (emails.length > 500) {
      return res.status(400).json({ ok: false, error: 'error.identity.too_many_emails', limit: 500 });
    }

    const normalizedEmails = emails
      .filter((e: any) => typeof e === 'string')
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.length > 0);

    if (normalizedEmails.length === 0) {
      return res.json({ ok: true, matches: [] });
    }

    const result = await pool.query(
      `SELECT id, display_name, lower(email) as email
       FROM cc_individuals
       WHERE lower(email) = ANY($1::text[])`,
      [normalizedEmails]
    );

    const matches = result.rows.map(row => ({
      email: row.email,
      individual_id: row.id,
      display_name: row.display_name || null
    }));

    res.json({ ok: true, matches });
  } catch (error: any) {
    console.error('Email lookup error:', error);
    res.status(500).json({ ok: false, error: 'error.identity.lookup_failed' });
  }
});

export default router;

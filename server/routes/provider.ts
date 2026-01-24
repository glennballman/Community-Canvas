/**
 * Provider Routes - Service Provider Experience Phase 1
 * 
 * API endpoints for provider inbox and request actions.
 * Uses parameterized queries to prevent SQL injection.
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import type { TenantRequest } from '../middleware/tenantContext';
import { JWT_SECRET } from '../middleware/auth';

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
  // First check if user is already populated
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

  // If no user, try to decode from JWT directly
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

router.get('/portals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Tenant context required' });
    }

    const result = await pool.query(`
      SELECT id, name, slug, status
      FROM cc_portals
      WHERE owning_tenant_id = $1 AND status = 'active'
      ORDER BY name ASC
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

    const portalsResult = await pool.query(`
      SELECT id FROM cc_portals WHERE id = ANY($1::uuid[]) AND owning_tenant_id = $2
    `, [portalIds, tenantId]);

    if (portalsResult.rows.length !== portalIds.length) {
      return res.status(400).json({ ok: false, error: 'One or more portals not found or not accessible' });
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

    // 4) Query candidate zones (zones-first)
    // Exclude portals already published
    let candidatesQuery = `
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

    const params: any[] = [tenantId];

    if (publishedPortalIds.length > 0) {
      candidatesQuery += ` AND p.id != ALL($2::uuid[])`;
      params.push(publishedPortalIds);
    }

    const candidatesResult = await pool.query(candidatesQuery, params);

    // 5) Compute distance and confidence for each candidate
    // V3.5 STEP 8: Added 'no_origin_coords' confidence mode
    interface Suggestion {
      zone_id: string;
      zone_name: string;
      zone_key: string;
      portal_id: string;
      portal_name: string;
      portal_slug: string;
      distance_meters: number | null;
      distance_label: string | null;
      distance_confidence: 'ok' | 'unknown' | 'no_origin' | 'no_origin_coords';
    }

    const suggestions: Suggestion[] = candidatesResult.rows.map(row => {
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

      return {
        zone_id: row.zone_id,
        zone_name: row.zone_name,
        zone_key: row.zone_key,
        portal_id: row.portal_id,
        portal_name: row.portal_name,
        portal_slug: row.portal_slug,
        distance_meters,
        distance_label,
        distance_confidence
      };
    });

    // 6) Sort: ok by distance ascending, then unknown/no_origin/no_origin_coords alphabetically
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

      // Alphabetical by zone_name
      return a.zone_name.localeCompare(b.zone_name);
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

export default router;

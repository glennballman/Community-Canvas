/**
 * Provider Routes - Service Provider Experience Phase 1
 * 
 * API endpoints for provider inbox and request actions.
 * Uses parameterized queries to prevent SQL injection.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import type { TenantRequest } from '../middleware/tenantContext';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; tenantId?: string };
  ctx?: { tenant_id: string | null };
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  next();
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
    const tenantId = req.ctx?.tenant_id;

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
    const tenantId = req.ctx?.tenant_id;
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
        r.metadata,
        r.created_at,
        r.updated_at,
        p.name as portal_name,
        z.name as zone_name
      FROM cc_n3_runs r
      LEFT JOIN cc_portals p ON r.portal_id = p.id
      LEFT JOIN cc_zones z ON r.zone_id = z.id
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
    const tenantId = req.ctx?.tenant_id;

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
    const tenantId = req.ctx?.tenant_id;
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
    const tenantId = req.ctx?.tenant_id;
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
const HOLDABLE_STATUSES = ['new', 'sent', 'awaiting_response', 'proposed_change', 'unassigned', 'awaiting_commitment'];
const TERMINAL_STATUSES = ['in_progress', 'completed', 'cancelled'];

// GET /api/provider/requests - List holdable service requests for the tenant
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.ctx?.tenant_id;

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
    const tenantId = req.ctx?.tenant_id;
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
    const tenantId = req.ctx?.tenant_id;
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
    const tenantId = req.ctx?.tenant_id;
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

export default router;

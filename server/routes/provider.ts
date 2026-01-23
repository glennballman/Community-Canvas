/**
 * Provider Routes - Service Provider Experience Phase 1
 * 
 * API endpoints for provider inbox and request actions.
 * Uses parameterized queries to prevent SQL injection.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; tenantId?: string };
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
    const tenantId = req.user!.tenantId;

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
    const tenantId = req.user!.tenantId;
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

    const publications = run.portal_id ? [{
      portal_id: run.portal_id,
      portal_name: run.portal_name
    }] : [];

    res.json({ 
      ok: true, 
      run: {
        id: run.id,
        title: run.title,
        description: run.description,
        status: run.status,
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
      attached_requests: [],
      publications
    });
  } catch (error: any) {
    console.error('Provider run detail error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch run' });
  }
});

export default router;

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

export default router;

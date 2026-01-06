import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

async function getOrCreatePartyForTenant(req: any): Promise<string | null> {
  const tenantId = req.ctx?.tenant_id;
  if (!tenantId) return null;

  const existing = await req.tenantQuery(
    `SELECT id FROM parties WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [tenantId]
  );

  if (existing.rows[0]?.id) return existing.rows[0].id;

  try {
    const created = await req.tenantQuery(
      `INSERT INTO parties (tenant_id, party_type, status, trade_name, primary_contact_email, metadata)
       VALUES ($1::uuid, 'contractor'::party_type, 'pending'::party_status, $2, $3, $4::jsonb)
       RETURNING id`,
      [
        tenantId,
        `Contractor ${tenantId.slice(0, 8)}`,
        null,
        JSON.stringify({ auto_created: true, created_from: 'api_job_board', created_at: new Date().toISOString() })
      ]
    );
    return created.rows[0]?.id || null;
  } catch (error) {
    console.error('Error auto-creating party:', error);
    return null;
  }
}

router.get('/mine', requireAuth, requireTenant, async (req, res) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;

    const partyId = await getOrCreatePartyForTenant(req);
    if (!partyId) return res.json({ bids: [], message: 'Unable to resolve party profile' });

    let query = `
      SELECT b.id, b.bid_ref, b.status, b.bid_amount, b.proposed_start_date,
             b.proposed_duration_days, b.submitted_at, b.score_overall, b.created_at,
             wr.title as work_request_title, wr.work_request_ref, wr.status as work_request_status,
             wr.bid_deadline, wr.expected_start_date as work_request_start_date,
             c.name as community_name, c.region as community_region
      FROM bids b
      JOIN work_requests wr ON wr.id = b.work_request_id
      LEFT JOIN sr_communities c ON c.id = wr.community_id
      WHERE b.party_id = $1::uuid
    `;

    const params: any[] = [partyId];
    let paramIndex = 2;

    if (status) {
      query += ` AND b.status = $${paramIndex}::bid_status`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await req.tenantQuery(query, params);
    res.json({ bids: result.rows });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

router.get('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const partyId = await getOrCreatePartyForTenant(tenantReq);
    if (!partyId) return res.status(403).json({ error: 'Unable to resolve party profile' });

    const result = await tenantReq.tenantQuery(
      `SELECT b.*, wr.title as work_request_title, wr.work_request_ref,
              wr.description as work_request_description, wr.status as work_request_status,
              wr.bid_deadline, wr.expected_start_date, wr.expected_duration_days as work_request_duration,
              wr.owner_tenant_id, c.name as community_name, c.region as community_region,
              p.trade_name as bidder_name
       FROM bids b
       JOIN work_requests wr ON wr.id = b.work_request_id
       LEFT JOIN sr_communities c ON c.id = wr.community_id
       LEFT JOIN parties p ON p.id = b.party_id
       WHERE b.id = $1::uuid AND (b.party_id = $2 OR wr.owner_tenant_id = $3)`,
      [id, partyId, tenantReq.ctx!.tenant_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });

    const lines = await tenantReq.tenantQuery(
      `SELECT id, line_number, category, description, quantity, unit, unit_price, total_price, notes
       FROM bid_breakdown_lines WHERE bid_id = $1 ORDER BY line_number`,
      [id]
    );

    const messages = await tenantReq.tenantQuery(
      `SELECT bm.*, p.trade_name as from_party_name
       FROM bid_messages bm LEFT JOIN parties p ON p.id = bm.from_party_id
       WHERE bm.bid_id = $1 ORDER BY bm.created_at`,
      [id]
    );

    res.json({ ...result.rows[0], breakdown_lines: lines.rows, messages: messages.rows });
  } catch (error) {
    console.error('Error fetching bid:', error);
    res.status(500).json({ error: 'Failed to fetch bid' });
  }
});

router.post('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const {
      work_request_id, opportunity_id, bid_amount, proposed_start_date, proposed_duration_days,
      technical_proposal, methodology, team_composition, exceptions, clarifications,
      breakdown_lines = [], submit_immediately = false
    } = req.body;

    const wrId = work_request_id || opportunity_id;
    if (!wrId) return res.status(400).json({ error: 'work_request_id is required' });

    const partyId = await getOrCreatePartyForTenant(tenantReq);
    if (!partyId) return res.status(400).json({ error: 'Unable to create party profile for bidding' });

    const portalId = tenantReq.ctx?.portal_id;

    const wrResult = await tenantReq.tenantQuery(
      `SELECT id, status, owner_tenant_id, bid_deadline FROM work_requests
       WHERE id = $1::uuid AND status = 'published'::work_request_status
         AND (visibility_scope = 'public'::publish_visibility
              OR (visibility_scope = 'portal_only'::publish_visibility AND portal_id = $2))`,
      [wrId, portalId]
    );

    if (wrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work request not found or not open for bidding' });
    }

    const wr = wrResult.rows[0];
    if (wr.bid_deadline && new Date(wr.bid_deadline) < new Date()) {
      return res.status(400).json({ error: 'Bid deadline has passed' });
    }

    const existingBid = await tenantReq.tenantQuery(
      `SELECT id, bid_ref FROM bids WHERE work_request_id = $1 AND party_id = $2`,
      [wrId, partyId]
    );

    if (existingBid.rows.length > 0) {
      return res.status(409).json({
        error: 'You already have a bid on this work request',
        existing_bid_id: existingBid.rows[0].id,
        existing_bid_ref: existingBid.rows[0].bid_ref
      });
    }

    const result = await tenantReq.tenantTransaction(async (client: any) => {
      const refResult = await client.query(
        `SELECT 'BD-' || to_char(now(), 'YYMMDD') || '-' || lpad(nextval('bid_ref_seq')::text, 3, '0') as ref`
      );
      const bidRef = refResult.rows[0].ref;

      const bidResult = await client.query(
        `INSERT INTO bids (bid_ref, work_request_id, party_id, status, bid_amount,
                          proposed_start_date, proposed_duration_days, technical_proposal,
                          methodology, team_composition, exceptions, clarifications, submitted_at)
         VALUES ($1, $2::uuid, $3::uuid, $4::bid_status, $5, $6::date, $7, $8, $9, $10::jsonb, $11, $12, $13)
         RETURNING *`,
        [
          bidRef, wrId, partyId,
          submit_immediately ? 'submitted' : 'draft',
          bid_amount || 0, proposed_start_date, proposed_duration_days,
          technical_proposal, methodology,
          team_composition ? JSON.stringify(team_composition) : null,
          exceptions, clarifications,
          submit_immediately ? new Date() : null
        ]
      );

      const bid = bidResult.rows[0];

      for (let i = 0; i < breakdown_lines.length; i++) {
        const line = breakdown_lines[i];
        await client.query(
          `INSERT INTO bid_breakdown_lines (bid_id, line_number, category, description, quantity, unit, unit_price, total_price, notes)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [bid.id, i + 1, line.category || 'General', line.description,
           line.quantity || 1, line.unit || 'each', line.unit_price || 0, line.total_price || 0, line.notes]
        );
      }

      return bid;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating bid:', error);
    res.status(500).json({ error: 'Failed to create bid', details: (error as Error).message });
  }
});

router.patch('/:id', requireAuth, requireTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const partyId = await getOrCreatePartyForTenant(req);
    if (!partyId) return res.status(403).json({ error: 'Unable to resolve party profile' });

    const bidCheck = await req.tenantQuery(
      `SELECT id, status FROM bids WHERE id = $1::uuid AND party_id = $2`,
      [id, partyId]
    );

    if (bidCheck.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });
    if (bidCheck.rows[0].status !== 'draft') return res.status(400).json({ error: 'Can only update draft bids' });

    const allowedFields = ['bid_amount', 'proposed_start_date', 'proposed_duration_days',
                          'technical_proposal', 'methodology', 'team_composition', 'exceptions', 'clarifications'];

    const setClauses: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'team_composition') {
          setClauses.push(`${field} = $${paramIndex}::jsonb`);
          params.push(JSON.stringify(updates[field]));
        } else {
          setClauses.push(`${field} = $${paramIndex}`);
          params.push(updates[field]);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    setClauses.push('updated_at = now()');

    const result = await req.tenantQuery(
      `UPDATE bids SET ${setClauses.join(', ')} WHERE id = $1::uuid RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bid:', error);
    res.status(500).json({ error: 'Failed to update bid' });
  }
});

router.post('/:id/submit', requireAuth, requireTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const partyId = await getOrCreatePartyForTenant(req);
    if (!partyId) return res.status(403).json({ error: 'Unable to resolve party profile' });

    const bidCheck = await req.tenantQuery(
      `SELECT b.id, b.status, wr.bid_deadline, wr.status as wr_status
       FROM bids b JOIN work_requests wr ON wr.id = b.work_request_id
       WHERE b.id = $1::uuid AND b.party_id = $2`,
      [id, partyId]
    );

    if (bidCheck.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });

    const bid = bidCheck.rows[0];
    if (bid.status !== 'draft') return res.status(400).json({ error: 'Bid already submitted' });
    if (bid.bid_deadline && new Date(bid.bid_deadline) < new Date()) return res.status(400).json({ error: 'Bid deadline has passed' });
    if (bid.wr_status !== 'published') return res.status(400).json({ error: 'Work request is no longer accepting bids' });

    const result = await req.tenantQuery(
      `UPDATE bids SET status = 'submitted'::bid_status, submitted_at = now(), updated_at = now()
       WHERE id = $1::uuid RETURNING *`,
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting bid:', error);
    res.status(500).json({ error: 'Failed to submit bid' });
  }
});

router.post('/:id/withdraw', requireAuth, requireTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const partyId = await getOrCreatePartyForTenant(req);
    if (!partyId) return res.status(403).json({ error: 'Unable to resolve party profile' });

    const result = await req.tenantQuery(
      `UPDATE bids SET status = 'withdrawn'::bid_status, updated_at = now()
       WHERE id = $1::uuid AND party_id = $2 AND status = 'submitted'::bid_status
       RETURNING *`,
      [id, partyId]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: 'Bid not found or cannot be withdrawn' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error withdrawing bid:', error);
    res.status(500).json({ error: 'Failed to withdraw bid' });
  }
});

router.post('/:id/messages', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  try {
    const { id } = req.params;
    const { message_type = 'message', subject, body, is_public = true, parent_message_id } = req.body;

    if (!body) return res.status(400).json({ error: 'Message body is required' });

    const partyId = await getOrCreatePartyForTenant(tenantReq);
    const tenantId = tenantReq.ctx!.tenant_id;

    const bidCheck = await tenantReq.tenantQuery(
      `SELECT b.id, b.work_request_id, wr.owner_tenant_id FROM bids b
       JOIN work_requests wr ON wr.id = b.work_request_id
       WHERE b.id = $1::uuid AND (b.party_id = $2 OR wr.owner_tenant_id = $3)`,
      [id, partyId, tenantId]
    );

    if (bidCheck.rows.length === 0) return res.status(404).json({ error: 'Bid not found' });

    const result = await tenantReq.tenantQuery(
      `INSERT INTO bid_messages (work_request_id, bid_id, from_party_id, from_tenant_id,
                                message_type, subject, body, is_public, parent_message_id)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::uuid)
       RETURNING *`,
      [bidCheck.rows[0].work_request_id, id, partyId, tenantId, message_type, subject, body, is_public, parent_message_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

export default router;

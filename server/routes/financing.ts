import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';
import { computeFinancingEligibility, formatFinancingSuggestion } from '../lib/financingEligibility';

const router = Router();

router.get('/work-requests/:id/financing-eligibility', async (req: Request, res: Response) => {
  try {
    const { id: work_request_id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const eligibility = await computeFinancingEligibility(work_request_id, actor.actor_party_id);
    const suggestion = formatFinancingSuggestion(eligibility);

    res.json({
      eligibility,
      suggestion,
      actor: { party_id: actor.actor_party_id, display_name: actor.display_name }
    });
  } catch (error) {
    console.error('Error checking financing eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

router.get('/financing/products', async (req: Request, res: Response) => {
  try {
    const { category, owner_type } = req.query;

    let query = `SELECT * FROM cc_financing_products WHERE is_active = true`;
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND product_category = $${params.length}::financing_category`;
    }

    if (owner_type) {
      params.push(owner_type);
      query += ` AND $${params.length} = ANY(eligible_counterparties)`;
    }

    query += ` ORDER BY provider_name, product_name`;

    const result = await pool.query(query, params);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Error fetching financing products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/work-requests/:id/financing-request', async (req: Request, res: Response) => {
  try {
    const { id: work_request_id } = req.params;
    const {
      financing_type,
      amount_requested,
      use_of_funds,
      repayment_source,
      related_milestone_id,
      conversation_id,
      financing_product_id,
      supporting_documents
    } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!financing_type || !amount_requested || !use_of_funds || !repayment_source) {
      return res.status(400).json({ error: 'financing_type, amount_requested, use_of_funds, and repayment_source required' });
    }

    const typeMap: Record<string, string> = {
      'materials': 'materials_advance',
      'labour': 'labour_bridge',
      'equipment': 'equipment_finance',
      'receivable': 'receivable_factoring',
      'mobilization': 'mobilization_advance'
    };

    const mappedType = typeMap[financing_type] || financing_type;

    const eligibility = await computeFinancingEligibility(work_request_id, actor.actor_party_id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO cc_contractor_financing_requests (
          work_request_id, conversation_id, contractor_party_id, requested_by_individual_id,
          financing_type, amount_requested, use_of_funds,
          repayment_source, related_milestone_id,
          financing_product_id, supporting_documents,
          eligibility_signals, status
        ) VALUES ($1, $2, $3, $4, $5::financing_category, $6, $7, $8::repayment_source, $9, $10, $11, $12, 'draft')
        RETURNING *`,
        [
          work_request_id,
          conversation_id || null,
          actor.actor_party_id,
          actor.individual_id,
          mappedType,
          amount_requested,
          JSON.stringify(use_of_funds),
          repayment_source,
          related_milestone_id || null,
          financing_product_id || null,
          supporting_documents ? JSON.stringify(supporting_documents) : null,
          JSON.stringify(eligibility)
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        financing_request: result.rows[0],
        eligibility,
        actor: { party_id: actor.actor_party_id, display_name: actor.display_name }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating financing request:', error);
    res.status(500).json({ error: 'Failed to create financing request' });
  }
});

router.get('/financing', async (req: Request, res: Response) => {
  try {
    const { status, financing_type } = req.query;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let query = `
      SELECT cfr.*, wr.title as work_request_title, wr.work_request_ref,
             fp.product_name, fp.provider_name
      FROM cc_contractor_financing_requests cfr
      JOIN cc_work_requests wr ON cfr.work_request_id = wr.id
      LEFT JOIN cc_financing_products fp ON cfr.financing_product_id = fp.id
      WHERE cfr.contractor_party_id = $1
    `;
    const params: any[] = [actor.actor_party_id];

    if (status) {
      params.push(status);
      query += ` AND cfr.status = $${params.length}::financing_status`;
    }

    if (financing_type) {
      const typeMap: Record<string, string> = {
        'materials': 'materials_advance',
        'labour': 'labour_bridge',
        'equipment': 'equipment_finance',
        'receivable': 'receivable_factoring',
        'mobilization': 'mobilization_advance'
      };
      params.push(typeMap[financing_type as string] || financing_type);
      query += ` AND cfr.financing_type = $${params.length}::financing_category`;
    }

    query += ` ORDER BY cfr.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      financing_requests: result.rows,
      actor: { party_id: actor.actor_party_id, display_name: actor.display_name }
    });
  } catch (error) {
    console.error('Error fetching financing requests:', error);
    res.status(500).json({ error: 'Failed to fetch financing requests' });
  }
});

router.get('/financing/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT cfr.*, wr.title as work_request_title, wr.work_request_ref, wr.site_address,
              fp.product_name, fp.provider_name, fp.advance_percent, fp.fee_percent
       FROM cc_contractor_financing_requests cfr
       JOIN cc_work_requests wr ON cfr.work_request_id = wr.id
       LEFT JOIN cc_financing_products fp ON cfr.financing_product_id = fp.id
       WHERE cfr.id = $1 AND cfr.contractor_party_id = $2`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financing request not found' });
    }

    const disbursements = await pool.query(
      `SELECT * FROM cc_financing_disbursements WHERE financing_request_id = $1 ORDER BY created_at`,
      [id]
    );

    const repayments = await pool.query(
      `SELECT * FROM cc_financing_repayments WHERE financing_request_id = $1 ORDER BY expected_date`,
      [id]
    );

    res.json({
      financing_request: result.rows[0],
      disbursements: disbursements.rows,
      repayments: repayments.rows
    });
  } catch (error) {
    console.error('Error fetching financing request:', error);
    res.status(500).json({ error: 'Failed to fetch financing request' });
  }
});

router.patch('/financing/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount_requested, use_of_funds, repayment_source, financing_product_id, supporting_documents } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const existing = await pool.query(
      `SELECT * FROM cc_contractor_financing_requests WHERE id = $1 AND contractor_party_id = $2`,
      [id, actor.actor_party_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Financing request not found' });
    }

    if (existing.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Can only update draft requests' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (amount_requested !== undefined) {
      updates.push(`amount_requested = $${paramIndex}`);
      params.push(amount_requested);
      paramIndex++;
    }
    if (use_of_funds !== undefined) {
      updates.push(`use_of_funds = $${paramIndex}`);
      params.push(JSON.stringify(use_of_funds));
      paramIndex++;
    }
    if (repayment_source !== undefined) {
      updates.push(`repayment_source = $${paramIndex}::repayment_source`);
      params.push(repayment_source);
      paramIndex++;
    }
    if (financing_product_id !== undefined) {
      updates.push(`financing_product_id = $${paramIndex}`);
      params.push(financing_product_id);
      paramIndex++;
    }
    if (supporting_documents !== undefined) {
      updates.push(`supporting_documents = $${paramIndex}`);
      params.push(JSON.stringify(supporting_documents));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = now()');
    params.push(id);

    const result = await pool.query(
      `UPDATE cc_contractor_financing_requests SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json({ financing_request: result.rows[0] });
  } catch (error) {
    console.error('Error updating financing request:', error);
    res.status(500).json({ error: 'Failed to update financing request' });
  }
});

router.post('/financing/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT cfr.*, wr.id as wr_id FROM cc_contractor_financing_requests cfr
         JOIN cc_work_requests wr ON cfr.work_request_id = wr.id
         WHERE cfr.id = $1 AND cfr.contractor_party_id = $2`,
        [id, actor.actor_party_id]
      );

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Financing request not found' });
      }

      const request = existing.rows[0];

      if (request.status !== 'draft') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Can only submit draft requests' });
      }

      const eligibility = await computeFinancingEligibility(request.work_request_id, actor.actor_party_id);

      if (!eligibility.can_request_financing) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Not eligible for financing', 
          reasons: eligibility.reasons 
        });
      }

      const result = await client.query(
        `UPDATE cc_contractor_financing_requests SET
          status = 'submitted',
          status_changed_at = now(),
          cc_status_history = COALESCE(cc_status_history, '[]'::jsonb) || jsonb_build_array($1::jsonb),
          eligibility_signals = $2,
          updated_at = now()
         WHERE id = $3 RETURNING *`,
        [
          JSON.stringify({ status: 'submitted', at: new Date().toISOString(), by: actor.individual_id }),
          JSON.stringify(eligibility),
          id
        ]
      );

      await client.query('COMMIT');

      res.json({
        financing_request: result.rows[0],
        message: 'Financing request submitted for review. You will be notified when a decision is made.'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error submitting financing request:', error);
    res.status(500).json({ error: 'Failed to submit financing request' });
  }
});

router.post('/financing/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE cc_contractor_financing_requests SET
        status = 'cancelled',
        status_changed_at = now(),
        cc_status_history = COALESCE(cc_status_history, '[]'::jsonb) || jsonb_build_array($1::jsonb),
        cancelled_reason = $2,
        cancelled_by_party_id = $3,
        updated_at = now()
       WHERE id = $4 AND contractor_party_id = $5
         AND status IN ('draft', 'submitted', 'under_review')
       RETURNING *`,
      [
        JSON.stringify({ status: 'cancelled', at: new Date().toISOString(), by: actor.individual_id }),
        reason || 'Cancelled by contractor',
        actor.actor_party_id,
        id,
        actor.actor_party_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financing request not found or cannot be cancelled' });
    }

    res.json({ financing_request: result.rows[0], cancelled: true });
  } catch (error) {
    console.error('Error cancelling financing request:', error);
    res.status(500).json({ error: 'Failed to cancel financing request' });
  }
});

export default router;

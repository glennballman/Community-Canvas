import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';

const router = Router();

// ============================================================
// SEND APPRECIATION (Owner → Contractor, Positive Only)
// ============================================================
router.post('/opportunities/:id/appreciation', async (req: Request, res: Response) => {
  try {
    const { id: opportunity_id } = req.params;
    const { 
      content, 
      highlights,
      display_name,
      conversation_id 
    } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Appreciation content required' });
    }

    const client = await pool.connect();
    try {
      const oppResult = await client.query(
        `SELECT o.id, c.contractor_party_id
         FROM opportunities o
         LEFT JOIN conversations c ON c.opportunity_id = o.id
         WHERE o.id = $1
         ORDER BY c.created_at DESC LIMIT 1`,
        [opportunity_id]
      );

      if (oppResult.rows.length === 0) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      const opp = oppResult.rows[0];
      
      if (!opp.contractor_party_id) {
        return res.status(400).json({ error: 'No contractor associated with this opportunity' });
      }

      const settingsResult = await client.query(
        `SELECT accepts_appreciation_requests 
         FROM contractor_feedback_settings 
         WHERE party_id = $1`,
        [opp.contractor_party_id]
      );

      if (settingsResult.rows[0]?.accepts_appreciation_requests === false) {
        return res.status(400).json({ error: 'Contractor is not accepting appreciations at this time' });
      }

      const result = await client.query(
        `INSERT INTO public_appreciations (
          opportunity_id,
          from_party_id, from_individual_id, from_display_name,
          to_party_id,
          content, highlights
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          opportunity_id,
          actor.actor_party_id,
          actor.individual_id,
          display_name || actor.display_name?.split(' ')[0] + ' ' + (actor.display_name?.split(' ')[1]?.[0] || '') + '.',
          opp.contractor_party_id,
          content,
          highlights || null
        ]
      );

      res.status(201).json({ 
        appreciation: result.rows[0],
        message: 'Appreciation sent! The contractor can choose to make this public.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error sending appreciation:', error);
    res.status(500).json({ error: 'Failed to send appreciation' });
  }
});

// ============================================================
// GET RECEIVED APPRECIATIONS (Contractor)
// ============================================================
router.get('/appreciations/received', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { include_hidden = 'false' } = req.query;

    let query = `
      SELECT pa.*, 
             o.title as opportunity_title,
             o.opportunity_ref
      FROM public_appreciations pa
      JOIN opportunities o ON pa.opportunity_id = o.id
      WHERE pa.to_party_id = $1
    `;

    if (include_hidden !== 'true') {
      query += ` AND NOT pa.hidden_by_contractor`;
    }

    query += ` ORDER BY pa.created_at DESC`;

    const result = await pool.query(query, [actor.actor_party_id]);

    res.json({ 
      appreciations: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching appreciations:', error);
    res.status(500).json({ error: 'Failed to fetch appreciations' });
  }
});

// ============================================================
// GET PUBLIC APPRECIATIONS (Anyone can view public ones)
// ============================================================
router.get('/parties/:party_id/appreciations', async (req: Request, res: Response) => {
  try {
    const { party_id } = req.params;

    const result = await pool.query(
      `SELECT pa.id, pa.from_display_name, pa.content, pa.highlights, pa.created_at,
              o.title as opportunity_title
       FROM public_appreciations pa
       JOIN opportunities o ON pa.opportunity_id = o.id
       WHERE pa.to_party_id = $1 
         AND pa.is_public = true 
         AND NOT pa.hidden_by_contractor
       ORDER BY pa.created_at DESC
       LIMIT 20`,
      [party_id]
    );

    res.json({ 
      appreciations: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching public appreciations:', error);
    res.status(500).json({ error: 'Failed to fetch appreciations' });
  }
});

// ============================================================
// MAKE APPRECIATION PUBLIC (Contractor Choice)
// ============================================================
router.post('/appreciations/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE public_appreciations SET 
        is_public = true, 
        made_public_at = now()
       WHERE id = $1 AND to_party_id = $2
       RETURNING *`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appreciation not found' });
    }

    res.json({ 
      appreciation: result.rows[0],
      message: 'Appreciation is now visible on your public profile'
    });
  } catch (error) {
    console.error('Error publishing appreciation:', error);
    res.status(500).json({ error: 'Failed to publish appreciation' });
  }
});

// ============================================================
// UNPUBLISH APPRECIATION (Contractor Choice)
// ============================================================
router.post('/appreciations/:id/unpublish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE public_appreciations SET 
        is_public = false
       WHERE id = $1 AND to_party_id = $2
       RETURNING *`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appreciation not found' });
    }

    res.json({ 
      appreciation: result.rows[0],
      message: 'Appreciation is now private'
    });
  } catch (error) {
    console.error('Error unpublishing appreciation:', error);
    res.status(500).json({ error: 'Failed to unpublish appreciation' });
  }
});

// ============================================================
// HIDE APPRECIATION (Contractor Can Hide Any)
// ============================================================
router.post('/appreciations/:id/hide', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE public_appreciations SET 
        hidden_by_contractor = true,
        hidden_at = now(),
        is_public = false
       WHERE id = $1 AND to_party_id = $2
       RETURNING *`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appreciation not found' });
    }

    res.json({ appreciation: result.rows[0] });
  } catch (error) {
    console.error('Error hiding appreciation:', error);
    res.status(500).json({ error: 'Failed to hide appreciation' });
  }
});

// ============================================================
// UNHIDE APPRECIATION (Contractor)
// ============================================================
router.post('/appreciations/:id/unhide', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE public_appreciations SET 
        hidden_by_contractor = false,
        hidden_at = null
       WHERE id = $1 AND to_party_id = $2
       RETURNING *`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appreciation not found' });
    }

    res.json({ appreciation: result.rows[0] });
  } catch (error) {
    console.error('Error unhiding appreciation:', error);
    res.status(500).json({ error: 'Failed to unhide appreciation' });
  }
});

// ============================================================
// GET CONTRACTOR TRUST SUMMARY (Public Profile)
// ============================================================
router.get('/parties/:party_id/trust-summary', async (req: Request, res: Response) => {
  try {
    const { party_id } = req.params;

    const client = await pool.connect();
    try {
      const partyResult = await client.query(
        `SELECT trade_name, legal_name, party_type, status, 
                metadata, payment_preferences
         FROM parties WHERE id = $1`,
        [party_id]
      );

      if (partyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Party not found' });
      }

      const appreciationCount = await client.query(
        `SELECT COUNT(*) FROM public_appreciations 
         WHERE to_party_id = $1 AND is_public = true AND NOT hidden_by_contractor`,
        [party_id]
      );

      const completedJobs = await client.query(
        `SELECT COUNT(DISTINCT o.id) 
         FROM opportunities o
         JOIN conversations c ON c.opportunity_id = o.id
         WHERE c.contractor_party_id = $1 AND c.state = 'completed'`,
        [party_id]
      );

      const repeatCustomers = await client.query(
        `SELECT COUNT(*) FROM (
           SELECT owner_party_id FROM conversations
           WHERE contractor_party_id = $1 AND state = 'completed'
           GROUP BY owner_party_id
           HAVING COUNT(*) > 1
         ) repeat`,
        [party_id]
      );

      const trustSignals = await client.query(
        `SELECT * FROM trust_signals WHERE party_id = $1`,
        [party_id]
      );

      res.json({
        party: {
          id: party_id,
          name: partyResult.rows[0].trade_name || partyResult.rows[0].legal_name,
          type: partyResult.rows[0].party_type,
          status: partyResult.rows[0].status
        },
        trust_metrics: {
          public_appreciation_count: parseInt(appreciationCount.rows[0].count),
          completed_jobs: parseInt(completedJobs.rows[0].count),
          repeat_customers: parseInt(repeatCustomers.rows[0].count),
          ...trustSignals.rows[0]
        },
        payment_preferences: partyResult.rows[0].payment_preferences
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching trust summary:', error);
    res.status(500).json({ error: 'Failed to fetch trust summary' });
  }
});

export default router;

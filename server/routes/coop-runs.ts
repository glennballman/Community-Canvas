import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';
import { computeMobilizationSplit, computeContractorMargins, formatCustomerEstimate } from '../lib/mobilizationSplit';
import { randomBytes } from 'crypto';

const router = Router();

/**
 * COOPERATIVE SERVICE RUNS ROUTES
 * 
 * Philosophy:
 * - Cooperative bundling, NOT competitive bidding
 * - Contractor controls pricing
 * - Customers coordinate demand
 * - More members = better for everyone
 * 
 * Prefix: /api/coop-runs
 */

async function resolveTenant(req: any): Promise<{ id: string }> {
  const tenant_id = req?.ctx?.tenant_id;
  if (tenant_id) return { id: tenant_id };
  
  const result = await pool.query(
    `SELECT id FROM cc_tenants WHERE slug = 'bamfield' LIMIT 1`
  );
  if (result.rows.length > 0) return { id: result.rows[0].id };
  
  throw new Error('Tenant not found');
}

// ============================================================
// CREATE COOP RUN (Customer who booked a contractor)
// ============================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req);
    const actor = await resolveActorParty(req, 'owner');
    
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      trade_category,
      service_description,
      contractor_name,
      contractor_email,
      contractor_website,
      contractor_phone,
      window_start,
      window_end,
      preferred_months,
      unit_price,
      unit_name,
      mobilization_fee,
      min_threshold,
      property_address,
      property_postal_code,
      property_community,
      unit_count = 1,
      units,
      access_notes
    } = req.body;

    if (!trade_category) {
      return res.status(400).json({ error: 'trade_category required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const runResult = await client.query(
        `INSERT INTO coop_service_runs (
          tenant_id, trade_category, service_description,
          contractor_name, contractor_contact_email, contractor_website,
          window_start, window_end, preferred_months,
          mobilization_fee_total, min_mobilization_threshold,
          pricing_model,
          created_by_party_id, created_by_individual_id,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'forming')
        RETURNING *`,
        [
          tenant.id,
          trade_category,
          service_description,
          contractor_name,
          contractor_email,
          contractor_website,
          window_start,
          window_end,
          preferred_months || [],
          mobilization_fee || 500,
          min_threshold || 1500,
          JSON.stringify({ 
            unit_name: unit_name || 'unit', 
            unit_price: unit_price || 0 
          }),
          actor.actor_party_id,
          actor.individual_id
        ]
      );

      const run = runResult.rows[0];

      const oppResult = await client.query(
        `INSERT INTO opportunities (
          tenant_id, owner_party_id, owner_individual_id,
          title, description, intake_mode, coop_run_id,
          property_address, postal_code,
          state
        ) VALUES ($1, $2, $3, $4, $5, 'run', $6, $7, $8, 'intake')
        RETURNING *`,
        [
          tenant.id,
          actor.actor_party_id,
          actor.individual_id,
          `${trade_category} - ${property_community || 'Coop Run'}`,
          service_description,
          run.id,
          property_address,
          property_postal_code
        ]
      );

      const opportunity = oppResult.rows[0];

      await client.query(
        `INSERT INTO coop_run_members (
          run_id, opportunity_id, owner_party_id, owner_individual_id,
          property_address, property_postal_code, property_community,
          unit_count, units, access_notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'joined')`,
        [
          run.id,
          opportunity.id,
          actor.actor_party_id,
          actor.individual_id,
          property_address,
          property_postal_code,
          property_community,
          unit_count,
          JSON.stringify(units || {}),
          access_notes
        ]
      );

      if (contractor_email) {
        const inviteToken = randomBytes(32).toString('hex');
        
        await client.query(
          `INSERT INTO coop_contractor_invites (
            coop_run_id, contractor_name, contractor_email,
            contractor_phone, contractor_website,
            source, invite_token, status,
            invited_by_party_id, invited_by_individual_id
          ) VALUES ($1, $2, $3, $4, $5, 'customer_provided', $6, 'pending', $7, $8)`,
          [
            run.id,
            contractor_name,
            contractor_email,
            contractor_phone,
            contractor_website,
            inviteToken,
            actor.actor_party_id,
            actor.individual_id
          ]
        );

        await client.query(
          `UPDATE coop_service_runs SET status = 'contractor_invited' WHERE id = $1`,
          [run.id]
        );
      }

      await client.query(`SELECT recompute_coop_run_estimates($1)`, [run.id]);

      await client.query('COMMIT');

      const estimate = await computeMobilizationSplit(run.id);

      res.status(201).json({
        coop_run: run,
        opportunity: opportunity,
        mobilization_estimate: estimate,
        message: 'Coop run created! Neighbors can now join to split mobilization costs.'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating coop run:', error);
    res.status(500).json({ error: 'Failed to create coop run' });
  }
});

// ============================================================
// GET COOP RUN (Public summary)
// ============================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        r.*,
        COUNT(m.id) FILTER (WHERE m.status IN ('interested', 'joined', 'scheduled')) as member_count,
        SUM(m.unit_count) FILTER (WHERE m.status IN ('interested', 'joined', 'scheduled')) as total_units
       FROM coop_service_runs r
       LEFT JOIN coop_run_members m ON m.run_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coop run not found' });
    }

    const run = result.rows[0];
    const estimate = await computeMobilizationSplit(id);
    const display = formatCustomerEstimate(estimate);

    res.json({
      coop_run: {
        id: run.id,
        trade_category: run.trade_category,
        service_description: run.service_description,
        contractor_name: run.contractor_name,
        status: run.status,
        window_start: run.window_start,
        window_end: run.window_end,
        pricing_model: run.pricing_model,
        member_count: parseInt(run.member_count) || 0,
        total_units: parseInt(run.total_units) || 0
      },
      mobilization: {
        ...estimate,
        display
      },
      copy: {
        headline: display.headline,
        call_to_action: 'Join this coop run to share mobilization costs with your neighbors',
        not_bidding: 'This is not a bidding war. You are joining a coordinated service run.',
        efficiency: 'The more neighbors who join, the more efficient the trip becomes.'
      }
    });
  } catch (error) {
    console.error('Error fetching coop run:', error);
    res.status(500).json({ error: 'Failed to fetch coop run' });
  }
});

// ============================================================
// JOIN COOP RUN
// ============================================================
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = await resolveActorParty(req, 'owner');
    const tenant = await resolveTenant(req);
    
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      property_address,
      property_postal_code,
      property_community,
      unit_count = 1,
      units,
      access_notes,
      special_requirements
    } = req.body;

    const runResult = await pool.query(
      `SELECT * FROM coop_service_runs WHERE id = $1 AND status IN ('forming', 'contractor_invited', 'contractor_claimed')`,
      [id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Coop run not found or not accepting members' });
    }

    const run = runResult.rows[0];

    const existingResult = await pool.query(
      `SELECT id FROM coop_run_members 
       WHERE run_id = $1 AND owner_party_id = $2 AND status != 'withdrawn'`,
      [id, actor.actor_party_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already joined this run' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const oppResult = await client.query(
        `INSERT INTO opportunities (
          tenant_id, owner_party_id, owner_individual_id,
          title, description, intake_mode, coop_run_id,
          property_address, postal_code,
          state
        ) VALUES ($1, $2, $3, $4, $5, 'run', $6, $7, $8, 'intake')
        RETURNING *`,
        [
          tenant.id,
          actor.actor_party_id,
          actor.individual_id,
          `${run.trade_category} - Join Run`,
          run.service_description,
          run.id,
          property_address,
          property_postal_code
        ]
      );

      const opportunity = oppResult.rows[0];

      const memberResult = await client.query(
        `INSERT INTO coop_run_members (
          run_id, opportunity_id, owner_party_id, owner_individual_id,
          property_address, property_postal_code, property_community,
          unit_count, units, access_notes, special_requirements, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'joined')
        RETURNING *`,
        [
          id,
          opportunity.id,
          actor.actor_party_id,
          actor.individual_id,
          property_address,
          property_postal_code,
          property_community,
          unit_count,
          JSON.stringify(units || {}),
          access_notes,
          special_requirements
        ]
      );

      await client.query('COMMIT');

      const estimate = await computeMobilizationSplit(id);
      const display = formatCustomerEstimate(estimate);

      res.status(201).json({
        member: memberResult.rows[0],
        opportunity: opportunity,
        mobilization: {
          ...estimate,
          display
        },
        message: `You've joined the coop run! Current mobilization share: $${estimate.share_per_member}`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error joining coop run:', error);
    res.status(500).json({ error: 'Failed to join coop run' });
  }
});

// ============================================================
// CONTRACTOR CLAIM RUN
// ============================================================
router.post('/:id/claim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = await resolveActorParty(req, 'contractor');
    
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { invite_token } = req.body;

    if (invite_token) {
      const inviteResult = await pool.query(
        `SELECT * FROM coop_contractor_invites 
         WHERE coop_run_id = $1 AND invite_token = $2 AND status != 'claimed'`,
        [id, invite_token]
      );

      if (inviteResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or already used invite token' });
      }
    }

    const runResult = await pool.query(
      `SELECT * FROM coop_service_runs 
       WHERE id = $1 AND status IN ('forming', 'contractor_invited') AND contractor_party_id IS NULL`,
      [id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Coop run not found or already claimed' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE coop_service_runs SET
          contractor_party_id = $1,
          status = 'contractor_claimed',
          updated_at = now()
         WHERE id = $2`,
        [actor.actor_party_id, id]
      );

      if (invite_token) {
        await client.query(
          `UPDATE coop_contractor_invites SET
            status = 'claimed',
            claimed_party_id = $1,
            claimed_at = now()
           WHERE coop_run_id = $2 AND invite_token = $3`,
          [actor.actor_party_id, id, invite_token]
        );
      }

      const membersResult = await client.query(
        `SELECT m.*, o.id as opp_id FROM coop_run_members m
         JOIN opportunities o ON m.opportunity_id = o.id
         WHERE m.run_id = $1 AND m.status IN ('interested', 'joined')`,
        [id]
      );

      for (const member of membersResult.rows) {
        await client.query(
          `INSERT INTO conversations (
            opportunity_id, owner_party_id, contractor_party_id, state
          ) VALUES ($1, $2, $3, 'interest')
          ON CONFLICT (opportunity_id, contractor_party_id) DO NOTHING`,
          [member.opp_id, member.owner_party_id, actor.actor_party_id]
        );
      }

      await client.query('COMMIT');

      const margins = await computeContractorMargins(id);

      res.json({
        message: 'Coop run claimed! You can now set your schedule and communicate with members.',
        coop_run_id: id,
        member_count: membersResult.rows.length,
        contractor_margins: margins,
        next_steps: [
          'Review member details and locations',
          'Confirm or adjust pricing',
          'Set your service window',
          'Optionally invite more of your past customers'
        ]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error claiming coop run:', error);
    res.status(500).json({ error: 'Failed to claim coop run' });
  }
});

// ============================================================
// LIST COOP RUNS (Public discovery)
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req);
    const { community, trade_category, status = 'forming' } = req.query;

    let query = `
      SELECT 
        r.id, r.trade_category, r.service_description, r.contractor_name,
        r.status, r.window_start, r.window_end,
        r.current_member_count, r.mobilization_fee_total,
        r.pricing_model,
        c.name as community_name
      FROM coop_service_runs r
      LEFT JOIN communities c ON r.community_id = c.id
      WHERE r.tenant_id = $1
    `;
    const params: any[] = [tenant.id];

    if (community) {
      params.push(community);
      query += ` AND r.community_id = $${params.length}`;
    }

    if (trade_category) {
      params.push(trade_category);
      query += ` AND r.trade_category = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }

    query += ` ORDER BY r.created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    const runs = await Promise.all(
      result.rows.map(async (run) => {
        try {
          const estimate = await computeMobilizationSplit(run.id);
          return {
            ...run,
            mobilization_share: estimate.share_per_member,
            threshold_met: estimate.threshold_met
          };
        } catch {
          return {
            ...run,
            mobilization_share: 0,
            threshold_met: false
          };
        }
      })
    );

    res.json({
      coop_runs: runs,
      count: runs.length,
      copy: {
        explainer: 'Coop runs let neighbors bundle together and split mobilization costs.',
        not_bidding: 'This is cooperative coordination, not competitive bidding.'
      }
    });
  } catch (error) {
    console.error('Error listing coop runs:', error);
    res.status(500).json({ error: 'Failed to list coop runs' });
  }
});

// ============================================================
// CONTRACTOR: Create outreach campaign (virality trigger)
// ============================================================
router.post('/:id/outreach-campaign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = await resolveActorParty(req, 'contractor');
    
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { campaign_name, message_template, target_emails = [], target_phones = [] } = req.body;

    const runResult = await pool.query(
      `SELECT * FROM coop_service_runs WHERE id = $1 AND contractor_party_id = $2`,
      [id, actor.actor_party_id]
    );

    if (runResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized - must be the run contractor' });
    }

    const result = await pool.query(
      `INSERT INTO coop_outreach_campaigns (
        run_id, contractor_party_id, campaign_name, message_template,
        target_emails, target_phones
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, actor.actor_party_id, campaign_name, message_template, target_emails, target_phones]
    );

    res.status(201).json({
      campaign: result.rows[0],
      message: 'Outreach campaign created! Ready to invite your past customers.',
      next_step: 'POST /coop-runs/:id/outreach-campaign/:campaignId/send to send invites'
    });
  } catch (error) {
    console.error('Error creating outreach campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// ============================================================
// GET CONTRACTOR MARGIN DASHBOARD (Private)
// ============================================================
router.get('/:id/contractor-margins', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = await resolveActorParty(req, 'contractor');
    
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const runResult = await pool.query(
      `SELECT * FROM coop_service_runs WHERE id = $1 AND contractor_party_id = $2`,
      [id, actor.actor_party_id]
    );

    if (runResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const margins = await computeContractorMargins(id);

    res.json({
      margins,
      insight: margins.margin_improvement_percent > 0
        ? `Your margins have improved ${margins.margin_improvement_percent}% with bundled customers!`
        : 'Add more customers to improve your margins on this trip.',
      tip: 'Invite your past customers in this area to join and maximize your efficiency.'
    });
  } catch (error) {
    console.error('Error fetching contractor margins:', error);
    res.status(500).json({ error: 'Failed to fetch margins' });
  }
});

export default router;

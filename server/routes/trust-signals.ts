import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';
import { computeTrustSignals, saveTrustSignals, formatTrustDisplay } from '../lib/trustSignals';

const router = Router();

// ============================================================
// GET MY TRUST SIGNALS (Contractor)
// ============================================================
router.get('/contractors/me/trust-signals', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT * FROM cc_trust_signals 
       WHERE party_id = $1 AND model = 'v1_agg'`,
      [actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      const signals = await computeTrustSignals(actor.actor_party_id);
      await saveTrustSignals(signals);
      const display = formatTrustDisplay(signals);
      
      return res.json({
        cc_trust_signals: signals,
        display,
        note: 'Computed fresh. Call recompute to update.'
      });
    }

    const signals = result.rows[0];
    
    const signalsSummary = {
      party_id: signals.party_id,
      model: signals.model,
      jobs_completed: signals.jobs_completed || 0,
      jobs_in_progress: signals.jobs_in_progress || 0,
      completion_rate: signals.completion_rate,
      repeat_customer_count: signals.repeat_customer_count || 0,
      total_unique_customers: signals.total_unique_customers || 0,
      repeat_customer_rate: signals.total_unique_customers > 0 
        ? ((signals.repeat_customer_count || 0) / signals.total_unique_customers * 100) 
        : null,
      response_time_avg_hours: signals.response_time_avg_hours,
      verified_communities: signals.verified_communities || [],
      years_in_community: signals.years_in_community,
      has_insurance: signals.has_insurance || false,
      licenses: signals.licenses || [],
      certifications: signals.certifications || [],
      positive_feedback_count: signals.positive_feedback_count || 0,
      public_appreciation_count: signals.public_appreciation_count || 0,
      appreciation_highlights: signals.appreciation_highlights || [],
      member_since: signals.member_since,
      platform_verified: signals.platform_verified || false,
      display_preferences: signals.display_preferences || {}
    };

    const display = formatTrustDisplay(signalsSummary as any);

    res.json({
      cc_trust_signals: signalsSummary,
      display,
      last_updated: signals.last_updated,
      computed_at: signals.computed_at
    });
  } catch (error) {
    console.error('Error fetching trust signals:', error);
    res.status(500).json({ error: 'Failed to fetch trust signals' });
  }
});

// ============================================================
// GET PUBLIC TRUST SIGNALS FOR ANY PARTY
// ============================================================
router.get('/cc_parties/:id/trust-signals', async (req: Request, res: Response) => {
  try {
    const { id: party_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM cc_trust_signals 
       WHERE party_id = $1 AND model = 'v1_agg'`,
      [party_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        public_signals: {},
        confidence_level: 'new',
        badges: [],
        note: 'No trust signals available yet.'
      });
    }

    const signals = result.rows[0];
    const prefs = signals.display_preferences || {};

    const publicSignals: Record<string, any> = {};
    const badges: string[] = [];

    if (prefs.show_completion_rate && signals.completion_rate !== null) {
      publicSignals.completion_rate = `${signals.completion_rate}%`;
    }

    if (prefs.show_repeat_customers && (signals.repeat_customer_count || 0) > 0) {
      publicSignals.repeat_customers = signals.repeat_customer_count;
    }

    if (prefs.show_response_time && signals.response_time_avg_hours !== null) {
      publicSignals.avg_response_time = signals.response_time_avg_hours < 24
        ? `${signals.response_time_avg_hours.toFixed(1)} hours`
        : `${(signals.response_time_avg_hours / 24).toFixed(1)} days`;
    }

    if (prefs.show_credentials) {
      if (signals.has_insurance) publicSignals.insured = true;
      if ((signals.licenses || []).length > 0) publicSignals.licenses = signals.licenses;
      if ((signals.certifications || []).length > 0) publicSignals.certifications = signals.certifications;
    }

    if (prefs.show_years_in_community && (signals.verified_communities || []).length > 0) {
      publicSignals.verified_in = signals.verified_communities;
    }

    if (prefs.show_public_appreciations && (signals.public_appreciation_count || 0) > 0) {
      publicSignals.appreciations = signals.public_appreciation_count;
      if ((signals.appreciation_highlights || []).length > 0) {
        publicSignals.known_for = signals.appreciation_highlights;
      }
    }

    if (signals.platform_verified) badges.push('Platform Verified');
    if (signals.has_insurance && prefs.show_credentials) badges.push('Insured');
    if ((signals.repeat_customer_count || 0) >= 3 && prefs.show_repeat_customers) badges.push('Repeat Business');
    if ((signals.verified_communities || []).length >= 2) badges.push('Community Trusted');
    if ((signals.jobs_completed || 0) >= 10) badges.push('Experienced');

    const dataPoints = (signals.jobs_completed || 0) + (signals.positive_feedback_count || 0);
    let confidence: 'new' | 'establishing' | 'established';
    if (dataPoints < 3) {
      confidence = 'new';
    } else if (dataPoints < 10) {
      confidence = 'establishing';
    } else {
      confidence = 'established';
    }

    res.json({
      public_signals: publicSignals,
      confidence_level: confidence,
      badges,
      member_since: signals.member_since
    });
  } catch (error) {
    console.error('Error fetching public trust signals:', error);
    res.status(500).json({ error: 'Failed to fetch trust signals' });
  }
});

// ============================================================
// UPDATE DISPLAY PREFERENCES (Contractor)
// ============================================================
router.put('/contractors/me/trust-signals/preferences', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newPrefs = req.body;

    const validKeys = [
      'show_repeat_customers',
      'show_public_appreciations',
      'show_credentials',
      'show_response_time',
      'show_years_in_community',
      'show_completion_rate'
    ];

    for (const key of Object.keys(newPrefs)) {
      if (!validKeys.includes(key)) {
        return res.status(400).json({ 
          error: `Invalid preference key: ${key}`,
          valid_keys: validKeys 
        });
      }
      if (typeof newPrefs[key] !== 'boolean') {
        return res.status(400).json({ 
          error: `Preference ${key} must be a boolean` 
        });
      }
    }

    const result = await pool.query(
      `UPDATE cc_trust_signals SET
        display_preferences = display_preferences || $1::jsonb,
        last_updated = now()
       WHERE party_id = $2 AND model = 'v1_agg'
       RETURNING display_preferences`,
      [JSON.stringify(newPrefs), actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO cc_trust_signals (party_id, party_type, model, display_preferences)
         VALUES ($1, 'contractor', 'v1_agg', $2)`,
        [actor.actor_party_id, JSON.stringify({
          show_repeat_customers: true,
          show_public_appreciations: true,
          show_credentials: true,
          show_response_time: false,
          show_years_in_community: true,
          show_completion_rate: true,
          ...newPrefs
        })]
      );
    }

    res.json({
      display_preferences: result.rows[0]?.display_preferences || newPrefs,
      message: 'Display preferences updated.',
      note: newPrefs.show_response_time === true 
        ? 'Warning: Response time can be weaponized in small towns. Consider keeping hidden.'
        : undefined
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ============================================================
// REQUEST FEEDBACK (Contractor)
// ============================================================
router.post('/cc_conversations/:id/request-feedback', async (req: Request, res: Response) => {
  try {
    const { id: conversation_id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const convResult = await pool.query(
      `SELECT * FROM cc_conversations 
       WHERE id = $1 AND contractor_party_id = $2`,
      [conversation_id, actor.actor_party_id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or not authorized' });
    }

    await pool.query(
      `INSERT INTO cc_messages (
        conversation_id, sender_party_id, sender_individual_id,
        content, metadata
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        conversation_id,
        actor.actor_party_id,
        actor.individual_id,
        'Thank you for working with us! We\'d love to hear your feedback. Your comments go directly to our team and are NOT posted publicly.',
        JSON.stringify({ 
          type: 'feedback_request', 
          requested_by: actor.actor_party_id,
          requested_at: new Date().toISOString()
        })
      ]
    );

    res.json({
      message: 'Feedback request sent.',
      note: 'Customer will see: "Your comments go directly to our team and are NOT posted publicly."'
    });
  } catch (error) {
    console.error('Error requesting feedback:', error);
    res.status(500).json({ error: 'Failed to request feedback' });
  }
});

// ============================================================
// SUBMIT FEEDBACK (Owner/Customer)
// ============================================================
router.post('/cc_conversations/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { id: conversation_id } = req.params;
    const { 
      feedback_text, 
      sentiment = 'neutral',
      quality_rating,
      communication_rating,
      timeliness_rating,
      allow_public_snippet = false,
      public_snippet
    } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!feedback_text || feedback_text.trim().length < 3) {
      return res.status(400).json({ error: 'Feedback text required (min 3 characters)' });
    }

    const convResult = await pool.query(
      `SELECT c.*, wr.id as wr_id
       FROM cc_conversations c
       LEFT JOIN cc_work_requests wr ON c.work_request_id = wr.id
       WHERE c.id = $1 AND c.owner_party_id = $2`,
      [conversation_id, actor.actor_party_id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or not authorized' });
    }

    const conv = convResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const nameResult = await client.query(
        `SELECT COALESCE(preferred_name, full_name, 'A customer') as name
         FROM cc_individuals WHERE id = $1`,
        [actor.individual_id]
      );
      const displayName = nameResult.rows[0]?.name || 'A customer';

      const feedbackResult = await client.query(
        `INSERT INTO cc_contractor_feedback (
          conversation_id, work_request_id,
          from_party_id, from_individual_id, from_display_name,
          to_party_id,
          sentiment, feedback_text,
          quality_rating, communication_rating, timeliness_rating,
          visibility
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::feedback_sentiment, $8, $9, $10, $11, 'private')
        RETURNING *`,
        [
          conversation_id,
          conv.wr_id,
          actor.actor_party_id,
          actor.individual_id,
          displayName,
          conv.contractor_party_id,
          sentiment,
          feedback_text,
          quality_rating || null,
          communication_rating || null,
          timeliness_rating || null
        ]
      );

      const feedback = feedbackResult.rows[0];

      if (allow_public_snippet && sentiment === 'positive' && public_snippet) {
        await client.query(
          `INSERT INTO cc_public_appreciations (
            source_feedback_id, conversation_id, work_request_id,
            from_party_id, from_individual_id, from_display_name,
            to_party_id,
            snippet,
            is_public
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
          [
            feedback.id,
            conversation_id,
            conv.wr_id,
            actor.actor_party_id,
            actor.individual_id,
            displayName.split(' ')[0],
            conv.contractor_party_id,
            public_snippet.substring(0, 280)
          ]
        );
      }

      if (sentiment === 'positive') {
        await client.query(
          `UPDATE cc_trust_signals SET
            positive_feedback_count = COALESCE(positive_feedback_count, 0) + 1,
            last_updated = now()
           WHERE party_id = $1 AND model = 'v1_agg'`,
          [conv.contractor_party_id]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        feedback_id: feedback.id,
        message: 'Thank you for your feedback! It has been sent directly to the company.',
        note: 'Your feedback is private and will NOT be posted publicly unless you offered a snippet AND the company chooses to share it.'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ============================================================
// GET MY FEEDBACK INBOX (Contractor)
// ============================================================
router.get('/contractors/me/feedback', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { include_deleted = 'false', include_handled = 'true', sentiment } = req.query;

    let query = `
      SELECT cf.*, wr.title as work_request_title
      FROM cc_contractor_feedback cf
      LEFT JOIN cc_work_requests wr ON cf.work_request_id = wr.id
      WHERE cf.to_party_id = $1
    `;
    const params: any[] = [actor.actor_party_id];

    if (include_deleted !== 'true') {
      query += ` AND cf.contractor_deleted_at IS NULL`;
    }

    if (include_handled !== 'true') {
      query += ` AND cf.is_handled = false`;
    }

    if (sentiment) {
      params.push(sentiment);
      query += ` AND cf.sentiment = $${params.length}::feedback_sentiment`;
    }

    query += ` ORDER BY cf.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      feedback: result.rows,
      count: result.rows.length,
      unhandled_count: result.rows.filter(f => !f.is_handled).length
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// ============================================================
// HANDLE FEEDBACK (Mark as handled, archive, delete)
// ============================================================
router.post('/contractors/me/feedback/:id/handle', async (req: Request, res: Response) => {
  try {
    const { id: feedback_id } = req.params;
    const { action, notes } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validActions = ['mark_handled', 'archive', 'delete'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Valid: ${validActions.join(', ')}` });
    }

    let updateQuery = '';
    let updateParams: any[] = [];

    switch (action) {
      case 'mark_handled':
        updateQuery = `
          UPDATE cc_contractor_feedback SET
            is_handled = true,
            handled_at = now(),
            handled_by_individual_id = $1,
            handler_notes = $2,
            updated_at = now()
          WHERE id = $3 AND to_party_id = $4
          RETURNING *`;
        updateParams = [actor.individual_id, notes, feedback_id, actor.actor_party_id];
        break;
      
      case 'archive':
        updateQuery = `
          UPDATE cc_contractor_feedback SET
            archived_at = now(),
            updated_at = now()
          WHERE id = $1 AND to_party_id = $2
          RETURNING *`;
        updateParams = [feedback_id, actor.actor_party_id];
        break;
      
      case 'delete':
        updateQuery = `
          UPDATE cc_contractor_feedback SET
            contractor_deleted_at = now(),
            contractor_delete_reason = $1,
            updated_at = now()
          WHERE id = $2 AND to_party_id = $3
          RETURNING *`;
        updateParams = [notes || 'Deleted by contractor', feedback_id, actor.actor_party_id];
        break;
    }

    const result = await pool.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found or not authorized' });
    }

    res.json({
      feedback: result.rows[0],
      action,
      message: action === 'delete' 
        ? 'Feedback deleted. This is your right.' 
        : `Feedback ${action.replace('_', ' ')}.`
    });
  } catch (error) {
    console.error('Error handling feedback:', error);
    res.status(500).json({ error: 'Failed to handle feedback' });
  }
});

// ============================================================
// GET PENDING APPRECIATIONS (Contractor)
// ============================================================
router.get('/contractors/me/appreciations/pending', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT pa.*, wr.title as work_request_title
       FROM cc_public_appreciations pa
       LEFT JOIN cc_work_requests wr ON pa.work_request_id = wr.id
       WHERE pa.to_party_id = $1 
         AND pa.is_public = false 
         AND pa.hidden_by_contractor = false
       ORDER BY pa.created_at DESC`,
      [actor.actor_party_id]
    );

    res.json({
      pending_appreciations: result.rows,
      count: result.rows.length,
      note: 'These snippets are waiting for your approval to go public.'
    });
  } catch (error) {
    console.error('Error fetching pending appreciations:', error);
    res.status(500).json({ error: 'Failed to fetch appreciations' });
  }
});

// ============================================================
// PROMOTE APPRECIATION TO PUBLIC (Contractor)
// ============================================================
router.post('/contractors/me/appreciations/:id/promote', async (req: Request, res: Response) => {
  try {
    const { id: appreciation_id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE cc_public_appreciations SET
        is_public = true,
        made_public_at = now()
       WHERE id = $1 AND to_party_id = $2 AND is_public = false
       RETURNING *`,
      [appreciation_id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Appreciation not found, not yours, or already public' 
      });
    }

    await pool.query(
      `UPDATE cc_trust_signals SET
        public_appreciation_count = COALESCE(public_appreciation_count, 0) + 1,
        last_updated = now()
       WHERE party_id = $1 AND model = 'v1_agg'`,
      [actor.actor_party_id]
    );

    res.json({
      appreciation: result.rows[0],
      message: 'Appreciation is now public. Thank you for sharing!'
    });
  } catch (error) {
    console.error('Error promoting appreciation:', error);
    res.status(500).json({ error: 'Failed to promote appreciation' });
  }
});

// ============================================================
// HIDE PUBLIC APPRECIATION (Contractor)
// ============================================================
router.post('/contractors/me/appreciations/:id/hide', async (req: Request, res: Response) => {
  try {
    const { id: appreciation_id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE cc_public_appreciations SET
        hidden_by_contractor = true,
        hidden_at = now()
       WHERE id = $1 AND to_party_id = $2
       RETURNING *`,
      [appreciation_id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appreciation not found or not yours' });
    }

    if (result.rows[0].is_public) {
      await pool.query(
        `UPDATE cc_trust_signals SET
          public_appreciation_count = GREATEST(COALESCE(public_appreciation_count, 0) - 1, 0),
          last_updated = now()
         WHERE party_id = $1 AND model = 'v1_agg'`,
        [actor.actor_party_id]
      );
    }

    res.json({
      appreciation: result.rows[0],
      hidden: true,
      message: 'Appreciation hidden from public view.'
    });
  } catch (error) {
    console.error('Error hiding appreciation:', error);
    res.status(500).json({ error: 'Failed to hide appreciation' });
  }
});

// ============================================================
// ADD COMMUNITY VERIFICATION (Contractor)
// ============================================================
router.post('/contractors/me/community-verification', async (req: Request, res: Response) => {
  try {
    const { community_name, community_type, verification_method, verification_notes } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!community_name) {
      return res.status(400).json({ error: 'community_name required' });
    }

    await pool.query(
      `INSERT INTO cc_community_verifications (
        party_id, community_name, community_type,
        verification_method, verification_notes
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (party_id, community_name) DO UPDATE SET
        verification_method = EXCLUDED.verification_method,
        verification_notes = EXCLUDED.verification_notes,
        verified_at = now()`,
      [
        actor.actor_party_id,
        community_name,
        community_type,
        verification_method || 'self_reported',
        verification_notes
      ]
    );

    await pool.query(
      `UPDATE cc_trust_signals SET
        verified_communities = (
          SELECT array_agg(DISTINCT community_name)
          FROM cc_community_verifications
          WHERE party_id = $1
        ),
        last_updated = now()
       WHERE party_id = $1 AND model = 'v1_agg'`,
      [actor.actor_party_id]
    );

    res.json({
      message: 'Community verification added.',
      community: community_name
    });
  } catch (error) {
    console.error('Error adding community verification:', error);
    res.status(500).json({ error: 'Failed to add verification' });
  }
});

// ============================================================
// RECOMPUTE TRUST SIGNALS (Contractor)
// ============================================================
router.post('/contractors/me/trust-signals/recompute', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const signals = await computeTrustSignals(actor.actor_party_id);
    await saveTrustSignals(signals);
    const display = formatTrustDisplay(signals);

    res.json({
      cc_trust_signals: signals,
      display,
      message: 'Trust signals recomputed successfully.',
      computed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recomputing trust signals:', error);
    res.status(500).json({ error: 'Failed to recompute trust signals' });
  }
});

export default router;

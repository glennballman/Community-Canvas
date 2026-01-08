import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';

const router = Router();

// ============================================================
// SEND PRIVATE FEEDBACK (Owner → Contractor)
// ============================================================
router.post('/work-requests/:id/private-feedback', async (req: Request, res: Response) => {
  try {
    const { id: work_request_id } = req.params;
    const { 
      content, 
      quality_rating, 
      communication_rating, 
      timeliness_rating,
      conversation_id 
    } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback content required' });
    }

    const client = await pool.connect();
    try {
      const wrResult = await client.query(
        `SELECT wr.id, c.contractor_party_id, c.id as conversation_id
         FROM cc_work_requests wr
         LEFT JOIN cc_conversations c ON c.work_request_id = wr.id
         WHERE wr.id = $1
         ORDER BY c.created_at DESC LIMIT 1`,
        [work_request_id]
      );

      if (wrResult.rows.length === 0) {
        return res.status(404).json({ error: 'Work request not found' });
      }

      const wr = wrResult.rows[0];
      
      if (!wr.contractor_party_id) {
        return res.status(400).json({ error: 'No contractor associated with this work request' });
      }

      const settingsResult = await client.query(
        `SELECT accepts_private_feedback, blocked_party_ids 
         FROM cc_contractor_feedback_settings 
         WHERE party_id = $1`,
        [wr.contractor_party_id]
      );

      const settings = settingsResult.rows[0];
      if (settings?.accepts_private_feedback === false) {
        return res.status(400).json({ error: 'Contractor is not accepting feedback at this time' });
      }

      if (settings?.blocked_party_ids?.includes(actor.actor_party_id)) {
        return res.status(201).json({ 
          feedback: { id: 'accepted' }, 
          message: 'Feedback sent' 
        });
      }

      const result = await client.query(
        `INSERT INTO cc_private_feedback (
          work_request_id, conversation_id,
          from_party_id, from_individual_id,
          to_party_id,
          feedback_type, content,
          quality_rating, communication_rating, timeliness_rating
        ) VALUES ($1, $2, $3, $4, $5, 'cc_private_feedback', $6, $7, $8, $9)
        RETURNING *`,
        [
          work_request_id,
          conversation_id || wr.conversation_id,
          actor.actor_party_id,
          actor.individual_id,
          wr.contractor_party_id,
          content,
          quality_rating || null,
          communication_rating || null,
          timeliness_rating || null
        ]
      );

      res.status(201).json({ 
        feedback: result.rows[0],
        message: 'Private feedback sent to contractor'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error sending private feedback:', error);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

// ============================================================
// GET MY RECEIVED FEEDBACK (Contractor View)
// ============================================================
router.get('/feedback/received', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { include_deleted = 'false', include_archived = 'false' } = req.query;

    let query = `
      SELECT pf.*, 
             wr.title as work_request_title,
             wr.work_request_ref,
             from_p.trade_name as from_party_name
      FROM cc_private_feedback pf
      JOIN cc_work_requests wr ON pf.work_request_id = wr.id
      LEFT JOIN cc_parties from_p ON pf.from_party_id = from_p.id
      WHERE pf.to_party_id = $1
    `;
    const params: any[] = [actor.actor_party_id];

    if (include_deleted !== 'true') {
      query += ` AND NOT pf.deleted_by_contractor`;
    }

    if (include_archived !== 'true') {
      query += ` AND pf.archived_at IS NULL`;
    }

    query += ` ORDER BY pf.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ 
      feedback: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// ============================================================
// DELETE PRIVATE FEEDBACK (Contractor Right)
// ============================================================
router.delete('/feedback/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hard_delete = 'false' } = req.query;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT * FROM cc_private_feedback WHERE id = $1 AND to_party_id = $2`,
        [id, actor.actor_party_id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      if (hard_delete === 'true') {
        await client.query(`DELETE FROM cc_private_feedback WHERE id = $1`, [id]);
        res.json({ deleted: true, type: 'hard_delete' });
      } else {
        await client.query(
          `UPDATE cc_private_feedback SET 
            deleted_by_contractor = true, 
            deleted_at = now(),
            content = '[Deleted by contractor]'
           WHERE id = $1`,
          [id]
        );
        res.json({ deleted: true, type: 'soft_delete' });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// ============================================================
// ARCHIVE FEEDBACK (Contractor)
// ============================================================
router.post('/feedback/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE cc_private_feedback SET archived_at = now(), updated_at = now()
       WHERE id = $1 AND to_party_id = $2
       RETURNING *`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ feedback: result.rows[0] });
  } catch (error) {
    console.error('Error archiving feedback:', error);
    res.status(500).json({ error: 'Failed to archive feedback' });
  }
});

// ============================================================
// MARK AS READ (Contractor)
// ============================================================
router.post('/feedback/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE cc_private_feedback SET read_at = now(), updated_at = now()
       WHERE id = $1 AND to_party_id = $2 AND read_at IS NULL
       RETURNING *`,
      [id, actor.actor_party_id]
    );

    res.json({ feedback: result.rows[0] || null });
  } catch (error) {
    console.error('Error marking feedback read:', error);
    res.status(500).json({ error: 'Failed to mark feedback read' });
  }
});

// ============================================================
// GET FEEDBACK SETTINGS (Contractor)
// ============================================================
router.get('/feedback/settings', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT * FROM cc_contractor_feedback_settings WHERE party_id = $1`,
      [actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        settings: {
          party_id: actor.actor_party_id,
          accepts_private_feedback: true,
          accepts_appreciation_requests: true,
          auto_archive_after_days: 30,
          blocked_party_ids: [],
          notify_on_feedback: true,
          notify_on_appreciation: true
        }
      });
    }

    res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Error fetching feedback settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ============================================================
// UPDATE FEEDBACK SETTINGS (Contractor)
// ============================================================
router.put('/feedback/settings', async (req: Request, res: Response) => {
  try {
    const { 
      accepts_private_feedback,
      accepts_appreciation_requests,
      auto_archive_after_days,
      notify_on_feedback,
      notify_on_appreciation
    } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `INSERT INTO cc_contractor_feedback_settings (
        party_id, accepts_private_feedback, accepts_appreciation_requests,
        auto_archive_after_days, notify_on_feedback, notify_on_appreciation
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (party_id) DO UPDATE SET
        accepts_private_feedback = COALESCE($2, cc_contractor_feedback_settings.accepts_private_feedback),
        accepts_appreciation_requests = COALESCE($3, cc_contractor_feedback_settings.accepts_appreciation_requests),
        auto_archive_after_days = COALESCE($4, cc_contractor_feedback_settings.auto_archive_after_days),
        notify_on_feedback = COALESCE($5, cc_contractor_feedback_settings.notify_on_feedback),
        notify_on_appreciation = COALESCE($6, cc_contractor_feedback_settings.notify_on_appreciation),
        updated_at = now()
      RETURNING *`,
      [
        actor.actor_party_id,
        accepts_private_feedback,
        accepts_appreciation_requests,
        auto_archive_after_days,
        notify_on_feedback,
        notify_on_appreciation
      ]
    );

    res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Error updating feedback settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================================
// BLOCK OWNER FROM SENDING FEEDBACK (Contractor)
// ============================================================
router.post('/feedback/block/:party_id', async (req: Request, res: Response) => {
  try {
    const { party_id: block_party_id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `INSERT INTO cc_contractor_feedback_settings (party_id, blocked_party_ids)
       VALUES ($1, ARRAY[$2]::uuid[])
       ON CONFLICT (party_id) DO UPDATE SET
         blocked_party_ids = array_append(
           COALESCE(cc_contractor_feedback_settings.blocked_party_ids, ARRAY[]::uuid[]),
           $2::uuid
         ),
         updated_at = now()
       RETURNING *`,
      [actor.actor_party_id, block_party_id]
    );

    res.json({ settings: result.rows[0], blocked: block_party_id });
  } catch (error) {
    console.error('Error blocking party:', error);
    res.status(500).json({ error: 'Failed to block party' });
  }
});

// ============================================================
// UNBLOCK OWNER (Contractor)
// ============================================================
router.delete('/feedback/block/:party_id', async (req: Request, res: Response) => {
  try {
    const { party_id: unblock_party_id } = req.params;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `UPDATE cc_contractor_feedback_settings SET
         blocked_party_ids = array_remove(blocked_party_ids, $2::uuid),
         updated_at = now()
       WHERE party_id = $1
       RETURNING *`,
      [actor.actor_party_id, unblock_party_id]
    );

    res.json({ settings: result.rows[0], unblocked: unblock_party_id });
  } catch (error) {
    console.error('Error unblocking party:', error);
    res.status(500).json({ error: 'Failed to unblock party' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { resolveActorParty } from '../lib/partyResolver';

const router = Router();

/**
 * PAYMENT SYSTEM PHILOSOPHY
 * 
 * - Tracking and communication, NOT enforcement
 * - Work never stops because of payment status
 * - Honor system by default
 * - Both cc_parties can always unlock contact
 * - Write-offs are contractor-private
 * - Multiple promises per conversation (one active)
 * 
 * Schema note: payer_party_id = owner, payee_party_id = contractor
 */

function mapPayerPayee(promise: any, actorPartyId: string) {
  return {
    ...promise,
    owner_party_id: promise.payer_party_id,
    contractor_party_id: promise.payee_party_id,
    my_role: promise.payer_party_id === actorPartyId ? 'owner' : 'contractor'
  };
}

router.post('/cc_conversations/:id/payment-promise', async (req: Request, res: Response) => {
  try {
    const { id: conversation_id } = req.params;
    const {
      total_amount,
      currency = 'CAD',
      deposit_amount,
      deposit_method,
      milestones,
      materials_separate,
      owner_notes,
      honor_system_note
    } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({ error: 'total_amount required and must be positive' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const convResult = await client.query(
        `SELECT * FROM cc_conversations WHERE id = $1 AND owner_party_id = $2`,
        [conversation_id, actor.actor_party_id]
      );

      if (convResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversation not found or not authorized' });
      }

      const conv = convResult.rows[0];

      await client.query(
        `UPDATE cc_payment_promises SET 
          is_active = false, 
          archived_at = now(), 
          archived_reason = 'Superseded by new promise'
         WHERE conversation_id = $1 AND is_active = true`,
        [conversation_id]
      );

      const promiseResult = await client.query(
        `INSERT INTO cc_payment_promises (
          conversation_id, 
          payer_party_id, payee_party_id,
          total_amount, currency,
          deposit_amount, deposit_method,
          materials_separate,
          owner_notes, honor_system_note,
          status, communication_status, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::payment_method, $8, $9, $10, 'pending', 'on_track', true)
        RETURNING *`,
        [
          conversation_id,
          actor.actor_party_id,
          conv.contractor_party_id,
          total_amount,
          currency,
          deposit_amount || 0,
          deposit_method || 'etransfer',
          materials_separate || false,
          owner_notes,
          honor_system_note || 'Payment on the honor system. We work it out together.'
        ]
      );

      const promise = promiseResult.rows[0];

      if (milestones && Array.isArray(milestones) && milestones.length > 0) {
        for (let i = 0; i < milestones.length; i++) {
          const ms = milestones[i];
          await client.query(
            `INSERT INTO cc_payment_milestones (
              payment_promise_id,
              name, description,
              amount, method,
              trigger_type, trigger_description,
              due_date, sequence_order,
              status, communication_status
            ) VALUES ($1, $2, $3, $4, $5::payment_method, $6::milestone_trigger, $7, $8, $9, 'pending', 'on_track')`,
            [
              promise.id,
              ms.name || `Payment ${i + 1}`,
              ms.description || null,
              ms.amount,
              ms.method || deposit_method || 'etransfer',
              ms.trigger_type || 'manual',
              ms.trigger_description || null,
              ms.due_date || null,
              ms.sequence_order || i + 1
            ]
          );
        }
      } else if (deposit_amount > 0) {
        await client.query(
          `INSERT INTO cc_payment_milestones (
            payment_promise_id,
            name, amount, method,
            trigger_type, sequence_order,
            status, communication_status
          ) VALUES ($1, 'Deposit', $2, $3::payment_method, 'on_award', 1, 'pending', 'on_track')`,
          [promise.id, deposit_amount, deposit_method || 'etransfer']
        );

        if (total_amount > deposit_amount) {
          await client.query(
            `INSERT INTO cc_payment_milestones (
              payment_promise_id,
              name, amount, method,
              trigger_type, sequence_order,
              status, communication_status
            ) VALUES ($1, 'Final Payment', $2, $3::payment_method, 'on_completion', 2, 'pending', 'on_track')`,
            [promise.id, total_amount - deposit_amount, deposit_method || 'etransfer']
          );
        }
      } else {
        await client.query(
          `INSERT INTO cc_payment_milestones (
            payment_promise_id,
            name, amount, method,
            trigger_type, sequence_order,
            status, communication_status
          ) VALUES ($1, 'Full Payment', $2, $3::payment_method, 'on_completion', 1, 'pending', 'on_track')`,
          [promise.id, total_amount, deposit_method || 'etransfer']
        );
      }

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id, actor_party_id, actor_individual_id, actor_role,
          event_type, amount, message
        ) VALUES ($1, $2, $3, 'owner', 'promise_created', $4, $5)`,
        [
          promise.id, actor.actor_party_id, actor.individual_id, 
          total_amount,
          'Payment promise created. Honor system - we work it out together.'
        ]
      );

      await client.query(
        `INSERT INTO cc_messages (
          conversation_id, sender_party_id, sender_individual_id,
          message_type, content, structured_data
        ) VALUES ($1, $2, $3, 'payment', $4, $5)`,
        [
          conversation_id,
          actor.actor_party_id,
          actor.individual_id,
          `Payment promise: $${parseFloat(total_amount).toLocaleString()} ${currency}`,
          JSON.stringify({ type: 'payment_promise', promise_id: promise.id, amount: total_amount })
        ]
      );

      await client.query('COMMIT');

      const milestonesResult = await pool.query(
        `SELECT * FROM cc_payment_milestones WHERE payment_promise_id = $1 ORDER BY sequence_order, created_at`,
        [promise.id]
      );

      res.status(201).json({
        payment_promise: mapPayerPayee(promise, actor.actor_party_id),
        milestones: milestonesResult.rows,
        message: 'Payment promise created. Honor system - no hard gates, just tracking.'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating payment promise:', error);
    res.status(500).json({ error: 'Failed to create payment promise' });
  }
});

router.get('/cc_conversations/:id/payment-promise', async (req: Request, res: Response) => {
  try {
    const { id: conversation_id } = req.params;
    const { include_archived = 'false' } = req.query;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const convResult = await pool.query(
      `SELECT * FROM cc_conversations WHERE id = $1
       AND (owner_party_id = $2 OR contractor_party_id = $2)`,
      [conversation_id, actor.actor_party_id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = convResult.rows[0];
    const isOwner = conv.owner_party_id === actor.actor_party_id;

    let promiseQuery = `
      SELECT pp.*, 
             payer_p.trade_name as owner_name,
             payee_p.trade_name as contractor_name
       FROM cc_payment_promises pp
       LEFT JOIN cc_parties payer_p ON pp.payer_party_id = payer_p.id
       LEFT JOIN cc_parties payee_p ON pp.payee_party_id = payee_p.id
       WHERE pp.conversation_id = $1
    `;
    
    if (include_archived !== 'true') {
      promiseQuery += ` AND pp.is_active = true`;
    }
    
    promiseQuery += ` ORDER BY pp.created_at DESC`;

    const promiseResult = await pool.query(promiseQuery, [conversation_id]);

    if (promiseResult.rows.length === 0) {
      return res.json({ payment_promise: null, milestones: [], recent_events: [] });
    }

    const promise = promiseResult.rows[0];

    let milestonesQuery = `
      SELECT id, payment_promise_id, name, description, amount, method,
             trigger_type, trigger_description, due_date, sequence_order,
             status, communication_status, 
             owner_message, owner_message_at,
             contractor_acknowledged, contractor_response,
             extended_to, extension_reason,
             partial_amount, partial_date, remaining_amount,
             payment_notes, payment_reference, paid_at,
             verified_at, created_at, updated_at
    `;

    if (!isOwner) {
      milestonesQuery += `, written_off, written_off_amount, written_off_reason, written_off_at`;
    }

    milestonesQuery += `
       FROM cc_payment_milestones 
       WHERE payment_promise_id = $1 
       ORDER BY sequence_order, created_at
    `;

    const milestonesResult = await pool.query(milestonesQuery, [promise.id]);

    let eventsQuery = `
      SELECT * FROM cc_payment_events 
      WHERE payment_promise_id = $1
    `;
    
    if (isOwner) {
      eventsQuery += ` AND is_private = false`;
    }
    
    eventsQuery += ` ORDER BY created_at DESC LIMIT 20`;

    const eventsResult = await pool.query(eventsQuery, [promise.id]);

    res.json({
      payment_promise: mapPayerPayee(promise, actor.actor_party_id),
      milestones: milestonesResult.rows,
      recent_events: eventsResult.rows,
      my_role: isOwner ? 'owner' : 'contractor'
    });

  } catch (error) {
    console.error('Error fetching payment promise:', error);
    res.status(500).json({ error: 'Failed to fetch payment promise' });
  }
});

router.post('/payment-milestones/:id/payment-sent', async (req: Request, res: Response) => {
  try {
    const { id: milestone_id } = req.params;
    const { amount, method, reference, message } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const msResult = await client.query(
        `SELECT pm.*, pp.payer_party_id, pp.id as promise_id
         FROM cc_payment_milestones pm
         JOIN cc_payment_promises pp ON pm.payment_promise_id = pp.id
         WHERE pm.id = $1 AND pp.payer_party_id = $2`,
        [milestone_id, actor.actor_party_id]
      );

      if (msResult.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found or not authorized' });
      }

      const milestone = msResult.rows[0];
      const paymentAmount = amount || milestone.amount;

      await client.query(
        `UPDATE cc_payment_milestones SET
          status = 'submitted',
          owner_message = $1,
          owner_message_at = now(),
          updated_at = now()
         WHERE id = $2`,
        [message || 'Payment sent', milestone_id]
      );

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id, milestone_id,
          actor_party_id, actor_individual_id, actor_role,
          event_type, amount, message, proof_reference
        ) VALUES ($1, $2, $3, $4, 'owner', 'payment_sent', $5, $6, $7)`,
        [
          milestone.promise_id, milestone_id,
          actor.actor_party_id, actor.individual_id,
          paymentAmount,
          message || 'Payment sent',
          reference
        ]
      );

      res.json({
        milestone_id,
        status: 'submitted',
        amount: paymentAmount,
        message: 'Payment marked as sent. Awaiting contractor confirmation.',
        note: 'Honor system - we trust each other.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error marking payment sent:', error);
    res.status(500).json({ error: 'Failed to mark payment sent' });
  }
});

router.post('/payment-milestones/:id/payment-received', async (req: Request, res: Response) => {
  try {
    const { id: milestone_id } = req.params;
    const { amount, message, reference } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const msResult = await client.query(
        `SELECT pm.*, pp.payee_party_id, pp.id as promise_id
         FROM cc_payment_milestones pm
         JOIN cc_payment_promises pp ON pm.payment_promise_id = pp.id
         WHERE pm.id = $1 AND pp.payee_party_id = $2`,
        [milestone_id, actor.actor_party_id]
      );

      if (msResult.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found or not authorized' });
      }

      const milestone = msResult.rows[0];
      const receivedAmount = amount || milestone.amount;
      const isPartial = receivedAmount < milestone.amount;

      await client.query(
        `UPDATE cc_payment_milestones SET
          status = $1,
          paid_at = now(),
          payment_reference = $2,
          payment_notes = $3,
          partial_amount = CASE WHEN $4 THEN $5 ELSE NULL END,
          partial_date = CASE WHEN $4 THEN now() ELSE NULL END,
          remaining_amount = CASE WHEN $4 THEN $6 - $5 ELSE 0 END,
          contractor_acknowledged = true,
          contractor_response = $3,
          verified_by_party_id = $7,
          verified_by_individual_id = $8,
          verified_at = now(),
          updated_at = now()
         WHERE id = $9`,
        [
          isPartial ? 'partial' : 'received',
          reference,
          message || 'Payment received',
          isPartial,
          receivedAmount,
          milestone.amount,
          actor.actor_party_id,
          actor.individual_id,
          milestone_id
        ]
      );

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id, milestone_id,
          actor_party_id, actor_individual_id, actor_role,
          event_type, amount, message, proof_reference
        ) VALUES ($1, $2, $3, $4, 'contractor', $5, $6, $7, $8)`,
        [
          milestone.promise_id, milestone_id,
          actor.actor_party_id, actor.individual_id,
          isPartial ? 'payment_partial' : 'payment_received',
          receivedAmount,
          message || 'Payment received',
          reference
        ]
      );

      res.json({
        milestone_id,
        status: isPartial ? 'partial' : 'received',
        amount_received: receivedAmount,
        remaining: isPartial ? milestone.amount - receivedAmount : 0,
        message: isPartial ? 'Partial payment confirmed.' : 'Full payment confirmed.',
        note: 'Thank you for the trust.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

router.post('/payment-milestones/:id/request-extension', async (req: Request, res: Response) => {
  try {
    const { id: milestone_id } = req.params;
    const { new_date, reason, message } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!new_date) {
      return res.status(400).json({ error: 'new_date required' });
    }

    const client = await pool.connect();
    try {
      const msResult = await client.query(
        `SELECT pm.*, pp.payer_party_id, pp.id as promise_id
         FROM cc_payment_milestones pm
         JOIN cc_payment_promises pp ON pm.payment_promise_id = pp.id
         WHERE pm.id = $1 AND pp.payer_party_id = $2`,
        [milestone_id, actor.actor_party_id]
      );

      if (msResult.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found or not authorized' });
      }

      const milestone = msResult.rows[0];

      await client.query(
        `UPDATE cc_payment_milestones SET
          communication_status = 'behind_schedule',
          owner_message = $1,
          owner_message_at = now(),
          updated_at = now()
         WHERE id = $2`,
        [message || `Requesting extension to ${new_date}: ${reason}`, milestone_id]
      );

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id, milestone_id,
          actor_party_id, actor_individual_id, actor_role,
          event_type, message, metadata
        ) VALUES ($1, $2, $3, $4, 'owner', 'extension_requested', $5, $6)`,
        [
          milestone.promise_id, milestone_id,
          actor.actor_party_id, actor.individual_id,
          message || `Extension requested to ${new_date}`,
          JSON.stringify({ new_date, reason })
        ]
      );

      res.json({
        milestone_id,
        requested_date: new_date,
        message: 'Extension request sent.',
        note: 'Life happens. We understand.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error requesting extension:', error);
    res.status(500).json({ error: 'Failed to request extension' });
  }
});

router.post('/payment-milestones/:id/grant-extension', async (req: Request, res: Response) => {
  try {
    const { id: milestone_id } = req.params;
    const { new_date, message } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!new_date) {
      return res.status(400).json({ error: 'new_date required' });
    }

    const client = await pool.connect();
    try {
      const msResult = await client.query(
        `SELECT pm.*, pp.payee_party_id, pp.id as promise_id
         FROM cc_payment_milestones pm
         JOIN cc_payment_promises pp ON pm.payment_promise_id = pp.id
         WHERE pm.id = $1 AND pp.payee_party_id = $2`,
        [milestone_id, actor.actor_party_id]
      );

      if (msResult.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found or not authorized' });
      }

      const milestone = msResult.rows[0];

      await client.query(
        `UPDATE cc_payment_milestones SET
          extended_to = $1,
          extension_reason = $2,
          communication_status = 'on_track',
          contractor_acknowledged = true,
          contractor_response = $2,
          updated_at = now()
         WHERE id = $3`,
        [new_date, message || 'Extension granted', milestone_id]
      );

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id, milestone_id,
          actor_party_id, actor_individual_id, actor_role,
          event_type, message, metadata
        ) VALUES ($1, $2, $3, $4, 'contractor', 'extension_granted', $5, $6)`,
        [
          milestone.promise_id, milestone_id,
          actor.actor_party_id, actor.individual_id,
          message || 'Extension granted',
          JSON.stringify({ new_date })
        ]
      );

      res.json({
        milestone_id,
        new_date,
        message: 'Extension granted.',
        note: 'Relationships matter. Thank you for working together.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error granting extension:', error);
    res.status(500).json({ error: 'Failed to grant extension' });
  }
});

router.post('/payment-promises/:id/community-event', async (req: Request, res: Response) => {
  try {
    const { id: promise_id } = req.params;
    const { event_description, message } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const promiseResult = await client.query(
        `SELECT * FROM cc_payment_promises 
         WHERE id = $1 AND (payer_party_id = $2 OR payee_party_id = $2)`,
        [promise_id, actor.actor_party_id]
      );

      if (promiseResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment promise not found' });
      }

      const promise = promiseResult.rows[0];
      const actorRole = promise.payer_party_id === actor.actor_party_id ? 'owner' : 'contractor';

      await client.query(
        `UPDATE cc_payment_promises SET
          affected_by_community_event = true,
          community_event_description = $1,
          communication_status = 'community_event',
          updated_at = now()
         WHERE id = $2`,
        [event_description, promise_id]
      );

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id,
          actor_party_id, actor_individual_id, actor_role,
          event_type, message
        ) VALUES ($1, $2, $3, $4, 'community_event_noted', $5)`,
        [
          promise_id,
          actor.actor_party_id, actor.individual_id, actorRole,
          message || 'Community event: ' + event_description
        ]
      );

      res.json({
        promise_id,
        message: 'Community event noted. Everyone understands.',
        note: 'Communities support each other.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error noting community event:', error);
    res.status(500).json({ error: 'Failed to note community event' });
  }
});

router.post('/payment-milestones/:id/write-off', async (req: Request, res: Response) => {
  try {
    const { id: milestone_id } = req.params;
    const { amount, reason } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const msResult = await client.query(
        `SELECT pm.*, pp.payee_party_id, pp.id as promise_id
         FROM cc_payment_milestones pm
         JOIN cc_payment_promises pp ON pm.payment_promise_id = pp.id
         WHERE pm.id = $1 AND pp.payee_party_id = $2`,
        [milestone_id, actor.actor_party_id]
      );

      if (msResult.rows.length === 0) {
        return res.status(404).json({ error: 'Milestone not found or not authorized' });
      }

      const milestone = msResult.rows[0];
      const writeOffAmount = amount || milestone.remaining_amount || milestone.amount;

      await client.query(
        `UPDATE cc_payment_milestones SET
          written_off = true,
          written_off_amount = $1,
          written_off_reason = $2,
          written_off_at = now(),
          status = 'verified',
          communication_status = 'written_off',
          remaining_amount = 0,
          updated_at = now()
         WHERE id = $3`,
        [writeOffAmount, reason || 'Written off', milestone_id]
      );

      await client.query(
        `INSERT INTO cc_payment_events (
          payment_promise_id, milestone_id,
          actor_party_id, actor_individual_id, actor_role,
          event_type, amount, message, is_private
        ) VALUES ($1, $2, $3, $4, 'contractor', 'written_off', $5, $6, true)`,
        [
          milestone.promise_id, milestone_id,
          actor.actor_party_id, actor.individual_id,
          writeOffAmount,
          reason || 'Contractor absorbed this amount'
        ]
      );

      res.json({
        milestone_id,
        written_off_amount: writeOffAmount,
        message: 'Amount written off. For your records only.',
        note: 'This is private. Does not affect owner view or public reputation.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error writing off:', error);
    res.status(500).json({ error: 'Failed to write off' });
  }
});

router.post('/cc_conversations/:id/contractor-unlock-contact', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const convResult = await client.query(
        `SELECT * FROM cc_conversations WHERE id = $1 AND contractor_party_id = $2`,
        [id, actor.actor_party_id]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found or not authorized' });
      }

      if (convResult.rows[0].contact_unlocked) {
        return res.json({ 
          conversation: convResult.rows[0], 
          contact_unlocked: true,
          message: 'Contact already unlocked'
        });
      }

      const result = await client.query(
        `UPDATE cc_conversations SET
          contact_unlocked = true,
          contact_unlocked_at = now(),
          contact_unlock_gate = 'contractor_override',
          contact_unlock_reason = $1,
          updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [reason || 'Contractor approved contact sharing', id]
      );

      await client.query(
        `INSERT INTO cc_messages (
          conversation_id, sender_party_id, sender_individual_id,
          message_type, content, visibility
        ) VALUES ($1, $2, $3, 'system', 'Contact information is now shared.', 'normal')`,
        [id, actor.actor_party_id, actor.individual_id]
      );

      res.json({ 
        conversation: result.rows[0],
        contact_unlocked: true,
        note: 'Both cc_parties can always unlock. No payment gate.'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error unlocking contact:', error);
    res.status(500).json({ error: 'Failed to unlock contact' });
  }
});

router.get('/community-cc_events/active', async (req: Request, res: Response) => {
  try {
    const { region, postal_prefix } = req.query;

    let query = `SELECT * FROM cc_community_events WHERE ongoing = true`;
    const params: any[] = [];

    if (region) {
      params.push(region);
      query += ` AND $${params.length} = ANY(affected_regions)`;
    }

    if (postal_prefix) {
      params.push(postal_prefix);
      query += ` AND $${params.length} = ANY(affected_postal_prefixes)`;
    }

    query += ` ORDER BY start_date DESC`;

    const result = await pool.query(query, params);

    res.json({
      cc_community_events: result.rows,
      message: result.rows.length > 0 
        ? 'Active cc_events may affect timelines. Flexibility expected.'
        : 'No active community cc_events.'
    });
  } catch (error) {
    console.error('Error fetching community cc_events:', error);
    res.status(500).json({ error: 'Failed to fetch community cc_events' });
  }
});

export default router;

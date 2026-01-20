import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';
import { resolveActorParty, canUnlockContact } from '../lib/partyResolver';
import { redactContactInfo, shouldBlockMessage } from '../lib/contactRedaction';
import { findOrCreateCircleConversation, fanOutMessageToRecipients } from '../services/messagingRoutingService';
import { getUnreadByConversation } from '../services/unreadMessagingService';

const router = Router();

/**
 * POST /api/conversations/circle
 * Create a new circle conversation with an initial message.
 * Requires validated acting_as_circle context from middleware.
 * 
 * Security: Uses req.ctx.circle_id and req.ctx.acting_as_circle which are 
 * revalidated every request by tenantContext middleware (checks membership 
 * OR active delegation before setting circle context).
 */
router.post('/circle', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    // Use validated context from tenantContext middleware (not raw session)
    const ctx = (req as any).ctx;
    const circleId = ctx?.circle_id;
    const actingAsCircle = ctx?.acting_as_circle;
    const individualId = ctx?.individual_id || (req as any).individual_id;
    const tenantId = ctx?.tenant_id || (req as any).tenant_id;
    
    // Security: These values come from tenantContext middleware which revalidates
    // circle membership on every request (direct member OR active delegation)
    if (!actingAsCircle || !circleId) {
      return res.status(403).json({ 
        error: 'Must be acting as a circle with valid membership to create circle conversations' 
      });
    }
    
    if (!individualId) {
      return res.status(401).json({ error: 'Individual context required' });
    }
    
    const { subject, message } = req.body;
    
    // Input validation
    const trimmedSubject = subject?.trim();
    const trimmedMessage = message?.trim();
    
    if (!trimmedSubject || !trimmedMessage) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    
    if (trimmedSubject.length > 500) {
      return res.status(400).json({ error: 'Subject too long (max 500 characters)' });
    }
    
    if (trimmedMessage.length > 10000) {
      return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
    }
    
    // Use single transaction for all operations
    await client.query('BEGIN');
    
    // Set GUCs for the transaction
    await client.query(`SELECT set_config('app.current_individual_id', $1, true)`, [individualId]);
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId || '']);
    
    // Create conversation
    const convResult = await client.query(`
      INSERT INTO cc_conversations (subject, status, created_at, updated_at)
      VALUES ($1, 'active', now(), now())
      RETURNING id
    `, [trimmedSubject]);
    
    const conversationId = convResult.rows[0].id as string;
    
    // Add circle as participant
    await client.query(`
      INSERT INTO cc_conversation_participants (
        conversation_id, participant_type, circle_id, is_active, joined_at
      )
      VALUES ($1, 'circle', $2, true, now())
    `, [conversationId, circleId]);
    
    // Add the creating individual as a participant (for tracking the initiator)
    await client.query(`
      INSERT INTO cc_conversation_participants (
        conversation_id, participant_type, individual_id, is_active, joined_at
      )
      VALUES ($1, 'individual', $2, true, now())
    `, [conversationId, individualId]);
    
    // Create the initial message
    const msgResult = await client.query(`
      INSERT INTO cc_messages (
        conversation_id, 
        sender_individual_id, 
        message_type, 
        content, 
        visibility,
        created_at
      )
      VALUES ($1, $2, 'normal', $3, 'normal', now())
      RETURNING id, created_at
    `, [conversationId, individualId, trimmedMessage]);
    
    await client.query('COMMIT');
    
    // Fan out notification to circle members (best-effort, after commit)
    try {
      await fanOutMessageToRecipients(
        conversationId,
        msgResult.rows[0].id,
        individualId
      );
    } catch (fanoutErr) {
      console.error('[CircleConversation] Fan-out notification failed:', fanoutErr);
      // Continue - message was saved, notification is best-effort
    }
    
    res.status(201).json({
      success: true,
      conversation_id: conversationId,
      message_id: msgResult.rows[0].id,
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating circle conversation:', error);
    res.status(500).json({ error: 'Failed to create circle conversation' });
  } finally {
    client.release();
  }
});

router.post('/cc_conversations', async (req: Request, res: Response) => {
  try {
    const work_request_id = req.body.work_request_id || req.body.opportunity_id;

    if (!work_request_id) {
      return res.status(400).json({ error: 'work_request_id required' });
    }

    const contractor = await resolveActorParty(req, 'contractor');
    if (!contractor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const wrResult = await client.query(
        `SELECT wr.id, wr.owner_tenant_id, wr.title
         FROM cc_work_requests wr
         WHERE wr.id = $1`,
        [work_request_id]
      );

      if (wrResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Work request not found' });
      }

      const wr = wrResult.rows[0];

      if (!wr.owner_tenant_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Work request has no owner' });
      }

      let ownerPartyResult = await client.query(
        `SELECT id FROM cc_parties
         WHERE tenant_id = $1 AND party_kind = 'organization'
         ORDER BY created_at ASC LIMIT 1`,
        [wr.owner_tenant_id]
      );

      let ownerPartyId = ownerPartyResult.rows[0]?.id;

      if (!ownerPartyId) {
        const ownerTenantResult = await client.query(
          `SELECT name, email, telephone FROM tenants WHERE id = $1`,
          [wr.owner_tenant_id]
        );
        const ownerTenant = ownerTenantResult.rows[0];

        if (!ownerTenant?.name) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Owner tenant not found' });
        }

        const createOwnerResult = await client.query(
          `INSERT INTO cc_parties (tenant_id, party_kind, party_type, status, legal_name, trade_name, primary_contact_email, primary_contact_telephone)
           VALUES ($1, 'organization', 'owner', 'active', $2, $2, $3, $4)
           RETURNING id`,
          [wr.owner_tenant_id, ownerTenant.name, ownerTenant.email, ownerTenant.telephone]
        );
        ownerPartyId = createOwnerResult.rows[0].id;
      }

      if (contractor.actor_party_id === ownerPartyId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot start conversation with yourself' });
      }

      const existingResult = await client.query(
        `SELECT * FROM cc_conversations
         WHERE work_request_id = $1 AND contractor_party_id = $2`,
        [work_request_id, contractor.actor_party_id]
      );

      if (existingResult.rows.length > 0) {
        await client.query('COMMIT');
        return res.json({ 
          conversation: existingResult.rows[0], 
          created: false,
          actor: {
            party_id: contractor.actor_party_id,
            individual_id: contractor.individual_id,
            display_name: contractor.display_name
          }
        });
      }

      const priorResult = await client.query(
        `SELECT 1 FROM cc_conversations
         WHERE contractor_party_id = $1 AND owner_party_id = $2
           AND state = 'completed'
         LIMIT 1`,
        [contractor.actor_party_id, ownerPartyId]
      );
      const hasPriorRelationship = priorResult.rows.length > 0;

      const createResult = await client.query(
        `INSERT INTO cc_conversations (
          work_request_id,
          contractor_party_id, owner_party_id,
          contractor_actor_party_id, owner_actor_party_id,
          state,
          contact_unlocked, contact_unlock_gate, contact_unlock_reason
        ) VALUES ($1, $2, $3, $4, $5, 'interest', $6, $7, $8)
        RETURNING *`,
        [
          work_request_id,
          contractor.actor_party_id,
          ownerPartyId,
          contractor.actor_party_id,
          ownerPartyId,
          hasPriorRelationship,
          hasPriorRelationship ? 'prior_relationship' : 'none',
          hasPriorRelationship ? 'Prior completed work together' : null
        ]
      );

      const conversation = createResult.rows[0];

      await client.query(
        `INSERT INTO cc_messages (
          conversation_id, sender_party_id, sender_individual_id,
          message_type, content, visibility
        ) VALUES ($1, NULL, NULL, 'system', $2, 'normal')`,
        [
          conversation.id,
          hasPriorRelationship 
            ? 'Conversation started. Contact details are available (prior relationship).'
            : 'Conversation started. Contact details will be shared after deposit is confirmed.'
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({ 
        conversation, 
        created: true,
        actor: {
          party_id: contractor.actor_party_id,
          individual_id: contractor.individual_id,
          display_name: contractor.display_name
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/cc_conversations', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const work_request_id = req.query.work_request_id || req.query.opportunity_id;
    const { state, limit = '50' } = req.query;

    let query = `
      SELECT c.*,
             wr.title as work_request_title,
             wr.work_request_ref,
             wr.work_category,
             wr.owner_type,
             owner_p.trade_name as owner_name,
             contractor_p.trade_name as contractor_name,
             (SELECT content FROM cc_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
      FROM cc_conversations c
      JOIN cc_work_requests wr ON c.work_request_id = wr.id
      LEFT JOIN cc_parties owner_p ON c.owner_party_id = owner_p.id
      LEFT JOIN cc_parties contractor_p ON c.contractor_party_id = contractor_p.id
      WHERE (c.owner_party_id = $1 OR c.contractor_party_id = $1)
    `;
    const params: any[] = [actor.actor_party_id];

    if (work_request_id) {
      params.push(work_request_id);
      query += ` AND c.work_request_id = $${params.length}`;
    }

    if (state) {
      params.push(state);
      query += ` AND c.state = $${params.length}::conversation_state`;
    }

    query += ` ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`;

    params.push(parseInt(limit as string));
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    const cc_conversations = result.rows.map(c => ({
      ...c,
      my_role: c.owner_party_id === actor.actor_party_id ? 'owner' : 'contractor',
      unread_count: c.owner_party_id === actor.actor_party_id ? c.unread_owner : c.unread_contractor
    }));

    res.json({ 
      cc_conversations,
      count: cc_conversations.length,
      actor: {
        party_id: actor.actor_party_id,
        individual_id: actor.individual_id,
        display_name: actor.display_name
      }
    });
  } catch (error) {
    console.error('Error fetching cc_conversations:', error);
    res.status(500).json({ error: 'Failed to fetch cc_conversations' });
  }
});

router.get('/cc_conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = await resolveActorParty(req, 'contractor');

    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT c.*,
              wr.title as work_request_title,
              wr.work_request_ref,
              wr.work_category,
              wr.site_address,
              wr.owner_type,
              wr.budget_ceiling,
              owner_p.trade_name as owner_name,
              owner_p.primary_contact_email as owner_email,
              owner_p.primary_contact_phone as owner_phone,
              contractor_p.trade_name as contractor_name,
              contractor_p.primary_contact_email as contractor_email,
              contractor_p.primary_contact_phone as contractor_phone
       FROM cc_conversations c
       JOIN cc_work_requests wr ON c.work_request_id = wr.id
       LEFT JOIN cc_parties owner_p ON c.owner_party_id = owner_p.id
       LEFT JOIN cc_parties contractor_p ON c.contractor_party_id = contractor_p.id
       WHERE c.id = $1
         AND (c.owner_party_id = $2 OR c.contractor_party_id = $2)`,
      [id, actor.actor_party_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conv = result.rows[0];
    const isOwner = conv.owner_party_id === actor.actor_party_id;

    const response: any = {
      ...conv,
      my_role: isOwner ? 'owner' : 'contractor',
      unread_count: isOwner ? conv.unread_owner : conv.unread_contractor
    };

    if (!conv.contact_unlocked) {
      if (isOwner) {
        delete response.contractor_email;
        delete response.contractor_phone;
      } else {
        delete response.owner_email;
        delete response.owner_phone;
      }
    }

    res.json({ 
      conversation: response,
      actor: {
        party_id: actor.actor_party_id,
        individual_id: actor.individual_id,
        display_name: actor.display_name
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.get('/cc_conversations/:id/contact-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actor = await resolveActorParty(req, 'contractor');

    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const convResult = await pool.query(
      `SELECT * FROM cc_conversations WHERE id = $1
       AND (owner_party_id = $2 OR contractor_party_id = $2)`,
      [id, actor.actor_party_id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const unlockStatus = await canUnlockContact(id);

    res.json({
      contact_unlocked: convResult.rows[0].contact_unlocked,
      contact_unlock_gate: convResult.rows[0].contact_unlock_gate,
      contact_unlocked_at: convResult.rows[0].contact_unlocked_at,
      can_unlock: unlockStatus.canUnlock,
      unlock_gate: unlockStatus.gate,
      reason: unlockStatus.reason
    });
  } catch (error) {
    console.error('Error checking contact status:', error);
    res.status(500).json({ error: 'Failed to check contact status' });
  }
});

router.post('/cc_conversations/:id/cc_messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, message_type = 'text', structured_data, attachments } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const convResult = await client.query(
        `SELECT * FROM cc_conversations WHERE id = $1`,
        [id]
      );

      if (convResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const conversation = convResult.rows[0];

      if (conversation.owner_party_id !== actor.actor_party_id &&
          conversation.contractor_party_id !== actor.actor_party_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Not authorized for this conversation' });
      }

      const isOwner = conversation.owner_party_id === actor.actor_party_id;

      let finalContent = content;
      let wasRedacted = false;
      let redactedContent: string | null = null;
      let redactionReason: string | null = null;
      let detectedItems: any[] = [];

      if (!conversation.contact_unlocked) {
        const recentRedactions = await client.query(
          `SELECT COUNT(*) as count FROM cc_message_redactions
           WHERE conversation_id = $1 
             AND sender_party_id = $2
             AND created_at > now() - interval '1 hour'`,
          [id, actor.actor_party_id]
        );

        const blockCheck = shouldBlockMessage(id, parseInt(recentRedactions.rows[0].count));

        const redaction = redactContactInfo(content);
        
        if (redaction.wasRedacted) {
          wasRedacted = true;
          finalContent = redaction.cleanContent;
          redactedContent = redaction.originalContent;
          detectedItems = redaction.detectedItems;
          redactionReason = blockCheck.reason || 'Contact details are shared after deposit is confirmed';

          await client.query(
            `INSERT INTO cc_message_redactions (
              message_id, conversation_id, 
              sender_party_id, sender_individual_id,
              original_content, detected_items
            ) VALUES (NULL, $1, $2, $3, $4, $5)`,
            [
              id,
              actor.actor_party_id,
              actor.individual_id,
              redaction.originalContent,
              JSON.stringify(detectedItems)
            ]
          );
        }
      }

      const msgResult = await client.query(
        `INSERT INTO cc_messages (
          conversation_id, 
          sender_party_id, sender_individual_id,
          message_type, content,
          structured_data, attachments,
          was_redacted, redacted_content, redaction_reason
        ) VALUES ($1, $2, $3, $4::message_type, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          id,
          actor.actor_party_id,
          actor.individual_id,
          message_type,
          finalContent,
          structured_data ? JSON.stringify(structured_data) : null,
          attachments ? JSON.stringify(attachments) : null,
          wasRedacted,
          redactedContent,
          redactionReason
        ]
      );

      const message = msgResult.rows[0];

      if (wasRedacted) {
        await client.query(
          `UPDATE cc_message_redactions SET message_id = $1
           WHERE conversation_id = $2 AND message_id IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [message.id, id]
        );
      }

      await client.query(
        `UPDATE cc_conversations SET
          last_message_at = now(),
          last_message_id = $1,
          message_count = message_count + 1,
          unread_owner = CASE WHEN $2 THEN unread_owner ELSE unread_owner + 1 END,
          unread_contractor = CASE WHEN $2 THEN unread_contractor + 1 ELSE unread_contractor END,
          updated_at = now()
         WHERE id = $3`,
        [message.id, isOwner, id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: {
          ...message,
          sender_role: isOwner ? 'owner' : 'contractor'
        },
        wasRedacted,
        redactionNotice: wasRedacted
          ? 'Contact information was protected. Contact details are shared after deposit is confirmed.'
          : null,
        detectedItems: wasRedacted ? detectedItems.map(d => d.type) : []
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/cc_conversations/:id/cc_messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', before, after } = req.query;
    
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      const convResult = await client.query(
        `SELECT * FROM cc_conversations WHERE id = $1
         AND (owner_party_id = $2 OR contractor_party_id = $2)`,
        [id, actor.actor_party_id]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const conversation = convResult.rows[0];
      const isOwner = conversation.owner_party_id === actor.actor_party_id;

      let query = `
        SELECT m.*,
               ind.full_name as sender_name,
               ind.preferred_name as sender_preferred_name,
               p.trade_name as sender_party_name,
               CASE 
                 WHEN m.sender_party_id = $2 THEN 'me'
                 WHEN m.sender_party_id IS NULL THEN 'system'
                 ELSE 'them'
               END as sender_role
        FROM cc_messages m
        LEFT JOIN cc_individuals ind ON m.sender_individual_id = ind.id
        LEFT JOIN cc_parties p ON m.sender_party_id = p.id
        WHERE m.conversation_id = $1
          AND m.deleted_at IS NULL
          AND m.visibility != 'hidden'
      `;
      const params: any[] = [id, actor.actor_party_id];

      if (before) {
        params.push(before);
        query += ` AND m.created_at < $${params.length}`;
      }

      if (after) {
        params.push(after);
        query += ` AND m.created_at > $${params.length}`;
      }

      params.push(parseInt(limit as string));
      query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

      const result = await client.query(query, params);

      const unreadField = isOwner ? 'unread_owner' : 'unread_contractor';
      await client.query(
        `UPDATE cc_conversations SET ${unreadField} = 0, updated_at = now() WHERE id = $1`,
        [id]
      );

      await client.query(
        `UPDATE cc_messages SET read_at = now()
         WHERE conversation_id = $1
           AND sender_party_id != $2
           AND read_at IS NULL`,
        [id, actor.actor_party_id]
      );

      const cc_messages = result.rows.reverse().map(m => ({
        ...m,
        sender_display_name: m.sender_preferred_name || m.sender_name || m.sender_party_name || 'System'
      }));

      res.json({ 
        cc_messages,
        count: cc_messages.length,
        contact_unlocked: conversation.contact_unlocked,
        has_more: result.rows.length === parseInt(limit as string)
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching cc_messages:', error);
    res.status(500).json({ error: 'Failed to fetch cc_messages' });
  }
});

router.patch('/cc_conversations/:id/state', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { state } = req.body;

    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validStates = [
      'interest', 'pre_bid', 'negotiation', 'awarded_pending',
      'contracted', 'in_progress', 'completed', 'closed', 'cancelled'
    ];

    if (!validStates.includes(state)) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const convResult = await client.query(
        `SELECT * FROM cc_conversations WHERE id = $1`,
        [id]
      );

      if (convResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const conversation = convResult.rows[0];
      const isOwner = conversation.owner_party_id === actor.actor_party_id;

      if (state === 'awarded_pending' && !isOwner) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Only owner can award' });
      }

      const unlockStatus = await canUnlockContact(id);

      const result = await client.query(
        `UPDATE cc_conversations SET
          state = $1::conversation_state,
          state_changed_at = now(),
          contact_unlocked = CASE WHEN $2 THEN true ELSE contact_unlocked END,
          contact_unlocked_at = CASE WHEN $2 AND NOT contact_unlocked THEN now() ELSE contact_unlocked_at END,
          contact_unlock_gate = CASE WHEN $2 AND NOT contact_unlocked THEN $3::contact_unlock_gate ELSE contact_unlock_gate END,
          contact_unlock_reason = CASE WHEN $2 AND NOT contact_unlocked THEN $4 ELSE contact_unlock_reason END,
          updated_at = now()
         WHERE id = $5
         RETURNING *`,
        [
          state,
          unlockStatus.canUnlock && !conversation.contact_unlocked,
          unlockStatus.gate,
          unlockStatus.reason,
          id
        ]
      );

      await client.query(
        `INSERT INTO cc_messages (
          conversation_id, sender_party_id, sender_individual_id,
          message_type, content
        ) VALUES ($1, $2, $3, 'system', $4)`,
        [
          id,
          actor.actor_party_id,
          actor.individual_id,
          `Status updated: ${state.replace(/_/g, ' ')}`
        ]
      );

      await client.query('COMMIT');

      res.json({ 
        conversation: result.rows[0],
        contact_unlocked: result.rows[0].contact_unlocked
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating state:', error);
    res.status(500).json({ error: 'Failed to update state' });
  }
});

/**
 * GET /api/conversations
 * 
 * Unified conversations endpoint that includes:
 * - Traditional party-based conversations (work requests)
 * - Circle conversations when acting_as_circle=true
 * 
 * Uses RLS through tenant context GUCs for circle visibility.
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const actor = await resolveActorParty(req, 'contractor');
    const tenantReq = req as any;
    const ctx = tenantReq.ctx || {};
    const isActingAsCircle = ctx.acting_as_circle && ctx.circle_id;
    
    // Collect all conversations
    const allConversations: any[] = [];
    
    // 1. Traditional party-based conversations
    if (actor) {
      const { state, limit = '50' } = req.query;
      
      let query = `
        SELECT c.id, c.work_request_id as opportunity_id,
               wr.title as opportunity_title,
               wr.work_request_ref as opportunity_ref,
               wr.work_category,
               wr.intake_mode,
               owner_p.trade_name as owner_name,
               contractor_p.trade_name as contractor_name,
               c.state,
               c.contact_unlocked,
               c.last_message_at,
               c.unread_owner,
               c.unread_contractor,
               c.owner_party_id,
               c.contractor_party_id,
               (SELECT content FROM cc_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview,
               'party' as conversation_type
        FROM cc_conversations c
        JOIN cc_work_requests wr ON c.work_request_id = wr.id
        LEFT JOIN cc_parties owner_p ON c.owner_party_id = owner_p.id
        LEFT JOIN cc_parties contractor_p ON c.contractor_party_id = contractor_p.id
        WHERE (c.owner_party_id = $1 OR c.contractor_party_id = $1)
      `;
      const params: any[] = [actor.actor_party_id];
      
      if (state && typeof state === 'string') {
        params.push(state);
        query += ` AND c.state = $${params.length}::conversation_state`;
      }
      
      query += ` ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`;
      params.push(parseInt(limit as string));
      query += ` LIMIT $${params.length}`;
      
      const result = await pool.query(query, params);
      
      result.rows.forEach((c: any) => {
        allConversations.push({
          ...c,
          my_role: c.owner_party_id === actor.actor_party_id ? 'owner' : 'contractor',
          unread_count: c.owner_party_id === actor.actor_party_id ? c.unread_owner : c.unread_contractor,
          is_circle_conversation: false,
        });
      });
    }
    
    // 2. Circle conversations (when acting_as_circle)
    if (isActingAsCircle) {
      try {
        // Query circle conversations using the circle participant type
        const circleQuery = `
          SELECT DISTINCT conv.id,
                 conv.subject as opportunity_title,
                 conv.status as state,
                 conv.created_at,
                 conv.updated_at as last_message_at,
                 c.name as circle_name,
                 'circle' as conversation_type
          FROM cc_conversation_participants cp
          JOIN cc_conversations conv ON conv.id = cp.conversation_id
          LEFT JOIN cc_coordination_circles c ON c.id = cp.circle_id
          WHERE cp.participant_type = 'circle'
            AND cp.circle_id = $1
            AND cp.is_active = true
          ORDER BY conv.updated_at DESC
          LIMIT 50
        `;
        
        const circleResult = await pool.query(circleQuery, [ctx.circle_id]);
        
        circleResult.rows.forEach((c: any) => {
          allConversations.push({
            id: c.id,
            opportunity_id: null,
            opportunity_title: c.opportunity_title || `Circle: ${c.circle_name}`,
            opportunity_ref: null,
            owner_name: c.circle_name,
            contractor_name: null,
            state: c.state || 'active',
            contact_unlocked: true,
            last_message_at: c.last_message_at,
            last_message_preview: null,
            my_role: 'circle_member',
            unread_count: 0,
            is_circle_conversation: true,
            circle_name: c.circle_name,
          });
        });
      } catch (circleErr) {
        // Circle tables may not exist in all environments
        console.error('Error fetching circle conversations:', circleErr);
      }
    }
    
    // Sort by most recent activity
    allConversations.sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });
    
    // Apply unified unread counts from shared service
    const tenantId = ctx.tenant_id || tenantReq.tenant_id;
    const individualId = ctx.individual_id || tenantReq.individual_id || actor?.individual_id;
    const partyId = actor?.actor_party_id || null;
    
    if (tenantId && individualId && allConversations.length > 0) {
      try {
        const unreadMap = await getUnreadByConversation(pool, {
          tenantId,
          individualId,
          partyId,
        });
        
        // Apply unread counts to each conversation
        for (const conv of allConversations) {
          conv.unread_count = unreadMap[conv.id] ?? 0;
        }
      } catch (unreadErr) {
        console.error('Error fetching unread counts:', unreadErr);
        // Keep existing unread_count values on error
      }
    }
    
    res.json({
      conversations: allConversations,
      count: allConversations.length,
      acting_as_circle: isActingAsCircle,
      circle_id: isActingAsCircle ? ctx.circle_id : null,
      actor: actor ? {
        party_id: actor.actor_party_id,
        individual_id: actor.individual_id,
        display_name: actor.display_name,
      } : null,
    });
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.post('/cc_conversations/:id/unlock-contact', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, gate = 'owner_override' } = req.body;

    const actor = await resolveActorParty(req, 'owner');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const convResult = await client.query(
        `SELECT * FROM cc_conversations WHERE id = $1 AND owner_party_id = $2`,
        [id, actor.actor_party_id]
      );

      if (convResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversation not found or not authorized' });
      }

      const conversation = convResult.rows[0];

      if (conversation.contact_unlocked) {
        await client.query('ROLLBACK');
        return res.json({ 
          already_unlocked: true, 
          contact_unlocked_at: conversation.contact_unlocked_at 
        });
      }

      const result = await client.query(
        `UPDATE cc_conversations SET
          contact_unlocked = true,
          contact_unlocked_at = now(),
          contact_unlock_gate = $1::contact_unlock_gate,
          contact_unlock_reason = $2,
          updated_at = now()
         WHERE id = $3
         RETURNING *`,
        [gate, reason || 'Owner manually unlocked contact', id]
      );

      await client.query(
        `INSERT INTO cc_messages (
          conversation_id, sender_party_id, sender_individual_id,
          message_type, content, visibility
        ) VALUES ($1, NULL, NULL, 'system', 'Contact details are now available.', 'normal')`,
        [id]
      );

      await client.query('COMMIT');

      res.json({
        conversation: result.rows[0],
        contact_unlocked: true,
        message: 'Contact details are now available to both cc_parties.'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error unlocking contact:', error);
    res.status(500).json({ error: 'Failed to unlock contact' });
  }
});

/**
 * POST /api/conversations/cc_conversations/:id/mark-read
 * 
 * Explicitly marks a conversation as read for the authenticated participant.
 * Resets unread counter and updates read_at on messages.
 * 
 * Security: Caller must be a participant (owner or contractor) in the conversation.
 */
router.post('/cc_conversations/:id/mark-read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const actor = await resolveActorParty(req, 'contractor');
    if (!actor) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const client = await pool.connect();
    try {
      // Verify participant access
      const convResult = await client.query(
        `SELECT id, owner_party_id, contractor_party_id 
         FROM cc_conversations 
         WHERE id = $1
           AND (owner_party_id = $2 OR contractor_party_id = $2)`,
        [id, actor.actor_party_id]
      );

      if (convResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found or not authorized' });
      }

      const conversation = convResult.rows[0];
      const isOwner = conversation.owner_party_id === actor.actor_party_id;
      const unreadField = isOwner ? 'unread_owner' : 'unread_contractor';

      // Reset unread counter for this side
      await client.query(
        `UPDATE cc_conversations SET ${unreadField} = 0, updated_at = now() WHERE id = $1`,
        [id]
      );

      // Mark messages from other party as read
      const readResult = await client.query(
        `UPDATE cc_messages SET read_at = now()
         WHERE conversation_id = $1
           AND sender_party_id != $2
           AND read_at IS NULL
         RETURNING id`,
        [id, actor.actor_party_id]
      );

      res.json({ 
        ok: true, 
        marked_read: readResult.rows.length,
        conversation_id: id
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error marking conversation read:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

export default router;

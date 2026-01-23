/**
 * V3.5 Message Action Blocks - Route Handler
 * 
 * POST /api/messages/:messageId/action
 * Executes an action on a message's action_block.
 * 
 * Security:
 * - Requires authentication via session
 * - Verifies actor is a participant in the conversation
 * - Enforces MarketMode policy server-side
 * - Records audit trail for all state transitions
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';
import { resolveActorParty } from '../lib/partyResolver';
import {
  ActionRequestSchema,
  ActionBlockV1Schema,
  ActionBlockState,
  isValidStateTransition,
  mapActionToState,
  isActionBlockExpired,
  ActionBlockV1,
} from '../schemas/actionBlocks';
import { ensureMarketActionAllowed } from '../policy/marketModePolicy';

const router = Router();

interface ActorContext {
  party_id: string;
  individual_id?: string;
  tenant_id?: string;
  actor_party_id?: string;
}

const messageIdSchema = z.string().uuid();

router.post('/:messageId/action', async (req: Request, res: Response) => {
  try {
    const messageIdResult = messageIdSchema.safeParse(req.params.messageId);
    if (!messageIdResult.success) {
      return res.status(400).json({
        ok: false,
        error: { code: 'invalid_request', message: 'Invalid message ID format' }
      });
    }
    const messageId = messageIdResult.data;

    const bodyResult = ActionRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'invalid_request', 
          message: 'Invalid request body',
          details: bodyResult.error.issues 
        }
      });
    }
    const { action, payload, idempotencyKey } = bodyResult.data;

    const actor = await resolveActorParty(req, 'contractor') as ActorContext | null;
    if (!actor) {
      return res.status(401).json({
        ok: false,
        error: { code: 'unauthenticated', message: 'Authentication required' }
      });
    }

    const actorPartyId = actor.actor_party_id || actor.party_id;
    const actorIndividualId = actor.individual_id;

    const messageResult = await serviceQuery(`
      SELECT 
        m.id,
        m.conversation_id,
        m.action_block,
        m.action_block_idempotency_key,
        c.contractor_party_id,
        c.owner_party_id,
        c.state as conversation_state,
        c.contact_unlocked
      FROM cc_messages m
      JOIN cc_conversations c ON c.id = m.conversation_id
      WHERE m.id = $1
    `, [messageId]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { code: 'not_found', message: 'Message not found' }
      });
    }

    const message = messageResult.rows[0];
    const conversationId = message.conversation_id;
    const contractorPartyId = message.contractor_party_id;
    const ownerPartyId = message.owner_party_id;

    const isContractor = actorPartyId === contractorPartyId;
    const isOwner = actorPartyId === ownerPartyId;

    if (!isContractor && !isOwner) {
      const participantCheck = await serviceQuery(`
        SELECT 1 FROM cc_conversation_participants
        WHERE conversation_id = $1
        AND (party_id = $2 OR individual_id = $3)
        AND is_active = true
        LIMIT 1
      `, [conversationId, actorPartyId, actorIndividualId || null]);

      if (participantCheck.rows.length === 0) {
        return res.status(403).json({
          ok: false,
          error: { code: 'forbidden_not_participant', message: 'Not authorized for this conversation' }
        });
      }
    }

    if (!message.action_block) {
      return res.status(409).json({
        ok: false,
        error: { code: 'no_action_block', message: 'Message has no action block' }
      });
    }

    const actionBlockResult = ActionBlockV1Schema.safeParse(message.action_block);
    if (!actionBlockResult.success) {
      return res.status(409).json({
        ok: false,
        error: { code: 'invalid_action_block', message: 'Action block is malformed' }
      });
    }

    const actionBlock = actionBlockResult.data;

    if (idempotencyKey && message.action_block_idempotency_key === idempotencyKey) {
      return res.json({
        ok: true,
        message_id: messageId,
        conversation_id: conversationId,
        action_block: actionBlock,
        idempotent: true
      });
    }

    if (actionBlock.state !== 'pending') {
      return res.status(409).json({
        ok: false,
        error: { code: 'action_block_already_resolved', message: `Action block already ${actionBlock.state}` }
      });
    }

    if (isActionBlockExpired(actionBlock)) {
      const expiredBlock: ActionBlockV1 = { ...actionBlock, state: 'expired' };
      
      await serviceQuery(`
        UPDATE cc_messages 
        SET action_block = $2, action_block_updated_at = now()
        WHERE id = $1
      `, [messageId, JSON.stringify(expiredBlock)]);

      return res.status(409).json({
        ok: false,
        error: { code: 'action_block_expired', message: 'Action block has expired' }
      });
    }

    const newState = mapActionToState(action);

    if (!isValidStateTransition(actionBlock.state as ActionBlockState, newState)) {
      return res.status(409).json({
        ok: false,
        error: { 
          code: 'invalid_state_transition', 
          message: `Cannot transition from ${actionBlock.state} to ${newState}` 
        }
      });
    }

    const actorRole = isOwner ? 'requester' : 'provider';
    const actionIdForPolicy = action === 'accept' ? 'accept_request' 
                            : action === 'decline' ? 'decline_request'
                            : action === 'propose' ? 'propose_change'
                            : action;

    const marketCheck = ensureMarketActionAllowed({
      actorRole: actorRole as 'requester' | 'provider',
      marketMode: 'TARGETED',
      visibility: 'PRIVATE',
      actionId: actionIdForPolicy as any,
      objectType: actionBlock.domain as any,
      objectStatus: 'AWAITING_RESPONSE',
      hasTargetProvider: true,
      hasActiveProposal: false,
    });

    if (!marketCheck.allowed) {
      return res.status(409).json({
        ok: false,
        error: { 
          code: 'marketmode_action_blocked', 
          message: marketCheck.reason || 'Action not allowed by market mode policy' 
        }
      });
    }

    const updatedBlock: ActionBlockV1 = {
      ...actionBlock,
      state: newState,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE cc_messages 
        SET 
          action_block = $2,
          action_block_updated_at = now(),
          action_block_idempotency_key = $3
        WHERE id = $1
      `, [messageId, JSON.stringify(updatedBlock), idempotencyKey || null]);

      await client.query(`
        INSERT INTO cc_message_action_events (
          message_id,
          conversation_id,
          actor_party_id,
          actor_individual_id,
          action,
          from_state,
          to_state,
          idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        messageId,
        conversationId,
        actorPartyId,
        actorIndividualId || null,
        action,
        actionBlock.state,
        newState,
        idempotencyKey || null
      ]);

      await client.query('COMMIT');

      return res.json({
        ok: true,
        message_id: messageId,
        conversation_id: conversationId,
        action_block: updatedBlock,
        idempotent: false
      });

    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[MessageActions] Error processing action:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'internal_error', message: 'Internal server error' }
    });
  }
});

router.get('/:messageId/action-block', async (req: Request, res: Response) => {
  try {
    const messageIdResult = messageIdSchema.safeParse(req.params.messageId);
    if (!messageIdResult.success) {
      return res.status(400).json({
        ok: false,
        error: { code: 'invalid_request', message: 'Invalid message ID format' }
      });
    }
    const messageId = messageIdResult.data;

    const actor = await resolveActorParty(req, 'contractor') as ActorContext | null;
    if (!actor) {
      return res.status(401).json({
        ok: false,
        error: { code: 'unauthenticated', message: 'Authentication required' }
      });
    }

    const actorPartyId = actor.actor_party_id || actor.party_id;

    const result = await serviceQuery(`
      SELECT 
        m.id,
        m.conversation_id,
        m.action_block,
        m.action_block_updated_at,
        c.contractor_party_id,
        c.owner_party_id
      FROM cc_messages m
      JOIN cc_conversations c ON c.id = m.conversation_id
      WHERE m.id = $1
        AND (c.contractor_party_id = $2 OR c.owner_party_id = $2)
    `, [messageId, actorPartyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { code: 'not_found', message: 'Message not found or not accessible' }
      });
    }

    const message = result.rows[0];

    return res.json({
      ok: true,
      message_id: messageId,
      conversation_id: message.conversation_id,
      action_block: message.action_block,
      action_block_updated_at: message.action_block_updated_at
    });

  } catch (error) {
    console.error('[MessageActions] Error fetching action block:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'internal_error', message: 'Internal server error' }
    });
  }
});

export default router;

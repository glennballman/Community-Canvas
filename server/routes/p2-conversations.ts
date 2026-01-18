import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';

const router = Router();

/**
 * Validate circle access for tenant.
 * Circle is accessible if:
 * 1. Circle's hub_tenant_id matches the tenant, OR
 * 2. Tenant has an active membership in that circle
 */
async function validateCircleAccess(circleId: string, tenantId: string): Promise<boolean> {
  try {
    const result = await serviceQuery(`
      SELECT cc.id 
      FROM cc_coordination_circles cc
      WHERE cc.id = $1
        AND (
          cc.hub_tenant_id = $2
          OR EXISTS (
            SELECT 1 FROM cc_circle_members cm
            WHERE cm.circle_id = cc.id
              AND cm.tenant_id = $2
              AND cm.is_active = true
          )
        )
      LIMIT 1
    `, [circleId, tenantId]);
    return result.rows.length > 0;
  } catch (e) {
    console.error('[P2 Conversations] Circle access validation error:', e);
    return false;
  }
}

/**
 * GET /api/p2/conversations
 * 
 * Returns conversations scoped to the current tenant.
 * Circle-aware: If circleId is provided or acting_as_circle, filters by circle.
 * Only returns conversations where circle_id is either:
 *   - the active circle context (validated), or
 *   - null (tenant-wide)
 * 
 * Security: 
 * - Tenant scoped via session/middleware
 * - Circle access validated against hub_tenant_id or membership
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;
    const tenantId = ctx?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
      });
    }

    const circleIdParam = String(req.query.circleId || '').trim() || null;
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    // Determine effective circle context
    // ctx.acting_as_circle + ctx.circle_id is already validated by tenantContext middleware
    let effectiveCircleId: string | null = null;
    
    if (ctx?.acting_as_circle && ctx.circle_id) {
      // Trust middleware-validated circle context
      effectiveCircleId = ctx.circle_id;
    } else if (circleIdParam) {
      // Query param requires explicit validation
      const hasAccess = await validateCircleAccess(circleIdParam, tenantId);
      if (!hasAccess) {
        return res.status(403).json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'No access to specified circle' }
        });
      }
      effectiveCircleId = circleIdParam;
    }

    const allConversations: any[] = [];

    // 1. Work request-based conversations (tenant-scoped)
    const workRequestConvs = await serviceQuery(`
      SELECT 
        c.id,
        c.work_request_id,
        wr.title,
        c.state,
        c.last_message_at,
        c.message_count,
        c.contact_unlocked,
        c.owner_party_id,
        c.contractor_party_id,
        owner_p.trade_name as owner_name,
        contractor_p.trade_name as contractor_name,
        (
          SELECT m.content
          FROM cc_messages m 
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message_preview,
        c.unread_owner,
        c.unread_contractor,
        NULL::uuid as circle_id,
        NULL::text as circle_name,
        'work_request' as conversation_type
      FROM cc_conversations c
      JOIN cc_work_requests wr ON c.work_request_id = wr.id
      LEFT JOIN cc_parties owner_p ON c.owner_party_id = owner_p.id
      LEFT JOIN cc_parties contractor_p ON c.contractor_party_id = contractor_p.id
      WHERE wr.owner_tenant_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
      LIMIT $2
    `, [tenantId, limit]);

    workRequestConvs.rows.forEach((c: any) => {
      allConversations.push({
        id: c.id,
        work_request_id: c.work_request_id,
        title: c.title,
        state: c.state,
        last_message_at: c.last_message_at,
        last_message_preview: c.last_message_preview,
        message_count: c.message_count,
        contact_unlocked: c.contact_unlocked,
        owner_name: c.owner_name,
        contractor_name: c.contractor_name,
        unread_owner: c.unread_owner,
        unread_contractor: c.unread_contractor,
        circle_id: null,
        circle_name: null,
        conversation_type: 'work_request',
      });
    });

    // 2. Circle conversations (if circle context is active and validated)
    if (effectiveCircleId) {
      try {
        const circleConvs = await serviceQuery(`
          SELECT DISTINCT 
            conv.id,
            conv.subject as title,
            conv.status as state,
            conv.updated_at as last_message_at,
            cp.circle_id,
            cc.name as circle_name,
            (
              SELECT m.content
              FROM cc_messages m 
              WHERE m.conversation_id = conv.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ) as last_message_preview,
            0 as unread_count,
            'circle' as conversation_type
          FROM cc_conversation_participants cp
          JOIN cc_conversations conv ON conv.id = cp.conversation_id
          JOIN cc_coordination_circles cc ON cc.id = cp.circle_id
          WHERE cp.participant_type = 'circle'
            AND cp.circle_id = $1
            AND cp.is_active = true
          ORDER BY conv.updated_at DESC
          LIMIT $2
        `, [effectiveCircleId, limit]);

        circleConvs.rows.forEach((c: any) => {
          allConversations.push({
            id: c.id,
            work_request_id: null,
            title: c.title || `Circle: ${c.circle_name}`,
            state: c.state || 'active',
            last_message_at: c.last_message_at,
            last_message_preview: c.last_message_preview,
            message_count: 0,
            contact_unlocked: true,
            owner_name: c.circle_name,
            contractor_name: null,
            unread_owner: 0,
            unread_contractor: 0,
            circle_id: c.circle_id,
            circle_name: c.circle_name,
            conversation_type: 'circle',
          });
        });
      } catch (circleErr) {
        console.error('[P2 Conversations] Circle query error:', circleErr);
      }
    }

    // Sort by most recent activity
    allConversations.sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ 
      ok: true, 
      conversations: allConversations.slice(0, limit),
      circle_id: effectiveCircleId,
      acting_as_circle: !!ctx?.acting_as_circle,
    });
  } catch (e: any) {
    console.error('[P2 Conversations] List error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

/**
 * GET /api/p2/conversations/:id
 * 
 * Returns single conversation with messages.
 * Validates the conversation belongs to the tenant (via work_request or circle participant).
 * Messages ordered ASC (oldest→newest).
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;
    const tenantId = ctx?.tenant_id;
    const circleId = ctx?.acting_as_circle ? ctx.circle_id : null;

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
      });
    }

    // Try work_request-based conversation first
    let convResult = await serviceQuery(`
      SELECT 
        c.*,
        wr.title,
        wr.work_request_ref,
        wr.work_category,
        wr.site_address,
        wr.owner_type,
        owner_p.trade_name as owner_name,
        contractor_p.trade_name as contractor_name,
        NULL::uuid as circle_id,
        NULL::text as circle_name,
        'work_request' as conversation_type
      FROM cc_conversations c
      JOIN cc_work_requests wr ON c.work_request_id = wr.id
      LEFT JOIN cc_parties owner_p ON c.owner_party_id = owner_p.id
      LEFT JOIN cc_parties contractor_p ON c.contractor_party_id = contractor_p.id
      WHERE c.id = $1
        AND wr.owner_tenant_id = $2
      LIMIT 1
    `, [id, tenantId]);

    // If not found and circle context active (middleware-validated), try circle conversation
    if (!convResult.rows.length && circleId) {
      try {
        convResult = await serviceQuery(`
          SELECT 
            conv.*,
            conv.subject as title,
            cp.circle_id,
            cc.name as circle_name,
            'circle' as conversation_type
          FROM cc_conversation_participants cp
          JOIN cc_conversations conv ON conv.id = cp.conversation_id
          JOIN cc_coordination_circles cc ON cc.id = cp.circle_id
          WHERE conv.id = $1
            AND cp.participant_type = 'circle'
            AND cp.circle_id = $2
            AND cp.is_active = true
          LIMIT 1
        `, [id, circleId]);
      } catch (circleErr) {
        console.error('[P2 Conversations] Circle detail query error:', circleErr);
      }
    }

    if (!convResult.rows.length) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    const messagesResult = await serviceQuery(`
      SELECT 
        m.id,
        m.content,
        m.sender_party_id,
        m.sender_individual_id,
        m.message_type,
        m.created_at,
        m.read_at,
        m.was_redacted,
        ind.full_name as sender_name,
        p.trade_name as sender_party_name
      FROM cc_messages m
      LEFT JOIN cc_individuals ind ON m.sender_individual_id = ind.id
      LEFT JOIN cc_parties p ON m.sender_party_id = p.id
      WHERE m.conversation_id = $1
        AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
      LIMIT 500
    `, [id]);

    res.json({
      ok: true,
      conversation: convResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (e: any) {
    console.error('[P2 Conversations] Get error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

/**
 * POST /api/p2/conversations/:id/messages
 * 
 * Validates tenant scope and participant authorization.
 * Requires sender context.
 * Updates conversation updated_at.
 */
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const content = String(req.body?.content || '').trim();

    const tenantReq = req as any;
    const ctx = tenantReq.ctx;
    const tenantId = ctx?.tenant_id;
    const individualId = ctx?.individual_id || tenantReq.individual_id;
    // Only use circle context if middleware-validated
    const circleId = ctx?.acting_as_circle ? ctx.circle_id : null;

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
      });
    }

    if (!content) {
      return res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Content required' }
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get tenant's party for authorization check
      const senderPartyResult = await client.query(`
        SELECT id FROM cc_parties
        WHERE tenant_id = $1 AND party_kind = 'organization'
        ORDER BY created_at ASC
        LIMIT 1
      `, [tenantId]);

      const senderPartyId = senderPartyResult.rows[0]?.id || null;

      // Check work_request-based conversation with participant validation
      let convCheck = await client.query(`
        SELECT c.id, c.owner_party_id, c.contractor_party_id, 'work_request' as conv_type
        FROM cc_conversations c
        JOIN cc_work_requests wr ON c.work_request_id = wr.id
        WHERE c.id = $1
          AND wr.owner_tenant_id = $2
          AND (c.owner_party_id = $3 OR c.contractor_party_id = $3 OR $3 IS NULL)
        LIMIT 1
      `, [id, tenantId, senderPartyId]);

      // If not found and circle context (middleware-validated), check circle conversation
      if (!convCheck.rows.length && circleId) {
        convCheck = await client.query(`
          SELECT conv.id, NULL as owner_party_id, NULL as contractor_party_id, 'circle' as conv_type
          FROM cc_conversation_participants cp
          JOIN cc_conversations conv ON conv.id = cp.conversation_id
          WHERE conv.id = $1
            AND cp.participant_type = 'circle'
            AND cp.circle_id = $2
            AND cp.is_active = true
          LIMIT 1
        `, [id, circleId]);
      }

      if (!convCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found or not authorized' }
        });
      }

      const convType = convCheck.rows[0].conv_type;
      const isOwner = convType === 'work_request' && convCheck.rows[0].owner_party_id === senderPartyId;

      // Insert message with appropriate sender context
      const msgResult = await client.query(`
        INSERT INTO cc_messages (
          conversation_id, 
          sender_party_id, 
          sender_individual_id,
          sender_circle_id,
          message_type, 
          content, 
          created_at
        )
        VALUES ($1, $2, $3, $4, 'text', $5, now())
        RETURNING id, content, created_at
      `, [id, senderPartyId, individualId, convType === 'circle' ? circleId : null, content]);

      // Update conversation metadata
      if (convType === 'work_request') {
        await client.query(`
          UPDATE cc_conversations
          SET updated_at = now(),
              last_message_at = now(),
              last_message_id = $1,
              message_count = COALESCE(message_count, 0) + 1,
              unread_owner = CASE WHEN $2 THEN unread_owner ELSE COALESCE(unread_owner, 0) + 1 END,
              unread_contractor = CASE WHEN $2 THEN COALESCE(unread_contractor, 0) + 1 ELSE unread_contractor END
          WHERE id = $3
        `, [msgResult.rows[0].id, isOwner, id]);
      } else {
        // Circle conversation - just update timestamp
        await client.query(`
          UPDATE cc_conversations
          SET updated_at = now()
          WHERE id = $1
        `, [id]);
      }

      await client.query('COMMIT');

      res.json({
        ok: true,
        message: msgResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error('[P2 Conversations] Send message error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

export default router;

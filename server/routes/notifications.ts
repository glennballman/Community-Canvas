import { Router, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';
import { requireAuth } from '../middleware/guards';

const router = Router();

router.get('/', requireAuth, async (req, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    const tenantId = tenantReq.ctx?.tenant_id;

    if (!individualId) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const status = req.query.status as string || 'all';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const cursor = req.query.cursor as string;

    let query = `
      SELECT 
        id,
        subject,
        body,
        short_body as "shortBody",
        category,
        priority,
        channels,
        action_url as "actionUrl",
        action_label as "actionLabel",
        context_type as "contextType",
        context_id as "contextId",
        status,
        created_at as "createdAt",
        read_at as "readAt",
        sender_name as "senderName"
      FROM cc_notifications
      WHERE (
        recipient_individual_id = $1
        OR recipient_tenant_id = $2
      )
    `;
    const params: any[] = [individualId, tenantId];

    if (status === 'unread') {
      query += ` AND read_at IS NULL AND status != 'cancelled'`;
    } else {
      query += ` AND status != 'cancelled'`;
    }

    if (cursor) {
      params.push(cursor);
      query += ` AND created_at < $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const result = await serviceQuery(query, params);
    const notifications = result.rows.slice(0, limit);
    const hasMore = result.rows.length > limit;
    const nextCursor = hasMore ? notifications[notifications.length - 1]?.createdAt : null;

    const countResult = await serviceQuery(`
      SELECT COUNT(*)::int as count
      FROM cc_notifications
      WHERE (recipient_individual_id = $1 OR recipient_tenant_id = $2)
        AND read_at IS NULL
        AND status != 'cancelled'
    `, [individualId, tenantId]);

    res.json({
      ok: true,
      notifications,
      totalUnread: countResult.rows[0]?.count || 0,
      hasMore,
      nextCursor,
    });
  } catch (error: any) {
    console.error('[Notifications] List error:', error);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Failed to fetch notifications' } });
  }
});

router.post('/:id/read', requireAuth, async (req, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    const tenantId = tenantReq.ctx?.tenant_id;
    const { id } = req.params;

    if (!individualId) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const result = await serviceQuery(`
      UPDATE cc_notifications
      SET read_at = now(), status = 'read', updated_at = now()
      WHERE id = $1
        AND (recipient_individual_id = $2 OR recipient_tenant_id = $3)
        AND read_at IS NULL
      RETURNING id
    `, [id, individualId, tenantId]);

    if (result.rows.length === 0) {
      const existsResult = await serviceQuery(`
        SELECT id FROM cc_notifications WHERE id = $1
      `, [id]);
      
      if (existsResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
      return res.json({ ok: true, alreadyRead: true });
    }

    res.json({ ok: true, markedRead: true });
  } catch (error: any) {
    console.error('[Notifications] Mark read error:', error);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Failed to mark notification as read' } });
  }
});

router.post('/read-all', requireAuth, async (req, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    const tenantId = tenantReq.ctx?.tenant_id;

    if (!individualId) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const result = await serviceQuery(`
      UPDATE cc_notifications
      SET read_at = now(), status = 'read', updated_at = now()
      WHERE (recipient_individual_id = $1 OR recipient_tenant_id = $2)
        AND read_at IS NULL
        AND status != 'cancelled'
      RETURNING id
    `, [individualId, tenantId]);

    res.json({ ok: true, markedCount: result.rows.length });
  } catch (error: any) {
    console.error('[Notifications] Mark all read error:', error);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Failed to mark notifications as read' } });
  }
});

router.get('/count', requireAuth, async (req, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const individualId = tenantReq.ctx?.individual_id;
    const tenantId = tenantReq.ctx?.tenant_id;

    if (!individualId) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const result = await serviceQuery(`
      SELECT COUNT(*)::int as count
      FROM cc_notifications
      WHERE (recipient_individual_id = $1 OR recipient_tenant_id = $2)
        AND read_at IS NULL
        AND status != 'cancelled'
    `, [individualId, tenantId]);

    res.json({ ok: true, unreadCount: result.rows[0]?.count || 0 });
  } catch (error: any) {
    console.error('[Notifications] Count error:', error);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Failed to get notification count' } });
  }
});

export const notificationsRouter = router;

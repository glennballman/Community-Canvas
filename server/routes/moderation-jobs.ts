import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

router.get('/pending', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED',
      message: 'Moderation requires portal context'
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await serviceQuery(`
      SELECT 
        jp.id as posting_id,
        jp.job_id,
        jp.portal_id,
        jp.publish_state,
        jp.posted_at,
        jp.custom_title,
        jp.custom_description,
        j.title,
        j.description,
        j.role_category,
        j.employment_type,
        j.location_text,
        j.brand_name_snapshot,
        j.legal_name_snapshot,
        j.created_at as job_created_at,
        t.name as tenant_name,
        p.name as portal_name,
        p.slug as portal_slug
      FROM cc_job_postings jp
      JOIN cc_jobs j ON j.id = jp.job_id
      JOIN cc_portals p ON p.id = jp.portal_id
      LEFT JOIN cc_tenants t ON t.id = j.tenant_id
      WHERE jp.portal_id = $1
        AND jp.publish_state = 'pending_review'
      ORDER BY jp.posted_at ASC
      LIMIT $2 OFFSET $3
    `, [ctx.portal_id, limit, offset]);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total
      FROM cc_job_postings jp
      WHERE jp.portal_id = $1 AND jp.publish_state = 'pending_review'
    `, [ctx.portal_id]);

    res.json({
      ok: true,
      postings: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('Pending moderation list error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch pending postings'
    });
  }
});

router.post('/:postingId/approve', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const checkResult = await serviceQuery(`
      SELECT id, publish_state FROM cc_job_postings
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND'
      });
    }

    if (checkResult.rows[0].publish_state !== 'pending_review') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: 'Posting is not pending review'
      });
    }

    await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'published',
        published_at = now(),
        reviewed_at = now(),
        reviewed_by_identity_id = $3::uuid,
        rejection_reason = NULL
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id, ctx.individual_id || null]);

    res.json({
      ok: true,
      message: 'Posting approved and published'
    });

  } catch (error: any) {
    console.error('Approve posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to approve posting'
    });
  }
});

router.post('/:postingId/reject', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;
  const { reason } = req.body;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'Rejection reason is required'
    });
  }

  try {
    const checkResult = await serviceQuery(`
      SELECT id, publish_state FROM cc_job_postings
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND'
      });
    }

    if (checkResult.rows[0].publish_state !== 'pending_review') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_STATE',
        message: 'Posting is not pending review'
      });
    }

    await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'rejected',
        reviewed_at = now(),
        reviewed_by_identity_id = $3::uuid,
        rejection_reason = $4
      WHERE id = $1 AND portal_id = $2
    `, [postingId, ctx.portal_id, ctx.individual_id || null, reason.trim()]);

    res.json({
      ok: true,
      message: 'Posting rejected'
    });

  } catch (error: any) {
    console.error('Reject posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to reject posting'
    });
  }
});

router.post('/:postingId/pause', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'paused',
        paused_at = now()
      WHERE id = $1 AND portal_id = $2 AND publish_state = 'published'
      RETURNING id
    `, [postingId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Posting paused'
    });

  } catch (error: any) {
    console.error('Pause posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to pause posting'
    });
  }
});

router.post('/:postingId/resume', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'published',
        paused_at = NULL
      WHERE id = $1 AND portal_id = $2 AND publish_state = 'paused'
      RETURNING id
    `, [postingId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Posting resumed'
    });

  } catch (error: any) {
    console.error('Resume posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to resume posting'
    });
  }
});

router.post('/:postingId/archive', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { postingId } = req.params;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_postings SET
        publish_state = 'archived',
        archived_at = now()
      WHERE id = $1 AND portal_id = $2 AND publish_state IN ('published', 'paused', 'rejected')
      RETURNING id
    `, [postingId, ctx.portal_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'POSTING_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Posting archived'
    });

  } catch (error: any) {
    console.error('Archive posting error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to archive posting'
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.portal_id) {
    return res.status(400).json({
      ok: false,
      error: 'PORTAL_CONTEXT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        publish_state,
        COUNT(*) as count
      FROM cc_job_postings
      WHERE portal_id = $1
      GROUP BY publish_state
    `, [ctx.portal_id]);

    const stats: Record<string, number> = {
      draft: 0,
      pending_review: 0,
      published: 0,
      rejected: 0,
      paused: 0,
      archived: 0
    };

    for (const row of result.rows) {
      stats[row.publish_state] = parseInt(row.count);
    }

    res.json({
      ok: true,
      stats
    });

  } catch (error: any) {
    console.error('Moderation stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch moderation stats'
    });
  }
});

export default router;

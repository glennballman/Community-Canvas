import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

router.post('/ingest-url', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { url } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'url is required'
    });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_URL',
      message: 'url must be a valid URL'
    });
  }

  try {
    const result = await serviceQuery(`
      INSERT INTO cc_job_ingestion_tasks (tenant_id, ingestion_type, source_url, status)
      VALUES ($1, 'url', $2, 'pending')
      RETURNING id
    `, [ctx.tenant_id, url]);

    res.status(201).json({
      ok: true,
      taskId: result.rows[0].id,
      status: 'pending',
      message: 'URL ingestion task created. Poll GET /api/p2/app/jobs/ingestion/:id for status.'
    });

  } catch (error: any) {
    console.error('Ingest URL error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create ingestion task'
    });
  }
});

router.post('/ingest-upload', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { mediaId } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!mediaId || typeof mediaId !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'mediaId is required'
    });
  }

  try {
    const result = await serviceQuery(`
      INSERT INTO cc_job_ingestion_tasks (tenant_id, ingestion_type, source_media_id, status)
      VALUES ($1, 'upload', $2, 'pending')
      RETURNING id
    `, [ctx.tenant_id, mediaId]);

    res.status(201).json({
      ok: true,
      taskId: result.rows[0].id,
      status: 'pending',
      message: 'Upload ingestion task created. Poll GET /api/p2/app/jobs/ingestion/:id for status.'
    });

  } catch (error: any) {
    console.error('Ingest upload error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create ingestion task'
    });
  }
});

router.post('/ai-draft', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { prompt } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'prompt is required and must be at least 10 characters'
    });
  }

  try {
    const result = await serviceQuery(`
      INSERT INTO cc_job_ingestion_tasks (tenant_id, ingestion_type, ai_prompt, status)
      VALUES ($1, 'ai_draft', $2, 'pending')
      RETURNING id
    `, [ctx.tenant_id, prompt.trim()]);

    res.status(201).json({
      ok: true,
      taskId: result.rows[0].id,
      status: 'pending',
      message: 'AI draft task created. Poll GET /api/p2/app/jobs/ingestion/:id for status.'
    });

  } catch (error: any) {
    console.error('AI draft error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create AI draft task'
    });
  }
});

router.get('/ingestion/:id', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT 
        id, ingestion_type, source_url, source_media_id, ai_prompt,
        status, extracted_data, draft_job_data, error_message, job_id,
        created_at, updated_at
      FROM cc_job_ingestion_tasks
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TASK_NOT_FOUND'
      });
    }

    const task = result.rows[0];

    res.json({
      ok: true,
      task: {
        id: task.id,
        ingestionType: task.ingestion_type,
        sourceUrl: task.source_url,
        sourceMediaId: task.source_media_id,
        aiPrompt: task.ai_prompt,
        status: task.status,
        extractedData: task.extracted_data,
        draftJobData: task.draft_job_data,
        errorMessage: task.error_message,
        jobId: task.job_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }
    });

  } catch (error: any) {
    console.error('Get ingestion task error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch ingestion task'
    });
  }
});

router.get('/ingestion', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let whereClause = `WHERE tenant_id = $1`;
    const params: any[] = [ctx.tenant_id];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await serviceQuery(`
      SELECT 
        id, ingestion_type, source_url, source_media_id, ai_prompt,
        status, error_message, job_id, created_at, updated_at
      FROM cc_job_ingestion_tasks
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await serviceQuery(`
      SELECT COUNT(*) as total FROM cc_job_ingestion_tasks ${whereClause}
    `, params.slice(0, -2));

    res.json({
      ok: true,
      tasks: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset
      }
    });

  } catch (error: any) {
    console.error('List ingestion tasks error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list ingestion tasks'
    });
  }
});

router.post('/from-draft', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { draftId, portalIds, embedSurfaceIds } = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  if (!draftId) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'draftId is required'
    });
  }

  try {
    const taskResult = await serviceQuery(`
      SELECT id, status, draft_job_data
      FROM cc_job_ingestion_tasks
      WHERE id = $1 AND tenant_id = $2
    `, [draftId, ctx.tenant_id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'DRAFT_NOT_FOUND'
      });
    }

    const task = taskResult.rows[0];

    if (task.status !== 'draft_ready') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_DRAFT_STATE',
        message: `Draft is in state ${task.status}, expected draft_ready`
      });
    }

    const draftData = task.draft_job_data || {};

    const jobResult = await serviceQuery(`
      INSERT INTO cc_jobs (
        tenant_id, title, role_category, employment_type, description,
        location_text, responsibilities, requirements,
        pay_type, pay_min, pay_max, currency,
        noc_code, occupational_category,
        status, source_type, verification_state
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        'open', 'ingested', 'draft'
      ) RETURNING id
    `, [
      ctx.tenant_id,
      draftData.title || 'Untitled Job',
      draftData.roleCategory || 'general',
      draftData.employmentType || 'full_time',
      draftData.description || '',
      draftData.locationText,
      draftData.responsibilities,
      draftData.requirements,
      draftData.payType,
      draftData.payMin,
      draftData.payMax,
      draftData.currency || 'CAD',
      draftData.nocCode,
      draftData.occupationalCategory
    ]);

    const jobId = jobResult.rows[0].id;

    await serviceQuery(`
      UPDATE cc_job_ingestion_tasks
      SET status = 'approved', job_id = $1, updated_at = now()
      WHERE id = $2
    `, [jobId, draftId]);

    if (portalIds && Array.isArray(portalIds)) {
      for (const portalId of portalIds) {
        await serviceQuery(`
          INSERT INTO cc_job_postings (job_id, portal_id, publish_state)
          VALUES ($1, $2, 'draft')
          ON CONFLICT (job_id, portal_id) DO NOTHING
        `, [jobId, portalId]);
      }
    }

    if (embedSurfaceIds && Array.isArray(embedSurfaceIds)) {
      for (const surfaceId of embedSurfaceIds) {
        await serviceQuery(`
          INSERT INTO cc_job_embed_publications (job_id, embed_surface_id, publish_state)
          VALUES ($1, $2, 'draft')
          ON CONFLICT (job_id, embed_surface_id) DO NOTHING
        `, [jobId, surfaceId]);
      }
    }

    res.status(201).json({
      ok: true,
      jobId,
      message: 'Job created from draft. Use POST /api/p2/app/jobs/:id/postings to publish to portals.'
    });

  } catch (error: any) {
    console.error('Create from draft error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create job from draft'
    });
  }
});

router.post('/ingestion/:id/cancel', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { id } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      UPDATE cc_job_ingestion_tasks
      SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'processing', 'draft_ready')
      RETURNING id
    `, [id, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'TASK_NOT_FOUND_OR_INVALID_STATE'
      });
    }

    res.json({
      ok: true,
      message: 'Ingestion task cancelled'
    });

  } catch (error: any) {
    console.error('Cancel ingestion task error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to cancel ingestion task'
    });
  }
});

export default router;

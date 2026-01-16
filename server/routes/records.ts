import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { serviceQuery } from '../db/tenantDb';
import { fetchAndStoreUrlSnapshot, captureFromSource } from '../lib/records/capture';
import { generateEmergencyRecordPack } from '../lib/records/generatePack';
import { processCaptureQueue, getQueueStats } from '../lib/records/queueWorker';

const router = Router();

const createSourceSchema = z.object({
  source_type: z.enum(['url', 'rss', 'json_feed', 'webhook', 'manual_url_list']),
  title: z.string().min(1),
  description: z.string().optional(),
  base_url: z.string().optional(),
  config: z.record(z.any()).default({}),
  portal_id: z.string().uuid().optional(),
  circle_id: z.string().uuid().optional(),
  client_request_id: z.string().optional(),
});

router.post('/sources', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const data = createSourceSchema.parse(req.body);
    const individualId = req.headers['x-individual-id'] as string;

    const result = await serviceQuery<{ id: string }>(
      `INSERT INTO cc_record_sources (
        tenant_id, source_type, title, description, base_url, config,
        portal_id, circle_id, client_request_id, created_by_individual_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        tenantId,
        data.source_type,
        data.title,
        data.description,
        data.base_url,
        JSON.stringify(data.config),
        data.portal_id,
        data.circle_id,
        data.client_request_id,
        individualId,
      ]
    );

    return res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('Error creating source:', err);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/sources', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const result = await serviceQuery(
      `SELECT id, source_type, title, description, base_url, config, enabled, created_at
       FROM cc_record_sources WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );

    return res.json({ sources: result.rows });
  } catch (err: any) {
    console.error('Error listing sources:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/sources/:id/capture', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const { id: sourceId } = req.params;
    const { run_id, requested_by_individual_id } = req.body;

    const results = await captureFromSource({
      tenantId,
      sourceId,
      runId: run_id,
      requestedBy: requested_by_individual_id || (req.headers['x-individual-id'] as string),
    });

    return res.json({ captures: results });
  } catch (err: any) {
    console.error('Error capturing from source:', err);
    return res.status(400).json({ error: err.message });
  }
});

const captureUrlSchema = z.object({
  run_id: z.string().uuid().optional(),
  url: z.string().url(),
  capture_type: z.enum(['evac_order', 'utility_outage', 'media_article', 'advisory', 'alert', 'generic']).default('generic'),
  include_headers: z.boolean().default(true),
  defer_if_fail: z.boolean().default(false),
  client_request_id: z.string().optional(),
});

router.post('/capture-url', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const data = captureUrlSchema.parse(req.body);
    const individualId = req.headers['x-individual-id'] as string;

    const result = await fetchAndStoreUrlSnapshot({
      tenantId,
      runId: data.run_id,
      url: data.url,
      captureType: data.capture_type,
      includeHeaders: data.include_headers,
      requestedBy: individualId,
      clientRequestId: data.client_request_id,
      deferIfFail: data.defer_if_fail,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error('Error capturing URL:', err);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/queue/process', async (req: Request, res: Response) => {
  try {
    const { limit } = req.body;
    const result = await processCaptureQueue({ limit });
    return res.json(result);
  } catch (err: any) {
    console.error('Error processing queue:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const stats = await getQueueStats(tenantId);
    return res.json(stats);
  } catch (err: any) {
    console.error('Error getting queue stats:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

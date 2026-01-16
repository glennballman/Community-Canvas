/**
 * P2.8 Offline / Low-Signal Evidence Queue + Reconciliation
 * API Routes
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import {
  upsertSyncSession,
  initializeUpload,
  completeUpload,
  ingestBatch,
  sealEvidenceObjects,
  fetchUrlSnapshot,
  type IngestBatch
} from '../lib/offline/ingest';
import { sha256Hex } from '../lib/evidence/custody';

const router = Router();

/**
 * Execute a function with service mode enabled for RLS bypass
 * This is required for offline ingest operations which need write access
 */
async function withServiceMode<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  await db.execute(sql`SELECT set_config('app.service_mode', 'true', false)`);
  await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, false)`);
  try {
    return await fn();
  } finally {
    await db.execute(sql`SELECT set_config('app.service_mode', '', false)`);
  }
}

// ============================================================
// SCHEMAS
// ============================================================

const syncSessionSchema = z.object({
  device_id: z.string().min(1),
  app_version: z.string().optional(),
  circle_id: z.string().uuid().optional(),
  portal_id: z.string().uuid().optional()
});

const uploadInitSchema = z.object({
  device_id: z.string().min(1),
  client_request_id: z.string().min(1),
  content_mime: z.string().optional()
});

const uploadCompleteSchema = z.object({
  device_id: z.string().min(1),
  client_request_id: z.string().min(1),
  r2_key: z.string().min(1),
  content_sha256: z.string().optional()
});

const ingestItemSchema = z.object({
  client_request_id: z.string().min(1),
  local_id: z.string().min(1),
  source_type: z.enum(['manual_note', 'file_r2', 'url_snapshot', 'json_snapshot']),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  created_at_device: z.string().min(1),
  occurred_at_device: z.string().optional().nullable(),
  captured_at_device: z.string().optional().nullable(),
  circle_id: z.string().uuid().optional().nullable(),
  portal_id: z.string().uuid().optional().nullable(),
  content_sha256: z.string().optional().nullable(),
  content_mime: z.string().optional().nullable(),
  content_bytes: z.number().optional().nullable(),
  payload: z.object({
    text: z.string().optional(),
    json: z.record(z.unknown()).optional(),
    url: z.string().optional(),
    fetched_at_device: z.string().optional(),
    http_status: z.number().optional(),
    headers: z.record(z.string()).optional(),
    r2_key: z.string().optional(),
    upload_token: z.string().optional()
  }),
  auto_seal: z.boolean().optional()
});

const ingestBatchSchema = z.object({
  device_id: z.string().min(1),
  batch_client_request_id: z.string().min(1),
  batch_created_at: z.string().min(1),
  items: z.array(ingestItemSchema)
});

const sealSchema = z.object({
  device_id: z.string().min(1),
  evidence_object_ids: z.array(z.string().uuid()),
  reason: z.string().optional()
});

const urlFetchSchema = z.object({
  url: z.string().url()
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const SERVICE_TENANT_ID = 'b0000000-0000-0000-0000-000000000001';

function getTenantId(req: Request): string {
  return (req as any).tenantId || SERVICE_TENANT_ID;
}

function getIndividualId(req: Request): string | null {
  return (req as any).individualId || null;
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/offline/sync/session
 * Create or update a sync session for a device
 */
router.post('/sync/session', async (req: Request, res: Response) => {
  try {
    const parsed = syncSessionSchema.parse(req.body);
    const tenantId = getTenantId(req);
    const individualId = getIndividualId(req);
    
    const session = await withServiceMode(tenantId, () => upsertSyncSession({
      tenantId,
      deviceId: parsed.device_id,
      individualId,
      circleId: parsed.circle_id,
      portalId: parsed.portal_id,
      appVersion: parsed.app_version
    }));
    
    res.json({ session_id: session.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Sync session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/offline/upload/init
 * Initialize an upload for offline evidence
 */
router.post('/upload/init', async (req: Request, res: Response) => {
  try {
    const parsed = uploadInitSchema.parse(req.body);
    const tenantId = getTenantId(req);
    
    const result = await withServiceMode(tenantId, () => initializeUpload({
      tenantId,
      deviceId: parsed.device_id,
      clientRequestId: parsed.client_request_id,
      contentMime: parsed.content_mime
    }));
    
    res.json({
      upload_url_or_token: result.upload_url_or_token,
      r2_key_hint: result.r2_key_hint
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Upload init error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/offline/upload/complete
 * Complete an upload - verify bytes are present
 */
router.post('/upload/complete', async (req: Request, res: Response) => {
  try {
    const parsed = uploadCompleteSchema.parse(req.body);
    const tenantId = getTenantId(req);
    
    const result = await withServiceMode(tenantId, () => completeUpload({
      tenantId,
      deviceId: parsed.device_id,
      clientRequestId: parsed.client_request_id,
      r2Key: parsed.r2_key,
      contentSha256: parsed.content_sha256
    }));
    
    res.json({
      verified: result.verified,
      computed_sha256: result.computedSha256
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Upload complete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/offline/ingest
 * Ingest a batch of offline evidence items
 */
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const parsed = ingestBatchSchema.parse(req.body);
    const tenantId = getTenantId(req);
    const individualId = getIndividualId(req);
    
    const batch: IngestBatch = {
      device_id: parsed.device_id,
      batch_client_request_id: parsed.batch_client_request_id,
      batch_created_at: parsed.batch_created_at,
      items: parsed.items.map(item => ({
        client_request_id: item.client_request_id,
        local_id: item.local_id,
        source_type: item.source_type,
        title: item.title,
        description: item.description,
        created_at_device: item.created_at_device,
        occurred_at_device: item.occurred_at_device,
        captured_at_device: item.captured_at_device,
        circle_id: item.circle_id,
        portal_id: item.portal_id,
        content_sha256: item.content_sha256,
        content_mime: item.content_mime,
        content_bytes: item.content_bytes,
        payload: item.payload,
        auto_seal: item.auto_seal
      }))
    };
    
    const result = await withServiceMode(tenantId, () => ingestBatch(tenantId, individualId, batch));
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Ingest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/offline/seal
 * Seal evidence objects after sync
 */
router.post('/seal', async (req: Request, res: Response) => {
  try {
    const parsed = sealSchema.parse(req.body);
    const tenantId = getTenantId(req);
    const individualId = getIndividualId(req);
    
    const results = await withServiceMode(tenantId, () => sealEvidenceObjects(
      tenantId,
      individualId,
      parsed.evidence_object_ids,
      parsed.reason
    ));
    
    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Seal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/offline/fetch-url
 * Server-side URL fetch for evidence capture
 */
router.post('/fetch-url', async (req: Request, res: Response) => {
  try {
    const parsed = urlFetchSchema.parse(req.body);
    
    const result = await fetchUrlSnapshot(parsed.url);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
    
    // Compute hash of content
    const contentSha256 = sha256Hex(result.content!);
    
    res.json({
      success: true,
      content_sha256: contentSha256,
      content_type: result.contentType,
      http_status: result.httpStatus,
      content_bytes: result.content!.length
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Fetch URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

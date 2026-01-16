/**
 * P2.5 Evidence Chain-of-Custody API Routes
 * Tamper-evident evidence bundles with immutable manifests
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import {
  canonicalizeJson,
  sha256Hex,
  computeEvidenceContentSha256,
  appendEvidenceEvent,
  verifyEvidenceChain,
  logEvidenceAccess,
  compileBundleManifest,
  EvidenceSourceType,
  EvidenceBundleType
} from '../lib/evidence/custody';

const router = Router();

// ============================================================
// SCHEMAS
// ============================================================

const createEvidenceObjectSchema = z.object({
  sourceType: z.enum(['file_r2', 'url_snapshot', 'json_snapshot', 'manual_note', 'external_feed']),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  occurredAt: z.string().datetime().optional(),
  circleId: z.string().uuid().optional(),
  portalId: z.string().uuid().optional(),
  clientRequestId: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
  contentJson: z.record(z.unknown()).optional(),
  noteText: z.string().optional(),
});

const uploadEvidenceSchema = z.object({
  contentBase64: z.string(),
  contentMime: z.string().max(255),
  clientRequestId: z.string().max(255).optional(),
});

const fetchUrlSchema = z.object({
  url: z.string().url(),
  includeHeaders: z.boolean().optional(),
  clientRequestId: z.string().max(255).optional(),
});

const sealEvidenceSchema = z.object({
  reason: z.string().max(2000).optional(),
  clientRequestId: z.string().max(255).optional(),
});

const createBundleSchema = z.object({
  bundleType: z.enum(['emergency_pack', 'insurance_claim', 'dispute_defense', 'class_action', 'generic']),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  circleId: z.string().uuid().optional(),
  portalId: z.string().uuid().optional(),
  clientRequestId: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const addBundleItemSchema = z.object({
  evidenceObjectId: z.string().uuid(),
  label: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  clientRequestId: z.string().max(255).optional(),
});

const sealBundleSchema = z.object({
  clientRequestId: z.string().max(255).optional(),
});

// ============================================================
// HELPERS
// ============================================================

async function setRlsContext(client: any, ctx: any): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [ctx.tenant_id || '']);
  await client.query(`SELECT set_config('app.portal_id', $1, true)`, [ctx.portal_id || '']);
  await client.query(`SELECT set_config('app.circle_id', $1, true)`, [ctx.circle_id || '']);
  await client.query(`SELECT set_config('app.individual_id', $1, true)`, [ctx.individual_id || '']);
}

// ============================================================
// EVIDENCE OBJECT ENDPOINTS
// ============================================================

/**
 * POST /api/evidence/objects
 * Create a new evidence object (open chain)
 */
router.post('/objects', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = createEvidenceObjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const data = validation.data;
    await setRlsContext(client, ctx);

    // Check idempotency
    if (data.clientRequestId) {
      const existing = await client.query(`
        SELECT id FROM cc_evidence_objects
        WHERE tenant_id = $1 AND client_request_id = $2
      `, [ctx.tenant_id, data.clientRequestId]);
      
      if (existing.rows.length > 0) {
        const obj = await client.query(`SELECT * FROM cc_evidence_objects WHERE id = $1`, [existing.rows[0].id]);
        return res.json({ success: true, evidenceObject: obj.rows[0], idempotent: true });
      }
    }

    // Compute content hash based on source type
    let contentSha256 = sha256Hex('');
    let contentCanonicalJson = null;
    
    if (data.sourceType === 'json_snapshot' && data.contentJson) {
      contentCanonicalJson = data.contentJson;
      contentSha256 = computeEvidenceContentSha256('json_snapshot', data.contentJson);
    } else if (data.sourceType === 'manual_note' && data.noteText) {
      contentSha256 = sha256Hex(data.noteText);
    }

    // Insert evidence object
    const result = await client.query(`
      INSERT INTO cc_evidence_objects (
        tenant_id, circle_id, portal_id, created_by_individual_id,
        source_type, title, description, occurred_at,
        content_sha256, content_canonical_json,
        client_request_id, metadata
      ) VALUES (
        $1, $2, $3, $4,
        $5::cc_evidence_source_type_enum, $6, $7, $8,
        $9, $10,
        $11, $12
      )
      RETURNING *
    `, [
      ctx.tenant_id,
      data.circleId || null,
      data.portalId || null,
      ctx.individual_id || null,
      data.sourceType,
      data.title || null,
      data.description || null,
      data.occurredAt ? new Date(data.occurredAt) : null,
      contentSha256,
      contentCanonicalJson ? JSON.stringify(contentCanonicalJson) : null,
      data.clientRequestId || null,
      JSON.stringify(data.metadata || {})
    ]);

    const evidenceObject = result.rows[0];

    // Append 'created' event
    await appendEvidenceEvent({
      evidenceId: evidenceObject.id,
      tenantId: ctx.tenant_id,
      circleId: data.circleId || null,
      eventType: 'created',
      payload: {
        source_type: data.sourceType,
        title: data.title,
        occurred_at: data.occurredAt,
        content_sha256: contentSha256
      },
      actorIndividualId: ctx.individual_id || null,
      clientRequestId: data.clientRequestId ? `${data.clientRequestId}-created` : null
    });

    res.status(201).json({ success: true, evidenceObject });
  } catch (error: any) {
    console.error('Error creating evidence object:', error);
    res.status(500).json({ error: 'Failed to create evidence object', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/evidence/objects/:id/upload
 * Upload file content to an evidence object
 */
router.post('/objects/:id/upload', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = uploadEvidenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { id } = req.params;
    const data = validation.data;
    await setRlsContext(client, ctx);

    // Check object exists and is open
    const objResult = await client.query(`
      SELECT id, chain_status, source_type FROM cc_evidence_objects
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (objResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence object not found' });
    }

    const obj = objResult.rows[0];
    if (obj.chain_status !== 'open') {
      return res.status(400).json({ error: 'Cannot modify sealed evidence object' });
    }

    // Decode base64 and compute hash
    const contentBuffer = Buffer.from(data.contentBase64, 'base64');
    const contentSha256 = sha256Hex(contentBuffer);
    const contentBytes = contentBuffer.length;

    // In production, upload to R2 here
    // For now, we just update the hash and metadata
    const r2Key = `evidence/${ctx.tenant_id}/${id}/${Date.now()}`;

    // Update evidence object
    await client.query(`
      UPDATE cc_evidence_objects
      SET content_sha256 = $1,
          content_bytes = $2,
          content_mime = $3,
          r2_bucket = $4,
          r2_key = $5,
          captured_at = now(),
          updated_at = now()
      WHERE id = $6
    `, [contentSha256, contentBytes, data.contentMime, 'community-canvas', r2Key, id]);

    // Append 'uploaded' event
    await appendEvidenceEvent({
      evidenceId: id,
      tenantId: ctx.tenant_id,
      eventType: 'uploaded',
      payload: {
        content_sha256: contentSha256,
        content_bytes: contentBytes,
        content_mime: data.contentMime,
        r2_key: r2Key
      },
      actorIndividualId: ctx.individual_id || null,
      clientRequestId: data.clientRequestId
    });

    const updated = await client.query(`SELECT * FROM cc_evidence_objects WHERE id = $1`, [id]);
    res.json({ success: true, evidenceObject: updated.rows[0] });
  } catch (error: any) {
    console.error('Error uploading evidence:', error);
    res.status(500).json({ error: 'Failed to upload evidence', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/evidence/objects/:id/fetch-url
 * Fetch URL content and store as evidence
 */
router.post('/objects/:id/fetch-url', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = fetchUrlSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { id } = req.params;
    const data = validation.data;
    await setRlsContext(client, ctx);

    // Check object exists and is open
    const objResult = await client.query(`
      SELECT id, chain_status, source_type FROM cc_evidence_objects
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (objResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence object not found' });
    }

    const obj = objResult.rows[0];
    if (obj.chain_status !== 'open') {
      return res.status(400).json({ error: 'Cannot modify sealed evidence object' });
    }

    // Fetch the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    let response;
    try {
      response = await fetch(data.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CommunityCanvas-Evidence-Collector/1.0'
        }
      });
    } catch (fetchError: any) {
      return res.status(400).json({ error: 'Failed to fetch URL', details: fetchError.message });
    } finally {
      clearTimeout(timeoutId);
    }

    // Get response as buffer
    const contentBuffer = Buffer.from(await response.arrayBuffer());
    
    // Cap at 50MB
    if (contentBuffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'URL content exceeds 50MB limit' });
    }

    const contentSha256 = sha256Hex(contentBuffer);
    const contentBytes = contentBuffer.length;
    const contentMime = response.headers.get('content-type') || 'application/octet-stream';
    
    // Get headers if requested
    let responseHeaders: Record<string, string> = {};
    if (data.includeHeaders) {
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
    }

    // In production, upload to R2 here
    const r2Key = `evidence/${ctx.tenant_id}/${id}/url-snapshot-${Date.now()}`;

    // Update evidence object
    await client.query(`
      UPDATE cc_evidence_objects
      SET content_sha256 = $1,
          content_bytes = $2,
          content_mime = $3,
          r2_bucket = $4,
          r2_key = $5,
          url = $6,
          url_fetched_at = now(),
          url_http_status = $7,
          url_response_headers = $8,
          captured_at = now(),
          updated_at = now()
      WHERE id = $9
    `, [
      contentSha256,
      contentBytes,
      contentMime,
      'community-canvas',
      r2Key,
      data.url,
      response.status,
      JSON.stringify(responseHeaders),
      id
    ]);

    // Append 'fetched' event
    await appendEvidenceEvent({
      evidenceId: id,
      tenantId: ctx.tenant_id,
      eventType: 'fetched',
      payload: {
        url: data.url,
        http_status: response.status,
        content_sha256: contentSha256,
        content_bytes: contentBytes,
        r2_key: r2Key
      },
      actorIndividualId: ctx.individual_id || null,
      clientRequestId: data.clientRequestId
    });

    const updated = await client.query(`SELECT * FROM cc_evidence_objects WHERE id = $1`, [id]);
    res.json({ success: true, evidenceObject: updated.rows[0] });
  } catch (error: any) {
    console.error('Error fetching URL for evidence:', error);
    res.status(500).json({ error: 'Failed to fetch URL', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/evidence/objects/:id/seal
 * Seal an evidence object (make immutable)
 */
router.post('/objects/:id/seal', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = sealEvidenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { id } = req.params;
    const data = validation.data;
    await setRlsContext(client, ctx);

    // Check object exists and is open
    const objResult = await client.query(`
      SELECT id, chain_status FROM cc_evidence_objects
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (objResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence object not found' });
    }

    const obj = objResult.rows[0];
    if (obj.chain_status !== 'open') {
      return res.status(400).json({ error: 'Evidence object is already sealed' });
    }

    // Seal the object
    await client.query(`
      UPDATE cc_evidence_objects
      SET chain_status = 'sealed'::cc_evidence_chain_status_enum,
          sealed_at = now(),
          sealed_by_individual_id = $1,
          seal_reason = $2,
          updated_at = now()
      WHERE id = $3
    `, [ctx.individual_id || null, data.reason || null, id]);

    // Append 'sealed' event
    await appendEvidenceEvent({
      evidenceId: id,
      tenantId: ctx.tenant_id,
      eventType: 'sealed',
      payload: {
        reason: data.reason,
        sealed_by: ctx.individual_id
      },
      actorIndividualId: ctx.individual_id || null,
      clientRequestId: data.clientRequestId
    });

    const updated = await client.query(`SELECT * FROM cc_evidence_objects WHERE id = $1`, [id]);
    res.json({ success: true, evidenceObject: updated.rows[0] });
  } catch (error: any) {
    console.error('Error sealing evidence:', error);
    res.status(500).json({ error: 'Failed to seal evidence', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/evidence/objects/:id/verify
 * Verify the hash chain for an evidence object
 */
router.get('/objects/:id/verify', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;
    await setRlsContext(client, ctx);

    // Verify the chain
    const result = await verifyEvidenceChain(id);

    // Log access (rate limited)
    if (result.evidenceObject) {
      await logEvidenceAccess(
        ctx.tenant_id,
        id,
        ctx.individual_id || null,
        'verify'
      );
    }

    res.json({
      success: true,
      valid: result.valid,
      evidenceObject: result.evidenceObject,
      eventChain: result.eventChain,
      firstFailureIndex: result.firstFailureIndex,
      failureReason: result.failureReason
    });
  } catch (error: any) {
    console.error('Error verifying evidence:', error);
    res.status(500).json({ error: 'Failed to verify evidence', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/evidence/objects/:id
 * Get an evidence object by ID
 */
router.get('/objects/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;
    await setRlsContext(client, ctx);

    const result = await client.query(`
      SELECT * FROM cc_evidence_objects
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence object not found' });
    }

    // Log access (rate limited)
    await logEvidenceAccess(
      ctx.tenant_id,
      id,
      ctx.individual_id || null,
      'read'
    );

    res.json({ success: true, evidenceObject: result.rows[0] });
  } catch (error: any) {
    console.error('Error getting evidence:', error);
    res.status(500).json({ error: 'Failed to get evidence', details: error.message });
  } finally {
    client.release();
  }
});

// ============================================================
// BUNDLE ENDPOINTS
// ============================================================

/**
 * POST /api/evidence/bundles
 * Create a new evidence bundle
 */
router.post('/bundles', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = createBundleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const data = validation.data;
    await setRlsContext(client, ctx);

    // Check idempotency
    if (data.clientRequestId) {
      const existing = await client.query(`
        SELECT id FROM cc_evidence_bundles
        WHERE tenant_id = $1 AND client_request_id = $2
      `, [ctx.tenant_id, data.clientRequestId]);
      
      if (existing.rows.length > 0) {
        const bundle = await client.query(`SELECT * FROM cc_evidence_bundles WHERE id = $1`, [existing.rows[0].id]);
        return res.json({ success: true, bundle: bundle.rows[0], idempotent: true });
      }
    }

    // Create bundle
    const result = await client.query(`
      INSERT INTO cc_evidence_bundles (
        tenant_id, circle_id, portal_id, bundle_type,
        title, description, created_by_individual_id,
        client_request_id, metadata
      ) VALUES (
        $1, $2, $3, $4::cc_evidence_bundle_type_enum,
        $5, $6, $7,
        $8, $9
      )
      RETURNING *
    `, [
      ctx.tenant_id,
      data.circleId || null,
      data.portalId || null,
      data.bundleType,
      data.title,
      data.description || null,
      ctx.individual_id || null,
      data.clientRequestId || null,
      JSON.stringify(data.metadata || {})
    ]);

    res.status(201).json({ success: true, bundle: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating bundle:', error);
    res.status(500).json({ error: 'Failed to create bundle', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/evidence/bundles/:id/items
 * Add an evidence object to a bundle
 */
router.post('/bundles/:id/items', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = addBundleItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { id } = req.params;
    const data = validation.data;
    await setRlsContext(client, ctx);

    // Check bundle exists and is open
    const bundleResult = await client.query(`
      SELECT id, bundle_status FROM cc_evidence_bundles
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const bundle = bundleResult.rows[0];
    if (bundle.bundle_status !== 'open') {
      return res.status(400).json({ error: 'Cannot modify sealed bundle' });
    }

    // Check evidence object exists
    const evidenceResult = await client.query(`
      SELECT id FROM cc_evidence_objects
      WHERE id = $1 AND tenant_id = $2
    `, [data.evidenceObjectId, ctx.tenant_id]);

    if (evidenceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence object not found' });
    }

    // Check if already added
    const existingItem = await client.query(`
      SELECT id FROM cc_evidence_bundle_items
      WHERE bundle_id = $1 AND evidence_object_id = $2 AND tenant_id = $3
    `, [id, data.evidenceObjectId, ctx.tenant_id]);

    if (existingItem.rows.length > 0) {
      return res.status(400).json({ error: 'Evidence object already in bundle' });
    }

    // Determine sort order
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await client.query(`
        SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
        FROM cc_evidence_bundle_items
        WHERE bundle_id = $1
      `, [id]);
      sortOrder = maxOrder.rows[0].next_order;
    }

    // Add item
    const result = await client.query(`
      INSERT INTO cc_evidence_bundle_items (
        tenant_id, bundle_id, evidence_object_id,
        added_by_individual_id, sort_order, label, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      RETURNING *
    `, [
      ctx.tenant_id,
      id,
      data.evidenceObjectId,
      ctx.individual_id || null,
      sortOrder,
      data.label || null,
      data.notes || null
    ]);

    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (error: any) {
    console.error('Error adding bundle item:', error);
    res.status(500).json({ error: 'Failed to add bundle item', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/evidence/bundles/:id/seal
 * Seal a bundle (freeze manifest)
 */
router.post('/bundles/:id/seal', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const validation = sealBundleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { id } = req.params;
    await setRlsContext(client, ctx);

    // Check bundle exists and is open
    const bundleResult = await client.query(`
      SELECT id, bundle_status FROM cc_evidence_bundles
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const bundle = bundleResult.rows[0];
    if (bundle.bundle_status !== 'open') {
      return res.status(400).json({ error: 'Bundle is already sealed' });
    }

    // Compile manifest
    const { manifest, manifestSha256 } = await compileBundleManifest(id);
    manifest.sealedByIndividualId = ctx.individual_id || null;

    // Seal the bundle
    await client.query(`
      UPDATE cc_evidence_bundles
      SET bundle_status = 'sealed'::cc_evidence_bundle_status_enum,
          manifest_json = $1,
          manifest_sha256 = $2,
          sealed_at = now(),
          sealed_by_individual_id = $3,
          updated_at = now()
      WHERE id = $4
    `, [JSON.stringify(manifest), manifestSha256, ctx.individual_id || null, id]);

    const updated = await client.query(`SELECT * FROM cc_evidence_bundles WHERE id = $1`, [id]);
    res.json({ success: true, bundle: updated.rows[0] });
  } catch (error: any) {
    console.error('Error sealing bundle:', error);
    res.status(500).json({ error: 'Failed to seal bundle', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/evidence/bundles/:id/manifest
 * Get bundle manifest and hash
 */
router.get('/bundles/:id/manifest', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;
    await setRlsContext(client, ctx);

    const result = await client.query(`
      SELECT manifest_json, manifest_sha256, bundle_status
      FROM cc_evidence_bundles
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const bundle = result.rows[0];
    
    if (bundle.bundle_status === 'open') {
      // For open bundles, compute current manifest without storing
      const { manifest, manifestSha256 } = await compileBundleManifest(id);
      return res.json({
        success: true,
        manifestJson: manifest,
        manifestSha256: manifestSha256,
        status: 'open',
        note: 'Manifest is not frozen - this is a preview'
      });
    }

    res.json({
      success: true,
      manifestJson: bundle.manifest_json,
      manifestSha256: bundle.manifest_sha256,
      status: bundle.bundle_status
    });
  } catch (error: any) {
    console.error('Error getting bundle manifest:', error);
    res.status(500).json({ error: 'Failed to get manifest', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/evidence/bundles/:id
 * Get bundle by ID
 */
router.get('/bundles/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const { id } = req.params;
    await setRlsContext(client, ctx);

    const bundleResult = await client.query(`
      SELECT * FROM cc_evidence_bundles
      WHERE id = $1 AND tenant_id = $2
    `, [id, ctx.tenant_id]);

    if (bundleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Get items
    const itemsResult = await client.query(`
      SELECT 
        bi.*,
        eo.source_type,
        eo.title as evidence_title,
        eo.content_sha256,
        eo.chain_status
      FROM cc_evidence_bundle_items bi
      JOIN cc_evidence_objects eo ON eo.id = bi.evidence_object_id
      WHERE bi.bundle_id = $1
      ORDER BY bi.sort_order ASC, bi.added_at ASC
    `, [id]);

    res.json({
      success: true,
      bundle: bundleResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error: any) {
    console.error('Error getting bundle:', error);
    res.status(500).json({ error: 'Failed to get bundle', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/evidence/bundles
 * List bundles for current tenant
 */
router.get('/bundles', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const ctx = (req as any).ctx;
    if (!ctx?.tenant_id) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    await setRlsContext(client, ctx);

    const { bundleType, status } = req.query;
    
    let sql = `
      SELECT 
        eb.*,
        (SELECT COUNT(*) FROM cc_evidence_bundle_items WHERE bundle_id = eb.id) as item_count
      FROM cc_evidence_bundles eb
      WHERE eb.tenant_id = $1
    `;
    const params: any[] = [ctx.tenant_id];
    let paramIndex = 2;

    if (bundleType) {
      sql += ` AND eb.bundle_type = $${paramIndex}::cc_evidence_bundle_type_enum`;
      params.push(bundleType);
      paramIndex++;
    }

    if (status) {
      sql += ` AND eb.bundle_status = $${paramIndex}::cc_evidence_bundle_status_enum`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY eb.created_at DESC`;

    const result = await client.query(sql, params);
    res.json({ success: true, bundles: result.rows });
  } catch (error: any) {
    console.error('Error listing bundles:', error);
    res.status(500).json({ error: 'Failed to list bundles', details: error.message });
  } finally {
    client.release();
  }
});

export default router;

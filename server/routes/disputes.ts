/**
 * P2.10 Dispute / Defense Pack API Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { attachDisputeInput, listDisputeInputs, removeDisputeInput } from '../lib/disputes/inputs';
import { 
  assembleDefensePack, 
  getDefensePack, 
  listDefensePacks, 
  addExportArtifact,
  PackType,
} from '../lib/disputes/assembleDefensePack';
import * as authorityAccess from '../lib/authority/access';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import archiver from 'archiver';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'community-canvas-cc_media';

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 storage is not configured');
    }
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

async function getR2SignedDownloadUrl(key: string, expiresIn: number): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

const router = Router();

// ============================================================
// Dispute CRUD
// ============================================================

const createDisputeSchema = z.object({
  disputeType: z.enum(['chargeback', 'review_extortion', 'bbb', 'contract', 'platform_dispute', 'other']),
  title: z.string().min(1),
  counterpartyType: z.enum(['guest_customer', 'platform', 'bank', 'vendor', 'contractor', 'regulator', 'other']).optional(),
  counterpartyName: z.string().optional(),
  counterpartyReference: z.string().optional(),
  summary: z.string().optional(),
  incidentOccurredAt: z.string().optional(),
  reportedAt: z.string().optional(),
  amountCents: z.number().int().optional(),
  currency: z.string().optional(),
  circleId: z.string().uuid().optional(),
  portalId: z.string().uuid().optional(),
  clientRequestId: z.string().optional(),
});

/**
 * POST /api/disputes - Create a dispute
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const individualId = req.headers['x-individual-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const body = createDisputeSchema.parse(req.body);
    
    // Generate dispute number
    const counterResult = await pool.query<any>(
      `SELECT COUNT(*)::int + 1 as next_num FROM cc_disputes WHERE tenant_id = $1::uuid`,
      [tenantId]
    );
    const disputeNumber = `DSP-${String(counterResult.rows[0].next_num).padStart(6, '0')}`;
    
    const result = await pool.query<any>(
      `INSERT INTO cc_disputes (
        tenant_id, dispute_number, dispute_type, title, 
        counterparty_type, counterparty_name, counterparty_reference,
        summary, incident_occurred_at, reported_at, amount_cents, currency,
        circle_id, portal_id, client_request_id, created_by_individual_id,
        description, initiator_party_id
      ) VALUES (
        $1::uuid, $2, $3, $4,
        $5, $6, $7,
        $8, $9::timestamptz, $10::timestamptz, $11, $12,
        $13::uuid, $14::uuid, $15, $16::uuid,
        $17, (SELECT party_id FROM cc_individuals WHERE id = $16::uuid LIMIT 1)
      )
      RETURNING *`,
      [
        tenantId,
        disputeNumber,
        body.disputeType,
        body.title,
        body.counterpartyType || 'other',
        body.counterpartyName || null,
        body.counterpartyReference || null,
        body.summary || null,
        body.incidentOccurredAt || null,
        body.reportedAt || null,
        body.amountCents || null,
        body.currency || 'CAD',
        body.circleId || null,
        body.portalId || null,
        body.clientRequestId || null,
        individualId || null,
        body.summary || body.title,
      ]
    );
    
    res.status(201).json(mapDisputeRow(result.rows[0]));
  } catch (error: any) {
    console.error('Create dispute error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/disputes - List disputes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const result = await pool.query<any>(
      `SELECT * FROM cc_disputes WHERE tenant_id = $1::uuid ORDER BY created_at DESC`,
      [tenantId]
    );
    
    res.json(result.rows.map(mapDisputeRow));
  } catch (error: any) {
    console.error('List disputes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/disputes/:id - Get a dispute
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const result = await pool.query<any>(
      `SELECT * FROM cc_disputes WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    res.json(mapDisputeRow(result.rows[0]));
  } catch (error: any) {
    console.error('Get dispute error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Input Attachment
// ============================================================

const attachInputSchema = z.object({
  inputType: z.enum(['evidence_bundle', 'evidence_object', 'claim_dossier', 'insurance_claim']),
  inputId: z.string().uuid(),
  label: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/disputes/:id/attach - Attach an input to a dispute
 */
router.post('/:id/attach', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const individualId = req.headers['x-individual-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const body = attachInputSchema.parse(req.body);
    
    const input = await attachDisputeInput({
      tenantId,
      disputeId: req.params.id,
      inputType: body.inputType,
      inputId: body.inputId,
      label: body.label,
      notes: body.notes,
      attachedByIndividualId: individualId,
    });
    
    res.status(201).json(input);
  } catch (error: any) {
    console.error('Attach input error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/disputes/:id/inputs - List inputs attached to a dispute
 */
router.get('/:id/inputs', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const inputs = await listDisputeInputs(tenantId, req.params.id);
    res.json(inputs);
  } catch (error: any) {
    console.error('List inputs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/disputes/:id/inputs/:inputId - Remove an input from a dispute
 */
router.delete('/:id/inputs/:inputId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    await removeDisputeInput(tenantId, req.params.id, req.params.inputId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Remove input error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Defense Pack Assembly
// ============================================================

const assemblePackSchema = z.object({
  packType: z.enum(['chargeback_v1', 'review_extortion_v1', 'bbb_v1', 'contract_v1', 'generic_v1']),
  clientRequestId: z.string().optional(),
  forceNewVersion: z.boolean().optional(),
});

/**
 * POST /api/disputes/:id/assemble - Assemble a defense pack
 */
router.post('/:id/assemble', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const individualId = req.headers['x-individual-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const body = assemblePackSchema.parse(req.body);
    
    const pack = await assembleDefensePack(
      tenantId,
      req.params.id,
      body.packType as PackType,
      individualId,
      body.clientRequestId,
      body.forceNewVersion
    );
    
    res.status(201).json({
      id: pack.id,
      packVersion: pack.packVersion,
      packStatus: pack.packStatus,
      packType: pack.packType,
      packSha256: pack.packSha256,
      assembledAt: pack.assembledAt,
    });
  } catch (error: any) {
    console.error('Assemble pack error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/disputes/:id/packs - List defense packs for a dispute
 */
router.get('/:id/packs', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const packs = await listDefensePacks(tenantId, req.params.id);
    res.json(packs.map(p => ({
      id: p.id,
      packVersion: p.packVersion,
      packStatus: p.packStatus,
      packType: p.packType,
      packSha256: p.packSha256,
      assembledAt: p.assembledAt,
      exportArtifacts: p.exportArtifacts,
    })));
  } catch (error: any) {
    console.error('List packs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Defense Pack Operations
// ============================================================

/**
 * GET /api/defense-packs/:packId - Get a defense pack
 */
router.get('/packs/:packId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const pack = await getDefensePack(tenantId, req.params.packId);
    if (!pack) {
      return res.status(404).json({ error: 'Defense pack not found' });
    }
    
    res.json({
      id: pack.id,
      disputeId: pack.disputeId,
      packVersion: pack.packVersion,
      packStatus: pack.packStatus,
      packType: pack.packType,
      packSha256: pack.packSha256,
      assembledAt: pack.assembledAt,
      packJson: pack.packJson,
      exportArtifacts: pack.exportArtifacts,
    });
  } catch (error: any) {
    console.error('Get pack error:', error);
    res.status(500).json({ error: error.message });
  }
});

const exportPackSchema = z.object({
  format: z.enum(['zip_json']),
});

/**
 * POST /api/defense-packs/:packId/export - Export a defense pack
 */
router.post('/packs/:packId/export', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const individualId = req.headers['x-individual-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const body = exportPackSchema.parse(req.body);
    
    const pack = await getDefensePack(tenantId, req.params.packId);
    if (!pack) {
      return res.status(404).json({ error: 'Defense pack not found' });
    }
    
    // Get inputs for the dispute
    const inputs = await listDisputeInputs(tenantId, pack.disputeId);
    
    // Create zip file
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk) => chunks.push(chunk));
    
    // Add defense pack JSON
    archive.append(JSON.stringify(pack.packJson, null, 2), { name: 'defense_pack.json' });
    
    // Add inputs JSON
    const inputsJson = {
      dispute_id: pack.disputeId,
      pack_id: pack.id,
      pack_version: pack.packVersion,
      inputs: inputs.map(i => ({
        input_type: i.inputType,
        input_id: i.inputId,
        copied_sha256: i.copiedSha256,
        label: i.label,
        attached_at: i.attachedAt,
      })),
    };
    archive.append(JSON.stringify(inputsJson, null, 2), { name: 'inputs.json' });
    
    // Add verification JSON
    const verificationJson = {
      pack_sha256: pack.packSha256,
      algorithm_version: pack.packJson.algorithm_version,
      bundle_manifests: pack.packJson.verification.bundle_manifest_sha256s,
      evidence_hashes: pack.packJson.verification.evidence_content_sha256s,
      dossier_hashes: pack.packJson.verification.dossier_sha256s,
      exported_at: new Date().toISOString(),
    };
    archive.append(JSON.stringify(verificationJson, null, 2), { name: 'verification.json' });
    
    await archive.finalize();
    
    const zipBuffer = Buffer.concat(chunks);
    
    // Upload to R2
    const r2Client = getR2Client();
    const r2Key = `tenants/${tenantId}/defense-packs/${pack.id}/export_v${pack.packVersion}_${Date.now()}.zip`;
    
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: zipBuffer,
      ContentType: 'application/zip',
    }));
    
    // Record export artifact
    await addExportArtifact(tenantId, pack.id, {
      format: 'zip_json',
      r2Key,
      exportedAt: new Date().toISOString(),
      exportedByIndividualId: individualId,
    });
    
    // Get signed download URL
    const downloadUrl = await getR2SignedDownloadUrl(r2Key, 3600);
    
    res.json({
      success: true,
      format: 'zip_json',
      r2Key,
      downloadUrl,
      expiresIn: 3600,
    });
  } catch (error: any) {
    console.error('Export pack error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

const sharePackSchema = z.object({
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientOrg: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  requirePasscode: z.boolean().default(false),
  passcode: z.string().min(6).optional(),
  maxViews: z.number().int().min(1).optional(),
});

/**
 * POST /api/defense-packs/:packId/share - Share a defense pack via authority portal
 */
router.post('/packs/:packId/share', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const individualId = req.headers['x-individual-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID required' });
    }
    
    const body = sharePackSchema.parse(req.body);
    
    const pack = await getDefensePack(tenantId, req.params.packId);
    if (!pack) {
      return res.status(404).json({ error: 'Defense pack not found' });
    }
    
    // Get inputs to create scopes for
    const inputs = await listDisputeInputs(tenantId, pack.disputeId);
    
    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);
    
    // Create authority grant
    const recipientInfo = [body.recipientName, body.recipientOrg, body.recipientEmail].filter(Boolean).join(' - ');
    const grant = await authorityAccess.createGrant({
      tenantId,
      grantType: 'generic',
      title: `Defense Pack: ${pack.packType}`,
      description: recipientInfo || 'Defense Pack Share',
      expiresAt,
      maxViews: body.maxViews,
      requirePasscode: body.requirePasscode,
      passcode: body.passcode,
      createdByIndividualId: individualId,
    });
    
    // Add scopes for all inputs
    for (const input of inputs) {
      if (input.inputType === 'evidence_bundle') {
        await authorityAccess.addScope({
          tenantId,
          grantId: grant.id,
          scopeType: 'evidence_bundle',
          scopeId: input.inputId,
          label: input.label || 'Evidence Bundle',
          addedByIndividualId: individualId,
        });
      } else if (input.inputType === 'claim_dossier') {
        await authorityAccess.addScope({
          tenantId,
          grantId: grant.id,
          scopeType: 'claim_dossier',
          scopeId: input.inputId,
          label: input.label || 'Claim Dossier',
          addedByIndividualId: individualId,
        });
      }
    }
    
    // Issue token
    const { token, rawToken } = await authorityAccess.createToken({
      tenantId,
      grantId: grant.id,
      expiresAt,
      issuedByIndividualId: individualId,
    });
    
    // Build share URL
    const baseUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    const shareUrl = authorityAccess.buildShareUrl(rawToken, baseUrl);
    
    // Update pack metadata with share event
    await pool.query(
      `UPDATE cc_defense_packs 
       SET metadata = jsonb_set(
         metadata, 
         '{events}', 
         COALESCE(metadata->'events', '[]'::jsonb) || $3::jsonb
       )
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [
        tenantId,
        pack.id,
        JSON.stringify([{ 
          type: 'defense_pack_shared', 
          at: new Date().toISOString(),
          grant_id: grant.id,
          token_id: token.id,
        }]),
      ]
    );
    
    res.json({
      success: true,
      grantId: grant.id,
      tokenId: token.id,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
      requirePasscode: body.requirePasscode,
    });
  } catch (error: any) {
    console.error('Share pack error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Helpers
// ============================================================

function mapDisputeRow(row: any): any {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    disputeNumber: row.dispute_number,
    disputeType: row.dispute_type,
    status: row.status,
    title: row.title,
    summary: row.summary,
    counterpartyType: row.counterparty_type,
    counterpartyName: row.counterparty_name,
    counterpartyReference: row.counterparty_reference,
    amountCents: row.amount_cents || row.disputed_amount_cents,
    currency: row.currency,
    incidentOccurredAt: row.incident_occurred_at,
    reportedAt: row.reported_at,
    circleId: row.circle_id,
    portalId: row.portal_id,
    createdAt: row.created_at,
    createdByIndividualId: row.created_by_individual_id,
    clientRequestId: row.client_request_id,
  };
}

export default router;

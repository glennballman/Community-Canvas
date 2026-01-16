/**
 * P2.6 Insurance Claim Auto-Assembler API Routes
 * Endpoints for managing insurance policies, claims, and dossiers
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';
import {
  attachClaimInput,
  assembleClaimDossier,
  prepareDossierExport,
  recordDossierExport,
} from '../lib/claims/assemble';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';

const router = express.Router();

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'community-canvas-cc_media';

function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    if (!isR2Configured()) {
      throw new Error('R2 storage is not configured');
    }
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

async function uploadBufferToR2(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

// ============================================================
// POLICIES
// ============================================================

/**
 * POST /api/insurance/policies
 * Create or upsert policy via client_request_id
 */
router.post('/policies', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const individualId = tenantReq.ctx.individual_id;

    const {
      policy_type,
      carrier_name,
      broker_name,
      policy_number,
      named_insured,
      effective_date,
      expiry_date,
      coverage_summary,
      contacts,
      circle_id,
      portal_id,
      client_request_id,
      metadata,
    } = req.body;

    if (!policy_type) {
      return res.status(400).json({ error: 'policy_type is required' });
    }

    // Check for existing by client_request_id
    if (client_request_id) {
      const existing = await db.execute(sql`
        SELECT id FROM cc_insurance_policies
        WHERE tenant_id = ${tenantId} AND client_request_id = ${client_request_id}
      `);
      if (existing.rows.length > 0) {
        const policyResult = await db.execute(sql`
          SELECT * FROM cc_insurance_policies WHERE id = ${(existing.rows[0] as any).id}
        `);
        return res.json({ policy: policyResult.rows[0], created: false });
      }
    }

    const result = await db.execute(sql`
      INSERT INTO cc_insurance_policies (
        tenant_id, circle_id, portal_id, policy_type, carrier_name, broker_name,
        policy_number, named_insured, effective_date, expiry_date,
        coverage_summary, contacts, created_by_individual_id, client_request_id, metadata
      ) VALUES (
        ${tenantId}, ${circle_id || null}, ${portal_id || null}, ${policy_type}::cc_policy_type_enum,
        ${carrier_name || null}, ${broker_name || null}, ${policy_number || null},
        ${named_insured || null}, ${effective_date || null}, ${expiry_date || null},
        ${JSON.stringify(coverage_summary || {})}::jsonb, ${JSON.stringify(contacts || {})}::jsonb,
        ${individualId || null}, ${client_request_id || null}, ${JSON.stringify(metadata || {})}::jsonb
      )
      RETURNING *
    `);

    res.status(201).json({ policy: result.rows[0], created: true });
  } catch (error: any) {
    console.error('[insurance/policies POST]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insurance/policies
 * List policies (tenant-scoped)
 */
router.get('/policies', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;

    const result = await db.execute(sql`
      SELECT * FROM cc_insurance_policies
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `);

    res.json({ policies: result.rows });
  } catch (error: any) {
    console.error('[insurance/policies GET]', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CLAIMS
// ============================================================

/**
 * POST /api/insurance/claims
 * Create a new claim (draft status)
 */
router.post('/claims', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const individualId = tenantReq.ctx.individual_id;

    const {
      claim_type,
      title,
      policy_id,
      loss_occurred_at,
      loss_discovered_at,
      reported_at,
      claim_number,
      loss_location,
      claimants,
      summary,
      circle_id,
      portal_id,
      client_request_id,
      metadata,
    } = req.body;

    if (!claim_type || !title) {
      return res.status(400).json({ error: 'claim_type and title are required' });
    }

    // Check for existing by client_request_id
    if (client_request_id) {
      const existing = await db.execute(sql`
        SELECT id FROM cc_insurance_claims
        WHERE tenant_id = ${tenantId} AND client_request_id = ${client_request_id}
      `);
      if (existing.rows.length > 0) {
        const claimResult = await db.execute(sql`
          SELECT * FROM cc_insurance_claims WHERE id = ${(existing.rows[0] as any).id}
        `);
        return res.json({ claim: claimResult.rows[0], created: false });
      }
    }

    const result = await db.execute(sql`
      INSERT INTO cc_insurance_claims (
        tenant_id, circle_id, portal_id, policy_id, claim_type, title,
        loss_occurred_at, loss_discovered_at, reported_at, claim_number,
        loss_location, claimants, summary, created_by_individual_id,
        client_request_id, metadata
      ) VALUES (
        ${tenantId}, ${circle_id || null}, ${portal_id || null}, ${policy_id || null},
        ${claim_type}::cc_claim_type_enum, ${title},
        ${loss_occurred_at || null}, ${loss_discovered_at || null}, ${reported_at || null},
        ${claim_number || null}, ${JSON.stringify(loss_location || null)}::jsonb,
        ${JSON.stringify(claimants || [])}::jsonb, ${summary || null},
        ${individualId || null}, ${client_request_id || null}, ${JSON.stringify(metadata || {})}::jsonb
      )
      RETURNING *
    `);

    res.status(201).json({ claim: result.rows[0], created: true });
  } catch (error: any) {
    console.error('[insurance/claims POST]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insurance/claims
 * List claims (tenant-scoped)
 */
router.get('/claims', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { status } = req.query;

    let result;
    if (status) {
      result = await db.execute(sql`
        SELECT * FROM cc_insurance_claims
        WHERE tenant_id = ${tenantId} AND claim_status = ${status as string}::cc_claim_status_enum
        ORDER BY created_at DESC
      `);
    } else {
      result = await db.execute(sql`
        SELECT * FROM cc_insurance_claims
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `);
    }

    res.json({ claims: result.rows });
  } catch (error: any) {
    console.error('[insurance/claims GET]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insurance/claims/:id
 * Get single claim with its inputs
 */
router.get('/claims/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const claimId = req.params.id;

    const claimResult = await db.execute(sql`
      SELECT * FROM cc_insurance_claims
      WHERE id = ${claimId} AND tenant_id = ${tenantId}
    `);

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const inputsResult = await db.execute(sql`
      SELECT * FROM cc_claim_inputs
      WHERE claim_id = ${claimId} AND tenant_id = ${tenantId}
      ORDER BY attached_at
    `);

    res.json({ claim: claimResult.rows[0], inputs: inputsResult.rows });
  } catch (error: any) {
    console.error('[insurance/claims/:id GET]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insurance/claims/:id/attach
 * Attach a sealed bundle or evidence object to the claim
 */
router.post('/claims/:id/attach', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const individualId = tenantReq.ctx.individual_id;
    const claimId = req.params.id;

    const { bundle_id, evidence_object_id, label, notes } = req.body;

    // Verify claim exists
    const claimCheck = await db.execute(sql`
      SELECT id FROM cc_insurance_claims
      WHERE id = ${claimId} AND tenant_id = ${tenantId}
    `);

    if (claimCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const input = await attachClaimInput({
      claimId,
      tenantId: tenantId!,
      bundleId: bundle_id,
      evidenceObjectId: evidence_object_id,
      attachedByIndividualId: individualId || undefined,
      label,
      notes,
    });

    res.status(201).json({ input });
  } catch (error: any) {
    console.error('[insurance/claims/:id/attach POST]', error);
    if (error.message.includes('unsealed')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('already attached')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insurance/claims/:id/assemble
 * Assemble a dossier from the claim's attached inputs
 */
router.post('/claims/:id/assemble', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const individualId = tenantReq.ctx.individual_id;
    const claimId = req.params.id;

    const { client_request_id, force_new_version } = req.body;

    // Check for existing dossier by client_request_id
    if (client_request_id) {
      const existing = await db.execute(sql`
        SELECT id FROM cc_claim_dossiers
        WHERE tenant_id = ${tenantId} AND client_request_id = ${client_request_id}
      `);
      if (existing.rows.length > 0) {
        const dossierResult = await db.execute(sql`
          SELECT * FROM cc_claim_dossiers WHERE id = ${(existing.rows[0] as any).id}
        `);
        return res.json({ dossier: dossierResult.rows[0], created: false });
      }
    }

    const dossier = await assembleClaimDossier({
      claimId,
      tenantId: tenantId!,
      assembledByIndividualId: individualId || undefined,
      clientRequestId: client_request_id,
      forceNewVersion: force_new_version,
    });

    res.status(201).json({ dossier, created: true });
  } catch (error: any) {
    console.error('[insurance/claims/:id/assemble POST]', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not sealed') || error.message.includes('no longer sealed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insurance/claims/:id/dossiers
 * List all dossier versions for a claim
 */
router.get('/claims/:id/dossiers', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const claimId = req.params.id;

    const result = await db.execute(sql`
      SELECT id, dossier_version, dossier_status, assembled_at, dossier_sha256, export_artifacts
      FROM cc_claim_dossiers
      WHERE claim_id = ${claimId} AND tenant_id = ${tenantId}
      ORDER BY dossier_version DESC
    `);

    res.json({ dossiers: result.rows });
  } catch (error: any) {
    console.error('[insurance/claims/:id/dossiers GET]', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DOSSIERS
// ============================================================

/**
 * GET /api/insurance/dossiers/:dossierId
 * Get a single dossier with full JSON content
 */
router.get('/dossiers/:dossierId', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const dossierId = req.params.dossierId;

    const result = await db.execute(sql`
      SELECT * FROM cc_claim_dossiers
      WHERE id = ${dossierId} AND tenant_id = ${tenantId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier not found' });
    }

    const dossier = result.rows[0] as Record<string, unknown>;
    res.json({
      dossier_json: dossier.dossier_json,
      dossier_sha256: dossier.dossier_sha256,
      dossier_version: dossier.dossier_version,
      dossier_status: dossier.dossier_status,
      assembled_at: dossier.assembled_at,
      export_artifacts: dossier.export_artifacts,
    });
  } catch (error: any) {
    console.error('[insurance/dossiers/:dossierId GET]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insurance/dossiers/:dossierId/export
 * Export a dossier as zip_json to R2
 */
router.post('/dossiers/:dossierId/export', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const individualId = tenantReq.ctx.individual_id;
    const dossierId = req.params.dossierId;

    const { format } = req.body;
    if (format !== 'zip_json') {
      return res.status(400).json({ error: 'Only zip_json format is supported' });
    }

    // Prepare export data
    const { dossier, exportData } = await prepareDossierExport({
      dossierId,
      tenantId: tenantId!,
      format: 'zip_json',
      exportedByIndividualId: individualId || undefined,
    });

    // Create ZIP in memory
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    const archiveComplete = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    // Add files to archive
    archive.append(JSON.stringify(exportData.dossierJson, null, 2), { name: 'dossier.json' });
    archive.append(JSON.stringify(exportData.inputsJson, null, 2), { name: 'inputs.json' });
    archive.finalize();

    const zipBuffer = await archiveComplete;

    // Upload to R2
    const r2Key = `insurance-dossiers/${tenantId}/${dossier.claimId}/${dossierId}/dossier-v${dossier.dossierVersion}.zip`;
    
    await uploadBufferToR2(r2Key, zipBuffer, 'application/zip');

    // Record the export
    await recordDossierExport({
      dossierId,
      tenantId: tenantId!,
      r2Key,
      format: 'zip_json',
      exportedByIndividualId: individualId || undefined,
    });

    res.json({
      success: true,
      r2_key: r2Key,
      format: 'zip_json',
      dossier_sha256: dossier.dossierSha256,
    });
  } catch (error: any) {
    console.error('[insurance/dossiers/:dossierId/export POST]', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

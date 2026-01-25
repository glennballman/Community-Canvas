/**
 * STEP 11C Phase 2C-10/2C-11: Run Proof Export Route
 * Admin-only export endpoint for deterministic audit bundles with optional attestation
 */

import { Router, Request, Response } from 'express';
import { TenantRequest } from '../middleware/tenantContext';
import { requireAuth, requireTenant, requireRole } from '../middleware/guards';
import { pool } from '../db';
import { buildRunProofExport, type ExportVersion } from '../lib/runProofExport';
import { verifyExportAttestation } from '../lib/verifyRunProofExport';

const router = Router();

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

router.get(
  '/:id/negotiation-proof-export',
  requireAuth,
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest;
    
    try {
      const runId = req.params.id;
      const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
      const version = (req.query.version as string) === 'v1' ? 'v1' : 'v2' as ExportVersion;
      const attestParam = req.query.attest as string | undefined;
      
      let attest: boolean;
      if (attestParam === 'true') {
        attest = true;
      } else if (attestParam === 'false') {
        attest = false;
      } else {
        attest = version === 'v2';
      }

      if (format === 'csv' && attest) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Attestation is not supported for CSV format. Use format=json or attest=false.' 
        });
      }

      const tenantId = tenantReq.ctx?.tenant_id;

      if (!tenantId) {
        return res.status(401).json({ ok: false, error: 'Tenant context required' });
      }

      if (!runId || !isValidUUID(runId)) {
        return res.status(400).json({ ok: false, error: 'Invalid run ID' });
      }

      const runCheck = await pool.query(
        `SELECT id, portal_id FROM cc_n3_runs WHERE id = $1 AND tenant_id = $2`,
        [runId, tenantId]
      );

      if (runCheck.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Run not found' });
      }

      const portalId = runCheck.rows[0].portal_id;

      const exportResult = await buildRunProofExport({
        tenantId,
        portalId,
        runId,
        negotiationType: 'schedule',
        format,
        version,
        attest,
      });

      if (format === 'csv' && exportResult.csv) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        return res.send(exportResult.csv);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      
      if (exportResult.attestation) {
        res.setHeader('X-Export-Hash-Sha256', exportResult.attestation.export_hash_sha256);
        res.setHeader('X-Export-Signature-Ed25519', exportResult.attestation.signature_ed25519);
        res.setHeader('X-Export-Signing-Key-Id', exportResult.attestation.signing_key_id);
      }
      
      return res.send(exportResult.json);
    } catch (error) {
      console.error('Failed to export run proof:', error);
      return res.status(500).json({ ok: false, error: 'Export failed' });
    }
  }
);

router.post(
  '/negotiation-proof-export/verify',
  requireAuth,
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    try {
      const { export_json } = req.body;

      if (!export_json || typeof export_json !== 'string') {
        return res.status(400).json({ ok: false, error: 'export_json is required' });
      }

      const result = verifyExportAttestation(export_json);

      return res.json(result);
    } catch (error) {
      console.error('Failed to verify export:', error);
      return res.status(500).json({ ok: false, error: 'Verification failed' });
    }
  }
);

export default router;

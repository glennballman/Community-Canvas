/**
 * STEP 11C Phase 2C-10: Run Proof Export Route
 * Admin-only export endpoint for deterministic audit bundles
 */

import { Router, Request, Response } from 'express';
import { TenantRequest } from '../middleware/tenantContext';
import { requireAuth, requireTenant, requireRole } from '../middleware/guards';
import { pool } from '../db';
import { buildRunProofExport } from '../lib/runProofExport';

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
      });

      if (format === 'csv' && exportResult.csv) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        return res.send(exportResult.csv);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      return res.send(exportResult.json);
    } catch (error) {
      console.error('Failed to export run proof:', error);
      return res.status(500).json({ ok: false, error: 'Export failed' });
    }
  }
);

export default router;

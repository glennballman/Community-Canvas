import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

router.get('/:portalId', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { portalId } = req.params;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT id, slug, name, settings, site_config, owning_tenant_id
      FROM cc_portals
      WHERE id = $1 AND owning_tenant_id = $2
    `, [portalId, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'PORTAL_NOT_FOUND'
      });
    }

    res.json({
      ok: true,
      portal: result.rows[0]
    });

  } catch (error: any) {
    console.error('Get portal error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch portal'
    });
  }
});

router.patch('/:portalId/appearance', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;
  const { portalId } = req.params;
  const uiSettings = req.body;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const portalCheck = await serviceQuery(`
      SELECT id, settings FROM cc_portals
      WHERE id = $1 AND owning_tenant_id = $2
    `, [portalId, ctx.tenant_id]);

    if (portalCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'PORTAL_NOT_FOUND'
      });
    }

    const existingSettings = portalCheck.rows[0].settings || {};
    const updatedSettings = {
      ...existingSettings,
      ui: uiSettings
    };

    await serviceQuery(`
      UPDATE cc_portals
      SET settings = $1, updated_at = now()
      WHERE id = $2 AND owning_tenant_id = $3
    `, [JSON.stringify(updatedSettings), portalId, ctx.tenant_id]);

    res.json({
      ok: true,
      message: 'Portal appearance updated'
    });

  } catch (error: any) {
    console.error('Update portal appearance error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update portal appearance'
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.tenant_id) {
    return res.status(401).json({
      ok: false,
      error: 'TENANT_REQUIRED'
    });
  }

  try {
    const result = await serviceQuery(`
      SELECT id, slug, name, status, portal_type, is_active, settings, created_at
      FROM cc_portals
      WHERE owning_tenant_id = $1
      ORDER BY created_at DESC
    `, [ctx.tenant_id]);

    res.json({
      ok: true,
      portals: result.rows
    });

  } catch (error: any) {
    console.error('List portals error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list portals'
    });
  }
});

export default router;

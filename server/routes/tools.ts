import { Router, Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/guards';
import { TenantRequest } from '../middleware/tenantContext';

const router = Router();

router.get('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx!.tenant_id;
    const result = await tenantReq.tenantQuery!(
      `SELECT * FROM tenant_tools WHERE tenant_id = $1 ORDER BY category NULLS LAST, name`,
      [tenantId]
    );
    res.json({ tools: result.rows });
  } catch (e: any) {
    console.error('Error fetching tools:', e);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

router.post('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx!.tenant_id;
    const { name, category, description, policy, daily_rate, operator_required, availability_notes } = req.body;
    
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await tenantReq.tenantQuery!(
      `INSERT INTO tenant_tools (
        tenant_id, name, category, description, policy, daily_rate, operator_required, availability_notes
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        tenantId,
        name,
        category || null,
        description || null,
        policy || 'lend',
        daily_rate || null,
        !!operator_required,
        availability_notes || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e: any) {
    console.error('Error creating tool:', e);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

router.patch('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx!.tenant_id;
    const { id } = req.params;
    const { name, category, description, policy, daily_rate, operator_required, availability_notes } = req.body;

    const result = await tenantReq.tenantQuery!(
      `UPDATE tenant_tools SET
        name = COALESCE($3, name),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        policy = COALESCE($6, policy),
        daily_rate = COALESCE($7, daily_rate),
        operator_required = COALESCE($8, operator_required),
        availability_notes = COALESCE($9, availability_notes),
        updated_at = now()
      WHERE id = $1::uuid AND tenant_id = $2::uuid
      RETURNING *`,
      [id, tenantId, name, category, description, policy, daily_rate, operator_required, availability_notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json(result.rows[0]);
  } catch (e: any) {
    console.error('Error updating tool:', e);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

router.delete('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx!.tenant_id;
    const { id } = req.params;

    const result = await tenantReq.tenantQuery!(
      `DELETE FROM tenant_tools WHERE id = $1::uuid AND tenant_id = $2::uuid RETURNING id`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json({ deleted: true, id });
  } catch (e: any) {
    console.error('Error deleting tool:', e);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

export default router;

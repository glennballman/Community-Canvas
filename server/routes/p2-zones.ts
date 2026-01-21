/**
 * Zones v1 API
 * 
 * First-class zones scoped to portals for organizing Work Requests and Properties.
 * All endpoints enforce tenant admin/owner permission.
 */

import { Router } from 'express';
import { pool } from '../db';
import { z } from 'zod';

const router = Router();

async function requireTenantAdmin(req: any, res: any): Promise<{ tenantId: string; userId: string } | null> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return null;
  }
  
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    res.status(400).json({ ok: false, error: 'Tenant context required' });
    return null;
  }
  
  const result = await pool.query(`
    SELECT role FROM cc_tenant_individuals 
    WHERE tenant_id = $1 AND individual_id = $2 AND status = 'active'
    LIMIT 1
  `, [tenantId, userId]);
  
  if (result.rows.length === 0 || !['admin', 'owner'].includes(result.rows[0].role || '')) {
    const isPlatformAdmin = req.user?.isPlatformAdmin === true;
    if (!isPlatformAdmin) {
      res.status(403).json({ ok: false, error: 'Admin access required' });
      return null;
    }
  }
  
  return { tenantId, userId };
}

// ============================================================================
// ZONES CRUD
// ============================================================================

const createZoneSchema = z.object({
  portalId: z.string().uuid(),
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  kind: z.enum(['neighborhood', 'community', 'island', 'access_point', 'district', 'custom']).default('neighborhood'),
  badgeLabelResident: z.string().max(50).nullable().optional(),
  badgeLabelContractor: z.string().max(50).nullable().optional(),
  badgeLabelVisitor: z.string().max(50).nullable().optional(),
  theme: z.record(z.any()).optional().default({}),
  accessProfile: z.record(z.any()).optional().default({}),
});

const updateZoneSchema = createZoneSchema.partial().omit({ portalId: true });

/**
 * GET /api/p2/app/zones
 * List zones for a portal
 * 
 * Query: portalId (required)
 */
router.get('/zones', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { portalId } = req.query;
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'portalId query parameter required' });
    }

    // Verify portal belongs to tenant
    const portalCheck = await pool.query(`
      SELECT id FROM cc_portals WHERE id = $1 AND owning_tenant_id = $2
    `, [portalId, auth.tenantId]);

    if (portalCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Portal not found or access denied' });
    }

    const result = await pool.query(`
      SELECT 
        id, tenant_id, portal_id, key, name, kind,
        badge_label_resident, badge_label_contractor, badge_label_visitor,
        theme, access_profile, created_at, updated_at
      FROM cc_zones
      WHERE portal_id = $1 AND tenant_id = $2
      ORDER BY name ASC
    `, [portalId, auth.tenantId]);

    const zones = result.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      portalId: row.portal_id,
      key: row.key,
      name: row.name,
      kind: row.kind,
      badgeLabelResident: row.badge_label_resident,
      badgeLabelContractor: row.badge_label_contractor,
      badgeLabelVisitor: row.badge_label_visitor,
      theme: row.theme,
      accessProfile: row.access_profile,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ ok: true, zones });
  } catch (error: any) {
    console.error('[Zones] GET zones error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/zones
 * Create a new zone
 */
router.post('/zones', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const parsed = createZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.errors });
    }

    const data = parsed.data;

    // Verify portal belongs to tenant
    const portalCheck = await pool.query(`
      SELECT id FROM cc_portals WHERE id = $1 AND owning_tenant_id = $2
    `, [data.portalId, auth.tenantId]);

    if (portalCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Portal not found or access denied' });
    }

    // Check for duplicate key
    const existingCheck = await pool.query(`
      SELECT id FROM cc_zones WHERE portal_id = $1 AND key = $2
    `, [data.portalId, data.key]);

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ ok: false, error: `Zone with key '${data.key}' already exists in this portal` });
    }

    const result = await pool.query(`
      INSERT INTO cc_zones (
        tenant_id, portal_id, key, name, kind,
        badge_label_resident, badge_label_contractor, badge_label_visitor,
        theme, access_profile
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, tenant_id, portal_id, key, name, kind,
        badge_label_resident, badge_label_contractor, badge_label_visitor,
        theme, access_profile, created_at, updated_at
    `, [
      auth.tenantId,
      data.portalId,
      data.key,
      data.name,
      data.kind,
      data.badgeLabelResident || null,
      data.badgeLabelContractor || null,
      data.badgeLabelVisitor || null,
      JSON.stringify(data.theme || {}),
      JSON.stringify(data.accessProfile || {}),
    ]);

    const row = result.rows[0];
    const zone = {
      id: row.id,
      tenantId: row.tenant_id,
      portalId: row.portal_id,
      key: row.key,
      name: row.name,
      kind: row.kind,
      badgeLabelResident: row.badge_label_resident,
      badgeLabelContractor: row.badge_label_contractor,
      badgeLabelVisitor: row.badge_label_visitor,
      theme: row.theme,
      accessProfile: row.access_profile,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.status(201).json({ ok: true, zone });
  } catch (error: any) {
    console.error('[Zones] POST zones error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/p2/app/zones/:zoneId
 * Update a zone
 */
router.put('/zones/:zoneId', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { zoneId } = req.params;

    const parsed = updateZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.errors });
    }

    const data = parsed.data;

    // Verify zone exists and belongs to tenant
    const zoneCheck = await pool.query(`
      SELECT z.id, z.portal_id FROM cc_zones z
      WHERE z.id = $1 AND z.tenant_id = $2
    `, [zoneId, auth.tenantId]);

    if (zoneCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Zone not found or access denied' });
    }

    const currentZone = zoneCheck.rows[0];

    // Check for duplicate key if key is being changed
    if (data.key) {
      const existingCheck = await pool.query(`
        SELECT id FROM cc_zones WHERE portal_id = $1 AND key = $2 AND id != $3
      `, [currentZone.portal_id, data.key, zoneId]);

      if (existingCheck.rows.length > 0) {
        return res.status(409).json({ ok: false, error: `Zone with key '${data.key}' already exists in this portal` });
      }
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.key !== undefined) {
      updates.push(`key = $${paramIndex++}`);
      values.push(data.key);
    }
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.kind !== undefined) {
      updates.push(`kind = $${paramIndex++}`);
      values.push(data.kind);
    }
    if (data.badgeLabelResident !== undefined) {
      updates.push(`badge_label_resident = $${paramIndex++}`);
      values.push(data.badgeLabelResident);
    }
    if (data.badgeLabelContractor !== undefined) {
      updates.push(`badge_label_contractor = $${paramIndex++}`);
      values.push(data.badgeLabelContractor);
    }
    if (data.badgeLabelVisitor !== undefined) {
      updates.push(`badge_label_visitor = $${paramIndex++}`);
      values.push(data.badgeLabelVisitor);
    }
    if (data.theme !== undefined) {
      updates.push(`theme = $${paramIndex++}`);
      values.push(JSON.stringify(data.theme));
    }
    if (data.accessProfile !== undefined) {
      updates.push(`access_profile = $${paramIndex++}`);
      values.push(JSON.stringify(data.accessProfile));
    }

    values.push(zoneId);
    values.push(auth.tenantId);

    const result = await pool.query(`
      UPDATE cc_zones SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING id, tenant_id, portal_id, key, name, kind,
        badge_label_resident, badge_label_contractor, badge_label_visitor,
        theme, access_profile, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Zone not found' });
    }

    const row = result.rows[0];
    const zone = {
      id: row.id,
      tenantId: row.tenant_id,
      portalId: row.portal_id,
      key: row.key,
      name: row.name,
      kind: row.kind,
      badgeLabelResident: row.badge_label_resident,
      badgeLabelContractor: row.badge_label_contractor,
      badgeLabelVisitor: row.badge_label_visitor,
      theme: row.theme,
      accessProfile: row.access_profile,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({ ok: true, zone });
  } catch (error: any) {
    console.error('[Zones] PUT zones/:zoneId error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/p2/app/zones/:zoneId
 * Delete a zone
 */
router.delete('/zones/:zoneId', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { zoneId } = req.params;

    // Verify zone exists and belongs to tenant
    const result = await pool.query(`
      DELETE FROM cc_zones 
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [zoneId, auth.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Zone not found or access denied' });
    }

    res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[Zones] DELETE zones/:zoneId error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// ZONE ASSIGNMENT
// ============================================================================

const assignZoneSchema = z.object({
  zoneId: z.string().uuid().nullable(),
});

/**
 * PUT /api/p2/app/properties/:propertyId/zone
 * Assign a zone to a property
 */
router.put('/properties/:propertyId/zone', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { propertyId } = req.params;

    const parsed = assignZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.errors });
    }

    const { zoneId } = parsed.data;

    // Verify property exists and belongs to tenant
    const propertyCheck = await pool.query(`
      SELECT id, portal_id FROM cc_properties WHERE id = $1 AND tenant_id = $2
    `, [propertyId, auth.tenantId]);

    if (propertyCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Property not found or access denied' });
    }

    const property = propertyCheck.rows[0];

    // If zoneId provided, verify it belongs to the same portal
    if (zoneId) {
      const zoneCheck = await pool.query(`
        SELECT id FROM cc_zones WHERE id = $1 AND tenant_id = $2 AND portal_id = $3
      `, [zoneId, auth.tenantId, property.portal_id]);

      if (zoneCheck.rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'Zone not found or does not belong to the same portal as the property' });
      }
    }

    await pool.query(`
      UPDATE cc_properties SET zone_id = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [zoneId, propertyId, auth.tenantId]);

    res.json({ ok: true, propertyId, zoneId });
  } catch (error: any) {
    console.error('[Zones] PUT properties/:propertyId/zone error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/p2/app/work-requests/:workRequestId/zone
 * Assign a zone to a work request (cc_work_requests - intake inbox)
 */
router.put('/work-requests/:workRequestId/zone', async (req: any, res) => {
  try {
    const auth = await requireTenantAdmin(req, res);
    if (!auth) return;

    const { workRequestId } = req.params;

    const parsed = assignZoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.errors });
    }

    const { zoneId } = parsed.data;

    // Verify work request exists in cc_work_requests
    const wrCheck = await pool.query(`
      SELECT wr.id, wr.portal_id, wr.tenant_id
      FROM cc_work_requests wr
      WHERE wr.id = $1 AND wr.tenant_id = $2
    `, [workRequestId, auth.tenantId]);

    if (wrCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work Request not found or access denied' });
    }

    const workRequest = wrCheck.rows[0];

    // If zoneId provided, verify it belongs to the same portal
    if (zoneId && workRequest.portal_id) {
      const zoneCheck = await pool.query(`
        SELECT id FROM cc_zones WHERE id = $1 AND tenant_id = $2 AND portal_id = $3
      `, [zoneId, auth.tenantId, workRequest.portal_id]);

      if (zoneCheck.rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'Zone not found or does not belong to the same portal' });
      }
    }

    await pool.query(`
      UPDATE cc_work_requests SET zone_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [zoneId, workRequestId]);

    res.json({ ok: true, workRequestId, zoneId });
  } catch (error: any) {
    console.error('[Zones] PUT work-requests/:workRequestId/zone error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

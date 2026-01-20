/**
 * P2 Work Catalog API
 * 
 * Access constraints, work areas, and work media for properties.
 * Uses tenant-scoped authentication.
 * 
 * TERMINOLOGY: "Work Request" = maintenance/contractor work (cc_maintenance_requests)
 *              "Job" = employment only (cc_jobs)
 */

import { Router } from 'express';
import { pool } from '../db';
import { z } from 'zod';

const router = Router();

async function requireTenantMember(req: any, res: any): Promise<{ tenantId: string; userId: string } | null> {
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
  `, [tenantId, userId]);
  
  if (result.rows.length === 0) {
    const isPlatformAdmin = req.user?.isPlatformAdmin === true;
    if (!isPlatformAdmin) {
      res.status(403).json({ ok: false, error: 'Tenant membership required' });
      return null;
    }
  }
  
  return { tenantId, userId };
}

// ============================================================================
// ACCESS CONSTRAINTS CRUD
// ============================================================================

const accessConstraintSchema = z.object({
  access: z.record(z.any()).default({}),
});

/**
 * GET /api/p2/app/access-constraints/:entityType/:entityId
 * Get access constraints for an entity
 */
router.get('/access-constraints/:entityType/:entityId', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { entityType, entityId } = req.params;
    
    const validTypes = ['property', 'work_request', 'asset', 'zone', 'route_edge', 'portal'];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ ok: false, error: 'Invalid entity type' });
    }

    const result = await pool.query(`
      SELECT id, access, created_at, updated_at
      FROM cc_access_constraints
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
    `, [auth.tenantId, entityType, entityId]);

    if (result.rows.length === 0) {
      return res.json({ ok: true, constraint: null });
    }

    res.json({ ok: true, constraint: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] GET access-constraints error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/p2/app/access-constraints/:entityType/:entityId
 * Upsert access constraints for an entity
 */
router.put('/access-constraints/:entityType/:entityId', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { entityType, entityId } = req.params;
    
    const validTypes = ['property', 'work_request', 'asset', 'zone', 'route_edge', 'portal'];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ ok: false, error: 'Invalid entity type' });
    }

    const parsed = accessConstraintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      INSERT INTO cc_access_constraints (tenant_id, entity_type, entity_id, access)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, entity_type, entity_id)
      DO UPDATE SET access = $4, updated_at = now()
      RETURNING id, access, created_at, updated_at
    `, [auth.tenantId, entityType, entityId, JSON.stringify(parsed.data.access)]);

    res.json({ ok: true, constraint: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] PUT access-constraints error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// RESOLVE EFFECTIVE CONSTRAINTS
// ============================================================================

function mergeConstraints(
  portal: Record<string, any> | null,
  property: Record<string, any> | null,
  workRequest: Record<string, any> | null
): Record<string, any> {
  const sources = [portal, property, workRequest].filter(Boolean) as Record<string, any>[];
  if (sources.length === 0) return {};

  const result: Record<string, any> = {};

  function mergeValue(key: string, values: any[]): any {
    const nonNull = values.filter(v => v !== undefined && v !== null);
    if (nonNull.length === 0) return undefined;

    const sample = nonNull[0];
    
    if (typeof sample === 'boolean') {
      return nonNull.some(v => v === true);
    }
    
    if (Array.isArray(sample)) {
      const merged: any[] = [];
      const seen = new Set<string>();
      nonNull.forEach(arr => arr.forEach((item: any) => {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }));
      return merged;
    }
    
    if (typeof sample === 'number') {
      if (key.includes('min') || key.includes('door_width') || key.includes('load_kg') || key.includes('max_wind')) {
        return Math.min(...nonNull);
      }
      if (key.includes('max') || key.includes('distance') || key.includes('elevation')) {
        return Math.max(...nonNull);
      }
      return nonNull[nonNull.length - 1];
    }
    
    return nonNull[nonNull.length - 1];
  }

  function deepMerge(target: Record<string, any>, sources: Record<string, any>[], path: string = ''): void {
    const allKeysSet = new Set<string>();
    sources.forEach(s => Object.keys(s || {}).forEach(k => allKeysSet.add(k)));
    const allKeys = Array.from(allKeysSet);

    for (const key of allKeys) {
      const fullPath = path ? `${path}.${key}` : key;
      const values = sources.map(s => s?.[key]);
      const nonNullValues = values.filter(v => v !== undefined && v !== null);
      
      if (nonNullValues.length === 0) continue;
      
      if (typeof nonNullValues[0] === 'object' && !Array.isArray(nonNullValues[0])) {
        target[key] = {};
        deepMerge(target[key], nonNullValues, fullPath);
      } else {
        const merged = mergeValue(fullPath, nonNullValues);
        if (merged !== undefined) {
          target[key] = merged;
        }
      }
    }
  }

  deepMerge(result, sources);
  return result;
}

/**
 * GET /api/p2/app/access-constraints/resolve
 * Resolve effective constraints by merging portal → property → work_request
 */
router.get('/access-constraints/resolve', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { propertyId, workRequestId, portalId } = req.query;
    
    if (!propertyId) {
      return res.status(400).json({ ok: false, error: 'propertyId is required' });
    }

    const sources: { portal: any; property: any; work_request: any } = {
      portal: null,
      property: null,
      work_request: null
    };

    if (portalId) {
      const result = await pool.query(`
        SELECT access FROM cc_access_constraints
        WHERE tenant_id = $1 AND entity_type = 'portal' AND entity_id = $2
      `, [auth.tenantId, portalId]);
      sources.portal = result.rows[0]?.access || null;
    }

    const propResult = await pool.query(`
      SELECT access FROM cc_access_constraints
      WHERE tenant_id = $1 AND entity_type = 'property' AND entity_id = $2
    `, [auth.tenantId, propertyId]);
    sources.property = propResult.rows[0]?.access || null;

    if (workRequestId) {
      const result = await pool.query(`
        SELECT access FROM cc_access_constraints
        WHERE tenant_id = $1 AND entity_type = 'work_request' AND entity_id = $2
      `, [auth.tenantId, workRequestId]);
      sources.work_request = result.rows[0]?.access || null;
    }

    const effective = mergeConstraints(sources.portal, sources.property, sources.work_request);

    res.json({ ok: true, effective, sources });
  } catch (error: any) {
    console.error('[WorkCatalog] resolve access-constraints error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// WORK AREAS CRUD
// ============================================================================

const workAreaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
});

/**
 * GET /api/p2/app/properties/:propertyId/work-areas
 * List work areas for a property
 */
router.get('/properties/:propertyId/work-areas', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { propertyId } = req.params;

    const result = await pool.query(`
      SELECT id, title, description, tags, created_by, created_at, updated_at
      FROM cc_work_areas
      WHERE tenant_id = $1 AND property_id = $2
      ORDER BY title ASC
    `, [auth.tenantId, propertyId]);

    res.json({ ok: true, workAreas: result.rows, total: result.rows.length });
  } catch (error: any) {
    console.error('[WorkCatalog] GET work-areas error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/properties/:propertyId/work-areas
 * Create a work area for a property
 */
router.post('/properties/:propertyId/work-areas', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { propertyId } = req.params;
    
    const parsed = workAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      INSERT INTO cc_work_areas (tenant_id, property_id, title, description, tags, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, description, tags, created_by, created_at, updated_at
    `, [
      auth.tenantId, 
      propertyId, 
      parsed.data.title, 
      parsed.data.description || null,
      parsed.data.tags,
      auth.userId
    ]);

    res.json({ ok: true, workArea: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] POST work-area error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/p2/app/work-areas/:workAreaId
 * Update a work area
 */
router.put('/work-areas/:workAreaId', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { workAreaId } = req.params;
    
    const parsed = workAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      UPDATE cc_work_areas
      SET title = $3, description = $4, tags = $5, updated_at = now()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, title, description, tags, created_by, created_at, updated_at
    `, [
      workAreaId,
      auth.tenantId, 
      parsed.data.title, 
      parsed.data.description || null,
      parsed.data.tags
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work area not found' });
    }

    res.json({ ok: true, workArea: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] PUT work-area error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/p2/app/work-areas/:workAreaId
 * Delete a work area
 */
router.delete('/work-areas/:workAreaId', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { workAreaId } = req.params;

    const result = await pool.query(`
      DELETE FROM cc_work_areas
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [workAreaId, auth.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work area not found' });
    }

    res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[WorkCatalog] DELETE work-area error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// WORK MEDIA CRUD
// ============================================================================

const workMediaSchema = z.object({
  portalId: z.string().uuid().optional().nullable(),
  propertyId: z.string().uuid().optional().nullable(),
  workAreaId: z.string().uuid().optional().nullable(),
  entityType: z.enum(['property', 'asset', 'work_request', 'zone', 'route_edge', 'portal']).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  mediaId: z.string().uuid(),
  title: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});

/**
 * GET /api/p2/app/work-media
 * List work media with optional filters
 */
router.get('/work-media', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { propertyId, workAreaId, portalId } = req.query;

    let query = `
      SELECT id, portal_id, property_id, work_area_id, entity_type, entity_id,
             media_id, title, notes, tags, sort_order, created_by, created_at, updated_at
      FROM cc_work_media
      WHERE tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];
    let paramIndex = 2;

    if (propertyId) {
      query += ` AND property_id = $${paramIndex++}`;
      params.push(propertyId);
    }
    if (workAreaId) {
      query += ` AND work_area_id = $${paramIndex++}`;
      params.push(workAreaId);
    }
    if (portalId) {
      query += ` AND portal_id = $${paramIndex++}`;
      params.push(portalId);
    }

    query += ` ORDER BY sort_order ASC, created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json({ ok: true, media: result.rows, total: result.rows.length });
  } catch (error: any) {
    console.error('[WorkCatalog] GET work-media error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/work-media
 * Create a work media entry
 */
router.post('/work-media', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;
    
    const parsed = workMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      INSERT INTO cc_work_media (
        tenant_id, portal_id, property_id, work_area_id, entity_type, entity_id,
        media_id, title, notes, tags, sort_order, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, portal_id, property_id, work_area_id, entity_type, entity_id,
                media_id, title, notes, tags, sort_order, created_by, created_at, updated_at
    `, [
      auth.tenantId,
      parsed.data.portalId || null,
      parsed.data.propertyId || null,
      parsed.data.workAreaId || null,
      parsed.data.entityType || null,
      parsed.data.entityId || null,
      parsed.data.mediaId,
      parsed.data.title || null,
      parsed.data.notes || null,
      parsed.data.tags,
      parsed.data.sortOrder,
      auth.userId
    ]);

    res.json({ ok: true, media: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] POST work-media error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PUT /api/p2/app/work-media/:id
 * Update a work media entry
 */
router.put('/work-media/:id', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { id } = req.params;
    
    const parsed = workMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      UPDATE cc_work_media
      SET portal_id = $3, property_id = $4, work_area_id = $5, entity_type = $6,
          entity_id = $7, media_id = $8, title = $9, notes = $10, tags = $11,
          sort_order = $12, updated_at = now()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, portal_id, property_id, work_area_id, entity_type, entity_id,
                media_id, title, notes, tags, sort_order, created_by, created_at, updated_at
    `, [
      id,
      auth.tenantId,
      parsed.data.portalId || null,
      parsed.data.propertyId || null,
      parsed.data.workAreaId || null,
      parsed.data.entityType || null,
      parsed.data.entityId || null,
      parsed.data.mediaId,
      parsed.data.title || null,
      parsed.data.notes || null,
      parsed.data.tags,
      parsed.data.sortOrder
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work media not found' });
    }

    res.json({ ok: true, media: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] PUT work-media error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/p2/app/work-media/:id
 * Delete a work media entry
 */
router.delete('/work-media/:id', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM cc_work_media
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [id, auth.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work media not found' });
    }

    res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[WorkCatalog] DELETE work-media error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// MAINTENANCE REQUEST WORK AREA LINKAGE
// ============================================================================

const maintenanceWorkAreaSchema = z.object({
  workAreaId: z.string().uuid().nullable(),
});

/**
 * PUT /api/p2/app/maintenance-requests/:id/work-area
 * Link a maintenance request to a work area (stores in details_json.work_area_id)
 */
router.put('/maintenance-requests/:id/work-area', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { id } = req.params;
    
    const parsed = maintenanceWorkAreaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      UPDATE cc_maintenance_requests
      SET details_json = jsonb_set(
        COALESCE(details_json, '{}'::jsonb),
        '{work_area_id}',
        to_jsonb($3::text)
      ),
      updated_at = now()
      WHERE id = $1 AND portal_id IN (
        SELECT id FROM cc_portals WHERE owning_tenant_id = $2
      )
      RETURNING id, details_json
    `, [id, auth.tenantId, parsed.data.workAreaId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Maintenance request not found' });
    }

    res.json({ ok: true, maintenanceRequest: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] PUT maintenance-request work-area error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/app/maintenance-requests/:id/work-area
 * Get the work area linked to a maintenance request
 */
router.get('/maintenance-requests/:id/work-area', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { id } = req.params;

    const result = await pool.query(`
      SELECT mr.id, mr.details_json->>'work_area_id' as work_area_id,
             wa.id as wa_id, wa.title as wa_title, wa.description as wa_description, wa.tags as wa_tags
      FROM cc_maintenance_requests mr
      LEFT JOIN cc_work_areas wa ON (mr.details_json->>'work_area_id')::uuid = wa.id
      WHERE mr.id = $1 AND mr.portal_id IN (
        SELECT id FROM cc_portals WHERE owning_tenant_id = $2
      )
    `, [id, auth.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Maintenance request not found' });
    }

    const row = result.rows[0];
    res.json({ 
      ok: true, 
      workAreaId: row.work_area_id,
      workArea: row.wa_id ? {
        id: row.wa_id,
        title: row.wa_title,
        description: row.wa_description,
        tags: row.wa_tags
      } : null
    });
  } catch (error: any) {
    console.error('[WorkCatalog] GET maintenance-request work-area error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

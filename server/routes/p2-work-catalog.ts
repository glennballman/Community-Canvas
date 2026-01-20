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

async function requireTenantMember(req: any, res: any): Promise<{ tenantId: string; userId: string; role: string } | null> {
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
    // Platform admins get owner role
    return { tenantId, userId, role: 'owner' };
  }
  
  return { tenantId, userId, role: result.rows[0].role };
}

/**
 * Require owner or admin role - blocks contractors from accessing sensitive routes
 * CRITICAL: Work Catalog data should only be accessible by owners/admins
 * Contractors must use disclosure-scoped endpoints only
 */
async function requireOwnerOrAdmin(req: any, res: any): Promise<{ tenantId: string; userId: string; role: string } | null> {
  const auth = await requireTenantMember(req, res);
  if (!auth) return null;
  
  const allowedRoles = ['owner', 'admin', 'manager'];
  if (!allowedRoles.includes(auth.role)) {
    res.status(403).json({ ok: false, error: 'Owner or admin access required' });
    return null;
  }
  
  return auth;
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
  subsystemId: z.string().uuid().optional().nullable(),
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
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const { propertyId, workAreaId, portalId, subsystemId } = req.query;

    let query = `
      SELECT id, portal_id, property_id, work_area_id, subsystem_id, entity_type, entity_id,
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
    if (subsystemId) {
      query += ` AND subsystem_id = $${paramIndex++}`;
      params.push(subsystemId);
    }

    query += ` ORDER BY sort_order ASC, created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json({ ok: true, workMedia: result.rows, total: result.rows.length });
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
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;
    
    const parsed = workMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const result = await pool.query(`
      INSERT INTO cc_work_media (
        tenant_id, portal_id, property_id, work_area_id, subsystem_id, entity_type, entity_id,
        media_id, title, notes, tags, sort_order, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, portal_id, property_id, work_area_id, subsystem_id, entity_type, entity_id,
                media_id, title, notes, tags, sort_order, created_by, created_at, updated_at
    `, [
      auth.tenantId,
      parsed.data.portalId || null,
      parsed.data.propertyId || null,
      parsed.data.workAreaId || null,
      parsed.data.subsystemId || null,
      parsed.data.entityType || null,
      parsed.data.entityId || null,
      parsed.data.mediaId,
      parsed.data.title || null,
      parsed.data.notes || null,
      parsed.data.tags,
      parsed.data.sortOrder,
      auth.userId
    ]);

    res.json({ ok: true, workMedia: result.rows[0] });
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
    const auth = await requireOwnerOrAdmin(req, res);
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

    res.json({ ok: true, workMedia: result.rows[0] });
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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
    const auth = await requireOwnerOrAdmin(req, res);
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

// ============================================================================
// WORK DISCLOSURES
// ============================================================================

const disclosureSchema = z.object({
  workRequestId: z.string().uuid(),
  itemType: z.enum(['work_area', 'work_media', 'subsystem', 'access_constraints', 'property_notes', 'community_media']),
  itemId: z.string().uuid().nullable().optional(),
  visibility: z.enum(['contractor', 'specific_contractor']).default('contractor'),
  specificContractorId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/p2/app/work-disclosures/:workRequestId
 * Get all disclosures for a work request
 */
router.get('/work-disclosures/:workRequestId', async (req: any, res) => {
  try {
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const { workRequestId } = req.params;

    const result = await pool.query(`
      SELECT d.*, 
             wa.title as work_area_title,
             wm.title as work_media_title, wm.notes as work_media_notes
      FROM cc_work_disclosures d
      LEFT JOIN cc_work_areas wa ON d.item_type = 'work_area' AND d.item_id = wa.id
      LEFT JOIN cc_work_media wm ON d.item_type = 'work_media' AND d.item_id = wm.id
      WHERE d.tenant_id = $1 AND d.work_request_id = $2
      ORDER BY d.created_at
    `, [auth.tenantId, workRequestId]);

    res.json({ ok: true, disclosures: result.rows });
  } catch (error: any) {
    console.error('[WorkCatalog] GET disclosures error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/work-disclosures
 * Create a disclosure
 */
router.post('/work-disclosures', async (req: any, res) => {
  try {
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const parsed = disclosureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }

    const { workRequestId, itemType, itemId, visibility, specificContractorId } = parsed.data;

    const result = await pool.query(`
      INSERT INTO cc_work_disclosures (
        tenant_id, work_request_id, item_type, item_id, 
        visibility, specific_contractor_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [auth.tenantId, workRequestId, itemType, itemId, visibility, specificContractorId, auth.userId]);

    res.json({ ok: true, disclosure: result.rows[0] });
  } catch (error: any) {
    console.error('[WorkCatalog] POST disclosure error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/p2/app/work-disclosures/bulk
 * Bulk create/update disclosures for a work request
 * 
 * Optional: contractorPersonId - if provided, assigns this contractor to the work request
 */
router.post('/work-disclosures/bulk', async (req: any, res) => {
  try {
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const { workRequestId, disclosures, contractorPersonId } = req.body;
    
    if (!workRequestId || !Array.isArray(disclosures)) {
      return res.status(400).json({ ok: false, error: 'workRequestId and disclosures array required' });
    }

    // Validate work request belongs to this tenant via portal ownership
    const wrCheck = await pool.query(`
      SELECT wr.id 
      FROM cc_maintenance_requests wr
      JOIN cc_portals p ON wr.portal_id = p.id
      WHERE wr.id = $1 AND p.owning_tenant_id = $2
    `, [workRequestId, auth.tenantId]);

    if (wrCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work request not found or not accessible' });
    }

    // If contractorPersonId provided, update the work request's assigned contractor
    if (contractorPersonId) {
      await pool.query(`
        UPDATE cc_maintenance_requests
        SET assigned_contractor_person_id = $1
        WHERE id = $2
      `, [contractorPersonId, workRequestId]);
    }

    // Get previous disclosures for audit diff
    const prevResult = await pool.query(`
      SELECT item_type, item_id FROM cc_work_disclosures
      WHERE tenant_id = $1 AND work_request_id = $2
    `, [auth.tenantId, workRequestId]);
    const prevItems = prevResult.rows.map(r => `${r.item_type}:${r.item_id}`);
    
    // Delete existing disclosures for this work request
    await pool.query(`
      DELETE FROM cc_work_disclosures
      WHERE tenant_id = $1 AND work_request_id = $2
    `, [auth.tenantId, workRequestId]);

    // Insert new disclosures
    if (disclosures.length > 0) {
      const values = disclosures.map((d: any, i: number) => {
        const offset = i * 7;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      }).join(', ');

      const params = disclosures.flatMap((d: any) => [
        auth.tenantId, workRequestId, d.itemType, d.itemId || null,
        d.visibility || 'contractor', d.specificContractorId || null, auth.userId
      ]);

      await pool.query(`
        INSERT INTO cc_work_disclosures (
          tenant_id, work_request_id, item_type, item_id, 
          visibility, specific_contractor_id, created_by
        )
        VALUES ${values}
      `, params);
    }

    // Log disclosure update to audit table
    const newItems = disclosures.map((d: any) => `${d.itemType}:${d.itemId || 'null'}`);
    const action = prevItems.length === 0 ? 'share_set' : 'share_update';
    await pool.query(`
      INSERT INTO cc_work_disclosure_audit 
      (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      auth.tenantId, 
      workRequestId, 
      auth.userId, 
      contractorPersonId || null,
      action,
      JSON.stringify({ 
        previous: prevItems, 
        current: newItems,
        count: disclosures.length 
      })
    ]);

    res.json({ ok: true, count: disclosures.length });
  } catch (error: any) {
    console.error('[WorkCatalog] POST bulk disclosures error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/p2/app/work-disclosures/:id
 * Delete a disclosure (revoke)
 */
router.delete('/work-disclosures/:id', async (req: any, res) => {
  try {
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM cc_work_disclosures
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [id, auth.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Disclosure not found' });
    }

    res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[WorkCatalog] DELETE disclosure error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/p2/app/work-disclosures/contractor/:workRequestId
 * Get disclosed items for a contractor (read-only view)
 * 
 * SECURITY: This endpoint uses requireTenantMember (not requireOwnerOrAdmin)
 * because contractors need access to their disclosed items.
 * Additional check: verifies user is the assigned contractor via cc_people.user_id.
 * 
 * NOTE: assigned_contractor_person_id references cc_people, not users directly.
 * We join cc_people to get user_id for contractor assignment verification.
 */
router.get('/work-disclosures/contractor/:workRequestId', async (req: any, res) => {
  try {
    const auth = await requireTenantMember(req, res);
    if (!auth) return;

    const { workRequestId } = req.params;

    // Verify the work request belongs to the tenant AND get assigned contractor person
    // Or user is owner/admin (they can view everything)
    const allowedRoles = ['owner', 'admin', 'manager'];
    const isOwnerOrAdmin = allowedRoles.includes(auth.role);
    
    const wrCheck = await pool.query(`
      SELECT wr.id, wr.assigned_contractor_person_id, p2.user_id as contractor_user_id
      FROM cc_maintenance_requests wr
      JOIN cc_portals p ON wr.portal_id = p.id
      LEFT JOIN cc_people p2 ON wr.assigned_contractor_person_id = p2.id
      WHERE wr.id = $1 AND p.owning_tenant_id = $2
    `, [workRequestId, auth.tenantId]);

    if (wrCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work request not found' });
    }
    
    // If not owner/admin, verify user is the assigned contractor
    const contractorPersonId = wrCheck.rows[0].assigned_contractor_person_id;
    if (!isOwnerOrAdmin) {
      const contractorUserId = wrCheck.rows[0].contractor_user_id;
      
      if (!contractorPersonId || contractorUserId !== auth.userId) {
        // Log denied access attempt with contractor attribution
        await pool.query(`
          INSERT INTO cc_work_disclosure_audit (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
          VALUES ($1, $2, $3, $4, 'view_denied', $5)
        `, [auth.tenantId, workRequestId, auth.userId, contractorPersonId, JSON.stringify({ reason: 'not_assigned' })]);
        
        return res.status(403).json({ ok: false, error: 'You are not assigned to this work request' });
      }
    }

    // Get disclosed items only - includes work_areas, work_media, access_constraints,
    // subsystems, and on_site_resources
    const result = await pool.query(`
      SELECT d.item_type, d.item_id,
             wa.title as work_area_title, wa.description as work_area_description, wa.tags as work_area_tags,
             wm.title as work_media_title, wm.notes as work_media_notes, wm.tags as work_media_tags, wm.url as work_media_url,
             ac.access as access_constraints,
             ps.title as subsystem_title, ps.description as subsystem_description, ps.tags as subsystem_tags,
             osr.name as resource_name, osr.description as resource_description, 
             osr.resource_type, osr.storage_location, osr.share_policy
      FROM cc_work_disclosures d
      LEFT JOIN cc_work_areas wa ON d.item_type = 'work_area' AND d.item_id = wa.id
      LEFT JOIN cc_work_media wm ON d.item_type = 'work_media' AND d.item_id = wm.id
      LEFT JOIN cc_access_constraints ac ON d.item_type = 'access_constraints' AND d.item_id = ac.id
      LEFT JOIN cc_property_subsystems ps ON d.item_type = 'subsystem' AND d.item_id = ps.id
      LEFT JOIN cc_on_site_resources osr ON d.item_type = 'on_site_resource' AND d.item_id = osr.id
      WHERE d.work_request_id = $1 AND d.tenant_id = $2
      ORDER BY d.item_type, d.created_at
    `, [workRequestId, auth.tenantId]);

    // Group by type
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!grouped[row.item_type]) grouped[row.item_type] = [];
      grouped[row.item_type].push(row);
    }

    res.json({ ok: true, disclosedItems: grouped });
  } catch (error: any) {
    console.error('[WorkCatalog] GET contractor disclosures error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

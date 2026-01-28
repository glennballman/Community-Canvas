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
import crypto from 'crypto';
import { can } from '../auth/authorize';

const router = Router();

// PROMPT-4: Capability-based tenant member check
// Uses tenant.read capability instead of isPlatformAdmin boolean
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
    // PROMPT-4: Check tenant.read capability instead of isPlatformAdmin
    const hasCapability = await can(req, 'tenant.read');
    if (!hasCapability) {
      res.status(403).json({ ok: false, error: 'Tenant membership required' });
      return null;
    }
    // Users with tenant.read capability get owner role for access
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

/**
 * Get the user's cc_people record with contractor type (if they have one)
 * Returns null if no contractor person record exists for this user
 * PROMPT 5: Validates entity_type='contractor' to prevent non-contractors from accessing
 */
async function getUserContractorRecord(tenantId: string, userId: string): Promise<{ id: string; entityType: string } | null> {
  const result = await pool.query(`
    SELECT id, entity_type 
    FROM cc_people 
    WHERE tenant_id = $1 AND user_id = $2 AND entity_type = 'contractor'
    LIMIT 1
  `, [tenantId, userId]);
  
  return result.rows.length > 0 
    ? { id: result.rows[0].id, entityType: result.rows[0].entity_type }
    : null;
}

/**
 * Validate that a contractor person ID belongs to the tenant and is marked as contractor
 * Returns true if valid, false otherwise
 */
async function validateContractorPersonId(tenantId: string, contractorPersonId: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT id FROM cc_people 
    WHERE id = $1 AND tenant_id = $2 AND entity_type = 'contractor'
    LIMIT 1
  `, [contractorPersonId, tenantId]);
  
  return result.rows.length > 0;
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

    // Transform to camelCase for frontend consumption
    const disclosures = result.rows.map(row => ({
      id: row.id,
      workRequestId: row.work_request_id,
      itemType: row.item_type,
      itemId: row.item_id,
      visibility: row.visibility,
      specificContractorId: row.specific_contractor_id,
      workAreaTitle: row.work_area_title,
      workMediaTitle: row.work_media_title,
      workMediaNotes: row.work_media_notes,
      createdAt: row.created_at
    }));

    res.json({ ok: true, disclosures });
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

    // If contractorPersonId provided, validate and update the work request's assigned contractor
    if (contractorPersonId) {
      // Validate contractor belongs to tenant and has contractor entity type
      const isValidContractor = await validateContractorPersonId(auth.tenantId, contractorPersonId);
      if (!isValidContractor) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Invalid contractor: must belong to tenant and have entity_type=contractor' 
        });
      }
      
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
 * PROMPT 5: Logs revoke action to audit table
 */
router.delete('/work-disclosures/:id', async (req: any, res) => {
  try {
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const { id } = req.params;

    // Get disclosure details before deleting for audit log
    const disclosureResult = await pool.query(`
      SELECT work_request_id, item_type, item_id, specific_contractor_id
      FROM cc_work_disclosures
      WHERE id = $1 AND tenant_id = $2
    `, [id, auth.tenantId]);

    if (disclosureResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Disclosure not found' });
    }

    const disclosure = disclosureResult.rows[0];

    // Delete the disclosure
    await pool.query(`
      DELETE FROM cc_work_disclosures
      WHERE id = $1 AND tenant_id = $2
    `, [id, auth.tenantId]);

    // Log revoke action to audit table
    await pool.query(`
      INSERT INTO cc_work_disclosure_audit 
      (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
      VALUES ($1, $2, $3, $4, 'revoke', $5)
    `, [
      auth.tenantId, 
      disclosure.work_request_id, 
      auth.userId, 
      disclosure.specific_contractor_id,
      JSON.stringify({ 
        revokedId: id,
        itemType: disclosure.item_type,
        itemId: disclosure.item_id
      })
    ]);

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
 * PROMPT 5 COMPLIANCE: This endpoint is for contractors ONLY (unless previewToken provided).
 * Owners/admins should use full-access endpoints (GET /work-disclosures/work-request/:id)
 * 
 * PROMPT 7: Accepts optional ?previewToken query param for owner/admin preview
 * 
 * AUTHORIZATION:
 * If previewToken provided:
 *   - Validate token exists, matches work_request_id, not expired, not used
 *   - Mark token used (single-use)
 *   - Return disclosed items for the token's contractorPersonId
 * 
 * If no previewToken:
 *   1. Get the requester's cc_people contractor record (validates entity_type='contractor')
 *   2. If none exists, return 403
 *   3. Allow access only if EITHER:
 *      (a) workRequest.assigned_contractor_person_id == requester contractorPersonId
 *      OR
 *      (b) there exists a disclosure row with visibility='specific_contractor' 
 *          and specific_contractor_id == requester contractorPersonId
 */
router.get('/work-disclosures/contractor/:workRequestId', async (req: any, res) => {
  try {
    const { workRequestId } = req.params;
    const { previewToken } = req.query;

    let tenantId: string;
    let actingContractorId: string;
    let actorUserId: string | null = null;
    let isPreviewMode = false;

    // PROMPT 7: Handle preview token flow
    if (previewToken && typeof previewToken === 'string') {
      isPreviewMode = true;
      
      // Validate token
      const tokenResult = await pool.query(`
        SELECT t.*, p.owning_tenant_id as tenant_id
        FROM cc_work_disclosure_preview_tokens t
        JOIN cc_maintenance_requests wr ON t.work_request_id = wr.id
        JOIN cc_portals p ON wr.portal_id = p.id
        WHERE t.token = $1 AND t.work_request_id = $2
      `, [previewToken, workRequestId]);

      if (tokenResult.rows.length === 0) {
        // Try to get tenant for audit logging
        const wrCheck = await pool.query(`
          SELECT p.owning_tenant_id FROM cc_maintenance_requests wr
          JOIN cc_portals p ON wr.portal_id = p.id
          WHERE wr.id = $1
        `, [workRequestId]);
        
        if (wrCheck.rows.length > 0) {
          await pool.query(`
            INSERT INTO cc_work_disclosure_audit 
              (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
            VALUES ($1, $2, NULL, NULL, 'view_denied', $3)
          `, [wrCheck.rows[0].owning_tenant_id, workRequestId, JSON.stringify({ reason: 'invalid_preview_token' })]);
        }
        
        return res.status(403).json({ ok: false, error: 'Invalid preview token' });
      }

      const tokenRow = tokenResult.rows[0];
      tenantId = tokenRow.tenant_id;
      actorUserId = tokenRow.created_by_user_id;

      // Check if token is expired
      if (new Date(tokenRow.expires_at) < new Date()) {
        await pool.query(`
          INSERT INTO cc_work_disclosure_audit 
            (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
          VALUES ($1, $2, $3, $4, 'view_denied', $5)
        `, [tenantId, workRequestId, actorUserId, tokenRow.contractor_person_id, 
            JSON.stringify({ reason: 'expired_preview_token' })]);
        
        return res.status(403).json({ ok: false, error: 'Preview token expired' });
      }

      // Check if token already used (single-use enforcement)
      if (tokenRow.used_at) {
        await pool.query(`
          INSERT INTO cc_work_disclosure_audit 
            (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
          VALUES ($1, $2, $3, $4, 'view_denied', $5)
        `, [tenantId, workRequestId, actorUserId, tokenRow.contractor_person_id,
            JSON.stringify({ reason: 'used_preview_token' })]);
        
        return res.status(403).json({ ok: false, error: 'Preview token already used' });
      }

      // Mark token as used (single-use)
      await pool.query(`
        UPDATE cc_work_disclosure_preview_tokens SET used_at = NOW() WHERE id = $1
      `, [tokenRow.id]);

      // Log successful preview
      await pool.query(`
        INSERT INTO cc_work_disclosure_audit 
          (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
        VALUES ($1, $2, $3, $4, 'preview_token_used', $5)
      `, [tenantId, workRequestId, actorUserId, tokenRow.contractor_person_id,
          JSON.stringify({ tokenId: tokenRow.id })]);

      actingContractorId = tokenRow.contractor_person_id;
      
    } else {
      // Standard contractor auth flow (no preview token)
      const auth = await requireTenantMember(req, res);
      if (!auth) return;

      // PROMPT 5: This endpoint is contractor-only. Owners/admins should use full-access endpoints.
      const allowedRoles = ['owner', 'admin', 'manager'];
      const isOwnerOrAdmin = allowedRoles.includes(auth.role);
      if (isOwnerOrAdmin) {
        return res.status(403).json({ 
          ok: false, 
          error: 'This endpoint is for contractors only. Use /work-disclosures/work-request/:id for full access.' 
        });
      }

      tenantId = auth.tenantId;
      actorUserId = auth.userId;

      // Verify the work request belongs to the tenant
      const wrCheck = await pool.query(`
        SELECT wr.id, wr.assigned_contractor_person_id
        FROM cc_maintenance_requests wr
        JOIN cc_portals p ON wr.portal_id = p.id
        WHERE wr.id = $1 AND p.owning_tenant_id = $2
      `, [workRequestId, tenantId]);

      if (wrCheck.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Work request not found' });
      }
      
      // Step 1: Get the requester's cc_people contractor record (validates entity_type='contractor')
      const userPerson = await getUserContractorRecord(tenantId, auth.userId);
      
      if (!userPerson) {
        // No person record - log and deny
        await pool.query(`
          INSERT INTO cc_work_disclosure_audit (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
          VALUES ($1, $2, $3, NULL, 'view_denied', $4)
        `, [tenantId, workRequestId, auth.userId, JSON.stringify({ reason: 'no_contractor_record' })]);
        
        return res.status(403).json({ ok: false, error: 'No contractor profile linked to your account' });
      }
      
      const requesterContractorId = userPerson.id;
      const assignedContractorId = wrCheck.rows[0].assigned_contractor_person_id;
      
      // Step 2: Check authorization - assignment OR specific disclosure
      const isAssigned = assignedContractorId === requesterContractorId;
      
      // Check for specific_contractor disclosure
      const specificDisclosureCheck = await pool.query(`
        SELECT 1 FROM cc_work_disclosures
        WHERE work_request_id = $1 AND tenant_id = $2 
          AND visibility = 'specific_contractor' AND specific_contractor_id = $3
        LIMIT 1
      `, [workRequestId, tenantId, requesterContractorId]);
      
      const hasSpecificDisclosure = specificDisclosureCheck.rows.length > 0;
      
      if (!isAssigned && !hasSpecificDisclosure) {
        // Log denied access attempt with requester's contractor ID
        await pool.query(`
          INSERT INTO cc_work_disclosure_audit (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
          VALUES ($1, $2, $3, $4, 'view_denied', $5)
        `, [
          tenantId, workRequestId, auth.userId, requesterContractorId, 
          JSON.stringify({ 
            reason: 'not_authorized', 
            requesterContractorId, 
            assignedContractorId,
            hasSpecificDisclosure: false
          })
        ]);
        
        return res.status(403).json({ ok: false, error: 'You are not authorized to access this work request' });
      }

      actingContractorId = requesterContractorId;
    }

    // Get disclosed items for the acting contractor (either real contractor or preview)
    // Filter by visibility: 'contractor' (all contractors) or 'specific_contractor' matching this contractor
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
        AND (
          d.visibility = 'contractor' 
          OR (d.visibility = 'specific_contractor' AND d.specific_contractor_id = $3)
        )
      ORDER BY d.item_type, d.created_at
    `, [workRequestId, tenantId, actingContractorId]);

    // Group by type
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!grouped[row.item_type]) grouped[row.item_type] = [];
      grouped[row.item_type].push(row);
    }

    const response: any = { ok: true, disclosedItems: grouped };
    if (isPreviewMode) {
      response.previewFor = { contractorPersonId: actingContractorId, workRequestId };
    }

    res.json(response);
  } catch (error: any) {
    console.error('[WorkCatalog] GET contractor disclosures error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// PROMPT 7: PREVIEW TOKEN SYSTEM
// ============================================================================

const previewTokenSchema = z.object({
  workRequestId: z.string().uuid(),
  contractorPersonId: z.string().uuid()
});

/**
 * POST /api/p2/app/work-disclosures/preview-token
 * Mint a single-use, short-lived preview token for viewing disclosed items as contractor
 * 
 * PROMPT 7: Only owner/admin can mint preview tokens.
 * Token expires in 15 minutes and is single-use.
 */
router.post('/work-disclosures/preview-token', async (req: any, res) => {
  try {
    const auth = await requireOwnerOrAdmin(req, res);
    if (!auth) return;

    const parsed = previewTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.flatten() });
    }

    const { workRequestId, contractorPersonId } = parsed.data;

    // Validate work request belongs to tenant
    const wrCheck = await pool.query(`
      SELECT wr.id FROM cc_maintenance_requests wr
      JOIN cc_portals p ON wr.portal_id = p.id
      WHERE wr.id = $1 AND p.owning_tenant_id = $2
    `, [workRequestId, auth.tenantId]);

    if (wrCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Work request not found' });
    }

    // Validate contractor person belongs to tenant and is contractor type
    const isValidContractor = await validateContractorPersonId(auth.tenantId, contractorPersonId);
    if (!isValidContractor) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Invalid contractor: must belong to tenant and have entity_type=contractor' 
      });
    }

    // Generate cryptographically random token (32 bytes = 256 bits)
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Insert token
    await pool.query(`
      INSERT INTO cc_work_disclosure_preview_tokens 
        (tenant_id, work_request_id, contractor_person_id, token, expires_at, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [auth.tenantId, workRequestId, contractorPersonId, token, expiresAt, auth.userId]);

    // Audit log with full details per PROMPT 7 spec
    await pool.query(`
      INSERT INTO cc_work_disclosure_audit 
        (tenant_id, work_request_id, actor_user_id, contractor_person_id, action, payload)
      VALUES ($1, $2, $3, $4, 'preview_token_created', $5)
    `, [
      auth.tenantId, workRequestId, auth.userId, contractorPersonId,
      JSON.stringify({ 
        workRequestId, 
        contractorPersonId, 
        expiresAt: expiresAt.toISOString() 
      })
    ]);

    res.json({ ok: true, token, expiresAt: expiresAt.toISOString() });
  } catch (error: any) {
    console.error('[WorkCatalog] POST preview-token error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

/**
 * P2 Subsystems & On-Site Resources API
 * 
 * Property subsystems (canonical + custom) and on-site resources (tools/materials).
 * Uses tenant-scoped authentication.
 * 
 * TERMINOLOGY: "Work Request" = maintenance/contractor work (cc_maintenance_requests)
 *              "Job" = employment only (cc_jobs)
 */

import { Router } from 'express';
import { pool } from '../db';
import { z } from 'zod';
import { can } from '../auth/authorize';

const router = Router();

// PROMPT-4: Capability-based tenant member check
// Uses tenant.configure capability for least-privilege (matches owner/admin requirement)
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
    // PROMPT-4: Check tenant.configure capability instead of isPlatformAdmin
    const hasCapability = await can(req, 'tenant.configure');
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

// ============ SUBSYSTEM CATALOG APIs ============

router.get('/subsystem-catalog', async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT id, key, title, description, tags, is_sensitive as "isSensitive"
      FROM cc_subsystem_catalog
      ORDER BY title ASC
    `);
    res.json({ ok: true, catalog: result.rows });
  } catch (error: any) {
    console.error('[Subsystems] GET catalog error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============ PROPERTY SUBSYSTEMS APIs ============

router.get('/properties/:propertyId/subsystems', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { propertyId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT ps.id, ps.catalog_key as "catalogKey", ps.custom_key as "customKey", 
             ps.title, ps.description, ps.tags, ps.visibility, ps.is_sensitive as "isSensitive",
             ps.created_at as "createdAt", ps.updated_at as "updatedAt"
      FROM cc_property_subsystems ps
      WHERE ps.tenant_id = $1 AND ps.property_id = $2
      ORDER BY ps.title ASC
    `, [auth.tenantId, propertyId]);
    
    res.json({ ok: true, subsystems: result.rows });
  } catch (error: any) {
    console.error('[Subsystems] GET property subsystems error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const createSubsystemSchema = z.object({
  catalogKey: z.string().optional(),
  customKey: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(['private', 'contractor']).default('private'),
});

router.post('/properties/:propertyId/subsystems', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { propertyId } = req.params;
  
  const parsed = createSubsystemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.errors });
  }
  
  let { catalogKey, customKey, title, description, tags, visibility } = parsed.data;
  
  if (!catalogKey && !customKey) {
    return res.status(400).json({ ok: false, error: 'Either catalogKey or customKey is required' });
  }
  
  if (catalogKey && customKey) {
    return res.status(400).json({ ok: false, error: 'Only one of catalogKey or customKey allowed' });
  }
  
  if (customKey && !customKey.startsWith('custom:')) {
    customKey = `custom:${customKey}`;
  }
  
  try {
    let isSensitive = false;
    
    if (catalogKey) {
      const catalogResult = await pool.query(
        `SELECT title, description, is_sensitive FROM cc_subsystem_catalog WHERE key = $1`,
        [catalogKey]
      );
      if (catalogResult.rows.length === 0) {
        return res.status(400).json({ ok: false, error: 'Invalid catalog key' });
      }
      const catalog = catalogResult.rows[0];
      title = title || catalog.title;
      description = description || catalog.description;
      isSensitive = catalog.is_sensitive;
    }
    
    if (!title) {
      return res.status(400).json({ ok: false, error: 'Title is required for custom subsystems' });
    }
    
    if (isSensitive) {
      visibility = 'private';
    }
    
    const result = await pool.query(`
      INSERT INTO cc_property_subsystems 
        (tenant_id, property_id, catalog_key, custom_key, title, description, tags, visibility, is_sensitive, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, catalog_key as "catalogKey", custom_key as "customKey", 
                title, description, tags, visibility, is_sensitive as "isSensitive",
                created_at as "createdAt"
    `, [auth.tenantId, propertyId, catalogKey || null, customKey || null, title, description, tags, visibility, isSensitive, auth.userId]);
    
    res.json({ ok: true, subsystem: result.rows[0] });
  } catch (error: any) {
    console.error('[Subsystems] POST subsystem error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Subsystem already exists for this property' });
    }
    res.status(500).json({ ok: false, error: error.message });
  }
});

const updateSubsystemSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['private', 'contractor']).optional(),
});

router.put('/subsystems/:subsystemId', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { subsystemId } = req.params;
  
  const parsed = updateSubsystemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.errors });
  }
  
  try {
    const existing = await pool.query(
      `SELECT is_sensitive FROM cc_property_subsystems WHERE id = $1 AND tenant_id = $2`,
      [subsystemId, auth.tenantId]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Subsystem not found' });
    }
    
    let { visibility } = parsed.data;
    if (existing.rows[0].is_sensitive && visibility === 'contractor') {
      visibility = 'private';
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    
    if (parsed.data.title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      values.push(parsed.data.title);
    }
    if (parsed.data.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(parsed.data.description);
    }
    if (parsed.data.tags !== undefined) {
      updates.push(`tags = $${paramIdx++}`);
      values.push(parsed.data.tags);
    }
    if (visibility !== undefined) {
      updates.push(`visibility = $${paramIdx++}`);
      values.push(visibility);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No updates provided' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(subsystemId, auth.tenantId);
    
    const result = await pool.query(`
      UPDATE cc_property_subsystems 
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}
      RETURNING id, catalog_key as "catalogKey", custom_key as "customKey", 
                title, description, tags, visibility, is_sensitive as "isSensitive",
                updated_at as "updatedAt"
    `, values);
    
    res.json({ ok: true, subsystem: result.rows[0] });
  } catch (error: any) {
    console.error('[Subsystems] PUT subsystem error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/subsystems/:subsystemId', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { subsystemId } = req.params;
  
  try {
    const result = await pool.query(
      `DELETE FROM cc_property_subsystems WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [subsystemId, auth.tenantId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Subsystem not found' });
    }
    
    res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[Subsystems] DELETE subsystem error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============ ON-SITE RESOURCES APIs ============

router.get('/properties/:propertyId/on-site-resources', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { propertyId } = req.params;
  const { resourceType } = req.query;
  
  try {
    let query = `
      SELECT id, resource_type as "resourceType", name, description, 
             quantity, unit, condition, tags, unspsc_code as "unspscCode",
             storage_location as "storageLocation", share_policy as "sharePolicy",
             suggested_price_amount as "suggestedPriceAmount", 
             suggested_price_currency as "suggestedPriceCurrency",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM cc_on_site_resources
      WHERE tenant_id = $1 AND property_id = $2
    `;
    const params: any[] = [auth.tenantId, propertyId];
    
    if (resourceType && ['tool', 'material'].includes(resourceType as string)) {
      query += ` AND resource_type = $3`;
      params.push(resourceType);
    }
    
    query += ` ORDER BY name ASC`;
    
    const result = await pool.query(query, params);
    res.json({ ok: true, resources: result.rows });
  } catch (error: any) {
    console.error('[OnSiteResources] GET resources error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const createResourceSchema = z.object({
  resourceType: z.enum(['tool', 'material']),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  condition: z.string().optional(),
  tags: z.array(z.string()).default([]),
  unspscCode: z.string().optional(),
  storageLocation: z.string().optional(),
  sharePolicy: z.enum(['private', 'disclosable', 'offerable']).default('private'),
  suggestedPriceAmount: z.number().optional(),
  suggestedPriceCurrency: z.string().default('CAD'),
});

router.post('/properties/:propertyId/on-site-resources', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { propertyId } = req.params;
  
  const parsed = createResourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.errors });
  }
  
  const data = parsed.data;
  
  try {
    const result = await pool.query(`
      INSERT INTO cc_on_site_resources 
        (tenant_id, property_id, resource_type, name, description, quantity, unit, condition, 
         tags, unspsc_code, storage_location, share_policy, suggested_price_amount, 
         suggested_price_currency, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, resource_type as "resourceType", name, description, 
                quantity, unit, condition, tags, unspsc_code as "unspscCode",
                storage_location as "storageLocation", share_policy as "sharePolicy",
                suggested_price_amount as "suggestedPriceAmount", 
                suggested_price_currency as "suggestedPriceCurrency",
                created_at as "createdAt"
    `, [
      auth.tenantId, propertyId, data.resourceType, data.name, data.description,
      data.quantity, data.unit, data.condition, data.tags, data.unspscCode,
      data.storageLocation, data.sharePolicy, data.suggestedPriceAmount,
      data.suggestedPriceCurrency, auth.userId
    ]);
    
    res.json({ ok: true, resource: result.rows[0] });
  } catch (error: any) {
    console.error('[OnSiteResources] POST resource error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.put('/on-site-resources/:id', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { id } = req.params;
  
  const updateSchema = createResourceSchema.partial();
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.errors });
  }
  
  const data = parsed.data;
  
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    
    const fieldMap: Record<string, string> = {
      resourceType: 'resource_type',
      name: 'name',
      description: 'description',
      quantity: 'quantity',
      unit: 'unit',
      condition: 'condition',
      tags: 'tags',
      unspscCode: 'unspsc_code',
      storageLocation: 'storage_location',
      sharePolicy: 'share_policy',
      suggestedPriceAmount: 'suggested_price_amount',
      suggestedPriceCurrency: 'suggested_price_currency',
    };
    
    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      if ((data as any)[jsKey] !== undefined) {
        updates.push(`${dbKey} = $${paramIdx++}`);
        values.push((data as any)[jsKey]);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No updates provided' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, auth.tenantId);
    
    const result = await pool.query(`
      UPDATE cc_on_site_resources 
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}
      RETURNING id, resource_type as "resourceType", name, description, 
                quantity, unit, condition, tags, unspsc_code as "unspscCode",
                storage_location as "storageLocation", share_policy as "sharePolicy",
                suggested_price_amount as "suggestedPriceAmount", 
                suggested_price_currency as "suggestedPriceCurrency",
                updated_at as "updatedAt"
    `, values);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Resource not found' });
    }
    
    res.json({ ok: true, resource: result.rows[0] });
  } catch (error: any) {
    console.error('[OnSiteResources] PUT resource error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.delete('/on-site-resources/:id', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      `DELETE FROM cc_on_site_resources WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, auth.tenantId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Resource not found' });
    }
    
    res.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[OnSiteResources] DELETE resource error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ============ PEOPLE (CONTRACTORS) API ============

router.get('/people', async (req: any, res) => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;
  const { entityType } = req.query;
  
  try {
    let query = `
      SELECT id, display_name as "displayName", entity_type as "entityType", 
             email, phone, status
      FROM cc_people
      WHERE tenant_id = $1
    `;
    const params: any[] = [auth.tenantId];
    
    if (entityType) {
      query += ` AND entity_type = $2`;
      params.push(entityType);
    }
    
    query += ` ORDER BY display_name ASC`;
    
    const result = await pool.query(query, params);
    res.json({ ok: true, people: result.rows });
  } catch (error: any) {
    console.error('[People] GET people error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

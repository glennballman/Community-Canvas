/**
 * ADMIN TENANTS ROUTES
 * 
 * Endpoints:
 * - GET /api/admin/tenants - List all tenants
 * - GET /api/admin/tenants/:id - Get single tenant details
 * 
 * All endpoints require platform admin access.
 */

import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from './foundation';

const router = express.Router();

// All routes require platform admin
router.use(authenticateToken, requirePlatformAdmin);

/**
 * GET /api/admin/tenants
 * 
 * Returns all tenants in the system.
 * Supports optional search/filter query params.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, type, status } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.tenant_type as type,
        t.status,
        t.created_at,
        p.slug as portal_slug
      FROM cc_tenants t
      LEFT JOIN LATERAL (
        SELECT slug FROM cc_portals 
        WHERE owning_tenant_id = t.id AND status = 'active'
        ORDER BY created_at LIMIT 1
      ) p ON true
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    // Optional filters
    if (search) {
      query += ` AND (t.name ILIKE $${paramIndex} OR t.slug ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND t.tenant_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY t.tenant_type, t.name ASC`;
    
    const result = await serviceQuery(query, params);
    
    res.json({
      tenants: result.rows.map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type,
        status: t.status || 'active',
        created_at: t.created_at,
        portal_slug: t.portal_slug || null,
      })),
    });
    
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * GET /api/admin/tenants/:id
 * 
 * Returns a single tenant with full details.
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await serviceQuery(`
      SELECT t.*, p.slug as portal_slug
      FROM cc_tenants t
      LEFT JOIN LATERAL (
        SELECT slug FROM cc_portals 
        WHERE owning_tenant_id = t.id AND status = 'active'
        ORDER BY created_at LIMIT 1
      ) p ON true
      WHERE t.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = result.rows[0];
    
    // Get member count
    const memberResult = await serviceQuery(`
      SELECT COUNT(*) as count
      FROM cc_tenant_users
      WHERE tenant_id = $1 AND status = 'active'
    `, [id]);
    
    res.json({
      tenant: {
        ...tenant,
        type: tenant.tenant_type,
        member_count: parseInt(memberResult.rows[0].count, 10),
        portal_slug: tenant.portal_slug || null,
      },
    });
    
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

export default router;

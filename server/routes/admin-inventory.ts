/**
 * ADMIN INVENTORY ROUTES
 * 
 * Endpoints:
 * - GET /api/admin/inventory - System-wide inventory audit view
 * 
 * All endpoints require platform admin access.
 * Read-only: No mutations.
 */

import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from './foundation';

const router = express.Router();

router.use(authenticateToken, requirePlatformAdmin);

/**
 * GET /api/admin/inventory
 * 
 * Returns assets across all tenants with filters.
 * Also returns counts from related inventory tables.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, tenant_id, asset_type, status } = req.query;
    
    let query = `
      SELECT 
        ua.id,
        ua.asset_type,
        ua.name,
        ua.description,
        ua.status,
        ua.owner_type,
        ua.owner_tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        ua.city,
        ua.region,
        ua.location_description,
        ua.created_at,
        ua.updated_at,
        ua.source_table,
        ua.source_id
      FROM cc_assets ua
      LEFT JOIN cc_tenants t ON ua.owner_tenant_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (search) {
      query += ` AND ua.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (tenant_id) {
      query += ` AND ua.owner_tenant_id = $${paramIndex}`;
      params.push(tenant_id);
      paramIndex++;
    }
    
    if (asset_type) {
      query += ` AND ua.asset_type = $${paramIndex}`;
      params.push(asset_type);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND ua.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY ua.updated_at DESC NULLS LAST, ua.created_at DESC NULLS LAST LIMIT 500`;
    
    const assetsResult = await serviceQuery(query, params);
    
    const tenantsResult = await serviceQuery(`
      SELECT DISTINCT id, name, slug 
      FROM cc_tenants 
      ORDER BY name
    `);
    
    const typesResult = await serviceQuery(`
      SELECT DISTINCT asset_type 
      FROM cc_assets 
      WHERE asset_type IS NOT NULL
      ORDER BY asset_type
    `);
    
    const tableCounts: Record<string, number | null> = {};
    
    const countTables = ['catalog_items', 'cc_rental_items', 'reservations'];
    for (const tableName of countTables) {
      try {
        const countResult = await serviceQuery(`SELECT COUNT(*)::int as count FROM ${tableName}`);
        tableCounts[tableName] = countResult.rows[0]?.count ?? 0;
      } catch {
        tableCounts[tableName] = null;
      }
    }
    
    const totalResult = await serviceQuery('SELECT COUNT(*)::int as count FROM cc_assets');
    
    res.json({
      assets: assetsResult.rows,
      total: totalResult.rows[0]?.count ?? 0,
      tenants: tenantsResult.rows,
      assetTypes: typesResult.rows.map((r: any) => r.asset_type),
      tableCounts,
    });
    
  } catch (error) {
    console.error('Error fetching admin inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory audit data' });
  }
});

export default router;

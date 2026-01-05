import express, { Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, AuthRequest } from './foundation';

const router = express.Router();

router.get('/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      tenant_id, 
      item_type, 
      search, 
      date_start, 
      date_end, 
      capacity 
    } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'tenant_id is required' 
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const tenantResult = await serviceQuery(`
      SELECT t.id, t.tenant_type, tu.role
      FROM cc_tenants t
      JOIN cc_tenant_users tu ON tu.tenant_id = t.id
      WHERE t.id = $1 AND tu.user_id = $2 AND tu.status = 'active'
    `, [tenant_id, userId]);

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this tenant' 
      });
    }

    const tenantType = tenantResult.rows[0].tenant_type;
    if (tenantType !== 'community' && tenantType !== 'government') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only community and government operators can access this endpoint' 
      });
    }

    let query = `
      SELECT 
        ci.id as item_id,
        ci.tenant_id as business_tenant_id,
        t.name as business_name,
        ci.name as item_name,
        ci.short_description,
        ci.item_type,
        ci.category,
        ci.photos,
        ci.price_amount,
        ci.price_unit,
        ci.price_visible,
        ci.capacity_max,
        ci.pickup_location,
        true as can_request_hold,
        CASE 
          WHEN ci.share_availability = true AND ci.share_details = true THEN 'full'
          WHEN ci.share_availability = true THEN 'availability_only'
          ELSE 'limited'
        END as sharing_status
      FROM catalog_items ci
      JOIN cc_tenants t ON t.id = ci.tenant_id
      WHERE ci.status = 'active'
        AND ci.share_availability = true
        AND (ci.visible_to_communities IS NULL OR $1::uuid = ANY(ci.visible_to_communities))
    `;

    const params: any[] = [tenant_id];
    let paramIndex = 2;

    if (item_type) {
      query += ` AND ci.item_type = $${paramIndex}`;
      params.push(item_type);
      paramIndex++;
    }

    if (search) {
      query += ` AND (ci.name ILIKE $${paramIndex} OR ci.short_description ILIKE $${paramIndex} OR ci.category ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (capacity) {
      query += ` AND ci.capacity_max >= $${paramIndex}`;
      params.push(Number(capacity));
      paramIndex++;
    }

    query += ` ORDER BY ci.name LIMIT 50`;

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      results: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('Operator availability search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search availability' 
    });
  }
});

export default router;

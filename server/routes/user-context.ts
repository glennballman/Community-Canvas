import express, { Response, Request } from 'express';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, AuthRequest } from './foundation';

const router = express.Router();

/**
 * GET /api/me/context
 * 
 * Returns the current user's context including:
 * - User info
 * - Tenant memberships
 * - Current tenant ID
 * - Impersonation state
 */
router.get('/me/context', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const session = (req as any).session;
    
    // Get user
    const userResult = await serviceQuery(`
      SELECT 
        id,
        email,
        COALESCE(display_name, given_name || ' ' || family_name) as full_name,
        is_platform_admin
      FROM cc_users
      WHERE id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get memberships with tenant info
    const membershipsResult = await serviceQuery(`
      SELECT 
        tu.tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.tenant_type,
        tu.role
      FROM cc_tenant_users tu
      JOIN cc_tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = $1
        AND t.status = 'active'
        AND tu.status = 'active'
      ORDER BY t.tenant_type, t.name ASC
    `, [userId]);
    
    const memberships = membershipsResult.rows;
    
    // Check for impersonation
    const impersonation = session?.impersonation;
    let impersonatedTenant = null;
    let currentTenantId = session?.current_tenant_id || null;
    
    if (impersonation?.tenant_id && impersonation?.expires_at) {
      // Check if impersonation is still valid
      if (new Date(impersonation.expires_at) > new Date()) {
        // Get impersonated tenant info with portal slug
        const tenantResult = await serviceQuery(`
          SELECT t.id, t.name, t.tenant_type, t.slug, p.slug as portal_slug
          FROM cc_tenants t
          LEFT JOIN LATERAL (
            SELECT slug FROM cc_portals 
            WHERE owning_tenant_id = t.id AND status = 'active'
            ORDER BY created_at LIMIT 1
          ) p ON true
          WHERE t.id = $1
        `, [impersonation.tenant_id]);
        
        if (tenantResult.rows.length > 0) {
          impersonatedTenant = tenantResult.rows[0];
          currentTenantId = impersonation.tenant_id;
        }
      } else {
        // Impersonation expired, clear it
        delete session.impersonation;
      }
    }
    
    // Get current circle from session
    const currentCircleId = (session as any)?.current_circle_id || null;
    let currentCircle = null;
    
    if (currentCircleId) {
      const circleResult = await serviceQuery(`
        SELECT id, name, slug, status
        FROM cc_coordination_circles
        WHERE id = $1 AND status = 'active'
      `, [currentCircleId]);
      
      if (circleResult.rows.length > 0) {
        currentCircle = circleResult.rows[0];
      }
    }
    
    // Get current portal context if current tenant has one
    let currentPortal = null;
    if (currentTenantId) {
      const portalResult = await serviceQuery(`
        SELECT id, name, slug, status
        FROM cc_portals
        WHERE owning_tenant_id = $1 AND status = 'active'
        ORDER BY created_at LIMIT 1
      `, [currentTenantId]);
      
      if (portalResult.rows.length > 0) {
        currentPortal = portalResult.rows[0];
      }
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_platform_admin: user.is_platform_admin || false,
      },
      memberships: memberships.map((m: any) => ({
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        tenant_type: m.tenant_type,
        role: m.role,
        is_primary: false,
      })),
      current_tenant_id: currentTenantId,
      current_portal: currentPortal ? {
        id: currentPortal.id,
        name: currentPortal.name,
        slug: currentPortal.slug,
      } : null,
      current_circle_id: currentCircleId,
      acting_as_circle: !!currentCircle,
      current_circle: currentCircle ? {
        id: currentCircle.id,
        name: currentCircle.name,
        slug: currentCircle.slug,
      } : null,
      is_impersonating: !!impersonatedTenant,
      impersonated_tenant: impersonatedTenant ? {
        id: impersonatedTenant.id,
        name: impersonatedTenant.name,
        type: impersonatedTenant.tenant_type,
        portal_slug: impersonatedTenant.portal_slug || null,
      } : null,
      impersonation_expires_at: impersonation?.expires_at || null,
    });
    
  } catch (error) {
    console.error('Error fetching user context:', error);
    res.status(500).json({ error: 'Failed to fetch user context' });
  }
});

/**
 * POST /api/me/switch-tenant
 * 
 * Switches the current tenant for the session.
 * User must have a membership in the target tenant.
 */
router.post('/me/switch-tenant', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { tenant_id } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }
    
    // Verify user has membership in this tenant
    const membershipResult = await serviceQuery(`
      SELECT tu.tenant_id
      FROM cc_tenant_users tu
      JOIN cc_tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = $1 
        AND tu.tenant_id = $2
        AND t.status = 'active'
        AND tu.status = 'active'
    `, [userId, tenant_id]);
    
    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this tenant' });
    }
    
    // Store in session
    const session = (req as any).session;
    if (session) {
      session.current_tenant_id = tenant_id;
    }
    
    res.json({ success: true, tenant_id });
    
  } catch (error) {
    console.error('Error switching tenant:', error);
    res.status(500).json({ error: 'Failed to switch tenant' });
  }
});

/**
 * Helper: Check if user can act as a specific circle
 * Returns the membership row if valid, null otherwise
 */
async function canActAsCircle(userId: string, circleId: string): Promise<any | null> {
  const result = await serviceQuery(`
    SELECT 
      cm.id,
      cm.circle_id,
      cm.role_id,
      cr.level as role_level,
      cr.name as role_name,
      c.status as circle_status
    FROM cc_circle_members cm
    JOIN cc_coordination_circles c ON c.id = cm.circle_id
    LEFT JOIN cc_circle_roles cr ON cr.id = cm.role_id
    WHERE cm.circle_id = $1
      AND cm.individual_id = $2
      AND cm.is_active = true
      AND c.status = 'active'
    LIMIT 1
  `, [circleId, userId]);
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * GET /api/me/circles
 * 
 * Returns circles the user is a member of
 */
router.get('/me/circles', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    const result = await serviceQuery(`
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.status,
        cm.is_active,
        cr.name as role_name,
        cr.level as role_level
      FROM cc_circle_members cm
      JOIN cc_coordination_circles c ON c.id = cm.circle_id
      LEFT JOIN cc_circle_roles cr ON cr.id = cm.role_id
      WHERE cm.individual_id = $1
        AND cm.is_active = true
        AND c.status = 'active'
      ORDER BY c.name ASC
    `, [userId]);
    
    res.json({ 
      circles: result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        role_name: r.role_name,
        role_level: r.role_level,
      }))
    });
    
  } catch (error) {
    console.error('Error fetching circles:', error);
    res.status(500).json({ error: 'Failed to fetch circles' });
  }
});

/**
 * POST /api/me/switch-circle
 * 
 * Switches the current circle for the session.
 * User must be an active member of the target circle.
 */
router.post('/me/switch-circle', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { circle_id } = req.body;
    
    if (!circle_id) {
      return res.status(400).json({ error: 'circle_id is required' });
    }
    
    // Validate UUID format
    if (typeof circle_id !== 'string' || !circle_id.match(/^[0-9a-f-]{36}$/i)) {
      return res.status(400).json({ error: 'Invalid circle_id format' });
    }
    
    // Verify user can act as this circle
    const membership = await canActAsCircle(userId!, circle_id);
    
    if (!membership) {
      return res.status(403).json({ error: 'Not an active member of this circle' });
    }
    
    // Store in session
    const session = (req as any).session;
    if (session) {
      session.current_circle_id = circle_id;
    }
    
    res.json({ 
      success: true, 
      circle_id,
      role_name: membership.role_name,
      role_level: membership.role_level,
    });
    
  } catch (error) {
    console.error('Error switching circle:', error);
    res.status(500).json({ error: 'Failed to switch circle' });
  }
});

/**
 * POST /api/me/clear-circle
 * 
 * Clears the current circle from the session.
 */
router.post('/me/clear-circle', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const session = (req as any).session;
    if (session) {
      delete session.current_circle_id;
    }
    
    res.json({ success: true, circle_id: null });
    
  } catch (error) {
    console.error('Error clearing circle:', error);
    res.status(500).json({ error: 'Failed to clear circle' });
  }
});

router.get('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await serviceQuery(`
      SELECT 
        id,
        email,
        given_name,
        family_name,
        display_name,
        telephone,
        avatar_url,
        bio,
        timezone,
        locale,
        notification_preferences,
        is_platform_admin,
        status,
        created_at,
        updated_at
      FROM cc_users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        given_name: user.given_name,
        family_name: user.family_name,
        display_name: user.display_name,
        telephone: user.telephone,
        avatar_url: user.avatar_url,
        bio: user.bio,
        timezone: user.timezone || 'America/Vancouver',
        locale: user.locale || 'en-CA',
        notification_preferences: user.notification_preferences || {},
        is_platform_admin: user.is_platform_admin,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get profile' 
    });
  }
});

router.put('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      given_name,
      family_name,
      display_name,
      telephone,
      bio,
      timezone,
      locale,
      notification_preferences
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (given_name !== undefined) {
      updates.push(`given_name = $${paramIndex}`);
      params.push(given_name);
      paramIndex++;
    }

    if (family_name !== undefined) {
      updates.push(`family_name = $${paramIndex}`);
      params.push(family_name);
      paramIndex++;
    }

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(display_name);
      paramIndex++;
    }

    if (telephone !== undefined) {
      updates.push(`telephone = $${paramIndex}`);
      params.push(telephone);
      paramIndex++;
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex}`);
      params.push(bio);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      params.push(timezone);
      paramIndex++;
    }

    if (locale !== undefined) {
      updates.push(`locale = $${paramIndex}`);
      params.push(locale);
      paramIndex++;
    }

    if (notification_preferences !== undefined) {
      updates.push(`notification_preferences = $${paramIndex}`);
      params.push(JSON.stringify(notification_preferences));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No fields to update' 
      });
    }

    updates.push(`updated_at = now()`);
    params.push(userId);

    const result = await serviceQuery(`
      UPDATE cc_users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, email, given_name, family_name, display_name, 
        telephone, bio, timezone, locale, notification_preferences,
        updated_at
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
  }
});

// ============================================================================
// PORTAL CONTEXT ROUTES
// ============================================================================

/**
 * GET /api/cc_portals
 * 
 * Returns cc_portals owned by the current tenant.
 * Uses X-Tenant-ID header to determine which cc_portals to return.
 */
router.get('/cc_portals', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const session = (req as any).session;
    
    // Use session tenant if header not provided
    const effectiveTenantId = tenantId || session?.current_tenant_id;
    
    if (!effectiveTenantId) {
      return res.json({ cc_portals: [] });
    }
    
    const result = await serviceQuery(`
      SELECT 
        id,
        name,
        slug,
        portal_type,
        legal_dba_name,
        status,
        tagline
      FROM cc_portals
      WHERE owning_tenant_id = $1
        AND status = 'active'
      ORDER BY name ASC
    `, [effectiveTenantId]);
    
    res.json({ cc_portals: result.rows });
    
  } catch (error) {
    console.error('Error fetching cc_portals:', error);
    res.status(500).json({ error: 'Failed to fetch cc_portals' });
  }
});

/**
 * GET /api/me/portal-preference
 * 
 * Returns the user's default portal for the current tenant.
 */
router.get('/me/portal-preference', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    const session = (req as any).session;
    
    const effectiveTenantId = tenantId || session?.current_tenant_id;
    
    if (!effectiveTenantId) {
      return res.json({ default_portal_id: null });
    }
    
    const result = await serviceQuery(`
      SELECT default_portal_id
      FROM cc_tenant_users
      WHERE user_id = $1 AND tenant_id = $2
    `, [userId, effectiveTenantId]);
    
    if (result.rows.length === 0) {
      return res.json({ default_portal_id: null });
    }
    
    res.json({ default_portal_id: result.rows[0].default_portal_id });
    
  } catch (error) {
    console.error('Error fetching portal preference:', error);
    res.status(500).json({ error: 'Failed to fetch portal preference' });
  }
});

/**
 * PUT /api/me/portal-preference
 * 
 * Sets the user's default portal for the current tenant.
 */
router.put('/me/portal-preference', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { portal_id } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    const session = (req as any).session;
    
    const effectiveTenantId = tenantId || session?.current_tenant_id;
    
    if (!effectiveTenantId) {
      return res.status(400).json({ error: 'No tenant context' });
    }
    
    if (!portal_id) {
      return res.status(400).json({ error: 'portal_id is required' });
    }
    
    // Verify portal belongs to tenant
    const portalCheck = await serviceQuery(`
      SELECT id FROM cc_portals
      WHERE id = $1 AND owning_tenant_id = $2
    `, [portal_id, effectiveTenantId]);
    
    if (portalCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Portal does not belong to tenant' });
    }
    
    // Update preference
    await serviceQuery(`
      UPDATE cc_tenant_users
      SET default_portal_id = $1
      WHERE user_id = $2 AND tenant_id = $3
    `, [portal_id, userId, effectiveTenantId]);
    
    res.json({ success: true, default_portal_id: portal_id });
    
  } catch (error) {
    console.error('Error setting portal preference:', error);
    res.status(500).json({ error: 'Failed to set portal preference' });
  }
});

export default router;

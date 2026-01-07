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
        COALESCE(display_name, first_name || ' ' || last_name) as full_name,
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
        // Get impersonated tenant info
        const tenantResult = await serviceQuery(`
          SELECT id, name, tenant_type, slug
          FROM cc_tenants
          WHERE id = $1
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
      is_impersonating: !!impersonatedTenant,
      impersonated_tenant: impersonatedTenant ? {
        id: impersonatedTenant.id,
        name: impersonatedTenant.name,
        type: impersonatedTenant.tenant_type,
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

router.get('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await serviceQuery(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        display_name,
        phone,
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
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        phone: user.phone,
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
      first_name,
      last_name,
      display_name,
      phone,
      bio,
      timezone,
      locale,
      notification_preferences
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(first_name);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(last_name);
      paramIndex++;
    }

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(display_name);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(phone);
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
        id, email, first_name, last_name, display_name, 
        phone, bio, timezone, locale, notification_preferences,
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
 * GET /api/portals
 * 
 * Returns portals owned by the current tenant.
 * Uses X-Tenant-ID header to determine which portals to return.
 */
router.get('/portals', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const session = (req as any).session;
    
    // Use session tenant if header not provided
    const effectiveTenantId = tenantId || session?.current_tenant_id;
    
    if (!effectiveTenantId) {
      return res.json({ portals: [] });
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
      FROM portals
      WHERE owning_tenant_id = $1
        AND status = 'active'
      ORDER BY name ASC
    `, [effectiveTenantId]);
    
    res.json({ portals: result.rows });
    
  } catch (error) {
    console.error('Error fetching portals:', error);
    res.status(500).json({ error: 'Failed to fetch portals' });
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
      SELECT id FROM portals
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

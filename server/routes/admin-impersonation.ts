/**
 * ADMIN IMPERSONATION ROUTES
 * 
 * Endpoints:
 * - GET /api/admin/impersonation/users - Search users for impersonation
 * - POST /api/admin/impersonation/start - Start impersonating a user (and optionally tenant)
 * - POST /api/admin/impersonation/stop - Stop impersonation
 * - GET /api/admin/impersonation/status - Get current impersonation status
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
 * GET /api/admin/impersonation/users
 * 
 * Search users for impersonation. Platform admin only.
 * Query params: query (email/name search), limit
 */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { query, limit = 20 } = req.query;
    const searchLimit = Math.min(Number(limit) || 20, 100);
    
    let sql = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.given_name,
        u.family_name,
        u.is_platform_admin,
        u.status,
        u.last_login_at,
        (
          SELECT json_agg(json_build_object(
            'tenant_id', tu.tenant_id,
            'tenant_name', t.name,
            'tenant_slug', t.slug,
            'role', tu.role,
            'title', tu.title
          ))
          FROM cc_tenant_users tu
          JOIN cc_tenants t ON t.id = tu.tenant_id
          WHERE tu.user_id = u.id AND tu.status = 'active'
        ) as memberships
      FROM cc_users u
      WHERE u.status = 'active'
    `;
    
    const params: any[] = [];
    
    if (query && typeof query === 'string' && query.trim()) {
      const searchTerm = `%${query.trim().toLowerCase()}%`;
      params.push(searchTerm);
      sql += `
        AND (
          LOWER(u.email) LIKE $${params.length}
          OR LOWER(u.display_name) LIKE $${params.length}
          OR LOWER(u.given_name) LIKE $${params.length}
          OR LOWER(u.family_name) LIKE $${params.length}
        )
      `;
    }
    
    params.push(searchLimit);
    sql += ` ORDER BY u.display_name, u.email LIMIT $${params.length}`;
    
    const result = await serviceQuery(sql, params);
    
    res.json({
      ok: true,
      users: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name || row.email.split('@')[0],
        givenName: row.given_name,
        familyName: row.family_name,
        isPlatformAdmin: row.is_platform_admin || false,
        status: row.status,
        lastLoginAt: row.last_login_at,
        memberships: row.memberships || [],
      })),
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ ok: false, error: 'Failed to search users' });
  }
});

/**
 * POST /api/admin/impersonation/start
 * 
 * Starts an impersonation session for a user (and optionally a tenant).
 * Stores impersonation state in session.
 * Logs the impersonation for audit.
 * 
 * Body: { user_id, tenant_id?, reason? }
 * - user_id: Required - the user to impersonate
 * - tenant_id: Optional - specific tenant context (if user has multiple memberships)
 * - reason: Optional - audit reason
 */
router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user?.userId;
    const { user_id, tenant_id, reason } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ ok: false, error: 'user_id is required' });
    }
    
    // Get user info
    const userResult = await serviceQuery(`
      SELECT id, email, display_name, given_name, family_name, is_platform_admin, status
      FROM cc_users
      WHERE id = $1
    `, [user_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    const targetUser = userResult.rows[0];
    
    if (targetUser.status !== 'active') {
      return res.status(400).json({ ok: false, error: 'Cannot impersonate inactive user' });
    }
    
    // Get user's tenant memberships
    const membershipsResult = await serviceQuery(`
      SELECT tu.tenant_id, tu.role, tu.title, t.name as tenant_name, t.slug as tenant_slug
      FROM cc_tenant_users tu
      JOIN cc_tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = $1 AND tu.status = 'active'
      ORDER BY t.name
    `, [user_id]);
    
    const memberships = membershipsResult.rows;
    
    // Determine which tenant to use
    let selectedTenant = null;
    if (tenant_id) {
      // User specified a tenant - verify membership
      selectedTenant = memberships.find(m => m.tenant_id === tenant_id);
      if (!selectedTenant) {
        return res.status(400).json({ ok: false, error: 'User is not a member of specified tenant' });
      }
    } else if (memberships.length === 1) {
      // User has exactly one membership - auto-select
      selectedTenant = memberships[0];
    } else if (memberships.length > 1) {
      // Multiple memberships - require explicit selection
      return res.status(400).json({ 
        ok: false, 
        error: 'User has multiple tenant memberships. Please specify tenant_id.',
        memberships: memberships.map(m => ({
          tenant_id: m.tenant_id,
          tenant_name: m.tenant_name,
          tenant_slug: m.tenant_slug,
          role: m.role,
        })),
      });
    }
    // If no memberships, selectedTenant remains null (platform admin with no tenants)
    
    // Set expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // Store impersonation in session
    const session = (req as any).session;
    if (session) {
      session.impersonation = {
        impersonated_user_id: targetUser.id,
        impersonated_user_email: targetUser.email,
        impersonated_user_name: targetUser.display_name || targetUser.email.split('@')[0],
        tenant_id: selectedTenant?.tenant_id || null,
        tenant_name: selectedTenant?.tenant_name || null,
        tenant_role: selectedTenant?.role || null,
        admin_user_id: adminUserId,
        reason: reason || 'Platform admin access',
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
      };
      
      // Set current tenant context
      if (selectedTenant) {
        session.current_tenant_id = selectedTenant.tenant_id;
        session.roles = [selectedTenant.role];
      }
    }
    
    // Log the impersonation
    try {
      await serviceQuery(`
        INSERT INTO cc_impersonation_logs (
          admin_user_id,
          impersonated_user_id,
          tenant_id,
          reason,
          started_at,
          ip_address
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
      `, [
        adminUserId,
        user_id,
        selectedTenant?.tenant_id || null,
        reason || 'Platform admin access',
        req.ip || 'unknown',
      ]);
    } catch (logError) {
      // Log table might not have impersonated_user_id column yet
      console.warn('Could not log user impersonation:', logError);
      
      // Try legacy format (tenant-only)
      if (selectedTenant) {
        try {
          await serviceQuery(`
            INSERT INTO cc_impersonation_logs (
              admin_user_id,
              tenant_id,
              reason,
              started_at,
              ip_address
            ) VALUES ($1, $2, $3, NOW(), $4)
          `, [
            adminUserId,
            selectedTenant.tenant_id,
            reason || 'Platform admin access',
            req.ip || 'unknown',
          ]);
        } catch (e) {
          console.warn('Could not log impersonation (legacy):', e);
        }
      }
    }
    
    res.json({
      ok: true,
      impersonating: {
        user_id: targetUser.id,
        user_email: targetUser.email,
        user_name: targetUser.display_name || targetUser.email.split('@')[0],
        tenant_id: selectedTenant?.tenant_id || null,
        tenant_name: selectedTenant?.tenant_name || null,
        role: selectedTenant?.role || null,
      },
      expires_at: expiresAt,
    });
    
  } catch (error) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({ ok: false, error: 'Failed to start impersonation' });
  }
});

/**
 * POST /api/admin/impersonation/stop
 * 
 * Stops the current impersonation session.
 */
router.post('/stop', async (req: AuthRequest, res: Response) => {
  try {
    const session = (req as any).session;
    const impersonation = session?.impersonation;
    
    if (impersonation) {
      // Log the end of impersonation
      try {
        // Try new format first (with user_id)
        await serviceQuery(`
          UPDATE cc_impersonation_logs
          SET ended_at = NOW()
          WHERE admin_user_id = $1 
            AND (impersonated_user_id = $2 OR tenant_id = $3)
            AND ended_at IS NULL
        `, [
          impersonation.admin_user_id, 
          impersonation.impersonated_user_id,
          impersonation.tenant_id
        ]);
      } catch (logError) {
        console.warn('Could not update impersonation log:', logError);
      }
      
      // Clear impersonation
      delete session.impersonation;
      delete session.current_tenant_id;
      delete session.roles;
    }
    
    res.json({ ok: true });
    
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    res.status(500).json({ ok: false, error: 'Failed to stop impersonation' });
  }
});

/**
 * GET /api/admin/impersonation/status
 * 
 * Gets the current impersonation status.
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  const session = (req as any).session;
  const impersonation = session?.impersonation;
  
  if (!impersonation || new Date(impersonation.expires_at) <= new Date()) {
    return res.json({ ok: true, is_impersonating: false });
  }
  
  res.json({
    ok: true,
    is_impersonating: true,
    impersonated_user_id: impersonation.impersonated_user_id,
    impersonated_user_email: impersonation.impersonated_user_email,
    impersonated_user_name: impersonation.impersonated_user_name,
    tenant_id: impersonation.tenant_id,
    tenant_name: impersonation.tenant_name,
    tenant_role: impersonation.tenant_role,
    expires_at: impersonation.expires_at,
  });
});

export default router;

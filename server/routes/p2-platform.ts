/**
 * P-UI-17 PLATFORM CONSOLE ROUTES
 * 
 * Platform-level administrative endpoints for platform admins.
 * 
 * Endpoints:
 * - GET /api/p2/platform/analytics/summary - Platform-wide analytics summary
 * - GET /api/p2/platform/cert/status - V3.5 certification status
 * - GET /api/p2/platform/tenants - Enhanced tenant list with stats
 * - GET /api/p2/platform/tenants/:tenantId - Enhanced tenant detail with portals
 * 
 * All endpoints require platform admin access.
 * Uses JWT auth via Authorization header (client sends cc_token from localStorage).
 */

import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { serviceQuery } from '../db/tenantDb';
import { authenticateToken, requirePlatformAdmin, AuthRequest } from './foundation';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

router.use(authenticateToken, requirePlatformAdmin);

/**
 * GET /api/p2/platform/analytics/summary
 * 
 * Returns platform-wide analytics including:
 * - Total tenants, portals, users
 * - Active counts
 * - 7-day rolling metrics if available
 * - Portal-level aggregated growth metrics
 */
router.get('/analytics/summary', async (req: AuthRequest, res: Response) => {
  try {
    const platformStats = await serviceQuery(`
      SELECT
        (SELECT COUNT(*) FROM cc_tenants) as total_tenants,
        (SELECT COUNT(*) FROM cc_tenants WHERE status = 'active') as active_tenants,
        (SELECT COUNT(*) FROM cc_portals) as total_portals,
        (SELECT COUNT(*) FROM cc_portals WHERE status = 'active') as active_portals,
        (SELECT COUNT(*) FROM cc_users) as total_users,
        (SELECT COUNT(*) FROM cc_users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM cc_users WHERE is_platform_admin = true) as platform_admins,
        (SELECT COUNT(*) FROM cc_tenant_users) as total_memberships,
        (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'government') as government_tenants,
        (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'business') as business_tenants,
        (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'property') as property_tenants,
        (SELECT COUNT(*) FROM cc_tenants WHERE tenant_type = 'individual') as individual_tenants
    `);

    const recentActivity = await serviceQuery(`
      SELECT
        (SELECT COUNT(*) FROM cc_tenants WHERE created_at > NOW() - INTERVAL '7 days') as new_tenants_7d,
        (SELECT COUNT(*) FROM cc_users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
        (SELECT COUNT(*) FROM cc_portals WHERE created_at > NOW() - INTERVAL '7 days') as new_portals_7d
    `);

    let growthMetrics = null;
    try {
      const growthResult = await serviceQuery(`
        SELECT 
          COUNT(DISTINCT p.id) as portals_with_jobs,
          COALESCE(SUM(
            CASE WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END
          ), 0) as new_jobs_7d,
          COALESCE(SUM(
            CASE WHEN ja.applied_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END
          ), 0) as new_applications_7d
        FROM cc_portals p
        LEFT JOIN cc_jobs j ON j.portal_id = p.id
        LEFT JOIN cc_job_applications ja ON ja.job_id = j.id
      `);
      growthMetrics = growthResult.rows[0];
    } catch (e) {
    }

    res.json({
      success: true,
      analytics: {
        platform: platformStats.rows[0],
        recent: recentActivity.rows[0],
        growth: growthMetrics,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

/**
 * GET /api/p2/platform/cert/status
 * 
 * Returns V3.5 certification status:
 * - Last cert run timestamp
 * - Pass/fail status
 * - Proof bundle path pointer
 */
router.get('/cert/status', async (req: AuthRequest, res: Response) => {
  try {
    const proofDir = path.join(process.cwd(), 'proof', 'v3.5');
    const terminologyScanPath = path.join(proofDir, 'terminology-scan.json');
    const invariantsPath = path.join(proofDir, 'invariants.json');
    const routesApiPath = path.join(proofDir, 'routes-api.json');
    const routesUiPath = path.join(proofDir, 'routes-ui.json');

    let terminologyScan = null;
    let invariants = null;
    let routesApi = null;
    let routesUi = null;
    let lastRun: Date | null = null;

    try {
      if (fs.existsSync(terminologyScanPath)) {
        const content = fs.readFileSync(terminologyScanPath, 'utf-8');
        terminologyScan = JSON.parse(content);
        const stats = fs.statSync(terminologyScanPath);
        lastRun = stats.mtime;
      }
    } catch (e) {}

    try {
      if (fs.existsSync(invariantsPath)) {
        const content = fs.readFileSync(invariantsPath, 'utf-8');
        invariants = JSON.parse(content);
      }
    } catch (e) {}

    try {
      if (fs.existsSync(routesApiPath)) {
        const content = fs.readFileSync(routesApiPath, 'utf-8');
        routesApi = JSON.parse(content);
      }
    } catch (e) {}

    try {
      if (fs.existsSync(routesUiPath)) {
        const content = fs.readFileSync(routesUiPath, 'utf-8');
        routesUi = JSON.parse(content);
      }
    } catch (e) {}

    const terminologyPassed = terminologyScan?.passed === true;
    const invariantsPassed = invariants?.allPassed === true || 
      (Array.isArray(invariants?.checks) && invariants.checks.every((c: any) => c.passed));
    const overallPassed = terminologyPassed && (invariants ? invariantsPassed : true);

    res.json({
      success: true,
      cert: {
        version: 'V3.5',
        lastRun: lastRun?.toISOString() || null,
        status: overallPassed ? 'passed' : 'failed',
        proofPath: './proof/v3.5/',
        checks: {
          terminology: {
            passed: terminologyPassed,
            violationCount: terminologyScan?.violationCount || 0,
          },
          invariants: invariants ? {
            passed: invariantsPassed,
            checks: invariants?.checks || [],
          } : null,
          routes: {
            api: routesApi ? { count: Array.isArray(routesApi) ? routesApi.length : Object.keys(routesApi).length } : null,
            ui: routesUi ? { count: Array.isArray(routesUi) ? routesUi.length : Object.keys(routesUi).length } : null,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching cert status:', error);
    res.status(500).json({ error: 'Failed to fetch certification status' });
  }
});

/**
 * GET /api/p2/platform/tenants
 * 
 * Enhanced tenant list with stats (portals count, active users, last activity).
 */
router.get('/tenants', async (req: AuthRequest, res: Response) => {
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
        (SELECT COUNT(*) FROM cc_portals WHERE owning_tenant_id = t.id) as portals_count,
        (SELECT COUNT(*) FROM cc_tenant_users WHERE tenant_id = t.id AND status = 'active') as active_users,
        (SELECT MAX(updated_at) FROM cc_tenant_users WHERE tenant_id = t.id) as last_activity
      FROM cc_tenants t
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

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

    query += ` ORDER BY t.name ASC`;

    const result = await serviceQuery(query, params);

    res.json({
      success: true,
      tenants: result.rows.map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type,
        status: t.status || 'active',
        createdAt: t.created_at,
        portalsCount: parseInt(t.portals_count, 10) || 0,
        activeUsers: parseInt(t.active_users, 10) || 0,
        lastActivity: t.last_activity,
      })),
    });
  } catch (error) {
    console.error('Error fetching platform tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * GET /api/p2/platform/tenants/:tenantId
 * 
 * Enhanced tenant detail with portals list, modules enabled, and activity.
 */
router.get('/tenants/:tenantId', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;

    const tenantResult = await serviceQuery(`
      SELECT t.*
      FROM cc_tenants t
      WHERE t.id = $1
    `, [tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];

    const portalsResult = await serviceQuery(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.status,
        p.primary_audience,
        p.created_at,
        (SELECT COUNT(*) FROM cc_portal_members WHERE portal_id = p.id AND is_active = true) as member_count
      FROM cc_portals p
      WHERE p.owning_tenant_id = $1
      ORDER BY p.name ASC
    `, [tenantId]);

    const membersResult = await serviceQuery(`
      SELECT 
        tu.id,
        tu.role,
        tu.status,
        tu.joined_at,
        u.email,
        u.given_name,
        u.family_name
      FROM cc_tenant_users tu
      JOIN cc_users u ON u.id = tu.user_id
      WHERE tu.tenant_id = $1
      ORDER BY tu.joined_at DESC
      LIMIT 10
    `, [tenantId]);

    let moduleFlags = null;
    try {
      const modulesResult = await serviceQuery(`
        SELECT * FROM cc_tenant_modules WHERE tenant_id = $1
      `, [tenantId]);
      if (modulesResult.rows.length > 0) {
        moduleFlags = modulesResult.rows[0];
      }
    } catch (e) {
    }

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        type: tenant.tenant_type,
        status: tenant.status || 'active',
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
      },
      portals: portalsResult.rows.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        primaryAudience: p.primary_audience,
        createdAt: p.created_at,
        memberCount: parseInt(p.member_count, 10) || 0,
      })),
      recentMembers: membersResult.rows.map((m: any) => ({
        id: m.id,
        email: m.email,
        name: [m.given_name, m.family_name].filter(Boolean).join(' ') || m.email,
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at,
      })),
      moduleFlags,
    });
  } catch (error) {
    console.error('Error fetching tenant detail:', error);
    res.status(500).json({ error: 'Failed to fetch tenant details' });
  }
});

/**
 * P-PLATFORM-ACCTMGMT-01: Platform Account Management APIs
 * 
 * User management endpoints for platform admins.
 */

// Helper to check if we're in dev mode (safe for password operations)
function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.CC_DEV_SEED === 'true';
}

/**
 * GET /api/p2/platform/users
 * List all platform users
 */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const result = await serviceQuery(`
      SELECT 
        id, email, given_name, family_name, status, 
        is_platform_admin, created_at, last_login_at
      FROM cc_users
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    res.json({
      success: true,
      users: result.rows.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: [u.given_name, u.family_name].filter(Boolean).join(' ') || u.email,
        status: u.status || 'active',
        isPlatformAdmin: u.is_platform_admin,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/p2/platform/users
 * Create a new user
 */
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, fullName, role, isPlatformAdmin: isAdmin, password } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Parse name into first/last (accept both 'name' and 'fullName')
    const displayName = fullName || name || '';
    const nameParts = displayName.split(' ');
    const givenName = nameParts[0] || null;
    const familyName = nameParts.slice(1).join(' ') || null;
    const isPlatformAdmin = isAdmin || role === 'platform_admin';
    
    // Check if user exists
    const existing = await serviceQuery(
      'SELECT id FROM cc_users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password if provided (dev mode only)
    let passwordHash: string | null = null;
    if (password) {
      if (!isDevMode()) {
        return res.status(400).json({ error: 'Password setting only available in development mode' });
      }
      passwordHash = await bcrypt.hash(password, 12);
    }
    
    // Create user
    const result = await serviceQuery(`
      INSERT INTO cc_users (email, given_name, family_name, password_hash, is_platform_admin, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'active', NOW())
      RETURNING id, email, given_name, family_name, is_platform_admin
    `, [email.toLowerCase(), givenName, familyName, passwordHash, isPlatformAdmin]);
    
    const user = result.rows[0];
    
    console.log(`[PLATFORM AUDIT] User created: ${user.id} (${email}) by ${req.user?.userId}`);
    
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: [user.given_name, user.family_name].filter(Boolean).join(' '),
        isPlatformAdmin: user.is_platform_admin,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * POST /api/p2/platform/users/:id/set-password
 * Set password for a user (DEV ONLY)
 */
router.post('/users/:id/set-password', async (req: AuthRequest, res: Response) => {
  try {
    if (!isDevMode()) {
      return res.status(403).json({ error: 'Password setting only available in development mode' });
    }
    
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Update user password
    const result = await serviceQuery(`
      UPDATE cc_users SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email
    `, [passwordHash, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[PLATFORM AUDIT] Password set for user ${id} by ${req.user?.userId}`);
    
    res.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

/**
 * POST /api/p2/platform/users/:id/reset-password
 * Reset password to random value (DEV ONLY) - returns the new password
 */
router.post('/users/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    if (!isDevMode()) {
      return res.status(403).json({ error: 'Password reset only available in development mode' });
    }
    
    const { id } = req.params;
    
    // Generate random password
    const newPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    // Update user password
    const result = await serviceQuery(`
      UPDATE cc_users SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email
    `, [passwordHash, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[PLATFORM AUDIT] Password reset for user ${id} by ${req.user?.userId}`);
    
    res.json({ 
      success: true, 
      password: newPassword,
      message: 'Password has been reset. Save this password - it will not be shown again.' 
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * POST /api/p2/platform/tenants
 * Create a new tenant
 */
router.post('/tenants', async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, tenantType, legalName, dbaNames } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }
    
    // Check slug uniqueness
    const existing = await serviceQuery(
      'SELECT id FROM cc_tenants WHERE slug = $1',
      [slug.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Tenant with this slug already exists' });
    }
    
    // Build metadata with dbaNames
    const metadata = dbaNames ? { dbaNames } : {};
    
    const result = await serviceQuery(`
      INSERT INTO cc_tenants (name, slug, tenant_type, legal_name, metadata, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'active', NOW())
      RETURNING id, name, slug, tenant_type
    `, [
      name,
      slug.toLowerCase(),
      tenantType || 'business',
      legalName || null,
      JSON.stringify(metadata)
    ]);
    
    const tenant = result.rows[0];
    
    console.log(`[PLATFORM AUDIT] Tenant created: ${tenant.id} (${name}) by ${req.user?.userId}`);
    
    res.status(201).json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        type: tenant.tenant_type,
      },
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * POST /api/p2/platform/tenants/:tenantId/assign-admin
 * Assign a user as tenant admin
 * Accepts either userId or email in request body
 */
router.post('/tenants/:tenantId/assign-admin', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { userId, email, actorRole } = req.body;
    
    if (!userId && !email) {
      return res.status(400).json({ error: 'userId or email is required' });
    }
    
    const role = actorRole || 'admin';
    
    // Check tenant exists
    const tenantCheck = await serviceQuery('SELECT id, name FROM cc_tenants WHERE id = $1', [tenantId]);
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    // Find user by id or email
    let userCheck;
    if (userId) {
      userCheck = await serviceQuery('SELECT id, email FROM cc_users WHERE id = $1', [userId]);
    } else {
      userCheck = await serviceQuery('SELECT id, email FROM cc_users WHERE email = $1', [email.toLowerCase()]);
    }
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const targetUserId = userCheck.rows[0].id;
    
    // Check if already a member
    const existingMembership = await serviceQuery(
      'SELECT id FROM cc_tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, targetUserId]
    );
    
    if (existingMembership.rows.length > 0) {
      // Update role
      await serviceQuery(`
        UPDATE cc_tenant_users SET role = $1, updated_at = NOW()
        WHERE tenant_id = $2 AND user_id = $3
      `, [role, tenantId, targetUserId]);
    } else {
      // Create membership
      await serviceQuery(`
        INSERT INTO cc_tenant_users (tenant_id, user_id, role, status, created_at)
        VALUES ($1, $2, $3, 'active', NOW())
      `, [tenantId, targetUserId, role]);
    }
    
    console.log(`[PLATFORM AUDIT] User ${targetUserId} assigned as ${role} for tenant ${tenantId} by ${req.user?.userId}`);
    
    res.json({ success: true, message: `User assigned as ${role}` });
  } catch (error) {
    console.error('Error assigning admin:', error);
    res.status(500).json({ error: 'Failed to assign admin' });
  }
});

/**
 * GET /api/p2/platform/tenants/:tenantId/users
 * Get users for a specific tenant
 */
router.get('/tenants/:tenantId/users', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    const result = await serviceQuery(`
      SELECT 
        u.id, u.email, u.given_name, u.family_name, u.status as user_status,
        tu.role, tu.status as membership_status, tu.created_at as joined_at
      FROM cc_users u
      JOIN cc_tenant_users tu ON tu.user_id = u.id
      WHERE tu.tenant_id = $1
      ORDER BY tu.created_at DESC
    `, [tenantId]);
    
    res.json({
      success: true,
      users: result.rows.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: [u.given_name, u.family_name].filter(Boolean).join(' ') || u.email,
        role: u.role,
        status: u.membership_status || 'active',
        joinedAt: u.joined_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    res.status(500).json({ error: 'Failed to fetch tenant users' });
  }
});

/**
 * POST /api/p2/platform/impersonate
 * Start impersonating a tenant (and optionally a user)
 */
router.post('/impersonate', async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user?.userId;
    const { tenantId, userId, mode } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    
    // Get tenant info
    const tenantResult = await serviceQuery(`
      SELECT id, name, tenant_type, slug
      FROM cc_tenants WHERE id = $1
    `, [tenantId]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = tenantResult.rows[0];
    
    // If userId provided, verify user belongs to tenant
    let targetUser = null;
    if (userId) {
      const userResult = await serviceQuery(`
        SELECT u.id, u.email, u.given_name, u.family_name
        FROM cc_users u
        JOIN cc_tenant_users tu ON tu.user_id = u.id
        WHERE u.id = $1 AND tu.tenant_id = $2
      `, [userId, tenantId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found in this tenant' });
      }
      targetUser = userResult.rows[0];
    }
    
    // Set expiration (1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // Store in session
    const session = (req as any).session;
    if (session) {
      session.impersonation = {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_type: tenant.tenant_type,
        user_id: targetUser?.id || null,
        user_email: targetUser?.email || null,
        admin_user_id: adminUserId,
        mode: mode || 'tenant',
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
      };
      session.current_tenant_id = tenant.id;
    }
    
    console.log(`[PLATFORM AUDIT] { event: "impersonate", actorUserId: "${adminUserId}", targetTenantId: "${tenantId}", targetUserId: "${userId || 'null'}" }`);
    
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.tenant_type,
      },
      user: targetUser ? {
        id: targetUser.id,
        email: targetUser.email,
        name: [targetUser.given_name, targetUser.family_name].filter(Boolean).join(' '),
      } : null,
      expiresAt,
    });
  } catch (error) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({ error: 'Failed to start impersonation' });
  }
});

/**
 * POST /api/p2/platform/stop-impersonation
 * Stop current impersonation session
 */
router.post('/stop-impersonation', async (req: AuthRequest, res: Response) => {
  try {
    const session = (req as any).session;
    const impersonation = session?.impersonation;
    
    if (impersonation) {
      console.log(`[PLATFORM AUDIT] { event: "stop_impersonation", actorUserId: "${impersonation.admin_user_id}", targetTenantId: "${impersonation.tenant_id}" }`);
      delete session.impersonation;
      delete session.current_tenant_id;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    res.status(500).json({ error: 'Failed to stop impersonation' });
  }
});

/**
 * GET /api/p2/platform/impersonation-status
 * Get current impersonation status
 */
router.get('/impersonation-status', async (req: AuthRequest, res: Response) => {
  const session = (req as any).session;
  const impersonation = session?.impersonation;
  
  if (!impersonation) {
    return res.json({ isImpersonating: false });
  }
  
  // Check if expired
  if (new Date(impersonation.expires_at) < new Date()) {
    delete session.impersonation;
    delete session.current_tenant_id;
    return res.json({ isImpersonating: false, reason: 'expired' });
  }
  
  res.json({
    isImpersonating: true,
    tenant: {
      id: impersonation.tenant_id,
      name: impersonation.tenant_name,
      type: impersonation.tenant_type,
    },
    user: impersonation.user_id ? {
      id: impersonation.user_id,
      email: impersonation.user_email,
    } : null,
    mode: impersonation.mode,
    startedAt: impersonation.started_at,
    expiresAt: impersonation.expires_at,
  });
});

/**
 * POST /api/p2/platform/dev/ensure-test-personas
 * Create/ensure test persona Ellen exists (DEV ONLY)
 */
router.post('/dev/ensure-test-personas', async (req: AuthRequest, res: Response) => {
  try {
    if (!isDevMode()) {
      return res.status(403).json({ error: 'Test personas only available in development mode' });
    }
    
    const tenantName = '1252093 BC LTD';
    const tenantSlug = '1252093-bc-ltd';
    const ellenEmail = 'ellen@example.com';
    const ellenPassword = 'ellen123!';
    const dbaNames = ['Enviropaving', 'Remote Services Inc'];
    
    // Ensure tenant exists
    let tenantId: string;
    const existingTenant = await serviceQuery(
      'SELECT id FROM cc_tenants WHERE slug = $1',
      [tenantSlug]
    );
    
    if (existingTenant.rows.length > 0) {
      tenantId = existingTenant.rows[0].id;
      // Update metadata with dbaNames
      await serviceQuery(`
        UPDATE cc_tenants SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{dbaNames}', $1::jsonb)
        WHERE id = $2
      `, [JSON.stringify(dbaNames), tenantId]);
    } else {
      const tenantResult = await serviceQuery(`
        INSERT INTO cc_tenants (name, slug, tenant_type, metadata, status, created_at)
        VALUES ($1, $2, 'business', $3, 'active', NOW())
        RETURNING id
      `, [tenantName, tenantSlug, JSON.stringify({ dbaNames })]);
      tenantId = tenantResult.rows[0].id;
    }
    
    // Ensure Ellen user exists
    let userId: string;
    const existingUser = await serviceQuery(
      'SELECT id FROM cc_users WHERE email = $1',
      [ellenEmail]
    );
    
    const passwordHash = await bcrypt.hash(ellenPassword, 12);
    
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Update password
      await serviceQuery(`
        UPDATE cc_users SET password_hash = $1, given_name = 'Ellen', updated_at = NOW()
        WHERE id = $2
      `, [passwordHash, userId]);
    } else {
      const userResult = await serviceQuery(`
        INSERT INTO cc_users (email, given_name, password_hash, status, created_at)
        VALUES ($1, 'Ellen', $2, 'active', NOW())
        RETURNING id
      `, [ellenEmail, passwordHash]);
      userId = userResult.rows[0].id;
    }
    
    // Ensure Ellen is tenant admin
    const existingMembership = await serviceQuery(
      'SELECT id FROM cc_tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    
    if (existingMembership.rows.length > 0) {
      await serviceQuery(`
        UPDATE cc_tenant_users SET role = 'admin' WHERE tenant_id = $1 AND user_id = $2
      `, [tenantId, userId]);
    } else {
      await serviceQuery(`
        INSERT INTO cc_tenant_users (tenant_id, user_id, role, status, created_at)
        VALUES ($1, $2, 'admin', 'active', NOW())
      `, [tenantId, userId]);
    }
    
    // Ensure contractor profile exists
    let contractorProfileId: string | null = null;
    try {
      const existingProfile = await serviceQuery(
        'SELECT id FROM cc_contractor_profiles WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );
      
      if (existingProfile.rows.length > 0) {
        contractorProfileId = existingProfile.rows[0].id;
      } else {
        const profileResult = await serviceQuery(`
          INSERT INTO cc_contractor_profiles (user_id, tenant_id, status, created_at)
          VALUES ($1, $2, 'active', NOW())
          RETURNING id
        `, [userId, tenantId]);
        contractorProfileId = profileResult.rows[0].id;
      }
    } catch (e) {
      // Contractor profiles table might not exist yet
      console.warn('Could not create contractor profile:', e);
    }
    
    console.log(`[PLATFORM AUDIT] Test persona Ellen ensured: tenant=${tenantId}, user=${userId}, profile=${contractorProfileId}`);
    
    res.json({
      success: true,
      tenantId,
      tenantName,
      dbaNames,
      userId,
      email: ellenEmail,
      password: ellenPassword,
      contractorProfileId,
    });
  } catch (error) {
    console.error('Error ensuring test personas:', error);
    res.status(500).json({ error: 'Failed to ensure test personas' });
  }
});

// ============================================================================
// MEMBERSHIP MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/p2/platform/tenants/:tenantId/members
 * Get all members for a specific tenant
 */
router.get('/tenants/:tenantId/members', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    const result = await serviceQuery(`
      SELECT 
        tu.id as membership_id,
        tu.user_id,
        u.email,
        COALESCE(u.given_name || ' ' || u.family_name, u.email) as name,
        tu.role,
        tu.status,
        tu.title,
        tu.invited_at,
        tu.joined_at,
        tu.invited_email,
        tu.invite_expires_at,
        tu.created_at
      FROM cc_tenant_users tu
      JOIN cc_users u ON u.id = tu.user_id
      WHERE tu.tenant_id = $1
      ORDER BY tu.created_at DESC
    `, [tenantId]);
    
    res.json({
      ok: true,
      members: result.rows.map(row => ({
        membershipId: row.membership_id,
        userId: row.user_id,
        email: row.email,
        name: row.name?.trim() || row.email,
        role: row.role,
        status: row.status,
        title: row.title,
        invitedAt: row.invited_at,
        joinedAt: row.joined_at,
        invitedEmail: row.invited_email,
        inviteExpiresAt: row.invite_expires_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching tenant members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * GET /api/p2/platform/users/:userId/tenants
 * Get all tenant memberships for a specific user
 */
router.get('/users/:userId/tenants', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const result = await serviceQuery(`
      SELECT 
        tu.id as membership_id,
        tu.tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.tenant_type,
        tu.role,
        tu.status,
        tu.title,
        tu.invited_at,
        tu.joined_at,
        tu.created_at
      FROM cc_tenant_users tu
      JOIN cc_tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = $1
      ORDER BY tu.created_at DESC
    `, [userId]);
    
    res.json({
      ok: true,
      tenants: result.rows.map(row => ({
        membershipId: row.membership_id,
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        tenantType: row.tenant_type,
        role: row.role,
        status: row.status,
        title: row.title,
        invitedAt: row.invited_at,
        joinedAt: row.joined_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching user tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * POST /api/p2/platform/memberships
 * Create or update a membership between user and tenant
 */
router.post('/memberships', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId, role = 'member', mode = 'active', inviteEmail, setPassword } = req.body;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'tenantId and userId are required' });
    }
    
    // Verify tenant exists
    const tenantCheck = await serviceQuery('SELECT id, name FROM cc_tenants WHERE id = $1', [tenantId]);
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    // Verify user exists
    const userCheck = await serviceQuery('SELECT id, email FROM cc_users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userEmail = userCheck.rows[0].email;
    
    // Set password if provided (platform admin power tool)
    if (setPassword && isDevMode()) {
      const passwordHash = await bcrypt.hash(setPassword, 12);
      await serviceQuery('UPDATE cc_users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
      console.log(`[PLATFORM AUDIT] password_set user=${userId} by=${req.user?.userId}`);
    }
    
    // Check for existing membership
    const existing = await serviceQuery(
      'SELECT id FROM cc_tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    
    let membership;
    let inviteLink: string | undefined;
    
    if (mode === 'invited') {
      // Generate invite token
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      if (existing.rows.length > 0) {
        // Update existing membership to invited
        const updateResult = await serviceQuery(`
          UPDATE cc_tenant_users 
          SET role = $1, status = 'invited', invited_email = $2, invite_token = $3, 
              invite_expires_at = $4, invited_at = NOW(), updated_at = NOW()
          WHERE tenant_id = $5 AND user_id = $6
          RETURNING id, role, status, invite_token
        `, [role, inviteEmail || userEmail, inviteToken, inviteExpiresAt, tenantId, userId]);
        membership = updateResult.rows[0];
      } else {
        // Create new invited membership
        const insertResult = await serviceQuery(`
          INSERT INTO cc_tenant_users (tenant_id, user_id, role, status, invited_email, invite_token, invite_expires_at, invited_at, created_at)
          VALUES ($1, $2, $3, 'invited', $4, $5, $6, NOW(), NOW())
          RETURNING id, role, status, invite_token
        `, [tenantId, userId, role, inviteEmail || userEmail, inviteToken, inviteExpiresAt]);
        membership = insertResult.rows[0];
      }
      
      inviteLink = `/claim/${inviteToken}`;
    } else {
      // Active mode
      if (existing.rows.length > 0) {
        // Update existing membership to active
        const updateResult = await serviceQuery(`
          UPDATE cc_tenant_users 
          SET role = $1, status = 'active', joined_at = COALESCE(joined_at, NOW()), updated_at = NOW()
          WHERE tenant_id = $2 AND user_id = $3
          RETURNING id, role, status
        `, [role, tenantId, userId]);
        membership = updateResult.rows[0];
      } else {
        // Create new active membership
        const insertResult = await serviceQuery(`
          INSERT INTO cc_tenant_users (tenant_id, user_id, role, status, joined_at, created_at)
          VALUES ($1, $2, $3, 'active', NOW(), NOW())
          RETURNING id, role, status
        `, [tenantId, userId, role]);
        membership = insertResult.rows[0];
      }
    }
    
    console.log(`[PLATFORM AUDIT] membership_upserted tenant=${tenantId} user=${userId} role=${role} mode=${mode} by=${req.user?.userId}`);
    
    res.json({
      ok: true,
      membership: {
        id: membership.id,
        tenantId,
        userId,
        role: membership.role,
        status: membership.status,
      },
      inviteLink,
    });
  } catch (error) {
    console.error('Error creating membership:', error);
    res.status(500).json({ error: 'Failed to create membership' });
  }
});

/**
 * DELETE /api/p2/platform/memberships
 * Remove a membership between user and tenant
 */
router.delete('/memberships', async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.body;
    
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'tenantId and userId are required' });
    }
    
    // Check if user is an admin being removed
    const memberCheck = await serviceQuery(
      'SELECT role FROM cc_tenant_users WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    
    const memberRole = memberCheck.rows[0].role;
    
    // If removing an admin/owner, ensure tenant still has at least one other admin
    if (memberRole === 'admin' || memberRole === 'owner') {
      const adminCount = await serviceQuery(`
        SELECT COUNT(*) as count FROM cc_tenant_users 
        WHERE tenant_id = $1 
        AND role IN ('admin', 'owner') 
        AND status = 'active'
        AND user_id != $2
      `, [tenantId, userId]);
      
      const remainingAdmins = parseInt(adminCount.rows[0]?.count || '0', 10);
      
      if (remainingAdmins === 0) {
        return res.status(400).json({ 
          ok: false, 
          error: 'tenant_must_have_admin',
          message: 'Cannot remove the last admin from a tenant'
        });
      }
    }
    
    const result = await serviceQuery(
      'DELETE FROM cc_tenant_users WHERE tenant_id = $1 AND user_id = $2 RETURNING id',
      [tenantId, userId]
    );
    
    console.log(`[PLATFORM AUDIT] membership_removed tenant=${tenantId} user=${userId} by=${req.user?.userId}`);
    
    res.json({ ok: true, message: 'Membership removed' });
  } catch (error) {
    console.error('Error removing membership:', error);
    res.status(500).json({ error: 'Failed to remove membership' });
  }
});

/**
 * GET /api/p2/platform/users/search
 * Search users by email or name for membership assignment
 */
router.get('/users/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ ok: true, users: [] });
    }
    
    const searchTerm = `%${q.toLowerCase()}%`;
    
    const result = await serviceQuery(`
      SELECT id, email, given_name, family_name, status
      FROM cc_users
      WHERE LOWER(email) LIKE $1 
         OR LOWER(given_name) LIKE $1 
         OR LOWER(family_name) LIKE $1
      ORDER BY email
      LIMIT 20
    `, [searchTerm]);
    
    res.json({
      ok: true,
      users: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: [row.given_name, row.family_name].filter(Boolean).join(' ') || row.email,
        status: row.status,
      })),
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * GET /api/p2/platform/tenants/search
 * Search tenants by name or slug for membership assignment
 */
router.get('/tenants/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ ok: true, tenants: [] });
    }
    
    const searchTerm = `%${q.toLowerCase()}%`;
    
    const result = await serviceQuery(`
      SELECT id, name, slug, tenant_type, status
      FROM cc_tenants
      WHERE LOWER(name) LIKE $1 OR LOWER(slug) LIKE $1
      ORDER BY name
      LIMIT 20
    `, [searchTerm]);
    
    res.json({
      ok: true,
      tenants: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.tenant_type,
        status: row.status,
      })),
    });
  } catch (error) {
    console.error('Error searching tenants:', error);
    res.status(500).json({ error: 'Failed to search tenants' });
  }
});

export default router;

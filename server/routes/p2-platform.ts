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
 */

import express, { Response } from 'express';
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

export default router;

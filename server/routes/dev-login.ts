/**
 * DEV-ONLY: Test user seed and login endpoint
 * 
 * This file provides:
 * 1. Deterministic seed for tester@example.com (dev/test only)
 * 2. /api/dev/login-as endpoint for passwordless login (dev only)
 * 
 * SECURITY: These endpoints MUST NEVER be available in production
 */

import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { serviceQuery } from '../db/tenantDb';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';
const IS_DEV = process.env.NODE_ENV !== 'production';

// Allowlist of emails that can be used with dev login
// This prevents accidental "log in as real user" flows that hide auth issues
const DEV_LOGIN_ALLOWLIST = new Set([
  'tester@example.com',
  'platformadmin@example.com',
  'contractor@example.com',
  'guest@example.com'
]);

interface JWTPayload {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  activeTenantId?: string;
}

/**
 * Seed the test user on server boot (idempotent)
 * Only runs in development mode
 */
export async function ensureDevTestUser(): Promise<void> {
  if (!IS_DEV && process.env.CC_DEV_SEED !== 'true') {
    return;
  }

  try {
    // Check if test user already exists
    const existing = await serviceQuery(
      'SELECT id FROM cc_users WHERE email = $1',
      ['tester@example.com']
    );

    if (existing.rows.length > 0) {
      const existingUserId = existing.rows[0].id;
      
      // Ensure contractor profile exists for existing user
      const tenantResult = await serviceQuery(`
        SELECT id FROM cc_tenants WHERE status = 'active' LIMIT 1
      `);
      
      if (tenantResult.rows.length > 0) {
        const tenantId = tenantResult.rows[0].id;
        
        // Ensure contractor profile exists
        await serviceQuery(`
          INSERT INTO cc_contractor_profiles (user_id, portal_id, tenant_id, onboarding_complete, contractor_role)
          VALUES ($1, $2, $2, false, 'contractor_admin')
          ON CONFLICT (user_id, portal_id) DO NOTHING
        `, [existingUserId, tenantId]);
      }
      
      console.log('[DEV SEED] tester@example.com already exists');
      return;
    }

    // Hash the test password
    const passwordHash = await bcrypt.hash('tester123!', 12);

    // Create the test user
    const userResult = await serviceQuery(`
      INSERT INTO cc_users (
        email, password_hash, given_name, family_name, display_name,
        status, is_platform_admin
      ) VALUES (
        $1, $2, 'Test', 'User', 'Test User',
        'active', true
      )
      RETURNING id
    `, ['tester@example.com', passwordHash]);

    const userId = userResult.rows[0]?.id;

    if (userId) {
      // Get the first tenant to attach the user to
      const tenantResult = await serviceQuery(`
        SELECT id FROM cc_tenants WHERE status = 'active' LIMIT 1
      `);

      if (tenantResult.rows.length > 0) {
        const tenantId = tenantResult.rows[0].id;

        // Attach user to tenant with contractor + platform_admin role
        await serviceQuery(`
          INSERT INTO cc_tenant_users (user_id, tenant_id, role, status)
          VALUES ($1, $2, 'contractor', 'active')
          ON CONFLICT (user_id, tenant_id) DO NOTHING
        `, [userId, tenantId]);

        // Create contractor profile for the test user (required for A2.6 testing)
        // Use tenantId as portalId for dev testing
        await serviceQuery(`
          INSERT INTO cc_contractor_profiles (user_id, portal_id, tenant_id, onboarding_complete, contractor_role)
          VALUES ($1, $2, $2, false, 'contractor_admin')
          ON CONFLICT (user_id, portal_id) DO NOTHING
        `, [userId, tenantId]);

        console.log(`[DEV SEED] ensured tester@example.com (tenant: ${tenantId}, with contractor profile)`);
      } else {
        console.log('[DEV SEED] ensured tester@example.com (no tenant attached)');
      }
    }
  } catch (error) {
    console.error('[DEV SEED] Failed to seed test user:', error);
  }
}

/**
 * DEV-ONLY: Login as any user by email (no password required)
 * POST /api/dev/login-as
 * 
 * SECURITY: Returns 404 in production to hide endpoint existence
 */
router.post('/login-as', async (req: Request, res: Response) => {
  // Hard guard: NEVER allow in production
  if (!IS_DEV && process.env.CC_DEV_SEED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email required' });
    }

    // Check email is in allowlist to prevent accidental real user login
    if (!DEV_LOGIN_ALLOWLIST.has(email.toLowerCase())) {
      return res.status(400).json({ 
        ok: false, 
        error: `Email not in dev login allowlist. Allowed: ${Array.from(DEV_LOGIN_ALLOWLIST).join(', ')}`
      });
    }

    // Find user by email
    const userResult = await serviceQuery(`
      SELECT id, email, given_name, family_name, display_name, 
             is_platform_admin, status
      FROM cc_users WHERE email = $1
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ ok: false, error: 'User not active' });
    }

    // Get user's tenants
    const tenantsResult = await serviceQuery(`
      SELECT t.id, t.name, t.slug, t.tenant_type, tu.role
      FROM cc_tenant_users tu
      JOIN cc_tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = $1 AND tu.status = 'active' AND t.status = 'active'
      ORDER BY t.tenant_type, t.name
    `, [user.id]);

    const tenants = tenantsResult.rows;
    const primaryTenant = tenants[0];

    // Create JWT token (same as normal login)
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.is_platform_admin,
      activeTenantId: primaryTenant?.id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    // Update last login
    await serviceQuery(
      'UPDATE cc_users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
      [user.id]
    );

    console.log(`[DEV LOGIN] Logged in as ${email}`);

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.given_name,
        lastName: user.family_name,
        displayName: user.display_name || `${user.given_name} ${user.family_name}`,
        isPlatformAdmin: user.is_platform_admin
      },
      tenantId: primaryTenant?.id,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.tenant_type,
        role: t.role
      })),
      roles: ['contractor', user.is_platform_admin ? 'platform_admin' : null].filter(Boolean)
    });

  } catch (error: any) {
    console.error('[DEV LOGIN] Error:', error);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

/**
 * DEV-ONLY: Check if dev login is available
 * GET /api/dev/status
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({
    devMode: IS_DEV || process.env.CC_DEV_SEED === 'true',
    testUserEmail: 'tester@example.com'
  });
});

export default router;

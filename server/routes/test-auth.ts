/**
 * V3.5 Test Auth Bootstrap
 * 
 * DEV/TEST-only endpoint to mint sessions for seeded personas.
 * Uses the SAME session mechanism as real login (cc_auth_sessions + JWT).
 * 
 * SECURITY: Returns 404 in production mode.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { serviceQuery } from '../db/tenantDb';
import { generateTokens } from '../middleware/auth';

const router = express.Router();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET;

/**
 * Allowlist of personas that can be used with test auth.
 * Maps persona name -> email in cc_users
 */
const PERSONA_ALLOWLIST: Record<string, string> = {
  ellen: 'ellen@example.com',
  tester: 'tester@example.com',
  wade: 'wade@example.com',
  pavel: 'pavel@example.com',
  rita: 'rita@example.com',
  bamfield_host: 'bamfield_host@example.com',
  platformadmin: 'platformadmin@example.com',
  contractor: 'contractor@example.com',
  guest: 'guest@example.com',
};

/**
 * Create session in cc_auth_sessions (same mechanism as real login)
 */
async function createTestSession(userId: string, refreshToken: string, req: Request): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionTokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await serviceQuery(`
    INSERT INTO cc_auth_sessions (
      user_id, token_hash, refresh_token_hash, refresh_expires_at,
      session_type, device_name, ip_address, user_agent, expires_at
    ) VALUES ($1, $2, $3, $4, 'api', $5, $6, $7, $8)
  `, [
    userId,
    sessionTokenHash,
    refreshTokenHash,
    expiresAt,
    'Playwright Test Runner',
    req.ip || 'test',
    req.headers['user-agent'] || 'Playwright',
    expiresAt
  ]);

  return sessionId;
}

/**
 * Log test auth usage for audit
 */
async function logTestAuthUsage(userId: string, persona: string, req: Request): Promise<void> {
  try {
    await serviceQuery(`
      INSERT INTO cc_audit_log (
        event_type, user_id, metadata, ip_address, user_agent, created_at
      ) VALUES (
        'test_auth_bootstrap', $1, $2, $3, $4, NOW()
      )
    `, [
      userId,
      JSON.stringify({ persona, source: 'test_auth' }),
      req.ip || 'unknown',
      req.headers['user-agent'] || 'unknown'
    ]);
  } catch (error) {
    // Audit log failure should not block auth - table may not exist
    console.warn('[TEST AUTH] Audit log insert failed (table may not exist):', error);
  }
}

/**
 * POST /api/test/auth/login
 * 
 * Mint a session for a seeded test persona.
 * 
 * Requirements:
 * - NODE_ENV !== "production" (returns 404 otherwise)
 * - X-TEST-AUTH header must match TEST_AUTH_SECRET
 * - Body: { persona: string } where persona is in allowlist
 * 
 * Returns: { ok: true, userId, tenantId, accessToken, refreshToken }
 */
router.post('/login', async (req: Request, res: Response) => {
  // HARD GUARD: Never allow in production
  if (IS_PRODUCTION) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Validate X-TEST-AUTH header
  const authHeader = req.headers['x-test-auth'];
  if (!TEST_AUTH_SECRET) {
    return res.status(500).json({ 
      ok: false, 
      error: 'TEST_AUTH_SECRET not configured. Add it to environment.' 
    });
  }
  
  if (authHeader !== TEST_AUTH_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid X-TEST-AUTH header' });
  }

  try {
    const { persona } = req.body;

    if (!persona || typeof persona !== 'string') {
      return res.status(400).json({ 
        ok: false, 
        error: 'persona required',
        allowedPersonas: Object.keys(PERSONA_ALLOWLIST)
      });
    }

    // Validate persona is in allowlist
    const email = PERSONA_ALLOWLIST[persona.toLowerCase()];
    if (!email) {
      return res.status(400).json({ 
        ok: false, 
        error: `Unknown persona: ${persona}`,
        allowedPersonas: Object.keys(PERSONA_ALLOWLIST)
      });
    }

    // Find user in cc_users
    const userResult = await serviceQuery(`
      SELECT id, email, given_name, family_name, display_name, 
             is_platform_admin, status
      FROM cc_users WHERE email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: `Persona "${persona}" not seeded. Run dev seed first.`,
        hint: 'Ensure ensureDevTestUser() or similar seed ran on startup.'
      });
    }

    const user = userResult.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ ok: false, error: 'User not active' });
    }

    // Get user's primary tenant
    const tenantsResult = await serviceQuery(`
      SELECT t.id, t.name, t.slug, tu.role
      FROM cc_tenant_users tu
      JOIN cc_tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = $1 AND tu.status = 'active' AND t.status = 'active'
      ORDER BY t.created_at
      LIMIT 1
    `, [user.id]);

    const primaryTenant = tenantsResult.rows[0] || null;

    // Generate tokens using SAME mechanism as real auth
    const userType = user.is_platform_admin ? 'admin' : 'user';
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, userType);

    // Create session in cc_auth_sessions (SAME as real login)
    await createTestSession(user.id, refreshToken, req);

    // Log for audit
    await logTestAuthUsage(user.id, persona, req);

    // Update login stats
    await serviceQuery(`
      UPDATE cc_users 
      SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1
      WHERE id = $1
    `, [user.id]);

    console.log(`[TEST AUTH] Logged in as persona "${persona}" (${email})`);

    res.json({
      ok: true,
      userId: user.id,
      tenantId: primaryTenant?.id || null,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        isPlatformAdmin: user.is_platform_admin
      },
      tenant: primaryTenant ? {
        id: primaryTenant.id,
        name: primaryTenant.name,
        slug: primaryTenant.slug,
        role: primaryTenant.role
      } : null
    });

  } catch (error: any) {
    console.error('[TEST AUTH] Error:', error);
    res.status(500).json({ ok: false, error: 'Test auth failed' });
  }
});

/**
 * GET /api/test/auth/personas
 * 
 * List available test personas.
 * Only available in non-production mode.
 */
router.get('/personas', (req: Request, res: Response) => {
  if (IS_PRODUCTION) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json({
    ok: true,
    personas: Object.entries(PERSONA_ALLOWLIST).map(([name, email]) => ({
      name,
      email
    }))
  });
});

export default router;

/**
 * V3.5 Test Auth Bootstrap (Hardened)
 * 
 * DEV/TEST-only endpoint to mint sessions for seeded personas.
 * Uses the SAME session mechanism as real login (cc_auth_sessions + JWT).
 * 
 * SECURITY:
 * - Returns 404 in production mode
 * - Returns 404 unless ALLOW_TEST_AUTH === "true"
 * - Requires X-TEST-AUTH header matching TEST_AUTH_SECRET
 * - Rate limited per IP
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { serviceQuery } from '../db/tenantDb';
import { generateTokens } from '../middleware/auth';

const router = express.Router();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOW_TEST_AUTH = process.env.ALLOW_TEST_AUTH === 'true';
const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET;

/**
 * Double guard check - must pass BOTH conditions
 */
function isTestAuthAllowed(): boolean {
  // HARD GUARD 1: Never in production
  if (IS_PRODUCTION) return false;
  // HARD GUARD 2: Must be explicitly enabled
  if (!ALLOW_TEST_AUTH) return false;
  return true;
}

/**
 * Rate limiter - sliding window per IP
 */
interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

const RATE_LIMITS = {
  login: { max: 30, windowMs: 5 * 60 * 1000 },    // 30 requests per 5 minutes
  personas: { max: 60, windowMs: 5 * 60 * 1000 }, // 60 requests per 5 minutes
};

function checkRateLimit(ip: string, endpoint: 'login' | 'personas'): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limit = RATE_LIMITS[endpoint];
  const key = `${endpoint}:${ip}`;
  
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }
  
  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(ts => now - ts < limit.windowMs);
  
  if (entry.timestamps.length >= limit.max) {
    // Calculate when the oldest request will expire
    const oldestTs = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestTs + limit.windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.timestamps.push(now);
  return { allowed: true };
}

/**
 * Canonical persona names -> email mappings
 * Note: Emails must exist in cc_users (via dev seed)
 */
const PERSONA_ALLOWLIST: Record<string, string> = {
  // Core test users (always seeded)
  ellen: 'ellen@example.com',
  tester: 'tester@example.com',
  wade: 'wade@example.com',
  
  // Extended personas (seeded on demand)
  pavel: 'pavel@example.com',
  rita: 'rita@example.com',
  bamfield_host: 'bamfield_host@example.com',
  platformadmin: 'platformadmin@example.com',
  
  // Renamed personas (canonical names -> existing emails)
  service_provider: 'contractor@example.com',  // Renamed from "contractor"
  guest_user: 'guest@example.com',             // Renamed from "guest"
};

/**
 * Legacy persona mapping (for backward compatibility)
 */
const LEGACY_PERSONA_MAP: Record<string, { newName: string }> = {
  contractor: { newName: 'service_provider' },
  guest: { newName: 'guest_user' },
};

/**
 * Resolve persona name (handles legacy names)
 */
function resolvePersona(input: string): { 
  resolvedName: string; 
  email: string | null; 
  deprecated?: { oldName: string; replacedBy: string } 
} {
  const lowerInput = input.toLowerCase();
  
  // Check legacy names first
  if (LEGACY_PERSONA_MAP[lowerInput]) {
    const legacy = LEGACY_PERSONA_MAP[lowerInput];
    const email = PERSONA_ALLOWLIST[legacy.newName];
    return {
      resolvedName: legacy.newName,
      email,
      deprecated: { oldName: lowerInput, replacedBy: legacy.newName }
    };
  }
  
  // Check canonical names
  const email = PERSONA_ALLOWLIST[lowerInput];
  return { resolvedName: lowerInput, email };
}

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
 * Log test auth usage for audit AND cleanup tracking
 * Uses cc_audit_log with test_auth = true marker in metadata
 */
async function logTestAuthUsage(
  userId: string, 
  persona: string, 
  sessionTokenHash: string,
  req: Request
): Promise<void> {
  try {
    // cc_audit_log schema: action, entity_type, entity_id, metadata
    await serviceQuery(`
      INSERT INTO cc_audit_log (
        action, entity_type, entity_id, user_id, metadata, created_at
      ) VALUES (
        'test_auth_bootstrap', 'session', $1, $2, $3, NOW()
      )
    `, [
      sessionTokenHash,  // entity_id = session token hash for cleanup lookup
      userId,
      JSON.stringify({ 
        persona, 
        source: 'test_auth',
        test_auth: true,  // Marker for cleanup
        ip: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown'
      })
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
 * - ALLOW_TEST_AUTH === "true" (returns 404 otherwise)
 * - X-TEST-AUTH header must match TEST_AUTH_SECRET
 * - Body: { persona: string } where persona is in allowlist
 * 
 * Returns: { ok: true, userId, tenantId, accessToken, refreshToken }
 */
router.post('/login', async (req: Request, res: Response) => {
  // DOUBLE GUARD: Never allow unless explicitly enabled in non-prod
  if (!isTestAuthAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Rate limit check
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rateCheck = checkRateLimit(ip, 'login');
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfter));
    return res.status(429).json({ ok: false, error: 'rate_limited', retryAfter: rateCheck.retryAfter });
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

    // Resolve persona (handles legacy names)
    const resolved = resolvePersona(persona);
    
    if (!resolved.email) {
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
    `, [resolved.email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: `Persona "${resolved.resolvedName}" not seeded. Run dev seed first.`,
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
    const sessionId = await createTestSession(user.id, refreshToken, req);

    // Compute session token hash for audit tracking
    const sessionTokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');

    // Log for audit with test_auth marker
    await logTestAuthUsage(user.id, resolved.resolvedName, sessionTokenHash, req);

    // Update login stats
    await serviceQuery(`
      UPDATE cc_users 
      SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1
      WHERE id = $1
    `, [user.id]);

    console.log(`[TEST AUTH] Logged in as persona "${resolved.resolvedName}" (${resolved.email})`);

    // Build response
    const response: any = {
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
    };

    // Include deprecation warning if legacy name was used
    if (resolved.deprecated) {
      response.warning = 'persona_deprecated';
      response.deprecatedPersona = resolved.deprecated.oldName;
      response.replacedBy = resolved.deprecated.replacedBy;
    }

    res.json(response);

  } catch (error: any) {
    console.error('[TEST AUTH] Error:', error);
    res.status(500).json({ ok: false, error: 'Test auth failed' });
  }
});

/**
 * GET /api/test/auth/personas
 * 
 * List available test personas (canonical names only).
 * Only available in non-production mode with ALLOW_TEST_AUTH enabled.
 */
router.get('/personas', (req: Request, res: Response) => {
  // DOUBLE GUARD
  if (!isTestAuthAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Rate limit check
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rateCheck = checkRateLimit(ip, 'personas');
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfter));
    return res.status(429).json({ ok: false, error: 'rate_limited', retryAfter: rateCheck.retryAfter });
  }

  res.json({
    ok: true,
    personas: Object.entries(PERSONA_ALLOWLIST).map(([name, email]) => ({
      name,
      email
    }))
  });
});

/**
 * POST /api/test/auth/purge
 * 
 * Purge expired test auth sessions.
 * Uses cc_audit_log with test_auth marker to identify sessions created by test auth.
 * 
 * Requirements:
 * - Same guards as /login
 * - X-TEST-AUTH header required
 */
router.post('/purge', async (req: Request, res: Response) => {
  // DOUBLE GUARD
  if (!isTestAuthAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Validate X-TEST-AUTH header
  const authHeader = req.headers['x-test-auth'];
  if (!TEST_AUTH_SECRET || authHeader !== TEST_AUTH_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid X-TEST-AUTH header' });
  }

  try {
    // Find expired test auth sessions via audit log join
    // Sessions created by test auth have entries in cc_audit_log with action = 'test_auth_bootstrap'
    // The entity_id column stores the session token hash
    const purgeResult = await serviceQuery(`
      WITH test_sessions AS (
        SELECT entity_id as token_hash
        FROM cc_audit_log
        WHERE action = 'test_auth_bootstrap'
          AND entity_type = 'session'
          AND metadata->>'test_auth' = 'true'
      )
      DELETE FROM cc_auth_sessions s
      WHERE s.expires_at < NOW()
        AND s.device_name = 'Playwright Test Runner'
        AND EXISTS (
          SELECT 1 FROM test_sessions ts WHERE ts.token_hash = s.token_hash
        )
      RETURNING s.id
    `);

    const purgedCount = purgeResult.rowCount || 0;

    console.log(`[TEST AUTH] Purged ${purgedCount} expired test sessions`);

    res.json({ ok: true, purgedCount });

  } catch (error: any) {
    console.error('[TEST AUTH] Purge error:', error);
    // If audit log doesn't exist, fall back to simpler purge by device name
    try {
      const fallbackResult = await serviceQuery(`
        DELETE FROM cc_auth_sessions
        WHERE expires_at < NOW()
          AND device_name = 'Playwright Test Runner'
        RETURNING id
      `);
      
      const purgedCount = fallbackResult.rowCount || 0;
      console.log(`[TEST AUTH] Purged ${purgedCount} expired test sessions (fallback method)`);
      
      res.json({ ok: true, purgedCount, method: 'fallback' });
    } catch (fallbackError: any) {
      console.error('[TEST AUTH] Fallback purge error:', fallbackError);
      res.status(500).json({ ok: false, error: 'Purge failed' });
    }
  }
});

/**
 * Export rate limit check for testing
 */
export { checkRateLimit, resolvePersona, isTestAuthAllowed };

export default router;

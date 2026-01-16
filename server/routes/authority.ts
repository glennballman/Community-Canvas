/**
 * P2.9 Authority / Adjuster Read-Only Portals
 * Public routes for external access and authenticated admin routes for grant management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  validateToken,
  createSession,
  verifySessionToken,
  checkRateLimit,
  hashToken,
  logEvent,
  getBundleManifest,
  getDossier,
  getEvidenceObjectSummary,
  listScopeIndex,
  generateSignedDownloadUrl,
  createGrant,
  getGrant,
  listGrants,
  revokeGrant,
  addScope,
  listScopes,
  removeScope,
  createToken,
  getToken,
  listTokens,
  revokeToken,
  buildShareUrl,
  AuthoritySession,
} from '../lib/authority/access';
import { pool } from '../db';

export const authorityRouter = Router();
export const publicAuthorityRouter = Router();

// ============================================================
// MIDDLEWARE
// ============================================================

interface AuthorityRequest extends Request {
  authoritySession?: AuthoritySession;
}

/**
 * Middleware to validate authority session token
 */
function requireAuthoritySession(req: AuthorityRequest, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authority session token' });
  }
  
  const sessionToken = authHeader.substring(7);
  const session = verifySessionToken(sessionToken);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  req.authoritySession = session;
  next();
}

/**
 * Rate limiting middleware for public endpoints
 */
function rateLimitMiddleware(req: Request, res: Response, next: Function) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const tokenHash = (req as any)._tokenHash || 'no-token';
  
  const { allowed, remaining } = checkRateLimit(ip, tokenHash);
  
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  
  if (!allowed) {
    // Log rate limited event if we have session info
    const session = (req as AuthorityRequest).authoritySession;
    if (session) {
      logEvent(
        session.tenantId,
        session.grantId,
        session.tokenId,
        'rate_limited',
        ip,
        req.headers['user-agent'] || null,
        req.path
      ).catch(() => {});
    }
    
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  next();
}

// ============================================================
// PUBLIC ROUTES (/p/authority/*)
// ============================================================

const sessionSchema = z.object({
  token: z.string().min(1),
  passcode: z.string().optional().nullable(),
});

/**
 * POST /p/authority/session
 * Validate token and create a short-lived session
 */
publicAuthorityRouter.post('/session', rateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const body = sessionSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Store token hash for rate limiting
    (req as any)._tokenHash = hashToken(body.token);
    
    // Validate token
    const validation = await validateToken(body.token, body.passcode || null);
    
    if (!validation.ok) {
      return res.status(401).json({ ok: false, error: 'Invalid token or passcode' });
    }
    
    // Create session
    const { sessionToken, expiresAt } = createSession(validation);
    
    // Log additional metadata at app layer
    await logEvent(
      validation.tenantId!,
      validation.grantId!,
      validation.tokenId!,
      'access_allowed',
      ip,
      userAgent,
      '/p/authority/session',
      { session_created: true }
    );
    
    return res.json({
      ok: true,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
      scopes: validation.scopes,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Authority session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /p/authority/index
 * Get scope index for the session
 */
publicAuthorityRouter.get('/index', requireAuthoritySession, rateLimitMiddleware, async (req: AuthorityRequest, res: Response) => {
  try {
    const { tenantId, grantId, tokenId } = req.authoritySession!;
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    const index = await listScopeIndex(tenantId, grantId);
    
    await logEvent(tenantId, grantId, tokenId, 'access_allowed', ip, userAgent, '/p/authority/index', { items: index.length });
    
    return res.json({ scopes: index });
  } catch (error) {
    console.error('Authority index error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /p/authority/bundles/:bundleId/manifest
 * Get bundle manifest
 */
publicAuthorityRouter.get('/bundles/:bundleId/manifest', requireAuthoritySession, rateLimitMiddleware, async (req: AuthorityRequest, res: Response) => {
  try {
    const { tenantId, grantId, tokenId } = req.authoritySession!;
    const { bundleId } = req.params;
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    const manifest = await getBundleManifest(tenantId, grantId, bundleId);
    
    if (!manifest || !manifest.id) {
      await logEvent(tenantId, grantId, tokenId, 'access_denied', ip, userAgent, req.path, { reason: 'not_in_scope', bundle_id: bundleId });
      return res.status(404).json({ error: 'Bundle not found or not in scope' });
    }
    
    await logEvent(tenantId, grantId, tokenId, 'access_allowed', ip, userAgent, req.path, { bundle_id: bundleId });
    
    return res.json(manifest);
  } catch (error) {
    console.error('Authority bundle manifest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /p/authority/dossiers/:dossierId
 * Get dossier
 */
publicAuthorityRouter.get('/dossiers/:dossierId', requireAuthoritySession, rateLimitMiddleware, async (req: AuthorityRequest, res: Response) => {
  try {
    const { tenantId, grantId, tokenId } = req.authoritySession!;
    const { dossierId } = req.params;
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    const dossier = await getDossier(tenantId, grantId, dossierId);
    
    if (!dossier || !dossier.id) {
      await logEvent(tenantId, grantId, tokenId, 'access_denied', ip, userAgent, req.path, { reason: 'not_in_scope', dossier_id: dossierId });
      return res.status(404).json({ error: 'Dossier not found or not in scope' });
    }
    
    await logEvent(tenantId, grantId, tokenId, 'access_allowed', ip, userAgent, req.path, { dossier_id: dossierId });
    
    return res.json(dossier);
  } catch (error) {
    console.error('Authority dossier error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /p/authority/evidence/:evidenceId
 * Get evidence object summary
 */
publicAuthorityRouter.get('/evidence/:evidenceId', requireAuthoritySession, rateLimitMiddleware, async (req: AuthorityRequest, res: Response) => {
  try {
    const { tenantId, grantId, tokenId } = req.authoritySession!;
    const { evidenceId } = req.params;
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    const evidence = await getEvidenceObjectSummary(tenantId, grantId, evidenceId);
    
    if (!evidence || !evidence.id) {
      await logEvent(tenantId, grantId, tokenId, 'access_denied', ip, userAgent, req.path, { reason: 'not_in_scope', evidence_id: evidenceId });
      return res.status(404).json({ error: 'Evidence not found or not in scope' });
    }
    
    await logEvent(tenantId, grantId, tokenId, 'access_allowed', ip, userAgent, req.path, { evidence_id: evidenceId });
    
    return res.json(evidence);
  } catch (error) {
    console.error('Authority evidence error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /p/authority/evidence/:evidenceId/download
 * Get signed download URL for evidence
 */
publicAuthorityRouter.post('/evidence/:evidenceId/download', requireAuthoritySession, rateLimitMiddleware, async (req: AuthorityRequest, res: Response) => {
  try {
    const { tenantId, grantId, tokenId } = req.authoritySession!;
    const { evidenceId } = req.params;
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Get evidence to verify scope and get r2_key
    const evidence = await getEvidenceObjectSummary(tenantId, grantId, evidenceId);
    
    if (!evidence || !evidence.id) {
      await logEvent(tenantId, grantId, tokenId, 'access_denied', ip, userAgent, req.path, { reason: 'not_in_scope', evidence_id: evidenceId });
      return res.status(404).json({ error: 'Evidence not found or not in scope' });
    }
    
    if (!evidence.r2_key) {
      return res.status(400).json({ error: 'Evidence has no downloadable file' });
    }
    
    // Generate signed URL (60 second expiry)
    const signedUrl = await generateSignedDownloadUrl(evidence.r2_key, 60);
    
    if (!signedUrl) {
      return res.status(500).json({ error: 'Storage not configured' });
    }
    
    // Log download issued
    await logEvent(tenantId, grantId, tokenId, 'download_issued', ip, userAgent, req.path, { evidence_id: evidenceId });
    
    return res.json({
      url: signedUrl.url,
      expires_at: signedUrl.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Authority download error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// AUTHENTICATED ADMIN ROUTES (/api/authority/*)
// ============================================================

const createGrantSchema = z.object({
  grant_type: z.enum(['adjuster', 'insurer', 'regulator', 'legal', 'contractor_third_party', 'generic']),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  circle_id: z.string().uuid().optional().nullable(),
  portal_id: z.string().uuid().optional().nullable(),
  expires_at: z.string().datetime(),
  max_views: z.number().int().positive().optional().nullable(),
  require_passcode: z.boolean().optional(),
  passcode: z.string().min(4).optional().nullable(),
  client_request_id: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/authority/grants
 * Create a new grant
 */
authorityRouter.post('/grants', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const individualId = (req as any).individualId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const body = createGrantSchema.parse(req.body);
    
    const grant = await createGrant({
      tenantId,
      grantType: body.grant_type,
      title: body.title,
      description: body.description || null,
      circleId: body.circle_id || null,
      portalId: body.portal_id || null,
      expiresAt: new Date(body.expires_at),
      maxViews: body.max_views || null,
      requirePasscode: body.require_passcode || false,
      passcode: body.passcode || null,
      createdByIndividualId: individualId || null,
      clientRequestId: body.client_request_id || null,
      metadata: body.metadata || {},
    });
    
    return res.status(201).json(grant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Create grant error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/authority/grants
 * List grants
 */
authorityRouter.get('/grants', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const grants = await listGrants(tenantId, {
      status: status as any,
      limit,
      offset,
    });
    
    // Get token counts for each grant
    const grantsWithCounts = await Promise.all(
      grants.map(async (grant) => {
        const tokenResult = await pool.query<any>(
          `SELECT COUNT(*) as total, 
                  COUNT(*) FILTER (WHERE status = 'active') as active,
                  MAX(last_accessed_at) as last_accessed
           FROM cc_authority_access_tokens 
           WHERE tenant_id = $1::uuid AND grant_id = $2::uuid`,
          [tenantId, grant.id]
        );
        
        return {
          ...grant,
          token_count: parseInt(tokenResult.rows[0].total),
          active_token_count: parseInt(tokenResult.rows[0].active),
          last_accessed_at: tokenResult.rows[0].last_accessed,
        };
      })
    );
    
    return res.json({ grants: grantsWithCounts });
  } catch (error) {
    console.error('List grants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/authority/grants/:id
 * Get grant details
 */
authorityRouter.get('/grants/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const grant = await getGrant(tenantId, id);
    
    if (!grant) {
      return res.status(404).json({ error: 'Grant not found' });
    }
    
    const scopes = await listScopes(tenantId, id);
    const tokens = await listTokens(tenantId, id);
    
    return res.json({ ...grant, scopes, tokens });
  } catch (error) {
    console.error('Get grant error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const addScopeSchema = z.object({
  scope_type: z.enum(['evidence_bundle', 'claim', 'claim_dossier', 'evidence_object']),
  scope_id: z.string().uuid(),
  label: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * POST /api/authority/grants/:id/scopes
 * Add scope to grant
 */
authorityRouter.post('/grants/:id/scopes', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const individualId = (req as any).individualId;
    const { id: grantId } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const body = addScopeSchema.parse(req.body);
    
    // Verify grant exists
    const grant = await getGrant(tenantId, grantId);
    if (!grant) {
      return res.status(404).json({ error: 'Grant not found' });
    }
    
    // Verify scope target exists and belongs to tenant
    const scopeExists = await verifyScopeTarget(tenantId, body.scope_type, body.scope_id);
    if (!scopeExists) {
      return res.status(400).json({ error: 'Scope target not found or not accessible' });
    }
    
    const scope = await addScope({
      tenantId,
      grantId,
      scopeType: body.scope_type,
      scopeId: body.scope_id,
      addedByIndividualId: individualId || null,
      label: body.label || null,
      notes: body.notes || null,
    });
    
    return res.status(201).json(scope);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Add scope error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/authority/grants/:id/scopes/:scopeId
 * Remove scope from grant
 */
authorityRouter.delete('/grants/:id/scopes/:scopeId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id: grantId, scopeId } = req.params;
    const scopeType = req.query.scope_type as string;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!scopeType) {
      return res.status(400).json({ error: 'scope_type query parameter required' });
    }
    
    const removed = await removeScope(tenantId, grantId, scopeType as any, scopeId);
    
    if (!removed) {
      return res.status(404).json({ error: 'Scope not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Remove scope error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const createTokenSchema = z.object({
  expires_at: z.string().datetime().optional().nullable(),
  client_request_id: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/authority/grants/:id/tokens
 * Create token for grant
 */
authorityRouter.post('/grants/:id/tokens', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const individualId = (req as any).individualId;
    const { id: grantId } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const body = createTokenSchema.parse(req.body);
    
    const { token, rawToken } = await createToken({
      tenantId,
      grantId,
      expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
      issuedByIndividualId: individualId || null,
      clientRequestId: body.client_request_id || null,
      metadata: body.metadata || {},
    });
    
    // Build share URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const shareUrl = buildShareUrl(rawToken, baseUrl);
    
    return res.status(201).json({
      ...token,
      raw_token: rawToken,
      share_url: shareUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('Grant not found')) {
      return res.status(404).json({ error: 'Grant not found' });
    }
    if (error instanceof Error && error.message.includes('inactive grant')) {
      return res.status(400).json({ error: 'Cannot create token for inactive grant' });
    }
    console.error('Create token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const revokeSchema = z.object({
  reason: z.string().min(1),
});

/**
 * POST /api/authority/tokens/:id/revoke
 * Revoke a token
 */
authorityRouter.post('/tokens/:id/revoke', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const individualId = (req as any).individualId;
    const { id: tokenId } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const body = revokeSchema.parse(req.body);
    
    await revokeToken(tenantId, tokenId, individualId || null, body.reason);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Token not found' });
    }
    console.error('Revoke token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/authority/grants/:id/revoke
 * Revoke a grant and all its tokens
 */
authorityRouter.post('/grants/:id/revoke', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const individualId = (req as any).individualId;
    const { id: grantId } = req.params;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const body = revokeSchema.parse(req.body);
    
    await revokeGrant(tenantId, grantId, individualId || null, body.reason);
    
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Revoke grant error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/authority/grants/:id/events
 * Get events for a grant
 */
authorityRouter.get('/grants/:id/events', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id: grantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await pool.query<any>(
      `SELECT * FROM cc_authority_access_events 
       WHERE tenant_id = $1::uuid AND grant_id = $2::uuid 
       ORDER BY event_at DESC 
       LIMIT $3 OFFSET $4`,
      [tenantId, grantId, limit, offset]
    );
    
    return res.json({ events: result.rows });
  } catch (error) {
    console.error('Get grant events error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Verify scope target exists and belongs to tenant
 */
async function verifyScopeTarget(
  tenantId: string,
  scopeType: string,
  scopeId: string
): Promise<boolean> {
  let tableName: string;
  
  switch (scopeType) {
    case 'evidence_bundle':
      tableName = 'cc_evidence_bundles';
      break;
    case 'claim':
      tableName = 'cc_insurance_claims';
      break;
    case 'claim_dossier':
      tableName = 'cc_claim_dossiers';
      break;
    case 'evidence_object':
      tableName = 'cc_evidence_objects';
      break;
    default:
      return false;
  }
  
  const result = await pool.query(
    `SELECT 1 FROM ${tableName} WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, scopeId]
  );
  
  return result.rowCount !== null && result.rowCount > 0;
}

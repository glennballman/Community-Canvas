/**
 * P2.9 Authority / Adjuster Read-Only Portals
 * Server utilities for token generation, validation, session management
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, pool } from '../../db';
import { sql } from 'drizzle-orm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================
// TYPES
// ============================================================

export type GrantType = 'adjuster' | 'insurer' | 'regulator' | 'legal' | 'contractor_third_party' | 'generic';
export type GrantStatus = 'active' | 'revoked' | 'expired';
export type ScopeType = 'evidence_bundle' | 'claim' | 'claim_dossier' | 'evidence_object';
export type TokenStatus = 'active' | 'revoked' | 'expired';
export type AccessEventType = 'token_issued' | 'token_revoked' | 'grant_revoked' | 
  'access_allowed' | 'access_denied' | 'passcode_failed' | 'rate_limited' | 'download_issued';

export interface AuthorityGrant {
  id: string;
  tenantId: string;
  circleId: string | null;
  portalId: string | null;
  grantType: GrantType;
  title: string;
  description: string | null;
  createdAt: Date;
  createdByIndividualId: string | null;
  status: GrantStatus;
  revokedAt: Date | null;
  revokedByIndividualId: string | null;
  revokeReason: string | null;
  expiresAt: Date;
  maxViews: number | null;
  requirePasscode: boolean;
  passcodeHash: string | null;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface AuthorityScope {
  id: string;
  tenantId: string;
  grantId: string;
  scopeType: ScopeType;
  scopeId: string;
  addedAt: Date;
  addedByIndividualId: string | null;
  label: string | null;
  notes: string | null;
}

export interface AuthorityToken {
  id: string;
  tenantId: string;
  grantId: string;
  tokenHash: string;
  issuedAt: Date;
  issuedByIndividualId: string | null;
  lastAccessedAt: Date | null;
  accessCount: number;
  status: TokenStatus;
  revokedAt: Date | null;
  revokedByIndividualId: string | null;
  revokeReason: string | null;
  expiresAt: Date;
  clientRequestId: string | null;
  metadata: Record<string, unknown>;
}

export interface AuthoritySession {
  tenantId: string;
  grantId: string;
  tokenId: string;
  exp: number;
}

export interface ValidationResult {
  ok: boolean;
  tenantId?: string;
  grantId?: string;
  tokenId?: string;
  expiresAt?: Date;
  scopes?: Array<{ scope_type: string; scope_id: string; label: string | null }>;
}

export interface CreateGrantInput {
  tenantId: string;
  grantType: GrantType;
  title: string;
  description?: string | null;
  circleId?: string | null;
  portalId?: string | null;
  expiresAt: Date;
  maxViews?: number | null;
  requirePasscode?: boolean;
  passcode?: string | null;
  createdByIndividualId?: string | null;
  clientRequestId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateScopeInput {
  tenantId: string;
  grantId: string;
  scopeType: ScopeType;
  scopeId: string;
  addedByIndividualId?: string | null;
  label?: string | null;
  notes?: string | null;
}

export interface CreateTokenInput {
  tenantId: string;
  grantId: string;
  expiresAt?: Date;
  issuedByIndividualId?: string | null;
  clientRequestId?: string | null;
  metadata?: Record<string, unknown>;
}

// ============================================================
// CONSTANTS
// ============================================================

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-authority-session-secret';
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_BYTES = 32;
const PASSCODE_SALT_ROUNDS = 10;

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'community-canvas-cc_media';

// Rate limiting config
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

// In-memory rate limit store (simple implementation)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ============================================================
// UTILITIES
// ============================================================

/**
 * Generate a cryptographically secure random token
 */
export function generateRawToken(): string {
  const bytes = randomBytes(TOKEN_BYTES);
  return bytes.toString('base64url');
}

/**
 * Compute SHA256 hash of a token (for storage)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Hash passcode for storage
 */
export async function hashPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(passcode, PASSCODE_SALT_ROUNDS);
}

/**
 * Verify passcode against hash
 */
export async function verifyPasscode(passcode: string, hash: string): Promise<boolean> {
  return bcrypt.compare(passcode, hash);
}

/**
 * Create a signed authority session token (JWT)
 */
export function createSessionToken(session: AuthoritySession): string {
  return jwt.sign(session, SESSION_SECRET, { algorithm: 'HS256' });
}

/**
 * Verify and decode authority session token
 */
export function verifySessionToken(token: string): AuthoritySession | null {
  try {
    const decoded = jwt.verify(token, SESSION_SECRET, { algorithms: ['HS256'] }) as AuthoritySession;
    if (decoded.exp * 1000 < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check rate limit for an IP + token hash combination
 */
export function checkRateLimit(ip: string, tokenHash: string): { allowed: boolean; remaining: number } {
  const key = `${ip}:${tokenHash}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  entry.count++;
  
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup rate limits every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

// ============================================================
// R2 SIGNED URL GENERATION
// ============================================================

let r2Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  
  return r2Client;
}

/**
 * Generate a short-lived signed URL for downloading evidence from R2
 */
export async function generateSignedDownloadUrl(
  r2Key: string,
  expiresInSeconds: number = 60
): Promise<{ url: string; expiresAt: Date } | null> {
  const client = getR2Client();
  if (!client) {
    return null;
  }
  
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
  });
  
  const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  
  return { url, expiresAt };
}

// ============================================================
// GRANT MANAGEMENT
// ============================================================

/**
 * Create a new authority access grant
 */
export async function createGrant(input: CreateGrantInput): Promise<AuthorityGrant> {
  let passcodeHash: string | null = null;
  
  if (input.requirePasscode && input.passcode) {
    passcodeHash = await hashPasscode(input.passcode);
  }
  
  const result = await pool.query<AuthorityGrant>(
    `INSERT INTO cc_authority_access_grants (
      tenant_id, circle_id, portal_id, grant_type, title, description,
      created_by_individual_id, expires_at, max_views, require_passcode, passcode_hash,
      client_request_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      input.tenantId,
      input.circleId || null,
      input.portalId || null,
      input.grantType,
      input.title,
      input.description || null,
      input.createdByIndividualId || null,
      input.expiresAt,
      input.maxViews || null,
      input.requirePasscode || false,
      passcodeHash,
      input.clientRequestId || null,
      JSON.stringify(input.metadata || {}),
    ]
  );
  
  return mapGrantRow(result.rows[0]);
}

/**
 * Get grant by ID
 */
export async function getGrant(tenantId: string, grantId: string): Promise<AuthorityGrant | null> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_access_grants WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, grantId]
  );
  
  if (result.rows.length === 0) return null;
  return mapGrantRow(result.rows[0]);
}

/**
 * List grants for a tenant
 */
export async function listGrants(
  tenantId: string,
  options: { status?: GrantStatus; limit?: number; offset?: number } = {}
): Promise<AuthorityGrant[]> {
  const { status, limit = 50, offset = 0 } = options;
  
  let query = `SELECT * FROM cc_authority_access_grants WHERE tenant_id = $1::uuid`;
  const params: any[] = [tenantId];
  
  if (status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const result = await pool.query<any>(query, params);
  return result.rows.map(mapGrantRow);
}

/**
 * Revoke a grant and all its tokens
 */
export async function revokeGrant(
  tenantId: string,
  grantId: string,
  revokedByIndividualId: string | null,
  reason: string
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Revoke grant
    await client.query(
      `UPDATE cc_authority_access_grants 
       SET status = 'revoked', revoked_at = now(), revoked_by_individual_id = $3::uuid, revoke_reason = $4
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [tenantId, grantId, revokedByIndividualId, reason]
    );
    
    // Revoke all tokens for this grant
    await client.query(
      `UPDATE cc_authority_access_tokens 
       SET status = 'revoked', revoked_at = now(), revoked_by_individual_id = $3::uuid, revoke_reason = $4
       WHERE tenant_id = $1::uuid AND grant_id = $2::uuid AND status = 'active'`,
      [tenantId, grantId, revokedByIndividualId, reason]
    );
    
    // Log event
    await client.query(
      `INSERT INTO cc_authority_access_events (tenant_id, grant_id, event_type, event_payload)
       VALUES ($1::uuid, $2::uuid, 'grant_revoked', $3::jsonb)`,
      [tenantId, grantId, JSON.stringify({ reason, revoked_by: revokedByIndividualId })]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// SCOPE MANAGEMENT
// ============================================================

/**
 * Add a scope to a grant
 */
export async function addScope(input: CreateScopeInput): Promise<AuthorityScope> {
  const result = await pool.query<any>(
    `INSERT INTO cc_authority_access_scopes (
      tenant_id, grant_id, scope_type, scope_id, added_by_individual_id, label, notes
    ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6, $7)
    ON CONFLICT (tenant_id, grant_id, scope_type, scope_id) DO NOTHING
    RETURNING *`,
    [
      input.tenantId,
      input.grantId,
      input.scopeType,
      input.scopeId,
      input.addedByIndividualId || null,
      input.label || null,
      input.notes || null,
    ]
  );
  
  if (result.rows.length === 0) {
    // Already exists, fetch it
    const existing = await pool.query<any>(
      `SELECT * FROM cc_authority_access_scopes 
       WHERE tenant_id = $1::uuid AND grant_id = $2::uuid AND scope_type = $3 AND scope_id = $4::uuid`,
      [input.tenantId, input.grantId, input.scopeType, input.scopeId]
    );
    return mapScopeRow(existing.rows[0]);
  }
  
  return mapScopeRow(result.rows[0]);
}

/**
 * List scopes for a grant
 */
export async function listScopes(tenantId: string, grantId: string): Promise<AuthorityScope[]> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_access_scopes WHERE tenant_id = $1::uuid AND grant_id = $2::uuid`,
    [tenantId, grantId]
  );
  return result.rows.map(mapScopeRow);
}

/**
 * Remove a scope from a grant
 */
export async function removeScope(
  tenantId: string,
  grantId: string,
  scopeType: ScopeType,
  scopeId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM cc_authority_access_scopes 
     WHERE tenant_id = $1::uuid AND grant_id = $2::uuid AND scope_type = $3 AND scope_id = $4::uuid`,
    [tenantId, grantId, scopeType, scopeId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * Create a new access token for a grant
 */
export async function createToken(
  input: CreateTokenInput
): Promise<{ token: AuthorityToken; rawToken: string }> {
  // Get grant to copy expiry
  const grant = await getGrant(input.tenantId, input.grantId);
  if (!grant) {
    throw new Error('Grant not found');
  }
  
  if (grant.status !== 'active') {
    throw new Error('Cannot create token for inactive grant');
  }
  
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  
  // Token expiry is min of grant expiry and provided expiry
  let expiresAt = grant.expiresAt;
  if (input.expiresAt && input.expiresAt < grant.expiresAt) {
    expiresAt = input.expiresAt;
  }
  
  const result = await pool.query<any>(
    `INSERT INTO cc_authority_access_tokens (
      tenant_id, grant_id, token_hash, issued_by_individual_id, expires_at, client_request_id, metadata
    ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7)
    RETURNING *`,
    [
      input.tenantId,
      input.grantId,
      tokenHash,
      input.issuedByIndividualId || null,
      expiresAt,
      input.clientRequestId || null,
      JSON.stringify(input.metadata || {}),
    ]
  );
  
  const token = mapTokenRow(result.rows[0]);
  
  // Log event
  await pool.query(
    `INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'token_issued', $4::jsonb)`,
    [input.tenantId, input.grantId, token.id, JSON.stringify({ issued_by: input.issuedByIndividualId })]
  );
  
  return { token, rawToken };
}

/**
 * Get token by ID
 */
export async function getToken(tenantId: string, tokenId: string): Promise<AuthorityToken | null> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_access_tokens WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, tokenId]
  );
  
  if (result.rows.length === 0) return null;
  return mapTokenRow(result.rows[0]);
}

/**
 * List tokens for a grant
 */
export async function listTokens(tenantId: string, grantId: string): Promise<AuthorityToken[]> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_access_tokens 
     WHERE tenant_id = $1::uuid AND grant_id = $2::uuid 
     ORDER BY issued_at DESC`,
    [tenantId, grantId]
  );
  return result.rows.map(mapTokenRow);
}

/**
 * Revoke a token
 */
export async function revokeToken(
  tenantId: string,
  tokenId: string,
  revokedByIndividualId: string | null,
  reason: string
): Promise<void> {
  const token = await getToken(tenantId, tokenId);
  if (!token) {
    throw new Error('Token not found');
  }
  
  await pool.query(
    `UPDATE cc_authority_access_tokens 
     SET status = 'revoked', revoked_at = now(), revoked_by_individual_id = $3::uuid, revoke_reason = $4
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, tokenId, revokedByIndividualId, reason]
  );
  
  // Log event
  await pool.query(
    `INSERT INTO cc_authority_access_events (tenant_id, grant_id, token_id, event_type, event_payload)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'token_revoked', $4::jsonb)`,
    [tenantId, token.grantId, tokenId, JSON.stringify({ reason, revoked_by: revokedByIndividualId })]
  );
}

// ============================================================
// TOKEN VALIDATION (PUBLIC ACCESS)
// ============================================================

/**
 * Validate a raw token and optional passcode
 * Uses the SECURITY DEFINER function in the database
 */
export async function validateToken(
  rawToken: string,
  passcode: string | null = null
): Promise<ValidationResult> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_validate_token($1, $2)`,
    [rawToken, passcode]
  );
  
  if (result.rows.length === 0 || !result.rows[0].ok) {
    return { ok: false };
  }
  
  const row = result.rows[0];
  return {
    ok: true,
    tenantId: row.tenant_id,
    grantId: row.grant_id,
    tokenId: row.token_id,
    expiresAt: row.expires_at,
    scopes: row.scopes || [],
  };
}

/**
 * Get bundle manifest via SECURITY DEFINER function
 */
export async function getBundleManifest(
  tenantId: string,
  grantId: string,
  bundleId: string
): Promise<any | null> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_get_bundle_manifest($1::uuid, $2::uuid, $3::uuid)`,
    [tenantId, grantId, bundleId]
  );
  
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Get dossier via SECURITY DEFINER function
 */
export async function getDossier(
  tenantId: string,
  grantId: string,
  dossierId: string
): Promise<any | null> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_get_dossier($1::uuid, $2::uuid, $3::uuid)`,
    [tenantId, grantId, dossierId]
  );
  
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Get evidence object summary via SECURITY DEFINER function
 */
export async function getEvidenceObjectSummary(
  tenantId: string,
  grantId: string,
  evidenceId: string
): Promise<any | null> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_get_evidence_object_summary($1::uuid, $2::uuid, $3::uuid)`,
    [tenantId, grantId, evidenceId]
  );
  
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * List scope index via SECURITY DEFINER function
 */
export async function listScopeIndex(
  tenantId: string,
  grantId: string
): Promise<any[]> {
  const result = await pool.query<any>(
    `SELECT * FROM cc_authority_list_scope_index($1::uuid, $2::uuid)`,
    [tenantId, grantId]
  );
  
  return result.rows;
}

/**
 * Log an authority access event
 */
export async function logEvent(
  tenantId: string,
  grantId: string,
  tokenId: string | null,
  eventType: AccessEventType,
  ip: string | null = null,
  userAgent: string | null = null,
  path: string | null = null,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const result = await pool.query<any>(
    `SELECT cc_authority_log_event($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb) as id`,
    [tenantId, grantId, tokenId, eventType, ip, userAgent, path, JSON.stringify(payload)]
  );
  
  return result.rows[0].id;
}

// ============================================================
// ROW MAPPERS
// ============================================================

function mapGrantRow(row: any): AuthorityGrant {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    circleId: row.circle_id,
    portalId: row.portal_id,
    grantType: row.grant_type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    createdByIndividualId: row.created_by_individual_id,
    status: row.status,
    revokedAt: row.revoked_at,
    revokedByIndividualId: row.revoked_by_individual_id,
    revokeReason: row.revoke_reason,
    expiresAt: row.expires_at,
    maxViews: row.max_views,
    requirePasscode: row.require_passcode,
    passcodeHash: row.passcode_hash,
    clientRequestId: row.client_request_id,
    metadata: row.metadata || {},
  };
}

function mapScopeRow(row: any): AuthorityScope {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    grantId: row.grant_id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    addedAt: row.added_at,
    addedByIndividualId: row.added_by_individual_id,
    label: row.label,
    notes: row.notes,
  };
}

function mapTokenRow(row: any): AuthorityToken {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    grantId: row.grant_id,
    tokenHash: row.token_hash,
    issuedAt: row.issued_at,
    issuedByIndividualId: row.issued_by_individual_id,
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count,
    status: row.status,
    revokedAt: row.revoked_at,
    revokedByIndividualId: row.revoked_by_individual_id,
    revokeReason: row.revoke_reason,
    expiresAt: row.expires_at,
    clientRequestId: row.client_request_id,
    metadata: row.metadata || {},
  };
}

/**
 * Build share URL for a token
 */
export function buildShareUrl(rawToken: string, baseUrl: string): string {
  return `${baseUrl}/p/authority?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Create a session from validated token
 */
export function createSession(validation: ValidationResult): { sessionToken: string; expiresAt: Date } {
  if (!validation.ok || !validation.tenantId || !validation.grantId || !validation.tokenId) {
    throw new Error('Invalid validation result');
  }
  
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  
  const session: AuthoritySession = {
    tenantId: validation.tenantId,
    grantId: validation.grantId,
    tokenId: validation.tokenId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  
  return {
    sessionToken: createSessionToken(session),
    expiresAt,
  };
}

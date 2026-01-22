/**
 * ONB-01 & ONB-02: Public Onboarding Routes
 * 
 * Guest-accessible workspace creation and management.
 * NO AUTH REQUIRED - uses access tokens for workspace access.
 * 
 * Routes:
 * - POST   /api/public/onboard/workspaces
 * - GET    /api/public/onboard/workspaces/:token
 * - PATCH  /api/public/onboard/workspaces/:token
 * - POST   /api/public/onboard/workspaces/:token/items
 * - GET    /api/public/onboard/workspaces/:token/items
 * - POST   /api/public/onboard/workspaces/:token/upload-url (ONB-02)
 * - POST   /api/public/onboard/workspaces/:token/complete-upload (ONB-02)
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { serviceQuery } from '../db/tenantDb';
import { ccOnboardingWorkspaces, ccOnboardingItems, ccOnboardingMediaObjects, cc_media, ccAiIngestions, ccOnboardingIngestionLinks } from '@shared/schema';
import { eq, desc, and, gte, sql, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getR2UploadUrl, getR2PublicUrl, isR2Configured } from '../lib/media/r2Storage';
import { generateTokens, optionalAuth, authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

const EXPIRY_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function getExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + EXPIRY_DAYS);
  return date;
}

async function getWorkspaceByToken(token: string) {
  return db.query.ccOnboardingWorkspaces.findFirst({
    where: eq(ccOnboardingWorkspaces.accessToken, token)
  });
}

async function extendExpiry(workspaceId: string) {
  const now = new Date();
  const newExpiry = getExpiryDate();
  await db.update(ccOnboardingWorkspaces)
    .set({ 
      expiresAt: newExpiry, 
      lastAccessedAt: now,
      updatedAt: now
    })
    .where(eq(ccOnboardingWorkspaces.id, workspaceId));
  return newExpiry;
}

/**
 * POST /api/public/onboard/workspaces
 * Create a new onboarding workspace
 * 
 * Accepts optional mode hints:
 * - intent: 'provide' | 'need' | 'both' | 'unsure'
 * - entry: 'place' | 'portal' | 'generic' (tracks entry path)
 * - portalSlug: string (if entered via portal)
 */
const createWorkspaceSchema = z.object({
  intent: z.enum(['provide', 'need', 'both', 'unsure']).optional(),
  entry: z.string().optional(),
  portalSlug: z.string().optional()
});

router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const parseResult = createWorkspaceSchema.safeParse(req.body);
    const { intent, entry, portalSlug } = parseResult.success ? parseResult.data : {};
    
    const token = generateToken();
    const expiresAt = getExpiryDate();
    
    // Build mode hints from request params
    const modeHints: Record<string, any> = {
      intent: intent || 'unsure'
    };
    if (entry) modeHints.entry = entry;
    if (portalSlug) modeHints.portalSlug = portalSlug;
    
    const [workspace] = await db.insert(ccOnboardingWorkspaces)
      .values({
        accessToken: token,
        status: 'open',
        modeHints,
        expiresAt
      })
      .returning();
    
    return res.json({
      ok: true,
      token: workspace.accessToken,
      expiresAt: workspace.expiresAt,
      urlPath: `/onboard/w/${workspace.accessToken}`
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return res.status(500).json({ ok: false, error: 'Failed to create workspace' });
  }
});

/**
 * GET /api/public/onboard/workspaces/:token
 * Get workspace details and extend expiry
 */
router.get('/workspaces/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    const newExpiry = await extendExpiry(workspace.id);
    
    const items = await db.query.ccOnboardingItems.findMany({
      where: eq(ccOnboardingItems.workspaceId, workspace.id),
      orderBy: [desc(ccOnboardingItems.createdAt)]
    });
    
    return res.json({
      ok: true,
      workspace: {
        id: workspace.id,
        token: workspace.accessToken,
        status: workspace.status,
        displayName: workspace.displayName,
        companyName: workspace.companyName,
        modeHints: workspace.modeHints,
        expiresAt: newExpiry,
        lastAccessedAt: new Date()
      },
      items
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch workspace' });
  }
});

/**
 * PATCH /api/public/onboard/workspaces/:token
 * Update workspace details
 */
const updateWorkspaceSchema = z.object({
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  modeHints: z.record(z.any()).optional()
});

router.patch('/workspaces/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    const parseResult = updateWorkspaceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { displayName, companyName, modeHints } = parseResult.data;
    const now = new Date();
    const newExpiry = getExpiryDate();
    
    const updates: any = {
      updatedAt: now,
      lastAccessedAt: now,
      expiresAt: newExpiry
    };
    
    if (displayName !== undefined) updates.displayName = displayName;
    if (companyName !== undefined) updates.companyName = companyName;
    if (modeHints !== undefined) {
      updates.modeHints = { ...(workspace.modeHints as object || {}), ...modeHints };
    }
    
    const [updated] = await db.update(ccOnboardingWorkspaces)
      .set(updates)
      .where(eq(ccOnboardingWorkspaces.id, workspace.id))
      .returning();
    
    return res.json({
      ok: true,
      workspace: {
        id: updated.id,
        token: updated.accessToken,
        status: updated.status,
        displayName: updated.displayName,
        companyName: updated.companyName,
        modeHints: updated.modeHints,
        expiresAt: updated.expiresAt,
        lastAccessedAt: updated.lastAccessedAt
      }
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return res.status(500).json({ ok: false, error: 'Failed to update workspace' });
  }
});

/**
 * POST /api/public/onboard/workspaces/:token/items
 * Add an item to the workspace
 * 
 * RES-ONB-01: Added zone_definition item type for resident zone definitions
 */
const createItemSchema = z.object({
  itemType: z.enum(['typed_note', 'media', 'form', 'qr_payload', 'zone_definition']),
  payload: z.record(z.any()).default({})
});

router.post('/workspaces/:token/items', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    const parseResult = createItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { itemType, payload } = parseResult.data;
    
    await extendExpiry(workspace.id);
    
    const [item] = await db.insert(ccOnboardingItems)
      .values({
        workspaceId: workspace.id,
        itemType,
        source: 'user',
        payload
      })
      .returning();
    
    return res.json({ ok: true, item });
  } catch (error) {
    console.error('Error creating item:', error);
    return res.status(500).json({ ok: false, error: 'Failed to create item' });
  }
});

/**
 * GET /api/public/onboard/workspaces/:token/items
 * Get all items for a workspace
 */
router.get('/workspaces/:token/items', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    await extendExpiry(workspace.id);
    
    const items = await db.query.ccOnboardingItems.findMany({
      where: eq(ccOnboardingItems.workspaceId, workspace.id),
      orderBy: [desc(ccOnboardingItems.createdAt)]
    });
    
    return res.json({ ok: true, items });
  } catch (error) {
    console.error('Error fetching items:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch items' });
  }
});

/**
 * DELETE /api/public/onboard/workspaces/:token/items/:itemId
 * Remove an item from the workspace (RES-ONB-01)
 */
router.delete('/workspaces/:token/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { token, itemId } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    // Verify item belongs to this workspace
    const item = await db.query.ccOnboardingItems.findFirst({
      where: and(
        eq(ccOnboardingItems.id, itemId),
        eq(ccOnboardingItems.workspaceId, workspace.id)
      )
    });
    
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }
    
    await db.delete(ccOnboardingItems)
      .where(eq(ccOnboardingItems.id, itemId));
    
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return res.status(500).json({ ok: false, error: 'Failed to delete item' });
  }
});

// ============================================================================
// ONB-02: Photo Upload Endpoints
// ============================================================================

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const RATE_LIMIT_UPLOADS = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Simple in-memory rate limit tracker (per token)
const uploadRateLimits = new Map<string, { count: number; windowStart: number }>();

function checkUploadRateLimit(token: string): boolean {
  const now = Date.now();
  const record = uploadRateLimits.get(token);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    uploadRateLimits.set(token, { count: 1, windowStart: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_UPLOADS) {
    return false;
  }
  
  record.count++;
  return true;
}

/**
 * POST /api/public/onboard/workspaces/:token/upload-url
 * Get a presigned URL for uploading a file to R2
 */
const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().refine(t => ALLOWED_IMAGE_TYPES.includes(t), {
    message: 'Only JPEG, PNG, WebP, and HEIC images are allowed'
  })
});

router.post('/workspaces/:token/upload-url', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!isR2Configured()) {
      return res.status(503).json({ ok: false, error: 'Storage not configured' });
    }
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    if (!checkUploadRateLimit(token)) {
      return res.status(429).json({ ok: false, error: 'Upload rate limit exceeded. Try again later.' });
    }
    
    const parseResult = uploadUrlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { filename, mimeType } = parseResult.data;
    
    // Generate storage key: onboarding/{workspaceId}/{uuid}.{ext}
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const objectId = crypto.randomUUID();
    const storageKey = `onboarding/${workspace.id}/${objectId}.${ext}`;
    
    const uploadUrl = await getR2UploadUrl(storageKey, mimeType, 600);
    
    await extendExpiry(workspace.id);
    
    return res.json({
      ok: true,
      uploadUrl,
      storageKey,
      expiresIn: 600
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({ ok: false, error: 'Failed to generate upload URL' });
  }
});

/**
 * POST /api/public/onboard/workspaces/:token/complete-upload
 * Complete an upload by creating media object and item records
 */
const completeUploadSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().refine(t => ALLOWED_IMAGE_TYPES.includes(t), {
    message: 'Only JPEG, PNG, WebP, and HEIC images are allowed'
  }),
  fileSize: z.number().positive().max(MAX_FILE_SIZE, { 
    message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
  }),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  sha256: z.string().optional(),
  exifJson: z.record(z.any()).optional()
});

router.post('/workspaces/:token/complete-upload', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    const parseResult = completeUploadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { storageKey, mimeType, fileSize, width, height, sha256, exifJson } = parseResult.data;
    
    // Validate storage key belongs to this workspace
    if (!storageKey.startsWith(`onboarding/${workspace.id}/`)) {
      return res.status(400).json({ ok: false, error: 'Invalid storage key for this workspace' });
    }
    
    // Create media object record
    const [mediaObject] = await db.insert(ccOnboardingMediaObjects)
      .values({
        workspaceId: workspace.id,
        storageKey,
        mimeType,
        fileSize: fileSize || null,
        width: width || null,
        height: height || null,
        sha256: sha256 || null,
        exifJson: exifJson || {}
      })
      .returning();
    
    // Create onboarding item referencing the media object
    const [item] = await db.insert(ccOnboardingItems)
      .values({
        workspaceId: workspace.id,
        itemType: 'media',
        source: 'upload',
        payload: {
          mediaObjectId: mediaObject.id,
          storageKey,
          mimeType,
          publicUrl: getR2PublicUrl(storageKey)
        }
      })
      .returning();
    
    await extendExpiry(workspace.id);
    
    return res.json({
      ok: true,
      mediaObject,
      item
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    return res.status(500).json({ ok: false, error: 'Failed to complete upload' });
  }
});

// ============================================================================
// ONB-03: Claim & Promote Endpoints
// ============================================================================

/**
 * GET /api/public/onboard/workspaces/:token/status
 * Returns claim and promotion status
 */
router.get('/workspaces/:token/status', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    const isExpired = new Date(workspace.expiresAt) < new Date();
    const isClaimed = !!workspace.claimedUserId;
    const isPromoted = !!workspace.promotedAt;
    
    let status: 'open' | 'claimed' | 'expired' = 'open';
    if (isExpired) status = 'expired';
    else if (workspace.status === 'claimed' || isClaimed) status = 'claimed';
    
    let next: 'claim' | 'promote' | 'view' = 'claim';
    if (!isClaimed) next = 'claim';
    else if (!isPromoted) next = 'promote';
    else next = 'view';
    
    return res.json({
      ok: true,
      status,
      claimed: isClaimed,
      promoted: isPromoted,
      next,
      claimedUserId: workspace.claimedUserId,
      claimedTenantId: workspace.claimedTenantId,
      promotionSummary: workspace.promotionSummary
    });
  } catch (error) {
    console.error('Error getting status:', error);
    return res.status(500).json({ ok: false, error: 'Failed to get status' });
  }
});

/**
 * POST /api/public/onboard/workspaces/:token/claim
 * Claim workspace to a user account
 */
const claimSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  intent: z.string().optional(),
  createTenant: z.boolean().optional(),
  tenantName: z.string().optional()
});

router.post('/workspaces/:token/claim', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    // Idempotency: if already claimed by same user, allow
    if (workspace.claimedUserId && workspace.status === 'claimed') {
      if (req.user && req.user.id === workspace.claimedUserId) {
        return res.json({
          ok: true,
          workspace: {
            id: workspace.id,
            token: workspace.accessToken,
            status: workspace.status,
            claimedUserId: workspace.claimedUserId,
            claimedTenantId: workspace.claimedTenantId
          },
          message: 'Already claimed by you'
        });
      }
      return res.status(400).json({ ok: false, error: 'Workspace already claimed by another user' });
    }
    
    const parseResult = claimSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { email, password, displayName, companyName, intent, createTenant, tenantName } = parseResult.data;
    
    let userId: string;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let userInfo: any;
    
    // Mode 1: Already authenticated
    if (req.user) {
      userId = req.user.id;
      userInfo = { id: userId, email: req.user.email };
    } 
    // Mode 2: Create account
    else if (email && password) {
      // Check if user exists in cc_users (main user table with UUID)
      const existing = await serviceQuery(
        'SELECT id, email, password_hash FROM cc_users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (existing.rows.length > 0) {
        // User exists - verify password
        if (!existing.rows[0].password_hash) {
          return res.status(401).json({ ok: false, error: 'This email is registered via another method. Please login normally.' });
        }
        const validPassword = await bcrypt.compare(password, existing.rows[0].password_hash);
        if (!validPassword) {
          return res.status(401).json({ ok: false, error: 'Invalid credentials for existing account' });
        }
        userId = existing.rows[0].id;
        userInfo = { id: userId, email: existing.rows[0].email };
      } else {
        // Create new user in cc_users
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await serviceQuery(`
          INSERT INTO cc_users (
            email, password_hash, given_name, display_name, status
          ) VALUES ($1, $2, $3, $4, 'active')
          RETURNING id, email, given_name, display_name
        `, [
          email.toLowerCase(),
          passwordHash,
          displayName || workspace.displayName || null,
          displayName || workspace.displayName || null
        ]);
        
        userId = result.rows[0].id;
        userInfo = result.rows[0];
      }
      
      // Generate tokens (userId is UUID string, cast for legacy function signature)
      const tokens = generateTokens(userId as any, email, 'guest');
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
    } else {
      return res.status(400).json({ ok: false, error: 'Authentication required: provide email/password or be logged in' });
    }
    
    let tenantId: string | null = null;
    
    // Create tenant if requested
    if (createTenant) {
      const name = tenantName || companyName || workspace.companyName || displayName || workspace.displayName || 'My Organization';
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      
      const tenantResult = await serviceQuery(`
        INSERT INTO cc_tenants (name, slug, tenant_type, status, owner_user_id)
        VALUES ($1, $2, 'business', 'active', $3)
        RETURNING id
      `, [name, slug, userId]);
      
      tenantId = tenantResult.rows[0].id;
      
      // Add user as tenant owner via cc_tenant_users
      await serviceQuery(`
        INSERT INTO cc_tenant_users (tenant_id, user_id, role, status, joined_at)
        VALUES ($1, $2, 'owner', 'active', NOW())
      `, [tenantId, userId]);
    }
    
    // Update workspace as claimed
    const [updatedWorkspace] = await db.update(ccOnboardingWorkspaces)
      .set({
        claimedUserId: userId,
        claimedTenantId: tenantId,
        claimedAt: new Date(),
        status: 'claimed',
        displayName: displayName || workspace.displayName,
        companyName: companyName || workspace.companyName,
        modeHints: intent ? { ...workspace.modeHints as object, intent } : workspace.modeHints,
        updatedAt: new Date()
      })
      .where(eq(ccOnboardingWorkspaces.id, workspace.id))
      .returning();
    
    const response: any = {
      ok: true,
      user: userInfo,
      workspace: {
        id: updatedWorkspace.id,
        token: updatedWorkspace.accessToken,
        status: updatedWorkspace.status,
        claimedUserId: updatedWorkspace.claimedUserId,
        claimedTenantId: updatedWorkspace.claimedTenantId
      }
    };
    
    if (accessToken) response.accessToken = accessToken;
    if (refreshToken) response.refreshToken = refreshToken;
    if (tenantId) response.tenantId = tenantId;
    
    return res.json(response);
  } catch (error) {
    console.error('Error claiming workspace:', error);
    return res.status(500).json({ ok: false, error: 'Failed to claim workspace' });
  }
});

/**
 * POST /api/public/onboard/workspaces/:token/promote
 * Promote guest artifacts into tenant-scoped systems
 * Requires authentication (claimed user or platform admin)
 */
const promoteSchema = z.object({
  tenantId: z.string().uuid(),
  modeHints: z.record(z.any()).optional(),
  force: z.boolean().optional()
});

router.post('/workspaces/:token/promote', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user!.id;
    
    const workspace = await getWorkspaceByToken(token);
    
    if (!workspace) {
      return res.status(404).json({ ok: false, error: 'Workspace not found' });
    }
    
    if (new Date(workspace.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' });
    }
    
    // Verify ownership
    if (workspace.claimedUserId !== userId && !req.user!.isPlatformAdmin) {
      return res.status(403).json({ ok: false, error: 'Not authorized to promote this workspace' });
    }
    
    const parseResult = promoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { tenantId, modeHints, force } = parseResult.data;
    
    // Verify tenant membership
    const membershipCheck = await serviceQuery(`
      SELECT role FROM cc_tenant_users 
      WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
    `, [tenantId, userId]);
    
    if (membershipCheck.rows.length === 0 && !req.user!.isPlatformAdmin) {
      return res.status(403).json({ ok: false, error: 'You must be a member of this tenant' });
    }
    
    // Idempotency: if already promoted and not force, return existing summary
    if (workspace.promotedAt && !force) {
      return res.json({
        ok: true,
        promoted: workspace.promotionSummary,
        alreadyPromoted: true,
        redirectTo: `/app/onboarding/results?workspaceToken=${workspace.accessToken}`
      });
    }
    
    let mediaCount = 0;
    let ingestionCount = 0;
    
    // Step 1: Promote media objects to cc_media
    const mediaObjects = await db.query.ccOnboardingMediaObjects.findMany({
      where: and(
        eq(ccOnboardingMediaObjects.workspaceId, workspace.id),
        isNull(ccOnboardingMediaObjects.promotedMediaId)
      )
    });
    
    for (const mediaObj of mediaObjects) {
      // Create cc_media record
      const [newMedia] = await db.insert(cc_media)
        .values({
          tenantId,
          storageKey: mediaObj.storageKey,
          storageProvider: 'r2',
          publicUrl: getR2PublicUrl(mediaObj.storageKey),
          filename: mediaObj.storageKey.split('/').pop() || 'upload',
          mimeType: mediaObj.mimeType,
          fileSize: mediaObj.fileSize || 0,
          width: mediaObj.width,
          height: mediaObj.height,
          mediaType: 'image',
          source: 'onboarding',
          uploadedBy: userId,
          exifJson: mediaObj.exifJson
        })
        .returning();
      
      // Update media object with promotion link
      await db.update(ccOnboardingMediaObjects)
        .set({
          promotedMediaId: newMedia.id,
          promotedAt: new Date()
        })
        .where(eq(ccOnboardingMediaObjects.id, mediaObj.id));
      
      mediaCount++;
    }
    
    // Step 2: Create ingestions for items and link to workspace
    const allItems = await db.query.ccOnboardingItems.findMany({
      where: and(
        eq(ccOnboardingItems.workspaceId, workspace.id),
        isNull(ccOnboardingItems.promotedIngestionId)
      )
    });
    
    // RES-ONB-01: Separate zone_definition items from other items
    const zoneItems = allItems.filter(item => item.itemType === 'zone_definition');
    const otherItems = allItems.filter(item => item.itemType !== 'zone_definition');
    
    const createdIngestionLinks: Array<{ workspaceId: string; tenantId: string; ingestionId: string }> = [];
    
    // Process non-zone items as ingestions
    for (const item of otherItems) {
      // Extract payload fields safely
      const itemPayload = (item.payload || {}) as Record<string, any>;
      
      // Create real cc_ai_ingestions record
      const [newIngestion] = await db.insert(ccAiIngestions)
        .values({
          tenantId,
          contractorProfileId: userId, // Use claiming user as profile reference
          sourceType: 'onboarding',
          status: 'proposed',
          media: [],
          aiProposedPayload: {
            onboardingItemId: item.id,
            itemType: item.itemType,
            label: itemPayload.label,
            note: itemPayload.text || itemPayload.note,
            mediaIds: itemPayload.mediaIds || []
          },
          classification: {},
          extractedEntities: {},
          geoInference: {},
          proposedLinks: {},
          identityProposal: {},
          proposedServiceAreas: []
        })
        .returning();
      
      // Update item with promotion link
      await db.update(ccOnboardingItems)
        .set({
          promotedIngestionId: newIngestion.id,
          promotedAt: new Date()
        })
        .where(eq(ccOnboardingItems.id, item.id));
      
      // Track for linking with tenant
      createdIngestionLinks.push({ 
        workspaceId: workspace.id, 
        tenantId,
        ingestionId: newIngestion.id 
      });
      
      ingestionCount++;
    }
    
    // Insert ingestion links for ONB-04
    if (createdIngestionLinks.length > 0) {
      await db.insert(ccOnboardingIngestionLinks)
        .values(createdIngestionLinks);
    }
    
    // RES-ONB-01: Process zone definitions and create work request for resident mode
    const workspaceModeHints = workspace.modeHints as { intent?: string; entry?: string; portalSlug?: string } || {};
    const isResidentMode = workspaceModeHints.intent === 'need' || workspaceModeHints.entry === 'place';
    let workRequestId: string | null = null;
    let zoneCount = 0;
    
    // Build zone definitions JSON for storage
    const zoneDefinitionsJson: Array<{ zoneType: string; name: string; notes?: string }> = [];
    
    if (isResidentMode && zoneItems.length > 0) {
      // Mark zone items as promoted and collect as JSON
      for (const zoneItem of zoneItems) {
        const payload = (zoneItem.payload || {}) as { zoneType?: string; name?: string; notes?: string };
        zoneDefinitionsJson.push({
          zoneType: payload.zoneType || 'general',
          name: payload.name || payload.zoneType || 'Zone',
          notes: payload.notes
        });
        
        await db.update(ccOnboardingItems)
          .set({ promotedAt: new Date() })
          .where(eq(ccOnboardingItems.id, zoneItem.id));
      }
      zoneCount = zoneItems.length;
    }
    
    // RES-ONB-01: Create draft work request for resident mode
    if (isResidentMode) {
      // Collect notes from typed_note items
      const noteItems = otherItems.filter(item => item.itemType === 'typed_note');
      const notesText = noteItems
        .map(item => (item.payload as any)?.text || '')
        .filter(Boolean)
        .join('\n\n');
      
      // Build zone definitions array for description
      const zoneDefinitions = zoneItems.map(item => {
        const payload = (item.payload || {}) as { zoneType?: string; name?: string; notes?: string };
        return `- ${payload.name || payload.zoneType || 'Zone'}${payload.notes ? `: ${payload.notes}` : ''}`;
      }).join('\n');
      
      // Create draft work request via raw SQL (table not in Drizzle)
      try {
        const userEmail = req.user!.email || 'unknown';
        const description = [
          notesText,
          zoneDefinitions ? `\nWork Zones:\n${zoneDefinitions}` : '',
          `\nPhotos: ${mediaCount}`
        ].filter(Boolean).join('\n');
        
        const wrResult = await serviceQuery(`
          INSERT INTO cc_work_requests (
            tenant_id, contact_channel_value, contact_channel_type,
            summary, description, source, status, created_by_actor_id
          ) VALUES (
            $1, $2, 'email', $3, $4, 'onboarding', 'draft'::work_request_status, $5
          ) RETURNING id
        `, [
          tenantId,
          userEmail,
          workspace.displayName || 'Work request from onboarding',
          description,
          userId
        ]);
        
        if (wrResult.rows.length > 0) {
          workRequestId = wrResult.rows[0].id;
        }
      } catch (wrError) {
        console.error('Failed to create work request:', wrError);
        // Continue with promotion even if work request fails
      }
    }
    
    // Update workspace with promotion summary
    const promotionSummary: Record<string, any> = { 
      mediaCount, 
      ingestionCount, 
      promotedAt: new Date().toISOString() 
    };
    
    // RES-ONB-01: Add resident-specific summary fields (store zone definitions as JSON)
    if (isResidentMode) {
      promotionSummary.zoneCount = zoneCount;
      promotionSummary.zoneDefinitions = zoneDefinitionsJson;
      if (workRequestId) {
        promotionSummary.workRequestId = workRequestId;
      }
    }
    
    await db.update(ccOnboardingWorkspaces)
      .set({
        promotedAt: new Date(),
        promotionSummary,
        modeHints: modeHints ? { ...workspace.modeHints as object, ...modeHints } : workspace.modeHints,
        updatedAt: new Date()
      })
      .where(eq(ccOnboardingWorkspaces.id, workspace.id));
    
    return res.json({
      ok: true,
      promoted: promotionSummary,
      redirectTo: `/app/onboarding/results?workspaceToken=${workspace.accessToken}`
    });
  } catch (error) {
    console.error('Error promoting workspace:', error);
    return res.status(500).json({ ok: false, error: 'Failed to promote workspace' });
  }
});

export default router;

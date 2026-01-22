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
import { db } from '../db';
import { ccOnboardingWorkspaces, ccOnboardingItems, ccOnboardingMediaObjects } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getR2UploadUrl, getR2PublicUrl, isR2Configured } from '../lib/media/r2Storage';

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
 */
const createWorkspaceSchema = z.object({
  intent: z.enum(['provide', 'need', 'both', 'unsure']).optional()
});

router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const parseResult = createWorkspaceSchema.safeParse(req.body);
    const intent = parseResult.success ? parseResult.data.intent : 'unsure';
    
    const token = generateToken();
    const expiresAt = getExpiryDate();
    
    const [workspace] = await db.insert(ccOnboardingWorkspaces)
      .values({
        accessToken: token,
        status: 'open',
        modeHints: { intent: intent || 'unsure' },
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
 */
const createItemSchema = z.object({
  itemType: z.enum(['typed_note', 'media', 'form', 'qr_payload']),
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

export default router;

/**
 * ONB-01: Public Onboarding Routes
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
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { ccOnboardingWorkspaces, ccOnboardingItems } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

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

export default router;

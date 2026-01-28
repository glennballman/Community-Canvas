/**
 * ONB-04: Authenticated Onboarding Routes
 * 
 * Provides tenant-safe access to promoted workspace data including:
 * - Ingestions created from promote
 * - A2.6 Next Actions
 * - A2.7 Photo Bundles
 * - Thread management
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { pool } from '../db';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { 
  ccOnboardingWorkspaces,
  ccOnboardingIngestionLinks,
  ccOnboardingThreads,
  ccAiIngestions,
  ccIngestionNextActions,
  ccContractorPhotoBundles,
  ccOnboardingMediaObjects
} from '@shared/schema';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';
import { can } from '../auth/authorize';

interface AuthUser {
  userId: string;
  email: string;
}

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper: Verify workspace access
 * User must be workspace owner OR platform admin
 * PROMPT-10: Uses capability check instead of isPlatformAdmin flag
 */
async function verifyWorkspaceAccess(
  req: Request,
  workspaceId: string, 
  userId: string
): Promise<{ ok: boolean; workspace?: any; error?: string }> {
  const workspace = await db.query.ccOnboardingWorkspaces.findFirst({
    where: eq(ccOnboardingWorkspaces.id, workspaceId)
  });
  
  if (!workspace) {
    return { ok: false, error: 'Workspace not found' };
  }
  
  if (!workspace.claimedUserId) {
    return { ok: false, error: 'Workspace not claimed' };
  }
  
  // PROMPT-10: Use capability check instead of isPlatformAdmin flag
  const hasPlatformCapability = await can(req, 'platform.configure');
  
  if (workspace.claimedUserId !== userId && !hasPlatformCapability) {
    return { ok: false, error: 'Not authorized to access this workspace' };
  }
  
  return { ok: true, workspace };
}

/**
 * GET /api/onboarding/results?workspaceId=<uuid> OR workspaceToken=<token>
 * 
 * Returns promoted workspace data including ingestions, actions, bundles.
 * Accepts either workspaceId (UUID) or workspaceToken (guest token).
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { workspaceId, workspaceToken } = req.query;
    const user = (req as any).user as AuthUser;
    
    // Find workspace by ID or token
    let workspace: any;
    
    if (workspaceId && typeof workspaceId === 'string') {
      const access = await verifyWorkspaceAccess(req, workspaceId, user.userId);
      if (!access.ok) {
        return res.status(403).json({ ok: false, error: access.error });
      }
      workspace = access.workspace;
    } else if (workspaceToken && typeof workspaceToken === 'string') {
      workspace = await db.query.ccOnboardingWorkspaces.findFirst({
        where: eq(ccOnboardingWorkspaces.accessToken, workspaceToken)
      });
      
      if (!workspace) {
        return res.status(404).json({ ok: false, error: 'Workspace not found' });
      }
      
      if (!workspace.claimedUserId) {
        return res.status(400).json({ ok: false, error: 'Workspace not claimed' });
      }
      
      // PROMPT-10: Use capability check instead of isPlatformAdmin flag
      const hasPlatformCapability = await can(req, 'platform.configure');
      
      // Verify ownership or platform admin
      if (workspace.claimedUserId !== user.userId && !hasPlatformCapability) {
        return res.status(403).json({ ok: false, error: 'Not authorized' });
      }
      
      // Verify tenant membership if workspace is promoted to a tenant
      if (workspace.claimedTenantId && workspace.claimedUserId !== user.userId) {
        const membershipCheck = await pool.query(`
          SELECT role FROM cc_tenant_users 
          WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
        `, [workspace.claimedTenantId, user.userId]);
        
        if (membershipCheck.rows.length === 0 && !hasPlatformCapability) {
          return res.status(403).json({ ok: false, error: 'Not authorized for this tenant' });
        }
      }
    } else {
      return res.status(400).json({ ok: false, error: 'workspaceId or workspaceToken required' });
    }
    const tenantId = workspace.claimedTenantId;
    const wsId = workspace.id;
    
    // Load ingestion links for this workspace
    const ingestionLinks = await db.query.ccOnboardingIngestionLinks.findMany({
      where: eq(ccOnboardingIngestionLinks.workspaceId, wsId)
    });
    
    const ingestionIds = ingestionLinks.map(l => l.ingestionId);
    
    // Load ingestions
    let ingestions: any[] = [];
    if (ingestionIds.length > 0) {
      ingestions = await db.query.ccAiIngestions.findMany({
        where: inArray(ccAiIngestions.id, ingestionIds)
      });
    }
    
    // Load next actions for these ingestions
    let nextActions: any[] = [];
    if (ingestionIds.length > 0) {
      nextActions = await db.query.ccIngestionNextActions.findMany({
        where: inArray(ccIngestionNextActions.ingestionId, ingestionIds)
      });
    }
    
    // Load photo bundles scoped to this workspace's promoted media only
    let photoBundles: any[] = [];
    if (tenantId) {
      // Get promoted media IDs from this workspace
      const promotedMedia = await db.query.ccOnboardingMediaObjects.findMany({
        where: eq(ccOnboardingMediaObjects.workspaceId, wsId)
      });
      
      const promotedMediaIds = promotedMedia
        .filter(m => m.promotedMediaId)
        .map(m => m.promotedMediaId!);
      
      // Only load bundles that include workspace's promoted media
      // For now return empty - full implementation requires bundle-media linking
      // This prevents leaking tenant-wide bundles to workspace viewers
      photoBundles = [];
    }
    
    // Load or reference existing thread
    const existingThread = await db.query.ccOnboardingThreads.findFirst({
      where: and(
        eq(ccOnboardingThreads.workspaceId, wsId),
        tenantId ? eq(ccOnboardingThreads.tenantId, tenantId) : isNull(ccOnboardingThreads.tenantId)
      )
    });
    
    // Count media objects
    const mediaCount = await db.query.ccOnboardingMediaObjects.findMany({
      where: eq(ccOnboardingMediaObjects.workspaceId, wsId)
    }).then(m => m.length);
    
    // Calculate action stats
    const actionsPending = nextActions.filter(a => a.status === 'pending').length;
    const actionsCompleted = nextActions.filter(a => a.status === 'confirmed').length;
    
    // RES-ONB-01: Extract promotion summary for resident mode
    const promotionSummary = (workspace.promotionSummary || {}) as { 
      zoneCount?: number; 
      workRequestId?: string;
      mediaCount?: number;
      ingestionCount?: number;
    };
    const modeHints = (workspace.modeHints || {}) as { 
      intent?: string; 
      entry?: string; 
      portalSlug?: string; 
    };
    
    // Format response to match client expectations
    const response = {
      ok: true,
      workspace: {
        id: workspace.id,
        guestToken: workspace.accessToken,
        status: workspace.status,
        intent: workspace.intent || modeHints.intent || 'unsure',
        claimedAt: workspace.claimedAt,
        promotedAt: workspace.promotedAt,
        modeHints,
        promotionSummary
      },
      summary: {
        mediaCount,
        ingestionCount: ingestions.length,
        actionsPending,
        actionsCompleted,
        zoneCount: promotionSummary.zoneCount,
        workRequestId: promotionSummary.workRequestId
      },
      nextActions: nextActions.map(a => ({
        id: a.id,
        actionType: a.actionType,
        title: a.actionPayload?.title || `${a.actionType} action`,
        payload: a.actionPayload || {},
        status: a.status || 'pending',
        priority: a.priority || 100
      })),
      photoBundles: photoBundles.map(b => ({
        id: b.id,
        bundleType: b.bundleType || 'general',
        label: b.bundleLabel || `${b.bundleType} collection`,
        thumbnailUrl: null, // TODO: Get first photo thumbnail
        photoCount: 0 // TODO: Count photos in bundle
      })),
      thread: existingThread ? { 
        id: existingThread.threadId,
        messageCount: 0 // TODO: Count messages
      } : null
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error loading onboarding results:', error);
    return res.status(500).json({ ok: false, error: 'Failed to load results' });
  }
});

/**
 * POST /api/onboarding/ensure-thread
 * 
 * Creates or returns existing onboarding thread for workspace.
 * Idempotent - safe to call multiple times.
 */
router.post('/ensure-thread', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body;
    const user = (req as any).user as AuthUser;
    
    if (!workspaceId) {
      return res.status(400).json({ ok: false, error: 'workspaceId required' });
    }
    
    // Verify access
    const access = await verifyWorkspaceAccess(req, workspaceId, user.userId);
    if (!access.ok) {
      return res.status(403).json({ ok: false, error: access.error });
    }
    
    const workspace = access.workspace!;
    const tenantId = workspace.claimedTenantId;
    
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Workspace must have a tenant to create thread' });
    }
    
    // Check for existing thread
    const existing = await db.query.ccOnboardingThreads.findFirst({
      where: and(
        eq(ccOnboardingThreads.workspaceId, workspaceId),
        eq(ccOnboardingThreads.tenantId, tenantId)
      )
    });
    
    if (existing) {
      return res.json({ ok: true, threadId: existing.threadId, existed: true });
    }
    
    // Create new conversation/thread
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create conversation
      const convResult = await client.query(`
        INSERT INTO cc_conversations (subject, status, created_at, updated_at)
        VALUES ($1, 'active', now(), now())
        RETURNING id
      `, [`Onboarding: ${workspace.displayName || workspace.companyName || 'New Workspace'}`]);
      
      const conversationId = convResult.rows[0].id as string;
      
      // Add user as participant
      await client.query(`
        INSERT INTO cc_conversation_participants (
          conversation_id, participant_type, individual_id, is_active, joined_at
        )
        VALUES ($1, 'individual', $2, true, now())
        ON CONFLICT DO NOTHING
      `, [conversationId, user.userId]);
      
      await client.query('COMMIT');
      
      // Store thread reference
      await db.insert(ccOnboardingThreads).values({
        workspaceId,
        tenantId,
        threadId: conversationId
      });
      
      return res.json({ ok: true, threadId: conversationId, existed: false });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error ensuring thread:', error);
    return res.status(500).json({ ok: false, error: 'Failed to ensure thread' });
  }
});

/**
 * POST /api/onboarding/post-summary
 * 
 * Posts summary message to onboarding thread.
 * Idempotent - uses hash to prevent duplicates.
 */
router.post('/post-summary', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body;
    const user = (req as any).user as AuthUser;
    
    if (!workspaceId) {
      return res.status(400).json({ ok: false, error: 'workspaceId required' });
    }
    
    // Verify access
    const access = await verifyWorkspaceAccess(req, workspaceId, user.userId);
    if (!access.ok) {
      return res.status(403).json({ ok: false, error: access.error });
    }
    
    const workspace = access.workspace!;
    const tenantId = workspace.claimedTenantId;
    const summary = workspace.promotionSummary as { mediaCount?: number; ingestionCount?: number } || {};
    
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Workspace must have a tenant to post summary' });
    }
    
    // Get thread
    const thread = await db.query.ccOnboardingThreads.findFirst({
      where: and(
        eq(ccOnboardingThreads.workspaceId, workspaceId),
        eq(ccOnboardingThreads.tenantId, tenantId)
      )
    });
    
    if (!thread) {
      return res.status(400).json({ ok: false, error: 'Thread not created yet. Call ensure-thread first.' });
    }
    
    // Generate hash for idempotency
    const summaryContent = `Welcome! Your workspace has been set up with ${summary.mediaCount || 0} photos and ${summary.ingestionCount || 0} items. Review the suggested actions to get started.`;
    const summaryHash = crypto.createHash('md5').update(summaryContent).digest('hex');
    
    // Check if already posted
    if (thread.summaryHash === summaryHash) {
      return res.json({ ok: true, skipped: true, reason: 'Already posted' });
    }
    
    // Post message
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO cc_messages (
          conversation_id, 
          sender_individual_id, 
          message_type, 
          content, 
          visibility,
          created_at
        )
        VALUES ($1, $2, 'text', $3, 'all', now())
      `, [thread.threadId, user.userId, summaryContent]);
      
      // Update thread with hash
      await db.update(ccOnboardingThreads)
        .set({
          summaryHash,
          summaryPostedAt: new Date()
        })
        .where(eq(ccOnboardingThreads.id, thread.id));
      
      return res.json({ ok: true, posted: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error posting summary:', error);
    return res.status(500).json({ ok: false, error: 'Failed to post summary' });
  }
});

/**
 * PATCH /api/onboarding/workspaces/:workspaceId/intent
 * 
 * Update workspace intent (provide/need) - subtle change without blocking progress.
 */
router.patch('/workspaces/:workspaceId/intent', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { intent } = req.body;
    const user = (req as any).user as AuthUser;
    
    if (!['provide', 'need', 'both', 'unsure'].includes(intent)) {
      return res.status(400).json({ ok: false, error: 'Invalid intent value' });
    }
    
    // Verify access
    const access = await verifyWorkspaceAccess(req, workspaceId, user.userId);
    if (!access.ok) {
      return res.status(403).json({ ok: false, error: access.error });
    }
    
    const workspace = access.workspace!;
    const currentHints = (workspace.modeHints as object) || {};
    
    await db.update(ccOnboardingWorkspaces)
      .set({
        modeHints: { ...currentHints, intent },
        updatedAt: new Date()
      })
      .where(eq(ccOnboardingWorkspaces.id, workspaceId));
    
    return res.json({ ok: true, intent });
  } catch (error) {
    console.error('Error updating intent:', error);
    return res.status(500).json({ ok: false, error: 'Failed to update intent' });
  }
});

export default router;

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

interface AuthUser {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
}

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper: Verify workspace access
 * User must be workspace owner OR platform admin
 */
async function verifyWorkspaceAccess(
  workspaceId: string, 
  userId: string, 
  isPlatformAdmin: boolean
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
  
  if (workspace.claimedUserId !== userId && !isPlatformAdmin) {
    return { ok: false, error: 'Not authorized to access this workspace' };
  }
  
  return { ok: true, workspace };
}

/**
 * GET /api/onboarding/results?workspaceId=<uuid>
 * 
 * Returns promoted workspace data including ingestions, actions, bundles.
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    const user = (req as any).user as AuthUser;
    
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ ok: false, error: 'workspaceId required' });
    }
    
    // Verify access
    const access = await verifyWorkspaceAccess(workspaceId, user.userId, user.isPlatformAdmin);
    if (!access.ok) {
      return res.status(403).json({ ok: false, error: access.error });
    }
    
    const workspace = access.workspace!;
    const tenantId = workspace.claimedTenantId;
    
    // Load ingestion links for this workspace
    const ingestionLinks = await db.query.ccOnboardingIngestionLinks.findMany({
      where: eq(ccOnboardingIngestionLinks.workspaceId, workspaceId)
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
    
    // Load photo bundles if tenant exists
    let photoBundles: any[] = [];
    if (tenantId) {
      // Get promoted media IDs from this workspace
      const promotedMedia = await db.query.ccOnboardingMediaObjects.findMany({
        where: and(
          eq(ccOnboardingMediaObjects.workspaceId, workspaceId),
          // Only those that have been promoted
          // Note: promotedMediaId would be set if promoted
        )
      });
      
      const promotedMediaIds = promotedMedia
        .filter(m => m.promotedMediaId)
        .map(m => m.promotedMediaId!);
      
      // For now, load bundles by tenant - in future could filter by mediaIds
      if (tenantId) {
        photoBundles = await db.query.ccContractorPhotoBundles.findMany({
          where: eq(ccContractorPhotoBundles.tenantId, tenantId)
        });
      }
    }
    
    // Load or reference existing thread
    const existingThread = await db.query.ccOnboardingThreads.findFirst({
      where: and(
        eq(ccOnboardingThreads.workspaceId, workspaceId),
        tenantId ? eq(ccOnboardingThreads.tenantId, tenantId) : isNull(ccOnboardingThreads.tenantId)
      )
    });
    
    // Format response
    const response = {
      ok: true,
      workspace: {
        id: workspace.id,
        displayName: workspace.displayName,
        companyName: workspace.companyName,
        modeHints: workspace.modeHints,
        promotionSummary: workspace.promotionSummary,
        claimedTenantId: workspace.claimedTenantId
      },
      ingestions: ingestions.map(i => ({
        id: i.id,
        createdAt: i.createdAt,
        sourceType: i.sourceType,
        status: i.status,
        confidence: i.confidence,
        media: i.media,
        aiProposedPayload: i.aiProposedPayload
      })),
      nextActions: nextActions.map(a => ({
        id: a.id,
        ingestionId: a.ingestionId,
        actionType: a.actionType,
        status: a.status,
        actionPayload: a.actionPayload,
        confidence: a.confidence
      })),
      photoBundles: photoBundles.map(b => ({
        id: b.id,
        status: b.status,
        bundleType: b.bundleType,
        coversFrom: b.coversFrom,
        coversTo: b.coversTo,
        completenessScore: b.completenessScore,
        qualityScore: b.qualityScore
      })),
      thread: existingThread ? { id: existingThread.threadId } : null
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
    const access = await verifyWorkspaceAccess(workspaceId, user.userId, user.isPlatformAdmin);
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
    const access = await verifyWorkspaceAccess(workspaceId, user.userId, user.isPlatformAdmin);
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
    const access = await verifyWorkspaceAccess(workspaceId, user.userId, user.isPlatformAdmin);
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

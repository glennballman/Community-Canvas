/**
 * A2.6: Contractor Ingestion Intelligence Routes
 * 
 * Routes for next action management, work request drafting from ingestions,
 * and N3 run drafting from ingestions.
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
  ccIngestionNextActions, 
  ccStickyNoteExtractions,
  ccAiIngestions,
  ccQuoteDrafts
} from '@shared/schema';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import nextActionsEngine from '../services/nextActionsEngine';

const router = Router();

const resolveActionSchema = z.object({
  resolution: z.enum(['confirm', 'dismiss', 'edit']),
  payload: z.record(z.any()).optional()
});

const draftWorkRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  lineItems: z.array(z.object({
    text: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  })).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  zoneId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional()
});

const draftN3RunSchema = z.object({
  runType: z.enum(['completed_work', 'scheduled_service', 'inspection']).optional(),
  segments: z.array(z.object({
    surfaceId: z.string().uuid().optional(),
    description: z.string().optional()
  })).optional(),
  evidenceIngestionIds: z.array(z.string().uuid()).optional(),
  scheduledFor: z.string().datetime().optional()
});

/**
 * GET /api/contractor/ingestions/:id/next-actions
 * Get next actions for an ingestion
 */
router.get('/:id/next-actions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const actions = await db.query.ccIngestionNextActions.findMany({
      where: eq(ccIngestionNextActions.ingestionId, id),
      orderBy: [desc(ccIngestionNextActions.confidence)]
    });

    return res.json({ ok: true, actions });
  } catch (error) {
    console.error('[A2.6] Error fetching next actions:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch next actions' });
  }
});

/**
 * POST /api/contractor/ingestions/:id/next-actions/recompute
 * Recompute next actions for an ingestion
 */
router.post('/:id/next-actions/recompute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    // Get contractor profile ID from user
    const contractorProfileId = userId; // Simplified: use userId as profileId

    const actions = await nextActionsEngine.recomputeNextActions(
      id,
      tenantId,
      contractorProfileId
    );

    return res.json({ ok: true, actions });
  } catch (error) {
    console.error('[A2.6] Error recomputing next actions:', error);
    return res.status(500).json({ ok: false, error: 'Failed to recompute next actions' });
  }
});

/**
 * POST /api/contractor/ingestions/:id/next-actions/:actionId/resolve
 * Resolve a next action (confirm, dismiss, edit)
 */
router.post('/:id/next-actions/:actionId/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, actionId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const parsed = resolveActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.errors });
    }

    const { resolution, payload } = parsed.data;

    const action = await nextActionsEngine.resolveNextAction(
      actionId,
      resolution,
      payload
    );

    // If confirming certain actions, trigger side effects
    if (resolution === 'confirm' && action.actionType === 'open_quote_draft') {
      // Create a quote draft linked to this ingestion
      const [quoteDraft] = await db.insert(ccQuoteDrafts).values({
        tenantId,
        sourceIngestionId: id,
        sourceMode: 'worksite_upload',
        status: 'draft'
      }).returning();

      return res.json({ 
        ok: true, 
        action, 
        linkedEntity: { type: 'quote_draft', id: quoteDraft.id } 
      });
    }

    return res.json({ ok: true, action });
  } catch (error) {
    console.error('[A2.6] Error resolving next action:', error);
    return res.status(500).json({ ok: false, error: 'Failed to resolve action' });
  }
});

/**
 * GET /api/contractor/ingestions/:id/sticky-note-extraction
 * Get sticky note extraction for an ingestion
 */
router.get('/:id/sticky-note-extraction', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const extraction = await db.query.ccStickyNoteExtractions.findFirst({
      where: eq(ccStickyNoteExtractions.ingestionId, id)
    });

    if (!extraction) {
      return res.status(404).json({ ok: false, error: 'No sticky note extraction found' });
    }

    return res.json({ ok: true, extraction });
  } catch (error) {
    console.error('[A2.6] Error fetching sticky note extraction:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch extraction' });
  }
});

/**
 * POST /api/contractor/work-requests/draft-from-ingestion
 * Create a draft work request from an ingestion
 */
router.post('/work-requests/draft-from-ingestion', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const { ingestionId, ...draftData } = req.body;
    
    if (!ingestionId) {
      return res.status(400).json({ ok: false, error: 'ingestionId required' });
    }

    const parsed = draftWorkRequestSchema.safeParse(draftData);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.errors });
    }

    // Get ingestion for source data
    const ingestion = await db.query.ccAiIngestions.findFirst({
      where: eq(ccAiIngestions.id, ingestionId)
    });

    if (!ingestion) {
      return res.status(404).json({ ok: false, error: 'Ingestion not found' });
    }

    // For now, return a draft payload without persisting
    // Full work request table integration would go here
    const workRequestDraft = {
      id: `draft_${Date.now()}`,
      status: 'draft',
      tenantId,
      sourceIngestionId: ingestionId,
      title: parsed.data.title,
      description: parsed.data.description || '',
      lineItems: parsed.data.lineItems || [],
      urgency: parsed.data.urgency || 'medium',
      zoneId: parsed.data.zoneId,
      customerId: parsed.data.customerId,
      geoInference: ingestion.geoInference,
      createdAt: new Date().toISOString()
    };

    console.log(`[A2.6] Created draft work request from ingestion ${ingestionId}`);

    return res.json({ 
      ok: true, 
      draft: workRequestDraft,
      message: 'Draft created. Confirm to save as work request.'
    });
  } catch (error) {
    console.error('[A2.6] Error creating work request draft:', error);
    return res.status(500).json({ ok: false, error: 'Failed to create work request draft' });
  }
});

/**
 * POST /api/contractor/n3/draft-from-ingestion
 * Create a draft N3 run from an ingestion (proposal only)
 */
router.post('/n3/draft-from-ingestion', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const { ingestionId, ...draftData } = req.body;
    
    if (!ingestionId) {
      return res.status(400).json({ ok: false, error: 'ingestionId required' });
    }

    const parsed = draftN3RunSchema.safeParse(draftData);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.errors });
    }

    // Get ingestion for source data
    const ingestion = await db.query.ccAiIngestions.findFirst({
      where: eq(ccAiIngestions.id, ingestionId)
    });

    if (!ingestion) {
      return res.status(404).json({ ok: false, error: 'Ingestion not found' });
    }

    const geoInference = ingestion.geoInference as any || {};

    // Return draft N3 run payload (proposal only - not persisted until confirm)
    const n3RunDraft = {
      id: `n3_draft_${Date.now()}`,
      status: 'draft',
      tenantId,
      sourceIngestionId: ingestionId,
      runType: parsed.data.runType || 'completed_work',
      segments: parsed.data.segments || [{
        description: 'Work segment from photo evidence',
        surfaceId: null
      }],
      evidenceBundle: {
        ingestionIds: [ingestionId, ...(parsed.data.evidenceIngestionIds || [])],
        capturedAt: ingestion.createdAt
      },
      proposedLocation: {
        lat: geoInference.lat,
        lng: geoInference.lng,
        address: geoInference.proposedAddress
      },
      scheduledFor: parsed.data.scheduledFor,
      createdAt: new Date().toISOString()
    };

    console.log(`[A2.6] Created draft N3 run from ingestion ${ingestionId}`);

    return res.json({ 
      ok: true, 
      draft: n3RunDraft,
      message: 'Draft N3 run created. This is a proposal only - confirm to create live run.'
    });
  } catch (error) {
    console.error('[A2.6] Error creating N3 run draft:', error);
    return res.status(500).json({ ok: false, error: 'Failed to create N3 run draft' });
  }
});

export default router;

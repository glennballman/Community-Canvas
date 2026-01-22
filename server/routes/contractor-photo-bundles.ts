/**
 * A2.7: Photo Bundle API Endpoints
 * 
 * Endpoints for managing contractor photo bundles with timeline and proof intelligence.
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccContractorPhotoBundles, 
  ccAiIngestions,
  ccIngestionNextActions
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { buildOrUpdateTimelineForBundle } from '../services/contractor/photoIntelligenceEngine';
import { resolveBundleItemIdToMedia } from '../services/contractor/bundleMediaResolver';
import { z } from 'zod';

const router = Router();

// Helper to ensure ingestion thread exists (from A2.6)
async function ensureIngestionThread(ingestionId: string, tenantId: string): Promise<string> {
  // For now, return a placeholder - in production would create/get messaging thread
  return `thread-${ingestionId}`;
}

// Helper to post message to thread
async function postThreadMessage(
  threadId: string, 
  tenantId: string, 
  message: string, 
  metadata?: Record<string, any>
): Promise<void> {
  // Log for now - in production would post to messaging system
  console.log(`[A2.7 Thread] ${threadId}: ${message}`, metadata || '');
}

/**
 * GET /api/contractor/photo-bundles
 * List bundles for the current contractor
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const contractorProfileId = (req as any).user?.contractorProfileId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const bundles = await db.select()
      .from(ccContractorPhotoBundles)
      .where(
        contractorProfileId 
          ? and(
              eq(ccContractorPhotoBundles.tenantId, tenantId),
              eq(ccContractorPhotoBundles.contractorProfileId, contractorProfileId)
            )
          : eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
      .orderBy(desc(ccContractorPhotoBundles.createdAt));
    
    return res.json({ bundles });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

/**
 * GET /api/contractor/photo-bundles/:id
 * Get a single bundle with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const bundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: and(
        eq(ccContractorPhotoBundles.id, id),
        eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    return res.json({ bundle });
  } catch (error) {
    console.error('Error fetching bundle:', error);
    return res.status(500).json({ error: 'Failed to fetch bundle' });
  }
});

/**
 * POST /api/contractor/photo-bundles/:id/recompute
 * Recompute bundle intelligence (timeline + proof)
 */
router.post('/:id/recompute', async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.body || {};
    const tenantId = (req as any).tenantId;
    const contractorProfileId = (req as any).user?.contractorProfileId || 'system';
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    // A2.7 Confirmed freeze: if confirmed and not force, only update timeline/proof (not media arrays)
    const existingBundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: and(
        eq(ccContractorPhotoBundles.id, id),
        eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
    });
    
    if (existingBundle?.status === 'confirmed' && force !== true) {
      // Return existing bundle unchanged - timeline/proof can still be refreshed but arrays frozen
      return res.json({ 
        ok: true, 
        bundle: existingBundle, 
        frozen: true,
        message: 'Bundle is confirmed. Media arrays are frozen. Use force=true to override.'
      });
    }
    
    const result = await buildOrUpdateTimelineForBundle({
      tenantId,
      contractorProfileId,
      bundleId: id,
      force: force === true
    });
    
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    
    // Post thread message about recompute
    if (result.bundle) {
      const proofJson = result.bundle.proofJson as any || {};
      const missingItems = proofJson.missingItems || [];
      const missingPrompts = missingItems.map((m: any) => m.prompt).join('; ');
      
      const threadId = await ensureIngestionThread(id, tenantId);
      await postThreadMessage(threadId, tenantId, 
        `Proof bundle recomputed. Status: ${result.bundle.status}${missingPrompts ? `. Missing: ${missingPrompts}` : ''}`,
        { bundleId: id, status: result.bundle.status, missingItems }
      );
    }
    
    return res.json({ ok: true, bundle: result.bundle });
  } catch (error) {
    console.error('Error recomputing bundle:', error);
    return res.status(500).json({ error: 'Failed to recompute bundle' });
  }
});

/**
 * POST /api/contractor/photo-bundles/:id/move
 * Move an item between stages (before/during/after)
 */
const moveSchema = z.object({
  itemId: z.string().uuid(),
  to: z.enum(['before', 'during', 'after'])
});

router.post('/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const parseResult = moveSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { itemId, to } = parseResult.data;
    const { force } = req.body || {};
    
    // Fetch the bundle
    const bundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: and(
        eq(ccContractorPhotoBundles.id, id),
        eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    // A2.7 Confirmed freeze: block move if confirmed unless force=true
    if (bundle.status === 'confirmed' && force !== true) {
      return res.status(400).json({ 
        error: 'Bundle is confirmed and frozen. Media cannot be moved.',
        frozen: true,
        hint: 'Use force=true to override freeze.'
      });
    }
    
    // Get current arrays
    const beforeIds = Array.isArray(bundle.beforeMediaIds) ? [...bundle.beforeMediaIds] : [];
    const duringIds = Array.isArray(bundle.duringMediaIds) ? [...bundle.duringMediaIds] : [];
    const afterIds = Array.isArray(bundle.afterMediaIds) ? [...bundle.afterMediaIds] : [];
    
    // Remove itemId from all arrays
    const removeFrom = (arr: any[]) => arr.filter(id => id !== itemId);
    const newBefore = removeFrom(beforeIds);
    const newDuring = removeFrom(duringIds);
    const newAfter = removeFrom(afterIds);
    
    // Add to target array
    if (to === 'before') newBefore.push(itemId);
    else if (to === 'during') newDuring.push(itemId);
    else if (to === 'after') newAfter.push(itemId);
    
    // Update the bundle
    const [updatedBundle] = await db.update(ccContractorPhotoBundles)
      .set({
        beforeMediaIds: newBefore,
        duringMediaIds: newDuring,
        afterMediaIds: newAfter,
        updatedAt: new Date()
      })
      .where(eq(ccContractorPhotoBundles.id, id))
      .returning();
    
    // Quick recompute of timeline (not full proof rebuild)
    const contractorProfileId = (req as any).user?.contractorProfileId || 'system';
    await buildOrUpdateTimelineForBundle({
      tenantId,
      contractorProfileId,
      bundleId: id,
      force: false
    });
    
    // Refetch after recompute
    const finalBundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: eq(ccContractorPhotoBundles.id, id)
    });
    
    return res.json({ ok: true, bundle: finalBundle });
  } catch (error) {
    console.error('Error moving item:', error);
    return res.status(500).json({ error: 'Failed to move item' });
  }
});

/**
 * POST /api/contractor/photo-bundles/:id/confirm
 * Confirm a complete bundle
 */
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    // Fetch the bundle
    const bundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: and(
        eq(ccContractorPhotoBundles.id, id),
        eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    // Check status - must be complete to confirm
    if (bundle.status !== 'complete') {
      return res.status(400).json({ 
        error: 'Bundle must be complete before confirming',
        currentStatus: bundle.status 
      });
    }
    
    // Update to confirmed
    const [confirmedBundle] = await db.update(ccContractorPhotoBundles)
      .set({
        status: 'confirmed',
        updatedAt: new Date()
      })
      .where(eq(ccContractorPhotoBundles.id, id))
      .returning();
    
    // Post thread message
    const threadId = await ensureIngestionThread(id, tenantId);
    await postThreadMessage(threadId, tenantId, 
      'Proof bundle confirmed',
      { bundleId: id, status: 'confirmed' }
    );
    
    return res.json({ ok: true, bundle: confirmedBundle });
  } catch (error) {
    console.error('Error confirming bundle:', error);
    return res.status(500).json({ error: 'Failed to confirm bundle' });
  }
});

/**
 * POST /api/contractor/photo-bundles/:id/request-missing
 * Request missing items - posts prompts to thread
 */
router.post('/:id/request-missing', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    // Fetch the bundle
    const bundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: and(
        eq(ccContractorPhotoBundles.id, id),
        eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    const proofJson = bundle.proofJson as any || {};
    const missingItems = proofJson.missingItems || [];
    
    if (missingItems.length === 0) {
      return res.json({ ok: true, message: 'No missing items' });
    }
    
    // Post each missing item prompt to thread
    const threadId = await ensureIngestionThread(id, tenantId);
    for (const item of missingItems) {
      await postThreadMessage(threadId, tenantId, 
        `Missing: ${item.prompt}`,
        { bundleId: id, actionType: item.actionType, stage: item.stage }
      );
    }
    
    return res.json({ ok: true, requestedCount: missingItems.length });
  } catch (error) {
    console.error('Error requesting missing items:', error);
    return res.status(500).json({ error: 'Failed to request missing items' });
  }
});

/**
 * POST /api/contractor/photo-bundles/create
 * Create a new bundle (optionally with initial items)
 */
const createBundleSchema = z.object({
  bundleType: z.enum(['before_after', 'progress_series']).default('before_after'),
  jobsiteId: z.string().uuid().optional(),
  beforeMediaIds: z.array(z.string()).optional(),
  afterMediaIds: z.array(z.string()).optional(),
  duringMediaIds: z.array(z.string()).optional()
});

router.post('/create', async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const contractorProfileId = (req as any).user?.contractorProfileId;
    
    if (!tenantId || !contractorProfileId) {
      return res.status(400).json({ error: 'Tenant and contractor context required' });
    }
    
    const parseResult = createBundleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const data = parseResult.data;
    
    // Create the bundle
    const [bundle] = await db.insert(ccContractorPhotoBundles)
      .values({
        tenantId,
        contractorProfileId,
        bundleType: data.bundleType,
        jobsiteId: data.jobsiteId || null,
        beforeMediaIds: data.beforeMediaIds || [],
        afterMediaIds: data.afterMediaIds || [],
        duringMediaIds: data.duringMediaIds || [],
        status: 'incomplete'
      })
      .returning();
    
    // Recompute if we have items
    if ((data.beforeMediaIds?.length || 0) + (data.afterMediaIds?.length || 0) + (data.duringMediaIds?.length || 0) > 0) {
      await buildOrUpdateTimelineForBundle({
        tenantId,
        contractorProfileId,
        bundleId: bundle.id,
        force: false
      });
    }
    
    // Refetch
    const finalBundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: eq(ccContractorPhotoBundles.id, bundle.id)
    });
    
    return res.json({ ok: true, bundle: finalBundle });
  } catch (error) {
    console.error('Error creating bundle:', error);
    return res.status(500).json({ error: 'Failed to create bundle' });
  }
});

/**
 * POST /api/contractor/photo-bundles/:id/add-item
 * Add an item to a bundle
 */
const addItemSchema = z.object({
  itemId: z.string(),
  stage: z.enum(['before', 'during', 'after'])
});

router.post('/:id/add-item', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    const contractorProfileId = (req as any).user?.contractorProfileId || 'system';
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const parseResult = addItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.errors });
    }
    
    const { itemId, stage } = parseResult.data;
    
    // Fetch the bundle
    const bundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: and(
        eq(ccContractorPhotoBundles.id, id),
        eq(ccContractorPhotoBundles.tenantId, tenantId)
      )
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    // Get current arrays and add the item
    const beforeIds = Array.isArray(bundle.beforeMediaIds) ? [...bundle.beforeMediaIds] : [];
    const duringIds = Array.isArray(bundle.duringMediaIds) ? [...bundle.duringMediaIds] : [];
    const afterIds = Array.isArray(bundle.afterMediaIds) ? [...bundle.afterMediaIds] : [];
    
    // Add to appropriate array (avoiding duplicates)
    if (stage === 'before' && !beforeIds.includes(itemId)) beforeIds.push(itemId);
    else if (stage === 'during' && !duringIds.includes(itemId)) duringIds.push(itemId);
    else if (stage === 'after' && !afterIds.includes(itemId)) afterIds.push(itemId);
    
    // Update
    await db.update(ccContractorPhotoBundles)
      .set({
        beforeMediaIds: beforeIds,
        duringMediaIds: duringIds,
        afterMediaIds: afterIds,
        updatedAt: new Date()
      })
      .where(eq(ccContractorPhotoBundles.id, id));
    
    // Recompute
    await buildOrUpdateTimelineForBundle({
      tenantId,
      contractorProfileId,
      bundleId: id,
      force: false
    });
    
    // Refetch
    const finalBundle = await db.query.ccContractorPhotoBundles.findFirst({
      where: eq(ccContractorPhotoBundles.id, id)
    });
    
    return res.json({ ok: true, bundle: finalBundle });
  } catch (error) {
    console.error('Error adding item:', error);
    return res.status(500).json({ error: 'Failed to add item' });
  }
});

export default router;

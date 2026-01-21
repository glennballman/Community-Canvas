/**
 * Contractor Event Routes - A2.5 Event Mode
 * 
 * Routes for event/booth mode operations:
 * - Quote drafts CRUD (create, list, update, publish, discard)
 * - Booth/QR scan ingestions
 * - Fourth Wow calendar opportunity preferences
 * 
 * Non-linear flow: booth scans and worksite photos can arrive in any order.
 * AI proposes → human confirms (no auto-linking).
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { ccQuoteDrafts, ccAiIngestions } from '@shared/schema';
import { conversations, messages } from '@shared/models/chat';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const createQuoteDraftSchema = z.object({
  sourceIngestionId: z.string().uuid().optional(),
  portalId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  addressText: z.string().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  category: z.string().optional(),
  scopeSummary: z.string().optional(),
  scopeDetails: z.record(z.any()).optional(),
  baseEstimate: z.number().optional(),
  lineItems: z.array(z.any()).optional(),
  materials: z.array(z.any()).optional(),
  notes: z.string().optional(),
  sourceMode: z.enum(['event_booth', 'qr_code', 'worksite_upload', 'manual']).optional(),
});

const updateQuoteDraftSchema = createQuoteDraftSchema.partial();

const opportunityPreferencesSchema = z.object({
  acceptMoreInZone: z.boolean().optional(),
  acceptMoreInAllZones: z.boolean().optional(),
  acceptMoreWithinMiles: z.number().optional(),
  keepPrivate: z.boolean().optional(),
});

/**
 * GET /api/contractor/event/quote-drafts
 * List draft quotes for current contractor
 */
router.get('/quote-drafts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const drafts = await db.query.ccQuoteDrafts.findMany({
      where: eq(ccQuoteDrafts.tenantId, tenantId),
      orderBy: [desc(ccQuoteDrafts.createdAt)],
    });

    return res.json({ success: true, drafts });
  } catch (error) {
    console.error('[EVENT] Error fetching quote drafts:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch quote drafts' });
  }
});

/**
 * GET /api/contractor/event/quote-drafts/:id
 * Get single quote draft
 */
router.get('/quote-drafts/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const draft = await db.query.ccQuoteDrafts.findFirst({
      where: and(
        eq(ccQuoteDrafts.id, id),
        eq(ccQuoteDrafts.tenantId, tenantId)
      ),
    });

    if (!draft) {
      return res.status(404).json({ success: false, error: 'Quote draft not found' });
    }

    return res.json({ success: true, draft });
  } catch (error) {
    console.error('[EVENT] Error fetching quote draft:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch quote draft' });
  }
});

/**
 * POST /api/contractor/event/quote-drafts
 * Create new quote draft
 */
router.post('/quote-drafts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const parsed = createQuoteDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.errors });
    }

    const data = parsed.data;

    const [draft] = await db.insert(ccQuoteDrafts).values({
      tenantId,
      portalId: data.portalId || portalId || null,
      zoneId: data.zoneId || null,
      sourceIngestionId: data.sourceIngestionId || null,
      customerName: data.customerName || null,
      customerPhone: data.customerPhone || null,
      customerEmail: data.customerEmail || null,
      addressText: data.addressText || null,
      geoLat: data.geoLat ? String(data.geoLat) : null,
      geoLng: data.geoLng ? String(data.geoLng) : null,
      category: data.category || null,
      scopeSummary: data.scopeSummary || null,
      scopeDetails: data.scopeDetails || {},
      baseEstimate: data.baseEstimate ? String(data.baseEstimate) : null,
      lineItems: data.lineItems || [],
      materials: data.materials || [],
      notes: data.notes || null,
      sourceMode: data.sourceMode || null,
      status: 'draft',
    }).returning();

    console.log(`[EVENT] Created quote draft ${draft.id} for tenant ${tenantId}`);

    return res.status(201).json({ success: true, draft });
  } catch (error) {
    console.error('[EVENT] Error creating quote draft:', error);
    return res.status(500).json({ success: false, error: 'Failed to create quote draft' });
  }
});

/**
 * PATCH /api/contractor/event/quote-drafts/:id
 * Update quote draft
 */
router.patch('/quote-drafts/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const parsed = updateQuoteDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.errors });
    }

    const existing = await db.query.ccQuoteDrafts.findFirst({
      where: and(
        eq(ccQuoteDrafts.id, id),
        eq(ccQuoteDrafts.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote draft not found' });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Cannot update published or archived quote' });
    }

    const data = parsed.data;
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (data.customerName !== undefined) updateData.customerName = data.customerName;
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
    if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail || null;
    if (data.addressText !== undefined) updateData.addressText = data.addressText;
    if (data.geoLat !== undefined) updateData.geoLat = String(data.geoLat);
    if (data.geoLng !== undefined) updateData.geoLng = String(data.geoLng);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.scopeSummary !== undefined) updateData.scopeSummary = data.scopeSummary;
    if (data.scopeDetails !== undefined) updateData.scopeDetails = data.scopeDetails;
    if (data.baseEstimate !== undefined) updateData.baseEstimate = String(data.baseEstimate);
    if (data.lineItems !== undefined) updateData.lineItems = data.lineItems;
    if (data.materials !== undefined) updateData.materials = data.materials;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.portalId !== undefined) updateData.portalId = data.portalId;
    if (data.zoneId !== undefined) updateData.zoneId = data.zoneId;

    const [updated] = await db.update(ccQuoteDrafts)
      .set(updateData)
      .where(eq(ccQuoteDrafts.id, id))
      .returning();

    return res.json({ success: true, draft: updated });
  } catch (error) {
    console.error('[EVENT] Error updating quote draft:', error);
    return res.status(500).json({ success: false, error: 'Failed to update quote draft' });
  }
});

/**
 * POST /api/contractor/event/quote-drafts/:id/publish
 * Publish quote draft → create messaging thread
 */
router.post('/quote-drafts/:id/publish', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const existing = await db.query.ccQuoteDrafts.findFirst({
      where: and(
        eq(ccQuoteDrafts.id, id),
        eq(ccQuoteDrafts.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote draft not found' });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Quote already published or archived' });
    }

    const customerName = existing.customerName || 'Customer';
    const category = existing.category || 'Work Request';
    const estimate = existing.baseEstimate ? `$${existing.baseEstimate}` : 'TBD';

    const [conversation] = await db.insert(conversations).values({
      title: `Quote: ${category} - ${customerName}`,
    }).returning();

    const quoteMessageContent = JSON.stringify({
      type: 'quote_published',
      quoteId: existing.id,
      summary: existing.scopeSummary || 'Work request quote',
      estimate,
      category: existing.category,
      address: existing.addressText,
      notes: existing.notes,
      nextActions: [
        'Ask a question',
        'Request site visit',
        'Accept quote'
      ],
    });

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'system',
      content: quoteMessageContent,
    });

    const [published] = await db.update(ccQuoteDrafts)
      .set({
        status: 'published',
        conversationId: conversation.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ccQuoteDrafts.id, id))
      .returning();

    console.log(`[EVENT] Published quote ${id} with conversation ${conversation.id}`);

    return res.json({ 
      success: true, 
      draft: published,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('[EVENT] Error publishing quote draft:', error);
    return res.status(500).json({ success: false, error: 'Failed to publish quote' });
  }
});

/**
 * POST /api/contractor/event/quote-drafts/:id/discard
 * Discard (archive) quote draft
 */
router.post('/quote-drafts/:id/discard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const existing = await db.query.ccQuoteDrafts.findFirst({
      where: and(
        eq(ccQuoteDrafts.id, id),
        eq(ccQuoteDrafts.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote draft not found' });
    }

    const [archived] = await db.update(ccQuoteDrafts)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ccQuoteDrafts.id, id))
      .returning();

    console.log(`[EVENT] Discarded quote ${id}`);

    return res.json({ success: true, draft: archived });
  } catch (error) {
    console.error('[EVENT] Error discarding quote draft:', error);
    return res.status(500).json({ success: false, error: 'Failed to discard quote' });
  }
});

/**
 * PATCH /api/contractor/event/quote-drafts/:id/opportunity
 * Update Fourth Wow opportunity preferences
 */
router.patch('/quote-drafts/:id/opportunity', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const parsed = opportunityPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.errors });
    }

    const existing = await db.query.ccQuoteDrafts.findFirst({
      where: and(
        eq(ccQuoteDrafts.id, id),
        eq(ccQuoteDrafts.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote draft not found' });
    }

    const [updated] = await db.update(ccQuoteDrafts)
      .set({
        opportunityPreferences: parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(ccQuoteDrafts.id, id))
      .returning();

    console.log(`[EVENT] Updated opportunity preferences for quote ${id}`);

    return res.json({ success: true, draft: updated });
  } catch (error) {
    console.error('[EVENT] Error updating opportunity preferences:', error);
    return res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

export default router;

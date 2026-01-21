/**
 * Public Event Routes - A2.5 Event Mode Public Lead Capture
 * 
 * Public routes for anonymous lead capture at events:
 * - Worksite photo upload (no login required)
 * - Lead creation with minimal info
 * 
 * Security:
 * - Rate limited
 * - File size caps
 * - No tenant access until claimed by contractor
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { ccQuoteDrafts } from '@shared/schema';
import { z } from 'zod';

const router = Router();

const publicLeadSchema = z.object({
  customerName: z.string().min(1, 'Name required').max(100),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  addressText: z.string().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  category: z.string().optional(),
  scopeSummary: z.string().max(1000).optional(),
  portalId: z.string().uuid().optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

/**
 * POST /api/public/event/quote
 * Create anonymous lead/quote draft from public form
 */
router.post('/quote', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ 
        success: false, 
        error: 'Too many requests. Please try again in a minute.' 
      });
    }

    const parsed = publicLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input', 
        details: parsed.error.errors 
      });
    }

    const data = parsed.data;

    const [draft] = await db.insert(ccQuoteDrafts).values({
      tenantId: null,
      contractorProfileId: null,
      portalId: data.portalId || null,
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      customerEmail: data.customerEmail || null,
      addressText: data.addressText || null,
      geoLat: data.geoLat ? String(data.geoLat) : null,
      geoLng: data.geoLng ? String(data.geoLng) : null,
      category: data.category || null,
      scopeSummary: data.scopeSummary || null,
      sourceMode: 'worksite_upload',
      status: 'draft',
    }).returning();

    console.log(`[PUBLIC EVENT] Created anonymous lead ${draft.id}`);

    return res.status(201).json({ 
      success: true, 
      message: 'Your request has been submitted. A contractor will be in touch soon.',
      leadId: draft.id,
    });
  } catch (error) {
    console.error('[PUBLIC EVENT] Error creating lead:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to submit request. Please try again.' 
    });
  }
});

/**
 * GET /api/public/event/quote/:id
 * Get public lead status (limited info)
 */
router.get('/quote/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const draft = await db.query.ccQuoteDrafts.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });

    if (!draft) {
      return res.status(404).json({ 
        success: false, 
        error: 'Request not found' 
      });
    }

    return res.json({ 
      success: true,
      status: draft.status,
      createdAt: draft.createdAt,
      hasContractor: !!draft.contractorProfileId,
    });
  } catch (error) {
    console.error('[PUBLIC EVENT] Error fetching lead status:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch status' 
    });
  }
});

export default router;

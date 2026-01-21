/**
 * Contractor Ingestion Routes - Prompt A2: Media Capture & AI Ingestion Pipeline
 * 
 * Unified ingestion pipeline for:
 * - Vehicle + trailer photos → AI proposal
 * - Tool photos → AI proposal  
 * - Sticky note photos → AI proposal
 * 
 * HARD INVARIANT: AI output is proposal only until human confirms. No silent commits.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { ccAiIngestions, ccContractorProfiles } from '@shared/schema';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Configure multer for media uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'ingestions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(file.mimetype);
  cb(null, ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB per file
});

// Allowed source types
const VALID_SOURCE_TYPES = ['vehicle_photo', 'tool_photo', 'sticky_note'] as const;
type SourceType = typeof VALID_SOURCE_TYPES[number];

// Generate stub AI proposal based on source type
function generateStubProposal(sourceType: SourceType): object {
  switch (sourceType) {
    case 'vehicle_photo':
      return {
        vehicle: {
          type: null,
          make: null,
          model: null,
          year: null,
          color: null,
          license_plate: null,
        },
        trailer: {
          detected: false,
          type: null,
          size: null,
        }
      };
    case 'tool_photo':
      return {
        detected_items: [],
        category_suggestions: [],
      };
    case 'sticky_note':
      return {
        text: '',
        possible_customer: {
          name: null,
          phone: null,
          address: null,
        },
        possible_service_run: {
          description: null,
          date: null,
          time: null,
        }
      };
    default:
      return {};
  }
}

// Helper: Get contractor profile for current user
async function getContractorProfile(userId: string, portalId: string) {
  return db.query.ccContractorProfiles.findFirst({
    where: and(
      eq(ccContractorProfiles.userId, userId),
      eq(ccContractorProfiles.portalId, portalId)
    )
  });
}

/**
 * POST /api/contractor/ingestions
 * Create an ingestion record with uploaded media
 */
router.post('/', authenticateToken, upload.array('media', 10), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    const { source_type } = req.body;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    
    if (!portalId || !tenantId) {
      return res.status(400).json({ ok: false, error: 'Portal ID and Tenant ID required' });
    }
    
    // Validate source type
    if (!source_type || !VALID_SOURCE_TYPES.includes(source_type)) {
      return res.status(400).json({ ok: false, error: 'Invalid source_type. Must be: vehicle_photo, tool_photo, or sticky_note' });
    }
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found. Complete onboarding first.' });
    }
    
    // Process uploaded files
    const files = (req as any).files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one media file is required' });
    }
    
    // Build media array
    const media = files.map(file => ({
      url: `/uploads/ingestions/${file.filename}`,
      mime: file.mimetype,
      bytes: file.size,
      captured_at: new Date().toISOString(),
    }));
    
    // Generate stub AI proposal
    const aiProposedPayload = generateStubProposal(source_type as SourceType);
    const confidenceScore = '50'; // Stub confidence
    
    // Create ingestion record
    const [ingestion] = await db.insert(ccAiIngestions).values({
      tenantId,
      contractorProfileId: profile.id,
      sourceType: source_type,
      status: 'proposed',
      media,
      aiProposedPayload,
      confidenceScore,
    }).returning();
    
    // Audit log
    console.log(`[CONTRACTOR AUDIT] ingestion_created | tenant=${tenantId} | contractor_profile=${profile.id} | ingestion=${ingestion.id} | source_type=${source_type} | actor=${userId} | occurred_at=${new Date().toISOString()}`);
    
    return res.json({
      ok: true,
      ingestion: {
        id: ingestion.id,
        tenantId: ingestion.tenantId,
        contractorProfileId: ingestion.contractorProfileId,
        sourceType: ingestion.sourceType,
        status: ingestion.status,
        media: ingestion.media,
        aiProposedPayload: ingestion.aiProposedPayload,
        confidenceScore: ingestion.confidenceScore,
        createdAt: ingestion.createdAt,
      }
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error creating ingestion:', error);
    return res.status(500).json({ ok: false, error: 'Failed to create ingestion' });
  }
});

/**
 * GET /api/contractor/ingestions/:id
 * Get a single ingestion record (scoped to contractor)
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    // Get contractor profile to scope access
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    // Fetch ingestion scoped to this contractor
    const ingestion = await db.query.ccAiIngestions.findFirst({
      where: and(
        eq(ccAiIngestions.id, id),
        eq(ccAiIngestions.contractorProfileId, profile.id)
      )
    });
    
    if (!ingestion) {
      return res.status(404).json({ ok: false, error: 'Ingestion not found' });
    }
    
    return res.json({
      ok: true,
      ingestion
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error fetching ingestion:', error);
    return res.status(500).json({ ok: false, error: 'Failed to fetch ingestion' });
  }
});

/**
 * POST /api/contractor/ingestions/:id/confirm
 * Confirm an ingestion (human approves AI proposal)
 */
router.post('/:id/confirm', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    const { id } = req.params;
    const { human_confirmed_payload } = req.body;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    // Fetch ingestion
    const ingestion = await db.query.ccAiIngestions.findFirst({
      where: and(
        eq(ccAiIngestions.id, id),
        eq(ccAiIngestions.contractorProfileId, profile.id)
      )
    });
    
    if (!ingestion) {
      return res.status(404).json({ ok: false, error: 'Ingestion not found' });
    }
    
    if (ingestion.status !== 'proposed') {
      return res.status(400).json({ ok: false, error: `Cannot confirm ingestion with status: ${ingestion.status}` });
    }
    
    // Use provided payload or default to AI proposal
    const confirmedPayload = human_confirmed_payload || ingestion.aiProposedPayload;
    
    // Update ingestion
    const [updated] = await db.update(ccAiIngestions)
      .set({
        status: 'confirmed',
        humanConfirmedPayload: confirmedPayload,
        updatedAt: new Date(),
      })
      .where(eq(ccAiIngestions.id, id))
      .returning();
    
    // Audit log
    console.log(`[CONTRACTOR AUDIT] ingestion_confirmed | tenant=${tenantId} | contractor_profile=${profile.id} | ingestion=${id} | source_type=${ingestion.sourceType} | actor=${userId} | occurred_at=${new Date().toISOString()}`);
    
    return res.json({
      ok: true,
      ingestion: updated
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error confirming ingestion:', error);
    return res.status(500).json({ ok: false, error: 'Failed to confirm ingestion' });
  }
});

/**
 * POST /api/contractor/ingestions/:id/discard
 * Discard an ingestion
 */
router.post('/:id/discard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    // Fetch ingestion
    const ingestion = await db.query.ccAiIngestions.findFirst({
      where: and(
        eq(ccAiIngestions.id, id),
        eq(ccAiIngestions.contractorProfileId, profile.id)
      )
    });
    
    if (!ingestion) {
      return res.status(404).json({ ok: false, error: 'Ingestion not found' });
    }
    
    if (ingestion.status !== 'proposed') {
      return res.status(400).json({ ok: false, error: `Cannot discard ingestion with status: ${ingestion.status}` });
    }
    
    // Update ingestion
    const [updated] = await db.update(ccAiIngestions)
      .set({
        status: 'discarded',
        updatedAt: new Date(),
      })
      .where(eq(ccAiIngestions.id, id))
      .returning();
    
    // Audit log
    console.log(`[CONTRACTOR AUDIT] ingestion_discarded | tenant=${tenantId} | contractor_profile=${profile.id} | ingestion=${id} | source_type=${ingestion.sourceType} | actor=${userId} | occurred_at=${new Date().toISOString()}`);
    
    return res.json({
      ok: true,
      ingestion: updated
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error discarding ingestion:', error);
    return res.status(500).json({ ok: false, error: 'Failed to discard ingestion' });
  }
});

/**
 * GET /api/contractor/ingestions
 * List ingestions for current contractor
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { source_type, status } = req.query;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    // Build query conditions
    const conditions = [eq(ccAiIngestions.contractorProfileId, profile.id)];
    
    if (source_type && VALID_SOURCE_TYPES.includes(source_type as SourceType)) {
      conditions.push(eq(ccAiIngestions.sourceType, source_type as string));
    }
    
    if (status && ['proposed', 'confirmed', 'discarded', 'error'].includes(status as string)) {
      conditions.push(eq(ccAiIngestions.status, status as string));
    }
    
    const ingestions = await db.select()
      .from(ccAiIngestions)
      .where(and(...conditions))
      .orderBy(desc(ccAiIngestions.createdAt))
      .limit(50);
    
    return res.json({
      ok: true,
      ingestions
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error listing ingestions:', error);
    return res.status(500).json({ ok: false, error: 'Failed to list ingestions' });
  }
});

export default router;

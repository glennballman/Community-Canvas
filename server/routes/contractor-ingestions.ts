/**
 * Contractor Ingestion Routes - Prompt A2.3: Unified Upload Classifier + Asset Router
 * 
 * Unified ingestion pipeline for ANY contractor upload:
 * - Vehicle + trailer photos → fleet assets
 * - Tool photos → tool assets
 * - Jobsite photos → GPS-clustered jobsites
 * - Before/after photos → paired bundles
 * - Sticky note/whiteboard → draft customers/service runs
 * - Documents/receipts → material extraction
 * 
 * HARD RULES:
 * - Always ingest first, classify with confidence
 * - Store provenance + confidence
 * - Propose next actions immediately
 * - No discard of uncertain data
 * 
 * HARD INVARIANT: AI output is proposal only until human confirms. No silent commits.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { ccAiIngestions, ccContractorProfiles, ccContractorFleet, ccContractorTools, ccContractorJobsites, ccContractorCustomers, ccContractorOpportunities, ccContractorPhotoBundles } from '@shared/schema';
import { authenticateToken } from '../middleware/auth';
import { can } from '../auth/authorize';
import { classifyUploads, autoLinkClassifiedUploads, type MediaItem, type ClassifiedIngestion } from '../services/contractorUploadClassifier';
import { inferOpportunities, storeOpportunities } from '../services/contractorRouteOpportunityEngine';

const router = Router();

// PROMPT-17B: Router-level authentication gate
router.use(authenticateToken);

/**
 * PROMPT-17B: Canonical 403 deny helper (AUTH_CONSTITUTION §8a)
 * Uses service_runs.own.* capabilities for contractor self-service operations
 */
function denyCapability(res: Response, capability: string): Response {
  return res.status(403).json({
    error: 'Forbidden',
    code: 'NOT_AUTHORIZED',
    capability,
    reason: 'capability_not_granted',
  });
}

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

// A2.3: Extended source types (auto-detected by classifier)
const VALID_SOURCE_TYPES = [
  'vehicle_photo', 'tool_photo', 'sticky_note',
  'vehicle_truck', 'vehicle_trailer', 'vehicle_van',
  'tool', 'material', 'jobsite', 'before_photo', 'after_photo',
  'whiteboard', 'document', 'receipt', 'unknown'
] as const;
type SourceType = typeof VALID_SOURCE_TYPES[number];

// Context hints for upload batches
const VALID_CONTEXT_HINTS = ['onboarding', 'job', 'fleet', 'unknown'] as const;
type ContextHint = typeof VALID_CONTEXT_HINTS[number];

// Batch sources
const VALID_BATCH_SOURCES = ['camera', 'upload', 'bulk'] as const;
type BatchSource = typeof VALID_BATCH_SOURCES[number];

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
 * A2.3: Unified upload classifier - classifies ANY media and proposes links
 * 
 * Request body:
 * - source: 'camera' | 'upload' | 'bulk' (optional)
 * - context_hint: 'onboarding' | 'job' | 'fleet' | 'unknown' (optional)
 * - auto_link: boolean (optional, defaults to true) - auto-create fleet/tool/jobsite records
 */
router.post('/', upload.array('media', 10), async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    // A2.3 HARD RULE: auto_link defaults to FALSE - proposals only until user confirms
    const { source = 'upload', context_hint = 'unknown', auto_link = false } = req.body;
    
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }
    
    if (!portalId || !tenantId) {
      return res.status(400).json({ ok: false, error: 'Portal ID and Tenant ID required' });
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
    
    // Build media array for classifier
    const mediaItems: MediaItem[] = files.map(file => ({
      url: `/uploads/ingestions/${file.filename}`,
      mime: file.mimetype,
      bytes: file.size,
      captured_at: new Date().toISOString(),
    }));
    
    // A2.3: Run unified classifier on all uploads
    const classifications = await classifyUploads({
      tenantId,
      contractorProfileId: profile.id,
      media: mediaItems,
      contextHint: context_hint as ContextHint,
      batchSource: source as BatchSource
    });
    
    // Auto-link if enabled (create fleet/tool/jobsite records)
    if (auto_link !== false && auto_link !== 'false') {
      await autoLinkClassifiedUploads(tenantId, profile.id, classifications);
    }
    
    // Audit log
    console.log(`[A2.3 AUDIT] unified_ingestion | tenant=${tenantId} | contractor_profile=${profile.id} | count=${classifications.length} | source=${source} | actor=${userId} | occurred_at=${new Date().toISOString()}`);
    
    return res.json({
      ok: true,
      count: classifications.length,
      classifications: classifications.map(c => ({
        ingestionId: c.ingestionId,
        classification: c.classification,
        extractedEntities: c.extractedEntities,
        geoInference: c.geoInference,
        proposedLinks: c.proposedLinks,
        nextActions: c.nextActions
      }))
    });
  } catch (error) {
    console.error('[A2.3] Error in unified ingestion:', error);
    return res.status(500).json({ ok: false, error: 'Failed to process uploads' });
  }
});

/**
 * GET /api/contractor/ingestions/:id
 * Get a single ingestion record (scoped to contractor)
 */
router.get('/:id', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');
  
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
router.post('/:id/confirm', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
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
router.post('/:id/discard', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
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
router.get('/', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');
  
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

// ============================================================================
// A2.3: Fleet Asset Endpoints
// ============================================================================

/**
 * GET /api/contractor/ingestions/fleet
 * List all fleet assets for current contractor
 */
router.get('/fleet', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const fleet = await db.query.ccContractorFleet.findMany({
      where: and(
        eq(ccContractorFleet.contractorProfileId, profile.id),
        eq(ccContractorFleet.isActive, true)
      )
    });
    
    return res.json({ ok: true, fleet });
  } catch (error) {
    console.error('[A2.3] Error listing fleet:', error);
    return res.status(500).json({ ok: false, error: 'Failed to list fleet' });
  }
});

/**
 * POST /api/contractor/ingestions/fleet/:id/confirm
 * Confirm a fleet asset with optional updates
 */
router.post('/fleet/:id/confirm', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { id } = req.params;
    const updates = req.body;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const [updated] = await db.update(ccContractorFleet)
      .set({
        ...updates,
        isConfirmed: true,
        confirmedAt: new Date()
      })
      .where(and(
        eq(ccContractorFleet.id, id),
        eq(ccContractorFleet.contractorProfileId, profile.id)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Fleet asset not found' });
    }
    
    return res.json({ ok: true, fleet: updated });
  } catch (error) {
    console.error('[A2.3] Error confirming fleet:', error);
    return res.status(500).json({ ok: false, error: 'Failed to confirm fleet asset' });
  }
});

// ============================================================================
// A2.3: Jobsite Endpoints
// ============================================================================

/**
 * GET /api/contractor/ingestions/jobsites
 * List all jobsites for current contractor
 */
router.get('/jobsites', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const jobsites = await db.query.ccContractorJobsites.findMany({
      where: and(
        eq(ccContractorJobsites.contractorProfileId, profile.id),
        eq(ccContractorJobsites.isActive, true)
      )
    });
    
    return res.json({ ok: true, jobsites });
  } catch (error) {
    console.error('[A2.3] Error listing jobsites:', error);
    return res.status(500).json({ ok: false, error: 'Failed to list jobsites' });
  }
});

/**
 * POST /api/contractor/ingestions/jobsites/:id/confirm
 * Confirm a jobsite with optional address updates
 */
router.post('/jobsites/:id/confirm', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { id } = req.params;
    const { confirmed_address } = req.body;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const [updated] = await db.update(ccContractorJobsites)
      .set({
        confirmedAddress: confirmed_address,
        isConfirmed: true,
        confirmedAt: new Date()
      })
      .where(and(
        eq(ccContractorJobsites.id, id),
        eq(ccContractorJobsites.contractorProfileId, profile.id)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Jobsite not found' });
    }
    
    return res.json({ ok: true, jobsite: updated });
  } catch (error) {
    console.error('[A2.3] Error confirming jobsite:', error);
    return res.status(500).json({ ok: false, error: 'Failed to confirm jobsite' });
  }
});

// ============================================================================
// A2.3 / Patent CC-11: Opportunity Endpoints
// ============================================================================

/**
 * GET /api/contractor/ingestions/opportunities
 * Get pending opportunities for current contractor
 */
router.get('/opportunities', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const opportunities = await db.query.ccContractorOpportunities.findMany({
      where: and(
        eq(ccContractorOpportunities.contractorProfileId, profile.id),
        eq(ccContractorOpportunities.status, 'proposed')
      ),
      orderBy: [desc(ccContractorOpportunities.createdAt)]
    });
    
    return res.json({ ok: true, opportunities });
  } catch (error) {
    console.error('[CC-11] Error listing opportunities:', error);
    return res.status(500).json({ ok: false, error: 'Failed to list opportunities' });
  }
});

/**
 * POST /api/contractor/ingestions/opportunities/infer
 * Trigger opportunity inference for current contractor
 */
router.post('/opportunities/infer', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !portalId || !tenantId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    // Run opportunity inference
    const result = await inferOpportunities(tenantId, profile.id);
    
    // Store new opportunities
    const stored = await storeOpportunities(tenantId, profile.id, result.opportunities);
    
    console.log(`[CC-11 AUDIT] opportunities_inferred | tenant=${tenantId} | contractor=${profile.id} | count=${stored.length} | actor=${userId}`);
    
    return res.json({
      ok: true,
      ...result,
      storedCount: stored.length
    });
  } catch (error) {
    console.error('[CC-11] Error inferring opportunities:', error);
    return res.status(500).json({ ok: false, error: 'Failed to infer opportunities' });
  }
});

/**
 * POST /api/contractor/ingestions/opportunities/:id/respond
 * Accept or dismiss an opportunity
 */
router.post('/opportunities/:id/respond', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { id } = req.params;
    const { response } = req.body; // 'accepted' | 'dismissed'
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    if (!['accepted', 'dismissed'].includes(response)) {
      return res.status(400).json({ ok: false, error: 'Invalid response. Must be: accepted or dismissed' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const [updated] = await db.update(ccContractorOpportunities)
      .set({
        status: response,
        respondedAt: new Date()
      })
      .where(and(
        eq(ccContractorOpportunities.id, id),
        eq(ccContractorOpportunities.contractorProfileId, profile.id)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Opportunity not found' });
    }
    
    return res.json({ ok: true, opportunity: updated });
  } catch (error) {
    console.error('[CC-11] Error responding to opportunity:', error);
    return res.status(500).json({ ok: false, error: 'Failed to respond to opportunity' });
  }
});

// ============================================================================
// A2.3: Customers Endpoints
// ============================================================================

/**
 * GET /api/contractor/ingestions/customers
 * List draft customers for current contractor
 */
router.get('/customers', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const customers = await db.query.ccContractorCustomers.findMany({
      where: and(
        eq(ccContractorCustomers.contractorProfileId, profile.id),
        eq(ccContractorCustomers.isActive, true)
      )
    });
    
    return res.json({ ok: true, customers });
  } catch (error) {
    console.error('[A2.3] Error listing customers:', error);
    return res.status(500).json({ ok: false, error: 'Failed to list customers' });
  }
});

/**
 * POST /api/contractor/ingestions/customers/:id/confirm
 * Confirm a draft customer with optional updates
 */
router.post('/customers/:id/confirm', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { id } = req.params;
    const updates = req.body;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    const [updated] = await db.update(ccContractorCustomers)
      .set({
        ...updates,
        isConfirmed: true,
        confirmedAt: new Date()
      })
      .where(and(
        eq(ccContractorCustomers.id, id),
        eq(ccContractorCustomers.contractorProfileId, profile.id)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }
    
    return res.json({ ok: true, customer: updated });
  } catch (error) {
    console.error('[A2.3] Error confirming customer:', error);
    return res.status(500).json({ ok: false, error: 'Failed to confirm customer' });
  }
});

// ============================================================================
// Message Thread Auto-Creation (A2.3 Extension)
// ============================================================================

/**
 * POST /api/contractor/ingestions/:ingestionId/create-thread
 * Create a message thread from a classified sticky note/whiteboard
 * 
 * This accepts the proposed message and creates the actual conversation.
 * Privacy-first: User must explicitly accept to create the thread.
 */
router.post('/:ingestionId/create-thread', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');
  
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { ingestionId } = req.params;
    const { proposedMessage, customerId, jobsiteId } = req.body;
    
    if (!userId || !portalId) {
      return res.status(400).json({ ok: false, error: 'Missing required headers' });
    }
    
    if (!proposedMessage) {
      return res.status(400).json({ ok: false, error: 'Missing proposed message' });
    }
    
    const profile = await getContractorProfile(userId, portalId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Contractor profile not found' });
    }
    
    // Verify the ingestion belongs to this contractor
    const [ingestion] = await db.select()
      .from(ccAiIngestions)
      .where(and(
        eq(ccAiIngestions.id, ingestionId),
        eq(ccAiIngestions.contractorProfileId, profile.id)
      ))
      .limit(1);
    
    if (!ingestion) {
      return res.status(404).json({ ok: false, error: 'Ingestion not found' });
    }
    
    // Create the thread as a pending proposal
    // The actual thread would be created in the P2 conversations system
    // For now, we store the proposal metadata on the ingestion
    const proposedActions = Array.isArray(ingestion.proposedActions) 
      ? ingestion.proposedActions 
      : [];
    
    const updatedActions = proposedActions.map((action: any) => {
      if (action.type === 'open_message_thread') {
        return {
          ...action,
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
          threadData: {
            message: proposedMessage,
            customerId,
            jobsiteId,
            createdBy: userId
          }
        };
      }
      return action;
    });
    
    // Update the ingestion with accepted action
    await db.update(ccAiIngestions)
      .set({
        proposedActions: updatedActions,
        updatedAt: new Date()
      })
      .where(eq(ccAiIngestions.id, ingestionId));
    
    // Return success with thread proposal details
    // In production, this would actually create the work request + conversation
    return res.json({
      ok: true,
      threadProposal: {
        ingestionId,
        message: proposedMessage,
        customerId,
        jobsiteId,
        status: 'pending_work_request',
        nextStep: 'Create work request to enable messaging'
      }
    });
  } catch (error) {
    console.error('[A2.3] Error creating message thread:', error);
    return res.status(500).json({ ok: false, error: 'Failed to create message thread' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  uploadMedia,
  getPresignedUploadUrl,
  completePresignedUpload,
  getMediaForEntity,
  getMediaById,
  deleteMedia,
  isR2Configured,
} from '../services/mediaService.js';
import { requireAuth } from '../middleware/guards.js';
import type { TenantRequest } from '../middleware/tenantContext.js';

// Helper to get tenant ID from request context
function getTenantId(req: Request): string | null {
  return (req as TenantRequest).ctx?.tenant_id || null;
}

// Helper to get actor ID from request context
function getActorId(req: Request): string | null {
  return (req as TenantRequest).ctx?.individual_id || null;
}

const router = Router();

// Configure multer for memory storage (files processed in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Request schemas
const uploadQuerySchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  role: z.string().optional(),
  alt_text: z.string().optional(),
  purpose: z.string().optional(),
});

const presignSchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
});

const completeUploadSchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  role: z.string().optional(),
  alt_text: z.string().optional(),
});

// Check if R2 is configured
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: isR2Configured(),
    provider: 'cloudflare-r2',
  });
});

// POST /api/cc_media/upload - Direct file upload
router.post('/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const actorId = getActorId(req);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }
    
    const parsed = uploadQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid parameters', details: parsed.error.errors });
    }
    
    const { entity_type, entity_id, role, alt_text, purpose } = parsed.data;
    
    const result = await uploadMedia(
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      },
      {
        tenantId,
        entityType: entity_type,
        entityId: entity_id,
        role,
        altText: alt_text,
        purpose,
        uploadedBy: actorId || undefined,
      }
    );
    
    return res.status(201).json({
      success: true,
      cc_media: result,
    });
  } catch (error: any) {
    console.error('[Media] Upload error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Upload failed' });
  }
});

// POST /api/cc_media/presign - Get presigned URL for direct browser upload
router.post('/presign', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const parsed = presignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid parameters', details: parsed.error.errors });
    }
    
    const { filename, content_type, entity_type, entity_id } = parsed.data;
    
    const result = await getPresignedUploadUrl(
      tenantId,
      filename,
      content_type,
      entity_type,
      entity_id
    );
    
    return res.json({
      success: true,
      upload_url: result.uploadUrl,
      media_id: result.mediaId,
      public_url: result.publicUrl,
    });
  } catch (error: any) {
    console.error('[Media] Presign error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to generate presigned URL' });
  }
});

// POST /api/cc_media/:id/complete - Complete presigned upload
router.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const parsed = completeUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid parameters', details: parsed.error.errors });
    }
    
    await completePresignedUpload(id, tenantId, {
      entityType: parsed.data.entity_type,
      entityId: parsed.data.entity_id,
      role: parsed.data.role,
      altText: parsed.data.alt_text,
    });
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Media] Complete upload error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to complete upload' });
  }
});

// GET /api/cc_media/:id - Get single cc_media item
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const cc_media = await getMediaById(id);
    
    if (!cc_media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    
    return res.json({ success: true, cc_media });
  } catch (error: any) {
    console.error('[Media] Get error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get cc_media' });
  }
});

// GET /api/cc_media/entity/:type/:id - Get cc_media for an entity
router.get('/entity/:type/:entityId', async (req: Request, res: Response) => {
  try {
    const { type, entityId } = req.params;
    const { role } = req.query;
    
    const cc_media = await getMediaForEntity(type, entityId, role as string | undefined);
    
    return res.json({
      success: true,
      cc_media,
      count: cc_media.length,
    });
  } catch (error: any) {
    console.error('[Media] Get entity cc_media error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get cc_media' });
  }
});

// DELETE /api/cc_media/:id - Delete cc_media
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    await deleteMedia(id, tenantId);
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Media] Delete error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete cc_media' });
  }
});

export default router;

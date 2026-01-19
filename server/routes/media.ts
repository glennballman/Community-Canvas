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
import { pool } from '../db.js';

// Helper to get tenant ID from request context
function getTenantId(req: Request): string | null {
  return (req as TenantRequest).ctx?.tenant_id || null;
}

// Helper to get actor ID from request context
function getActorId(req: Request): string | null {
  return (req as TenantRequest).ctx?.individual_id || null;
}

// Helper to get portal ID from request context
function getPortalId(req: Request): string | null {
  return (req as TenantRequest).ctx?.portal_id || null;
}

// Helper to get user ID from request context
function getUserId(req: Request): string | null {
  return (req as TenantRequest).user?.id || null;
}

// Check if user can modify media for an entity (entity-specific permission checks)
async function canModifyEntityMedia(
  tenantId: string, 
  entityType?: string, 
  entityId?: string,
  portalId?: string | null,
  userId?: string | null
): Promise<{ allowed: boolean; error?: string }> {
  if (!entityType || !entityId) {
    return { allowed: true };
  }
  
  if (entityType === 'bid') {
    try {
      const partyResult = await pool.query(
        `SELECT id FROM cc_parties WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [tenantId]
      );
      const partyId = partyResult.rows[0]?.id;
      if (!partyId) {
        return { allowed: false, error: 'No party profile found for tenant' };
      }
      
      const bidResult = await pool.query(
        `SELECT id FROM cc_bids WHERE id = $1::uuid AND party_id = $2`,
        [entityId, partyId]
      );
      if (bidResult.rows.length === 0) {
        return { allowed: false, error: 'You do not have permission to modify this bid' };
      }
    } catch (error) {
      console.error('[Media] Bid permission check error:', error);
      return { allowed: false, error: 'Failed to verify bid ownership' };
    }
  }
  
  if (entityType === 'surface_task') {
    try {
      const taskResult = await pool.query(
        `SELECT id, portal_id, tenant_id, assigned_to_user_id FROM cc_surface_tasks WHERE id = $1::uuid`,
        [entityId]
      );
      if (taskResult.rows.length === 0) {
        return { allowed: false, error: 'Task not found' };
      }
      const task = taskResult.rows[0];
      
      // Task must belong to current tenant (required tenant scoping)
      if (task.tenant_id !== tenantId) {
        return { allowed: false, error: 'Task does not belong to your tenant' };
      }
      
      // Check assigned user first (most common case for housekeeping crew)
      const isAssignedUser = userId && task.assigned_to_user_id === userId;
      if (isAssignedUser) {
        return { allowed: true };
      }
      
      // Check if user is a portal admin/owner for the task's portal
      if (userId && task.portal_id) {
        const portalMemberResult = await pool.query(
          `SELECT role FROM cc_portal_members WHERE portal_id = $1 AND individual_id = (
            SELECT id FROM cc_tenant_individuals WHERE user_id = $2 AND tenant_id = $3 LIMIT 1
          ) AND is_active = true`,
          [task.portal_id, userId, tenantId]
        );
        const portalRole = portalMemberResult.rows[0]?.role;
        if (portalRole === 'owner' || portalRole === 'admin') {
          return { allowed: true };
        }
      }
      
      // Check if user is tenant admin/owner (query cc_tenant_users)
      if (userId) {
        const membershipResult = await pool.query(
          `SELECT role FROM cc_tenant_users WHERE tenant_id = $1 AND user_id = $2`,
          [tenantId, userId]
        );
        const memberRole = membershipResult.rows[0]?.role;
        if (memberRole === 'owner' || memberRole === 'admin') {
          return { allowed: true };
        }
      }
      
      return { allowed: false, error: 'You do not have permission to modify this task' };
    } catch (error) {
      console.error('[Media] Surface task permission check error:', error);
      return { allowed: false, error: 'Failed to verify task ownership' };
    }
  }
  
  return { allowed: true };
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
    const portalId = getPortalId(req);
    const userId = getUserId(req);
    
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
    
    const permCheck = await canModifyEntityMedia(tenantId, entity_type, entity_id, portalId, userId);
    if (!permCheck.allowed) {
      return res.status(403).json({ success: false, error: permCheck.error });
    }
    
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
    const portalId = getPortalId(req);
    const userId = getUserId(req);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const parsed = presignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid parameters', details: parsed.error.errors });
    }
    
    const { filename, content_type, entity_type, entity_id } = parsed.data;
    
    const permCheck = await canModifyEntityMedia(tenantId, entity_type, entity_id, portalId, userId);
    if (!permCheck.allowed) {
      return res.status(403).json({ success: false, error: permCheck.error });
    }
    
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
    const portalId = getPortalId(req);
    const userId = getUserId(req);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant context required' });
    }
    
    const media = await getMediaById(id);
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    
    const permCheck = await canModifyEntityMedia(tenantId, media.entity_type || undefined, media.entity_id || undefined, portalId, userId);
    if (!permCheck.allowed) {
      return res.status(403).json({ success: false, error: permCheck.error });
    }
    
    await deleteMedia(id, tenantId);
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Media] Delete error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete cc_media' });
  }
});

export default router;

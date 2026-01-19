/**
 * P-UI-11 SurfaceOps API
 * 
 * Operator-ready workflows:
 * - Housekeeping task management
 * - Media attachment management
 * - Incident console with ledger links
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccSurfaceTasks,
  ccHousekeepingRates,
  ccMediaAssets,
  ccRefundIncidents,
  ccFolioLedgerLinks,
  ccFolioLedger,
  ccSurfaceUnits,
  ccSurfaceClaims,
  ccTripPartyProfiles,
  ccSurfaceContainerMembers,
  ccSurfaceContainers,
} from '@shared/schema';
import { eq, and, sql, inArray, desc, isNotNull } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ============================================
// HOUSEKEEPING TASKS
// ============================================

/**
 * GET /api/p2/app/ops/tasks
 * List housekeeping tasks with optional filters
 */
router.get('/tasks', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const { status, assignedTo, unitId } = req.query;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    let query = db
      .select({
        task: ccSurfaceTasks,
        unit: ccSurfaceUnits,
      })
      .from(ccSurfaceTasks)
      .leftJoin(ccSurfaceUnits, eq(ccSurfaceTasks.surfaceUnitId, ccSurfaceUnits.id))
      .where(eq(ccSurfaceTasks.portalId, portalId))
      .orderBy(desc(ccSurfaceTasks.createdAt));
    
    const tasks = await query;
    
    let filteredTasks = tasks;
    if (status && typeof status === 'string') {
      filteredTasks = filteredTasks.filter(t => t.task.status === status);
    }
    if (assignedTo && typeof assignedTo === 'string') {
      filteredTasks = filteredTasks.filter(t => t.task.assignedToUserId === assignedTo);
    }
    if (unitId && typeof unitId === 'string') {
      filteredTasks = filteredTasks.filter(t => t.task.surfaceUnitId === unitId);
    }
    
    const result = await Promise.all(filteredTasks.map(async ({ task, unit }) => {
      let containerPath: string[] = [];
      if (unit?.surfaceId) {
        const member = await db.query.ccSurfaceContainerMembers.findFirst({
          where: eq(ccSurfaceContainerMembers.surfaceId, unit.surfaceId),
        });
        if (member?.containerId) {
          let nextId: string | null = member.containerId;
          while (nextId) {
            const containerId = nextId;
            const foundContainer = await db.query.ccSurfaceContainers.findFirst({
              where: eq(ccSurfaceContainers.id, containerId),
            });
            if (!foundContainer) break;
            containerPath.unshift(foundContainer.title || foundContainer.containerType || 'Container');
            nextId = foundContainer.parentContainerId;
          }
        }
      }
      
      const metadata = task.metadata as Record<string, unknown> || {};
      
      return {
        id: task.id,
        unit_id: task.surfaceUnitId,
        task_type: task.taskType,
        status: task.status,
        priority: (metadata.priority as number) || 3,
        notes: task.notes,
        assigned_to: task.assignedToUserId,
        scheduled_for: task.dueAt?.toISOString() || null,
        started_at: null,
        completed_at: task.completedAt?.toISOString() || null,
        created_at: task.createdAt.toISOString(),
        unit_label: unit?.label || null,
        container_path: containerPath,
      };
    }));
    
    res.json({ ok: true, tasks: result });
  } catch (error) {
    console.error('[Ops] GET /tasks error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/p2/app/ops/tasks/:taskId
 * Get single task detail
 */
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await db.query.ccSurfaceTasks.findFirst({
      where: eq(ccSurfaceTasks.id, taskId),
    });
    
    if (!task) {
      return res.status(404).json({ ok: false, error: 'Task not found' });
    }
    
    const unit = await db.query.ccSurfaceUnits.findFirst({
      where: eq(ccSurfaceUnits.id, task.surfaceUnitId),
    });
    
    let containerPath: string[] = [];
    if (unit?.surfaceId) {
      const member = await db.query.ccSurfaceContainerMembers.findFirst({
        where: eq(ccSurfaceContainerMembers.surfaceId, unit.surfaceId),
      });
      
      if (member?.containerId) {
        let nextId: string | null = member.containerId;
        while (nextId) {
          const containerId = nextId;
          const foundContainer = await db.query.ccSurfaceContainers.findFirst({
            where: eq(ccSurfaceContainers.id, containerId),
          });
          if (!foundContainer) break;
          containerPath.unshift(foundContainer.title || foundContainer.containerType || 'Container');
          nextId = foundContainer.parentContainerId;
        }
      }
    }
    
    const metadata = task.metadata as Record<string, unknown> || {};
    
    res.json({
      ok: true,
      task: {
        id: task.id,
        unit_id: task.surfaceUnitId,
        task_type: task.taskType,
        status: task.status,
        priority: (metadata.priority as number) || 3,
        notes: task.notes,
        assigned_to: task.assignedToUserId,
        scheduled_for: task.dueAt?.toISOString() || null,
        started_at: null,
        completed_at: task.completedAt?.toISOString() || null,
        created_at: task.createdAt.toISOString(),
        unit_label: unit?.label || null,
        container_path: containerPath,
      },
    });
  } catch (error) {
    console.error('[Ops] GET /tasks/:taskId error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch task' });
  }
});

/**
 * POST /api/p2/app/ops/tasks
 * Create a new housekeeping task
 */
router.post('/tasks', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    const schema = z.object({
      surface_unit_id: z.string().uuid(),
      task_type: z.enum(['clean', 'setup', 'inspect', 'repair']),
      assigned_to_user_id: z.string().uuid().optional(),
      due_at: z.string().datetime().optional(),
      notes: z.string().optional(),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.issues });
    }
    
    const { surface_unit_id, task_type, assigned_to_user_id, due_at, notes } = parsed.data;
    
    const [task] = await db.insert(ccSurfaceTasks).values({
      portalId,
      tenantId: tenantId || null,
      surfaceUnitId: surface_unit_id,
      taskType: task_type,
      status: 'open',
      assignedToUserId: assigned_to_user_id || null,
      dueAt: due_at ? new Date(due_at) : null,
      notes: notes || null,
    }).returning();
    
    res.json({
      ok: true,
      task_id: task.id,
    });
  } catch (error) {
    console.error('[Ops] POST /tasks error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create task' });
  }
});

/**
 * PATCH /api/p2/app/ops/tasks/:taskId
 * Update task status, assignment, or notes
 */
router.patch('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const schema = z.object({
      status: z.enum(['open', 'in_progress', 'done', 'canceled']).optional(),
      assigned_to_user_id: z.string().uuid().nullable().optional(),
      notes: z.string().optional(),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.issues });
    }
    
    const updates: Partial<typeof ccSurfaceTasks.$inferInsert> = {};
    
    if (parsed.data.status !== undefined) {
      updates.status = parsed.data.status;
      if (parsed.data.status === 'done') {
        updates.completedAt = new Date();
      }
    }
    if (parsed.data.assigned_to_user_id !== undefined) {
      updates.assignedToUserId = parsed.data.assigned_to_user_id;
    }
    if (parsed.data.notes !== undefined) {
      updates.notes = parsed.data.notes;
    }
    
    const [updated] = await db
      .update(ccSurfaceTasks)
      .set(updates)
      .where(eq(ccSurfaceTasks.id, taskId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Task not found' });
    }
    
    res.json({
      ok: true,
      task: {
        id: updated.id,
        status: updated.status,
        completed_at: updated.completedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[Ops] PATCH /tasks/:taskId error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update task' });
  }
});

/**
 * GET /api/p2/app/ops/tasks/summary
 * Get task completion summary by staff
 */
router.get('/tasks/summary', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const { date } = req.query;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const completedTasks = await db
      .select({
        assignedToUserId: ccSurfaceTasks.assignedToUserId,
        count: sql<number>`count(*)::int`,
      })
      .from(ccSurfaceTasks)
      .where(
        and(
          eq(ccSurfaceTasks.portalId, portalId),
          eq(ccSurfaceTasks.status, 'done'),
          sql`${ccSurfaceTasks.completedAt} >= ${startOfDay}`,
          sql`${ccSurfaceTasks.completedAt} <= ${endOfDay}`
        )
      )
      .groupBy(ccSurfaceTasks.assignedToUserId);
    
    res.json({
      ok: true,
      date: targetDate.toISOString().split('T')[0],
      summary: completedTasks.map(s => ({
        user_id: s.assignedToUserId,
        completed_count: s.count,
      })),
    });
  } catch (error) {
    console.error('[Ops] GET /tasks/summary error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch summary' });
  }
});

// ============================================
// MEDIA ASSETS
// ============================================

/**
 * GET /api/p2/app/ops/media
 * List media for a target
 */
router.get('/media', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const { target_type, target_id } = req.query;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    if (!target_type || !target_id) {
      return res.status(400).json({ ok: false, error: 'target_type and target_id required' });
    }
    
    const media = await db
      .select()
      .from(ccMediaAssets)
      .where(
        and(
          eq(ccMediaAssets.portalId, portalId),
          eq(ccMediaAssets.targetType, target_type as string),
          eq(ccMediaAssets.targetId, target_id as string)
        )
      )
      .orderBy(ccMediaAssets.sortOrder);
    
    res.json({
      ok: true,
      media: media.map(m => ({
        id: m.id,
        url: m.url,
        caption: m.caption,
        media_type: m.mediaType,
        sort_order: m.sortOrder,
        created_at: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Ops] GET /media error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch media' });
  }
});

/**
 * POST /api/p2/app/ops/media
 * Attach media URL to a target
 */
router.post('/media', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    const schema = z.object({
      target_type: z.enum(['container', 'surface', 'unit']),
      target_id: z.string().uuid(),
      url: z.string().url(),
      caption: z.string().optional(),
      media_type: z.enum(['photo', 'document', 'video']).default('photo'),
      sort_order: z.number().int().default(0),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request', details: parsed.error.issues });
    }
    
    const [asset] = await db.insert(ccMediaAssets).values({
      portalId,
      tenantId: tenantId || null,
      targetType: parsed.data.target_type,
      targetId: parsed.data.target_id,
      url: parsed.data.url,
      caption: parsed.data.caption || null,
      mediaType: parsed.data.media_type,
      sortOrder: parsed.data.sort_order,
    }).returning();
    
    res.json({
      ok: true,
      media_id: asset.id,
    });
  } catch (error) {
    console.error('[Ops] POST /media error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create media' });
  }
});

/**
 * DELETE /api/p2/app/ops/media/:mediaId
 * Remove media attachment
 */
router.delete('/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    
    const [deleted] = await db
      .delete(ccMediaAssets)
      .where(eq(ccMediaAssets.id, mediaId))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Media not found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[Ops] DELETE /media/:mediaId error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete media' });
  }
});

// ============================================
// INCIDENTS
// ============================================

/**
 * GET /api/p2/app/ops/incidents
 * List incidents with optional filters
 */
router.get('/incidents', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const { status, type, limit: limitStr } = req.query;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    const limit = limitStr ? parseInt(limitStr as string, 10) : 50;
    
    let incidents = await db
      .select()
      .from(ccRefundIncidents)
      .where(eq(ccRefundIncidents.portalId, portalId))
      .orderBy(desc(ccRefundIncidents.createdAt))
      .limit(limit);
    
    if (status && typeof status === 'string') {
      incidents = incidents.filter(i => i.status === status);
    }
    if (type && typeof type === 'string') {
      incidents = incidents.filter(i => i.incidentType === type);
    }
    
    res.json({
      ok: true,
      incidents: incidents.map(i => ({
        id: i.id,
        incident_type: i.incidentType,
        status: i.status,
        notes: i.notes,
        occurred_at: i.occurredAt.toISOString(),
        created_at: i.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Ops] GET /incidents error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch incidents' });
  }
});

/**
 * GET /api/p2/app/ops/incidents/:incidentId
 * Get incident detail with linked ledger entries and units
 */
router.get('/incidents/:incidentId', async (req, res) => {
  try {
    const { incidentId } = req.params;
    
    const incident = await db.query.ccRefundIncidents.findFirst({
      where: eq(ccRefundIncidents.id, incidentId),
    });
    
    if (!incident) {
      return res.status(404).json({ ok: false, error: 'Incident not found' });
    }
    
    const ledgerLinks = await db
      .select({
        link: ccFolioLedgerLinks,
        entry: ccFolioLedger,
      })
      .from(ccFolioLedgerLinks)
      .leftJoin(ccFolioLedger, eq(ccFolioLedgerLinks.folioLedgerId, ccFolioLedger.id))
      .where(eq(ccFolioLedgerLinks.incidentId, incidentId));
    
    let linkedUnits: { id: string; unit_type: string; unit_label: string | null }[] = [];
    let participant = null;
    
    const unitLinks = await db
      .select()
      .from(ccFolioLedgerLinks)
      .where(
        and(
          eq(ccFolioLedgerLinks.incidentId, incidentId),
          isNotNull(ccFolioLedgerLinks.surfaceUnitId)
        )
      );
    
    if (unitLinks.length > 0) {
      const unitIds = unitLinks.map(l => l.surfaceUnitId).filter(Boolean) as string[];
      if (unitIds.length > 0) {
        const units = await db
          .select()
          .from(ccSurfaceUnits)
          .where(inArray(ccSurfaceUnits.id, unitIds));
        
        linkedUnits = units.map(u => ({
          id: u.id,
          unit_type: u.unitType,
          unit_label: u.label,
        }));
      }
    }
    
    if (incident.affectedParticipantId) {
      const party = await db.query.ccTripPartyProfiles.findFirst({
        where: eq(ccTripPartyProfiles.id, incident.affectedParticipantId),
      });
      if (party) {
        participant = {
          id: party.id,
          display_name: party.displayName,
          role: party.role,
        };
      }
    }
    
    res.json({
      ok: true,
      incident: {
        id: incident.id,
        incident_type: incident.incidentType,
        status: incident.status,
        notes: incident.notes,
        related_asset: incident.relatedAsset,
        occurred_at: incident.occurredAt.toISOString(),
        created_at: incident.createdAt.toISOString(),
      },
      ledger_entries: ledgerLinks.map(({ link, entry }) => ({
        link_id: link.id,
        entry_id: entry?.id,
        amount_cents: entry?.amountCents,
        entry_type: entry?.entryType,
        description: entry?.description,
      })),
      linked_units: linkedUnits,
      participant,
    });
  } catch (error) {
    console.error('[Ops] GET /incidents/:incidentId error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch incident' });
  }
});

/**
 * PATCH /api/p2/app/ops/incidents/:incidentId
 * Update incident status or resolution
 */
router.patch('/incidents/:incidentId', async (req, res) => {
  try {
    const { incidentId } = req.params;
    
    const schema = z.object({
      status: z.enum(['open', 'processing', 'approved', 'denied']).optional(),
      notes: z.string().optional(),
    });
    
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request' });
    }
    
    const updates: Partial<typeof ccRefundIncidents.$inferInsert> = {};
    
    if (parsed.data.status) {
      updates.status = parsed.data.status as any;
    }
    if (parsed.data.notes !== undefined) {
      updates.notes = parsed.data.notes;
    }
    updates.updatedAt = new Date();
    
    const [updated] = await db
      .update(ccRefundIncidents)
      .set(updates)
      .where(eq(ccRefundIncidents.id, incidentId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Incident not found' });
    }
    
    res.json({
      ok: true,
      incident: {
        id: updated.id,
        status: updated.status,
        updated_at: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Ops] PATCH /incidents/:incidentId error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update incident' });
  }
});

// ============================================
// HOUSEKEEPING RATES
// ============================================

/**
 * GET /api/p2/app/ops/rates
 * Get housekeeping pay rates
 */
router.get('/rates', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required' });
    }
    
    const rates = await db
      .select()
      .from(ccHousekeepingRates)
      .where(eq(ccHousekeepingRates.portalId, portalId));
    
    res.json({
      ok: true,
      rates: rates.map(r => ({
        id: r.id,
        unit_type: r.unitType,
        pay_cents_per_unit: r.payCentsPerUnit,
        currency: r.currency,
      })),
    });
  } catch (error) {
    console.error('[Ops] GET /rates error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch rates' });
  }
});

// ============================================
// DEV SEED ENDPOINT
// ============================================

/**
 * POST /api/p2/app/ops/dev/seed
 * Seed test data for ops development (dev only)
 */
router.post('/dev/seed', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ ok: false, error: 'Not available in production' });
  }
  
  try {
    const taskTypes: Array<'clean' | 'setup' | 'inspect' | 'repair'> = ['clean', 'setup', 'inspect', 'repair'];
    const statuses: Array<'open' | 'in_progress' | 'done'> = ['open', 'in_progress', 'done'];
    
    const units = await db.query.ccSurfaceUnits.findMany({ limit: 10 });
    
    if (units.length === 0) {
      return res.status(400).json({ ok: false, error: 'No units found to create tasks for. Seed surface units first.' });
    }
    
    const portalId = req.headers['x-portal-id'] as string;
    if (!portalId) {
      return res.status(400).json({ ok: false, error: 'Portal ID required in x-portal-id header' });
    }
    
    const seededTasks = [];
    for (let i = 0; i < Math.min(units.length, 8); i++) {
      const unit = units[i];
      const taskType = taskTypes[i % taskTypes.length];
      const status = statuses[i % statuses.length];
      
      const [task] = await db.insert(ccSurfaceTasks).values({
        id: crypto.randomUUID(),
        surfaceUnitId: unit.id,
        portalId,
        tenantId: unit.tenantId,
        taskType,
        status,
        notes: `Sample ${taskType} task for development testing`,
        dueAt: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)),
        createdAt: new Date(),
      }).returning();
      
      seededTasks.push(task);
    }
    
    const seededRates = [];
    const unitTypes = ['standard_room', 'suite', 'cabin', 'campsite'];
    
    for (const unitType of unitTypes) {
      const existing = await db.query.ccHousekeepingRates.findFirst({
        where: and(
          eq(ccHousekeepingRates.portalId, portalId),
          eq(ccHousekeepingRates.unitType, unitType)
        ),
      });
      
      if (!existing) {
        const [rate] = await db.insert(ccHousekeepingRates).values({
          id: crypto.randomUUID(),
          portalId,
          unitType,
          payCentsPerUnit: unitType === 'suite' ? 5000 : unitType === 'cabin' ? 3500 : 2500,
          currency: 'CAD',
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        
        seededRates.push(rate);
      }
    }
    
    res.json({
      ok: true,
      seeded: {
        tasks: seededTasks.length,
        rates: seededRates.length,
      },
    });
  } catch (error) {
    console.error('[Ops] POST /dev/seed error:', error);
    res.status(500).json({ ok: false, error: 'Failed to seed data' });
  }
});

export default router;

import { db } from '../db';
import { eq, and, gte, lte, asc, desc, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { updateUnitStatusInternal } from './pmsService';
import { 
  ccPortals, ccProperties, ccUnits,
  ccHousekeepingTasks, ccMaintenanceRequests, ccHousekeepingChecklists
} from '@shared/schema';

interface CreateTaskRequest {
  portalSlug: string;
  propertyId: string;
  unitId: string;
  taskType: string;
  priority?: string;
  scheduledDate: Date;
  scheduledTime?: string;
  dueBy?: Date;
  checkoutReservationId?: string;
  checkinReservationId?: string;
  guestArrivalTime?: string;
  assignedTo?: string;
  assignedTeam?: string;
  estimatedMinutes?: number;
  specialInstructions?: string;
}

interface CreateMaintenanceRequest {
  portalSlug: string;
  propertyId: string;
  unitId?: string;
  reportedByType?: string;
  reportedByName?: string;
  reportedByContact?: string;
  reservationId?: string;
  housekeepingTaskId?: string;
  category: string;
  priority?: string;
  title: string;
  description?: string;
  locationDetail?: string;
  affectsHabitability?: boolean;
}

function generateTaskNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `HK-${dateStr}-${suffix}`;
}

function generateRequestNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `MR-${dateStr}-${suffix}`;
}

export async function createHousekeepingTask(req: CreateTaskRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const property = await db.query.ccProperties.findFirst({
    where: and(
      eq(ccProperties.id, req.propertyId),
      eq(ccProperties.portalId, portal.id)
    )
  });
  
  if (!property) throw new Error('Property not found');
  
  const unit = await db.query.ccUnits.findFirst({
    where: and(
      eq(ccUnits.id, req.unitId),
      eq(ccUnits.propertyId, req.propertyId)
    )
  });
  
  if (!unit) throw new Error('Unit not found');
  
  let checklistJson: any[] = [];
  const checklists = await db.query.ccHousekeepingChecklists.findMany({
    where: and(
      or(
        eq(ccHousekeepingChecklists.portalId, portal.id),
        eq(ccHousekeepingChecklists.propertyId, req.propertyId)
      ),
      eq(ccHousekeepingChecklists.taskType, req.taskType),
      eq(ccHousekeepingChecklists.status, 'active')
    )
  });
  const checklist = checklists.sort((a, b) => {
    if (a.propertyId && !b.propertyId) return -1;
    if (!a.propertyId && b.propertyId) return 1;
    return 0;
  })[0];
  
  if (checklist) {
    const items = checklist.itemsJson as any[];
    checklistJson = items.map(item => ({ ...item, done: false }));
  }
  
  const taskNumber = generateTaskNumber();
  
  const [task] = await db.insert(ccHousekeepingTasks).values({
    portalId: portal.id,
    propertyId: req.propertyId,
    unitId: req.unitId,
    taskNumber,
    taskType: req.taskType,
    priority: req.priority || 'normal',
    scheduledDate: req.scheduledDate.toISOString().split('T')[0],
    scheduledTime: req.scheduledTime,
    dueBy: req.dueBy,
    checkoutReservationId: req.checkoutReservationId,
    checkinReservationId: req.checkinReservationId,
    guestArrivalTime: req.guestArrivalTime,
    assignedTo: req.assignedTo,
    assignedTeam: req.assignedTeam,
    assignedAt: req.assignedTo ? new Date() : undefined,
    estimatedMinutes: req.estimatedMinutes || checklist?.estimatedMinutes || 60,
    checklistJson,
    specialInstructions: req.specialInstructions,
    status: req.assignedTo ? 'assigned' : 'pending'
  }).returning();
  
  return { task, checklist };
}

export async function getHousekeepingTask(
  portalSlug: string,
  taskId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const task = await db.query.ccHousekeepingTasks.findFirst({
    where: and(
      eq(ccHousekeepingTasks.id, taskId),
      eq(ccHousekeepingTasks.portalId, portal.id)
    )
  });
  
  if (!task) return null;
  
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, task.unitId)
  });
  
  const property = await db.query.ccProperties.findFirst({
    where: eq(ccProperties.id, task.propertyId)
  });
  
  return { task, unit, property };
}

export async function searchHousekeepingTasks(
  portalSlug: string,
  options?: {
    propertyId?: string;
    unitId?: string;
    status?: string;
    assignedTo?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccHousekeepingTasks.portalId, portal.id)];
  
  if (options?.propertyId) {
    conditions.push(eq(ccHousekeepingTasks.propertyId, options.propertyId));
  }
  
  if (options?.unitId) {
    conditions.push(eq(ccHousekeepingTasks.unitId, options.unitId));
  }
  
  if (options?.status) {
    conditions.push(eq(ccHousekeepingTasks.status, options.status));
  }
  
  if (options?.assignedTo) {
    conditions.push(eq(ccHousekeepingTasks.assignedTo, options.assignedTo));
  }
  
  if (options?.dateFrom) {
    conditions.push(gte(ccHousekeepingTasks.scheduledDate, options.dateFrom.toISOString().split('T')[0]));
  }
  
  if (options?.dateTo) {
    conditions.push(lte(ccHousekeepingTasks.scheduledDate, options.dateTo.toISOString().split('T')[0]));
  }
  
  return db.query.ccHousekeepingTasks.findMany({
    where: and(...conditions),
    orderBy: [asc(ccHousekeepingTasks.scheduledDate), asc(ccHousekeepingTasks.scheduledTime)],
    limit: options?.limit || 50
  });
}

export async function assignTask(
  portalSlug: string,
  taskId: string,
  assignedTo: string,
  team?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccHousekeepingTasks)
    .set({
      assignedTo,
      assignedTeam: team,
      assignedAt: new Date(),
      status: 'assigned',
      updatedAt: new Date()
    })
    .where(and(
      eq(ccHousekeepingTasks.id, taskId),
      eq(ccHousekeepingTasks.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function startTask(
  portalSlug: string,
  taskId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const task = await db.query.ccHousekeepingTasks.findFirst({
    where: and(
      eq(ccHousekeepingTasks.id, taskId),
      eq(ccHousekeepingTasks.portalId, portal.id)
    )
  });
  
  if (!task) throw new Error('Task not found');
  
  await updateUnitStatusInternal(task.unitId, undefined, 'in_progress');
  
  const [updated] = await db.update(ccHousekeepingTasks)
    .set({
      status: 'in_progress',
      startedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccHousekeepingTasks.id, taskId))
    .returning();
  
  return updated;
}

export async function updateChecklist(
  portalSlug: string,
  taskId: string,
  checklistJson: any[]
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccHousekeepingTasks)
    .set({
      checklistJson,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccHousekeepingTasks.id, taskId),
      eq(ccHousekeepingTasks.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function completeTask(
  portalSlug: string,
  taskId: string,
  data?: {
    actualMinutes?: number;
    suppliesUsed?: any[];
    notes?: string;
    issuesFound?: string;
    maintenanceNeeded?: boolean;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const task = await db.query.ccHousekeepingTasks.findFirst({
    where: and(
      eq(ccHousekeepingTasks.id, taskId),
      eq(ccHousekeepingTasks.portalId, portal.id)
    )
  });
  
  if (!task) throw new Error('Task not found');
  
  const [updated] = await db.update(ccHousekeepingTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
      actualMinutes: data?.actualMinutes,
      suppliesUsed: data?.suppliesUsed,
      notes: data?.notes,
      issuesFound: data?.issuesFound,
      maintenanceNeeded: data?.maintenanceNeeded || false,
      updatedAt: new Date()
    })
    .where(eq(ccHousekeepingTasks.id, taskId))
    .returning();
  
  if (data?.maintenanceNeeded && data?.issuesFound) {
    await updateUnitStatusInternal(task.unitId, 'maintenance', 'blocked');
    const property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, task.propertyId)
    });
    
    if (property) {
      const maintenanceReq = await createMaintenanceRequest({
        portalSlug,
        propertyId: task.propertyId,
        unitId: task.unitId,
        reportedByType: 'housekeeping',
        housekeepingTaskId: taskId,
        category: 'general',
        priority: 'normal',
        title: 'Issue found during cleaning',
        description: data.issuesFound
      });
      
      await db.update(ccHousekeepingTasks)
        .set({ maintenanceRequestId: maintenanceReq.request.id })
        .where(eq(ccHousekeepingTasks.id, taskId));
    }
  } else {
    await updateUnitStatusInternal(task.unitId, 'available', 'clean');
  }
  
  return updated;
}

export async function inspectTask(
  portalSlug: string,
  taskId: string,
  data: {
    passed: boolean;
    inspectedBy: string;
    notes?: string;
    photos?: string[];
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const task = await db.query.ccHousekeepingTasks.findFirst({
    where: and(
      eq(ccHousekeepingTasks.id, taskId),
      eq(ccHousekeepingTasks.portalId, portal.id)
    )
  });
  
  if (!task) throw new Error('Task not found');
  
  const [updated] = await db.update(ccHousekeepingTasks)
    .set({
      status: data.passed ? 'inspected' : 'failed',
      inspectedBy: data.inspectedBy,
      inspectedAt: new Date(),
      inspectionNotes: data.notes,
      inspectionPhotos: data.photos,
      updatedAt: new Date()
    })
    .where(eq(ccHousekeepingTasks.id, taskId))
    .returning();
  
  if (data.passed) {
    await updateUnitStatusInternal(task.unitId, undefined, 'inspected');
  } else {
    await updateUnitStatusInternal(task.unitId, undefined, 'dirty');
  }
  
  return updated;
}

export async function createMaintenanceRequest(req: CreateMaintenanceRequest): Promise<{
  request: any;
}> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const property = await db.query.ccProperties.findFirst({
    where: and(
      eq(ccProperties.id, req.propertyId),
      eq(ccProperties.portalId, portal.id)
    )
  });
  
  if (!property) throw new Error('Property not found');
  
  if (req.housekeepingTaskId) {
    const housekeepingTask = await db.query.ccHousekeepingTasks.findFirst({
      where: and(
        eq(ccHousekeepingTasks.id, req.housekeepingTaskId),
        eq(ccHousekeepingTasks.portalId, portal.id)
      )
    });
    if (!housekeepingTask) throw new Error('Housekeeping task not found or access denied');
  }
  
  if (req.unitId) {
    const unit = await db.query.ccUnits.findFirst({
      where: and(
        eq(ccUnits.id, req.unitId),
        eq(ccUnits.propertyId, req.propertyId)
      )
    });
    if (!unit) throw new Error('Unit not found or does not belong to property');
  }
  
  const requestNumber = generateRequestNumber();
  
  const [request] = await db.insert(ccMaintenanceRequests).values({
    portalId: portal.id,
    propertyId: req.propertyId,
    unitId: req.unitId,
    reportedByType: req.reportedByType || 'staff',
    reportedByName: req.reportedByName,
    reportedByContact: req.reportedByContact,
    reservationId: req.reservationId,
    housekeepingTaskId: req.housekeepingTaskId,
    requestNumber,
    category: req.category,
    priority: req.priority || 'normal',
    title: req.title,
    description: req.description,
    locationDetail: req.locationDetail,
    affectsHabitability: req.affectsHabitability || false,
    status: 'reported'
  }).returning();
  
  if (req.affectsHabitability && req.unitId) {
    await updateUnitStatusInternal(req.unitId, 'maintenance', 'blocked');
    
    await db.update(ccMaintenanceRequests)
      .set({ unitBlocked: true })
      .where(eq(ccMaintenanceRequests.id, request.id));
  }
  
  return { request };
}

export async function getMaintenanceRequest(
  portalSlug: string,
  requestId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const request = await db.query.ccMaintenanceRequests.findFirst({
    where: and(
      eq(ccMaintenanceRequests.id, requestId),
      eq(ccMaintenanceRequests.portalId, portal.id)
    )
  });
  
  if (!request) return null;
  
  const property = await db.query.ccProperties.findFirst({
    where: eq(ccProperties.id, request.propertyId)
  });
  
  let unit = null;
  if (request.unitId) {
    unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, request.unitId)
    });
  }
  
  return { request, property, unit };
}

export async function searchMaintenanceRequests(
  portalSlug: string,
  options?: {
    propertyId?: string;
    unitId?: string;
    category?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccMaintenanceRequests.portalId, portal.id)];
  
  if (options?.propertyId) {
    conditions.push(eq(ccMaintenanceRequests.propertyId, options.propertyId));
  }
  
  if (options?.unitId) {
    conditions.push(eq(ccMaintenanceRequests.unitId, options.unitId));
  }
  
  if (options?.category) {
    conditions.push(eq(ccMaintenanceRequests.category, options.category));
  }
  
  if (options?.status) {
    conditions.push(eq(ccMaintenanceRequests.status, options.status));
  }
  
  if (options?.priority) {
    conditions.push(eq(ccMaintenanceRequests.priority, options.priority));
  }
  
  if (options?.assignedTo) {
    conditions.push(eq(ccMaintenanceRequests.assignedTo, options.assignedTo));
  }
  
  return db.query.ccMaintenanceRequests.findMany({
    where: and(...conditions),
    orderBy: [
      desc(sql`CASE priority WHEN 'emergency' THEN 5 WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END`),
      asc(ccMaintenanceRequests.createdAt)
    ],
    limit: options?.limit || 50
  });
}

export async function updateMaintenanceStatus(
  portalSlug: string,
  requestId: string,
  status: string,
  data?: {
    assignedTo?: string;
    assignedVendor?: string;
    scheduledDate?: Date;
    workPerformed?: string;
    resolutionNotes?: string;
    laborCost?: number;
    partsCost?: number;
    vendorCost?: number;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date()
  };
  
  if (status === 'triaged') updates.triagedAt = new Date();
  if (status === 'assigned') updates.assignedAt = new Date();
  if (status === 'in_progress') updates.workStartedAt = new Date();
  if (status === 'completed') updates.workCompletedAt = new Date();
  if (status === 'verified') updates.verifiedAt = new Date();
  
  if (data?.assignedTo) updates.assignedTo = data.assignedTo;
  if (data?.assignedVendor) updates.assignedVendor = data.assignedVendor;
  if (data?.scheduledDate) updates.scheduledDate = data.scheduledDate.toISOString().split('T')[0];
  if (data?.workPerformed) updates.workPerformed = data.workPerformed;
  if (data?.resolutionNotes) updates.resolutionNotes = data.resolutionNotes;
  
  if (data?.laborCost !== undefined) updates.laborCostCad = data.laborCost.toString();
  if (data?.partsCost !== undefined) updates.partsCostCad = data.partsCost.toString();
  if (data?.vendorCost !== undefined) updates.vendorCostCad = data.vendorCost.toString();
  
  const request = await db.query.ccMaintenanceRequests.findFirst({
    where: eq(ccMaintenanceRequests.id, requestId)
  });
  
  if (request) {
    const labor = data?.laborCost ?? Number(request.laborCostCad) ?? 0;
    const parts = data?.partsCost ?? Number(request.partsCostCad) ?? 0;
    const vendor = data?.vendorCost ?? Number(request.vendorCostCad) ?? 0;
    updates.totalCostCad = (labor + parts + vendor).toString();
  }
  
  const [updated] = await db.update(ccMaintenanceRequests)
    .set(updates)
    .where(and(
      eq(ccMaintenanceRequests.id, requestId),
      eq(ccMaintenanceRequests.portalId, portal.id)
    ))
    .returning();
  
  if (['completed', 'verified'].includes(status) && updated?.unitBlocked && updated?.unitId) {
    await updateUnitStatusInternal(updated.unitId, 'available', 'dirty');
    
    await db.update(ccMaintenanceRequests)
      .set({ unitBlocked: false, blockedUntil: null })
      .where(eq(ccMaintenanceRequests.id, requestId));
  }
  
  return updated;
}

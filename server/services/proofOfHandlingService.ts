import { db } from '../db';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { 
  ccProofOfHandling, ccHandlingExceptions, ccFreightManifests, 
  ccFreightItems, ccPortals 
} from '@shared/schema';
import { logActivity } from './activityService';
import { markItemDelivered } from './freightService';

// ============ TYPES ============

interface RecordHandlingRequest {
  portalSlug: string;
  manifestId: string;
  itemId?: string;
  locationId?: string;
  handlingType: string;
  handledAt?: Date;
  locationName?: string;
  locationDescription?: string;
  handlerName: string;
  handlerRole?: string;
  handlerCompany?: string;
  recipientName?: string;
  recipientSignature?: string;
  recipientIdType?: string;
  recipientIdNumber?: string;
  condition?: string;
  conditionNotes?: string;
  verifiedWeightLbs?: number;
  photoUrls?: string[];
  documentUrls?: string[];
  notes?: string;
  internalNotes?: string;
  lat?: number;
  lon?: number;
  deviceId?: string;
  appVersion?: string;
}

interface CreateExceptionRequest {
  portalSlug: string;
  manifestId: string;
  itemId?: string;
  proofOfHandlingId?: string;
  exceptionType: string;
  severity?: string;
  description: string;
  photoUrls?: string[];
  claimedAmountCad?: number;
}

// ============ PROOF OF HANDLING FUNCTIONS ============

export async function recordHandling(req: RecordHandlingRequest): Promise<any> {
  if (!req.portalSlug) {
    throw new Error('portalSlug is required');
  }
  
  const [portal] = await db.select()
    .from(ccPortals)
    .where(sql`${ccPortals.slug} = ${req.portalSlug}`)
    .limit(1);
  
  if (!portal) throw new Error('Portal not found');
  
  const [manifest] = await db.select()
    .from(ccFreightManifests)
    .where(sql`${ccFreightManifests.id} = ${req.manifestId}`)
    .limit(1);
  
  if (!manifest) throw new Error('Manifest not found');
  if (manifest.portalId !== portal.id) {
    throw new Error('Manifest does not belong to this portal');
  }
  
  let weightVariance: string | undefined;
  if (req.verifiedWeightLbs && req.itemId) {
    const [item] = await db.select()
      .from(ccFreightItems)
      .where(sql`${ccFreightItems.id} = ${req.itemId}`)
      .limit(1);
    if (item?.weightLbs) {
      weightVariance = String(req.verifiedWeightLbs - Number(item.weightLbs));
    }
  }
  
  const [poh] = await db.insert(ccProofOfHandling).values({
    portalId: portal.id,
    manifestId: req.manifestId,
    itemId: req.itemId,
    locationId: req.locationId,
    handlingType: req.handlingType,
    handledAt: req.handledAt || new Date(),
    locationName: req.locationName,
    locationDescription: req.locationDescription,
    handlerName: req.handlerName,
    handlerRole: req.handlerRole,
    handlerCompany: req.handlerCompany,
    recipientName: req.recipientName,
    recipientSignature: req.recipientSignature,
    recipientIdType: req.recipientIdType,
    recipientIdNumber: req.recipientIdNumber,
    condition: req.condition || 'good',
    conditionNotes: req.conditionNotes,
    verifiedWeightLbs: req.verifiedWeightLbs ? String(req.verifiedWeightLbs) : undefined,
    weightVarianceLbs: weightVariance,
    photoUrls: req.photoUrls,
    documentUrls: req.documentUrls,
    notes: req.notes,
    internalNotes: req.internalNotes,
    lat: req.lat ? String(req.lat) : undefined,
    lon: req.lon ? String(req.lon) : undefined,
    deviceId: req.deviceId,
    appVersion: req.appVersion
  }).returning();
  
  await updateStatusFromHandling(req.manifestId, req.itemId, req.handlingType, req.recipientName, req.notes);
  
  if (req.condition === 'damaged' || req.condition === 'missing_items') {
    await createException({
      portalSlug: req.portalSlug,
      manifestId: req.manifestId,
      itemId: req.itemId,
      proofOfHandlingId: poh.id,
      exceptionType: req.condition === 'damaged' ? 'damage' : 'shortage',
      severity: 'medium',
      description: req.conditionNotes || `${req.condition} reported at ${req.handlingType}`,
      photoUrls: req.photoUrls
    });
  }
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: req.handlerName,
      action: `freight.${req.handlingType}`,
      resourceType: 'proof_of_handling',
      resourceId: poh.id,
      metadata: {
        manifestId: req.manifestId,
        itemId: req.itemId,
        condition: req.condition
      }
    });
  } catch (e) {
  }
  
  return poh;
}

async function updateStatusFromHandling(
  manifestId: string,
  itemId: string | undefined,
  handlingType: string,
  recipientName?: string,
  notes?: string
): Promise<void> {
  if (itemId) {
    const statusMap: Record<string, string> = {
      'pickup': 'pending',
      'received': 'pending',
      'loaded': 'loaded',
      'in_transit': 'in_transit',
      'offloaded': 'offloaded',
      'delivered': 'delivered',
      'returned': 'returned',
      'damaged': 'damaged',
      'held': 'held'
    };
    
    const newStatus = statusMap[handlingType];
    if (newStatus) {
      if (newStatus === 'delivered') {
        await markItemDelivered(itemId, recipientName, notes);
      } else {
        await db.update(ccFreightItems)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(sql`${ccFreightItems.id} = ${itemId}`);
      }
    }
  }
  
  const manifestStatusMap: Record<string, string> = {
    'loaded': 'loaded',
    'in_transit': 'in_transit',
    'offloaded': 'arrived'
  };
  
  const newManifestStatus = manifestStatusMap[handlingType];
  if (newManifestStatus && !itemId) {
    await db.update(ccFreightManifests)
      .set({ status: newManifestStatus, updatedAt: new Date() })
      .where(sql`${ccFreightManifests.id} = ${manifestId}`);
  }
}

export async function getHandlingHistory(
  portalSlug: string,
  manifestId: string,
  itemId?: string
): Promise<any[]> {
  if (!portalSlug) {
    throw new Error('portalSlug is required');
  }
  
  const [portal] = await db.select()
    .from(ccPortals)
    .where(sql`${ccPortals.slug} = ${portalSlug}`)
    .limit(1);
  
  if (!portal) return [];
  
  let whereClause = sql`${ccProofOfHandling.manifestId} = ${manifestId} AND ${ccProofOfHandling.portalId} = ${portal.id}`;
  
  if (itemId) {
    whereClause = sql`${ccProofOfHandling.manifestId} = ${manifestId} AND ${ccProofOfHandling.portalId} = ${portal.id} AND ${ccProofOfHandling.itemId} = ${itemId}`;
  }
  
  return db.select()
    .from(ccProofOfHandling)
    .where(whereClause)
    .orderBy(asc(ccProofOfHandling.handledAt));
}

export async function getChainOfCustody(
  portalSlug: string,
  trackingCode: string
): Promise<{
  item: any;
  manifest: any;
  history: any[];
  exceptions: any[];
} | null> {
  if (!portalSlug) {
    throw new Error('portalSlug is required');
  }
  
  const [item] = await db.select()
    .from(ccFreightItems)
    .where(eq(ccFreightItems.trackingCode, trackingCode))
    .limit(1);
  
  if (!item) return null;
  
  const [manifest] = await db.select()
    .from(ccFreightManifests)
    .where(sql`${ccFreightManifests.id} = ${item.manifestId}`)
    .limit(1);
  
  if (!manifest) return null;
  
  const [portal] = await db.select()
    .from(ccPortals)
    .where(sql`${ccPortals.slug} = ${portalSlug}`)
    .limit(1);
  
  if (!portal || manifest.portalId !== portal.id) return null;
  
  const history = await db.select()
    .from(ccProofOfHandling)
    .where(sql`${ccProofOfHandling.itemId} = ${item.id}`)
    .orderBy(asc(ccProofOfHandling.handledAt));
  
  const exceptions = await db.select()
    .from(ccHandlingExceptions)
    .where(sql`${ccHandlingExceptions.itemId} = ${item.id}`)
    .orderBy(desc(ccHandlingExceptions.createdAt));
  
  return { item, manifest, history, exceptions };
}

// ============ EXCEPTION FUNCTIONS ============

export async function createException(req: CreateExceptionRequest): Promise<any> {
  if (!req.portalSlug) {
    throw new Error('portalSlug is required');
  }
  
  const [portal] = await db.select()
    .from(ccPortals)
    .where(sql`${ccPortals.slug} = ${req.portalSlug}`)
    .limit(1);
  
  if (!portal) throw new Error('Portal not found');
  
  const [exception] = await db.insert(ccHandlingExceptions).values({
    portalId: portal.id,
    manifestId: req.manifestId,
    itemId: req.itemId,
    proofOfHandlingId: req.proofOfHandlingId,
    exceptionType: req.exceptionType,
    severity: req.severity || 'medium',
    description: req.description,
    photoUrls: req.photoUrls,
    claimedAmountCad: req.claimedAmountCad ? String(req.claimedAmountCad) : undefined,
    status: 'open'
  }).returning();
  
  if (req.itemId && ['damage', 'shortage', 'wrong_item'].includes(req.exceptionType)) {
    await db.update(ccFreightItems)
      .set({ status: 'held', updatedAt: new Date() })
      .where(sql`${ccFreightItems.id} = ${req.itemId}`);
  }
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: 'system',
      action: 'freight_exception.created',
      resourceType: 'handling_exception',
      resourceId: exception.id,
      metadata: {
        exceptionType: req.exceptionType,
        severity: req.severity,
        manifestId: req.manifestId
      }
    });
  } catch (e) {
  }
  
  return exception;
}

export async function getExceptions(
  portalSlug: string,
  options?: {
    manifestId?: string;
    status?: string;
    severity?: string;
  }
): Promise<any[]> {
  if (!portalSlug) {
    throw new Error('portalSlug is required');
  }
  
  const [portal] = await db.select()
    .from(ccPortals)
    .where(sql`${ccPortals.slug} = ${portalSlug}`)
    .limit(1);
  
  if (!portal) return [];
  
  let whereClause = sql`${ccHandlingExceptions.portalId} = ${portal.id}`;
  
  if (options?.manifestId) {
    whereClause = sql`${whereClause} AND ${ccHandlingExceptions.manifestId} = ${options.manifestId}`;
  }
  
  if (options?.status) {
    whereClause = sql`${whereClause} AND ${ccHandlingExceptions.status} = ${options.status}`;
  }
  
  if (options?.severity) {
    whereClause = sql`${whereClause} AND ${ccHandlingExceptions.severity} = ${options.severity}`;
  }
  
  return db.select()
    .from(ccHandlingExceptions)
    .where(whereClause)
    .orderBy(
      desc(sql`CASE ${ccHandlingExceptions.severity} WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`),
      desc(ccHandlingExceptions.createdAt)
    );
}

export async function resolveException(
  exceptionId: string,
  resolution: {
    resolutionType: string;
    resolutionNotes?: string;
    resolvedBy: string;
    approvedAmountCad?: number;
  }
): Promise<any> {
  const [updated] = await db.update(ccHandlingExceptions)
    .set({
      status: 'resolved',
      resolutionType: resolution.resolutionType,
      resolutionNotes: resolution.resolutionNotes,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date(),
      approvedAmountCad: resolution.approvedAmountCad ? String(resolution.approvedAmountCad) : undefined,
      updatedAt: new Date()
    })
    .where(sql`${ccHandlingExceptions.id} = ${exceptionId}`)
    .returning();
  
  if (updated?.itemId) {
    await db.update(ccFreightItems)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(sql`${ccFreightItems.id} = ${updated.itemId} AND ${ccFreightItems.status} = 'held'`);
  }
  
  return updated;
}

export async function updateExceptionStatus(
  exceptionId: string,
  status: string
): Promise<any> {
  const [updated] = await db.update(ccHandlingExceptions)
    .set({ status, updatedAt: new Date() })
    .where(sql`${ccHandlingExceptions.id} = ${exceptionId}`)
    .returning();
  
  return updated;
}

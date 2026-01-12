// server/services/freightService.ts

import { db } from '../db';
import { eq, and, gte, lte, asc, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  ccFreightManifests, ccFreightItems, ccPortals, ccTransportOperators 
} from '@shared/schema';

// ============ TYPES ============

interface CreateManifestRequest {
  portalSlug: string;
  operatorId: string;
  sailingId?: string;
  originLocationId?: string;
  destinationLocationId?: string;
  manifestDate: Date;
  scheduledDeparture?: string;
  shipperName?: string;
  shipperPhone?: string;
  shipperEmail?: string;
  shipperBusiness?: string;
  consigneeName?: string;
  consigneePhone?: string;
  consigneeEmail?: string;
  consigneeBusiness?: string;
  consigneeLocationId?: string;
  billingMethod?: string;
  specialInstructions?: string;
}

interface AddItemRequest {
  manifestId: string;
  description: string;
  category?: string;
  quantity?: number;
  weightLbs?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  declaredValueCad?: number;
  insured?: boolean;
  insuranceValueCad?: number;
  specialHandling?: string[];
  handlingInstructions?: string;
}

// ============ HELPERS ============

function generateManifestNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `FRT-${dateStr}-${suffix}`;
}

function generateTrackingCode(): string {
  return `TRK${nanoid(8).toUpperCase()}`;
}

function calculateFreightCharge(weightLbs: number): number {
  const baseCharge = weightLbs * 0.15;
  return Math.max(baseCharge, 15);
}

// ============ MANIFEST FUNCTIONS ============

export async function createManifest(req: CreateManifestRequest): Promise<any> {
  let portalId: string | undefined;
  if (req.portalSlug) {
    const [portal] = await db.select()
      .from(ccPortals)
      .where(sql`${ccPortals.slug} = ${req.portalSlug}`)
      .limit(1);
    if (portal) portalId = portal.id;
  }
  
  const [operator] = await db.select()
    .from(ccTransportOperators)
    .where(sql`${ccTransportOperators.id} = ${req.operatorId}`)
    .limit(1);
  
  if (!operator) throw new Error('Operator not found');
  if (portalId && operator.portalId !== portalId) {
    throw new Error('Operator does not belong to this portal');
  }
  
  const manifestNumber = generateManifestNumber();
  
  const [manifest] = await db.insert(ccFreightManifests).values({
    portalId,
    operatorId: req.operatorId,
    sailingId: req.sailingId,
    manifestNumber,
    originLocationId: req.originLocationId,
    destinationLocationId: req.destinationLocationId,
    manifestDate: req.manifestDate.toISOString().split('T')[0],
    scheduledDeparture: req.scheduledDeparture,
    shipperName: req.shipperName,
    shipperPhone: req.shipperPhone,
    shipperEmail: req.shipperEmail,
    shipperBusiness: req.shipperBusiness,
    consigneeName: req.consigneeName,
    consigneePhone: req.consigneePhone,
    consigneeEmail: req.consigneeEmail,
    consigneeBusiness: req.consigneeBusiness,
    consigneeLocationId: req.consigneeLocationId,
    billingMethod: req.billingMethod || 'prepaid',
    specialInstructions: req.specialInstructions,
    status: 'draft'
  }).returning();
  
  return manifest;
}

export async function getManifest(manifestId: string): Promise<{
  manifest: any;
  items: any[];
} | null> {
  const [manifest] = await db.select()
    .from(ccFreightManifests)
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .limit(1);
  
  if (!manifest) return null;
  
  const items = await db.select()
    .from(ccFreightItems)
    .where(sql`${ccFreightItems.manifestId} = ${manifestId}`)
    .orderBy(asc(ccFreightItems.itemNumber));
  
  return { manifest, items };
}

export async function getManifestByNumber(manifestNumber: string): Promise<{
  manifest: any;
  items: any[];
} | null> {
  const [manifest] = await db.select()
    .from(ccFreightManifests)
    .where(eq(ccFreightManifests.manifestNumber, manifestNumber))
    .limit(1);
  
  if (!manifest) return null;
  
  return getManifest(manifest.id);
}

export async function getManifestsForSailing(sailingId: string): Promise<any[]> {
  return db.select()
    .from(ccFreightManifests)
    .where(sql`${ccFreightManifests.sailingId} = ${sailingId}`)
    .orderBy(asc(ccFreightManifests.createdAt));
}

export async function searchManifests(options: {
  portalSlug?: string;
  operatorId?: string;
  fromDate?: Date;
  toDate?: Date;
  status?: string;
  limit?: number;
}): Promise<any[]> {
  const conditions: any[] = [];
  
  if (options.portalSlug) {
    const [portal] = await db.select()
      .from(ccPortals)
      .where(sql`${ccPortals.slug} = ${options.portalSlug}`)
      .limit(1);
    if (portal) {
      conditions.push(sql`${ccFreightManifests.portalId} = ${portal.id}`);
    }
  }
  
  if (options.operatorId) {
    conditions.push(sql`${ccFreightManifests.operatorId} = ${options.operatorId}`);
  }
  
  if (options.fromDate) {
    conditions.push(sql`${ccFreightManifests.manifestDate} >= ${options.fromDate.toISOString().split('T')[0]}`);
  }
  
  if (options.toDate) {
    conditions.push(sql`${ccFreightManifests.manifestDate} <= ${options.toDate.toISOString().split('T')[0]}`);
  }
  
  if (options.status) {
    conditions.push(sql`${ccFreightManifests.status} = ${options.status}`);
  }
  
  const whereClause = conditions.length > 0 
    ? sql`${sql.join(conditions, sql` AND `)}` 
    : sql`1=1`;
  
  const result = await db.select()
    .from(ccFreightManifests)
    .where(whereClause)
    .orderBy(desc(ccFreightManifests.manifestDate))
    .limit(options.limit || 50);
  
  return result;
}

// ============ ITEM FUNCTIONS ============

export async function addItem(req: AddItemRequest): Promise<any> {
  const existing = await db.select()
    .from(ccFreightItems)
    .where(sql`${ccFreightItems.manifestId} = ${req.manifestId}`);
  
  const itemNumber = existing.length + 1;
  const trackingCode = generateTrackingCode();
  
  const itemCharge = calculateFreightCharge(req.weightLbs || 0);
  
  const [item] = await db.insert(ccFreightItems).values({
    manifestId: req.manifestId,
    itemNumber,
    trackingCode,
    description: req.description,
    category: req.category || 'general',
    quantity: req.quantity || 1,
    weightLbs: req.weightLbs?.toString(),
    lengthIn: req.lengthIn?.toString(),
    widthIn: req.widthIn?.toString(),
    heightIn: req.heightIn?.toString(),
    declaredValueCad: req.declaredValueCad?.toString(),
    insured: req.insured || false,
    insuranceValueCad: req.insuranceValueCad?.toString(),
    specialHandling: req.specialHandling,
    handlingInstructions: req.handlingInstructions,
    itemChargeCad: itemCharge.toString(),
    status: 'pending'
  }).returning();
  
  await updateManifestTotals(req.manifestId);
  
  return item;
}

export async function updateManifestTotals(manifestId: string): Promise<void> {
  const items = await db.select()
    .from(ccFreightItems)
    .where(sql`${ccFreightItems.manifestId} = ${manifestId}`);
  
  let totalItems = 0;
  let totalWeight = 0;
  let totalValue = 0;
  let freightCharges = 0;
  
  for (const item of items) {
    totalItems += item.quantity || 1;
    totalWeight += Number(item.weightLbs) || 0;
    totalValue += Number(item.declaredValueCad) || 0;
    freightCharges += Number(item.itemChargeCad) || 0;
  }
  
  await db.update(ccFreightManifests)
    .set({
      totalItems,
      totalWeightLbs: totalWeight.toString(),
      totalValueCad: totalValue.toString(),
      freightChargesCad: freightCharges.toString(),
      updatedAt: new Date()
    })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`);
}

export async function getItemByTracking(trackingCode: string): Promise<{
  item: any;
  manifest: any;
} | null> {
  const [item] = await db.select()
    .from(ccFreightItems)
    .where(eq(ccFreightItems.trackingCode, trackingCode))
    .limit(1);
  
  if (!item) return null;
  
  const [manifest] = await db.select()
    .from(ccFreightManifests)
    .where(sql`${ccFreightManifests.id} = ${item.manifestId}`)
    .limit(1);
  
  return { item, manifest };
}

// ============ STATUS TRANSITIONS ============

export async function submitManifest(manifestId: string): Promise<any> {
  const [updated] = await db.update(ccFreightManifests)
    .set({ status: 'submitted', updatedAt: new Date() })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .returning();
  
  return updated;
}

export async function acceptManifest(manifestId: string): Promise<any> {
  const [updated] = await db.update(ccFreightManifests)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .returning();
  
  return updated;
}

export async function markManifestLoaded(manifestId: string): Promise<any> {
  await db.update(ccFreightItems)
    .set({ status: 'loaded', loadedAt: new Date(), updatedAt: new Date() })
    .where(sql`${ccFreightItems.manifestId} = ${manifestId}`);
  
  const [updated] = await db.update(ccFreightManifests)
    .set({ status: 'loaded', loadedAt: new Date(), updatedAt: new Date() })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .returning();
  
  return updated;
}

export async function markManifestInTransit(manifestId: string): Promise<any> {
  await db.update(ccFreightItems)
    .set({ status: 'in_transit', updatedAt: new Date() })
    .where(sql`${ccFreightItems.manifestId} = ${manifestId}`);
  
  const [updated] = await db.update(ccFreightManifests)
    .set({ status: 'in_transit', departedAt: new Date(), updatedAt: new Date() })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .returning();
  
  return updated;
}

export async function markManifestArrived(manifestId: string): Promise<any> {
  const [updated] = await db.update(ccFreightManifests)
    .set({ status: 'arrived', arrivedAt: new Date(), updatedAt: new Date() })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .returning();
  
  return updated;
}

export async function markItemDelivered(
  itemId: string,
  receivedBy?: string,
  notes?: string
): Promise<any> {
  const [updated] = await db.update(ccFreightItems)
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
      receivedBy,
      deliveryNotes: notes,
      updatedAt: new Date()
    })
    .where(sql`${ccFreightItems.id} = ${itemId}`)
    .returning();
  
  const [item] = await db.select()
    .from(ccFreightItems)
    .where(sql`${ccFreightItems.id} = ${itemId}`)
    .limit(1);
  
  if (item) {
    const allItems = await db.select()
      .from(ccFreightItems)
      .where(sql`${ccFreightItems.manifestId} = ${item.manifestId}`);
    
    const allDelivered = allItems.every(i => i.status === 'delivered');
    const someDelivered = allItems.some(i => i.status === 'delivered');
    
    if (allDelivered) {
      await db.update(ccFreightManifests)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(sql`${ccFreightManifests.id} = ${item.manifestId}`);
    } else if (someDelivered) {
      await db.update(ccFreightManifests)
        .set({ status: 'partial', updatedAt: new Date() })
        .where(sql`${ccFreightManifests.id} = ${item.manifestId}`);
    }
  }
  
  return updated;
}

export async function cancelManifest(manifestId: string): Promise<any> {
  const [updated] = await db.update(ccFreightManifests)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(sql`${ccFreightManifests.id} = ${manifestId}`)
    .returning();
  
  return updated;
}

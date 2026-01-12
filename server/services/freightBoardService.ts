import { db } from '../db';
import { eq, and, or, sql, desc, asc, inArray } from 'drizzle-orm';
import { 
  ccPortals, ccFreightManifests, ccFreightItems, ccHandlingExceptions,
  ccProofOfHandling, ccLocations, ccSailings, ccTransportOperators
} from '@shared/schema';

interface FreightBoardSummary {
  date: string;
  manifests: {
    total: number;
    byStatus: Record<string, number>;
    draft: number;
    inTransit: number;
    delivered: number;
    exceptions: number;
  };
  items: {
    total: number;
    pending: number;
    loaded: number;
    inTransit: number;
    delivered: number;
    held: number;
  };
  weight: {
    totalLbs: number;
    loadedLbs: number;
    deliveredLbs: number;
  };
  revenue: {
    totalCad: number;
    pendingCad: number;
    collectedCad: number;
  };
  exceptions: {
    open: number;
    critical: number;
    pendingResolution: number;
  };
}

interface ManifestBoardEntry {
  manifestId: string;
  manifestNumber: string;
  status: string;
  manifestDate: string;
  
  shipper: {
    name: string;
    business?: string;
  };
  consignee: {
    name: string;
    business?: string;
  };
  
  route: {
    origin?: string;
    destination?: string;
  };
  
  items: {
    total: number;
    pending: number;
    loaded: number;
    delivered: number;
    held: number;
  };
  
  weight: {
    totalLbs: number;
  };
  
  charges: {
    totalCad: number;
    paymentStatus: string;
  };
  
  exceptions: {
    open: number;
    critical: number;
  };
  
  sailingNumber?: string;
  operatorCode?: string;
  
  lastActivity?: {
    type: string;
    at: Date;
    by: string;
  };
}

function emptyBoardSummary(date: Date): FreightBoardSummary {
  return {
    date: date.toISOString().split('T')[0],
    manifests: { total: 0, byStatus: {}, draft: 0, inTransit: 0, delivered: 0, exceptions: 0 },
    items: { total: 0, pending: 0, loaded: 0, inTransit: 0, delivered: 0, held: 0 },
    weight: { totalLbs: 0, loadedLbs: 0, deliveredLbs: 0 },
    revenue: { totalCad: 0, pendingCad: 0, collectedCad: 0 },
    exceptions: { open: 0, critical: 0, pendingResolution: 0 }
  };
}

export async function getFreightBoardSummary(
  portalSlug: string,
  date?: Date
): Promise<FreightBoardSummary> {
  const [portal] = await db.select()
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) {
    return emptyBoardSummary(date || new Date());
  }
  
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const manifests = await db.select()
    .from(ccFreightManifests)
    .where(and(
      eq(ccFreightManifests.portalId, portal.id),
      sql`${ccFreightManifests.manifestDate}::date = ${dateStr}::date`
    ));
  
  const byStatus: Record<string, number> = {};
  let totalWeight = 0;
  let loadedWeight = 0;
  let deliveredWeight = 0;
  let totalRevenue = 0;
  let pendingRevenue = 0;
  let collectedRevenue = 0;
  
  for (const m of manifests) {
    const status = m.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
    totalWeight += Number(m.totalWeightLbs) || 0;
    totalRevenue += Number(m.freightChargesCad) || 0;
    
    if (['loaded', 'in_transit', 'arrived', 'delivered', 'partial'].includes(status)) {
      loadedWeight += Number(m.totalWeightLbs) || 0;
    }
    if (['delivered'].includes(status)) {
      deliveredWeight += Number(m.totalWeightLbs) || 0;
    }
    if (m.paymentStatus === 'paid') {
      collectedRevenue += Number(m.freightChargesCad) || 0;
    } else {
      pendingRevenue += Number(m.freightChargesCad) || 0;
    }
  }
  
  const manifestIds = manifests.map(m => m.id);
  let items: any[] = [];
  if (manifestIds.length > 0) {
    items = await db.select()
      .from(ccFreightItems)
      .where(inArray(ccFreightItems.manifestId, manifestIds));
  }
  
  const itemsByStatus: Record<string, number> = {};
  for (const item of items) {
    itemsByStatus[item.status] = (itemsByStatus[item.status] || 0) + 1;
  }
  
  const exceptions = await db.select()
    .from(ccHandlingExceptions)
    .where(and(
      eq(ccHandlingExceptions.portalId, portal.id),
      eq(ccHandlingExceptions.status, 'open')
    ));
  
  const criticalExceptions = exceptions.filter(e => e.severity === 'critical').length;
  
  return {
    date: dateStr,
    manifests: {
      total: manifests.length,
      byStatus,
      draft: byStatus['draft'] || 0,
      inTransit: byStatus['in_transit'] || 0,
      delivered: byStatus['delivered'] || 0,
      exceptions: manifests.filter(m => m.status === 'held').length
    },
    items: {
      total: items.length,
      pending: itemsByStatus['pending'] || 0,
      loaded: itemsByStatus['loaded'] || 0,
      inTransit: itemsByStatus['in_transit'] || 0,
      delivered: itemsByStatus['delivered'] || 0,
      held: itemsByStatus['held'] || 0
    },
    weight: {
      totalLbs: totalWeight,
      loadedLbs: loadedWeight,
      deliveredLbs: deliveredWeight
    },
    revenue: {
      totalCad: totalRevenue,
      pendingCad: pendingRevenue,
      collectedCad: collectedRevenue
    },
    exceptions: {
      open: exceptions.length,
      critical: criticalExceptions,
      pendingResolution: exceptions.filter(e => e.status === 'pending_action').length
    }
  };
}

export async function getFreightBoard(
  portalSlug: string,
  options?: {
    date?: Date;
    status?: string;
    operatorId?: string;
    sailingId?: string;
    limit?: number;
  }
): Promise<{
  entries: ManifestBoardEntry[];
  summary: FreightBoardSummary;
}> {
  const [portal] = await db.select()
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) {
    return { entries: [], summary: emptyBoardSummary(options?.date || new Date()) };
  }
  
  const conditions: any[] = [eq(ccFreightManifests.portalId, portal.id)];
  
  if (options?.date) {
    const dateStr = options.date.toISOString().split('T')[0];
    conditions.push(sql`${ccFreightManifests.manifestDate}::date = ${dateStr}::date`);
  }
  
  if (options?.status) {
    conditions.push(eq(ccFreightManifests.status, options.status));
  }
  
  if (options?.operatorId) {
    conditions.push(eq(ccFreightManifests.operatorId, options.operatorId));
  }
  
  if (options?.sailingId) {
    conditions.push(eq(ccFreightManifests.sailingId, options.sailingId));
  }
  
  const manifests = await db.select()
    .from(ccFreightManifests)
    .where(and(...conditions))
    .orderBy(desc(ccFreightManifests.manifestDate), asc(ccFreightManifests.createdAt))
    .limit(options?.limit || 50);
  
  const entries: ManifestBoardEntry[] = [];
  
  for (const manifest of manifests) {
    const items = await db.select()
      .from(ccFreightItems)
      .where(eq(ccFreightItems.manifestId, manifest.id));
    
    const itemsByStatus: Record<string, number> = {};
    for (const item of items) {
      const itemStatus = item.status || 'unknown';
      itemsByStatus[itemStatus] = (itemsByStatus[itemStatus] || 0) + 1;
    }
    
    const exceptions = await db.select()
      .from(ccHandlingExceptions)
      .where(and(
        eq(ccHandlingExceptions.manifestId, manifest.id),
        eq(ccHandlingExceptions.status, 'open')
      ));
    
    const [lastHandling] = await db.select()
      .from(ccProofOfHandling)
      .where(eq(ccProofOfHandling.manifestId, manifest.id))
      .orderBy(desc(ccProofOfHandling.handledAt))
      .limit(1);
    
    let originName: string | undefined;
    let destName: string | undefined;
    
    if (manifest.originLocationId) {
      const [loc] = await db.select()
        .from(ccLocations)
        .where(eq(ccLocations.id, manifest.originLocationId))
        .limit(1);
      originName = loc?.name || undefined;
    }
    
    if (manifest.destinationLocationId) {
      const [loc] = await db.select()
        .from(ccLocations)
        .where(eq(ccLocations.id, manifest.destinationLocationId))
        .limit(1);
      destName = loc?.name || undefined;
    }
    
    let sailingNumber: string | undefined;
    if (manifest.sailingId) {
      const [sailing] = await db.select()
        .from(ccSailings)
        .where(eq(ccSailings.id, manifest.sailingId))
        .limit(1);
      sailingNumber = sailing?.sailingNumber || undefined;
    }
    
    let operatorCode: string | undefined;
    if (manifest.operatorId) {
      const [operator] = await db.select()
        .from(ccTransportOperators)
        .where(eq(ccTransportOperators.id, manifest.operatorId))
        .limit(1);
      operatorCode = operator?.code || undefined;
    }
    
    const manifestDateVal = manifest.manifestDate;
    const manifestDateStr = manifestDateVal && typeof manifestDateVal === 'object' && 'toISOString' in manifestDateVal
      ? (manifestDateVal as Date).toISOString().split('T')[0]
      : String(manifestDateVal || '');
    
    entries.push({
      manifestId: manifest.id,
      manifestNumber: manifest.manifestNumber,
      status: manifest.status || 'unknown',
      manifestDate: manifestDateStr,
      shipper: {
        name: manifest.shipperName || 'Unknown',
        business: manifest.shipperBusiness || undefined
      },
      consignee: {
        name: manifest.consigneeName || 'Unknown',
        business: manifest.consigneeBusiness || undefined
      },
      route: {
        origin: originName,
        destination: destName
      },
      items: {
        total: items.length,
        pending: itemsByStatus['pending'] || 0,
        loaded: itemsByStatus['loaded'] || 0,
        delivered: itemsByStatus['delivered'] || 0,
        held: itemsByStatus['held'] || 0
      },
      weight: {
        totalLbs: Number(manifest.totalWeightLbs) || 0
      },
      charges: {
        totalCad: Number(manifest.freightChargesCad) || 0,
        paymentStatus: manifest.paymentStatus || 'pending'
      },
      exceptions: {
        open: exceptions.length,
        critical: exceptions.filter(e => e.severity === 'critical').length
      },
      sailingNumber,
      operatorCode,
      lastActivity: lastHandling ? {
        type: lastHandling.handlingType,
        at: lastHandling.handledAt,
        by: lastHandling.handlerName
      } : undefined
    });
  }
  
  const summary = await getFreightBoardSummary(portalSlug, options?.date);
  
  return { entries, summary };
}

export async function getPendingPickups(portalSlug: string): Promise<any[]> {
  const [portal] = await db.select()
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return [];
  
  const manifests = await db.select()
    .from(ccFreightManifests)
    .where(and(
      eq(ccFreightManifests.portalId, portal.id),
      or(
        eq(ccFreightManifests.status, 'draft'),
        eq(ccFreightManifests.status, 'submitted'),
        eq(ccFreightManifests.status, 'accepted')
      )
    ))
    .orderBy(asc(ccFreightManifests.manifestDate));
  
  return manifests;
}

export async function getPendingDeliveries(portalSlug: string): Promise<any[]> {
  const [portal] = await db.select()
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return [];
  
  const items = await db.select()
    .from(ccFreightItems)
    .where(eq(ccFreightItems.status, 'offloaded'));
  
  const result: any[] = [];
  for (const item of items) {
    const [manifest] = await db.select()
      .from(ccFreightManifests)
      .where(and(
        eq(ccFreightManifests.id, item.manifestId),
        eq(ccFreightManifests.portalId, portal.id)
      ))
      .limit(1);
    
    if (manifest) {
      result.push({ item, manifest });
    }
  }
  
  return result;
}

export async function getOpenExceptionsBoard(portalSlug: string): Promise<any[]> {
  const [portal] = await db.select()
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return [];
  
  const exceptions = await db.select()
    .from(ccHandlingExceptions)
    .where(and(
      eq(ccHandlingExceptions.portalId, portal.id),
      or(
        eq(ccHandlingExceptions.status, 'open'),
        eq(ccHandlingExceptions.status, 'investigating'),
        eq(ccHandlingExceptions.status, 'pending_action')
      )
    ))
    .orderBy(
      desc(sql`CASE ${ccHandlingExceptions.severity} WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`),
      asc(ccHandlingExceptions.createdAt)
    );
  
  const result: any[] = [];
  for (const exc of exceptions) {
    const [manifest] = await db.select()
      .from(ccFreightManifests)
      .where(eq(ccFreightManifests.id, exc.manifestId))
      .limit(1);
    
    let item = null;
    if (exc.itemId) {
      const [foundItem] = await db.select()
        .from(ccFreightItems)
        .where(eq(ccFreightItems.id, exc.itemId))
        .limit(1);
      item = foundItem;
    }
    
    result.push({
      exception: exc,
      manifest,
      item
    });
  }
  
  return result;
}

export async function getSailingFreightSummary(
  portalSlug: string,
  sailingId: string
): Promise<{
  sailing: any;
  manifests: any[];
  totals: {
    manifestCount: number;
    itemCount: number;
    totalWeightLbs: number;
    totalValueCad: number;
    freightChargesCad: number;
  };
  byStatus: Record<string, number>;
}> {
  const [portal] = await db.select()
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) {
    return {
      sailing: null,
      manifests: [],
      totals: { manifestCount: 0, itemCount: 0, totalWeightLbs: 0, totalValueCad: 0, freightChargesCad: 0 },
      byStatus: {}
    };
  }
  
  const [sailing] = await db.select()
    .from(ccSailings)
    .where(eq(ccSailings.id, sailingId))
    .limit(1);
  
  const manifests = await db.select()
    .from(ccFreightManifests)
    .where(and(
      eq(ccFreightManifests.portalId, portal.id),
      eq(ccFreightManifests.sailingId, sailingId)
    ));
  
  let itemCount = 0;
  let totalWeightLbs = 0;
  let totalValueCad = 0;
  let freightChargesCad = 0;
  const byStatus: Record<string, number> = {};
  
  for (const m of manifests) {
    const status = m.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
    itemCount += m.totalItems || 0;
    totalWeightLbs += Number(m.totalWeightLbs) || 0;
    totalValueCad += Number(m.totalValueCad) || 0;
    freightChargesCad += Number(m.freightChargesCad) || 0;
  }
  
  return {
    sailing,
    manifests,
    totals: {
      manifestCount: manifests.length,
      itemCount,
      totalWeightLbs,
      totalValueCad,
      freightChargesCad
    },
    byStatus
  };
}

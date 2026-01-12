import { db } from '../db';
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { ccTerritoryNotices, ccCulturalSites, ccPortals, ccAuthorities } from '@shared/schema';

// ============ TYPES ============

interface CreateNoticeRequest {
  portalSlug: string;
  authorityCode: string;
  tripId?: string;
  
  visitorName: string;
  visitorEmail?: string;
  visitorPhone?: string;
  partySize?: number;
  partyMembers?: string[];
  
  visitPurpose: string;
  visitDescription?: string;
  
  entryDate: Date;
  exitDate?: Date;
  entryPoint?: string;
  plannedAreas?: string[];
  
  vesselName?: string;
  vesselType?: string;
  vesselRegistration?: string;
  
  visitorNotes?: string;
}

interface AcknowledgmentData {
  territoryAcknowledged: boolean;
  culturalRespectAgreed: boolean;
  leaveNoTraceAgreed: boolean;
  sacredSitesRespect: boolean;
}

// ============ HELPERS ============

function generateNoticeNumber(nationCode: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `TAN-${nationCode}-${dateStr}-${suffix}`;
}

// ============ NOTICE FUNCTIONS ============

export async function createTerritoryNotice(req: CreateNoticeRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: and(
      eq(ccAuthorities.portalId, portal.id),
      eq(ccAuthorities.code, req.authorityCode)
    )
  });
  
  if (!authority) throw new Error('Authority not found');
  
  if (authority.authorityType !== 'first_nation') {
    throw new Error('Territory notices are only for First Nations authorities');
  }
  
  const noticeNumber = generateNoticeNumber(authority.code || 'FN');
  
  // Format date as YYYY-MM-DD string for Postgres date column
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [notice] = await db.insert(ccTerritoryNotices).values({
    portalId: portal.id,
    authorityId: authority.id,
    tripId: req.tripId,
    noticeNumber,
    visitorName: req.visitorName,
    visitorEmail: req.visitorEmail,
    visitorPhone: req.visitorPhone,
    partySize: req.partySize || 1,
    partyMembers: req.partyMembers || [],
    visitPurpose: req.visitPurpose,
    visitDescription: req.visitDescription,
    entryDate: formatDate(req.entryDate),
    exitDate: req.exitDate ? formatDate(req.exitDate) : undefined,
    entryPoint: req.entryPoint,
    plannedAreas: req.plannedAreas || [],
    vesselName: req.vesselName,
    vesselType: req.vesselType,
    vesselRegistration: req.vesselRegistration,
    visitorNotes: req.visitorNotes,
    status: 'pending'
  }).returning();
  
  const protocols = authority.culturalProtocolsJson as any || {};
  
  return {
    notice,
    authority: {
      id: authority.id,
      name: authority.name,
      code: authority.code
    },
    culturalProtocols: protocols,
    acknowledgmentRequired: true
  };
}

export async function acknowledgeNotice(
  portalSlug: string,
  noticeId: string,
  acknowledgments: AcknowledgmentData
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (!acknowledgments.territoryAcknowledged ||
      !acknowledgments.culturalRespectAgreed ||
      !acknowledgments.leaveNoTraceAgreed ||
      !acknowledgments.sacredSitesRespect) {
    throw new Error('All acknowledgments must be accepted');
  }
  
  const [updated] = await db.update(ccTerritoryNotices)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgementsJson: {
        ...acknowledgments,
        timestamp: new Date().toISOString()
      },
      updatedAt: new Date()
    })
    .where(and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    ))
    .returning();
  
  if (!updated) throw new Error('Notice not found');
  
  return updated;
}

export async function getNotice(
  portalSlug: string,
  noticeId: string
): Promise<{
  notice: any;
  authority: any;
  culturalSites: any[];
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const notice = await db.query.ccTerritoryNotices.findFirst({
    where: and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    )
  });
  
  if (!notice) return null;
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: eq(ccAuthorities.id, notice.authorityId)
  });
  
  const culturalSites = await db.query.ccCulturalSites.findMany({
    where: eq(ccCulturalSites.authorityId, notice.authorityId)
  });
  
  return { notice, authority, culturalSites };
}

export async function getNoticeByNumber(
  portalSlug: string,
  noticeNumber: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const notice = await db.query.ccTerritoryNotices.findFirst({
    where: and(
      eq(ccTerritoryNotices.noticeNumber, noticeNumber),
      eq(ccTerritoryNotices.portalId, portal.id)
    )
  });
  
  if (!notice) return null;
  
  return getNotice(portalSlug, notice.id);
}

export async function getNoticesForTrip(
  portalSlug: string,
  tripId: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  return db.query.ccTerritoryNotices.findMany({
    where: and(
      eq(ccTerritoryNotices.portalId, portal.id),
      eq(ccTerritoryNotices.tripId, tripId)
    ),
    orderBy: [asc(ccTerritoryNotices.entryDate)]
  });
}

export async function searchNotices(
  portalSlug: string,
  options?: {
    authorityId?: string;
    status?: string;
    entryDateFrom?: Date;
    entryDateTo?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccTerritoryNotices.portalId, portal.id)];
  
  if (options?.authorityId) {
    conditions.push(eq(ccTerritoryNotices.authorityId, options.authorityId));
  }
  
  if (options?.status) {
    conditions.push(eq(ccTerritoryNotices.status, options.status));
  }
  
  if (options?.entryDateFrom) {
    conditions.push(gte(ccTerritoryNotices.entryDate, options.entryDateFrom.toISOString().slice(0, 10)));
  }
  
  if (options?.entryDateTo) {
    conditions.push(lte(ccTerritoryNotices.entryDate, options.entryDateTo.toISOString().slice(0, 10)));
  }
  
  return db.query.ccTerritoryNotices.findMany({
    where: and(...conditions),
    orderBy: [desc(ccTerritoryNotices.entryDate)],
    limit: options?.limit || 50
  });
}

// ============ CULTURAL SITES ============

export async function getCulturalSites(
  portalSlug: string,
  authorityCode?: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccCulturalSites.portalId, portal.id)];
  
  if (authorityCode) {
    const authority = await db.query.ccAuthorities.findFirst({
      where: and(
        eq(ccAuthorities.portalId, portal.id),
        eq(ccAuthorities.code, authorityCode)
      )
    });
    
    if (authority) {
      conditions.push(eq(ccCulturalSites.authorityId, authority.id));
    }
  }
  
  return db.query.ccCulturalSites.findMany({
    where: and(...conditions),
    orderBy: [asc(ccCulturalSites.name)]
  });
}

export async function getCulturalSite(
  portalSlug: string,
  siteId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  return db.query.ccCulturalSites.findFirst({
    where: and(
      eq(ccCulturalSites.id, siteId),
      eq(ccCulturalSites.portalId, portal.id)
    )
  });
}

// ============ TERRITORY ACKNOWLEDGMENT TEXT ============

export async function getTerritoryAcknowledgment(
  portalSlug: string,
  authorityCode: string
): Promise<{
  authority: any;
  acknowledgment: string;
  protocols: any;
  sites: any[];
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: and(
      eq(ccAuthorities.portalId, portal.id),
      eq(ccAuthorities.code, authorityCode)
    )
  });
  
  if (!authority) return null;
  
  const protocols = authority.culturalProtocolsJson as any || {};
  
  const sites = await db.query.ccCulturalSites.findMany({
    where: eq(ccCulturalSites.authorityId, authority.id)
  });
  
  return {
    authority: {
      id: authority.id,
      name: authority.name,
      code: authority.code,
      type: authority.authorityType
    },
    acknowledgment: protocols.territory_acknowledgment || 
      `We acknowledge that we are visitors on the traditional territory of the ${authority.name}`,
    protocols,
    sites
  };
}

// ============ STATUS TRANSITIONS ============

export async function activateNotice(
  portalSlug: string,
  noticeId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const notice = await db.query.ccTerritoryNotices.findFirst({
    where: and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    )
  });
  
  if (!notice) throw new Error('Notice not found');
  
  if (notice.status !== 'acknowledged') {
    throw new Error('Only acknowledged notices can be activated');
  }
  
  const [updated] = await db.update(ccTerritoryNotices)
    .set({
      status: 'active',
      updatedAt: new Date()
    })
    .where(and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function completeNotice(
  portalSlug: string,
  noticeId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const notice = await db.query.ccTerritoryNotices.findFirst({
    where: and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    )
  });
  
  if (!notice) throw new Error('Notice not found');
  
  if (notice.status !== 'active') {
    throw new Error('Only active notices can be completed');
  }
  
  const [updated] = await db.update(ccTerritoryNotices)
    .set({
      status: 'completed',
      updatedAt: new Date()
    })
    .where(and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function cancelNotice(
  portalSlug: string,
  noticeId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccTerritoryNotices)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(and(
      eq(ccTerritoryNotices.id, noticeId),
      eq(ccTerritoryNotices.portalId, portal.id)
    ))
    .returning();
  
  if (!updated) throw new Error('Notice not found');
  
  return updated;
}

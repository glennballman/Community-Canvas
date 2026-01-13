import { db } from '../db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  ccCitations, ccCitationAppeals, ccViolationHistory,
  ccPortals, ccProperties, ccUnits, ccComplianceRules
} from '@shared/schema';
import { logActivity } from './activityService';

interface CreateCitationRequest {
  portalSlug: string;
  propertyId?: string;
  unitId?: string;
  reservationId?: string;
  complianceRuleId?: string;
  complianceCheckId?: string;
  incidentReportId?: string;
  
  violatorType?: string;
  violatorName: string;
  violatorEmail?: string;
  violatorPhone?: string;
  violatorAddress?: string;
  guestReservationId?: string;
  
  vesselName?: string;
  vesselRegistration?: string;
  vehiclePlate?: string;
  vehicleDescription?: string;
  
  violationDate: Date;
  violationTime?: string;
  violationLocation?: string;
  lat?: number;
  lon?: number;
  
  ruleCode?: string;
  ruleName: string;
  violationDescription: string;
  
  evidenceDescription?: string;
  photos?: string[];
  witnessNames?: string[];
  
  fineAmount?: number;
  fineDueDate?: Date;
  
  additionalAction?: string;
  actionNotes?: string;
  
  issuedBy: string;
  issuerNotes?: string;
}

function generateCitationNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `CIT-${dateStr}-${suffix}`;
}

function generateAppealNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `APL-${dateStr}-${suffix}`;
}

async function getViolationHistoryInternal(
  portalId: string,
  identifierType: string,
  identifierValue: string
): Promise<any | null> {
  return db.query.ccViolationHistory.findFirst({
    where: and(
      eq(ccViolationHistory.portalId, portalId),
      eq(ccViolationHistory.identifierType, identifierType),
      eq(ccViolationHistory.identifierValue, identifierValue.toLowerCase())
    )
  });
}

async function updateViolationHistoryInternal(
  portalId: string,
  identifierType: string,
  identifierValue: string,
  citation: any
): Promise<void> {
  const existing = await getViolationHistoryInternal(portalId, identifierType, identifierValue.toLowerCase());
  
  const fineAmount = Number(citation.fineAmountCad) || 0;
  
  if (existing) {
    const newTotalCitations = (existing.totalCitations || 0) + 1;
    const newTotalFines = Number(existing.totalFinesCad || 0) + fineAmount;
    const newUnpaidFines = Number(existing.unpaidFinesCad || 0) + fineAmount;
    
    let standing = existing.standing;
    if (newTotalCitations >= 3) {
      standing = 'restricted';
    } else if (newTotalCitations >= 2) {
      standing = 'probation';
    } else if (newTotalCitations >= 1) {
      standing = 'warned';
    }
    
    await db.update(ccViolationHistory)
      .set({
        totalCitations: newTotalCitations,
        totalFinesCad: String(newTotalFines),
        unpaidFinesCad: String(newUnpaidFines),
        lastCitationId: citation.id,
        lastCitationDate: citation.violationDate,
        lastViolationType: citation.ruleCode,
        standing,
        updatedAt: new Date()
      })
      .where(eq(ccViolationHistory.id, existing.id));
  } else {
    await db.insert(ccViolationHistory).values({
      portalId,
      identifierType,
      identifierValue: identifierValue.toLowerCase(),
      totalCitations: 1,
      totalWarnings: 0,
      totalFinesCad: String(fineAmount),
      unpaidFinesCad: String(fineAmount),
      lastCitationId: citation.id,
      lastCitationDate: citation.violationDate,
      lastViolationType: citation.ruleCode,
      standing: 'warned'
    });
  }
}

async function getPriorCitations(
  portalId: string,
  violatorEmail?: string
): Promise<any[]> {
  if (!violatorEmail) return [];
  
  return db.query.ccCitations.findMany({
    where: and(
      eq(ccCitations.portalId, portalId),
      eq(ccCitations.violatorEmail, violatorEmail.toLowerCase())
    ),
    orderBy: [desc(ccCitations.violationDate)],
    limit: 10
  });
}

export async function createCitation(req: CreateCitationRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (req.propertyId) {
    const property = await db.query.ccProperties.findFirst({
      where: and(
        eq(ccProperties.id, req.propertyId),
        eq(ccProperties.portalId, portal.id)
      )
    });
    if (!property) throw new Error('Property not found');
  }
  
  const priorCitations = await getPriorCitations(portal.id, req.violatorEmail);
  const offenseNumber = priorCitations.length + 1;
  
  const priorCitationsJson = priorCitations.map(c => ({
    citationNumber: c.citationNumber,
    date: c.violationDate,
    ruleCode: c.ruleCode
  }));
  
  let fineAmount = req.fineAmount || 0;
  if (req.complianceRuleId && !req.fineAmount) {
    const rule = await db.query.ccComplianceRules.findFirst({
      where: eq(ccComplianceRules.id, req.complianceRuleId)
    });
    if (rule?.fineAmountCad) {
      fineAmount = Number(rule.fineAmountCad);
    }
  }
  
  const fineDueDate = req.fineDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  const citationNumber = generateCitationNumber();
  
  const [citation] = await db.insert(ccCitations).values({
    portalId: portal.id,
    propertyId: req.propertyId,
    unitId: req.unitId,
    reservationId: req.reservationId,
    complianceRuleId: req.complianceRuleId,
    complianceCheckId: req.complianceCheckId,
    incidentReportId: req.incidentReportId,
    citationNumber,
    violatorType: req.violatorType || 'guest',
    violatorName: req.violatorName,
    violatorEmail: req.violatorEmail?.toLowerCase(),
    violatorPhone: req.violatorPhone,
    violatorAddress: req.violatorAddress,
    guestReservationId: req.guestReservationId,
    vesselName: req.vesselName,
    vesselRegistration: req.vesselRegistration,
    vehiclePlate: req.vehiclePlate,
    vehicleDescription: req.vehicleDescription,
    violationDate: req.violationDate.toISOString().split('T')[0],
    violationTime: req.violationTime,
    violationLocation: req.violationLocation,
    lat: req.lat ? String(req.lat) : undefined,
    lon: req.lon ? String(req.lon) : undefined,
    ruleCode: req.ruleCode,
    ruleName: req.ruleName,
    violationDescription: req.violationDescription,
    evidenceDescription: req.evidenceDescription,
    photosJson: req.photos || [],
    witnessNames: req.witnessNames,
    offenseNumber,
    priorCitationsJson,
    fineAmountCad: String(fineAmount),
    fineDueDate: fineDueDate.toISOString().split('T')[0],
    additionalAction: req.additionalAction || 'none',
    actionNotes: req.actionNotes,
    issuedBy: req.issuedBy,
    issuerNotes: req.issuerNotes,
    status: 'issued'
  }).returning();
  
  if (req.violatorEmail) {
    await updateViolationHistoryInternal(portal.id, 'email', req.violatorEmail, citation);
  }
  if (req.vesselRegistration) {
    await updateViolationHistoryInternal(portal.id, 'vessel_registration', req.vesselRegistration, citation);
  }
  if (req.vehiclePlate) {
    await updateViolationHistoryInternal(portal.id, 'vehicle_plate', req.vehiclePlate, citation);
  }
  
  await logActivity({
    tenantId: 'system',
    actorId: req.issuedBy,
    action: 'citation.issued',
    resourceType: 'citation',
    resourceId: citation.id,
    metadata: { 
      citationNumber, 
      violator: req.violatorName, 
      rule: req.ruleName,
      offenseNumber,
      fineAmount
    }
  });
  
  return { citation, offenseNumber, priorCitations: priorCitationsJson };
}

export async function getCitation(
  portalSlug: string,
  citationId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const citation = await db.query.ccCitations.findFirst({
    where: and(
      eq(ccCitations.id, citationId),
      eq(ccCitations.portalId, portal.id)
    )
  });
  
  if (!citation) return null;
  
  let property = null;
  let unit = null;
  let rule = null;
  let appeals: any[] = [];
  
  if (citation.propertyId) {
    property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, citation.propertyId)
    });
  }
  
  if (citation.unitId) {
    unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, citation.unitId)
    });
  }
  
  if (citation.complianceRuleId) {
    rule = await db.query.ccComplianceRules.findFirst({
      where: eq(ccComplianceRules.id, citation.complianceRuleId)
    });
  }
  
  appeals = await db.query.ccCitationAppeals.findMany({
    where: eq(ccCitationAppeals.citationId, citation.id),
    orderBy: [desc(ccCitationAppeals.filedAt)]
  });
  
  return { citation, property, unit, rule, appeals };
}

export async function getCitationByNumber(
  portalSlug: string,
  citationNumber: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const citation = await db.query.ccCitations.findFirst({
    where: and(
      eq(ccCitations.citationNumber, citationNumber),
      eq(ccCitations.portalId, portal.id)
    )
  });
  
  if (!citation) return null;
  
  return getCitation(portalSlug, citation.id);
}

export async function searchCitations(
  portalSlug: string,
  options?: {
    propertyId?: string;
    status?: string;
    paymentStatus?: string;
    violatorEmail?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccCitations.portalId, portal.id)];
  
  if (options?.propertyId) {
    conditions.push(eq(ccCitations.propertyId, options.propertyId));
  }
  
  if (options?.status) {
    conditions.push(eq(ccCitations.status, options.status));
  }
  
  if (options?.paymentStatus) {
    conditions.push(eq(ccCitations.paymentStatus, options.paymentStatus));
  }
  
  if (options?.violatorEmail) {
    conditions.push(eq(ccCitations.violatorEmail, options.violatorEmail.toLowerCase()));
  }
  
  if (options?.fromDate) {
    conditions.push(gte(ccCitations.violationDate, options.fromDate.toISOString().split('T')[0]));
  }
  
  if (options?.toDate) {
    conditions.push(lte(ccCitations.violationDate, options.toDate.toISOString().split('T')[0]));
  }
  
  return db.query.ccCitations.findMany({
    where: and(...conditions),
    orderBy: [desc(ccCitations.violationDate)],
    limit: options?.limit || 50
  });
}

export async function recordPayment(
  portalSlug: string,
  citationId: string,
  data: {
    amount: number;
    paymentReference?: string;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const citation = await db.query.ccCitations.findFirst({
    where: and(
      eq(ccCitations.id, citationId),
      eq(ccCitations.portalId, portal.id)
    )
  });
  
  if (!citation) throw new Error('Citation not found');
  
  const newAmountPaid = Number(citation.amountPaidCad || 0) + data.amount;
  const fineAmount = Number(citation.fineAmountCad) || 0;
  
  const paymentStatus = newAmountPaid >= fineAmount ? 'paid' : 'partial';
  const status = newAmountPaid >= fineAmount ? 'paid' : citation.status;
  
  const [updated] = await db.update(ccCitations)
    .set({
      amountPaidCad: String(newAmountPaid),
      paymentStatus,
      status,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentReference: data.paymentReference,
      updatedAt: new Date()
    })
    .where(eq(ccCitations.id, citationId))
    .returning();
  
  if (citation.violatorEmail && paymentStatus === 'paid') {
    const history = await getViolationHistoryInternal(portal.id, 'email', citation.violatorEmail);
    if (history) {
      const newUnpaid = Math.max(0, Number(history.unpaidFinesCad || 0) - fineAmount);
      await db.update(ccViolationHistory)
        .set({
          unpaidFinesCad: String(newUnpaid),
          updatedAt: new Date()
        })
        .where(eq(ccViolationHistory.id, history.id));
    }
  }
  
  return updated;
}

export async function fileAppeal(
  portalSlug: string,
  citationId: string,
  data: {
    appellantName: string;
    appellantEmail?: string;
    appellantPhone?: string;
    grounds: string;
    supportingEvidence?: string;
    documents?: string[];
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const citation = await db.query.ccCitations.findFirst({
    where: and(
      eq(ccCitations.id, citationId),
      eq(ccCitations.portalId, portal.id)
    )
  });
  
  if (!citation) throw new Error('Citation not found');
  
  const appealNumber = generateAppealNumber();
  
  const [appeal] = await db.insert(ccCitationAppeals).values({
    citationId,
    appealNumber,
    appellantName: data.appellantName,
    appellantEmail: data.appellantEmail,
    appellantPhone: data.appellantPhone,
    grounds: data.grounds,
    supportingEvidence: data.supportingEvidence,
    documentsJson: data.documents || [],
    status: 'filed'
  }).returning();
  
  await db.update(ccCitations)
    .set({
      status: 'contested',
      paymentStatus: 'appealed',
      updatedAt: new Date()
    })
    .where(eq(ccCitations.id, citationId));
  
  await logActivity({
    tenantId: 'system',
    actorId: data.appellantEmail || 'appellant',
    action: 'citation.appealed',
    resourceType: 'citation_appeal',
    resourceId: appeal.id,
    metadata: { appealNumber, citationNumber: citation.citationNumber }
  });
  
  return { appeal, citation };
}

export async function getAppeal(
  portalSlug: string,
  appealId: string
): Promise<any | null> {
  const appeal = await db.query.ccCitationAppeals.findFirst({
    where: eq(ccCitationAppeals.id, appealId)
  });
  
  if (!appeal) return null;
  
  const citationResult = await getCitation(portalSlug, appeal.citationId);
  if (!citationResult) return null;
  
  return { appeal, ...citationResult };
}

export async function updateAppealStatus(
  portalSlug: string,
  appealId: string,
  status: string,
  data?: {
    assignedTo?: string;
    hearingDate?: Date;
    hearingTime?: string;
    hearingLocation?: string;
    hearingNotes?: string;
  }
): Promise<any> {
  const appeal = await db.query.ccCitationAppeals.findFirst({
    where: eq(ccCitationAppeals.id, appealId)
  });
  
  if (!appeal) throw new Error('Appeal not found');
  
  const citationResult = await getCitation(portalSlug, appeal.citationId);
  if (!citationResult) throw new Error('Citation not found');
  
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date()
  };
  
  if (data?.assignedTo) {
    updates.assignedTo = data.assignedTo;
    updates.assignedAt = new Date();
  }
  
  if (data?.hearingDate) updates.hearingDate = data.hearingDate.toISOString().split('T')[0];
  if (data?.hearingTime) updates.hearingTime = data.hearingTime;
  if (data?.hearingLocation) updates.hearingLocation = data.hearingLocation;
  if (data?.hearingNotes) updates.hearingNotes = data.hearingNotes;
  
  const [updated] = await db.update(ccCitationAppeals)
    .set(updates)
    .where(eq(ccCitationAppeals.id, appealId))
    .returning();
  
  return updated;
}

export async function decideAppeal(
  portalSlug: string,
  appealId: string,
  data: {
    decision: string;
    decisionReason: string;
    decidedBy: string;
    newFineAmount?: number;
    newDueDate?: Date;
  }
): Promise<any> {
  const appeal = await db.query.ccCitationAppeals.findFirst({
    where: eq(ccCitationAppeals.id, appealId)
  });
  
  if (!appeal) throw new Error('Appeal not found');
  
  const citationResult = await getCitation(portalSlug, appeal.citationId);
  if (!citationResult) throw new Error('Citation not found');
  
  const [updatedAppeal] = await db.update(ccCitationAppeals)
    .set({
      status: 'decided',
      decision: data.decision,
      decisionReason: data.decisionReason,
      decidedBy: data.decidedBy,
      decidedAt: new Date(),
      newFineAmountCad: data.newFineAmount !== undefined ? String(data.newFineAmount) : undefined,
      newDueDate: data.newDueDate?.toISOString().split('T')[0],
      updatedAt: new Date()
    })
    .where(eq(ccCitationAppeals.id, appealId))
    .returning();
  
  const citationUpdates: Record<string, any> = {
    updatedAt: new Date()
  };
  
  if (data.decision === 'upheld') {
    citationUpdates.status = 'upheld';
    citationUpdates.paymentStatus = 'unpaid';
  } else if (data.decision === 'dismissed') {
    citationUpdates.status = 'dismissed';
    citationUpdates.paymentStatus = 'waived';
  } else if (data.decision === 'reduced' && data.newFineAmount !== undefined) {
    citationUpdates.status = 'reduced';
    citationUpdates.fineAmountCad = String(data.newFineAmount);
    citationUpdates.paymentStatus = data.newFineAmount === 0 ? 'waived' : 'unpaid';
    if (data.newDueDate) citationUpdates.fineDueDate = data.newDueDate.toISOString().split('T')[0];
  }
  
  await db.update(ccCitations)
    .set(citationUpdates)
    .where(eq(ccCitations.id, appeal.citationId));
  
  await logActivity({
    tenantId: 'system',
    actorId: data.decidedBy,
    action: 'appeal.decided',
    resourceType: 'citation_appeal',
    resourceId: appealId,
    metadata: { decision: data.decision, newFineAmount: data.newFineAmount }
  });
  
  return { appeal: updatedAppeal, citation: citationResult.citation };
}

export async function checkViolatorStanding(
  portalSlug: string,
  identifierType: string,
  identifierValue: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const history = await getViolationHistoryInternal(portal.id, identifierType, identifierValue.toLowerCase());
  
  if (!history) {
    return {
      standing: 'good',
      totalCitations: 0,
      totalFines: 0,
      unpaidFines: 0,
      canBook: true
    };
  }
  
  return {
    standing: history.standing,
    totalCitations: history.totalCitations,
    totalFines: Number(history.totalFinesCad),
    unpaidFines: Number(history.unpaidFinesCad),
    lastViolation: history.lastCitationDate,
    canBook: !['restricted', 'banned'].includes(history.standing),
    banUntil: history.banUntil,
    banReason: history.banReason
  };
}

export async function updateViolatorStanding(
  portalSlug: string,
  identifierType: string,
  identifierValue: string,
  standing: string,
  data?: {
    banReason?: string;
    banUntil?: Date;
    notes?: string;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const history = await getViolationHistoryInternal(portal.id, identifierType, identifierValue.toLowerCase());
  
  if (!history) {
    const [created] = await db.insert(ccViolationHistory).values({
      portalId: portal.id,
      identifierType,
      identifierValue: identifierValue.toLowerCase(),
      standing,
      banReason: data?.banReason,
      banUntil: data?.banUntil?.toISOString().split('T')[0],
      notes: data?.notes
    }).returning();
    return created;
  }
  
  const [updated] = await db.update(ccViolationHistory)
    .set({
      standing,
      banReason: data?.banReason,
      banUntil: data?.banUntil?.toISOString().split('T')[0],
      notes: data?.notes,
      updatedAt: new Date()
    })
    .where(eq(ccViolationHistory.id, history.id))
    .returning();
  
  return updated;
}

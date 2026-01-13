import { db } from '../db';
import { eq, and, gte, lte, asc, desc, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  ccPortals, ccProperties, ccUnits, 
  ccComplianceRules, ccComplianceChecks, ccIncidentReports 
} from '@shared/schema';

interface CreateCheckRequest {
  portalSlug: string;
  propertyId?: string;
  unitId?: string;
  reservationId?: string;
  checkType: string;
  scheduledAt?: Date;
  scheduledBy?: string;
  assignedTo?: string;
  locationDescription?: string;
}

interface CreateIncidentRequest {
  portalSlug: string;
  propertyId?: string;
  unitId?: string;
  reservationId?: string;
  locationId?: string;
  incidentType: string;
  severity?: string;
  incidentAt: Date;
  locationDescription?: string;
  lat?: number;
  lon?: number;
  reportedByType?: string;
  reportedByName?: string;
  reportedByContact?: string;
  reporterReservationId?: string;
  title: string;
  description?: string;
  involvedParties?: any[];
}

function generateCheckNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `CHK-${dateStr}-${suffix}`;
}

function generateIncidentNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `INC-${dateStr}-${suffix}`;
}

export async function getComplianceRules(
  portalSlug: string,
  options?: {
    category?: string;
    propertyId?: string;
    status?: string;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  if (options?.propertyId) {
    const property = await db.query.ccProperties.findFirst({
      where: and(
        eq(ccProperties.id, options.propertyId),
        eq(ccProperties.portalId, portal.id)
      )
    });
    if (!property) return [];
  }
  
  const conditions: any[] = [
    eq(ccComplianceRules.portalId, portal.id),
    eq(ccComplianceRules.status, options?.status || 'active')
  ];
  
  if (options?.propertyId) {
    conditions.push(or(
      sql`${ccComplianceRules.propertyId} IS NULL`,
      eq(ccComplianceRules.propertyId, options.propertyId)
    ));
  }
  
  if (options?.category) {
    conditions.push(eq(ccComplianceRules.category, options.category));
  }
  
  return db.query.ccComplianceRules.findMany({
    where: and(...conditions),
    orderBy: [asc(ccComplianceRules.category), asc(ccComplianceRules.name)]
  });
}

export async function getRuleByCode(
  portalSlug: string,
  code: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  return db.query.ccComplianceRules.findFirst({
    where: and(
      eq(ccComplianceRules.portalId, portal.id),
      eq(ccComplianceRules.code, code)
    )
  });
}

export async function createComplianceRule(
  portalSlug: string,
  data: {
    name: string;
    code?: string;
    category: string;
    description: string;
    rationale?: string;
    propertyId?: string;
    enforcementLevel?: string;
    firstOffenseAction?: string;
    secondOffenseAction?: string;
    thirdOffenseAction?: string;
    fineAmount?: number;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    seasonalMonths?: number[];
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (data.propertyId) {
    const property = await db.query.ccProperties.findFirst({
      where: and(
        eq(ccProperties.id, data.propertyId),
        eq(ccProperties.portalId, portal.id)
      )
    });
    if (!property) throw new Error('Property not found');
  }
  
  const [rule] = await db.insert(ccComplianceRules).values({
    portalId: portal.id,
    propertyId: data.propertyId,
    name: data.name,
    code: data.code,
    category: data.category,
    description: data.description,
    rationale: data.rationale,
    enforcementLevel: data.enforcementLevel || 'standard',
    firstOffenseAction: data.firstOffenseAction || 'warning',
    secondOffenseAction: data.secondOffenseAction || 'citation',
    thirdOffenseAction: data.thirdOffenseAction || 'eviction',
    fineAmountCad: data.fineAmount?.toString(),
    quietHoursStart: data.quietHoursStart,
    quietHoursEnd: data.quietHoursEnd,
    seasonalMonths: data.seasonalMonths,
    status: 'active'
  }).returning();
  
  return rule;
}

export async function createComplianceCheck(req: CreateCheckRequest): Promise<any> {
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
  
  if (req.unitId && req.propertyId) {
    const unit = await db.query.ccUnits.findFirst({
      where: and(
        eq(ccUnits.id, req.unitId),
        eq(ccUnits.propertyId, req.propertyId)
      )
    });
    if (!unit) throw new Error('Unit not found');
  }
  
  const checkNumber = generateCheckNumber();
  
  const rules = await getComplianceRules(req.portalSlug, { propertyId: req.propertyId });
  const checklistJson = rules.map(rule => ({
    ruleId: rule.id,
    ruleName: rule.name,
    ruleCode: rule.code,
    category: rule.category,
    compliant: null,
    notes: ''
  }));
  
  const [check] = await db.insert(ccComplianceChecks).values({
    portalId: portal.id,
    propertyId: req.propertyId,
    unitId: req.unitId,
    reservationId: req.reservationId,
    checkNumber,
    checkType: req.checkType,
    scheduledAt: req.scheduledAt || new Date(),
    scheduledBy: req.scheduledBy,
    assignedTo: req.assignedTo,
    assignedAt: req.assignedTo ? new Date() : undefined,
    locationDescription: req.locationDescription,
    checklistJson,
    status: 'scheduled'
  }).returning();
  
  return { check, checklist: checklistJson };
}

export async function getComplianceCheck(
  portalSlug: string,
  checkId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const check = await db.query.ccComplianceChecks.findFirst({
    where: and(
      eq(ccComplianceChecks.id, checkId),
      eq(ccComplianceChecks.portalId, portal.id)
    )
  });
  
  if (!check) return null;
  
  let property = null;
  let unit = null;
  
  if (check.propertyId) {
    property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, check.propertyId)
    });
  }
  
  if (check.unitId) {
    unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, check.unitId)
    });
  }
  
  return { check, property, unit };
}

export async function searchComplianceChecks(
  portalSlug: string,
  options?: {
    propertyId?: string;
    status?: string;
    checkType?: string;
    assignedTo?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccComplianceChecks.portalId, portal.id)];
  
  if (options?.propertyId) {
    conditions.push(eq(ccComplianceChecks.propertyId, options.propertyId));
  }
  
  if (options?.status) {
    conditions.push(eq(ccComplianceChecks.status, options.status));
  }
  
  if (options?.checkType) {
    conditions.push(eq(ccComplianceChecks.checkType, options.checkType));
  }
  
  if (options?.assignedTo) {
    conditions.push(eq(ccComplianceChecks.assignedTo, options.assignedTo));
  }
  
  if (options?.fromDate) {
    conditions.push(gte(ccComplianceChecks.scheduledAt, options.fromDate));
  }
  
  if (options?.toDate) {
    conditions.push(lte(ccComplianceChecks.scheduledAt, options.toDate));
  }
  
  return db.query.ccComplianceChecks.findMany({
    where: and(...conditions),
    orderBy: [asc(ccComplianceChecks.scheduledAt)],
    limit: options?.limit || 50
  });
}

export async function startComplianceCheck(
  portalSlug: string,
  checkId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const check = await db.query.ccComplianceChecks.findFirst({
    where: and(
      eq(ccComplianceChecks.id, checkId),
      eq(ccComplianceChecks.portalId, portal.id)
    )
  });
  
  if (!check) throw new Error('Check not found');
  
  const [updated] = await db.update(ccComplianceChecks)
    .set({
      status: 'in_progress',
      startedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccComplianceChecks.id, checkId))
    .returning();
  
  return updated;
}

export async function updateCheckChecklist(
  portalSlug: string,
  checkId: string,
  checklistJson: any[]
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const check = await db.query.ccComplianceChecks.findFirst({
    where: and(
      eq(ccComplianceChecks.id, checkId),
      eq(ccComplianceChecks.portalId, portal.id)
    )
  });
  
  if (!check) throw new Error('Check not found');
  
  const [updated] = await db.update(ccComplianceChecks)
    .set({
      checklistJson,
      updatedAt: new Date()
    })
    .where(eq(ccComplianceChecks.id, checkId))
    .returning();
  
  return updated;
}

export async function completeComplianceCheck(
  portalSlug: string,
  checkId: string,
  data: {
    overallResult: string;
    findingsSummary?: string;
    actionsTaken?: string;
    warningsIssued?: number;
    citationsIssued?: number;
    requiresFollowup?: boolean;
    followupDate?: Date;
    followupNotes?: string;
    inspectorNotes?: string;
    photos?: string[];
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const check = await db.query.ccComplianceChecks.findFirst({
    where: and(
      eq(ccComplianceChecks.id, checkId),
      eq(ccComplianceChecks.portalId, portal.id)
    )
  });
  
  if (!check) throw new Error('Check not found');
  
  let status = 'completed';
  if (data.overallResult === 'pass') {
    status = 'compliant';
  } else if (data.overallResult === 'fail') {
    status = 'non_compliant';
  }
  
  const [updated] = await db.update(ccComplianceChecks)
    .set({
      status,
      completedAt: new Date(),
      overallResult: data.overallResult,
      findingsSummary: data.findingsSummary,
      actionsTaken: data.actionsTaken,
      warningsIssued: data.warningsIssued || 0,
      citationsIssued: data.citationsIssued || 0,
      requiresFollowup: data.requiresFollowup || false,
      followupDate: data.followupDate?.toISOString().split('T')[0],
      followupNotes: data.followupNotes,
      inspectorNotes: data.inspectorNotes,
      photosJson: data.photos,
      updatedAt: new Date()
    })
    .where(eq(ccComplianceChecks.id, checkId))
    .returning();
  
  return updated;
}

export async function createIncidentReport(req: CreateIncidentRequest): Promise<any> {
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
  
  if (req.unitId && req.propertyId) {
    const unit = await db.query.ccUnits.findFirst({
      where: and(
        eq(ccUnits.id, req.unitId),
        eq(ccUnits.propertyId, req.propertyId)
      )
    });
    if (!unit) throw new Error('Unit not found');
  }
  
  const reportNumber = generateIncidentNumber();
  
  const [report] = await db.insert(ccIncidentReports).values({
    portalId: portal.id,
    propertyId: req.propertyId,
    unitId: req.unitId,
    reservationId: req.reservationId,
    locationId: req.locationId,
    reportNumber,
    incidentType: req.incidentType,
    severity: req.severity || 'moderate',
    incidentAt: req.incidentAt,
    locationDescription: req.locationDescription,
    lat: req.lat?.toString(),
    lon: req.lon?.toString(),
    reportedByType: req.reportedByType || 'staff',
    reportedByName: req.reportedByName,
    reportedByContact: req.reportedByContact,
    reporterReservationId: req.reporterReservationId,
    title: req.title,
    description: req.description,
    involvedPartiesJson: req.involvedParties || [],
    status: 'reported'
  }).returning();
  
  return { report };
}

export async function getIncidentReport(
  portalSlug: string,
  reportId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const report = await db.query.ccIncidentReports.findFirst({
    where: and(
      eq(ccIncidentReports.id, reportId),
      eq(ccIncidentReports.portalId, portal.id)
    )
  });
  
  if (!report) return null;
  
  let property = null;
  let unit = null;
  
  if (report.propertyId) {
    property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, report.propertyId)
    });
  }
  
  if (report.unitId) {
    unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, report.unitId)
    });
  }
  
  return { report, property, unit };
}

export async function searchIncidentReports(
  portalSlug: string,
  options?: {
    propertyId?: string;
    incidentType?: string;
    severity?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccIncidentReports.portalId, portal.id)];
  
  if (options?.propertyId) {
    conditions.push(eq(ccIncidentReports.propertyId, options.propertyId));
  }
  
  if (options?.incidentType) {
    conditions.push(eq(ccIncidentReports.incidentType, options.incidentType));
  }
  
  if (options?.severity) {
    conditions.push(eq(ccIncidentReports.severity, options.severity));
  }
  
  if (options?.status) {
    conditions.push(eq(ccIncidentReports.status, options.status));
  }
  
  if (options?.fromDate) {
    conditions.push(gte(ccIncidentReports.incidentAt, options.fromDate));
  }
  
  if (options?.toDate) {
    conditions.push(lte(ccIncidentReports.incidentAt, options.toDate));
  }
  
  return db.query.ccIncidentReports.findMany({
    where: and(...conditions),
    orderBy: [
      desc(sql`CASE severity WHEN 'emergency' THEN 5 WHEN 'critical' THEN 4 WHEN 'major' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END`),
      desc(ccIncidentReports.incidentAt)
    ],
    limit: options?.limit || 50
  });
}

export async function updateIncidentStatus(
  portalSlug: string,
  reportId: string,
  status: string,
  data?: {
    respondedBy?: string;
    investigatedBy?: string;
    investigationNotes?: string;
    resolutionType?: string;
    resolutionNotes?: string;
    resolvedBy?: string;
    damageEstimate?: number;
    repairCost?: number;
    requiresFollowup?: boolean;
    followupDate?: Date;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const report = await db.query.ccIncidentReports.findFirst({
    where: and(
      eq(ccIncidentReports.id, reportId),
      eq(ccIncidentReports.portalId, portal.id)
    )
  });
  
  if (!report) throw new Error('Report not found');
  
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date()
  };
  
  if (status === 'investigating' && !report.respondedAt) {
    updates.respondedAt = new Date();
    updates.respondedBy = data?.respondedBy;
    const responseMinutes = Math.round((new Date().getTime() - new Date(report.reportedAt!).getTime()) / 60000);
    updates.responseTimeMinutes = responseMinutes;
  }
  
  if (data?.investigatedBy) updates.investigatedBy = data.investigatedBy;
  if (data?.investigationNotes) updates.investigationNotes = data.investigationNotes;
  if (data?.resolutionType) updates.resolutionType = data.resolutionType;
  if (data?.resolutionNotes) updates.resolutionNotes = data.resolutionNotes;
  if (data?.resolvedBy) updates.resolvedBy = data.resolvedBy;
  if (data?.damageEstimate !== undefined) updates.damageEstimateCad = data.damageEstimate.toString();
  if (data?.repairCost !== undefined) updates.repairCostCad = data.repairCost.toString();
  if (data?.requiresFollowup !== undefined) updates.requiresFollowup = data.requiresFollowup;
  if (data?.followupDate) updates.followupDate = data.followupDate.toISOString().split('T')[0];
  
  if (status === 'resolved') {
    updates.resolvedAt = new Date();
  }
  
  const [updated] = await db.update(ccIncidentReports)
    .set(updates)
    .where(eq(ccIncidentReports.id, reportId))
    .returning();
  
  return updated;
}

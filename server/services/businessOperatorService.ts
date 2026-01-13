import { db } from '../db';
import { eq, and, or, desc, asc, lte, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logActivity } from './activityService';
import { assignRoleToUser } from './roleService';
import { 
  ccOperatorApplications, 
  ccOperators, 
  ccOperatorDocuments,
  ccPortals
} from '@shared/schema';

interface CreateApplicationRequest {
  portalSlug: string;
  userId: string;
  operatorType: string;
  businessName: string;
  businessLegalName?: string;
  businessNumber?: string;
  gstNumber?: string;
  businessStructure?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  businessAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  businessDescription?: string;
  servicesOffered?: string[];
  serviceAreas?: string[];
  yearsInBusiness?: number;
  employeeCount?: number;
  seasonalOperation?: boolean;
  operatingMonths?: number[];
}

function generateApplicationNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `OPA-${dateStr}-${suffix}`;
}

function generateOperatorNumber(operatorType: string): string {
  const typeCode = operatorType.substring(0, 3).toUpperCase();
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `OPR-${typeCode}-${dateStr}-${suffix}`;
}

export async function createApplication(req: CreateApplicationRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const existing = await db.query.ccOperatorApplications.findFirst({
    where: and(
      eq(ccOperatorApplications.portalId, portal.id),
      eq(ccOperatorApplications.userId, req.userId),
      or(
        eq(ccOperatorApplications.status, 'draft'),
        eq(ccOperatorApplications.status, 'submitted'),
        eq(ccOperatorApplications.status, 'under_review')
      )
    )
  });
  
  if (existing) {
    throw new Error('You already have a pending application');
  }
  
  const applicationNumber = generateApplicationNumber();
  
  const [application] = await db.insert(ccOperatorApplications).values({
    portalId: portal.id,
    userId: req.userId,
    applicationNumber,
    operatorType: req.operatorType,
    businessName: req.businessName,
    businessLegalName: req.businessLegalName,
    businessNumber: req.businessNumber,
    gstNumber: req.gstNumber,
    businessStructure: req.businessStructure,
    contactName: req.contactName,
    contactEmail: req.contactEmail,
    contactPhone: req.contactPhone,
    businessAddressLine1: req.businessAddress?.line1,
    businessAddressLine2: req.businessAddress?.line2,
    businessCity: req.businessAddress?.city,
    businessProvince: req.businessAddress?.province || 'BC',
    businessPostalCode: req.businessAddress?.postalCode,
    businessDescription: req.businessDescription,
    servicesOffered: req.servicesOffered,
    serviceAreas: req.serviceAreas,
    yearsInBusiness: req.yearsInBusiness,
    employeeCount: req.employeeCount,
    seasonalOperation: req.seasonalOperation,
    operatingMonths: req.operatingMonths,
    status: 'draft'
  }).returning();
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: req.userId,
      action: 'operator.application_created',
      resourceType: 'operator_application',
      resourceId: application.id,
      metadata: { applicationNumber, operatorType: req.operatorType }
    });
  } catch (e) {
  }
  
  return application;
}

export async function getApplication(
  portalSlug: string,
  applicationId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const application = await db.query.ccOperatorApplications.findFirst({
    where: and(
      eq(ccOperatorApplications.id, applicationId),
      eq(ccOperatorApplications.portalId, portal.id)
    )
  });
  
  if (!application) return null;
  
  return { application };
}

export async function getUserApplications(
  portalSlug: string,
  userId: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  return db.query.ccOperatorApplications.findMany({
    where: and(
      eq(ccOperatorApplications.portalId, portal.id),
      eq(ccOperatorApplications.userId, userId)
    ),
    orderBy: [desc(ccOperatorApplications.createdAt)]
  });
}

export async function searchApplications(
  portalSlug: string,
  options?: {
    status?: string;
    operatorType?: string;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccOperatorApplications.portalId, portal.id)];
  
  if (options?.status) {
    conditions.push(eq(ccOperatorApplications.status, options.status));
  }
  
  if (options?.operatorType) {
    conditions.push(eq(ccOperatorApplications.operatorType, options.operatorType));
  }
  
  return db.query.ccOperatorApplications.findMany({
    where: and(...conditions),
    orderBy: [desc(ccOperatorApplications.submittedAt), desc(ccOperatorApplications.createdAt)],
    limit: options?.limit || 50
  });
}

export async function updateApplication(
  portalSlug: string,
  applicationId: string,
  data: Partial<CreateApplicationRequest>
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const application = await db.query.ccOperatorApplications.findFirst({
    where: and(
      eq(ccOperatorApplications.id, applicationId),
      eq(ccOperatorApplications.portalId, portal.id)
    )
  });
  
  if (!application) throw new Error('Application not found');
  
  if (!['draft', 'info_requested'].includes(application.status || '')) {
    throw new Error('Cannot update application in current status');
  }
  
  const updates: Record<string, any> = { updatedAt: new Date() };
  
  if (data.businessName) updates.businessName = data.businessName;
  if (data.businessLegalName !== undefined) updates.businessLegalName = data.businessLegalName;
  if (data.businessNumber !== undefined) updates.businessNumber = data.businessNumber;
  if (data.gstNumber !== undefined) updates.gstNumber = data.gstNumber;
  if (data.businessStructure !== undefined) updates.businessStructure = data.businessStructure;
  if (data.contactName) updates.contactName = data.contactName;
  if (data.contactEmail) updates.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) updates.contactPhone = data.contactPhone;
  if (data.businessAddress) {
    if (data.businessAddress.line1 !== undefined) updates.businessAddressLine1 = data.businessAddress.line1;
    if (data.businessAddress.line2 !== undefined) updates.businessAddressLine2 = data.businessAddress.line2;
    if (data.businessAddress.city !== undefined) updates.businessCity = data.businessAddress.city;
    if (data.businessAddress.province !== undefined) updates.businessProvince = data.businessAddress.province;
    if (data.businessAddress.postalCode !== undefined) updates.businessPostalCode = data.businessAddress.postalCode;
  }
  if (data.businessDescription !== undefined) updates.businessDescription = data.businessDescription;
  if (data.servicesOffered !== undefined) updates.servicesOffered = data.servicesOffered;
  if (data.serviceAreas !== undefined) updates.serviceAreas = data.serviceAreas;
  if (data.yearsInBusiness !== undefined) updates.yearsInBusiness = data.yearsInBusiness;
  if (data.employeeCount !== undefined) updates.employeeCount = data.employeeCount;
  if (data.seasonalOperation !== undefined) updates.seasonalOperation = data.seasonalOperation;
  if (data.operatingMonths !== undefined) updates.operatingMonths = data.operatingMonths;
  
  const [updated] = await db.update(ccOperatorApplications)
    .set(updates)
    .where(eq(ccOperatorApplications.id, applicationId))
    .returning();
  
  return updated;
}

export async function submitApplication(
  portalSlug: string,
  applicationId: string,
  termsAccepted: boolean,
  codeOfConductAccepted: boolean
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  if (!termsAccepted || !codeOfConductAccepted) {
    throw new Error('You must accept the terms and code of conduct');
  }
  
  const [updated] = await db.update(ccOperatorApplications)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      codeOfConductAccepted: true,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccOperatorApplications.id, applicationId),
      eq(ccOperatorApplications.portalId, portal.id),
      eq(ccOperatorApplications.status, 'draft')
    ))
    .returning();
  
  if (!updated) throw new Error('Application not found or already submitted');
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: updated.userId,
      action: 'operator.application_submitted',
      resourceType: 'operator_application',
      resourceId: applicationId,
      metadata: { applicationNumber: updated.applicationNumber }
    });
  } catch (e) {
  }
  
  return updated;
}

export async function reviewApplication(
  portalSlug: string,
  applicationId: string,
  reviewerId: string,
  action: 'approve' | 'reject' | 'request_info',
  notes?: string,
  rejectionReason?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const application = await db.query.ccOperatorApplications.findFirst({
    where: and(
      eq(ccOperatorApplications.id, applicationId),
      eq(ccOperatorApplications.portalId, portal.id)
    )
  });
  
  if (!application) throw new Error('Application not found');
  
  const updates: Record<string, any> = {
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    reviewNotes: notes,
    updatedAt: new Date()
  };
  
  if (action === 'approve') {
    updates.status = 'approved';
    updates.approvedAt = new Date();
    updates.approvedBy = reviewerId;
  } else if (action === 'reject') {
    updates.status = 'rejected';
    updates.rejectionReason = rejectionReason;
  } else if (action === 'request_info') {
    updates.status = 'info_requested';
  }
  
  const [updated] = await db.update(ccOperatorApplications)
    .set(updates)
    .where(eq(ccOperatorApplications.id, applicationId))
    .returning();
  
  let operator = null;
  if (action === 'approve') {
    operator = await createOperatorFromApplication(portalSlug, updated);
  }
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: reviewerId,
      action: `operator.application_${action}`,
      resourceType: 'operator_application',
      resourceId: applicationId,
      metadata: { applicationNumber: updated.applicationNumber, action }
    });
  } catch (e) {
  }
  
  return { application: updated, operator };
}

async function createOperatorFromApplication(
  portalSlug: string,
  application: any
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const operatorNumber = generateOperatorNumber(application.operatorType);
  
  const [operator] = await db.insert(ccOperators).values({
    portalId: portal.id,
    userId: application.userId,
    applicationId: application.id,
    operatorNumber,
    operatorType: application.operatorType,
    businessName: application.businessName,
    businessLegalName: application.businessLegalName,
    businessNumber: application.businessNumber,
    gstNumber: application.gstNumber,
    contactName: application.contactName,
    contactEmail: application.contactEmail,
    contactPhone: application.contactPhone,
    businessAddressJson: {
      line1: application.businessAddressLine1,
      line2: application.businessAddressLine2,
      city: application.businessCity,
      province: application.businessProvince,
      postalCode: application.businessPostalCode
    },
    description: application.businessDescription,
    servicesOffered: application.servicesOffered,
    serviceAreas: application.serviceAreas,
    seasonalOperation: application.seasonalOperation,
    operatingMonths: application.operatingMonths,
    employeeCount: application.employeeCount,
    businessLicenseNumber: application.businessLicenseNumber,
    businessLicenseExpiry: application.businessLicenseExpiry,
    insuranceExpiry: application.insuranceExpiry,
    liabilityCoverageAmount: application.liabilityCoverageAmount,
    status: 'pending',
    verificationStatus: 'pending'
  }).returning();
  
  const operatorTypeToRole: Record<string, string> = {
    'accommodation': 'property_manager',
    'transport': 'transport_operator',
    'contractor': 'maintenance'
  };
  
  const roleCode = operatorTypeToRole[application.operatorType];
  if (roleCode) {
    try {
      await assignRoleToUser({
        userId: application.userId,
        roleCode,
        portalSlug,
        assignedBy: application.approvedBy
      });
    } catch (e) {
    }
  }
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: application.userId,
      action: 'operator.created',
      resourceType: 'operator',
      resourceId: operator.id,
      metadata: { operatorNumber, operatorType: application.operatorType }
    });
  } catch (e) {
  }
  
  return operator;
}

export async function getBusinessOperator(
  portalSlug: string,
  operatorId: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const operator = await db.query.ccOperators.findFirst({
    where: and(
      eq(ccOperators.id, operatorId),
      eq(ccOperators.portalId, portal.id)
    )
  });
  
  if (!operator) return null;
  
  const documents = await db.query.ccOperatorDocuments.findMany({
    where: eq(ccOperatorDocuments.operatorId, operatorId)
  });
  
  return { operator, documents };
}

export async function getBusinessOperatorByNumber(
  portalSlug: string,
  operatorNumber: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const operator = await db.query.ccOperators.findFirst({
    where: and(
      eq(ccOperators.operatorNumber, operatorNumber),
      eq(ccOperators.portalId, portal.id)
    )
  });
  
  if (!operator) return null;
  
  return { operator };
}

export async function searchBusinessOperators(
  portalSlug: string,
  options?: {
    operatorType?: string;
    status?: string;
    verificationStatus?: string;
    featured?: boolean;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccOperators.portalId, portal.id)];
  
  if (options?.operatorType) {
    conditions.push(eq(ccOperators.operatorType, options.operatorType));
  }
  
  if (options?.status) {
    conditions.push(eq(ccOperators.status, options.status));
  }
  
  if (options?.verificationStatus) {
    conditions.push(eq(ccOperators.verificationStatus, options.verificationStatus));
  }
  
  if (options?.featured !== undefined) {
    conditions.push(eq(ccOperators.featured, options.featured));
  }
  
  return db.query.ccOperators.findMany({
    where: and(...conditions),
    orderBy: [desc(ccOperators.createdAt)],
    limit: options?.limit || 50
  });
}

export async function updateBusinessOperator(
  portalSlug: string,
  operatorId: string,
  data: Record<string, any>
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const operator = await db.query.ccOperators.findFirst({
    where: and(
      eq(ccOperators.id, operatorId),
      eq(ccOperators.portalId, portal.id)
    )
  });
  
  if (!operator) throw new Error('Operator not found');
  
  const updates: Record<string, any> = { updatedAt: new Date() };
  
  const allowedFields = [
    'businessName', 'businessLegalName', 'businessNumber', 'gstNumber',
    'contactName', 'contactEmail', 'contactPhone', 'websiteUrl',
    'businessAddressJson', 'description', 'tagline', 'logoUrl', 'coverPhotoUrl',
    'servicesOffered', 'serviceAreas', 'amenities',
    'seasonalOperation', 'operatingMonths', 'operatingHoursJson',
    'employeeCount', 'featured', 'acceptsOnlineBooking', 'instantConfirmation',
    'status', 'internalNotes'
  ];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  }
  
  if (data.onboardingCompleted === true && !operator.onboardingCompleted) {
    updates.onboardingCompleted = true;
    updates.onboardingCompletedAt = new Date();
    updates.status = 'active';
  }
  
  const [updated] = await db.update(ccOperators)
    .set(updates)
    .where(eq(ccOperators.id, operatorId))
    .returning();
  
  return updated;
}

export async function verifyBusinessOperator(
  portalSlug: string,
  operatorId: string,
  verifiedBy: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  
  const [updated] = await db.update(ccOperators)
    .set({
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verificationExpiresAt: expiresAt,
      lastComplianceCheck: new Date().toISOString().split('T')[0],
      updatedAt: new Date()
    })
    .where(and(
      eq(ccOperators.id, operatorId),
      eq(ccOperators.portalId, portal.id)
    ))
    .returning();
  
  if (!updated) throw new Error('Operator not found');
  
  try {
    await logActivity({
      tenantId: 'system',
      actorId: verifiedBy,
      action: 'operator.verified',
      resourceType: 'operator',
      resourceId: operatorId,
      metadata: { operatorNumber: updated.operatorNumber }
    });
  } catch (e) {
  }
  
  return updated;
}

export async function addOperatorDocument(
  operatorId: string,
  data: {
    documentType: string;
    documentName: string;
    documentNumber?: string;
    fileUrl: string;
    fileType?: string;
    fileSizeBytes?: number;
    issueDate?: Date;
    expiryDate?: Date;
  }
): Promise<any> {
  const operator = await db.query.ccOperators.findFirst({
    where: eq(ccOperators.id, operatorId)
  });
  
  if (!operator) throw new Error('Operator not found');
  
  const [document] = await db.insert(ccOperatorDocuments).values({
    operatorId,
    documentType: data.documentType,
    documentName: data.documentName,
    documentNumber: data.documentNumber,
    fileUrl: data.fileUrl,
    fileType: data.fileType,
    fileSizeBytes: data.fileSizeBytes,
    issueDate: data.issueDate ? data.issueDate.toISOString().split('T')[0] : undefined,
    expiryDate: data.expiryDate ? data.expiryDate.toISOString().split('T')[0] : undefined,
    verificationStatus: 'pending'
  }).returning();
  
  return document;
}

export async function verifyDocument(
  documentId: string,
  verifiedBy: string,
  approved: boolean,
  rejectionReason?: string
): Promise<any> {
  const [updated] = await db.update(ccOperatorDocuments)
    .set({
      verificationStatus: approved ? 'verified' : 'rejected',
      verifiedBy,
      verifiedAt: new Date(),
      rejectionReason: approved ? null : rejectionReason,
      updatedAt: new Date()
    })
    .where(eq(ccOperatorDocuments.id, documentId))
    .returning();
  
  return updated;
}

export async function getExpiringDocuments(
  portalSlug: string,
  daysAhead: number = 30
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  const operators = await db.query.ccOperators.findMany({
    where: eq(ccOperators.portalId, portal.id)
  });
  
  const operatorIds = operators.map(o => o.id);
  
  if (operatorIds.length === 0) return [];
  
  return db.query.ccOperatorDocuments.findMany({
    where: and(
      inArray(ccOperatorDocuments.operatorId, operatorIds),
      lte(ccOperatorDocuments.expiryDate, cutoffDateStr),
      eq(ccOperatorDocuments.verificationStatus, 'verified')
    ),
    orderBy: [asc(ccOperatorDocuments.expiryDate)]
  });
}

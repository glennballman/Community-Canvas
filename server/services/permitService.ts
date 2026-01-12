import { db } from '../db';
import { eq, and, gte, lte, or, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { calculatePermitFee } from './authorityService';
import { ccVisitorPermits, ccPermitTypes, ccAuthorities, ccPortals } from '@shared/schema';

// ============ TYPES ============

interface CreatePermitRequest {
  portalSlug: string;
  permitTypeId: string;
  cartId?: string;
  tripId?: string;
  
  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;
  applicantAddress?: string;
  
  partySize?: number;
  partyMembers?: string[];
  
  validFrom: Date;
  validTo: Date;
  
  locationId?: string;
  activityDescription?: string;
  entryPoint?: string;
  exitPoint?: string;
  
  vesselName?: string;
  vesselRegistration?: string;
  vesselLengthFt?: number;
  
  applicantNotes?: string;
}

// ============ HELPERS ============

function generatePermitNumber(authorityCode: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `PRM-${authorityCode}-${dateStr}-${suffix}`;
}

function generateQRToken(): string {
  return nanoid(24);
}

function calculateDays(from: Date, to: Date): number {
  const diffTime = Math.abs(to.getTime() - from.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function calculateNights(from: Date, to: Date): number {
  const diffTime = Math.abs(to.getTime() - from.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============ PERMIT FUNCTIONS ============

export async function createPermit(req: CreatePermitRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const permitType = await db.query.ccPermitTypes.findFirst({
    where: eq(ccPermitTypes.id, req.permitTypeId)
  });
  
  if (!permitType) throw new Error('Permit type not found');
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: eq(ccAuthorities.id, permitType.authorityId)
  });
  
  if (!authority) throw new Error('Authority not found');
  
  if (authority.portalId !== portal.id) {
    throw new Error('Permit type does not belong to this portal');
  }
  
  const days = calculateDays(req.validFrom, req.validTo);
  const nights = calculateNights(req.validFrom, req.validTo);
  
  const feeCalc = await calculatePermitFee(req.permitTypeId, {
    persons: req.partySize || 1,
    days,
    nights
  });
  
  const permitNumber = generatePermitNumber(authority.code || 'GEN');
  const qrToken = generateQRToken();
  
  const [permit] = await db.insert(ccVisitorPermits).values({
    portalId: portal.id,
    authorityId: authority.id,
    permitTypeId: req.permitTypeId,
    cartId: req.cartId,
    tripId: req.tripId,
    permitNumber,
    applicantName: req.applicantName,
    applicantEmail: req.applicantEmail,
    applicantPhone: req.applicantPhone,
    applicantAddress: req.applicantAddress,
    partySize: req.partySize || 1,
    partyMembers: req.partyMembers,
    validFrom: req.validFrom.toISOString().split('T')[0],
    validTo: req.validTo.toISOString().split('T')[0],
    locationId: req.locationId,
    activityDescription: req.activityDescription,
    entryPoint: req.entryPoint,
    exitPoint: req.exitPoint,
    vesselName: req.vesselName,
    vesselRegistration: req.vesselRegistration,
    vesselLengthFt: req.vesselLengthFt?.toString(),
    baseFeeCad: feeCalc.baseFee.toString(),
    personFeeCad: feeCalc.personFee.toString(),
    dayFeeCad: feeCalc.dayFee.toString(),
    nightFeeCad: feeCalc.nightFee.toString(),
    totalFeeCad: feeCalc.totalFee.toString(),
    applicantNotes: req.applicantNotes,
    qrCodeToken: qrToken,
    status: 'draft'
  }).returning();
  
  return {
    permit,
    permitType,
    authority,
    feeBreakdown: feeCalc
  };
}

export async function getPermit(
  portalSlug: string,
  permitId: string
): Promise<{
  permit: any;
  permitType: any;
  authority: any;
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const permit = await db.query.ccVisitorPermits.findFirst({
    where: and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    )
  });
  
  if (!permit) return null;
  
  const permitType = await db.query.ccPermitTypes.findFirst({
    where: eq(ccPermitTypes.id, permit.permitTypeId)
  });
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: eq(ccAuthorities.id, permit.authorityId)
  });
  
  return { permit, permitType, authority };
}

export async function getPermitByNumber(
  portalSlug: string,
  permitNumber: string
): Promise<{
  permit: any;
  permitType: any;
  authority: any;
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const permit = await db.query.ccVisitorPermits.findFirst({
    where: and(
      eq(ccVisitorPermits.permitNumber, permitNumber),
      eq(ccVisitorPermits.portalId, portal.id)
    )
  });
  
  if (!permit) return null;
  
  return getPermit(portalSlug, permit.id);
}

export async function getPermitByQR(
  portalSlug: string,
  qrToken: string
): Promise<{
  permit: any;
  permitType: any;
  authority: any;
  valid: boolean;
  message: string;
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const permit = await db.query.ccVisitorPermits.findFirst({
    where: and(
      eq(ccVisitorPermits.qrCodeToken, qrToken),
      eq(ccVisitorPermits.portalId, portal.id)
    )
  });
  
  if (!permit) return null;
  
  const permitType = await db.query.ccPermitTypes.findFirst({
    where: eq(ccPermitTypes.id, permit.permitTypeId)
  });
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: eq(ccAuthorities.id, permit.authorityId)
  });
  
  const now = new Date();
  const validFrom = new Date(permit.validFrom);
  const validTo = new Date(permit.validTo);
  validTo.setHours(23, 59, 59, 999);
  
  let valid = false;
  let message = '';
  
  if (!['issued', 'active'].includes(permit.status)) {
    message = `Permit status: ${permit.status}`;
  } else if (now < validFrom) {
    message = `Permit not yet valid (starts ${permit.validFrom})`;
  } else if (now > validTo) {
    message = `Permit expired (ended ${permit.validTo})`;
  } else {
    valid = true;
    message = 'Permit is valid';
  }
  
  return { permit, permitType, authority, valid, message };
}

export async function searchPermits(
  portalSlug: string,
  options?: {
    authorityId?: string;
    permitTypeId?: string;
    status?: string;
    applicantEmail?: string;
    validOn?: Date;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccVisitorPermits.portalId, portal.id)];
  
  if (options?.authorityId) {
    conditions.push(eq(ccVisitorPermits.authorityId, options.authorityId));
  }
  
  if (options?.permitTypeId) {
    conditions.push(eq(ccVisitorPermits.permitTypeId, options.permitTypeId));
  }
  
  if (options?.status) {
    conditions.push(eq(ccVisitorPermits.status, options.status));
  }
  
  if (options?.applicantEmail) {
    conditions.push(eq(ccVisitorPermits.applicantEmail, options.applicantEmail));
  }
  
  if (options?.validOn) {
    const dateStr = options.validOn.toISOString().split('T')[0];
    conditions.push(lte(ccVisitorPermits.validFrom, dateStr));
    conditions.push(gte(ccVisitorPermits.validTo, dateStr));
  }
  
  return db.query.ccVisitorPermits.findMany({
    where: and(...conditions),
    orderBy: [desc(ccVisitorPermits.createdAt)],
    limit: options?.limit || 50
  });
}

export async function getPermitsForTrip(
  portalSlug: string,
  tripId: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  return db.query.ccVisitorPermits.findMany({
    where: and(
      eq(ccVisitorPermits.portalId, portal.id),
      eq(ccVisitorPermits.tripId, tripId)
    ),
    orderBy: [asc(ccVisitorPermits.validFrom)]
  });
}

// ============ STATUS TRANSITIONS ============

export async function submitPermit(
  portalSlug: string,
  permitId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccVisitorPermits)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function approvePermit(
  portalSlug: string,
  permitId: string,
  approvedBy: string,
  conditions?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const updates: Record<string, any> = {
    status: 'approved',
    approvedAt: new Date(),
    approvedBy,
    updatedAt: new Date()
  };
  
  if (conditions) {
    updates.specialConditions = conditions;
  }
  
  const [updated] = await db.update(ccVisitorPermits)
    .set(updates)
    .where(and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function issuePermit(
  portalSlug: string,
  permitId: string,
  paymentReference?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const permit = await db.query.ccVisitorPermits.findFirst({
    where: and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    )
  });
  
  if (!permit) throw new Error('Permit not found');
  
  const requiresPayment = Number(permit.totalFeeCad) > 0;
  
  const updates: Record<string, any> = {
    status: 'issued',
    issuedAt: new Date(),
    updatedAt: new Date()
  };
  
  if (requiresPayment) {
    updates.paymentStatus = 'paid';
    updates.paidAt = new Date();
    updates.paymentReference = paymentReference;
  } else {
    updates.paymentStatus = 'waived';
  }
  
  const [updated] = await db.update(ccVisitorPermits)
    .set(updates)
    .where(eq(ccVisitorPermits.id, permitId))
    .returning();
  
  return updated;
}

export async function activatePermit(
  portalSlug: string,
  permitId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccVisitorPermits)
    .set({
      status: 'active',
      updatedAt: new Date()
    })
    .where(and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function cancelPermit(
  portalSlug: string,
  permitId: string,
  reason?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccVisitorPermits)
    .set({
      status: 'cancelled',
      rejectionReason: reason,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function rejectPermit(
  portalSlug: string,
  permitId: string,
  reason: string,
  rejectedBy: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccVisitorPermits)
    .set({
      status: 'rejected',
      rejectionReason: reason,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccVisitorPermits.id, permitId),
      eq(ccVisitorPermits.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

// ============ EXPIRY MANAGEMENT ============

export async function expirePermits(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  const result = await db.update(ccVisitorPermits)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(
      or(
        eq(ccVisitorPermits.status, 'issued'),
        eq(ccVisitorPermits.status, 'active')
      ),
      lte(ccVisitorPermits.validTo, today)
    ))
    .returning();
  
  return result.length;
}

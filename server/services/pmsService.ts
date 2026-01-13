import { db } from '../db';
import { eq, and, or, gte, lte, asc, ne, lt, gt, sql } from 'drizzle-orm';
import { ccProperties, ccUnits, ccPmsReservations, ccPortals } from '@shared/schema';
import { nanoid } from 'nanoid';

// ============ HELPERS ============

function generatePropertyCode(name: string): string {
  const prefix = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `${prefix}-${suffix}`;
}

function generateConfirmationNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = nanoid(4).toUpperCase();
  return `RES-${dateStr}-${suffix}`;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============ PROPERTY FUNCTIONS ============

interface CreatePropertyRequest {
  portalSlug: string;
  name: string;
  code?: string;
  propertyType: string;
  description?: string;
  tagline?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  contactPhone?: string;
  contactEmail?: string;
  websiteUrl?: string;
  amenities?: string[];
  policies?: Record<string, any>;
  baseRateCad?: number;
  cleaningFeeCad?: number;
}

export async function createProperty(req: CreatePropertyRequest): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const code = req.code || generatePropertyCode(req.name);
  const slug = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  
  const [property] = await db.insert(ccProperties).values({
    portalId: portal.id,
    name: req.name,
    code,
    slug,
    propertyType: req.propertyType,
    description: req.description,
    tagline: req.tagline,
    addressLine1: req.addressLine1,
    city: req.city,
    province: req.province || 'BC',
    postalCode: req.postalCode,
    lat: req.lat?.toString(),
    lon: req.lon?.toString(),
    contactPhone: req.contactPhone,
    contactEmail: req.contactEmail,
    websiteUrl: req.websiteUrl,
    amenitiesJson: req.amenities || [],
    policiesJson: req.policies || {},
    baseRateCad: req.baseRateCad?.toString(),
    cleaningFeeCad: (req.cleaningFeeCad || 0).toString(),
    status: 'active'
  }).returning();
  
  return property;
}

export async function getProperties(
  portalSlug: string,
  options?: {
    propertyType?: string;
    status?: string;
    query?: string;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccProperties.portalId, portal.id)];
  
  if (options?.propertyType) {
    conditions.push(eq(ccProperties.propertyType, options.propertyType));
  }
  
  if (options?.status) {
    conditions.push(eq(ccProperties.status, options.status));
  } else {
    conditions.push(ne(ccProperties.status, 'draft'));
  }
  
  return db.query.ccProperties.findMany({
    where: and(...conditions),
    orderBy: [asc(ccProperties.name)]
  });
}

export async function getProperty(
  portalSlug: string,
  propertyId: string
): Promise<{
  property: any;
  units: any[];
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const property = await db.query.ccProperties.findFirst({
    where: and(
      eq(ccProperties.id, propertyId),
      eq(ccProperties.portalId, portal.id)
    )
  });
  
  if (!property) return null;
  
  const units = await db.query.ccUnits.findMany({
    where: eq(ccUnits.propertyId, propertyId),
    orderBy: [asc(ccUnits.sortOrder), asc(ccUnits.name)]
  });
  
  return { property, units };
}

export async function getPropertyBySlug(
  portalSlug: string,
  propertySlug: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const property = await db.query.ccProperties.findFirst({
    where: and(
      eq(ccProperties.slug, propertySlug),
      eq(ccProperties.portalId, portal.id)
    )
  });
  
  if (!property) return null;
  
  return getProperty(portalSlug, property.id);
}

// ============ UNIT FUNCTIONS ============

interface CreateUnitRequest {
  portalSlug: string;
  propertyId: string;
  name: string;
  code?: string;
  unitNumber?: string;
  unitType: string;
  description?: string;
  maxOccupancy?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  baseRateCad?: number;
  weekendRateCad?: number;
}

export async function createUnit(req: CreateUnitRequest): Promise<any> {
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
  
  if (!property) throw new Error('Property not found or access denied');
  
  const code = req.code || `${req.unitType.substring(0, 3).toUpperCase()}-${nanoid(3).toUpperCase()}`;
  
  const [unit] = await db.insert(ccUnits).values({
    propertyId: req.propertyId,
    name: req.name,
    code,
    unitNumber: req.unitNumber,
    unitType: req.unitType,
    description: req.description,
    maxOccupancy: req.maxOccupancy || 2,
    bedrooms: req.bedrooms || 1,
    bathrooms: (req.bathrooms || 1).toString(),
    amenitiesJson: req.amenities || [],
    baseRateCad: req.baseRateCad?.toString(),
    weekendRateCad: req.weekendRateCad?.toString(),
    status: 'available'
  }).returning();
  
  await updatePropertyUnitCount(req.propertyId);
  
  return unit;
}

async function updatePropertyUnitCount(propertyId: string): Promise<void> {
  const units = await db.query.ccUnits.findMany({
    where: eq(ccUnits.propertyId, propertyId)
  });
  
  const totalUnits = units.length;
  const maxOccupancy = units.reduce((sum, u) => sum + (u.maxOccupancy || 0), 0);
  
  await db.update(ccProperties)
    .set({
      totalUnits,
      maxOccupancy,
      updatedAt: new Date()
    })
    .where(eq(ccProperties.id, propertyId));
}

export async function getUnit(
  portalSlug: string,
  unitId: string
): Promise<{
  unit: any;
  property: any;
} | null> {
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, unitId)
  });
  
  if (!unit) return null;
  
  const propertyResult = await getProperty(portalSlug, unit.propertyId);
  if (!propertyResult) return null;
  
  return { unit, property: propertyResult.property };
}

export async function updateUnitStatus(
  portalSlug: string,
  unitId: string,
  status: string,
  cleanStatus?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, unitId)
  });
  
  if (!unit) throw new Error('Unit not found');
  
  const property = await db.query.ccProperties.findFirst({
    where: and(
      eq(ccProperties.id, unit.propertyId),
      eq(ccProperties.portalId, portal.id)
    )
  });
  
  if (!property) throw new Error('Unit not found or access denied');
  
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date()
  };
  
  if (cleanStatus) {
    updates.cleanStatus = cleanStatus;
    if (cleanStatus === 'clean' || cleanStatus === 'inspected') {
      updates.lastCleanedAt = new Date();
    }
  }
  
  const [updated] = await db.update(ccUnits)
    .set(updates)
    .where(eq(ccUnits.id, unitId))
    .returning();
  
  return updated;
}

export async function updateUnitStatusInternal(
  unitId: string,
  status?: string,
  cleanStatus?: string
): Promise<any> {
  const updates: Record<string, any> = {
    updatedAt: new Date()
  };
  
  if (status !== undefined) {
    updates.status = status;
  }
  
  if (cleanStatus) {
    updates.cleanStatus = cleanStatus;
    if (cleanStatus === 'clean' || cleanStatus === 'inspected') {
      updates.lastCleanedAt = new Date();
    }
  }
  
  const [updated] = await db.update(ccUnits)
    .set(updates)
    .where(eq(ccUnits.id, unitId))
    .returning();
  
  return updated;
}

// ============ AVAILABILITY CHECK ============

export async function checkAvailability(
  portalSlug: string,
  options: {
    propertyId?: string;
    unitId?: string;
    checkInDate: Date;
    checkOutDate: Date;
    guestCount?: number;
  }
): Promise<{
  available: boolean;
  units: any[];
  conflicts: any[];
}> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return { available: false, units: [], conflicts: [] };
  
  const checkIn = formatDate(options.checkInDate);
  const checkOut = formatDate(options.checkOutDate);
  
  let unitConditions: any[] = [eq(ccUnits.status, 'available')];
  
  if (options.unitId) {
    unitConditions.push(eq(ccUnits.id, options.unitId));
  } else if (options.propertyId) {
    unitConditions.push(eq(ccUnits.propertyId, options.propertyId));
  }
  
  if (options.guestCount) {
    unitConditions.push(gte(ccUnits.maxOccupancy, options.guestCount));
  }
  
  const units = await db.query.ccUnits.findMany({
    where: and(...unitConditions)
  });
  
  if (units.length === 0) {
    return { available: false, units: [], conflicts: [] };
  }
  
  const unitIds = units.map(u => u.id);
  
  const conflicts = await db.query.ccPmsReservations.findMany({
    where: and(
      sql`${ccPmsReservations.unitId} = ANY(ARRAY[${sql.raw(unitIds.map(id => `'${id}'::uuid`).join(','))}])`,
      ne(ccPmsReservations.status, 'cancelled'),
      ne(ccPmsReservations.status, 'no_show'),
      or(
        and(
          lte(ccPmsReservations.checkInDate, checkIn),
          gt(ccPmsReservations.checkOutDate, checkIn)
        ),
        and(
          lt(ccPmsReservations.checkInDate, checkOut),
          gte(ccPmsReservations.checkOutDate, checkIn)
        )
      )
    )
  });
  
  const conflictedUnitIds = new Set(conflicts.map(c => c.unitId));
  const availableUnits = units.filter(u => !conflictedUnitIds.has(u.id));
  
  return {
    available: availableUnits.length > 0,
    units: availableUnits,
    conflicts
  };
}

// ============ RESERVATION FUNCTIONS ============

interface CreateReservationRequest {
  portalSlug: string;
  propertyId: string;
  unitId: string;
  cartId?: string;
  tripId?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCount?: number;
  checkInDate: Date;
  checkOutDate: Date;
  expectedArrivalTime?: string;
  source?: string;
  sourceReference?: string;
  specialRequests?: string;
}

export async function createReservation(req: CreateReservationRequest): Promise<{
  reservation: any;
  pricing: {
    nights: number;
    baseRate: number;
    cleaningFee: number;
    taxRate: number;
    tax: number;
    total: number;
  };
}> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, req.unitId)
  });
  
  if (!unit) throw new Error('Unit not found');
  
  const property = await db.query.ccProperties.findFirst({
    where: eq(ccProperties.id, req.propertyId)
  });
  
  if (!property) throw new Error('Property not found');
  
  const availability = await checkAvailability(req.portalSlug, {
    unitId: req.unitId,
    checkInDate: req.checkInDate,
    checkOutDate: req.checkOutDate
  });
  
  if (!availability.available) {
    throw new Error('Unit not available for selected dates');
  }
  
  const checkIn = formatDate(req.checkInDate);
  const checkOut = formatDate(req.checkOutDate);
  const nights = Math.ceil((req.checkOutDate.getTime() - req.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const baseRate = parseFloat(unit.baseRateCad || property.baseRateCad || '0') * nights;
  const cleaningFee = parseFloat(property.cleaningFeeCad || '0');
  const taxRate = parseFloat(property.taxRatePercent || '13');
  const subtotal = baseRate + cleaningFee;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  
  const confirmationNumber = generateConfirmationNumber();
  
  const [reservation] = await db.insert(ccPmsReservations).values({
    portalId: portal.id,
    propertyId: req.propertyId,
    unitId: req.unitId,
    cartId: req.cartId,
    tripId: req.tripId,
    confirmationNumber,
    guestName: req.guestName,
    guestEmail: req.guestEmail,
    guestPhone: req.guestPhone,
    guestCount: req.guestCount || 1,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    expectedArrivalTime: req.expectedArrivalTime,
    baseRateCad: baseRate.toFixed(2),
    cleaningFeeCad: cleaningFee.toFixed(2),
    taxCad: tax.toFixed(2),
    totalCad: total.toFixed(2),
    balanceCad: total.toFixed(2),
    source: req.source || 'direct',
    sourceReference: req.sourceReference,
    specialRequests: req.specialRequests,
    status: 'pending'
  }).returning();
  
  return {
    reservation,
    pricing: {
      nights,
      baseRate,
      cleaningFee,
      taxRate,
      tax,
      total
    }
  };
}

export async function getReservation(
  portalSlug: string,
  reservationId: string
): Promise<{
  reservation: any;
  unit: any;
  property: any;
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const reservation = await db.query.ccPmsReservations.findFirst({
    where: and(
      eq(ccPmsReservations.id, reservationId),
      eq(ccPmsReservations.portalId, portal.id)
    )
  });
  
  if (!reservation) return null;
  
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, reservation.unitId)
  });
  
  const property = await db.query.ccProperties.findFirst({
    where: eq(ccProperties.id, reservation.propertyId)
  });
  
  return { reservation, unit, property };
}

export async function getReservationByConfirmation(
  portalSlug: string,
  confirmationNumber: string
): Promise<any | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const reservation = await db.query.ccPmsReservations.findFirst({
    where: and(
      eq(ccPmsReservations.confirmationNumber, confirmationNumber),
      eq(ccPmsReservations.portalId, portal.id)
    )
  });
  
  if (!reservation) return null;
  
  return getReservation(portalSlug, reservation.id);
}

export async function searchReservations(
  portalSlug: string,
  options?: {
    propertyId?: string;
    unitId?: string;
    status?: string;
    checkInFrom?: Date;
    checkInTo?: Date;
    guestEmail?: string;
    limit?: number;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccPmsReservations.portalId, portal.id)];
  
  if (options?.propertyId) {
    conditions.push(eq(ccPmsReservations.propertyId, options.propertyId));
  }
  
  if (options?.unitId) {
    conditions.push(eq(ccPmsReservations.unitId, options.unitId));
  }
  
  if (options?.status) {
    conditions.push(eq(ccPmsReservations.status, options.status));
  }
  
  if (options?.checkInFrom) {
    conditions.push(gte(ccPmsReservations.checkInDate, formatDate(options.checkInFrom)));
  }
  
  if (options?.checkInTo) {
    conditions.push(lte(ccPmsReservations.checkInDate, formatDate(options.checkInTo)));
  }
  
  if (options?.guestEmail) {
    conditions.push(eq(ccPmsReservations.guestEmail, options.guestEmail));
  }
  
  return db.query.ccPmsReservations.findMany({
    where: and(...conditions),
    orderBy: [asc(ccPmsReservations.checkInDate)],
    limit: options?.limit || 50
  });
}

// ============ STATUS TRANSITIONS ============

export async function confirmReservation(
  portalSlug: string,
  reservationId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccPmsReservations)
    .set({
      status: 'confirmed',
      confirmedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(ccPmsReservations.id, reservationId),
      eq(ccPmsReservations.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

export async function checkInGuest(
  portalSlug: string,
  reservationId: string,
  actualArrivalTime?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccPmsReservations)
    .set({
      status: 'checked_in',
      checkedInAt: new Date(),
      actualArrivalTime: actualArrivalTime || new Date().toTimeString().slice(0, 5),
      updatedAt: new Date()
    })
    .where(and(
      eq(ccPmsReservations.id, reservationId),
      eq(ccPmsReservations.portalId, portal.id)
    ))
    .returning();
  
  if (updated) {
    await updateUnitStatusInternal(updated.unitId, 'occupied');
  }
  
  return updated;
}

export async function checkOutGuest(
  portalSlug: string,
  reservationId: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccPmsReservations)
    .set({
      status: 'checked_out',
      checkedOutAt: new Date(),
      actualDepartureTime: new Date().toTimeString().slice(0, 5),
      updatedAt: new Date()
    })
    .where(and(
      eq(ccPmsReservations.id, reservationId),
      eq(ccPmsReservations.portalId, portal.id)
    ))
    .returning();
  
  if (updated) {
    await updateUnitStatusInternal(updated.unitId, 'available', 'dirty');
  }
  
  return updated;
}

export async function cancelReservation(
  portalSlug: string,
  reservationId: string,
  reason?: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccPmsReservations)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccPmsReservations.id, reservationId),
      eq(ccPmsReservations.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

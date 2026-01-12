import { db } from '../db';
import { eq, and, gte, lte, asc, desc, sql, or } from 'drizzle-orm';
import { 
  ccUnitCalendar, ccSeasonalRules, ccPmsReservations,
  ccUnits, ccProperties, ccPortals
} from '@shared/schema';

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CalendarDay {
  date: string;
  availability: string;
  rateCad: number;
  minStayNights: number;
  source: string;
  notes?: string;
  reservationId?: string;
}

interface BlockDatesRequest {
  portalSlug: string;
  unitId: string;
  startDate: Date;
  endDate: Date;
  availability: string;
  reason?: string;
  blockedBy?: string;
}

export async function getUnitCalendar(
  portalSlug: string,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarDay[]> {
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
  
  const baseRate = Number(unit.baseRateCad) || Number(property.baseRateCad) || 0;
  
  const calendarEntries = await db.query.ccUnitCalendar.findMany({
    where: and(
      eq(ccUnitCalendar.unitId, unitId),
      gte(ccUnitCalendar.calendarDate, formatDate(startDate)),
      lte(ccUnitCalendar.calendarDate, formatDate(endDate))
    ),
    orderBy: [asc(ccUnitCalendar.calendarDate)]
  });
  
  const rules = await getApplicableRules(portalSlug, property.id, unitId, startDate, endDate);
  
  const calendar: CalendarDay[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dateStr = formatDate(current);
    const entry = calendarEntries.find(e => e.calendarDate === dateStr);
    
    const { rate, minStay } = calculateDayRate(current, baseRate, rules);
    
    calendar.push({
      date: dateStr,
      availability: entry?.availability || 'available',
      rateCad: entry?.rateCad ? Number(entry.rateCad) : rate,
      minStayNights: entry?.minStayNights || minStay || 1,
      source: entry?.source || 'default',
      notes: entry?.notes ?? undefined,
      reservationId: entry?.sourceId ?? undefined
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return calendar;
}

async function getApplicableRules(
  portalSlug: string,
  propertyId: string,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const rules = await db.query.ccSeasonalRules.findMany({
    where: and(
      eq(ccSeasonalRules.status, 'active'),
      or(
        eq(ccSeasonalRules.portalId, portal.id),
        eq(ccSeasonalRules.propertyId, propertyId),
        eq(ccSeasonalRules.unitId, unitId)
      )
    ),
    orderBy: [desc(ccSeasonalRules.priority)]
  });
  
  return rules.sort((a, b) => {
    const aPriority = a.priority ?? 0;
    const bPriority = b.priority ?? 0;
    if (bPriority !== aPriority) return bPriority - aPriority;
    if (a.unitId && !b.unitId) return -1;
    if (!a.unitId && b.unitId) return 1;
    if (a.propertyId && !b.propertyId) return -1;
    if (!a.propertyId && b.propertyId) return 1;
    if (a.startDate && !b.startDate) return -1;
    if (!a.startDate && b.startDate) return 1;
    return 0;
  });
}

function calculateDayRate(
  date: Date,
  baseRate: number,
  rules: any[]
): { rate: number; minStay: number | null } {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = formatDate(date);
  
  let rate = baseRate;
  let minStay: number | null = null;
  
  for (const rule of rules) {
    let applies = false;
    
    if (rule.startDate && rule.endDate) {
      applies = dateStr >= rule.startDate && dateStr <= rule.endDate;
    } else if (rule.startMonth && rule.endMonth) {
      if (rule.startMonth <= rule.endMonth) {
        applies = month >= rule.startMonth && month <= rule.endMonth;
        if (applies && rule.startDay && month === rule.startMonth) {
          applies = day >= rule.startDay;
        }
        if (applies && rule.endDay && month === rule.endMonth) {
          applies = day <= rule.endDay;
        }
      } else {
        applies = month >= rule.startMonth || month <= rule.endMonth;
      }
    }
    
    if (applies) {
      if (rule.rateType === 'fixed') {
        rate = Number(rule.rateValue);
      } else if (rule.rateType === 'multiplier') {
        rate = baseRate * Number(rule.rateValue);
      } else if (rule.rateType === 'adjustment') {
        rate = baseRate + Number(rule.rateValue);
      }
      
      if (rule.minStayNights) {
        minStay = rule.minStayNights;
      }
      
      break;
    }
  }
  
  return { rate: Math.floor(rate * 100 + 0.5) / 100, minStay };
}

export async function blockDates(req: BlockDatesRequest): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, req.portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, req.unitId)
  });
  
  if (!unit) throw new Error('Unit not found');
  
  const property = await db.query.ccProperties.findFirst({
    where: eq(ccProperties.id, unit.propertyId)
  });
  
  if (!property || property.portalId !== portal.id) {
    throw new Error('Unit does not belong to this portal');
  }
  
  const blocked: any[] = [];
  const current = new Date(req.startDate);
  const end = new Date(req.endDate);
  
  while (current <= end) {
    const dateStr = formatDate(current);
    
    const [entry] = await db.insert(ccUnitCalendar)
      .values({
        unitId: req.unitId,
        calendarDate: dateStr,
        availability: req.availability,
        source: 'manual',
        blockReason: req.reason,
        blockedBy: req.blockedBy,
        blockedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [ccUnitCalendar.unitId, ccUnitCalendar.calendarDate],
        set: {
          availability: req.availability,
          source: 'manual',
          blockReason: req.reason,
          blockedBy: req.blockedBy,
          blockedAt: new Date(),
          updatedAt: new Date()
        }
      })
      .returning();
    
    blocked.push(entry);
    current.setDate(current.getDate() + 1);
  }
  
  return blocked;
}

export async function unblockDates(
  portalSlug: string,
  unitId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const unit = await db.query.ccUnits.findFirst({
    where: eq(ccUnits.id, unitId)
  });
  
  if (!unit) throw new Error('Unit not found');
  
  const property = await db.query.ccProperties.findFirst({
    where: eq(ccProperties.id, unit.propertyId)
  });
  
  if (!property || property.portalId !== portal.id) {
    throw new Error('Unit does not belong to this portal');
  }
  
  const result = await db.delete(ccUnitCalendar)
    .where(and(
      eq(ccUnitCalendar.unitId, unitId),
      gte(ccUnitCalendar.calendarDate, formatDate(startDate)),
      lte(ccUnitCalendar.calendarDate, formatDate(endDate)),
      eq(ccUnitCalendar.source, 'manual')
    ))
    .returning();
  
  return result.length;
}

export async function syncReservationToCalendar(
  reservationId: string
): Promise<void> {
  const reservation = await db.query.ccPmsReservations.findFirst({
    where: eq(ccPmsReservations.id, reservationId)
  });
  
  if (!reservation) return;
  
  const availability = ['cancelled', 'no_show'].includes(reservation.status || '') 
    ? 'available' 
    : 'booked';
  
  const current = new Date(reservation.checkInDate);
  const end = new Date(reservation.checkOutDate);
  end.setDate(end.getDate() - 1);
  
  while (current <= end) {
    await db.insert(ccUnitCalendar)
      .values({
        unitId: reservation.unitId,
        calendarDate: formatDate(current),
        availability,
        source: 'reservation',
        sourceId: reservation.id,
        sourceRef: reservation.confirmationNumber
      })
      .onConflictDoUpdate({
        target: [ccUnitCalendar.unitId, ccUnitCalendar.calendarDate],
        set: {
          availability,
          source: 'reservation',
          sourceId: reservation.id,
          sourceRef: reservation.confirmationNumber,
          updatedAt: new Date()
        }
      });
    
    current.setDate(current.getDate() + 1);
  }
}

export async function getPropertyAvailability(
  portalSlug: string,
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  property: any;
  unitAvailability: {
    unit: any;
    availableDates: string[];
    blockedDates: string[];
    bookedDates: string[];
  }[];
  summary: {
    totalUnits: number;
    fullyAvailable: number;
    partiallyAvailable: number;
    fullyBooked: number;
  };
}> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) {
    return {
      property: null,
      unitAvailability: [],
      summary: { totalUnits: 0, fullyAvailable: 0, partiallyAvailable: 0, fullyBooked: 0 }
    };
  }
  
  const property = await db.query.ccProperties.findFirst({
    where: and(
      eq(ccProperties.id, propertyId),
      eq(ccProperties.portalId, portal.id)
    )
  });
  
  if (!property) {
    return {
      property: null,
      unitAvailability: [],
      summary: { totalUnits: 0, fullyAvailable: 0, partiallyAvailable: 0, fullyBooked: 0 }
    };
  }
  
  const units = await db.query.ccUnits.findMany({
    where: eq(ccUnits.propertyId, propertyId),
    orderBy: [asc(ccUnits.sortOrder), asc(ccUnits.name)]
  });
  
  const unitAvailability: any[] = [];
  let fullyAvailable = 0;
  let partiallyAvailable = 0;
  let fullyBooked = 0;
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  for (const unit of units) {
    const calendar = await getUnitCalendar(portalSlug, unit.id, startDate, endDate);
    
    const availableDates = calendar.filter(d => d.availability === 'available').map(d => d.date);
    const blockedDates = calendar.filter(d => ['blocked', 'owner_use', 'maintenance', 'seasonal_close'].includes(d.availability)).map(d => d.date);
    const bookedDates = calendar.filter(d => d.availability === 'booked').map(d => d.date);
    
    unitAvailability.push({
      unit,
      availableDates,
      blockedDates,
      bookedDates
    });
    
    if (availableDates.length === totalDays) {
      fullyAvailable++;
    } else if (bookedDates.length + blockedDates.length === totalDays) {
      fullyBooked++;
    } else {
      partiallyAvailable++;
    }
  }
  
  return {
    property,
    unitAvailability,
    summary: {
      totalUnits: units.length,
      fullyAvailable,
      partiallyAvailable,
      fullyBooked
    }
  };
}

export async function getSeasonalRules(
  portalSlug: string,
  propertyId?: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccSeasonalRules.portalId, portal.id)];
  
  if (propertyId) {
    conditions.push(
      or(
        eq(ccSeasonalRules.propertyId, propertyId),
        sql`${ccSeasonalRules.propertyId} IS NULL`
      )
    );
  }
  
  return db.query.ccSeasonalRules.findMany({
    where: and(...conditions),
    orderBy: [desc(ccSeasonalRules.priority), asc(ccSeasonalRules.name)]
  });
}

export async function createSeasonalRule(
  portalSlug: string,
  data: {
    propertyId?: string;
    unitId?: string;
    name: string;
    code?: string;
    startDate?: string;
    endDate?: string;
    startMonth?: number;
    startDay?: number;
    endMonth?: number;
    endDay?: number;
    rateType: string;
    rateValue: number;
    minStayNights?: number;
    priority?: number;
  }
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [rule] = await db.insert(ccSeasonalRules).values({
    portalId: portal.id,
    propertyId: data.propertyId,
    unitId: data.unitId,
    name: data.name,
    code: data.code,
    startDate: data.startDate,
    endDate: data.endDate,
    startMonth: data.startMonth,
    startDay: data.startDay,
    endMonth: data.endMonth,
    endDay: data.endDay,
    rateType: data.rateType,
    rateValue: String(data.rateValue),
    minStayNights: data.minStayNights,
    priority: data.priority || 0,
    status: 'active'
  }).returning();
  
  return rule;
}

export async function updateSeasonalRule(
  portalSlug: string,
  ruleId: string,
  updates: Partial<{
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    rateType: string;
    rateValue: number;
    minStayNights: number;
    priority: number;
    status: string;
  }>
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const rule = await db.query.ccSeasonalRules.findFirst({
    where: and(
      eq(ccSeasonalRules.id, ruleId),
      eq(ccSeasonalRules.portalId, portal.id)
    )
  });
  
  if (!rule) throw new Error('Rule not found');
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.code !== undefined) updateData.code = updates.code;
  if (updates.startDate !== undefined) updateData.startDate = updates.startDate;
  if (updates.endDate !== undefined) updateData.endDate = updates.endDate;
  if (updates.startMonth !== undefined) updateData.startMonth = updates.startMonth;
  if (updates.startDay !== undefined) updateData.startDay = updates.startDay;
  if (updates.endMonth !== undefined) updateData.endMonth = updates.endMonth;
  if (updates.endDay !== undefined) updateData.endDay = updates.endDay;
  if (updates.rateType !== undefined) updateData.rateType = updates.rateType;
  if (updates.rateValue !== undefined) updateData.rateValue = String(updates.rateValue);
  if (updates.minStayNights !== undefined) updateData.minStayNights = updates.minStayNights;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.status !== undefined) updateData.status = updates.status;
  
  const [updated] = await db.update(ccSeasonalRules)
    .set(updateData)
    .where(eq(ccSeasonalRules.id, ruleId))
    .returning();
  
  return updated;
}

export async function deleteSeasonalRule(
  portalSlug: string,
  ruleId: string
): Promise<boolean> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const result = await db.delete(ccSeasonalRules)
    .where(and(
      eq(ccSeasonalRules.id, ruleId),
      eq(ccSeasonalRules.portalId, portal.id)
    ))
    .returning();
  
  return result.length > 0;
}

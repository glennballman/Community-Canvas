import { db } from '../db';
import { eq, and, gte, lte, asc, desc, sql, or, ne } from 'drizzle-orm';
import {
  ccPortals, ccProperties, ccUnits, ccPmsReservations,
  ccHousekeepingTasks, ccMaintenanceRequests, ccComplianceChecks,
  ccIncidentReports, ccCitations, ccTransportOperators, ccSailings,
  ccTransportRequests, ccFreightManifests, ccTransportAlerts,
  ccVerifiedIdentities
} from '@shared/schema';

interface DashboardSummary {
  date: string;
  properties: PropertySummary;
  operations: OperationsSummary;
  transport: TransportSummary;
  compliance: ComplianceSummary;
  revenue: RevenueSummary;
}

interface PropertySummary {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  maintenanceUnits: number;
  occupancyRate: number;
}

interface OperationsSummary {
  arrivalsToday: number;
  departuresToday: number;
  inHouseGuests: number;
  pendingHousekeeping: number;
  inProgressHousekeeping: number;
  openMaintenanceRequests: number;
  urgentMaintenance: number;
}

interface TransportSummary {
  sailingsToday: number;
  passengersBooked: number;
  freightManifests: number;
  pendingPickups: number;
  pendingDeliveries: number;
  activeAlerts: number;
}

interface ComplianceSummary {
  scheduledChecks: number;
  openIncidents: number;
  unpaidCitations: number;
  totalUnpaidFines: number;
}

interface RevenueSummary {
  reservationsToday: number;
  revenueToday: number;
  reservationsMonth: number;
  revenueMonth: number;
  pendingPayments: number;
}

export async function getDashboardSummary(
  portalSlug: string,
  date?: Date
): Promise<DashboardSummary | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const [properties, operations, transport, compliance, revenue] = await Promise.all([
    getPropertySummary(portal.id),
    getOperationsSummary(portal.id, targetDate),
    getTransportSummary(portal.id, targetDate),
    getComplianceSummary(portal.id),
    getRevenueSummary(portal.id, targetDate)
  ]);
  
  return {
    date: dateStr,
    properties,
    operations,
    transport,
    compliance,
    revenue
  };
}

async function getPropertySummary(portalId: string): Promise<PropertySummary> {
  const properties = await db.query.ccProperties.findMany({
    where: and(
      eq(ccProperties.portalId, portalId),
      eq(ccProperties.status, 'active')
    )
  });
  
  const units = await db.query.ccUnits.findMany({
    where: sql`${ccUnits.propertyId} IN (
      SELECT id FROM cc_properties WHERE portal_id = ${portalId} AND status = 'active'
    )`
  });
  
  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === 'occupied').length;
  const availableUnits = units.filter(u => u.status === 'available').length;
  const maintenanceUnits = units.filter(u => u.status === 'maintenance').length;
  
  const occupancyRate = totalUnits > 0 
    ? Math.round((occupiedUnits / totalUnits) * 100) 
    : 0;
  
  return {
    totalProperties: properties.length,
    totalUnits,
    occupiedUnits,
    availableUnits,
    maintenanceUnits,
    occupancyRate
  };
}

async function getOperationsSummary(portalId: string, date: Date): Promise<OperationsSummary> {
  const dateStr = date.toISOString().split('T')[0];
  
  const arrivals = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portalId),
      sql`${ccPmsReservations.checkInDate}::date = ${dateStr}::date`,
      or(
        eq(ccPmsReservations.status, 'confirmed'),
        eq(ccPmsReservations.status, 'pending')
      )
    )
  });
  
  const departures = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portalId),
      sql`${ccPmsReservations.checkOutDate}::date = ${dateStr}::date`,
      eq(ccPmsReservations.status, 'checked_in')
    )
  });
  
  const inHouse = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portalId),
      eq(ccPmsReservations.status, 'checked_in')
    )
  });
  
  const housekeepingTasks = await db.query.ccHousekeepingTasks.findMany({
    where: and(
      eq(ccHousekeepingTasks.portalId, portalId),
      sql`${ccHousekeepingTasks.scheduledDate}::date = ${dateStr}::date`
    )
  });
  
  const pendingHousekeeping = housekeepingTasks.filter(t => 
    t.status && ['pending', 'assigned'].includes(t.status)
  ).length;
  
  const inProgressHousekeeping = housekeepingTasks.filter(t => 
    t.status === 'in_progress'
  ).length;
  
  const maintenanceRequests = await db.query.ccMaintenanceRequests.findMany({
    where: and(
      eq(ccMaintenanceRequests.portalId, portalId),
      or(
        eq(ccMaintenanceRequests.status, 'reported'),
        eq(ccMaintenanceRequests.status, 'triaged'),
        eq(ccMaintenanceRequests.status, 'assigned'),
        eq(ccMaintenanceRequests.status, 'in_progress')
      )
    )
  });
  
  const urgentMaintenance = maintenanceRequests.filter(m =>
    m.priority && ['urgent', 'emergency'].includes(m.priority)
  ).length;
  
  return {
    arrivalsToday: arrivals.length,
    departuresToday: departures.length,
    inHouseGuests: inHouse.reduce((sum, r) => sum + (r.guestCount || 1), 0),
    pendingHousekeeping,
    inProgressHousekeeping,
    openMaintenanceRequests: maintenanceRequests.length,
    urgentMaintenance
  };
}

async function getTransportSummary(portalId: string, date: Date): Promise<TransportSummary> {
  const dateStr = date.toISOString().split('T')[0];
  
  const sailings = await db.query.ccSailings.findMany({
    where: sql`${ccSailings.operatorId} IN (
      SELECT id FROM cc_transport_operators WHERE portal_id = ${portalId}
    ) AND ${ccSailings.sailingDate}::date = ${dateStr}::date`
  });
  
  const transportRequests = await db.query.ccTransportRequests.findMany({
    where: and(
      eq(ccTransportRequests.portalId, portalId),
      sql`${ccTransportRequests.requestedDate}::date = ${dateStr}::date`,
      ne(ccTransportRequests.status, 'cancelled')
    )
  });
  
  const passengersBooked = transportRequests.reduce((sum, r) => 
    sum + (r.passengerCount || 0), 0
  );
  
  const manifests = await db.query.ccFreightManifests.findMany({
    where: sql`${ccFreightManifests.operatorId} IN (
      SELECT id FROM cc_transport_operators WHERE portal_id = ${portalId}
    ) AND ${ccFreightManifests.manifestDate}::date = ${dateStr}::date`
  });
  
  const pendingPickups = manifests.filter(m => 
    m.status && ['draft', 'submitted', 'accepted'].includes(m.status)
  ).length;
  
  const pendingDeliveries = manifests.filter(m =>
    m.status && ['arrived'].includes(m.status)
  ).length;
  
  const alerts = await db.query.ccTransportAlerts.findMany({
    where: sql`${ccTransportAlerts.operatorId} IN (
      SELECT id FROM cc_transport_operators WHERE portal_id = ${portalId}
    ) AND ${ccTransportAlerts.status} = 'active'`
  });
  
  return {
    sailingsToday: sailings.length,
    passengersBooked,
    freightManifests: manifests.length,
    pendingPickups,
    pendingDeliveries,
    activeAlerts: alerts.length
  };
}

async function getComplianceSummary(portalId: string): Promise<ComplianceSummary> {
  const checks = await db.query.ccComplianceChecks.findMany({
    where: and(
      eq(ccComplianceChecks.portalId, portalId),
      eq(ccComplianceChecks.status, 'scheduled')
    )
  });
  
  const incidents = await db.query.ccIncidentReports.findMany({
    where: and(
      eq(ccIncidentReports.portalId, portalId),
      or(
        eq(ccIncidentReports.status, 'reported'),
        eq(ccIncidentReports.status, 'investigating')
      )
    )
  });
  
  const citations = await db.query.ccCitations.findMany({
    where: and(
      eq(ccCitations.portalId, portalId),
      eq(ccCitations.paymentStatus, 'unpaid')
    )
  });
  
  const totalUnpaidFines = citations.reduce((sum, c) => 
    sum + (Number(c.fineAmountCad) - Number(c.amountPaidCad || 0)), 0
  );
  
  return {
    scheduledChecks: checks.length,
    openIncidents: incidents.length,
    unpaidCitations: citations.length,
    totalUnpaidFines: Math.round(totalUnpaidFines * 100) / 100
  };
}

async function getRevenueSummary(portalId: string, date: Date): Promise<RevenueSummary> {
  const dateStr = date.toISOString().split('T')[0];
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
  const todayReservations = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portalId),
      sql`${ccPmsReservations.createdAt}::date = ${dateStr}::date`
    )
  });
  
  const revenueToday = todayReservations.reduce((sum, r) => 
    sum + Number(r.totalCad || 0), 0
  );
  
  const monthReservations = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portalId),
      gte(ccPmsReservations.createdAt, monthStart),
      lte(ccPmsReservations.createdAt, monthEnd)
    )
  });
  
  const revenueMonth = monthReservations.reduce((sum, r) => 
    sum + Number(r.totalCad || 0), 0
  );
  
  const pendingPayments = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portalId),
      eq(ccPmsReservations.paymentStatus, 'pending')
    )
  });
  
  return {
    reservationsToday: todayReservations.length,
    revenueToday: Math.round(revenueToday * 100) / 100,
    reservationsMonth: monthReservations.length,
    revenueMonth: Math.round(revenueMonth * 100) / 100,
    pendingPayments: pendingPayments.length
  };
}

export async function getArrivalsBoard(
  portalSlug: string,
  date?: Date
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const arrivals = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portal.id),
      sql`${ccPmsReservations.checkInDate}::date = ${dateStr}::date`,
      or(
        eq(ccPmsReservations.status, 'pending'),
        eq(ccPmsReservations.status, 'confirmed'),
        eq(ccPmsReservations.status, 'checked_in')
      )
    ),
    orderBy: [asc(ccPmsReservations.expectedArrivalTime)]
  });
  
  const enriched = await Promise.all(arrivals.map(async (r) => {
    const property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, r.propertyId)
    });
    const unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, r.unitId)
    });
    
    return {
      reservation: {
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        status: r.status,
        guestName: r.guestName,
        guestCount: r.guestCount,
        expectedArrivalTime: r.expectedArrivalTime,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        guestNotes: r.guestNotes
      },
      property: property ? { id: property.id, name: property.name } : null,
      unit: unit ? { id: unit.id, name: unit.name, code: unit.code, cleanStatus: unit.cleanStatus } : null
    };
  }));
  
  return enriched;
}

export async function getDeparturesBoard(
  portalSlug: string,
  date?: Date
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const departures = await db.query.ccPmsReservations.findMany({
    where: and(
      eq(ccPmsReservations.portalId, portal.id),
      sql`${ccPmsReservations.checkOutDate}::date = ${dateStr}::date`,
      or(
        eq(ccPmsReservations.status, 'checked_in'),
        eq(ccPmsReservations.status, 'checked_out')
      )
    ),
    orderBy: [asc(ccPmsReservations.expectedDepartureTime)]
  });
  
  const enriched = await Promise.all(departures.map(async (r) => {
    const property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, r.propertyId)
    });
    const unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, r.unitId)
    });
    
    const housekeeping = await db.query.ccHousekeepingTasks.findFirst({
      where: and(
        eq(ccHousekeepingTasks.unitId, r.unitId),
        sql`${ccHousekeepingTasks.scheduledDate}::date = ${dateStr}::date`
      )
    });
    
    return {
      reservation: {
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        status: r.status,
        guestName: r.guestName,
        balanceDue: Number(r.balanceCad || 0)
      },
      property: property ? { id: property.id, name: property.name } : null,
      unit: unit ? { id: unit.id, name: unit.name, code: unit.code } : null,
      housekeeping: housekeeping ? {
        id: housekeeping.id,
        status: housekeeping.status,
        assignedTo: housekeeping.assignedTo
      } : null
    };
  }));
  
  return enriched;
}

export async function getHousekeepingBoard(
  portalSlug: string,
  date?: Date
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const tasks = await db.query.ccHousekeepingTasks.findMany({
    where: and(
      eq(ccHousekeepingTasks.portalId, portal.id),
      sql`${ccHousekeepingTasks.scheduledDate}::date = ${dateStr}::date`,
      ne(ccHousekeepingTasks.status, 'cancelled')
    ),
    orderBy: [
      desc(sql`CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END`),
      asc(ccHousekeepingTasks.scheduledTime)
    ]
  });
  
  const enriched = await Promise.all(tasks.map(async (t) => {
    const property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, t.propertyId)
    });
    const unit = await db.query.ccUnits.findFirst({
      where: eq(ccUnits.id, t.unitId)
    });
    
    let nextArrival = null;
    if (t.checkinReservationId) {
      const reservation = await db.query.ccPmsReservations.findFirst({
        where: eq(ccPmsReservations.id, t.checkinReservationId)
      });
      if (reservation) {
        nextArrival = {
          guestName: reservation.guestName,
          expectedTime: reservation.expectedArrivalTime
        };
      }
    }
    
    return {
      task: {
        id: t.id,
        taskNumber: t.taskNumber,
        taskType: t.taskType,
        priority: t.priority,
        status: t.status,
        scheduledTime: t.scheduledTime,
        assignedTo: t.assignedTo,
        estimatedMinutes: t.estimatedMinutes
      },
      property: property ? { id: property.id, name: property.name } : null,
      unit: unit ? { id: unit.id, name: unit.name, code: unit.code } : null,
      nextArrival
    };
  }));
  
  return enriched;
}

export async function getMaintenanceBoard(
  portalSlug: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const requests = await db.query.ccMaintenanceRequests.findMany({
    where: and(
      eq(ccMaintenanceRequests.portalId, portal.id),
      or(
        eq(ccMaintenanceRequests.status, 'reported'),
        eq(ccMaintenanceRequests.status, 'triaged'),
        eq(ccMaintenanceRequests.status, 'assigned'),
        eq(ccMaintenanceRequests.status, 'scheduled'),
        eq(ccMaintenanceRequests.status, 'in_progress'),
        eq(ccMaintenanceRequests.status, 'parts_ordered')
      )
    ),
    orderBy: [
      desc(sql`CASE priority WHEN 'emergency' THEN 5 WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END`),
      asc(ccMaintenanceRequests.createdAt)
    ]
  });
  
  const enriched = await Promise.all(requests.map(async (r) => {
    const property = await db.query.ccProperties.findFirst({
      where: eq(ccProperties.id, r.propertyId)
    });
    let unit = null;
    if (r.unitId) {
      unit = await db.query.ccUnits.findFirst({
        where: eq(ccUnits.id, r.unitId)
      });
    }
    
    const ageHours = r.createdAt 
      ? Math.round((Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60))
      : 0;
    
    return {
      request: {
        id: r.id,
        requestNumber: r.requestNumber,
        title: r.title,
        category: r.category,
        priority: r.priority,
        status: r.status,
        assignedTo: r.assignedTo,
        assignedVendor: r.assignedVendor,
        affectsHabitability: r.affectsHabitability,
        ageHours
      },
      property: property ? { id: property.id, name: property.name } : null,
      unit: unit ? { id: unit.id, name: unit.name, code: unit.code } : null
    };
  }));
  
  return enriched;
}

export async function getTransportBoard(
  portalSlug: string,
  date?: Date
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  
  const operators = await db.query.ccTransportOperators.findMany({
    where: eq(ccTransportOperators.portalId, portal.id)
  });
  
  const operatorIds = operators.map(o => o.id);
  
  if (operatorIds.length === 0) return [];
  
  const sailings = await db.query.ccSailings.findMany({
    where: and(
      sql`${ccSailings.operatorId} = ANY(ARRAY[${sql.raw(operatorIds.map(id => `'${id}'`).join(','))}]::uuid[])`,
      sql`${ccSailings.sailingDate}::date = ${dateStr}::date`
    ),
    orderBy: [asc(ccSailings.scheduledDeparture)]
  });
  
  const enriched = await Promise.all(sailings.map(async (s) => {
    const operator = operators.find(o => o.id === s.operatorId);
    
    const requests = await db.query.ccTransportRequests.findMany({
      where: and(
        eq(ccTransportRequests.sailingId, s.id),
        ne(ccTransportRequests.status, 'cancelled')
      )
    });
    
    const bookedPassengers = requests.reduce((sum, r) => sum + (r.passengerCount || 0), 0);
    
    const alerts = await db.query.ccTransportAlerts.findMany({
      where: and(
        eq(ccTransportAlerts.sailingId, s.id),
        eq(ccTransportAlerts.status, 'active')
      )
    });
    
    return {
      sailing: {
        id: s.id,
        sailingNumber: s.sailingNumber,
        scheduledDeparture: s.scheduledDeparture,
        scheduledArrival: s.scheduledArrival,
        sailingDate: s.sailingDate,
        status: s.status,
        bookedPassengers
      },
      operator: operator ? { id: operator.id, name: operator.name, code: operator.code } : null,
      alerts: alerts.map(a => ({
        id: a.id,
        alertType: a.alertType,
        severity: a.severity,
        message: a.message
      }))
    };
  }));
  
  return enriched;
}

export async function getIncidentsBoard(
  portalSlug: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const incidents = await db.query.ccIncidentReports.findMany({
    where: and(
      eq(ccIncidentReports.portalId, portal.id),
      or(
        eq(ccIncidentReports.status, 'reported'),
        eq(ccIncidentReports.status, 'investigating'),
        eq(ccIncidentReports.status, 'action_taken')
      )
    ),
    orderBy: [
      desc(sql`CASE severity WHEN 'emergency' THEN 5 WHEN 'critical' THEN 4 WHEN 'major' THEN 3 WHEN 'moderate' THEN 2 ELSE 1 END`),
      desc(ccIncidentReports.incidentAt)
    ],
    limit: 20
  });
  
  const enriched = await Promise.all(incidents.map(async (i) => {
    let property = null;
    if (i.propertyId) {
      property = await db.query.ccProperties.findFirst({
        where: eq(ccProperties.id, i.propertyId)
      });
    }
    
    const hoursSince = Math.round((Date.now() - i.incidentAt.getTime()) / (1000 * 60 * 60));
    
    return {
      incident: {
        id: i.id,
        reportNumber: i.reportNumber,
        title: i.title,
        incidentType: i.incidentType,
        severity: i.severity,
        status: i.status,
        respondedBy: i.respondedBy,
        responseTimeMinutes: i.responseTimeMinutes,
        hoursSince
      },
      property: property ? { id: property.id, name: property.name } : null
    };
  }));
  
  return enriched;
}

export async function getQuickStats(
  portalSlug: string
): Promise<Record<string, number>> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return {};
  
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  const [
    pendingReservations,
    checkedInGuests,
    pendingHousekeeping,
    openMaintenance,
    openIncidents,
    activeAlerts,
    unpaidCitations,
    verifiedIdentities
  ] = await Promise.all([
    db.query.ccPmsReservations.findMany({
      where: and(
        eq(ccPmsReservations.portalId, portal.id),
        eq(ccPmsReservations.status, 'pending')
      )
    }),
    db.query.ccPmsReservations.findMany({
      where: and(
        eq(ccPmsReservations.portalId, portal.id),
        eq(ccPmsReservations.status, 'checked_in')
      )
    }),
    db.query.ccHousekeepingTasks.findMany({
      where: and(
        eq(ccHousekeepingTasks.portalId, portal.id),
        sql`${ccHousekeepingTasks.scheduledDate}::date = ${dateStr}::date`,
        eq(ccHousekeepingTasks.status, 'pending')
      )
    }),
    db.query.ccMaintenanceRequests.findMany({
      where: and(
        eq(ccMaintenanceRequests.portalId, portal.id),
        ne(ccMaintenanceRequests.status, 'completed'),
        ne(ccMaintenanceRequests.status, 'verified'),
        ne(ccMaintenanceRequests.status, 'cancelled')
      )
    }),
    db.query.ccIncidentReports.findMany({
      where: and(
        eq(ccIncidentReports.portalId, portal.id),
        or(
          eq(ccIncidentReports.status, 'reported'),
          eq(ccIncidentReports.status, 'investigating')
        )
      )
    }),
    db.query.ccTransportAlerts.findMany({
      where: sql`${ccTransportAlerts.operatorId} IN (
        SELECT id FROM cc_transport_operators WHERE portal_id = ${portal.id}
      ) AND ${ccTransportAlerts.status} = 'active'`
    }),
    db.query.ccCitations.findMany({
      where: and(
        eq(ccCitations.portalId, portal.id),
        eq(ccCitations.paymentStatus, 'unpaid')
      )
    }),
    db.query.ccVerifiedIdentities.findMany({
      where: and(
        eq(ccVerifiedIdentities.portalId, portal.id),
        eq(ccVerifiedIdentities.verificationStatus, 'verified')
      )
    })
  ]);
  
  return {
    pendingReservations: pendingReservations.length,
    checkedInGuests: checkedInGuests.reduce((sum, r) => sum + (r.guestCount || 1), 0),
    pendingHousekeeping: pendingHousekeeping.length,
    openMaintenance: openMaintenance.length,
    openIncidents: openIncidents.length,
    activeAlerts: activeAlerts.length,
    unpaidCitations: unpaidCitations.length,
    verifiedIdentities: verifiedIdentities.length
  };
}

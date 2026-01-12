import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { getRequiredPermits } from './authorityService';
import { createPermit } from './permitService';
import { ccTripPermits, ccPortals, ccTrips, ccPermitTypes, ccAuthorities, ccVisitorPermits, cc_reservation_carts, cc_reservation_cart_items, ccPortalMoments, ccTransportRequests } from '@shared/schema';

// ============ TYPES ============

interface PermitRequirement {
  permitTypeId: string;
  permitTypeName: string;
  permitTypeCode: string;
  authorityId: string;
  authorityName: string;
  authorityCode: string;
  requirementSource: string;
  sourceLocationId?: string;
  sourceDescription: string;
  estimatedFee: number;
  required: boolean;
}

interface TripPermitSummary {
  trip: any;
  requirements: PermitRequirement[];
  obtained: any[];
  pending: any[];
  totalEstimatedFees: number;
  allRequirementsMet: boolean;
}

// ============ REQUIREMENT ANALYSIS ============

export async function analyzeTripPermitRequirements(
  portalSlug: string,
  tripId: string
): Promise<PermitRequirement[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const trip = await db.query.ccTrips.findFirst({
    where: and(
      eq(ccTrips.id, tripId),
      eq(ccTrips.portalId, portal.id)
    )
  });
  
  // Portal isolation: trip must belong to this portal
  if (!trip) return [];
  
  const requirements: PermitRequirement[] = [];
  const addedPermitTypes = new Set<string>();
  
  // Get cart items for this trip to find locations/activities
  const carts = await db.query.cc_reservation_carts.findMany({
    where: eq(cc_reservation_carts.tripId, tripId)
  });
  
  for (const cart of carts) {
    const items = await db.query.cc_reservation_cart_items.findMany({
      where: eq(cc_reservation_cart_items.cartId, cart.id)
    });
    
    for (const item of items) {
      // Check moments for location-based permits - moments use locationName not locationId
      if (item.momentId) {
        const moment = await db.query.ccPortalMoments.findFirst({
          where: eq(ccPortalMoments.id, item.momentId)
        });
        
        // Moments don't have locationId, but we can check if activity-based permits apply
        if (moment) {
          // Moment-based activities could trigger permits based on title/category
          // This is handled below in the intent-based checks
        }
      }
      
      // Check transport for crossing authorities
      if (item.transportRequestId) {
        const transportReq = await db.query.ccTransportRequests.findFirst({
          where: eq(ccTransportRequests.id, item.transportRequestId)
        });
        
        if (transportReq?.destinationLocationId) {
          const destRequirements = await getRequiredPermits(portalSlug, transportReq.destinationLocationId);
          for (const req of destRequirements.requiredPermits) {
            if (!addedPermitTypes.has(req.permitType.id)) {
              addedPermitTypes.add(req.permitType.id);
              requirements.push({
                permitTypeId: req.permitType.id,
                permitTypeName: req.permitType.name,
                permitTypeCode: req.permitType.code || '',
                authorityId: req.authority.id,
                authorityName: req.authority.name,
                authorityCode: req.authority.code || '',
                requirementSource: 'location',
                sourceLocationId: transportReq.destinationLocationId,
                sourceDescription: `Required for destination: ${destRequirements.location?.name}`,
                estimatedFee: Number(req.permitType.baseFeeCad) || 0,
                required: req.required !== false
              });
            }
          }
        }
      }
    }
  }
  
  // Check trip intent for activity-based permits
  const intent = trip.intentJson as any || {};
  
  if (intent.activities?.includes('west_coast_trail') || intent.activities?.includes('hiking')) {
    const wctType = await db.query.ccPermitTypes.findFirst({
      where: eq(ccPermitTypes.code, 'WCT')
    });
    
    if (wctType && !addedPermitTypes.has(wctType.id)) {
      const authority = await db.query.ccAuthorities.findFirst({
        where: eq(ccAuthorities.id, wctType.authorityId)
      });
      
      if (authority) {
        addedPermitTypes.add(wctType.id);
        requirements.push({
          permitTypeId: wctType.id,
          permitTypeName: wctType.name,
          permitTypeCode: wctType.code || '',
          authorityId: authority.id,
          authorityName: authority.name,
          authorityCode: authority.code || '',
          requirementSource: 'activity',
          sourceDescription: 'West Coast Trail hiking requires Parks Canada permit',
          estimatedFee: Number(wctType.baseFeeCad) + Number(wctType.perPersonFeeCad),
          required: true
        });
      }
    }
  }
  
  if (intent.activities?.includes('kayaking') || intent.activities?.includes('broken_group')) {
    const bgiType = await db.query.ccPermitTypes.findFirst({
      where: eq(ccPermitTypes.code, 'BGI')
    });
    
    if (bgiType && !addedPermitTypes.has(bgiType.id)) {
      const authority = await db.query.ccAuthorities.findFirst({
        where: eq(ccAuthorities.id, bgiType.authorityId)
      });
      
      if (authority) {
        addedPermitTypes.add(bgiType.id);
        requirements.push({
          permitTypeId: bgiType.id,
          permitTypeName: bgiType.name,
          permitTypeCode: bgiType.code || '',
          authorityId: authority.id,
          authorityName: authority.name,
          authorityCode: authority.code || '',
          requirementSource: 'activity',
          sourceDescription: 'Broken Group Islands camping requires Parks Canada permit',
          estimatedFee: Number(bgiType.baseFeeCad) + Number(bgiType.perNightFeeCad),
          required: true
        });
      }
    }
  }
  
  // Always recommend First Nations territory acknowledgment
  const tanType = await db.query.ccPermitTypes.findFirst({
    where: eq(ccPermitTypes.code, 'TAN')
  });
  
  if (tanType && !addedPermitTypes.has(tanType.id)) {
    const authority = await db.query.ccAuthorities.findFirst({
      where: eq(ccAuthorities.id, tanType.authorityId)
    });
    
    if (authority) {
      addedPermitTypes.add(tanType.id);
      requirements.push({
        permitTypeId: tanType.id,
        permitTypeName: tanType.name,
        permitTypeCode: tanType.code || '',
        authorityId: authority.id,
        authorityName: authority.name,
        authorityCode: authority.code || '',
        requirementSource: 'location',
        sourceDescription: 'Acknowledgment of entry into Huu-ay-aht traditional territory',
        estimatedFee: 0,
        required: true
      });
    }
  }
  
  return requirements;
}

// ============ TRIP PERMIT MANAGEMENT ============

export async function createTripPermitRequirements(
  portalSlug: string,
  tripId: string
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const requirements = await analyzeTripPermitRequirements(portalSlug, tripId);
  
  const created: any[] = [];
  
  for (const req of requirements) {
    const existing = await db.query.ccTripPermits.findFirst({
      where: and(
        eq(ccTripPermits.tripId, tripId),
        eq(ccTripPermits.permitTypeId, req.permitTypeId)
      )
    });
    
    if (!existing) {
      const [tripPermit] = await db.insert(ccTripPermits).values({
        portalId: portal.id,
        tripId,
        permitTypeId: req.permitTypeId,
        authorityId: req.authorityId,
        requirementSource: req.requirementSource,
        sourceLocationId: req.sourceLocationId,
        sourceDescription: req.sourceDescription,
        status: req.required ? 'required' : 'recommended'
      }).returning();
      
      created.push({ tripPermit, requirement: req });
    }
  }
  
  return created;
}

export async function getTripPermitSummary(
  portalSlug: string,
  tripId: string
): Promise<TripPermitSummary | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const trip = await db.query.ccTrips.findFirst({
    where: and(
      eq(ccTrips.id, tripId),
      eq(ccTrips.portalId, portal.id)
    )
  });
  
  // Portal isolation: trip must belong to this portal
  if (!trip) return null;
  
  const tripPermits = await db.query.ccTripPermits.findMany({
    where: and(
      eq(ccTripPermits.portalId, portal.id),
      eq(ccTripPermits.tripId, tripId)
    )
  });
  
  const requirements: PermitRequirement[] = [];
  const obtained: any[] = [];
  const pending: any[] = [];
  let totalEstimatedFees = 0;
  
  for (const tp of tripPermits) {
    const permitType = await db.query.ccPermitTypes.findFirst({
      where: eq(ccPermitTypes.id, tp.permitTypeId)
    });
    
    const authority = await db.query.ccAuthorities.findFirst({
      where: eq(ccAuthorities.id, tp.authorityId)
    });
    
    if (!permitType || !authority) continue;
    
    const estimatedFee = Number(permitType.baseFeeCad) || 0;
    totalEstimatedFees += estimatedFee;
    
    const req: PermitRequirement = {
      permitTypeId: tp.permitTypeId,
      permitTypeName: permitType.name,
      permitTypeCode: permitType.code || '',
      authorityId: tp.authorityId,
      authorityName: authority.name,
      authorityCode: authority.code || '',
      requirementSource: tp.requirementSource,
      sourceLocationId: tp.sourceLocationId || undefined,
      sourceDescription: tp.sourceDescription || '',
      estimatedFee,
      required: tp.status === 'required'
    };
    
    requirements.push(req);
    
    if (tp.status === 'obtained' && tp.permitId) {
      const permit = await db.query.ccVisitorPermits.findFirst({
        where: eq(ccVisitorPermits.id, tp.permitId)
      });
      obtained.push({ tripPermit: tp, permit, permitType, authority });
    } else if (['required', 'recommended'].includes(tp.status || '')) {
      pending.push({ tripPermit: tp, permitType, authority });
    }
  }
  
  const allRequirementsMet = tripPermits
    .filter(tp => tp.status === 'required')
    .every(tp => tp.status === 'obtained' || tp.status === 'waived');
  
  return {
    trip,
    requirements,
    obtained,
    pending,
    totalEstimatedFees,
    allRequirementsMet
  };
}

export async function obtainPermitForTrip(
  portalSlug: string,
  tripId: string,
  permitTypeId: string,
  applicantInfo: {
    name: string;
    email?: string;
    phone?: string;
    partySize?: number;
    partyMembers?: string[];
  },
  dates: {
    validFrom: Date;
    validTo: Date;
  }
): Promise<{
  tripPermit: any;
  permit: any;
}> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  // Portal isolation: verify trip belongs to this portal
  const trip = await db.query.ccTrips.findFirst({
    where: and(
      eq(ccTrips.id, tripId),
      eq(ccTrips.portalId, portal.id)
    )
  });
  
  if (!trip) throw new Error('Trip not found');
  
  let tripPermit = await db.query.ccTripPermits.findFirst({
    where: and(
      eq(ccTripPermits.tripId, tripId),
      eq(ccTripPermits.portalId, portal.id),
      eq(ccTripPermits.permitTypeId, permitTypeId)
    )
  });
  
  if (!tripPermit) {
    const permitType = await db.query.ccPermitTypes.findFirst({
      where: eq(ccPermitTypes.id, permitTypeId)
    });
    
    if (!permitType) throw new Error('Permit type not found');
    
    [tripPermit] = await db.insert(ccTripPermits).values({
      portalId: portal.id,
      tripId,
      permitTypeId,
      authorityId: permitType.authorityId,
      requirementSource: 'manual',
      sourceDescription: 'Manually obtained',
      status: 'required'
    }).returning();
  }
  
  const permitResult = await createPermit({
    portalSlug,
    permitTypeId,
    tripId,
    applicantName: applicantInfo.name,
    applicantEmail: applicantInfo.email,
    applicantPhone: applicantInfo.phone,
    partySize: applicantInfo.partySize,
    partyMembers: applicantInfo.partyMembers,
    validFrom: dates.validFrom,
    validTo: dates.validTo
  });
  
  const permitType = await db.query.ccPermitTypes.findFirst({
    where: eq(ccPermitTypes.id, permitTypeId)
  });
  
  let finalPermit = permitResult.permit;
  
  // Auto-approve and issue free permits
  if (permitType && 
      Number(permitType.baseFeeCad) === 0 && 
      Number(permitType.perPersonFeeCad) === 0 &&
      Number(permitType.perDayFeeCad) === 0 &&
      Number(permitType.perNightFeeCad) === 0) {
    // Submit, approve, then issue for free permits
    await db.update(ccVisitorPermits)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(ccVisitorPermits.id, finalPermit.id));
    
    await db.update(ccVisitorPermits)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: 'System (auto-approved)',
        updatedAt: new Date()
      })
      .where(eq(ccVisitorPermits.id, finalPermit.id));
    
    const [issuedPermit] = await db.update(ccVisitorPermits)
      .set({
        status: 'issued',
        issuedAt: new Date(),
        paymentStatus: 'waived',
        updatedAt: new Date()
      })
      .where(eq(ccVisitorPermits.id, finalPermit.id))
      .returning();
    
    finalPermit = issuedPermit;
  }
  
  const [updatedTripPermit] = await db.update(ccTripPermits)
    .set({
      permitId: finalPermit.id,
      status: 'obtained',
      obtainedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(ccTripPermits.id, tripPermit.id))
    .returning();
  
  return {
    tripPermit: updatedTripPermit,
    permit: finalPermit
  };
}

export async function waiveTripPermit(
  portalSlug: string,
  tripPermitId: string,
  reason: string
): Promise<any> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) throw new Error('Portal not found');
  
  const [updated] = await db.update(ccTripPermits)
    .set({
      status: 'waived',
      waiverReason: reason,
      updatedAt: new Date()
    })
    .where(and(
      eq(ccTripPermits.id, tripPermitId),
      eq(ccTripPermits.portalId, portal.id)
    ))
    .returning();
  
  return updated;
}

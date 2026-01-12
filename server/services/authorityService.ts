import { db } from '../db';
import { eq, and, or, ilike, asc, inArray } from 'drizzle-orm';
import { ccAuthorities, ccPermitTypes, ccPortals, ccLocations } from '@shared/schema';

// ============ AUTHORITY FUNCTIONS ============

export async function getAuthorities(
  portalSlug: string,
  options?: {
    authorityType?: string;
    status?: string;
    query?: string;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const conditions: any[] = [eq(ccAuthorities.portalId, portal.id)];
  
  if (options?.authorityType) {
    conditions.push(eq(ccAuthorities.authorityType, options.authorityType));
  }
  
  if (options?.status) {
    conditions.push(eq(ccAuthorities.status, options.status));
  } else {
    conditions.push(eq(ccAuthorities.status, 'active'));
  }
  
  if (options?.query) {
    conditions.push(or(
      ilike(ccAuthorities.name, `%${options.query}%`),
      ilike(ccAuthorities.code, `%${options.query}%`)
    ));
  }
  
  return db.query.ccAuthorities.findMany({
    where: and(...conditions),
    orderBy: [asc(ccAuthorities.name)]
  });
}

export async function getAuthorityByCode(
  portalSlug: string,
  code: string
): Promise<{
  authority: any;
  permitTypes: any[];
} | null> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return null;
  
  const authority = await db.query.ccAuthorities.findFirst({
    where: and(
      eq(ccAuthorities.portalId, portal.id),
      eq(ccAuthorities.code, code.toUpperCase())
    )
  });
  
  if (!authority) return null;
  
  const permitTypes = await db.query.ccPermitTypes.findMany({
    where: and(
      eq(ccPermitTypes.authorityId, authority.id),
      eq(ccPermitTypes.status, 'active')
    ),
    orderBy: [asc(ccPermitTypes.name)]
  });
  
  return { authority, permitTypes };
}

export async function getAuthorityById(authorityId: string): Promise<{
  authority: any;
  permitTypes: any[];
} | null> {
  const authority = await db.query.ccAuthorities.findFirst({
    where: eq(ccAuthorities.id, authorityId)
  });
  
  if (!authority) return null;
  
  const permitTypes = await db.query.ccPermitTypes.findMany({
    where: and(
      eq(ccPermitTypes.authorityId, authorityId),
      eq(ccPermitTypes.status, 'active')
    ),
    orderBy: [asc(ccPermitTypes.name)]
  });
  
  return { authority, permitTypes };
}

// ============ PERMIT TYPE FUNCTIONS ============

export async function getPermitTypes(
  portalSlug: string,
  options?: {
    authorityId?: string;
    authorityCode?: string;
    category?: string;
  }
): Promise<any[]> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return [];
  
  const authorities = await db.query.ccAuthorities.findMany({
    where: eq(ccAuthorities.portalId, portal.id)
  });
  
  const authorityIds = authorities.map(a => a.id);
  if (authorityIds.length === 0) return [];
  
  let targetAuthorityIds = authorityIds;
  
  if (options?.authorityId) {
    targetAuthorityIds = [options.authorityId];
  } else if (options?.authorityCode) {
    const authCode = options.authorityCode;
    const auth = authorities.find(a => a.code === authCode.toUpperCase());
    if (auth) targetAuthorityIds = [auth.id];
  }
  
  const permitTypes: any[] = [];
  for (const authId of targetAuthorityIds) {
    const conditions: any[] = [
      eq(ccPermitTypes.authorityId, authId),
      eq(ccPermitTypes.status, 'active')
    ];
    
    if (options?.category) {
      conditions.push(eq(ccPermitTypes.permitCategory, options.category));
    }
    
    const types = await db.query.ccPermitTypes.findMany({
      where: and(...conditions)
    });
    
    const auth = authorities.find(a => a.id === authId);
    for (const pt of types) {
      permitTypes.push({
        ...pt,
        authority: auth ? { id: auth.id, name: auth.name, code: auth.code, type: auth.authorityType } : null
      });
    }
  }
  
  return permitTypes;
}

export async function getPermitTypeByCode(
  portalSlug: string,
  authorityCode: string,
  permitCode: string
): Promise<{
  permitType: any;
  authority: any;
} | null> {
  const authResult = await getAuthorityByCode(portalSlug, authorityCode);
  if (!authResult) return null;
  
  const permitType = await db.query.ccPermitTypes.findFirst({
    where: and(
      eq(ccPermitTypes.authorityId, authResult.authority.id),
      eq(ccPermitTypes.code, permitCode.toUpperCase())
    )
  });
  
  if (!permitType) return null;
  
  return { permitType, authority: authResult.authority };
}

export async function calculatePermitFee(
  permitTypeId: string,
  options: {
    persons?: number;
    days?: number;
    nights?: number;
  }
): Promise<{
  baseFee: number;
  personFee: number;
  dayFee: number;
  nightFee: number;
  totalFee: number;
  breakdown: string;
}> {
  const permitType = await db.query.ccPermitTypes.findFirst({
    where: eq(ccPermitTypes.id, permitTypeId)
  });
  
  if (!permitType) {
    return { baseFee: 0, personFee: 0, dayFee: 0, nightFee: 0, totalFee: 0, breakdown: 'Permit type not found' };
  }
  
  const baseFee = Number(permitType.baseFeeCad) || 0;
  const personFee = (Number(permitType.perPersonFeeCad) || 0) * (options.persons || 1);
  const dayFee = (Number(permitType.perDayFeeCad) || 0) * (options.days || 1);
  const nightFee = (Number(permitType.perNightFeeCad) || 0) * (options.nights || 0);
  
  const totalFee = baseFee + personFee + dayFee + nightFee;
  
  const parts: string[] = [];
  if (baseFee > 0) parts.push(`Base: $${baseFee.toFixed(2)}`);
  if (personFee > 0) parts.push(`${options.persons || 1} person(s): $${personFee.toFixed(2)}`);
  if (dayFee > 0) parts.push(`${options.days || 1} day(s): $${dayFee.toFixed(2)}`);
  if (nightFee > 0) parts.push(`${options.nights || 0} night(s): $${nightFee.toFixed(2)}`);
  
  return {
    baseFee,
    personFee,
    dayFee,
    nightFee,
    totalFee,
    breakdown: parts.join(' + ') || 'No fees'
  };
}

// ============ REQUIRED PERMITS FOR LOCATION ============

export async function getRequiredPermits(
  portalSlug: string,
  locationId: string
): Promise<{
  location: any;
  requiredPermits: any[];
}> {
  const portal = await db.query.ccPortals.findFirst({
    where: eq(ccPortals.slug, portalSlug)
  });
  
  if (!portal) return { location: null, requiredPermits: [] };
  
  const location = await db.query.ccLocations.findFirst({
    where: and(
      eq(ccLocations.id, locationId),
      eq(ccLocations.portalId, portal.id)
    )
  });
  
  if (!location) return { location: null, requiredPermits: [] };
  
  const requiredPermits: any[] = [];
  
  const authorityRules = (location as any).authorityRules as any || {};
  
  if (authorityRules.permit_required && authorityRules.permit_type) {
    const permitTypes = await getPermitTypes(portalSlug, {});
    const matching = permitTypes.find(pt => 
      pt.code === authorityRules.permit_type || 
      pt.permitCategory === authorityRules.permit_type
    );
    
    if (matching) {
      requiredPermits.push({
        reason: 'Location requires permit',
        permitType: matching,
        authority: matching.authority
      });
    }
  }
  
  if ((location as any).authorityType === 'parks_canada') {
    const parksPermits = await getPermitTypes(portalSlug, { authorityCode: 'PRNPR' });
    for (const pp of parksPermits) {
      requiredPermits.push({
        reason: 'Parks Canada jurisdiction',
        permitType: pp,
        authority: pp.authority
      });
    }
  }
  
  if ((location as any).authorityType === 'first_nation') {
    const fnPermits = await getPermitTypes(portalSlug, { authorityCode: 'HFN' });
    for (const fp of fnPermits) {
      if (fp.permitCategory === 'access') {
        requiredPermits.push({
          reason: 'First Nations territory acknowledgment',
          permitType: fp,
          authority: fp.authority,
          required: true
        });
      }
    }
  }
  
  return { location, requiredPermits };
}

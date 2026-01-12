import { db } from '../db';
import { eq, and, or, ilike, asc } from 'drizzle-orm';
import { ccTransportOperators, ccTransportAssets, ccPortals } from '@shared/schema';

interface OperatorSearchRequest {
  portalSlug?: string;
  portalId?: string;
  operatorType?: string;
  status?: string;
  query?: string;
}

export async function getOperators(req: OperatorSearchRequest): Promise<{
  operators: any[];
  total: number;
}> {
  let portalId = req.portalId;
  
  if (req.portalSlug && !portalId) {
    const [portal] = await db.select({ id: ccPortals.id })
      .from(ccPortals)
      .where(eq(ccPortals.slug, req.portalSlug))
      .limit(1);
    if (portal) {
      portalId = portal.id;
    } else {
      return { operators: [], total: 0 };
    }
  }
  
  const conditions: any[] = [];
  
  if (portalId) {
    conditions.push(eq(ccTransportOperators.portalId, portalId));
  }
  
  if (req.operatorType) {
    conditions.push(eq(ccTransportOperators.operatorType, req.operatorType));
  }
  
  if (req.status) {
    conditions.push(eq(ccTransportOperators.status, req.status));
  } else {
    conditions.push(or(
      eq(ccTransportOperators.status, 'active'),
      eq(ccTransportOperators.status, 'seasonal')
    ));
  }
  
  if (req.query) {
    conditions.push(or(
      ilike(ccTransportOperators.name, `%${req.query}%`),
      ilike(ccTransportOperators.code, `%${req.query}%`)
    ));
  }
  
  const operators = await db.select()
    .from(ccTransportOperators)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(ccTransportOperators.name));
  
  return {
    operators,
    total: operators.length
  };
}

export async function getOperatorByCode(
  portalSlug: string,
  code: string
): Promise<any | null> {
  const [portal] = await db.select({ id: ccPortals.id })
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return null;
  
  const [operator] = await db.select()
    .from(ccTransportOperators)
    .where(and(
      eq(ccTransportOperators.portalId, portal.id),
      eq(ccTransportOperators.code, code.toUpperCase())
    ))
    .limit(1);
  
  if (!operator) return null;
  
  const assets = await db.select()
    .from(ccTransportAssets)
    .where(eq(ccTransportAssets.operatorId, operator.id));
  
  return { ...operator, assets };
}

export async function getOperatorById(id: string): Promise<any | null> {
  const [operator] = await db.select()
    .from(ccTransportOperators)
    .where(eq(ccTransportOperators.id, id))
    .limit(1);
  
  if (!operator) return null;
  
  const assets = await db.select()
    .from(ccTransportAssets)
    .where(eq(ccTransportAssets.operatorId, id));
  
  return { ...operator, assets };
}

export async function getAssets(operatorId: string): Promise<any[]> {
  return db.select()
    .from(ccTransportAssets)
    .where(and(
      eq(ccTransportAssets.operatorId, operatorId),
      or(
        eq(ccTransportAssets.status, 'active'),
        eq(ccTransportAssets.status, 'seasonal')
      )
    ));
}

export async function getAssetById(assetId: string): Promise<any | null> {
  const [asset] = await db.select()
    .from(ccTransportAssets)
    .where(eq(ccTransportAssets.id, assetId))
    .limit(1);
  
  return asset || null;
}

export async function getOperatorRoutes(operatorId: string): Promise<any[]> {
  const [operator] = await db.select()
    .from(ccTransportOperators)
    .where(eq(ccTransportOperators.id, operatorId))
    .limit(1);
  
  if (!operator?.serviceAreaJson) return [];
  
  const serviceArea = operator.serviceAreaJson as any;
  return serviceArea.routes || [];
}

export async function findOperatorsForRoute(
  portalSlug: string,
  fromLocationCode: string,
  toLocationCode: string
): Promise<any[]> {
  const [portal] = await db.select({ id: ccPortals.id })
    .from(ccPortals)
    .where(eq(ccPortals.slug, portalSlug))
    .limit(1);
  
  if (!portal) return []; // Portal isolation: invalid slug returns empty
  
  const operators = await db.select()
    .from(ccTransportOperators)
    .where(and(
      eq(ccTransportOperators.portalId, portal.id),
      or(
        eq(ccTransportOperators.status, 'active'),
        eq(ccTransportOperators.status, 'seasonal')
      )
    ));
  
  return operators.filter(op => {
    const serviceArea = op.serviceAreaJson as any;
    const locations = serviceArea?.service_locations || [];
    
    const servesFrom = locations.includes(fromLocationCode) || serviceArea?.home_port === fromLocationCode;
    const servesTo = locations.includes(toLocationCode);
    
    const hasRoute = serviceArea?.routes?.some((r: any) => 
      (r.from === fromLocationCode && r.to === toLocationCode) ||
      (r.from === toLocationCode && r.to === fromLocationCode)
    );
    
    return (servesFrom && servesTo) || hasRoute || serviceArea?.on_demand;
  });
}

import { db } from '../db';
import { sql } from 'drizzle-orm';

type AvailabilitySignal = 'available' | 'limited' | 'waitlist' | 'call_to_confirm' | 'unavailable';
type PolicyMode = 'scarcity_bookable' | 'truthful' | 'hidden' | 'request_only';

interface VisibilityPolicy {
  id: string;
  tenantId: string;
  assetId: string | null;
  facilityId: string | null;
  policyMode: PolicyMode;
  publicSignalAvailable: AvailabilitySignal;
  publicSignalFull: AvailabilitySignal;
  operatorCanViewTruth: boolean;
  publicCanShow: boolean;
  allowRequestsWhenFull: boolean;
  seasonalRules: any[];
}

interface DisclosureResult {
  disclosedSignal: AvailabilitySignal;
  truthSignal: AvailabilitySignal;
  canBook: boolean;
  nextAction: 'book_now' | 'book_request' | 'call_provider' | 'waitlist' | 'unavailable';
}

export async function getVisibilityPolicy(
  facilityId?: string,
  assetId?: string
): Promise<VisibilityPolicy | null> {
  if (!facilityId && !assetId) return null;
  
  let result;
  if (facilityId) {
    result = await db.execute(sql`
      SELECT 
        id,
        tenant_id as "tenantId",
        asset_id as "assetId",
        facility_id as "facilityId",
        policy_mode as "policyMode",
        public_signal_available as "publicSignalAvailable",
        public_signal_full as "publicSignalFull",
        operator_can_view_truth as "operatorCanViewTruth",
        public_can_show as "publicCanShow",
        allow_requests_when_full as "allowRequestsWhenFull",
        seasonal_rules as "seasonalRules"
      FROM cc_asset_visibility_policies
      WHERE facility_id = ${facilityId}
      LIMIT 1
    `);
  } else {
    result = await db.execute(sql`
      SELECT 
        id,
        tenant_id as "tenantId",
        asset_id as "assetId",
        facility_id as "facilityId",
        policy_mode as "policyMode",
        public_signal_available as "publicSignalAvailable",
        public_signal_full as "publicSignalFull",
        operator_can_view_truth as "operatorCanViewTruth",
        public_can_show as "publicCanShow",
        allow_requests_when_full as "allowRequestsWhenFull",
        seasonal_rules as "seasonalRules"
      FROM cc_asset_visibility_policies
      WHERE asset_id = ${assetId}
      LIMIT 1
    `);
  }
  
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as VisibilityPolicy;
}

function checkSeasonalOverride(
  rules: any[],
  currentDate: Date
): PolicyMode | null {
  if (!rules || rules.length === 0) return null;
  
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  const currentMMDD = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
  for (const rule of rules) {
    if (!rule.start || !rule.end || !rule.mode) continue;
    
    const start = rule.start;
    const end = rule.end;
    
    let inRange = false;
    if (start <= end) {
      inRange = currentMMDD >= start && currentMMDD <= end;
    } else {
      inRange = currentMMDD >= start || currentMMDD <= end;
    }
    
    if (inRange) {
      return rule.mode as PolicyMode;
    }
  }
  
  return null;
}

export async function getDisclosureSignal(
  facilityId: string,
  truthSignal: AvailabilitySignal,
  windowStart: Date,
  windowEnd: Date
): Promise<DisclosureResult> {
  const policy = await getVisibilityPolicy(facilityId);
  
  if (!policy) {
    return {
      disclosedSignal: truthSignal,
      truthSignal,
      canBook: truthSignal === 'available' || truthSignal === 'limited',
      nextAction: truthSignal === 'available' || truthSignal === 'limited' ? 'book_now' : 'unavailable',
    };
  }
  
  if (!policy.publicCanShow) {
    return {
      disclosedSignal: 'unavailable',
      truthSignal,
      canBook: false,
      nextAction: 'unavailable',
    };
  }
  
  const seasonalMode = checkSeasonalOverride(policy.seasonalRules || [], windowStart);
  const effectiveMode = seasonalMode || policy.policyMode;
  
  const isFull = truthSignal === 'unavailable' || truthSignal === 'waitlist';
  
  switch (effectiveMode) {
    case 'hidden':
      return {
        disclosedSignal: 'unavailable',
        truthSignal,
        canBook: false,
        nextAction: 'unavailable',
      };
      
    case 'request_only':
      return {
        disclosedSignal: 'call_to_confirm',
        truthSignal,
        canBook: false,
        nextAction: 'call_provider',
      };
      
    case 'scarcity_bookable':
      if (isFull) {
        return {
          disclosedSignal: policy.publicSignalFull as AvailabilitySignal,
          truthSignal,
          canBook: false,
          nextAction: policy.allowRequestsWhenFull ? 'waitlist' : 'unavailable',
        };
      }
      return {
        disclosedSignal: policy.publicSignalAvailable as AvailabilitySignal,
        truthSignal,
        canBook: true,
        nextAction: 'book_now',
      };
      
    case 'truthful':
    default:
      if (isFull) {
        return {
          disclosedSignal: policy.publicSignalFull as AvailabilitySignal,
          truthSignal,
          canBook: false,
          nextAction: policy.allowRequestsWhenFull ? 'waitlist' : 'unavailable',
        };
      }
      return {
        disclosedSignal: truthSignal,
        truthSignal,
        canBook: true,
        nextAction: 'book_now',
      };
  }
}

export async function getOperatorView(
  facilityId: string,
  truthSignal: AvailabilitySignal
): Promise<{ signal: AvailabilitySignal; canViewTruth: boolean }> {
  const policy = await getVisibilityPolicy(facilityId);
  
  if (!policy || policy.operatorCanViewTruth) {
    return { signal: truthSignal, canViewTruth: true };
  }
  
  return { signal: 'limited', canViewTruth: false };
}

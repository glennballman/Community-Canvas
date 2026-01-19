/**
 * PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
 * Capacity Lens System
 * 
 * Lenses MUST NOT change physical reality.
 * A lens is a policy CAP on offerable atomic units of a given unit_type within a container subtree.
 * 
 * Offerable units = min(physical_active_units, lens_cap_if_set)
 * 
 * Invariants:
 * - cap_normal = clamp(cap_normal, 0, physical)
 * - cap_emergency = clamp(cap_emergency, 0, physical)
 * - If both caps exist: cap_normal <= cap_emergency
 * - available_units = max(0, lens_units_total - claimed_units_total)
 */

import { db } from '../../db';
import { 
  ccSurfaceUnits,
  ccSurfaceContainerMembers,
  ccSurfaces,
  ccSurfaceClaims,
  ccCapacityPolicies
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export type CapacityLens = 'normal' | 'emergency';

export interface CapacityResult {
  containerId: string;
  surfaceType: string;
  lens: CapacityLens;
  physicalUnitsTotal: number;      // Count of active atomic units in subtree
  lensCap: number | null;          // Policy cap (null = no cap)
  lensUnitsTotal: number;          // min(physical, cap) or physical if no cap
  claimedUnitsTotal: number;       // Overlapping claims
  availableUnits: number;          // max(0, lensUnitsTotal - claimedUnitsTotal)
  feasible: boolean;               // availableUnits >= requestedUnits (for queries with requested)
  requestedUnits?: number;
}

export interface GetCapacityOptions {
  portalId: string;
  containerId: string;
  surfaceType: string;
  lens?: CapacityLens;
  requestedUnits?: number;
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

/**
 * Count physical active units in a container subtree for a given unit type.
 * Uses recursive CTE to find all descendant containers.
 */
export async function countPhysicalUnits(
  portalId: string, 
  containerId: string, 
  unitType: string
): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH RECURSIVE container_tree AS (
      SELECT id FROM cc_surface_containers WHERE id = ${containerId}
      UNION ALL
      SELECT c.id 
      FROM cc_surface_containers c
      JOIN container_tree ct ON c.parent_container_id = ct.id
    )
    SELECT COUNT(*) as count
    FROM cc_surface_units su
    JOIN cc_surfaces s ON su.surface_id = s.id
    JOIN cc_surface_container_members scm ON s.id = scm.surface_id
    JOIN container_tree ct ON scm.container_id = ct.id
    WHERE su.unit_type = ${unitType}
      AND su.portal_id = ${portalId}
      AND su.is_active = true
  `);
  
  return parseInt(result.rows?.[0]?.count || '0');
}

/**
 * Get the lens cap for a container/surface type/lens combination.
 * Returns null if no policy exists or no cap is set for that lens.
 */
export async function getLensCap(
  portalId: string,
  containerId: string,
  unitType: string,
  lens: CapacityLens
): Promise<number | null> {
  const policies = await db
    .select()
    .from(ccCapacityPolicies)
    .where(
      and(
        eq(ccCapacityPolicies.portalId, portalId),
        eq(ccCapacityPolicies.containerId, containerId),
        eq(ccCapacityPolicies.surfaceType, unitType)
      )
    )
    .limit(1);

  const policy = policies[0];
  if (!policy) return null;

  if (lens === 'emergency') {
    return policy.emergencyUnitsLimit ?? null;
  } else {
    return policy.normalUnitsLimit ?? null;
  }
}

/**
 * Calculate lens units total from physical count and cap.
 * If cap is null, returns physical. Otherwise returns min(physical, cap).
 */
export function getLensUnitsTotal(physical: number, cap: number | null): number {
  if (cap === null) return physical;
  return Math.min(physical, Math.max(0, cap));
}

/**
 * Count claimed units in a time window for a container subtree.
 */
async function countClaimedUnits(
  portalId: string,
  containerId: string,
  unitType: string,
  timeWindow: { start: Date; end: Date }
): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH RECURSIVE container_tree AS (
      SELECT id FROM cc_surface_containers WHERE id = ${containerId}
      UNION ALL
      SELECT c.id 
      FROM cc_surface_containers c
      JOIN container_tree ct ON c.parent_container_id = ct.id
    )
    SELECT COUNT(*) as count
    FROM cc_surface_claims sc
    JOIN cc_surface_units su ON sc.unit_id = su.id
    JOIN cc_surfaces s ON su.surface_id = s.id
    JOIN cc_surface_container_members scm ON s.id = scm.surface_id
    JOIN container_tree ct ON scm.container_id = ct.id
    WHERE su.unit_type = ${unitType}
      AND sc.portal_id = ${portalId}
      AND sc.claim_start <= ${timeWindow.end}
      AND sc.claim_end > ${timeWindow.start}
      AND sc.status = 'active'
  `);
  
  return parseInt(result.rows?.[0]?.count || '0');
}

/**
 * Get capacity for a container/surface type with lens semantics.
 * 
 * Returns:
 * - physicalUnitsTotal: actual atomic units in subtree
 * - lensCap: policy cap (null if none)
 * - lensUnitsTotal: offerable units = min(physical, cap)
 * - claimedUnitsTotal: units with overlapping claims
 * - availableUnits: lensUnitsTotal - claimedUnitsTotal
 * - feasible: availableUnits >= requestedUnits
 */
export async function getCapacity(options: GetCapacityOptions): Promise<CapacityResult> {
  const { portalId, containerId, surfaceType, lens = 'normal', requestedUnits = 0, timeWindow } = options;

  // 1. Count physical units
  const physicalUnitsTotal = await countPhysicalUnits(portalId, containerId, surfaceType);

  // 2. Get lens cap
  const lensCap = await getLensCap(portalId, containerId, surfaceType, lens);

  // 3. Calculate lens units (capped)
  const lensUnitsTotal = getLensUnitsTotal(physicalUnitsTotal, lensCap);

  // 4. Count claimed units (if time window provided)
  let claimedUnitsTotal = 0;
  if (timeWindow) {
    claimedUnitsTotal = await countClaimedUnits(portalId, containerId, surfaceType, timeWindow);
  }

  // 5. Calculate available
  const availableUnits = Math.max(0, lensUnitsTotal - claimedUnitsTotal);

  // 6. Check feasibility
  const feasible = availableUnits >= requestedUnits;

  return {
    containerId,
    surfaceType,
    lens,
    physicalUnitsTotal,
    lensCap,
    lensUnitsTotal,
    claimedUnitsTotal,
    availableUnits,
    feasible,
    requestedUnits: requestedUnits > 0 ? requestedUnits : undefined,
  };
}

/**
 * Batch get capacity for multiple containers
 */
export async function batchGetCapacity(
  portalId: string,
  containers: Array<{ containerId: string; surfaceType: string; requestedUnits?: number }>,
  lens: CapacityLens = 'normal',
  timeWindow?: { start: Date; end: Date }
): Promise<CapacityResult[]> {
  const results: CapacityResult[] = [];

  for (const { containerId, surfaceType, requestedUnits } of containers) {
    const result = await getCapacity({
      portalId,
      containerId,
      surfaceType,
      lens,
      requestedUnits,
      timeWindow,
    });
    results.push(result);
  }

  return results;
}

/**
 * Compare capacity between normal and emergency lenses.
 * Validates that normal <= emergency when both caps are set.
 */
export async function compareCapacityLenses(
  portalId: string,
  containerId: string,
  surfaceType: string,
  timeWindow?: { start: Date; end: Date }
): Promise<{
  normal: CapacityResult;
  emergency: CapacityResult;
  physicalUnitsTotal: number;
  invariantViolation: boolean;
  invariantMessage?: string;
}> {
  const normal = await getCapacity({
    portalId,
    containerId,
    surfaceType,
    lens: 'normal',
    timeWindow,
  });

  const emergency = await getCapacity({
    portalId,
    containerId,
    surfaceType,
    lens: 'emergency',
    timeWindow,
  });

  // Check invariant: normal <= emergency (when both caps set)
  let invariantViolation = false;
  let invariantMessage: string | undefined;
  
  if (normal.lensCap !== null && emergency.lensCap !== null) {
    if (normal.lensUnitsTotal > emergency.lensUnitsTotal) {
      invariantViolation = true;
      invariantMessage = `Normal cap (${normal.lensCap}) exceeds emergency cap (${emergency.lensCap})`;
    }
  }

  return {
    normal,
    emergency,
    physicalUnitsTotal: normal.physicalUnitsTotal,
    invariantViolation,
    invariantMessage,
  };
}

// Legacy aliases for backward compatibility
export type EffectiveCapacity = CapacityResult;
export const getEffectiveUnits = getCapacity;
export const batchGetEffectiveUnits = batchGetCapacity;

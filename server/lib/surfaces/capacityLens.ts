/**
 * PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
 * Capacity Lens System
 * 
 * Computes effective units for containers based on:
 * - Base unit count from surface units
 * - Capacity policy overrides for Normal vs Emergency lenses
 * - Time window claim overlaps
 */

import { db } from '../../db';
import { 
  ccSurfaceUnits,
  ccSurfaceContainerMembers,
  ccSurfaces,
  ccSurfaceClaims,
  ccCapacityPolicies
} from '@shared/schema';
import { eq, and, sql, lte, gt } from 'drizzle-orm';

export type CapacityLens = 'normal' | 'emergency';

export interface EffectiveCapacity {
  containerId: string;
  surfaceType: string;
  lens: CapacityLens;
  baseUnits: number;
  policyOverride: number | null;
  effectiveUnits: number;
  claimedUnits: number;
  availableUnits: number;
}

export interface GetEffectiveUnitsOptions {
  portalId: string;
  containerId: string;
  surfaceType: string;
  lens?: CapacityLens;
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

/**
 * Get the effective unit count for a container/surface type combination
 * considering capacity lens and time window claims
 * 
 * Uses recursive CTE to find all descendant containers
 */
export async function getEffectiveUnits(options: GetEffectiveUnitsOptions): Promise<EffectiveCapacity> {
  const { portalId, containerId, surfaceType, lens = 'normal', timeWindow } = options;

  // 1. Get base unit count from surface units (including all descendant containers)
  const baseQuery = await db.execute<{ count: string }>(sql`
    WITH RECURSIVE container_tree AS (
      -- Base case: the target container
      SELECT id FROM cc_surface_containers WHERE id = ${containerId}
      UNION ALL
      -- Recursive case: all child containers
      SELECT c.id 
      FROM cc_surface_containers c
      JOIN container_tree ct ON c.parent_container_id = ct.id
    )
    SELECT COUNT(*) as count
    FROM cc_surface_units su
    JOIN cc_surfaces s ON su.surface_id = s.id
    JOIN cc_surface_container_members scm ON s.id = scm.surface_id
    JOIN container_tree ct ON scm.container_id = ct.id
    WHERE su.unit_type = ${surfaceType}
      AND su.portal_id = ${portalId}
  `);
  
  const baseUnits = parseInt(baseQuery.rows?.[0]?.count || '0');

  // 2. Get capacity policy override
  const policies = await db
    .select()
    .from(ccCapacityPolicies)
    .where(
      and(
        eq(ccCapacityPolicies.portalId, portalId),
        eq(ccCapacityPolicies.containerId, containerId),
        eq(ccCapacityPolicies.surfaceType, surfaceType)
      )
    )
    .limit(1);

  const policy = policies[0];
  let policyOverride: number | null = null;
  
  if (policy) {
    if (lens === 'emergency' && policy.emergencyUnitsOverride !== null) {
      policyOverride = policy.emergencyUnitsOverride;
    } else if (lens === 'normal' && policy.normalUnitsOverride !== null) {
      policyOverride = policy.normalUnitsOverride;
    }
  }

  // Calculate effective units (policy override takes precedence if set)
  const effectiveUnits = policyOverride !== null ? policyOverride : baseUnits;

  // 3. Get claimed units in time window (using recursive CTE for descendant containers)
  let claimedUnits = 0;
  
  if (timeWindow) {
    const claimsQuery = await db.execute<{ count: string }>(sql`
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
      WHERE su.unit_type = ${surfaceType}
        AND sc.portal_id = ${portalId}
        AND sc.claim_start <= ${timeWindow.end}
        AND sc.claim_end > ${timeWindow.start}
        AND sc.status = 'active'
    `);
    
    claimedUnits = parseInt(claimsQuery.rows?.[0]?.count || '0');
  }

  return {
    containerId,
    surfaceType,
    lens,
    baseUnits,
    policyOverride,
    effectiveUnits,
    claimedUnits,
    availableUnits: Math.max(0, effectiveUnits - claimedUnits),
  };
}

/**
 * Batch get effective units for multiple containers
 */
export async function batchGetEffectiveUnits(
  portalId: string,
  containers: Array<{ containerId: string; surfaceType: string }>,
  lens: CapacityLens = 'normal',
  timeWindow?: { start: Date; end: Date }
): Promise<EffectiveCapacity[]> {
  const results: EffectiveCapacity[] = [];

  for (const { containerId, surfaceType } of containers) {
    const result = await getEffectiveUnits({
      portalId,
      containerId,
      surfaceType,
      lens,
      timeWindow,
    });
    results.push(result);
  }

  return results;
}

/**
 * Compare capacity between normal and emergency lenses
 */
export async function compareCapacityLenses(
  portalId: string,
  containerId: string,
  surfaceType: string,
  timeWindow?: { start: Date; end: Date }
): Promise<{
  normal: EffectiveCapacity;
  emergency: EffectiveCapacity;
  delta: number;
}> {
  const normal = await getEffectiveUnits({
    portalId,
    containerId,
    surfaceType,
    lens: 'normal',
    timeWindow,
  });

  const emergency = await getEffectiveUnits({
    portalId,
    containerId,
    surfaceType,
    lens: 'emergency',
    timeWindow,
  });

  return {
    normal,
    emergency,
    delta: emergency.effectiveUnits - normal.effectiveUnits,
  };
}

/**
 * V3.3.1 Federation Service
 * Enable cross-tenant access for Chamber operators and partners
 * "Bamfield as one resort" - Chamber can search and reserve across all federated providers
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// Types
export interface FederationContext {
  actorTenantId: string;
  actorIndividualId?: string;
  communityId: string;
}

export interface FederatedFacility {
  id: string;
  tenantId: string;
  tenantName: string;
  name: string;
  slug: string;
  facilityType: string;
  allocationMode: string;
  capacityUnit: string | null;
  capacityTotal: number | null;
  scarcityBand: 'available' | 'limited' | 'scarce' | 'sold_out';
}

/**
 * Check if actor has specific scope on target tenant
 * Uses cc_federation_grants with tenant/circle/portal principals
 * Relies on DB GUCs (current_tenant_id(), current_circle_id(), current_portal_id())
 */
export async function hasScope(
  ctx: FederationContext,
  targetTenantId: string,
  scope: string
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
    FROM cc_federation_grants g
    WHERE g.provider_tenant_id = ${targetTenantId}
      AND g.community_id = ${ctx.communityId}
      AND g.status = 'active'
      AND ${scope} = ANY(g.scopes)
      AND (
        -- Tenant principal
        (g.principal_type = 'tenant'
          AND g.principal_tenant_id = current_tenant_id())

        -- Circle principal
        OR (g.principal_type = 'circle'
          AND g.principal_circle_id = current_circle_id())

        -- Portal principal
        OR (g.principal_type = 'portal'
          AND g.principal_portal_id = current_portal_id())
      )
    LIMIT 1
  `);

  return result.rows.length > 0;
}

/**
 * Get all tenants where actor has given scope
 * Uses cc_federation_grants with tenant/circle/portal principals
 */
export async function getAccessibleTenants(
  ctx: FederationContext,
  scope: string
): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT g.provider_tenant_id
    FROM cc_federation_grants g
    WHERE g.community_id = ${ctx.communityId}
      AND g.status = 'active'
      AND ${scope} = ANY(g.scopes)
      AND (
        (g.principal_type = 'tenant'
          AND g.principal_tenant_id = current_tenant_id())
        OR (g.principal_type = 'circle'
          AND g.principal_circle_id = current_circle_id())
        OR (g.principal_type = 'portal'
          AND g.principal_portal_id = current_portal_id())
      )
  `);

  return result.rows.map(row => row.provider_tenant_id as string);
}

/**
 * Get all facilities across federated tenants with scarcity bands
 * NEVER returns true counts - only scarcity bands
 */
export async function getFederatedFacilities(
  ctx: FederationContext
): Promise<FederatedFacility[]> {
  // Get tenants with availability:read scope
  const accessibleTenants = await getAccessibleTenants(ctx, 'availability:read');
  
  if (accessibleTenants.length === 0) {
    return [];
  }
  
  // Build tenant list for SQL
  const tenantList = accessibleTenants.map(t => `'${t}'`).join(', ');
  
  const result = await db.execute(sql.raw(`
    SELECT 
      f.id,
      f.tenant_id,
      t.name as tenant_name,
      f.name,
      f.slug,
      f.facility_type,
      f.allocation_mode,
      f.capacity_unit,
      f.capacity_total,
      (
        SELECT COUNT(*) 
        FROM cc_inventory_units u 
        WHERE u.facility_id = f.id AND u.is_active = true
      ) as unit_count,
      (
        SELECT COUNT(*) 
        FROM cc_inventory_units u
        LEFT JOIN cc_reservation_allocations a ON a.inventory_unit_id = u.id
          AND (a.hold_expires_at IS NULL OR a.hold_expires_at > now())
        LEFT JOIN cc_reservation_items ri ON a.reservation_item_id = ri.id
          AND ri.status NOT IN ('cancelled', 'no_show', 'checked_out')
        WHERE u.facility_id = f.id AND u.is_active = true AND a.id IS NOT NULL
      ) as allocated_count
    FROM cc_facilities f
    JOIN cc_tenants t ON f.tenant_id = t.id
    WHERE f.tenant_id IN (${tenantList})
      AND f.is_active = true
    ORDER BY f.facility_type, t.name, f.name
  `));
  
  return result.rows.map(row => {
    const unitCount = parseInt(row.unit_count as string) || 0;
    const allocatedCount = parseInt(row.allocated_count as string) || 0;
    const availableCount = unitCount - allocatedCount;
    const availablePercent = unitCount > 0 ? (availableCount / unitCount) * 100 : 0;
    
    // Calculate scarcity band (NEVER expose true counts)
    let scarcityBand: 'available' | 'limited' | 'scarce' | 'sold_out';
    if (availableCount === 0) {
      scarcityBand = 'sold_out';
    } else if (availablePercent <= 10) {
      scarcityBand = 'scarce';
    } else if (availablePercent <= 30) {
      scarcityBand = 'limited';
    } else {
      scarcityBand = 'available';
    }
    
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      tenantName: row.tenant_name as string,
      name: row.name as string,
      slug: row.slug as string,
      facilityType: row.facility_type as string,
      allocationMode: row.allocation_mode as string,
      capacityUnit: row.capacity_unit as string | null,
      capacityTotal: row.capacity_total as number | null,
      scarcityBand,
    };
  });
}

/**
 * Log federated access to activity ledger
 * Now includes circle_id and portal_id attribution via GUCs
 */
export async function logFederatedAccess(
  ctx: FederationContext,
  targetTenantId: string,
  action: string,
  resourceType: string,
  resourceId: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id,
      community_id,
      actor_tenant_id,
      actor_identity_id,
      circle_id,
      portal_id,
      action,
      entity_type,
      entity_id,
      payload
    ) VALUES (
      ${targetTenantId},
      ${ctx.communityId},
      current_tenant_id(),
      ${ctx.actorIndividualId || null},
      current_circle_id(),
      current_portal_id(),
      ${action},
      ${resourceType},
      ${resourceId},
      ${JSON.stringify({ federation: true, scope: action.split('.')[0] })}
    )
  `);
}

/**
 * Search availability across federated facilities
 */
export async function searchFederatedAvailability(
  ctx: FederationContext,
  startDate: Date,
  endDate: Date,
  requirements?: {
    boatLengthFt?: number;
    vehicleLengthFt?: number;
    partySize?: number;
    facilityTypes?: string[];
  }
): Promise<{
  accommodations: FederatedFacility[];
  moorage: FederatedFacility[];
  parking: FederatedFacility[];
}> {
  const facilities = await getFederatedFacilities(ctx);
  
  // Filter by requirements if provided
  let filtered = facilities;
  if (requirements?.facilityTypes && requirements.facilityTypes.length > 0) {
    filtered = filtered.filter(f => requirements.facilityTypes!.includes(f.facilityType));
  }
  
  // Group by category
  const accommodations = filtered.filter(f => f.facilityType === 'lodging');
  const moorage = filtered.filter(f => f.facilityType === 'marina');
  const parking = filtered.filter(f => f.facilityType === 'parking');
  
  // Log the search
  await logFederatedAccess(
    ctx,
    ctx.communityId,
    'availability.search',
    'community',
    ctx.communityId
  );
  
  return { accommodations, moorage, parking };
}

/**
 * Test function for federation
 * NOTE: Deprecated - uses hardcoded IDs and bypasses real context
 * Prefer testing via actual authenticated requests with GUCs set
 */
export async function testFederation(): Promise<{
  success: boolean;
  grantCount?: number;
  error?: string;
}> {
  try {
    // Count grants (not agreements)
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM cc_federation_grants WHERE status = 'active'
    `);
    const grantCount = parseInt(countResult.rows[0]?.count as string) || 0;
    
    return {
      success: true,
      grantCount,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

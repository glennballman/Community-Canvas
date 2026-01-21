/**
 * N3 Zone Defaulting Helper
 * 
 * Provides deterministic zone defaulting for N3 service runs based on portal configuration.
 * 
 * Algorithm:
 * 1. If portal has default_zone_id set → return it
 * 2. Else if portal has exactly 1 zone → return that zone's id
 * 3. Else return null
 * 
 * INVARIANT: Zone pricing modifiers remain advisory only - no billing/ledger changes.
 */

import { db } from '../db';
import { ccPortals, ccZones } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ZoneDefaultResult {
  zoneId: string | null;
  source: 'portal_default' | 'single_zone' | 'none';
}

/**
 * Resolve the default zone ID for a portal.
 * 
 * @param tenantId - The tenant ID for scoping
 * @param portalId - The portal to resolve default zone for
 * @returns The zone ID and source, or null if no default can be determined
 */
export async function resolveDefaultZoneIdForPortal(
  tenantId: string,
  portalId: string
): Promise<ZoneDefaultResult> {
  const portal = await db.query.ccPortals.findFirst({
    where: and(
      eq(ccPortals.id, portalId),
      eq(ccPortals.owningTenantId, tenantId)
    ),
  });

  if (!portal) {
    return { zoneId: null, source: 'none' };
  }

  if (portal.defaultZoneId) {
    const zoneExists = await db.query.ccZones.findFirst({
      where: and(
        eq(ccZones.id, portal.defaultZoneId),
        eq(ccZones.portalId, portalId),
        eq(ccZones.tenantId, tenantId)
      ),
    });
    
    if (zoneExists) {
      return { zoneId: portal.defaultZoneId, source: 'portal_default' };
    }
  }

  const zones = await db
    .select({ id: ccZones.id })
    .from(ccZones)
    .where(and(
      eq(ccZones.portalId, portalId),
      eq(ccZones.tenantId, tenantId)
    ))
    .limit(2);

  if (zones.length === 1) {
    return { zoneId: zones[0].id, source: 'single_zone' };
  }

  return { zoneId: null, source: 'none' };
}

/**
 * Check if a zone belongs to a specific portal within a tenant.
 */
export async function isZoneValidForPortal(
  tenantId: string,
  portalId: string,
  zoneId: string
): Promise<boolean> {
  const zone = await db.query.ccZones.findFirst({
    where: and(
      eq(ccZones.id, zoneId),
      eq(ccZones.portalId, portalId),
      eq(ccZones.tenantId, tenantId)
    ),
  });
  return !!zone;
}

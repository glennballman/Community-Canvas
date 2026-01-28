/**
 * N3 Service Run Monitor API Routes
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Endpoints:
 * - GET /api/n3/attention - Get runs requiring attention (open bundles)
 * - GET /api/n3/runs/:runId/monitor - Get monitor detail for a run
 * - GET /api/n3/zones - Get portal-scoped zones for zone assignment (owner/admin only)
 * - PUT /api/n3/runs/:runId/zone - Assign zone to a run (owner/admin only)
 * - POST /api/n3/bundles/:bundleId/dismiss - Dismiss a bundle
 * - POST /api/n3/bundles/:bundleId/action - Take action on a bundle
 * - POST /api/n3/runs/:runId/evaluate - Trigger immediate evaluation
 * - GET /api/n3/status - Get monitor status
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { 
  ccN3Runs, 
  ccN3Segments,
  ccMonitorState, 
  ccReplanBundles, 
  ccReplanOptions,
  ccReplanActions,
  ccZones,
  ccPortals,
  ccMaintenanceRequests,
  ccN3RunMaintenanceRequests,
  ccN3RunReadinessSnapshots,
  ccN3RunExecutionHandoffs,
  ccN3ExecutionContracts,
  ccN3ExecutionReceipts,
  ccN3ExecutionVerifications,
  ccN3ExecutionAttestations
} from '@shared/schema';
import { createHash } from 'crypto';
import { eq, and, desc, isNull, gte, count, max, sql } from 'drizzle-orm';
import { z } from 'zod';
import { computeZonePricingEstimate, ZonePricingModifiers } from '@shared/zonePricing';
import { requireAuth, requireTenant } from '../middleware/guards';
import type { TenantRequest } from '../middleware/tenantContext';
import { resolveDefaultZoneIdForPortal, isZoneValidForPortal } from '../lib/n3-zone-defaults';
import { can } from '../auth/authorize';

/**
 * Owner/Admin gate for zone-sensitive N3 routes
 * Only tenant owners, admins, or platform admins can access pricing modifiers and assign zones
 * PROMPT-10: Uses capability check instead of isPlatformAdmin flag
 */
async function requireTenantAdminOrOwner(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const roles = tenantReq.ctx?.roles || [];
  
  // Check tenant roles first
  const hasTenantAdminRole = 
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin');
  
  // PROMPT-10: Use capability check instead of isPlatformAdmin flag
  const hasPlatformCapability = await can(req, 'platform.configure');
  
  if (!hasTenantAdminRole && !hasPlatformCapability) {
    return res.status(403).json({ 
      error: 'Owner or admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * Check if requester has admin/owner privileges (for conditional data exposure)
 * PROMPT-10: Uses capability check instead of isPlatformAdmin flag
 */
async function isAdminOrOwner(req: TenantRequest): Promise<boolean> {
  const roles = req.ctx?.roles || [];
  const hasTenantAdminRole = (
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin')
  );
  
  if (hasTenantAdminRole) return true;
  
  // PROMPT-10: Use capability check instead of isPlatformAdmin flag
  return await can(req, 'platform.configure');
}
import { 
  evaluateServiceRun, 
  saveEvaluationResult,
  getMonitorStatus,
  runMonitorCycle,
} from '../lib/n3';

export const n3Router = Router();

/**
 * GET /api/n3/filters - Get filter options (portals and zones)
 * Returns portals for the tenant and zones (optionally filtered by portalId)
 */
n3Router.get('/filters', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { portalId } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    // Get all portals for the tenant
    const portals = await db
      .select({
        id: ccPortals.id,
        name: ccPortals.name,
        slug: ccPortals.slug,
      })
      .from(ccPortals)
      .where(eq(ccPortals.owningTenantId, tenantId))
      .orderBy(ccPortals.name);

    // Get zones - if portalId provided, filter by it; otherwise get all tenant zones
    let zonesQuery = db
      .select({
        id: ccZones.id,
        portal_id: ccZones.portalId,
        key: ccZones.key,
        name: ccZones.name,
        badge_label_resident: ccZones.badgeLabelResident,
        badge_label_contractor: ccZones.badgeLabelContractor,
        badge_label_visitor: ccZones.badgeLabelVisitor,
      })
      .from(ccZones)
      .orderBy(ccZones.name);

    let zones;
    if (portalId && typeof portalId === 'string') {
      zones = await zonesQuery.where(
        and(
          eq(ccZones.tenantId, tenantId),
          eq(ccZones.portalId, portalId)
        )
      );
    } else {
      zones = await zonesQuery.where(eq(ccZones.tenantId, tenantId));
    }

    res.json({ portals, zones });
  } catch (err) {
    console.error('[N3 API] Error fetching filters:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/zone-heat - Get zone heat metrics (activity counts)
 * Returns counts of runs and attention bundles grouped by zone for ops awareness.
 * Query params:
 *   - portalId?: string - Filter by portal
 *   - windowDays?: number - Time window (default 7, clamped 1-60)
 */
n3Router.get('/zone-heat', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { portalId, windowDays: windowDaysParam } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    // Parse and clamp windowDays (default 7, range 1-60)
    let windowDays = 7;
    if (windowDaysParam) {
      const parsed = parseInt(windowDaysParam as string, 10);
      if (!isNaN(parsed)) {
        windowDays = Math.max(1, Math.min(60, parsed));
      }
    }

    // Calculate the window start date
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    // Build conditions for runs query
    const runsConditions = [
      eq(ccN3Runs.tenantId, tenantId),
      // Use startsAt if available, fallback to createdAt
      sql`COALESCE(${ccN3Runs.startsAt}, ${ccN3Runs.createdAt}) >= ${windowStart}`,
    ];
    if (portalId && typeof portalId === 'string') {
      runsConditions.push(eq(ccN3Runs.portalId, portalId));
    }

    // Get runs grouped by zone with counts
    const zoneRunCounts = await db
      .select({
        zone_id: ccN3Runs.zoneId,
        zone_key: ccZones.key,
        zone_name: ccZones.name,
        badge_label_resident: ccZones.badgeLabelResident,
        badge_label_contractor: ccZones.badgeLabelContractor,
        badge_label_visitor: ccZones.badgeLabelVisitor,
        runs_count: count(ccN3Runs.id),
        last_activity_at: max(sql`COALESCE(${ccN3Runs.startsAt}, ${ccN3Runs.createdAt})`),
      })
      .from(ccN3Runs)
      .leftJoin(ccZones, eq(ccN3Runs.zoneId, ccZones.id))
      .where(and(...runsConditions))
      .groupBy(
        ccN3Runs.zoneId,
        ccZones.key,
        ccZones.name,
        ccZones.badgeLabelResident,
        ccZones.badgeLabelContractor,
        ccZones.badgeLabelVisitor
      );

    // Get attention bundles (open only) grouped by zone
    // We need to join through runs to get zone info
    const bundleConditions = [
      eq(ccReplanBundles.tenantId, tenantId),
      eq(ccReplanBundles.status, 'open'),
      gte(ccReplanBundles.createdAt, windowStart),
    ];

    // Subquery to get open bundle counts per run, then aggregate by zone
    const zoneBundleCounts = await db
      .select({
        zone_id: ccN3Runs.zoneId,
        attention_bundles_count: count(ccReplanBundles.id),
      })
      .from(ccReplanBundles)
      .innerJoin(ccN3Runs, eq(ccReplanBundles.runId, ccN3Runs.id))
      .where(
        and(
          eq(ccReplanBundles.tenantId, tenantId),
          eq(ccReplanBundles.status, 'open'),
          gte(ccReplanBundles.createdAt, windowStart),
          portalId && typeof portalId === 'string' 
            ? eq(ccN3Runs.portalId, portalId) 
            : undefined
        )
      )
      .groupBy(ccN3Runs.zoneId);

    // Merge counts into a map
    const bundleCountMap = new Map<string | null, number>();
    for (const row of zoneBundleCounts) {
      bundleCountMap.set(row.zone_id, Number(row.attention_bundles_count));
    }

    // Build zone heat data
    const zones = zoneRunCounts.map(row => ({
      zone_id: row.zone_id,
      zone_key: row.zone_key,
      zone_name: row.zone_name,
      badge_label_resident: row.badge_label_resident,
      badge_label_contractor: row.badge_label_contractor,
      badge_label_visitor: row.badge_label_visitor,
      runs_count: Number(row.runs_count),
      attention_bundles_count: bundleCountMap.get(row.zone_id) || 0,
      last_activity_at: row.last_activity_at,
    }));

    // Calculate rollups
    const totalRuns = zones.reduce((sum, z) => sum + z.runs_count, 0);
    const totalAttentionBundles = zones.reduce((sum, z) => sum + z.attention_bundles_count, 0);
    const unzonedZone = zones.find(z => z.zone_id === null);
    const unzonedRuns = unzonedZone?.runs_count || 0;
    const unzonedAttentionBundles = unzonedZone?.attention_bundles_count || 0;

    res.json({
      zones,
      rollups: {
        total_runs: totalRuns,
        total_attention_bundles: totalAttentionBundles,
        unzoned_runs: unzonedRuns,
        unzoned_attention_bundles: unzonedAttentionBundles,
      },
      window_days: windowDays,
    });
  } catch (err) {
    console.error('[N3 API] Error fetching zone heat:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs - List all runs for a tenant with optional filters
 * Query params:
 *   - portalId?: string - Filter by portal
 *   - zoneId?: string | 'none' - Filter by zone (use 'none' for unzoned runs)
 */
n3Router.get('/runs', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { portalId, zoneId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    // Build query with LEFT JOIN to zones for zone metadata
    const runs = await db
      .select({
        id: ccN3Runs.id,
        tenantId: ccN3Runs.tenantId,
        name: ccN3Runs.name,
        description: ccN3Runs.description,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
        metadata: ccN3Runs.metadata,
        portal_id: ccN3Runs.portalId,
        zone_id: ccN3Runs.zoneId,
        zone_name: ccZones.name,
        zone_key: ccZones.key,
        badge_label_resident: ccZones.badgeLabelResident,
        badge_label_contractor: ccZones.badgeLabelContractor,
        badge_label_visitor: ccZones.badgeLabelVisitor,
      })
      .from(ccN3Runs)
      .leftJoin(ccZones, eq(ccN3Runs.zoneId, ccZones.id))
      .where(
        and(
          eq(ccN3Runs.tenantId, tenantId),
          // Portal filter
          portalId && typeof portalId === 'string' 
            ? eq(ccN3Runs.portalId, portalId) 
            : undefined,
          // Zone filter
          zoneId === 'none'
            ? isNull(ccN3Runs.zoneId)
            : (zoneId && typeof zoneId === 'string' 
                ? eq(ccN3Runs.zoneId, zoneId) 
                : undefined)
        )
      )
      .orderBy(desc(ccN3Runs.startsAt))
      .limit(50);

    res.json(runs);
  } catch (err) {
    console.error('[N3 API] Error fetching runs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/attention - Get attention queue with optional filters
 * Query params:
 *   - portalId?: string - Filter by portal
 *   - zoneId?: string | 'none' - Filter by zone (use 'none' for unzoned runs)
 */
n3Router.get('/attention', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { portalId, zoneId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const allBundles = await db
      .select({
        bundleId: ccReplanBundles.id,
        runId: ccReplanBundles.runId,
        runName: ccN3Runs.name,
        startsAt: ccN3Runs.startsAt,
        status: ccReplanBundles.status,
        reasonCodes: ccReplanBundles.reasonCodes,
        summary: ccReplanBundles.summary,
        riskDelta: ccReplanBundles.riskDelta,
        createdAt: ccReplanBundles.createdAt,
        portal_id: ccN3Runs.portalId,
        zone_id: ccN3Runs.zoneId,
        zone_name: ccZones.name,
        zone_key: ccZones.key,
        badge_label_resident: ccZones.badgeLabelResident,
        badge_label_contractor: ccZones.badgeLabelContractor,
        badge_label_visitor: ccZones.badgeLabelVisitor,
      })
      .from(ccReplanBundles)
      .innerJoin(ccN3Runs, eq(ccReplanBundles.runId, ccN3Runs.id))
      .leftJoin(ccZones, eq(ccN3Runs.zoneId, ccZones.id))
      .where(
        and(
          eq(ccReplanBundles.tenantId, tenantId),
          // Portal filter at run level
          portalId && typeof portalId === 'string' 
            ? eq(ccN3Runs.portalId, portalId) 
            : undefined,
          // Zone filter at run level
          zoneId === 'none'
            ? isNull(ccN3Runs.zoneId)
            : (zoneId && typeof zoneId === 'string' 
                ? eq(ccN3Runs.zoneId, zoneId) 
                : undefined)
        )
      )
      .orderBy(desc(ccReplanBundles.createdAt))
      .limit(100);

    res.json({ bundles: allBundles });
  } catch (err) {
    console.error('[N3 API] Error fetching attention queue:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

n3Router.get('/runs/:runId/monitor', requireAuth, requireTenant, async (req, res) => {
  try {
    const { runId } = req.params;
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const run = await db.query.ccN3Runs.findFirst({
      where: and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ),
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const canSeePricing = await isAdminOrOwner(tenantReq);

    const segments = await db.query.ccN3Segments.findMany({
      where: eq(ccN3Segments.runId, runId),
    });

    const state = await db.query.ccMonitorState.findFirst({
      where: eq(ccMonitorState.runId, runId),
    });

    const bundles = await db
      .select()
      .from(ccReplanBundles)
      .where(eq(ccReplanBundles.runId, runId))
      .orderBy(desc(ccReplanBundles.createdAt))
      .limit(10);

    const bundlesWithOptions = await Promise.all(
      bundles.map(async (bundle) => {
        const options = await db.query.ccReplanOptions.findMany({
          where: eq(ccReplanOptions.bundleId, bundle.id),
        });
        return { ...bundle, options };
      })
    );

    let zoneData: {
      zone_id: string | null;
      zone_name: string | null;
      zone_key: string | null;
      badge_label_resident: string | null;
      badge_label_contractor: string | null;
      badge_label_visitor: string | null;
      pricing_modifiers: ZonePricingModifiers | null;
      zone_pricing_estimate: ReturnType<typeof computeZonePricingEstimate> | null;
    } = {
      zone_id: run.zoneId || null,
      zone_name: null,
      zone_key: null,
      badge_label_resident: null,
      badge_label_contractor: null,
      badge_label_visitor: null,
      pricing_modifiers: null,
      zone_pricing_estimate: null,
    };

    if (run.zoneId) {
      const zone = await db.query.ccZones.findFirst({
        where: eq(ccZones.id, run.zoneId),
      });

      if (zone) {
        const pricingModifiers = (zone.pricingModifiers as ZonePricingModifiers) || null;
        zoneData = {
          zone_id: zone.id,
          zone_name: zone.name,
          zone_key: zone.key,
          badge_label_resident: zone.badgeLabelResident,
          badge_label_contractor: zone.badgeLabelContractor,
          badge_label_visitor: zone.badgeLabelVisitor,
          pricing_modifiers: canSeePricing ? pricingModifiers : null,
          zone_pricing_estimate: null,
        };

        if (canSeePricing) {
          const baseEstimate = (run.metadata as any)?.estimated_value;
          if (typeof baseEstimate === 'number' && baseEstimate > 0 && pricingModifiers) {
            zoneData.zone_pricing_estimate = computeZonePricingEstimate(baseEstimate, pricingModifiers);
          }
        }
      }
    }

    res.json({
      run: {
        ...run,
        portal_id: run.portalId,
        zone_id: run.zoneId,
      },
      segments,
      monitorState: state,
      bundles: bundlesWithOptions,
      ...zoneData,
    });
  } catch (err) {
    console.error('[N3 API] Error fetching monitor detail:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

n3Router.get('/portals', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const portals = await db
      .select({
        id: ccPortals.id,
        name: ccPortals.name,
        slug: ccPortals.slug,
        default_zone_id: ccPortals.defaultZoneId,
      })
      .from(ccPortals)
      .where(eq(ccPortals.owningTenantId, tenantId))
      .orderBy(ccPortals.name);

    res.json({ portals });
  } catch (err) {
    console.error('[N3 API] Error fetching portals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

n3Router.get('/zones', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const portalId = req.query.portalId as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    if (!portalId) {
      return res.status(400).json({ error: 'Missing portalId query parameter' });
    }

    const zones = await db
      .select({
        id: ccZones.id,
        key: ccZones.key,
        name: ccZones.name,
        badge_label_resident: ccZones.badgeLabelResident,
        badge_label_contractor: ccZones.badgeLabelContractor,
        badge_label_visitor: ccZones.badgeLabelVisitor,
        pricing_modifiers: ccZones.pricingModifiers,
      })
      .from(ccZones)
      .where(and(
        eq(ccZones.tenantId, tenantId),
        eq(ccZones.portalId, portalId)
      ))
      .orderBy(ccZones.name);

    res.json({ zones });
  } catch (err) {
    console.error('[N3 API] Error fetching zones:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const zoneAssignmentSchema = z.object({
  zone_id: z.string().uuid().nullable(),
});

n3Router.put('/runs/:runId/zone', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  try {
    const { runId } = req.params;
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const body = zoneAssignmentSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const run = await db.query.ccN3Runs.findFirst({
      where: and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ),
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (!run.portalId) {
      return res.status(400).json({ 
        error: 'Run must have portal_id set before zone assignment',
        code: 'PORTAL_REQUIRED'
      });
    }

    const previousZoneId = run.zoneId;

    if (body.zone_id !== null) {
      const zone = await db.query.ccZones.findFirst({
        where: eq(ccZones.id, body.zone_id),
      });

      if (!zone) {
        return res.status(404).json({ error: 'Zone not found' });
      }

      if (zone.portalId !== run.portalId) {
        return res.status(400).json({ 
          error: 'Zone must belong to the same portal as the run',
          code: 'PORTAL_MISMATCH'
        });
      }
    }

    await db
      .update(ccN3Runs)
      .set({ 
        zoneId: body.zone_id,
        updatedAt: new Date(),
      })
      .where(eq(ccN3Runs.id, runId));

    let auditAction: string;
    if (previousZoneId === null && body.zone_id !== null) {
      auditAction = 'zone_set';
    } else if (previousZoneId !== null && body.zone_id === null) {
      auditAction = 'zone_cleared';
    } else {
      auditAction = 'zone_updated';
    }

    console.log(`[N3 API] Zone ${auditAction}: run=${runId}, prev=${previousZoneId}, new=${body.zone_id}`);

    res.json({ 
      success: true,
      zone_id: body.zone_id,
      audit_action: auditAction,
    });
  } catch (err) {
    console.error('[N3 API] Error assigning zone:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const portalAssignmentSchema = z.object({
  portal_id: z.string().uuid(),
});

n3Router.put('/runs/:runId/portal', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  try {
    const { runId } = req.params;
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const body = portalAssignmentSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const run = await db.query.ccN3Runs.findFirst({
      where: and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ),
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const portal = await db.query.ccPortals.findFirst({
      where: and(
        eq(ccPortals.id, body.portal_id),
        eq(ccPortals.owningTenantId, tenantId)
      ),
    });

    if (!portal) {
      return res.status(404).json({ error: 'Portal not found or does not belong to tenant' });
    }

    const previousPortalId = run.portalId;
    const isPortalChange = previousPortalId !== null && previousPortalId !== body.portal_id;

    let newZoneId: string | null = run.zoneId;
    let zoneAuditAction: string | null = null;

    if (isPortalChange && run.zoneId) {
      const zoneStillValid = await isZoneValidForPortal(tenantId, body.portal_id, run.zoneId);
      if (!zoneStillValid) {
        newZoneId = null;
        zoneAuditAction = 'zone_cleared_portal_change';
      }
    }

    if (newZoneId === null) {
      const defaultResult = await resolveDefaultZoneIdForPortal(tenantId, body.portal_id);
      if (defaultResult.zoneId) {
        newZoneId = defaultResult.zoneId;
        zoneAuditAction = `zone_defaulted_${defaultResult.source}`;
      }
    }

    await db
      .update(ccN3Runs)
      .set({ 
        portalId: body.portal_id,
        zoneId: newZoneId,
        updatedAt: new Date(),
      })
      .where(eq(ccN3Runs.id, runId));

    const portalAuditAction = previousPortalId === null ? 'portal_set' : 'portal_updated';

    console.log(`[N3 API] Portal ${portalAuditAction}: run=${runId}, prev=${previousPortalId}, new=${body.portal_id}`);
    if (zoneAuditAction) {
      console.log(`[N3 API] Zone ${zoneAuditAction}: run=${runId}, zone=${newZoneId}`);
    }

    res.json({ 
      success: true,
      id: runId,
      portal_id: body.portal_id,
      zone_id: newZoneId,
      portal_audit_action: portalAuditAction,
      zone_audit_action: zoneAuditAction,
    });
  } catch (err) {
    console.error('[N3 API] Error assigning portal:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const dismissSchema = z.object({
  reason: z.string().optional(),
});

n3Router.post('/bundles/:bundleId/dismiss', requireAuth, requireTenant, async (req, res) => {
  try {
    const { bundleId } = req.params;
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const body = dismissSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const bundle = await db.query.ccReplanBundles.findFirst({
      where: and(
        eq(ccReplanBundles.id, bundleId),
        eq(ccReplanBundles.tenantId, tenantId)
      ),
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    if (bundle.status !== 'open') {
      return res.status(400).json({ error: 'Bundle is not open' });
    }

    await db
      .update(ccReplanBundles)
      .set({ status: 'dismissed' })
      .where(eq(ccReplanBundles.id, bundleId));

    res.json({ success: true, status: 'dismissed' });
  } catch (err) {
    console.error('[N3 API] Error dismissing bundle:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const actionSchema = z.object({
  optionId: z.string().uuid(),
  actionKind: z.enum(['suggest', 'request', 'dictate']),
  notes: z.string().optional(),
});

n3Router.post('/bundles/:bundleId/action', requireAuth, requireTenant, async (req, res) => {
  try {
    const { bundleId } = req.params;
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const body = actionSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const bundle = await db.query.ccReplanBundles.findFirst({
      where: and(
        eq(ccReplanBundles.id, bundleId),
        eq(ccReplanBundles.tenantId, tenantId)
      ),
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    if (bundle.status !== 'open') {
      return res.status(400).json({ error: 'Bundle is not open' });
    }

    const option = await db.query.ccReplanOptions.findFirst({
      where: and(
        eq(ccReplanOptions.id, body.optionId),
        eq(ccReplanOptions.bundleId, bundleId)
      ),
    });

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    const [action] = await db.insert(ccReplanActions).values({
      tenantId,
      bundleId,
      optionId: body.optionId,
      actionKind: body.actionKind,
      notes: body.notes,
    }).returning();

    await db
      .update(ccReplanBundles)
      .set({ status: 'actioned' })
      .where(eq(ccReplanBundles.id, bundleId));

    res.json({ 
      success: true, 
      actionId: action.id,
      status: 'actioned',
    });
  } catch (err) {
    console.error('[N3 API] Error taking action:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

n3Router.post('/runs/:runId/evaluate', requireAuth, requireTenant, async (req, res) => {
  try {
    const { runId } = req.params;
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const portalId = tenantReq.ctx.portal_id || req.headers['x-portal-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const run = await db.query.ccN3Runs.findFirst({
      where: and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ),
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const result = await evaluateServiceRun(runId, run.tenantId, portalId);
    const bundleId = await saveEvaluationResult(result);

    res.json({
      success: true,
      evaluation: {
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        fingerprintHash: result.fingerprint.hash,
        findingsCount: result.findings.length,
        effectiveCapacityCount: result.effectiveCapacityBySegment?.length || 0,
        hasChanged: result.hasChanged,
        bundleId,
      },
      effectiveCapacityBySegment: result.effectiveCapacityBySegment,
    });
  } catch (err) {
    console.error('[N3 API] Error evaluating run:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/draft-from-window - Create a draft N3 Service Run from suggested window
 * PROMPT 25: Explicit, admin-only draft creation
 * 
 * No auto-execution, no contractor visibility, no notifications, no bundles.
 * This is object creation only.
 */
const draftFromWindowSchema = z.object({
  portal_id: z.string().uuid(),
  zone_id: z.string().uuid().nullable().optional(),
  category: z.string().nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  coordination_metrics: z.object({
    coord_ready_count: z.number(),
    total_active_count: z.number(),
    readiness_ratio: z.number(),
    confidence_score: z.number().min(0).max(100),
    window_source: z.literal('suggested'),
    parameters: z.object({
      lookahead_days: z.number(),
      window_size_days: z.number(),
      desired_windows: z.number(),
    }),
  }),
});

n3Router.post('/runs/draft-from-window', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  
  try {
    const parseResult = draftFromWindowSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
    }
    
    const { 
      portal_id, 
      zone_id, 
      category,
      starts_at, 
      ends_at, 
      coordination_metrics,
    } = parseResult.data;
    
    const tenantId = tenantReq.ctx.tenant_id;
    const userId = tenantReq.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Validate portal belongs to tenant
    const portalCheck = await db
      .select({ id: ccPortals.id })
      .from(ccPortals)
      .where(and(
        eq(ccPortals.id, portal_id),
        eq(ccPortals.owningTenantId, tenantId)
      ))
      .limit(1);
    
    if (portalCheck.length === 0) {
      return res.status(400).json({ error: 'Portal not found or does not belong to tenant' });
    }
    
    // Validate zone if provided
    if (zone_id) {
      const zoneCheck = await db
        .select({ id: ccZones.id })
        .from(ccZones)
        .where(and(
          eq(ccZones.id, zone_id),
          eq(ccZones.portalId, portal_id)
        ))
        .limit(1);
      
      if (zoneCheck.length === 0) {
        return res.status(400).json({ error: 'Zone not found or does not belong to portal' });
      }
    }
    
    // Validate time window
    const startsAtDate = new Date(starts_at);
    const endsAtDate = new Date(ends_at);
    
    if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for starts_at or ends_at' });
    }
    
    if (startsAtDate >= endsAtDate) {
      return res.status(400).json({ error: 'starts_at must be before ends_at' });
    }
    
    const windowLengthDays = (endsAtDate.getTime() - startsAtDate.getTime()) / (1000 * 60 * 60 * 24);
    if (windowLengthDays > 14) {
      return res.status(400).json({ error: 'Window length must not exceed 14 days' });
    }
    
    // Get zone label for naming
    let zoneName = 'Unzoned';
    if (zone_id) {
      const zoneRow = await db
        .select({ name: ccZones.name, key: ccZones.key })
        .from(ccZones)
        .where(eq(ccZones.id, zone_id))
        .limit(1);
      
      if (zoneRow.length > 0) {
        zoneName = zoneRow[0].name || zoneRow[0].key || 'Zone';
      }
    }
    
    // Create draft run
    const now = new Date();
    const [newRun] = await db
      .insert(ccN3Runs)
      .values({
        tenantId,
        portalId: portal_id,
        zoneId: zone_id || null,
        name: `Draft Service Run (${zoneName})`,
        status: 'draft',
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        metadata: {
          source: 'coordination_window',
          category: category || null,
          coordination: coordination_metrics,
          created_by_user_id: userId,
          created_at: now.toISOString(),
        },
      })
      .returning({ id: ccN3Runs.id });
    
    // Emit audit event (log for now, can be extended to audit table)
    console.log('[N3 AUDIT] n3_run_draft_created_from_coordination_window', {
      tenant_id: tenantId,
      portal_id,
      zone_id: zone_id || null,
      run_id: newRun.id,
      confidence_score: coordination_metrics.confidence_score,
      user_id: userId,
      created_at: now.toISOString(),
    });
    
    res.json({
      success: true,
      run_id: newRun.id,
      status: 'draft',
      redirect: `/app/n3/runs/${newRun.id}/monitor`,
    });
  } catch (err) {
    console.error('[N3 API] Error creating draft run from window:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/:runId/promote - Promote a draft Service Run to scheduled
 * PROMPT 26: Explicit, admin-only promotion
 * 
 * Changes status from 'draft' -> 'scheduled'. No side effects:
 * - No contractor assignment/notification
 * - No billing/ledger/folio interaction
 * - No public disclosure
 * - Fully reversible
 */
const promoteRunSchema = z.object({
  note: z.string().max(280).optional(),
});

n3Router.post('/runs/:runId/promote', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  
  try {
    const parseResult = promoteRunSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
    }
    
    const { note } = parseResult.data;
    const tenantId = tenantReq.ctx.tenant_id;
    const userId = tenantReq.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Fetch the run
    const runRows = await db
      .select()
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Check current status
    if (run.status === 'scheduled') {
      // Idempotent: already scheduled
      return res.status(409).json({ 
        error: 'Run is already scheduled',
        code: 'ALREADY_SCHEDULED',
      });
    }
    
    if (run.status !== 'draft') {
      return res.status(400).json({ 
        error: `Cannot promote run with status '${run.status}'. Only draft runs can be promoted.`,
        code: 'INVALID_STATUS',
      });
    }
    
    // Validate portal assignment
    if (!run.portalId) {
      return res.status(400).json({ 
        error: 'Run must have a portal assigned before promotion',
        code: 'PORTAL_REQUIRED',
      });
    }
    
    // Validate time window
    if (!run.startsAt || !run.endsAt) {
      return res.status(400).json({ 
        error: 'Run must have valid start and end times before promotion',
        code: 'INVALID_WINDOW',
      });
    }
    
    const startsAt = new Date(run.startsAt);
    const endsAt = new Date(run.endsAt);
    
    if (startsAt >= endsAt) {
      return res.status(400).json({ 
        error: 'Start time must be before end time',
        code: 'INVALID_WINDOW',
      });
    }
    
    const durationDays = (endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 14) {
      return res.status(400).json({ 
        error: 'Run duration must not exceed 14 days',
        code: 'INVALID_WINDOW',
      });
    }
    
    // Check for zone warning (soft check)
    const warnings: string[] = [];
    
    if (!run.zoneId) {
      // Check if portal has zones
      const zoneCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(ccZones)
        .where(eq(ccZones.portalId, run.portalId));
      
      if (zoneCount[0]?.count > 0) {
        warnings.push('ZONE_NOT_ASSIGNED');
      }
    }
    
    // Perform the promotion
    await db
      .update(ccN3Runs)
      .set({
        status: 'scheduled',
        updatedAt: new Date(),
      })
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId),
        eq(ccN3Runs.status, 'draft')
      ));
    
    const now = new Date();
    
    // Emit audit event
    console.log('[N3 AUDIT] n3_run_promoted', {
      event: 'n3_run_promoted',
      run_id: runId,
      from_status: 'draft',
      to_status: 'scheduled',
      actor_id: userId,
      tenant_id: tenantId,
      portal_id: run.portalId,
      zone_id: run.zoneId,
      note: note || null,
      occurred_at: now.toISOString(),
    });
    
    const response: { success: boolean; run_id: string; status: string; warnings?: string[] } = {
      success: true,
      run_id: runId,
      status: 'scheduled',
    };
    
    if (warnings.length > 0) {
      response.warnings = warnings;
    }
    
    res.json(response);
  } catch (err) {
    console.error('[N3 API] Error promoting run:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/:runId/demote - Demote a scheduled Service Run back to draft
 * PROMPT 27: Reversible demotion, admin-only
 * 
 * Changes status from 'scheduled' -> 'draft'. No side effects:
 * - No contractor notification
 * - No billing/ledger/folio impact
 * - No execution triggers
 * - Fully reversible
 */
const demoteRunSchema = z.object({
  note: z.string().max(280).optional(),
});

n3Router.post('/runs/:runId/demote', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  
  try {
    const parseResult = demoteRunSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
    }
    
    const { note } = parseResult.data;
    const tenantId = tenantReq.ctx.tenant_id;
    const userId = tenantReq.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Fetch the run
    const runRows = await db
      .select()
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Check current status
    if (run.status === 'draft') {
      // Idempotent: already draft
      return res.status(409).json({ 
        error: 'Run is already draft',
        code: 'ALREADY_DRAFT',
      });
    }
    
    if (run.status !== 'scheduled') {
      return res.status(400).json({ 
        error: `Cannot demote run with status '${run.status}'. Only scheduled runs can be demoted.`,
        code: 'INVALID_STATUS',
      });
    }
    
    // Update status to draft with demotion metadata
    const now = new Date();
    const existingMetadata = (run.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      demoted_from: 'scheduled',
      demoted_at: now.toISOString(),
      demoted_by: userId,
      demotion_note: note || null,
    };
    
    await db
      .update(ccN3Runs)
      .set({
        status: 'draft',
        metadata: updatedMetadata,
        updatedAt: now,
      })
      .where(eq(ccN3Runs.id, runId));
    
    // Emit audit event
    console.log('[N3 AUDIT] n3_run_demoted', {
      event: 'n3_run_demoted',
      run_id: runId,
      previous_status: 'scheduled',
      new_status: 'draft',
      actor_user_id: userId,
      tenant_id: tenantId,
      portal_id: run.portalId,
      zone_id: run.zoneId,
      note: note || null,
      occurred_at: now.toISOString(),
    });
    
    res.json({
      success: true,
      id: runId,
      status: 'draft',
      audit_action: 'n3_run_demoted',
    });
  } catch (err) {
    console.error('[N3 API] Error demoting run:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/health - Unauthenticated healthcheck (returns only { ok: true })
 */
n3Router.get('/health', async (_req, res) => {
  res.json({ ok: true });
});

/**
 * GET /api/n3/status - Get monitor status (protected: platform admin only)
 * PROMPT-10: Uses capability check instead of isPlatformAdmin flag
 */
n3Router.get('/status', requireAuth, async (req, res) => {
  // PROMPT-10: Use capability check instead of isPlatformAdmin flag
  const hasPlatformCapability = await can(req, 'platform.configure');
  
  if (!hasPlatformCapability) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  
  const status = getMonitorStatus();
  res.json(status);
});

/**
 * POST /api/n3/trigger-cycle - Trigger monitor cycle (protected: platform admin only)
 * Rate limited: 60 second cooldown between manual triggers
 */
let lastTriggerCycleTime = 0;
const TRIGGER_CYCLE_COOLDOWN_MS = 60000; // 60 seconds

n3Router.post('/trigger-cycle', requireAuth, async (req, res) => {
  try {
    // PROMPT-10: Use capability check instead of isPlatformAdmin flag
    const hasPlatformCapability = await can(req, 'platform.configure');
    
    if (!hasPlatformCapability) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }
    
    // Rate limit check
    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerCycleTime;
    if (timeSinceLastTrigger < TRIGGER_CYCLE_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((TRIGGER_CYCLE_COOLDOWN_MS - timeSinceLastTrigger) / 1000);
      return res.status(429).json({ 
        error: `Rate limited. Please wait ${waitSeconds} seconds before triggering another cycle.`,
        retry_after_seconds: waitSeconds,
      });
    }
    
    lastTriggerCycleTime = now;
    const stats = await runMonitorCycle();
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[N3 API] Error triggering cycle:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PROMPT 28: Maintenance Request Attachments ============

/**
 * GET /api/n3/runs/:runId/eligible-maintenance-requests
 * List coordination-opt-in maintenance requests eligible for attachment to a draft run
 * Admin/owner only
 */
const eligibleMaintenanceRequestsSchema = z.object({
  category: z.string().optional(),
  limit: z.coerce.number().min(10).max(200).default(50),
  include_unzoned: z.coerce.boolean().default(false),
});

n3Router.get('/runs/:runId/eligible-maintenance-requests', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  
  try {
    const parseResult = eligibleMaintenanceRequestsSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parseResult.error.flatten() });
    }
    
    const { category, limit, include_unzoned } = parseResult.data;
    const tenantId = tenantReq.ctx.tenant_id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Fetch the run
    const runRows = await db
      .select()
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    if (run.status !== 'draft') {
      return res.status(400).json({ 
        error: 'Only draft runs can have maintenance requests attached',
        code: 'INVALID_STATUS',
      });
    }
    
    if (!run.portalId) {
      return res.status(400).json({ 
        error: 'Run must have a portal assigned before attaching maintenance requests',
        code: 'PORTAL_REQUIRED',
      });
    }
    
    // Verify portal belongs to tenant (defense in depth)
    const portalRows = await db
      .select({ id: ccPortals.id })
      .from(ccPortals)
      .where(and(
        eq(ccPortals.id, run.portalId),
        eq(ccPortals.owningTenantId, tenantId)
      ))
      .limit(1);
    
    if (portalRows.length === 0) {
      return res.status(403).json({ 
        error: 'Portal does not belong to this tenant',
        code: 'TENANT_MISMATCH',
      });
    }
    
    const warnings: string[] = [];
    
    // Build query conditions
    const conditions: any[] = [
      eq(ccMaintenanceRequests.portalId, run.portalId),
      eq(ccMaintenanceRequests.coordinationOptIn, true),
    ];
    
    if (run.zoneId) {
      conditions.push(eq(ccMaintenanceRequests.zoneId, run.zoneId));
    } else {
      if (include_unzoned) {
        conditions.push(isNull(ccMaintenanceRequests.zoneId));
      } else {
        warnings.push('ZONE_NOT_ASSIGNED');
        // Return empty list with warning if run has no zone and include_unzoned is false
        return res.json({
          ok: true,
          run: { 
            id: run.id, 
            portal_id: run.portalId, 
            zone_id: run.zoneId, 
            status: run.status 
          },
          items: [],
          warnings,
        });
      }
    }
    
    if (category) {
      conditions.push(eq(ccMaintenanceRequests.category, category));
    }
    
    // Fetch eligible requests
    const requests = await db
      .select({
        id: ccMaintenanceRequests.id,
        request_number: ccMaintenanceRequests.requestNumber,
        category: ccMaintenanceRequests.category,
        status: ccMaintenanceRequests.status,
        zone_id: ccMaintenanceRequests.zoneId,
        portal_id: ccMaintenanceRequests.portalId,
        coordination_opt_in_set_at: ccMaintenanceRequests.coordinationOptInSetAt,
        created_at: ccMaintenanceRequests.createdAt,
        updated_at: ccMaintenanceRequests.updatedAt,
      })
      .from(ccMaintenanceRequests)
      .where(and(...conditions))
      .orderBy(desc(ccMaintenanceRequests.createdAt))
      .limit(limit);
    
    res.json({
      ok: true,
      run: { 
        id: run.id, 
        portal_id: run.portalId, 
        zone_id: run.zoneId, 
        status: run.status 
      },
      items: requests,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (err) {
    console.error('[N3 API] Error fetching eligible maintenance requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/:runId/attach-maintenance-requests
 * Attach coordination-opt-in maintenance requests to a draft run
 * Admin/owner only
 */
const attachMaintenanceRequestsSchema = z.object({
  maintenance_request_ids: z.array(z.string().uuid()).min(1).max(10),
});

n3Router.post('/runs/:runId/attach-maintenance-requests', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  
  try {
    const parseResult = attachMaintenanceRequestsSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Check for limit exceeded specifically
      const errors = parseResult.error.flatten();
      if (errors.fieldErrors?.maintenance_request_ids?.some(e => e.includes('10'))) {
        return res.status(400).json({ 
          error: 'Cannot attach more than 10 requests at once',
          code: 'LIMIT_EXCEEDED',
        });
      }
      return res.status(400).json({ error: 'Invalid request body', details: errors });
    }
    
    const { maintenance_request_ids } = parseResult.data;
    const tenantId = tenantReq.ctx.tenant_id;
    const userId = tenantReq.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Fetch the run
    const runRows = await db
      .select()
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    if (run.status !== 'draft') {
      return res.status(400).json({ 
        error: 'Only draft runs can have maintenance requests attached',
        code: 'INVALID_STATUS',
      });
    }
    
    if (!run.portalId) {
      return res.status(400).json({ 
        error: 'Run must have a portal assigned',
        code: 'PORTAL_REQUIRED',
      });
    }
    
    // Verify portal belongs to tenant (defense in depth)
    const portalRows = await db
      .select({ id: ccPortals.id })
      .from(ccPortals)
      .where(and(
        eq(ccPortals.id, run.portalId),
        eq(ccPortals.owningTenantId, tenantId)
      ))
      .limit(1);
    
    if (portalRows.length === 0) {
      return res.status(403).json({ 
        error: 'Portal does not belong to this tenant',
        code: 'TENANT_MISMATCH',
      });
    }
    
    // Validate each maintenance request
    const validRequests: string[] = [];
    for (const reqId of maintenance_request_ids) {
      const reqRows = await db
        .select({
          id: ccMaintenanceRequests.id,
          portalId: ccMaintenanceRequests.portalId,
          zoneId: ccMaintenanceRequests.zoneId,
          coordinationOptIn: ccMaintenanceRequests.coordinationOptIn,
        })
        .from(ccMaintenanceRequests)
        .where(eq(ccMaintenanceRequests.id, reqId))
        .limit(1);
      
      if (reqRows.length === 0) continue;
      const mReq = reqRows[0];
      
      // Must match portal
      if (mReq.portalId !== run.portalId) continue;
      
      // Must match zone if run has zone
      if (run.zoneId && mReq.zoneId !== run.zoneId) continue;
      
      // Must be opted in
      if (!mReq.coordinationOptIn) continue;
      
      validRequests.push(reqId);
    }
    
    // Insert attachments (ignore duplicates)
    let attachedCount = 0;
    for (const reqId of validRequests) {
      try {
        await db.insert(ccN3RunMaintenanceRequests).values({
          tenantId,
          runId,
          maintenanceRequestId: reqId,
          attachedBy: userId,
        }).onConflictDoNothing();
        attachedCount++;
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_maintenance_requests_attached', {
      event: 'n3_run_maintenance_requests_attached',
      run_id: runId,
      attached_count: attachedCount,
      actor_id: userId,
      tenant_id: tenantId,
      occurred_at: new Date().toISOString(),
    });
    
    res.json({ success: true, attached_count: attachedCount });
  } catch (err) {
    console.error('[N3 API] Error attaching maintenance requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/:runId/detach-maintenance-requests
 * Detach maintenance requests from a run
 * Admin/owner only
 */
const detachMaintenanceRequestsSchema = z.object({
  maintenance_request_ids: z.array(z.string().uuid()).min(1).max(100),
});

n3Router.post('/runs/:runId/detach-maintenance-requests', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  
  try {
    const parseResult = detachMaintenanceRequestsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }
    
    const { maintenance_request_ids } = parseResult.data;
    const tenantId = tenantReq.ctx.tenant_id;
    const userId = tenantReq.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select()
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Delete attachments
    let detachedCount = 0;
    for (const reqId of maintenance_request_ids) {
      const result = await db
        .delete(ccN3RunMaintenanceRequests)
        .where(and(
          eq(ccN3RunMaintenanceRequests.tenantId, tenantId),
          eq(ccN3RunMaintenanceRequests.runId, runId),
          eq(ccN3RunMaintenanceRequests.maintenanceRequestId, reqId)
        ));
      detachedCount++;
    }
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_maintenance_requests_detached', {
      event: 'n3_run_maintenance_requests_detached',
      run_id: runId,
      detached_count: detachedCount,
      actor_id: userId,
      tenant_id: tenantId,
      occurred_at: new Date().toISOString(),
    });
    
    res.json({ success: true, detached_count: detachedCount });
  } catch (err) {
    console.error('[N3 API] Error detaching maintenance requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/maintenance-requests
 * List attached maintenance requests for a run
 * Admin/owner only
 */
n3Router.get('/runs/:runId/maintenance-requests', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  
  try {
    const tenantId = tenantReq.ctx.tenant_id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select()
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Fetch attached requests with join
    const attachments = await db
      .select({
        id: ccN3RunMaintenanceRequests.id,
        maintenance_request_id: ccN3RunMaintenanceRequests.maintenanceRequestId,
        attached_at: ccN3RunMaintenanceRequests.attachedAt,
        request_number: ccMaintenanceRequests.requestNumber,
        category: ccMaintenanceRequests.category,
        status: ccMaintenanceRequests.status,
        zone_id: ccMaintenanceRequests.zoneId,
        coordination_opt_in_set_at: ccMaintenanceRequests.coordinationOptInSetAt,
      })
      .from(ccN3RunMaintenanceRequests)
      .innerJoin(
        ccMaintenanceRequests,
        eq(ccN3RunMaintenanceRequests.maintenanceRequestId, ccMaintenanceRequests.id)
      )
      .where(and(
        eq(ccN3RunMaintenanceRequests.tenantId, tenantId),
        eq(ccN3RunMaintenanceRequests.runId, runId)
      ))
      .orderBy(desc(ccN3RunMaintenanceRequests.attachedAt));
    
    // Compute rollups
    const categoryCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};
    
    for (const att of attachments) {
      categoryCount[att.category] = (categoryCount[att.category] || 0) + 1;
      if (att.status) {
        statusCount[att.status] = (statusCount[att.status] || 0) + 1;
      }
    }
    
    res.json({
      ok: true,
      items: attachments,
      total_attached: attachments.length,
      counts_by_category: categoryCount,
      counts_by_status: statusCount,
    });
  } catch (err) {
    console.error('[N3 API] Error fetching attached maintenance requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/readiness-drift
 * 
 * Evaluate readiness drift for a draft or scheduled N3 Service Run.
 * Returns advisory warnings (counts only) when attached maintenance requests
 * have drifted from planning assumptions.
 * 
 * Admin/owner only. No PII or IDs returned.
 * 
 * Query params:
 * - age_days: optional (default 30, clamp 7-90)
 * 
 * Drift types:
 * - coordination_opt_out: requests that have opted out since attachment
 * - zone_mismatch: requests with no zone or different zone than run
 * - inactive_status: requests no longer in active status (reported/triaged/scheduled)
 * - age_exceeded: coordination opt-in older than threshold
 */
n3Router.get('/runs/:runId/readiness-drift', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const actorId = tenantReq.user?.id || 'system';
  
  // Parse and clamp age_days parameter
  let ageDays = 30;
  if (req.query.age_days) {
    const parsed = parseInt(req.query.age_days as string, 10);
    if (!isNaN(parsed)) {
      ageDays = Math.max(7, Math.min(90, parsed));
    }
  }
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Fetch the run
    const runRows = await db
      .select({
        id: ccN3Runs.id,
        status: ccN3Runs.status,
        zoneId: ccN3Runs.zoneId,
        portalId: ccN3Runs.portalId,
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Only draft and scheduled runs can have drift evaluated
    if (run.status !== 'draft' && run.status !== 'scheduled') {
      return res.status(400).json({ 
        error: 'Drift evaluation only applies to draft or scheduled runs',
        code: 'INVALID_STATUS',
      });
    }
    
    // Fetch attached maintenance requests with relevant fields for drift detection
    const attachedRequests = await db
      .select({
        maintenanceRequestId: ccN3RunMaintenanceRequests.maintenanceRequestId,
        coordinationOptIn: ccMaintenanceRequests.coordinationOptIn,
        coordinationOptInSetAt: ccMaintenanceRequests.coordinationOptInSetAt,
        zoneId: ccMaintenanceRequests.zoneId,
        status: ccMaintenanceRequests.status,
      })
      .from(ccN3RunMaintenanceRequests)
      .innerJoin(
        ccMaintenanceRequests,
        eq(ccN3RunMaintenanceRequests.maintenanceRequestId, ccMaintenanceRequests.id)
      )
      .where(and(
        eq(ccN3RunMaintenanceRequests.tenantId, tenantId),
        eq(ccN3RunMaintenanceRequests.runId, runId)
      ));
    
    const evaluatedAt = new Date().toISOString();
    const ageThresholdDate = new Date();
    ageThresholdDate.setDate(ageThresholdDate.getDate() - ageDays);
    
    // Active statuses for maintenance requests
    const activeStatuses = ['reported', 'triaged', 'scheduled'];
    
    // Drift counters
    let coordinationOptOutCount = 0;
    let zoneMismatchCount = 0;
    let inactiveStatusCount = 0;
    let ageExceededCount = 0;
    
    for (const mReq of attachedRequests) {
      // D1: Coordination opt-in drift - request opted out
      if (!mReq.coordinationOptIn) {
        coordinationOptOutCount++;
      }
      
      // D2: Zone drift - run has zone but request doesn't match
      if (run.zoneId) {
        if (!mReq.zoneId || mReq.zoneId !== run.zoneId) {
          zoneMismatchCount++;
        }
      }
      
      // D3: Status drift - request no longer active
      if (mReq.status && !activeStatuses.includes(mReq.status)) {
        inactiveStatusCount++;
      }
      
      // D4: Age drift - opt-in older than threshold
      if (mReq.coordinationOptInSetAt) {
        const optInDate = new Date(mReq.coordinationOptInSetAt);
        if (optInDate < ageThresholdDate) {
          ageExceededCount++;
        }
      }
    }
    
    const withDrift = new Set<string>();
    
    // Compute unique drift count (a request can have multiple drift types)
    for (const mReq of attachedRequests) {
      let hasDrift = false;
      
      if (!mReq.coordinationOptIn) hasDrift = true;
      if (run.zoneId && (!mReq.zoneId || mReq.zoneId !== run.zoneId)) hasDrift = true;
      if (mReq.status && !activeStatuses.includes(mReq.status)) hasDrift = true;
      if (mReq.coordinationOptInSetAt) {
        const optInDate = new Date(mReq.coordinationOptInSetAt);
        if (optInDate < ageThresholdDate) hasDrift = true;
      }
      
      if (hasDrift) {
        withDrift.add(mReq.maintenanceRequestId);
      }
    }
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_readiness_drift_evaluated', {
      event: 'n3_run_readiness_drift_evaluated',
      run_id: runId,
      actor_id: actorId,
      tenant_id: tenantId,
      evaluated_at: evaluatedAt,
    });
    
    // Build response - counts only, no PII or IDs
    const response: any = {
      run_id: runId,
      status: run.status,
      evaluated_at: evaluatedAt,
      active_statuses: activeStatuses,
      totals: {
        attached: attachedRequests.length,
        with_drift: withDrift.size,
      },
      drift: {},
    };
    
    // Only include drift types with count > 0
    if (coordinationOptOutCount > 0) {
      response.drift.coordination_opt_out = { count: coordinationOptOutCount };
    }
    if (zoneMismatchCount > 0) {
      response.drift.zone_mismatch = { count: zoneMismatchCount };
    }
    if (inactiveStatusCount > 0) {
      response.drift.inactive_status = { count: inactiveStatusCount };
    }
    if (ageExceededCount > 0) {
      response.drift.age_exceeded = { 
        count: ageExceededCount,
        threshold_days: ageDays,
      };
    }
    
    res.json(response);
  } catch (err) {
    console.error('[N3 API] Error evaluating readiness drift:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ============ PRE-EXECUTION LOCK / READINESS SNAPSHOT ============
 * 
 * Records what the operator believed was true at the moment they locked the run.
 * This is a planning artifact, not a system guarantee.
 */

/**
 * GET /api/n3/runs/:runId/readiness-lock
 * 
 * Check if a run has a readiness snapshot locked.
 * Returns the snapshot if it exists, null otherwise.
 * Admin/owner only.
 */
n3Router.get('/runs/:runId/readiness-lock', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id, status: ccN3Runs.status })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Get snapshot if exists
    const snapshots = await db
      .select()
      .from(ccN3RunReadinessSnapshots)
      .where(and(
        eq(ccN3RunReadinessSnapshots.runId, runId),
        eq(ccN3RunReadinessSnapshots.tenantId, tenantId)
      ))
      .limit(1);
    
    if (snapshots.length === 0) {
      return res.json({ locked: false, snapshot: null });
    }
    
    const snapshot = snapshots[0];
    
    res.json({
      locked: true,
      snapshot: {
        id: snapshot.id,
        run_id: snapshot.runId,
        locked_at: snapshot.lockedAt,
        locked_by: snapshot.lockedBy,
        note: snapshot.note,
        payload: snapshot.snapshotPayload,
      }
    });
  } catch (err) {
    console.error('[N3 API] Error fetching readiness lock:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/:runId/readiness-lock
 * 
 * Lock the run's readiness state by creating a snapshot.
 * Captures current state as planning artifact.
 * Admin/owner only. Only draft or scheduled runs can be locked.
 * 
 * Body:
 * - note: optional string
 */
const lockReadinessSchema = z.object({
  note: z.string().max(500).optional(),
});

n3Router.post('/runs/:runId/readiness-lock', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const actorId = tenantReq.user?.id || 'system';
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    const parsed = lockReadinessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }
    
    const { note } = parsed.data;
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({
        id: ccN3Runs.id,
        status: ccN3Runs.status,
        name: ccN3Runs.name,
        zoneId: ccN3Runs.zoneId,
        portalId: ccN3Runs.portalId,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Only draft or scheduled runs can be locked
    if (run.status !== 'draft' && run.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Only draft or scheduled runs can be locked',
        code: 'INVALID_STATUS',
      });
    }
    
    // Check if already locked
    const existingSnapshots = await db
      .select({ id: ccN3RunReadinessSnapshots.id })
      .from(ccN3RunReadinessSnapshots)
      .where(eq(ccN3RunReadinessSnapshots.runId, runId))
      .limit(1);
    
    if (existingSnapshots.length > 0) {
      return res.status(409).json({
        error: 'Run is already locked',
        code: 'ALREADY_LOCKED',
      });
    }
    
    // Fetch attached maintenance requests for snapshot
    const attachedRequests = await db
      .select({
        maintenanceRequestId: ccN3RunMaintenanceRequests.maintenanceRequestId,
        attachedAt: ccN3RunMaintenanceRequests.attachedAt,
        status: ccMaintenanceRequests.status,
        zoneId: ccMaintenanceRequests.zoneId,
        coordinationOptIn: ccMaintenanceRequests.coordinationOptIn,
        coordinationOptInSetAt: ccMaintenanceRequests.coordinationOptInSetAt,
      })
      .from(ccN3RunMaintenanceRequests)
      .innerJoin(
        ccMaintenanceRequests,
        eq(ccN3RunMaintenanceRequests.maintenanceRequestId, ccMaintenanceRequests.id)
      )
      .where(and(
        eq(ccN3RunMaintenanceRequests.runId, runId),
        eq(ccN3RunMaintenanceRequests.tenantId, tenantId)
      ));
    
    // Build snapshot payload
    const snapshotPayload = {
      run: {
        id: run.id,
        name: run.name,
        status: run.status,
        zone_id: run.zoneId,
        portal_id: run.portalId,
        starts_at: run.startsAt,
        ends_at: run.endsAt,
      },
      attached_requests: attachedRequests.map(r => ({
        maintenance_request_id: r.maintenanceRequestId,
        attached_at: r.attachedAt,
        status_at_lock: r.status,
        zone_id_at_lock: r.zoneId,
        coordination_opt_in_at_lock: r.coordinationOptIn,
        coordination_opt_in_set_at: r.coordinationOptInSetAt,
      })),
      summary: {
        total_attached: attachedRequests.length,
        opted_in_count: attachedRequests.filter(r => r.coordinationOptIn).length,
        opted_out_count: attachedRequests.filter(r => !r.coordinationOptIn).length,
      },
    };
    
    const lockedAt = new Date();
    
    // Create snapshot
    const [newSnapshot] = await db
      .insert(ccN3RunReadinessSnapshots)
      .values({
        tenantId,
        runId,
        lockedAt,
        lockedBy: actorId,
        note: note || null,
        snapshotPayload,
      })
      .returning();
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_readiness_locked', {
      event: 'n3_run_readiness_locked',
      run_id: runId,
      snapshot_id: newSnapshot.id,
      actor_id: actorId,
      tenant_id: tenantId,
      locked_at: lockedAt.toISOString(),
      attached_count: attachedRequests.length,
    });
    
    res.json({
      success: true,
      snapshot: {
        id: newSnapshot.id,
        run_id: newSnapshot.runId,
        locked_at: newSnapshot.lockedAt,
        locked_by: newSnapshot.lockedBy,
        note: newSnapshot.note,
        payload: newSnapshot.snapshotPayload,
      }
    });
  } catch (err) {
    console.error('[N3 API] Error locking readiness:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/n3/runs/:runId/readiness-unlock
 * 
 * Unlock the run by deleting the readiness snapshot.
 * Admin/owner only.
 */
n3Router.post('/runs/:runId/readiness-unlock', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const actorId = tenantReq.user?.id || 'system';
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id, status: ccN3Runs.status })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Check if locked
    const existingSnapshots = await db
      .select({ id: ccN3RunReadinessSnapshots.id, lockedAt: ccN3RunReadinessSnapshots.lockedAt })
      .from(ccN3RunReadinessSnapshots)
      .where(and(
        eq(ccN3RunReadinessSnapshots.runId, runId),
        eq(ccN3RunReadinessSnapshots.tenantId, tenantId)
      ))
      .limit(1);
    
    if (existingSnapshots.length === 0) {
      return res.status(404).json({
        error: 'Run is not locked',
        code: 'NOT_LOCKED',
      });
    }
    
    const snapshotId = existingSnapshots[0].id;
    const wasLockedAt = existingSnapshots[0].lockedAt;
    
    // Delete snapshot
    await db
      .delete(ccN3RunReadinessSnapshots)
      .where(eq(ccN3RunReadinessSnapshots.id, snapshotId));
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_readiness_unlocked', {
      event: 'n3_run_readiness_unlocked',
      run_id: runId,
      snapshot_id: snapshotId,
      actor_id: actorId,
      tenant_id: tenantId,
      unlocked_at: new Date().toISOString(),
      was_locked_at: wasLockedAt,
    });
    
    res.json({ success: true, unlocked: true });
  } catch (err) {
    console.error('[N3 API] Error unlocking readiness:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * ============ EXECUTION ELIGIBILITY GATE (Prompt 31) ============
 * 
 * Compares locked snapshot against current live state.
 * Advisory only - no execution, no notifications, no blocking.
 */

/**
 * GET /api/n3/runs/:runId/execution-eligibility
 * 
 * Compare locked snapshot vs live state for advisory eligibility check.
 * Returns counts + deltas only (no PII, no IDs).
 * Admin/owner only. Requires active snapshot.
 */
n3Router.get('/runs/:runId/execution-eligibility', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const actorId = tenantReq.user?.id || 'system';
  const evaluatedAt = new Date().toISOString();
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({
        id: ccN3Runs.id,
        status: ccN3Runs.status,
        zoneId: ccN3Runs.zoneId,
        portalId: ccN3Runs.portalId,
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Only draft or scheduled runs
    if (run.status !== 'draft' && run.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Eligibility check only applies to draft or scheduled runs',
        code: 'INVALID_STATUS',
      });
    }
    
    // Get snapshot (required)
    const snapshots = await db
      .select()
      .from(ccN3RunReadinessSnapshots)
      .where(and(
        eq(ccN3RunReadinessSnapshots.runId, runId),
        eq(ccN3RunReadinessSnapshots.tenantId, tenantId)
      ))
      .limit(1);
    
    if (snapshots.length === 0) {
      return res.status(409).json({
        error: 'Snapshot required for eligibility check',
        code: 'SNAPSHOT_REQUIRED',
      });
    }
    
    const snapshot = snapshots[0];
    const snapshotPayload = snapshot.snapshotPayload as {
      run: {
        id: string;
        name: string;
        status: string;
        zone_id: string | null;
        portal_id: string | null;
        starts_at: string | null;
        ends_at: string | null;
      };
      attached_requests: Array<{
        maintenance_request_id: string;
        attached_at: string;
        status_at_lock: string;
        zone_id_at_lock: string | null;
        coordination_opt_in_at_lock: boolean;
        coordination_opt_in_set_at: string | null;
      }>;
      summary: {
        total_attached: number;
        opted_in_count: number;
        opted_out_count: number;
      };
    };
    
    // --- Collect Live State ---
    
    // Live attached maintenance requests
    const liveAttached = await db
      .select({
        maintenanceRequestId: ccN3RunMaintenanceRequests.maintenanceRequestId,
        status: ccMaintenanceRequests.status,
        category: ccMaintenanceRequests.category,
        zoneId: ccMaintenanceRequests.zoneId,
        coordinationOptIn: ccMaintenanceRequests.coordinationOptIn,
        coordinationOptInSetAt: ccMaintenanceRequests.coordinationOptInSetAt,
      })
      .from(ccN3RunMaintenanceRequests)
      .innerJoin(
        ccMaintenanceRequests,
        eq(ccN3RunMaintenanceRequests.maintenanceRequestId, ccMaintenanceRequests.id)
      )
      .where(and(
        eq(ccN3RunMaintenanceRequests.runId, runId),
        eq(ccN3RunMaintenanceRequests.tenantId, tenantId)
      ));
    
    // Live counts
    const liveAttachedCount = liveAttached.length;
    const liveOptedInCount = liveAttached.filter(r => r.coordinationOptIn).length;
    const liveOptedOutCount = liveAttached.filter(r => !r.coordinationOptIn).length;
    
    // Snapshot counts
    const snapshotAttachedCount = snapshotPayload.summary.total_attached;
    const snapshotOptedInCount = snapshotPayload.summary.opted_in_count;
    const snapshotOptedOutCount = snapshotPayload.summary.opted_out_count;
    
    // --- Compute Deltas ---
    
    // Attachment deltas
    const attachedCountDelta = liveAttachedCount - snapshotAttachedCount;
    
    // Category deltas (count per category in live vs snapshot)
    const liveCategoryCounts: Record<string, number> = {};
    for (const r of liveAttached) {
      const cat = r.category || 'uncategorized';
      liveCategoryCounts[cat] = (liveCategoryCounts[cat] || 0) + 1;
    }
    
    const snapshotCategoryCounts: Record<string, number> = {};
    for (const r of snapshotPayload.attached_requests) {
      // We don't have category in snapshot, so skip category deltas for now
      // This could be enhanced in future prompts
    }
    
    // Coordination deltas
    const coordReadyCountDelta = liveOptedInCount - snapshotOptedInCount;
    const snapshotOptInRatio = snapshotAttachedCount > 0 ? snapshotOptedInCount / snapshotAttachedCount : 0;
    const liveOptInRatio = liveAttachedCount > 0 ? liveOptedInCount / liveAttachedCount : 0;
    const optInRatioDelta = liveOptInRatio - snapshotOptInRatio;
    
    // Readiness drift deltas (compare snapshot state to live state)
    const activeStatuses = ['reported', 'triaged', 'scheduled'];
    const ageDays = 30;
    const ageThresholdDate = new Date();
    ageThresholdDate.setDate(ageThresholdDate.getDate() - ageDays);
    
    // Count drift types in snapshot (at lock time)
    let snapshotOptOutDrift = 0;
    let snapshotZoneMismatchDrift = 0;
    let snapshotInactiveStatusDrift = 0;
    let snapshotAgeExceededDrift = 0;
    
    for (const req of snapshotPayload.attached_requests) {
      if (!req.coordination_opt_in_at_lock) snapshotOptOutDrift++;
      if (snapshotPayload.run.zone_id && (!req.zone_id_at_lock || req.zone_id_at_lock !== snapshotPayload.run.zone_id)) {
        snapshotZoneMismatchDrift++;
      }
      if (req.status_at_lock && !activeStatuses.includes(req.status_at_lock)) {
        snapshotInactiveStatusDrift++;
      }
      if (req.coordination_opt_in_set_at) {
        const optInDate = new Date(req.coordination_opt_in_set_at);
        if (optInDate < ageThresholdDate) {
          snapshotAgeExceededDrift++;
        }
      }
    }
    
    // Count drift types in live state
    let liveOptOutDrift = 0;
    let liveZoneMismatchDrift = 0;
    let liveInactiveStatusDrift = 0;
    let liveAgeExceededDrift = 0;
    
    for (const req of liveAttached) {
      if (!req.coordinationOptIn) liveOptOutDrift++;
      if (run.zoneId && (!req.zoneId || req.zoneId !== run.zoneId)) {
        liveZoneMismatchDrift++;
      }
      if (req.status && !activeStatuses.includes(req.status)) {
        liveInactiveStatusDrift++;
      }
      if (req.coordinationOptInSetAt) {
        const optInDate = new Date(req.coordinationOptInSetAt);
        if (optInDate < ageThresholdDate) {
          liveAgeExceededDrift++;
        }
      }
    }
    
    // Drift deltas
    const driftDeltas = {
      coordination_opt_out: liveOptOutDrift - snapshotOptOutDrift,
      zone_mismatch: liveZoneMismatchDrift - snapshotZoneMismatchDrift,
      inactive_status: liveInactiveStatusDrift - snapshotInactiveStatusDrift,
      age_exceeded: liveAgeExceededDrift - snapshotAgeExceededDrift,
    };
    
    // --- Eligibility Classification ---
    // Tolerance thresholds (configurable)
    const tolerances = {
      optInRatioThreshold: 0.10, // 10%
      attachedCountThreshold: 2,
      driftThreshold: 1,
    };
    
    let overall: 'unchanged' | 'improved' | 'degraded' = 'unchanged';
    
    // Check for degradation
    const hasDegradation = 
      optInRatioDelta < -tolerances.optInRatioThreshold ||
      attachedCountDelta < -tolerances.attachedCountThreshold ||
      driftDeltas.coordination_opt_out > 0 ||
      driftDeltas.zone_mismatch > 0 ||
      driftDeltas.inactive_status > 0 ||
      driftDeltas.age_exceeded > 0;
    
    // Check for improvement
    const hasImprovement = 
      coordReadyCountDelta > 0 ||
      optInRatioDelta > tolerances.optInRatioThreshold ||
      driftDeltas.coordination_opt_out < 0 ||
      driftDeltas.zone_mismatch < 0 ||
      driftDeltas.inactive_status < 0 ||
      driftDeltas.age_exceeded < 0;
    
    if (hasDegradation) {
      overall = 'degraded';
    } else if (hasImprovement) {
      overall = 'improved';
    }
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_execution_eligibility_evaluated', {
      event: 'n3_run_execution_eligibility_evaluated',
      run_id: runId,
      tenant_id: tenantId,
      actor_id: actorId,
      occurred_at: evaluatedAt,
      overall,
    });
    
    // Build response (counts + deltas only, no PII)
    const response: any = {
      run_id: runId,
      evaluated_at: evaluatedAt,
      snapshot: {
        locked_at: snapshot.lockedAt,
        locked_by: snapshot.lockedBy,
      },
      eligibility: {
        overall,
      },
      deltas: {},
    };
    
    // Only include non-zero deltas
    if (attachedCountDelta !== 0) {
      response.deltas.attachments = {
        attached_count_delta: attachedCountDelta,
      };
    }
    
    if (coordReadyCountDelta !== 0 || Math.abs(optInRatioDelta) > 0.01) {
      response.deltas.coordination = {
        coord_ready_count_delta: coordReadyCountDelta,
        opt_in_ratio_delta: Math.round(optInRatioDelta * 100) / 100,
      };
    }
    
    const hasNonZeroDrift = 
      driftDeltas.coordination_opt_out !== 0 ||
      driftDeltas.zone_mismatch !== 0 ||
      driftDeltas.inactive_status !== 0 ||
      driftDeltas.age_exceeded !== 0;
    
    if (hasNonZeroDrift) {
      response.deltas.readiness_drift = {};
      if (driftDeltas.coordination_opt_out !== 0) {
        response.deltas.readiness_drift.coordination_opt_out = driftDeltas.coordination_opt_out;
      }
      if (driftDeltas.zone_mismatch !== 0) {
        response.deltas.readiness_drift.zone_mismatch = driftDeltas.zone_mismatch;
      }
      if (driftDeltas.inactive_status !== 0) {
        response.deltas.readiness_drift.inactive_status = driftDeltas.inactive_status;
      }
      if (driftDeltas.age_exceeded !== 0) {
        response.deltas.readiness_drift.age_exceeded = driftDeltas.age_exceeded;
      }
    }
    
    res.json(response);
  } catch (err) {
    console.error('[N3 API] Error evaluating execution eligibility:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ EXECUTION HANDOFF (Prompt 32) ============

/**
 * POST /api/n3/runs/:runId/execution-handoff
 * 
 * Create an immutable execution handoff record that captures:
 * - The locked readiness snapshot
 * - The execution eligibility evaluation
 * - The current run configuration
 * 
 * This is a read-only contract of intent - NOT execution or activation.
 * Admin/owner only. Requires active readiness snapshot.
 */
n3Router.post('/runs/:runId/execution-handoff', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const actorId = tenantReq.user?.id || 'system';
  const capturedAt = new Date().toISOString();
  const { note } = req.body || {};
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        status: ccN3Runs.status,
        zoneId: ccN3Runs.zoneId,
        portalId: ccN3Runs.portalId,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Only draft or scheduled runs
    if (run.status !== 'draft' && run.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Handoff only available for draft or scheduled runs',
        code: 'INVALID_STATUS',
      });
    }
    
    // Check if handoff already exists (one per run)
    const existingHandoff = await db
      .select({ id: ccN3RunExecutionHandoffs.id })
      .from(ccN3RunExecutionHandoffs)
      .where(eq(ccN3RunExecutionHandoffs.runId, runId))
      .limit(1);
    
    if (existingHandoff.length > 0) {
      return res.status(409).json({
        error: 'Execution handoff already exists for this run',
        code: 'HANDOFF_EXISTS',
      });
    }
    
    // Get snapshot (required)
    const snapshots = await db
      .select()
      .from(ccN3RunReadinessSnapshots)
      .where(and(
        eq(ccN3RunReadinessSnapshots.runId, runId),
        eq(ccN3RunReadinessSnapshots.tenantId, tenantId)
      ))
      .limit(1);
    
    if (snapshots.length === 0) {
      return res.status(409).json({
        error: 'Readiness snapshot required before creating handoff',
        code: 'SNAPSHOT_REQUIRED',
      });
    }
    
    const snapshot = snapshots[0];
    
    // --- Compute Execution Eligibility (same logic as GET endpoint) ---
    const snapshotPayload = snapshot.snapshotPayload as {
      run: {
        id: string;
        name: string;
        status: string;
        zone_id: string | null;
        portal_id: string | null;
        starts_at: string | null;
        ends_at: string | null;
      };
      attached_requests: Array<{
        maintenance_request_id: string;
        attached_at: string;
        status_at_lock: string;
        zone_id_at_lock: string | null;
        coordination_opt_in_at_lock: boolean;
        coordination_opt_in_set_at: string | null;
      }>;
      summary: {
        total_attached: number;
        opted_in_count: number;
        opted_out_count: number;
      };
    };
    
    // Live attached maintenance requests
    const liveAttached = await db
      .select({
        maintenanceRequestId: ccN3RunMaintenanceRequests.maintenanceRequestId,
        status: ccMaintenanceRequests.status,
        category: ccMaintenanceRequests.category,
        zoneId: ccMaintenanceRequests.zoneId,
        coordinationOptIn: ccMaintenanceRequests.coordinationOptIn,
        coordinationOptInSetAt: ccMaintenanceRequests.coordinationOptInSetAt,
      })
      .from(ccN3RunMaintenanceRequests)
      .innerJoin(ccMaintenanceRequests, eq(ccN3RunMaintenanceRequests.maintenanceRequestId, ccMaintenanceRequests.id))
      .where(eq(ccN3RunMaintenanceRequests.runId, runId));
    
    // Snapshot state
    const snapshotAttachedCount = snapshotPayload.summary.total_attached;
    const snapshotOptedInCount = snapshotPayload.summary.opted_in_count;
    
    // Live state
    const liveAttachedCount = liveAttached.length;
    const liveOptedInCount = liveAttached.filter(r => r.coordinationOptIn === true).length;
    
    // Deltas
    const attachedCountDelta = liveAttachedCount - snapshotAttachedCount;
    const coordReadyCountDelta = liveOptedInCount - snapshotOptedInCount;
    
    const snapshotOptInRatio = snapshotAttachedCount > 0 ? snapshotOptedInCount / snapshotAttachedCount : 0;
    const liveOptInRatio = liveAttachedCount > 0 ? liveOptedInCount / liveAttachedCount : 0;
    const optInRatioDelta = liveOptInRatio - snapshotOptInRatio;
    
    // Drift calculations
    let liveOptOutDrift = 0;
    let liveZoneMismatchDrift = 0;
    let liveInactiveStatusDrift = 0;
    let liveAgeExceededDrift = 0;
    
    const activeStatuses = ['open', 'pending', 'in_progress'];
    
    for (const req of liveAttached) {
      if (req.coordinationOptIn === false) liveOptOutDrift++;
      if (req.zoneId !== run.zoneId) liveZoneMismatchDrift++;
      if (!activeStatuses.includes(req.status || '')) liveInactiveStatusDrift++;
      
      if (req.coordinationOptInSetAt) {
        const setAt = new Date(req.coordinationOptInSetAt as any);
        const now = new Date();
        const daysSince = (now.getTime() - setAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 14) liveAgeExceededDrift++;
      }
    }
    
    let snapshotOptOutDrift = 0;
    let snapshotZoneMismatchDrift = 0;
    let snapshotInactiveStatusDrift = 0;
    let snapshotAgeExceededDrift = 0;
    
    const snapshotZoneId = snapshotPayload.run.zone_id;
    const lockDate = new Date(snapshot.lockedAt);
    
    for (const req of snapshotPayload.attached_requests) {
      if (!req.coordination_opt_in_at_lock) snapshotOptOutDrift++;
      if (req.zone_id_at_lock !== snapshotZoneId) snapshotZoneMismatchDrift++;
      if (!activeStatuses.includes(req.status_at_lock || '')) snapshotInactiveStatusDrift++;
      
      if (req.coordination_opt_in_set_at) {
        const setAt = new Date(req.coordination_opt_in_set_at);
        const daysSince = (lockDate.getTime() - setAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 14) snapshotAgeExceededDrift++;
      }
    }
    
    const driftDeltas = {
      coordination_opt_out: liveOptOutDrift - snapshotOptOutDrift,
      zone_mismatch: liveZoneMismatchDrift - snapshotZoneMismatchDrift,
      inactive_status: liveInactiveStatusDrift - snapshotInactiveStatusDrift,
      age_exceeded: liveAgeExceededDrift - snapshotAgeExceededDrift,
    };
    
    // Eligibility classification
    const tolerances = {
      optInRatioThreshold: 0.10,
      attachedCountThreshold: 2,
      driftThreshold: 1,
    };
    
    let overall: 'unchanged' | 'improved' | 'degraded' = 'unchanged';
    
    const hasDegradation = 
      optInRatioDelta < -tolerances.optInRatioThreshold ||
      attachedCountDelta < -tolerances.attachedCountThreshold ||
      driftDeltas.coordination_opt_out > 0 ||
      driftDeltas.zone_mismatch > 0 ||
      driftDeltas.inactive_status > 0 ||
      driftDeltas.age_exceeded > 0;
    
    const hasImprovement = 
      coordReadyCountDelta > 0 ||
      optInRatioDelta > tolerances.optInRatioThreshold ||
      driftDeltas.coordination_opt_out < 0 ||
      driftDeltas.zone_mismatch < 0 ||
      driftDeltas.inactive_status < 0 ||
      driftDeltas.age_exceeded < 0;
    
    if (hasDegradation) {
      overall = 'degraded';
    } else if (hasImprovement) {
      overall = 'improved';
    }
    
    // --- Build Handoff Payload ---
    const eligibilityDeltas: any = {};
    
    if (attachedCountDelta !== 0) {
      eligibilityDeltas.attachments = { attached_count_delta: attachedCountDelta };
    }
    
    if (coordReadyCountDelta !== 0 || Math.abs(optInRatioDelta) > 0.01) {
      eligibilityDeltas.coordination = {
        coord_ready_count_delta: coordReadyCountDelta,
        opt_in_ratio_delta: Math.round(optInRatioDelta * 100) / 100,
      };
    }
    
    const hasNonZeroDrift = 
      driftDeltas.coordination_opt_out !== 0 ||
      driftDeltas.zone_mismatch !== 0 ||
      driftDeltas.inactive_status !== 0 ||
      driftDeltas.age_exceeded !== 0;
    
    if (hasNonZeroDrift) {
      eligibilityDeltas.readiness_drift = {};
      if (driftDeltas.coordination_opt_out !== 0) {
        eligibilityDeltas.readiness_drift.coordination_opt_out = driftDeltas.coordination_opt_out;
      }
      if (driftDeltas.zone_mismatch !== 0) {
        eligibilityDeltas.readiness_drift.zone_mismatch = driftDeltas.zone_mismatch;
      }
      if (driftDeltas.inactive_status !== 0) {
        eligibilityDeltas.readiness_drift.inactive_status = driftDeltas.inactive_status;
      }
      if (driftDeltas.age_exceeded !== 0) {
        eligibilityDeltas.readiness_drift.age_exceeded = driftDeltas.age_exceeded;
      }
    }
    
    const handoffPayload = {
      run: {
        id: run.id,
        status: run.status,
        portal_id: run.portalId,
        zone_id: run.zoneId,
        starts_at: run.startsAt?.toISOString() || null,
        ends_at: run.endsAt?.toISOString() || null,
      },
      readiness_snapshot: {
        locked_at: snapshot.lockedAt?.toISOString(),
        locked_by: snapshot.lockedBy,
        summary: snapshotPayload.summary,
      },
      execution_eligibility: {
        evaluated_at: capturedAt,
        overall,
        deltas: eligibilityDeltas,
      },
      captured_at: capturedAt,
    };
    
    // --- Create Handoff Record ---
    const inserted = await db
      .insert(ccN3RunExecutionHandoffs)
      .values({
        runId,
        tenantId,
        portalId: run.portalId,
        zoneId: run.zoneId,
        handoffPayload,
        createdBy: actorId,
        note: note?.slice(0, 280) || null,
      })
      .returning({ id: ccN3RunExecutionHandoffs.id, createdAt: ccN3RunExecutionHandoffs.createdAt });
    
    const handoff = inserted[0];
    
    // Audit log
    console.log('[N3 AUDIT] n3_run_execution_handoff_created', {
      event: 'n3_run_execution_handoff_created',
      run_id: runId,
      tenant_id: tenantId,
      portal_id: run.portalId,
      zone_id: run.zoneId,
      actor_id: actorId,
      occurred_at: capturedAt,
    });
    
    res.status(201).json({
      success: true,
      handoff_id: handoff.id,
      created_at: handoff.createdAt,
    });
  } catch (err) {
    console.error('[N3 API] Error creating execution handoff:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/execution-handoff
 * 
 * Retrieve the stored execution handoff payload.
 * Admin/owner only. 404 if none exists.
 */
n3Router.get('/runs/:runId/execution-handoff', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Get handoff
    const handoffs = await db
      .select()
      .from(ccN3RunExecutionHandoffs)
      .where(and(
        eq(ccN3RunExecutionHandoffs.runId, runId),
        eq(ccN3RunExecutionHandoffs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (handoffs.length === 0) {
      return res.status(404).json({ error: 'No execution handoff exists for this run' });
    }
    
    const handoff = handoffs[0];
    
    res.json({
      id: handoff.id,
      run_id: handoff.runId,
      created_at: handoff.createdAt,
      created_by: handoff.createdBy,
      note: handoff.note,
      payload: handoff.handoffPayload,
    });
  } catch (err) {
    console.error('[N3 API] Error fetching execution handoff:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ EXECUTION CONTRACTS (Prompt 33) ============

/**
 * Compute SHA256 hash of a JSON payload
 */
function computePayloadHash(payload: object): string {
  const payloadString = JSON.stringify(payload);
  return createHash('sha256').update(payloadString).digest('hex');
}

/**
 * Execution Consumer Guard (read-only access for execution systems)
 * For now, allows admin/owner or platform admin access.
 * Future: Add mTLS, service tokens, or internal execution role checks.
 */
/**
 * PROMPT-10: Uses capability check instead of isPlatformAdmin flag
 */
async function requireExecutionConsumer(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const roles = tenantReq.ctx?.roles || [];
  
  // Check tenant roles first
  const hasTenantAdminRole = 
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin');
  
  // PROMPT-10: Use capability check instead of isPlatformAdmin flag  
  const hasPlatformCapability = await can(req, 'platform.configure');
  
  if (!hasTenantAdminRole && !hasPlatformCapability) {
    return res.status(403).json({ 
      error: 'Execution consumer access required',
      code: 'CONSUMER_ACCESS_REQUIRED'
    });
  }
  next();
}

/**
 * POST /api/n3/runs/:runId/execution-contract
 * 
 * Create an immutable, cryptographically verifiable execution contract.
 * Requires: readiness snapshot, execution eligibility, execution handoff.
 * Admin/owner only. One contract per run.
 */
n3Router.post('/runs/:runId/execution-contract', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const actorId = tenantReq.user?.id || 'system';
  const issuedAt = new Date().toISOString();
  const { note } = req.body || {};
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        status: ccN3Runs.status,
        zoneId: ccN3Runs.zoneId,
        portalId: ccN3Runs.portalId,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Only draft or scheduled runs
    if (run.status !== 'draft' && run.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Execution contract only available for draft or scheduled runs',
        code: 'INVALID_STATUS',
      });
    }
    
    // Check if contract already exists (one per run)
    const existingContract = await db
      .select({ id: ccN3ExecutionContracts.id })
      .from(ccN3ExecutionContracts)
      .where(eq(ccN3ExecutionContracts.runId, runId))
      .limit(1);
    
    if (existingContract.length > 0) {
      return res.status(409).json({
        error: 'Execution contract already exists for this run',
        code: 'CONTRACT_EXISTS',
      });
    }
    
    // Get snapshot (required)
    const snapshots = await db
      .select()
      .from(ccN3RunReadinessSnapshots)
      .where(and(
        eq(ccN3RunReadinessSnapshots.runId, runId),
        eq(ccN3RunReadinessSnapshots.tenantId, tenantId)
      ))
      .limit(1);
    
    if (snapshots.length === 0) {
      return res.status(409).json({
        error: 'Readiness snapshot required before creating execution contract',
        code: 'SNAPSHOT_REQUIRED',
      });
    }
    
    const snapshot = snapshots[0];
    
    // Get handoff (required)
    const handoffs = await db
      .select()
      .from(ccN3RunExecutionHandoffs)
      .where(and(
        eq(ccN3RunExecutionHandoffs.runId, runId),
        eq(ccN3RunExecutionHandoffs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (handoffs.length === 0) {
      return res.status(409).json({
        error: 'Execution handoff required before creating execution contract',
        code: 'HANDOFF_REQUIRED',
      });
    }
    
    const handoff = handoffs[0];
    const handoffPayload = handoff.handoffPayload as {
      readiness_snapshot?: {
        locked_at: string;
        locked_by: string;
        summary: {
          total_attached: number;
          opted_in_count: number;
          opted_out_count: number;
          drift_count?: number;
        };
      };
      execution_eligibility?: {
        evaluated_at: string;
        overall: string;
        deltas: {
          opt_in_ratio: { classification: string };
          attached_count: { classification: string };
          drift: { classification: string };
        };
      };
    };
    
    // Validate handoff has execution eligibility
    if (!handoffPayload.execution_eligibility) {
      return res.status(409).json({
        error: 'Execution eligibility evaluation required before creating execution contract',
        code: 'ELIGIBILITY_REQUIRED',
      });
    }
    
    // Build contract payload (counts only, no PII)
    const contractPayload = {
      run: {
        id: run.id,
        status: run.status,
        starts_at: run.startsAt?.toISOString() || null,
        ends_at: run.endsAt?.toISOString() || null,
      },
      scope: {
        portal_id: run.portalId,
        zone_id: run.zoneId,
      },
      planning_state: {
        attached_requests: handoffPayload.readiness_snapshot?.summary.total_attached || 0,
        coordination_opt_in: handoffPayload.readiness_snapshot?.summary.opted_in_count || 0,
        unassigned: 0,
      },
      eligibility: {
        status: handoffPayload.execution_eligibility?.overall || 'unknown',
        evaluated_at: handoffPayload.execution_eligibility?.evaluated_at || issuedAt,
      },
      readiness_snapshot: {
        locked_at: handoffPayload.readiness_snapshot?.locked_at || null,
        counts: {
          attached: handoffPayload.readiness_snapshot?.summary.total_attached || 0,
          coord_ready: handoffPayload.readiness_snapshot?.summary.opted_in_count || 0,
          drift: handoffPayload.readiness_snapshot?.summary.drift_count || 0,
        },
      },
      advisory_only: true,
    };
    
    // Compute hash
    const payloadHash = computePayloadHash(contractPayload);
    
    // Insert contract
    const [contract] = await db
      .insert(ccN3ExecutionContracts)
      .values({
        runId,
        tenantId,
        portalId: run.portalId,
        zoneId: run.zoneId,
        contractPayload,
        payloadHash,
        payloadVersion: 'v1',
        issuedAt: new Date(),
        issuedBy: actorId,
        note: note ? String(note).slice(0, 280) : null,
      })
      .returning();
    
    // Emit audit log
    console.log('[N3 AUDIT] n3_execution_contract_issued', {
      run_id: runId,
      tenant_id: tenantId,
      portal_id: run.portalId,
      zone_id: run.zoneId,
      payload_hash: payloadHash,
      issued_by: actorId,
      issued_at: issuedAt,
    });
    
    res.status(201).json({
      id: contract.id,
      run_id: contract.runId,
      payload_hash: contract.payloadHash,
      payload_version: contract.payloadVersion,
      issued_at: contract.issuedAt,
      issued_by: contract.issuedBy,
      note: contract.note,
    });
  } catch (err) {
    console.error('[N3 API] Error creating execution contract:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/execution-contract
 * 
 * Retrieve the execution contract for consumption by execution systems.
 * Read-only. Execution consumer guard.
 */
n3Router.get('/runs/:runId/execution-contract', requireAuth, requireTenant, requireExecutionConsumer, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Get contract
    const contracts = await db
      .select()
      .from(ccN3ExecutionContracts)
      .where(and(
        eq(ccN3ExecutionContracts.runId, runId),
        eq(ccN3ExecutionContracts.tenantId, tenantId)
      ))
      .limit(1);
    
    if (contracts.length === 0) {
      return res.status(404).json({ error: 'No execution contract exists for this run' });
    }
    
    const contract = contracts[0];
    
    res.json({
      contract: contract.contractPayload,
      payload_hash: contract.payloadHash,
      payload_version: contract.payloadVersion,
      issued_at: contract.issuedAt,
    });
  } catch (err) {
    console.error('[N3 API] Error fetching execution contract:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ EXECUTION RECEIPTS (APPEND-ONLY PROOF CHANNEL) ============

// Forbidden keys that must not appear in receipt payloads (PII protection)
const FORBIDDEN_RECEIPT_KEYS = [
  'id', 'work_request_id', 'request_id', 'contractor_id', 'user_id',
  'name', 'email', 'phone', 'address', 'price', 'amount', 'payment',
  'resident', 'contractor', 'owner', 'tenant'
];

// Validate receipt payload contains no forbidden keys (recursive)
function validateReceiptPayload(obj: unknown, path = ''): string[] {
  const violations: string[] = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_RECEIPT_KEYS.some(forbidden => lowerKey.includes(forbidden))) {
        violations.push(`${path}${key}`);
      }
      violations.push(...validateReceiptPayload((obj as Record<string, unknown>)[key], `${path}${key}.`));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      violations.push(...validateReceiptPayload(item, `${path}[${idx}].`));
    });
  }
  return violations;
}

/**
 * POST /api/n3/runs/:runId/execution-receipts
 * 
 * Append-only endpoint for execution engines to submit evidence receipts.
 * Receipts are immutable, counts-only, cryptographically bound to contracts.
 * No UPDATE/DELETE - append-only design.
 */
n3Router.post('/runs/:runId/execution-receipts', requireAuth, requireTenant, requireExecutionConsumer, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    const { execution_contract_id, payload_hash, receipt_payload, reported_by } = req.body;
    
    // Validate required fields
    if (!execution_contract_id) {
      return res.status(400).json({ error: 'Missing execution_contract_id' });
    }
    if (!payload_hash) {
      return res.status(400).json({ error: 'Missing payload_hash' });
    }
    if (!receipt_payload) {
      return res.status(400).json({ error: 'Missing receipt_payload' });
    }
    if (!reported_by) {
      return res.status(400).json({ error: 'Missing reported_by' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Verify execution contract exists and belongs to this run
    const contracts = await db
      .select({
        id: ccN3ExecutionContracts.id,
        runId: ccN3ExecutionContracts.runId,
        payloadHash: ccN3ExecutionContracts.payloadHash
      })
      .from(ccN3ExecutionContracts)
      .where(and(
        eq(ccN3ExecutionContracts.id, execution_contract_id),
        eq(ccN3ExecutionContracts.tenantId, tenantId)
      ))
      .limit(1);
    
    if (contracts.length === 0) {
      return res.status(404).json({ error: 'Execution contract not found' });
    }
    
    const contract = contracts[0];
    
    // Verify contract belongs to this run
    if (contract.runId !== runId) {
      return res.status(400).json({ error: 'Execution contract does not belong to this run' });
    }
    
    // Verify payload hash matches contract (cryptographic binding)
    if (contract.payloadHash !== payload_hash) {
      return res.status(400).json({ error: 'Payload hash does not match execution contract' });
    }
    
    // Validate receipt payload is valid JSON object
    if (typeof receipt_payload !== 'object' || Array.isArray(receipt_payload) || receipt_payload === null) {
      return res.status(400).json({ error: 'Receipt payload must be a JSON object' });
    }
    
    // Validate no forbidden keys (PII protection)
    const violations = validateReceiptPayload(receipt_payload);
    if (violations.length > 0) {
      return res.status(400).json({ 
        error: 'Receipt payload contains forbidden keys',
        violations 
      });
    }
    
    const reportedAt = new Date();
    
    // Insert receipt (append-only)
    const [receipt] = await db
      .insert(ccN3ExecutionReceipts)
      .values({
        runId,
        executionContractId: execution_contract_id,
        payloadHash: payload_hash,
        receiptPayload: receipt_payload,
        reportedBy: reported_by,
        reportedAt,
      })
      .returning({ id: ccN3ExecutionReceipts.id });
    
    console.log('[N3 AUDIT] n3_execution_receipt_recorded', {
      run_id: runId,
      execution_contract_id,
      reported_by,
      reported_at: reportedAt.toISOString()
    });
    
    res.status(201).json({
      ok: true,
      receipt_id: receipt.id,
      reported_at: reportedAt.toISOString()
    });
  } catch (err) {
    console.error('[N3 API] Error creating execution receipt:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/execution-receipts
 * 
 * Retrieve execution receipts for admin review.
 * Evidence only - non-authoritative, for review purposes.
 */
n3Router.get('/runs/:runId/execution-receipts', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Get all receipts for this run (ordered by reported_at desc)
    const receipts = await db
      .select()
      .from(ccN3ExecutionReceipts)
      .where(eq(ccN3ExecutionReceipts.runId, runId))
      .orderBy(desc(ccN3ExecutionReceipts.reportedAt));
    
    res.json({
      run_id: runId,
      receipts: receipts.map(r => ({
        id: r.id,
        execution_contract_id: r.executionContractId,
        payload_hash: r.payloadHash,
        receipt_version: r.receiptVersion,
        receipt_payload: r.receiptPayload,
        reported_by: r.reportedBy,
        reported_at: r.reportedAt?.toISOString()
      }))
    });
  } catch (err) {
    console.error('[N3 API] Error fetching execution receipts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ EXECUTION VERIFICATIONS (ADVISORY CONFIDENCE SCORING) ============

// Verification signals interface (counts-only)
interface VerificationSignals {
  receipt_count: number;
  hash_consistency_ratio: number;
  time_alignment_ratio: number;
  status_distribution: {
    done: number;
    attempted: number;
    pending: number;
  };
  duplicate_payload_rate: number;
  window_overrun: boolean;
  coverage_ratio: number;
}

// Compute confidence score from signals (heuristic)
function computeConfidenceScore(signals: VerificationSignals): number {
  let score = 50; // Start at 50
  
  // Positive modifiers
  if (signals.hash_consistency_ratio >= 0.95) score += 20;
  if (signals.time_alignment_ratio >= 0.9) score += 15;
  if (signals.status_distribution.done >= 
      signals.status_distribution.attempted + signals.status_distribution.pending) score += 10;
  if (signals.duplicate_payload_rate < 0.1) score += 5;
  
  // Negative modifiers
  if (signals.window_overrun) score -= 20;
  if (signals.duplicate_payload_rate >= 0.3) score -= 15;
  if (signals.status_distribution.attempted + signals.status_distribution.pending > 
      signals.status_distribution.done) score -= 10;
  if (signals.receipt_count === 0) score -= 10;
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

// Determine confidence band from score
function getConfidenceBand(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * POST /api/n3/runs/:runId/execution-verification
 * 
 * Evaluate/re-evaluate execution verification.
 * Computes signals and confidence score from receipts.
 * Advisory only - does not affect run status.
 */
n3Router.post('/runs/:runId/execution-verification', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const userId = tenantReq.user?.id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    const { notes } = req.body;
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ 
        id: ccN3Runs.id,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Get execution contract (required)
    const contracts = await db
      .select({
        id: ccN3ExecutionContracts.id,
        payloadHash: ccN3ExecutionContracts.payloadHash
      })
      .from(ccN3ExecutionContracts)
      .where(and(
        eq(ccN3ExecutionContracts.runId, runId),
        eq(ccN3ExecutionContracts.tenantId, tenantId)
      ))
      .limit(1);
    
    if (contracts.length === 0) {
      return res.status(400).json({ error: 'Execution contract required for verification' });
    }
    
    const contract = contracts[0];
    
    // Get all receipts for this run
    const receipts = await db
      .select({
        payloadHash: ccN3ExecutionReceipts.payloadHash,
        reportedAt: ccN3ExecutionReceipts.reportedAt,
        receiptPayload: ccN3ExecutionReceipts.receiptPayload
      })
      .from(ccN3ExecutionReceipts)
      .where(eq(ccN3ExecutionReceipts.runId, runId));
    
    if (receipts.length === 0) {
      return res.status(400).json({ error: 'At least one receipt required for verification' });
    }
    
    // Compute signals (counts-only)
    const receiptCount = receipts.length;
    
    // Hash consistency: % of receipts matching contract hash
    const matchingHashes = receipts.filter(r => r.payloadHash === contract.payloadHash).length;
    const hashConsistencyRatio = receiptCount > 0 ? matchingHashes / receiptCount : 0;
    
    // Time alignment: % of receipts within contract window
    const runStart = run.startsAt ? new Date(run.startsAt).getTime() : 0;
    const runEnd = run.endsAt ? new Date(run.endsAt).getTime() : Date.now();
    const alignedReceipts = receipts.filter(r => {
      if (!r.reportedAt) return false;
      const reportedTime = new Date(r.reportedAt).getTime();
      return reportedTime >= runStart && reportedTime <= runEnd;
    }).length;
    const timeAlignmentRatio = receiptCount > 0 ? alignedReceipts / receiptCount : 0;
    
    // Status distribution from receipt payloads
    let doneCount = 0;
    let attemptedCount = 0;
    let pendingCount = 0;
    
    for (const r of receipts) {
      const payload = r.receiptPayload as any;
      if (payload?.summary) {
        doneCount += payload.summary.tasks_completed || 0;
        attemptedCount += payload.summary.tasks_attempted || 0;
        pendingCount += payload.summary.tasks_deferred || 0;
      }
    }
    
    // Duplicate payload rate: % of identical payloads
    const payloadHashes = receipts.map(r => JSON.stringify(r.receiptPayload));
    const uniquePayloads = new Set(payloadHashes).size;
    const duplicatePayloadRate = receiptCount > 1 ? 1 - (uniquePayloads / receiptCount) : 0;
    
    // Window overrun: any receipts after run end
    const now = Date.now();
    const windowOverrun = receipts.some(r => {
      if (!r.reportedAt) return false;
      return new Date(r.reportedAt).getTime() > runEnd;
    });
    
    // Coverage ratio: receipts vs expected (use attempted as proxy)
    const expectedAttempts = attemptedCount || 1;
    const coverageRatio = Math.min(1, receiptCount / expectedAttempts);
    
    const signals: VerificationSignals = {
      receipt_count: receiptCount,
      hash_consistency_ratio: Math.round(hashConsistencyRatio * 100) / 100,
      time_alignment_ratio: Math.round(timeAlignmentRatio * 100) / 100,
      status_distribution: {
        done: doneCount,
        attempted: attemptedCount,
        pending: pendingCount
      },
      duplicate_payload_rate: Math.round(duplicatePayloadRate * 100) / 100,
      window_overrun: windowOverrun,
      coverage_ratio: Math.round(coverageRatio * 100) / 100
    };
    
    const confidenceScore = computeConfidenceScore(signals);
    const confidenceBand = getConfidenceBand(confidenceScore);
    const evaluatedAt = new Date();
    
    // Upsert verification record (one per run)
    const existingVerification = await db
      .select({ id: ccN3ExecutionVerifications.id })
      .from(ccN3ExecutionVerifications)
      .where(eq(ccN3ExecutionVerifications.runId, runId))
      .limit(1);
    
    let verificationId: string;
    
    if (existingVerification.length > 0) {
      // Update existing
      await db
        .update(ccN3ExecutionVerifications)
        .set({
          executionContractId: contract.id,
          confidenceScore,
          confidenceBand,
          signals,
          notes: notes || null,
          evaluatedAt,
          evaluatedBy: userId || null
        })
        .where(eq(ccN3ExecutionVerifications.runId, runId));
      verificationId = existingVerification[0].id;
    } else {
      // Insert new
      const [inserted] = await db
        .insert(ccN3ExecutionVerifications)
        .values({
          runId,
          executionContractId: contract.id,
          confidenceScore,
          confidenceBand,
          signals,
          notes: notes || null,
          evaluatedAt,
          evaluatedBy: userId || null
        })
        .returning({ id: ccN3ExecutionVerifications.id });
      verificationId = inserted.id;
    }
    
    console.log('[N3 AUDIT] n3_execution_verified', {
      run_id: runId,
      confidence_score: confidenceScore,
      confidence_band: confidenceBand,
      receipt_count: receiptCount,
      evaluated_by: userId,
      evaluated_at: evaluatedAt.toISOString()
    });
    
    res.status(200).json({
      ok: true,
      verification_id: verificationId,
      confidence_score: confidenceScore,
      confidence_band: confidenceBand,
      signals,
      evaluated_at: evaluatedAt.toISOString()
    });
  } catch (err) {
    console.error('[N3 API] Error evaluating execution verification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/execution-verification
 * 
 * Retrieve execution verification for a run.
 * Advisory only - does not affect run status.
 */
n3Router.get('/runs/:runId/execution-verification', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Get verification
    const verifications = await db
      .select()
      .from(ccN3ExecutionVerifications)
      .where(eq(ccN3ExecutionVerifications.runId, runId))
      .limit(1);
    
    if (verifications.length === 0) {
      return res.status(404).json({ error: 'No verification exists for this run' });
    }
    
    const v = verifications[0];
    
    res.json({
      run_id: runId,
      confidence_score: v.confidenceScore,
      confidence_band: v.confidenceBand,
      signals: v.signals,
      evaluated_at: v.evaluatedAt?.toISOString(),
      notes: v.notes
    });
  } catch (err) {
    console.error('[N3 API] Error fetching execution verification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ N3 EXECUTION ATTESTATIONS (PROMPT 36) ============
// Human-in-the-loop advisory assessment layer
// Immutable after creation - no UPDATE/DELETE routes
// Advisory only - does not approve execution, billing, or outcomes

const attestationAssessmentSchema = z.object({
  assessment: z.enum(['acceptable', 'questionable', 'requires_follow_up']),
  rationale: z.string().max(500).optional()
});

/**
 * POST /api/n3/runs/:runId/attestation
 * 
 * Create a human attestation for a run (one per run, immutable).
 * Prerequisites: Contract and Verification must exist.
 * Advisory only - does not affect run status, billing, or notifications.
 */
n3Router.post('/runs/:runId/attestation', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  const userId = tenantReq.user?.id;
  
  try {
    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Missing tenant or user context' });
    }
    
    // Validate body
    const parsed = attestationAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }
    const { assessment, rationale } = parsed.data;
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ 
        id: ccN3Runs.id,
        portalId: ccN3Runs.portalId,
        zoneId: ccN3Runs.zoneId
      })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const run = runRows[0];
    
    // Prerequisite: Execution Contract must exist
    const contractRows = await db
      .select({ id: ccN3ExecutionContracts.id })
      .from(ccN3ExecutionContracts)
      .where(eq(ccN3ExecutionContracts.runId, runId))
      .limit(1);
    
    if (contractRows.length === 0) {
      return res.status(400).json({ error: 'Execution contract must exist before attestation' });
    }
    
    // Prerequisite: Execution Verification must exist
    const verificationRows = await db
      .select({ id: ccN3ExecutionVerifications.id })
      .from(ccN3ExecutionVerifications)
      .where(eq(ccN3ExecutionVerifications.runId, runId))
      .limit(1);
    
    if (verificationRows.length === 0) {
      return res.status(400).json({ error: 'Execution verification must exist before attestation' });
    }
    
    // Check if attestation already exists (immutable)
    const existingAttestation = await db
      .select({ id: ccN3ExecutionAttestations.id })
      .from(ccN3ExecutionAttestations)
      .where(eq(ccN3ExecutionAttestations.runId, runId))
      .limit(1);
    
    if (existingAttestation.length > 0) {
      return res.status(409).json({ error: 'Attestation already exists for this run and is immutable' });
    }
    
    const now = new Date();
    
    // Create attestation
    const [attestation] = await db
      .insert(ccN3ExecutionAttestations)
      .values({
        runId,
        tenantId,
        portalId: run.portalId,
        zoneId: run.zoneId,
        assessment,
        rationale: rationale || null,
        basedOnVerificationId: verificationRows[0].id,
        basedOnContractId: contractRows[0].id,
        attestedBy: userId,
        attestedAt: now,
        createdAt: now
      })
      .returning();
    
    // Audit log
    console.log('[N3 AUDIT] n3_execution_attested', {
      event: 'n3_execution_attested',
      run_id: runId,
      assessment,
      actor_id: userId,
      tenant_id: tenantId,
      portal_id: run.portalId,
      zone_id: run.zoneId,
      occurred_at: now.toISOString(),
    });
    
    res.status(201).json({
      run_id: runId,
      assessment: attestation.assessment,
      rationale: attestation.rationale,
      attested_by: attestation.attestedBy,
      attested_at: attestation.attestedAt?.toISOString(),
      based_on_verification_id: attestation.basedOnVerificationId,
      based_on_contract_id: attestation.basedOnContractId
    });
  } catch (err: any) {
    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Attestation already exists for this run' });
    }
    console.error('[N3 API] Error creating attestation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/n3/runs/:runId/attestation
 * 
 * Retrieve execution attestation for a run.
 * Advisory only - governance artifact.
 */
n3Router.get('/runs/:runId/attestation', requireAuth, requireTenant, requireTenantAdminOrOwner, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { runId } = req.params;
  const tenantId = tenantReq.ctx.tenant_id;
  
  try {
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }
    
    // Verify run exists and belongs to tenant
    const runRows = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(
        eq(ccN3Runs.id, runId),
        eq(ccN3Runs.tenantId, tenantId)
      ))
      .limit(1);
    
    if (runRows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Get attestation
    const attestations = await db
      .select()
      .from(ccN3ExecutionAttestations)
      .where(eq(ccN3ExecutionAttestations.runId, runId))
      .limit(1);
    
    if (attestations.length === 0) {
      return res.status(404).json({ error: 'No attestation exists for this run' });
    }
    
    const a = attestations[0];
    
    res.json({
      run_id: runId,
      assessment: a.assessment,
      rationale: a.rationale,
      attested_by: a.attestedBy,
      attested_at: a.attestedAt?.toISOString(),
      based_on_verification_id: a.basedOnVerificationId,
      based_on_contract_id: a.basedOnContractId
    });
  } catch (err) {
    console.error('[N3 API] Error fetching attestation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

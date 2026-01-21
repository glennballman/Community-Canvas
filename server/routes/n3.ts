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
  ccPortals
} from '@shared/schema';
import { eq, and, desc, isNull, gte, count, max, sql } from 'drizzle-orm';
import { z } from 'zod';
import { computeZonePricingEstimate, ZonePricingModifiers } from '@shared/zonePricing';
import { requireAuth, requireTenant } from '../middleware/guards';
import type { TenantRequest } from '../middleware/tenantContext';
import { resolveDefaultZoneIdForPortal, isZoneValidForPortal } from '../lib/n3-zone-defaults';

/**
 * Owner/Admin gate for zone-sensitive N3 routes
 * Only tenant owners, admins, or platform admins can access pricing modifiers and assign zones
 */
function requireTenantAdminOrOwner(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const roles = tenantReq.ctx?.roles || [];
  
  const isAdminOrOwner = 
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin') ||
    !!tenantReq.user?.isPlatformAdmin;
  
  if (!isAdminOrOwner) {
    return res.status(403).json({ 
      error: 'Owner or admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
}

/**
 * Check if requester has admin/owner privileges (for conditional data exposure)
 */
function isAdminOrOwner(req: TenantRequest): boolean {
  const roles = req.ctx?.roles || [];
  return (
    roles.includes('owner') || 
    roles.includes('admin') || 
    roles.includes('tenant_admin') ||
    !!req.user?.isPlatformAdmin
  );
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

    const canSeePricing = isAdminOrOwner(tenantReq);

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
 * GET /api/n3/health - Unauthenticated healthcheck (returns only { ok: true })
 */
n3Router.get('/health', async (_req, res) => {
  res.json({ ok: true });
});

/**
 * GET /api/n3/status - Get monitor status (protected: platform admin only)
 */
n3Router.get('/status', requireAuth, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const isPlatformAdmin = tenantReq.user?.isPlatformAdmin === true;
  
  if (!isPlatformAdmin) {
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
    const tenantReq = req as TenantRequest;
    const isPlatformAdmin = tenantReq.user?.isPlatformAdmin === true;
    
    if (!isPlatformAdmin) {
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

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
  ccZones
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { computeZonePricingEstimate, ZonePricingModifiers } from '@shared/zonePricing';
import { requireAuth, requireTenant } from '../middleware/guards';
import type { TenantRequest } from '../middleware/tenantContext';

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

// List all runs for a tenant
n3Router.get('/runs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant ID' });
    }

    const runs = await db
      .select()
      .from(ccN3Runs)
      .where(eq(ccN3Runs.tenantId, tenantId))
      .orderBy(desc(ccN3Runs.startsAt))
      .limit(50);

    res.json(runs);
  } catch (err) {
    console.error('[N3 API] Error fetching runs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

n3Router.get('/attention', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant ID' });
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
      })
      .from(ccReplanBundles)
      .innerJoin(ccN3Runs, eq(ccReplanBundles.runId, ccN3Runs.id))
      .where(eq(ccReplanBundles.tenantId, tenantId))
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

const dismissSchema = z.object({
  reason: z.string().optional(),
});

n3Router.post('/bundles/:bundleId/dismiss', async (req, res) => {
  try {
    const { bundleId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const body = dismissSchema.parse(req.body);

    const bundle = await db.query.ccReplanBundles.findFirst({
      where: and(
        eq(ccReplanBundles.id, bundleId),
        tenantId ? eq(ccReplanBundles.tenantId, tenantId) : undefined
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

n3Router.post('/bundles/:bundleId/action', async (req, res) => {
  try {
    const { bundleId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const body = actionSchema.parse(req.body);

    const bundle = await db.query.ccReplanBundles.findFirst({
      where: and(
        eq(ccReplanBundles.id, bundleId),
        tenantId ? eq(ccReplanBundles.tenantId, tenantId) : undefined
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

n3Router.post('/runs/:runId/evaluate', async (req, res) => {
  try {
    const { runId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const portalId = req.headers['x-portal-id'] as string;

    const run = await db.query.ccN3Runs.findFirst({
      where: and(
        eq(ccN3Runs.id, runId),
        tenantId ? eq(ccN3Runs.tenantId, tenantId) : undefined
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

n3Router.get('/status', async (_req, res) => {
  const status = getMonitorStatus();
  res.json(status);
});

n3Router.post('/trigger-cycle', async (_req, res) => {
  try {
    const stats = await runMonitorCycle();
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[N3 API] Error triggering cycle:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

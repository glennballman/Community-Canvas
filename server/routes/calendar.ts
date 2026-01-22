/**
 * N3-CAL-01: Service Run Calendar Projections
 * 
 * Read-only calendar views over existing N3 Service Runs for:
 * - Contractors / Providers
 * - Residents / Requestors
 * - Community Portals
 * 
 * All views reference the same N3 run IDs - NO new scheduling tables.
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccN3Runs, 
  ccPortals,
  ccProperties,
  ccContractorFleet,
  ccContractorTools,
  ccStaffAvailabilityBlocks,
  ccContractorPhotoBundles,
  type CalendarRunDTO
} from '@shared/schema';
import { eq, and, gte, lte, or, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireTenant } from '../middleware/guards';
import type { TenantRequest } from '../middleware/tenantContext';
import {
  getDependencyWindowsForTenant,
  getDependencyWindowsForPortal,
  createDependencyResources,
  mapDependencyWindowsToEvents,
  computeZoneFeasibility,
} from '../services/dependencyWindowsService';

export const calendarRouter = Router();

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function normalizeStatus(status: string): 'draft' | 'scheduled' | 'in_progress' | 'completed' {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'in_progress':
    case 'active':
      return 'in_progress';
    case 'completed':
    case 'done':
      return 'completed';
    default:
      return 'scheduled';
  }
}

function getDefaultDateRange() {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);
  return { startDate, endDate };
}

/**
 * GET /api/contractor/calendar
 * Returns projection of runs for the authenticated contractor.
 */
calendarRouter.get('/contractor/calendar', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const { startDate: startParam, endDate: endParam } = dateRangeSchema.parse(req.query);
    
    const defaults = getDefaultDateRange();
    const startDate = startParam ? new Date(startParam) : defaults.startDate;
    const endDate = endParam ? new Date(endParam) : defaults.endDate;

    const runs = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        description: ccN3Runs.description,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
        metadata: ccN3Runs.metadata,
      })
      .from(ccN3Runs)
      .where(
        and(
          eq(ccN3Runs.tenantId, tenantId),
          or(
            and(gte(ccN3Runs.startsAt, startDate), lte(ccN3Runs.startsAt, endDate)),
            and(gte(ccN3Runs.endsAt, startDate), lte(ccN3Runs.endsAt, endDate)),
            and(lte(ccN3Runs.startsAt, startDate), gte(ccN3Runs.endsAt, endDate))
          )
        )
      )
      .orderBy(desc(ccN3Runs.startsAt));

    const calendarRuns: CalendarRunDTO[] = runs.map(run => ({
      runId: run.id,
      title: run.name || 'Untitled Run',
      status: normalizeStatus(run.status),
      startAt: run.startsAt?.toISOString() || null,
      endAt: run.endsAt?.toISOString() || null,
      evidenceStatus: 'none' as const,
    }));

    res.json({
      runs: calendarRuns,
      meta: {
        count: calendarRuns.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }
    });
  } catch (err) {
    console.error('[Calendar API] Contractor calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/resident/calendar
 * Returns runs linked to resident's places (simplified view).
 */
calendarRouter.get('/resident/calendar', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { startDate: startParam, endDate: endParam } = dateRangeSchema.parse(req.query);
    
    const defaults = getDefaultDateRange();
    const startDate = startParam ? new Date(startParam) : defaults.startDate;
    const endDate = endParam ? new Date(endParam) : defaults.endDate;

    const residentProperties = await db
      .select({ id: ccProperties.id, tenantId: ccProperties.tenantId })
      .from(ccProperties)
      .where(eq(ccProperties.ownerId, userId));

    if (residentProperties.length === 0) {
      return res.json({
        runs: [],
        meta: {
          count: 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });
    }

    const tenantIds = residentProperties.map(p => p.tenantId).filter(Boolean) as string[];
    
    if (tenantIds.length === 0) {
      return res.json({
        runs: [],
        meta: {
          count: 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });
    }

    const runs = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
      })
      .from(ccN3Runs)
      .where(
        and(
          inArray(ccN3Runs.tenantId, tenantIds),
          or(
            and(gte(ccN3Runs.startsAt, startDate), lte(ccN3Runs.startsAt, endDate)),
            and(gte(ccN3Runs.endsAt, startDate), lte(ccN3Runs.endsAt, endDate)),
            and(lte(ccN3Runs.startsAt, startDate), gte(ccN3Runs.endsAt, endDate))
          )
        )
      )
      .orderBy(desc(ccN3Runs.startsAt));

    const calendarRuns: CalendarRunDTO[] = runs.map(run => ({
      runId: run.id,
      title: getFriendlyTitle(run.status, run.name),
      status: normalizeStatus(run.status),
      startAt: run.startsAt?.toISOString() || null,
      endAt: run.endsAt?.toISOString() || null,
    }));

    res.json({
      runs: calendarRuns,
      meta: {
        count: calendarRuns.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }
    });
  } catch (err) {
    console.error('[Calendar API] Resident calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function getFriendlyTitle(status: string, name: string | null): string {
  const normalizedStatus = normalizeStatus(status);
  switch (normalizedStatus) {
    case 'draft':
      return 'Pending Request';
    case 'scheduled':
      return 'Upcoming Work';
    case 'in_progress':
      return 'Work In Progress';
    case 'completed':
      return 'Completed Work';
    default:
      return name || 'Service Activity';
  }
}

/**
 * GET /api/portal/:portalId/calendar
 * Returns aggregated runs for a portal (read-only, no contractor identity).
 */
calendarRouter.get('/portal/:portalId/calendar', async (req, res) => {
  try {
    const { portalId } = req.params;
    
    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID required' });
    }

    const { startDate: startParam, endDate: endParam } = dateRangeSchema.parse(req.query);
    
    const defaults = getDefaultDateRange();
    const startDate = startParam ? new Date(startParam) : defaults.startDate;
    const endDate = endParam ? new Date(endParam) : defaults.endDate;

    const portal = await db
      .select({ id: ccPortals.id, name: ccPortals.name, owningTenantId: ccPortals.owningTenantId })
      .from(ccPortals)
      .where(eq(ccPortals.id, portalId))
      .limit(1);

    if (portal.length === 0) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    const portalTenantId = portal[0].owningTenantId;
    if (!portalTenantId) {
      return res.json({
        runs: [],
        portal: { id: portal[0].id, name: portal[0].name },
        meta: { count: 0, startDate: startDate.toISOString(), endDate: endDate.toISOString() }
      });
    }

    const runs = await db
      .select({
        id: ccN3Runs.id,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
      })
      .from(ccN3Runs)
      .where(
        and(
          eq(ccN3Runs.tenantId, portalTenantId),
          or(
            and(gte(ccN3Runs.startsAt, startDate), lte(ccN3Runs.startsAt, endDate)),
            and(gte(ccN3Runs.endsAt, startDate), lte(ccN3Runs.endsAt, endDate)),
            and(lte(ccN3Runs.startsAt, startDate), gte(ccN3Runs.endsAt, endDate))
          )
        )
      )
      .orderBy(desc(ccN3Runs.startsAt));

    const calendarRuns: CalendarRunDTO[] = runs.map(run => ({
      runId: run.id,
      title: 'Service activity in your area',
      status: normalizeStatus(run.status),
      startAt: run.startsAt?.toISOString() || null,
      endAt: run.endsAt?.toISOString() || null,
      portalLabel: portal[0].name || undefined,
    }));

    res.json({
      runs: calendarRuns,
      portal: {
        id: portal[0].id,
        name: portal[0].name,
      },
      meta: {
        count: calendarRuns.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }
    });
  } catch (err) {
    console.error('[Calendar API] Portal calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * OPS-CALENDAR ENDPOINTS
 * Returns Resource[] + ScheduleEvent[] format for ScheduleBoard consumption.
 * These endpoints support the Operations Timeline Grid (15m granular view).
 */

interface OpsResource {
  id: string;
  name: string;
  asset_type: string;
  status: string;
  group?: string;
}

interface OpsEvent {
  id: string;
  resource_id: string;
  event_type: 'reserved' | 'hold' | 'maintenance' | 'buffer' | 'reservation';
  start_date: string;
  end_date: string;
  status: string;
  title: string;
  notes?: string;
  meta?: {
    feasibility?: { status: 'ok' | 'risky' | 'blocked'; reasons: string[]; severity?: string };
    severity?: string;
    reasonCodes?: string[];
    affectedZones?: string[];
    confidence?: number;
  };
}

function mapRunsToOpsFormat(runs: Array<{
  id: string;
  name: string | null;
  description: string | null;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  metadata: unknown;
}>): { resources: OpsResource[]; events: OpsEvent[] } {
  const resources: OpsResource[] = [];
  const events: OpsEvent[] = [];
  
  runs.forEach((run, index) => {
    const resourceId = `run-${run.id}`;
    
    resources.push({
      id: resourceId,
      name: run.name || `Run ${index + 1}`,
      asset_type: 'service_run',
      status: run.status,
      group: 'Service Runs',
    });
    
    if (run.startsAt) {
      const endAt = run.endsAt || new Date(run.startsAt.getTime() + 3600000);
      
      events.push({
        id: `event-${run.id}`,
        resource_id: resourceId,
        event_type: run.status === 'completed' ? 'reservation' :
                   run.status === 'in_progress' ? 'hold' :
                   run.status === 'draft' ? 'buffer' : 'reserved',
        start_date: run.startsAt.toISOString(),
        end_date: endAt.toISOString(),
        status: run.status,
        title: run.name || 'Untitled Run',
        notes: run.description || undefined,
      });
    }
  });
  
  return { resources, events };
}

/**
 * GET /api/contractor/ops-calendar
 * Returns ops board format (Resource[] + ScheduleEvent[]) for contractors.
 * N3-CAL-02: Includes service runs + staff + dependencies + fleet/tools/materials lanes
 */
calendarRouter.get('/contractor/ops-calendar', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant context' });
    }

    const { startDate: startParam, endDate: endParam } = dateRangeSchema.parse(req.query);
    
    const defaults = getDefaultDateRange();
    const startDate = startParam ? new Date(startParam) : defaults.startDate;
    const endDate = endParam ? new Date(endParam) : defaults.endDate;

    // 1) Service Runs
    const runs = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        description: ccN3Runs.description,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
        metadata: ccN3Runs.metadata,
      })
      .from(ccN3Runs)
      .where(
        and(
          eq(ccN3Runs.tenantId, tenantId),
          or(
            and(gte(ccN3Runs.startsAt, startDate), lte(ccN3Runs.startsAt, endDate)),
            and(gte(ccN3Runs.endsAt, startDate), lte(ccN3Runs.endsAt, endDate)),
            and(lte(ccN3Runs.startsAt, startDate), gte(ccN3Runs.endsAt, endDate))
          )
        )
      )
      .orderBy(desc(ccN3Runs.startsAt));

    const { resources: runResources, events: runEvents } = mapRunsToOpsFormat(runs);

    // 2) Staff Availability Blocks
    const staffBlocks = await db
      .select()
      .from(ccStaffAvailabilityBlocks)
      .where(
        and(
          eq(ccStaffAvailabilityBlocks.tenantId, tenantId),
          or(
            and(gte(ccStaffAvailabilityBlocks.startAt, startDate), lte(ccStaffAvailabilityBlocks.startAt, endDate)),
            and(gte(ccStaffAvailabilityBlocks.endAt, startDate), lte(ccStaffAvailabilityBlocks.endAt, endDate)),
            and(lte(ccStaffAvailabilityBlocks.startAt, startDate), gte(ccStaffAvailabilityBlocks.endAt, endDate))
          )
        )
      );

    const staffResourceMap = new Map<string, OpsResource>();
    const staffEvents: OpsEvent[] = [];

    staffBlocks.forEach((block, index) => {
      const resourceId = `staff:${block.personId}`;
      if (!staffResourceMap.has(resourceId)) {
        staffResourceMap.set(resourceId, {
          id: resourceId,
          name: `Staff ${index + 1}`, // TODO: Join with user table for real names
          asset_type: 'staff',
          status: 'active',
          group: 'Staff',
        });
      }
      staffEvents.push({
        id: `staff-block-${block.id}`,
        resource_id: resourceId,
        event_type: 'maintenance',
        start_date: block.startAt.toISOString(),
        end_date: block.endAt.toISOString(),
        status: 'unavailable',
        title: 'Unavailable',
        notes: block.reason || undefined,
        meta: { severity: 'warn', reasonCodes: [block.kind] },
      });
    });

    const staffResources = Array.from(staffResourceMap.values());
    if (staffResources.length === 0) {
      staffResources.push({
        id: 'staff:placeholder',
        name: 'Staff (none configured)',
        asset_type: 'staff',
        status: 'placeholder',
        group: 'Staff',
      });
    }

    // 3) Dependencies (Weather + Travel)
    const dependencyWindows = await getDependencyWindowsForTenant(tenantId, startDate, endDate);
    const dependencyResources = createDependencyResources();
    const dependencyEvents = mapDependencyWindowsToEvents(dependencyWindows);

    // 4) Fleet
    const fleetItems = await db
      .select()
      .from(ccContractorFleet)
      .where(eq(ccContractorFleet.tenantId, tenantId))
      .limit(10);

    const fleetResources: OpsResource[] = fleetItems.length > 0 
      ? fleetItems.map(item => ({
          id: `fleet:${item.id}`,
          name: item.make && item.model ? `${item.make} ${item.model}` : item.assetType,
          asset_type: 'fleet',
          status: item.isActive ? 'active' : 'inactive',
          group: 'Fleet',
        }))
      : [{
          id: 'fleet:placeholder',
          name: 'Fleet (none yet)',
          asset_type: 'fleet',
          status: 'placeholder',
          group: 'Fleet',
        }];

    // 5) Tools
    const toolItems = await db
      .select()
      .from(ccContractorTools)
      .where(eq(ccContractorTools.tenantId, tenantId))
      .limit(10);

    const toolResources: OpsResource[] = toolItems.length > 0
      ? toolItems.map(item => ({
          id: `tool:${item.id}`,
          name: item.name,
          asset_type: 'tool',
          status: item.isActive ? 'active' : 'inactive',
          group: 'Tools',
        }))
      : [{
          id: 'tool:placeholder',
          name: 'Tools (none yet)',
          asset_type: 'tool',
          status: 'placeholder',
          group: 'Tools',
        }];

    // 6) Materials (placeholder)
    const materialsResources: OpsResource[] = [{
      id: 'materials:placeholder',
      name: 'Materials',
      asset_type: 'materials',
      status: 'active',
      group: 'Materials',
    }];

    // 7) Accommodations (placeholder)
    const accommodationsResources: OpsResource[] = [{
      id: 'accom:placeholder',
      name: 'Accommodations (none configured)',
      asset_type: 'accommodation',
      status: 'placeholder',
      group: 'Accommodations',
    }];

    // 8) Payments (placeholder)
    const paymentsResources: OpsResource[] = [{
      id: 'payments:placeholder',
      name: 'Payments',
      asset_type: 'payments',
      status: 'active',
      group: 'Payments',
    }];

    // 9) A2.7 Evidence Badges: Query photo bundles for evidence status
    const photoBundles = await db
      .select({
        id: ccContractorPhotoBundles.id,
        status: ccContractorPhotoBundles.status,
        coversFrom: ccContractorPhotoBundles.coversFrom,
        coversTo: ccContractorPhotoBundles.coversTo,
        beforeMediaIds: ccContractorPhotoBundles.beforeMediaIds,
        afterMediaIds: ccContractorPhotoBundles.afterMediaIds,
        duringMediaIds: ccContractorPhotoBundles.duringMediaIds,
      })
      .from(ccContractorPhotoBundles)
      .where(
        and(
          eq(ccContractorPhotoBundles.tenantId, tenantId),
          or(
            and(gte(ccContractorPhotoBundles.coversFrom, startDate), lte(ccContractorPhotoBundles.coversFrom, endDate)),
            and(gte(ccContractorPhotoBundles.coversTo, startDate), lte(ccContractorPhotoBundles.coversTo, endDate)),
            and(lte(ccContractorPhotoBundles.coversFrom, startDate), gte(ccContractorPhotoBundles.coversTo, endDate))
          )
        )
      );

    // Build evidence lookup by time overlap (arrow function to avoid strict mode issue)
    const getEvidenceForRun = (runStart: Date, runEnd: Date): { status: 'none' | 'partial' | 'complete' | 'confirmed'; bundleId?: string } => {
      for (const bundle of photoBundles) {
        const bundleStart = bundle.coversFrom ? new Date(bundle.coversFrom) : null;
        const bundleEnd = bundle.coversTo ? new Date(bundle.coversTo) : null;
        
        // Check time overlap
        const overlaps = bundleStart && bundleEnd && bundleStart < runEnd && bundleEnd > runStart;
        if (!overlaps && bundleStart) continue;
        
        // Determine evidence status from bundle
        if (bundle.status === 'confirmed') {
          return { status: 'confirmed', bundleId: bundle.id };
        } else if (bundle.status === 'complete') {
          return { status: 'complete', bundleId: bundle.id };
        } else {
          const beforeIds = bundle.beforeMediaIds as string[] || [];
          const afterIds = bundle.afterMediaIds as string[] || [];
          const duringIds = bundle.duringMediaIds as string[] || [];
          const hasMedia = beforeIds.length > 0 || afterIds.length > 0 || duringIds.length > 0;
          if (hasMedia) {
            return { status: 'partial', bundleId: bundle.id };
          }
        }
      }
      return { status: 'none' };
    };

    // Apply feasibility overlay and evidence badges to run events
    const enhancedRunEvents = runEvents.map(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      
      // Get evidence status for this run
      const evidence = getEvidenceForRun(eventStart, eventEnd);
      
      // Check dependency overlaps
      const overlappingDeps = dependencyWindows.filter(w => 
        w.startAt < eventEnd && w.endAt > eventStart
      );

      // Build enhanced meta with evidence
      const baseMeta = {
        ...event.meta,
        evidence,
      };

      if (overlappingDeps.some(d => d.severity === 'critical')) {
        return {
          ...event,
          meta: {
            ...baseMeta,
            feasibility: {
              status: 'blocked' as const,
              reasons: overlappingDeps.flatMap(d => d.reasonCodes),
              severity: 'critical',
            },
          },
        };
      } else if (overlappingDeps.some(d => d.severity === 'warn')) {
        return {
          ...event,
          meta: {
            ...baseMeta,
            feasibility: {
              status: 'risky' as const,
              reasons: overlappingDeps.flatMap(d => d.reasonCodes),
              severity: 'warn',
            },
          },
        };
      }
      return { ...event, meta: baseMeta };
    });

    // Combine all resources and events in group order
    const allResources = [
      ...runResources,
      ...staffResources,
      ...fleetResources,
      ...toolResources,
      ...materialsResources,
      ...accommodationsResources,
      ...dependencyResources,
      ...paymentsResources,
    ];

    const allEvents = [
      ...enhancedRunEvents,
      ...staffEvents,
      ...dependencyEvents,
    ];

    res.json({
      resources: allResources,
      events: allEvents,
      meta: {
        count: runs.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        laneGroups: ['Service Runs', 'Staff', 'Fleet', 'Tools', 'Materials', 'Accommodations', 'Dependencies', 'Payments'],
      }
    });
  } catch (err) {
    console.error('[Calendar API] Contractor ops-calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/resident/ops-calendar
 * Returns ops board format for residents (filtered to their properties).
 */
calendarRouter.get('/resident/ops-calendar', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { startDate: startParam, endDate: endParam } = dateRangeSchema.parse(req.query);
    
    const defaults = getDefaultDateRange();
    const startDate = startParam ? new Date(startParam) : defaults.startDate;
    const endDate = endParam ? new Date(endParam) : defaults.endDate;

    const residentProperties = await db
      .select({ id: ccProperties.id, tenantId: ccProperties.tenantId })
      .from(ccProperties)
      .where(eq(ccProperties.ownerId, userId));

    if (residentProperties.length === 0) {
      return res.json({
        resources: [],
        events: [],
        meta: {
          count: 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });
    }

    const tenantIds = Array.from(new Set(residentProperties.map(p => p.tenantId).filter((t): t is string => t !== null)));

    if (tenantIds.length === 0) {
      return res.json({
        resources: [],
        events: [],
        meta: {
          count: 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });
    }

    // 1) Service Runs for resident's properties
    const runs = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        description: ccN3Runs.description,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
        metadata: ccN3Runs.metadata,
      })
      .from(ccN3Runs)
      .where(
        and(
          inArray(ccN3Runs.tenantId, tenantIds),
          or(
            and(gte(ccN3Runs.startsAt, startDate), lte(ccN3Runs.startsAt, endDate)),
            and(gte(ccN3Runs.endsAt, startDate), lte(ccN3Runs.endsAt, endDate)),
            and(lte(ccN3Runs.startsAt, startDate), gte(ccN3Runs.endsAt, endDate))
          )
        )
      )
      .orderBy(desc(ccN3Runs.startsAt));

    const { resources: runResources, events: runEvents } = mapRunsToOpsFormat(runs);
    
    // Redact contractor names
    runResources.forEach(r => {
      r.name = r.name.replace(/internal|contractor/gi, 'Service');
    });

    // 2) Redacted staff lane (no names)
    const staffResources: OpsResource[] = [{
      id: 'staff:assigned',
      name: 'Assigned Staff',
      asset_type: 'staff',
      status: 'active',
      group: 'Staff',
    }];

    // 3) Dependencies
    const dependencyWindows = await getDependencyWindowsForTenant(tenantIds[0] || '', startDate, endDate);
    const dependencyResources = createDependencyResources();
    const dependencyEvents = mapDependencyWindowsToEvents(dependencyWindows);

    // 4) Payments lane (placeholder)
    const paymentsResources: OpsResource[] = [{
      id: 'payments:resident',
      name: 'Payments',
      asset_type: 'payments',
      status: 'active',
      group: 'Payments',
    }];

    // Apply feasibility overlay to run events
    const enhancedRunEvents = runEvents.map(event => {
      const overlappingDeps = dependencyWindows.filter(w => {
        const eventStart = new Date(event.start_date);
        const eventEnd = new Date(event.end_date);
        return w.startAt < eventEnd && w.endAt > eventStart;
      });

      if (overlappingDeps.some(d => d.severity === 'critical')) {
        return {
          ...event,
          meta: {
            ...event.meta,
            feasibility: {
              status: 'blocked' as const,
              reasons: overlappingDeps.flatMap(d => d.reasonCodes),
              severity: 'critical',
            },
          },
        };
      } else if (overlappingDeps.some(d => d.severity === 'warn')) {
        return {
          ...event,
          meta: {
            ...event.meta,
            feasibility: {
              status: 'risky' as const,
              reasons: overlappingDeps.flatMap(d => d.reasonCodes),
              severity: 'warn',
            },
          },
        };
      }
      return event;
    });

    const allResources = [
      ...runResources,
      ...staffResources,
      ...dependencyResources,
      ...paymentsResources,
    ];

    const allEvents = [
      ...enhancedRunEvents,
      ...dependencyEvents,
    ];

    res.json({
      resources: allResources,
      events: allEvents,
      meta: {
        count: runs.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        laneGroups: ['Service Runs', 'Staff', 'Dependencies', 'Payments'],
      }
    });
  } catch (err) {
    console.error('[Calendar API] Resident ops-calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/portal/:portalId/ops-calendar
 * Returns ops board format for public portal view.
 * N3-CAL-02: Includes dependencies + zone feasibility roll-up (privacy-filtered)
 */
calendarRouter.get('/portal/:portalId/ops-calendar', async (req, res) => {
  try {
    const { portalId } = req.params;
    
    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID required' });
    }

    const { startDate: startParam, endDate: endParam } = dateRangeSchema.parse(req.query);
    
    const defaults = getDefaultDateRange();
    const startDate = startParam ? new Date(startParam) : defaults.startDate;
    const endDate = endParam ? new Date(endParam) : defaults.endDate;

    const portal = await db
      .select({
        id: ccPortals.id,
        name: ccPortals.name,
        owningTenantId: ccPortals.owningTenantId,
      })
      .from(ccPortals)
      .where(eq(ccPortals.id, portalId))
      .limit(1);

    if (portal.length === 0 || !portal[0].owningTenantId) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    // 1) Service Runs (redacted)
    const runs = await db
      .select({
        id: ccN3Runs.id,
        name: ccN3Runs.name,
        description: ccN3Runs.description,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
        metadata: ccN3Runs.metadata,
      })
      .from(ccN3Runs)
      .where(
        and(
          eq(ccN3Runs.tenantId, portal[0].owningTenantId),
          or(
            and(gte(ccN3Runs.startsAt, startDate), lte(ccN3Runs.startsAt, endDate)),
            and(gte(ccN3Runs.endsAt, startDate), lte(ccN3Runs.endsAt, endDate)),
            and(lte(ccN3Runs.startsAt, startDate), gte(ccN3Runs.endsAt, endDate))
          )
        )
      )
      .orderBy(desc(ccN3Runs.startsAt));

    const { resources: runResources, events: runEvents } = mapRunsToOpsFormat(runs);
    
    // Redact all identities
    runResources.forEach(r => {
      r.name = 'Community Service';
      r.group = 'Scheduled Work';
    });

    // 2) Dependencies (Weather + Travel)
    const dependencyWindows = await getDependencyWindowsForPortal(portalId, startDate, endDate);
    const dependencyResources = createDependencyResources();
    const dependencyEvents = mapDependencyWindowsToEvents(dependencyWindows);

    // 3) Zone Feasibility Roll-up
    // Define zones for the portal area (Bamfield example)
    const portalZones = ['East Bamfield', 'West Bamfield', 'Helby Island', 'Deer Group'];
    const zoneFeasibility = computeZoneFeasibility(dependencyWindows, portalZones);

    const zoneResources: OpsResource[] = portalZones.map(zone => ({
      id: `zone:${zone.toLowerCase().replace(/\s+/g, '-')}`,
      name: `Zone: ${zone}`,
      asset_type: 'zone',
      status: zoneFeasibility.get(zone)?.status || 'ok',
      group: 'Zone Feasibility',
    }));

    // Create zone events for blocked/risky windows
    const zoneEvents: OpsEvent[] = [];
    dependencyWindows.forEach((window, index) => {
      const affectedZones = window.affectedZoneIds || [];
      affectedZones.forEach((zone: string) => {
        const feasibility = zoneFeasibility.get(zone);
        if (feasibility && feasibility.status !== 'ok') {
          zoneEvents.push({
            id: `zone-event-${zone}-${index}`,
            resource_id: `zone:${zone.toLowerCase().replace(/\s+/g, '-')}`,
            event_type: feasibility.status === 'blocked' ? 'maintenance' : 'hold',
            start_date: window.startAt.toISOString(),
            end_date: window.endAt.toISOString(),
            status: feasibility.status,
            title: feasibility.status === 'blocked' ? 'Blocked' : 'Risky',
            notes: feasibility.reasons.join(', '),
            meta: {
              severity: window.severity,
              reasonCodes: window.reasonCodes,
            },
          });
        }
      });
    });

    // 4) Staff availability lane (redacted, no names)
    const staffResources: OpsResource[] = [{
      id: 'staff:availability',
      name: 'Staff Availability',
      asset_type: 'staff',
      status: 'active',
      group: 'Staff',
    }];

    const allResources = [
      ...runResources,
      ...staffResources,
      ...dependencyResources,
      ...zoneResources,
    ];

    const allEvents = [
      ...runEvents,
      ...dependencyEvents,
      ...zoneEvents,
    ];

    res.json({
      resources: allResources,
      events: allEvents,
      portal: {
        id: portal[0].id,
        name: portal[0].name,
      },
      meta: {
        count: runs.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        laneGroups: ['Scheduled Work', 'Staff', 'Dependencies', 'Zone Feasibility'],
        zones: portalZones,
      }
    });
  } catch (err) {
    console.error('[Calendar API] Portal ops-calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// N3-CAL-03: Run → Thread Endpoints
// ============================================================================

import { pool } from '../db';
import { randomUUID } from 'crypto';

/**
 * POST /api/contractor/n3/runs/:runId/ensure-thread
 * Idempotently creates/retrieves a message thread for a service run.
 * Returns the thread ID for navigation.
 */
calendarRouter.post('/contractor/n3/runs/:runId/ensure-thread', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { runId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ ok: false, error: 'Missing tenant context' });
    }

    if (!runId) {
      return res.status(400).json({ ok: false, error: 'Missing runId' });
    }

    // Check if run exists and belongs to tenant
    const runCheck = await db
      .select({ id: ccN3Runs.id })
      .from(ccN3Runs)
      .where(and(eq(ccN3Runs.id, runId), eq(ccN3Runs.tenantId, tenantId)))
      .limit(1);

    if (runCheck.length === 0) {
      return res.status(404).json({ ok: false, error: 'Run not found' });
    }

    // Check for existing thread link
    const existingThread = await pool.query(`
      SELECT thread_id FROM cc_entity_threads
      WHERE tenant_id = $1 AND entity_type = 'n3_run' AND entity_id = $2
      LIMIT 1
    `, [tenantId, runId]);

    if (existingThread.rows.length > 0) {
      return res.json({ ok: true, threadId: existingThread.rows[0].thread_id });
    }

    // Create new conversation/thread
    const threadId = randomUUID();
    const conversationId = randomUUID();

    // Create the conversation entry
    await pool.query(`
      INSERT INTO cc_conversations (id, state, message_count, created_at, updated_at)
      VALUES ($1, 'active', 0, NOW(), NOW())
    `, [conversationId]);

    // Link entity to thread (using conversation_id as thread_id)
    await pool.query(`
      INSERT INTO cc_entity_threads (id, tenant_id, entity_type, entity_id, thread_id, created_at)
      VALUES ($1, $2, 'n3_run', $3, $4, NOW())
    `, [randomUUID(), tenantId, runId, conversationId]);

    res.json({ ok: true, threadId: conversationId });
  } catch (err) {
    console.error('[Calendar API] ensure-thread error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/contractor/n3/runs/:runId/thread
 * Get the thread ID for a run (if exists).
 */
calendarRouter.get('/contractor/n3/runs/:runId/thread', requireAuth, requireTenant, async (req, res) => {
  try {
    const tenantReq = req as TenantRequest;
    const tenantId = tenantReq.ctx.tenant_id;
    const { runId } = req.params;
    
    if (!tenantId || !runId) {
      return res.status(400).json({ ok: false, error: 'Missing required params' });
    }

    const result = await pool.query(`
      SELECT thread_id FROM cc_entity_threads
      WHERE tenant_id = $1 AND entity_type = 'n3_run' AND entity_id = $2
      LIMIT 1
    `, [tenantId, runId]);

    if (result.rows.length === 0) {
      return res.json({ ok: true, threadId: null });
    }

    res.json({ ok: true, threadId: result.rows[0].thread_id });
  } catch (err) {
    console.error('[Calendar API] get thread error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default calendarRouter;

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
  type CalendarRunDTO
} from '@shared/schema';
import { eq, and, gte, lte, or, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireTenant } from '../middleware/guards';
import type { TenantRequest } from '../middleware/tenantContext';

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

    const { resources, events } = mapRunsToOpsFormat(runs);

    res.json({
      resources,
      events,
      meta: {
        count: runs.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
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

    const { resources, events } = mapRunsToOpsFormat(runs);
    
    resources.forEach(r => {
      r.name = r.name.replace(/internal|contractor/gi, 'Service');
    });

    res.json({
      resources,
      events,
      meta: {
        count: runs.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
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

    const { resources, events } = mapRunsToOpsFormat(runs);
    
    resources.forEach(r => {
      r.name = 'Community Service';
      r.group = 'Scheduled Work';
    });

    res.json({
      resources,
      events,
      portal: {
        id: portal[0].id,
        name: portal[0].name,
      },
      meta: {
        count: runs.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }
    });
  } catch (err) {
    console.error('[Calendar API] Portal ops-calendar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default calendarRouter;

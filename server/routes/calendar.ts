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
  ccN3Segments,
  ccZones,
  ccPortals,
  ccProperties,
  type CalendarRunDTO
} from '@shared/schema';
import { eq, and, gte, lte, or, desc, sql, inArray } from 'drizzle-orm';
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
        zoneName: ccZones.name,
        portalName: ccPortals.name,
        metadata: ccN3Runs.metadata,
      })
      .from(ccN3Runs)
      .leftJoin(ccZones, eq(ccN3Runs.zoneId, ccZones.id))
      .leftJoin(ccPortals, eq(ccN3Runs.portalId, ccPortals.id))
      .where(
        and(
          eq(ccN3Runs.tenantId, tenantId),
          or(
            gte(ccN3Runs.startsAt, startDate),
            gte(ccN3Runs.endsAt, startDate)
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
      zoneLabel: run.zoneName || undefined,
      portalLabel: run.portalName || undefined,
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
      .select({ id: ccProperties.id, portalId: ccProperties.portalId })
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

    const portalIds = residentProperties.map(p => p.portalId).filter(Boolean) as string[];
    
    if (portalIds.length === 0) {
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
        zoneName: ccZones.name,
      })
      .from(ccN3Runs)
      .leftJoin(ccZones, eq(ccN3Runs.zoneId, ccZones.id))
      .where(
        and(
          inArray(ccN3Runs.portalId, portalIds),
          or(
            gte(ccN3Runs.startsAt, startDate),
            gte(ccN3Runs.endsAt, startDate)
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
      zoneLabel: run.zoneName || undefined,
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
      .select({ id: ccPortals.id, name: ccPortals.name })
      .from(ccPortals)
      .where(eq(ccPortals.id, portalId))
      .limit(1);

    if (portal.length === 0) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    const runs = await db
      .select({
        id: ccN3Runs.id,
        status: ccN3Runs.status,
        startsAt: ccN3Runs.startsAt,
        endsAt: ccN3Runs.endsAt,
        zoneName: ccZones.name,
      })
      .from(ccN3Runs)
      .leftJoin(ccZones, eq(ccN3Runs.zoneId, ccZones.id))
      .where(
        and(
          eq(ccN3Runs.portalId, portalId),
          or(
            gte(ccN3Runs.startsAt, startDate),
            gte(ccN3Runs.endsAt, startDate)
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
      zoneLabel: run.zoneName || undefined,
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

export default calendarRouter;

/**
 * PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
 * V3.5 Surface Spine API Routes
 * 
 * Endpoints:
 * - GET /api/p2/app/surfaces/containers/:containerId - Get container details
 * - POST /api/p2/app/surfaces/claims/hold - Hold units for a time window
 * - POST /api/p2/app/surfaces/claims/confirm - Confirm held claims
 * - POST /api/p2/app/surfaces/claims/release - Release claims
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccSurfaceContainers,
  ccSurfaces,
  ccSurfaceContainerMembers,
  ccSurfaceUnits,
  ccSurfaceClaims,
  ccUtilityNodes,
  ccSurfaceUtilityBindings
} from '@shared/schema';
import { eq, and, sql, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';

export const surfacesRouter = Router();

// GET /containers/:containerId - Get container details with hierarchy
surfacesRouter.get('/containers/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;
    const portalId = req.headers['x-portal-id'] as string;
    
    const container = await db.query.ccSurfaceContainers.findFirst({
      where: eq(ccSurfaceContainers.id, containerId),
    });

    if (!container) {
      return res.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Container not found' } });
    }

    // Get child containers
    const childContainers = await db
      .select()
      .from(ccSurfaceContainers)
      .where(eq(ccSurfaceContainers.parentContainerId, containerId));

    // Get member surfaces
    const members = await db
      .select({
        member: ccSurfaceContainerMembers,
        surface: ccSurfaces,
      })
      .from(ccSurfaceContainerMembers)
      .innerJoin(ccSurfaces, eq(ccSurfaceContainerMembers.surfaceId, ccSurfaces.id))
      .where(eq(ccSurfaceContainerMembers.containerId, containerId));

    // Get units for each surface
    const surfaceIds = members.map(m => m.surface.id);
    const units = surfaceIds.length > 0
      ? await db.select().from(ccSurfaceUnits).where(inArray(ccSurfaceUnits.surfaceId, surfaceIds))
      : [];

    // Get utility bindings
    const utilityBindings = surfaceIds.length > 0
      ? await db
          .select({
            binding: ccSurfaceUtilityBindings,
            node: ccUtilityNodes,
          })
          .from(ccSurfaceUtilityBindings)
          .innerJoin(ccUtilityNodes, eq(ccSurfaceUtilityBindings.utilityNodeId, ccUtilityNodes.id))
          .where(inArray(ccSurfaceUtilityBindings.surfaceId, surfaceIds))
      : [];

    // Group units by surface
    const unitsBySurface: Record<string, typeof units> = {};
    for (const unit of units) {
      if (!unitsBySurface[unit.surfaceId]) {
        unitsBySurface[unit.surfaceId] = [];
      }
      unitsBySurface[unit.surfaceId].push(unit);
    }

    res.json({
      ok: true,
      container,
      childContainers,
      surfaces: members.map(m => ({
        ...m.surface,
        memberRole: m.member.role,
        units: unitsBySurface[m.surface.id] || [],
      })),
      utilityBindings: utilityBindings.map(b => ({
        ...b.binding,
        node: b.node,
      })),
    });
  } catch (err) {
    console.error('[Surfaces API] Error fetching container:', err);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

const holdSchema = z.object({
  unit_ids: z.array(z.string().uuid()),
  time_start: z.string(),
  time_end: z.string(),
  hold_token: z.string().optional(),
  container_id: z.string().uuid().optional(),
  assigned_participant_id: z.string().uuid().optional(),
});

// POST /claims/hold - Hold units for a time window
surfacesRouter.post('/claims/hold', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    const body = holdSchema.parse(req.body);

    if (!portalId) {
      return res.json({ ok: false, error: { code: 'MISSING_PORTAL', message: 'Portal ID required' } });
    }

    const timeStart = new Date(body.time_start);
    const timeEnd = new Date(body.time_end);

    if (timeStart >= timeEnd) {
      return res.json({ ok: false, error: { code: 'INVALID_TIME', message: 'time_start must be before time_end' } });
    }

    // Check for overlapping claims using GIN index on unit_ids
    // Overlap exists if: new.start < existing.end AND new.end > existing.start
    const overlapping = await db.execute<{ id: string; unit_ids: string[] }>(sql`
      SELECT id, unit_ids 
      FROM cc_surface_claims 
      WHERE portal_id = ${portalId}
        AND claim_status IN ('hold', 'confirmed')
        AND unit_ids && ARRAY[${sql.join(body.unit_ids.map(id => sql`${id}::uuid`), sql`, `)}]
        AND time_start < ${timeEnd.toISOString()}::timestamptz
        AND time_end > ${timeStart.toISOString()}::timestamptz
      LIMIT 10
    `);

    if (overlapping.rows && overlapping.rows.length > 0) {
      // Find which units are conflicting
      const conflictingUnitIds = new Set<string>();
      for (const claim of overlapping.rows) {
        for (const unitId of claim.unit_ids) {
          if (body.unit_ids.includes(unitId)) {
            conflictingUnitIds.add(unitId);
          }
        }
      }

      return res.json({
        ok: false,
        error: {
          code: 'UNIT_OVERLAP',
          message: 'One or more units already claimed for this time window',
          conflicting_unit_ids: Array.from(conflictingUnitIds),
        },
      });
    }

    // Create the claim
    const holdToken = body.hold_token || `hold_${nanoid(12)}`;
    
    const [claim] = await db.insert(ccSurfaceClaims).values({
      portalId,
      tenantId,
      containerId: body.container_id,
      holdToken,
      claimStatus: 'hold',
      timeStart,
      timeEnd,
      unitIds: body.unit_ids,
      assignedParticipantId: body.assigned_participant_id,
    }).returning();

    res.json({
      ok: true,
      claim_id: claim.id,
      hold_token: holdToken,
    });
  } catch (err) {
    console.error('[Surfaces API] Error creating hold:', err);
    if (err instanceof z.ZodError) {
      return res.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

const confirmSchema = z.object({
  hold_token: z.string(),
  reservation_id: z.string().uuid(),
});

// POST /claims/confirm - Confirm held claims
surfacesRouter.post('/claims/confirm', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const body = confirmSchema.parse(req.body);

    const result = await db
      .update(ccSurfaceClaims)
      .set({
        claimStatus: 'confirmed',
        reservationId: body.reservation_id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ccSurfaceClaims.portalId, portalId),
          eq(ccSurfaceClaims.holdToken, body.hold_token),
          eq(ccSurfaceClaims.claimStatus, 'hold')
        )
      )
      .returning();

    res.json({
      ok: true,
      confirmed_count: result.length,
    });
  } catch (err) {
    console.error('[Surfaces API] Error confirming claims:', err);
    if (err instanceof z.ZodError) {
      return res.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

const releaseSchema = z.object({
  hold_token: z.string().optional(),
  reservation_id: z.string().uuid().optional(),
});

// POST /claims/release - Release claims
surfacesRouter.post('/claims/release', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const body = releaseSchema.parse(req.body);

    if (!body.hold_token && !body.reservation_id) {
      return res.json({ ok: false, error: { code: 'MISSING_IDENTIFIER', message: 'hold_token or reservation_id required' } });
    }

    const conditions = [eq(ccSurfaceClaims.portalId, portalId)];
    
    if (body.hold_token) {
      conditions.push(eq(ccSurfaceClaims.holdToken, body.hold_token));
    }
    if (body.reservation_id) {
      conditions.push(eq(ccSurfaceClaims.reservationId, body.reservation_id));
    }

    const result = await db
      .update(ccSurfaceClaims)
      .set({
        claimStatus: 'released',
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    res.json({
      ok: true,
      released_count: result.length,
    });
  } catch (err) {
    console.error('[Surfaces API] Error releasing claims:', err);
    if (err instanceof z.ZodError) {
      return res.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

// GET /units/available - Get available units for a time window
surfacesRouter.get('/units/available', async (req, res) => {
  try {
    const portalId = req.headers['x-portal-id'] as string;
    const { surface_id, time_start, time_end } = req.query;

    if (!surface_id || !time_start || !time_end) {
      return res.json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'surface_id, time_start, time_end required' } });
    }

    const timeStart = new Date(time_start as string);
    const timeEnd = new Date(time_end as string);

    // Get all units for this surface
    const allUnits = await db
      .select()
      .from(ccSurfaceUnits)
      .where(
        and(
          eq(ccSurfaceUnits.surfaceId, surface_id as string),
          eq(ccSurfaceUnits.isActive, true)
        )
      );

    // Get claimed unit IDs for this time window
    const claimedResult = await db.execute<{ unit_id: string }>(sql`
      SELECT DISTINCT unnest(unit_ids) as unit_id
      FROM cc_surface_claims 
      WHERE portal_id = ${portalId}
        AND claim_status IN ('hold', 'confirmed')
        AND time_start < ${timeEnd.toISOString()}::timestamptz
        AND time_end > ${timeStart.toISOString()}::timestamptz
    `);

    const claimedUnitIds = new Set(claimedResult.rows?.map(r => r.unit_id) || []);

    const availableUnits = allUnits.filter(u => !claimedUnitIds.has(u.id));

    res.json({
      ok: true,
      total_units: allUnits.length,
      available_units: availableUnits,
      claimed_count: claimedUnitIds.size,
    });
  } catch (err) {
    console.error('[Surfaces API] Error fetching available units:', err);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

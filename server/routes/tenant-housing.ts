import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { serviceQuery } from '../db/tenantDb';
import { TenantRequest } from '../middleware/tenantContext';

const router = express.Router();

async function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx;

  if (!ctx?.tenant_id) {
    return res.status(400).json({
      ok: false,
      error: 'TENANT_CONTEXT_REQUIRED',
      message: 'Tenant context required for this operation'
    });
  }

  if (!ctx?.individual_id) {
    return res.status(401).json({
      ok: false,
      error: 'AUTH_REQUIRED',
      message: 'Authentication required'
    });
  }

  next();
}

router.use(requireTenantContext);

const housingOfferSchema = z.object({
  capacity_beds: z.number().int().min(0).default(0),
  capacity_rooms: z.number().int().min(0).default(0),
  nightly_cost_min_cents: z.number().int().min(0).nullable().optional(),
  nightly_cost_max_cents: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'paused']).default('active'),
  housing_tier: z.enum(['premium', 'standard', 'temporary', 'emergency']).default('standard')
});

// GET /api/p2/app/portals/:portalId/housing-offer
router.get('/portals/:portalId/housing-offer', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  try {
    const result = await serviceQuery(`
      SELECT * FROM cc_portal_housing_offers
      WHERE portal_id = $1 AND tenant_id = $2
    `, [portalId, ctx.tenant_id]);

    if (result.rows.length === 0) {
      return res.json({
        ok: true,
        offer: null
      });
    }

    const offer = result.rows[0];
    res.json({
      ok: true,
      offer: {
        id: offer.id,
        portalId: offer.portal_id,
        tenantId: offer.tenant_id,
        capacityBeds: offer.capacity_beds,
        capacityRooms: offer.capacity_rooms,
        nightlyCostMinCents: offer.nightly_cost_min_cents,
        nightlyCostMaxCents: offer.nightly_cost_max_cents,
        notes: offer.notes,
        status: offer.status,
        housingTier: offer.housing_tier,
        updatedAt: offer.updated_at
      }
    });
  } catch (error: any) {
    console.error('Get housing offer error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch housing offer' });
  }
});

// PUT /api/p2/app/portals/:portalId/housing-offer (upsert)
router.put('/portals/:portalId/housing-offer', async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest;
  const ctx = tenantReq.ctx!;
  const { portalId } = req.params;

  const parseResult = housingOfferSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details: parseResult.error.flatten()
    });
  }

  const data = parseResult.data;

  try {
    // Verify portal exists
    const portalCheck = await serviceQuery(`
      SELECT id FROM cc_portals WHERE id = $1
    `, [portalId]);

    if (portalCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Portal not found' });
    }

    // Upsert housing offer
    const result = await serviceQuery(`
      INSERT INTO cc_portal_housing_offers (
        portal_id, tenant_id, capacity_beds, capacity_rooms,
        nightly_cost_min_cents, nightly_cost_max_cents, notes, status, housing_tier
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (portal_id, tenant_id) DO UPDATE SET
        capacity_beds = EXCLUDED.capacity_beds,
        capacity_rooms = EXCLUDED.capacity_rooms,
        nightly_cost_min_cents = EXCLUDED.nightly_cost_min_cents,
        nightly_cost_max_cents = EXCLUDED.nightly_cost_max_cents,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        housing_tier = EXCLUDED.housing_tier,
        updated_at = now()
      RETURNING *
    `, [
      portalId,
      ctx.tenant_id,
      data.capacity_beds,
      data.capacity_rooms,
      data.nightly_cost_min_cents ?? null,
      data.nightly_cost_max_cents ?? null,
      data.notes ?? null,
      data.status,
      data.housing_tier
    ]);

    const offer = result.rows[0];
    res.json({
      ok: true,
      offer: {
        id: offer.id,
        portalId: offer.portal_id,
        tenantId: offer.tenant_id,
        capacityBeds: offer.capacity_beds,
        capacityRooms: offer.capacity_rooms,
        nightlyCostMinCents: offer.nightly_cost_min_cents,
        nightlyCostMaxCents: offer.nightly_cost_max_cents,
        notes: offer.notes,
        status: offer.status,
        housingTier: offer.housing_tier,
        updatedAt: offer.updated_at
      }
    });
  } catch (error: any) {
    console.error('Upsert housing offer error:', error);
    res.status(500).json({ ok: false, error: 'Failed to save housing offer' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';

const router = Router();

/**
 * GET /api/p2/marina/properties
 * 
 * Returns properties with marina slips for property selector.
 * Uses cc_marina_unit_details join to identify marina slips.
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;
    const tenantId = ctx?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
      });
    }

    const result = await serviceQuery(`
      SELECT
        p.id,
        p.name,
        count(u.id)::int as slip_count
      FROM cc_properties p
      JOIN cc_units u ON u.property_id = p.id
      JOIN cc_marina_unit_details d ON d.unit_id = u.id
      WHERE p.tenant_id = $1
      GROUP BY p.id, p.name
      HAVING count(u.id) > 0
      ORDER BY p.name
    `, [tenantId]);

    res.json({
      ok: true,
      properties: result.rows
    });
  } catch (e: any) {
    console.error('[P2 Marina] Properties error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

/**
 * GET /api/p2/marina/units
 * 
 * Returns all marina slip units for a property with layout and marina-specific data.
 * Query params:
 * - propertyId (required)
 * - dockCode (optional filter)
 */
router.get('/units', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;
    const tenantId = ctx?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
      });
    }

    const propertyId = String(req.query.propertyId || '').trim();
    const dockCode = String(req.query.dockCode || '').trim() || null;

    if (!propertyId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'propertyId required' }
      });
    }

    const result = await serviceQuery(`
      SELECT 
        u.id,
        u.code,
        u.name,
        u.unit_type,
        u.status,
        u.layout_x,
        u.layout_y,
        u.layout_rotation,
        u.layout_shape,
        u.layout_ref,
        d.dock_code,
        d.dock_side,
        d.min_length_ft,
        d.max_length_ft,
        d.max_beam_ft,
        d.max_draft_ft,
        d.power_service,
        COALESCE(d.has_water, false) as has_water,
        COALESCE(d.has_pump_out, false) as has_pump_out
      FROM cc_units u
      JOIN cc_marina_unit_details d ON d.unit_id = u.id
      JOIN cc_properties p ON u.property_id = p.id
      WHERE u.property_id = $1::uuid
        AND p.tenant_id = $2
        AND ($3::text IS NULL OR d.dock_code = $3)
      ORDER BY d.dock_code NULLS LAST, u.code
    `, [propertyId, tenantId, dockCode]);

    const propertyResult = await serviceQuery(`
      SELECT id, name FROM cc_properties 
      WHERE id = $1::uuid AND tenant_id = $2
    `, [propertyId, tenantId]);

    res.json({
      ok: true,
      units: result.rows,
      property: propertyResult.rows[0] || null
    });
  } catch (e: any) {
    console.error('[P2 Marina] Units error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

/**
 * GET /api/p2/marina/availability
 * 
 * Returns availability status for all marina slips on a given date.
 * Query params:
 * - propertyId (required)
 * - date (required, defaults to today)
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;
    const tenantId = ctx?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing tenant context' }
      });
    }

    const propertyId = String(req.query.propertyId || '').trim();
    const dateStr = String(req.query.date || new Date().toISOString().split('T')[0]);

    if (!propertyId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'propertyId required' }
      });
    }

    const unitsResult = await serviceQuery(`
      SELECT u.id, u.code, u.status
      FROM cc_units u
      JOIN cc_marina_unit_details d ON d.unit_id = u.id
      JOIN cc_properties p ON u.property_id = p.id
      WHERE u.property_id = $1::uuid
        AND p.tenant_id = $2
    `, [propertyId, tenantId]);

    const allocResult = await serviceQuery(`
      SELECT
        a.id as allocation_id,
        COALESCE(a.unit_id, a.inventory_unit_id) as unit_id,
        a.starts_at,
        a.ends_at,
        a.hold_type,
        ci.id as cart_item_id,
        c.primary_guest_name as guest_name,
        ci.title as vessel_name,
        r.id as reservation_id
      FROM cc_reservation_allocations a
      LEFT JOIN cc_reservation_cart_items ci ON a.reservation_item_id = ci.id
      LEFT JOIN cc_reservation_carts c ON ci.cart_id = c.id
      LEFT JOIN cc_pms_reservations r ON r.cart_id = c.id
      WHERE COALESCE(a.unit_id, a.inventory_unit_id) IN (
        SELECT u.id FROM cc_units u
        JOIN cc_marina_unit_details d ON d.unit_id = u.id
        JOIN cc_properties p ON u.property_id = p.id
        WHERE u.property_id = $1::uuid 
          AND p.tenant_id = $2
      )
      AND a.starts_at < ($3::date + interval '1 day')
      AND a.ends_at > $3::date
    `, [propertyId, tenantId, dateStr]);

    const byUnit = new Map<string, any[]>();
    for (const row of allocResult.rows as any[]) {
      const unitId = row.unit_id;
      if (!unitId) continue;
      const list = byUnit.get(unitId) ?? [];
      list.push(row);
      byUnit.set(unitId, list);
    }

    const pickAllocation = (list: any[] | undefined): any | null => {
      if (!list || list.length === 0) return null;
      const confirmed = list.find((x) => x.hold_type === 'confirmed');
      return confirmed ?? list[0];
    };

    const allocations = (unitsResult.rows as any[]).map((unit) => {
      const alloc = pickAllocation(byUnit.get(unit.id));
      let status = 'available';

      if (unit.status === 'maintenance') {
        status = 'maintenance';
      } else if (alloc) {
        status = alloc.hold_type === 'confirmed' ? 'occupied' : 'reserved';
      }

      return {
        unit_id: unit.id,
        unit_code: unit.code,
        status,
        allocation_id: alloc?.allocation_id || null,
        guest_name: alloc?.guest_name || null,
        vessel_name: alloc?.vessel_name || null,
        vessel_length_ft: null,
        starts_at: alloc?.starts_at || null,
        ends_at: alloc?.ends_at || null,
        reservation_id: alloc?.reservation_id || null
      };
    });

    res.json({ ok: true, date: dateStr, allocations });
  } catch (e: any) {
    console.error('[P2 Marina] Availability error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

export default router;

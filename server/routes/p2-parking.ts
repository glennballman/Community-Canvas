import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { serviceQuery } from '../db/tenantDb';

const router = Router();

/**
 * GET /api/p2/parking/units
 * 
 * Returns all parking stall units for a property with layout data.
 * Query params:
 * - propertyId (required)
 * - zoneCode (optional filter)
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
    const zoneCode = String(req.query.zoneCode || '').trim() || null;

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
        d.zone_code,
        d.size_class,
        COALESCE(d.covered, false) as covered,
        COALESCE(d.accessible, false) as accessible,
        COALESCE(d.ev_charging, false) as ev_charging
      FROM cc_units u
      LEFT JOIN cc_parking_unit_details d ON d.unit_id = u.id
      JOIN cc_properties p ON u.property_id = p.id
      WHERE u.property_id = $1::uuid
        AND u.unit_type = 'parking_stall'
        AND p.tenant_id = $2
        AND ($3::text IS NULL OR d.zone_code = $3)
      ORDER BY d.zone_code NULLS LAST, u.code
    `, [propertyId, tenantId, zoneCode]);

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
    console.error('[P2 Parking] Units error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

/**
 * GET /api/p2/parking/availability
 * 
 * Returns availability status for all parking stalls on a given date.
 * Uses starts_at/ends_at overlap logic for allocations.
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
      JOIN cc_properties p ON u.property_id = p.id
      WHERE u.property_id = $1::uuid
        AND u.unit_type = 'parking_stall'
        AND p.tenant_id = $2
    `, [propertyId, tenantId]);

    const allocResult = await serviceQuery(`
      SELECT
        a.id as allocation_id,
        COALESCE(a.unit_id, iu.unit_id) as unit_id,
        a.starts_at,
        a.ends_at,
        a.hold_type,
        ci.id as cart_item_id,
        c.primary_guest_name as guest_name,
        ci.vehicle_plate
      FROM cc_reservation_allocations a
      LEFT JOIN cc_inventory_units iu ON a.inventory_unit_id = iu.id
      LEFT JOIN cc_reservation_cart_items ci ON a.reservation_item_id = ci.id
      LEFT JOIN cc_reservation_carts c ON ci.cart_id = c.id
      WHERE COALESCE(a.unit_id, iu.unit_id) IN (
        SELECT u.id FROM cc_units u
        JOIN cc_properties p ON u.property_id = p.id
        WHERE u.property_id = $1::uuid 
          AND u.unit_type = 'parking_stall'
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
        vehicle_plate: alloc?.vehicle_plate || null,
        starts_at: alloc?.starts_at || null,
        ends_at: alloc?.ends_at || null,
        reservation_id: alloc?.cart_item_id || null
      };
    });

    res.json({ ok: true, date: dateStr, allocations });
  } catch (e: any) {
    console.error('[P2 Parking] Availability error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

/**
 * GET /api/p2/parking/properties
 * 
 * Returns properties with parking stalls for property selector.
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
      SELECT DISTINCT p.id, p.name
      FROM cc_properties p
      JOIN cc_units u ON u.property_id = p.id
      WHERE p.tenant_id = $1
        AND u.unit_type = 'parking_stall'
      ORDER BY p.name
    `, [tenantId]);

    res.json({
      ok: true,
      properties: result.rows
    });
  } catch (e: any) {
    console.error('[P2 Parking] Properties error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

export default router;

/**
 * DEV/QA Seed Route for Parking Plan View Testing
 * 
 * Creates minimal seed data for QA testing of the parking plan view.
 * Only accessible to platform admins in development mode.
 * 
 * POST /api/dev/seed/parking?tenantId=xxx
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

router.post('/parking', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;

    if (!ctx?.is_platform_admin) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Platform admin required' }
      });
    }

    const tenantId = String(req.query.tenantId || '').trim() || 
                     '7d8e6df5-bf12-4965-85a9-20b4312ce6c8';

    const tenantCheck = await pool.query(
      'SELECT id, name FROM cc_tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Tenant not found' }
      });
    }

    const tenantName = tenantCheck.rows[0].name;
    console.log(`[DEV Seed] Creating parking data for tenant: ${tenantName}`);

    const existingProp = await pool.query(`
      SELECT p.id FROM cc_properties p
      JOIN cc_units u ON u.property_id = p.id
      JOIN cc_parking_unit_details d ON d.unit_id = u.id
      WHERE p.tenant_id = $1
      LIMIT 1
    `, [tenantId]);

    if (existingProp.rows.length > 0) {
      return res.json({
        ok: true,
        message: 'Parking data already exists',
        property_id: existingProp.rows[0].id,
        skipped: true
      });
    }

    const propertyId = randomUUID();
    await pool.query(`
      INSERT INTO cc_properties (
        id, tenant_id, name, code, slug, property_type, status,
        address_line1, city, province, postal_code, country,
        created_at, updated_at
      ) VALUES (
        $1, $2, 'Downtown Parking Lot', 'DPL-001', 'downtown-parking-lot', 'other', 'active',
        '123 Main Street', 'Victoria', 'BC', 'V8W 1A1', 'CA',
        NOW(), NOW()
      )
    `, [propertyId, tenantId]);

    console.log(`[DEV Seed] Created property: ${propertyId}`);

    const stalls = [
      { code: 'A01', name: 'Stall A01', zone: 'A', accessible: false, covered: true, ev: false, x: 0, y: 0 },
      { code: 'A02', name: 'Stall A02', zone: 'A', accessible: false, covered: true, ev: false, x: 1, y: 0 },
      { code: 'A03', name: 'Stall A03', zone: 'A', accessible: true, covered: true, ev: false, x: 2, y: 0 },
      { code: 'A04', name: 'Stall A04', zone: 'A', accessible: false, covered: true, ev: true, x: 3, y: 0 },
      { code: 'B01', name: 'Stall B01', zone: 'B', accessible: false, covered: false, ev: false, x: 0, y: 1 },
      { code: 'B02', name: 'Stall B02', zone: 'B', accessible: false, covered: false, ev: false, x: 1, y: 1 },
      { code: 'B03', name: 'Stall B03', zone: 'B', accessible: true, covered: false, ev: false, x: 2, y: 1 },
      { code: 'B04', name: 'Stall B04', zone: 'B', accessible: false, covered: false, ev: true, x: 3, y: 1 },
    ];

    const unitIds: string[] = [];

    for (const stall of stalls) {
      const unitId = randomUUID();
      unitIds.push(unitId);

      await pool.query(`
        INSERT INTO cc_units (
          id, property_id, name, code, unit_type, status,
          layout_x, layout_y, layout_rotation,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'other', 'available',
          $5, $6, 0,
          NOW(), NOW()
        )
      `, [unitId, propertyId, stall.name, stall.code, stall.x, stall.y]);

      await pool.query(`
        INSERT INTO cc_parking_unit_details (
          unit_id, zone_code, size_class, accessible, covered, ev_charging,
          created_at, updated_at
        ) VALUES (
          $1, $2, 'standard', $3, $4, $5,
          NOW(), NOW()
        )
      `, [unitId, stall.zone, stall.accessible, stall.covered, stall.ev]);
    }

    console.log(`[DEV Seed] Created ${stalls.length} parking stalls`);

    // Note: Allocations require reservation_item_id (FK constraint), so we cannot 
    // seed test allocations without full reservation data. All stalls will show as available.

    res.json({
      ok: true,
      message: 'Parking seed data created successfully',
      data: {
        tenant_id: tenantId,
        tenant_name: tenantName,
        property_id: propertyId,
        stall_count: stalls.length,
        unit_ids: unitIds
      }
    });
  } catch (e: any) {
    console.error('[DEV Seed] Parking error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

router.delete('/parking', async (req: Request, res: Response) => {
  try {
    const tenantReq = req as any;
    const ctx = tenantReq.ctx;

    if (!ctx?.is_platform_admin) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Platform admin required' }
      });
    }

    const tenantId = String(req.query.tenantId || '').trim() ||
                     '7d8e6df5-bf12-4965-85a9-20b4312ce6c8';

    // Delete allocations for parking stalls
    await pool.query(`
      DELETE FROM cc_reservation_allocations 
      WHERE unit_id IN (
        SELECT u.id FROM cc_units u
        JOIN cc_parking_unit_details d ON d.unit_id = u.id
        JOIN cc_properties p ON u.property_id = p.id
        WHERE p.tenant_id = $1
      )
    `, [tenantId]);

    // Get unit IDs before deleting details
    const unitIdsResult = await pool.query(`
      SELECT u.id FROM cc_units u
      JOIN cc_parking_unit_details d ON d.unit_id = u.id
      JOIN cc_properties p ON u.property_id = p.id
      WHERE p.tenant_id = $1
    `, [tenantId]);
    const unitIds = unitIdsResult.rows.map((r: any) => r.id);

    // Delete parking details
    await pool.query(`
      DELETE FROM cc_parking_unit_details 
      WHERE unit_id = ANY($1::uuid[])
    `, [unitIds]);

    // Delete units
    await pool.query(`
      DELETE FROM cc_units 
      WHERE id = ANY($1::uuid[])
    `, [unitIds]);

    // Delete parking lot properties (property_type = 'other' with DPL code pattern)
    const deletedProps = await pool.query(`
      DELETE FROM cc_properties 
      WHERE tenant_id = $1 
        AND code LIKE 'DPL-%'
      RETURNING id
    `, [tenantId]);

    res.json({
      ok: true,
      message: 'Parking seed data cleaned up',
      deleted_properties: deletedProps.rows.length
    });
  } catch (e: any) {
    console.error('[DEV Seed] Cleanup error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

export default router;

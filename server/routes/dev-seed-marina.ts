/**
 * DEV/QA Seed Route for Marina Plan View Testing
 * 
 * Creates minimal seed data for QA testing of the marina plan view.
 * Only accessible to platform admins in development mode.
 * 
 * POST /api/dev/seed/marina?tenantId=xxx
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

router.post('/marina', async (req: Request, res: Response) => {
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
    console.log(`[DEV Seed] Creating marina data for tenant: ${tenantName}`);

    const existingProp = await pool.query(`
      SELECT p.id FROM cc_properties p
      JOIN cc_units u ON u.property_id = p.id
      JOIN cc_marina_unit_details d ON d.unit_id = u.id
      WHERE p.tenant_id = $1
      LIMIT 1
    `, [tenantId]);

    if (existingProp.rows.length > 0) {
      return res.json({
        ok: true,
        message: 'Marina data already exists',
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
        $1, $2, 'Harbour View Marina', 'HVM-001', 'harbour-view-marina', 'other', 'active',
        '500 Harbour Road', 'Victoria', 'BC', 'V8V 2T6', 'CA',
        NOW(), NOW()
      )
    `, [propertyId, tenantId]);

    console.log(`[DEV Seed] Created property: ${propertyId}`);

    const slips = [
      { code: 'A01', name: 'Slip A01', dock: 'A', side: 'port', minLen: 20, maxLen: 35, maxBeam: 12, maxDraft: 6, power: '30A', water: true, pumpOut: false, x: 0, y: 0 },
      { code: 'A02', name: 'Slip A02', dock: 'A', side: 'starboard', minLen: 20, maxLen: 35, maxBeam: 12, maxDraft: 6, power: '30A', water: true, pumpOut: false, x: 1, y: 0 },
      { code: 'A03', name: 'Slip A03', dock: 'A', side: 'port', minLen: 25, maxLen: 45, maxBeam: 14, maxDraft: 8, power: '50A', water: true, pumpOut: true, x: 2, y: 0 },
      { code: 'A04', name: 'Slip A04', dock: 'A', side: 'starboard', minLen: 25, maxLen: 45, maxBeam: 14, maxDraft: 8, power: '50A', water: true, pumpOut: true, x: 3, y: 0 },
      { code: 'B01', name: 'Slip B01', dock: 'B', side: 'port', minLen: 30, maxLen: 55, maxBeam: 16, maxDraft: 10, power: '100A', water: true, pumpOut: true, x: 0, y: 2 },
      { code: 'B02', name: 'Slip B02', dock: 'B', side: 'starboard', minLen: 30, maxLen: 55, maxBeam: 16, maxDraft: 10, power: '100A', water: true, pumpOut: true, x: 1, y: 2 },
      { code: 'B03', name: 'Mooring B03', dock: 'B', side: null, minLen: 20, maxLen: 40, maxBeam: 14, maxDraft: 6, power: null, water: false, pumpOut: false, x: 2, y: 2, type: 'mooring' },
      { code: 'B04', name: 'Mooring B04', dock: 'B', side: null, minLen: 20, maxLen: 40, maxBeam: 14, maxDraft: 6, power: null, water: false, pumpOut: false, x: 3, y: 2, type: 'mooring' },
    ];

    const unitIds: string[] = [];

    for (const slip of slips) {
      const unitId = randomUUID();
      unitIds.push(unitId);
      const unitType = (slip as any).type === 'mooring' ? 'mooring' : 'slip';

      await pool.query(`
        INSERT INTO cc_units (
          id, property_id, name, code, unit_type, status,
          layout_x, layout_y, layout_rotation,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'available',
          $6, $7, 0,
          NOW(), NOW()
        )
      `, [unitId, propertyId, slip.name, slip.code, unitType, slip.x, slip.y]);

      await pool.query(`
        INSERT INTO cc_marina_unit_details (
          unit_id, dock_code, dock_side, min_length_ft, max_length_ft,
          max_beam_ft, max_draft_ft, power_service, has_water, has_pump_out,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          NOW(), NOW()
        )
      `, [unitId, slip.dock, slip.side, slip.minLen, slip.maxLen, slip.maxBeam, slip.maxDraft, slip.power, slip.water, slip.pumpOut]);
    }

    console.log(`[DEV Seed] Created ${slips.length} marina slips`);

    res.json({
      ok: true,
      message: 'Marina seed data created successfully',
      data: {
        tenant_id: tenantId,
        tenant_name: tenantName,
        property_id: propertyId,
        slip_count: slips.length,
        unit_ids: unitIds
      }
    });
  } catch (e: any) {
    console.error('[DEV Seed] Marina error:', e);
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL', message: e.message }
    });
  }
});

router.delete('/marina', async (req: Request, res: Response) => {
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

    await pool.query(`
      DELETE FROM cc_reservation_allocations 
      WHERE unit_id IN (
        SELECT u.id FROM cc_units u
        JOIN cc_marina_unit_details d ON d.unit_id = u.id
        JOIN cc_properties p ON u.property_id = p.id
        WHERE p.tenant_id = $1
      )
    `, [tenantId]);

    const unitIdsResult = await pool.query(`
      SELECT u.id FROM cc_units u
      JOIN cc_marina_unit_details d ON d.unit_id = u.id
      JOIN cc_properties p ON u.property_id = p.id
      WHERE p.tenant_id = $1
    `, [tenantId]);
    const unitIds = unitIdsResult.rows.map((r: any) => r.id);

    await pool.query(`
      DELETE FROM cc_marina_unit_details 
      WHERE unit_id = ANY($1::uuid[])
    `, [unitIds]);

    await pool.query(`
      DELETE FROM cc_units 
      WHERE id = ANY($1::uuid[])
    `, [unitIds]);

    const deletedProps = await pool.query(`
      DELETE FROM cc_properties 
      WHERE tenant_id = $1 
        AND code LIKE 'HVM-%'
      RETURNING id
    `, [tenantId]);

    res.json({
      ok: true,
      message: 'Marina seed data cleaned up',
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

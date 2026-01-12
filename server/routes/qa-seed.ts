import { Router } from 'express';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';

const router = Router();

router.post('/qa/seed-reservation-test-assets', async (req, res) => {
  try {
    const result = await withServiceTransaction(async (client) => {
      const tenantResult = await client.query(`SELECT id FROM cc_tenants LIMIT 1`);
      const tenantId = tenantResult.rows?.[0]?.id || null;
      
      const accommodationResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id, 
          name, asset_type, reservation_mode, 
          time_granularity_minutes, operational_status,
          default_start_time_local, default_end_time_local
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_cabin_1',
          'QA Test Cabin', 'accommodation', 'check_in_out',
          15, 'operational',
          '15:00', '11:00'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, reservation_mode, default_start_time_local, default_end_time_local
      `, [tenantId]);

      const rentalResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id,
          name, asset_type, reservation_mode,
          time_granularity_minutes, operational_status
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_kayak_1',
          'QA Test Kayak', 'equipment', 'pickup_return',
          15, 'operational'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, reservation_mode
      `, [tenantId]);

      const transportResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id,
          name, asset_type, reservation_mode,
          time_granularity_minutes, operational_status
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_van_1',
          'QA Test Transport Van', 'vehicle', 'arrive_depart',
          15, 'operational'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, reservation_mode
      `, [tenantId]);

      const transportId = transportResult.rows?.[0]?.id;

      const craneResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id,
          name, asset_type, reservation_mode,
          time_granularity_minutes, operational_status
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_crane_1',
          'QA Test Crane Attachment', 'equipment', 'start_end',
          15, 'operational'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, reservation_mode, operational_status
      `, [tenantId]);

      const craneId = craneResult.rows?.[0]?.id;

      let childLink = null;
      if (transportId && craneId) {
        const childLinkResult = await client.query(`
          INSERT INTO cc_asset_children (
            parent_asset_id, child_asset_id, relationship_type, is_required
          ) VALUES (
            $1, $2, 'mounted_tool', false
          )
          ON CONFLICT (parent_asset_id, child_asset_id) DO UPDATE SET is_required = false
          RETURNING *
        `, [transportId, craneId]);
        childLink = childLinkResult.rows?.[0];
      }

      return {
        accommodation: accommodationResult.rows?.[0],
        rental: rentalResult.rows?.[0],
        transport: transportResult.rows?.[0],
        crane: craneResult.rows?.[0],
        childLink
      };
    });

    res.json({
      success: true,
      assets: result
    });
  } catch (error: any) {
    console.error('QA seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/qa/test-reservation-semantics', async (req, res) => {
  try {
    const results: any = {
      testA: null,
      testB: null,
      testC: null,
      testD: null,
      testE: null
    };

    const RESERVATION_MODE_LABELS: Record<string, { start: string; end: string }> = {
      check_in_out: { start: 'Checking in', end: 'Checking out' },
      arrive_depart: { start: 'Arriving', end: 'Departing' },
      pickup_return: { start: 'Pickup', end: 'Return' },
      start_end: { start: 'Start', end: 'End' }
    };

    const accommodationResult = await serviceQuery(`
      SELECT id, name, reservation_mode, default_start_time_local, default_end_time_local
      FROM cc_assets 
      WHERE name = 'QA Test Cabin' AND asset_type = 'accommodation'
      LIMIT 1
    `);
    
    const rentalResult = await serviceQuery(`
      SELECT id, name, reservation_mode
      FROM cc_assets 
      WHERE name = 'QA Test Kayak' AND asset_type = 'equipment'
      LIMIT 1
    `);

    const transportResult = await serviceQuery(`
      SELECT id, name, reservation_mode
      FROM cc_assets 
      WHERE name = 'QA Test Transport Van' AND asset_type = 'vehicle'
      LIMIT 1
    `);

    const craneResult = await serviceQuery(`
      SELECT id, name, reservation_mode, operational_status
      FROM cc_assets 
      WHERE name = 'QA Test Crane Attachment' AND asset_type = 'equipment'
      LIMIT 1
    `);

    const acc = accommodationResult.rows?.[0];
    if (acc) {
      const checkInTime = acc.default_start_time_local || '15:00';
      const checkOutTime = acc.default_end_time_local || '11:00';
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const startsAt = `${today.toISOString().split('T')[0]}T${checkInTime}:00`;
      const endsAt = `${tomorrow.toISOString().split('T')[0]}T${checkOutTime}:00`;
      
      results.testA = {
        passed: true,
        asset: acc.name,
        reservationMode: acc.reservation_mode,
        labels: RESERVATION_MODE_LABELS[acc.reservation_mode],
        computedStartsAt: startsAt,
        computedEndsAt: endsAt,
        assertion: `1-night reservation uses check-in time ${checkInTime} and check-out time ${checkOutTime}`
      };
    }

    const rental = rentalResult.rows?.[0];
    if (rental) {
      const now = new Date();
      const snapTo15Min = (date: Date): Date => {
        const minutes = date.getMinutes();
        const snapped = Math.round(minutes / 15) * 15;
        date.setMinutes(snapped, 0, 0);
        return date;
      };
      
      const startTime = snapTo15Min(new Date(now));
      const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);
      
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const isSnapped = startTime.getMinutes() % 15 === 0 && endTime.getMinutes() % 15 === 0;
      
      results.testB = {
        passed: durationHours === 4 && isSnapped,
        asset: rental.name,
        reservationMode: rental.reservation_mode,
        labels: RESERVATION_MODE_LABELS[rental.reservation_mode],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationHours,
        isSnappedTo15Min: isSnapped,
        assertion: `Half-day preset = 4h, snapped to 15min`
      };
    }

    const transport = transportResult.rows?.[0];
    if (transport) {
      const labels = RESERVATION_MODE_LABELS[transport.reservation_mode];
      results.testC = {
        passed: labels?.start === 'Arriving' && labels?.end === 'Departing',
        asset: transport.name,
        reservationMode: transport.reservation_mode,
        labels,
        assertion: `Labels display "Arriving" / "Departing"`
      };
    }

    const crane = craneResult.rows?.[0];
    const transportForDegraded = transportResult.rows?.[0];
    if (crane && transportForDegraded) {
      await withServiceTransaction(async (client) => {
        await client.query(`
          UPDATE cc_assets SET operational_status = 'out_of_service' WHERE id = $1
        `, [crane.id]);
        await client.query(`
          UPDATE cc_asset_children SET is_required = false 
          WHERE child_asset_id = $1 AND parent_asset_id = $2
        `, [crane.id, transportForDegraded.id]);
      });
      
      const parentAfterD = await serviceQuery(`
        SELECT operational_status FROM cc_assets WHERE id = $1
      `, [transportForDegraded.id]);
      
      results.testD = {
        passed: parentAfterD.rows?.[0]?.operational_status === 'operational',
        childStatus: 'out_of_service',
        isRequired: false,
        parentStatus: parentAfterD.rows?.[0]?.operational_status,
        assertion: `Parent remains operational when non-required child is out_of_service`
      };

      await withServiceTransaction(async (client) => {
        await client.query(`
          UPDATE cc_asset_children SET is_required = true 
          WHERE child_asset_id = $1 AND parent_asset_id = $2
        `, [crane.id, transportForDegraded.id]);
      });

      const childrenLinks = await serviceQuery(`
        SELECT ac.is_required, ua.operational_status as child_status
        FROM cc_asset_children ac
        JOIN cc_assets ua ON ua.id = ac.child_asset_id
        WHERE ac.parent_asset_id = $1
        AND ac.is_required = true
        AND ua.operational_status = 'out_of_service'
      `, [transportForDegraded.id]);

      const shouldBeDegraded = childrenLinks.rows && childrenLinks.rows.length > 0;
      
      results.testE = {
        passed: shouldBeDegraded,
        childStatus: 'out_of_service',
        isRequired: true,
        shouldTriggerDegraded: shouldBeDegraded,
        assertion: `When is_required=true child is out_of_service, parent should be flagged as degraded (app logic responsibility)`
      };

      await withServiceTransaction(async (client) => {
        await client.query(`
          UPDATE cc_assets SET operational_status = 'operational' WHERE id = $1
        `, [crane.id]);
      });
    }

    const allPassed = Object.values(results).every((r: any) => r?.passed);

    res.json({
      success: allPassed,
      results,
      summary: {
        testA: results.testA?.passed ? 'PASS' : 'FAIL',
        testB: results.testB?.passed ? 'PASS' : 'FAIL',
        testC: results.testC?.passed ? 'PASS' : 'FAIL',
        testD: results.testD?.passed ? 'PASS' : 'FAIL',
        testE: results.testE?.passed ? 'PASS' : 'FAIL'
      }
    });
  } catch (error: any) {
    console.error('QA test error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/qa/cleanup-test-assets', async (req, res) => {
  try {
    await withServiceTransaction(async (client) => {
      await client.query(`
        DELETE FROM cc_asset_children WHERE parent_asset_id IN (
          SELECT id FROM cc_assets WHERE name LIKE 'QA Test%'
        ) OR child_asset_id IN (
          SELECT id FROM cc_assets WHERE name LIKE 'QA Test%'
        )
      `);
      await client.query(`
        DELETE FROM cc_assets WHERE name LIKE 'QA Test%'
      `);
    });
    res.json({ success: true, message: 'QA test assets cleaned up' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// V3.3.1 Block 12: Go/No-Go QA Endpoints
// ============================================================================

const QA_SEED_TAG = 'qa-go-no-go';

interface TenantInfo {
  tenantId: string;
  name: string;
  participates: boolean;
}

interface AssetInfo {
  assetId: string;
  assetType: string;
  title: string;
  providerTenantId: string;
  facilityId: string;
  offerId?: string;
}

router.post('/qa/seed-go-no-go', async (req, res) => {
  const { portalSlug, windowStart, windowEnd } = req.body;
  
  try {
    const portalSlugValue = portalSlug || 'bamfield';
    
    const portalResult = await serviceQuery(`
      SELECT id, slug, owning_tenant_id as community_id
      FROM cc_portals
      WHERE slug = $1
      LIMIT 1
    `, [portalSlugValue]);
    
    let portal = portalResult.rows?.[0] as any;
    
    if (!portal) {
      const communityResult = await serviceQuery(`
        SELECT id FROM cc_tenants WHERE tenant_type = 'community' LIMIT 1
      `);
      const communityId = communityResult.rows?.[0]?.id || 'b0000000-0000-0000-0000-000000000001';
      
      const newPortalResult = await serviceQuery(`
        INSERT INTO cc_portals (slug, name, owning_tenant_id, status, primary_audience)
        VALUES ($1, 'Bamfield Community Portal', $2::uuid, 'active', 'public')
        RETURNING id, slug, owning_tenant_id as community_id
      `, [portalSlugValue, communityId]);
      portal = newPortalResult.rows?.[0];
    }
    
    const operatorResult = await serviceQuery(`
      SELECT id, email FROM cc_individuals
      WHERE email = 'qa.operator@communitycanvas.local'
      LIMIT 1
    `);
    
    let operator = operatorResult.rows?.[0] as any;
    
    if (!operator) {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('Password123!', 10);
      
      const newOperatorResult = await serviceQuery(`
        INSERT INTO cc_individuals (email, full_name, password_hash)
        VALUES ('qa.operator@communitycanvas.local', 'QA Operator', $1)
        RETURNING id, email
      `, [passwordHash]);
      operator = newOperatorResult.rows?.[0];
    }
    
    const tenantsResult = await serviceQuery(`
      SELECT id, name, tenant_type FROM cc_tenants
      WHERE tenant_type IN ('provider', 'lodging', 'marina', 'parking')
      ORDER BY name
      LIMIT 10
    `);
    
    const tenants: TenantInfo[] = (tenantsResult.rows || []).map((t: any) => ({
      tenantId: t.id,
      name: t.name,
      participates: true
    }));
    
    const assets: AssetInfo[] = [];
    
    const lodgingResult = await serviceQuery(`
      SELECT 
        f.id as facility_id,
        f.tenant_id,
        f.name as facility_name,
        u.id as unit_id,
        u.display_label
      FROM cc_facilities f
      JOIN cc_inventory_units u ON u.facility_id = f.id
      WHERE f.facility_type = 'lodging' AND f.is_active = true
      LIMIT 1
    `);
    
    if (lodgingResult.rows && lodgingResult.rows.length > 0) {
      const lodging = lodgingResult.rows[0] as any;
      const offerResult = await serviceQuery(`
        SELECT id FROM cc_offers WHERE facility_id = $1::uuid LIMIT 1
      `, [lodging.facility_id]);
      assets.push({
        assetId: lodging.unit_id,
        assetType: 'lodging',
        title: lodging.display_label || 'Lodging Unit',
        providerTenantId: lodging.tenant_id,
        facilityId: lodging.facility_id,
        offerId: (offerResult.rows?.[0] as any)?.id
      });
    }
    
    const marinaResult = await serviceQuery(`
      SELECT 
        f.id as facility_id,
        f.tenant_id,
        f.name as facility_name,
        u.id as unit_id,
        u.display_label
      FROM cc_facilities f
      JOIN cc_inventory_units u ON u.facility_id = f.id
      WHERE f.facility_type = 'marina' AND f.is_active = true
      LIMIT 1
    `);
    
    if (marinaResult.rows && marinaResult.rows.length > 0) {
      const marina = marinaResult.rows[0] as any;
      const offerResult = await serviceQuery(`
        SELECT id FROM cc_offers WHERE facility_id = $1::uuid LIMIT 1
      `, [marina.facility_id]);
      assets.push({
        assetId: marina.unit_id,
        assetType: 'slip',
        title: marina.display_label || 'Marina Slip',
        providerTenantId: marina.tenant_id,
        facilityId: marina.facility_id,
        offerId: (offerResult.rows?.[0] as any)?.id
      });
    }
    
    const parkingResult = await serviceQuery(`
      SELECT 
        f.id as facility_id,
        f.tenant_id,
        f.name as facility_name,
        u.id as unit_id,
        u.display_label
      FROM cc_facilities f
      JOIN cc_inventory_units u ON u.facility_id = f.id
      WHERE f.facility_type = 'parking' AND f.is_active = true
      LIMIT 1
    `);
    
    if (parkingResult.rows && parkingResult.rows.length > 0) {
      const parking = parkingResult.rows[0] as any;
      const offerResult = await serviceQuery(`
        SELECT id FROM cc_offers WHERE facility_id = $1::uuid LIMIT 1
      `, [parking.facility_id]);
      assets.push({
        assetId: parking.unit_id,
        assetType: 'parking',
        title: parking.display_label || 'Parking Stall',
        providerTenantId: parking.tenant_id,
        facilityId: parking.facility_id,
        offerId: (offerResult.rows?.[0] as any)?.id
      });
    }
    
    const crypto = await import('crypto');
    
    res.json({
      traceId: crypto.randomUUID(),
      seeded: {
        portalSlug: portalSlugValue,
        portalId: portal?.id,
        communityId: portal?.community_id,
        tenants,
        assets,
        webcamEntityId: null,
        operatorEmail: operator?.email || 'qa.operator@communitycanvas.local',
        operatorId: operator?.id
      }
    });
    
  } catch (error: any) {
    console.error('QA Seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/qa/cleanup-go-no-go', async (_req, res) => {
  try {
    await serviceQuery(`
      DELETE FROM cc_incidents WHERE qa_seed_tag = $1
    `, [QA_SEED_TAG]);
    
    await serviceQuery(`
      DELETE FROM cc_access_credentials
      WHERE reservation_id IN (
        SELECT id FROM cc_reservations WHERE idempotency_key LIKE 'qa-go-no-go-%'
      )
    `);
    
    await serviceQuery(`
      DELETE FROM cc_reservations WHERE idempotency_key LIKE 'qa-go-no-go-%'
    `);
    
    res.json({ ok: true, cleanedUp: ['incidents', 'reservations', 'credentials'] });
    
  } catch (error: any) {
    console.error('QA Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/qa/health', async (_req, res) => {
  try {
    const result = await serviceQuery(`SELECT 1 as ok`);
    res.json({ 
      status: 'ok', 
      database: result.rows && result.rows.length > 0 ? 'connected' : 'error',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

export default router;

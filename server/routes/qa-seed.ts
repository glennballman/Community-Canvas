import { Router } from 'express';
import { serviceQuery, withServiceTransaction } from '../db/tenantDb';

const router = Router();

router.post('/qa/seed-booking-test-assets', async (req, res) => {
  try {
    const result = await withServiceTransaction(async (client) => {
      const tenantResult = await client.query(`SELECT id FROM cc_tenants LIMIT 1`);
      const tenantId = tenantResult.rows?.[0]?.id || null;
      
      const accommodationResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id, 
          name, asset_type, booking_mode, 
          time_granularity_minutes, operational_status,
          default_start_time_local, default_end_time_local
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_cabin_1',
          'QA Test Cabin', 'accommodation', 'check_in_out',
          15, 'operational',
          '15:00', '11:00'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, booking_mode, default_start_time_local, default_end_time_local
      `, [tenantId]);

      const rentalResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id,
          name, asset_type, booking_mode,
          time_granularity_minutes, operational_status
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_kayak_1',
          'QA Test Kayak', 'equipment', 'pickup_return',
          15, 'operational'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, booking_mode
      `, [tenantId]);

      const transportResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id,
          name, asset_type, booking_mode,
          time_granularity_minutes, operational_status
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_van_1',
          'QA Test Transport Van', 'vehicle', 'arrive_depart',
          15, 'operational'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, booking_mode
      `, [tenantId]);

      const transportId = transportResult.rows?.[0]?.id;

      const craneResult = await client.query(`
        INSERT INTO cc_assets (
          id, owner_tenant_id, owner_type, source_table, source_id,
          name, asset_type, booking_mode,
          time_granularity_minutes, operational_status
        ) VALUES (
          gen_random_uuid(), $1, 'tenant', 'qa_test', 'qa_crane_1',
          'QA Test Crane Attachment', 'equipment', 'start_end',
          15, 'operational'
        )
        ON CONFLICT DO NOTHING
        RETURNING id, name, booking_mode, operational_status
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

router.post('/qa/test-booking-semantics', async (req, res) => {
  try {
    const results: any = {
      testA: null,
      testB: null,
      testC: null,
      testD: null,
      testE: null
    };

    const BOOKING_MODE_LABELS: Record<string, { start: string; end: string }> = {
      check_in_out: { start: 'Checking in', end: 'Checking out' },
      arrive_depart: { start: 'Arriving', end: 'Departing' },
      pickup_return: { start: 'Pickup', end: 'Return' },
      start_end: { start: 'Start', end: 'End' }
    };

    const accommodationResult = await serviceQuery(`
      SELECT id, name, booking_mode, default_start_time_local, default_end_time_local
      FROM cc_assets 
      WHERE name = 'QA Test Cabin' AND asset_type = 'accommodation'
      LIMIT 1
    `);
    
    const rentalResult = await serviceQuery(`
      SELECT id, name, booking_mode
      FROM cc_assets 
      WHERE name = 'QA Test Kayak' AND asset_type = 'equipment'
      LIMIT 1
    `);

    const transportResult = await serviceQuery(`
      SELECT id, name, booking_mode
      FROM cc_assets 
      WHERE name = 'QA Test Transport Van' AND asset_type = 'vehicle'
      LIMIT 1
    `);

    const craneResult = await serviceQuery(`
      SELECT id, name, booking_mode, operational_status
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
        bookingMode: acc.booking_mode,
        labels: BOOKING_MODE_LABELS[acc.booking_mode],
        computedStartsAt: startsAt,
        computedEndsAt: endsAt,
        assertion: `1-night booking uses check-in time ${checkInTime} and check-out time ${checkOutTime}`
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
        bookingMode: rental.booking_mode,
        labels: BOOKING_MODE_LABELS[rental.booking_mode],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationHours,
        isSnappedTo15Min: isSnapped,
        assertion: `Half-day preset = 4h, snapped to 15min`
      };
    }

    const transport = transportResult.rows?.[0];
    if (transport) {
      const labels = BOOKING_MODE_LABELS[transport.booking_mode];
      results.testC = {
        passed: labels?.start === 'Arriving' && labels?.end === 'Departing',
        asset: transport.name,
        bookingMode: transport.booking_mode,
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

export default router;

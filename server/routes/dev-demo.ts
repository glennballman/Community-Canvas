/**
 * N3-CAL-04: Demo Seed/Reset Endpoints
 * DEV-ONLY: Seeds demo data for Bamfield portal with personas
 */

import express, { Request, Response } from 'express';
import { serviceQuery } from '../db/tenantDb';
import bcrypt from 'bcrypt';
import { DEMO_BATCH_ID, isDemoMode, validateDemoKey } from '../services/demoTag';

const router = express.Router();
const IS_DEV = process.env.NODE_ENV !== 'production';

function checkDemoGuard(req: Request, res: Response): boolean {
  if (!IS_DEV && !isDemoMode()) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  
  const headerKey = req.headers['x-demo-seed-key'] as string | undefined;
  if (!validateDemoKey(headerKey)) {
    res.status(403).json({ error: 'Invalid demo seed key' });
    return false;
  }
  
  return true;
}

async function logDemoRow(tableName: string, rowId: string): Promise<void> {
  await serviceQuery(`
    INSERT INTO cc_demo_seed_log (demo_batch_id, table_name, row_id)
    VALUES ($1, $2, $3::uuid)
    ON CONFLICT DO NOTHING
  `, [DEMO_BATCH_ID, tableName, rowId]);
}

router.post('/api/dev/demo-seed', async (req: Request, res: Response) => {
  if (!checkDemoGuard(req, res)) return;

  const summary = {
    portal: 0,
    zones: 0,
    tenant: 0,
    users: 0,
    memberships: 0,
    contractorProfiles: 0,
    runs: 0,
    photoBundles: 0,
    staffBlocks: 0,
    dependencyRules: 0,
  };

  try {
    let portalId: string;
    let tenantId: string;
    let ellenUserId: string;
    let wadeUserId: string;

    const existingPortal = await serviceQuery(
      "SELECT id, owning_tenant_id FROM cc_portals WHERE slug = 'bamfield'"
    );

    if (existingPortal.rows.length > 0) {
      portalId = existingPortal.rows[0].id;
      tenantId = existingPortal.rows[0].owning_tenant_id;
    } else {
      const tenantResult = await serviceQuery(`
        SELECT id FROM cc_tenants WHERE name ILIKE '%1252093 BC%' OR name ILIKE '%Enviropaving%'
        LIMIT 1
      `);

      if (tenantResult.rows.length > 0) {
        tenantId = tenantResult.rows[0].id;
      } else {
        const newTenant = await serviceQuery(`
          INSERT INTO cc_tenants (name, status)
          VALUES ('1252093 BC LTD', 'active')
          RETURNING id
        `);
        tenantId = newTenant.rows[0].id;
        await logDemoRow('cc_tenants', tenantId);
        summary.tenant = 1;
      }

      const portalResult = await serviceQuery(`
        INSERT INTO cc_portals (slug, name, owning_tenant_id, status)
        VALUES ('bamfield', 'Bamfield Community', $1, 'active')
        RETURNING id
      `, [tenantId]);
      portalId = portalResult.rows[0].id;
      await logDemoRow('cc_portals', portalId);
      summary.portal = 1;
    }

    const zones = [
      { key: 'east-bamfield', name: 'East Bamfield' },
      { key: 'west-bamfield', name: 'West Bamfield' },
      { key: 'helby-island', name: 'Helby Island' },
      { key: 'deer-group', name: 'Deer Group' },
    ];

    const zoneIds: Map<string, string> = new Map();

    for (const zone of zones) {
      const existing = await serviceQuery(
        'SELECT id FROM cc_zones WHERE portal_id = $1 AND key = $2',
        [portalId, zone.key]
      );

      if (existing.rows.length > 0) {
        zoneIds.set(zone.key, existing.rows[0].id);
      } else {
        const result = await serviceQuery(`
          INSERT INTO cc_zones (tenant_id, portal_id, key, name, kind)
          VALUES ($1, $2, $3, $4, 'neighborhood')
          RETURNING id
        `, [tenantId, portalId, zone.key, zone.name]);
        zoneIds.set(zone.key, result.rows[0].id);
        await logDemoRow('cc_zones', result.rows[0].id);
        summary.zones++;
      }
    }

    const passwordHash = await bcrypt.hash('ellen123!', 12);

    const ellenExisting = await serviceQuery(
      "SELECT id FROM cc_users WHERE email = 'ellen@example.com'"
    );

    if (ellenExisting.rows.length > 0) {
      ellenUserId = ellenExisting.rows[0].id;
    } else {
      const result = await serviceQuery(`
        INSERT INTO cc_users (email, password_hash, given_name, family_name, display_name, status)
        VALUES ('ellen@example.com', $1, 'Ellen', 'Contractor', 'Ellen Contractor', 'active')
        RETURNING id
      `, [passwordHash]);
      ellenUserId = result.rows[0].id;
      await logDemoRow('cc_users', ellenUserId);
      summary.users++;
    }

    const wadePasswordHash = await bcrypt.hash('wade123!', 12);
    const wadeExisting = await serviceQuery(
      "SELECT id FROM cc_users WHERE email = 'wade@example.com'"
    );

    if (wadeExisting.rows.length > 0) {
      wadeUserId = wadeExisting.rows[0].id;
    } else {
      const result = await serviceQuery(`
        INSERT INTO cc_users (email, password_hash, given_name, family_name, display_name, status)
        VALUES ('wade@example.com', $1, 'Wade', 'Resident', 'Wade Resident', 'active')
        RETURNING id
      `, [wadePasswordHash]);
      wadeUserId = result.rows[0].id;
      await logDemoRow('cc_users', wadeUserId);
      summary.users++;
    }

    const ellenMembership = await serviceQuery(`
      SELECT id FROM cc_tenant_users WHERE user_id = $1 AND tenant_id = $2
    `, [ellenUserId, tenantId]);

    if (ellenMembership.rows.length === 0) {
      const result = await serviceQuery(`
        INSERT INTO cc_tenant_users (user_id, tenant_id, role, status)
        VALUES ($1, $2, 'admin', 'active')
        RETURNING id
      `, [ellenUserId, tenantId]);
      await logDemoRow('cc_tenant_users', result.rows[0].id);
      summary.memberships++;
    }

    const ellenProfile = await serviceQuery(`
      SELECT id FROM cc_contractor_profiles WHERE user_id = $1
    `, [ellenUserId]);

    let contractorProfileId: string;
    if (ellenProfile.rows.length > 0) {
      contractorProfileId = ellenProfile.rows[0].id;
    } else {
      const result = await serviceQuery(`
        INSERT INTO cc_contractor_profiles (user_id, portal_id, tenant_id, company_name, onboarding_complete, contractor_role)
        VALUES ($1, $2, $3, 'Enviropaving', true, 'contractor_admin')
        RETURNING id
      `, [ellenUserId, portalId, tenantId]);
      contractorProfileId = result.rows[0].id;
      await logDemoRow('cc_contractor_profiles', contractorProfileId);
      summary.contractorProfiles++;
    }

    const existingDemoRuns = await serviceQuery(`
      SELECT id FROM cc_n3_runs 
      WHERE tenant_id = $1 
      AND metadata->>'demoBatchId' = $2
    `, [tenantId, DEMO_BATCH_ID]);

    if (existingDemoRuns.rows.length === 0) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 86400000);

      const runsToSeed = [
        { name: 'Driveway Paving - East', zone: 'east-bamfield', day: today, hour: 9, status: 'scheduled' },
        { name: 'Curb Repair - East', zone: 'east-bamfield', day: today, hour: 14, status: 'scheduled' },
        { name: 'Walkway Install - West', zone: 'west-bamfield', day: today, hour: 10, status: 'scheduled' },
        { name: 'Dock Access Paving - Helby', zone: 'helby-island', day: today, hour: 13, status: 'scheduled' },
        { name: 'Community Road Repair', zone: 'west-bamfield', day: tomorrow, hour: 9, status: 'scheduled' },
        { name: 'Marina Lot Paving', zone: 'deer-group', day: tomorrow, hour: 11, status: 'scheduled' },
      ];

      for (const run of runsToSeed) {
        const startAt = new Date(run.day);
        startAt.setHours(run.hour, 0, 0, 0);
        const endAt = new Date(startAt.getTime() + 2 * 3600000);

        const result = await serviceQuery(`
          INSERT INTO cc_n3_runs (tenant_id, portal_id, zone_id, name, status, starts_at, ends_at, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          tenantId,
          portalId,
          zoneIds.get(run.zone),
          run.name,
          run.status,
          startAt.toISOString(),
          endAt.toISOString(),
          JSON.stringify({ demoBatchId: DEMO_BATCH_ID })
        ]);
        await logDemoRow('cc_n3_runs', result.rows[0].id);
        summary.runs++;
      }
    }

    const existingBundles = await serviceQuery(`
      SELECT id FROM cc_contractor_photo_bundles 
      WHERE contractor_profile_id = $1 
      AND meta->>'demoBatchId' = $2
    `, [contractorProfileId, DEMO_BATCH_ID]);

    if (existingBundles.rows.length === 0) {
      const now = new Date();
      const bundleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
      const bundleEnd = new Date(bundleStart.getTime() + 2 * 3600000);

      const result = await serviceQuery(`
        INSERT INTO cc_contractor_photo_bundles (
          contractor_profile_id, 
          tenant_id, 
          bundle_type, 
          status, 
          start_time, 
          end_time,
          meta
        )
        VALUES ($1, $2, 'job_evidence', 'confirmed', $3, $4, $5)
        RETURNING id
      `, [
        contractorProfileId,
        tenantId,
        bundleStart.toISOString(),
        bundleEnd.toISOString(),
        JSON.stringify({ demoBatchId: DEMO_BATCH_ID })
      ]);
      await logDemoRow('cc_contractor_photo_bundles', result.rows[0].id);
      summary.photoBundles++;
    }

    const existingBlocks = await serviceQuery(`
      SELECT id FROM cc_staff_availability_blocks 
      WHERE tenant_id = $1 
      AND reason LIKE '%demoBatchId%'
    `, [tenantId]);

    if (existingBlocks.rows.length === 0) {
      const now = new Date();
      const blockStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      const blockEnd = new Date(blockStart.getTime() + 4 * 3600000);

      const result = await serviceQuery(`
        INSERT INTO cc_staff_availability_blocks (tenant_id, person_id, kind, start_at, end_at, reason)
        VALUES ($1, $2, 'unavailable', $3, $4, $5)
        RETURNING id
      `, [
        tenantId,
        ellenUserId,
        blockStart.toISOString(),
        blockEnd.toISOString(),
        JSON.stringify({ demoBatchId: DEMO_BATCH_ID, display: 'Team Meeting' })
      ]);
      await logDemoRow('cc_staff_availability_blocks', result.rows[0].id);
      summary.staffBlocks++;
    }

    const existingRules = await serviceQuery(`
      SELECT id FROM cc_portal_dependency_rules 
      WHERE portal_id = $1 
      AND rule_payload::text LIKE '%demo%'
    `, [portalId]);

    if (existingRules.rows.length === 0) {
      const westZoneId = zoneIds.get('west-bamfield');
      const helbyZoneId = zoneIds.get('helby-island');
      const eastZoneId = zoneIds.get('east-bamfield');

      if (westZoneId) {
        const r1 = await serviceQuery(`
          INSERT INTO cc_portal_dependency_rules (portal_id, dependency_type, rule_payload)
          VALUES ($1, 'seaplane', $2)
          RETURNING id
        `, [portalId, JSON.stringify({ zoneId: westZoneId, source: 'demo-seaplane', severity: 'warn' })]);
        await logDemoRow('cc_portal_dependency_rules', r1.rows[0].id);
        summary.dependencyRules++;
      }

      if (helbyZoneId) {
        const r2 = await serviceQuery(`
          INSERT INTO cc_portal_dependency_rules (portal_id, dependency_type, rule_payload)
          VALUES ($1, 'seaplane', $2)
          RETURNING id
        `, [portalId, JSON.stringify({ zoneId: helbyZoneId, source: 'demo-seaplane', severity: 'critical' })]);
        await logDemoRow('cc_portal_dependency_rules', r2.rows[0].id);
        summary.dependencyRules++;
      }

      if (eastZoneId) {
        const r3 = await serviceQuery(`
          INSERT INTO cc_portal_dependency_rules (portal_id, dependency_type, rule_payload)
          VALUES ($1, 'ferry', $2)
          RETURNING id
        `, [portalId, JSON.stringify({ zoneId: eastZoneId, source: 'demo-ferry', severity: 'warn' })]);
        await logDemoRow('cc_portal_dependency_rules', r3.rows[0].id);
        summary.dependencyRules++;

        const r4 = await serviceQuery(`
          INSERT INTO cc_portal_dependency_rules (portal_id, dependency_type, rule_payload)
          VALUES ($1, 'road', $2)
          RETURNING id
        `, [portalId, JSON.stringify({ zoneId: eastZoneId, source: 'demo-road', severity: 'critical' })]);
        await logDemoRow('cc_portal_dependency_rules', r4.rows[0].id);
        summary.dependencyRules++;
      }
    }

    // Seed demo alerts for Command Console testing
    const existingAlerts = await serviceQuery(`
      SELECT id FROM cc_alerts WHERE source_key = 'demo-seed' LIMIT 1
    `);

    let demoAlerts = 0;
    if (existingAlerts.rows.length === 0) {
      const demoAlertsData = [
        {
          title: 'Highway 4 - Gravel Section Delays',
          summary: 'Expect delays on the Bamfield Road due to gravel surface maintenance between Km 67 and Km 85.',
          severity: 'warning',
          signal_type: 'drivebc',
          alert_type: 'road',
          affected_area: 'Bamfield Road',
          details: JSON.stringify({ highway: 'Bamfield Road', km_start: 67, km_end: 85 }),
        },
        {
          title: 'MV Frances Barkley - Schedule Change',
          summary: 'Lady Rose Marine Services announces modified sailing schedule for Bamfield route due to vessel maintenance.',
          severity: 'moderate',
          signal_type: 'bcferries',
          alert_type: 'ferry',
          affected_area: 'Barkley Sound',
          details: JSON.stringify({ route: 'Port Alberni - Bamfield', vessel: 'MV Frances Barkley' }),
        },
        {
          title: 'Wind Warning - Barkley Sound',
          summary: 'Environment Canada has issued a wind warning for Barkley Sound. Southwest winds 60-80 km/h expected.',
          severity: 'warning',
          signal_type: 'environment-canada',
          alert_type: 'weather',
          affected_area: 'Barkley Sound',
          details: JSON.stringify({ type: 'wind_warning', wind_speed: '60-80 km/h' }),
        },
      ];

      for (const alert of demoAlertsData) {
        const result = await serviceQuery(`
          INSERT INTO cc_alerts (
            title, summary, severity, signal_type, alert_type, 
            affected_area, details, source_key, 
            effective_from, effective_until
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'demo-seed', NOW(), NOW() + interval '7 days')
          RETURNING id
        `, [
          alert.title,
          alert.summary,
          alert.severity,
          alert.signal_type,
          alert.alert_type,
          alert.affected_area,
          alert.details,
        ]);
        await logDemoRow('cc_alerts', result.rows[0].id);
        demoAlerts++;
      }
    }

    res.json({
      ok: true,
      demoBatchId: DEMO_BATCH_ID,
      summary: { ...summary, demoAlerts },
      portalId,
      tenantId,
      users: {
        ellen: { id: ellenUserId, email: 'ellen@example.com' },
        wade: { id: wadeUserId, email: 'wade@example.com' },
      },
    });
  } catch (err) {
    console.error('[Demo Seed] Error:', err);
    res.status(500).json({ error: 'Demo seed failed', details: String(err) });
  }
});

router.post('/api/dev/demo-reset', async (req: Request, res: Response) => {
  if (!checkDemoGuard(req, res)) return;

  const summary = {
    alerts: 0,
    photoBundles: 0,
    staffBlocks: 0,
    runs: 0,
    dependencyRules: 0,
    contractorProfiles: 0,
    memberships: 0,
    zones: 0,
    portal: 0,
    tenant: 0,
    users: 0,
    logEntries: 0,
  };

  try {
    const deleteOrder = [
      { table: 'cc_alerts', key: 'alerts' },
      { table: 'cc_contractor_photo_bundles', key: 'photoBundles' },
      { table: 'cc_staff_availability_blocks', key: 'staffBlocks' },
      { table: 'cc_n3_runs', key: 'runs' },
      { table: 'cc_portal_dependency_rules', key: 'dependencyRules' },
      { table: 'cc_contractor_profiles', key: 'contractorProfiles' },
      { table: 'cc_tenant_users', key: 'memberships' },
      { table: 'cc_zones', key: 'zones' },
      { table: 'cc_portals', key: 'portal' },
      { table: 'cc_tenants', key: 'tenant' },
      { table: 'cc_users', key: 'users' },
    ];

    for (const { table, key } of deleteOrder) {
      const rows = await serviceQuery(`
        SELECT row_id FROM cc_demo_seed_log 
        WHERE demo_batch_id = $1 AND table_name = $2
      `, [DEMO_BATCH_ID, table]);

      for (const row of rows.rows) {
        try {
          await serviceQuery(`DELETE FROM ${table} WHERE id = $1`, [row.row_id]);
          (summary as any)[key]++;
        } catch (deleteErr) {
          console.warn(`[Demo Reset] Could not delete from ${table}:`, row.row_id);
        }
      }
    }

    const logResult = await serviceQuery(`
      DELETE FROM cc_demo_seed_log WHERE demo_batch_id = $1
    `, [DEMO_BATCH_ID]);
    summary.logEntries = logResult.rowCount || 0;

    res.json({
      ok: true,
      demoBatchId: DEMO_BATCH_ID,
      summary,
    });
  } catch (err) {
    console.error('[Demo Reset] Error:', err);
    res.status(500).json({ error: 'Demo reset failed', details: String(err) });
  }
});

export default router;

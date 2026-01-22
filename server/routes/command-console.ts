/**
 * Command Console API Routes
 * 
 * Platform Admin endpoints for viewing live feed data from pipelines.
 * All endpoints require platform admin authentication.
 * 
 * Routes:
 * - GET /api/p2/platform/command-console/roads?scope=bamfield|all
 * - GET /api/p2/platform/command-console/ferries?scope=bamfield|all
 * - GET /api/p2/platform/command-console/weather?scope=bamfield|all
 * - GET /api/p2/platform/command-console/hydro?scope=bamfield|all
 * - GET /api/p2/platform/command-console/earthquakes?scope=bamfield|all
 * - GET /api/p2/platform/command-console/dependency-rules?portalId=...
 * - GET /api/p2/platform/command-console/bamfield (aggregated snapshot)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requirePlatformAdmin } from '../middleware/guards';

const router = Router();

const BAMFIELD_REGION = {
  lat: 48.83,
  lng: -125.13,
  radiusKm: 100,
  keywords: ['bamfield', 'alberni', 'tofino', 'ucluelet', 'port alberni', 'pacific rim', 'vancouver island', 'barkley sound'],
};

function isBamfieldRelevant(row: any): boolean {
  const text = [
    row.title,
    row.summary,
    row.message,
    row.affected_area,
    JSON.stringify(row.details),
  ].filter(Boolean).join(' ').toLowerCase();

  if (BAMFIELD_REGION.keywords.some(kw => text.includes(kw))) {
    return true;
  }

  if (row.latitude && row.longitude) {
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    const distance = Math.sqrt(
      Math.pow(lat - BAMFIELD_REGION.lat, 2) + 
      Math.pow(lng - BAMFIELD_REGION.lng, 2)
    ) * 111;
    return distance < BAMFIELD_REGION.radiusKm;
  }

  return false;
}

router.get('/api/p2/platform/command-console/roads', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope as string || 'all';
    
    const result = await pool.query(`
      SELECT 
        id, title, summary, message, severity, 
        effective_from, effective_until,
        latitude, longitude, 
        details, source_key, signal_type
      FROM cc_alerts
      WHERE signal_type LIKE '%drivebc%' OR alert_type IN ('road', 'closure', 'road_event')
      ORDER BY effective_from DESC
      LIMIT 100
    `);

    let rows = result.rows;
    if (scope === 'bamfield') {
      rows = rows.filter(isBamfieldRelevant);
    }

    const items = rows.map(row => ({
      id: row.id,
      title: row.title || 'Road Event',
      summary: row.summary || row.message,
      severity: row.severity,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      location: row.details?.location || row.details?.highway || null,
      source: row.source_key,
    }));

    res.json({
      ok: true,
      scope,
      count: items.length,
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Command Console] Roads error:', err);
    res.status(500).json({ error: 'Failed to fetch road data' });
  }
});

router.get('/api/p2/platform/command-console/ferries', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope as string || 'all';

    const alertsResult = await pool.query(`
      SELECT 
        id, title, summary, message, severity,
        effective_from, effective_until,
        details, source_key
      FROM cc_alerts
      WHERE alert_type = 'ferry' OR signal_type LIKE '%ferry%'
      ORDER BY effective_from DESC
      LIMIT 50
    `);

    const transportResult = await pool.query(`
      SELECT 
        id, title, message, severity, alert_type,
        affected_date, delay_minutes, source
      FROM cc_transport_alerts
      WHERE alert_type IN ('ferry_delay', 'ferry_cancellation', 'ferry')
      ORDER BY created_at DESC
      LIMIT 50
    `);

    let rows = [...alertsResult.rows, ...transportResult.rows];
    if (scope === 'bamfield') {
      rows = rows.filter(isBamfieldRelevant);
    }

    const items = rows.map(row => ({
      id: row.id,
      title: row.title || 'Ferry Alert',
      summary: row.summary || row.message,
      severity: row.severity,
      alertType: row.alert_type,
      delayMinutes: row.delay_minutes,
      affectedDate: row.affected_date,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      source: row.source_key || row.source,
    }));

    res.json({
      ok: true,
      scope,
      count: items.length,
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Command Console] Ferries error:', err);
    res.status(500).json({ error: 'Failed to fetch ferry data' });
  }
});

router.get('/api/p2/platform/command-console/weather', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope as string || 'all';

    const result = await pool.query(`
      SELECT 
        id, title, summary, message, severity,
        effective_from, effective_until,
        latitude, longitude,
        details, source_key
      FROM cc_alerts
      WHERE alert_type = 'weather' OR signal_type LIKE '%weather%'
      ORDER BY effective_from DESC
      LIMIT 100
    `);

    let rows = result.rows;
    if (scope === 'bamfield') {
      rows = rows.filter(isBamfieldRelevant);
    }

    const items = rows.map(row => ({
      id: row.id,
      title: row.title || 'Weather Alert',
      summary: row.summary || row.message,
      severity: row.severity,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      warningType: row.details?.warning_type,
      source: row.source_key,
    }));

    res.json({
      ok: true,
      scope,
      count: items.length,
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Command Console] Weather error:', err);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

router.get('/api/p2/platform/command-console/hydro', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope as string || 'all';

    const result = await pool.query(`
      SELECT 
        id, title, summary, message, severity,
        effective_from, effective_until,
        latitude, longitude,
        details, source_key
      FROM cc_alerts
      WHERE alert_type = 'outage' OR signal_type LIKE '%hydro%' OR signal_type LIKE '%power%'
      ORDER BY effective_from DESC
      LIMIT 100
    `);

    let rows = result.rows;
    if (scope === 'bamfield') {
      rows = rows.filter(isBamfieldRelevant);
    }

    const items = rows.map(row => ({
      id: row.id,
      title: row.title || 'Power Outage',
      summary: row.summary || row.message,
      severity: row.severity,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      customersAffected: row.details?.customers_affected,
      cause: row.details?.cause,
      source: row.source_key,
    }));

    res.json({
      ok: true,
      scope,
      count: items.length,
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Command Console] Hydro error:', err);
    res.status(500).json({ error: 'Failed to fetch hydro data' });
  }
});

router.get('/api/p2/platform/command-console/earthquakes', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope as string || 'all';

    const result = await pool.query(`
      SELECT 
        id, title, summary, message, severity,
        effective_from, effective_until,
        latitude, longitude,
        details, source_key
      FROM cc_alerts
      WHERE alert_type IN ('earthquake', 'tsunami', 'seismic')
        OR signal_type LIKE '%earthquake%' 
        OR signal_type LIKE '%seismic%'
      ORDER BY effective_from DESC
      LIMIT 100
    `);

    let rows = result.rows;
    if (scope === 'bamfield') {
      rows = rows.filter(isBamfieldRelevant);
    }

    const items = rows.map(row => ({
      id: row.id,
      title: row.title || 'Seismic Event',
      summary: row.summary || row.message,
      severity: row.severity,
      magnitude: row.details?.magnitude,
      depth: row.details?.depth,
      effectiveFrom: row.effective_from,
      latitude: row.latitude,
      longitude: row.longitude,
      source: row.source_key,
    }));

    res.json({
      ok: true,
      scope,
      count: items.length,
      items,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Command Console] Earthquakes error:', err);
    res.status(500).json({ error: 'Failed to fetch earthquake data' });
  }
});

router.get('/api/p2/platform/command-console/dependency-rules', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const portalId = req.query.portalId as string;

    let query = `
      SELECT 
        r.id, r.portal_id, r.dependency_type, r.rule_payload, r.created_at,
        p.name as portal_name, p.slug as portal_slug
      FROM cc_portal_dependency_rules r
      LEFT JOIN cc_portals p ON r.portal_id = p.id
    `;
    const params: string[] = [];

    if (portalId) {
      query += ` WHERE r.portal_id = $1`;
      params.push(portalId);
    }

    query += ` ORDER BY p.name, r.dependency_type`;

    const result = await pool.query(query, params);

    const items = result.rows.map(row => ({
      id: row.id,
      portalId: row.portal_id,
      portalName: row.portal_name,
      portalSlug: row.portal_slug,
      dependencyType: row.dependency_type,
      rulePayload: row.rule_payload,
      createdAt: row.created_at,
    }));

    res.json({
      ok: true,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error('[Command Console] Dependency Rules error:', err);
    res.status(500).json({ error: 'Failed to fetch dependency rules' });
  }
});

router.get('/api/p2/platform/command-console/bamfield', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const portalResult = await pool.query(`
      SELECT id, name, slug FROM cc_portals WHERE slug = 'bamfield' LIMIT 1
    `);
    
    const portal = portalResult.rows[0] || null;

    const alertsResult = await pool.query(`
      SELECT 
        id, alert_type, title, summary, message, severity,
        effective_from, effective_until,
        latitude, longitude, details, signal_type, source_key
      FROM cc_alerts
      WHERE is_active = true
      ORDER BY effective_from DESC
      LIMIT 200
    `);

    const bamfieldAlerts = alertsResult.rows.filter(isBamfieldRelevant);

    const byType: Record<string, any[]> = {
      roads: [],
      ferries: [],
      weather: [],
      hydro: [],
      earthquakes: [],
    };

    for (const row of bamfieldAlerts) {
      const item = {
        id: row.id,
        title: row.title,
        summary: row.summary || row.message,
        severity: row.severity,
        effectiveFrom: row.effective_from,
        effectiveUntil: row.effective_until,
      };

      const type = row.alert_type?.toLowerCase() || '';
      const signal = row.signal_type?.toLowerCase() || '';

      if (type.includes('road') || type.includes('closure') || signal.includes('drivebc')) {
        byType.roads.push(item);
      } else if (type.includes('ferry') || signal.includes('ferry')) {
        byType.ferries.push(item);
      } else if (type.includes('weather') || signal.includes('weather')) {
        byType.weather.push(item);
      } else if (type.includes('outage') || type.includes('hydro') || signal.includes('hydro')) {
        byType.hydro.push(item);
      } else if (type.includes('earthquake') || type.includes('seismic') || type.includes('tsunami')) {
        byType.earthquakes.push(item);
      }
    }

    const rulesResult = portal ? await pool.query(`
      SELECT r.id, r.dependency_type, r.rule_payload, r.created_at
      FROM cc_portal_dependency_rules r
      WHERE r.portal_id = $1
    `, [portal.id]) : { rows: [] };

    const zonesResult = portal ? await pool.query(`
      SELECT id, name, key FROM cc_zones WHERE portal_id = $1
    `, [portal.id]) : { rows: [] };

    const overallStatus = bamfieldAlerts.some(a => a.severity === 'critical' || a.severity === 'major') 
      ? 'blocked' 
      : bamfieldAlerts.some(a => a.severity === 'warning' || a.severity === 'moderate')
        ? 'risky'
        : 'ok';

    res.json({
      ok: true,
      portal: portal ? { id: portal.id, name: portal.name, slug: portal.slug } : null,
      overallStatus,
      zones: zonesResult.rows,
      dependencyRules: rulesResult.rows.map(r => ({
        id: r.id,
        dependencyType: r.dependency_type,
        rulePayload: r.rule_payload,
        createdAt: r.created_at,
      })),
      feeds: {
        roads: { count: byType.roads.length, items: byType.roads.slice(0, 5) },
        ferries: { count: byType.ferries.length, items: byType.ferries.slice(0, 5) },
        weather: { count: byType.weather.length, items: byType.weather.slice(0, 5) },
        hydro: { count: byType.hydro.length, items: byType.hydro.slice(0, 5) },
        earthquakes: { count: byType.earthquakes.length, items: byType.earthquakes.slice(0, 5) },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Command Console] Bamfield Snapshot error:', err);
    res.status(500).json({ error: 'Failed to fetch Bamfield snapshot' });
  }
});

export default router;

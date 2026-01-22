/**
 * Public Portal Conditions API
 * 
 * Provides privacy-safe summary of community conditions for public portal pages.
 * No authentication required - returns aggregated status only, not detailed events.
 * 
 * Routes:
 * - GET /api/public/portal/:portalSlug/conditions
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

interface FeedStatus {
  status: 'ok' | 'warning' | 'critical';
  count: number;
  label: string;
}

interface ConditionsResponse {
  ok: boolean;
  portal: { id: string; name: string; slug: string } | null;
  overallStatus: 'ok' | 'risky' | 'blocked';
  statusLabel: string;
  feeds: {
    roads: FeedStatus;
    ferries: FeedStatus;
    weather: FeedStatus;
    power: FeedStatus;
    seismic: FeedStatus;
  };
  lastUpdated: string;
}

const BAMFIELD_KEYWORDS = [
  'bamfield', 'alberni', 'tofino', 'ucluelet', 'port alberni', 
  'pacific rim', 'vancouver island', 'barkley sound'
];

function isRelevantToPortal(row: any, keywords: string[]): boolean {
  const text = [
    row.title,
    row.summary,
    row.message,
    row.affected_area,
    JSON.stringify(row.details),
  ].filter(Boolean).join(' ').toLowerCase();

  return keywords.some(kw => text.includes(kw));
}

function getStatusFromSeverity(severities: string[]): 'ok' | 'warning' | 'critical' {
  if (severities.some(s => s === 'critical' || s === 'major')) return 'critical';
  if (severities.some(s => s === 'warning' || s === 'moderate')) return 'warning';
  return 'ok';
}

router.get('/api/public/portal/:portalSlug/conditions', async (req: Request, res: Response) => {
  try {
    const { portalSlug } = req.params;

    const portalResult = await pool.query(`
      SELECT id, name, slug FROM cc_portals WHERE slug = $1 LIMIT 1
    `, [portalSlug]);

    const portal = portalResult.rows[0];
    if (!portal) {
      return res.json({
        ok: false,
        error: 'Portal not found',
        portal: null,
        overallStatus: 'ok',
        statusLabel: 'Unknown',
        feeds: {
          roads: { status: 'ok', count: 0, label: 'Roads' },
          ferries: { status: 'ok', count: 0, label: 'Ferries' },
          weather: { status: 'ok', count: 0, label: 'Weather' },
          power: { status: 'ok', count: 0, label: 'Power' },
          seismic: { status: 'ok', count: 0, label: 'Seismic' },
        },
        lastUpdated: new Date().toISOString(),
      } as ConditionsResponse);
    }

    const keywords = portalSlug === 'bamfield' ? BAMFIELD_KEYWORDS : [portalSlug];

    const alertsResult = await pool.query(`
      SELECT 
        id, title, summary, message, severity, 
        signal_type, alert_type, details, affected_area
      FROM cc_alerts
      WHERE effective_until IS NULL OR effective_until > NOW()
      ORDER BY effective_from DESC
      LIMIT 200
    `);

    const relevantAlerts = alertsResult.rows.filter(row => isRelevantToPortal(row, keywords));

    const byType = {
      roads: [] as any[],
      ferries: [] as any[],
      weather: [] as any[],
      power: [] as any[],
      seismic: [] as any[],
    };

    for (const alert of relevantAlerts) {
      const type = alert.signal_type?.toLowerCase() || alert.alert_type?.toLowerCase() || '';
      if (type.includes('drivebc') || type.includes('road')) {
        byType.roads.push(alert);
      } else if (type.includes('ferry') || type.includes('bcferries')) {
        byType.ferries.push(alert);
      } else if (type.includes('weather') || type.includes('environment')) {
        byType.weather.push(alert);
      } else if (type.includes('hydro') || type.includes('power') || type.includes('outage')) {
        byType.power.push(alert);
      } else if (type.includes('earthquake') || type.includes('seismic')) {
        byType.seismic.push(alert);
      }
    }

    const feedStatuses = {
      roads: {
        status: getStatusFromSeverity(byType.roads.map(a => a.severity)),
        count: byType.roads.length,
        label: 'Roads',
      } as FeedStatus,
      ferries: {
        status: getStatusFromSeverity(byType.ferries.map(a => a.severity)),
        count: byType.ferries.length,
        label: 'Ferries',
      } as FeedStatus,
      weather: {
        status: getStatusFromSeverity(byType.weather.map(a => a.severity)),
        count: byType.weather.length,
        label: 'Weather',
      } as FeedStatus,
      power: {
        status: getStatusFromSeverity(byType.power.map(a => a.severity)),
        count: byType.power.length,
        label: 'Power',
      } as FeedStatus,
      seismic: {
        status: getStatusFromSeverity(byType.seismic.map(a => a.severity)),
        count: byType.seismic.length,
        label: 'Seismic',
      } as FeedStatus,
    };

    const allStatuses = Object.values(feedStatuses).map(f => f.status);
    const overallStatus = allStatuses.includes('critical') 
      ? 'blocked' 
      : allStatuses.includes('warning') 
        ? 'risky' 
        : 'ok';

    const statusLabel = overallStatus === 'blocked' 
      ? 'Service Disruptions' 
      : overallStatus === 'risky' 
        ? 'Minor Delays Possible' 
        : 'All Systems Normal';

    res.json({
      ok: true,
      portal: { id: portal.id, name: portal.name, slug: portal.slug },
      overallStatus,
      statusLabel,
      feeds: feedStatuses,
      lastUpdated: new Date().toISOString(),
    } as ConditionsResponse);
  } catch (err) {
    console.error('[Public Conditions] Error:', err);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

export default router;

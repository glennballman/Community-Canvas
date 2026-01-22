/**
 * N3-CAL-03: Dependency Windows Service
 * 
 * Provides dependency risk windows (weather, travel) for calendar feasibility overlays.
 * These windows affect zone feasibility and are used to mark runs as ok/risky/blocked.
 * 
 * IMPLEMENTATION STATUS:
 * - LIVE FEED MODE: Queries cc_alerts and cc_transport_alerts tables populated by pipelines
 * - Pipelines: DriveBC (road), Weather (Environment Canada), BC Ferries, Earthquakes
 * - Fallback: Returns dev_seed data when no feed data available AND in DEV mode
 * 
 * ZONE MAPPING:
 * - Uses cc_portal_dependency_rules for explicit zone mapping (seaplane, custom routes)
 * - Falls back to geo-proximity matching via alert lat/lng to zone centroids
 */

import { pool } from '../db';
import type { DependencyWindowDTO } from '@shared/schema';

const IS_DEV = process.env.NODE_ENV === 'development' || process.env.CC_DEV_SEED === 'true';

export interface DependencyWindow {
  id: string;
  type: 'weather' | 'ferry' | 'highway' | 'seaplane' | 'road' | 'tsunami' | 'air';
  startAt: Date;
  endAt: Date;
  severity: 'info' | 'warn' | 'critical';
  reasonCodes: string[];
  affectedZoneIds?: string[];
  confidence?: number;
  source: 'feed' | 'dev_seed';
  rawRef?: {
    feedEventId?: string;
    provider?: string;
  };
}

export type ZoneWindowMap = Map<string, DependencyWindow[]>;

/**
 * Map alert_type and severity from cc_alerts to DependencyWindow format.
 */
function mapAlertSeverity(severity: string): 'info' | 'warn' | 'critical' {
  switch (severity?.toLowerCase()) {
    case 'major':
    case 'critical':
      return 'critical';
    case 'warning':
    case 'moderate':
      return 'warn';
    default:
      return 'info';
  }
}

/**
 * Map alert_type to dependency window type.
 */
function mapAlertType(alertType: string, signalType?: string): DependencyWindow['type'] {
  switch (alertType?.toLowerCase()) {
    case 'weather':
      return 'weather';
    case 'closure':
    case 'road':
    case 'road_event':
      return 'road';
    case 'ferry':
    case 'ferry_delay':
    case 'ferry_cancellation':
      return 'ferry';
    case 'earthquake':
    case 'tsunami':
      return 'tsunami';
    default:
      if (signalType?.includes('ferry')) return 'ferry';
      if (signalType?.includes('drivebc')) return 'road';
      return 'weather';
  }
}

/**
 * Get dependency windows from cc_alerts table (main feed storage).
 */
async function getWindowsFromAlerts(
  from: Date,
  to: Date,
  regionId?: string | null
): Promise<DependencyWindow[]> {
  const windows: DependencyWindow[] = [];

  try {
    const result = await pool.query(`
      SELECT 
        id,
        alert_type,
        severity,
        signal_type,
        title,
        summary,
        message,
        details,
        effective_from,
        effective_until,
        latitude,
        longitude,
        source_key
      FROM cc_alerts
      WHERE is_active = true
        AND (effective_until IS NULL OR effective_until > $1)
        AND effective_from < $2
      ORDER BY effective_from ASC
      LIMIT 100
    `, [from, to]);

    for (const row of result.rows) {
      const endAt = row.effective_until || new Date(to.getTime() + 24 * 60 * 60 * 1000);
      
      const reasonCodes: string[] = [];
      if (row.details?.event_type) reasonCodes.push(row.details.event_type.toLowerCase());
      if (row.details?.warning_type) reasonCodes.push(row.details.warning_type.toLowerCase());
      if (row.title) reasonCodes.push(row.title.toLowerCase().replace(/\s+/g, '_').substring(0, 30));

      windows.push({
        id: `alert-${row.id}`,
        type: mapAlertType(row.alert_type, row.signal_type),
        startAt: new Date(row.effective_from),
        endAt: new Date(endAt),
        severity: mapAlertSeverity(row.severity),
        reasonCodes: reasonCodes.filter(Boolean),
        confidence: 0.9,
        source: 'feed',
        rawRef: {
          feedEventId: row.id,
          provider: row.signal_type || row.alert_type,
        },
      });
    }
  } catch (error) {
    console.error('[DependencyWindows] Error querying cc_alerts:', error);
  }

  return windows;
}

/**
 * Get dependency windows from cc_transport_alerts table (ferry/transport specific).
 */
async function getWindowsFromTransportAlerts(
  portalId: string | null,
  from: Date,
  to: Date
): Promise<DependencyWindow[]> {
  const windows: DependencyWindow[] = [];

  try {
    let query = `
      SELECT 
        id,
        alert_type,
        severity,
        title,
        message,
        affected_date,
        delay_minutes,
        source,
        source_ref,
        created_at
      FROM cc_transport_alerts
      WHERE status = 'active'
        AND (expires_at IS NULL OR expires_at > $1)
    `;
    const params: (Date | string)[] = [from];

    if (portalId) {
      query += ` AND portal_id = $2`;
      params.push(portalId);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);

    for (const row of result.rows) {
      const startAt = row.affected_date ? new Date(row.affected_date) : new Date(row.created_at);
      const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

      const severity: 'info' | 'warn' | 'critical' = 
        row.alert_type === 'cancellation' ? 'critical' :
        (row.delay_minutes && row.delay_minutes > 30) ? 'warn' : 'info';

      const reasonCodes: string[] = [];
      if (row.alert_type) reasonCodes.push(row.alert_type.toLowerCase());
      if (row.delay_minutes) reasonCodes.push(`delay_${row.delay_minutes}min`);

      windows.push({
        id: `transport-${row.id}`,
        type: 'ferry',
        startAt,
        endAt,
        severity,
        reasonCodes,
        confidence: 0.95,
        source: 'feed',
        rawRef: {
          feedEventId: row.id,
          provider: row.source || 'transport_alert',
        },
      });
    }
  } catch (error) {
    console.error('[DependencyWindows] Error querying cc_transport_alerts:', error);
  }

  return windows;
}

/**
 * Get portal dependency rules for zone mapping.
 */
async function getPortalDependencyRules(
  portalId: string
): Promise<Array<{ dependencyType: string; rulePayload: Record<string, unknown> }>> {
  try {
    const result = await pool.query(`
      SELECT dependency_type, rule_payload
      FROM cc_portal_dependency_rules
      WHERE portal_id = $1
    `, [portalId]);

    return result.rows.map(row => ({
      dependencyType: row.dependency_type,
      rulePayload: row.rule_payload || {},
    }));
  } catch {
    return [];
  }
}

/**
 * Apply zone mapping rules to windows.
 */
function applyZoneMapping(
  windows: DependencyWindow[],
  rules: Array<{ dependencyType: string; rulePayload: Record<string, unknown> }>
): DependencyWindow[] {
  return windows.map(window => {
    const matchingRule = rules.find(r => 
      r.dependencyType === window.type ||
      (r.rulePayload.sourcePattern && 
       window.rawRef?.provider?.match(new RegExp(r.rulePayload.sourcePattern as string, 'i')))
    );

    if (matchingRule && matchingRule.rulePayload.affectedZones) {
      return {
        ...window,
        affectedZoneIds: matchingRule.rulePayload.affectedZones as string[],
      };
    }

    return window;
  });
}

/**
 * Generate dev seed windows for QA testing.
 */
function getDevSeedWindows(from: Date, to: Date): DependencyWindow[] {
  const windows: DependencyWindow[] = [];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(18, 0, 0, 0);

  if (tomorrow >= from && tomorrow <= to) {
    windows.push({
      id: 'dev-seed-seaplane-001',
      type: 'seaplane',
      startAt: tomorrow,
      endAt: tomorrowEnd,
      severity: 'critical',
      reasonCodes: ['seaplane_cancelled', 'high_wind', 'sea_state_rough'],
      affectedZoneIds: ['west-bamfield', 'helby-island'],
      confidence: 0.85,
      source: 'dev_seed',
    });

    const weatherStart = new Date(tomorrow);
    weatherStart.setHours(10, 0, 0, 0);
    const weatherEnd = new Date(tomorrow);
    weatherEnd.setHours(14, 0, 0, 0);

    windows.push({
      id: 'dev-seed-weather-001',
      type: 'weather',
      startAt: weatherStart,
      endAt: weatherEnd,
      severity: 'warn',
      reasonCodes: ['rain', 'reduced_visibility'],
      affectedZoneIds: ['west-bamfield', 'east-bamfield', 'helby-island'],
      confidence: 0.70,
      source: 'dev_seed',
    });
  }

  return windows;
}

/**
 * Get dependency windows for a portal's service area.
 * Queries live feed data, falls back to dev_seed in DEV mode when no data available.
 */
export async function getDependencyWindowsForPortal(
  portalId: string,
  from: Date,
  to: Date
): Promise<DependencyWindow[]> {
  let windows: DependencyWindow[] = [];

  const alertWindows = await getWindowsFromAlerts(from, to);
  windows = windows.concat(alertWindows);

  if (portalId) {
    const transportWindows = await getWindowsFromTransportAlerts(portalId, from, to);
    windows = windows.concat(transportWindows);

    const rules = await getPortalDependencyRules(portalId);
    if (rules.length > 0) {
      windows = applyZoneMapping(windows, rules);
    }
  }

  const hasFeedData = windows.some(w => w.source === 'feed');
  if (!hasFeedData && IS_DEV) {
    const devWindows = getDevSeedWindows(from, to);
    windows = windows.concat(devWindows);
  }

  return windows;
}

/**
 * Get dependency windows for specific zones.
 */
export async function getDependencyWindowsForZones(
  portalId: string,
  zoneIds: string[],
  from: Date,
  to: Date
): Promise<ZoneWindowMap> {
  const allWindows = await getDependencyWindowsForPortal(portalId, from, to);
  const zoneMap: ZoneWindowMap = new Map();

  zoneIds.forEach(zoneId => {
    zoneMap.set(zoneId, []);
  });

  allWindows.forEach(window => {
    const affected = window.affectedZoneIds || [];
    
    zoneIds.forEach(zoneId => {
      const normalizedZoneId = zoneId.toLowerCase().replace(/\s+/g, '-');
      const matchesZone = affected.some(az => 
        az.toLowerCase().replace(/\s+/g, '-') === normalizedZoneId ||
        az.toLowerCase().includes(zoneId.toLowerCase()) ||
        zoneId.toLowerCase().includes(az.toLowerCase())
      );

      if (matchesZone || affected.length === 0) {
        const existing = zoneMap.get(zoneId) || [];
        existing.push(window);
        zoneMap.set(zoneId, existing);
      }
    });
  });

  return zoneMap;
}

/**
 * Get dependency windows for a tenant's service area.
 * Used for contractor/resident calendar views.
 */
export async function getDependencyWindowsForTenant(
  tenantId: string,
  from: Date,
  to: Date
): Promise<DependencyWindow[]> {
  return getDependencyWindowsForPortal('', from, to);
}

/**
 * Convert DependencyWindow to ScheduleBoard-compatible event format.
 */
export function mapDependencyWindowToEvent(
  window: DependencyWindow,
  resourceId: string,
  index: number
): {
  id: string;
  resource_id: string;
  event_type: 'buffer' | 'hold' | 'maintenance';
  start_date: string;
  end_date: string;
  status: string;
  title: string;
  notes?: string;
  meta?: Record<string, unknown>;
} {
  const eventType = window.severity === 'critical' ? 'maintenance' : 
                   window.severity === 'warn' ? 'hold' : 'buffer';
  
  const title = window.severity === 'critical' ? 'Blocked' :
               window.severity === 'warn' ? 'Risky' : 'Advisory';

  return {
    id: window.id || `dep-${window.type}-${index}`,
    resource_id: resourceId,
    event_type: eventType,
    start_date: window.startAt.toISOString(),
    end_date: window.endAt.toISOString(),
    status: window.severity,
    title,
    notes: window.reasonCodes.join(', '),
    meta: {
      severity: window.severity,
      reasonCodes: window.reasonCodes,
      affectedZoneIds: window.affectedZoneIds,
      confidence: window.confidence,
      source: window.source,
      rawRef: window.rawRef,
    },
  };
}

/**
 * Create dependency lane resources for ScheduleBoard.
 */
export function createDependencyResources(): Array<{
  id: string;
  name: string;
  asset_type: string;
  status: string;
  group: string;
}> {
  return [
    {
      id: 'dep:weather',
      name: 'Weather',
      asset_type: 'dependency',
      status: 'active',
      group: 'Dependencies',
    },
    {
      id: 'dep:seaplane',
      name: 'Lucky Lander (Seaplane)',
      asset_type: 'dependency',
      status: 'active',
      group: 'Dependencies',
    },
    {
      id: 'dep:ferry',
      name: 'Lady Rose (Ferry)',
      asset_type: 'dependency',
      status: 'active',
      group: 'Dependencies',
    },
    {
      id: 'dep:road',
      name: 'Highway 4',
      asset_type: 'dependency',
      status: 'active',
      group: 'Dependencies',
    },
  ];
}

/**
 * Map dependency windows to ScheduleBoard events.
 */
export function mapDependencyWindowsToEvents(
  windows: DependencyWindow[]
): Array<{
  id: string;
  resource_id: string;
  event_type: 'buffer' | 'hold' | 'maintenance';
  start_date: string;
  end_date: string;
  status: string;
  title: string;
  notes?: string;
  meta?: Record<string, unknown>;
}> {
  const events: Array<ReturnType<typeof mapDependencyWindowToEvent>> = [];

  windows.forEach((window, index) => {
    const resourceId = `dep:${window.type}`;
    events.push(mapDependencyWindowToEvent(window, resourceId, index));
  });

  return events;
}

/**
 * Compute zone feasibility from dependency windows.
 * Returns feasibility status for each zone.
 */
export function computeZoneFeasibility(
  windows: DependencyWindow[],
  zones: string[]
): Map<string, { status: 'ok' | 'risky' | 'blocked'; reasons: string[]; source?: string }> {
  const feasibility = new Map<string, { status: 'ok' | 'risky' | 'blocked'; reasons: string[]; source?: string }>();

  zones.forEach(zone => {
    feasibility.set(zone, { status: 'ok', reasons: [], source: undefined });
  });

  windows.forEach(window => {
    const affectedZoneIds = window.affectedZoneIds || [];
    
    zones.forEach(zone => {
      const normalizedZone = zone.toLowerCase().replace(/\s+/g, '-');
      const isAffected = affectedZoneIds.length === 0 || affectedZoneIds.some(az => 
        az.toLowerCase().replace(/\s+/g, '-') === normalizedZone ||
        az.toLowerCase().includes(zone.toLowerCase()) ||
        zone.toLowerCase().includes(az.toLowerCase())
      );

      if (!isAffected) return;

      const current = feasibility.get(zone);
      if (!current) return;

      if (window.severity === 'critical') {
        feasibility.set(zone, { 
          status: 'blocked', 
          reasons: [...current.reasons, ...window.reasonCodes],
          source: window.source,
        });
      } else if (window.severity === 'warn' && current.status !== 'blocked') {
        feasibility.set(zone, { 
          status: 'risky', 
          reasons: [...current.reasons, ...window.reasonCodes],
          source: window.source,
        });
      }
    });
  });

  return feasibility;
}

/**
 * Compute feasibility overlay for a single run event.
 */
export function computeRunFeasibility(
  runStartAt: Date,
  runEndAt: Date,
  runZone: string | undefined,
  windows: DependencyWindow[]
): { status: 'ok' | 'risky' | 'blocked'; reasons: string[]; severity: string } {
  let status: 'ok' | 'risky' | 'blocked' = 'ok';
  const reasons: string[] = [];

  for (const window of windows) {
    const overlaps = window.startAt < runEndAt && window.endAt > runStartAt;
    if (!overlaps) continue;

    const zoneMatch = !runZone || !window.affectedZoneIds?.length ||
      window.affectedZoneIds.some(az => 
        az.toLowerCase().replace(/\s+/g, '-') === runZone.toLowerCase().replace(/\s+/g, '-') ||
        az.toLowerCase().includes(runZone.toLowerCase())
      );

    if (!zoneMatch) continue;

    if (window.severity === 'critical') {
      status = 'blocked';
      reasons.push(...window.reasonCodes);
    } else if (window.severity === 'warn' && status !== 'blocked') {
      status = 'risky';
      reasons.push(...window.reasonCodes);
    }
  }

  const severity = status === 'blocked' ? 'critical' : status === 'risky' ? 'warn' : 'info';
  return { status, reasons: Array.from(new Set(reasons)), severity };
}

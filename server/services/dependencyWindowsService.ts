/**
 * N3-CAL-02: Dependency Windows Service
 * 
 * Provides dependency risk windows (weather, travel) for calendar feasibility overlays.
 * These windows affect zone feasibility and are used to mark runs as ok/risky/blocked.
 * 
 * IMPLEMENTATION STATUS:
 * - DEV/STUB MODE: Returns seeded test data for development/QA testing
 * - The DEV seed creates a seaplane critical window for tomorrow 12pm-6pm
 *   affecting West Bamfield and Helby Island zones (NOT East Bamfield)
 * 
 * PRODUCTION TODO: Integrate with real data sources:
 *   - Weather: cc_weather_observations + cc_weather_alerts tables
 *   - Ferry: BC Ferries API / cc_external_data_lake
 *   - Seaplane: Harbour Air status feed  
 *   - Highway: DriveBC road events / cc_road_events table
 */

import { db } from '../db';
import type { DependencyWindowDTO } from '@shared/schema';

const IS_DEV = process.env.NODE_ENV === 'development' || process.env.CC_DEV_SEED === 'true';

export interface DependencyWindow {
  type: 'weather' | 'ferry' | 'highway' | 'seaplane' | 'air';
  startAt: Date;
  endAt: Date;
  severity: 'info' | 'warn' | 'critical';
  reasonCodes: string[];
  affectedZones?: string[];
  confidence?: number;
}

/**
 * Get dependency windows for a portal's service area.
 * In DEV mode, includes seed windows for QA testing.
 */
export async function getDependencyWindowsForPortal(
  portalId: string,
  from: Date,
  to: Date
): Promise<DependencyWindow[]> {
  const windows: DependencyWindow[] = [];

  // TODO: Wire to existing weather/ferry/highway feed data when available
  // For now, return DEV seed windows for QA

  if (IS_DEV) {
    // DEV SEED: Create a seaplane critical window for tomorrow 12pm-6pm
    // Affects West Bamfield and Helby Island, NOT East Bamfield
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(18, 0, 0, 0);

    if (tomorrow >= from && tomorrow <= to) {
      windows.push({
        type: 'seaplane',
        startAt: tomorrow,
        endAt: tomorrowEnd,
        severity: 'critical',
        reasonCodes: ['high_wind', 'sea_state_rough'],
        affectedZones: ['West Bamfield', 'Helby Island'],
        confidence: 0.85,
      });

      // Add a weather warning window (less severe)
      const weatherStart = new Date(tomorrow);
      weatherStart.setHours(10, 0, 0, 0);
      const weatherEnd = new Date(tomorrow);
      weatherEnd.setHours(14, 0, 0, 0);

      windows.push({
        type: 'weather',
        startAt: weatherStart,
        endAt: weatherEnd,
        severity: 'warn',
        reasonCodes: ['rain', 'reduced_visibility'],
        affectedZones: ['West Bamfield', 'East Bamfield', 'Helby Island'],
        confidence: 0.70,
      });
    }
  }

  return windows;
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
  // For now, delegate to portal function with empty portal ID
  // In future, look up tenant's primary portal or service zones
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
    id: `dep-${window.type}-${index}`,
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
      affectedZones: window.affectedZones,
      confidence: window.confidence,
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
      id: 'dep:highway',
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
): Map<string, { status: 'ok' | 'risky' | 'blocked'; reasons: string[] }> {
  const feasibility = new Map<string, { status: 'ok' | 'risky' | 'blocked'; reasons: string[] }>();

  // Initialize all zones as OK
  zones.forEach(zone => {
    feasibility.set(zone, { status: 'ok', reasons: [] });
  });

  // Apply dependency windows
  windows.forEach(window => {
    const affectedZones = window.affectedZones || [];
    
    affectedZones.forEach(zone => {
      const current = feasibility.get(zone);
      if (!current) return;

      if (window.severity === 'critical') {
        feasibility.set(zone, { 
          status: 'blocked', 
          reasons: [...current.reasons, ...window.reasonCodes] 
        });
      } else if (window.severity === 'warn' && current.status !== 'blocked') {
        feasibility.set(zone, { 
          status: 'risky', 
          reasons: [...current.reasons, ...window.reasonCodes] 
        });
      }
    });
  });

  return feasibility;
}

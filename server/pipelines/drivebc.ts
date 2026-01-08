import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface DriveBCEvent {
  id: string;
  headline: string;
  description: string;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'UNKNOWN';
  eventType: string;
  eventSubtype: string;
  roads: Array<{ name: string; direction: string }>;
  latitude: number;
  longitude: number;
  created: string;
  updated: string;
  startTime: string;
  endTime: string | null;
}

export class DriveBCPipeline extends BasePipeline {
  constructor() {
    super('drivebc-cc_events', 'DriveBC Road Events', 300000); // 5 min rate limit
  }

  async fetch(): Promise<any> {
    console.log('[DriveBC] Fetching active road events...');
    
    // DriveBC Open511 API
    const response = await fetch(
      'https://api.open511.gov.bc.ca/cc_events?format=json&status=ACTIVE&limit=500',
      {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'CivOS Dashboard'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`DriveBC API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[DriveBC] Retrieved ${data.cc_events?.length || 0} cc_events`);
    return data;
  }

  transform(rawData: any): DriveBCEvent[] {
    const cc_events = rawData.cc_events || [];
    
    return cc_events.map((event: any) => {
      // Extract coordinates from geography
      let latitude = 0;
      let longitude = 0;
      
      if (event.geography?.coordinates) {
        const coords = event.geography.coordinates;
        if (event.geography.type === 'Point') {
          longitude = coords[0] || 0;
          latitude = coords[1] || 0;
        } else if (event.geography.type === 'LineString' && coords.length > 0) {
          // Use midpoint for LineString
          const midIdx = Math.floor(coords.length / 2);
          longitude = coords[midIdx]?.[0] || coords[0]?.[0] || 0;
          latitude = coords[midIdx]?.[1] || coords[0]?.[1] || 0;
        }
      }
      
      // Parse schedule for start/end times
      let startTime = event.created || new Date().toISOString();
      let endTime: string | null = null;
      
      if (event.schedule?.intervals?.length > 0) {
        const interval = event.schedule.intervals[0];
        const parts = interval.split('/');
        if (parts[0]) startTime = parts[0];
        if (parts[1]) endTime = parts[1];
      }
      
      // Map severity
      let severity: DriveBCEvent['severity'] = 'UNKNOWN';
      const severityStr = (event.severity || '').toUpperCase();
      if (['MINOR', 'MODERATE', 'MAJOR'].includes(severityStr)) {
        severity = severityStr as DriveBCEvent['severity'];
      }
      
      // Extract roads
      const roads = (event.roads || []).map((r: any) => ({
        name: r.name || 'Unknown Road',
        direction: r.direction || 'BOTH'
      }));
      
      return {
        id: event.id || `drivebc-${Date.now()}`,
        headline: event.headline || '',
        description: event.description || '',
        severity,
        eventType: event.event_type || 'UNKNOWN',
        eventSubtype: event.event_subtypes?.[0] || '',
        roads,
        latitude,
        longitude,
        created: event.created || new Date().toISOString(),
        updated: event.updated || new Date().toISOString(),
        startTime,
        endTime
      };
    });
  }

  async load(cc_events: DriveBCEvent[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    // Get all active DriveBC cc_alerts to track which ones to deactivate
    const activeAlerts = await pool.query(
      `SELECT source_key FROM cc_alerts WHERE alert_type = 'closure' AND is_active = true`
    );
    const activeSourceKeys = new Set(activeAlerts.rows.map(r => r.source_key));
    const processedKeys = new Set<string>();

    for (const event of cc_events) {
      const sourceKey = `drivebc-${event.id}`;
      processedKeys.add(sourceKey);
      
      // Find nearest region based on coordinates
      let regionId: string | null = null;
      if (event.latitude && event.longitude) {
        const regionResult = await pool.query(`
          SELECT id FROM cc_geo_regions 
          WHERE centroid_lat IS NOT NULL 
          AND centroid_lon IS NOT NULL
          ORDER BY 
            SQRT(POWER(centroid_lat - $1, 2) + POWER(centroid_lon - $2, 2))
          LIMIT 1
        `, [event.latitude, event.longitude]);
        
        if (regionResult.rows.length > 0) {
          regionId = regionResult.rows[0].id;
        }
      }

      // Map severity to alert severity enum (using valid severity_level values)
      let alertSeverity = 'warning';
      if (event.severity === 'MINOR') alertSeverity = 'minor';
      else if (event.severity === 'MAJOR') alertSeverity = 'major';
      
      // Build road names for title
      const roadNames = event.roads.map(r => r.name).join(', ');
      const title = event.headline || `${event.eventType}: ${roadNames}`;

      // Check if alert already exists
      const existing = await pool.query(
        `SELECT id FROM cc_alerts WHERE source_key = $1`,
        [sourceKey]
      );

      const details = {
        event_id: event.id,
        event_type: event.eventType,
        event_subtype: event.eventSubtype,
        roads: event.roads,
        description: event.description,
        drivebc_severity: event.severity,
        start_time: event.startTime,
        end_time: event.endTime
      };

      if (existing.rows.length > 0) {
        // Update existing alert
        await pool.query(`
          UPDATE cc_alerts SET
            title = $2,
            summary = $3,
            message = $4,
            severity = $5::severity_level,
            latitude = $6,
            longitude = $7,
            region_id = $8,
            details = $9::jsonb,
            effective_until = $10,
            updated_at = NOW(),
            is_active = true
          WHERE source_key = $1
        `, [
          sourceKey,
          title.substring(0, 255),
          event.headline.substring(0, 255),
          event.description,
          alertSeverity,
          event.latitude || null,
          event.longitude || null,
          regionId,
          JSON.stringify(details),
          event.endTime ? new Date(event.endTime) : null
        ]);
        updated++;
      } else {
        // Create new alert
        await pool.query(`
          INSERT INTO cc_alerts (
            alert_type, severity, signal_type, title, summary, message,
            latitude, longitude, region_id, details,
            effective_from, effective_until, is_active,
            source_key, source_url, observed_at
          ) VALUES (
            'closure', $1::severity_level, 'drivebc', $2, $3, $4,
            $5, $6, $7, $8::jsonb,
            $9, $10, true,
            $11, $12, NOW()
          )
        `, [
          alertSeverity,
          title.substring(0, 255),
          event.headline.substring(0, 255),
          event.description,
          event.latitude || null,
          event.longitude || null,
          regionId,
          JSON.stringify(details),
          new Date(event.startTime),
          event.endTime ? new Date(event.endTime) : null,
          sourceKey,
          `https://www.drivebc.ca/cc_events/${event.id}`
        ]);
        created++;
      }
    }

    // Deactivate cc_alerts that are no longer in the feed
    const toDeactivate = [...activeSourceKeys].filter(k => !processedKeys.has(k));
    if (toDeactivate.length > 0) {
      await pool.query(`
        UPDATE cc_alerts SET 
          is_active = false,
          resolved_at = NOW()
        WHERE source_key = ANY($1)
      `, [toDeactivate]);
      console.log(`[DriveBC] Deactivated ${toDeactivate.length} resolved cc_events`);
    }

    console.log(`[DriveBC] Created: ${created}, Updated: ${updated}`);
    return { created, updated };
  }
}

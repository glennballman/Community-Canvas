import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface DriveBCEvent {
  id: string;
  headline: string;
  description: string;
  severity: string;
  eventType: string;
  roads: string[];
  latitude: number;
  longitude: number;
  created: string;
  lastUpdated: string;
}

export class DriveBCPipeline extends BasePipeline {
  constructor() {
    super('drivebc-events', 'DriveBC Road Events', 300000); // 5 min rate limit
  }

  async fetch(): Promise<any> {
    // DriveBC Open511 API
    const response = await fetch(
      'https://api.open511.gov.bc.ca/events?format=json&status=ACTIVE&limit=500',
      {
        headers: { 'Accept': 'application/json' }
      }
    );
    
    if (!response.ok) {
      throw new Error(`DriveBC API error: ${response.status}`);
    }
    
    return response.json();
  }

  transform(rawData: any): DriveBCEvent[] {
    const events = rawData.events || [];
    
    return events.map((event: any) => {
      const coords = event.geography?.coordinates || [0, 0];
      const roads = (event.roads || []).map((r: any) => r.name).filter(Boolean);
      
      return {
        id: event.id,
        headline: event.headline || '',
        description: event.description || '',
        severity: event.severity || 'UNKNOWN',
        eventType: event.event_type || 'UNKNOWN',
        roads,
        latitude: coords[1] || 0,
        longitude: coords[0] || 0,
        created: event.created,
        lastUpdated: event.updated
      };
    });
  }

  async load(events: DriveBCEvent[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const event of events) {
      const slug = `drivebc-event-${event.id}`;
      
      // Check if entity exists
      const existing = await pool.query(
        'SELECT id FROM entities WHERE slug = $1',
        [slug]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await pool.query(`
          UPDATE entities SET
            name = $2,
            configuration = configuration || $3::jsonb
          WHERE slug = $1
        `, [
          slug,
          event.headline.substring(0, 255),
          JSON.stringify({
            description: event.description,
            severity: event.severity,
            event_type: event.eventType,
            roads: event.roads,
            last_updated: event.lastUpdated
          })
        ]);
        updated++;
      } else {
        // Create new
        await pool.query(`
          INSERT INTO entities (slug, name, entity_type_id, latitude, longitude, configuration)
          VALUES ($1, $2, 'road-event', $3, $4, $5)
        `, [
          slug,
          event.headline.substring(0, 255),
          event.latitude,
          event.longitude,
          JSON.stringify({
            drivebc_id: event.id,
            description: event.description,
            severity: event.severity,
            event_type: event.eventType,
            roads: event.roads,
            created: event.created,
            last_updated: event.lastUpdated
          })
        ]);
        created++;
      }
    }

    return { created, updated };
  }
}

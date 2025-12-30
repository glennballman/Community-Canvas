import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface Earthquake {
  eventId: string;
  magnitude: number;
  depth: number;
  location: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  felt: boolean;
}

export class EarthquakesPipeline extends BasePipeline {
  constructor() {
    super('earthquakes-canada', 'Earthquakes Canada', 600000); // 10 min
  }

  async fetch(): Promise<any> {
    // Earthquakes Canada GeoJSON feed for BC region
    // Bounding box roughly covers BC
    const minLat = 48.0;
    const maxLat = 60.0;
    const minLon = -140.0;
    const maxLon = -114.0;
    
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=${minLat}&maxlatitude=${maxLat}&minlongitude=${minLon}&maxlongitude=${maxLon}&minmagnitude=2.0&orderby=time&limit=50`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Earthquake API error: ${response.status}`);
    }
    
    return response.json();
  }

  transform(rawData: any): Earthquake[] {
    const features = rawData.features || [];
    
    return features.map((f: any) => {
      const props = f.properties || {};
      const coords = f.geometry?.coordinates || [0, 0, 0];
      
      return {
        eventId: f.id || props.code || `eq-${Date.now()}`,
        magnitude: props.mag || 0,
        depth: coords[2] || 0,
        location: props.place || 'Unknown location',
        latitude: coords[1] || 0,
        longitude: coords[0] || 0,
        timestamp: props.time ? new Date(props.time).toISOString() : new Date().toISOString(),
        felt: props.felt > 0
      };
    });
  }

  async load(earthquakes: Earthquake[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const eq of earthquakes) {
      const slug = `earthquake-${eq.eventId}`;
      
      const existing = await pool.query(
        'SELECT id FROM entities WHERE slug = $1',
        [slug]
      );

      const config = {
        event_id: eq.eventId,
        magnitude: eq.magnitude,
        depth_km: eq.depth,
        location_text: eq.location,
        event_time: eq.timestamp,
        felt_reports: eq.felt,
        last_updated: new Date().toISOString()
      };

      if (existing.rows.length > 0) {
        await pool.query(`
          UPDATE entities SET
            configuration = $2::jsonb
          WHERE slug = $1
        `, [slug, JSON.stringify(config)]);
        updated++;
      } else {
        await pool.query(`
          INSERT INTO entities (slug, name, entity_type_id, latitude, longitude, configuration)
          VALUES ($1, $2, 'earthquake', $3, $4, $5)
        `, [
          slug,
          `M${eq.magnitude.toFixed(1)} - ${eq.location}`.substring(0, 255),
          eq.latitude,
          eq.longitude,
          JSON.stringify(config)
        ]);
        created++;
      }
    }

    return { created, updated };
  }
}

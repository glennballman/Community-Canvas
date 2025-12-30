import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface PowerOutage {
  outageId: string;
  region: string;
  municipality: string;
  customersAffected: number;
  cause: string;
  crewStatus: string;
  estimatedRestoration: string;
  latitude: number;
  longitude: number;
}

export class BCHydroPipeline extends BasePipeline {
  constructor() {
    super('bchydro-outages', 'BC Hydro Outages', 300000); // 5 min
  }

  async fetch(): Promise<any> {
    // BC Hydro outage map data
    const response = await fetch(
      'https://www.bchydro.com/power-outages/app/outage-map-data.json',
      {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'CivOS Dashboard'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`BC Hydro API error: ${response.status}`);
    }
    
    return response.json();
  }

  transform(rawData: any): PowerOutage[] {
    const outages: PowerOutage[] = [];
    
    // BC Hydro returns regions with outages
    const regions = rawData.regions || [];
    
    for (const region of regions) {
      for (const outage of region.outages || []) {
        outages.push({
          outageId: outage.id || `${region.name}-${Date.now()}`,
          region: region.name || '',
          municipality: outage.municipality || outage.area || '',
          customersAffected: outage.numCustomersOut || 0,
          cause: outage.cause || 'Unknown',
          crewStatus: outage.crewStatus || 'Unknown',
          estimatedRestoration: outage.dateOff || '',
          latitude: outage.latitude || 0,
          longitude: outage.longitude || 0
        });
      }
    }
    
    return outages;
  }

  async load(outages: PowerOutage[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    // First, mark all existing outages as potentially resolved
    await pool.query(`
      UPDATE entities 
      SET configuration = configuration || '{"status": "checking"}'::jsonb
      WHERE entity_type_id = 'power-outage'
      AND configuration->>'status' = 'active'
    `);

    for (const outage of outages) {
      const slug = `bchydro-outage-${outage.outageId}`;
      
      const existing = await pool.query(
        'SELECT id FROM entities WHERE slug = $1',
        [slug]
      );

      const config = {
        outage_id: outage.outageId,
        region: outage.region,
        customers_affected: outage.customersAffected,
        cause: outage.cause,
        crew_status: outage.crewStatus,
        estimated_restoration: outage.estimatedRestoration,
        status: 'active',
        last_updated: new Date().toISOString()
      };

      if (existing.rows.length > 0) {
        await pool.query(`
          UPDATE entities SET
            name = $2,
            configuration = $3::jsonb
          WHERE slug = $1
        `, [
          slug,
          `Power Outage: ${outage.municipality}`.substring(0, 255),
          JSON.stringify(config)
        ]);
        updated++;
      } else {
        await pool.query(`
          INSERT INTO entities (slug, name, entity_type_id, latitude, longitude, city, configuration)
          VALUES ($1, $2, 'power-outage', $3, $4, $5, $6)
        `, [
          slug,
          `Power Outage: ${outage.municipality}`.substring(0, 255),
          outage.latitude,
          outage.longitude,
          outage.municipality,
          JSON.stringify(config)
        ]);
        created++;
      }
    }

    // Mark outages not in current data as resolved
    await pool.query(`
      UPDATE entities 
      SET configuration = configuration || '{"status": "resolved", "resolved_at": "${new Date().toISOString()}"}'::jsonb
      WHERE entity_type_id = 'power-outage'
      AND configuration->>'status' = 'checking'
    `);

    return { created, updated };
  }
}

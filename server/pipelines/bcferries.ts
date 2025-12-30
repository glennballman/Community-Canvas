import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface FerryRoute {
  routeCode: string;
  routeName: string;
  departureTerminal: string;
  arrivalTerminal: string;
  sailingStatus: string;
  percentFull: number;
  nextSailing: string;
  vehicleWait: string;
}

export class BCFerriesPipeline extends BasePipeline {
  constructor() {
    super('bcferries-conditions', 'BC Ferries Current Conditions', 300000); // 5 min
  }

  async fetch(): Promise<any> {
    // BC Ferries doesn't have a public API, so we'll use a scraping approach
    // For now, return mock structure - in production would use Firecrawl
    const response = await fetch('https://www.bcferries.com/current-conditions', {
      headers: { 'Accept': 'text/html' }
    });
    
    if (!response.ok) {
      throw new Error(`BC Ferries fetch error: ${response.status}`);
    }
    
    // In real implementation, parse HTML or use Firecrawl
    return { routes: [] };
  }

  transform(rawData: any): FerryRoute[] {
    // Transform scraped data to normalized format
    const routes = rawData.routes || [];
    return routes;
  }

  async load(routes: FerryRoute[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const route of routes) {
      const slug = `bcferries-route-${route.routeCode}`.toLowerCase();
      
      const existing = await pool.query(
        'SELECT id FROM entities WHERE slug = $1',
        [slug]
      );

      if (existing.rows.length > 0) {
        await pool.query(`
          UPDATE entities SET
            configuration = configuration || $2::jsonb
          WHERE slug = $1
        `, [
          slug,
          JSON.stringify({
            sailing_status: route.sailingStatus,
            percent_full: route.percentFull,
            next_sailing: route.nextSailing,
            vehicle_wait: route.vehicleWait,
            last_updated: new Date().toISOString()
          })
        ]);
        updated++;
      }
    }

    return { created, updated };
  }
}

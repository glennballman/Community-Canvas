import FirecrawlApp from "@mendable/firecrawl-js";
import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface FerrySailing {
  route: string;
  departureTerminal: string;
  arrivalTerminal: string;
  nextSailing: string;
  status: 'on_time' | 'delayed' | 'cancelled' | 'unknown';
  delayMinutes: number;
  vehicleCapacityPct: number;
  passengerCapacityPct: number;
  advisory: string | null;
}

interface FerryRouteData {
  routeName: string;
  departureTerminal: string;
  arrivalTerminal: string;
  sailings: Array<{
    departureTime: string;
    status: string;
    vehiclePercentFull: number;
    passengerPercentFull: number;
  }>;
  advisory: string | null;
}

export class BCFerriesPipeline extends BasePipeline {
  private firecrawl: FirecrawlApp;

  constructor() {
    super('bcferries-conditions', 'BC Ferries Current Conditions', 600000); // 10 min
    this.firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
  }

  async fetch(): Promise<any> {
    console.log('[BCFerries] Fetching current conditions via Firecrawl...');
    
    try {
      const result = await this.firecrawl.scrapeUrl(
        'https://www.bcferries.com/current-conditions/',
        {
          formats: ['extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                routes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      routeName: { type: 'string', description: 'Full route name like "Tsawwassen - Swartz Bay"' },
                      departureTerminal: { type: 'string', description: 'Departure terminal name' },
                      arrivalTerminal: { type: 'string', description: 'Arrival terminal name' },
                      nextDeparture: { type: 'string', description: 'Next departure time' },
                      status: { type: 'string', description: 'Status: on time, delayed, cancelled' },
                      vehiclePercentFull: { type: 'number', description: 'Vehicle deck capacity percentage 0-100' },
                      passengerPercentFull: { type: 'number', description: 'Passenger capacity percentage 0-100' },
                      delayMinutes: { type: 'number', description: 'Delay in minutes if delayed' },
                      advisory: { type: 'string', description: 'Any weather or service advisory' }
                    },
                    required: ['routeName']
                  }
                },
                generalAdvisory: { type: 'string', description: 'Any general advisory message for all routes' }
              },
              required: ['routes']
            },
            prompt: 'Extract all BC Ferries route information including sailing times, status (on time/delayed/cancelled), vehicle and passenger capacity percentages, and any advisories. Include all routes shown on the current conditions page.'
          }
        }
      );

      const extracted = (result as any).extract;
      console.log(`[BCFerries] Extracted ${extracted?.routes?.length || 0} routes`);
      return extracted || { routes: [] };
    } catch (error) {
      console.error('[BCFerries] Firecrawl error:', error);
      throw error;
    }
  }

  transform(rawData: any): FerrySailing[] {
    const routes = rawData.routes || [];
    const sailings: FerrySailing[] = [];

    for (const route of routes) {
      if (!route.routeName) continue;

      // Parse route name to get terminals
      const parts = route.routeName.split(/\s*[-–]\s*/);
      const departureTerminal = route.departureTerminal || parts[0]?.trim() || 'Unknown';
      const arrivalTerminal = route.arrivalTerminal || parts[1]?.trim() || 'Unknown';

      // Normalize status
      let status: FerrySailing['status'] = 'unknown';
      const statusStr = (route.status || '').toLowerCase();
      if (statusStr.includes('on time') || statusStr.includes('ontime')) {
        status = 'on_time';
      } else if (statusStr.includes('delay')) {
        status = 'delayed';
      } else if (statusStr.includes('cancel')) {
        status = 'cancelled';
      }

      sailings.push({
        route: route.routeName,
        departureTerminal,
        arrivalTerminal,
        nextSailing: route.nextDeparture || '',
        status,
        delayMinutes: route.delayMinutes || 0,
        vehicleCapacityPct: route.vehiclePercentFull || 0,
        passengerCapacityPct: route.passengerPercentFull || 0,
        advisory: route.advisory || rawData.generalAdvisory || null
      });
    }

    return sailings;
  }

  async load(sailings: FerrySailing[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const sailing of sailings) {
      // Find matching ferry terminal entities
      const terminalQuery = await pool.query(`
        SELECT id, name FROM entities 
        WHERE entity_type_id = 'ferry-terminal'
        AND (
          LOWER(name) LIKE $1 
          OR LOWER(name) LIKE $2
          OR LOWER(configuration->>'terminal_name') LIKE $1
          OR LOWER(configuration->>'terminal_name') LIKE $2
        )
        LIMIT 2
      `, [
        `%${sailing.departureTerminal.toLowerCase()}%`,
        `%${sailing.arrivalTerminal.toLowerCase()}%`
      ]);

      // Create snapshot data
      const snapshotData = {
        route: sailing.route,
        next_sailing: sailing.nextSailing,
        status: sailing.status,
        delay_minutes: sailing.delayMinutes,
        vehicle_capacity_pct: sailing.vehicleCapacityPct,
        passenger_capacity_pct: sailing.passengerCapacityPct,
        advisory: sailing.advisory,
        fetched_at: new Date().toISOString()
      };

      // Create alerts for delays or cancellations
      let alerts = null;
      if (sailing.status === 'cancelled') {
        alerts = [{
          type: 'cancellation',
          severity: 'high',
          message: `Route ${sailing.route} sailing cancelled`,
          timestamp: new Date().toISOString()
        }];
      } else if (sailing.status === 'delayed' && sailing.delayMinutes > 30) {
        alerts = [{
          type: 'delay',
          severity: 'medium',
          message: `Route ${sailing.route} delayed ${sailing.delayMinutes} minutes`,
          timestamp: new Date().toISOString()
        }];
      }

      // Update terminal entities with latest status
      // Note: entity_snapshots table uses integer IDs but entities uses UUID, so we skip snapshot saving
      for (const terminal of terminalQuery.rows) {
        await pool.query(`
          UPDATE entities SET
            configuration = configuration || $2::jsonb
          WHERE id = $1
        `, [
          terminal.id,
          JSON.stringify({
            current_status: sailing.status,
            current_route: sailing.route,
            last_updated: new Date().toISOString(),
            vehicle_capacity_pct: sailing.vehicleCapacityPct,
            passenger_capacity_pct: sailing.passengerCapacityPct,
            has_advisory: !!sailing.advisory,
            advisory: sailing.advisory,
            next_sailing: sailing.nextSailing,
            delay_minutes: sailing.delayMinutes
          })
        ]);
        updated++;
      }

      // Also create/update a route-level entity
      const routeSlug = `bcferries-route-${sailing.route.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const existingRoute = await pool.query(
        'SELECT id FROM entities WHERE slug = $1',
        [routeSlug]
      );

      if (existingRoute.rows.length === 0) {
        // Create route entity
        await pool.query(`
          INSERT INTO entities (slug, name, entity_type_id, configuration)
          VALUES ($1, $2, 'ferry-route', $3)
        `, [
          routeSlug,
          `BC Ferries: ${sailing.route}`,
          JSON.stringify({
            departure_terminal: sailing.departureTerminal,
            arrival_terminal: sailing.arrivalTerminal,
            current_status: sailing.status,
            next_sailing: sailing.nextSailing,
            vehicle_capacity_pct: sailing.vehicleCapacityPct,
            passenger_capacity_pct: sailing.passengerCapacityPct,
            advisory: sailing.advisory,
            last_updated: new Date().toISOString()
          })
        ]);
        created++;
      } else {
        // Update existing route
        await pool.query(`
          UPDATE entities SET
            configuration = configuration || $2::jsonb
          WHERE slug = $1
        `, [
          routeSlug,
          JSON.stringify({
            current_status: sailing.status,
            next_sailing: sailing.nextSailing,
            vehicle_capacity_pct: sailing.vehicleCapacityPct,
            passenger_capacity_pct: sailing.passengerCapacityPct,
            advisory: sailing.advisory,
            last_updated: new Date().toISOString()
          })
        ]);
        updated++;
      }
    }

    console.log(`[BCFerries] Processed ${sailings.length} routes`);
    return { created, updated };
  }
}

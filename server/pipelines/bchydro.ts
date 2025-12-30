import FirecrawlApp from "@mendable/firecrawl-js";
import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface PowerOutage {
  outageId: string;
  region: string;
  municipality: string;
  area: string;
  customersAffected: number;
  cause: string;
  crewStatus: string;
  estimatedRestoration: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'active' | 'restored';
  outageStart: string;
}

export class BCHydroPipeline extends BasePipeline {
  private firecrawl: FirecrawlApp;

  constructor() {
    super('bchydro-outages', 'BC Hydro Outages', 300000); // 5 min
    this.firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
  }

  async fetch(): Promise<any> {
    console.log('[BCHydro] Fetching outage data via Firecrawl...');
    
    try {
      const result = await this.firecrawl.scrapeUrl(
        'https://www.bchydro.com/power-outages/app/outage-list-planned.html',
        {
          formats: ['extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                outages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      region: { type: 'string', description: 'Region name (e.g., Lower Mainland, Vancouver Island)' },
                      municipality: { type: 'string', description: 'City or municipality name' },
                      area: { type: 'string', description: 'Specific area or neighborhood affected' },
                      customersAffected: { type: 'number', description: 'Number of customers without power' },
                      cause: { type: 'string', description: 'Cause of outage if known (e.g., tree on line, equipment failure)' },
                      crewStatus: { type: 'string', description: 'Status of repair crews (e.g., On site, En route, Investigating)' },
                      estimatedRestoration: { type: 'string', description: 'Estimated time power will be restored' },
                      outageStart: { type: 'string', description: 'When the outage started' },
                      outageId: { type: 'string', description: 'Unique identifier for this outage if available' }
                    },
                    required: ['municipality', 'customersAffected']
                  }
                },
                totalOutages: { type: 'number', description: 'Total number of active outages' },
                totalCustomersAffected: { type: 'number', description: 'Total customers without power' }
              },
              required: ['outages']
            },
            prompt: 'Extract all current power outages listed on this page. For each outage, get the region, municipality/city, area affected, number of customers affected, cause (if known), crew status, estimated restoration time, and when the outage started.'
          }
        }
      );

      const extracted = (result as any).extract;
      console.log(`[BCHydro] Extracted ${extracted?.outages?.length || 0} outages`);
      return extracted || { outages: [] };
    } catch (error) {
      console.error('[BCHydro] Firecrawl error:', error);
      // Return empty if scraping fails
      return { outages: [] };
    }
  }

  transform(rawData: any): PowerOutage[] {
    const outages: PowerOutage[] = [];
    
    for (const outage of rawData.outages || []) {
      if (!outage.municipality && !outage.area) continue;
      
      // Generate unique ID
      const outageId = outage.outageId || 
        `bchydro-${(outage.municipality || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      outages.push({
        outageId,
        region: outage.region || 'Unknown',
        municipality: outage.municipality || 'Unknown',
        area: outage.area || outage.municipality || 'Unknown',
        customersAffected: outage.customersAffected || 0,
        cause: outage.cause || 'Under investigation',
        crewStatus: outage.crewStatus || 'Unknown',
        estimatedRestoration: outage.estimatedRestoration || null,
        latitude: null, // Will be geocoded from municipality
        longitude: null,
        status: 'active',
        outageStart: outage.outageStart || new Date().toISOString()
      });
    }
    
    return outages;
  }

  async load(outages: PowerOutage[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    // Get all active BC Hydro alerts to track which ones to deactivate
    const activeAlerts = await pool.query(
      `SELECT source_key FROM alerts WHERE alert_type = 'outage' AND is_active = true`
    );
    const activeSourceKeys = new Set(activeAlerts.rows.map(r => r.source_key));
    const processedKeys = new Set<string>();

    for (const outage of outages) {
      const sourceKey = `bchydro-${outage.outageId}`;
      processedKeys.add(sourceKey);
      
      // Determine severity based on customers affected
      // Using valid severity_level enum values: minor, warning, major
      let severity: 'minor' | 'warning' | 'major' = 'minor';
      if (outage.customersAffected >= 1000) {
        severity = 'major';
      } else if (outage.customersAffected >= 100) {
        severity = 'warning';
      }

      // Find matching region
      let regionId: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      const regionResult = await pool.query(`
        SELECT id, centroid_lat, centroid_lon FROM geo_regions 
        WHERE LOWER(name) LIKE $1 
        AND region_type IN ('municipality', 'regional-district')
        LIMIT 1
      `, [`%${outage.municipality.toLowerCase()}%`]);
      
      if (regionResult.rows.length > 0) {
        regionId = regionResult.rows[0].id;
        latitude = regionResult.rows[0].centroid_lat;
        longitude = regionResult.rows[0].centroid_lon;
      }

      const title = `Power outage affecting ${outage.customersAffected.toLocaleString()} customers in ${outage.area}`;
      
      const details = {
        outage_id: outage.outageId,
        region: outage.region,
        municipality: outage.municipality,
        area: outage.area,
        customers_affected: outage.customersAffected,
        cause: outage.cause,
        crew_status: outage.crewStatus,
        estimated_restoration: outage.estimatedRestoration,
        outage_start: outage.outageStart
      };

      // Check if alert already exists
      const existing = await pool.query(
        `SELECT id FROM alerts WHERE source_key = $1`,
        [sourceKey]
      );

      // Parse dates safely
      let effectiveUntil: Date | null = null;
      try {
        if (outage.estimatedRestoration && !outage.estimatedRestoration.includes('NaN')) {
          effectiveUntil = new Date(outage.estimatedRestoration);
          if (isNaN(effectiveUntil.getTime())) effectiveUntil = null;
        }
      } catch (e) {
        // Use null if date parsing fails
      }

      if (existing.rows.length > 0) {
        // Update existing alert
        await pool.query(`
          UPDATE alerts SET
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
          `${outage.cause}. Crew: ${outage.crewStatus}`.substring(0, 255),
          `Power outage in ${outage.area}, ${outage.municipality}. Cause: ${outage.cause}. Crew status: ${outage.crewStatus}. Estimated restoration: ${outage.estimatedRestoration || 'Unknown'}.`,
          severity,
          latitude,
          longitude,
          regionId,
          JSON.stringify(details),
          effectiveUntil
        ]);
        updated++;
      } else {
        // Create new alert - parse effectiveFrom safely
        let effectiveFrom = new Date();
        try {
          if (outage.outageStart && !outage.outageStart.includes('NaN')) {
            effectiveFrom = new Date(outage.outageStart);
            if (isNaN(effectiveFrom.getTime())) effectiveFrom = new Date();
          }
        } catch (e) {
          // Use current time if date parsing fails
        }
        
        await pool.query(`
          INSERT INTO alerts (
            alert_type, severity, signal_type, title, summary, message,
            latitude, longitude, region_id, details,
            effective_from, effective_until, is_active,
            source_key, source_url, observed_at
          ) VALUES (
            'outage', $1::severity_level, 'bchydro', $2, $3, $4,
            $5, $6, $7, $8::jsonb,
            $9, $10, true,
            $11, 'https://www.bchydro.com/power-outages/app/outage-map.html', NOW()
          )
        `, [
          severity,
          title.substring(0, 255),
          `${outage.cause}. Crew: ${outage.crewStatus}`.substring(0, 255),
          `Power outage in ${outage.area}, ${outage.municipality}. Cause: ${outage.cause}. Crew status: ${outage.crewStatus}. Estimated restoration: ${outage.estimatedRestoration || 'Unknown'}.`,
          latitude,
          longitude,
          regionId,
          JSON.stringify(details),
          effectiveFrom,
          effectiveUntil,
          sourceKey
        ]);
        created++;
      }
    }

    // Resolve outages that are no longer in the feed
    const toResolve = [...activeSourceKeys].filter(k => !processedKeys.has(k));
    if (toResolve.length > 0) {
      await pool.query(`
        UPDATE alerts SET 
          is_active = false,
          resolved_at = NOW(),
          details = details || '{"status": "restored"}'::jsonb
        WHERE source_key = ANY($1)
      `, [toResolve]);
      console.log(`[BCHydro] Resolved ${toResolve.length} restored outages`);
    }

    console.log(`[BCHydro] Created: ${created}, Updated: ${updated}`);
    return { created, updated };
  }
}

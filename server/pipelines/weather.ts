import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface WeatherObservation {
  stationId: string;
  stationName: string;
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  windDirection: string | null;
  windGustKmh: number | null;
  condition: string | null;
  visibilityKm: number | null;
  pressureKpa: number | null;
  dewpointC: number | null;
  observedAt: string;
}

interface WeatherAlert {
  title: string;
  description: string;
  type: string;
  severity: 'minor' | 'warning' | 'major';
  effectiveFrom: string;
  effectiveUntil: string | null;
  stationId: string;
}

// BC weather station IDs from Environment Canada citypage
const BC_STATIONS: Array<{ id: string; name: string; city: string }> = [
  { id: 's0000141', name: 'Vancouver', city: 'Vancouver' },
  { id: 's0000780', name: 'Victoria', city: 'Victoria' },
  { id: 's0000568', name: 'Kelowna', city: 'Kelowna' },
  { id: 's0000039', name: 'Kamloops', city: 'Kamloops' },
  { id: 's0000645', name: 'Prince George', city: 'Prince George' },
  { id: 's0000779', name: 'Nanaimo', city: 'Nanaimo' },
  { id: 's0000067', name: 'Abbotsford', city: 'Abbotsford' },
  { id: 's0000769', name: 'Whistler', city: 'Whistler' },
  { id: 's0000102', name: 'Cranbrook', city: 'Cranbrook' },
  { id: 's0000683', name: 'Prince Rupert', city: 'Prince Rupert' },
  { id: 's0000208', name: 'Penticton', city: 'Penticton' },
  { id: 's0000566', name: 'Vernon', city: 'Vernon' },
  { id: 's0000196', name: 'Nelson', city: 'Nelson' },
  { id: 's0000197', name: 'Revelstoke', city: 'Revelstoke' },
  { id: 's0000785', name: 'Campbell River', city: 'Campbell River' },
  { id: 's0000786', name: 'Courtenay', city: 'Courtenay' },
  { id: 's0000106', name: 'Dawson Creek', city: 'Dawson Creek' },
  { id: 's0000179', name: 'Fort St. John', city: 'Fort St. John' },
  { id: 's0000232', name: 'Terrace', city: 'Terrace' },
  { id: 's0000798', name: 'Tofino', city: 'Tofino' },
];

export class WeatherPipeline extends BasePipeline {
  constructor() {
    super('eccc-weather', 'Environment Canada Weather', 600000); // 10 min
  }

  async fetch(): Promise<any> {
    console.log('[Weather] Fetching BC weather data...');
    
    const observations: any[] = [];
    const alerts: any[] = [];
    
    for (const station of BC_STATIONS) {
      try {
        const url = `https://dd.weather.gc.ca/citypage_weather/xml/BC/${station.id}_e.xml`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/xml' }
        });
        
        if (response.ok) {
          const xml = await response.text();
          observations.push({ 
            stationId: station.id, 
            stationName: station.name,
            city: station.city,
            xml 
          });
        }
      } catch (e) {
        console.log(`[Weather] Failed to fetch ${station.name}: ${e}`);
      }
    }
    
    console.log(`[Weather] Fetched ${observations.length} station observations`);
    return { observations, alerts };
  }

  transform(rawData: any): { observations: WeatherObservation[]; alerts: WeatherAlert[] } {
    const observations: WeatherObservation[] = [];
    const alerts: WeatherAlert[] = [];
    
    for (const obs of rawData.observations || []) {
      const xml = obs.xml || '';
      
      // Parse current conditions from XML
      const tempMatch = xml.match(/<temperature.*?unitType="metric"[^>]*>([-\d.]+)</);
      const humidityMatch = xml.match(/<relativeHumidity.*?>([\d.]+)</);
      const windSpeedMatch = xml.match(/<speed.*?unitType="metric"[^>]*>([\d.]+)</);
      const windDirMatch = xml.match(/<direction>(.*?)<\/direction>/);
      const windGustMatch = xml.match(/<gust.*?unitType="metric"[^>]*>([\d.]+)</);
      const conditionMatch = xml.match(/<condition>(.*?)<\/condition>/);
      const visibilityMatch = xml.match(/<visibility.*?unitType="metric"[^>]*>([\d.]+)</);
      const pressureMatch = xml.match(/<pressure.*?unitType="metric"[^>]*>([\d.]+)</);
      const dewpointMatch = xml.match(/<dewpoint.*?unitType="metric"[^>]*>([-\d.]+)</);
      const obsTimeMatch = xml.match(/<dateTime.*?zone="UTC".*?name="observation"[^>]*>.*?<timeStamp>(.*?)<\/timeStamp>/s);
      
      observations.push({
        stationId: obs.stationId,
        stationName: obs.stationName,
        temperatureC: tempMatch ? parseFloat(tempMatch[1]) : null,
        humidityPct: humidityMatch ? parseFloat(humidityMatch[1]) : null,
        windSpeedKmh: windSpeedMatch ? parseFloat(windSpeedMatch[1]) : null,
        windDirection: windDirMatch ? windDirMatch[1] : null,
        windGustKmh: windGustMatch ? parseFloat(windGustMatch[1]) : null,
        condition: conditionMatch ? conditionMatch[1] : null,
        visibilityKm: visibilityMatch ? parseFloat(visibilityMatch[1]) : null,
        pressureKpa: pressureMatch ? parseFloat(pressureMatch[1]) : null,
        dewpointC: dewpointMatch ? parseFloat(dewpointMatch[1]) : null,
        observedAt: obsTimeMatch ? obsTimeMatch[1] : new Date().toISOString()
      });
      
      // Parse weather warnings/alerts
      const warningMatches = xml.matchAll(/<warning.*?>([\s\S]*?)<\/warning>/g);
      for (const match of warningMatches) {
        const warningXml = match[1];
        const titleMatch = warningXml.match(/<event.*?>(.*?)<\/event>/);
        const descMatch = warningXml.match(/<description>([\s\S]*?)<\/description>/);
        const typeMatch = warningXml.match(/<type>(.*?)<\/type>/);
        const priorityMatch = warningXml.match(/<priority>(.*?)<\/priority>/);
        
        if (titleMatch) {
          const priority = (priorityMatch?.[1] || '').toLowerCase();
          let severity: WeatherAlert['severity'] = 'warning';
          if (priority.includes('low') || priority.includes('statement')) {
            severity = 'minor';
          } else if (priority.includes('high') || priority.includes('warning')) {
            severity = 'major';
          }
          
          alerts.push({
            title: titleMatch[1],
            description: descMatch ? descMatch[1].trim() : '',
            type: typeMatch ? typeMatch[1] : 'unknown',
            severity,
            effectiveFrom: new Date().toISOString(),
            effectiveUntil: null,
            stationId: obs.stationId
          });
        }
      }
    }
    
    return { observations, alerts };
  }

  async load(data: { observations: WeatherObservation[]; alerts: WeatherAlert[] }): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    // Process observations
    for (const obs of data.observations) {
      // Find matching weather station entity
      const stationResult = await pool.query(`
        SELECT id, primary_region_id FROM entities 
        WHERE entity_type_id = 'weather-station'
        AND (
          configuration->>'station_id' = $1
          OR LOWER(name) LIKE $2
          OR LOWER(city) = $3
        )
        LIMIT 1
      `, [obs.stationId, `%${obs.stationName.toLowerCase()}%`, obs.stationName.toLowerCase()]);

      let entityId: number | null = null;
      let regionId: string | null = null;

      if (stationResult.rows.length > 0) {
        entityId = stationResult.rows[0].id;
        regionId = stationResult.rows[0].primary_region_id;
      } else {
        // Try to find by city match
        const cityResult = await pool.query(`
          SELECT id FROM geo_regions 
          WHERE LOWER(name) LIKE $1 
          AND region_type = 'municipality'
          LIMIT 1
        `, [`%${obs.stationName.toLowerCase()}%`]);
        
        if (cityResult.rows.length > 0) {
          regionId = cityResult.rows[0].id;
        }
      }

      const snapshotData = {
        temperature_c: obs.temperatureC,
        humidity_pct: obs.humidityPct,
        wind_speed_kmh: obs.windSpeedKmh,
        wind_direction: obs.windDirection,
        wind_gust_kmh: obs.windGustKmh,
        condition: obs.condition,
        visibility_km: obs.visibilityKm,
        pressure_kpa: obs.pressureKpa,
        dewpoint_c: obs.dewpointC,
        observed_at: obs.observedAt
      };

      if (entityId) {
        // Save snapshot
        await this.saveSnapshot(
          entityId,
          'active',
          snapshotData,
          {
            temperature: obs.temperatureC,
            humidity: obs.humidityPct,
            wind_speed: obs.windSpeedKmh,
            visibility: obs.visibilityKm
          }
        );
        
        // Update entity with current conditions
        await pool.query(`
          UPDATE entities SET
            configuration = configuration || $2::jsonb
          WHERE id = $1
        `, [
          entityId,
          JSON.stringify({
            current_temp_c: obs.temperatureC,
            current_condition: obs.condition,
            current_wind_kmh: obs.windSpeedKmh,
            current_humidity_pct: obs.humidityPct,
            last_observation: obs.observedAt,
            last_updated: new Date().toISOString()
          })
        ]);
        
        updated++;
      }
    }

    // Process weather alerts
    for (const alert of data.alerts) {
      const sourceKey = `eccc-weather-${alert.stationId}-${alert.title.replace(/\s+/g, '-').toLowerCase()}`;
      
      // Find region for the station
      const regionResult = await pool.query(`
        SELECT id FROM geo_regions 
        WHERE LOWER(name) LIKE $1 
        LIMIT 1
      `, [`%${BC_STATIONS.find(s => s.id === alert.stationId)?.city.toLowerCase() || ''}%`]);
      
      const regionId = regionResult.rows[0]?.id || null;

      // Check if alert already exists
      const existing = await pool.query(
        `SELECT id FROM alerts WHERE source_key = $1 AND is_active = true`,
        [sourceKey]
      );

      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO alerts (
            alert_type, severity, signal_type, title, summary, message,
            region_id, details, effective_from, is_active, source_key, observed_at
          ) VALUES (
            'weather', $1::severity_level, 'environment_canada', $2, $3, $4,
            $5, $6::jsonb, NOW(), true, $7, NOW()
          )
        `, [
          alert.severity,
          alert.title.substring(0, 255),
          alert.title.substring(0, 255),
          alert.description,
          regionId,
          JSON.stringify({ 
            warning_type: alert.type,
            station_id: alert.stationId
          }),
          sourceKey
        ]);
        created++;
      }
    }

    console.log(`[Weather] Observations updated: ${updated}, Alerts created: ${created}`);
    return { created, updated };
  }
}

import { BasePipeline } from "./base-pipeline";
import { pool } from "../db";

interface WeatherObservation {
  stationId: string;
  stationName: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  pressure: number;
  condition: string;
  observationTime: string;
}

export class WeatherPipeline extends BasePipeline {
  constructor() {
    super('eccc-weather', 'Environment Canada Weather', 600000); // 10 min
  }

  async fetch(): Promise<any> {
    // Environment Canada provides XML feeds
    // Key BC weather stations
    const stations = [
      's0000141', // Vancouver
      's0000780', // Victoria
      's0000568', // Kelowna
      's0000039', // Kamloops
      's0000645', // Prince George
      's0000779', // Nanaimo
    ];
    
    const observations: any[] = [];
    
    for (const stationId of stations) {
      try {
        const url = `https://dd.weather.gc.ca/citypage_weather/xml/BC/${stationId}_e.xml`;
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          observations.push({ stationId, xml: text });
        }
      } catch (e) {
        console.log(`Weather fetch failed for ${stationId}`);
      }
    }
    
    return { observations };
  }

  transform(rawData: any): WeatherObservation[] {
    const results: WeatherObservation[] = [];
    
    for (const obs of rawData.observations || []) {
      // Parse XML to extract weather data
      // Simplified - would use proper XML parser in production
      const tempMatch = obs.xml?.match(/<temperature.*?>([-\d.]+)</);
      const humidityMatch = obs.xml?.match(/<relativeHumidity.*?>([\d.]+)</);
      const windMatch = obs.xml?.match(/<speed.*?>([\d.]+)</);
      const conditionMatch = obs.xml?.match(/<condition>(.*?)<\/condition>/);
      
      if (tempMatch) {
        results.push({
          stationId: obs.stationId,
          stationName: obs.stationId,
          temperature: parseFloat(tempMatch[1]) || 0,
          humidity: parseFloat(humidityMatch?.[1] || '0'),
          windSpeed: parseFloat(windMatch?.[1] || '0'),
          windDirection: '',
          pressure: 0,
          condition: conditionMatch?.[1] || 'Unknown',
          observationTime: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  async load(observations: WeatherObservation[]): Promise<{ created: number; updated: number }> {
    let updated = 0;

    for (const obs of observations) {
      // Find matching weather station entity
      const station = await pool.query(
        `SELECT id FROM entities 
         WHERE entity_type_id = 'weather-station' 
         AND configuration->>'station_id' = $1
         LIMIT 1`,
        [obs.stationId]
      );

      if (station.rows.length > 0) {
        const entityId = station.rows[0].id;
        
        // Save snapshot
        await this.saveSnapshot(
          entityId,
          'active',
          obs,
          {
            temperature: obs.temperature,
            humidity: obs.humidity,
            wind_speed: obs.windSpeed
          }
        );
        
        // Update entity with latest
        await pool.query(`
          UPDATE entities SET
            configuration = configuration || $2::jsonb
          WHERE id = $1
        `, [
          entityId,
          JSON.stringify({
            current_temp: obs.temperature,
            current_condition: obs.condition,
            last_observation: obs.observationTime
          })
        ]);
        
        updated++;
      }
    }

    return { created: 0, updated };
  }
}

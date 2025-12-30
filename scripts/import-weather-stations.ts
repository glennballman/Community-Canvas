import { BC_WEATHER_STATIONS } from "../shared/weather-stations";
import { pool } from "../server/db";

const TYPE_MAP: Record<string, string> = {
  "metar": "weather-station-metar",
  "marine_buoy": "weather-station-buoy",
  "lightstation": "weather-station-lightstation",
  "synop": "weather-station-climate",
  "climate": "weather-station-climate"
};

async function importWeatherStations() {
  console.log("Starting weather station import...");
  console.log(`Found ${BC_WEATHER_STATIONS.length} stations to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const station of BC_WEATHER_STATIONS) {
      const entityTypeId = TYPE_MAP[station.type];
      if (!entityTypeId) {
        console.log(`  Skipping ${station.id}: unknown type ${station.type}`);
        continue;
      }
      
      const metadata = {
        station_id: station.station_id,
        icao: station.icao ?? null,
        wmo_id: station.wmo_id ?? null,
        elevation_m: station.elevation_m ?? null,
        reports: station.reports ?? [],
        url: station.url ?? null,
        notes: station.notes ?? null
      };
      
      const query = `
        INSERT INTO entities (
          id, entity_type_id, name, slug, short_name,
          primary_region_id, city, latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          entity_type_id = EXCLUDED.entity_type_id,
          name = EXCLUDED.name,
          short_name = EXCLUDED.short_name,
          primary_region_id = EXCLUDED.primary_region_id,
          city = EXCLUDED.city,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          configuration = EXCLUDED.configuration,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        entityTypeId,
        station.name,
        station.id,
        station.station_id,
        station.region_id ?? null,
        station.municipality ?? null,
        station.latitude,
        station.longitude,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} weather stations.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id LIKE 'weather-station%'
      GROUP BY entity_type_id
      ORDER BY entity_type_id
    `);
    
    console.log("\nWeather stations by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
    const metarResult = await client.query(`
      SELECT name, configuration->>'station_id' as station_id, configuration->>'icao' as icao
      FROM entities 
      WHERE entity_type_id = 'weather-station-metar'
      LIMIT 5
    `);
    
    console.log("\nSample METAR stations:");
    for (const row of metarResult.rows) {
      console.log(`  ${row.station_id} (${row.icao}): ${row.name}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing weather stations:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importWeatherStations().catch(console.error);

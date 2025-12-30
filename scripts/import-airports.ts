import { BC_AIRPORTS } from "../shared/aviation";
import { pool } from "../server/db";

const TYPE_MAP: Record<string, string> = {
  "large_airport": "airport-large",
  "medium_airport": "airport-medium",
  "small_airport": "airport-small",
  "seaplane_base": "seaplane-base",
  "heliport": "heliport"
};

async function importAirports() {
  console.log("Starting airport import...");
  
  const airportsToImport = BC_AIRPORTS.filter(a => a.type !== "closed");
  console.log(`Found ${airportsToImport.length} airports to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const airport of airportsToImport) {
      const entityTypeId = TYPE_MAP[airport.type];
      if (!entityTypeId) {
        console.log(`  Skipping ${airport.id}: unknown type ${airport.type}`);
        continue;
      }
      
      const metadata = {
        icao: airport.icao ?? null,
        iata: airport.iata ?? null,
        tc_lid: airport.tc_lid ?? null,
        elevation_ft: airport.elevation_ft ?? null,
        has_metar: airport.has_metar,
        has_customs: airport.has_customs,
        runways: airport.runways ?? [],
        status: airport.status,
        notes: airport.notes ?? null
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
        airport.name,
        airport.id,
        airport.icao ?? airport.id.toUpperCase(),
        airport.region_id ?? null,
        airport.municipality ?? null,
        airport.latitude,
        airport.longitude,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} airports.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id LIKE 'airport%' OR entity_type_id IN ('seaplane-base', 'heliport')
      GROUP BY entity_type_id
      ORDER BY entity_type_id
    `);
    
    console.log("\nAirports by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
    const largeResult = await client.query(`
      SELECT name, latitude, longitude, configuration->>'icao' as icao
      FROM entities 
      WHERE entity_type_id = 'airport-large'
      ORDER BY name
    `);
    
    console.log("\nLarge airports:");
    for (const row of largeResult.rows) {
      console.log(`  ${row.icao}: ${row.name}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing airports:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importAirports().catch(console.error);

import { BC_TAXI_SERVICES } from "../shared/taxi-services";
import { pool } from "../server/db";

async function importTaxiServices() {
  console.log("Starting taxi services import...");
  console.log(`Found ${BC_TAXI_SERVICES.length} taxi services to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const taxi of BC_TAXI_SERVICES) {
      const metadata = {
        taxi_type: taxi.type,
        license_area: taxi.service_area ?? [],
        fleet_size: taxi.fleet_size ?? null,
        wheelchair_accessible: taxi.wheelchair_accessible ?? false,
        app_available: taxi.app_available ?? false,
        notes: taxi.notes ?? null
      };
      
      const query = `
        INSERT INTO entities (
          id, entity_type_id, name, slug,
          city, address_line1, phone, website,
          latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9, $10,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          entity_type_id = EXCLUDED.entity_type_id,
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          address_line1 = EXCLUDED.address_line1,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          configuration = EXCLUDED.configuration,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        "taxi-service",
        taxi.name,
        taxi.id,
        taxi.municipality ?? null,
        taxi.base_location?.address ?? null,
        taxi.phone ?? null,
        taxi.website ?? null,
        taxi.base_location?.lat ?? null,
        taxi.base_location?.lng ?? null,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} taxi services.`);
    
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'taxi-service'
    `);
    console.log(`\nTotal taxi services in database: ${countResult.rows[0].count}`);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing taxi services:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importTaxiServices().catch(console.error);

import { BC_PHARMACIES } from "../shared/pharmacies";
import { pool } from "../server/db";

async function importPharmacies() {
  console.log("Starting pharmacies import...");
  console.log(`Found ${BC_PHARMACIES.length} pharmacies to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const pharmacy of BC_PHARMACIES) {
      const metadata = {
        chain: pharmacy.chain,
        pharmacy_type: pharmacy.type,
        services: pharmacy.services ?? [],
        courier_services: pharmacy.courier_services ?? [],
        hours_24: pharmacy.hours_24 ?? false,
        notes: pharmacy.notes ?? null
      };
      
      const query = `
        INSERT INTO entities (
          id, entity_type_id, name, slug,
          city, address_line1, phone,
          latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          entity_type_id = EXCLUDED.entity_type_id,
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          address_line1 = EXCLUDED.address_line1,
          phone = EXCLUDED.phone,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          configuration = EXCLUDED.configuration,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        "pharmacy",
        pharmacy.name,
        pharmacy.id,
        pharmacy.municipality ?? null,
        pharmacy.address ?? null,
        pharmacy.phone ?? null,
        pharmacy.lat,
        pharmacy.lng,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} pharmacies.`);
    
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'pharmacy'
    `);
    console.log(`\nTotal pharmacies in database: ${countResult.rows[0].count}`);
    
    const chainResult = await client.query(`
      SELECT configuration->>'chain' as chain, COUNT(*) as count
      FROM entities 
      WHERE entity_type_id = 'pharmacy'
      GROUP BY configuration->>'chain'
      ORDER BY count DESC
      LIMIT 5
    `);
    
    console.log("\nTop 5 chains:");
    for (const row of chainResult.rows) {
      console.log(`  ${row.chain}: ${row.count}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing pharmacies:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importPharmacies().catch(console.error);

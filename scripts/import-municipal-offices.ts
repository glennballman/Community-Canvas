import { municipalOffices } from "../shared/municipal-offices";
import { pool } from "../server/db";

const TYPE_MAP: Record<string, string> = {
  "city_hall": "city-hall",
  "town_office": "city-hall",
  "district_office": "city-hall",
  "village_office": "city-hall",
  "regional_district": "regional-district",
  "first_nation_band_office": "first-nations-admin",
  "treaty_nation_office": "first-nations-admin"
};

async function importMunicipalOffices() {
  console.log("Starting municipal offices import...");
  console.log(`Found ${municipalOffices.length} offices to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const office of municipalOffices) {
      const entityTypeId = TYPE_MAP[office.type] ?? "city-hall";
      
      const metadata = {
        office_type: office.type,
        notes: office.notes ?? null
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
        entityTypeId,
        office.name,
        office.id,
        office.municipality ?? null,
        office.address ?? null,
        office.phone ?? null,
        office.website ?? null,
        office.lat,
        office.lng,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} municipal offices.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id IN ('city-hall', 'regional-district', 'service-bc', 'first-nations-admin')
      GROUP BY entity_type_id
      ORDER BY count DESC
    `);
    
    console.log("\nMunicipal offices by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing municipal offices:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importMunicipalOffices().catch(console.error);

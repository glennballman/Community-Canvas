import { BC_MARINE_FACILITIES } from "../shared/marine";
import { pool } from "../server/db";

const TYPE_MAP: Record<string, string> = {
  "coast_guard": "coast-guard",
  "marina": "marina",
  "harbour_authority": "harbour-authority",
  "public_wharf": "public-wharf",
  "ferry_terminal": "ferry-terminal",
  "fuel_dock": "marina",
  "rescue_station": "coast-guard",
  "seaplane_dock": "marina",
  "private_ferry": "ferry-terminal",
  "water_taxi": "ferry-terminal"
};

async function importMarineFacilities() {
  console.log("Starting marine facilities import...");
  console.log(`Found ${BC_MARINE_FACILITIES.length} facilities to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const facility of BC_MARINE_FACILITIES) {
      const entityTypeId = TYPE_MAP[facility.type] ?? "marina";
      
      const metadata = {
        services: facility.services ?? [],
        vhf_channel: facility.vhf_channel ?? null,
        has_fuel: facility.has_fuel ?? false,
        has_moorage: facility.has_moorage ?? false,
        has_launch: facility.has_launch ?? false,
        emergency_services: facility.emergency_services ?? false,
        notes: facility.notes ?? null
      };
      
      const query = `
        INSERT INTO entities (
          id, entity_type_id, name, slug,
          city, phone,
          latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5,
          $6, $7, $8,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          entity_type_id = EXCLUDED.entity_type_id,
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          phone = EXCLUDED.phone,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          configuration = EXCLUDED.configuration,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        entityTypeId,
        facility.name,
        facility.id,
        facility.municipality ?? null,
        facility.phone ?? null,
        facility.latitude,
        facility.longitude,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} marine facilities.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id IN ('coast-guard', 'marina', 'harbour-authority', 'public-wharf', 'ferry-terminal')
      GROUP BY entity_type_id
      ORDER BY count DESC
    `);
    
    console.log("\nMarine facilities by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
    const ccgResult = await client.query(`
      SELECT name, configuration->>'vhf_channel' as vhf, configuration->'services' as services
      FROM entities 
      WHERE entity_type_id = 'coast-guard'
      ORDER BY name
    `);
    
    console.log("\nCoast Guard stations:");
    for (const row of ccgResult.rows) {
      console.log(`  ${row.name} (VHF ${row.vhf})`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing marine facilities:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importMarineFacilities().catch(console.error);

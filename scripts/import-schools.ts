import { BC_SCHOOLS } from "../shared/schools";
import { pool } from "../server/db";

function getEntityTypeId(type: string): string {
  if (type === "university") return "school-university";
  if (type === "college" || type === "polytechnic") return "school-college";
  return "school-k12";
}

async function importSchools() {
  console.log("Starting schools import...");
  console.log(`Found ${BC_SCHOOLS.length} schools to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const school of BC_SCHOOLS) {
      const entityTypeId = getEntityTypeId(school.type);
      
      const metadata = {
        school_type: school.type,
        category: school.category,
        grades: school.grades ?? null,
        district: school.district ?? null,
        enrollment: school.enrollment ?? null,
        notes: school.notes ?? null
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
        school.name,
        school.id,
        school.municipality ?? null,
        school.address ?? null,
        school.phone ?? null,
        school.website ?? null,
        school.lat,
        school.lng,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} schools.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id LIKE 'school%'
      GROUP BY entity_type_id
      ORDER BY entity_type_id
    `);
    
    console.log("\nSchools by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
    const uniResult = await client.query(`
      SELECT name, configuration->>'enrollment' as enrollment
      FROM entities 
      WHERE entity_type_id = 'school-university'
      ORDER BY (configuration->>'enrollment')::int DESC NULLS LAST
    `);
    
    console.log("\nUniversities:");
    for (const row of uniResult.rows) {
      const enrollment = row.enrollment ? ` (${parseInt(row.enrollment).toLocaleString()} students)` : '';
      console.log(`  ${row.name}${enrollment}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing schools:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importSchools().catch(console.error);

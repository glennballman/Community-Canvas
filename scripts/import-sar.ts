import { BC_SAR_GROUPS } from "../shared/search-rescue";
import { pool } from "../server/db";

async function importSARGroups() {
  console.log("Starting SAR groups import...");
  console.log(`Found ${BC_SAR_GROUPS.length} groups to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const group of BC_SAR_GROUPS) {
      const metadata = {
        short_name: group.short_name,
        coverage_area: group.coverage_area,
        capabilities: group.capabilities ?? [],
        email: group.email ?? null,
        notes: group.notes ?? null
      };
      
      const query = `
        INSERT INTO entities (
          id, entity_type_id, name, slug, short_name,
          city, phone, website,
          latitude, longitude, configuration,
          is_active, verification_status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          true, 'verified'
        )
        ON CONFLICT (slug) DO UPDATE SET
          entity_type_id = EXCLUDED.entity_type_id,
          name = EXCLUDED.name,
          short_name = EXCLUDED.short_name,
          city = EXCLUDED.city,
          phone = EXCLUDED.phone,
          website = EXCLUDED.website,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          configuration = EXCLUDED.configuration,
          is_active = EXCLUDED.is_active
      `;
      
      const values = [
        "sar-group",
        group.name,
        group.id,
        group.short_name,
        group.municipality ?? null,
        group.phone ?? null,
        group.website ?? null,
        group.latitude,
        group.longitude,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} SAR groups.`);
    
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'sar-group'
    `);
    console.log(`\nTotal SAR groups in database: ${countResult.rows[0].count}`);
    
    const sampleResult = await client.query(`
      SELECT name, configuration->>'short_name' as short_name, configuration->'capabilities' as capabilities
      FROM entities 
      WHERE entity_type_id = 'sar-group'
      LIMIT 5
    `);
    
    console.log("\nSample SAR groups:");
    for (const row of sampleResult.rows) {
      console.log(`  ${row.short_name}: ${row.name}`);
    }
    
    const jdfResult = await client.query(`
      SELECT name, configuration->>'coverage_area' as coverage
      FROM entities 
      WHERE slug = 'sar-juan-de-fuca'
    `);
    
    if (jdfResult.rows.length > 0) {
      console.log(`\nJuan de Fuca SAR:`);
      console.log(`  Name: ${jdfResult.rows[0].name}`);
      console.log(`  Coverage: ${jdfResult.rows[0].coverage}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing SAR groups:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importSARGroups().catch(console.error);

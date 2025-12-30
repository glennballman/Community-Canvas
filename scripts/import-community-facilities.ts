import { BC_COMMUNITY_FACILITIES } from "../shared/community-facilities";
import { pool } from "../server/db";

async function importCommunityFacilities() {
  console.log("Starting community facilities import...");
  console.log(`Found ${BC_COMMUNITY_FACILITIES.length} facilities to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const facility of BC_COMMUNITY_FACILITIES) {
      const entityTypeId = "recreation-centre";
      
      const amenityTypes = facility.amenities?.map(a => a.type) ?? [];
      
      const metadata = {
        category: facility.category,
        amenities: amenityTypes,
        operator: facility.operator ?? null,
        ownership: facility.ownership ?? null,
        year_opened: facility.year_opened ?? null,
        notes: facility.notes ?? null
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
        facility.name,
        facility.id,
        facility.municipality ?? null,
        facility.address ?? null,
        facility.phone ?? null,
        facility.website ?? null,
        facility.lat,
        facility.lng,
        JSON.stringify(metadata)
      ];
      
      await client.query(query, values);
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} community facilities.`);
    
    const result = await client.query(`
      SELECT entity_type_id, COUNT(*) as count 
      FROM entities 
      WHERE entity_type_id IN ('recreation-centre', 'library', 'community-hall')
      GROUP BY entity_type_id
      ORDER BY count DESC
    `);
    
    console.log("\nCommunity facilities by type:");
    let total = 0;
    for (const row of result.rows) {
      console.log(`  ${row.entity_type_id}: ${row.count}`);
      total += parseInt(row.count);
    }
    console.log(`  TOTAL: ${total}`);
    
    const categoryResult = await client.query(`
      SELECT configuration->>'category' as category, COUNT(*) as count
      FROM entities 
      WHERE entity_type_id = 'recreation-centre'
      GROUP BY configuration->>'category'
      ORDER BY count DESC
      LIMIT 5
    `);
    
    console.log("\nTop 5 categories:");
    for (const row of categoryResult.rows) {
      console.log(`  ${row.category}: ${row.count}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing community facilities:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importCommunityFacilities().catch(console.error);

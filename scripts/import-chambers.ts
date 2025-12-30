import { BC_CHAMBERS_OF_COMMERCE } from "../shared/chambers-of-commerce";
import { pool } from "../server/db";

function parseMembers(membersStr?: string): number | null {
  if (!membersStr) return null;
  const match = membersStr.match(/(\d[\d,]*)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return null;
}

async function importChambers() {
  console.log("Starting chambers of commerce import...");
  console.log(`Found ${BC_CHAMBERS_OF_COMMERCE.length} chambers to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    for (const chamber of BC_CHAMBERS_OF_COMMERCE) {
      const metadata = {
        founded: chamber.founded ?? null,
        members: chamber.members ?? null,
        email: chamber.email ?? null,
        notes: chamber.notes ?? null
      };
      
      // Insert into entities table
      const entityQuery = `
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
        RETURNING id
      `;
      
      const entityValues = [
        "chamber-of-commerce",
        chamber.name,
        chamber.id,
        chamber.municipality ?? null,
        chamber.location?.address ?? null,
        chamber.phone ?? null,
        chamber.website ?? null,
        chamber.location?.lat ?? null,
        chamber.location?.lng ?? null,
        JSON.stringify(metadata)
      ];
      
      const entityResult = await client.query(entityQuery, entityValues);
      const entityId = entityResult.rows[0].id;
      
      // Insert into chamber_details table
      const expectedMembers = parseMembers(chamber.members);
      const directoryUrl = chamber.website ? chamber.website + "/directory" : null;
      
      const detailsQuery = `
        INSERT INTO chamber_details (
          entity_id, directory_url, member_count_expected
        ) VALUES ($1, $2, $3)
        ON CONFLICT (entity_id) DO UPDATE SET
          directory_url = EXCLUDED.directory_url,
          member_count_expected = EXCLUDED.member_count_expected,
          updated_at = NOW()
      `;
      
      await client.query(detailsQuery, [entityId, directoryUrl, expectedMembers]);
      
      imported++;
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} chambers.`);
    
    const entityCount = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'chamber-of-commerce'
    `);
    console.log(`\nEntities with type 'chamber-of-commerce': ${entityCount.rows[0].count}`);
    
    const detailsCount = await client.query(`
      SELECT COUNT(*) as count FROM chamber_details
    `);
    console.log(`Chamber details records: ${detailsCount.rows[0].count}`);
    
    const sookeResult = await client.query(`
      SELECT e.name, e.latitude, e.longitude, cd.member_count_expected
      FROM entities e
      JOIN chamber_details cd ON cd.entity_id = e.id
      WHERE e.slug = 'sooke-chamber'
    `);
    
    if (sookeResult.rows.length > 0) {
      const row = sookeResult.rows[0];
      console.log(`\nSooke Chamber verification:`);
      console.log(`  Name: ${row.name}`);
      console.log(`  Lat/Lng: ${row.latitude}, ${row.longitude}`);
      console.log(`  Expected Members: ${row.member_count_expected}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing chambers:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importChambers().catch(console.error);

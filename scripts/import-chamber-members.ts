import { chamberMembers } from "../shared/chamber-members";
import { pool } from "../server/db";

const BATCH_SIZE = 500;

async function importChamberMembers() {
  console.log("Starting chamber members import...");
  console.log(`Found ${chamberMembers.length} members to import`);
  
  const client = await pool.connect();
  
  try {
    // First, build a lookup of chamber slug -> entity_id
    const chamberLookup = new Map<string, string>();
    const chamberResult = await client.query(`
      SELECT id, slug FROM entities WHERE entity_type_id = 'chamber-of-commerce'
    `);
    for (const row of chamberResult.rows) {
      chamberLookup.set(row.slug, row.id);
    }
    console.log(`Loaded ${chamberLookup.size} chamber lookups`);
    
    await client.query("BEGIN");
    
    let imported = 0;
    let skipped = 0;
    const batches = Math.ceil(chamberMembers.length / BATCH_SIZE);
    
    for (let batch = 0; batch < batches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, chamberMembers.length);
      const batchMembers = chamberMembers.slice(start, end);
      
      for (const member of batchMembers) {
        const chamberEntityId = chamberLookup.get(member.chamberId);
        if (!chamberEntityId) {
          skipped++;
          continue;
        }
        
        const metadata = {
          naics_code: member.naicsCode ?? null,
          naics_title: member.naicsTitle ?? null,
          naics_sector: member.naicsSector ?? null,
          naics_subsector: member.naicsSubsector ?? null,
          category: member.category ?? null,
          subcategory: member.subcategory ?? null,
          description: member.description ?? null,
          cross_reference: member.crossReference ?? null
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
            NULL, NULL, $8,
            true, 'unverified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            entity_type_id = EXCLUDED.entity_type_id,
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            address_line1 = EXCLUDED.address_line1,
            phone = EXCLUDED.phone,
            website = EXCLUDED.website,
            configuration = EXCLUDED.configuration
          RETURNING id
        `;
        
        // Truncate phone to 30 chars to fit varchar(30)
        const phone = member.phone ? member.phone.substring(0, 30) : null;
        
        const entityValues = [
          "business",
          member.businessName,
          member.id,
          member.municipality ?? null,
          member.address ?? null,
          phone,
          member.website ?? null,
          JSON.stringify(metadata)
        ];
        
        const entityResult = await client.query(entityQuery, entityValues);
        const memberEntityId = entityResult.rows[0].id;
        
        // Insert into chamber_memberships table
        const memberSinceDate = member.memberSince 
          ? `${member.memberSince}-01-01` 
          : null;
        
        const membershipQuery = `
          INSERT INTO chamber_memberships (
            id, chamber_entity_id, member_entity_id, status, member_since
          ) VALUES (
            gen_random_uuid(), $1, $2, 'active', $3
          )
          ON CONFLICT (chamber_entity_id, member_entity_id) DO UPDATE SET
            status = 'active',
            member_since = COALESCE(EXCLUDED.member_since, chamber_memberships.member_since),
            updated_at = NOW()
        `;
        
        await client.query(membershipQuery, [chamberEntityId, memberEntityId, memberSinceDate]);
        
        imported++;
      }
      
      console.log(`  Batch ${batch + 1}/${batches} complete (${imported} imported, ${skipped} skipped)`);
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} members, skipped ${skipped}.`);
    
    // Verification queries
    const entityCount = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'business'
    `);
    console.log(`\nTotal business entities: ${entityCount.rows[0].count}`);
    
    const membershipCount = await client.query(`
      SELECT COUNT(*) as count FROM chamber_memberships
    `);
    console.log(`Total chamber memberships: ${membershipCount.rows[0].count}`);
    
    const naicsResult = await client.query(`
      SELECT 
        configuration->>'naics_sector' as sector,
        COUNT(*) as count
      FROM entities 
      WHERE entity_type_id = 'business'
      AND configuration->>'naics_sector' IS NOT NULL
      GROUP BY configuration->>'naics_sector'
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log("\nTop 10 NAICS sectors:");
    for (const row of naicsResult.rows) {
      console.log(`  Sector ${row.sector}: ${row.count}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing chamber members:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importChamberMembers().catch(console.error);

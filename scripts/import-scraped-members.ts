import { pool } from "../server/db";
import * as fs from "fs";
import * as path from "path";

interface ScrapedMember {
  id: string;
  chamberId: string;
  businessName: string;
  category?: string;
  subcategory?: string;
  naicsCode?: string;
  naicsTitle?: string;
  naicsSector?: string;
  naicsSubsector?: string;
  municipality?: string;
  region?: string;
  website?: string;
  phone?: string;
  address?: string;
  description?: string;
}

const JSON_FILES = [
  "alert-bay.json",
  "chemainus.json",
  "cowichan-lake.json",
  "ladysmith.json",
  "pender-island.json",
  "port-alberni.json",
  "port-hardy.json",
  "port-mcneill.json",
  "port-renfrew.json",
  "qualicum-beach.json",
  "sooke.json",
  "tofino.json",
  "ucluelet.json"
];

async function importScrapedMembers() {
  console.log("Starting scraped chamber members import...");
  
  const client = await pool.connect();
  
  try {
    // Load chamber lookup
    const chamberLookup = new Map<string, string>();
    const chamberResult = await client.query(`
      SELECT id, slug FROM entities WHERE entity_type_id = 'chamber-of-commerce'
    `);
    for (const row of chamberResult.rows) {
      chamberLookup.set(row.slug, row.id);
    }
    console.log(`Loaded ${chamberLookup.size} chamber lookups`);
    
    await client.query("BEGIN");
    
    let totalProcessed = 0;
    let updated = 0;
    let inserted = 0;
    let skipped = 0;
    
    for (const jsonFile of JSON_FILES) {
      const filePath = path.join("data/chambers", jsonFile);
      
      if (!fs.existsSync(filePath)) {
        console.log(`  Skipping ${jsonFile} - file not found`);
        continue;
      }
      
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const members: ScrapedMember[] = JSON.parse(fileContent);
      
      console.log(`  Processing ${jsonFile} (${members.length} members)...`);
      
      for (const member of members) {
        totalProcessed++;
        
        const chamberEntityId = chamberLookup.get(member.chamberId);
        if (!chamberEntityId) {
          skipped++;
          continue;
        }
        
        // Check if entity already exists by slug
        const existingResult = await client.query(
          `SELECT id FROM entities WHERE slug = $1`,
          [member.id]
        );
        
        const metadata = {
          naics_code: member.naicsCode ?? null,
          naics_title: member.naicsTitle ?? null,
          naics_sector: member.naicsSector ?? null,
          naics_subsector: member.naicsSubsector ?? null,
          category: member.category ?? null,
          subcategory: member.subcategory ?? null,
          description: member.description ?? null
        };
        
        if (existingResult.rows.length > 0) {
          // Update existing entity with NAICS data
          await client.query(`
            UPDATE entities SET
              configuration = configuration || $1::jsonb,
              updated_at = NOW()
            WHERE slug = $2
          `, [JSON.stringify(metadata), member.id]);
          updated++;
        } else {
          // Insert new entity
          const phone = member.phone ? member.phone.substring(0, 30) : null;
          
          const entityResult = await client.query(`
            INSERT INTO entities (
              id, entity_type_id, name, slug,
              city, address_line1, phone, website,
              latitude, longitude, configuration,
              is_active, verification_status
            ) VALUES (
              gen_random_uuid(), 'business', $1, $2,
              $3, $4, $5, $6,
              NULL, NULL, $7,
              true, 'unverified'
            )
            RETURNING id
          `, [
            member.businessName,
            member.id,
            member.municipality ?? null,
            member.address ?? null,
            phone,
            member.website ?? null,
            JSON.stringify(metadata)
          ]);
          
          const memberEntityId = entityResult.rows[0].id;
          
          // Create chamber membership
          await client.query(`
            INSERT INTO chamber_memberships (
              id, chamber_entity_id, member_entity_id, status
            ) VALUES (
              gen_random_uuid(), $1, $2, 'active'
            )
            ON CONFLICT (chamber_entity_id, member_entity_id) DO NOTHING
          `, [chamberEntityId, memberEntityId]);
          
          inserted++;
        }
      }
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete!`);
    console.log(`  Total processed: ${totalProcessed}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Skipped: ${skipped}`);
    
    // Verification query
    const naicsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN configuration->>'naics_code' IS NOT NULL THEN 1 END) as has_naics,
        ROUND(100.0 * COUNT(CASE WHEN configuration->>'naics_code' IS NOT NULL THEN 1 END) / COUNT(*), 1) as pct
      FROM entities 
      WHERE entity_type_id = 'business'
    `);
    
    const row = naicsResult.rows[0];
    console.log(`\nNAICS coverage:`);
    console.log(`  Total businesses: ${row.total}`);
    console.log(`  With NAICS code: ${row.has_naics}`);
    console.log(`  Coverage: ${row.pct}%`);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing scraped members:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importScrapedMembers().catch(console.error);

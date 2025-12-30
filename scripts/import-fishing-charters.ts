import { pool } from "../server/db";
import * as fs from "fs";

interface ContactPerson {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface SocialMediaLink {
  value: string;
}

interface FishingCharter {
  business_name: string;
  location: string;
  website_url: string | null;
  phone_number: string | null;
  email: string | null;
  social_media_links: SocialMediaLink[];
  contact_people: ContactPerson[];
  directory_url: string | null;
}

interface CharterData {
  fishing_charter_operators: FishingCharter[];
}

const BATCH_SIZE = 100;

function generateSlug(name: string): string {
  return "fishing-" + name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

function extractCity(location: string): string | null {
  if (!location) return null;
  // Extract first part before comma (typically the city)
  const parts = location.split(',');
  return parts[0]?.trim() || null;
}

async function importFishingCharters() {
  console.log("Starting fishing charters import...");
  
  const fileContent = fs.readFileSync("data/fishing-charters-bc.json", "utf-8");
  const data: CharterData = JSON.parse(fileContent);
  
  console.log(`Found ${data.fishing_charter_operators.length} charters to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    let skipped = 0;
    const batches = Math.ceil(data.fishing_charter_operators.length / BATCH_SIZE);
    const seenSlugs = new Set<string>();
    
    for (let batch = 0; batch < batches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, data.fishing_charter_operators.length);
      const batchCharters = data.fishing_charter_operators.slice(start, end);
      
      for (const charter of batchCharters) {
        if (!charter.business_name) {
          skipped++;
          continue;
        }
        
        let slug = generateSlug(charter.business_name);
        
        // Handle duplicate slugs
        let originalSlug = slug;
        let counter = 1;
        while (seenSlugs.has(slug)) {
          slug = `${originalSlug}-${counter}`;
          counter++;
        }
        seenSlugs.add(slug);
        
        const city = extractCity(charter.location);
        
        // Extract social media URLs
        const socialMediaUrls = charter.social_media_links
          ?.map(link => link.value)
          .filter(Boolean) || [];
        
        // Clean contact people
        const contactPeople = charter.contact_people
          ?.filter(p => p.first_name || p.last_name)
          .map(p => ({
            first_name: p.first_name,
            last_name: p.last_name,
            role: p.role
          })) || [];
        
        const metadata = {
          home_port: charter.location,
          email: charter.email,
          contact_people: contactPeople,
          social_media_links: socialMediaUrls,
          directory_url: charter.directory_url
        };
        
        // Truncate phone to 30 chars
        const phone = charter.phone_number?.substring(0, 30) || null;
        
        await client.query(`
          INSERT INTO entities (
            id, entity_type_id, name, slug, city,
            phone, website, latitude, longitude,
            configuration, is_active, verification_status
          ) VALUES (
            gen_random_uuid(), 'fishing-charter', $1, $2, $3,
            $4, $5, NULL, NULL,
            $6, true, 'unverified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            website = EXCLUDED.website,
            configuration = EXCLUDED.configuration
        `, [
          charter.business_name,
          slug,
          city,
          phone,
          charter.website_url || null,
          JSON.stringify(metadata)
        ]);
        
        imported++;
      }
      
      console.log(`  Batch ${batch + 1}/${batches} complete (${imported} imported, ${skipped} skipped)`);
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} charters, skipped ${skipped}.`);
    
    // Verification
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'fishing-charter'
    `);
    console.log(`\nTotal fishing charters in database: ${countResult.rows[0].count}`);
    
    const sampleResult = await client.query(`
      SELECT name, phone, website, configuration->>'home_port' as port
      FROM entities 
      WHERE entity_type_id = 'fishing-charter'
      LIMIT 10
    `);
    console.log("\nSample charters:");
    for (const row of sampleResult.rows) {
      console.log(`  ${row.name} - ${row.port}`);
      if (row.phone) console.log(`    Phone: ${row.phone}`);
    }
    
    // Regional distribution
    const regionResult = await client.query(`
      SELECT 
        city,
        COUNT(*) as charters
      FROM entities
      WHERE entity_type_id = 'fishing-charter'
      GROUP BY city
      ORDER BY charters DESC
      LIMIT 10
    `);
    console.log("\nTop 10 locations:");
    for (const row of regionResult.rows) {
      console.log(`  ${row.city || 'Unknown'}: ${row.charters}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing fishing charters:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importFishingCharters().catch(console.error);

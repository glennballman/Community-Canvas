import { pool } from "../server/db";
import * as fs from "fs";

interface Webcam {
  latitude: number;
  longitude: number;
  city: string;
  nickname: string;
  view_description: string;
  host_page_url: string;
  direct_feed_url: string;
  source_provider: string;
  live_feed_status: string;
}

interface WebcamData {
  webcams: Webcam[];
}

const BATCH_SIZE = 200;

function generateSlug(nickname: string): string {
  return "webcam-" + nickname
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

function extractDirection(nickname: string): string | null {
  const match = nickname.match(/\s-\s([NSEW])$/);
  if (match) {
    const dir = match[1];
    return dir === 'N' ? 'North' : 
           dir === 'S' ? 'South' : 
           dir === 'E' ? 'East' : 
           dir === 'W' ? 'West' : null;
  }
  return null;
}

async function importWebcams() {
  console.log("Starting webcams import...");
  
  const fileContent = fs.readFileSync("data/webcams-bc.json", "utf-8");
  const data: WebcamData = JSON.parse(fileContent);
  
  console.log(`Found ${data.webcams.length} webcams to import`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    let skipped = 0;
    const batches = Math.ceil(data.webcams.length / BATCH_SIZE);
    const seenSlugs = new Set<string>();
    
    for (let batch = 0; batch < batches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, data.webcams.length);
      const batchWebcams = data.webcams.slice(start, end);
      
      for (const webcam of batchWebcams) {
        if (!webcam.nickname || !webcam.latitude || !webcam.longitude) {
          skipped++;
          continue;
        }
        
        let slug = generateSlug(webcam.nickname);
        
        // Handle duplicate slugs by appending a counter
        let originalSlug = slug;
        let counter = 1;
        while (seenSlugs.has(slug)) {
          slug = `${originalSlug}-${counter}`;
          counter++;
        }
        seenSlugs.add(slug);
        
        const direction = extractDirection(webcam.nickname);
        
        const metadata = {
          direct_feed_url: webcam.direct_feed_url,
          view_description: webcam.view_description,
          source_provider: webcam.source_provider,
          live_feed_status: webcam.live_feed_status,
          direction: direction
        };
        
        await client.query(`
          INSERT INTO entities (
            id, entity_type_id, name, slug, city,
            website, latitude, longitude,
            configuration, is_active, verification_status
          ) VALUES (
            gen_random_uuid(), 'webcam', $1, $2, $3,
            $4, $5, $6,
            $7, true, 'verified'
          )
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            configuration = EXCLUDED.configuration
        `, [
          webcam.nickname,
          slug,
          webcam.city || null,
          webcam.host_page_url || null,
          webcam.latitude,
          webcam.longitude,
          JSON.stringify(metadata)
        ]);
        
        imported++;
      }
      
      console.log(`  Batch ${batch + 1}/${batches} complete (${imported} imported, ${skipped} skipped)`);
    }
    
    await client.query("COMMIT");
    console.log(`\nImport complete! Imported ${imported} webcams, skipped ${skipped}.`);
    
    // Verification
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM entities WHERE entity_type_id = 'webcam'
    `);
    console.log(`\nTotal webcams in database: ${countResult.rows[0].count}`);
    
    const sampleResult = await client.query(`
      SELECT name, latitude, longitude, configuration->>'direct_feed_url' as feed_url
      FROM entities 
      WHERE entity_type_id = 'webcam'
      LIMIT 5
    `);
    console.log("\nSample webcams:");
    for (const row of sampleResult.rows) {
      console.log(`  ${row.name} (${row.latitude}, ${row.longitude})`);
      console.log(`    Feed: ${row.feed_url}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing webcams:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importWebcams().catch(console.error);

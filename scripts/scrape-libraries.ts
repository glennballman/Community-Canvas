import FirecrawlApp from "@mendable/firecrawl-js";
import { pool } from "../server/db";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

interface LibraryBranch {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  hours?: string;
  postal_code?: string;
}

interface ScrapedSystem {
  system_name: string;
  branches: LibraryBranch[];
}

// City coordinates for geocoding
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "vancouver": { lat: 49.2827, lng: -123.1207 },
  "victoria": { lat: 48.4284, lng: -123.3656 },
  "nanaimo": { lat: 49.1659, lng: -123.9401 },
  "kelowna": { lat: 49.8863, lng: -119.4966 },
  "abbotsford": { lat: 49.0504, lng: -122.3045 },
  "chilliwack": { lat: 49.1579, lng: -121.9514 },
  "mission": { lat: 49.1330, lng: -122.3089 },
  "langley": { lat: 49.1044, lng: -122.5827 },
  "surrey": { lat: 49.1044, lng: -122.8011 },
  "richmond": { lat: 49.1666, lng: -123.1336 },
  "burnaby": { lat: 49.2488, lng: -122.9805 },
  "coquitlam": { lat: 49.2838, lng: -122.7932 },
  "north vancouver": { lat: 49.3165, lng: -123.0688 },
  "west vancouver": { lat: 49.3272, lng: -123.1663 },
  "new westminster": { lat: 49.2069, lng: -122.9110 },
  "port moody": { lat: 49.2789, lng: -122.8567 },
  "maple ridge": { lat: 49.2193, lng: -122.5985 },
  "white rock": { lat: 49.0252, lng: -122.8026 },
  "delta": { lat: 49.0847, lng: -123.0587 },
  "pitt meadows": { lat: 49.2216, lng: -122.6894 },
  "hope": { lat: 49.3858, lng: -121.4419 },
  "agassiz": { lat: 49.2333, lng: -121.7500 },
  "aldergrove": { lat: 49.0556, lng: -122.4711 },
  "fort langley": { lat: 49.1694, lng: -122.5775 },
  "parksville": { lat: 49.3150, lng: -124.3150 },
  "qualicum beach": { lat: 49.3542, lng: -124.4397 },
  "port alberni": { lat: 49.2339, lng: -124.8055 },
  "tofino": { lat: 49.1530, lng: -125.9066 },
  "ucluelet": { lat: 48.9422, lng: -125.5461 },
  "courtenay": { lat: 49.6841, lng: -124.9936 },
  "comox": { lat: 49.6733, lng: -124.9022 },
  "cumberland": { lat: 49.6178, lng: -125.0283 },
  "campbell river": { lat: 50.0244, lng: -125.2475 },
  "port hardy": { lat: 50.7256, lng: -127.4969 },
  "port mcneill": { lat: 50.5878, lng: -127.0856 },
  "duncan": { lat: 48.7787, lng: -123.7079 },
  "ladysmith": { lat: 48.9975, lng: -123.8203 },
  "chemainus": { lat: 48.9267, lng: -123.7144 },
  "sooke": { lat: 48.3724, lng: -123.7262 },
  "sidney": { lat: 48.6500, lng: -123.3986 },
  "salt spring island": { lat: 48.8167, lng: -123.4833 },
  "langford": { lat: 48.4500, lng: -123.5058 },
  "colwood": { lat: 48.4236, lng: -123.4958 },
  "esquimalt": { lat: 48.4322, lng: -123.4139 },
  "saanich": { lat: 48.4843, lng: -123.3815 },
  "oak bay": { lat: 48.4264, lng: -123.3173 },
  "vernon": { lat: 50.2671, lng: -119.2720 },
  "penticton": { lat: 49.4991, lng: -119.5937 },
  "west kelowna": { lat: 49.8625, lng: -119.5833 },
  "summerland": { lat: 49.6006, lng: -119.6778 },
  "oliver": { lat: 49.1828, lng: -119.5502 },
  "osoyoos": { lat: 49.0333, lng: -119.4667 },
  "lake country": { lat: 50.0500, lng: -119.4167 },
  "armstrong": { lat: 50.4483, lng: -119.2008 },
  "enderby": { lat: 50.5500, lng: -119.1400 },
  "revelstoke": { lat: 50.9981, lng: -118.1957 },
  "salmon arm": { lat: 50.7001, lng: -119.2838 },
  "golden": { lat: 51.2978, lng: -116.9634 },
  "invermere": { lat: 50.5083, lng: -116.0333 },
  "peachland": { lat: 49.7667, lng: -119.7333 },
  "keremeos": { lat: 49.2000, lng: -119.8333 },
  "princeton": { lat: 49.4589, lng: -120.5064 },
  "merritt": { lat: 50.1113, lng: -120.7862 },
};

function extractCity(address: string): string | null {
  if (!address) return null;
  const addressLower = address.toLowerCase();
  for (const city of Object.keys(CITY_COORDS)) {
    if (addressLower.includes(city)) {
      return city;
    }
  }
  return null;
}

function getCoords(city: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  return CITY_COORDS[city.toLowerCase()] || null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

async function scrapeLibrarySystem(url: string, systemName: string): Promise<ScrapedSystem> {
  console.log(`\nScraping ${systemName} from ${url}...`);
  
  try {
    const result = await firecrawl.scrapeUrl(url, {
      formats: ["extract"],
      extract: {
        schema: {
          type: "object",
          properties: {
            branches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Branch/library name" },
                  address: { type: "string", description: "Full street address" },
                  city: { type: "string", description: "City name" },
                  phone: { type: "string", description: "Phone number" },
                  hours: { type: "string", description: "Operating hours" },
                  postal_code: { type: "string", description: "Postal code" }
                },
                required: ["name"]
              }
            }
          },
          required: ["branches"]
        },
        prompt: "Extract all library branch locations with their names, addresses, cities, phone numbers, hours, and postal codes. Include ALL branches listed on this page."
      }
    });

    const extracted = (result as any).extract;
    const branches = extracted?.branches || [];
    
    console.log(`  Found ${branches.length} branches`);
    
    return {
      system_name: systemName,
      branches: branches
    };
  } catch (error) {
    console.error(`  Error scraping ${systemName}:`, error);
    return { system_name: systemName, branches: [] };
  }
}

async function importScrapedLibraries() {
  console.log("Starting library scraping and import...\n");
  
  const systems = [
    { url: "https://www.vpl.ca/branches", name: "Vancouver Public Library" },
    { url: "https://virl.bc.ca/branches", name: "Vancouver Island Regional Library" },
    { url: "https://www.orl.bc.ca/hours-locations", name: "Okanagan Regional Library" },
    { url: "https://www.fvrl.bc.ca/locations", name: "Fraser Valley Regional Library" },
    { url: "https://www.gvpl.ca/using-the-library/locations-hours/", name: "Greater Victoria Public Library" },
  ];
  
  const allBranches: Array<LibraryBranch & { system: string }> = [];
  
  for (const sys of systems) {
    const result = await scrapeLibrarySystem(sys.url, sys.name);
    for (const branch of result.branches) {
      allBranches.push({ ...branch, system: result.system_name });
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`\nTotal branches scraped: ${allBranches.length}`);
  
  // Import to database
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const branch of allBranches) {
      if (!branch.name) {
        skipped++;
        continue;
      }
      
      const slug = generateSlug(`${branch.system} ${branch.name}`);
      const city = branch.city || extractCity(branch.address || '');
      const coords = getCoords(city);
      
      // Check if exists
      const exists = await client.query(
        "SELECT id FROM entities WHERE slug = $1",
        [slug]
      );
      
      if (exists.rows.length > 0) {
        // Update existing
        await client.query(`
          UPDATE entities SET
            phone = COALESCE($2, phone),
            address_line1 = COALESCE($3, address_line1),
            city = COALESCE($4, city),
            postal_code = COALESCE($5, postal_code),
            configuration = configuration || $6::jsonb
          WHERE slug = $1
        `, [
          slug,
          branch.phone?.substring(0, 30) || null,
          branch.address || null,
          city || null,
          branch.postal_code || null,
          JSON.stringify({ hours: branch.hours })
        ]);
        updated++;
      } else {
        // Insert new
        await client.query(`
          INSERT INTO entities (
            slug, name, entity_type_id,
            latitude, longitude,
            phone, address_line1, city, postal_code,
            configuration
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          slug,
          branch.name,
          'library',
          coords?.lat || 54.0,
          coords?.lng || -125.0,
          branch.phone?.substring(0, 30) || null,
          branch.address || null,
          city || null,
          branch.postal_code || null,
          JSON.stringify({
            library_system: branch.system,
            branch_type: branch.name.toLowerCase().includes('central') || branch.name.toLowerCase().includes('main') ? 'main' : 'branch',
            hours: branch.hours
          })
        ]);
        imported++;
      }
    }
    
    await client.query("COMMIT");
    
    console.log(`\nImport complete!`);
    console.log(`  New: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    
    // Verification
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM entities WHERE entity_type_id = 'library'
    `);
    console.log(`  Total libraries: ${countResult.rows[0].total}`);
    
    // Distribution by system
    const distResult = await client.query(`
      SELECT 
        configuration->>'library_system' as system,
        COUNT(*) as branches
      FROM entities
      WHERE entity_type_id = 'library'
      GROUP BY configuration->>'library_system'
      ORDER BY branches DESC
      LIMIT 15
    `);
    
    console.log(`\nDistribution by library system:`);
    for (const row of distResult.rows) {
      console.log(`  ${row.system}: ${row.branches}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error importing:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importScrapedLibraries().catch(console.error);

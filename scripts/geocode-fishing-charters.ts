import { pool } from "../server/db";

// Port/city to coordinates mapping
const PORT_COORDINATES: Record<string, { lat: number; lng: number; region?: string }> = {
  "bamfield": { lat: 48.8333, lng: -125.1350, region: "alberni-clayoquot" },
  "tofino": { lat: 49.1530, lng: -125.9066, region: "alberni-clayoquot" },
  "ucluelet": { lat: 48.9422, lng: -125.5461, region: "alberni-clayoquot" },
  "port alberni": { lat: 49.2339, lng: -124.8055, region: "alberni-clayoquot" },
  "campbell river": { lat: 50.0244, lng: -125.2475, region: "strathcona" },
  "port hardy": { lat: 50.7256, lng: -127.4969, region: "mount-waddington" },
  "victoria": { lat: 48.4284, lng: -123.3656, region: "capital" },
  "nanaimo": { lat: 49.1659, lng: -123.9401, region: "nanaimo" },
  "prince rupert": { lat: 54.3150, lng: -130.3208, region: "north-coast" },
  "sooke": { lat: 48.3724, lng: -123.7262, region: "capital" },
  "sidney": { lat: 48.6500, lng: -123.3986, region: "capital" },
  "north vancouver": { lat: 49.3165, lng: -123.0688, region: "metro-vancouver" },
  "vancouver": { lat: 49.2827, lng: -123.1207, region: "metro-vancouver" },
  "richmond": { lat: 49.1666, lng: -123.1336, region: "metro-vancouver" },
  "delta": { lat: 49.0847, lng: -123.0587, region: "metro-vancouver" },
  "steveston": { lat: 49.1253, lng: -123.1822, region: "metro-vancouver" },
  "ladner": { lat: 49.0894, lng: -123.0823, region: "metro-vancouver" },
  "squamish": { lat: 49.7016, lng: -123.1558, region: "squamish-lillooet" },
  "gibsons": { lat: 49.4020, lng: -123.5058, region: "sunshine-coast" },
  "sechelt": { lat: 49.4742, lng: -123.7545, region: "sunshine-coast" },
  "powell river": { lat: 49.8353, lng: -124.5247, region: "powell-river" },
  "comox": { lat: 49.6733, lng: -124.9022, region: "comox-valley" },
  "courtenay": { lat: 49.6841, lng: -124.9936, region: "comox-valley" },
  "qualicum beach": { lat: 49.3542, lng: -124.4397, region: "nanaimo" },
  "parksville": { lat: 49.3150, lng: -124.3150, region: "nanaimo" },
  "mill bay": { lat: 48.6450, lng: -123.5533, region: "cowichan-valley" },
  "duncan": { lat: 48.7787, lng: -123.7079, region: "cowichan-valley" },
  "cowichan bay": { lat: 48.7356, lng: -123.6150, region: "cowichan-valley" },
  "chemainus": { lat: 48.9267, lng: -123.7144, region: "cowichan-valley" },
  "ladysmith": { lat: 48.9975, lng: -123.8203, region: "cowichan-valley" },
  "lantzville": { lat: 49.2506, lng: -124.0572, region: "nanaimo" },
  "gabriola island": { lat: 49.1667, lng: -123.7833, region: "nanaimo" },
  "salt spring island": { lat: 48.8167, lng: -123.4833, region: "capital" },
  "pender island": { lat: 48.7667, lng: -123.2833, region: "capital" },
  "galiano island": { lat: 48.9333, lng: -123.3833, region: "capital" },
  "mayne island": { lat: 48.8500, lng: -123.2833, region: "capital" },
  "saturna island": { lat: 48.7833, lng: -123.1500, region: "capital" },
  "bowen island": { lat: 49.3833, lng: -123.3333, region: "metro-vancouver" },
  "haida gwaii": { lat: 53.2500, lng: -132.0833, region: "north-coast" },
  "queen charlotte": { lat: 53.2561, lng: -132.0761, region: "north-coast" },
  "masset": { lat: 54.0167, lng: -132.1500, region: "north-coast" },
  "kitimat": { lat: 54.0522, lng: -128.6536, region: "kitimat-stikine" },
  "terrace": { lat: 54.5164, lng: -128.6031, region: "kitimat-stikine" },
  "bella coola": { lat: 52.3697, lng: -126.7550, region: "central-coast" },
  "gold river": { lat: 49.6817, lng: -126.1133, region: "strathcona" },
  "zeballos": { lat: 49.9817, lng: -126.8433, region: "strathcona" },
  "tahsis": { lat: 49.9167, lng: -126.6500, region: "strathcona" },
  "port mcneill": { lat: 50.5878, lng: -127.0856, region: "mount-waddington" },
  "alert bay": { lat: 50.5864, lng: -126.9319, region: "mount-waddington" },
  "port alice": { lat: 50.3833, lng: -127.4500, region: "mount-waddington" },
  "aldergrove": { lat: 49.0556, lng: -122.4711, region: "fraser-valley" },
  // Fallbacks for broader regions
  "vancouver island": { lat: 49.5, lng: -125.5, region: "vancouver-island" },
  "british columbia": { lat: 54.0, lng: -125.0, region: "bc" },
};

function extractCity(location: string): string | null {
  if (!location) return null;
  // Get first part before comma and clean it
  const parts = location.split(',');
  return parts[0]?.trim().toLowerCase() || null;
}

function findCoordinates(location: string): { lat: number; lng: number; region?: string } | null {
  if (!location) return null;
  
  const cityName = extractCity(location);
  if (!cityName) return null;
  
  // Direct match
  if (PORT_COORDINATES[cityName]) {
    return PORT_COORDINATES[cityName];
  }
  
  // Check if location contains any known port name
  const locationLower = location.toLowerCase();
  for (const [port, coords] of Object.entries(PORT_COORDINATES)) {
    if (locationLower.includes(port)) {
      return coords;
    }
  }
  
  // Fallback to Vancouver Island or BC
  if (locationLower.includes("vancouver island") || locationLower.includes("vi")) {
    return PORT_COORDINATES["vancouver island"];
  }
  if (locationLower.includes("british columbia") || locationLower.includes("bc")) {
    return PORT_COORDINATES["british columbia"];
  }
  
  return null;
}

async function geocodeFishingCharters() {
  console.log("Starting fishing charter geocoding...");
  
  const client = await pool.connect();
  
  try {
    // Get all fishing charters
    const result = await client.query(`
      SELECT id, name, city, configuration->>'home_port' as home_port
      FROM entities
      WHERE entity_type_id = 'fishing-charter'
    `);
    
    console.log(`Found ${result.rows.length} fishing charters to geocode`);
    
    await client.query("BEGIN");
    
    let geocoded = 0;
    let failed = 0;
    
    for (const charter of result.rows) {
      const location = charter.home_port || charter.city;
      const coords = findCoordinates(location);
      
      if (coords) {
        await client.query(`
          UPDATE entities
          SET 
            latitude = $1,
            longitude = $2,
            configuration = configuration || $3::jsonb
          WHERE id = $4
        `, [
          coords.lat,
          coords.lng,
          JSON.stringify({ primary_port: location, service_region: coords.region }),
          charter.id
        ]);
        geocoded++;
      } else {
        failed++;
        if (failed <= 10) {
          console.log(`  Could not geocode: ${charter.name} - "${location}"`);
        }
      }
    }
    
    await client.query("COMMIT");
    
    console.log(`\nGeocoding complete!`);
    console.log(`  Geocoded: ${geocoded}`);
    console.log(`  Failed: ${failed}`);
    
    // Verification
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(latitude) as geocoded,
        ROUND(100.0 * COUNT(latitude) / COUNT(*), 1) as pct
      FROM entities 
      WHERE entity_type_id = 'fishing-charter'
    `);
    
    const row = verifyResult.rows[0];
    console.log(`\nVerification:`);
    console.log(`  Total: ${row.total}`);
    console.log(`  Geocoded: ${row.geocoded}`);
    console.log(`  Coverage: ${row.pct}%`);
    
    // Distribution by city
    const distResult = await client.query(`
      SELECT 
        city,
        COUNT(*) as charters
      FROM entities
      WHERE entity_type_id = 'fishing-charter'
      AND latitude IS NOT NULL
      GROUP BY city
      ORDER BY charters DESC
      LIMIT 15
    `);
    
    console.log(`\nDistribution by location:`);
    for (const row of distResult.rows) {
      console.log(`  ${row.city || 'Unknown'}: ${row.charters}`);
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error geocoding:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

geocodeFishingCharters().catch(console.error);

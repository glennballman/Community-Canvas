import { pool } from "../server/db";

// Build city name to coordinates mapping
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Vancouver Island - South
  "victoria": { lat: 48.4284, lng: -123.3656 },
  "saanich": { lat: 48.4843, lng: -123.3815 },
  "saanich peninsula": { lat: 48.5833, lng: -123.4167 },
  "oak bay": { lat: 48.4264, lng: -123.3173 },
  "esquimalt": { lat: 48.4322, lng: -123.4139 },
  "langford": { lat: 48.4500, lng: -123.5058 },
  "colwood": { lat: 48.4236, lng: -123.4958 },
  "metchosin": { lat: 48.3817, lng: -123.5372 },
  "sooke": { lat: 48.3724, lng: -123.7262 },
  "sidney": { lat: 48.6500, lng: -123.3986 },
  "central saanich": { lat: 48.5333, lng: -123.3833 },
  "north saanich": { lat: 48.6167, lng: -123.4167 },
  "view royal": { lat: 48.4519, lng: -123.4336 },
  "highlands": { lat: 48.4833, lng: -123.5000 },
  
  // Cowichan Valley
  "duncan": { lat: 48.7787, lng: -123.7079 },
  "north cowichan": { lat: 48.8333, lng: -123.7333 },
  "lake cowichan": { lat: 48.8261, lng: -124.0533 },
  "cowichan bay": { lat: 48.7356, lng: -123.6150 },
  "ladysmith": { lat: 48.9975, lng: -123.8203 },
  "chemainus": { lat: 48.9267, lng: -123.7144 },
  
  // Nanaimo Region
  "nanaimo": { lat: 49.1659, lng: -123.9401 },
  "lantzville": { lat: 49.2506, lng: -124.0572 },
  "parksville": { lat: 49.3150, lng: -124.3150 },
  "qualicum beach": { lat: 49.3542, lng: -124.4397 },
  "gabriola island": { lat: 49.1667, lng: -123.7833 },
  
  // Alberni-Clayoquot
  "port alberni": { lat: 49.2339, lng: -124.8055 },
  "tofino": { lat: 49.1530, lng: -125.9066 },
  "ucluelet": { lat: 48.9422, lng: -125.5461 },
  "bamfield": { lat: 48.8333, lng: -125.1350 },
  
  // Comox Valley
  "courtenay": { lat: 49.6841, lng: -124.9936 },
  "comox": { lat: 49.6733, lng: -124.9022 },
  "cumberland": { lat: 49.6178, lng: -125.0283 },
  
  // Strathcona
  "campbell river": { lat: 50.0244, lng: -125.2475 },
  "gold river": { lat: 49.6817, lng: -126.1133 },
  "tahsis": { lat: 49.9167, lng: -126.6500 },
  "zeballos": { lat: 49.9817, lng: -126.8433 },
  "sayward": { lat: 50.3833, lng: -125.9500 },
  
  // Mount Waddington
  "port hardy": { lat: 50.7256, lng: -127.4969 },
  "port mcneill": { lat: 50.5878, lng: -127.0856 },
  "port alice": { lat: 50.3833, lng: -127.4500 },
  "alert bay": { lat: 50.5864, lng: -126.9319 },
  
  // Gulf Islands
  "salt spring island": { lat: 48.8167, lng: -123.4833 },
  "pender island": { lat: 48.7667, lng: -123.2833 },
  "galiano island": { lat: 48.9333, lng: -123.3833 },
  "mayne island": { lat: 48.8500, lng: -123.2833 },
  "saturna island": { lat: 48.7833, lng: -123.1500 },
  
  // Metro Vancouver
  "vancouver": { lat: 49.2827, lng: -123.1207 },
  "burnaby": { lat: 49.2488, lng: -122.9805 },
  "richmond": { lat: 49.1666, lng: -123.1336 },
  "surrey": { lat: 49.1044, lng: -122.8011 },
  "delta": { lat: 49.0847, lng: -123.0587 },
  "north vancouver": { lat: 49.3165, lng: -123.0688 },
  "west vancouver": { lat: 49.3272, lng: -123.1663 },
  "new westminster": { lat: 49.2069, lng: -122.9110 },
  "coquitlam": { lat: 49.2838, lng: -122.7932 },
  "port coquitlam": { lat: 49.2628, lng: -122.7811 },
  "port moody": { lat: 49.2789, lng: -122.8567 },
  "maple ridge": { lat: 49.2193, lng: -122.5985 },
  "pitt meadows": { lat: 49.2216, lng: -122.6894 },
  "langley": { lat: 49.1044, lng: -122.5827 },
  "white rock": { lat: 49.0252, lng: -122.8026 },
  "lions bay": { lat: 49.4500, lng: -123.2333 },
  "bowen island": { lat: 49.3833, lng: -123.3333 },
  
  // Fraser Valley
  "abbotsford": { lat: 49.0504, lng: -122.3045 },
  "chilliwack": { lat: 49.1579, lng: -121.9514 },
  "mission": { lat: 49.1330, lng: -122.3089 },
  "hope": { lat: 49.3858, lng: -121.4419 },
  "harrison hot springs": { lat: 49.2833, lng: -121.7833 },
  "agassiz": { lat: 49.2333, lng: -121.7500 },
  
  // Sea-to-Sky
  "squamish": { lat: 49.7016, lng: -123.1558 },
  "whistler": { lat: 50.1163, lng: -122.9574 },
  "pemberton": { lat: 50.3165, lng: -122.8028 },
  
  // Sunshine Coast
  "gibsons": { lat: 49.4020, lng: -123.5058 },
  "sechelt": { lat: 49.4742, lng: -123.7545 },
  "powell river": { lat: 49.8353, lng: -124.5247 },
  
  // Okanagan
  "kelowna": { lat: 49.8863, lng: -119.4966 },
  "west kelowna": { lat: 49.8625, lng: -119.5833 },
  "penticton": { lat: 49.4991, lng: -119.5937 },
  "vernon": { lat: 50.2671, lng: -119.2720 },
  "summerland": { lat: 49.6006, lng: -119.6778 },
  "oliver": { lat: 49.1828, lng: -119.5502 },
  "osoyoos": { lat: 49.0333, lng: -119.4667 },
  "lake country": { lat: 50.0500, lng: -119.4167 },
  "peachland": { lat: 49.7667, lng: -119.7333 },
  
  // Thompson-Nicola
  "kamloops": { lat: 50.6745, lng: -120.3273 },
  "merritt": { lat: 50.1113, lng: -120.7862 },
  "chase": { lat: 50.8190, lng: -119.6847 },
  "clearwater": { lat: 51.6500, lng: -120.0333 },
  
  // Kootenays
  "nelson": { lat: 49.4928, lng: -117.2948 },
  "castlegar": { lat: 49.3256, lng: -117.6661 },
  "trail": { lat: 49.0967, lng: -117.7117 },
  "rossland": { lat: 49.0833, lng: -117.8000 },
  "cranbrook": { lat: 49.5097, lng: -115.7693 },
  "kimberley": { lat: 49.6697, lng: -115.9778 },
  "fernie": { lat: 49.5042, lng: -115.0631 },
  "creston": { lat: 49.0956, lng: -116.5133 },
  "invermere": { lat: 50.5083, lng: -116.0333 },
  "revelstoke": { lat: 50.9981, lng: -118.1957 },
  "golden": { lat: 51.2978, lng: -116.9634 },
  
  // Northern BC
  "prince george": { lat: 53.9171, lng: -122.7497 },
  "prince rupert": { lat: 54.3150, lng: -130.3208 },
  "terrace": { lat: 54.5164, lng: -128.6031 },
  "kitimat": { lat: 54.0522, lng: -128.6536 },
  "smithers": { lat: 54.7817, lng: -127.1667 },
  "burns lake": { lat: 54.2300, lng: -125.7600 },
  "vanderhoof": { lat: 54.0167, lng: -124.0000 },
  "quesnel": { lat: 52.9784, lng: -122.4934 },
  "williams lake": { lat: 52.1417, lng: -122.1417 },
  "100 mile house": { lat: 51.6417, lng: -121.2917 },
  "fort st john": { lat: 56.2465, lng: -120.8476 },
  "dawson creek": { lat: 55.7596, lng: -120.2377 },
  "fort nelson": { lat: 58.8050, lng: -122.7002 },
  "mackenzie": { lat: 55.3333, lng: -123.1000 },
  "haida gwaii": { lat: 53.2500, lng: -132.0833 },
  "queen charlotte": { lat: 53.2561, lng: -132.0761 },
  "masset": { lat: 54.0167, lng: -132.1500 },
  "bella coola": { lat: 52.3697, lng: -126.7550 },
  
  // Fallbacks
  "greater victoria": { lat: 48.4284, lng: -123.3656 },
  "cowichan valley": { lat: 48.7787, lng: -123.7079 },
  "capital regional district": { lat: 48.4284, lng: -123.3656 },
};

function normalizeCity(city: string): string {
  return city.toLowerCase().trim()
    .replace(/^city of /, '')
    .replace(/^district of /, '')
    .replace(/^corporation of /, '')
    .replace(/^town of /, '')
    .replace(/^village of /, '');
}

async function geocodeBusinesses() {
  console.log("Starting business geocoding...");
  
  const client = await pool.connect();
  
  try {
    // Get all businesses without coordinates
    const result = await client.query(`
      SELECT id, name, city
      FROM entities
      WHERE entity_type_id = 'business'
      AND latitude IS NULL
      AND city IS NOT NULL
    `);
    
    console.log(`Found ${result.rows.length} businesses to geocode`);
    
    await client.query("BEGIN");
    
    let geocoded = 0;
    let failed = 0;
    const failedCities = new Map<string, number>();
    
    const BATCH_SIZE = 500;
    const batches = Math.ceil(result.rows.length / BATCH_SIZE);
    
    for (let batch = 0; batch < batches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, result.rows.length);
      const batchBusinesses = result.rows.slice(start, end);
      
      for (const business of batchBusinesses) {
        const normalizedCity = normalizeCity(business.city);
        const coords = CITY_COORDS[normalizedCity];
        
        if (coords) {
          await client.query(`
            UPDATE entities
            SET 
              latitude = $1,
              longitude = $2,
              configuration = COALESCE(configuration, '{}'::jsonb) || '{"geocode_precision": "municipality"}'::jsonb
            WHERE id = $3
          `, [coords.lat, coords.lng, business.id]);
          geocoded++;
        } else {
          failed++;
          failedCities.set(business.city, (failedCities.get(business.city) || 0) + 1);
        }
      }
      
      console.log(`  Batch ${batch + 1}/${batches} complete (${geocoded} geocoded, ${failed} failed)`);
    }
    
    await client.query("COMMIT");
    
    console.log(`\nGeocoding complete!`);
    console.log(`  Geocoded: ${geocoded}`);
    console.log(`  Failed: ${failed}`);
    
    if (failedCities.size > 0) {
      console.log(`\nTop unmapped cities:`);
      const sortedFailed = [...failedCities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [city, count] of sortedFailed) {
        console.log(`  "${city}": ${count}`);
      }
    }
    
    // Verification
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(latitude) as geocoded,
        ROUND(100.0 * COUNT(latitude) / COUNT(*), 1) as pct
      FROM entities 
      WHERE entity_type_id = 'business'
    `);
    
    const row = verifyResult.rows[0];
    console.log(`\nVerification:`);
    console.log(`  Total businesses: ${row.total}`);
    console.log(`  Geocoded: ${row.geocoded}`);
    console.log(`  Coverage: ${row.pct}%`);
    
    // Precision check
    const precisionResult = await client.query(`
      SELECT 
        configuration->>'geocode_precision' as precision,
        COUNT(*) as count
      FROM entities 
      WHERE entity_type_id = 'business'
      AND configuration->>'geocode_precision' IS NOT NULL
      GROUP BY configuration->>'geocode_precision'
    `);
    
    console.log(`\nGeocoding precision:`);
    for (const row of precisionResult.rows) {
      console.log(`  ${row.precision}: ${row.count}`);
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

geocodeBusinesses().catch(console.error);

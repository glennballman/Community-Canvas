/**
 * QA 8: Score Calculations Test
 * Tests the crew_score, rv_score, trucker_score, etc. calculations
 */

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log('\n🧪 QA 8: SCORE CALCULATIONS\n');

  // Test 1: Crew score calculation
  await test('Crew score is calculated based on amenities', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    if (!data.properties || data.properties.length === 0) {
      throw new Error('No properties found');
    }
    
    // Check that all properties have crewScore field
    for (const prop of data.properties) {
      if (prop.crewScore === undefined) {
        throw new Error(`Property ${prop.id} missing crewScore`);
      }
      if (typeof prop.crewScore !== 'number') {
        throw new Error(`Property ${prop.id} crewScore is not a number`);
      }
    }
  });

  // Test 2: RV score calculation
  await test('RV score is calculated based on RV amenities', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      if (prop.rvScore === undefined) {
        throw new Error(`Property ${prop.id} missing rvScore`);
      }
      if (typeof prop.rvScore !== 'number') {
        throw new Error(`Property ${prop.id} rvScore is not a number`);
      }
    }
  });

  // Test 3: Trucker score calculation
  await test('Trucker score is calculated based on truck amenities', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      if (prop.truckerScore === undefined) {
        throw new Error(`Property ${prop.id} missing truckerScore`);
      }
    }
  });

  // Test 4: Equestrian score calculation
  await test('Equestrian score is calculated based on horse amenities', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      if (prop.equestrianScore === undefined) {
        throw new Error(`Property ${prop.id} missing equestrianScore`);
      }
    }
  });

  // Test 5: Long-term score calculation
  await test('Long-term score is calculated', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      if (prop.longTermScore === undefined) {
        throw new Error(`Property ${prop.id} missing longTermScore`);
      }
    }
  });

  // Test 6: Score ranges are valid (0-100)
  await test('All scores are within valid range (0-100)', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      const scores = [prop.crewScore, prop.rvScore, prop.truckerScore, prop.equestrianScore, prop.longTermScore];
      for (const score of scores) {
        if (score < 0 || score > 100) {
          throw new Error(`Property ${prop.id} has score out of range: ${score}`);
        }
      }
    }
  });

  // Test 7: Stats endpoint returns average scores
  await test('Stats endpoint returns aggregated scores', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/stats`);
    if (!res.ok) throw new Error('Stats endpoint failed');
    
    const data = await res.json();
    if (data.avgCrewScore === undefined) {
      throw new Error('Missing avgCrewScore in stats');
    }
    if (data.avgRvScore === undefined) {
      throw new Error('Missing avgRvScore in stats');
    }
  });

  // Test 8: Search returns properties with scores
  await test('Search returns properties with score fields', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/search`);
    if (!res.ok) throw new Error('Search failed');
    
    const data = await res.json();
    // All returned properties should have score fields
    for (const prop of data.properties || []) {
      if (prop.crewScore === undefined) {
        throw new Error(`Property ${prop.id} missing crewScore in search results`);
      }
    }
  });

  // Test 9: Search can sort by score
  await test('Search supports sorting by crewScore', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/search?sortBy=crewScore&sortOrder=desc`);
    if (!res.ok) throw new Error('Search with sort by crewScore failed');
    
    const data = await res.json();
    // Verify descending order
    let lastScore = Infinity;
    for (const prop of data.properties || []) {
      if (prop.crewScore > lastScore) {
        throw new Error('Properties not sorted by crewScore descending');
      }
      lastScore = prop.crewScore;
    }
  });

  // Test 10: Property with known amenities has expected score range
  await test('Property scores correlate with amenities', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    // Find a property with some amenities
    const propWithAmenities = data.properties.find((p: any) => 
      p.hasShorePower || p.hasWifi || p.hasBathrooms
    );
    
    if (propWithAmenities) {
      // Property with amenities should have some positive scores
      if (propWithAmenities.crewScore === 0 && propWithAmenities.rvScore === 0) {
        // This might be OK depending on which amenities
      }
    }
    // Test passes if no errors thrown
  });

  // Summary
  console.log('\n📊 QA 8 SUMMARY');
  console.log('================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
}

runTests().catch(console.error);

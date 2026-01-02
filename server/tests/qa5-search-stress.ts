/**
 * QA 5: Search Stress Test
 * Tests search performance and edge cases
 */

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  duration?: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: error.message });
    console.log(`❌ ${name}: ${error.message} (${duration}ms)`);
  }
}

async function runTests() {
  console.log('\n🧪 QA 5: SEARCH STRESS TEST\n');

  // Test 1: Basic search performance
  await test('Basic search < 500ms', async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/api/staging/search`);
    const duration = Date.now() - start;
    
    if (!res.ok) throw new Error('Search failed');
    if (duration > 500) throw new Error(`Too slow: ${duration}ms`);
    
    const data = await res.json();
    if (!Array.isArray(data.properties)) throw new Error('Invalid response');
  });

  // Test 2: Search with all filters
  await test('Search with all filters < 1000ms', async () => {
    const params = new URLSearchParams({
      vehicleLengthFt: '40',
      needsPower: 'true',
      powerAmps: '30',
      needsWater: 'true',
      needsSewer: 'true',
      region: 'Vancouver Island',
      sortBy: 'rv_score',
      limit: '20'
    });
    
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/api/staging/search?${params}`);
    const duration = Date.now() - start;
    
    if (!res.ok) throw new Error('Search failed');
    if (duration > 1000) throw new Error(`Too slow: ${duration}ms`);
  });

  // Test 3: Concurrent searches (simulate multiple users)
  await test('5 concurrent searches complete', async () => {
    const searches = [
      fetch(`${BASE_URL}/api/staging/search?sortBy=rv_score`),
      fetch(`${BASE_URL}/api/staging/search?sortBy=crew_score`),
      fetch(`${BASE_URL}/api/staging/search?sortBy=trucker_score`),
      fetch(`${BASE_URL}/api/staging/search?needsPower=true`),
      fetch(`${BASE_URL}/api/staging/search?region=Vancouver%20Island`)
    ];
    
    const responses = await Promise.all(searches);
    
    for (const res of responses) {
      if (!res.ok) throw new Error('One of the searches failed');
    }
  });

  // Test 4: Pagination works correctly
  await test('Pagination returns different results', async () => {
    const page1 = await fetch(`${BASE_URL}/api/staging/search?limit=2&offset=0`);
    const page2 = await fetch(`${BASE_URL}/api/staging/search?limit=2&offset=2`);
    
    const data1 = await page1.json();
    const data2 = await page2.json();
    
    // If we have enough properties, pages should be different
    if (data1.properties.length > 0 && data2.properties.length > 0) {
      if (data1.properties[0]?.id === data2.properties[0]?.id) {
        throw new Error('Pagination returned same first result');
      }
    }
  });

  // Test 5: Empty results handled gracefully
  await test('Empty results return valid response', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/search?vehicleLengthFt=9999`);
    
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    
    if (!Array.isArray(data.properties)) throw new Error('Invalid response structure');
    // Empty is OK
  });

  // Test 6: Invalid filter values don't crash
  await test('Invalid filter values handled gracefully', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/search?vehicleLengthFt=not-a-number`);
    
    // Should either work (ignore invalid) or return 400, not 500
    if (res.status === 500) throw new Error('Server crashed on invalid input');
  });

  // Test 7: Large offset handled
  await test('Large offset returns empty results', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/search?offset=10000`);
    
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    
    if (!Array.isArray(data.properties)) throw new Error('Invalid response');
    // Should be empty but not error
  });

  // Test 8: All sort options work
  await test('All sort options work', async () => {
    const sortOptions = ['rv_score', 'crew_score', 'trucker_score', 'equestrian_score', 'rating', 'price_low', 'price_high'];
    
    for (const sortBy of sortOptions) {
      const res = await fetch(`${BASE_URL}/api/staging/search?sortBy=${sortBy}`);
      if (!res.ok) throw new Error(`Sort by ${sortBy} failed`);
    }
  });

  // Test 9: Boolean filters work correctly
  await test('Boolean filters work correctly', async () => {
    const filters = [
      'needsPower=true',
      'needsWater=true',
      'needsSewer=true',
      'needsPullThrough=true',
      'isHorseFriendly=true',
      'acceptsSemi=true',
      'hasMechanic=true',
      'dogsAllowed=true'
    ];
    
    for (const filter of filters) {
      const res = await fetch(`${BASE_URL}/api/staging/search?${filter}`);
      if (!res.ok) throw new Error(`Filter ${filter} failed`);
    }
  });

  // Test 10: Rapid-fire searches (rate limit test)
  await test('20 rapid searches complete without error', async () => {
    const searches = Array(20).fill(null).map((_, i) => 
      fetch(`${BASE_URL}/api/staging/search?offset=${i}`)
    );
    
    const responses = await Promise.all(searches);
    const errors = responses.filter(r => !r.ok);
    
    if (errors.length > 0) {
      throw new Error(`${errors.length} searches failed`);
    }
  });

  // Summary
  console.log('\n📊 QA 5 SUMMARY');
  console.log('================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const avgDuration = Math.round(results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length);
  
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Average duration: ${avgDuration}ms`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
}

runTests().catch(console.error);

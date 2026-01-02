/**
 * QA 7: Service Providers Test
 * Tests service provider CRUD and search
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
  console.log('\n🧪 QA 7: SERVICE PROVIDERS\n');

  // Get first active property
  const propsRes = await fetch(`${BASE_URL}/api/staging/properties`);
  const propsData = await propsRes.json();
  
  if (!propsData.properties || propsData.properties.length === 0) {
    console.error('❌ No properties found');
    return;
  }
  
  const propertyId = propsData.properties[0].id;
  console.log(`Using property ID: ${propertyId}\n`);

  let createdProviderId: number | null = null;

  // Test 1: List all providers
  await test('List all providers', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/providers`);
    
    if (!res.ok) throw new Error('Failed to list providers');
    const data = await res.json();
    
    if (!Array.isArray(data.providers)) throw new Error('Invalid response structure');
    if (typeof data.total !== 'number') throw new Error('Missing total count');
  });

  // Test 2: Get providers for property
  await test('Get providers for property', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties/${propertyId}/providers`);
    
    if (!res.ok) throw new Error('Failed to get property providers');
    const data = await res.json();
    
    if (!Array.isArray(data.providers)) throw new Error('Invalid response structure');
  });

  // Test 3: Create provider for property
  await test('Create provider for property', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties/${propertyId}/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerName: 'Test Mechanic Service',
        providerType: 'mechanic',
        businessName: 'Johns Auto Shop',
        phone: '250-555-1234',
        email: 'john@mechanic.com',
        servicesOffered: ['oil change', 'tire repair', 'brake service'],
        available_24hr: true,
        isActive: true
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create provider');
    }
    
    const data = await res.json();
    if (!data.id) throw new Error('No provider ID returned');
    
    createdProviderId = data.id;
  });

  // Test 4: Get provider by ID
  await test('Get provider by ID', async () => {
    if (!createdProviderId) throw new Error('No provider created to test');
    
    const res = await fetch(`${BASE_URL}/api/staging/providers/${createdProviderId}`);
    
    if (!res.ok) throw new Error('Failed to get provider');
    const data = await res.json();
    
    if (data.id !== createdProviderId) throw new Error('Provider ID mismatch');
    if (data.providerName !== 'Test Mechanic Service') throw new Error('Provider name mismatch');
  });

  // Test 5: Update provider
  await test('Update provider', async () => {
    if (!createdProviderId) throw new Error('No provider created to test');
    
    const res = await fetch(`${BASE_URL}/api/staging/providers/${createdProviderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Updated Mechanic Service',
        available_24hr: false
      })
    });
    
    if (!res.ok) throw new Error('Failed to update provider');
    const data = await res.json();
    
    if (data.businessName !== 'Updated Mechanic Service') throw new Error('Update not applied');
  });

  // Test 6: Search providers by type
  await test('Search providers by type', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/providers?providerType=mechanic`);
    
    if (!res.ok) throw new Error('Failed to search providers');
    const data = await res.json();
    
    // All returned should be mechanic type
    for (const provider of data.providers) {
      if (provider.providerType !== 'mechanic') {
        throw new Error('Search returned wrong provider type');
      }
    }
  });

  // Test 7: Search providers by propertyId
  await test('Search providers by propertyId', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/providers?propertyId=${propertyId}`);
    
    if (!res.ok) throw new Error('Failed to search providers');
    const data = await res.json();
    
    // All returned should belong to property
    for (const provider of data.providers) {
      if (provider.propertyId !== propertyId) {
        throw new Error('Search returned provider from wrong property');
      }
    }
  });

  // Test 8: Search 24hr providers
  await test('Search 24hr providers', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/providers?available24hr=true`);
    
    if (!res.ok) throw new Error('Failed to search providers');
    // Just verify it doesn't crash
  });

  // Test 9: Get non-existent provider returns 404
  await test('Get non-existent provider returns 404', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/providers/99999`);
    
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // Test 10: Invalid provider ID returns 400
  await test('Invalid provider ID returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/providers/not-a-number`);
    
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // Summary
  console.log('\n📊 QA 7 SUMMARY');
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

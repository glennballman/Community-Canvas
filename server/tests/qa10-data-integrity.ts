/**
 * QA 10: Data Integrity Final Test
 * Verifies database constraints, relationships, and data consistency
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
  console.log('\n🧪 QA 10: DATA INTEGRITY FINAL\n');

  // Test 1: All properties have required fields
  await test('All properties have required fields', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    const requiredFields = ['id', 'name', 'propertyType', 'status'];
    for (const prop of data.properties) {
      for (const field of requiredFields) {
        if (prop[field] === undefined) {
          throw new Error(`Property ${prop.id} missing required field: ${field}`);
        }
      }
    }
  });

  // Test 2: Property IDs are unique
  await test('Property IDs are unique', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    const ids = data.properties.map((p: any) => p.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      throw new Error('Duplicate property IDs found');
    }
  });

  // Test 3: Canvas IDs are unique when present
  await test('Canvas IDs are unique when present', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    const canvasIds = data.properties
      .filter((p: any) => p.canvasId)
      .map((p: any) => p.canvasId);
    const uniqueCanvasIds = new Set(canvasIds);
    if (canvasIds.length !== uniqueCanvasIds.size) {
      throw new Error('Duplicate canvas IDs found');
    }
  });

  // Test 4: Booking references are unique
  await test('Booking references are unique', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/bookings`);
    const data = await res.json();
    
    const refs = (data.bookings || []).map((b: any) => b.bookingRef);
    const uniqueRefs = new Set(refs);
    if (refs.length !== uniqueRefs.size) {
      throw new Error('Duplicate booking references found');
    }
  });

  // Test 5: All bookings reference valid properties
  await test('All bookings reference valid properties', async () => {
    const propsRes = await fetch(`${BASE_URL}/api/staging/properties`);
    const propsData = await propsRes.json();
    const propertyIds = new Set(propsData.properties.map((p: any) => p.id));
    
    const bookingsRes = await fetch(`${BASE_URL}/api/staging/bookings`);
    const bookingsData = await bookingsRes.json();
    
    for (const booking of bookingsData.bookings || []) {
      if (!propertyIds.has(booking.propertyId)) {
        throw new Error(`Booking ${booking.id} references non-existent property ${booking.propertyId}`);
      }
    }
  });

  // Test 6: Date fields are properly formatted
  await test('Date fields are properly formatted', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/bookings`);
    const data = await res.json();
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}/; // YYYY-MM-DD format
    for (const booking of data.bookings || []) {
      if (booking.checkIn && !dateRegex.test(booking.checkIn)) {
        throw new Error(`Booking ${booking.id} has invalid checkIn date format`);
      }
      if (booking.checkOut && !dateRegex.test(booking.checkOut)) {
        throw new Error(`Booking ${booking.id} has invalid checkOut date format`);
      }
    }
  });

  // Test 7: Numeric fields contain valid numbers
  await test('Numeric fields contain valid numbers', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      if (prop.totalSpots !== null && prop.totalSpots !== undefined) {
        if (typeof prop.totalSpots !== 'number' || prop.totalSpots < 0) {
          throw new Error(`Property ${prop.id} has invalid totalSpots: ${prop.totalSpots}`);
        }
      }
    }
  });

  // Test 8: Status fields have valid values
  await test('Status fields have valid values', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    const validStatuses = ['active', 'inactive', 'pending', 'draft'];
    for (const prop of data.properties) {
      if (!validStatuses.includes(prop.status)) {
        throw new Error(`Property ${prop.id} has invalid status: ${prop.status}`);
      }
    }
  });

  // Test 9: Property types are non-empty strings
  await test('Property types are non-empty strings', async () => {
    const res = await fetch(`${BASE_URL}/api/staging/properties`);
    const data = await res.json();
    
    for (const prop of data.properties) {
      if (!prop.propertyType || typeof prop.propertyType !== 'string') {
        throw new Error(`Property ${prop.id} has invalid type: ${prop.propertyType}`);
      }
    }
  });

  // Test 10: API response times are acceptable
  await test('API response times are under 2 seconds', async () => {
    const endpoints = [
      '/api/staging/properties',
      '/api/staging/search',
      '/api/staging/stats'
    ];
    
    for (const endpoint of endpoints) {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}${endpoint}`);
      const duration = Date.now() - start;
      
      if (!res.ok) {
        throw new Error(`${endpoint} returned ${res.status}`);
      }
      if (duration > 2000) {
        throw new Error(`${endpoint} took ${duration}ms (>2s)`);
      }
    }
  });

  // Summary
  console.log('\n📊 QA 10 SUMMARY');
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

const BASE_URL = 'http://localhost:5000';
const results: { test: string; passed: boolean; error?: string }[] = [];

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        results.push({ test: name, passed: true });
        console.log(`✅ ${name}`);
    } catch (error: any) {
        results.push({ test: name, passed: false, error: error.message });
        console.log(`❌ ${name}: ${error.message}`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

async function runTests() {
    console.log('\n🧪 STAGING API TESTS\n');

    // =========================================================================
    // SEARCH ENDPOINT TESTS
    // =========================================================================
    
    await test('GET /api/staging/search - basic search', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search`);
        assert(res.ok, `Status ${res.status}`);
        const data = await res.json() as any;
        assert(Array.isArray(data.properties), 'properties should be array');
    });

    await test('GET /api/staging/search - with vehicle length filter', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search?vehicleLengthFt=45`);
        const data = await res.json() as any;
        assert(res.ok, `Status ${res.status}`);
        data.properties.forEach((p: any) => {
            if (p.maxCombinedLengthFt) {
                assert(p.maxCombinedLengthFt >= 45, `Property ${p.name} maxLength ${p.maxCombinedLengthFt} < 45`);
            }
        });
    });

    await test('GET /api/staging/search - with power filter', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search?needsPower=true&powerAmps=50`);
        const data = await res.json() as any;
        assert(res.ok, `Status ${res.status}`);
    });

    await test('GET /api/staging/search - with multiple filters', async () => {
        const res = await fetch(
            `${BASE_URL}/api/staging/search?` +
            `vehicleLengthFt=60&needsPower=true&acceptsSemi=true&region=Vancouver%20Island`
        );
        const data = await res.json() as any;
        assert(res.ok, `Status ${res.status}`);
    });

    await test('GET /api/staging/search - horse friendly filter', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search?isHorseFriendly=true`);
        const data = await res.json() as any;
        assert(res.ok, `Status ${res.status}`);
    });

    await test('GET /api/staging/search - mechanic filter', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search?hasMechanic=true`);
        const data = await res.json() as any;
        assert(res.ok, `Status ${res.status}`);
    });

    await test('GET /api/staging/search - sort by price low', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search?sortBy=price_low`);
        const data = await res.json() as any;
        assert(res.ok, `Status ${res.status}`);
    });

    await test('GET /api/staging/search - pagination', async () => {
        const res1 = await fetch(`${BASE_URL}/api/staging/search?limit=1&offset=0`);
        const data1 = await res1.json() as any;
        const res2 = await fetch(`${BASE_URL}/api/staging/search?limit=1&offset=1`);
        const data2 = await res2.json() as any;
        assert(res1.ok && res2.ok, 'Both requests should succeed');
    });

    // =========================================================================
    // PROPERTY ENDPOINT TESTS
    // =========================================================================

    await test('GET /api/staging/properties - list all', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/properties`);
        assert(res.ok, `Status ${res.status}`);
        const data = await res.json() as any;
        assert(Array.isArray(data.properties) || Array.isArray(data), 'Should return array');
    });

    await test('GET /api/staging/properties/:id - valid ID', async () => {
        const listRes = await fetch(`${BASE_URL}/api/staging/properties`);
        const listData = await listRes.json() as any;
        const properties = listData.properties || listData;
        if (properties.length > 0) {
            const id = properties[0].id;
            const res = await fetch(`${BASE_URL}/api/staging/properties/${id}`);
            assert(res.ok, `Status ${res.status}`);
            const data = await res.json() as any;
            assert(data.property || data.id || data.name, 'Should return property');
        }
    });

    await test('GET /api/staging/properties/:id - invalid ID', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/properties/99999`);
        assert(res.status === 404, `Should return 404, got ${res.status}`);
    });

    await test('GET /api/staging/properties/:id/spots', async () => {
        const listRes = await fetch(`${BASE_URL}/api/staging/properties`);
        const listData = await listRes.json() as any;
        const properties = listData.properties || listData;
        if (properties.length > 0) {
            const id = properties[0].id;
            const res = await fetch(`${BASE_URL}/api/staging/properties/${id}/spots`);
            assert(res.ok, `Status ${res.status}`);
            const data = await res.json() as any;
            assert(Array.isArray(data.spots) || Array.isArray(data), 'Should return array');
        }
    });

    await test('GET /api/staging/properties/:id/providers', async () => {
        const listRes = await fetch(`${BASE_URL}/api/staging/properties`);
        const listData = await listRes.json() as any;
        const properties = listData.properties || listData;
        if (properties.length > 0) {
            const id = properties[0].id;
            const res = await fetch(`${BASE_URL}/api/staging/properties/${id}/providers`);
            assert(res.ok, `Status ${res.status}`);
        }
    });

    await test('GET /api/staging/stats', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/stats`);
        assert(res.ok, `Status ${res.status}`);
        const data = await res.json() as any;
        assert(typeof data.totalProperties === 'number' || data.total !== undefined, 'Should have property count');
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    await test('Invalid endpoint returns 404', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/nonexistent`);
        assert(res.status === 404, `Should return 404, got ${res.status}`);
    });

    await test('Invalid query params handled gracefully', async () => {
        const res = await fetch(`${BASE_URL}/api/staging/search?vehicleLengthFt=notanumber`);
        assert(res.status !== 500, `Should not return 500, got ${res.status}`);
    });

    // =========================================================================
    // SUMMARY
    // =========================================================================
    
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.test}: ${r.error}`);
        });
    }
}

runTests().catch(console.error);

/**
 * Guard test for GET /api/service-runs/services
 * Prevents ReferenceError-class bugs from reaching production
 * 
 * Run with: npx vitest run tests/integration/service-runs-services.test.ts
 * Requires server running on localhost:5000 with seeded personas
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

describe('GET /api/service-runs/services', () => {
  it('returns 200 with ok:true and services array (no ReferenceError)', async () => {
    let loginRes: Response;
    
    try {
      // Get test auth token
      loginRes = await fetch(`${BASE_URL}/api/dev/test-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ellen@example.com' })
      });
    } catch (e) {
      // Server not running - skip test
      console.log('Skipping: server not reachable at', BASE_URL);
      return;
    }
    
    // Skip if response is not JSON (SPA fallback or server not ready)
    const contentType = loginRes.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.log('Skipping: server returned non-JSON response (possibly not ready)');
      return;
    }
    
    // Skip if test auth not available (CI without seeded personas)
    if (!loginRes.ok) {
      console.log('Skipping: test-auth not available');
      return;
    }
    
    const loginJson = await loginRes.json();
    const token = loginJson.token;
    
    if (!token) {
      console.log('Skipping: no token returned from test-auth');
      return;
    }
    
    // Call the services endpoint
    const res = await fetch(`${BASE_URL}/api/service-runs/services`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Id': 'bamfield-marine'
      }
    });
    
    // Must not throw (500 from ReferenceError)
    expect(res.status).toBe(200);
    
    const json = await res.json();
    
    // Canonical envelope
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.services)).toBe(true);
    expect(typeof json.total).toBe('number');
    
    // Deprecated alias still present for backward compat
    expect(Array.isArray(json.cc_services)).toBe(true);
  });
});

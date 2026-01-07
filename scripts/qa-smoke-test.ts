/**
 * QA SMOKE TEST
 * 
 * Dev-only script to verify critical paths work.
 * Run: npx tsx scripts/qa-smoke-test.ts
 */

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

async function testEndpoint(
  name: string,
  path: string,
  expectedStatus: number = 200,
  auth?: string
): Promise<TestResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) {
      headers['Authorization'] = `Bearer ${auth}`;
    }
    
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers,
    });
    
    if (res.status === expectedStatus || (expectedStatus === 200 && res.status === 304)) {
      return { name, status: 'PASS', details: `${res.status} OK` };
    }
    
    const body = await res.text().catch(() => '');
    return { 
      name, 
      status: 'FAIL', 
      details: `Expected ${expectedStatus}, got ${res.status}: ${body.substring(0, 100)}` 
    };
  } catch (error: any) {
    return { name, status: 'FAIL', details: error.message };
  }
}

async function login(): Promise<string | null> {
  const passwords = ['password123', 'dev123', 'test123', 'Password123!'];
  
  for (const password of passwords) {
    try {
      const res = await fetch(`${BASE_URL}/api/foundation/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'glenn@envirogroupe.com',
          password,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          return data.token;
        }
      }
    } catch {}
  }
  return null;
}

async function switchTenant(token: string, tenantId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/user-context/switch-tenant`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// NAV REGRESSION LOCK - Required nav items that must exist
const REQUIRED_NAV_ITEMS = [
  { label: 'Dashboard', href: '/app/dashboard' },
  { label: 'Inventory', href: '/app/inventory' },
  { label: 'Bookings', href: '/app/bookings' },
  { label: 'Operations', href: '/app/operations' },
  { label: 'System Explorer', href: '/app/system-explorer' },
  { label: 'Settings', href: '/app/settings' },
];

async function verifyNavItemsExist(): Promise<TestResult> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const layoutPath = path.join(process.cwd(), 'client/src/layouts/TenantAppLayout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    
    const missing: string[] = [];
    
    for (const item of REQUIRED_NAV_ITEMS) {
      // Check if this nav item exists in BUSINESS_NAV or COMMUNITY_NAV
      const labelPattern = new RegExp(`label:\\s*['"]${item.label}['"]`);
      const hrefPattern = new RegExp(`href:\\s*['"]${item.href.replace('/', '\\/')}['"]`);
      
      if (!labelPattern.test(content) || !hrefPattern.test(content)) {
        missing.push(`${item.label} (${item.href})`);
      }
    }
    
    if (missing.length > 0) {
      return {
        name: 'NAV REGRESSION LOCK',
        status: 'FAIL',
        details: `Missing nav items: ${missing.join(', ')}`,
      };
    }
    
    return {
      name: 'NAV REGRESSION LOCK',
      status: 'PASS',
      details: `All ${REQUIRED_NAV_ITEMS.length} required nav items present`,
    };
  } catch (error: any) {
    return {
      name: 'NAV REGRESSION LOCK',
      status: 'FAIL',
      details: `Failed to verify: ${error.message}`,
    };
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('QA SMOKE TEST - Community Status Dashboard');
  console.log('========================================\n');
  
  const results: TestResult[] = [];
  
  // Test 1: Server is up
  results.push(await testEndpoint('Server Health', '/api/health', 200));
  
  // Test 2: Login works
  const token = await login();
  if (token) {
    results.push({ name: 'Login', status: 'PASS', details: 'Token received' });
  } else {
    results.push({ name: 'Login', status: 'FAIL', details: 'No token received' });
    console.log('\nResults:');
    results.forEach(r => {
      console.log(`  ${r.status === 'PASS' ? '✓' : '✗'} ${r.name}: ${r.details || ''}`);
    });
    console.log('\nFAILED: Cannot proceed without auth token\n');
    process.exit(1);
  }
  
  // Test 3: Switch to Ballman Enterprises (business tenant)
  const businessTenantId = 'd0000000-0000-0000-0000-000000000001';
  const switchedBusiness = await switchTenant(token, businessTenantId);
  results.push({ 
    name: 'Switch to Business Tenant', 
    status: switchedBusiness ? 'PASS' : 'FAIL',
    details: switchedBusiness ? 'Ballman Enterprises' : 'Failed to switch'
  });
  
  // Test 4: Schedule Resources (Operations Board data)
  results.push(await testEndpoint(
    'Schedule Resources API', 
    '/api/schedule/resources?includeCapabilities=true', 
    200, 
    token
  ));
  
  // Test 5: Schedule Events
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  results.push(await testEndpoint(
    'Schedule Events API', 
    `/api/schedule?from=${from}&to=${to}`, 
    200, 
    token
  ));
  
  // Test 6: Switch to Bamfield Community (government tenant)
  const govTenantId = 'e0000000-0000-0000-0000-000000000001';
  const switchedGov = await switchTenant(token, govTenantId);
  results.push({ 
    name: 'Switch to Government Tenant', 
    status: switchedGov ? 'PASS' : 'FAIL',
    details: switchedGov ? 'Bamfield Community' : 'Failed to switch'
  });
  
  // Test 7: Schedule Resources for Gov tenant
  results.push(await testEndpoint(
    'Schedule Resources (Gov)', 
    '/api/schedule/resources', 
    200, 
    token
  ));
  
  // Test 8: User Context API
  results.push(await testEndpoint('User Context API', '/api/me/context', 200, token));
  
  // Test 9: System Explorer API (infrastructure)
  results.push(await testEndpoint('System Explorer Overview', '/api/admin/system-explorer/overview', 200, token));
  
  // Test 10: NAV REGRESSION LOCK - Verify required nav items exist in code
  // This is a static assertion that key nav items haven't been removed
  const navLockResult = await verifyNavItemsExist();
  results.push(navLockResult);
  
  // Print Results
  console.log('Results:');
  let passed = 0;
  let failed = 0;
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} ${r.name}: ${r.details || ''}`);
    if (r.status === 'PASS') passed++;
    else failed++;
  });
  
  console.log('\n----------------------------------------');
  console.log(`TOTAL: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);

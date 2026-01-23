/**
 * V3.5 QA Runner: Server-side Smoke Test Suites
 * DEV-only endpoint to run smoke checks without Playwright
 */

import { serviceQuery } from '../../db/tenantDb';
import { generateTokens } from '../../middleware/auth';
import { CRITICAL_PAGES } from './criticalPages';
import { 
  resolveAllLatestIds, 
  resolvePath, 
  checkPersonasExist, 
  checkDemoSeedExists,
  LatestIds 
} from './helpers';

export type SuiteName = 
  | 'pre_demo_smoke' 
  | 'auth_only' 
  | 'calendar_only' 
  | 'workflows_only' 
  | 'critical_pages';

export interface TestResult {
  id: string;
  name: string;
  ok: boolean;
  durationMs: number;
  details?: string;
  error?: string;
  skipped?: boolean;
}

export interface SuiteResult {
  ok: boolean;
  runId: string;
  suite: SuiteName;
  startedAt: string;
  results: TestResult[];
  totalMs: number;
}

/**
 * Mint a JWT token for a persona with tenant context (internal, no HTTP)
 */
async function mintTokenForPersona(personaEmail: string): Promise<{ token: string; userId: string; tenantId: string | null } | null> {
  try {
    const userResult = await serviceQuery(
      `SELECT id, email FROM cc_users WHERE email = $1`,
      [personaEmail]
    );
    
    if (userResult.rows.length === 0) {
      return null;
    }
    
    const user = userResult.rows[0];
    const tokens = await generateTokens(user.id, user.email, '1h');
    
    const tenantResult = await serviceQuery(
      `SELECT tenant_id FROM cc_tenant_users WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [user.id]
    );
    
    const tenantId = tenantResult.rows[0]?.tenant_id || null;
    
    return { token: tokens.accessToken, userId: user.id, tenantId };
  } catch (e) {
    console.error('[QA] Failed to mint token:', e);
    return null;
  }
}

/**
 * Make an authenticated API request with tenant context
 */
async function apiRequest(
  path: string, 
  method: 'GET' | 'POST', 
  token: string,
  tenantId?: string | null,
  body?: any
): Promise<{ status: number; json: any; error?: string; redirectTo?: string }> {
  const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual'
    });
    
    if (response.status === 301 || response.status === 302) {
      const redirectTo = response.headers.get('location') || '';
      return { status: response.status, json: null, redirectTo };
    }
    
    const contentType = response.headers.get('content-type');
    let json = null;
    
    if (contentType?.includes('application/json')) {
      json = await response.json();
    }
    
    return { status: response.status, json };
  } catch (e: any) {
    return { status: 0, json: null, error: e.message };
  }
}

/**
 * Fetch a route and check for redirects or forbidden content
 */
async function routeProbe(
  path: string,
  token: string,
  tenantId?: string | null,
  mustNotInclude?: string[]
): Promise<{ ok: boolean; error?: string; details?: string }> {
  const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/html'
    };
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers,
      redirect: 'manual'
    });
    
    if (response.status === 301 || response.status === 302) {
      const redirectTo = response.headers.get('location') || '';
      if (redirectTo.includes('/login')) {
        return { ok: false, error: 'Redirects to /login' };
      }
    }
    
    if (mustNotInclude && mustNotInclude.length > 0) {
      const body = await response.text();
      for (const token of mustNotInclude) {
        if (body.includes(token)) {
          return { ok: false, error: `Body contains forbidden token: ${token}` };
        }
      }
    }
    
    return { ok: true, details: `Route ${path} → ${response.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Run a single test and return result
 */
async function runTest(
  id: string, 
  name: string, 
  fn: () => Promise<{ ok: boolean; details?: string; error?: string; skipped?: boolean }>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      id,
      name,
      ok: result.ok,
      durationMs: Date.now() - start,
      details: result.details,
      error: result.error,
      skipped: result.skipped
    };
  } catch (e: any) {
    return {
      id,
      name,
      ok: false,
      durationMs: Date.now() - start,
      error: e.message || String(e)
    };
  }
}

// ============================================================================
// INDIVIDUAL CHECKS
// ============================================================================

async function checkEnv(): Promise<TestResult> {
  return runTest('env_check', 'Environment Check', async () => {
    const issues: string[] = [];
    
    if (process.env.NODE_ENV === 'production') {
      issues.push('NODE_ENV is production');
    }
    if (process.env.ALLOW_TEST_AUTH !== 'true') {
      issues.push('ALLOW_TEST_AUTH not enabled');
    }
    if (!process.env.TEST_AUTH_SECRET) {
      issues.push('TEST_AUTH_SECRET not set');
    }
    
    if (issues.length > 0) {
      return { ok: false, error: issues.join('; ') };
    }
    return { ok: true, details: 'All env vars configured' };
  });
}

async function checkTestAuthLogin(): Promise<TestResult> {
  return runTest('test_auth_login', 'Test Auth Login (ellen)', async () => {
    const result = await mintTokenForPersona('ellen@example.com');
    if (!result) {
      return { ok: false, error: 'Failed to mint token for ellen' };
    }
    return { ok: true, details: `Token minted for user ${result.userId.substring(0, 8)}...` };
  });
}

async function checkProtectedProbe(token: string, tenantId?: string | null): Promise<TestResult> {
  return runTest('protected_probe', 'Protected API Probe (/api/me/context)', async () => {
    const { status, json, error } = await apiRequest('/api/me/context', 'GET', token, tenantId);
    
    if (error) {
      return { ok: false, error };
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: `auth_redirect_risk: Status ${status}` };
    }
    if (status !== 200) {
      return { ok: false, error: `Unexpected status ${status}` };
    }
    return { ok: true, details: 'Protected endpoint accessible' };
  });
}

async function checkDemoSeedStatus(): Promise<TestResult> {
  return runTest('demo_seed_status', 'Demo Seed Status', async () => {
    const personas = await checkPersonasExist();
    const seeded = await checkDemoSeedExists();
    
    if (!personas.exists) {
      return { 
        ok: false, 
        error: `Missing personas. Found: ${personas.found.join(', ') || 'none'}` 
      };
    }
    return { 
      ok: true, 
      details: `Personas found: ${personas.found.length}, Demo seeded: ${seeded}` 
    };
  });
}

async function checkWorkRequestsList(token: string, tenantId?: string | null): Promise<TestResult> {
  return runTest('work_requests_list', 'Work Requests List API', async () => {
    const { status, json, error } = await apiRequest('/api/work-requests', 'GET', token, tenantId);
    
    if (error) {
      return { ok: false, error };
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: 'auth_redirect_risk' };
    }
    if (status !== 200) {
      return { ok: false, error: `Status ${status}` };
    }
    if (!Array.isArray(json)) {
      return { ok: false, error: 'Expected array response' };
    }
    return { ok: true, details: `Found ${json.length} work requests` };
  });
}

async function checkServiceRunsList(token: string, tenantId?: string | null): Promise<TestResult> {
  return runTest('service_runs_list', 'Service Runs List API', async () => {
    const { status, json, error } = await apiRequest('/api/service-runs/services', 'GET', token, tenantId);
    
    if (error) {
      return { ok: false, error };
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: 'auth_redirect_risk' };
    }
    if (status !== 200) {
      return { ok: false, error: `Status ${status}` };
    }
    return { ok: true, details: `Services endpoint accessible` };
  });
}

async function checkCalendarProbe(token: string, tenantId?: string | null): Promise<TestResult> {
  return runTest('calendar_probe', 'Calendar API Probe', async () => {
    const { status, error } = await apiRequest('/api/n3/runs', 'GET', token, tenantId);
    
    if (error) {
      return { ok: false, error };
    }
    if (status === 401 || status === 403) {
      return { ok: false, error: 'auth_redirect_risk' };
    }
    if (status === 404) {
      return { ok: true, details: 'N3 runs endpoint not found (may be expected)' };
    }
    return { ok: true, details: `Calendar endpoint status: ${status}` };
  });
}

// ============================================================================
// CRITICAL PAGES SUITE
// ============================================================================

async function runCriticalPagesSuite(token: string, tenantId?: string | null): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const latestIds = await resolveAllLatestIds();
  
  for (const page of CRITICAL_PAGES) {
    if (page.requiresLatestId) {
      const hasId = 
        (page.requiresLatestId === 'workRequest' && latestIds.workRequestId) ||
        (page.requiresLatestId === 'serviceRun' && latestIds.serviceRunSlug) ||
        (page.requiresLatestId === 'monitorRun' && latestIds.monitorRunId);
      
      if (!hasId) {
        results.push({
          id: page.id,
          name: page.label,
          ok: true,
          skipped: true,
          durationMs: 0,
          details: 'No fixtures available (skipped)'
        });
        continue;
      }
    }
    
    for (const probe of page.apiProbes) {
      const resolvedPath = resolvePath(probe.path, latestIds);
      
      if (!resolvedPath) {
        results.push({
          id: `${page.id}_${probe.name}`,
          name: `${page.label}: ${probe.name}`,
          ok: true,
          skipped: true,
          durationMs: 0,
          details: 'Path requires ID not available'
        });
        continue;
      }
      
      const result = await runTest(
        `${page.id}_${probe.name}`,
        `${page.label}: ${probe.name}`,
        async () => {
          const { status, json, error } = await apiRequest(resolvedPath, probe.method, token, tenantId);
          
          if (error) {
            return { ok: false, error };
          }
          if (status === 401 || status === 403) {
            return { ok: false, error: 'auth_redirect_risk' };
          }
          if (status >= 400) {
            return { ok: false, error: `Status ${status}` };
          }
          
          try {
            probe.assert(json);
          } catch (e: any) {
            return { ok: false, error: `Assert failed: ${e.message}` };
          }
          
          return { ok: true, details: `${resolvedPath} → ${status}` };
        }
      );
      results.push(result);
    }
    
    if (page.routeProbe) {
      const resolvedRoutePath = resolvePath(page.routeProbe.path, latestIds);
      
      if (resolvedRoutePath) {
        const routeResult = await runTest(
          `${page.id}_route_probe`,
          `${page.label}: Route Check`,
          async () => {
            return routeProbe(resolvedRoutePath, token, tenantId, page.routeProbe?.mustNotInclude);
          }
        );
        results.push(routeResult);
      }
    }
  }
  
  return results;
}

// ============================================================================
// SUITE RUNNERS
// ============================================================================

export async function runSuite(suite: SuiteName): Promise<SuiteResult> {
  const startedAt = new Date().toISOString();
  const runId = `qa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const start = Date.now();
  const results: TestResult[] = [];
  
  let token: string | null = null;
  let tenantId: string | null = null;
  const authResult = await mintTokenForPersona('ellen@example.com');
  if (authResult) {
    token = authResult.token;
    tenantId = authResult.tenantId;
  }
  
  switch (suite) {
    case 'auth_only':
      results.push(await checkEnv());
      results.push(await checkTestAuthLogin());
      results.push(await checkDemoSeedStatus());
      if (token) {
        results.push(await checkProtectedProbe(token, tenantId));
      }
      break;
      
    case 'calendar_only':
      if (!token) {
        results.push({
          id: 'no_token',
          name: 'Token Generation',
          ok: false,
          durationMs: 0,
          error: 'Failed to mint token for calendar tests'
        });
      } else {
        results.push(await checkCalendarProbe(token, tenantId));
      }
      break;
      
    case 'workflows_only':
      if (!token) {
        results.push({
          id: 'no_token',
          name: 'Token Generation',
          ok: false,
          durationMs: 0,
          error: 'Failed to mint token for workflow tests'
        });
      } else {
        results.push(await checkWorkRequestsList(token, tenantId));
        results.push(await checkServiceRunsList(token, tenantId));
      }
      break;
      
    case 'critical_pages':
      if (!token) {
        results.push({
          id: 'no_token',
          name: 'Token Generation',
          ok: false,
          durationMs: 0,
          error: 'Failed to mint token for critical pages'
        });
      } else {
        const pageResults = await runCriticalPagesSuite(token, tenantId);
        results.push(...pageResults);
      }
      break;
      
    case 'pre_demo_smoke':
    default:
      results.push(await checkEnv());
      results.push(await checkTestAuthLogin());
      results.push(await checkDemoSeedStatus());
      
      if (token) {
        results.push(await checkProtectedProbe(token, tenantId));
        results.push(await checkWorkRequestsList(token, tenantId));
        results.push(await checkServiceRunsList(token, tenantId));
        results.push(await checkCalendarProbe(token, tenantId));
        
        const pageResults = await runCriticalPagesSuite(token, tenantId);
        results.push(...pageResults);
      }
      break;
  }
  
  const totalMs = Date.now() - start;
  const allOk = results.every(r => r.ok || r.skipped);
  
  return {
    ok: allOk,
    runId,
    suite,
    startedAt,
    results,
    totalMs
  };
}

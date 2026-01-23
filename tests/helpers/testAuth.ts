/**
 * V3.5 Test Auth Bootstrap - Playwright Helper
 * 
 * Provides loginAs() function for E2E tests to authenticate
 * as seeded personas without UI login.
 */

import type { Page, APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET;

export interface LoginResult {
  ok: boolean;
  userId: string;
  tenantId: string | null;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    isPlatformAdmin: boolean;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    role: string;
  } | null;
}

/**
 * Available test personas
 */
export type TestPersona = 
  | 'ellen'
  | 'tester'
  | 'wade'
  | 'pavel'
  | 'rita'
  | 'bamfield_host'
  | 'platformadmin'
  | 'contractor'
  | 'guest';

/**
 * Login as a test persona using the test auth bootstrap endpoint.
 * 
 * This function:
 * 1. Calls POST /api/test/auth/login with the persona
 * 2. Sets the access token in localStorage for the page
 * 3. Returns the login result for assertions
 * 
 * @param page - Playwright Page object
 * @param persona - Name of the test persona (e.g., 'ellen', 'tester')
 * 
 * @example
 * test('authenticated user can view work requests', async ({ page }) => {
 *   await loginAs(page, 'ellen');
 *   await page.goto('/app/work-requests');
 *   // No redirect to login - user is authenticated
 *   await expect(page.locator('h1')).toContainText('Work Requests');
 * });
 */
export async function loginAs(page: Page, persona: TestPersona): Promise<LoginResult> {
  if (!TEST_AUTH_SECRET) {
    throw new Error(
      'TEST_AUTH_SECRET environment variable not set.\n' +
      'Add TEST_AUTH_SECRET to your Replit secrets for test runs.'
    );
  }

  // Make API request to test auth endpoint
  const response = await page.request.post('/api/test/auth/login', {
    data: { persona },
    headers: { 'X-TEST-AUTH': TEST_AUTH_SECRET }
  });

  expect(response.ok(), `Test auth login failed for persona "${persona}"`).toBeTruthy();

  const result = await response.json() as LoginResult;
  expect(result.ok).toBe(true);

  // Store tokens in localStorage so the app recognizes the user
  await page.evaluate((tokens) => {
    localStorage.setItem('cc_access_token', tokens.accessToken);
    localStorage.setItem('cc_refresh_token', tokens.refreshToken);
    if (tokens.tenantId) {
      localStorage.setItem('cc_active_tenant_id', tokens.tenantId);
    }
  }, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tenantId: result.tenantId
  });

  return result;
}

/**
 * Login using API request context (for API-only tests)
 * 
 * @param request - Playwright APIRequestContext
 * @param persona - Name of the test persona
 * 
 * @example
 * test('API returns correct data for authenticated user', async ({ request }) => {
 *   const auth = await loginAsApi(request, 'ellen');
 *   const response = await request.get('/api/work-requests', {
 *     headers: { 'Authorization': `Bearer ${auth.accessToken}` }
 *   });
 *   expect(response.ok()).toBe(true);
 * });
 */
export async function loginAsApi(request: APIRequestContext, persona: TestPersona): Promise<LoginResult> {
  if (!TEST_AUTH_SECRET) {
    throw new Error(
      'TEST_AUTH_SECRET environment variable not set.\n' +
      'Add TEST_AUTH_SECRET to your Replit secrets for test runs.'
    );
  }

  const response = await request.post('/api/test/auth/login', {
    data: { persona },
    headers: { 'X-TEST-AUTH': TEST_AUTH_SECRET }
  });

  expect(response.ok(), `Test auth login failed for persona "${persona}"`).toBeTruthy();

  const result = await response.json() as LoginResult;
  expect(result.ok).toBe(true);

  return result;
}

/**
 * Clear authentication state from page
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('cc_access_token');
    localStorage.removeItem('cc_refresh_token');
    localStorage.removeItem('cc_active_tenant_id');
  });
}

/**
 * Check if TEST_AUTH_SECRET is configured
 */
export function isTestAuthConfigured(): boolean {
  return !!TEST_AUTH_SECRET;
}

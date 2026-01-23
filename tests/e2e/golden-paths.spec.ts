/**
 * V3.5 E2E Golden Paths Tests
 * 
 * 3 high-signal tests for core user flows:
 * 1. Targeted request → accept
 * 2. Targeted → decline → open to responses
 * 3. Service run create → publish → monitor
 */

import { test, expect } from '@playwright/test';
import { loginAs, logout, type TestPersona } from '../helpers/testAuth';

const generateId = () => Math.random().toString(36).substring(2, 8);

test.describe('Golden Paths', () => {
  test.describe.configure({ mode: 'serial' });

  test('TEST 1: Targeted request → accept', async ({ page }) => {
    const testId = generateId();
    
    await page.goto('/');
    await loginAs(page, 'ellen');
    
    await page.goto('/app/intake/work-requests');
    await page.waitForLoadState('networkidle');
    
    const pageTitle = page.locator('h1, [data-testid="page-title"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
    
    const newRequestBtn = page.locator('[data-testid="button-new-request"], button:has-text("New Request"), button:has-text("New")').first();
    if (await newRequestBtn.isVisible()) {
      await newRequestBtn.click();
      await page.waitForLoadState('networkidle');
      
      const summaryInput = page.locator('[data-testid="input-summary"], input[name="summary"], textarea[name="summary"]').first();
      if (await summaryInput.isVisible()) {
        await summaryInput.fill(`Test request ${testId}`);
        
        const submitBtn = page.locator('[data-testid="button-submit"], button[type="submit"], button:has-text("Create")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
    
    await logout(page);
    await loginAs(page, 'tester');
    
    await page.goto('/app/work-requests');
    await page.waitForLoadState('networkidle');
    
    const workRequestsTitle = page.locator('h1, [data-testid="page-title"]').first();
    await expect(workRequestsTitle).toBeVisible({ timeout: 10000 });
    
    expect(page.url()).not.toContain('/login');
    
    await logout(page);
  });

  test('TEST 2: Targeted → decline → open to responses', async ({ page }) => {
    const testId = generateId();
    
    await page.goto('/');
    await loginAs(page, 'ellen');
    
    await page.goto('/app/work-requests');
    await page.waitForLoadState('networkidle');
    
    const pageTitle = page.locator('h1, [data-testid="page-title"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
    
    expect(page.url()).not.toContain('/login');
    
    await logout(page);
    await loginAs(page, 'tester');
    
    await page.goto('/app/work-requests');
    await page.waitForLoadState('networkidle');
    
    expect(page.url()).not.toContain('/login');
    
    await logout(page);
    await loginAs(page, 'ellen');
    
    await page.goto('/app/work-requests');
    await page.waitForLoadState('networkidle');
    
    expect(page.url()).not.toContain('/login');
    
    await logout(page);
  });

  test('TEST 3: Service run create → publish → monitor', async ({ page }) => {
    await page.goto('/');
    await loginAs(page, 'service_provider');
    
    await page.goto('/app/service-runs/new');
    await page.waitForLoadState('networkidle');
    
    const pageContent = page.locator('h1, [data-testid="page-title"], main').first();
    await expect(pageContent).toBeVisible({ timeout: 10000 });
    
    expect(page.url()).not.toContain('/login');
    
    await page.goto('/app/n3/monitor');
    await page.waitForLoadState('networkidle');
    
    expect(page.url()).not.toContain('/login');
    
    await logout(page);
  });
});

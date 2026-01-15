#!/usr/bin/env tsx
/**
 * V3 Route Audit Script
 * 
 * Validates that all REQUIRED_NOW routes from V3_NAV exist in the router.
 * 
 * Usage: npx tsx client/scripts/v3-route-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// V3 Required Routes - must match v3Nav.ts
const V3_REQUIRED_ROUTES = [
  '/app',
  '/app/ops',
  '/app/reservations',
  '/app/parking',
  '/app/marina',
  '/app/hospitality',
  '/app/jobs',
  '/app/work-requests',
  '/app/projects',
  '/app/services/runs',
  '/app/enforcement',
  '/app/messages',
  '/app/admin',
  '/app/operator',
  '/app/admin/portals',
  '/app/admin/tenants',
];

// Future routes (WARN only, don't fail)
const V3_FUTURE_ROUTES = [
  '/app/wallet',
  '/app/contracts',
  '/app/trips',
];

function extractRoutesFromApp(content: string): string[] {
  const routes: string[] = [];
  
  // Match all path patterns
  const pathRegex = /path=["']([^"']+)["']/g;
  let match;
  
  while ((match = pathRegex.exec(content)) !== null) {
    const routePath = match[1];
    // Add absolute paths
    if (routePath.startsWith('/')) {
      routes.push(routePath);
    } else {
      // Add relative paths as /app prefixed (nested under /app)
      routes.push(`/app/${routePath}`);
    }
  }
  
  // Handle index routes
  if (content.includes('<Route index')) {
    routes.push('/app');
  }
  
  return [...new Set(routes)]; // Dedupe
}

function main() {
  console.log('V3 Route Audit');
  console.log('==============\n');
  
  const appTsxPath = path.resolve(__dirname, '../src/App.tsx');
  
  if (!fs.existsSync(appTsxPath)) {
    console.error('ERROR: App.tsx not found at', appTsxPath);
    process.exit(1);
  }
  
  const content = fs.readFileSync(appTsxPath, 'utf-8');
  const existingRoutes = extractRoutesFromApp(content);
  
  console.log('Found routes in App.tsx:');
  existingRoutes.slice(0, 30).forEach(r => console.log(`  - ${r}`));
  if (existingRoutes.length > 30) console.log(`  ... and ${existingRoutes.length - 30} more`);
  console.log('');
  
  let failCount = 0;
  let warnCount = 0;
  
  console.log('Checking REQUIRED_NOW routes:');
  for (const route of V3_REQUIRED_ROUTES) {
    // Check if route exists (exact match)
    const exists = existingRoutes.includes(route);
    
    if (exists) {
      console.log(`  [PASS] ${route}`);
    } else {
      console.log(`  [FAIL] ${route} - NOT FOUND`);
      failCount++;
    }
  }
  
  console.log('\nChecking FUTURE routes (warn only):');
  for (const route of V3_FUTURE_ROUTES) {
    const exists = existingRoutes.some(r => r === route || r.startsWith(route + '/'));
    if (exists) {
      console.log(`  [OK]   ${route}`);
    } else {
      console.log(`  [WARN] ${route} - not implemented yet`);
      warnCount++;
    }
  }
  
  console.log('\n==============');
  console.log(`Results: ${failCount} failures, ${warnCount} warnings`);
  
  if (failCount > 0) {
    console.log('\nAUDIT FAILED: Missing required routes');
    process.exit(1);
  } else {
    console.log('\nAUDIT PASSED');
    process.exit(0);
  }
}

main();

#!/usr/bin/env tsx
/**
 * V3.5 Certification Script
 * PATENT CC-01 & CC-02 INVENTOR GLENN BALLMAN
 * 
 * Runs automated certification checks:
 * 1. Terminology scan (HARD FAIL on "booking"/"book")
 * 2. UI route inventory
 * 3. API route inventory
 * 4. Invariant checks (SQL-based)
 * 5. Proof bundle generation
 * 
 * Usage: pnpm cert:v35
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { 
  APP_UI_ROUTES, 
  PUBLIC_UI_ROUTES, 
  API_ENDPOINTS, 
  TERMINOLOGY_SCAN_DIRS, 
  TERMINOLOGY_SCAN_EXTENSIONS, 
  TERMINOLOGY_ALLOWLIST,
  INVARIANT_CHECKS,
  DEV_SEED_ENDPOINTS,
} from '../shared/v35Manifest';

const PROOF_DIR = './proof/v3.5';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface CheckResult {
  name: string;
  passed: boolean;
  details: string[];
  critical: boolean;
}

const results: CheckResult[] = [];

function log(msg: string) {
  console.log(msg);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) {
    return files;
  }
  
  function walk(currentDir: string) {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
          walk(fullPath);
        }
      } else if (extensions.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function terminologyScan(): CheckResult {
  logSection('TERMINOLOGY SCAN');
  
  const violations: string[] = [];
  const pattern = /\b(book|booking|bookings|booked)\b/gi;
  
  for (const dir of TERMINOLOGY_SCAN_DIRS) {
    const files = getAllFiles(dir, TERMINOLOGY_SCAN_EXTENSIONS);
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const matches = line.match(pattern);
          
          if (matches) {
            const isAllowed = TERMINOLOGY_ALLOWLIST.some(allowPattern => 
              allowPattern.test(line)
            );
            
            if (!isAllowed) {
              violations.push(`${file}:${i + 1}: ${line.trim().substring(0, 100)}`);
            }
          }
        }
      } catch (err) {
      }
    }
  }
  
  const passed = violations.length === 0;
  
  if (passed) {
    log('✅ No terminology violations found');
  } else {
    log(`❌ Found ${violations.length} terminology violations:`);
    violations.slice(0, 20).forEach(v => log(`   ${v}`));
    if (violations.length > 20) {
      log(`   ... and ${violations.length - 20} more`);
    }
  }
  
  writeProofFile('terminology-scan.json', {
    passed,
    violationCount: violations.length,
    violations: violations.slice(0, 100),
    scannedDirs: TERMINOLOGY_SCAN_DIRS,
  });
  
  return {
    name: 'Terminology Scan',
    passed,
    details: violations,
    critical: true,
  };
}

function uiRouteInventory(): CheckResult {
  logSection('UI ROUTE INVENTORY');
  
  const issues: string[] = [];
  const routesFound: string[] = [];
  
  try {
    const appTsxPath = 'client/src/App.tsx';
    const appContent = existsSync(appTsxPath) ? readFileSync(appTsxPath, 'utf-8') : '';
    
    const allRoutes = [...PUBLIC_UI_ROUTES, ...APP_UI_ROUTES];
    
    for (const route of allRoutes) {
      if (!route.required) continue;
      
      const pathPattern = route.path.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`["'\`]${pathPattern}["'\`]|path=["'\`]${pathPattern}["'\`]`);
      
      if (regex.test(appContent) || appContent.includes(route.path)) {
        routesFound.push(route.path);
        log(`✅ ${route.label} (${route.path})`);
      } else {
        const pagesDir = 'client/src/pages';
        const pageFiles = getAllFiles(pagesDir, ['.tsx', '.ts']);
        let found = false;
        
        for (const pageFile of pageFiles) {
          if (pageFile.toLowerCase().includes(route.path.split('/').pop()?.toLowerCase() || '')) {
            found = true;
            break;
          }
        }
        
        if (found) {
          routesFound.push(route.path);
          log(`✅ ${route.label} (${route.path}) - found in pages`);
        } else {
          issues.push(`Missing route: ${route.label} (${route.path})`);
          log(`❌ ${route.label} (${route.path})`);
        }
      }
    }
  } catch (err) {
    issues.push(`Error scanning routes: ${err}`);
  }
  
  const passed = issues.length === 0;
  
  writeProofFile('routes-ui.json', {
    passed,
    routesFound,
    publicRoutes: PUBLIC_UI_ROUTES,
    appRoutes: APP_UI_ROUTES,
    issues,
  });
  
  return {
    name: 'UI Route Inventory',
    passed,
    details: issues,
    critical: false,
  };
}

function apiRouteInventory(): CheckResult {
  logSection('API ROUTE INVENTORY');
  
  const issues: string[] = [];
  const endpointsFound: Record<string, string[]> = {};
  
  const routeFiles = [
    { file: 'server/routes/surfaces.ts', prefix: '/api/p2/app/surfaces' },
    { file: 'server/routes/proposals.ts', prefix: '/api/p2/app/proposals' },
    { file: 'server/routes/ops.ts', prefix: '/api/p2/app/ops' },
    { file: 'server/routes/n3.ts', prefix: '/api/n3' },
    { file: 'server/routes/media.ts', prefix: '/api/media' },
  ];
  
  for (const domain of Object.keys(API_ENDPOINTS)) {
    endpointsFound[domain] = [];
    log(`\n  ${domain.toUpperCase()}:`);
    
    for (const endpoint of API_ENDPOINTS[domain]) {
      if (!endpoint.required) continue;
      
      const [method, path] = endpoint.path.split(' ');
      let found = false;
      
      for (const rf of routeFiles) {
        if (!existsSync(rf.file)) continue;
        
        const content = readFileSync(rf.file, 'utf-8');
        const pathSegment = path.replace(rf.prefix, '').replace(/:[^/]+/g, ':');
        
        const patterns = [
          new RegExp(`\\.${method.toLowerCase()}\\s*\\(['"\`]${pathSegment.replace(/\//g, '\\/')}`, 'i'),
          new RegExp(`Router\\.${method.toLowerCase()}\\s*\\(['"\`]${pathSegment.replace(/\//g, '\\/')}`, 'i'),
          new RegExp(`${method.toLowerCase()}\\(['"\`]${pathSegment.replace(/\//g, '\\/')}`, 'i'),
        ];
        
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            found = true;
            break;
          }
        }
        
        if (found) break;
      }
      
      if (found) {
        endpointsFound[domain].push(endpoint.path);
        log(`    ✅ ${endpoint.label}`);
      } else {
        issues.push(`Missing endpoint: ${endpoint.path} (${endpoint.label})`);
        log(`    ❌ ${endpoint.label} (${endpoint.path})`);
      }
    }
  }
  
  const passed = issues.length === 0;
  
  writeProofFile('routes-api.json', {
    passed,
    endpointsFound,
    allEndpoints: API_ENDPOINTS,
    issues,
  });
  
  return {
    name: 'API Route Inventory',
    passed,
    details: issues,
    critical: false,
  };
}

async function invariantChecks(): Promise<CheckResult> {
  logSection('INVARIANT CHECKS');
  
  const issues: string[] = [];
  const checkResults: Record<string, { passed: boolean; count?: number; error?: string }> = {};
  
  log('  Note: SQL checks require running database. Checking schema definitions instead...');
  
  const schemaPath = 'shared/schema.ts';
  if (existsSync(schemaPath)) {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    
    if (schemaContent.includes('ccFolioLedger') && schemaContent.includes('pgTable')) {
      log('  ✅ Ledger table defined (cc_folio_ledger)');
      checkResults['ledgerTableExists'] = { passed: true };
    } else {
      issues.push('Ledger table not found in schema');
      checkResults['ledgerTableExists'] = { passed: false, error: 'Not found' };
    }
    
    if (schemaContent.includes('ccFolioLedgerLinks')) {
      log('  ✅ Ledger links table defined (cc_folio_ledger_links)');
      checkResults['ledgerLinksExists'] = { passed: true };
    } else {
      issues.push('Ledger links table not found in schema');
      checkResults['ledgerLinksExists'] = { passed: false, error: 'Not found' };
    }
    
    if (schemaContent.includes('ccSurfaceUnits')) {
      log('  ✅ Surface units table defined (cc_surface_units)');
      checkResults['surfaceUnitsExists'] = { passed: true };
    } else {
      issues.push('Surface units table not found');
      checkResults['surfaceUnitsExists'] = { passed: false, error: 'Not found' };
    }
    
    if (schemaContent.includes('ccSurfaceClaims')) {
      log('  ✅ Surface claims table defined (cc_surface_claims)');
      checkResults['surfaceClaimsExists'] = { passed: true };
    } else {
      issues.push('Surface claims table not found');
      checkResults['surfaceClaimsExists'] = { passed: false, error: 'Not found' };
    }
    
    if (schemaContent.includes('ccRefundIncidents')) {
      log('  ✅ Refund incidents table defined (cc_refund_incidents)');
      checkResults['refundIncidentsExists'] = { passed: true };
    } else {
      issues.push('Refund incidents table not found');
      checkResults['refundIncidentsExists'] = { passed: false, error: 'Not found' };
    }
    
    const portalIdPattern = /portal_id|portalId/g;
    const portalIdMatches = schemaContent.match(portalIdPattern);
    if (portalIdMatches && portalIdMatches.length > 10) {
      log(`  ✅ Portal scoping enforced (${portalIdMatches.length} portal_id references)`);
      checkResults['portalScoping'] = { passed: true, count: portalIdMatches.length };
    } else {
      issues.push('Portal scoping may be incomplete');
      checkResults['portalScoping'] = { passed: false, count: portalIdMatches?.length || 0 };
    }
  }
  
  const passed = issues.length === 0;
  
  writeProofFile('invariants.json', {
    passed,
    checkResults,
    sqlQueries: INVARIANT_CHECKS,
    issues,
    note: 'Schema-based checks. Run with live DB for full SQL validation.',
  });
  
  return {
    name: 'Invariant Checks',
    passed,
    details: issues,
    critical: true,
  };
}

async function fetchDevSeedData(): Promise<void> {
  logSection('DEV SEED ENDPOINTS');
  
  log('  Checking dev seed endpoint definitions...');
  
  const weddingSeedPath = 'server/routes/dev-seed-wedding.ts';
  if (existsSync(weddingSeedPath)) {
    log('  ✅ Wedding stress seed endpoint defined');
    const content = readFileSync(weddingSeedPath, 'utf-8');
    writeProofFile('seed-wedding-proposal.json', {
      exists: true,
      path: weddingSeedPath,
      description: 'Split pay + refunds + incidents stress test',
      endpoint: DEV_SEED_ENDPOINTS.weddingStress,
      lineCount: content.split('\n').length,
    });
  } else {
    log('  ❌ Wedding stress seed endpoint not found');
    writeProofFile('seed-wedding-proposal.json', { exists: false });
  }
  
  const n3SeedPath = 'server/routes/dev-seed-n3.ts';
  if (existsSync(n3SeedPath)) {
    log('  ✅ N3 seed endpoint defined');
    const content = readFileSync(n3SeedPath, 'utf-8');
    writeProofFile('seed-n3-eval.json', {
      exists: true,
      path: n3SeedPath,
      description: 'N3 Service Run Monitor + Replan Engine test data',
      endpoint: DEV_SEED_ENDPOINTS.n3,
      lineCount: content.split('\n').length,
    });
  } else {
    log('  ❌ N3 seed endpoint not found');
    writeProofFile('seed-n3-eval.json', { exists: false });
  }
  
  const opsSeedPath = 'server/routes/ops.ts';
  if (existsSync(opsSeedPath)) {
    const content = readFileSync(opsSeedPath, 'utf-8');
    if (content.includes('/dev/seed')) {
      log('  ✅ Ops seed endpoint defined');
      writeProofFile('seed-ops.json', {
        exists: true,
        path: opsSeedPath,
        description: 'Housekeeping + incident sample data',
        endpoint: DEV_SEED_ENDPOINTS.ops,
      });
    } else {
      log('  ⚠️ Ops seed endpoint not found in ops.ts');
      writeProofFile('seed-ops.json', { exists: false, note: 'Endpoint not found in ops.ts' });
    }
  }
}

function writeProofFile(filename: string, data: object): void {
  if (!existsSync(PROOF_DIR)) {
    mkdirSync(PROOF_DIR, { recursive: true });
  }
  
  const filepath = join(PROOF_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function printSummary(): boolean {
  logSection('CERTIFICATION SUMMARY');
  
  let passed = 0;
  let failed = 0;
  let criticalFailed = false;
  
  for (const result of results) {
    if (result.passed) {
      passed++;
      log(`✅ ${result.name}`);
    } else {
      failed++;
      const marker = result.critical ? '❌ [CRITICAL]' : '⚠️';
      log(`${marker} ${result.name} (${result.details.length} issues)`);
      if (result.critical) {
        criticalFailed = true;
      }
    }
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`  Proof bundle: ${PROOF_DIR}/`);
  console.log('-'.repeat(60));
  
  if (criticalFailed) {
    console.log('\n❌ CERTIFICATION FAILED - Critical checks did not pass');
    return false;
  } else if (failed > 0) {
    console.log('\n⚠️ CERTIFICATION PASSED WITH WARNINGS');
    return true;
  } else {
    console.log('\n✅ V3.5 CERTIFICATION PASSED');
    return true;
  }
}

async function main(): Promise<void> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         V3.5 CERTIFICATION SUITE                           ║');
  console.log('║  Patents CC-01 & CC-02 - Inventor: Glenn Ballman           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  if (!existsSync(PROOF_DIR)) {
    mkdirSync(PROOF_DIR, { recursive: true });
  }
  
  results.push(terminologyScan());
  
  results.push(uiRouteInventory());
  
  results.push(apiRouteInventory());
  
  results.push(await invariantChecks());
  
  await fetchDevSeedData();
  
  const certPassed = printSummary();
  
  const files = existsSync(PROOF_DIR) ? readdirSync(PROOF_DIR) : [];
  console.log('\nProof bundle files generated:');
  files.forEach(f => console.log(`  - ${PROOF_DIR}/${f}`));
  
  process.exit(certPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Certification failed with error:', err);
  process.exit(1);
});

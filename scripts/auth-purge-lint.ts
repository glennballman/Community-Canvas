#!/usr/bin/env npx tsx
/**
 * AUTH PURGE LINT SCRIPT
 * 
 * This script fails the build if any legacy/staging auth references exist in the codebase.
 * Run as part of CI/lint to prevent regression.
 * 
 * Usage: npx tsx scripts/auth-purge-lint.ts
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const FORBIDDEN_PATTERNS = [
  'cc_staging_users',
  'cc_staging_sessions', 
  'cc_staging_password_resets',
  'cc_staging_host_accounts',
  'cc_staging_host_sessions',
  'cc_staging_user_favorites',
  'cc_staging_user_vehicles',
  'cc_legacy_',
  'staging_users',
  'source.*cc_staging',
  'migrated_from_staging',
];

const SEARCH_DIRS = ['server', 'client', 'shared'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '_deprecated'];
const EXCLUDE_FILES = [
  'AUTH_PURGE_AUDIT.md',
  'AUTH_V3_PROOF_PACK.md',
  'auth-purge-lint.ts',
  'stagingStorage.ts', // Non-auth staging storage is allowed
];

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

function searchPattern(pattern: string): Violation[] {
  const violations: Violation[] = [];
  
  for (const dir of SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    
    try {
      const excludeArgs = EXCLUDE_DIRS.map(d => `--glob '!${d}/**'`).join(' ');
      const excludeFileArgs = EXCLUDE_FILES.map(f => `--glob '!**/${f}'`).join(' ');
      
      const cmd = `rg -n '${pattern}' ${dir} ${excludeArgs} ${excludeFileArgs} 2>/dev/null || true`;
      const output = execSync(cmd, { encoding: 'utf-8' });
      
      if (output.trim()) {
        const lines = output.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            violations.push({
              file: match[1],
              line: parseInt(match[2], 10),
              content: match[3].trim(),
              pattern,
            });
          }
        }
      }
    } catch (e) {
      // rg returns exit code 1 if no matches, which is fine
    }
  }
  
  return violations;
}

function main(): void {
  console.log('🔍 AUTH PURGE LINT: Checking for forbidden staging/legacy auth patterns...\n');
  
  const allViolations: Violation[] = [];
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    const violations = searchPattern(pattern);
    allViolations.push(...violations);
  }
  
  // Filter out allowed files/patterns
  const filteredViolations = allViolations.filter(v => {
    // Allow _deprecated folder (quarantined legacy code)
    if (v.file.includes('/_deprecated/')) return false;
    // Allow stagingStorage.ts for non-auth staging (properties, spots, etc)
    if (v.file.includes('stagingStorage.ts')) return false;
    // Allow staging.ts route for non-auth staging
    if (v.file.includes('routes/staging.ts')) return false;
    // Allow crew routes for non-auth staging properties
    if (v.file.includes('routes/crew.ts') && v.content.includes('cc_staging_properties')) return false;
    // Allow crew/AccommodationSearch for cc_staging_properties reference
    if (v.file.includes('AccommodationSearch.tsx') && v.content.includes('cc_staging_properties')) return false;
    // Allow commented-out code in routes.ts
    if (v.file.includes('routes.ts') && v.content.trim().startsWith('//')) return false;
    // Allow documentation files
    if (v.file.endsWith('.md')) return false;
    return true;
  });
  
  if (filteredViolations.length === 0) {
    console.log('✅ No forbidden staging/legacy auth patterns found!\n');
    console.log('AUTH PURGE LINT: PASSED');
    process.exit(0);
  }
  
  console.error('❌ FORBIDDEN STAGING/LEGACY AUTH PATTERNS FOUND:\n');
  
  for (const v of filteredViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    Content: ${v.content.slice(0, 100)}`);
    console.error('');
  }
  
  console.error(`\n❌ AUTH PURGE LINT: FAILED (${filteredViolations.length} violations)\n`);
  console.error('These patterns indicate legacy auth code that should have been removed.');
  console.error('Please remove these references or update EXCLUDE_FILES in auth-purge-lint.ts if intentional.\n');
  
  process.exit(1);
}

main();

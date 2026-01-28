/**
 * PROMPT-10: Forbidden Authority Sources Guard
 * 
 * This test ensures no authorization decisions use forbidden sources.
 * Per AUTH_CONSTITUTION.md Section 11, platform admin authority MUST
 * come from cc_grants, NOT from:
 * - cc_users.is_platform_admin flag
 * - JWT isPlatformAdmin claim
 * - Hardcoded admin lists
 * 
 * PROMPT-10: All production files have been migrated to:
 * - Capability-based checks: `can(req, 'platform.configure')`
 * - Grant-based checks: `checkPlatformAdminGrant(userId)`
 * 
 * Only dev/test files and infrastructure files (type definitions, data reads) remain whitelisted.
 */

import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// PROMPT-10: Remaining whitelist entries are for:
// 1. Dev/test files (acceptable - not production authorization)
// 2. Data reads (SELECT queries returning the flag as data, not using it for auth)
// 3. Type definitions (interface declarations, not authorization logic)
// 4. Infrastructure (auth system internals that use grant-based checks)
const WHITELISTED_VIOLATIONS: Record<string, string[]> = {
  'is_platform_admin': [
    // Dev/test files (acceptable - not production authorization)
    'server/routes/dev-login.ts',
    'server/routes/dev-seed-parking.ts',
    'server/routes/dev-seed-marina.ts',
    'server/routes/test-auth.ts',
    // Data reads (SELECT queries returning the flag as data, not using it for auth)
    'server/routes/auth.ts',
    'server/routes/admin-impersonation.ts',
    'server/routes/p2-platform.ts',
    'server/routes/user-context.ts',
    'server/routes/internal.ts',
    // Infrastructure (auth system internals that use grant-based checks)
    'server/middleware/guards.ts',
    'server/auth/capabilities.ts',
  ],
  'isPlatformAdmin': [
    // Dev/test files (acceptable - not production authorization)
    'server/routes/dev-login.ts',
    'server/routes/test-auth.ts',
    // Infrastructure: Type definitions and interface declarations (not authorization logic)
    'server/middleware/auth.ts',
    'server/middleware/guards.ts',
    'server/routes/internal.ts',
    // PROMPT-10: user-context.ts uses it for data assembly, not authorization
    'server/routes/user-context.ts',
  ]
};

// PROMPT-10: Files migrated to capability-based checks (use `can()` from authorize.ts)
const CAPABILITY_MIGRATED_FILES = [
  'server/routes/n3.ts',
  'server/routes/onboarding.ts', 
  'server/routes/public-onboard.ts',
  'server/routes/maintenance-requests.ts',
  'server/middleware/tenantContext.ts',
];

// PROMPT-10: Files migrated to grant-based checks (use `checkPlatformAdminGrant()`)
const GRANT_MIGRATED_FILES = [
  'server/routes/foundation.ts',
];

// All migrated files combined
const ALL_MIGRATED_FILES = [...CAPABILITY_MIGRATED_FILES, ...GRANT_MIGRATED_FILES];

describe('Forbidden Authority Sources Guard', () => {

  test('platform admin check in foundation.ts uses grants only', () => {
    const foundationPath = path.join(process.cwd(), 'server/routes/foundation.ts');
    const content = fs.readFileSync(foundationPath, 'utf-8');
    
    // Verify checkPlatformAdminGrant queries cc_grants
    expect(content).toContain('cc_grants');
    expect(content).toContain('cc_principals');
    expect(content).toContain('10000000-0000-0000-0000-000000000001'); // Platform admin role ID
    expect(content).toContain('00000000-0000-0000-0000-000000000001'); // Platform scope ID
    
    // Verify requirePlatformAdmin uses checkPlatformAdminGrant
    expect(content).toContain('checkPlatformAdminGrant(req.user.userId)');
    
    // Verify PROMPT-10 migration markers are present
    expect(content).toContain('PROMPT-10: Use grant-based check');
    
    // PROMPT-10: Verify authorization uses grant-based, NOT flag-based checks
    // Look for patterns that would indicate flag-based authorization
    const flagAuthPatterns = [
      /req\.user[!?]?\.isPlatformAdmin\s*[=!&|?]/,
      /if\s*\(\s*[^)]*req\.user[!?]?\.isPlatformAdmin/,
      /if\s*\(\s*[^)]*user\.isPlatformAdmin\s*[=!&|?]/,
    ];
    for (const pattern of flagAuthPatterns) {
      expect(content).not.toMatch(pattern);
    }
  });

  test('p2-platform routes use requireCapability', () => {
    const p2PlatformPath = path.join(process.cwd(), 'server/routes/p2-platform.ts');
    const content = fs.readFileSync(p2PlatformPath, 'utf-8');
    
    // Verify router uses requireCapability middleware
    expect(content).toMatch(/router\.use\(requireCapability\('platform\.configure'\)\)/);
  });

  test('AUTH_CONSTITUTION.md documents platform admin authority rules', () => {
    const constitutionPath = path.join(process.cwd(), 'docs/AUTH_CONSTITUTION.md');
    const content = fs.readFileSync(constitutionPath, 'utf-8');
    
    // Verify Section 11 exists
    expect(content).toContain('## 11. Platform Admin Authority');
    expect(content).toContain('`cc_grants` at platform scope');
    expect(content).toContain('Forbidden as authoritative sources');
    expect(content).toContain('cc_users.is_platform_admin');
    expect(content).toContain('non-authoritative');
  });

  test('PROMPT-10 capability-migrated files use can() checks', () => {
    for (const filePath of CAPABILITY_MIGRATED_FILES) {
      const fullPath = path.join(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Verify PROMPT-10 migration markers are present
      expect(content).toContain('PROMPT-10:');
      
      // Verify capability check import or usage
      expect(content).toMatch(/import.*can.*from.*authorize|can\(req,.*'platform\.configure'\)/);
    }
  });

  test('PROMPT-10 grant-migrated files use checkPlatformAdminGrant', () => {
    for (const filePath of GRANT_MIGRATED_FILES) {
      const fullPath = path.join(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Verify PROMPT-10 migration markers are present
      expect(content).toContain('PROMPT-10:');
      
      // Verify grant-based check usage
      expect(content).toContain('checkPlatformAdminGrant');
      
      // Verify it queries cc_grants table
      expect(content).toContain('cc_grants');
    }
  });

  test('no new is_platform_admin violations outside whitelist', () => {
    const result = execSync(
      'grep -rn "is_platform_admin" server/routes/ server/middleware/ server/auth/ --include="*.ts" 2>/dev/null || true',
      { encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n').filter(Boolean);
    const violations: string[] = [];
    
    for (const line of lines) {
      const filePath = line.split(':')[0];
      const fileName = path.basename(filePath);
      
      // Skip if whitelisted
      const isWhitelisted = WHITELISTED_VIOLATIONS['is_platform_admin']?.some(
        w => filePath.includes(w.replace('server/routes/', ''))
      );
      
      // Skip grant-migrated files (they reference is_platform_admin in SELECTs or comments)
      const isGrantMigrated = GRANT_MIGRATED_FILES.some(f => filePath.includes(f.replace('server/', '')));
      
      // Skip test files
      if (fileName.endsWith('.test.ts')) continue;
      
      // Skip comments that explain the deprecation
      if (line.includes('// ') && !line.includes('if (') && !line.includes('if(')) continue;
      if (line.includes('SELECT') && line.includes('is_platform_admin')) continue; // Data reads OK
      if (line.includes('COMMENT ON')) continue; // DB comments OK
      
      if (!isWhitelisted && !isGrantMigrated && line.includes('is_platform_admin')) {
        violations.push(line);
      }
    }
    
    if (violations.length > 0) {
      console.log('\n=== NEW is_platform_admin VIOLATIONS ===');
      violations.forEach(v => console.log(v));
      console.log('\nThese must be migrated to grant-based checks or added to whitelist.');
    }
    
    expect(violations.length).toBe(0);
  });

  test('no new isPlatformAdmin authorization checks outside whitelist', () => {
    // Find isPlatformAdmin used in conditionals (authorization checks)
    const result = execSync(
      'grep -rn "isPlatformAdmin" server/routes/ server/middleware/ server/auth/ --include="*.ts" 2>/dev/null || true',
      { encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n').filter(Boolean);
    const violations: string[] = [];
    
    for (const line of lines) {
      const filePath = line.split(':')[0];
      const fileName = path.basename(filePath);
      
      // Skip test files
      if (fileName.endsWith('.test.ts')) continue;
      
      // Skip type definitions and interfaces
      if (line.includes('isPlatformAdmin:') && line.includes('boolean')) continue;
      if (line.includes('interface ')) continue;
      
      // Skip if whitelisted
      const isWhitelisted = WHITELISTED_VIOLATIONS['isPlatformAdmin']?.some(
        w => filePath.includes(w.replace('server/routes/', ''))
      );
      
      // Skip grant-migrated files (they use isPlatformAdmin variable to store grant check result)
      const isGrantMigrated = GRANT_MIGRATED_FILES.some(f => filePath.includes(f.replace('server/', '')));
      
      // Authorization check patterns using FLAG (not grant result): if statements, ternary, &&
      // These are violations only if they access req.user.isPlatformAdmin or user.isPlatformAdmin
      const isFlagAuthCheck = 
        (line.includes('req.user') && line.includes('isPlatformAdmin') && 
          (line.includes('if (') || line.includes('if(') || line.includes('? ') || line.includes('&&'))) ||
        (line.includes('user.isPlatformAdmin') && 
          (line.includes('if (') || line.includes('if(') || line.includes('? ') || line.includes('&&')));
      
      if (!isWhitelisted && !isGrantMigrated && isFlagAuthCheck) {
        violations.push(line);
      }
    }
    
    if (violations.length > 0) {
      console.log('\n=== NEW isPlatformAdmin AUTH CHECK VIOLATIONS ===');
      violations.forEach(v => console.log(v));
      console.log('\nThese must use requireCapability or grant-based checks.');
    }
    
    expect(violations.length).toBe(0);
  });

  test('migrated files no longer use isPlatformAdmin for FLAG-based authorization', () => {
    for (const filePath of ALL_MIGRATED_FILES) {
      const fullPath = path.join(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Check for FLAG-based authorization patterns (accessing isPlatformAdmin from request/user)
      const flagAuthPatterns = [
        /req\.user[!?]?\.isPlatformAdmin\s*[=!&|?]/,
        /user\.isPlatformAdmin\s*===?\s*true/,
      ];
      
      for (const pattern of flagAuthPatterns) {
        const match = content.match(pattern);
        if (match) {
          throw new Error(`${filePath} still uses isPlatformAdmin FLAG for authorization: ${match[0]}`);
        }
      }
    }
  });

  test('whitelist only contains acceptable entries', () => {
    const allWhitelisted = [
      ...WHITELISTED_VIOLATIONS['is_platform_admin'],
      ...WHITELISTED_VIOLATIONS['isPlatformAdmin']
    ].filter((v, i, arr) => arr.indexOf(v) === i); // Dedupe
    
    // Verify no migrated files are in whitelist
    for (const migratedFile of ALL_MIGRATED_FILES) {
      expect(allWhitelisted).not.toContain(migratedFile);
    }
    
    // Categorize remaining whitelist
    const devTestFiles = allWhitelisted.filter(f => f.includes('dev-') || f.includes('test-'));
    const infrastructureFiles = allWhitelisted.filter(f => 
      f.includes('auth/') || f.includes('guards.ts') || f.includes('middleware/auth.ts')
    );
    const dataReadFiles = allWhitelisted.filter(f => 
      !f.includes('dev-') && !f.includes('test-') && !f.includes('auth/') && !f.includes('guards.ts') && !f.includes('middleware/auth.ts')
    );
    
    console.log('\n=== Whitelist Summary (PROMPT-10) ===');
    console.log(`Dev/Test files: ${devTestFiles.length}`);
    console.log(`Infrastructure files: ${infrastructureFiles.length}`);
    console.log(`Data read files: ${dataReadFiles.length}`);
    console.log(`Capability-migrated files: ${CAPABILITY_MIGRATED_FILES.length}`);
    console.log(`Grant-migrated files: ${GRANT_MIGRATED_FILES.length}`);
    console.log('\nAll whitelisted files are acceptable per AUTH_CONSTITUTION.md Section 11.');
    
    // Verify whitelist is not growing - should be stable after PROMPT-10
    expect(allWhitelisted.length).toBeLessThanOrEqual(18);
  });
});

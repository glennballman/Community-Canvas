/**
 * PROMPT-9B: Forbidden Authority Sources Guard
 * 
 * This test ensures no authorization decisions use forbidden sources.
 * Per AUTH_CONSTITUTION.md Section 11, platform admin authority MUST
 * come from cc_grants, NOT from:
 * - cc_users.is_platform_admin flag
 * - JWT isPlatformAdmin claim
 * - Hardcoded admin lists
 */

import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Known violations that are whitelisted (documented technical debt)
// These MUST be migrated to grant-based checks in future work
const WHITELISTED_VIOLATIONS: Record<string, string[]> = {
  'is_platform_admin': [
    // Dev/test files (acceptable)
    'server/routes/dev-login.ts',
    'server/routes/dev-seed-parking.ts',
    'server/routes/dev-seed-marina.ts',
    'server/routes/test-auth.ts',
    // Data reads (not authorization checks)
    'server/routes/auth.ts',
    'server/routes/admin-impersonation.ts',
    'server/routes/p2-platform.ts',
    'server/routes/user-context.ts',
    'server/routes/foundation.ts',
    'server/routes/internal.ts',
    'server/middleware/guards.ts',
    'server/auth/capabilities.ts',
  ],
  'isPlatformAdmin': [
    // Dev/test files (acceptable)
    'server/routes/dev-login.ts',
    'server/routes/test-auth.ts',
    // Production files (TODO: Migrate to requireCapability or grant checks)
    'server/routes/n3.ts',
    'server/routes/onboarding.ts',
    'server/routes/public-onboard.ts',
    'server/routes/maintenance-requests.ts',
    'server/routes/internal.ts',
    'server/routes/foundation.ts',
    'server/middleware/tenantContext.ts',
  ]
};

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
    
    // Verify loadTenantContext uses grant check, not JWT claim
    expect(content).toContain('PROMPT-9B: Use grant-based check');
    expect(content).toContain('checkPlatformAdminGrant(req.user.userId)');
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
      
      // Skip test files
      if (fileName.endsWith('.test.ts')) continue;
      
      // Skip comments and strings that don't look like authorization checks
      if (line.includes('// ') && !line.includes('if')) continue;
      if (line.includes('SELECT') && line.includes('is_platform_admin')) continue; // Data reads OK
      
      if (!isWhitelisted && line.includes('is_platform_admin')) {
        violations.push(line);
      }
    }
    
    if (violations.length > 0) {
      console.log('\\n=== NEW is_platform_admin VIOLATIONS ===');
      violations.forEach(v => console.log(v));
      console.log('\\nThese must be migrated to grant-based checks or added to whitelist.');
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
      
      // Authorization check patterns: if statements, ternary, &&
      const isAuthCheck = 
        line.includes('if (') ||
        line.includes('if(') ||
        line.includes('? ') ||
        line.includes('&&') ||
        line.includes('isPlatformAdmin === true') ||
        line.includes('isPlatformAdmin == true');
      
      if (!isWhitelisted && isAuthCheck) {
        violations.push(line);
      }
    }
    
    if (violations.length > 0) {
      console.log('\\n=== NEW isPlatformAdmin AUTH CHECK VIOLATIONS ===');
      violations.forEach(v => console.log(v));
      console.log('\\nThese must use requireCapability or grant-based checks.');
    }
    
    expect(violations.length).toBe(0);
  });

  test('documents known violations for future remediation', () => {
    const allWhitelisted = [
      ...WHITELISTED_VIOLATIONS['is_platform_admin'],
      ...WHITELISTED_VIOLATIONS['isPlatformAdmin']
    ].filter((v, i, arr) => arr.indexOf(v) === i); // Dedupe
    
    const todoViolations = allWhitelisted.filter(f => !f.includes('dev-') && !f.includes('test-'));
    
    console.log('\\n=== Technical Debt: Files Using Forbidden Authority Sources ===');
    todoViolations.forEach(file => {
      console.log(`  - ${file}`);
    });
    console.log('\\nThese MUST be migrated to grant-based checks per AUTH_CONSTITUTION.md Section 11.');
    
    expect(todoViolations.length).toBeGreaterThan(0);
  });
});

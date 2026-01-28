/**
 * PROMPT-10: Forbidden Authority Sources Guard
 * PROMPT-13: Identity Graph Lock + Forbidden Fallbacks
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
 * PROMPT-13 additions:
 * - Forbid "bootstrap" fallback patterns
 * - Forbid "if principal missing then treat as admin" patterns
 * - Forbid direct cc_users.is_platform_admin reads for authorization
 * - server/auth/principal.ts remains ONLY identity resolver
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

// PROMPT-13: Identity Graph Lock + Forbidden Fallbacks
describe('PROMPT-13: Forbidden Fallback Authority Patterns', () => {

  test('no bootstrap admin fallback patterns in authorization code', () => {
    // PROMPT-13: Detect patterns like "bootstrap", "seed admin", "initial admin"
    // that might bypass principal-based authorization
    const result = execSync(
      'grep -rn -E "(bootstrap.*admin|initial.*admin|seed.*admin|default.*admin)" server/routes/ server/middleware/ server/auth/ --include="*.ts" 2>/dev/null || true',
      { encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n').filter(Boolean);
    const violations: string[] = [];
    
    // PROMPT-13: Whitelisted bootstrap files (legitimate initial setup infrastructure)
    const WHITELISTED_BOOTSTRAP_FILES = [
      'server/routes/internal.ts', // Platform bootstrap endpoint - creates first admin with proper grants
    ];
    
    for (const line of lines) {
      const filePath = line.split(':')[0];
      
      // Skip test files
      if (filePath.endsWith('.test.ts')) continue;
      
      // Skip dev-* files (acceptable for development seeding)
      if (filePath.includes('dev-')) continue;
      
      // Skip whitelisted bootstrap infrastructure files
      if (WHITELISTED_BOOTSTRAP_FILES.some(w => filePath.includes(w.replace('server/', '')))) continue;
      
      // Skip comments that explain the concept
      if (line.includes('// ') && !line.includes('if (') && !line.includes('if(')) continue;
      
      // Skip help text messages (not authorization logic)
      if (line.includes('message:') && line.includes("'")) continue;
      
      violations.push(line);
    }
    
    if (violations.length > 0) {
      console.log('\n=== BOOTSTRAP ADMIN FALLBACK VIOLATIONS (PROMPT-13) ===');
      violations.forEach(v => console.log(v));
    }
    
    expect(violations.length).toBe(0);
  });

  test('no "if principal missing then treat as admin" fallback patterns', () => {
    // PROMPT-13: Detect patterns that grant admin when principal is null/undefined
    const result = execSync(
      'grep -rn -E "(principal.*null|!principal|principal\\s*===?\\s*null|principalId\\s*===?\\s*null).*admin|(admin|authorize).*(!principal|principal.*null)" server/routes/ server/middleware/ server/auth/ --include="*.ts" 2>/dev/null || true',
      { encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n').filter(Boolean);
    const violations: string[] = [];
    
    for (const line of lines) {
      const filePath = line.split(':')[0];
      
      // Skip test files
      if (filePath.endsWith('.test.ts')) continue;
      
      // Skip comments
      if (line.includes('// ') && !line.includes('if (')) continue;
      
      // Skip error handling patterns (returning 401/403 when principal missing is OK)
      if (line.includes('401') || line.includes('403') || line.includes('return')) continue;
      
      violations.push(line);
    }
    
    if (violations.length > 0) {
      console.log('\n=== PRINCIPAL MISSING FALLBACK VIOLATIONS (PROMPT-13) ===');
      violations.forEach(v => console.log(v));
    }
    
    expect(violations.length).toBe(0);
  });

  test('principal.ts is the ONLY identity resolver', () => {
    // PROMPT-13: server/auth/principal.ts must be the single source of identity resolution
    const principalPath = path.join(process.cwd(), 'server/auth/principal.ts');
    const content = fs.readFileSync(principalPath, 'utf-8');
    
    // Verify it exports resolvePrincipalFromSession as the single authority
    expect(content).toContain('export async function resolvePrincipalFromSession');
    expect(content).toContain('SINGLE AUTHORITY for identity');
    
    // Verify it documents the identity graph
    expect(content).toContain('Identity Graph');
    expect(content).toContain('cc_users');
    expect(content).toContain('cc_individuals');
    expect(content).toContain('cc_principals');
    
    // PROMPT-13: Verify it uses ensure_principal_for_user DB function
    expect(content).toContain('ensure_principal_for_user');
  });

  test('no parallel identity resolvers exist', () => {
    // PROMPT-13: Ensure no other files implement resolvePrincipal* functions
    const result = execSync(
      'grep -rn "function resolvePrincipal\\|async function resolvePrincipal\\|resolvePrincipal.*=.*async" server/ --include="*.ts" 2>/dev/null || true',
      { encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n').filter(Boolean);
    const nonPrincipalFiles = lines.filter(line => {
      const filePath = line.split(':')[0];
      return !filePath.includes('principal.ts') && !filePath.endsWith('.test.ts');
    });
    
    if (nonPrincipalFiles.length > 0) {
      console.log('\n=== PARALLEL IDENTITY RESOLVER VIOLATIONS (PROMPT-13) ===');
      nonPrincipalFiles.forEach(v => console.log(v));
    }
    
    expect(nonPrincipalFiles.length).toBe(0);
  });

  test('no authorization decisions from JWT claims alone', () => {
    // PROMPT-13: Authorization must not come from JWT claims bypassing cc_grants
    const result = execSync(
      'grep -rn -E "(jwt|token|claim).*admin.*(if|\\?|&&)|(if|\\?|&&).*(jwt|token|claim).*admin" server/routes/ server/middleware/ --include="*.ts" 2>/dev/null || true',
      { encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n').filter(Boolean);
    const violations = lines.filter(line => {
      const filePath = line.split(':')[0];
      // Skip test files
      if (filePath.endsWith('.test.ts')) return false;
      // Skip comments
      if (line.includes('// ') && !line.includes('if (')) return false;
      // Skip the auth infrastructure that validates tokens (not authorizes)
      if (filePath.includes('middleware/auth.ts')) return false;
      return true;
    });
    
    if (violations.length > 0) {
      console.log('\n=== JWT CLAIM AUTHORIZATION VIOLATIONS (PROMPT-13) ===');
      violations.forEach(v => console.log(v));
    }
    
    expect(violations.length).toBe(0);
  });

  test('identity graph functions exist in database', async () => {
    // PROMPT-13: Verify the ensure_principal_for_user and verify_identity_graph_integrity functions exist
    // This test imports from the server module to verify DB functions
    const { serviceQuery } = await import('../../server/db/tenantDb');
    
    const result = await serviceQuery(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name IN ('ensure_principal_for_user', 'ensure_individual_for_user', 'verify_identity_graph_integrity')
        AND routine_schema = 'public'
    `);
    
    const functionNames = result.rows.map((r: any) => r.routine_name);
    
    expect(functionNames).toContain('ensure_principal_for_user');
    expect(functionNames).toContain('ensure_individual_for_user');
    expect(functionNames).toContain('verify_identity_graph_integrity');
  });

  test('identity graph integrity check passes', async () => {
    // PROMPT-13: Verify the identity graph FK constraints are correct
    const { serviceQuery } = await import('../../server/db/tenantDb');
    
    const result = await serviceQuery(`SELECT * FROM verify_identity_graph_integrity()`);
    
    for (const row of result.rows) {
      expect(row.check_passed).toBe(true);
    }
    
    // Specifically verify cc_principals.user_id -> cc_individuals.id (not cc_users)
    const fkCheck = result.rows.find((r: any) => r.check_name === 'cc_principals_user_id_fk_target');
    expect(fkCheck?.detail).toContain('cc_individuals.id');
  });
});

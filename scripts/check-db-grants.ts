#!/usr/bin/env tsx
/**
 * DB Permission Parity Check
 * 
 * Verifies that all required tables have proper grants for the cc_app role.
 * Run in dev startup and CI to prevent permission denied errors.
 * 
 * Usage: npx tsx scripts/check-db-grants.ts
 */

import pg from 'pg';

const REQUIRED_ROLE = 'cc_app';

const TABLE_PREFIXES = [
  'unified_',
  'resource_',
  'asset_',
  'cc_',
];

const EXPLICIT_TABLES = [
  'individuals',
  'tenants',
  'tenant_memberships',
  'session',
];

const REQUIRED_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

async function checkGrants(): Promise<{ success: boolean; missing: string[] }> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const missing: string[] = [];

  try {
    const prefixConditions = TABLE_PREFIXES.map(p => `table_name LIKE '${p}%'`).join(' OR ');
    const explicitCondition = EXPLICIT_TABLES.map(t => `'${t}'`).join(', ');

    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND (${prefixConditions} OR table_name IN (${explicitCondition}))
      ORDER BY table_name
    `;

    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(r => r.table_name);

    console.log(`\n[DB Grants Check] Found ${tables.length} tables to verify\n`);

    for (const tableName of tables) {
      const grantsQuery = `
        SELECT privilege_type 
        FROM information_schema.table_privileges 
        WHERE table_name = $1 
          AND grantee = $2
      `;

      const grantsResult = await pool.query(grantsQuery, [tableName, REQUIRED_ROLE]);
      const grantedPrivileges = grantsResult.rows.map(r => r.privilege_type);

      const missingPrivileges = REQUIRED_PRIVILEGES.filter(p => !grantedPrivileges.includes(p));

      if (missingPrivileges.length > 0) {
        const msg = `${tableName}: missing ${missingPrivileges.join(', ')} for ${REQUIRED_ROLE}`;
        missing.push(msg);
        console.log(`  [FAIL] ${msg}`);
      } else {
        console.log(`  [OK] ${tableName}`);
      }
    }

    const rlsQuery = `
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND rowsecurity = true
    `;

    const rlsResult = await pool.query(rlsQuery);
    
    if (rlsResult.rows.length > 0) {
      console.log(`\n[RLS Check] ${rlsResult.rows.length} tables have RLS enabled:`);
      
      for (const row of rlsResult.rows) {
        const policiesQuery = `
          SELECT policyname 
          FROM pg_policies 
          WHERE tablename = $1
        `;
        const policiesResult = await pool.query(policiesQuery, [row.tablename]);
        
        if (policiesResult.rows.length === 0) {
          const msg = `${row.tablename}: RLS enabled but no policies defined`;
          missing.push(msg);
          console.log(`  [WARN] ${msg}`);
        } else {
          console.log(`  [OK] ${row.tablename}: ${policiesResult.rows.length} policies`);
        }
      }
    }

  } finally {
    await pool.end();
  }

  return { success: missing.length === 0, missing };
}

async function main() {
  console.log('='.repeat(60));
  console.log('DB Permission Parity Check');
  console.log('='.repeat(60));

  const { success, missing } = await checkGrants();

  console.log('\n' + '='.repeat(60));
  
  if (success) {
    console.log('[PASS] All required tables have proper grants');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log(`[FAIL] ${missing.length} issues found:`);
    missing.forEach(m => console.log(`  - ${m}`));
    console.log('\nFix by adding GRANT statements to migrations:');
    console.log('  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE <table_name> TO cc_app;');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Parity check failed:', err);
  process.exit(1);
});

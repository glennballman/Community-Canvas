import { pool } from '../server/db';
import { setSessionVars, clearSessionVars, setServiceMode } from '../server/db/tenantDb';

const TENANT_A = 'd0000000-0000-0000-0000-000000000001';

async function testSessionVarLeakage() {
  console.log('=== Session Variable Leakage Test (50 iterations) ===\n');
  
  for (let i = 0; i < 50; i++) {
    const client = await pool.connect();
    try {
      if (i % 2 === 0) {
        // Simulate tenantQuery
        await clearSessionVars(client);
        await setSessionVars(client, { tenantId: TENANT_A, portalId: null, individualId: null });
        
        const result = await client.query(
          `SELECT 
            current_setting('app.tenant_id', true) as tenant_id,
            current_setting('app.portal_id', true) as portal_id,
            current_setting('app.individual_id', true) as individual_id`
        );
        const r = result.rows[0];
        if (r.tenant_id !== TENANT_A || r.tenant_id === '__SERVICE__') {
          console.log(`FAIL [${i}] tenantQuery executed with wrong context:`, r);
          process.exit(1);
        }
      } else {
        // Simulate serviceQuery
        await clearSessionVars(client);
        await setServiceMode(client);
        
        const result = await client.query(
          `SELECT 
            current_setting('app.tenant_id', true) as tenant_id,
            current_setting('app.portal_id', true) as portal_id,
            current_setting('app.individual_id', true) as individual_id`
        );
        const r = result.rows[0];
        if (r.tenant_id !== '__SERVICE__') {
          console.log(`FAIL [${i}] serviceQuery executed with tenant context:`, r);
          process.exit(1);
        }
        // Ensure no stale UUIDs leaked into service mode
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(r.portal_id) || uuidRegex.test(r.individual_id)) {
          console.log(`FAIL [${i}] serviceQuery has stale UUID in portal/individual:`, r);
          process.exit(1);
        }
      }
    } finally {
      await clearSessionVars(client);
      client.release();
    }
    
    if (i % 10 === 9) {
      console.log(`  Iterations ${i-8}-${i+1}: PASS`);
    }
  }
  
  console.log('\nPASS: 50 iterations completed without session variable leakage');
  console.log('  - tenantQuery never executed with __SERVICE__');
  console.log('  - serviceQuery never executed with tenant UUID');
  
  await pool.end();
}

testSessionVarLeakage().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});

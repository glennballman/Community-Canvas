/**
 * Migration: Add Contractor Assignment + Disclosure Audit
 * 
 * A) Add assigned_contractor_person_id to cc_maintenance_requests
 *    - FK reference to cc_people(id)
 *    - ON DELETE SET NULL
 *    - Index on (portal_id, assigned_contractor_person_id)
 *    - NOTE: cc_maintenance_requests doesn't have tenant_id; uses portal_id 
 *      (portals are tenant-scoped via cc_portals.owning_tenant_id)
 *    - NOTE: Does NOT remove legacy assignedTo/assignedVendor text fields
 * 
 * B) Create cc_work_disclosure_audit table
 *    - Append-only audit trail for disclosure actions
 *    - RLS with tenant isolation + is_service_mode() bypass
 *    - NOTE: cc_people is not in shared/schema.ts so Drizzle references 
 *      not added; FK constraints exist in database via SQL migration
 */

import { pool } from '../db';

export async function runMigration(): Promise<void> {
  console.log('[Migration] Adding contractor assignment and disclosure audit...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ============ A) Add assigned_contractor_person_id column ============
    
    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'cc_maintenance_requests' 
      AND column_name = 'assigned_contractor_person_id'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('[Migration] Adding assigned_contractor_person_id column...');
      
      // Add column with FK
      await client.query(`
        ALTER TABLE cc_maintenance_requests
        ADD COLUMN assigned_contractor_person_id uuid NULL
        REFERENCES cc_people(id) ON DELETE SET NULL
      `);
      
      // Add index for efficient lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cc_maintenance_requests_contractor
        ON cc_maintenance_requests (portal_id, assigned_contractor_person_id)
        WHERE assigned_contractor_person_id IS NOT NULL
      `);
      
      console.log('[Migration] assigned_contractor_person_id column added');
    } else {
      console.log('[Migration] assigned_contractor_person_id column already exists');
    }

    // ============ B) Create cc_work_disclosure_audit table ============
    
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'cc_work_disclosure_audit'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('[Migration] Creating cc_work_disclosure_audit table...');
      
      await client.query(`
        CREATE TABLE cc_work_disclosure_audit (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          work_request_id uuid NOT NULL REFERENCES cc_maintenance_requests(id) ON DELETE CASCADE,
          actor_user_id uuid NOT NULL,
          contractor_person_id uuid REFERENCES cc_people(id) ON DELETE SET NULL,
          action varchar(50) NOT NULL,
          payload jsonb NOT NULL DEFAULT '{}',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      
      // Indexes for efficient queries
      await client.query(`
        CREATE INDEX idx_cc_work_disclosure_audit_work_request
        ON cc_work_disclosure_audit (tenant_id, work_request_id, created_at DESC)
      `);
      
      await client.query(`
        CREATE INDEX idx_cc_work_disclosure_audit_contractor
        ON cc_work_disclosure_audit (tenant_id, contractor_person_id, created_at DESC)
        WHERE contractor_person_id IS NOT NULL
      `);
      
      console.log('[Migration] cc_work_disclosure_audit table created');
    } else {
      console.log('[Migration] cc_work_disclosure_audit table already exists');
    }

    // ============ C) Enable RLS on audit table ============
    
    console.log('[Migration] Setting up RLS on cc_work_disclosure_audit...');
    
    // Enable RLS
    await client.query(`
      ALTER TABLE cc_work_disclosure_audit ENABLE ROW LEVEL SECURITY
    `);
    
    // Force RLS for table owner
    await client.query(`
      ALTER TABLE cc_work_disclosure_audit FORCE ROW LEVEL SECURITY
    `);
    
    // Drop existing policy if exists (for idempotency)
    await client.query(`
      DROP POLICY IF EXISTS cc_work_disclosure_audit_tenant_isolation ON cc_work_disclosure_audit
    `);
    
    // Create tenant isolation policy with is_service_mode() bypass
    await client.query(`
      CREATE POLICY cc_work_disclosure_audit_tenant_isolation
      ON cc_work_disclosure_audit
      FOR ALL
      USING (
        is_service_mode() 
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
      )
      WITH CHECK (
        is_service_mode()
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
      )
    `);
    
    console.log('[Migration] RLS enabled with tenant isolation policy');

    await client.query('COMMIT');
    console.log('[Migration] Contractor assignment and disclosure audit migration complete');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

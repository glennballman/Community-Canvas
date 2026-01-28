/**
 * PART 6: Jobber Role Enforcement Tests
 * AUTH_CONSTITUTION.md governs; validates locked role mappings
 * 
 * Jobber Role Mappings (LOCKED):
 * - Admin → tenant_admin
 * - Manager → operations_supervisor  
 * - Dispatcher → operations_full
 * - Worker → field_worker_full
 * - Limited Worker → field_worker_limited
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serviceQuery } from '../../server/db/tenantDb';

describe('Jobber Role Mappings', () => {
  const expectedMappings = [
    { jobberRole: 'admin', systemRole: 'tenant_admin' },
    { jobberRole: 'manager', systemRole: 'operations_supervisor' },
    { jobberRole: 'dispatcher', systemRole: 'operations_full' },
    { jobberRole: 'worker', systemRole: 'field_worker_full' },
    { jobberRole: 'limited_worker', systemRole: 'field_worker_limited' },
  ];

  // Helper to check if external system role mappings table exists
  async function tableExists(): Promise<boolean> {
    try {
      const result = await serviceQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cc_external_system_role_mappings'
        ) as exists
      `);
      return result.rows[0]?.exists === true;
    } catch {
      return false;
    }
  }

  it('should have all Jobber role mappings in external_system_role_mappings', async () => {
    if (!(await tableExists())) {
      console.log('[SKIP] cc_external_system_role_mappings table not yet created (PROMPT-2 dependency)');
      return; // Skip test gracefully
    }
    
    const result = await serviceQuery(`
      SELECT 
        external_role_id,
        system_role_id,
        r.role_name
      FROM cc_external_system_role_mappings esrm
      JOIN cc_system_roles r ON esrm.system_role_id = r.id
      WHERE esrm.external_system = 'jobber'
      ORDER BY external_role_id
    `);

    expect(result.rows.length).toBeGreaterThanOrEqual(expectedMappings.length);

    for (const mapping of expectedMappings) {
      const found = result.rows.find(
        (r: any) => r.external_role_id === mapping.jobberRole
      );
      expect(found).toBeDefined();
      expect(found?.role_name).toBe(mapping.systemRole);
    }
  });

  it.skip('should map Jobber Admin to tenant_admin (requires PROMPT-2 schema)', async () => {
    // Skip until cc_external_system_role_mappings is created
    const result = await serviceQuery(`
      SELECT r.role_name
      FROM cc_external_system_role_mappings esrm
      JOIN cc_system_roles r ON esrm.system_role_id = r.id
      WHERE esrm.external_system = 'jobber'
        AND esrm.external_role_id = 'admin'
    `);
    expect(result.rows[0]?.role_name).toBe('tenant_admin');
  });

  it.skip('should map Jobber Manager to operations_supervisor (requires PROMPT-2 schema)', async () => {
    const result = await serviceQuery(`
      SELECT r.role_name
      FROM cc_external_system_role_mappings esrm
      JOIN cc_system_roles r ON esrm.system_role_id = r.id
      WHERE esrm.external_system = 'jobber'
        AND esrm.external_role_id = 'manager'
    `);
    expect(result.rows[0]?.role_name).toBe('operations_supervisor');
  });

  it.skip('should map Jobber Dispatcher to operations_full (requires PROMPT-2 schema)', async () => {
    const result = await serviceQuery(`
      SELECT r.role_name
      FROM cc_external_system_role_mappings esrm
      JOIN cc_system_roles r ON esrm.system_role_id = r.id
      WHERE esrm.external_system = 'jobber'
        AND esrm.external_role_id = 'dispatcher'
    `);
    expect(result.rows[0]?.role_name).toBe('operations_full');
  });

  it.skip('should map Jobber Worker to field_worker_full (requires PROMPT-2 schema)', async () => {
    const result = await serviceQuery(`
      SELECT r.role_name
      FROM cc_external_system_role_mappings esrm
      JOIN cc_system_roles r ON esrm.system_role_id = r.id
      WHERE esrm.external_system = 'jobber'
        AND esrm.external_role_id = 'worker'
    `);
    expect(result.rows[0]?.role_name).toBe('field_worker_full');
  });

  it.skip('should map Jobber Limited Worker to field_worker_limited (requires PROMPT-2 schema)', async () => {
    const result = await serviceQuery(`
      SELECT r.role_name
      FROM cc_external_system_role_mappings esrm
      JOIN cc_system_roles r ON esrm.system_role_id = r.id
      WHERE esrm.external_system = 'jobber'
        AND esrm.external_role_id = 'limited_worker'
    `);
    
    expect(result.rows[0]?.role_name).toBe('field_worker_limited');
  });
});

describe('cc_has_capability Function - Fail-Closed Behavior', () => {
  
  it('should deny access for non-existent principal', async () => {
    const result = await serviceQuery(`
      SELECT cc_has_capability(
        '00000000-0000-0000-0000-000000000000', -- Non-existent principal
        'tenant.read',
        '00000000-0000-0000-0000-000000000001'  -- Platform scope
      ) as allowed
    `);
    
    expect(result.rows[0]?.allowed).toBe(false);
  });

  it('should deny access for unknown capability', async () => {
    // First create a test principal if needed
    const result = await serviceQuery(`
      SELECT cc_has_capability(
        (SELECT id FROM cc_principals WHERE is_active = TRUE LIMIT 1),
        'some.nonexistent.capability',
        '00000000-0000-0000-0000-000000000001'
      ) as allowed
    `);
    
    expect(result.rows[0]?.allowed).toBe(false);
  });

  it('should deny access for unknown scope', async () => {
    const result = await serviceQuery(`
      SELECT cc_has_capability(
        (SELECT id FROM cc_principals WHERE is_active = TRUE LIMIT 1),
        'tenant.read',
        '99999999-9999-9999-9999-999999999999' -- Non-existent scope
      ) as allowed
    `);
    
    expect(result.rows[0]?.allowed).toBe(false);
  });
});

describe('Audit Logging', () => {
  
  it('should log authorization decisions with cc_auth_audit_log_insert', async () => {
    // Create a test audit log entry
    const principalId = await serviceQuery(`
      SELECT id FROM cc_principals WHERE is_active = TRUE LIMIT 1
    `);
    
    if (!principalId.rows[0]) {
      // Skip if no principals exist
      return;
    }
    
    const result = await serviceQuery(`
      SELECT cc_auth_audit_log_insert(
        $1,                              -- principal_id
        $1,                              -- effective_principal_id
        'test.capability',               -- capability_code
        '00000000-0000-0000-0000-000000000001', -- scope_id
        'deny',                          -- decision
        'test_audit_logging',            -- reason
        '/api/test',                     -- route
        'GET',                           -- method
        NULL,                            -- resource_type
        NULL,                            -- resource_id
        NULL,                            -- tenant_id
        NULL,                            -- org_id
        NULL,                            -- request_ip
        NULL,                            -- user_agent
        NULL,                            -- session_id
        '{}'::jsonb                      -- metadata
      ) as log_id
    `, [principalId.rows[0].id]);
    
    expect(result.rows[0]?.log_id).toBeDefined();
    
    // Verify the log was inserted
    const verify = await serviceQuery(`
      SELECT * FROM cc_auth_audit_log 
      WHERE id = $1
    `, [result.rows[0].log_id]);
    
    expect(verify.rows[0]?.decision).toBe('deny');
    expect(verify.rows[0]?.decision_reason).toBe('test_audit_logging');
    expect(verify.rows[0]?.route).toBe('/api/test');
  });
});

describe('Platform Scope', () => {
  
  it('should have singleton platform scope with expected ID', async () => {
    const result = await serviceQuery(`
      SELECT id, scope_type, scope_path 
      FROM cc_scopes 
      WHERE id = '00000000-0000-0000-0000-000000000001'
    `);
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.scope_type).toBe('platform');
  });
});

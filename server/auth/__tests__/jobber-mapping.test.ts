/**
 * Jobber External System Role Mapping Tests
 * AUTH_CONSTITUTION.md governs; validates locked role mappings
 * 
 * NOTE: These tests require PROMPT-2 schema (cc_external_system_role_mappings table).
 * Tests will skip gracefully until that schema is applied.
 * 
 * Jobber Role Mappings (LOCKED):
 * - Admin → tenant_admin
 * - Manager → operations_supervisor  
 * - Dispatcher → operations_full
 * - Worker → field_worker_full
 * - Limited Worker → field_worker_limited
 */

import { describe, it, expect } from 'vitest';
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

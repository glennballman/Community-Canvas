/**
 * PROMPT-15: External System Role Mapping Tests
 * AUTH_CONSTITUTION.md governs; validates locked role mappings
 * 
 * External role mappings are stored in cc_roles table:
 * - external_system column identifies the source system
 * - external_role_code column maps to the external role identifier
 * 
 * Jobber Role Mappings (LOCKED):
 * - admin → tenant_admin
 * - manager → operations_supervisor  
 * - dispatcher → operations_full
 * - worker → field_worker_full
 * - limited_worker → field_worker_limited
 */

import { describe, it, expect } from 'vitest';
import { serviceQuery } from '../../server/db/tenantDb';

describe('PROMPT-15: External Role Mappings', () => {
  
  describe('Jobber Role Mappings', () => {
    const expectedJobberMappings = [
      { externalRole: 'admin', systemRole: 'tenant_admin' },
      { externalRole: 'manager', systemRole: 'operations_supervisor' },
      { externalRole: 'dispatcher', systemRole: 'operations_full' },
      { externalRole: 'worker', systemRole: 'field_worker_full' },
      { externalRole: 'limited_worker', systemRole: 'field_worker_limited' },
    ];

    it('should have all Jobber role mappings in cc_roles', async () => {
      const result = await serviceQuery(`
        SELECT 
          code,
          external_system,
          external_role_code
        FROM cc_roles
        WHERE external_system = 'jobber'
        ORDER BY external_role_code
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(expectedJobberMappings.length);

      for (const mapping of expectedJobberMappings) {
        const found = result.rows.find(
          (r: any) => r.external_role_code === mapping.externalRole
        );
        expect(found).toBeDefined();
        expect(found?.code).toBe(mapping.systemRole);
      }
    });

    it('should map Jobber Admin to tenant_admin', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'jobber'
          AND external_role_code = 'admin'
      `);
      expect(result.rows[0]?.code).toBe('tenant_admin');
    });

    it('should map Jobber Manager to operations_supervisor', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'jobber'
          AND external_role_code = 'manager'
      `);
      expect(result.rows[0]?.code).toBe('operations_supervisor');
    });

    it('should map Jobber Dispatcher to operations_full', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'jobber'
          AND external_role_code = 'dispatcher'
      `);
      expect(result.rows[0]?.code).toBe('operations_full');
    });

    it('should map Jobber Worker to field_worker_full', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'jobber'
          AND external_role_code = 'worker'
      `);
      expect(result.rows[0]?.code).toBe('field_worker_full');
    });

    it('should map Jobber Limited Worker to field_worker_limited', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'jobber'
          AND external_role_code = 'limited_worker'
      `);
      expect(result.rows[0]?.code).toBe('field_worker_limited');
    });
  });

  describe('Cloudbeds Role Mappings', () => {
    it('should map Cloudbeds front_desk to reservation_manager', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'cloudbeds'
          AND external_role_code = 'front_desk'
      `);
      expect(result.rows[0]?.code).toBe('reservation_manager');
    });
  });

  describe('Robotics Role Mappings', () => {
    it('should have machine_operator role for robotics', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'robotics'
          AND code = 'machine_operator'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have machine_supervisor role for robotics', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'robotics'
          AND code = 'machine_supervisor'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('No Silent Defaults', () => {
    it('should not have default fallback mappings for unknown external roles', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'unknown_system'
          AND external_role_code = 'unknown_role'
      `);
      expect(result.rows.length).toBe(0);
    });

    it('external mappings should not include any default role assignment', async () => {
      const result = await serviceQuery(`
        SELECT code, external_system, external_role_code
        FROM cc_roles
        WHERE external_system IS NOT NULL
          AND code = 'tenant_admin'
          AND external_role_code IS NULL
      `);
      expect(result.rows.length).toBe(0);
    });
  });
});

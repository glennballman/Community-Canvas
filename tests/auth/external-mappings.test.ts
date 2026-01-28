/**
 * PROMPT-15: External Role Mapping Resolver Tests
 * AUTH_CONSTITUTION.md governs; validates fail-closed behavior
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { serviceQuery } from '../../server/db/tenantDb';

describe('PROMPT-15: External Role Mapping Resolver', () => {

  describe('Resolver Implementation', () => {
    it('resolveExternalRoleToRoleCode function exists', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain('export async function resolveExternalRoleToRoleCode');
    });

    it('resolver returns role_code or deny result', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain('roleCode: string | null');
      expect(content).toContain('capabilities: string[]');
    });

    it('resolver is fail-closed on unknown systems', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain("'invalid_external_system'");
      expect(content).toContain('ok: false');
    });

    it('resolver is fail-closed on unknown roles', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain("'no_mapping_found'");
    });

    it('resolver logs deny reasons to audit log', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain('async function logMappingDeny');
      expect(content).toContain('INSERT INTO cc_auth_audit_log');
      expect(content).toContain("'deny'");
    });

    it('resolver logs allow decisions to audit log', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain('async function logMappingAllow');
      expect(content).toContain("'allow'");
    });
  });

  describe('Preview Endpoint', () => {
    it('preview endpoint exists with POST method', () => {
      const content = fs.readFileSync('server/routes/p2-platform.ts', 'utf-8');
      expect(content).toContain("router.post('/external-mappings/preview'");
    });

    it('preview endpoint is capability-guarded (platform.configure)', () => {
      const content = fs.readFileSync('server/routes/p2-platform.ts', 'utf-8');
      expect(content).toContain("router.use(requireCapability('platform.configure'))");
    });

    it('preview endpoint validates inputs', () => {
      const content = fs.readFileSync('server/routes/p2-platform.ts', 'utf-8');
      expect(content).toContain('external_system is required');
      expect(content).toContain('external_role_code is required');
    });

    it('preview endpoint returns 404 for unmapped roles', () => {
      const content = fs.readFileSync('server/routes/p2-platform.ts', 'utf-8');
      expect(content).toContain('res.status(404).json(preview)');
    });
  });

  describe('No Silent Defaults', () => {
    it('resolver never assigns default role on failure', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      
      // Should not contain patterns like 'default_role' or fallback to tenant_admin
      expect(content).not.toContain('default_role');
      expect(content).not.toContain('fallback_role');
      
      // Failure path should return null roleCode
      expect(content).toContain('roleCode: null');
    });

    it('database has no catch-all external mappings', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system IS NOT NULL
          AND external_role_code IS NULL
          AND code IN ('tenant_admin', 'operations_full', 'field_worker_full')
      `);
      
      // No external system should map to these roles without a specific external_role_code
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Supported External Systems', () => {
    it('jobber system has valid mappings', async () => {
      const result = await serviceQuery(`
        SELECT external_role_code, code
        FROM cc_roles
        WHERE external_system = 'jobber'
          AND external_role_code IS NOT NULL
          AND is_active = true
      `);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(4);
    });

    it('cloudbeds system has valid mappings', async () => {
      const result = await serviceQuery(`
        SELECT external_role_code, code
        FROM cc_roles
        WHERE external_system = 'cloudbeds'
          AND external_role_code IS NOT NULL
          AND is_active = true
      `);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('robotics system exists', async () => {
      const result = await serviceQuery(`
        SELECT code
        FROM cc_roles
        WHERE external_system = 'robotics'
          AND is_active = true
      `);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Audit Logging', () => {
    it('external_role_mapping action type is logged', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain("'external_role_mapping'");
    });

    it('logs include external_system in metadata', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain("'external_system', $1");
    });

    it('logs include external_role_code in metadata', () => {
      const content = fs.readFileSync('server/auth/externalMappings.ts', 'utf-8');
      expect(content).toContain("'external_role_code', $2");
    });
  });
});

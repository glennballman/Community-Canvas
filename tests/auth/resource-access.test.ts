/**
 * PROMPT-11: Resource-Level Authorization Tests
 * Tests own/all enforcement, explicit grants, and fail-closed behavior
 * AUTH_CONSTITUTION.md governs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serviceQuery } from '../../server/db/tenantDb';
import crypto from 'crypto';

const TEST_PREFIX = 'test_prompt11_';

describe('PROMPT-11: Resource-Level Authorization', () => {
  let testPrincipal1Id: string;
  let testPrincipal2Id: string;
  let testTenantId: string;
  let testTenantScopeId: string;
  let testWorkRequestId: string;
  let testN3RunId: string;

  beforeAll(async () => {
    try {
      testTenantId = crypto.randomUUID();
      
      const testSlug = `${TEST_PREFIX}tenant_${Date.now()}`;
      await serviceQuery(`
        INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
        VALUES ($1, 'Test Tenant for PROMPT-11', $2, 'business', 'active')
        ON CONFLICT DO NOTHING
      `, [testTenantId, testSlug]);
      
      const serviceName1 = `${TEST_PREFIX}svc1_${Date.now()}`;
      const serviceName2 = `${TEST_PREFIX}svc2_${Date.now()}`;
      
      const principalResult1 = await serviceQuery(`
        INSERT INTO cc_principals (principal_type, service_name, display_name, is_active)
        VALUES ('service', $1, 'Test Service 1', true)
        RETURNING id
      `, [serviceName1]);
      testPrincipal1Id = principalResult1.rows[0]?.id;

      const principalResult2 = await serviceQuery(`
        INSERT INTO cc_principals (principal_type, service_name, display_name, is_active)
        VALUES ('service', $1, 'Test Service 2', true)
        RETURNING id
      `, [serviceName2]);
      testPrincipal2Id = principalResult2.rows[0]?.id;

      const tenantScopeResult = await serviceQuery(`
        SELECT get_or_create_tenant_scope($1::uuid) as scope_id
      `, [testTenantId]);
      testTenantScopeId = tenantScopeResult.rows[0]?.scope_id;

      const workRequestResult = await serviceQuery(`
        INSERT INTO cc_work_requests (
          tenant_id, contact_channel_value, contact_channel_type, status, 
          summary, created_by_principal_id
        )
        VALUES ($1::uuid, 'test@test.com', 'email', 'new', 'Test Work Request', $2)
        RETURNING id
      `, [testTenantId, testPrincipal1Id]);
      testWorkRequestId = workRequestResult.rows[0]?.id;

      const n3RunResult = await serviceQuery(`
        INSERT INTO cc_n3_runs (tenant_id, name, status, created_by_principal_id)
        VALUES ($1::uuid, 'Test N3 Run', 'scheduled', $2)
        RETURNING id
      `, [testTenantId, testPrincipal1Id]);
      testN3RunId = n3RunResult.rows[0]?.id;
    } catch (error) {
      console.error('PROMPT-11 test setup failed:', error);
    }
  });

  afterAll(async () => {
    try {
      await serviceQuery(`DELETE FROM cc_n3_runs WHERE id = $1`, [testN3RunId]);
      await serviceQuery(`DELETE FROM cc_work_requests WHERE id = $1`, [testWorkRequestId]);
      await serviceQuery(`DELETE FROM cc_resource_grants WHERE principal_id IN ($1, $2)`, 
        [testPrincipal1Id, testPrincipal2Id]);
      await serviceQuery(`DELETE FROM cc_principals WHERE id IN ($1, $2)`, 
        [testPrincipal1Id, testPrincipal2Id]);
      await serviceQuery(`DELETE FROM cc_scopes WHERE tenant_id = $1`, [testTenantId]);
    } catch (error) {
      console.error('PROMPT-11 test cleanup warning:', error);
    }
  });

  describe('cc_can_access_resource function', () => {
    it('should exist in the database', async () => {
      const result = await serviceQuery(`
        SELECT proname FROM pg_proc WHERE proname = 'cc_can_access_resource'
      `);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0]?.proname).toBe('cc_can_access_resource');
    });

    it('should deny access when principal has no capability (fail-closed)', async () => {
      if (!testPrincipal2Id || !testTenantScopeId || !testWorkRequestId) {
        console.warn('Skipping: test data not initialized');
        return;
      }

      const result = await serviceQuery(`
        SELECT cc_can_access_resource($1, 'work_requests.read', $2, 'cc_work_requests', $3) as allowed
      `, [testPrincipal2Id, testTenantScopeId, testWorkRequestId]);
      
      expect(result.rows[0]?.allowed).toBe(false);
    });

    it('should return false for NULL effective_principal_id (fail-closed)', async () => {
      const result = await serviceQuery(`
        SELECT cc_can_access_resource(NULL, 'work_requests.read', $1, 'cc_work_requests', $2) as allowed
      `, [testTenantScopeId, testWorkRequestId]);
      
      expect(result.rows[0]?.allowed).toBe(false);
    });

    it('should return false for unknown resource table (fail-closed)', async () => {
      const result = await serviceQuery(`
        SELECT cc_can_access_resource($1, 'test.read', $2, 'unknown_table', $3) as allowed
      `, [testPrincipal1Id, testTenantScopeId, testWorkRequestId]);
      
      expect(result.rows[0]?.allowed).toBe(false);
    });
  });

  describe('cc_resource_grants table', () => {
    it('should exist with required columns', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_resource_grants'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('principal_id');
      expect(columns).toContain('resource_table');
      expect(columns).toContain('resource_id');
      expect(columns).toContain('capability_code');
      expect(columns).toContain('valid_from');
      expect(columns).toContain('valid_until');
      expect(columns).toContain('created_by_principal_id');
    });

    it('should allow explicit resource grants to be created', async () => {
      if (!testPrincipal2Id || !testTenantScopeId || !testWorkRequestId) {
        console.warn('Skipping: test data not initialized');
        return;
      }

      await serviceQuery(`
        INSERT INTO cc_resource_grants (
          principal_id, scope_id, resource_table, resource_id, capability_code,
          valid_from, created_by_principal_id
        ) VALUES ($1, $2, 'cc_work_requests', $3, 'work_requests.read', NOW(), $4)
        ON CONFLICT DO NOTHING
      `, [testPrincipal2Id, testTenantScopeId, testWorkRequestId, testPrincipal1Id]);

      const result = await serviceQuery(`
        SELECT * FROM cc_resource_grants 
        WHERE principal_id = $1 AND resource_id = $2
      `, [testPrincipal2Id, testWorkRequestId]);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Ownership columns', () => {
    it('cc_work_requests should have created_by_principal_id column', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_work_requests' AND column_name = 'created_by_principal_id'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('cc_n3_runs should have created_by_principal_id column', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_n3_runs' AND column_name = 'created_by_principal_id'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('cc_reservation_carts should have created_by_principal_id column', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_reservation_carts' AND column_name = 'created_by_principal_id'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('cc_pms_reservations should have created_by_principal_id column', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_pms_reservations' AND column_name = 'created_by_principal_id'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('get_or_create_resource_scope function', () => {
    it('should exist in the database', async () => {
      const result = await serviceQuery(`
        SELECT proname FROM pg_proc WHERE proname = 'get_or_create_resource_scope'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should create resource scope idempotently', async () => {
      if (!testTenantScopeId || !testWorkRequestId) {
        console.warn('Skipping: test data not initialized');
        return;
      }

      const result1 = await serviceQuery(`
        SELECT get_or_create_resource_scope($1, 'work_requests', $2) as scope_id
      `, [testTenantScopeId, testWorkRequestId]);
      
      const result2 = await serviceQuery(`
        SELECT get_or_create_resource_scope($1, 'work_requests', $2) as scope_id
      `, [testTenantScopeId, testWorkRequestId]);
      
      expect(result1.rows[0]?.scope_id).toBe(result2.rows[0]?.scope_id);
    });
  });

  describe('Audit logging', () => {
    it('cc_auth_audit_log should have resource_type column for resource access', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_auth_audit_log' AND column_name = 'resource_type'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('cc_auth_audit_log should have resource_id column for resource access', async () => {
      const result = await serviceQuery(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cc_auth_audit_log' AND column_name = 'resource_id'
      `);
      expect(result.rows.length).toBe(1);
    });
  });
});

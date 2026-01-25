/**
 * Platform Admin Invariant Tests
 * 
 * INVARIANT P0: Platform admins (cc_users.is_platform_admin = true) cannot
 * have any rows in cc_tenant_users.
 * 
 * These tests verify the database triggers enforce this invariant.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../server/db';

describe('Platform Admin Invariant P0', () => {
  // Use valid UUIDs for test users
  const testPlatformAdminId = 'deadbeef-0000-0000-0000-000000000001';
  const testRegularUserId = 'deadbeef-0000-0000-0000-000000000002';
  const testTenantId = 'c0000000-0000-0000-0000-000000000001'; // Glenn Ballman tenant

  beforeAll(async () => {
    // Create test platform admin user
    await pool.query(`
      INSERT INTO cc_users (id, email, password_hash, is_platform_admin, status)
      VALUES ($1, $2, 'test_hash', true, 'active')
      ON CONFLICT (id) DO NOTHING
    `, [testPlatformAdminId, `test-platform-admin-${Date.now()}@test.com`]);

    // Create test regular user
    await pool.query(`
      INSERT INTO cc_users (id, email, password_hash, is_platform_admin, status)
      VALUES ($1, $2, 'test_hash', false, 'active')
      ON CONFLICT (id) DO NOTHING
    `, [testRegularUserId, `test-regular-user-${Date.now()}@test.com`]);
  });

  afterAll(async () => {
    // Cleanup test users
    await pool.query('DELETE FROM cc_tenant_users WHERE user_id = $1', [testRegularUserId]);
    await pool.query('DELETE FROM cc_users WHERE id IN ($1, $2)', [testPlatformAdminId, testRegularUserId]);
  });

  it('should reject INSERT into cc_tenant_users for platform admin', async () => {
    try {
      await pool.query(`
        INSERT INTO cc_tenant_users (user_id, tenant_id, role)
        VALUES ($1, $2, 'member')
      `, [testPlatformAdminId, testTenantId]);
      
      // Should not reach here
      expect.fail('Expected insert to fail for platform admin');
    } catch (error: any) {
      expect(error.message).toContain('PLATFORM_ADMIN_CANNOT_HAVE_TENANT_MEMBERSHIP');
    }
  });

  it('should allow INSERT into cc_tenant_users for regular user', async () => {
    // This should succeed
    const result = await pool.query(`
      INSERT INTO cc_tenant_users (user_id, tenant_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'member'
      RETURNING user_id
    `, [testRegularUserId, testTenantId]);

    expect(result.rowCount).toBe(1);
  });

  it('should delete tenant membership when user becomes platform admin', async () => {
    // Verify regular user has membership
    const beforeResult = await pool.query(`
      SELECT COUNT(*) as count FROM cc_tenant_users WHERE user_id = $1
    `, [testRegularUserId]);
    expect(parseInt(beforeResult.rows[0].count)).toBeGreaterThan(0);

    // Flip user to platform admin
    await pool.query(`
      UPDATE cc_users SET is_platform_admin = true WHERE id = $1
    `, [testRegularUserId]);

    // Verify membership was deleted
    const afterResult = await pool.query(`
      SELECT COUNT(*) as count FROM cc_tenant_users WHERE user_id = $1
    `, [testRegularUserId]);
    expect(parseInt(afterResult.rows[0].count)).toBe(0);

    // Flip back for cleanup
    await pool.query(`
      UPDATE cc_users SET is_platform_admin = false WHERE id = $1
    `, [testRegularUserId]);
  });

  it('should have zero platform admins in cc_tenant_users (invariant check)', async () => {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM cc_tenant_users tu
      JOIN cc_users u ON tu.user_id = u.id
      WHERE COALESCE(u.is_platform_admin, false) = true
    `);

    expect(parseInt(result.rows[0].count)).toBe(0);
  });
});

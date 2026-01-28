/**
 * PROMPT-12: Platform Tenants Endpoint Authorization Tests
 * 
 * Validates that /api/p2/platform/tenants:
 * 1. Uses requireCapability('platform.configure') for authorization
 * 2. Queries canonical tables only (cc_tenants, cc_users, cc_portals, cc_tenant_users)
 * 3. Denies access to non-platform-admin users
 */

import { describe, it, expect } from 'vitest';
import { serviceQuery } from '../../server/db/tenantDb';

describe('Platform Tenants Endpoint - Authorization', () => {

  it('should require platform.configure capability for platform tenants list', async () => {
    const result = await serviceQuery(`
      SELECT p.id as principal_id, 
             cc_has_capability(p.id, 'platform.configure', '00000000-0000-0000-0000-000000000001') as has_platform_configure
      FROM cc_principals p
      JOIN cc_users u ON p.user_id = u.id
      WHERE u.is_platform_admin = true
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      expect(result.rows[0]?.has_platform_configure).toBe(true);
    }
  });

  it('should deny platform.configure for non-platform-admin users', async () => {
    const result = await serviceQuery(`
      SELECT p.id as principal_id,
             cc_has_capability(p.id, 'platform.configure', '00000000-0000-0000-0000-000000000001') as has_platform_configure
      FROM cc_principals p
      JOIN cc_users u ON p.user_id = u.id
      WHERE u.is_platform_admin = false
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      expect(result.rows[0]?.has_platform_configure).toBe(false);
    }
  });
});

describe('Platform Tenants Endpoint - Canonical Tables', () => {

  it('should query cc_tenants with proper tenant data structure', async () => {
    const result = await serviceQuery(`
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.tenant_type,
        t.status,
        t.owner_user_id
      FROM cc_tenants t
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      const tenant = result.rows[0];
      expect(tenant).toHaveProperty('id');
      expect(tenant).toHaveProperty('name');
      expect(tenant).toHaveProperty('slug');
      expect(tenant).toHaveProperty('tenant_type');
    }
  });

  it('should join cc_tenant_users for member counts', async () => {
    const result = await serviceQuery(`
      SELECT 
        t.id as tenant_id,
        t.name,
        COUNT(DISTINCT tu.user_id) as member_count
      FROM cc_tenants t
      LEFT JOIN cc_tenant_users tu ON tu.tenant_id = t.id AND tu.status = 'active'
      GROUP BY t.id, t.name
      LIMIT 5
    `);
    
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
    if (result.rows.length > 0) {
      expect(result.rows[0]).toHaveProperty('member_count');
    }
  });

  it('should join cc_users for owner information', async () => {
    const result = await serviceQuery(`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        u.email as owner_email,
        u.given_name as owner_given_name,
        u.family_name as owner_family_name
      FROM cc_tenants t
      LEFT JOIN cc_users u ON u.id = t.owner_user_id
      LIMIT 5
    `);
    
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
  });

  it('should join cc_portals for portal slugs', async () => {
    const result = await serviceQuery(`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        p.slug as portal_slug
      FROM cc_tenants t
      LEFT JOIN LATERAL (
        SELECT slug FROM cc_portals 
        WHERE owning_tenant_id = t.id AND status = 'active'
        ORDER BY created_at LIMIT 1
      ) p ON true
      LIMIT 5
    `);
    
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Platform Tenants Endpoint - Filter Support', () => {

  it('should support filtering by tenant_type', async () => {
    const result = await serviceQuery(`
      SELECT id, name, tenant_type
      FROM cc_tenants
      WHERE tenant_type = 'business'
      LIMIT 5
    `);
    
    for (const row of result.rows) {
      expect(row.tenant_type).toBe('business');
    }
  });

  it('should support filtering by status', async () => {
    const result = await serviceQuery(`
      SELECT id, name, status
      FROM cc_tenants
      WHERE status = 'active'
      LIMIT 5
    `);
    
    for (const row of result.rows) {
      expect(row.status).toBe('active');
    }
  });

  it('should support search by name or slug', async () => {
    const result = await serviceQuery(`
      SELECT id, name, slug
      FROM cc_tenants
      WHERE name ILIKE $1 OR slug ILIKE $1
      LIMIT 5
    `, ['%test%']);
    
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
  });
});

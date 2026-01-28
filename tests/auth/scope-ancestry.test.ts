/**
 * PROMPT-9A: Scope Ancestry Function Tests
 * Tests the scope_is_ancestor_of(UUID, UUID) database function
 * 
 * Creates a controlled scope hierarchy: platform → tenant → resource_type
 * All tests use this hierarchy - no skip paths allowed per TASK D requirements.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

describe('scope_is_ancestor_of', () => {
  let pool: Pool;
  let platformScopeId: string;
  
  // Fixed test UUIDs for deterministic cleanup
  const testTenantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001';
  let testTenantScopeId: string; // Auto-created by trigger
  const testResourceTypeScopeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003';

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Get platform scope (must exist)
    const platformResult = await pool.query(`
      SELECT id FROM cc_scopes WHERE scope_type = 'platform'
    `);
    platformScopeId = platformResult.rows[0]?.id;

    if (!platformScopeId) {
      throw new Error('Platform scope not found - cannot run tests');
    }

    // Cleanup any stale test data from previous runs
    // First delete scopes (by tenant_id to catch all orphans), then tenants
    await pool.query(`DELETE FROM cc_scopes WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM cc_scopes WHERE tenant_id IN (SELECT id FROM cc_tenants WHERE slug = '__test_scope_ancestry__')`);
    await pool.query(`DELETE FROM cc_tenants WHERE id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM cc_tenants WHERE slug = '__test_scope_ancestry__'`);

    // Create test tenant (trigger auto-creates tenant scope)
    await pool.query(`
      INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
      VALUES ($1, '__test_scope_ancestry__', '__test_scope_ancestry__', 'business', 'active')
    `, [testTenantId]);

    // Get the auto-created tenant scope ID
    const tenantScopeResult = await pool.query(`
      SELECT id FROM cc_scopes 
      WHERE scope_type = 'tenant' AND tenant_id = $1
    `, [testTenantId]);
    testTenantScopeId = tenantScopeResult.rows[0]?.id;
    
    if (!testTenantScopeId) {
      throw new Error('Tenant scope not auto-created');
    }

    // Create resource_type scope (child of tenant, grandchild of platform)
    await pool.query(`
      INSERT INTO cc_scopes (id, scope_type, tenant_id, resource_type, parent_scope_id, scope_path)
      VALUES ($1, 'resource_type', $2, '__test_resource__', $3, 'platform/tenant:test/resource_type:test')
    `, [testResourceTypeScopeId, testTenantId, testTenantScopeId]);
  });

  afterAll(async () => {
    // Cleanup all scopes with this tenant first (handles any orphans), then tenant
    await pool.query(`DELETE FROM cc_scopes WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM cc_tenants WHERE id = $1`, [testTenantId]);
    await pool.end();
  });

  // === Identity Tests ===
  it('returns TRUE for same scope (A = A)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $1) as is_ancestor
    `, [platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(true);
  });

  // === Parent-Child Traversal Tests ===
  it('returns TRUE for parent -> child (platform -> tenant)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $2) as is_ancestor
    `, [platformScopeId, testTenantScopeId]);
    expect(result.rows[0].is_ancestor).toBe(true);
  });

  it('returns TRUE for parent -> child (tenant -> resource_type)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $2) as is_ancestor
    `, [testTenantScopeId, testResourceTypeScopeId]);
    expect(result.rows[0].is_ancestor).toBe(true);
  });

  // === Grandparent-Grandchild Traversal Test ===
  it('returns TRUE for grandparent -> grandchild (platform -> resource_type)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $2) as is_ancestor
    `, [platformScopeId, testResourceTypeScopeId]);
    expect(result.rows[0].is_ancestor).toBe(true);
  });

  // === Inverse Direction Tests (should be FALSE) ===
  it('returns FALSE for child -> parent (tenant -> platform)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $2) as is_ancestor
    `, [testTenantScopeId, platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });

  it('returns FALSE for grandchild -> grandparent (resource_type -> platform)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $2) as is_ancestor
    `, [testResourceTypeScopeId, platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });

  // === NULL Input Tests (Fail-Closed) ===
  it('returns FALSE for NULL ancestor', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of(NULL, $1) as is_ancestor
    `, [platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });

  it('returns FALSE for NULL descendant', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, NULL) as is_ancestor
    `, [platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });

  // === Non-Existent Scope Tests (Fail-Closed) ===
  it('returns FALSE for non-existent ancestor scope', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of('deadbeef-dead-beef-dead-beefdeadbeef', $1) as is_ancestor
    `, [platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });

  it('returns FALSE for non-existent descendant scope', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, 'deadbeef-dead-beef-dead-beefdeadbeef') as is_ancestor
    `, [platformScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });

  // === Sibling Scope Test ===
  it('returns FALSE for sibling scopes (resource_type is not ancestor of tenant)', async () => {
    const result = await pool.query(`
      SELECT scope_is_ancestor_of($1, $2) as is_ancestor
    `, [testResourceTypeScopeId, testTenantScopeId]);
    expect(result.rows[0].is_ancestor).toBe(false);
  });
});

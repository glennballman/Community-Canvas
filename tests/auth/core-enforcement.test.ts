/**
 * PROMPT-3: Core Authorization Enforcement Tests
 * AUTH_CONSTITUTION.md governs; validates fail-closed behavior, audit logging, and scope resolution
 * 
 * These tests validate constitutional requirements independent of external system mappings.
 */

import { describe, it, expect } from 'vitest';
import { serviceQuery } from '../../server/db/tenantDb';

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

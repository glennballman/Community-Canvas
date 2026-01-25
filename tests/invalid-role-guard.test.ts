import { describe, it, expect } from 'vitest';
import { requireRole, VALID_TENANT_ROLES } from '../server/middleware/guards';

describe('requireRole validation (fail-fast)', () => {
  it('should throw immediately when "admin" (invalid) is passed', () => {
    // This is the core regression test - 'admin' alone is NOT a valid role
    expect(() => requireRole('admin')).toThrowError(/INVALID_ROLE_GUARD/);
  });

  it('should throw for other invalid roles', () => {
    expect(() => requireRole('superuser')).toThrowError(/INVALID_ROLE_GUARD/);
    expect(() => requireRole('root')).toThrowError(/INVALID_ROLE_GUARD/);
    expect(() => requireRole('platform_admin')).toThrowError(/INVALID_ROLE_GUARD/);
  });

  it('should throw with helpful message mentioning requirePlatformAdmin', () => {
    expect(() => requireRole('admin')).toThrowError(/requirePlatformAdmin/);
  });

  it('should NOT throw for valid tenant roles', () => {
    expect(() => requireRole('tenant_owner')).not.toThrow();
    expect(() => requireRole('tenant_admin')).not.toThrow();
    expect(() => requireRole('operator')).not.toThrow();
    expect(() => requireRole('staff')).not.toThrow();
    expect(() => requireRole('member')).not.toThrow();
  });

  it('should NOT throw for "owner" (DB storage value for tenant_owner)', () => {
    expect(() => requireRole('owner')).not.toThrow();
  });

  it('should include invalid role in error message', () => {
    expect(() => requireRole('badRole')).toThrowError(/badRole/);
  });

  it('should validate VALID_TENANT_ROLES contains expected values', () => {
    expect(VALID_TENANT_ROLES.has('tenant_owner')).toBe(true);
    expect(VALID_TENANT_ROLES.has('tenant_admin')).toBe(true);
    expect(VALID_TENANT_ROLES.has('operator')).toBe(true);
    expect(VALID_TENANT_ROLES.has('staff')).toBe(true);
    expect(VALID_TENANT_ROLES.has('member')).toBe(true);
    expect(VALID_TENANT_ROLES.has('owner')).toBe(true);
    // 'admin' alone is NOT valid - must use 'tenant_admin'
    expect(VALID_TENANT_ROLES.has('admin')).toBe(false);
  });
});

/**
 * PROMPT-5: UI Authorization Helper
 * 
 * Provides visibility-only capability checks for UI gating.
 * This does NOT enforce authorization - backend always enforces via PROMPT-3/4.
 * 
 * ARCHITECTURAL CONSTRAINT:
 * Full capability evaluation is server-side only. This module provides
 * "best-effort approximation" for UI hints using available client context:
 * - isPlatformAdmin flag from /api/me/context
 * - Current tenant membership and role
 * 
 * This approximation is acceptable because:
 * 1. UI gating is VISIBILITY-ONLY, not authorization
 * 2. Backend always enforces via requireCapability() (PROMPT-3/4)
 * 3. Users may see UI they can't use, but never bypass backend
 * 
 * FUTURE: When /api/me/capabilities endpoint is available, replace
 * approximation logic with explicit capability list lookup.
 * 
 * AUTH_CONSTITUTION.md compliance:
 * - Uses auth context from /api/me/context (single identity authority)
 * - Returns false on any uncertainty (fail-closed)
 * - Never throws errors
 * - Never escalates privileges
 * - Impersonation: uses isPlatformAdmin which reflects effective principal
 */

import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export interface CanUIOptions {
  scope?: 'platform' | 'organization' | 'tenant' | 'resource';
  resourceId?: string;
  tenantId?: string;
}

/**
 * Platform capability codes that require platform admin
 */
const PLATFORM_CAPABILITIES = [
  'platform.configure',
  'platform.admin',
  'platform.read',
  'platform.manage_tenants',
  'platform.manage_users',
  'platform.impersonate',
  'platform.analytics',
];

/**
 * Tenant admin capability codes that require owner/admin role
 */
const TENANT_ADMIN_CAPABILITIES = [
  'tenant.configure',
  'tenant.manage',
  'tenant.admin',
  'zones.manage',
  'work_catalog.manage',
  'subsystems.manage',
  'portals.configure',
  'team.manage',
  'users.invite',
  'users.manage',
  'roles.manage',
  'settings.manage',
];

/**
 * Tenant read capabilities that any member can access
 */
const TENANT_READ_CAPABILITIES = [
  'tenant.read',
  'folios.read',
  'zones.read',
  'work_catalog.read',
  'subsystems.read',
  'reservations.read',
  'operations.read',
  'dashboard.read',
];

/**
 * Write/action capabilities that require specific roles
 */
const TENANT_WRITE_CAPABILITIES = [
  'quotes.create',
  'quotes.edit',
  'quotes.delete',
  'reservations.create',
  'reservations.edit',
  'reservations.cancel',
  'work_requests.create',
  'work_requests.edit',
  'runs.create',
  'runs.edit',
  'runs.approve',
  'jobs.create',
  'jobs.edit',
  'jobs.delete',
  'applications.review',
  'applications.approve',
];

/**
 * Hook-based capability check for React components
 * Returns a function that checks if the current principal has a capability
 * 
 * Usage:
 * const canUI = useCanUI();
 * if (canUI('platform.configure')) { ... }
 */
export function useCanUI() {
  const { user, isPlatformAdmin, impersonation } = useAuth();
  const tenantContext = useTenant();
  
  return function canUI(capabilityCode: string, options: CanUIOptions = {}): boolean {
    // Fail-closed: no user context means no access
    if (!user) {
      return false;
    }
    
    // When impersonating, use the impersonated principal's permissions
    // The isPlatformAdmin flag is already based on effective user from /api/me/context
    const effectiveIsPlatformAdmin = isPlatformAdmin;
    
    // Platform-scoped capabilities
    if (PLATFORM_CAPABILITIES.includes(capabilityCode) || 
        options.scope === 'platform' ||
        capabilityCode.startsWith('platform.')) {
      return effectiveIsPlatformAdmin;
    }
    
    // Get current tenant membership
    const currentTenant = tenantContext?.currentTenant;
    const currentRole = currentTenant?.role;
    
    // Tenant admin capabilities require owner/admin/manager role
    if (TENANT_ADMIN_CAPABILITIES.includes(capabilityCode) ||
        capabilityCode.endsWith('.manage') ||
        capabilityCode.endsWith('.configure') ||
        capabilityCode.endsWith('.admin')) {
      // Platform admins can access tenant admin features
      if (effectiveIsPlatformAdmin) {
        return true;
      }
      
      // Check for admin-level role
      if (!currentRole) {
        return false;
      }
      
      const adminRoles = ['owner', 'admin', 'manager'];
      return adminRoles.includes(currentRole);
    }
    
    // Tenant read capabilities require any membership
    if (TENANT_READ_CAPABILITIES.includes(capabilityCode) ||
        capabilityCode.endsWith('.read')) {
      // Platform admins can read tenant data
      if (effectiveIsPlatformAdmin) {
        return true;
      }
      
      // Any active membership grants read access
      return !!currentTenant;
    }
    
    // Write capabilities require member status and appropriate role
    if (TENANT_WRITE_CAPABILITIES.includes(capabilityCode) ||
        capabilityCode.endsWith('.create') ||
        capabilityCode.endsWith('.edit') ||
        capabilityCode.endsWith('.delete') ||
        capabilityCode.endsWith('.approve')) {
      // Platform admins can write
      if (effectiveIsPlatformAdmin) {
        return true;
      }
      
      // Must have current tenant and non-contractor role for most writes
      if (!currentTenant || !currentRole) {
        return false;
      }
      
      // Contractors have limited write access
      const contractorOnlyCapabilities = ['quotes.create', 'work_requests.create'];
      if (currentRole === 'contractor') {
        return contractorOnlyCapabilities.includes(capabilityCode);
      }
      
      // Other members can write
      return true;
    }
    
    // Unknown capability - fail closed (deny)
    // This matches AUTH_CONSTITUTION.md §8a behavior
    return false;
  };
}

/**
 * Non-hook version for use outside React components
 * Requires passing auth context directly
 * 
 * Usage in callbacks or event handlers where hooks can't be used
 */
export function canUIWithContext(
  capabilityCode: string,
  context: {
    user: { id: string; isPlatformAdmin: boolean } | null;
    currentTenantRole: string | null;
    hasTenant: boolean;
  },
  options: CanUIOptions = {}
): boolean {
  const { user, currentTenantRole, hasTenant } = context;
  
  // Fail-closed
  if (!user) {
    return false;
  }
  
  // Platform capabilities
  if (PLATFORM_CAPABILITIES.includes(capabilityCode) ||
      options.scope === 'platform' ||
      capabilityCode.startsWith('platform.')) {
    return user.isPlatformAdmin;
  }
  
  // Tenant admin capabilities
  if (TENANT_ADMIN_CAPABILITIES.includes(capabilityCode) ||
      capabilityCode.endsWith('.manage') ||
      capabilityCode.endsWith('.configure')) {
    if (user.isPlatformAdmin) return true;
    if (!currentTenantRole) return false;
    return ['owner', 'admin', 'manager'].includes(currentTenantRole);
  }
  
  // Tenant read capabilities
  if (TENANT_READ_CAPABILITIES.includes(capabilityCode) ||
      capabilityCode.endsWith('.read')) {
    if (user.isPlatformAdmin) return true;
    return hasTenant;
  }
  
  // Write capabilities
  if (capabilityCode.endsWith('.create') ||
      capabilityCode.endsWith('.edit') ||
      capabilityCode.endsWith('.delete')) {
    if (user.isPlatformAdmin) return true;
    return hasTenant && !!currentTenantRole && currentTenantRole !== 'contractor';
  }
  
  return false;
}

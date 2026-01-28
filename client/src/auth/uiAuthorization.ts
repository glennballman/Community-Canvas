/**
 * PROMPT-5 → PROMPT-6: UI Authorization Helper
 * 
 * Provides visibility-only capability checks for UI gating.
 * This does NOT enforce authorization - backend always enforces via PROMPT-3/4.
 * 
 * PROMPT-6 UPGRADE:
 * This module now uses the authoritative capability snapshot from /api/me/capabilities
 * as the SINGLE SOURCE OF TRUTH for UI visibility gating. The old approximation
 * logic is retained as a fallback during the transition period.
 * 
 * When capabilities snapshot is available:
 * - Uses explicit capability list lookup (authoritative)
 * - Respects scope hierarchy (platform → organization → tenant)
 * - Immediately reflects impersonation changes
 * 
 * When capabilities snapshot is NOT available (fallback):
 * - Uses best-effort approximation based on role/admin flags
 * - This should only occur during auth loading state
 * 
 * AUTH_CONSTITUTION.md compliance:
 * - Uses capabilities from /api/me/capabilities (single source of truth)
 * - Returns false on any uncertainty (fail-closed)
 * - Never throws errors
 * - Never escalates privileges
 * - Impersonation: uses effective_principal_id capabilities
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
 * PROMPT-9B: Must match actual seeded capability codes in cc_capabilities
 */
const PLATFORM_CAPABILITIES = [
  'platform.configure',
  'platform.users.manage',
  'impersonation.start',
  'impersonation.end',
  'analytics.view',
  'analytics.export',
  'audit.view',
  'audit.export',
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
 * PROMPT-6 UPGRADE: Now uses authoritative capability snapshot when available.
 * Falls back to approximation logic only during auth loading states.
 * 
 * Usage:
 * const canUI = useCanUI();
 * if (canUI('platform.configure')) { ... }
 */
export function useCanUI() {
  const { user, isPlatformAdmin, capabilities, hasCapability } = useAuth();
  const tenantContext = useTenant();
  
  return function canUI(capabilityCode: string, options: CanUIOptions = {}): boolean {
    // Fail-closed: no user context means no access
    if (!user) {
      return false;
    }
    
    // PROMPT-6: Use authoritative capability snapshot if available
    if (capabilities && capabilities.ok) {
      // Determine which scope to check
      if (options.scope === 'platform') {
        return hasCapability(capabilityCode, 'platform');
      }
      if (options.scope === 'organization') {
        return hasCapability(capabilityCode, 'organization');
      }
      if (options.scope === 'tenant') {
        return hasCapability(capabilityCode, 'tenant');
      }
      
      // No scope specified - check all scopes (respects inheritance)
      return hasCapability(capabilityCode);
    }
    
    // FALLBACK: Approximation logic for when capabilities not yet loaded
    // This should only occur during initial auth loading
    
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

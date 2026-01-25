/**
 * SESSION TYPES - Canonical types for auth and impersonation state
 * 
 * Phase 2C-15B: Single source of truth for impersonation state shape.
 * AuthContext is the canonical source. TenantContext must derive from it.
 */

/**
 * Canonical impersonation state shape.
 * Used by AuthContext and derived by TenantContext.
 */
export interface ImpersonationState {
  active: boolean;
  target_user: {
    id: string;
    email: string;
    display_name?: string;
  } | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  role: string | null;
  expires_at: string | null;
}

/**
 * Default impersonation state (not impersonating)
 */
export const defaultImpersonation: ImpersonationState = {
  active: false,
  target_user: null,
  tenant_id: null,
  tenant_name: null,
  tenant_slug: null,
  role: null,
  expires_at: null,
};

/**
 * User identity from auth context
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  isPlatformAdmin: boolean;
}

/**
 * Tenant membership
 */
export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string | null;
  tenant_type?: string;
  role: string;
  title?: string;
}

/**
 * Parse server impersonation response into canonical shape
 */
export function parseImpersonationResponse(data: any): ImpersonationState {
  if (!data || (!data.active && !data.is_impersonating)) {
    return defaultImpersonation;
  }
  
  // Handle whoami format (active, target_user, tenant)
  if ('active' in data) {
    return {
      active: data.active,
      target_user: data.target_user || null,
      tenant_id: data.tenant?.id || null,
      tenant_name: data.tenant?.name || null,
      tenant_slug: data.tenant?.slug || null,
      role: data.role || null,
      expires_at: data.expires_at || null,
    };
  }
  
  // Handle context format (is_impersonating, impersonated_tenant)
  if ('is_impersonating' in data) {
    return {
      active: data.is_impersonating,
      target_user: data.impersonated_user ? {
        id: data.impersonated_user.id,
        email: data.impersonated_user.email,
        display_name: data.impersonated_user.display_name,
      } : null,
      tenant_id: data.impersonated_tenant?.id || null,
      tenant_name: data.impersonated_tenant?.name || null,
      tenant_slug: data.impersonated_tenant?.slug || null,
      role: data.impersonated_tenant?.role || null,
      expires_at: data.impersonation_expires_at || null,
    };
  }
  
  return defaultImpersonation;
}

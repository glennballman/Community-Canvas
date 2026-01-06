/**
 * TENANT CONTEXT
 * 
 * Manages:
 * - Current user
 * - User's tenant memberships  
 * - Currently selected tenant
 * - Impersonation state
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_platform_admin: boolean;
}

export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_type: 'community' | 'business' | 'government' | 'individual';
  role: string;
  is_primary: boolean;
}

export interface ImpersonationState {
  is_impersonating: boolean;
  tenant_id?: string;
  tenant_name?: string;
  tenant_type?: string;
  expires_at?: string;
}

interface TenantContextValue {
  // User
  user: User | null;
  
  // Tenants
  memberships: TenantMembership[];
  currentTenant: TenantMembership | null;
  
  // Impersonation
  impersonation: ImpersonationState;
  
  // State
  loading: boolean;
  initialized: boolean;
  
  // Actions
  switchTenant: (tenantId: string) => Promise<void>;
  clearTenant: () => void;
  refreshContext: () => Promise<void>;
  startImpersonation: (tenantId: string, reason?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ 
    is_impersonating: false 
  });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // --------------------------------------------------------------------------
  // Fetch context on mount
  // --------------------------------------------------------------------------
  
  const fetchContext = useCallback(async () => {
    try {
      const token = localStorage.getItem('cc_token');
      if (!token) {
        setUser(null);
        setMemberships([]);
        setCurrentTenantId(null);
        setImpersonation({ is_impersonating: false });
        setLoading(false);
        setInitialized(true);
        return;
      }
      
      const response = await fetch('/api/me/context', { 
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated
          setUser(null);
          setMemberships([]);
          setCurrentTenantId(null);
          setImpersonation({ is_impersonating: false });
        }
        return;
      }
      
      const data = await response.json();
      
      setUser(data.user || null);
      setMemberships(data.memberships || []);
      setCurrentTenantId(data.current_tenant_id || null);
      
      // Handle impersonation state
      if (data.is_impersonating && data.impersonated_tenant) {
        setImpersonation({
          is_impersonating: true,
          tenant_id: data.impersonated_tenant.id,
          tenant_name: data.impersonated_tenant.name,
          tenant_type: data.impersonated_tenant.type,
          expires_at: data.impersonation_expires_at,
        });
        // When impersonating, current tenant is the impersonated tenant
        setCurrentTenantId(data.impersonated_tenant.id);
      } else {
        setImpersonation({ is_impersonating: false });
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    fetchContext();
    
    // Re-fetch when token changes (after auth completes)
    const checkToken = () => {
      const token = localStorage.getItem('cc_token');
      if (token && !user) {
        fetchContext();
      }
    };
    
    // Poll for token every 500ms until we have a user
    const interval = setInterval(checkToken, 500);
    
    // Also listen for storage events (token changes from other tabs)
    window.addEventListener('storage', checkToken);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkToken);
    };
  }, [fetchContext, user]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      const token = localStorage.getItem('cc_token');
      const response = await fetch('/api/me/switch-tenant', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch tenant');
      }
      
      setCurrentTenantId(tenantId);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      throw error;
    }
  }, []);

  const clearTenant = useCallback(() => {
    setCurrentTenantId(null);
  }, []);

  const refreshContext = useCallback(async () => {
    setLoading(true);
    await fetchContext();
  }, [fetchContext]);

  const startImpersonation = useCallback(async (tenantId: string, reason?: string) => {
    try {
      const token = localStorage.getItem('cc_token');
      const response = await fetch('/api/admin/impersonation/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId, reason: reason || 'Admin access' }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to start impersonation');
      }
      
      // CRITICAL: Full page redirect to /app/dashboard
      // This ensures all state is fresh and correct
      window.location.href = '/app/dashboard';
      
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      throw error;
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    try {
      const token = localStorage.getItem('cc_token');
      await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
      });
      
      // CRITICAL: Full page redirect to /admin/impersonation
      // This ensures all state is fresh and correct
      window.location.href = '/admin/impersonation';
      
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      throw error;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  // When impersonating, the tenant may not be in the user's memberships.
  // Synthesize a tenant object from impersonation data so queries are enabled.
  const currentTenant: TenantMembership | null = (() => {
    if (!currentTenantId) return null;
    
    // First try to find in memberships
    const found = memberships.find(m => m.tenant_id === currentTenantId);
    if (found) return found;
    
    // If impersonating and not found in memberships, synthesize from impersonation data
    if (impersonation.is_impersonating && impersonation.tenant_id === currentTenantId) {
      return {
        tenant_id: impersonation.tenant_id,
        tenant_name: impersonation.tenant_name || 'Unknown Tenant',
        tenant_slug: '', // Not critical for queries
        tenant_type: (impersonation.tenant_type as TenantMembership['tenant_type']) || 'business',
        role: 'admin', // Impersonation grants admin-level access
        is_primary: false,
      };
    }
    
    return null;
  })();

  // --------------------------------------------------------------------------
  // Value
  // --------------------------------------------------------------------------

  const value: TenantContextValue = {
    user,
    memberships,
    currentTenant,
    impersonation,
    loading,
    initialized,
    switchTenant,
    clearTenant,
    refreshContext,
    startImpersonation,
    stopImpersonation,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * TENANT CONTEXT
 * 
 * Manages:
 * - Current user
 * - User's tenant memberships  
 * - Currently selected tenant
 * - Impersonation state
 * 
 * Phase 2C-15B: Uses canonical ImpersonationState from types/session.ts
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  useRef,
  ReactNode 
} from 'react';

import { 
  ImpersonationState, 
  defaultImpersonation, 
  parseImpersonationResponse 
} from '@/types/session';

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

// Re-export canonical type for consumers
export type { ImpersonationState } from '@/types/session';

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
// LOADING OVERLAY HELPERS
// ============================================================================

function showLoadingOverlay(message: string) {
  // Create overlay element if it doesn't exist
  let overlay = document.getElementById('impersonation-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'impersonation-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
      <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <div style="font-size: 18px; font-weight: 500;">${message}</div>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;
  overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('impersonation-loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
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
  const [impersonation, setImpersonation] = useState<ImpersonationState>(defaultImpersonation);
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
        setImpersonation(defaultImpersonation);
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
          setImpersonation(defaultImpersonation);
        }
        return;
      }
      
      const data = await response.json();
      
      setUser(data.user || null);
      setMemberships(data.memberships || []);
      setCurrentTenantId(data.current_tenant_id || null);
      
      // Phase 2C-15B: Use canonical impersonation state
      // Parse impersonation from data.impersonation object (new format) or legacy fields
      if (data.impersonation) {
        // New format: impersonation object with canonical shape
        const parsedImpersonation = parseImpersonationResponse(data.impersonation);
        setImpersonation(parsedImpersonation);
        
        // Only set currentTenantId from impersonation if tenant is explicitly set
        if (parsedImpersonation.active && parsedImpersonation.tenant_id) {
          setCurrentTenantId(parsedImpersonation.tenant_id);
        }
      } else if (data.is_impersonating && data.impersonated_tenant) {
        // Legacy format fallback
        setImpersonation({
          active: true,
          target_user: null,
          tenant_id: data.impersonated_tenant.id,
          tenant_name: data.impersonated_tenant.name,
          tenant_slug: data.impersonated_tenant.slug || null,
          role: data.impersonated_tenant.role || null,
          expires_at: data.impersonation_expires_at || null,
        });
        setCurrentTenantId(data.impersonated_tenant.id);
      } else {
        setImpersonation(defaultImpersonation);
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
      setUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  // Use a ref to track user state for the interval check without triggering re-renders
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    fetchContext();
    
    // Re-fetch when token changes (after auth completes)
    const checkToken = () => {
      const token = localStorage.getItem('cc_token');
      if (token && !userRef.current) {
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
  }, [fetchContext]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      const token = localStorage.getItem('cc_token');
      
      // Phase 2C-15B: Use appropriate endpoint based on impersonation state
      // During impersonation, use set-tenant endpoint to update impersonation context
      const endpoint = impersonation.active 
        ? '/api/admin/impersonation/set-tenant'
        : '/api/me/switch-tenant';
      
      const response = await fetch(endpoint, {
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
  }, [impersonation.active]);

  const clearTenant = useCallback(() => {
    setCurrentTenantId(null);
  }, []);

  const refreshContext = useCallback(async () => {
    setLoading(true);
    await fetchContext();
  }, [fetchContext]);

  const startImpersonation = useCallback(async (tenantId: string, reason?: string) => {
    try {
      // Show loading overlay immediately for visual feedback
      showLoadingOverlay('Switching to tenant...');
      
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
        hideLoadingOverlay();
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
      // Show loading overlay immediately for visual feedback
      showLoadingOverlay('Ending impersonation...');
      
      const token = localStorage.getItem('cc_token');
      await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
      });
      
      // CRITICAL: Full page redirect to All Tenants page
      // This ensures all state is fresh and returns admin to tenant management
      window.location.href = '/app/platform/tenants';
      
    } catch (error) {
      hideLoadingOverlay();
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
    if (impersonation.active && impersonation.tenant_id === currentTenantId) {
      return {
        tenant_id: impersonation.tenant_id,
        tenant_name: impersonation.tenant_name || 'Unknown Tenant',
        tenant_slug: impersonation.tenant_slug || '',
        tenant_type: 'business', // Default type
        role: impersonation.role || 'tenant_admin',
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

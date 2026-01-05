import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useImpersonation } from './ImpersonationContext';
import { api } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  role: string;
  portal_slug?: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  isCommunityOperator: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { ccTenants, isAuthenticated, loading: authLoading } = useAuth();
  const { session: impersonationSession, isActive: isImpersonating, loading: impersonationLoading } = useImpersonation();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for both auth and impersonation to finish loading
    if (authLoading || impersonationLoading) {
      return;
    }

    // PRIORITY 1: Impersonation session takes precedence - clears localStorage to prevent conflicts
    if (isImpersonating && impersonationSession) {
      // Clear any stored tenant to prevent it from overriding impersonation after stop
      localStorage.removeItem('cc_current_tenant');
      
      const impersonatedTenant: Tenant = {
        id: impersonationSession.tenant_id,
        name: impersonationSession.tenant_name,
        slug: impersonationSession.tenant_id,
        type: impersonationSession.tenant_type || 'community',
        role: 'admin',
      };
      setCurrentTenant(impersonatedTenant);
      setLoading(false);
      return;
    }

    // PRIORITY 2: Regular tenant selection from user's memberships
    if (isAuthenticated && ccTenants.length > 0) {
      const stored = localStorage.getItem('cc_current_tenant');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const found = ccTenants.find(t => t.id === parsed.id);
          if (found) {
            setCurrentTenant(found);
          } else {
            setCurrentTenant(ccTenants[0]);
          }
        } catch {
          setCurrentTenant(ccTenants[0]);
        }
      } else {
        // No stored tenant - leave currentTenant null so TenantPicker shows
        setCurrentTenant(null);
      }
    } else {
      setCurrentTenant(null);
    }
    setLoading(false);
  }, [isAuthenticated, ccTenants, isImpersonating, impersonationSession, authLoading, impersonationLoading]);

  async function switchTenant(tenantId: string) {
    const tenant = ccTenants.find(t => t.id === tenantId);
    if (!tenant) return;

    try {
      await api.post('/api/foundation/me/switch-tenant', { tenant_id: tenantId });
      setCurrentTenant(tenant);
      localStorage.setItem('cc_current_tenant', JSON.stringify(tenant));
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  }

  const isCommunityOperator = currentTenant?.type === 'community' || currentTenant?.type === 'government';

  return (
    <TenantContext.Provider value={{
      currentTenant,
      tenants: ccTenants,
      loading,
      switchTenant,
      isCommunityOperator
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

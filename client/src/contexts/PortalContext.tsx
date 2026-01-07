/**
 * PORTAL CONTEXT
 * 
 * Manages portal selection for multi-portal tenants.
 * Staff users can switch between portals owned by their tenant.
 * 
 * Portal context affects:
 * - Work Requests list/create (filtered + default)
 * - Projects list/create (filtered + default)
 * - Contacts list/create (filtered + default)
 * - Bookings create (attaches portal_id)
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from './TenantContext';

export interface Portal {
  id: string;
  name: string;
  slug: string;
  portal_type: string;
  legal_dba_name: string | null;
  status: string;
  tagline?: string;
}

interface PortalContextValue {
  portals: Portal[];
  currentPortal: Portal | null;
  loading: boolean;
  switchPortal: (portalId: string) => Promise<void>;
  clearPortal: () => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within PortalProvider');
  }
  return context;
}

interface PortalProviderProps {
  children: ReactNode;
}

export function PortalProvider({ children }: PortalProviderProps) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [currentPortalId, setCurrentPortalId] = useState<string | null>(null);

  const tenantId = currentTenant?.tenant_id;

  const { data: portalsData, isLoading } = useQuery<{ portals: Portal[] }>({
    queryKey: ['/api/portals', tenantId],
    enabled: !!tenantId,
  });

  const portals = portalsData?.portals || [];

  const { data: preferencesData } = useQuery<{ default_portal_id: string | null }>({
    queryKey: ['/api/me/portal-preference', tenantId],
    enabled: !!tenantId,
  });

  const setDefaultPortalMutation = useMutation({
    mutationFn: async (portalId: string) => {
      const token = localStorage.getItem('cc_token');
      const res = await fetch('/api/me/portal-preference', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ portal_id: portalId }),
      });
      if (!res.ok) throw new Error('Failed to set portal preference');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/portal-preference', tenantId] });
    },
  });

  useEffect(() => {
    if (preferencesData?.default_portal_id) {
      setCurrentPortalId(preferencesData.default_portal_id);
    } else if (portals.length > 0 && !currentPortalId) {
      setCurrentPortalId(portals[0].id);
    }
  }, [preferencesData, portals, currentPortalId]);

  useEffect(() => {
    setCurrentPortalId(null);
  }, [tenantId]);

  const currentPortal = portals.find(p => p.id === currentPortalId) || null;

  const switchPortal = useCallback(async (portalId: string) => {
    setCurrentPortalId(portalId);
    await setDefaultPortalMutation.mutateAsync(portalId);
  }, [setDefaultPortalMutation]);

  const clearPortal = useCallback(() => {
    setCurrentPortalId(null);
  }, []);

  return (
    <PortalContext.Provider value={{
      portals,
      currentPortal,
      loading: isLoading,
      switchPortal,
      clearPortal,
    }}>
      {children}
    </PortalContext.Provider>
  );
}

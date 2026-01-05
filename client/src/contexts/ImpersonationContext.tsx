import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface ImpersonationSession {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_type: string;
  individual_id: string | null;
  individual_name: string | null;
  reason: string;
  expires_at: string;
  created_at: string;
}

interface ImpersonationContextType {
  session: ImpersonationSession | null;
  isActive: boolean;
  loading: boolean;
  error: string | null;
  start: (params: StartParams) => Promise<boolean>;
  stop: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

interface StartParams {
  tenant_id: string;
  individual_id?: string | null;
  reason: string;
  duration_hours: number;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

// P0 SECURITY: /api/internal/* routes use platform session cookie only (no Authorization header)
// We use credentials: 'include' to send the platform_sid cookie
function getInternalHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

// Exchange foundation JWT for platform session
// This must be called before any other /api/internal/* requests
async function exchangeTokenForSession(): Promise<boolean> {
  const token = localStorage.getItem('cc_token');
  if (!token) {
    return false;
  }
  
  try {
    const res = await fetch('/api/internal/auth/exchange', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.success === true;
    }
    return false;
  } catch (err) {
    console.error('[ImpersonationContext] Token exchange failed:', err);
    return false;
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasExchanged, setHasExchanged] = useState(false);

  // Exchange token on first load
  useEffect(() => {
    if (!hasExchanged) {
      exchangeTokenForSession().then(success => {
        setHasExchanged(true);
        if (!success) {
          console.log('[ImpersonationContext] Token exchange not successful (may not be platform admin)');
        }
      });
    }
  }, [hasExchanged]);

  const refresh = useCallback(async () => {
    try {
      // P0 SECURITY: Use session cookie only, no Authorization header
      const res = await fetch('/api/internal/impersonate/status', {
        credentials: 'include',
        headers: getInternalHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.active && data.impersonation) {
          setSession({
            id: data.impersonation.id,
            tenant_id: data.impersonation.tenant_id,
            tenant_name: data.impersonation.tenant_name,
            tenant_type: data.impersonation.tenant_type || 'community',
            individual_id: data.impersonation.individual_id,
            individual_name: data.impersonation.individual_name,
            reason: data.impersonation.reason,
            expires_at: data.impersonation.expires_at,
            created_at: data.impersonation.created_at
          });
        } else {
          setSession(null);
        }
      } else if (res.status === 401 && hasExchanged) {
        // Session expired, try to re-exchange
        const exchanged = await exchangeTokenForSession();
        if (exchanged) {
          // Retry the status check
          const retryRes = await fetch('/api/internal/impersonate/status', {
            credentials: 'include',
            headers: getInternalHeaders()
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            if (data.success && data.active && data.impersonation) {
              setSession({
                id: data.impersonation.id,
                tenant_id: data.impersonation.tenant_id,
                tenant_name: data.impersonation.tenant_name,
                tenant_type: data.impersonation.tenant_type || 'community',
                individual_id: data.impersonation.individual_id,
                individual_name: data.impersonation.individual_name,
                reason: data.impersonation.reason,
                expires_at: data.impersonation.expires_at,
                created_at: data.impersonation.created_at
              });
            } else {
              setSession(null);
            }
          }
        } else {
          setSession(null);
        }
      } else {
        setSession(null);
      }
      setError(null);
    } catch (err) {
      console.error('[ImpersonationContext] Status check failed:', err);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [hasExchanged]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const start = useCallback(async (params: StartParams): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // P0 SECURITY: Use session cookie only, no Authorization header
      const res = await fetch('/api/internal/impersonate/start', {
        method: 'POST',
        headers: getInternalHeaders(),
        credentials: 'include',
        body: JSON.stringify(params)
      });
      
      const data = await res.json();
      
      if (data.success && data.impersonation) {
        setSession({
          id: data.impersonation.id,
          tenant_id: data.impersonation.tenant_id,
          tenant_name: data.impersonation.tenant_name,
          tenant_type: data.impersonation.tenant_type || 'community',
          individual_id: data.impersonation.individual_id,
          individual_name: data.impersonation.individual_name,
          reason: data.impersonation.reason,
          expires_at: data.impersonation.expires_at,
          created_at: data.impersonation.created_at
        });
        return true;
      } else {
        setError(data.error || 'Failed to start impersonation');
        return false;
      }
    } catch (err) {
      console.error('[ImpersonationContext] Start failed:', err);
      setError('Network error starting impersonation');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // P0 SECURITY: Use session cookie only, no Authorization header
      const res = await fetch('/api/internal/impersonate/stop', {
        method: 'POST',
        headers: getInternalHeaders(),
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSession(null);
        return true;
      } else {
        setError(data.error || 'Failed to stop impersonation');
        return false;
      }
    } catch (err) {
      console.error('[ImpersonationContext] Stop failed:', err);
      setError('Network error stopping impersonation');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        session,
        isActive: session !== null,
        loading,
        error,
        start,
        stop,
        refresh
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  return context;
}

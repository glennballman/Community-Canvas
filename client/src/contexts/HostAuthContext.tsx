import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

interface HostAccount {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  telephone: string | null;
  businessName: string | null;
  businessType: string | null;
  emailVerified: boolean;
  status: string;
  createdAt: string;
}

interface HostAuthContextType {
  host: HostAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  refreshHost: () => Promise<void>;
}

const HostAuthContext = createContext<HostAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'hostToken';

export function HostAuthProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HostAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  const setToken = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refreshHost = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setHost(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/host/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHost(data);
      } else {
        clearToken();
        setHost(null);
      }
    } catch (error) {
      console.error('Failed to refresh host:', error);
      clearToken();
      setHost(null);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, clearToken]);

  useEffect(() => {
    refreshHost();
  }, [refreshHost]);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    const response = await fetch('/api/host/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, rememberMe })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    setHost(data.host);
  }, [setToken]);

  const logout = useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/host/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    clearToken();
    setHost(null);
    setLocation('/host/login');
  }, [getToken, clearToken, setLocation]);

  const value: HostAuthContextType = {
    host,
    isAuthenticated: !!host,
    isLoading,
    login,
    logout,
    refreshHost
  };

  return (
    <HostAuthContext.Provider value={value}>
      {children}
    </HostAuthContext.Provider>
  );
}

export function useHostAuth() {
  const context = useContext(HostAuthContext);
  if (context === undefined) {
    throw new Error('useHostAuth must be used within a HostAuthProvider');
  }
  return context;
}

export function ProtectedHostRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useHostAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/host/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

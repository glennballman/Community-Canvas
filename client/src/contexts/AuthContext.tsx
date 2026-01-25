import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';

interface User {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    isPlatformAdmin: boolean;
}

interface CCTenant {
    id: string;
    name: string;
    slug: string;
    type: string;
    role: string;
}

interface ImpersonationState {
    active: boolean;
    target_user: {
        id: string;
        email: string;
        display_name: string;
    } | null;
    tenant: {
        id: string;
        slug: string | null;
        name: string;
    } | null;
    role: string | null;
    expires_at: string | null;
}

interface AuthContextType {
    user: User | null;
    ccTenants: CCTenant[];
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    isAuthenticated: boolean;
    isPlatformAdmin: boolean;
    impersonation: ImpersonationState;
}

const defaultImpersonation: ImpersonationState = {
    active: false,
    target_user: null,
    tenant: null,
    role: null,
    expires_at: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [ccTenants, setCCTenants] = useState<CCTenant[]>([]);
    const [token, setToken] = useState<string | null>(localStorage.getItem('cc_token'));
    const [loading, setLoading] = useState(true);
    const [impersonation, setImpersonation] = useState<ImpersonationState>(defaultImpersonation);

    const refreshSession = useCallback(async () => {
        const storedToken = localStorage.getItem('cc_token');
        if (!storedToken) {
            setImpersonation(defaultImpersonation);
            return;
        }

        try {
            const res = await fetch('/api/foundation/auth/whoami', {
                headers: { Authorization: `Bearer ${storedToken}` },
                credentials: 'include',
            });
            const data = await res.json();
            if (data.ok) {
                setImpersonation(data.impersonation || defaultImpersonation);
            }
        } catch (err) {
            console.error('Failed to refresh session:', err);
        }
    }, []);

    useEffect(() => {
        async function checkAuth() {
            const storedToken = localStorage.getItem('cc_token');
            if (storedToken) {
                try {
                    const res = await fetch('/api/foundation/auth/me', {
                        headers: { Authorization: `Bearer ${storedToken}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        setUser(data.user);
                        setCCTenants(data.tenants || []);
                        setToken(storedToken);
                        await refreshSession();
                    } else {
                        localStorage.removeItem('cc_token');
                        setToken(null);
                    }
                } catch (err) {
                    console.error('Auth check failed:', err);
                    localStorage.removeItem('cc_token');
                    setToken(null);
                }
            }
            setLoading(false);
        }
        checkAuth();
    }, [refreshSession]);

    useEffect(() => {
        async function devAutoLogin() {
            if (!token && !loading) {
                console.log('Dev mode: Auto-logging in as platform admin...');
                await login('glenn@envirogroupe.com', 'TestPass123!');
            }
        }
        if (!token && !loading) {
            devAutoLogin();
        }
    }, [loading, token]);

    async function login(email: string, password: string): Promise<boolean> {
        try {
            const res = await fetch('/api/foundation/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('cc_token', data.token);
                setToken(data.token);
                setUser(data.user);
                setCCTenants(data.tenants || []);
                await refreshSession();
                return true;
            }
            return false;
        } catch (err) {
            console.error('Login failed:', err);
            return false;
        }
    }

    async function logout() {
        const storedToken = localStorage.getItem('cc_token');
        if (storedToken) {
            try {
                await fetch('/api/foundation/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${storedToken}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                });
            } catch (err) {
                console.error('Server logout failed:', err);
            }
        }
        
        localStorage.removeItem('cc_token');
        setToken(null);
        setUser(null);
        setCCTenants([]);
        setImpersonation(defaultImpersonation);
        queryClient.clear();
    }

    return (
        <AuthContext.Provider value={{
            user,
            ccTenants,
            token,
            loading,
            login,
            logout,
            refreshSession,
            isAuthenticated: !!token && !!user,
            isPlatformAdmin: user?.isPlatformAdmin || false,
            impersonation
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

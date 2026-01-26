import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';

// Throttle helper for forensic logs (prevents console spam)
const throttleTimestamps: Record<string, number> = {};
function throttledLog(key: string, ...args: unknown[]) {
  if (process.env.NODE_ENV !== 'development') return;
  const now = Date.now();
  if (!throttleTimestamps[key] || now - throttleTimestamps[key] > 500) {
    throttleTimestamps[key] = now;
    console.debug(...args);
  }
}

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

export type NavMode = 'platform_only' | 'tenant' | 'impersonating';

interface AuthContextType {
    user: User | null;
    ccTenants: CCTenant[];
    token: string | null;
    loading: boolean;
    ready: boolean; // True when auth state is fully resolved (not during initial load)
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<boolean>;
    isAuthenticated: boolean;
    isPlatformAdmin: boolean;
    impersonation: ImpersonationState;
    navMode: NavMode;
    hasTenantMemberships: boolean;
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
    const [ready, setReady] = useState(false); // True once initial auth check completes
    const [impersonation, setImpersonation] = useState<ImpersonationState>(defaultImpersonation);

    const refreshSession = useCallback(async (): Promise<boolean> => {
        const startMs = Date.now();
        const storedToken = localStorage.getItem('cc_token');
        
        throttledLog('refreshSession-start', '[AuthContext] refreshSession: start', { hasToken: !!storedToken });
        
        if (!storedToken) {
            setImpersonation(defaultImpersonation);
            setCCTenants([]);
            throttledLog('refreshSession-no-token', '[AuthContext] refreshSession: no token, returning false');
            return false;
        }

        try {
            // PHASE 2C-15: Call /api/me/context as source of truth for user + memberships + impersonation
            const res = await fetch('/api/me/context', {
                headers: { Authorization: `Bearer ${storedToken}` },
                credentials: 'include',
            });
            
            const durationMs = Date.now() - startMs;
            const contentType = res.headers.get('content-type');
            
            throttledLog('refreshSession-response', '[AuthContext] refreshSession: response', {
                status: res.status,
                ok: res.ok,
                contentType,
                durationMs,
            });
            
            if (!res.ok) {
                console.warn('/api/me/context returned non-OK status:', res.status);
                return false;
            }
            
            if (!contentType || !contentType.includes('application/json')) {
                console.warn('/api/me/context returned non-JSON response');
                return false;
            }
            
            const data = await res.json();
            if (data.ok) {
                // Parse impersonation state
                const impersonationData = data.impersonation || {};
                const newImpersonation: ImpersonationState = {
                    active: impersonationData.active || false,
                    target_user: impersonationData.target_user || null,
                    tenant: impersonationData.tenant_id ? {
                        id: impersonationData.tenant_id,
                        slug: impersonationData.tenant_slug || null,
                        name: impersonationData.tenant_name || '',
                    } : null,
                    role: impersonationData.role || null,
                    expires_at: impersonationData.expires_at || null,
                };
                setImpersonation(newImpersonation);
                
                // Update user from /api/me/context response
                if (data.user) {
                    setUser({
                        id: data.user.id,
                        email: data.user.email,
                        firstName: null,
                        lastName: null,
                        displayName: data.user.full_name || data.user.email,
                        isPlatformAdmin: data.user.is_platform_admin || false,
                    });
                }
                
                // PHASE 2C-15: Hydrate memberships from /api/me/context
                // This returns the EFFECTIVE user's memberships (impersonated if active)
                const memberships = data.memberships || [];
                setCCTenants(memberships.map((m: any) => ({
                    id: m.tenant_id,
                    name: m.tenant_name,
                    slug: m.tenant_slug,
                    type: m.tenant_type || 'business',
                    role: m.role,
                })));
                
                // Dev debug logging
                if (process.env.NODE_ENV === 'development') {
                    console.debug('[AuthContext] refreshSession: hydrated', {
                        impersonationActive: newImpersonation.active,
                        targetUser: newImpersonation.target_user?.email,
                        membershipsCount: memberships.length,
                        memberships: memberships.map((m: any) => m.tenant_name),
                    });
                }
                
                throttledLog('refreshSession-done', '[AuthContext] refreshSession: complete', {
                    impersonationActive: newImpersonation.active,
                    membershipsCount: memberships.length,
                    durationMs,
                });
                return true;
            }
            return false;
        } catch (err) {
            console.error('Failed to refresh session:', err);
            return false;
        }
    }, []);

    useEffect(() => {
        async function checkAuth() {
            const storedToken = localStorage.getItem('cc_token');
            if (storedToken) {
                try {
                    // PHASE 2C-15: Use /api/me/context as single source of truth
                    // This gives us user, memberships, and impersonation state in one call
                    const res = await fetch('/api/me/context', {
                        headers: { Authorization: `Bearer ${storedToken}` },
                        credentials: 'include',
                    });
                    
                    if (!res.ok) {
                        console.warn('Auth check failed:', res.status);
                        localStorage.removeItem('cc_token');
                        setToken(null);
                    } else {
                        const data = await res.json();
                        if (data.ok) {
                            setToken(storedToken);
                            
                            // Set user from context response
                            setUser({
                                id: data.user.id,
                                email: data.user.email,
                                firstName: null,
                                lastName: null,
                                displayName: data.user.full_name || data.user.email,
                                isPlatformAdmin: data.user.is_platform_admin || false,
                            });
                            
                            // Set memberships
                            const memberships = data.memberships || [];
                            setCCTenants(memberships.map((m: any) => ({
                                id: m.tenant_id,
                                name: m.tenant_name,
                                slug: m.tenant_slug,
                                type: m.tenant_type || 'business',
                                role: m.role,
                            })));
                            
                            // Set impersonation state
                            const impersonationData = data.impersonation || {};
                            setImpersonation({
                                active: impersonationData.active || false,
                                target_user: impersonationData.target_user || null,
                                tenant: impersonationData.tenant_id ? {
                                    id: impersonationData.tenant_id,
                                    slug: impersonationData.tenant_slug || null,
                                    name: impersonationData.tenant_name || '',
                                } : null,
                                role: impersonationData.role || null,
                                expires_at: impersonationData.expires_at || null,
                            });
                            
                            if (process.env.NODE_ENV === 'development') {
                                console.debug('[AuthContext] checkAuth: hydrated', {
                                    isPlatformAdmin: data.user.is_platform_admin,
                                    membershipsCount: memberships.length,
                                    impersonationActive: impersonationData.active || false,
                                });
                            }
                        } else {
                            localStorage.removeItem('cc_token');
                            setToken(null);
                        }
                    }
                } catch (err) {
                    console.error('Auth check failed:', err);
                    localStorage.removeItem('cc_token');
                    setToken(null);
                }
            }
            setLoading(false);
            setReady(true); // Auth state is now fully resolved
            if (process.env.NODE_ENV === 'development') {
                console.debug('[AuthContext] ready=true');
            }
        }
        checkAuth();
    }, []);

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
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('cc_token', data.token);
                setToken(data.token);
                
                // PHASE 2C-15: After login, call /api/me/context to get full state
                // This ensures memberships and impersonation are properly hydrated
                const contextRes = await fetch('/api/me/context', {
                    headers: { Authorization: `Bearer ${data.token}` },
                    credentials: 'include',
                });
                
                if (contextRes.ok) {
                    const contextData = await contextRes.json();
                    if (contextData.ok) {
                        // Set user from context
                        setUser({
                            id: contextData.user.id,
                            email: contextData.user.email,
                            firstName: null,
                            lastName: null,
                            displayName: contextData.user.full_name || contextData.user.email,
                            isPlatformAdmin: contextData.user.is_platform_admin || false,
                        });
                        
                        // Set memberships
                        const memberships = contextData.memberships || [];
                        setCCTenants(memberships.map((m: any) => ({
                            id: m.tenant_id,
                            name: m.tenant_name,
                            slug: m.tenant_slug,
                            type: m.tenant_type || 'business',
                            role: m.role,
                        })));
                        
                        // Set impersonation
                        const impersonationData = contextData.impersonation || {};
                        setImpersonation({
                            active: impersonationData.active || false,
                            target_user: impersonationData.target_user || null,
                            tenant: impersonationData.tenant_id ? {
                                id: impersonationData.tenant_id,
                                slug: impersonationData.tenant_slug || null,
                                name: impersonationData.tenant_name || '',
                            } : null,
                            role: impersonationData.role || null,
                            expires_at: impersonationData.expires_at || null,
                        });
                    }
                } else {
                    // Fallback to login response data
                    setUser(data.user);
                    setCCTenants(data.tenants || []);
                }
                
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
        
        // PHASE 2C-15: Clear all local state
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_view_mode');
        sessionStorage.clear(); // Clear any session-based state
        
        setToken(null);
        setUser(null);
        setCCTenants([]);
        setImpersonation(defaultImpersonation);
        setReady(false);
        queryClient.clear();
        
        // Hard navigate to ensure clean state
        window.location.href = '/';
    }

    const hasTenantMemberships = ccTenants.length > 0;
    const isImpersonating = impersonation.active;
    
    const navMode: NavMode = (() => {
        if (isImpersonating) return 'impersonating';
        if (user?.isPlatformAdmin && !hasTenantMemberships) return 'platform_only';
        return 'tenant';
    })();

    return (
        <AuthContext.Provider value={{
            user,
            ccTenants,
            token,
            loading,
            ready,
            login,
            logout,
            refreshSession,
            isAuthenticated: !!token && !!user,
            isPlatformAdmin: user?.isPlatformAdmin || false,
            impersonation,
            navMode,
            hasTenantMemberships,
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

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

interface AuthContextType {
    user: User | null;
    ccTenants: CCTenant[];
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    isAuthenticated: boolean;
    isPlatformAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [ccTenants, setCCTenants] = useState<CCTenant[]>([]);
    const [token, setToken] = useState<string | null>(localStorage.getItem('cc_token'));
    const [loading, setLoading] = useState(true);

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
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('cc_token', data.token);
                setToken(data.token);
                setUser(data.user);
                setCCTenants(data.tenants || []);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Login failed:', err);
            return false;
        }
    }

    function logout() {
        localStorage.removeItem('cc_token');
        setToken(null);
        setUser(null);
        setCCTenants([]);
    }

    return (
        <AuthContext.Provider value={{
            user,
            ccTenants,
            token,
            loading,
            login,
            logout,
            isAuthenticated: !!token && !!user,
            isPlatformAdmin: user?.isPlatformAdmin || false
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

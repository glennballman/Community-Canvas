import { useState, useEffect } from 'react';
import { X, Bug, ChevronDown, ChevronUp, Copy, Check, LogIn, Loader2, LogOut, Building2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface ApiCall {
  id: string;
  endpoint: string;
  method: string;
  status: number;
  ms: number;
  traceId?: string;
  error?: string;
  timestamp: Date;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  type: string;
  role: string;
}

interface ContextData {
  user?: { id: string; email: string; full_name: string; is_platform_admin: boolean };
  current_tenant_id?: string | null;
  memberships?: Array<{ tenant_id: string; tenant_name: string; role: string }>;
}

const apiCalls: ApiCall[] = [];
const MAX_CALLS = 20;

export function recordApiCall(call: Omit<ApiCall, 'id' | 'timestamp'>) {
  const id = crypto.randomUUID();
  apiCalls.unshift({ ...call, id, timestamp: new Date() });
  if (apiCalls.length > MAX_CALLS) {
    apiCalls.pop();
  }
  window.dispatchEvent(new CustomEvent('debug-panel-update'));
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const start = performance.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    
    try {
      const response = await originalFetch(input, init);
      const ms = Math.round(performance.now() - start);
      
      if (url.includes('/api/')) {
        let traceId: string | undefined;
        let error: string | undefined;
        
        if (!response.ok) {
          const cloned = response.clone();
          try {
            const json = await cloned.json();
            traceId = json.traceId;
            error = json.error;
          } catch {}
        }
        
        recordApiCall({
          endpoint: url,
          method,
          status: response.status,
          ms,
          traceId,
          error,
        });
      }
      
      return response;
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      if (url.includes('/api/')) {
        recordApiCall({
          endpoint: url,
          method,
          status: 0,
          ms,
          error: err instanceof Error ? err.message : 'Network error',
        });
      }
      throw err;
    }
  };
}

const KNOWN_DEV_USERS = [
  'ellen@example.com',
  'tester@example.com',
  'glenn@envirogroupe.com',
  'platformadmin@example.com',
  'contractor@example.com'
];

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  
  // Login state
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState('ellen@example.com');
  const [customEmail, setCustomEmail] = useState('');
  
  // Tenant state
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [setTenantLoading, setSetTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [tenantSuccess, setTenantSuccess] = useState(false);
  
  // Context state
  const [context, setContext] = useState<ContextData | null>(null);
  
  const isDev = import.meta.env.DEV;
  const TOKEN_KEY = 'cc_token';

  const authState = {
    tokenPresent: !!localStorage.getItem(TOKEN_KEY),
    tokenKey: TOKEN_KEY,
    cookiePresent: document.cookie.includes('tenant_sid'),
  };

  // Fetch context when panel opens
  useEffect(() => {
    if (isOpen && authState.tokenPresent) {
      fetchContext();
    }
  }, [isOpen, authState.tokenPresent]);

  const fetchContext = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch('/api/me/context', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setContext(data);
      }
    } catch (err) {
      console.error('Failed to fetch context:', err);
    }
  };

  const loginAs = async (email: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/dev/login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (data.ok && data.token) {
        localStorage.setItem('cc_token', data.token);
        if (data.tenantId) {
          localStorage.setItem('cc_tenant_id', data.tenantId);
        }
        if (data.user) {
          localStorage.setItem('cc_user', JSON.stringify(data.user));
        }
        window.location.reload();
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('cc_token');
    localStorage.removeItem('cc_tenant_id');
    localStorage.removeItem('cc_user');
    window.location.href = '/login';
  };

  const loadTenants = async () => {
    setTenantsLoading(true);
    setTenantError(null);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch('/api/me/tenants', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.ok && data.tenants) {
        setTenants(data.tenants);
        if (data.tenants.length > 0 && !selectedTenant) {
          setSelectedTenant(data.tenants[0].id);
        }
      } else {
        setTenantError(data.error || 'Failed to load tenants');
      }
    } catch (err) {
      setTenantError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTenantsLoading(false);
    }
  };

  const setTenant = async () => {
    if (!selectedTenant) return;
    setSetTenantLoading(true);
    setTenantError(null);
    setTenantSuccess(false);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch('/api/dev/set-tenant', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ tenantId: selectedTenant })
      });
      const data = await res.json();
      
      if (data.ok) {
        setTenantSuccess(true);
        await fetchContext();
        setTimeout(() => setTenantSuccess(false), 3000);
      } else {
        setTenantError(data.error || 'Failed to set tenant');
      }
    } catch (err) {
      setTenantError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSetTenantLoading(false);
    }
  };

  useEffect(() => {
    const update = () => setCalls([...apiCalls]);
    window.addEventListener('debug-panel-update', update);
    update();
    return () => window.removeEventListener('debug-panel-update', update);
  }, []);

  const copyState = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      auth: authState,
      context,
      recentCalls: calls.slice(0, 5).map(c => ({
        endpoint: c.endpoint,
        status: c.status,
        traceId: c.traceId,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isDev) return null;

  if (!isOpen) {
    return (
      <Button
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 z-50 opacity-50 hover:opacity-100"
        onClick={() => setIsOpen(true)}
        data-testid="button-open-debug"
      >
        <Bug className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] bg-background border rounded-lg shadow-lg max-h-[90vh] overflow-hidden flex flex-col" data-testid="debug-panel">
      <div className="flex items-center justify-between p-2 border-b shrink-0">
        <span className="font-mono text-sm font-medium">Debug Panel (DEV)</span>
        <Button size="icon" variant="ghost" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* Big Status Badges */}
          <div className="flex gap-2 justify-center" data-testid="status-badges">
            <Badge 
              variant={authState.tokenPresent ? 'default' : 'destructive'} 
              className="text-sm px-3 py-1 gap-1"
              data-testid="badge-authenticated"
            >
              {authState.tokenPresent ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              Authenticated
            </Badge>
            <Badge 
              variant={context?.current_tenant_id ? 'default' : 'destructive'} 
              className="text-sm px-3 py-1 gap-1"
              data-testid="badge-tenant-set"
            >
              {context?.current_tenant_id ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              Tenant Set
            </Badge>
          </div>

          {/* Tenant Null Warning */}
          {authState.tokenPresent && !context?.current_tenant_id && (
            <div 
              className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-3 py-2 text-xs font-mono text-center"
              data-testid="warning-no-tenant"
            >
              Tenant context is null → tenant routes will 404 until you Set Tenant.
            </div>
          )}

          {/* Auth State Section */}
          <div className="text-xs font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="opacity-50">Auth State:</span>
              <div className="flex gap-1">
                <Badge variant={authState.tokenPresent ? 'default' : 'secondary'} className="text-xs">
                  Token: {authState.tokenPresent ? 'Yes' : 'No'}
                </Badge>
                <Badge variant={authState.cookiePresent ? 'default' : 'secondary'} className="text-xs">
                  Cookie: {authState.cookiePresent ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
            {context?.user && (
              <div className="text-xs opacity-70">
                Logged in as: <span className="font-semibold">{context.user.email}</span>
                {context.user.is_platform_admin && <Badge variant="outline" className="ml-1 text-xs">Admin</Badge>}
              </div>
            )}
            {context?.current_tenant_id && (
              <div className="text-xs opacity-70">
                Current Tenant: <span className="font-semibold">{context.current_tenant_id.substring(0, 8)}...</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Login As Section */}
          <div className="space-y-2">
            <div className="text-xs font-mono font-medium flex items-center gap-1">
              <LogIn className="h-3 w-3" /> Login As (Dev)
            </div>
            
            {!authState.tokenPresent ? (
              <>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-7 text-xs" data-testid="select-dev-user">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_DEV_USERS.map(email => (
                      <SelectItem key={email} value={email} className="text-xs">
                        {email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex gap-1">
                  <Input 
                    placeholder="Or enter email..."
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="h-7 text-xs flex-1"
                    data-testid="input-custom-email"
                  />
                </div>
                
                <Button 
                  size="sm" 
                  variant="default" 
                  onClick={() => loginAs(customEmail || selectedUser)} 
                  disabled={loginLoading}
                  className="w-full h-7 text-xs"
                  data-testid="button-dev-login"
                >
                  {loginLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <LogIn className="h-3 w-3 mr-1" />
                  )}
                  Login as {customEmail || selectedUser}
                </Button>
              </>
            ) : (
              <div className="flex gap-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={logout}
                  className="flex-1 h-7 text-xs"
                  data-testid="button-dev-logout"
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Logout (Dev)
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={copyState}
                  className="h-7 text-xs"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )}
            
            {loginError && (
              <div className="text-xs text-destructive">{loginError}</div>
            )}
          </div>

          <Separator />

          {/* Tenant Context Section */}
          {authState.tokenPresent && (
            <div className="space-y-2">
              <div className="text-xs font-mono font-medium flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Tenant Context
              </div>
              
              <div className="flex gap-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={loadTenants}
                  disabled={tenantsLoading}
                  className="h-7 text-xs"
                  data-testid="button-load-tenants"
                >
                  {tenantsLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Load Tenants
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={fetchContext}
                  className="h-7 text-xs"
                  title="Refresh context"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
              
              {tenants.length > 0 && (
                <>
                  <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                    <SelectTrigger className="h-7 text-xs" data-testid="select-tenant">
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name} ({t.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    size="sm" 
                    variant="default" 
                    onClick={setTenant}
                    disabled={setTenantLoading || !selectedTenant}
                    className="w-full h-7 text-xs"
                    data-testid="button-set-tenant"
                  >
                    {setTenantLoading ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : tenantSuccess ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Building2 className="h-3 w-3 mr-1" />
                    )}
                    {tenantSuccess ? 'Tenant Set!' : 'Set Tenant'}
                  </Button>
                </>
              )}
              
              {tenantError && (
                <div className="text-xs text-destructive">{tenantError}</div>
              )}
              
              {/* Quick Navigation */}
              {context?.current_tenant_id && (
                <div className="flex gap-1 flex-wrap">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.location.href = '/app/contractor/photo-bundles'}
                    className="h-6 text-xs"
                    data-testid="link-contractor-bundles"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Bundles
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.location.href = '/app/dashboard'}
                    className="h-6 text-xs"
                    data-testid="link-dashboard"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Dashboard
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.location.href = '/app/platform'}
                    className="h-6 text-xs"
                    data-testid="link-platform"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Platform
                  </Button>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* API Calls Section */}
          <div className="space-y-1">
            <div className="text-xs font-mono opacity-50">Last {calls.length} API calls:</div>
            {calls.map(call => (
              <div
                key={call.id}
                className="text-xs font-mono p-1 rounded bg-muted/50"
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpanded(expanded === call.id ? null : call.id)}
                >
                  <div className="flex items-center gap-1 truncate">
                    <Badge
                      variant={call.status >= 200 && call.status < 300 ? 'default' : 'destructive'}
                      className="text-xs px-1"
                    >
                      {call.status || 'ERR'}
                    </Badge>
                    <span className="truncate">{call.endpoint.replace('/api/', '/')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="opacity-50">{call.ms}ms</span>
                    {expanded === call.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </div>
                {expanded === call.id && (
                  <div className="mt-1 pt-1 border-t border-muted text-xs space-y-0.5">
                    <div><span className="opacity-50">method:</span> {call.method}</div>
                    {call.traceId && <div><span className="opacity-50">traceId:</span> {call.traceId}</div>}
                    {call.error && <div className="text-destructive"><span className="opacity-50">error:</span> {call.error}</div>}
                    <div><span className="opacity-50">time:</span> {call.timestamp.toLocaleTimeString()}</div>
                  </div>
                )}
              </div>
            ))}
            {calls.length === 0 && (
              <div className="text-xs opacity-50 text-center py-4">No API calls recorded yet</div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

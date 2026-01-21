import { useState, useEffect } from 'react';
import { X, Bug, ChevronDown, ChevronUp, Copy, Check, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const isDev = import.meta.env.DEV;

  const loginAsTester = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/dev/login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tester@example.com' })
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

  useEffect(() => {
    const update = () => setCalls([...apiCalls]);
    window.addEventListener('debug-panel-update', update);
    update();
    return () => window.removeEventListener('debug-panel-update', update);
  }, []);

  if (!isDev) return null;

  const authState = {
    tokenPresent: !!localStorage.getItem('cc_token'),
    cookiePresent: document.cookie.includes('tenant_sid'),
  };

  const copyState = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      auth: authState,
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
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-background border rounded-lg shadow-lg" data-testid="debug-panel">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="font-mono text-sm font-medium">Debug Panel</span>
        <Button size="icon" variant="ghost" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-2 border-b text-xs font-mono space-y-1">
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
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={copyState} className="flex-1 h-6 text-xs">
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            Copy state
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            onClick={loginAsTester} 
            disabled={loginLoading || authState.tokenPresent}
            className="flex-1 h-6 text-xs"
            data-testid="button-dev-login"
          >
            {loginLoading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <LogIn className="h-3 w-3 mr-1" />
            )}
            {authState.tokenPresent ? 'Logged in' : 'Login as tester'}
          </Button>
        </div>
        {loginError && (
          <div className="text-xs text-destructive">{loginError}</div>
        )}
      </div>

      <ScrollArea className="h-64">
        <div className="p-2 space-y-1">
          <div className="text-xs font-mono opacity-50 mb-2">Last {calls.length} API calls:</div>
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
      </ScrollArea>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Play, RotateCcw, AlertTriangle, ExternalLink, Copy, Check, 
  User, Building2, Calendar, Loader2, RefreshCw, TestTube2, 
  CheckCircle2, XCircle, ChevronDown, Clock, SkipForward
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QaTestResult {
  id: string;
  name: string;
  ok: boolean;
  durationMs: number;
  details?: string;
  error?: string;
  skipped?: boolean;
}

interface QaSuiteResult {
  ok: boolean;
  runId: string;
  suite: string;
  startedAt: string;
  results: QaTestResult[];
  totalMs: number;
}

interface DemoStatus {
  authToken: boolean;
  currentTenantId: string | null;
  currentTenantName: string | null;
  lastSeedResult: { ok: boolean; timestamp: string; message: string } | null;
}

interface SeedResponse {
  ok: boolean;
  demoBatchId?: string;
  summary?: Record<string, number>;
  bamfieldPortalId?: string;
  ellenTenantId?: string;
  wadeTenantId?: string;
  error?: string;
  message?: string;
  step?: string;
}

export default function DemoLauncherPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DemoStatus>({
    authToken: false,
    currentTenantId: null,
    currentTenantName: null,
    lastSeedResult: null,
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qaResult, setQaResult] = useState<QaSuiteResult | null>(null);
  const [qaLoading, setQaLoading] = useState<string | null>(null);

  const TOKEN_KEY = 'cc_token';
  const DEMO_SEED_KEY = 'cc_demo_last_seed';
  const QA_RESULT_KEY = 'cc_qa_last_result';

  const refreshStatus = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const lastSeed = localStorage.getItem(DEMO_SEED_KEY);
    
    let currentTenantId: string | null = null;
    let currentTenantName: string | null = null;
    
    if (token) {
      try {
        const res = await fetch('/api/me/context', {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          currentTenantId = data.current_tenant_id;
          if (data.memberships) {
            const m = data.memberships.find((m: any) => m.tenant_id === currentTenantId);
            currentTenantName = m?.tenant_name || null;
          }
        }
      } catch (e) {
        console.error('Failed to fetch context:', e);
      }
    }
    
    setStatus({
      authToken: !!token,
      currentTenantId,
      currentTenantName,
      lastSeedResult: lastSeed ? JSON.parse(lastSeed) : null,
    });
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleSeedDemo = async () => {
    setLoading('seed');
    try {
      const res = await fetch('/api/dev/demo-seed', { method: 'POST' });
      const data: SeedResponse = await res.json();
      
      const result = {
        ok: data.ok,
        timestamp: new Date().toISOString(),
        message: data.ok 
          ? `Seeded: ${Object.values(data.summary || {}).reduce((a, b) => a + b, 0)} items`
          : data.message || data.error || 'Seed failed'
      };
      
      localStorage.setItem(DEMO_SEED_KEY, JSON.stringify(result));
      
      if (data.ok) {
        toast({ title: 'Demo Seeded', description: result.message });
      } else {
        toast({ title: 'Seed Failed', description: `${data.message} (step: ${data.step})`, variant: 'destructive' });
      }
      
      await refreshStatus();
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleResetDemo = async () => {
    setLoading('reset');
    try {
      const res = await fetch('/api/dev/demo-reset', { method: 'POST' });
      const data = await res.json();
      
      if (data.ok) {
        localStorage.removeItem(DEMO_SEED_KEY);
        toast({ title: 'Demo Reset', description: 'Demo data cleared' });
      } else {
        toast({ title: 'Reset Failed', description: data.error, variant: 'destructive' });
      }
      
      await refreshStatus();
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handlePanicReset = async () => {
    setLoading('panic');
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('Logout failed:', e);
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('cc_tenant_id');
    localStorage.removeItem('cc_user');
    localStorage.removeItem('cc_view_mode');
    localStorage.removeItem('cc_last_tenant_id');
    localStorage.removeItem(DEMO_SEED_KEY);
    
    toast({ title: 'Panic Reset Complete', description: 'All auth and context cleared' });
    setLoading(null);
    
    await refreshStatus();
  };

  const openBamfieldPortal = () => {
    window.open('/p/bamfield/calendar', '_blank');
  };

  const openEllenContractor = async () => {
    setLoading('ellen');
    try {
      const res = await fetch('/api/dev/login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ellen@example.com' }),
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.ok && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        
        const ellenTenantId = data.tenants?.find((t: any) => 
          t.name?.includes('1252093') || t.name?.includes('Enviropaving')
        )?.id || data.tenantId;
        
        if (ellenTenantId) {
          await fetch('/api/dev/set-tenant', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`
            },
            credentials: 'include',
            body: JSON.stringify({ tenantId: ellenTenantId })
          });
          localStorage.setItem('cc_tenant_id', ellenTenantId);
          localStorage.setItem('cc_last_tenant_id', ellenTenantId);
        }
        
        window.location.href = '/app/contractor/calendar';
      } else {
        toast({ title: 'Login Failed', description: data.error, variant: 'destructive' });
        setLoading(null);
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
      setLoading(null);
    }
  };

  const openWadeResident = async () => {
    setLoading('wade');
    try {
      const res = await fetch('/api/dev/login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wade@example.com' }),
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.ok && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        
        const wadeTenantId = data.tenants?.find((t: any) => 
          t.name?.includes('Wade') || t.type === 'individual'
        )?.id || data.tenantId;
        
        if (wadeTenantId) {
          await fetch('/api/dev/set-tenant', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`
            },
            credentials: 'include',
            body: JSON.stringify({ tenantId: wadeTenantId })
          });
          localStorage.setItem('cc_tenant_id', wadeTenantId);
          localStorage.setItem('cc_last_tenant_id', wadeTenantId);
        }
        
        window.location.href = '/app/my-place/calendar';
      } else {
        toast({ title: 'Login Failed', description: data.error, variant: 'destructive' });
        setLoading(null);
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
      setLoading(null);
    }
  };

  const copyDemoLinks = () => {
    const baseUrl = window.location.origin;
    const links = `Demo Links:
- Bamfield Portal Calendar: ${baseUrl}/p/bamfield/calendar
- Ellen Contractor (login required): ${baseUrl}/app/contractor/calendar
- Wade Resident (login required): ${baseUrl}/app/my-place/calendar
- Demo Launcher: ${baseUrl}/app/dev/demo`;
    
    navigator.clipboard.writeText(links);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied', description: 'Demo links copied to clipboard' });
  };

  const runQaSuite = async (suite: string) => {
    setQaLoading(suite);
    try {
      const res = await fetch('/api/dev/qa/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suite })
      });
      
      if (res.status === 404) {
        toast({ title: 'QA Disabled', description: 'QA runner not enabled in this environment', variant: 'destructive' });
        setQaLoading(null);
        return;
      }
      
      const data: QaSuiteResult = await res.json();
      setQaResult(data);
      sessionStorage.setItem(QA_RESULT_KEY, JSON.stringify(data));
      
      const passCount = data.results.filter(r => r.ok && !r.skipped).length;
      const failCount = data.results.filter(r => !r.ok && !r.skipped).length;
      const skipCount = data.results.filter(r => r.skipped).length;
      
      toast({
        title: data.ok ? 'QA Passed' : 'QA Failed',
        description: `${passCount} pass, ${failCount} fail, ${skipCount} skip (${data.totalMs}ms)`,
        variant: data.ok ? 'default' : 'destructive'
      });
    } catch (err) {
      toast({ title: 'QA Error', description: String(err), variant: 'destructive' });
    } finally {
      setQaLoading(null);
    }
  };

  const clearQaResults = () => {
    setQaResult(null);
    sessionStorage.removeItem(QA_RESULT_KEY);
  };

  useEffect(() => {
    const savedQa = sessionStorage.getItem(QA_RESULT_KEY);
    if (savedQa) {
      try {
        setQaResult(JSON.parse(savedQa));
      } catch (e) {
        // ignore parse errors
      }
    }
  }, []);

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Launcher</h1>
          <p className="text-muted-foreground">N3-CAL-04 Demo Recovery Pack</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshStatus} data-testid="button-refresh-status">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap" data-testid="status-badges">
        <Badge variant={status.authToken ? 'default' : 'destructive'} className="gap-1">
          <User className="h-3 w-3" />
          Auth: {status.authToken ? 'Yes' : 'No'}
        </Badge>
        <Badge variant={status.currentTenantId ? 'default' : 'destructive'} className="gap-1">
          <Building2 className="h-3 w-3" />
          Tenant: {status.currentTenantName || (status.currentTenantId ? status.currentTenantId.substring(0, 8) + '...' : 'None')}
        </Badge>
        {status.lastSeedResult && (
          <Badge variant={status.lastSeedResult.ok ? 'outline' : 'destructive'} className="gap-1">
            Last Seed: {status.lastSeedResult.ok ? 'Success' : 'Failed'}
            {' '}({new Date(status.lastSeedResult.timestamp).toLocaleTimeString()})
          </Badge>
        )}
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5 text-green-500" />
              Seed Demo
            </CardTitle>
            <CardDescription>Create demo data for Bamfield portal</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={handleSeedDemo}
              disabled={loading !== null}
              data-testid="button-seed-demo"
            >
              {loading === 'seed' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Seed Demo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Reset Demo
            </CardTitle>
            <CardDescription>Clear all demo-tagged data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleResetDemo}
              disabled={loading !== null}
              data-testid="button-reset-demo"
            >
              {loading === 'reset' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Reset Demo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Panic Reset
            </CardTitle>
            <CardDescription>Logout + clear all context</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              className="w-full" 
              onClick={handlePanicReset}
              disabled={loading !== null}
              data-testid="button-panic-reset"
            >
              {loading === 'panic' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Panic Reset
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <h2 className="text-xl font-semibold">Open Demo Views</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Bamfield Portal
            </CardTitle>
            <CardDescription>Public operations calendar (no login)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={openBamfieldPortal}
              data-testid="button-open-bamfield"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Portal Calendar
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-green-500" />
              Ellen Contractor
            </CardTitle>
            <CardDescription>Login as Ellen (Enviropaving admin)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={openEllenContractor}
              disabled={loading !== null}
              data-testid="button-open-ellen"
            >
              {loading === 'ellen' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Login as Ellen
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-purple-500" />
              Wade Resident
            </CardTitle>
            <CardDescription>Login as Wade (resident)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={openWadeResident}
              disabled={loading !== null}
              data-testid="button-open-wade"
            >
              {loading === 'wade' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Login as Wade
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <h2 className="text-xl font-semibold flex items-center gap-2">
        <TestTube2 className="h-5 w-5" />
        QA Checks
      </h2>

      <div className="grid gap-3 md:grid-cols-6">
        <Button 
          variant="default"
          onClick={() => runQaSuite('pre_demo_smoke')}
          disabled={qaLoading !== null}
          data-testid="button-qa-pre-demo"
        >
          {qaLoading === 'pre_demo_smoke' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Pre-Demo
        </Button>
        <Button 
          variant="outline"
          onClick={() => runQaSuite('auth_only')}
          disabled={qaLoading !== null}
          data-testid="button-qa-auth"
        >
          {qaLoading === 'auth_only' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Auth
        </Button>
        <Button 
          variant="outline"
          onClick={() => runQaSuite('calendar_only')}
          disabled={qaLoading !== null}
          data-testid="button-qa-calendar"
        >
          {qaLoading === 'calendar_only' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Calendar
        </Button>
        <Button 
          variant="outline"
          onClick={() => runQaSuite('workflows_only')}
          disabled={qaLoading !== null}
          data-testid="button-qa-workflows"
        >
          {qaLoading === 'workflows_only' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Workflows
        </Button>
        <Button 
          variant="outline"
          onClick={() => runQaSuite('critical_pages')}
          disabled={qaLoading !== null}
          data-testid="button-qa-critical-pages"
        >
          {qaLoading === 'critical_pages' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Critical Pages
        </Button>
        <Button 
          variant="ghost"
          onClick={clearQaResults}
          disabled={!qaResult}
          data-testid="button-qa-clear"
        >
          Clear
        </Button>
      </div>

      {qaResult && (
        <Card data-testid="qa-results-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2" data-testid="qa-results-title">
                {qaResult.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="qa-overall-pass" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" data-testid="qa-overall-fail" />
                )}
                {qaResult.suite.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span data-testid="qa-total-duration">{qaResult.totalMs}ms</span>
                <span className="text-xs" data-testid="qa-run-time">
                  ({new Date(qaResult.startedAt).toLocaleTimeString()})
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {qaResult.results.map((result, idx) => (
              <Collapsible key={result.id}>
                <div 
                  className="flex items-center gap-2 py-1 px-2 rounded hover-elevate"
                  data-testid={`qa-result-row-${idx}`}
                >
                  {result.skipped ? (
                    <SkipForward className="h-4 w-4 text-muted-foreground" data-testid={`qa-status-skip-${idx}`} />
                  ) : result.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" data-testid={`qa-status-pass-${idx}`} />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" data-testid={`qa-status-fail-${idx}`} />
                  )}
                  <span 
                    className={`flex-1 text-sm ${result.skipped ? 'text-muted-foreground' : ''}`}
                    data-testid={`qa-result-name-${idx}`}
                  >
                    {result.name}
                  </span>
                  <span className="text-xs text-muted-foreground" data-testid={`qa-result-duration-${idx}`}>
                    {result.durationMs}ms
                  </span>
                  {(result.details || result.error) && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`qa-result-expand-${idx}`}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
                <CollapsibleContent>
                  <div className="ml-6 px-2 py-1 text-xs rounded bg-muted" data-testid={`qa-result-details-${idx}`}>
                    {result.details && <div className="text-muted-foreground">{result.details}</div>}
                    {result.error && <div className="text-red-500 font-mono" data-testid={`qa-result-error-${idx}`}>{result.error}</div>}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex justify-center">
        <Button variant="outline" onClick={copyDemoLinks} data-testid="button-copy-links">
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy Demo Links'}
        </Button>
      </div>
    </div>
  );
}

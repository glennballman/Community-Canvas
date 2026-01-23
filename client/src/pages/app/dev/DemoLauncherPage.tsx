import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, RotateCcw, AlertTriangle, ExternalLink, Copy, Check, 
  User, Building2, Calendar, Loader2, RefreshCw 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  const TOKEN_KEY = 'cc_token';
  const DEMO_SEED_KEY = 'cc_demo_last_seed';

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

      <div className="flex justify-center">
        <Button variant="outline" onClick={copyDemoLinks} data-testid="button-copy-links">
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy Demo Links'}
        </Button>
      </div>
    </div>
  );
}

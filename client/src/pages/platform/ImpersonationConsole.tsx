import { useState, useEffect } from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Search, Users, Building2, Clock, AlertTriangle, Zap } from 'lucide-react';
import { useImpersonationQAMode } from '@/pages/AdminSettings';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface Individual {
  id: string;
  full_name: string;
  email: string | null;
}

const DURATION_OPTIONS = [
  { value: '0.5', label: '30 minutes' },
  { value: '1', label: '1 hour' },
  { value: '4', label: '4 hours (max)' }
];

export default function ImpersonationConsole() {
  const { session, isActive, loading, error, start, stop, refresh } = useImpersonation();
  const { toast } = useToast();
  const { qaMode } = useImpersonationQAMode();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [individualsLoading, setIndividualsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('1');

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchIndividuals(selectedTenant.id);
    } else {
      setIndividuals([]);
      setSelectedIndividual('');
    }
  }, [selectedTenant]);

  function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('cc_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async function fetchTenants() {
    try {
      const res = await fetch('/api/internal/tenants', { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      } else {
        console.error('Failed to fetch tenants:', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setTenantsLoading(false);
    }
  }

  async function fetchIndividuals(tenantId: string) {
    setIndividualsLoading(true);
    try {
      const res = await fetch(`/api/internal/tenants/${tenantId}/individuals`, { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setIndividuals(data.individuals || []);
      }
    } catch (err) {
      console.error('Failed to fetch individuals:', err);
    } finally {
      setIndividualsLoading(false);
    }
  }

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStart = async () => {
    if (!selectedTenant) {
      toast({ title: 'Error', description: 'Please select a tenant', variant: 'destructive' });
      return;
    }
    
    const effectiveReason = qaMode && reason.length < 20
      ? '[QA Mode - Reason not required]'
      : reason;
    
    if (effectiveReason.length < 20) {
      toast({ title: 'Error', description: 'Reason must be at least 20 characters', variant: 'destructive' });
      return;
    }

    const success = await start({
      tenant_id: selectedTenant.id,
      individual_id: selectedIndividual || null,
      reason: effectiveReason,
      duration_hours: parseFloat(duration)
    });

    if (success) {
      toast({ title: 'Impersonation Started', description: `Now impersonating ${selectedTenant.name}` });
    } else {
      toast({ title: 'Failed to Start', description: error || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleStop = async () => {
    const success = await stop();
    if (success) {
      toast({ title: 'Impersonation Stopped', description: 'Session ended successfully' });
      setSelectedTenant(null);
      setSelectedIndividual('');
      setReason('');
    } else {
      toast({ title: 'Failed to Stop', description: error || 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-console-title">Platform Impersonation Console</h1>
          <p className="text-muted-foreground">Temporarily access tenant accounts for support and debugging</p>
        </div>
      </div>

      {isActive && session && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Active Impersonation Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tenant:</span>
                <p className="font-medium" data-testid="text-active-tenant">{session.tenant_name}</p>
              </div>
              {session.individual_name && (
                <div>
                  <span className="text-muted-foreground">As Individual:</span>
                  <p className="font-medium" data-testid="text-active-individual">{session.individual_name}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Reason:</span>
                <p className="font-medium" data-testid="text-active-reason">{session.reason}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Expires:</span>
                <p className="font-medium" data-testid="text-active-expires">
                  {new Date(session.expires_at).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handleStop}
              disabled={loading}
              data-testid="button-stop-impersonation"
            >
              Stop Impersonation
            </Button>
          </CardContent>
        </Card>
      )}

      {!isActive && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Impersonation</CardTitle>
            <CardDescription>
              Select a tenant and optionally an individual to impersonate. You must provide a reason.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tenant-search">Search Tenants</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="tenant-search"
                  placeholder="Search by name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-tenant-search"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Tenant</Label>
              {tenantsLoading ? (
                <p className="text-muted-foreground text-sm">Loading tenants...</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {filteredTenants.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-2">No tenants found</p>
                  ) : (
                    filteredTenants.map(tenant => (
                      <button
                        key={tenant.id}
                        onClick={() => setSelectedTenant(tenant)}
                        className={`flex items-center gap-3 p-3 rounded-md text-left transition-colors ${
                          selectedTenant?.id === tenant.id
                            ? 'bg-primary/10 border border-primary'
                            : 'hover-elevate border border-transparent'
                        }`}
                        data-testid={`button-tenant-${tenant.slug}`}
                      >
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{tenant.type}</Badge>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedTenant && (
              <div className="space-y-2">
                <Label htmlFor="individual-select">As Individual (Optional)</Label>
                <Select value={selectedIndividual || "__NONE__"} onValueChange={(val) => setSelectedIndividual(val === "__NONE__" ? "" : val)}>
                  <SelectTrigger data-testid="select-individual">
                    <SelectValue placeholder={individualsLoading ? "Loading..." : "Select individual (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">No specific individual</SelectItem>
                    {individuals.map(ind => (
                      <SelectItem key={ind.id} value={ind.id}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {ind.full_name}
                          {ind.email && <span className="text-muted-foreground text-xs">({ind.email})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason {qaMode 
                  ? <Badge variant="secondary" className="ml-2 text-[10px]"><Zap className="w-3 h-3 mr-1" />QA Mode - Optional</Badge>
                  : <span className="text-muted-foreground">(min 20 characters)</span>
                }
              </Label>
              <Textarea
                id="reason"
                placeholder={qaMode ? "Optional in QA mode..." : "Explain why you need to access this tenant account..."}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-20"
                data-testid="input-reason"
              />
              {!qaMode && (
                <p className="text-xs text-muted-foreground">
                  {reason.length}/20 characters {reason.length >= 20 && '- OK'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Session Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleStart}
              disabled={loading || !selectedTenant || (!qaMode && reason.length < 20)}
              className="w-full"
              data-testid="button-start-impersonation"
            >
              <Shield className="w-4 h-4 mr-2" />
              Start Impersonation
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Notice</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>All impersonation sessions are logged with full audit trail including:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Staff identity and IP address</li>
            <li>Target tenant and individual</li>
            <li>Session start/stop times</li>
            <li>All actions performed during impersonation</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

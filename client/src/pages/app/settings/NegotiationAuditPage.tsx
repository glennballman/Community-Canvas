import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Copy, RefreshCw, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { Link } from 'wouter';

interface AuditEvent {
  id: string;
  created_at: string;
  portal_id: string | null;
  run_id: string;
  actor_type: string;
  actor_tenant_membership_id: string | null;
  negotiation_type: string;
  effective_source: string;
  effective_policy_id: string;
  effective_policy_updated_at: string;
  effective_policy_hash: string;
  request_fingerprint: string;
}

interface AuditListResponse {
  ok: boolean;
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
  next_offset: number | null;
}

function maskHash(hash: string): string {
  if (!hash) return '********';
  if (hash.length <= 12) return hash;
  return `${hash.substring(0, 8)}…${hash.substring(hash.length - 4)}`;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

export default function NegotiationAuditPage() {
  const { toast } = useToast();
  const { resolve } = useCopy();
  
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all');
  const [effectiveSourceFilter, setEffectiveSourceFilter] = useState<string>('all');
  const [runIdFilter, setRunIdFilter] = useState('');
  const [policyHashFilter, setPolicyHashFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;
  
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('negotiation_type', 'schedule');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    
    if (actorTypeFilter !== 'all') {
      params.set('actor_type', actorTypeFilter);
    }
    if (effectiveSourceFilter !== 'all') {
      params.set('effective_source', effectiveSourceFilter);
    }
    if (runIdFilter.trim()) {
      params.set('run_id', runIdFilter.trim());
    }
    if (policyHashFilter.trim()) {
      params.set('policy_hash', policyHashFilter.trim());
    }
    
    return params.toString();
  };
  
  const { data, isLoading, error, refetch } = useQuery<AuditListResponse>({
    queryKey: ['/api/app/negotiation-audit', actorTypeFilter, effectiveSourceFilter, runIdFilter, policyHashFilter, offset],
    queryFn: async () => {
      const res = await fetch(`/api/app/negotiation-audit?${buildQueryParams()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch audit events');
      }
      return res.json();
    },
  });
  
  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard`,
        duration: 1500,
      });
    } catch {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
        duration: 1500,
      });
    }
  };
  
  const handleSearch = () => {
    setOffset(0);
    refetch();
  };
  
  const handleLoadMore = () => {
    if (data?.next_offset !== null) {
      setOffset(data!.next_offset!);
    }
  };
  
  const handleReset = () => {
    setActorTypeFilter('all');
    setEffectiveSourceFilter('all');
    setRunIdFilter('');
    setPolicyHashFilter('');
    setOffset(0);
  };
  
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {resolve('settings.negotiation_audit.title') || 'Negotiation Audit Trail'}
          </h1>
          <p className="text-muted-foreground">
            {resolve('settings.negotiation_audit.description') || 'View policy resolution events for schedule proposals'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            {resolve('settings.negotiation_audit.filters.title') || 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actor-type-filter">
                {resolve('settings.negotiation_audit.filters.actor_type') || 'Actor Type'}
              </Label>
              <Select 
                value={actorTypeFilter} 
                onValueChange={setActorTypeFilter}
              >
                <SelectTrigger id="actor-type-filter" data-testid="select-actor-type">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="stakeholder">Stakeholder</SelectItem>
                  <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="effective-source-filter">
                {resolve('settings.negotiation_audit.filters.effective_source') || 'Policy Source'}
              </Label>
              <Select 
                value={effectiveSourceFilter} 
                onValueChange={setEffectiveSourceFilter}
              >
                <SelectTrigger id="effective-source-filter" data-testid="select-effective-source">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                  <SelectItem value="tenant_override">Tenant Override</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="run-id-filter">
                {resolve('settings.negotiation_audit.filters.run_id') || 'Run ID'}
              </Label>
              <Input
                id="run-id-filter"
                placeholder="Enter run ID..."
                value={runIdFilter}
                onChange={(e) => setRunIdFilter(e.target.value)}
                data-testid="input-run-id"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="policy-hash-filter">
                {resolve('settings.negotiation_audit.filters.policy_hash') || 'Policy Hash'}
              </Label>
              <Input
                id="policy-hash-filter"
                placeholder="Enter hash..."
                value={policyHashFilter}
                onChange={(e) => setPolicyHashFilter(e.target.value)}
                data-testid="input-policy-hash"
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} data-testid="button-search">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {resolve('settings.negotiation_audit.table.title') || 'Audit Events'}
            {data && (
              <Badge variant="secondary" className="ml-2">
                {data.total} total
              </Badge>
            )}
          </CardTitle>
          {data && (
            <CardDescription>
              Showing {data.items.length} of {data.total} events
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive" data-testid="text-error">
              Failed to load audit events
            </div>
          ) : data?.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">
              {resolve('settings.negotiation_audit.empty.message') || 'No audit events found'}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {resolve('settings.negotiation_audit.table.created_at') || 'Time'}
                      </TableHead>
                      <TableHead>
                        {resolve('settings.negotiation_audit.table.run_id') || 'Run'}
                      </TableHead>
                      <TableHead>
                        {resolve('settings.negotiation_audit.table.actor_type') || 'Actor'}
                      </TableHead>
                      <TableHead>
                        {resolve('settings.negotiation_audit.table.effective_source') || 'Source'}
                      </TableHead>
                      <TableHead>
                        {resolve('settings.negotiation_audit.table.policy_updated') || 'Policy Updated'}
                      </TableHead>
                      <TableHead>
                        {resolve('settings.negotiation_audit.table.policy_hash') || 'Hash'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((event) => (
                      <TableRow key={event.id} data-testid={`row-audit-${event.id}`}>
                        <TableCell className="text-sm">
                          <span title={new Date(event.created_at).toLocaleString()}>
                            {formatRelativeTime(event.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/app/provider/runs/${event.run_id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs font-mono"
                                data-testid={`link-run-${event.run_id}`}
                              >
                                {event.run_id.substring(0, 8)}…
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleCopy(event.run_id, 'Run ID')}
                              data-testid={`button-copy-run-${event.run_id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {event.actor_type.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={event.effective_source === 'platform' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {event.effective_source === 'platform' ? 'Platform' : 'Tenant'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(event.effective_policy_updated_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {maskHash(event.effective_policy_hash)}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleCopy(event.effective_policy_hash, 'Policy hash')}
                              data-testid={`button-copy-hash-${event.id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {data?.next_offset !== null && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    data-testid="button-load-more"
                  >
                    {resolve('settings.negotiation_audit.load_more') || 'Load More'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

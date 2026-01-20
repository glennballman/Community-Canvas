/**
 * Portal QA Launchpad
 * Route: /app/admin/portals/:portalId/qa
 * 
 * Quick-access page for founders to test all public portal workflows
 * without hunting for dynamic keys (campaign keys, trip access codes, pay tokens).
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, ExternalLink, Copy, Globe, Briefcase, Users, 
  FileText, Calendar, CheckCircle, Clock, AlertCircle,
  Rocket, Link2, Plus, Loader2, Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface QaData {
  ok: boolean;
  portal: {
    id: string;
    slug: string;
    name: string;
  };
  campaigns: Array<{
    key: string;
    title: string;
    status: string;
  }>;
  campaignsTotal: number;
  trips: Array<{
    id: string;
    accessCode: string;
    status: string;
    groupName: string | null;
    startDate: string | null;
  }>;
  tripsTotal: number;
  proposals: Array<{
    id: string;
    title: string;
    status: string;
    payToken: string | null;
  }>;
  proposalsTotal: number;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
    active: { variant: 'default', icon: CheckCircle },
    confirmed: { variant: 'default', icon: CheckCircle },
    pending: { variant: 'secondary', icon: Clock },
    draft: { variant: 'outline', icon: Clock },
    cancelled: { variant: 'destructive', icon: AlertCircle },
  };
  
  const config = variants[status] || { variant: 'outline' as const, icon: Clock };
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function LinkRow({ 
  href, 
  label, 
  sublabel,
  status,
  icon: Icon = ExternalLink 
}: { 
  href: string; 
  label: string; 
  sublabel?: string;
  status?: string | null;
  icon?: typeof ExternalLink;
}) {
  const { toast } = useToast();
  const fullUrl = window.location.origin + href;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast({ title: 'Copied to clipboard', description: href });
  };
  
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate" data-testid={`link-row-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{label}</span>
            {status && <StatusBadge status={status} />}
          </div>
          {sublabel && (
            <span className="text-xs text-muted-foreground truncate block">{sublabel}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleCopy}
          data-testid={`button-copy-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          asChild
          data-testid={`button-open-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

interface FixtureResult {
  ok: boolean;
  created: boolean;
  url?: string;
  campaignKey?: string;
  postingId?: string;
  jobId?: string;
  proposalId?: string;
  payToken?: string;
  viewUrl?: string;
  payUrl?: string;
  tripId?: string;
  accessCode?: string;
}

function FixtureButton({
  label,
  icon: Icon,
  onSeed,
  isPending,
  result,
}: {
  label: string;
  icon: typeof Briefcase;
  onSeed: () => void;
  isPending: boolean;
  result: FixtureResult | null;
}) {
  const { toast } = useToast();
  
  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-md" data-testid={`fixture-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{label}</div>
          {result && (
            <div className="text-xs text-muted-foreground mt-1">
              {result.created ? (
                <Badge variant="default" className="mr-2">Created</Badge>
              ) : (
                <Badge variant="secondary" className="mr-2">Exists</Badge>
              )}
              {result.url && <span className="truncate">{result.url}</span>}
              {result.viewUrl && <span className="truncate">{result.viewUrl}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {result?.url && (
          <>
            <Button size="icon" variant="ghost" onClick={() => handleCopy(result.url!)} data-testid={`button-copy-fixture-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" asChild data-testid={`button-open-fixture-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </>
        )}
        {result?.viewUrl && (
          <>
            <Button size="icon" variant="ghost" onClick={() => handleCopy(result.viewUrl!)} data-testid={`button-copy-fixture-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" asChild data-testid={`button-open-fixture-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              <a href={result.viewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </>
        )}
        <Button 
          size="sm" 
          onClick={onSeed} 
          disabled={isPending}
          data-testid={`button-seed-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="ml-1">{result ? 'Refresh' : 'Create'}</span>
        </Button>
      </div>
    </div>
  );
}

export default function PortalQaLaunchpadPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fixture results state
  const [campaignResult, setCampaignResult] = useState<FixtureResult | null>(null);
  const [jobResult, setJobResult] = useState<FixtureResult | null>(null);
  const [proposalResult, setProposalResult] = useState<FixtureResult | null>(null);
  const [tripResult, setTripResult] = useState<FixtureResult | null>(null);
  
  const { data, isLoading, error } = useQuery<QaData>({
    queryKey: ['/api/p2/admin/portals', portalId, 'qa'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/admin/portals/${portalId}/qa`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load QA data');
      return res.json();
    },
    enabled: !!portalId,
  });
  
  // Seed mutations
  const seedCampaign = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-campaign`);
      return res.json();
    },
    onSuccess: (data: FixtureResult) => {
      setCampaignResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      toast({ title: data.created ? 'Test campaign created' : 'Test campaign exists' });
    },
    onError: () => toast({ title: 'Failed to create campaign', variant: 'destructive' }),
  });
  
  const seedJob = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-job`);
      return res.json();
    },
    onSuccess: (data: FixtureResult) => {
      setJobResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      toast({ title: data.created ? 'Test job created' : 'Test job exists' });
    },
    onError: () => toast({ title: 'Failed to create job', variant: 'destructive' }),
  });
  
  const seedProposal = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-proposal`);
      return res.json();
    },
    onSuccess: (data: FixtureResult) => {
      setProposalResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      toast({ title: data.created ? 'Test proposal created' : 'Test proposal exists' });
    },
    onError: () => toast({ title: 'Failed to create proposal', variant: 'destructive' }),
  });
  
  const seedTrip = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-trip`);
      return res.json();
    },
    onSuccess: (data: FixtureResult) => {
      setTripResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      toast({ title: data.created ? 'Test trip created' : 'Test trip exists' });
    },
    onError: () => toast({ title: 'Failed to create trip', variant: 'destructive' }),
  });
  
  const portal = data?.portal;
  const slug = portal?.slug || '';
  
  const openAllCore = () => {
    if (!slug) return;
    const urls = [
      `/p/${slug}`,
      `/p/${slug}/onboarding`,
      `/p/${slug}/reserve`,
      `/b/${slug}/jobs`,
    ];
    urls.forEach(url => window.open(url, '_blank'));
    toast({ title: 'Opened 4 core links in new tabs' });
  };
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="page-portal-qa-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  
  if (error || !data?.ok) {
    return (
      <div className="p-6" data-testid="page-portal-qa-error">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load QA data</p>
            <p className="text-muted-foreground">{(error as Error)?.message}</p>
            <Button asChild className="mt-4">
              <Link to="/app/admin/portals">Back to Portals</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6" data-testid="page-portal-qa-launchpad">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/admin/portals" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              QA Launchpad
            </h1>
            <p className="text-muted-foreground">
              {portal?.name} <span className="text-xs">({slug})</span>
            </p>
          </div>
        </div>
        
        <Button onClick={openAllCore} data-testid="button-open-all-core">
          <Link2 className="h-4 w-4 mr-2" />
          Open All Core Links
        </Button>
      </div>
      
      <Card data-testid="card-fixtures">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Create Test Fixtures
          </CardTitle>
          <CardDescription>
            Seed test data for QA workflows (idempotent - reuses existing [TEST] items)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FixtureButton
            label="Test Campaign"
            icon={Briefcase}
            onSeed={() => seedCampaign.mutate()}
            isPending={seedCampaign.isPending}
            result={campaignResult}
          />
          <FixtureButton
            label="Test Job Posting"
            icon={Users}
            onSeed={() => seedJob.mutate()}
            isPending={seedJob.isPending}
            result={jobResult}
          />
          <FixtureButton
            label="Test Proposal"
            icon={FileText}
            onSeed={() => seedProposal.mutate()}
            isPending={seedProposal.isPending}
            result={proposalResult}
          />
          <FixtureButton
            label="Test Trip"
            icon={Calendar}
            onSeed={() => seedTrip.mutate()}
            isPending={seedTrip.isPending}
            result={tripResult}
          />
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-public-links">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Public Workflow Links
            </CardTitle>
            <CardDescription>
              Core public pages for this portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <LinkRow 
              href={`/p/${slug}`} 
              label="Portal Home" 
              icon={Globe}
            />
            <LinkRow 
              href={`/p/${slug}/onboarding`} 
              label="Portal Onboarding" 
              icon={Users}
            />
            <LinkRow 
              href={`/p/${slug}/reserve`} 
              label="Portal Reserve" 
              icon={Calendar}
            />
            <LinkRow 
              href={`/b/${slug}/jobs`} 
              label="Jobs List" 
              icon={Briefcase}
            />
          </CardContent>
        </Card>
        
        <Card data-testid="card-campaigns">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Campaign Apply Links
            </CardTitle>
            <CardDescription>
              {data.campaigns.length} campaign{data.campaigns.length !== 1 ? 's' : ''} enabled
              {data.campaignsTotal > data.campaigns.length && (
                <span className="text-muted-foreground ml-1">(showing {data.campaigns.length} of {data.campaignsTotal})</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.campaigns.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No campaigns configured
              </p>
            ) : (
              data.campaigns.map(c => (
                <LinkRow 
                  key={c.key}
                  href={`/b/${slug}/apply/${c.key}`}
                  label={c.title}
                  sublabel={c.key}
                  status={c.status}
                  icon={Briefcase}
                />
              ))
            )}
          </CardContent>
        </Card>
        
        <Card data-testid="card-trips">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Trip Links
            </CardTitle>
            <CardDescription>
              {data.trips.length} trip{data.trips.length !== 1 ? 's' : ''} with access codes
              {data.tripsTotal > data.trips.length && (
                <span className="text-muted-foreground ml-1">(showing {data.trips.length} of {data.tripsTotal})</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {data.trips.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No trips with access codes
              </p>
            ) : (
              data.trips.map(t => (
                <LinkRow 
                  key={t.id}
                  href={`/trip/${t.accessCode}`}
                  label={t.groupName || 'Unnamed Trip'}
                  sublabel={t.accessCode}
                  status={t.status}
                  icon={Calendar}
                />
              ))
            )}
          </CardContent>
        </Card>
        
        <Card data-testid="card-proposals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Proposal Links
            </CardTitle>
            <CardDescription>
              {data.proposals.length} proposal{data.proposals.length !== 1 ? 's' : ''}
              {data.proposalsTotal > data.proposals.length && (
                <span className="text-muted-foreground ml-1">(showing {data.proposals.length} of {data.proposalsTotal})</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {data.proposals.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No proposals found
              </p>
            ) : (
              data.proposals.map(p => (
                <div key={p.id} className="space-y-1 py-1 border-b last:border-0">
                  <LinkRow 
                    href={`/p/proposal/${p.id}`}
                    label={p.title}
                    sublabel="View proposal"
                    status={p.status}
                    icon={FileText}
                  />
                  {p.payToken && (
                    <LinkRow 
                      href={`/p/proposal/${p.id}/pay/${p.payToken}`}
                      label="Pay Link"
                      sublabel={p.payToken}
                      icon={FileText}
                    />
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

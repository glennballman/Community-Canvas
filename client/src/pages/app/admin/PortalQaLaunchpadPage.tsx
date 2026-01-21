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
  Rocket, Link2, Plus, Loader2, Wrench, Eye, ClipboardList, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  workRequests: Array<{
    id: string;
    title: string | null;
    status: string;
    createdAt: string;
    propertyId: string | null;
    assignedContractorPersonId: string | null;
    zoneId: string | null;
    zoneName: string | null;
    zoneKey: string | null;
  }>;
  workRequestsTotal: number;
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
  workRequest?: {
    id: string;
    title: string;
    status: string;
    propertyId?: string;
    assignedContractorPersonId?: string | null;
  };
}

interface DisclosureResult {
  ok: boolean;
  workRequestId: string;
  contractorPersonId: string;
  counts: {
    areas: number;
    media: number;
    subsystems: number;
    resources: number;
  };
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
              {result.payUrl && <span className="truncate ml-2">| Pay: {result.payUrl}</span>}
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
            <Button size="icon" variant="ghost" onClick={() => handleCopy(result.viewUrl!)} title="Copy view URL" data-testid={`button-copy-fixture-${label.toLowerCase().replace(/\s+/g, '-')}-view`}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" asChild title="Open view" data-testid={`button-open-fixture-${label.toLowerCase().replace(/\s+/g, '-')}-view`}>
              <a href={result.viewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </>
        )}
        {result?.payUrl && (
          <>
            <Button size="icon" variant="ghost" onClick={() => handleCopy(result.payUrl!)} title="Copy pay URL" data-testid={`button-copy-fixture-${label.toLowerCase().replace(/\s+/g, '-')}-pay`}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" asChild title="Open pay page" data-testid={`button-open-fixture-${label.toLowerCase().replace(/\s+/g, '-')}-pay`}>
              <a href={result.payUrl} target="_blank" rel="noopener noreferrer">
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

type SeedStep = 'idle' | 'campaign' | 'job' | 'proposal' | 'trip' | 'done';

function WorkRequestFixtureButton({
  onSeed,
  isPending,
  result,
  onSeedDisclosures,
  disclosurePending,
  disclosureResult,
}: {
  onSeed: () => void;
  isPending: boolean;
  result: FixtureResult | null;
  onSeedDisclosures: () => void;
  disclosurePending: boolean;
  disclosureResult: DisclosureResult | null;
}) {
  const { toast } = useToast();
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const handlePreview = async () => {
    if (!result?.workRequest?.id) return;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/p2/app/work-disclosures/preview-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workRequestId: result.workRequest.id }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create preview token');
      }
      
      const data = await res.json();
      const previewUrl = `/preview/contractor/work-request/${result.workRequest.id}?previewToken=${encodeURIComponent(data.token)}`;
      window.open(previewUrl, '_blank');
      toast({ title: 'Preview opened', description: 'Token expires in 15 minutes.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const totalDisclosed = disclosureResult 
    ? disclosureResult.counts.areas + disclosureResult.counts.media + 
      disclosureResult.counts.subsystems + disclosureResult.counts.resources
    : 0;

  return (
    <div className="space-y-2" data-testid="fixture-test-work-request">
      <div className="flex items-center justify-between gap-3 p-3 border rounded-md">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Test Work Request</div>
            {result && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                {result.created ? (
                  <Badge variant="default">Created</Badge>
                ) : (
                  <Badge variant="secondary">Exists</Badge>
                )}
                {result.workRequest?.title && (
                  <span className="truncate">{result.workRequest.title}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {result?.workRequest?.id && (
            <>
              <Button size="sm" variant="outline" asChild data-testid="button-open-work-request-owner">
                <Link to={`/app/intake/work-requests/${result.workRequest.id}`}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Link>
              </Button>
              {result.workRequest.assignedContractorPersonId && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handlePreview}
                  disabled={previewLoading}
                  data-testid="button-preview-work-request-contractor"
                >
                  {previewLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3 mr-1" />
                  )}
                  Preview
                </Button>
              )}
            </>
          )}
          <Button 
            size="sm" 
            onClick={onSeed} 
            disabled={isPending}
            data-testid="button-seed-test-work-request"
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
      
      {/* Disclosure Pack sub-row */}
      {result?.workRequest?.id && (
        <div className="flex items-center justify-between gap-3 p-3 border rounded-md ml-6 bg-muted/30" data-testid="fixture-disclosure-pack">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Share2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Disclosure Pack</div>
              {disclosureResult && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{totalDisclosed} items</Badge>
                  <span>
                    {disclosureResult.counts.areas} areas, {disclosureResult.counts.media} media, 
                    {disclosureResult.counts.subsystems} subsystems, {disclosureResult.counts.resources} resources
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            {disclosureResult && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={handlePreview}
                disabled={previewLoading}
                data-testid="button-preview-disclosure-pack"
              >
                {previewLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Eye className="h-3 w-3 mr-1" />
                )}
                Preview
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={onSeedDisclosures} 
              disabled={disclosurePending}
              data-testid="button-seed-disclosure-pack"
            >
              {disclosurePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-1" />
              )}
              {disclosureResult ? 'Refresh' : 'Seed'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface WorkRequest {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  propertyId: string | null;
  assignedContractorPersonId: string | null;
  zoneId: string | null;
  zoneName: string | null;
  zoneKey: string | null;
}

function WorkRequestsCard({ 
  workRequests, 
  workRequestsTotal 
}: { 
  workRequests: WorkRequest[];
  workRequestsTotal: number;
}) {
  const { toast } = useToast();
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  
  const handlePreviewContractor = async (workRequestId: string) => {
    setPreviewLoading(workRequestId);
    try {
      const res = await fetch('/api/p2/app/work-disclosures/preview-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workRequestId }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create preview token');
      }
      
      const data = await res.json();
      const previewUrl = `/preview/contractor/work-request/${workRequestId}?previewToken=${encodeURIComponent(data.token)}`;
      window.open(previewUrl, '_blank');
      toast({ title: 'Preview opened', description: 'Token expires in 15 minutes.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to preview', variant: 'destructive' });
    } finally {
      setPreviewLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };
  
  return (
    <Card data-testid="card-work-requests">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Work Requests
        </CardTitle>
        <CardDescription>
          {workRequests.length} work request{workRequests.length !== 1 ? 's' : ''}
          {workRequestsTotal > workRequests.length && (
            <span className="text-muted-foreground ml-1">(showing {workRequests.length} of {workRequestsTotal})</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {workRequests.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center" data-testid="text-no-work-requests">
            No work requests found
          </p>
        ) : (
          workRequests.map(wr => (
            <div 
              key={wr.id} 
              className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate border"
              data-testid={`item-work-request-${wr.id.slice(0, 8)}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate" data-testid={`text-work-request-title-${wr.id.slice(0, 8)}`}>
                      {wr.title || `Work Request ${wr.id.slice(0, 8).toUpperCase()}`}
                    </span>
                    <StatusBadge status={wr.status} />
                    {wr.zoneName ? (
                      <Badge variant="outline" className="text-xs" data-testid={`badge-zone-${wr.id.slice(0, 8)}`}>
                        {wr.zoneName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-unzoned-${wr.id.slice(0, 8)}`}>
                        Unzoned
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground block">
                    Created: {formatDate(wr.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button 
                  size="sm" 
                  variant="outline"
                  asChild
                  data-testid={`button-open-owner-${wr.id.slice(0, 8)}`}
                >
                  <Link to={`/app/intake/work-requests/${wr.id}`}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </Link>
                </Button>
                {wr.assignedContractorPersonId && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handlePreviewContractor(wr.id)}
                    disabled={previewLoading === wr.id}
                    data-testid={`button-preview-contractor-${wr.id.slice(0, 8)}`}
                  >
                    {previewLoading === wr.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    Preview
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
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
  const [workRequestResult, setWorkRequestResult] = useState<FixtureResult | null>(null);
  const [disclosureResult, setDisclosureResult] = useState<DisclosureResult | null>(null);
  
  // Seed All state
  const [seedAllStep, setSeedAllStep] = useState<SeedStep>('idle');
  const [isSeedingAll, setIsSeedingAll] = useState(false);
  
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
  
  // QA Status query
  const { data: statusData } = useQuery<{ ok: boolean; status: string }>({
    queryKey: ['/api/p2/admin/portals', portalId, 'qa', 'status'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/admin/portals/${portalId}/qa/status`, {
        credentials: 'include',
      });
      if (!res.ok) return { ok: true, status: 'incomplete' };
      return res.json();
    },
    enabled: !!portalId,
  });
  
  const qaStatus = statusData?.status || 'incomplete';
  
  // QA Status mutation
  const updateQaStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/status`, { status });
      return res.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa', 'status'] });
      toast({ title: `QA status updated to ${status}` });
    },
    onError: () => toast({ title: 'Failed to update QA status', variant: 'destructive' }),
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
  
  const seedWorkRequest = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-work-request`);
      return res.json();
    },
    onSuccess: (data: FixtureResult) => {
      setWorkRequestResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      toast({ title: data.created ? 'Test work request created' : 'Test work request exists' });
    },
    onError: () => toast({ title: 'Failed to create work request', variant: 'destructive' }),
  });

  const seedDisclosures = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-work-request-disclosures`);
      return res.json();
    },
    onSuccess: (data: DisclosureResult) => {
      setDisclosureResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      const total = data.counts.areas + data.counts.media + data.counts.subsystems + data.counts.resources;
      toast({ title: `Disclosure pack seeded: ${total} items` });
    },
    onError: (error: any) => toast({ 
      title: 'Failed to seed disclosures', 
      description: error?.message || 'Unknown error',
      variant: 'destructive' 
    }),
  });
  
  const portal = data?.portal;
  const slug = portal?.slug || '';
  
  // Seed All Fixtures - runs sequentially with progress tracking
  const seedAllFixtures = async (andOpen = false) => {
    if (isSeedingAll || !portalId) return;
    
    setIsSeedingAll(true);
    const results: { campaign?: FixtureResult; job?: FixtureResult; proposal?: FixtureResult; trip?: FixtureResult } = {};
    
    try {
      // Step 1: Campaign
      setSeedAllStep('campaign');
      const campaignRes = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-campaign`);
      results.campaign = await campaignRes.json();
      setCampaignResult(results.campaign!);
      
      // Step 2: Job
      setSeedAllStep('job');
      const jobRes = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-job`);
      results.job = await jobRes.json();
      setJobResult(results.job!);
      
      // Step 3: Proposal
      setSeedAllStep('proposal');
      const proposalRes = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-proposal`);
      results.proposal = await proposalRes.json();
      setProposalResult(results.proposal!);
      
      // Step 4: Trip
      setSeedAllStep('trip');
      const tripRes = await apiRequest('POST', `/api/p2/admin/portals/${portalId}/qa/seed-trip`);
      results.trip = await tripRes.json();
      setTripResult(results.trip!);
      
      // Complete
      setSeedAllStep('done');
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId, 'qa'] });
      
      const created = [results.campaign, results.job, results.proposal, results.trip].filter(r => r?.created).length;
      toast({ 
        title: 'All fixtures seeded',
        description: `${created} created, ${4 - created} already existed`,
      });
      
      // Open tabs if requested
      if (andOpen && slug) {
        const urls: string[] = [
          `/p/${slug}`,
          `/p/${slug}/reserve`,
          `/b/${slug}/jobs`,
        ];
        
        // Add fixture-specific links (max 8 total)
        if (results.campaign?.url) urls.push(results.campaign.url);
        if (results.trip?.url) urls.push(results.trip.url);
        if (results.proposal?.viewUrl) urls.push(results.proposal.viewUrl);
        if (results.proposal?.payUrl) urls.push(results.proposal.payUrl);
        if (results.job?.url) urls.push(results.job.url);
        
        // Cap at 8 tabs
        urls.slice(0, 8).forEach(url => window.open(url, '_blank'));
        toast({ title: `Opened ${Math.min(urls.length, 8)} tabs` });
      }
    } catch (error) {
      toast({ title: 'Failed to seed fixtures', variant: 'destructive' });
    } finally {
      setIsSeedingAll(false);
      setTimeout(() => setSeedAllStep('idle'), 2000);
    }
  };
  
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
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">QA Status:</span>
            <Select 
              value={qaStatus} 
              onValueChange={(v) => updateQaStatus.mutate(v)}
              disabled={updateQaStatus.isPending}
            >
              <SelectTrigger className="w-32" data-testid="select-qa-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incomplete">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Incomplete
                  </span>
                </SelectItem>
                <SelectItem value="in_progress">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3" />
                    In Progress
                  </span>
                </SelectItem>
                <SelectItem value="complete">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    Complete
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={openAllCore} data-testid="button-open-all-core">
            <Link2 className="h-4 w-4 mr-2" />
            Open All Core Links
          </Button>
        </div>
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
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-md">
            <Button 
              onClick={() => seedAllFixtures(false)}
              disabled={isSeedingAll}
              data-testid="button-seed-all"
            >
              {isSeedingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {seedAllStep === 'campaign' && 'Seeding Campaign...'}
                  {seedAllStep === 'job' && 'Seeding Job...'}
                  {seedAllStep === 'proposal' && 'Seeding Proposal...'}
                  {seedAllStep === 'trip' && 'Seeding Trip...'}
                  {seedAllStep === 'done' && 'Complete!'}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Seed All Fixtures
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={() => seedAllFixtures(true)}
              disabled={isSeedingAll}
              data-testid="button-seed-all-open"
            >
              {isSeedingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Working...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Seed All + Open Core
                </>
              )}
            </Button>
            {seedAllStep !== 'idle' && seedAllStep !== 'done' && (
              <Badge variant="secondary" className="ml-auto">
                Step: {seedAllStep}
              </Badge>
            )}
            {seedAllStep === 'done' && (
              <Badge variant="default" className="ml-auto">
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
          
          <div className="space-y-3">
            <FixtureButton
              label="Test Campaign"
              icon={Briefcase}
              onSeed={() => seedCampaign.mutate()}
              isPending={seedCampaign.isPending || (isSeedingAll && seedAllStep === 'campaign')}
              result={campaignResult}
            />
            <FixtureButton
              label="Test Job Posting"
              icon={Users}
              onSeed={() => seedJob.mutate()}
              isPending={seedJob.isPending || (isSeedingAll && seedAllStep === 'job')}
              result={jobResult}
            />
            <FixtureButton
              label="Test Proposal"
              icon={FileText}
              onSeed={() => seedProposal.mutate()}
              isPending={seedProposal.isPending || (isSeedingAll && seedAllStep === 'proposal')}
              result={proposalResult}
            />
            <FixtureButton
              label="Test Trip"
              icon={Calendar}
              onSeed={() => seedTrip.mutate()}
              isPending={seedTrip.isPending || (isSeedingAll && seedAllStep === 'trip')}
              result={tripResult}
            />
            <WorkRequestFixtureButton
              onSeed={() => seedWorkRequest.mutate()}
              isPending={seedWorkRequest.isPending}
              result={workRequestResult}
              onSeedDisclosures={() => seedDisclosures.mutate()}
              disclosurePending={seedDisclosures.isPending}
              disclosureResult={disclosureResult}
            />
          </div>
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
        
        <WorkRequestsCard 
          workRequests={data.workRequests || []} 
          workRequestsTotal={data.workRequestsTotal || 0} 
        />
      </div>
    </div>
  );
}

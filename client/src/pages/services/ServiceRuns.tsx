import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Gavel, FileText, MapPin, Calendar, Truck } from 'lucide-react';

interface ServiceRun {
  id: string;
  title: string;
  slug: string;
  description: string;
  communityName: string;
  runTypeName: string;
  bundleName: string;
  initiatorType: string;
  targetStartDate: string;
  targetEndDate: string;
  minSlots: number;
  maxSlots: number;
  currentSlots: number;
  status: string;
  biddingOpensAt: string | null;
  biddingClosesAt: string | null;
  estimatedMobilizationCost: number | null;
  totalEstimatedRevenue: number;
  createdAt: string;
}

interface SharedRun {
  id: string;
  trade_category: string;
  service_description: string;
  contractor_name: string | null;
  status: string;
  window_start: string | null;
  window_end: string | null;
  current_member_count: number;
  mobilization_fee_total: number | null;
  pricing_model: string;
  mobilization_share: number;
  threshold_met: boolean;
}

interface WorkRequest {
  id: string;
  work_request_ref: string;
  title: string;
  description: string;
  work_category: string;
  site_address: string;
  community_name: string | null;
  estimated_value_low: number;
  estimated_value_high: number;
  bid_deadline: string | null;
  expected_start_date: string | null;
  status: string;
  bid_count: number;
}

type MergedRun = {
  id: string;
  type: 'bidding' | 'shared';
  title: string;
  description: string;
  community: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  capacity: string;
  slug: string;
  rawData: ServiceRun | SharedRun;
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  collecting: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  bidding: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  bid_review: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/50',
  scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  in_progress: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/50',
  forming: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  contractor_invited: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  contractor_claimed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  collecting: 'Collecting Signups',
  bidding: 'Open for Bidding',
  bid_review: 'Reviewing Bids',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  forming: 'Forming',
  contractor_invited: 'Contractor Invited',
  contractor_claimed: 'Contractor Claimed'
};

export default function ServiceRuns() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [runs, setRuns] = useState<ServiceRun[]>([]);
  const [sharedRuns, setSharedRuns] = useState<SharedRun[]>([]);
  const [workRequests, setWorkRequests] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'service-runs' | 'work-requests'>('service-runs');

  useEffect(() => {
    loadAllData();
  }, [token]);

  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const [biddingRes, sharedRes, workRequestsRes] = await Promise.all([
        fetch('/api/service-runs/runs', { headers }),
        fetch('/api/shared-runs', { headers }),
        fetch('/api/work-requests?limit=20', { headers })
      ]);
      
      const biddingData = await biddingRes.json().catch(() => ({}));
      const sharedData = await sharedRes.json().catch(() => ({}));
      const workRequestsData = await workRequestsRes.json().catch(() => ({}));
      
      setRuns(Array.isArray(biddingData?.runs) ? biddingData.runs : []);
      setSharedRuns(Array.isArray(sharedData?.shared_runs) ? sharedData.shared_runs : []);
      setWorkRequests(Array.isArray(workRequestsData?.workRequests) ? workRequestsData.workRequests : []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Unable to load service runs. Please try again.');
      setRuns([]);
      setSharedRuns([]);
      setWorkRequests([]);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  const mergedRuns: MergedRun[] = [
    ...runs.map((run): MergedRun => ({
      id: run.id,
      type: 'bidding',
      title: run.title,
      description: run.description,
      community: run.communityName || 'TBD',
      status: run.status,
      startDate: run.targetStartDate,
      endDate: run.targetEndDate,
      capacity: `${run.currentSlots}/${run.maxSlots} slots`,
      slug: run.slug,
      rawData: run
    })),
    ...sharedRuns.map((run): MergedRun => ({
      id: run.id,
      type: 'shared',
      title: run.trade_category,
      description: run.service_description,
      community: 'TBD',
      status: run.status,
      startDate: run.window_start,
      endDate: run.window_end,
      capacity: `${run.current_member_count || 0} members`,
      slug: `shared-${run.id}`,
      rawData: run
    }))
  ].sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return dateA - dateB;
  });

  const stats = {
    totalRuns: mergedRuns.length,
    sharedRuns: sharedRuns.length,
    biddingRuns: runs.length,
    workRequests: workRequests.length
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-96 bg-muted rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={loadAllData}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
            data-testid="button-retry"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Upcoming Service Runs</h1>
          <p className="text-muted-foreground">Shared mobilizations that bring contractors, equipment, and essential services into remote communities.</p>
        </div>
        <button
          onClick={() => navigate('/app/service-runs/new')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
          data-testid="button-create-run"
        >
          Create Run
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold" data-testid="text-total-runs">{stats.totalRuns}</div>
          <div className="text-sm text-muted-foreground">Total Runs</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-blue-400">{stats.sharedRuns}</div>
          <div className="text-sm text-muted-foreground">Shared Runs</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-purple-400">{stats.biddingRuns}</div>
          <div className="text-sm text-muted-foreground">Bidding Runs</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-amber-400">{stats.workRequests}</div>
          <div className="text-sm text-muted-foreground">Work Requests</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'service-runs' | 'work-requests')} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="service-runs" className="flex items-center gap-2" data-testid="tab-service-runs">
            <Truck className="w-4 h-4" />
            Service Runs ({stats.totalRuns})
          </TabsTrigger>
          <TabsTrigger value="work-requests" className="flex items-center gap-2" data-testid="tab-work-requests">
            <FileText className="w-4 h-4" />
            Work Requests ({stats.workRequests})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="service-runs" className="space-y-4">
          {mergedRuns.length === 0 ? (
            <div className="bg-card rounded-lg p-12 text-center border">
              <Truck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nothing scheduled yet.</h3>
              <p className="text-muted-foreground mb-4">When the next run is posted, it'll show up here. Check back soon.</p>
              <button
                onClick={() => navigate('/app/service-runs/new')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
              >
                Create Run
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {mergedRuns.map(run => (
                <div
                  key={`${run.type}-${run.id}`}
                  onClick={() => navigate(`/app/service-runs/${run.slug}`)}
                  className="bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border"
                  data-testid={`card-run-${run.type}-${run.id}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="font-semibold text-lg">{run.title}</h3>
                        <Badge variant="outline" className={run.type === 'shared' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-purple-500/20 text-purple-400 border-purple-500/50'}>
                          {run.type === 'shared' ? 'Shared Run' : 'Bidding Run'}
                        </Badge>
                        <Badge variant="outline" className={STATUS_COLORS[run.status]}>
                          {STATUS_LABELS[run.status] || run.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{run.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        {run.capacity}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {run.community}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(run.startDate)}
                      {run.endDate && run.endDate !== run.startDate ? ` - ${formatDate(run.endDate)}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="work-requests" className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-400">
              Work Requests are individual procurement requests from property owners. Filters apply to Work Requests.
            </p>
          </div>

          {workRequests.length === 0 ? (
            <div className="bg-card rounded-lg p-12 text-center border">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Work Requests</h3>
              <p className="text-muted-foreground">No open work requests at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workRequests.map(wr => (
                <div
                  key={wr.id}
                  onClick={() => navigate(`/app/work-requests/${wr.id}`)}
                  className="bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border"
                  data-testid={`card-work-request-${wr.id}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{wr.work_request_ref}</span>
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/50">
                          {wr.work_category}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg">{wr.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{wr.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-muted-foreground">
                        {wr.bid_count} bids
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {wr.site_address || wr.community_name || 'Location TBD'}
                    </span>
                    {wr.expected_start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Start: {formatDate(wr.expected_start_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

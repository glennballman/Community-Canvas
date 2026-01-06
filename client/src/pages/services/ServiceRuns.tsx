import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Gavel } from 'lucide-react';

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

interface CoopRun {
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
  const [coopRuns, setCoopRuns] = useState<CoopRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'coop' | 'bidding'>('coop');

  useEffect(() => {
    loadAllRuns();
  }, [statusFilter, token]);

  async function loadAllRuns() {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const [biddingRes, coopRes] = await Promise.all([
        fetch('/api/service-runs/runs' + (statusFilter ? `?status=${statusFilter}` : ''), { headers }),
        fetch('/api/coop-runs', { headers })
      ]);
      
      const biddingData = await biddingRes.json();
      const coopData = await coopRes.json();
      
      if (biddingData.success) {
        setRuns(biddingData.runs);
      }
      if (coopData.coop_runs) {
        setCoopRuns(coopData.coop_runs);
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function getSlotProgress(current: number, min: number, max: number) {
    const percentage = (current / max) * 100;
    const atMinimum = current >= min;
    
    return (
      <div className="w-full relative">
        <div className="flex justify-between text-xs mb-1">
          <span className={atMinimum ? 'text-green-400' : 'text-yellow-400'}>
            {current} / {max} slots
          </span>
          <span className="text-muted-foreground">min: {min}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden relative">
          <div 
            className={`h-full rounded-full transition-all ${atMinimum ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
          <div 
            className="h-full w-0.5 bg-white/50 absolute top-0"
            style={{ left: `${(min / max) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  const stats = {
    total: runs.length + coopRuns.length,
    coopForming: coopRuns.filter(r => r.status === 'forming').length,
    collecting: runs.filter(r => r.status === 'collecting').length,
    bidding: runs.filter(r => r.status === 'bidding' || r.status === 'bid_review').length,
    active: runs.filter(r => ['confirmed', 'scheduled', 'in_progress'].includes(r.status)).length,
    totalRevenue: runs.reduce((sum, r) => sum + r.totalEstimatedRevenue, 0),
    totalSlots: runs.reduce((sum, r) => sum + r.currentSlots, 0) + coopRuns.reduce((sum, r) => sum + (r.current_member_count || 0), 0)
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading service runs...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Service Runs</h1>
          <p className="text-muted-foreground">Coordinate service runs with neighbors or contractors</p>
        </div>
        <button
          onClick={() => navigate('/app/service-runs/new')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
          data-testid="button-create-run"
        >
          Create Run
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold" data-testid="text-total-runs">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Runs</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-blue-400">{coopRuns.length}</div>
          <div className="text-sm text-muted-foreground">Coop Runs</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-purple-400">{runs.length}</div>
          <div className="text-sm text-muted-foreground">Bidding Runs</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-green-400">{stats.active}</div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats.totalSlots}</div>
          <div className="text-sm text-muted-foreground">Total Participants</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-green-400">
            ${stats.totalRevenue.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Est. Revenue</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'coop' | 'bidding')} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="coop" className="flex items-center gap-2" data-testid="tab-coop-runs">
            <Users className="w-4 h-4" />
            Cooperative ({coopRuns.length})
          </TabsTrigger>
          <TabsTrigger value="bidding" className="flex items-center gap-2" data-testid="tab-bidding-runs">
            <Gavel className="w-4 h-4" />
            Bidding ({runs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coop" className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-400">
              Cooperative runs let neighbors bundle together and split mobilization costs. This is NOT competitive bidding - it&apos;s coordinated service sharing.
            </p>
          </div>
          
          {coopRuns.length === 0 ? (
            <div className="bg-card rounded-lg p-12 text-center border">
              <h3 className="text-lg font-medium mb-2">No Cooperative Runs</h3>
              <p className="text-muted-foreground mb-4">Start a coop run to coordinate services with your neighbors.</p>
              <button
                onClick={() => navigate('/app/service-runs/new')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
              >
                Start Coop Run
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {coopRuns.map(run => (
                <div
                  key={run.id}
                  onClick={() => navigate(`/app/service-runs/coop-${run.id}`)}
                  className="bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border"
                  data-testid={`card-coop-run-${run.id}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="font-semibold text-lg">{run.trade_category}</h3>
                        <Badge variant="outline" className={STATUS_COLORS[run.status]}>
                          {STATUS_LABELS[run.status] || run.status}
                        </Badge>
                        {run.threshold_met && (
                          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                            Threshold Met
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{run.service_description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-400">
                        {run.current_member_count || 0} members
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ~${run.mobilization_share?.toFixed(0) || '?'} each
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Contractor</div>
                      <div className="text-sm">{run.contractor_name || 'Pending'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Window</div>
                      <div className="text-sm">
                        {run.window_start ? formatDate(run.window_start) : 'TBD'}
                        {run.window_end ? ` - ${formatDate(run.window_end)}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Pricing</div>
                      <div className="text-sm capitalize">{run.pricing_model || 'Per unit'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Total Mobilization</div>
                      <div className="text-sm">
                        {run.mobilization_fee_total ? `$${run.mobilization_fee_total}` : 'TBD'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bidding" className="space-y-4">
          <div className="bg-card rounded-lg p-4 mb-4 border">
            <div className="flex items-center gap-4 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-muted border border-border rounded-lg px-4 py-2"
                data-testid="select-status-filter"
              >
                <option value="">All Statuses</option>
                <option value="collecting">Collecting Signups</option>
                <option value="bidding">Open for Bidding</option>
                <option value="bid_review">Reviewing Bids</option>
                <option value="confirmed">Confirmed</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <span className="text-muted-foreground text-sm">
                Showing {runs.length} run{runs.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {runs.length === 0 ? (
            <div className="bg-card rounded-lg p-12 text-center border">
              <h3 className="text-lg font-medium mb-2">No Bidding Runs</h3>
              <p className="text-muted-foreground mb-4">Create a bidding run to collect signups and receive contractor bids.</p>
              <button
                onClick={() => navigate('/app/service-runs/new')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg"
              >
                Create Bidding Run
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map(run => (
                <div
                  key={run.id}
                  onClick={() => navigate(`/app/service-runs/${run.slug}`)}
                  className="bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border"
                  data-testid={`card-run-${run.slug}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="font-semibold text-lg">{run.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[run.status]}`}>
                          {STATUS_LABELS[run.status]}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{run.description?.substring(0, 150)}...</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        ${run.totalEstimatedRevenue.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">est. revenue</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Community</div>
                      <div className="text-sm">{run.communityName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Bundle</div>
                      <div className="text-sm truncate">{run.bundleName || run.runTypeName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Target Dates</div>
                      <div className="text-sm">
                        {formatDate(run.targetStartDate)} - {formatDate(run.targetEndDate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Mobilization</div>
                      <div className="text-sm">
                        {run.estimatedMobilizationCost ? `$${run.estimatedMobilizationCost}` : '-'}
                      </div>
                    </div>
                  </div>

                  {getSlotProgress(run.currentSlots, run.minSlots, run.maxSlots)}

                  {run.status === 'collecting' && run.biddingOpensAt && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Bidding opens: {formatDate(run.biddingOpensAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface CoopRunDetail {
  id: string;
  trade_category: string;
  service_description: string;
  contractor_name: string | null;
  status: string;
  window_start: string | null;
  window_end: string | null;
  pricing_model: string;
  member_count: number;
  total_units: number;
}

interface CoopMobilization {
  total_fee: number;
  share_per_member: number;
  member_count: number;
  threshold_met: boolean;
  display: {
    headline: string;
  };
}

interface Slot {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  propertyAddress: string;
  propertyAccessType: string;
  propertyAccessNotes: string;
  servicesRequested: string[];
  specialRequirements: string;
  requiresOwnerPresent: boolean;
  status: string;
  estimatedCost: number | null;
  scheduledDate: string | null;
  createdAt: string;
}

interface Bid {
  id: string;
  contractorName: string;
  contractorEmail: string;
  bidType: string;
  mobilizationCost: number;
  perSlotCostLow: number | null;
  perSlotCostHigh: number | null;
  crewSize: number;
  crewNeedsAccommodation: boolean;
  proposedStartDate: string | null;
  estimatedDaysOnSite: number;
  status: string;
  bidNotes: string;
  submittedAt: string;
}

interface RunDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  communityName: string;
  runTypeName: string;
  bundleName: string;
  bundleSlug: string;
  serviceAreaDescription: string;
  targetStartDate: string;
  targetEndDate: string;
  minSlots: number;
  maxSlots: number;
  currentSlots: number;
  status: string;
  biddingOpensAt: string | null;
  biddingClosesAt: string | null;
  estimatedMobilizationCost: number | null;
  cancellationPolicy: string;
}

interface Stats {
  totalEstimatedRevenue: number;
  waterAccessCount: number;
  roadAccessCount: number;
  pendingCount: number;
  confirmedCount: number;
  bidCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  collecting: 'bg-blue-500/20 text-blue-400',
  bidding: 'bg-purple-500/20 text-purple-400',
  bid_review: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-cyan-500/20 text-cyan-400',
  in_progress: 'bg-orange-500/20 text-orange-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  submitted: 'bg-blue-500/20 text-blue-400',
  shortlisted: 'bg-purple-500/20 text-purple-400',
  accepted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400'
};

const ACCESS_ICONS: Record<string, string> = {
  road: 'Car',
  water_only: 'Boat',
  '4x4': 'Truck',
  helicopter: 'Helicopter',
  ferry: 'Ferry'
};

export default function ServiceRunDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [coopRun, setCoopRun] = useState<CoopRunDetail | null>(null);
  const [coopMobilization, setCoopMobilization] = useState<CoopMobilization | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'slots' | 'bids' | 'schedule'>('slots');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  
  const isCoopRun = slug?.startsWith('coop-');
  const coopRunId = isCoopRun ? slug.replace('coop-', '') : null;

  useEffect(() => {
    if (isCoopRun && coopRunId) {
      loadCoopRunDetail();
    } else {
      loadRunDetail();
    }
  }, [slug, token]);

  async function loadCoopRunDetail() {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/coop-runs/${coopRunId}`, { headers });
      const data = await res.json();
      
      if (data.coop_run) {
        setCoopRun(data.coop_run);
        setCoopMobilization(data.mobilization);
      }
    } catch (err) {
      console.error('Failed to load coop run:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetail() {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`/api/service-runs/runs/${slug}`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setRun(data.run);
        setSlots(data.slots);
        setBids(data.bids);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load run:', err);
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

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading run details...
      </div>
    );
  }

  if (!run && !coopRun) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-medium mb-2">Run Not Found</h3>
        <button
          onClick={() => navigate('/app/service-runs')}
          className="text-primary hover:underline"
          data-testid="link-back-to-runs"
        >
          Back to Runs
        </button>
      </div>
    );
  }

  if (isCoopRun && coopRun) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <button
            onClick={() => navigate('/app/service-runs')}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-back"
          >
            Back
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                <Users className="w-3 h-3 mr-1" />
                Coop Run
              </Badge>
              <h1 className="text-2xl font-bold" data-testid="text-run-title">{coopRun.trade_category}</h1>
              <Badge variant="outline" className={STATUS_COLORS[coopRun.status]}>
                {coopRun.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{coopRun.service_description}</p>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-400">
            This is a cooperative run - neighbors bundling together to share mobilization costs. This is NOT competitive bidding.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg p-4 text-center border">
            <div className="text-2xl font-bold text-blue-400">{coopRun.member_count || 0}</div>
            <div className="text-sm text-muted-foreground">Members</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border">
            <div className="text-2xl font-bold">{coopRun.total_units || 0}</div>
            <div className="text-sm text-muted-foreground">Total Units</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border">
            <div className="text-2xl font-bold text-green-400">
              ${coopMobilization?.share_per_member?.toFixed(0) || '?'}
            </div>
            <div className="text-sm text-muted-foreground">Your Share</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center border">
            <div className="text-2xl font-bold">
              ${coopMobilization?.total_fee?.toFixed(0) || '?'}
            </div>
            <div className="text-sm text-muted-foreground">Total Mobilization</div>
          </div>
        </div>

        {coopMobilization?.threshold_met && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-400 font-medium">
              Threshold met - this run has enough members to proceed.
            </p>
          </div>
        )}

        <div className="bg-card rounded-lg p-6 border mb-6">
          <h2 className="text-lg font-semibold mb-4">Run Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Contractor</div>
              <div className="font-medium">{coopRun.contractor_name || 'Pending'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Service Window</div>
              <div className="font-medium">
                {coopRun.window_start ? formatDate(coopRun.window_start) : 'TBD'}
                {coopRun.window_end ? ` - ${formatDate(coopRun.window_end)}` : ''}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Pricing Model</div>
              <div className="font-medium capitalize">{coopRun.pricing_model || 'Per unit'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <div className="font-medium capitalize">{coopRun.status.replace('_', ' ')}</div>
            </div>
          </div>
        </div>

        {coopMobilization?.display?.headline && (
          <div className="bg-card rounded-lg p-6 border">
            <h2 className="text-lg font-semibold mb-2">Cost Breakdown</h2>
            <p className="text-muted-foreground">{coopMobilization.display.headline}</p>
          </div>
        )}
      </div>
    );
  }

  if (!run) return null;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button
          onClick={() => navigate('/app/service-runs')}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-back"
        >
          Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" data-testid="text-run-title">{run.title}</h1>
            <span className={`text-sm px-3 py-1 rounded ${STATUS_COLORS[run.status]}`}>
              {run.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <p className="text-muted-foreground">{run.communityName} - {run.bundleName || run.runTypeName}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {run.status === 'collecting' && (
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
              Open Bidding
            </button>
          )}
          {run.status === 'bidding' && (
            <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg">
              Review Bids
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{run.currentSlots}</div>
          <div className="text-sm text-muted-foreground">Slots</div>
          <div className="text-xs text-muted-foreground">{run.minSlots} min / {run.maxSlots} max</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-green-400">
            ${stats?.totalEstimatedRevenue.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Est. Revenue</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold">{stats?.roadAccessCount || 0}</div>
          <div className="text-sm text-muted-foreground">Road Access</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-blue-400">{stats?.waterAccessCount || 0}</div>
          <div className="text-sm text-muted-foreground">Water Only</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-2xl font-bold text-purple-400">{stats?.bidCount || 0}</div>
          <div className="text-sm text-muted-foreground">Bids</div>
        </div>
        <div className="bg-card rounded-lg p-4 text-center border">
          <div className="text-lg font-bold">
            {formatDate(run.targetStartDate)}
          </div>
          <div className="text-sm text-muted-foreground">Target Start</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveTab('slots')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'slots' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover-elevate'
          }`}
          data-testid="button-tab-slots"
        >
          Slots ({slots.length})
        </button>
        <button
          onClick={() => setActiveTab('bids')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'bids' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover-elevate'
          }`}
          data-testid="button-tab-bids"
        >
          Bids ({bids.length})
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'schedule' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover-elevate'
          }`}
          data-testid="button-tab-schedule"
        >
          Schedule
        </button>
      </div>

      {activeTab === 'slots' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {slots.length === 0 ? (
              <div className="bg-card rounded-lg p-8 text-center border">
                <h3 className="text-lg font-medium mb-2">No Signups Yet</h3>
                <p className="text-muted-foreground">Share this run with property owners to collect signups.</p>
              </div>
            ) : (
              slots.map(slot => (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={`bg-card rounded-lg p-4 cursor-pointer hover-elevate transition-colors border ${
                    selectedSlot?.id === slot.id ? 'border-primary' : ''
                  }`}
                  data-testid={`card-slot-${slot.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">{ACCESS_ICONS[slot.propertyAccessType] || 'Location'}</span>
                        <h4 className="font-medium">{slot.customerName}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[slot.status]}`}>
                          {slot.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{slot.propertyAddress}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">
                        ${slot.estimatedCost?.toLocaleString() || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">estimated</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-xs">
                    {slot.servicesRequested?.map((service, i) => (
                      <span key={i} className="bg-muted px-2 py-1 rounded">
                        {service}
                      </span>
                    ))}
                    {slot.requiresOwnerPresent && (
                      <span className="bg-yellow-500/20 px-2 py-1 rounded text-yellow-400">
                        Owner Present
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-1">
            {selectedSlot ? (
              <div className="bg-card rounded-lg p-4 sticky top-4 border">
                <h3 className="font-semibold mb-4">{selectedSlot.customerName}</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Contact</div>
                    <div className="text-sm">{selectedSlot.customerEmail}</div>
                    <div className="text-sm text-muted-foreground">{selectedSlot.customerPhone}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Property</div>
                    <div className="text-sm">{selectedSlot.propertyAddress}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {ACCESS_ICONS[selectedSlot.propertyAccessType]} {selectedSlot.propertyAccessType.replace('_', ' ')} access
                    </div>
                  </div>
                  
                  {selectedSlot.propertyAccessNotes && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Access Notes</div>
                      <div className="text-sm bg-muted rounded p-2">
                        {selectedSlot.propertyAccessNotes}
                      </div>
                    </div>
                  )}
                  
                  {selectedSlot.specialRequirements && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Special Requirements</div>
                      <div className="text-sm bg-muted rounded p-2">
                        {selectedSlot.specialRequirements}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Services Requested</div>
                    <div className="space-y-1">
                      {selectedSlot.servicesRequested?.map((service, i) => (
                        <div key={i} className="text-sm bg-muted rounded px-2 py-1">
                          {service}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between mb-2">
                      <span className="text-muted-foreground">Estimated Cost</span>
                      <span className="font-bold">${selectedSlot.estimatedCost?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Signed up</span>
                      <span>{formatDate(selectedSlot.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg p-8 text-center text-muted-foreground sticky top-4 border">
                <p>Select a slot to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bids' && (
        <div className="space-y-4">
          {bids.length === 0 ? (
            <div className="bg-card rounded-lg p-8 text-center border">
              <h3 className="text-lg font-medium mb-2">No Bids Yet</h3>
              <p className="text-muted-foreground">
                {run.status === 'collecting' 
                  ? 'Bidding will open once signup collection is complete.'
                  : 'Contractors can submit bids during the bidding period.'}
              </p>
            </div>
          ) : (
            bids.map(bid => (
              <div key={bid.id} className="bg-card rounded-lg p-4 border" data-testid={`card-bid-${bid.id}`}>
                <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{bid.contractorName}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[bid.status]}`}>
                        {bid.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{bid.contractorEmail}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      ${bid.mobilizationCost}
                    </div>
                    <div className="text-xs text-muted-foreground">mobilization</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Per Slot</div>
                    <div>
                      ${bid.perSlotCostLow} - ${bid.perSlotCostHigh}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Crew Size</div>
                    <div>{bid.crewSize}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Days On Site</div>
                    <div>{bid.estimatedDaysOnSite}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Accommodation</div>
                    <div>{bid.crewNeedsAccommodation ? 'Needed' : 'No'}</div>
                  </div>
                </div>
                
                {bid.bidNotes && (
                  <div className="mt-3 text-sm text-muted-foreground bg-muted rounded p-2">
                    {bid.bidNotes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-card rounded-lg p-8 text-center border">
          <h3 className="text-lg font-medium mb-2">Schedule Coming Soon</h3>
          <p className="text-muted-foreground">
            Once a bid is accepted, the schedule builder will help optimize the route and timing.
          </p>
        </div>
      )}

      <div className="mt-6 bg-card rounded-lg p-4 border">
        <h3 className="font-semibold mb-4">Run Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Service Area</div>
            <div>{run.serviceAreaDescription || '-'}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Target Window</div>
            <div>{formatDate(run.targetStartDate)} - {formatDate(run.targetEndDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Bidding Period</div>
            <div>
              {run.biddingOpensAt 
                ? `${formatDate(run.biddingOpensAt)} - ${formatDate(run.biddingClosesAt!)}`
                : 'Not set'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Mobilization Est.</div>
            <div>${run.estimatedMobilizationCost || '-'}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Bundle</div>
            <div>{run.bundleName || '-'}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Cancellation Policy</div>
            <div className="text-xs">{run.cancellationPolicy}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

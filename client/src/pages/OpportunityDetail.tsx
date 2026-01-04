import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { 
  ArrowLeft, MapPin, Calendar, Clock, Building2, Award, 
  Send, CheckCircle, AlertCircle, FileText, DollarSign, LogIn
} from 'lucide-react';

interface OpportunityDetail {
  id: string;
  opportunity_ref: string;
  title: string;
  description: string;
  scope_of_work: string;
  work_category: string;
  site_address: string;
  site_latitude: number;
  site_longitude: number;
  community_name: string | null;
  estimated_value_low: number;
  estimated_value_high: number;
  budget_ceiling: number;
  bid_deadline: string | null;
  questions_deadline: string | null;
  expected_start_date: string | null;
  expected_duration_days: number | null;
  required_certifications: string[] | null;
  status: string;
  owner_name: string | null;
  owner_contact_name: string | null;
  bid_count: number;
  media: Array<{ id: string; media_type: string; url: string; caption: string }>;
  measurements: Array<{ id: string; measurement_type: string; value: number; unit: string }>;
  messages: Array<{ id: string; body: string; from_party_name: string; created_at: string; is_public: boolean }>;
  user_bid: { id: string; bid_ref: string; status: string; bid_amount: number } | null;
  is_owner: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
};

const daysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff < 0 ? 0 : diff;
};

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [proposedStart, setProposedStart] = useState('');
  const [duration, setDuration] = useState('');
  const [proposal, setProposal] = useState('');
  const [methodology, setMethodology] = useState('');

  const { data: opp, isLoading, error } = useQuery<OpportunityDetail>({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities/${id}`);
      if (!res.ok) throw new Error('Failed to fetch opportunity');
      return res.json();
    },
    enabled: !!id
  });

  const submitBid = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Please sign in to submit a bid.');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit bid');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setShowBidForm(false);
      setBidAmount('');
      setProposedStart('');
      setDuration('');
      setProposal('');
      setMethodology('');
    }
  });

  const bidAmountNum = Number(bidAmount);
  const isValidBidAmount = Number.isFinite(bidAmountNum) && bidAmountNum > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Opportunity not found</h2>
          <Link href="/jobs" className="text-primary hover:underline mt-4 inline-block">
            Back to Job Board
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmitBid = () => {
    if (!isValidBidAmount) return;
    
    submitBid.mutate({
      opportunity_id: id,
      bid_amount: bidAmountNum,
      proposed_start_date: proposedStart || null,
      proposed_duration_days: duration ? parseInt(duration) : null,
      technical_proposal: proposal || null,
      methodology: methodology || null,
      submit_immediately: true
    });
  };

  const deadlineDays = daysUntil(opp.bid_deadline);
  const isUrgent = deadlineDays !== null && deadlineDays <= 7 && deadlineDays > 0;
  const isPastDeadline = deadlineDays === 0;
  const isAuthError = submitBid.error?.message?.includes('sign in');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/jobs" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-jobs">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Job Board
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Section */}
            <div className="bg-card rounded-md border p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-mono text-muted-foreground" data-testid="text-opportunity-ref">{opp.opportunity_ref}</span>
                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                  {opp.work_category}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  opp.status === 'published' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                  opp.status === 'evaluating' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                  opp.status === 'awarded' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {opp.status.charAt(0).toUpperCase() + opp.status.slice(1)}
                </span>
                {isUrgent && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded-full">
                    {deadlineDays} days left to bid
                  </span>
                )}
              </div>
              
              <h1 className="text-2xl font-bold text-foreground mb-4" data-testid="text-opportunity-title">{opp.title}</h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{opp.site_address}</span>
                </div>
                {opp.owner_name && (
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    <span>{opp.owner_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-card rounded-md border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Description
              </h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{opp.description}</p>
            </div>

            {/* Scope of Work */}
            {opp.scope_of_work && (
              <div className="bg-card rounded-md border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Scope of Work</h2>
                <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{opp.scope_of_work}</div>
              </div>
            )}

            {/* Requirements & Certifications */}
            {opp.required_certifications && opp.required_certifications.length > 0 && (
              <div className="bg-card rounded-md border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Required Certifications
                </h2>
                <div className="flex flex-wrap gap-2">
                  {opp.required_certifications.map((cert, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20">
                      <Award className="w-4 h-4" />
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Q&A Section */}
            {opp.messages && opp.messages.length > 0 && (
              <div className="bg-card rounded-md border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Questions & Answers</h2>
                <div className="space-y-4">
                  {opp.messages.map((msg) => (
                    <div key={msg.id} className="border-l-4 border-primary/50 pl-4 py-2">
                      <div className="text-sm text-muted-foreground mb-1">
                        {msg.from_party_name || 'Anonymous'} - {formatDate(msg.created_at)}
                      </div>
                      <p className="text-foreground">{msg.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Bid Card */}
            <div className="bg-card rounded-md border p-6 sticky top-6">
              <div className="text-center mb-6">
                <div className="text-sm text-muted-foreground mb-1">Budget Range</div>
                <div className="text-2xl font-bold text-foreground" data-testid="text-budget-range">
                  {formatCurrency(opp.estimated_value_low)} - {formatCurrency(opp.estimated_value_high)}
                </div>
                {opp.budget_ceiling && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Maximum: {formatCurrency(opp.budget_ceiling)}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Bid Deadline
                  </span>
                  <span className={`font-medium ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                    {formatDate(opp.bid_deadline)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Start Date
                  </span>
                  <span className="font-medium text-foreground">{formatDate(opp.expected_start_date)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Duration
                  </span>
                  <span className="font-medium text-foreground">{opp.expected_duration_days} days</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Current Bids</span>
                  <span className="font-medium text-foreground" data-testid="text-bid-count">{opp.bid_count}</span>
                </div>
              </div>

              {/* Bid Status / Form */}
              {opp.user_bid ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <div className="font-semibold text-green-600 dark:text-green-400">Bid Submitted!</div>
                  <div className="text-sm text-green-600 dark:text-green-500 mt-1">{opp.user_bid.bid_ref}</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-2">
                    {formatCurrency(opp.user_bid.bid_amount)}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-500 mt-1 capitalize">
                    Status: {opp.user_bid.status}
                  </div>
                </div>
              ) : isPastDeadline ? (
                <div className="bg-muted border rounded-md p-4 text-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <div className="font-semibold text-muted-foreground">Bidding Closed</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    The deadline for this opportunity has passed.
                  </div>
                </div>
              ) : showBidForm ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Bid Amount (CAD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        data-testid="input-bid-amount"
                        className="w-full pl-9 pr-4 py-2 bg-background border rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder-muted-foreground"
                        placeholder="45000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Proposed Start Date
                    </label>
                    <input
                      type="date"
                      value={proposedStart}
                      onChange={(e) => setProposedStart(e.target.value)}
                      data-testid="input-proposed-start"
                      className="w-full px-3 py-2 bg-background border rounded-md focus:ring-2 focus:ring-primary text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Duration (days)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      data-testid="input-duration"
                      className="w-full px-3 py-2 bg-background border rounded-md focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
                      placeholder={opp.expected_duration_days?.toString() || '14'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Technical Approach
                    </label>
                    <textarea
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                      rows={3}
                      data-testid="input-proposal"
                      className="w-full px-3 py-2 bg-background border rounded-md focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
                      placeholder="Describe your approach and experience..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Methodology
                    </label>
                    <textarea
                      value={methodology}
                      onChange={(e) => setMethodology(e.target.value)}
                      rows={2}
                      data-testid="input-methodology"
                      className="w-full px-3 py-2 bg-background border rounded-md focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
                      placeholder="How will you execute this work?"
                    />
                  </div>
                  
                  {submitBid.error && (
                    <div className={`text-sm p-3 rounded-md flex items-center gap-2 ${
                      isAuthError 
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400' 
                        : 'bg-destructive/10 border border-destructive/30 text-destructive'
                    }`}>
                      {isAuthError ? <LogIn className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {(submitBid.error as Error).message}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowBidForm(false)}
                      data-testid="button-cancel-bid"
                      className="flex-1 px-4 py-2 border text-foreground rounded-md hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitBid}
                      disabled={submitBid.isPending || !isValidBidAmount}
                      data-testid="button-submit-bid"
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                      {submitBid.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Bid
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowBidForm(true)}
                  data-testid="button-start-bid"
                  className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-5 h-5" />
                  Submit a Bid
                </button>
              )}
            </div>

            {/* Location Card */}
            <div className="bg-card rounded-md border p-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Location
              </h3>
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center text-muted-foreground mb-3">
                <MapPin className="w-12 h-12" />
              </div>
              <div className="text-sm text-foreground">{opp.site_address}</div>
              {opp.site_latitude && opp.site_longitude && (
                <div className="text-xs text-muted-foreground mt-1 font-mono">
                  {opp.site_latitude.toFixed(4)}N, {Math.abs(opp.site_longitude).toFixed(4)}W
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

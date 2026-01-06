import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Search, MapPin, Calendar, Clock, Users, 
  ChevronRight, Briefcase, Award
} from 'lucide-react';

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
  expected_duration_days: number | null;
  required_certifications: string[] | null;
  status: string;
  bid_count: number;
  owner_name: string | null;
}

interface Stats {
  published: number;
  evaluating: number;
  awarded: number;
  total: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff < 0 ? 0 : diff;
};

export default function WorkRequestBoard() {
  const [search, setSearch] = useState('');
  const [workCategory, setWorkCategory] = useState('');
  const [sortBy, setSortBy] = useState('created_at');

  const { data: stats } = useQuery<Stats>({
    queryKey: ['work-request-stats'],
    queryFn: async () => {
      const res = await fetch('/api/work-requests/stats/summary');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const raw = await res.json();
      return {
        published: parseInt(raw.published ?? '0', 10),
        evaluating: parseInt(raw.evaluating ?? '0', 10),
        awarded: parseInt(raw.awarded ?? '0', 10),
        total: parseInt(raw.total ?? '0', 10),
      };
    }
  });

  const { data, isLoading, error } = useQuery<{ workRequests: WorkRequest[], pagination: { total: number } }>({
    queryKey: ['work-requests', search, workCategory, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (workCategory) params.set('work_category', workCategory);
      params.set('sort', sortBy);
      params.set('limit', '20');
      const res = await fetch(`/api/work-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch work requests');
      return res.json();
    }
  });

  const workRequests = data?.workRequests || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Find Work Requests</h1>
          <p className="text-blue-100 text-lg">Browse open work requests across British Columbia's remote communities</p>
          
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-xl">
            <div className="bg-white/10 rounded-md p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-published">{stats?.published || 0}</div>
              <div className="text-blue-200 text-sm">Open Requests</div>
            </div>
            <div className="bg-white/10 rounded-md p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-evaluating">{stats?.evaluating || 0}</div>
              <div className="text-blue-200 text-sm">Evaluating</div>
            </div>
            <div className="bg-white/10 rounded-md p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-awarded">{stats?.awarded || 0}</div>
              <div className="text-blue-200 text-sm">Awarded</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">
        <div className="bg-card rounded-md shadow-lg p-4 border">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search by title, location, or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
                className="w-full pl-10 pr-4 py-3 border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
              />
            </div>
            <select
              value={workCategory}
              onChange={(e) => setWorkCategory(e.target.value)}
              data-testid="select-category"
              className="px-4 py-3 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground min-w-[180px]"
            >
              <option value="">All Categories</option>
              <option value="Decks & Patios">Decks & Patios</option>
              <option value="Roofing">Roofing</option>
              <option value="Foundation">Foundation</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              data-testid="select-sort"
              className="px-4 py-3 border border-border rounded-md focus:ring-2 focus:ring-primary bg-background text-foreground min-w-[160px]"
            >
              <option value="created_at">Newest First</option>
              <option value="bid_deadline">Deadline Soon</option>
              <option value="estimated_value_high">Highest Value</option>
              <option value="expected_start_date">Start Date</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading work requests...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">Failed to load work requests.</div>
        ) : workRequests.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No work requests found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-6" data-testid="text-result-count">
              Showing <span className="font-semibold text-foreground">{workRequests.length}</span> work requests
            </p>
            <div className="grid gap-4">
              {workRequests.map((wr) => {
                const deadlineDays = daysUntil(wr.bid_deadline);
                const isUrgent = deadlineDays !== null && deadlineDays <= 7 && deadlineDays > 0;
                return (
                  <Link 
                    key={wr.id} 
                    href={`/work-requests/${wr.id}`}
                    data-testid={`card-work-request-${wr.id}`}
                  >
                    <div className="bg-card rounded-md border p-6 hover-elevate cursor-pointer transition-all">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-muted-foreground">{wr.work_request_ref}</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                              {wr.work_category}
                            </span>
                            {isUrgent && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded-full">
                                {deadlineDays} days left
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1">{wr.title}</h3>
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{wr.description}</p>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                            {wr.expected_duration_days && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {wr.expected_duration_days} days
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-lg font-bold text-foreground">
                            {formatCurrency(wr.estimated_value_low)} - {formatCurrency(wr.estimated_value_high)}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Users className="w-4 h-4" />
                              {wr.bid_count} bids
                            </span>
                            {wr.required_certifications && wr.required_certifications.length > 0 && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Award className="w-4 h-4" />
                                {wr.required_certifications.length} certs
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-primary text-sm font-medium mt-2">
                            View Details <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

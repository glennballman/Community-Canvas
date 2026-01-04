import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Search, MapPin, Calendar, Clock, Users, 
  ChevronRight, Briefcase, Award
} from 'lucide-react';

interface Opportunity {
  id: string;
  opportunity_ref: string;
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

export default function JobBoard() {
  const [search, setSearch] = useState('');
  const [workCategory, setWorkCategory] = useState('');
  const [sortBy, setSortBy] = useState('created_at');

  const { data: stats } = useQuery<Stats>({
    queryKey: ['opportunity-stats'],
    queryFn: async () => {
      const res = await fetch('/api/opportunities/stats/summary');
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

  const { data, isLoading, error } = useQuery<{ opportunities: Opportunity[], pagination: { total: number } }>({
    queryKey: ['opportunities', search, workCategory, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (workCategory) params.set('work_category', workCategory);
      params.set('sort', sortBy);
      params.set('limit', '20');
      const res = await fetch(`/api/opportunities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch opportunities');
      return res.json();
    }
  });

  const opportunities = data?.opportunities || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Find Your Next Project</h1>
          <p className="text-blue-100 text-lg">Browse open opportunities across British Columbia's remote communities</p>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-xl">
            <div className="bg-white/10 rounded-md p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-published">{stats?.published || 0}</div>
              <div className="text-blue-200 text-sm">Open Gigs</div>
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

      {/* Search & Filters */}
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

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading opportunities...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">Failed to load opportunities.</div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No opportunities found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-6" data-testid="text-result-count">
              Showing <span className="font-semibold text-foreground">{opportunities.length}</span> opportunities
            </p>
            <div className="grid gap-6">
              {opportunities.map((opp) => {
                const deadlineDays = daysUntil(opp.bid_deadline);
                const isUrgent = deadlineDays !== null && deadlineDays <= 7 && deadlineDays > 0;
                
                return (
                  <Link key={opp.id} href={`/opportunities/${opp.id}`}>
                    <div 
                      className="bg-card rounded-md shadow-sm border hover:shadow-md hover:border-primary/50 transition-all cursor-pointer p-6"
                      data-testid={`card-opportunity-${opp.id}`}
                    >
                      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-sm font-mono text-muted-foreground">{opp.opportunity_ref}</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                              {opp.work_category}
                            </span>
                            {isUrgent && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded-full">
                                {deadlineDays} days left
                              </span>
                            )}
                          </div>
                          
                          <h3 className="text-xl font-semibold text-foreground mb-2">{opp.title}</h3>
                          <p className="text-muted-foreground line-clamp-2 mb-4">{opp.description}</p>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{opp.community_name || opp.site_address?.split(',')[1]?.trim() || 'BC'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Start: {formatDate(opp.expected_start_date)}</span>
                            </div>
                            {opp.expected_duration_days && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{opp.expected_duration_days} days</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{opp.bid_count} bid{opp.bid_count !== 1 ? 's' : ''}</span>
                            </div>
                          </div>

                          {opp.required_certifications && opp.required_certifications.length > 0 && (
                            <div className="flex items-center gap-2 mt-3">
                              <Award className="w-4 h-4 text-amber-500" />
                              <div className="flex flex-wrap gap-1">
                                {opp.required_certifications.map((cert, i) => (
                                  <span key={i} className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">
                                    {cert}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0 lg:min-w-[180px]">
                          <div className="text-sm text-muted-foreground mb-1">Budget Range</div>
                          <div className="text-xl font-bold text-foreground">
                            {formatCurrency(opp.estimated_value_low)} - {formatCurrency(opp.estimated_value_high)}
                          </div>
                          {opp.bid_deadline && (
                            <div className="text-sm text-muted-foreground mt-2">
                              Deadline: {formatDate(opp.bid_deadline)}
                            </div>
                          )}
                          <div className="mt-4 flex items-center justify-end text-primary font-medium">
                            View Details
                            <ChevronRight className="w-5 h-5 ml-1" />
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

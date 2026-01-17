import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Search, MapPin, DollarSign, Clock, Briefcase, Building2, Home,
  ChevronLeft, Filter, X, Calendar, ArrowUpDown, ExternalLink, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { employmentTypes, roleCategories } from '@/lib/api/jobs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PublicJob {
  id: string;
  posting_id: string;
  title: string;
  description: string | null;
  role_category: string;
  employment_type: string;
  location_text: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_type: string | null;
  pay_unit?: string | null;
  housing_provided: boolean;
  brand_name_snapshot: string | null;
  legal_name_snapshot: string | null;
  employer_id: string | null;
  published_at: string;
  posted_at: string;
  season_window: string | null;
  is_featured?: boolean;
  is_pinned?: boolean;
}

interface PublicJobsResponse {
  ok: boolean;
  jobs: PublicJob[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

const DATE_POSTED_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Most Recent' },
  { value: 'pay_high', label: 'Pay: High to Low' },
  { value: 'pay_low', label: 'Pay: Low to High' },
];

function formatPay(job: PublicJob) {
  if (!job.pay_min && !job.pay_max) return null;
  const min = job.pay_min ? `$${job.pay_min}` : '';
  const max = job.pay_max ? `$${job.pay_max}` : '';
  const payType = job.pay_type || job.pay_unit;
  const unit = payType === 'hourly' ? '/hr' : payType === 'salary' || payType === 'annually' ? '/yr' : '';
  if (min && max) return `${min} - ${max}${unit}`;
  if (min) return `From ${min}${unit}`;
  if (max) return `Up to ${max}${unit}`;
  return null;
}

function formatDatePosted(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function isWithinDateRange(dateStr: string, range: string): boolean {
  if (range === 'any') return true;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  switch (range) {
    case '24h': return diffDays <= 1;
    case '7d': return diffDays <= 7;
    case '30d': return diffDays <= 30;
    default: return true;
  }
}

function JobCard({ 
  job, 
  isSelected, 
  onClick,
  portalSlug,
  isMobile
}: { 
  job: PublicJob; 
  isSelected: boolean; 
  onClick: () => void;
  portalSlug: string;
  isMobile?: boolean;
}) {
  const navigate = useNavigate();
  const pay = formatPay(job);
  
  const handleClick = () => {
    if (isMobile) {
      navigate(`/b/${portalSlug}/jobs/${job.id}`);
    } else {
      onClick();
    }
  };
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected && !isMobile ? 'ring-2 ring-primary bg-primary/5' : 'hover-elevate'}`}
      onClick={handleClick}
      data-testid={`job-card-${job.posting_id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold mb-1 line-clamp-2">{job.title}</h3>
          {job.is_featured && (
            <Badge className="bg-amber-500 text-xs shrink-0">Featured</Badge>
          )}
        </div>
        
        {job.employer_id ? (
          <Link 
            to={`/b/${portalSlug}/employers/${job.employer_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-muted-foreground hover:text-primary hover:underline mb-2 block"
            data-testid={`link-employer-${job.posting_id}`}
          >
            {job.brand_name_snapshot || 'Employer'}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground mb-2 block">
            {job.brand_name_snapshot || 'Employer'}
          </span>
        )}
        
        <div className="flex flex-wrap gap-2 mb-2">
          {job.employment_type && (
            <Badge variant="outline" className="text-xs">
              {employmentTypes.find(t => t.value === job.employment_type)?.label || job.employment_type}
            </Badge>
          )}
          {job.housing_provided && (
            <Badge className="bg-green-600 text-xs">
              <Home className="h-3 w-3 mr-1" />
              Housing
            </Badge>
          )}
        </div>
        
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {job.location_text && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location_text}
            </span>
          )}
          {pay && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {pay}
            </span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          {formatDatePosted(job.posted_at || job.published_at)}
        </div>
      </CardContent>
    </Card>
  );
}

function JobDetail({ job, portalSlug }: { job: PublicJob | null; portalSlug: string }) {
  const navigate = useNavigate();

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <div className="text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a job to view details</p>
        </div>
      </div>
    );
  }

  const pay = formatPay(job);

  return (
    <div className="p-6 space-y-6" data-testid="job-detail-panel">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          {job.is_featured && (
            <Badge className="bg-amber-500 shrink-0">Featured</Badge>
          )}
        </div>
        {job.employer_id ? (
          <Link 
            to={`/b/${portalSlug}/employers/${job.employer_id}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary"
            data-testid="link-employer-detail"
          >
            <Building2 className="h-4 w-4" />
            <span className="font-medium hover:underline">{job.brand_name_snapshot || 'Employer'}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="font-medium">{job.brand_name_snapshot || 'Employer'}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {job.employment_type && (
          <Badge variant="secondary">
            {employmentTypes.find(t => t.value === job.employment_type)?.label}
          </Badge>
        )}
        {job.role_category && (
          <Badge variant="outline">
            {roleCategories.find(c => c.value === job.role_category)?.label}
          </Badge>
        )}
        {job.housing_provided && (
          <Badge className="bg-green-600">
            <Home className="h-3 w-3 mr-1" />
            Housing Included
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {job.location_text && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{job.location_text}</span>
          </div>
        )}
        {pay && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>{pay}</span>
          </div>
        )}
        {job.season_window && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{job.season_window}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{formatDatePosted(job.posted_at || job.published_at)}</span>
        </div>
      </div>

      <Separator />

      {job.description && (
        <div>
          <h3 className="font-semibold mb-2">About This Role</h3>
          <p className="text-muted-foreground whitespace-pre-wrap line-clamp-[12]">{job.description}</p>
        </div>
      )}

      <div className="pt-4 space-y-2">
        <Button 
          size="lg" 
          className="w-full"
          onClick={() => navigate(`/b/${portalSlug}/jobs/${job.id}`)}
          data-testid="button-view-details"
        >
          View Full Details
        </Button>
        <Button 
          variant="outline"
          size="lg" 
          className="w-full"
          onClick={() => navigate(`/b/${portalSlug}/jobs/${job.id}/apply`)}
          data-testid="button-apply-quick"
        >
          Quick Apply
        </Button>
      </div>
    </div>
  );
}

export default function PortalJobsPage() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(searchParams.get('job') || null);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
  const [datePosted, setDatePosted] = useState(searchParams.get('posted') || 'any');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string[]>(
    searchParams.get('type')?.split(',').filter(Boolean) || []
  );
  const [employerFilter, setEmployerFilter] = useState(searchParams.get('employer') || '');
  const [housingFilter, setHousingFilter] = useState(searchParams.get('housing') === 'true');
  const [payMin, setPayMin] = useState(searchParams.get('payMin') || '');
  const [payMax, setPayMax] = useState(searchParams.get('payMax') || '');
  const [filterOpen, setFilterOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data, isLoading, error } = useQuery<PublicJobsResponse>({
    queryKey: ['/api/p2/public/jobs', portalSlug],
    queryFn: async () => {
      const res = await fetch(`/b/${portalSlug}/api/public/jobs?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    enabled: !!portalSlug,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['/api/p2/public/jobs/campaigns', portalSlug],
    queryFn: async () => {
      const res = await fetch(`/api/p2/public/b/${portalSlug}/jobs/campaigns`);
      if (!res.ok) return { ok: false, campaigns: [] };
      return res.json();
    },
    enabled: !!portalSlug,
  });

  const availableCampaigns = (campaignsData as any)?.campaigns || [];

  const allJobs = data?.jobs || [];

  const employers = useMemo(() => {
    const employerMap = new Map<string, { id: string; name: string; count: number }>();
    allJobs.forEach(job => {
      const name = job.brand_name_snapshot || job.legal_name_snapshot || 'Unknown';
      const id = job.employer_id || name;
      if (!employerMap.has(id)) {
        employerMap.set(id, { id, name, count: 0 });
      }
      employerMap.get(id)!.count++;
    });
    return Array.from(employerMap.values()).sort((a, b) => b.count - a.count);
  }, [allJobs]);

  const filteredJobs = useMemo(() => {
    let jobs = [...allJobs];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(j => 
        j.title.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.brand_name_snapshot?.toLowerCase().includes(q)
      );
    }
    
    if (locationFilter) {
      const loc = locationFilter.toLowerCase();
      jobs = jobs.filter(j => j.location_text?.toLowerCase().includes(loc));
    }
    
    if (datePosted !== 'any') {
      jobs = jobs.filter(j => isWithinDateRange(j.posted_at || j.published_at, datePosted));
    }
    
    if (employmentTypeFilter.length > 0) {
      jobs = jobs.filter(j => employmentTypeFilter.includes(j.employment_type));
    }
    
    if (employerFilter) {
      jobs = jobs.filter(j => j.employer_id === employerFilter || 
        j.brand_name_snapshot === employerFilter);
    }
    
    if (housingFilter) {
      jobs = jobs.filter(j => j.housing_provided);
    }
    
    if (payMin) {
      const min = parseFloat(payMin);
      jobs = jobs.filter(j => j.pay_min !== null && j.pay_min >= min);
    }
    
    if (payMax) {
      const max = parseFloat(payMax);
      jobs = jobs.filter(j => j.pay_max !== null && j.pay_max <= max);
    }
    
    switch (sortBy) {
      case 'date':
        jobs.sort((a, b) => new Date(b.posted_at || b.published_at).getTime() - 
          new Date(a.posted_at || a.published_at).getTime());
        break;
      case 'pay_high':
        jobs.sort((a, b) => (b.pay_max || b.pay_min || 0) - (a.pay_max || a.pay_min || 0));
        break;
      case 'pay_low':
        jobs.sort((a, b) => (a.pay_min || a.pay_max || Infinity) - (b.pay_min || b.pay_max || Infinity));
        break;
      default:
        jobs.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return new Date(b.posted_at || b.published_at).getTime() - 
            new Date(a.posted_at || a.published_at).getTime();
        });
    }
    
    return jobs;
  }, [allJobs, searchQuery, locationFilter, datePosted, employmentTypeFilter, 
      employerFilter, housingFilter, payMin, payMax, sortBy]);

  const selectedJob = filteredJobs.find(j => j.id === selectedJobId) || 
    (filteredJobs.length > 0 && !selectedJobId ? filteredJobs[0] : null);

  useEffect(() => {
    if (filteredJobs.length > 0 && !selectedJobId && !isMobile) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, selectedJobId, isMobile]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (locationFilter) params.set('location', locationFilter);
    if (selectedJobId) params.set('job', selectedJobId);
    if (sortBy !== 'relevance') params.set('sort', sortBy);
    if (datePosted !== 'any') params.set('posted', datePosted);
    if (employmentTypeFilter.length > 0) params.set('type', employmentTypeFilter.join(','));
    if (employerFilter) params.set('employer', employerFilter);
    if (housingFilter) params.set('housing', 'true');
    if (payMin) params.set('payMin', payMin);
    if (payMax) params.set('payMax', payMax);
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, locationFilter, selectedJobId, sortBy, datePosted, 
      employmentTypeFilter, employerFilter, housingFilter, payMin, payMax, setSearchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const activeFilterCount = [
    datePosted !== 'any',
    employmentTypeFilter.length > 0,
    employerFilter,
    housingFilter,
    payMin,
    payMax,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setDatePosted('any');
    setEmploymentTypeFilter([]);
    setEmployerFilter('');
    setHousingFilter(false);
    setPayMin('');
    setPayMax('');
    setLocationFilter('');
  };

  const toggleEmploymentType = (value: string) => {
    setEmploymentTypeFilter(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-portal-jobs">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold capitalize">{portalSlug?.replace(/-/g, ' ')} Jobs</h1>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Job title, keywords..."
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <div className="relative flex-1 max-w-xs">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  placeholder="Location..."
                  className="pl-10"
                  data-testid="input-location"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]" data-testid="select-sort">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="relative" data-testid="button-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      Narrow down your job search
                    </SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-180px)] pr-4">
                    <div className="py-6 space-y-6">
                      <div className="space-y-2">
                        <Label>Date Posted</Label>
                        <Select value={datePosted} onValueChange={setDatePosted}>
                          <SelectTrigger data-testid="select-date-posted">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATE_POSTED_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Employment Type</Label>
                        <div className="space-y-2">
                          {employmentTypes.map(type => (
                            <div key={type.value} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`type-${type.value}`}
                                checked={employmentTypeFilter.includes(type.value)}
                                onChange={() => toggleEmploymentType(type.value)}
                                className="rounded border-input"
                                data-testid={`checkbox-type-${type.value}`}
                              />
                              <Label htmlFor={`type-${type.value}`} className="font-normal cursor-pointer">
                                {type.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Employer</Label>
                        <Select value={employerFilter} onValueChange={setEmployerFilter}>
                          <SelectTrigger data-testid="select-employer">
                            <SelectValue placeholder="All employers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All employers</SelectItem>
                            {employers.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name} ({emp.count})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Pay Range</Label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input
                              type="number"
                              value={payMin}
                              onChange={e => setPayMin(e.target.value)}
                              placeholder="Min"
                              data-testid="input-pay-min"
                            />
                          </div>
                          <span className="flex items-center text-muted-foreground">to</span>
                          <div className="flex-1">
                            <Input
                              type="number"
                              value={payMax}
                              onChange={e => setPayMax(e.target.value)}
                              placeholder="Max"
                              data-testid="input-pay-max"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="housing">Housing Provided</Label>
                        <Switch
                          id="housing"
                          checked={housingFilter}
                          onCheckedChange={setHousingFilter}
                          data-testid="switch-housing-filter"
                        />
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={clearFilters}
                          data-testid="button-clear-filters"
                        >
                          Clear All
                        </Button>
                        <SheetClose asChild>
                          <Button className="flex-1" data-testid="button-apply-filters">
                            Apply Filters
                          </Button>
                        </SheetClose>
                      </div>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {datePosted !== 'any' && (
                <Badge variant="secondary" className="gap-1">
                  {DATE_POSTED_OPTIONS.find(o => o.value === datePosted)?.label}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setDatePosted('any')} />
                </Badge>
              )}
              {employmentTypeFilter.map(type => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {employmentTypes.find(t => t.value === type)?.label}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEmploymentType(type)} />
                </Badge>
              ))}
              {employerFilter && (
                <Badge variant="secondary" className="gap-1">
                  {employers.find(e => e.id === employerFilter)?.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setEmployerFilter('')} />
                </Badge>
              )}
              {housingFilter && (
                <Badge variant="secondary" className="gap-1">
                  Housing Provided
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setHousingFilter(false)} />
                </Badge>
              )}
              {(payMin || payMax) && (
                <Badge variant="secondary" className="gap-1">
                  Pay: {payMin || '0'} - {payMax || 'any'}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setPayMin(''); setPayMax(''); }} />
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-6 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {availableCampaigns.length > 0 && (
          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Apply to Multiple Jobs at Once</h3>
                    <p className="text-sm text-muted-foreground">
                      Send one application to {availableCampaigns[0]?.jobCount || 'all'} employers
                    </p>
                  </div>
                </div>
                <Button asChild data-testid="button-campaign-apply-cta">
                  <Link to={`/b/${portalSlug}/apply/${availableCampaigns[0]?.key || 'all_roles'}`}>
                    Quick Apply to All
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-4 text-sm text-muted-foreground">
          {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
            <Skeleton className="h-[600px] hidden md:block" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load jobs. Please try again.
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No jobs found</h3>
            <p className="text-muted-foreground mb-4">
              {activeFilterCount > 0 
                ? 'Try adjusting your filters' 
                : searchQuery 
                  ? 'Try different search terms' 
                  : 'Check back later for new opportunities'}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 md:max-h-[calc(100vh-280px)] md:overflow-y-auto md:pr-2">
              {filteredJobs.map(job => (
                <JobCard
                  key={job.posting_id}
                  job={job}
                  isSelected={job.id === selectedJobId}
                  onClick={() => setSelectedJobId(job.id)}
                  portalSlug={portalSlug || ''}
                  isMobile={isMobile}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <Card className="sticky top-28 max-h-[calc(100vh-160px)] overflow-y-auto">
                <JobDetail job={selectedJob} portalSlug={portalSlug || ''} />
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Powered by Community Canvas
        </div>
      </footer>
    </div>
  );
}

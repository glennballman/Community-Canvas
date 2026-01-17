import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, MapPin, DollarSign, Clock, Briefcase, Building2, Home,
  ChevronLeft, ChevronRight, Filter, X, Calendar, ArrowUpDown
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
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { employmentTypes, roleCategories } from '@/lib/api/jobs';

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
  pay_unit: string | null;
  housing_provided: boolean;
  brand_name_snapshot: string | null;
  legal_name_snapshot: string | null;
  published_at: string;
  season_window: string | null;
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

function formatPay(job: PublicJob) {
  if (!job.pay_min && !job.pay_max) return null;
  const min = job.pay_min ? `$${job.pay_min}` : '';
  const max = job.pay_max ? `$${job.pay_max}` : '';
  const unit = job.pay_unit === 'hourly' ? '/hr' : job.pay_unit === 'annually' ? '/yr' : '';
  if (min && max) return `${min} - ${max}${unit}`;
  if (min) return `From ${min}${unit}`;
  if (max) return `Up to ${max}${unit}`;
  return null;
}

function JobCard({ 
  job, 
  isSelected, 
  onClick,
  onNavigate
}: { 
  job: PublicJob; 
  isSelected: boolean; 
  onClick: () => void;
  onNavigate: () => void;
}) {
  const pay = formatPay(job);
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover-elevate'}`}
      onClick={onClick}
      onDoubleClick={onNavigate}
      data-testid={`job-card-${job.posting_id}`}
    >
      <CardContent className="p-4">
        <h3 className="font-semibold mb-1 line-clamp-1">{job.title}</h3>
        <p className="text-sm text-muted-foreground mb-2">
          {job.brand_name_snapshot || 'Employer'}
        </p>
        
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
          Posted {new Date(job.published_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}

function JobDetail({ job }: { job: PublicJob | null }) {
  const navigate = useNavigate();
  const { portalSlug } = useParams();

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a job to view details
      </div>
    );
  }

  const pay = formatPay(job);

  return (
    <div className="p-6 space-y-6" data-testid="job-detail">
      <div>
        <h1 className="text-2xl font-bold mb-2">{job.title}</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span className="font-medium">{job.brand_name_snapshot || 'Employer'}</span>
        </div>
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
      </div>

      <Separator />

      {job.description && (
        <div>
          <h3 className="font-semibold mb-2">About This Role</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
        </div>
      )}

      <div className="pt-4 space-y-2">
        <Button 
          size="lg" 
          className="w-full"
          onClick={() => navigate(`/b/${portalSlug}/jobs/${job.posting_id}`)}
          data-testid="button-view-details"
        >
          View Full Details
        </Button>
        <Button 
          variant="outline"
          size="lg" 
          className="w-full"
          onClick={() => navigate(`/b/${portalSlug}/jobs/${job.posting_id}/apply`)}
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('date');
  const [filters, setFilters] = useState({
    employmentType: '',
    housingProvided: false,
    payMin: 0,
    payMax: 100,
  });

  const { data, isLoading, error } = useQuery<PublicJobsResponse>({
    queryKey: ['/api/p2/public/jobs', portalSlug, searchQuery, sortBy, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (sortBy) params.set('sort', sortBy);
      if (filters.employmentType) params.set('employment_type', filters.employmentType);
      if (filters.housingProvided) params.set('housing', 'true');
      if (filters.payMin > 0) params.set('pay_min', String(filters.payMin));
      if (filters.payMax < 100) params.set('pay_max', String(filters.payMax));
      const url = `/api/p2/public/jobs/${portalSlug}${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  const jobs = data?.jobs || [];
  const selectedJob = jobs.find(j => j.posting_id === selectedJobId) || null;

  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].posting_id);
    }
  }, [jobs, selectedJobId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(searchQuery ? { q: searchQuery } : {});
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-portal-jobs">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold capitalize">{portalSlug} Jobs</h1>
            </div>
            
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search jobs..."
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Most Recent</SelectItem>
                  <SelectItem value="pay_high">Pay: High to Low</SelectItem>
                  <SelectItem value="pay_low">Pay: Low to High</SelectItem>
                </SelectContent>
              </Select>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-filter">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      Narrow down your job search
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 space-y-6">
                    <div className="space-y-2">
                      <Label>Employment Type</Label>
                      <Select 
                        value={filters.employmentType} 
                        onValueChange={v => setFilters(f => ({ ...f, employmentType: v }))}
                      >
                        <SelectTrigger data-testid="select-employment-type">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All types</SelectItem>
                          {employmentTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="housing">Housing Provided</Label>
                      <Switch
                        id="housing"
                        checked={filters.housingProvided}
                        onCheckedChange={v => setFilters(f => ({ ...f, housingProvided: v }))}
                        data-testid="switch-housing-filter"
                      />
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setFilters({
                        employmentType: '',
                        housingProvided: false,
                        payMin: 0,
                        payMax: 100,
                      })}
                      data-testid="button-clear-filters"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
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
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No jobs found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try adjusting your search terms' : 'Check back later for new opportunities'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {jobs.map(job => (
                <JobCard
                  key={job.posting_id}
                  job={job}
                  isSelected={job.posting_id === selectedJobId}
                  onClick={() => setSelectedJobId(job.posting_id)}
                  onNavigate={() => navigate(`/b/${portalSlug}/jobs/${job.posting_id}`)}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <Card className="sticky top-24">
                <JobDetail job={selectedJob} />
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

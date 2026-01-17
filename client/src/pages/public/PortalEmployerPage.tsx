import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { 
  Building2, MapPin, DollarSign, Briefcase, Home, ExternalLink, 
  ArrowLeft, Globe, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { employmentTypes } from '@/lib/api/jobs';

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
  housing_provided: boolean;
  brand_name_snapshot: string | null;
  legal_name_snapshot: string | null;
  employer_id: string | null;
  published_at: string;
  posted_at: string;
}

interface EmployerResponse {
  ok: boolean;
  employer: {
    id: string;
    name: string;
    legal_name: string | null;
    description: string | null;
    website: string | null;
    logo_url: string | null;
  } | null;
  jobs: PublicJob[];
}

function formatPay(job: PublicJob) {
  if (!job.pay_min && !job.pay_max) return null;
  const min = job.pay_min ? `$${job.pay_min}` : '';
  const max = job.pay_max ? `$${job.pay_max}` : '';
  const unit = job.pay_type === 'hourly' ? '/hr' : job.pay_type === 'salary' ? '/yr' : '';
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

function JobCard({ job, portalSlug }: { job: PublicJob; portalSlug: string }) {
  const pay = formatPay(job);
  
  return (
    <Link to={`/b/${portalSlug}/jobs/${job.id}`} data-testid={`job-card-${job.posting_id}`}>
      <Card className="hover-elevate transition-all cursor-pointer">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 line-clamp-1">{job.title}</h3>
          
          <div className="flex flex-wrap gap-2 mb-3">
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
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDatePosted(job.posted_at || job.published_at)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PortalEmployerPage() {
  const { portalSlug, employerId } = useParams();

  const { data, isLoading, error } = useQuery<EmployerResponse>({
    queryKey: ['/api/p2/public/employers', portalSlug, employerId],
    queryFn: async () => {
      const res = await fetch(`/b/${portalSlug}/api/public/employers/${employerId}`);
      if (!res.ok) throw new Error('Failed to fetch employer');
      return res.json();
    },
    enabled: !!portalSlug && !!employerId,
  });

  const employer = data?.employer;
  const jobs = data?.jobs || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="page-employer-loading">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-48 w-full mb-8" />
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !employer) {
    return (
      <div className="min-h-screen bg-background" data-testid="page-employer-error">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Link to={`/b/${portalSlug}/jobs`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Employer Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This employer may not have any active listings on this portal.
          </p>
          <Button asChild>
            <Link to={`/b/${portalSlug}/jobs`}>View All Jobs</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-employer">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              to={`/b/${portalSlug}/jobs`} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              data-testid="link-back-jobs"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Link>
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-primary" />
              <span className="font-medium capitalize">{portalSlug?.replace(/-/g, ' ')}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8" data-testid="employer-profile-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {employer.logo_url ? (
                    <img 
                      src={employer.logo_url} 
                      alt={employer.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold mb-1">{employer.name}</h1>
                  {employer.legal_name && employer.legal_name !== employer.name && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Legal name: {employer.legal_name}
                    </p>
                  )}
                  
                  {employer.website && (
                    <a 
                      href={employer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-3"
                      data-testid="link-employer-website"
                    >
                      <Globe className="h-4 w-4" />
                      Visit Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  
                  {employer.description && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <h3 className="font-semibold mb-2">About</h3>
                        <p className="text-muted-foreground">{employer.description}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-1">
              Open Positions
            </h2>
            <p className="text-sm text-muted-foreground">
              {jobs.length} job{jobs.length !== 1 ? 's' : ''} available from this employer
            </p>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Open Positions</h3>
              <p className="text-muted-foreground mb-4">
                This employer doesn't have any active listings right now.
              </p>
              <Button variant="outline" asChild>
                <Link to={`/b/${portalSlug}/jobs`}>Browse All Jobs</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {jobs.map(job => (
                <JobCard 
                  key={job.posting_id} 
                  job={job} 
                  portalSlug={portalSlug || ''} 
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Powered by Community Canvas
        </div>
      </footer>
    </div>
  );
}

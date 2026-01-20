import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MapPin, DollarSign, Briefcase, Building2, Home, ArrowLeft,
  Calendar, Clock, Share2, ExternalLink
} from 'lucide-react';
import { PortalBrandedShell } from './components/PortalBrandedShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { employmentTypes, roleCategories } from '@/lib/api/jobs';

interface PublicJobDetail {
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
  responsibilities: string | null;
  requirements: string | null;
  nice_to_have: string | null;
  hours_per_week: number | null;
  shift_details: string | null;
  is_flexible_dates: boolean;
  start_date: string | null;
  end_date: string | null;
  external_apply_url: string | null;
}

interface PublicJobDetailResponse {
  ok: boolean;
  job: PublicJobDetail;
}

function formatPay(job: PublicJobDetail) {
  if (!job.pay_min && !job.pay_max) return null;
  const min = job.pay_min ? `$${job.pay_min}` : '';
  const max = job.pay_max ? `$${job.pay_max}` : '';
  const unit = job.pay_unit === 'hourly' ? '/hr' : job.pay_unit === 'annually' ? '/yr' : '';
  if (min && max) return `${min} - ${max}${unit}`;
  if (min) return `From ${min}${unit}`;
  if (max) return `Up to ${max}${unit}`;
  return null;
}

function generateJobPostingJsonLd(job: PublicJobDetail, portalSlug: string) {
  const payUnitMap: Record<string, string> = {
    hourly: 'HOUR',
    daily: 'DAY',
    weekly: 'WEEK',
    monthly: 'MONTH',
    annually: 'YEAR',
  };

  const employmentTypeMap: Record<string, string> = {
    full_time: 'FULL_TIME',
    part_time: 'PART_TIME',
    contract: 'CONTRACTOR',
    seasonal: 'TEMPORARY',
    temporary: 'TEMPORARY',
    internship: 'INTERN',
  };

  const jobUrl = `${window.location.origin}/b/${portalSlug}/jobs/${job.posting_id}`;

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || job.title,
    datePosted: job.published_at,
    identifier: {
      '@type': 'PropertyValue',
      name: portalSlug,
      value: job.posting_id,
    },
    url: jobUrl,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.brand_name_snapshot || job.legal_name_snapshot || 'Employer',
    },
    jobLocation: job.location_text ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location_text,
        addressCountry: 'CA',
      },
    } : undefined,
    employmentType: employmentTypeMap[job.employment_type] || 'OTHER',
  };

  if (job.pay_min || job.pay_max) {
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'CAD',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.pay_min || undefined,
        maxValue: job.pay_max || undefined,
        unitText: payUnitMap[job.pay_unit || 'hourly'] || 'HOUR',
      },
    };
  }

  if (job.end_date) {
    jsonLd.validThrough = job.end_date;
  }

  return jsonLd;
}

export default function PortalJobDetailPage() {
  const { portalSlug, postingId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<PublicJobDetailResponse>({
    queryKey: ['/api/p2/public/jobs', portalSlug, postingId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/public/jobs/${portalSlug}/${postingId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      return res.json();
    },
  });

  const job = data?.job;
  const pay = job ? formatPay(job) : null;

  useEffect(() => {
    if (!job || !portalSlug) return;

    const existingScript = document.getElementById('job-posting-jsonld');
    if (existingScript) {
      existingScript.remove();
    }

    const jsonLd = generateJobPostingJsonLd(job, portalSlug);
    const script = document.createElement('script');
    script.id = 'job-posting-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      const script = document.getElementById('job-posting-jsonld');
      if (script) script.remove();
    };
  }, [job, portalSlug]);

  if (isLoading) {
    return (
      <PortalBrandedShell
        portalSlug={portalSlug}
        backHref={`/b/${portalSlug}/jobs`}
        backLabel="Back to Jobs"
      >
        <div className="container mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PortalBrandedShell>
    );
  }

  if (error || !job) {
    return (
      <PortalBrandedShell
        portalSlug={portalSlug}
        backHref={`/b/${portalSlug}/jobs`}
        backLabel="Back to Jobs"
      >
        <div className="text-center py-12" data-testid="page-job-not-found">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-bold mb-2">Job Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This job posting may have been removed or is no longer available.
          </p>
          <Button onClick={() => navigate(`/b/${portalSlug}/jobs`)} data-testid="button-back-to-jobs">
            View All Jobs
          </Button>
        </div>
      </PortalBrandedShell>
    );
  }

  return (
    <PortalBrandedShell
      portalSlug={portalSlug}
      backHref={`/b/${portalSlug}/jobs`}
      backLabel="Back to Jobs"
    >
      <div data-testid="page-job-detail" className="container mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2" data-testid="text-job-title">{job.title}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="font-medium" data-testid="text-employer">
                  {job.brand_name_snapshot || 'Employer'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {job.employment_type && (
                <Badge variant="secondary" data-testid="badge-employment-type">
                  {employmentTypes.find(t => t.value === job.employment_type)?.label}
                </Badge>
              )}
              {job.role_category && (
                <Badge variant="outline" data-testid="badge-category">
                  {roleCategories.find(c => c.value === job.role_category)?.label}
                </Badge>
              )}
              {job.housing_provided && (
                <Badge className="bg-green-600 text-white" data-testid="badge-housing">
                  <Home className="h-3 w-3 mr-1" />
                  Housing Included
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {job.location_text && (
                <div className="flex items-center gap-2" data-testid="text-location">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{job.location_text}</span>
                </div>
              )}
              {pay && (
                <div className="flex items-center gap-2" data-testid="text-pay">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{pay}</span>
                </div>
              )}
              {job.season_window && (
                <div className="flex items-center gap-2" data-testid="text-season">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{job.season_window}</span>
                </div>
              )}
              {job.hours_per_week && (
                <div className="flex items-center gap-2" data-testid="text-hours">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{job.hours_per_week} hrs/week</span>
                </div>
              )}
            </div>

            <Separator />

            {job.description && (
              <div>
                <h3 className="font-semibold mb-2">About This Role</h3>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
                  {job.description}
                </p>
              </div>
            )}

            {job.responsibilities && (
              <div>
                <h3 className="font-semibold mb-2">Responsibilities</h3>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-responsibilities">
                  {job.responsibilities}
                </p>
              </div>
            )}

            {job.requirements && (
              <div>
                <h3 className="font-semibold mb-2">Requirements</h3>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-requirements">
                  {job.requirements}
                </p>
              </div>
            )}

            {job.nice_to_have && (
              <div>
                <h3 className="font-semibold mb-2">Nice to Have</h3>
                <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-nice-to-have">
                  {job.nice_to_have}
                </p>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-3">
              {job.external_apply_url ? (
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => window.open(job.external_apply_url!, '_blank')}
                  data-testid="button-apply-external"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apply on Company Site
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => navigate(`/b/${portalSlug}/jobs/${postingId}/apply`)}
                  data-testid="button-apply"
                >
                  Apply Now
                </Button>
              )}
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full"
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Job
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              Posted {new Date(job.published_at).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalBrandedShell>
  );
}

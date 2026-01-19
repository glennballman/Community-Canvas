import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Briefcase, Building2, Calendar, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { JobConversationPanel } from '@/components/jobs/JobConversationPanel';

interface ApplicationDetail {
  id: string;
  job_id: string;
  application_number: string;
  status: string;
  submitted_at: string | null;
  cover_letter: string | null;
  job_title: string;
  job_description: string | null;
  company_name: string;
  portal_name: string;
  location: string | null;
  employment_type: string | null;
}

interface ApplicationResponse {
  ok: boolean;
  application: ApplicationDetail;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed',
  offer_extended: 'Offer Extended',
  offer_accepted: 'Accepted',
  offer_declined: 'Declined',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn'
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  under_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  shortlisted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  interview_scheduled: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  interviewed: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  offer_extended: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  offer_accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  offer_declined: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
};

export default function ApplicationDetailPage() {
  const { appId } = useParams<{ appId: string }>();

  const { data, isLoading, error } = useQuery<ApplicationResponse>({
    queryKey: ['/api/participant/applications', appId],
    enabled: !!appId,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="page-application-detail-loading">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !data?.application) {
    return (
      <div className="p-6" data-testid="page-application-detail-error">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Application not found or you don't have access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const app = data.application;

  return (
    <div className="p-6 space-y-6" data-testid="page-application-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/participant/applications">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Applications
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">{app.job_title}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{app.company_name || app.portal_name}</span>
            </div>
          </div>
        </div>
        <Badge className={STATUS_COLORS[app.status]} variant="secondary">
          {STATUS_LABELS[app.status] || app.status}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Application Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Application Number</div>
                <div className="font-medium">{app.application_number}</div>
              </div>
              {app.submitted_at && (
                <div>
                  <div className="text-muted-foreground">Submitted</div>
                  <div className="font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(app.submitted_at).toLocaleDateString()}
                  </div>
                </div>
              )}
              {app.location && (
                <div>
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {app.location}
                  </div>
                </div>
              )}
              {app.employment_type && (
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {app.employment_type}
                  </div>
                </div>
              )}
            </div>

            {app.cover_letter && (
              <>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Your Cover Letter</div>
                  <div className="text-sm border rounded-md p-3 bg-muted/30 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {app.cover_letter}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <JobConversationPanel 
              jobId={app.job_id} 
              applicationId={app.id} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

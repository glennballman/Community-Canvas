import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Briefcase, Building2, Calendar, ChevronRight, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Application {
  id: string;
  job_id: string;
  application_number: string;
  status: string;
  submitted_at: string | null;
  job_title: string;
  company_name: string;
  portal_name: string;
  has_unread_messages: boolean;
}

interface ApplicationsResponse {
  ok: boolean;
  applications: Application[];
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

export default function MyApplicationsPage() {
  const { data, isLoading, error } = useQuery<ApplicationsResponse>({
    queryKey: ['/api/participant/applications'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="page-my-applications-loading">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" data-testid="page-my-applications-error">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Failed to load your applications. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const applications = data?.applications || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-my-applications">
      <div className="flex items-center gap-3">
        <Briefcase className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold">My Applications</h1>
          <p className="text-sm text-muted-foreground">
            Track your job applications and messages
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>You haven't applied to any jobs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3">
            {applications.map((app) => (
              <Link
                key={app.id}
                to={`/app/participant/applications/${app.id}`}
                data-testid={`application-card-${app.id}`}
              >
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{app.job_title}</span>
                          <Badge className={STATUS_COLORS[app.status]} variant="secondary">
                            {STATUS_LABELS[app.status] || app.status}
                          </Badge>
                          {app.has_unread_messages && (
                            <Badge variant="default" className="gap-1">
                              <MessageSquare className="h-3 w-3" />
                              New
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {app.company_name || app.portal_name}
                          </span>
                          {app.submitted_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Applied {new Date(app.submitted_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

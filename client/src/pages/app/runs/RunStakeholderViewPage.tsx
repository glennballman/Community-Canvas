import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, Clock, MapPin, Calendar, CheckCircle, AlertCircle, Loader2,
  Bell, Building2, User, Shield, MessageSquare, Check, HelpCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';

interface StakeholderRunView {
  id: string;
  name: string;
  market_mode: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_end_time: string | null;
  run_date: string | null;
  status: string | null;
  publishing_state: string | null;
  zone_name: string | null;
  tenant_name: string | null;
}

interface LatestResponse {
  id: string;
  response_type: 'confirm' | 'request_change' | 'question';
  message: string | null;
  responded_at: string;
}

interface AccessInfo {
  type: 'stakeholder' | 'tenant_owner';
  stakeholder_role: string | null;
  granted_at: string | null;
  latest_response: LatestResponse | null;
}

interface StakeholderViewResponse {
  ok: boolean;
  run: StakeholderRunView;
  access: AccessInfo;
  error?: string;
}

interface StakeholderResponseItem {
  id: string;
  response_type: 'confirm' | 'request_change' | 'question';
  message: string | null;
  responded_at: string;
}

interface ResponsesListResponse {
  ok: boolean;
  responses: StakeholderResponseItem[];
}

const stakeholderResponseFormSchema = z.object({
  response_type: z.enum(['confirm', 'request_change', 'question'], {
    required_error: 'Please select a response type',
  }),
  message: z.string().max(2000, 'Message must be 2000 characters or less').optional(),
});

type StakeholderResponseFormData = z.infer<typeof stakeholderResponseFormSchema>;

function formatRole(role: string | null): string {
  if (!role) return 'Stakeholder';
  return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'completed':
      return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" data-testid="badge-status-completed"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
    case 'cancelled':
      return <Badge variant="destructive" data-testid="badge-status-cancelled">Cancelled</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" data-testid="badge-status-in-progress"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-default">{status || 'Scheduled'}</Badge>;
  }
}

function getResponseTypeIcon(type: string) {
  switch (type) {
    case 'confirm':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'request_change':
      return <RefreshCw className="w-4 h-4 text-amber-600" />;
    case 'question':
      return <HelpCircle className="w-4 h-4 text-blue-600" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
}

function getResponseTypeLabel(type: string, resolve: (key: string) => string) {
  switch (type) {
    case 'confirm':
      return resolve('stakeholder.response.type.confirm') || 'Confirm';
    case 'request_change':
      return resolve('stakeholder.response.type.request_change') || 'Request change';
    case 'question':
      return resolve('stakeholder.response.type.question') || 'Ask a question';
    default:
      return type;
  }
}

export default function RunStakeholderViewPage() {
  const { id } = useParams<{ id: string }>();
  const { resolve } = useCopy({ entryPoint: 'service' });
  const queryClient = useQueryClient();

  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<StakeholderResponseFormData>({
    resolver: zodResolver(stakeholderResponseFormSchema),
    defaultValues: {
      response_type: 'confirm',
      message: '',
    },
  });

  const { data, isLoading, error } = useQuery<StakeholderViewResponse>({
    queryKey: ['/api/runs', id, 'view'],
    enabled: !!id,
  });

  const { data: responsesData, isLoading: responsesLoading, error: responsesError } = useQuery<ResponsesListResponse>({
    queryKey: ['/api/runs', id, 'responses'],
    enabled: !!id && !!data?.ok,
  });

  const submitMutation = useMutation({
    mutationFn: async (body: StakeholderResponseFormData) => {
      return apiRequest('POST', `/api/runs/${id}/respond`, {
        response_type: body.response_type,
        message: body.message?.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/runs', id, 'view'] });
      queryClient.invalidateQueries({ queryKey: ['/api/runs', id, 'responses'] });
      form.reset({ response_type: 'confirm', message: '' });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const onSubmit = (data: StakeholderResponseFormData) => {
    submitMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-stakeholder-view">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" data-testid="error-stakeholder-view">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have access to this service run. The invitation may have been revoked or expired.
        </p>
        <Button variant="outline" asChild data-testid="button-back-notifications">
          <Link href="/app/notifications">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Notifications
          </Link>
        </Button>
      </div>
    );
  }

  const { run, access } = data;
  const responses = responsesData?.responses || [];
  const latestResponse = access.latest_response;

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4" data-testid="stakeholder-run-view">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild data-testid="button-back">
          <Link href="/app/notifications">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="run-name">{run.name}</h1>
          <p className="text-muted-foreground text-sm" data-testid="run-tenant">
            <Building2 className="w-3 h-3 inline mr-1" />
            {run.tenant_name || 'Service Provider'}
          </p>
        </div>
        {getStatusBadge(run.status)}
      </div>

      <Card className="mb-6" data-testid="card-access-info">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Your Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm" data-testid="access-role">
                You have access as: <strong>{formatRole(access.stakeholder_role)}</strong>
              </span>
            </div>
            {access.granted_at && (
              <Badge variant="outline" className="text-xs" data-testid="access-granted-date">
                Granted {new Date(access.granted_at).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6" data-testid="card-response-form">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {resolve('stakeholder.response.title') || 'Your Response'}
          </CardTitle>
          <CardDescription>
            {resolve('stakeholder.response.help') || 'Send a response to the service provider.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestResponse && (
            <div className="p-3 rounded-md bg-muted/50 border mb-4" data-testid="current-response">
              <p className="text-xs text-muted-foreground mb-1">
                {resolve('stakeholder.response.current') || 'Your current response'}
              </p>
              <div className="flex items-center gap-2">
                {getResponseTypeIcon(latestResponse.response_type)}
                <span className="font-medium text-sm">
                  {getResponseTypeLabel(latestResponse.response_type, resolve)}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(latestResponse.responded_at).toLocaleString()}
                </span>
              </div>
              {latestResponse.message && (
                <p className="text-sm text-muted-foreground mt-2 pl-6">{latestResponse.message}</p>
              )}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="response_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{resolve('stakeholder.response.type.label') || 'Response type'}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex flex-col gap-3"
                        data-testid="radio-response-type"
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="confirm" id="confirm" data-testid="radio-confirm" />
                          <label htmlFor="confirm" className="flex items-center gap-2 cursor-pointer text-sm">
                            <Check className="w-4 h-4 text-green-600" />
                            {resolve('stakeholder.response.type.confirm') || 'Confirm'}
                          </label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="request_change" id="request_change" data-testid="radio-request-change" />
                          <label htmlFor="request_change" className="flex items-center gap-2 cursor-pointer text-sm">
                            <RefreshCw className="w-4 h-4 text-amber-600" />
                            {resolve('stakeholder.response.type.request_change') || 'Request change'}
                          </label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="question" id="question" data-testid="radio-question" />
                          <label htmlFor="question" className="flex items-center gap-2 cursor-pointer text-sm">
                            <HelpCircle className="w-4 h-4 text-blue-600" />
                            {resolve('stakeholder.response.type.question') || 'Ask a question'}
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {resolve('stakeholder.response.message.label') || 'Message (optional)'}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={resolve('stakeholder.response.message.placeholder') || 'Add details for the service provider…'}
                        className="min-h-[80px]"
                        data-testid="textarea-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4 flex-wrap">
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-response"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    resolve('stakeholder.response.submit') || 'Send Response'
                  )}
                </Button>
                {showSuccess && (
                  <span className="text-sm text-green-600 dark:text-green-400" data-testid="success-message">
                    {resolve('stakeholder.response.success') || 'Response sent.'}
                  </span>
                )}
                {submitMutation.isError && (
                  <span className="text-sm text-destructive" data-testid="error-message">
                    Failed to send response. Please try again.
                  </span>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {responsesLoading && (
        <Card className="mb-6" data-testid="card-response-history-loading">
          <CardContent className="py-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading responses...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {responsesError && (
        <Card className="mb-6" data-testid="card-response-history-error">
          <CardContent className="py-6">
            <div className="flex items-center justify-center text-muted-foreground">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm">Failed to load response history</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!responsesLoading && !responsesError && responses.length > 1 && (
        <Card className="mb-6" data-testid="card-response-history">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {resolve('stakeholder.response.history.title') || 'Previous Responses'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {responses.slice(1, 10).map((resp) => (
                <div 
                  key={resp.id} 
                  className="flex items-start gap-3 p-2 rounded-md bg-muted/30"
                  data-testid={`response-history-${resp.id}`}
                >
                  {getResponseTypeIcon(resp.response_type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {getResponseTypeLabel(resp.response_type, resolve)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(resp.responded_at).toLocaleString()}
                      </span>
                    </div>
                    {resp.message && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{resp.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6" data-testid="card-run-details">
        <CardHeader>
          <CardTitle className="text-base">Service Run Details</CardTitle>
          <CardDescription>
            Information about this scheduled service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {run.scheduled_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Scheduled Date</p>
                  <p className="text-sm text-muted-foreground" data-testid="scheduled-date">
                    {new Date(run.scheduled_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            
            {run.scheduled_time && (
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-sm text-muted-foreground" data-testid="scheduled-time">
                    {run.scheduled_time}
                    {run.scheduled_end_time && ` - ${run.scheduled_end_time}`}
                  </p>
                </div>
              </div>
            )}

            {run.zone_name && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground" data-testid="zone-name">
                    {run.zone_name}
                  </p>
                </div>
              </div>
            )}

            {run.market_mode && (
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Type</p>
                  <Badge variant="outline" className="mt-1" data-testid="market-mode">
                    {run.market_mode.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {run.publishing_state && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Publishing Status:</span>
                <Badge variant="secondary" data-testid="publishing-state">
                  {run.publishing_state}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" asChild data-testid="button-back-notifications-bottom">
          <Link href="/app/notifications">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Notifications
          </Link>
        </Button>
      </div>
    </div>
  );
}

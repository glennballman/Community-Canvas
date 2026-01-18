/**
 * N3 Service Run Monitor Detail Page
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Shows detailed monitor information for a specific service run
 */

import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  RefreshCw, 
  Calendar, 
  MapPin,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  useN3MonitorDetail, 
  useN3TakeAction, 
  useN3TriggerEvaluation,
  useN3DismissBundle
} from '@/hooks/n3/useN3';
import { SegmentList } from '@/components/n3/SegmentList';
import { SignalBadges, RiskScoreBadge } from '@/components/n3/SignalBadges';
import { ReplanOptionCard } from '@/components/n3/ReplanOptionCard';
import { useToast } from '@/hooks/use-toast';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function ServiceRunMonitorPage() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { 
    data, 
    isLoading, 
    refetch,
    isRefetching 
  } = useN3MonitorDetail(runId || '', TEST_TENANT_ID);

  const actionMutation = useN3TakeAction(TEST_TENANT_ID);
  const evaluateMutation = useN3TriggerEvaluation(TEST_TENANT_ID);
  const dismissMutation = useN3DismissBundle(TEST_TENANT_ID);

  const handleTakeAction = async (
    bundleId: string,
    optionId: string, 
    actionKind: 'suggest' | 'request' | 'dictate'
  ) => {
    try {
      await actionMutation.mutateAsync({ bundleId, optionId, actionKind });
      toast({
        title: 'Action taken',
        description: `Replan option ${actionKind === 'dictate' ? 'applied' : actionKind + 'ed'} successfully.`,
      });
      refetch();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to take action.',
        variant: 'destructive',
      });
    }
  };

  const handleTriggerEvaluation = async () => {
    if (!runId) return;
    try {
      await evaluateMutation.mutateAsync({ runId });
      toast({
        title: 'Evaluation triggered',
        description: 'Service run re-evaluated successfully.',
      });
      refetch();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to trigger evaluation.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!data?.run) {
    return (
      <div className="container max-w-4xl mx-auto p-6" data-testid="monitor-not-found">
        <Button variant="ghost" onClick={() => setLocation('/app/n3/attention')} data-testid="button-back-not-found">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-12">
          <h2 className="text-lg font-medium" data-testid="text-not-found-title">Run not found</h2>
          <p className="text-muted-foreground" data-testid="text-not-found-message">The requested service run could not be found.</p>
        </div>
      </div>
    );
  }

  const { run, segments, monitorState, bundles } = data;
  const openBundle = bundles?.find(b => b.status === 'open');
  const affectedSegmentIds = openBundle?.bundle?.findings?.map(f => f.segmentId) || [];

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6" data-testid="monitor-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/app/n3/attention')} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-run-name">{run.name}</h1>
            {run.description && (
              <p className="text-muted-foreground">{run.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerEvaluation}
            disabled={evaluateMutation.isPending}
            data-testid="trigger-evaluation"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
            Re-evaluate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Starts</span>
            </div>
            <div className="font-medium mt-1">
              {run.startsAt ? format(new Date(run.startsAt), 'MMM d, yyyy h:mm a') : 'TBD'}
            </div>
            {run.startsAt && (
              <div className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(run.startsAt), { addSuffix: true })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last Check</span>
            </div>
            <div className="font-medium mt-1">
              {monitorState?.lastCheckedAt 
                ? formatDistanceToNow(new Date(monitorState.lastCheckedAt), { addSuffix: true })
                : 'Never'}
            </div>
            {monitorState?.nextCheckAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Next: {formatDistanceToNow(new Date(monitorState.nextCheckAt), { addSuffix: true })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Risk Score</span>
            </div>
            <div className="mt-2">
              {monitorState?.lastRiskScore ? (
                <RiskScoreBadge 
                  score={parseFloat(monitorState.lastRiskScore)} 
                  level={
                    parseFloat(monitorState.lastRiskScore) >= 0.85 ? 'critical' :
                    parseFloat(monitorState.lastRiskScore) >= 0.6 ? 'high' :
                    parseFloat(monitorState.lastRiskScore) >= 0.35 ? 'medium' : 'low'
                  }
                />
              ) : (
                <Badge variant="outline">Not evaluated</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Segments ({segments?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <SegmentList 
              segments={segments || []} 
              highlightSegmentIds={affectedSegmentIds}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {openBundle && (
            <Card className="border-orange-500 border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Active Replan Bundle
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissMutation.mutate({ bundleId: openBundle.bundleId })}
                    data-testid="dismiss-active-bundle"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <SignalBadges 
                    findings={openBundle.bundle?.findings || []} 
                  />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {openBundle.summary}
                </p>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Replan Options</h4>
                  {openBundle.options?.map(option => (
                    <ReplanOptionCard
                      key={option.id}
                      option={option}
                      onSelect={(optionId, actionKind) => 
                        handleTakeAction(openBundle.bundleId, optionId, actionKind)
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!openBundle && bundles && bundles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Bundles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bundles.slice(0, 5).map(bundle => (
                    <div 
                      key={bundle.bundleId}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div>
                        <Badge variant={bundle.status === 'actioned' ? 'default' : 'secondary'}>
                          {bundle.status}
                        </Badge>
                        <span className="text-sm ml-2">
                          {formatDistanceToNow(new Date(bundle.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {bundle.riskDelta}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!bundles || bundles.length === 0) && !openBundle && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No replan bundles for this run yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleTriggerEvaluation}
                  disabled={evaluateMutation.isPending}
                >
                  Trigger Evaluation
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

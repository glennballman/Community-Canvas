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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Calendar, 
  MapPin,
  Clock,
  AlertTriangle,
  FileText,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  useN3MonitorDetail, 
  useN3TakeAction, 
  useN3TriggerEvaluation,
  useN3DismissBundle,
  useN3Zones,
  useN3AssignZone,
  useN3Portals,
  useN3AssignPortal
} from '@/hooks/n3/useN3';
import { SegmentList } from '@/components/n3/SegmentList';
import { SignalBadges, RiskScoreBadge } from '@/components/n3/SignalBadges';
import { ReplanOptionCard } from '@/components/n3/ReplanOptionCard';
import { ZoneBadge } from '@/components/ZoneBadge';
import { ZoneImpactSummary } from '@/components/ZoneImpactSummary';
import { useToast } from '@/hooks/use-toast';
import { usePromoteN3Run, useDemoteN3Run } from '@/hooks/useCoordination';
import { RotateCcw } from 'lucide-react';
import type { ZonePricingModifiers } from '@shared/zonePricing';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function ServiceRunMonitorPage() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Promote flow state
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [promoteNote, setPromoteNote] = useState('');
  const [promoteWarnings, setPromoteWarnings] = useState<string[]>([]);
  
  // Demote flow state
  const [showDemoteConfirm, setShowDemoteConfirm] = useState(false);
  const [demoteNote, setDemoteNote] = useState('');

  const { 
    data, 
    isLoading, 
    refetch,
    isRefetching 
  } = useN3MonitorDetail(runId || '', TEST_TENANT_ID);

  const actionMutation = useN3TakeAction(TEST_TENANT_ID);
  const evaluateMutation = useN3TriggerEvaluation(TEST_TENANT_ID);
  const dismissMutation = useN3DismissBundle(TEST_TENANT_ID);
  const assignZoneMutation = useN3AssignZone(TEST_TENANT_ID);
  const assignPortalMutation = useN3AssignPortal(TEST_TENANT_ID);
  const promoteMutation = usePromoteN3Run();
  const demoteMutation = useDemoteN3Run();
  
  const portalId = data?.run?.portal_id || null;
  const { data: portalsData } = useN3Portals(TEST_TENANT_ID);
  const portals = portalsData?.portals || [];
  const { data: zonesData } = useN3Zones(portalId, TEST_TENANT_ID);
  const zones = zonesData?.zones || [];

  const handlePortalChange = async (selectedPortalId: string) => {
    if (!runId || selectedPortalId === 'none') return;
    try {
      await assignPortalMutation.mutateAsync({ runId, portalId: selectedPortalId });
      toast({
        title: 'Portal assigned',
        description: 'Portal and zone defaulting applied successfully.',
      });
    } catch (err) {
      toast({
        title: 'Failed to assign portal',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleZoneChange = async (zoneId: string) => {
    if (!runId) return;
    const actualZoneId = zoneId === 'none' ? null : zoneId;
    try {
      await assignZoneMutation.mutateAsync({ runId, zoneId: actualZoneId });
      toast({
        title: 'Zone updated',
        description: actualZoneId ? 'Zone assigned successfully.' : 'Zone removed.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update zone.',
        variant: 'destructive',
      });
    }
  };

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

  const handlePromote = async () => {
    if (!runId) return;
    try {
      const result = await promoteMutation.mutateAsync({ 
        runId, 
        note: promoteNote || undefined,
      });
      
      if (result.warnings && result.warnings.length > 0) {
        setPromoteWarnings(result.warnings);
      }
      
      toast({
        title: 'Service run scheduled',
        description: 'No notifications sent. The run is now eligible for planning.',
      });
      setShowPromoteConfirm(false);
      setPromoteNote('');
      refetch();
    } catch (err) {
      toast({
        title: 'Promotion failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDemote = async () => {
    if (!runId) return;
    try {
      await demoteMutation.mutateAsync({ 
        runId, 
        note: demoteNote || undefined,
      });
      
      toast({
        title: 'Run reverted to draft',
        description: 'Draft runs are internal only and do not notify contractors.',
      });
      setShowDemoteConfirm(false);
      setDemoteNote('');
      refetch();
    } catch (err) {
      toast({
        title: 'Demotion failed',
        description: err instanceof Error ? err.message : 'Unknown error',
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

      {run.status === 'draft' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4" data-testid="banner-draft-status">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Draft Service Run
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This Service Run is in draft status. Configure the run details, then schedule it to make it active. 
                Draft runs are not visible to contractors and do not trigger notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {run.status === 'draft' && (
        <Card data-testid="card-promote-run">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Promote Draft Service Run
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will mark the service run as scheduled, making it eligible for planning and future actions.
              No contractors will be notified and no charges will occur.
            </p>

            {!showPromoteConfirm ? (
              <Button 
                onClick={() => setShowPromoteConfirm(true)}
                data-testid="button-promote-run"
              >
                Promote to Scheduled
              </Button>
            ) : (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Promotion note (optional)
                  </label>
                  <Textarea
                    placeholder="Add a note for your records..."
                    value={promoteNote}
                    onChange={(e) => setPromoteNote(e.target.value.slice(0, 280))}
                    className="resize-none"
                    rows={2}
                    data-testid="input-promote-note"
                  />
                  <p className="text-xs text-muted-foreground">
                    {promoteNote.length}/280 characters
                  </p>
                </div>

                <div className="rounded-lg bg-muted p-3 space-y-1">
                  <p className="text-sm font-medium">
                    Are you sure you want to promote this draft service run to scheduled?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This action is reversible. No contractors will be notified.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handlePromote}
                    disabled={promoteMutation.isPending}
                    data-testid="button-confirm-promote"
                  >
                    {promoteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Promoting...
                      </>
                    ) : (
                      'Confirm Promote'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPromoteConfirm(false);
                      setPromoteNote('');
                    }}
                    disabled={promoteMutation.isPending}
                    data-testid="button-cancel-promote"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {promoteWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3" data-testid="banner-promote-warnings">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              {promoteWarnings.includes('ZONE_NOT_ASSIGNED') && (
                <p>This run was scheduled without a zone assignment.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {run.status === 'scheduled' && (
        <Card className="border-amber-200 dark:border-amber-800" data-testid="card-demote-run">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <RotateCcw className="h-5 w-5" />
              Revert to Draft
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will return the service run to draft. Draft runs are not visible to contractors 
              and do not trigger execution.
            </p>

            {!showDemoteConfirm ? (
              <Button 
                variant="outline"
                onClick={() => setShowDemoteConfirm(true)}
                data-testid="button-demote-run"
              >
                Revert to Draft
              </Button>
            ) : (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Why are you reverting this run? (optional)
                  </label>
                  <Textarea
                    placeholder="Why are you reverting this run?"
                    value={demoteNote}
                    onChange={(e) => setDemoteNote(e.target.value.slice(0, 280))}
                    className="resize-none"
                    rows={2}
                    data-testid="input-demote-note"
                  />
                  <p className="text-xs text-muted-foreground">
                    {demoteNote.length}/280 characters
                  </p>
                </div>

                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Confirm revert to draft?
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This action is reversible. No contractors will be notified.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDemote}
                    disabled={demoteMutation.isPending}
                    data-testid="button-confirm-demote"
                  >
                    {demoteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reverting...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDemoteConfirm(false);
                      setDemoteNote('');
                    }}
                    disabled={demoteMutation.isPending}
                    data-testid="button-cancel-demote"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {!portalId && portals.length > 0 && (
        <Card data-testid="portal-assignment-card" className="border-amber-500 border-2 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Portal Required for Zone Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a portal to enable zone assignment and pricing estimates.
            </p>
            <div className="flex items-center gap-4">
              <Select 
                onValueChange={handlePortalChange}
                disabled={assignPortalMutation.isPending}
              >
                <SelectTrigger className="w-64" data-testid="select-portal">
                  <SelectValue placeholder="Select portal..." />
                </SelectTrigger>
                <SelectContent>
                  {portals.map(portal => (
                    <SelectItem key={portal.id} value={portal.id}>
                      {portal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignPortalMutation.isPending && (
                <span className="text-sm text-muted-foreground">Assigning...</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {portalId && (
        <Card data-testid="zone-assignment-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Zone Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select 
                value={data?.zone_id || 'none'} 
                onValueChange={handleZoneChange}
                disabled={assignZoneMutation.isPending}
              >
                <SelectTrigger className="w-48" data-testid="select-zone">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No zone</SelectItem>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.badge_label_resident || zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data?.zone_id && data?.zone_name && (
                <ZoneBadge
                  zone={{
                    id: data.zone_id,
                    name: data.zone_name,
                    key: data.zone_key || '',
                    badge_label_resident: data.badge_label_resident || null,
                    badge_label_contractor: data.badge_label_contractor || null,
                    badge_label_visitor: data.badge_label_visitor || null,
                  }}
                  viewerContext="resident"
                />
              )}
            </div>
            {data?.zone_id && data?.zone_name && data?.pricing_modifiers && (
              <ZoneImpactSummary
                zone={{
                  id: data.zone_id,
                  name: data.zone_name,
                  key: data.zone_key || '',
                  badge_label_resident: data.badge_label_resident || null,
                  badge_label_contractor: data.badge_label_contractor || null,
                  badge_label_visitor: data.badge_label_visitor || null,
                  pricingModifiers: data.pricing_modifiers as ZonePricingModifiers,
                }}
                baseEstimate={data.zone_pricing_estimate?.base_estimate}
                viewerContext="resident"
              />
            )}
          </CardContent>
        </Card>
      )}

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

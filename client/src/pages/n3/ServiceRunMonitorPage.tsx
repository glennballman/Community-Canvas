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
  ArrowUp,
  ArrowDown,
  RefreshCw, 
  Calendar, 
  MapPin,
  Clock,
  AlertTriangle,
  FileText,
  FileCheck,
  Loader2,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
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
  useN3AssignPortal,
  useN3AttachedMaintenanceRequests,
  useN3EligibleMaintenanceRequests,
  useN3AttachMaintenanceRequests,
  useN3DetachMaintenanceRequests,
  useN3ReadinessDrift,
  useN3ReadinessSnapshot,
  useLockN3Readiness,
  useUnlockN3Readiness,
  useN3ExecutionEligibility,
  useN3ExecutionHandoff,
  useCreateN3ExecutionHandoff,
} from '@/hooks/n3/useN3';
import { SegmentList } from '@/components/n3/SegmentList';
import { SignalBadges, RiskScoreBadge } from '@/components/n3/SignalBadges';
import { ReplanOptionCard } from '@/components/n3/ReplanOptionCard';
import { ZoneBadge } from '@/components/ZoneBadge';
import { ZoneImpactSummary } from '@/components/ZoneImpactSummary';
import { useToast } from '@/hooks/use-toast';
import { usePromoteN3Run, useDemoteN3Run } from '@/hooks/useCoordination';
import { RotateCcw, Link2, Link2Off, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  
  // Attach maintenance requests flow state (Prompt 28)
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [includeUnzoned, setIncludeUnzoned] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

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
  const attachMutation = useN3AttachMaintenanceRequests(TEST_TENANT_ID);
  const detachMutation = useN3DetachMaintenanceRequests(TEST_TENANT_ID);
  
  const portalId = data?.run?.portal_id || null;
  const { data: portalsData } = useN3Portals(TEST_TENANT_ID);
  const portals = portalsData?.portals || [];
  const { data: zonesData } = useN3Zones(portalId, TEST_TENANT_ID);
  const zones = zonesData?.zones || [];
  
  // Attached maintenance requests (Prompt 28)
  const { data: attachedData, refetch: refetchAttached } = useN3AttachedMaintenanceRequests(
    runId, 
    TEST_TENANT_ID
  );
  const attachedRequests = attachedData?.items || [];
  
  // Eligible requests for attach modal
  const { data: eligibleData, refetch: refetchEligible } = useN3EligibleMaintenanceRequests(
    showAttachModal ? runId : undefined,
    TEST_TENANT_ID,
    { category: categoryFilter, include_unzoned: includeUnzoned }
  );
  
  // Readiness drift (Prompt 29) - only fetch for draft/scheduled runs with attached requests
  const runStatus = data?.run?.status;
  const shouldFetchDrift = runId && (runStatus === 'draft' || runStatus === 'scheduled') && attachedRequests.length > 0;
  const { data: driftData } = useN3ReadinessDrift(
    shouldFetchDrift ? runId : undefined,
    TEST_TENANT_ID
  );
  
  // Readiness lock/snapshot (Prompt 30)
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [lockNote, setLockNote] = useState('');
  const shouldFetchSnapshot = runId && (runStatus === 'draft' || runStatus === 'scheduled');
  const { data: snapshotData, refetch: refetchSnapshot } = useN3ReadinessSnapshot(
    shouldFetchSnapshot ? runId : undefined,
    TEST_TENANT_ID
  );
  const lockMutation = useLockN3Readiness(runId || '', TEST_TENANT_ID);
  const unlockMutation = useUnlockN3Readiness(runId || '', TEST_TENANT_ID);
  
  // Execution eligibility (Prompt 31) - only fetch when snapshot is locked
  const snapshotLockedAt = snapshotData?.locked ? snapshotData.snapshot?.locked_at : null;
  const { data: eligibilityData } = useN3ExecutionEligibility(
    snapshotLockedAt ? runId : undefined,
    TEST_TENANT_ID,
    snapshotLockedAt
  );
  
  // Execution handoff (Prompt 32) - read-only contract of intent
  const [handoffNote, setHandoffNote] = useState('');
  const { data: handoffData, isError: handoffNotFound } = useN3ExecutionHandoff(
    runId,
    TEST_TENANT_ID
  );
  const createHandoffMutation = useCreateN3ExecutionHandoff(runId || '', TEST_TENANT_ID);

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

  const handleAttachRequests = async () => {
    if (!runId || selectedRequestIds.length === 0) return;
    try {
      await attachMutation.mutateAsync({ 
        runId, 
        maintenanceRequestIds: selectedRequestIds 
      });
      toast({
        title: 'Requests attached',
        description: `${selectedRequestIds.length} request(s) attached for planning.`,
      });
      setShowAttachModal(false);
      setSelectedRequestIds([]);
      refetchAttached();
    } catch (err) {
      toast({
        title: 'Attach failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDetachRequest = async (maintenanceRequestId: string) => {
    if (!runId) return;
    try {
      await detachMutation.mutateAsync({ 
        runId, 
        maintenanceRequestIds: [maintenanceRequestId] 
      });
      toast({
        title: 'Request detached',
        description: 'Request removed from planning.',
      });
      refetchAttached();
    } catch (err) {
      toast({
        title: 'Detach failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
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

      {run.status === 'draft' && (
        <Card data-testid="card-attached-maintenance-requests">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Coordination-Opt-In Requests
                </CardTitle>
                <Badge variant="secondary" className="text-xs">internal only</Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAttachModal(true)}
                data-testid="button-attach-requests"
              >
                Attach requests
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Attached for planning only. No one is notified.
            </p>
            
            {attachedRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No requests attached yet.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Request #</th>
                      <th className="text-left p-2 font-medium">Category</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">Zone</th>
                      <th className="text-left p-2 font-medium">Attached</th>
                      <th className="text-right p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachedRequests.map((req) => (
                      <tr key={req.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{req.request_number}</td>
                        <td className="p-2">{req.category}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {req.status}
                          </Badge>
                        </td>
                        <td className="p-2">
                          {req.zone_id && zones.find(z => z.id === req.zone_id) ? (
                            <ZoneBadge 
                              zone={{
                                id: req.zone_id,
                                key: zones.find(z => z.id === req.zone_id)?.key || '',
                                name: zones.find(z => z.id === req.zone_id)?.name || '',
                                badge_label_resident: zones.find(z => z.id === req.zone_id)?.badge_label_resident || null,
                                badge_label_contractor: zones.find(z => z.id === req.zone_id)?.badge_label_contractor || null,
                                badge_label_visitor: zones.find(z => z.id === req.zone_id)?.badge_label_visitor || null,
                              }}
                              viewerContext="resident" 
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground text-xs">
                          {req.attached_at ? format(new Date(req.attached_at), 'MMM d, h:mm a') : '—'}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDetachRequest(req.maintenance_request_id)}
                            disabled={detachMutation.isPending}
                            data-testid={`button-detach-${req.maintenance_request_id}`}
                          >
                            <Link2Off className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {attachedData && attachedData.total_attached > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Total: {attachedData.total_attached}</span>
                {Object.entries(attachedData.counts_by_category).map(([cat, count]) => (
                  <span key={cat}>{cat}: {count}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Readiness Drift Card (Prompt 29) - Advisory warnings for drift */}
      {(run.status === 'draft' || run.status === 'scheduled') && 
       attachedRequests.length > 0 && 
       driftData && 
       driftData.totals.with_drift > 0 && (
        <Card data-testid="card-readiness-drift">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Readiness Drift (Advisory)
              </CardTitle>
              <Badge variant="outline" className="text-xs">advisory only</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These signals indicate changes since this run was planned. No action is required.
            </p>
            
            <div className="space-y-2">
              {driftData.drift.coordination_opt_out && driftData.drift.coordination_opt_out.count > 0 && (
                <div 
                  className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                  data-testid="drift-coordination-opt-out"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Requests opted out of coordination
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {driftData.drift.coordination_opt_out.count}
                  </Badge>
                </div>
              )}
              
              {driftData.drift.zone_mismatch && driftData.drift.zone_mismatch.count > 0 && (
                <div 
                  className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                  data-testid="drift-zone-mismatch"
                >
                  <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Zone mismatch or unzoned
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {driftData.drift.zone_mismatch.count}
                  </Badge>
                </div>
              )}
              
              {driftData.drift.inactive_status && driftData.drift.inactive_status.count > 0 && (
                <div 
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border"
                  data-testid="drift-inactive-status"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Requests no longer active
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {driftData.drift.inactive_status.count}
                  </Badge>
                </div>
              )}
              
              {driftData.drift.age_exceeded && driftData.drift.age_exceeded.count > 0 && (
                <div 
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border"
                  data-testid="drift-age-exceeded"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Opt-in older than {driftData.drift.age_exceeded.threshold_days} days
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {driftData.drift.age_exceeded.count}
                  </Badge>
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              You may want to review attachments, update zones, or revert this run to draft.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Readiness Lock Card (Prompt 30) - Pre-execution snapshot */}
      {(run.status === 'draft' || run.status === 'scheduled') && snapshotData && (
        <Card data-testid="card-readiness-lock">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {snapshotData.locked ? (
                  <Lock className="h-5 w-5 text-green-500" />
                ) : (
                  <Unlock className="h-5 w-5 text-muted-foreground" />
                )}
                Readiness Lock
              </CardTitle>
              {snapshotData.locked && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  Locked
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!snapshotData.locked ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Lock the current state as a planning snapshot before execution. This captures what you believed was true at this moment.
                </p>
                <div className="space-y-2">
                  <label htmlFor="lock-note" className="text-sm font-medium">
                    Note (optional)
                  </label>
                  <Textarea
                    id="lock-note"
                    placeholder="Any notes about this lock..."
                    value={lockNote}
                    onChange={(e) => setLockNote(e.target.value)}
                    className="resize-none"
                    maxLength={500}
                    data-testid="input-lock-note"
                  />
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await lockMutation.mutateAsync(lockNote || undefined);
                      toast({
                        title: 'Readiness locked',
                        description: 'A snapshot of the current state has been captured.',
                      });
                      setLockNote('');
                      refetchSnapshot();
                    } catch (err: any) {
                      toast({
                        title: 'Failed to lock',
                        description: err.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                  disabled={lockMutation.isPending}
                  data-testid="button-lock-readiness"
                >
                  {lockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Lock Readiness
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Locked {snapshotData.snapshot?.locked_at ? formatDistanceToNow(new Date(snapshotData.snapshot.locked_at), { addSuffix: true }) : 'recently'}
                    </span>
                  </div>
                  {snapshotData.snapshot?.note && (
                    <div className="p-2 rounded bg-muted text-sm">
                      {snapshotData.snapshot.note}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>
                      {snapshotData.snapshot?.payload.summary.total_attached} requests captured
                      ({snapshotData.snapshot?.payload.summary.opted_in_count} opted-in, {snapshotData.snapshot?.payload.summary.opted_out_count} opted-out)
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSnapshotDialog(true)}
                    data-testid="button-view-snapshot"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Snapshot
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await unlockMutation.mutateAsync();
                        toast({
                          title: 'Readiness unlocked',
                          description: 'The snapshot has been deleted.',
                        });
                        refetchSnapshot();
                      } catch (err: any) {
                        toast({
                          title: 'Failed to unlock',
                          description: err.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                    disabled={unlockMutation.isPending}
                    data-testid="button-unlock-readiness"
                  >
                    {unlockMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Unlock className="h-4 w-4 mr-2" />
                    )}
                    Unlock
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution Eligibility Gate Card (Prompt 31) - Advisory only */}
      {(run.status === 'draft' || run.status === 'scheduled') && 
       snapshotData?.locked && 
       eligibilityData && (
        <Card data-testid="card-execution-eligibility">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                Execution Eligibility (Advisory)
              </CardTitle>
              <Badge 
                variant="outline" 
                className={
                  eligibilityData.eligibility.overall === 'degraded' 
                    ? 'text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400' 
                    : eligibilityData.eligibility.overall === 'improved'
                      ? 'text-green-600 border-green-600 dark:text-green-400 dark:border-green-400'
                      : 'text-muted-foreground'
                }
                data-testid="badge-eligibility-overall"
              >
                {eligibilityData.eligibility.overall}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Delta Summary - only show non-zero deltas */}
            {Object.keys(eligibilityData.deltas).length > 0 ? (
              <div className="space-y-3">
                {eligibilityData.deltas.attachments && (
                  <div 
                    className="flex items-center gap-2 text-sm"
                    data-testid="delta-attachments"
                  >
                    {eligibilityData.deltas.attachments.attached_count_delta > 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>
                      {Math.abs(eligibilityData.deltas.attachments.attached_count_delta)} 
                      {eligibilityData.deltas.attachments.attached_count_delta > 0 ? ' more' : ' fewer'} attached requests since snapshot
                    </span>
                  </div>
                )}
                
                {eligibilityData.deltas.coordination && (
                  <div 
                    className="flex items-center gap-2 text-sm"
                    data-testid="delta-coordination"
                  >
                    {eligibilityData.deltas.coordination.coord_ready_count_delta >= 0 ? (
                      <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>
                      {Math.abs(eligibilityData.deltas.coordination.coord_ready_count_delta)} 
                      {eligibilityData.deltas.coordination.coord_ready_count_delta >= 0 ? ' more' : ' fewer'} coordination-ready requests since snapshot
                    </span>
                  </div>
                )}
                
                {eligibilityData.deltas.readiness_drift && (
                  <div className="space-y-1" data-testid="delta-drift">
                    {eligibilityData.deltas.readiness_drift.coordination_opt_out !== undefined && 
                     eligibilityData.deltas.readiness_drift.coordination_opt_out !== 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        {eligibilityData.deltas.readiness_drift.coordination_opt_out > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                        <span>
                          {Math.abs(eligibilityData.deltas.readiness_drift.coordination_opt_out)} 
                          {eligibilityData.deltas.readiness_drift.coordination_opt_out > 0 ? ' more' : ' fewer'} coordination opt-outs
                        </span>
                      </div>
                    )}
                    {eligibilityData.deltas.readiness_drift.zone_mismatch !== undefined && 
                     eligibilityData.deltas.readiness_drift.zone_mismatch !== 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        {eligibilityData.deltas.readiness_drift.zone_mismatch > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                        <span>
                          {Math.abs(eligibilityData.deltas.readiness_drift.zone_mismatch)} 
                          {eligibilityData.deltas.readiness_drift.zone_mismatch > 0 ? ' more' : ' fewer'} zone mismatches
                        </span>
                      </div>
                    )}
                    {eligibilityData.deltas.readiness_drift.inactive_status !== undefined && 
                     eligibilityData.deltas.readiness_drift.inactive_status !== 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {eligibilityData.deltas.readiness_drift.inactive_status > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                        <span>
                          {Math.abs(eligibilityData.deltas.readiness_drift.inactive_status)} 
                          {eligibilityData.deltas.readiness_drift.inactive_status > 0 ? ' more' : ' fewer'} inactive statuses
                        </span>
                      </div>
                    )}
                    {eligibilityData.deltas.readiness_drift.age_exceeded !== undefined && 
                     eligibilityData.deltas.readiness_drift.age_exceeded !== 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {eligibilityData.deltas.readiness_drift.age_exceeded > 0 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                        <span>
                          {Math.abs(eligibilityData.deltas.readiness_drift.age_exceeded)} 
                          {eligibilityData.deltas.readiness_drift.age_exceeded > 0 ? ' more' : ' fewer'} age-exceeded signals
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No significant changes detected since snapshot.
              </p>
            )}
            
            {/* Operator Guidance */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic">
                {eligibilityData.eligibility.overall === 'unchanged' && (
                  "Conditions are consistent with the locked snapshot."
                )}
                {eligibilityData.eligibility.overall === 'improved' && (
                  "Readiness has improved since the snapshot."
                )}
                {eligibilityData.eligibility.overall === 'degraded' && (
                  "Some readiness signals have declined since the snapshot. You may want to review attachments or drift warnings."
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Handoff Card (Prompt 32) - Read-only contract of intent */}
      {(run.status === 'draft' || run.status === 'scheduled') && 
       snapshotData?.locked && (
        <Card data-testid="card-execution-handoff">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-muted-foreground" />
                Execution Handoff
              </CardTitle>
              {handoffData && (
                <Badge 
                  variant="outline" 
                  className="text-green-600 border-green-600 dark:text-green-400 dark:border-green-400"
                  data-testid="badge-handoff-recorded"
                >
                  recorded
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {handoffData ? (
              <>
                {/* Handoff already recorded - read-only state */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Recorded:</span>
                    <span className="font-medium" data-testid="text-handoff-created-at">
                      {format(new Date(handoffData.created_at), 'PPpp')}
                    </span>
                  </div>
                  {handoffData.payload?.execution_eligibility?.overall && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Eligibility at handoff:</span>
                      <Badge 
                        variant="outline"
                        className={
                          handoffData.payload.execution_eligibility.overall === 'degraded'
                            ? 'text-amber-600 dark:text-amber-400'
                            : handoffData.payload.execution_eligibility.overall === 'improved'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-muted-foreground'
                        }
                        data-testid="badge-handoff-eligibility"
                      >
                        {handoffData.payload.execution_eligibility.overall}
                      </Badge>
                    </div>
                  )}
                  {handoffData.note && (
                    <div>
                      <span className="text-muted-foreground">Note:</span>
                      <p className="mt-1" data-testid="text-handoff-note">{handoffData.note}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground italic pt-2 border-t">
                  Execution handoff recorded for reference. This is a read-only contract of intent.
                </p>
              </>
            ) : !handoffNotFound ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Create handoff form */}
                <p className="text-sm text-muted-foreground">
                  This records the current planning state for execution reference. 
                  No notifications or execution will occur.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note (optional, 280 chars max)</label>
                  <Textarea
                    placeholder="Add an optional note for this handoff..."
                    value={handoffNote}
                    onChange={(e) => setHandoffNote(e.target.value.slice(0, 280))}
                    maxLength={280}
                    className="resize-none"
                    data-testid="input-handoff-note"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {handoffNote.length}/280
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await createHandoffMutation.mutateAsync(handoffNote || undefined);
                      toast({
                        title: 'Handoff recorded',
                        description: 'Execution handoff has been recorded for reference.',
                      });
                      setHandoffNote('');
                    } catch (err: any) {
                      toast({
                        title: 'Failed to create handoff',
                        description: err.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                  disabled={createHandoffMutation.isPending}
                  data-testid="button-create-handoff"
                >
                  {createHandoffMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4 mr-2" />
                  )}
                  Create Execution Handoff
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Snapshot View Dialog (Prompt 30) */}
      <Dialog open={showSnapshotDialog} onOpenChange={setShowSnapshotDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-green-500" />
              Readiness Snapshot
            </DialogTitle>
          </DialogHeader>
          
          {snapshotData?.snapshot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Locked At:</span>
                  <p className="font-medium">
                    {format(new Date(snapshotData.snapshot.locked_at), 'PPpp')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Attached:</span>
                  <p className="font-medium">{snapshotData.snapshot.payload.summary.total_attached}</p>
                </div>
              </div>
              
              {snapshotData.snapshot.note && (
                <div>
                  <span className="text-sm text-muted-foreground">Note:</span>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{snapshotData.snapshot.note}</p>
                </div>
              )}
              
              <div>
                <span className="text-sm font-medium">Run State at Lock</span>
                <div className="mt-2 p-3 rounded bg-muted/50 border text-sm space-y-1">
                  <div><span className="text-muted-foreground">Name:</span> {snapshotData.snapshot.payload.run.name}</div>
                  <div><span className="text-muted-foreground">Status:</span> {snapshotData.snapshot.payload.run.status}</div>
                  {snapshotData.snapshot.payload.run.zone_id && (
                    <div><span className="text-muted-foreground">Zone ID:</span> {snapshotData.snapshot.payload.run.zone_id}</div>
                  )}
                  {snapshotData.snapshot.payload.run.starts_at && (
                    <div><span className="text-muted-foreground">Starts:</span> {format(new Date(snapshotData.snapshot.payload.run.starts_at), 'PPpp')}</div>
                  )}
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium">Attached Requests at Lock ({snapshotData.snapshot.payload.attached_requests.length})</span>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                  {snapshotData.snapshot.payload.attached_requests.map((req, idx) => (
                    <div 
                      key={req.maintenance_request_id} 
                      className="p-2 rounded bg-muted/30 border text-xs"
                      data-testid={`snapshot-request-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{req.maintenance_request_id.slice(0, 8)}...</span>
                        <Badge variant={req.coordination_opt_in_at_lock ? "default" : "secondary"} className="text-xs">
                          {req.coordination_opt_in_at_lock ? 'Opted In' : 'Opted Out'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{req.status_at_lock}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnapshotDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAttachModal} onOpenChange={setShowAttachModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attach Coordination-Opt-In Requests</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select requests to attach for planning. Only coordination-opted-in requests matching the run's portal/zone are shown.
            </p>
            
            <div className="flex items-center gap-4">
              {!eligibleData?.run?.zone_id && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-unzoned"
                    checked={includeUnzoned}
                    onCheckedChange={(checked) => setIncludeUnzoned(checked === true)}
                  />
                  <label htmlFor="include-unzoned" className="text-sm">
                    Include unzoned requests
                  </label>
                </div>
              )}
            </div>
            
            {eligibleData?.warnings?.includes('ZONE_NOT_ASSIGNED') && !includeUnzoned && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Run has no zone assigned. Enable "Include unzoned requests" to see eligible requests.
                </p>
              </div>
            )}
            
            {eligibleData && eligibleData.items.length > 0 ? (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {eligibleData.items.map((req) => (
                  <div 
                    key={req.id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`req-${req.id}`}
                      checked={selectedRequestIds.includes(req.id)}
                      onCheckedChange={() => toggleRequestSelection(req.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{req.request_number}</span>
                        <Badge variant="outline" className="text-xs">
                          {req.category}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {req.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No eligible requests found.
              </p>
            )}
          </div>
          
          {selectedRequestIds.length > 10 && (
            <div 
              className="rounded-lg border border-destructive/50 bg-destructive/10 p-3"
              data-testid="alert-attach-limit-exceeded"
            >
              <p className="text-sm text-destructive" data-testid="text-attach-limit-message">
                Cannot attach more than 10 requests at once. Please deselect {selectedRequestIds.length - 10} request(s).
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttachModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAttachRequests}
              disabled={selectedRequestIds.length === 0 || selectedRequestIds.length > 10 || attachMutation.isPending}
              data-testid="button-confirm-attach"
            >
              {attachMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Attaching...
                </>
              ) : (
                `Attach ${selectedRequestIds.length} request(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

/**
 * Coordination Readiness Dashboard
 * 
 * Admin/ops dashboard showing where coordination intent is accumulating.
 * Answers: "Which zones have the most coordination-ready work right now?"
 * 
 * All outputs are counts-only, privacy-safe.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { 
  useCoordinationReadiness, 
  useCoordinationReadinessBuckets,
  useSuggestCoordinationWindows,
  useCreateDraftRunFromWindow,
  type CoordinationReadinessZone,
  type SuggestedWindow,
} from '@/hooks/useCoordination';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getZoneBadgeLabel } from '@/components/ZoneBadge';
import { 
  Users, 
  MapPin, 
  AlertCircle, 
  TrendingUp,
  ChevronRight,
  Layers,
  Calendar,
  Sparkles,
  Info,
  Loader2,
  Plus,
  FileText,
} from 'lucide-react';

interface Portal {
  id: string;
  name: string;
  slug: string;
}

interface Zone {
  id: string;
  key: string;
  name: string;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle,
  variant = 'default',
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType;
  subtitle?: string;
  variant?: 'default' | 'warning' | 'success';
}) {
  const variantStyles = {
    default: 'text-foreground',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className={`text-2xl font-semibold ${variantStyles[variant]}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneReadinessRow({ 
  zone,
  isSelected,
  onClick,
}: { 
  zone: CoordinationReadinessZone;
  isSelected: boolean;
  onClick: () => void;
}) {
  const zoneLabel = zone.zone_id 
    ? getZoneBadgeLabel({
        id: zone.zone_id,
        key: zone.zone_key || '',
        name: zone.zone_name || '',
        badge_label_resident: zone.badge_label_resident,
        badge_label_contractor: zone.badge_label_contractor,
        badge_label_visitor: zone.badge_label_visitor,
      }, 'resident')
    : 'Unzoned';

  const ratioPercent = Math.round(zone.coord_ready_ratio * 100);

  return (
    <TableRow 
      className={`cursor-pointer hover-elevate ${isSelected ? 'bg-accent' : ''}`}
      onClick={onClick}
      data-testid={`row-zone-${zone.zone_id || 'unzoned'}`}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {zone.zone_id ? (
            <Badge variant="secondary" data-testid={`badge-zone-${zone.zone_key}`}>
              {zoneLabel}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-dashed" data-testid="badge-zone-unzoned">
              Unzoned
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="font-medium">{zone.coord_ready_count}</span>
        <span className="text-muted-foreground"> / {zone.active_count}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress value={ratioPercent} className="h-2 flex-1" />
          <Badge 
            variant={ratioPercent >= 50 ? 'default' : 'secondary'}
            className="tabular-nums"
          >
            {ratioPercent}%
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatRelativeTime(zone.last_activity_at)}
      </TableCell>
      <TableCell className="text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 70) {
    return <Badge variant="default" className="bg-emerald-600">High</Badge>;
  }
  if (confidence >= 40) {
    return <Badge variant="secondary">Medium</Badge>;
  }
  return <Badge variant="outline">Low</Badge>;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

interface SuggestWindowsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  zone: CoordinationReadinessZone | null;
  zoneName: string;
}

function SuggestWindowsModal({ 
  open, 
  onOpenChange, 
  portalId, 
  zone, 
  zoneName 
}: SuggestWindowsModalProps) {
  const [lookaheadDays, setLookaheadDays] = useState(21);
  const [windowSizeDays, setWindowSizeDays] = useState(3);
  const [desiredWindows, setDesiredWindows] = useState(3);
  const [confirmingWindowIndex, setConfirmingWindowIndex] = useState<number | null>(null);

  const { toast } = useToast();
  const [, navigate] = useLocation();
  const suggestMutation = useSuggestCoordinationWindows();
  const createDraftMutation = useCreateDraftRunFromWindow();

  const handleSuggest = () => {
    suggestMutation.mutate({
      portal_id: portalId,
      zone_id: zone?.zone_id ?? null,
      lookahead_days: lookaheadDays,
      window_size_days: windowSizeDays,
      desired_windows: desiredWindows,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      suggestMutation.reset();
      setConfirmingWindowIndex(null);
    }
    onOpenChange(newOpen);
  };

  const handleCreateDraft = (windowData: SuggestedWindow, index: number) => {
    createDraftMutation.mutate({
      portal_id: portalId,
      zone_id: zone?.zone_id ?? null,
      category: null,
      starts_at: windowData.start_date,
      ends_at: windowData.end_date,
      coordination_metrics: {
        coord_ready_count: windowData.coord_ready_count,
        total_active_count: windowData.active_count,
        readiness_ratio: windowData.readiness_ratio,
        confidence_score: windowData.confidence,
        window_source: 'suggested' as const,
        parameters: {
          lookahead_days: lookaheadDays,
          window_size_days: windowSizeDays,
          desired_windows: desiredWindows,
        },
      },
    }, {
      onSuccess: (data) => {
        toast({
          title: 'Draft Service Run Created',
          description: 'You can now configure and schedule this run.',
        });
        setConfirmingWindowIndex(null);
        handleOpenChange(false);
        navigate(data.redirect);
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Failed to create draft',
          description: error.message,
        });
        setConfirmingWindowIndex(null);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Suggested Schedule Windows
          </DialogTitle>
          <DialogDescription>
            Advisory schedule windows for {zoneName}. No service runs are created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lookahead</label>
              <Select
                value={lookaheadDays.toString()}
                onValueChange={(v) => setLookaheadDays(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[100px]" data-testid="select-lookahead">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="21">21 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Window Size</label>
              <Select
                value={windowSizeDays.toString()}
                onValueChange={(v) => setWindowSizeDays(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[100px]" data-testid="select-window-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 days</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="5">5 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Windows</label>
              <Select
                value={desiredWindows.toString()}
                onValueChange={(v) => setDesiredWindows(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[80px]" data-testid="select-desired-windows">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleSuggest}
                disabled={suggestMutation.isPending}
                data-testid="button-suggest-windows"
              >
                {suggestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Suggest
                  </>
                )}
              </Button>
            </div>
          </div>

          {suggestMutation.data && (
            <div className="space-y-4">
              {suggestMutation.data.windows.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No active work requests found for this selection.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-3">
                    {suggestMutation.data.windows.map((window, index) => (
                      <Card key={index}>
                        <CardContent className="py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {formatDateRange(window.start_date, window.end_date)}
                                </span>
                                {getConfidenceBadge(window.confidence)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {window.explanation}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className="font-semibold text-emerald-600">
                                  {window.coord_ready_count}
                                </p>
                                <p className="text-xs text-muted-foreground">Ready</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold">{window.active_count}</p>
                                <p className="text-xs text-muted-foreground">Active</p>
                              </div>
                              <div className="text-center">
                                <p className="font-semibold">
                                  {Math.round(window.readiness_ratio * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground">Ratio</p>
                              </div>
                            </div>
                          </div>
                          
                          {confirmingWindowIndex === index ? (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <p className="text-sm text-muted-foreground">
                                Create a draft Service Run for this window? You can configure and schedule it before it becomes active.
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleCreateDraft(window, index)}
                                  disabled={createDraftMutation.isPending}
                                  data-testid={`button-confirm-create-draft-${index}`}
                                >
                                  {createDraftMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                      Creating...
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="h-3 w-3 mr-1.5" />
                                      Create Draft
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmingWindowIndex(null)}
                                  disabled={createDraftMutation.isPending}
                                  data-testid={`button-cancel-create-draft-${index}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmingWindowIndex(index)}
                                data-testid={`button-create-draft-${index}`}
                              >
                                <Plus className="h-3 w-3 mr-1.5" />
                                Create Draft Service Run
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    {suggestMutation.data.notes.map((note, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {note}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {suggestMutation.error && (
            <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              Failed to generate suggestions. Please try again.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryBucketsPanel({
  portalId,
  zoneId,
  zoneName,
  windowDays,
  isUnzoned = false,
}: {
  portalId: string;
  zoneId: string | null;
  zoneName: string;
  windowDays: number;
  isUnzoned?: boolean;
}) {
  const { data, isLoading } = useCoordinationReadinessBuckets(
    portalId,
    isUnzoned ? 'none' : zoneId,
    windowDays,
    10
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Top Categories in {zoneName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.buckets?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Top Categories in {zoneName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active work requests in this zone within the selected window.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Top Categories in {zoneName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.buckets.map((bucket) => {
            const ratioPercent = Math.round(bucket.coord_ready_ratio * 100);
            return (
              <div key={bucket.category} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bucket.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {bucket.coord_ready_count} ready of {bucket.active_count} active
                  </p>
                </div>
                <Badge variant={ratioPercent >= 50 ? 'default' : 'secondary'}>
                  {ratioPercent}%
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoordinationReadinessPage() {
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<CoordinationReadinessZone | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);

  const { data: portalsData, isLoading: portalsLoading } = useQuery<{ portals: Portal[] }>({
    queryKey: ['/api/portals'],
  });
  const portals = portalsData?.portals || [];

  const { data: readinessData, isLoading: readinessLoading } = useCoordinationReadiness(
    selectedPortalId,
    null,
    windowDays
  );

  if (portalsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const selectedZoneLabel = selectedZone
    ? (selectedZone.zone_id
        ? getZoneBadgeLabel({
            id: selectedZone.zone_id,
            key: selectedZone.zone_key || '',
            name: selectedZone.zone_name || '',
            badge_label_resident: selectedZone.badge_label_resident,
          }, 'resident')
        : 'Unzoned')
    : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Coordination Readiness</h1>
          <p className="text-muted-foreground">
            Zones with the most coordination-ready work requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedPortalId || ''}
            onValueChange={(v) => {
              setSelectedPortalId(v || null);
              setSelectedZone(null);
            }}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-portal">
              <SelectValue placeholder="Select portal..." />
            </SelectTrigger>
            <SelectContent>
              {portals.map((portal) => (
                <SelectItem key={portal.id} value={portal.id}>
                  {portal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={windowDays.toString()}
            onValueChange={(v) => setWindowDays(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[120px]" data-testid="select-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>

          {selectedPortalId && selectedZone && (
            <Button 
              onClick={() => setSuggestModalOpen(true)}
              data-testid="button-open-suggest-windows"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Suggest Windows
            </Button>
          )}
        </div>
      </div>

      {selectedPortalId && (
        <SuggestWindowsModal
          open={suggestModalOpen}
          onOpenChange={setSuggestModalOpen}
          portalId={selectedPortalId}
          zone={selectedZone}
          zoneName={selectedZone 
            ? (selectedZone.zone_id 
              ? getZoneBadgeLabel({
                  id: selectedZone.zone_id,
                  key: selectedZone.zone_key || '',
                  name: selectedZone.zone_name || '',
                  badge_label_resident: selectedZone.badge_label_resident,
                }, 'resident')
              : 'Unzoned')
            : 'All Zones'}
        />
      )}

      {!selectedPortalId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Select a portal to view coordination readiness</p>
            <p className="text-muted-foreground">
              Choose a portal from the dropdown above to see zone-level coordination data.
            </p>
          </CardContent>
        </Card>
      ) : readinessLoading ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Total Active"
              value={readinessData?.rollups.total_active || 0}
              icon={Users}
              subtitle={`In last ${windowDays} days`}
            />
            <KpiCard
              title="Coordination Ready"
              value={readinessData?.rollups.total_coord_ready || 0}
              icon={TrendingUp}
              variant="success"
              subtitle="Opted in for coordination"
            />
            <KpiCard
              title="Ready Ratio"
              value={`${readinessData?.rollups.total_active 
                ? Math.round((readinessData.rollups.total_coord_ready / readinessData.rollups.total_active) * 100) 
                : 0}%`}
              icon={TrendingUp}
            />
            <KpiCard
              title="Unzoned Ready"
              value={readinessData?.rollups.unzoned_coord_ready || 0}
              icon={AlertCircle}
              variant={readinessData?.rollups.unzoned_coord_ready ? 'warning' : 'default'}
              subtitle="Operational debt"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Coordination Readiness by Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!readinessData?.zones?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    No active work requests in the selected window.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zone</TableHead>
                        <TableHead className="text-right">Ready / Active</TableHead>
                        <TableHead>Readiness</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {readinessData.zones.map((zone) => (
                        <ZoneReadinessRow
                          key={zone.zone_id || 'unzoned'}
                          zone={zone}
                          isSelected={selectedZone?.zone_id === zone.zone_id}
                          onClick={() => setSelectedZone(
                            selectedZone?.zone_id === zone.zone_id ? null : zone
                          )}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selectedZone ? (
                <CategoryBucketsPanel
                  portalId={selectedPortalId}
                  zoneId={selectedZone.zone_id}
                  zoneName={selectedZoneLabel || 'Selected Zone'}
                  windowDays={windowDays}
                  isUnzoned={!selectedZone.zone_id}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Click a zone row to see top coordination-ready categories.
                    </p>
                  </CardContent>
                </Card>
              )}

              {!selectedZone && selectedPortalId && (
                <CategoryBucketsPanel
                  portalId={selectedPortalId}
                  zoneId={null}
                  zoneName="All Zones"
                  windowDays={windowDays}
                  isUnzoned={false}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

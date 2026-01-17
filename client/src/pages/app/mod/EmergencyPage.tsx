import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { 
  AlertTriangle, Clock, User, Briefcase, Plus,
  Search, Loader2, X, Check, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface EmergencyRequest {
  id: string;
  portalId: string;
  tenantId: string;
  tenantName: string | null;
  jobId: string | null;
  jobTitle: string | null;
  urgency: 'now' | 'today' | 'this_week';
  roleNeeded: string;
  headcountNeeded: number;
  startDate: string | null;
  notes: string | null;
  status: 'open' | 'searching' | 'filled' | 'cancelled';
  filledByBenchId: string | null;
  createdAt: string;
  updatedAt: string;
  hoursSinceCreated: number;
}

interface EmergencyResponse {
  ok: boolean;
  requests: EmergencyRequest[];
  total: number;
  limit: number;
  offset: number;
}

interface BenchCandidate {
  id: string;
  individualName: string;
  individualEmail: string;
  readinessState: string;
  housingNeeded: boolean;
  daysSinceActivity: number;
}

interface CandidatesResponse {
  ok: boolean;
  candidates: BenchCandidate[];
}

const URGENCY_OPTIONS = [
  { value: 'now', label: 'Now', color: 'bg-red-500' },
  { value: 'today', label: 'Today', color: 'bg-orange-500' },
  { value: 'this_week', label: 'This Week', color: 'bg-yellow-500' }
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-blue-500' },
  { value: 'searching', label: 'Searching', color: 'bg-yellow-500' },
  { value: 'filled', label: 'Filled', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500' }
];

function UrgencyBadge({ urgency }: { urgency: string }) {
  const opt = URGENCY_OPTIONS.find(o => o.value === urgency);
  return (
    <Badge variant={urgency === 'now' ? 'destructive' : 'default'} className="text-xs">
      <AlertTriangle className="h-3 w-3 mr-1" />
      {opt?.label || urgency}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  return (
    <Badge variant="outline" className="text-xs">
      <div className={`w-2 h-2 rounded-full mr-1 ${opt?.color || 'bg-gray-400'}`} />
      {opt?.label || status}
    </Badge>
  );
}

function EmergencyRow({
  request,
  onStatusChange,
  onFindCandidates,
  isUpdating
}: {
  request: EmergencyRequest;
  onStatusChange: (id: string, status: string) => void;
  onFindCandidates: (request: EmergencyRequest) => void;
  isUpdating: boolean;
}) {
  return (
    <Card data-testid={`emergency-request-${request.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium" data-testid="text-role-needed">{request.roleNeeded}</span>
              <UrgencyBadge urgency={request.urgency} />
              <StatusBadge status={request.status} />
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {request.headcountNeeded} needed
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {request.tenantName && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {request.tenantName}
                </span>
              )}
              {request.jobTitle && (
                <span>{request.jobTitle}</span>
              )}
              {request.startDate && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Start: {new Date(request.startDate).toLocaleDateString()}
                </span>
              )}
            </div>
            {request.notes && (
              <p className="text-sm mt-2 text-muted-foreground">{request.notes}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {request.status !== 'filled' && request.status !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFindCandidates(request)}
                data-testid="button-find-candidates"
              >
                <Users className="h-4 w-4 mr-1" />
                Find
              </Button>
            )}
            
            <Select
              value={request.status}
              onValueChange={(value) => onStatusChange(request.id, value)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-28" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateRequestDialog({
  open,
  onClose,
  portalId
}: {
  open: boolean;
  onClose: () => void;
  portalId: string;
}) {
  const { toast } = useToast();
  const [roleNeeded, setRoleNeeded] = useState('');
  const [urgency, setUrgency] = useState<string>('today');
  const [headcount, setHeadcount] = useState('1');
  const [notes, setNotes] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/p2/app/mod/portals/${portalId}/emergency-replacements`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/p2/app/mod/portals', portalId, 'emergency-replacements']
      });
      toast({ title: 'Emergency request created' });
      onClose();
      setRoleNeeded('');
      setUrgency('today');
      setHeadcount('1');
      setNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create request',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = () => {
    if (!roleNeeded.trim()) {
      toast({ title: 'Role needed is required', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      role_needed: roleNeeded,
      urgency,
      headcount_needed: parseInt(headcount) || 1,
      notes: notes || null
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Emergency Request</DialogTitle>
          <DialogDescription>
            Request an immediate replacement worker
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="roleNeeded">Role Needed</Label>
            <Input
              id="roleNeeded"
              placeholder="e.g., Line Cook, Server, Driver"
              value={roleNeeded}
              onChange={(e) => setRoleNeeded(e.target.value)}
              data-testid="input-role-needed"
            />
          </div>

          <div>
            <Label htmlFor="urgency">Urgency</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger data-testid="select-urgency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="headcount">Headcount Needed</Label>
            <Input
              id="headcount"
              type="number"
              min="1"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              data-testid="input-headcount"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createMutation.isPending}
            data-testid="button-create-request"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Create Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidatesSheet({
  request,
  portalId,
  open,
  onClose
}: {
  request: EmergencyRequest | null;
  portalId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<CandidatesResponse>({
    queryKey: ['/api/p2/app/mod/emergency-replacements', request?.id, 'candidates'],
    enabled: !!request?.id && open
  });

  const routeMutation = useMutation({
    mutationFn: async ({ requestId, benchId }: { requestId: string; benchId: string }) => {
      return apiRequest('POST', `/api/p2/app/mod/emergency-replacements/${requestId}/route`, {
        bench_id: benchId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/p2/app/mod/portals', portalId, 'emergency-replacements']
      });
      toast({ title: 'Candidate assigned to request' });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to route candidate',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle data-testid="text-candidates-title">
            Available Candidates
          </SheetTitle>
          <SheetDescription>
            {request?.roleNeeded} - {request?.headcountNeeded} needed
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : data?.candidates?.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No available candidates</p>
              <p className="text-sm text-muted-foreground mt-2">
                Consider posting to job boards or contacting agencies
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.candidates?.map(candidate => (
                <Card key={candidate.id} data-testid={`candidate-${candidate.id}`}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{candidate.individualName}</p>
                        <p className="text-sm text-muted-foreground">{candidate.individualEmail}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {candidate.readinessState}
                          </Badge>
                          {candidate.housingNeeded && (
                            <Badge variant="secondary" className="text-xs">Housing</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Active {candidate.daysSinceActivity}d ago
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => request && routeMutation.mutate({
                          requestId: request.id,
                          benchId: candidate.id
                        })}
                        disabled={routeMutation.isPending}
                        data-testid="button-assign-candidate"
                      >
                        {routeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function EmergencyPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EmergencyRequest | null>(null);

  const { data, isLoading, error } = useQuery<EmergencyResponse>({
    queryKey: ['/api/p2/app/mod/portals', portalId, 'emergency-replacements', { status: statusFilter, urgency: urgencyFilter }],
    enabled: !!portalId
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest('PATCH', `/api/p2/app/mod/emergency-replacements/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/p2/app/mod/portals', portalId, 'emergency-replacements']
      });
      toast({ title: 'Request updated' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate({ id, updates: { status } });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load emergency requests</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Emergency Replacements</h1>
          <Badge variant="secondary" className="ml-2" data-testid="badge-total-count">
            {data?.total || 0}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-32" data-testid="select-filter-urgency">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {URGENCY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-new">
            <Plus className="h-4 w-4 mr-1" />
            New Request
          </Button>
        </div>
      </div>

      {data?.requests?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No emergency requests</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create a request when you need an immediate replacement worker
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.requests?.map(request => (
            <EmergencyRow
              key={request.id}
              request={request}
              onStatusChange={handleStatusChange}
              onFindCandidates={(req) => setSelectedRequest(req)}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      <CreateRequestDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        portalId={portalId || ''}
      />

      <CandidatesSheet
        request={selectedRequest}
        portalId={portalId || ''}
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
}

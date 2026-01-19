import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Search, Calendar, DollarSign, FileText, ExternalLink, Clock, User, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type IncidentStatus = 'open' | 'processing' | 'approved' | 'denied';
type IncidentType = 'cancellation' | 'damage' | 'dispute' | 'refund';

interface Incident {
  id: string;
  incident_type: IncidentType;
  status: IncidentStatus;
  notes: string | null;
  occurred_at: string;
  created_at: string;
}

const statusColors: Record<IncidentStatus, string> = {
  open: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  processing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-500 border-green-500/30',
  denied: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const typeIcons: Record<IncidentType, typeof AlertTriangle> = {
  cancellation: Calendar,
  damage: AlertTriangle,
  dispute: FileText,
  refund: DollarSign,
};

const typeLabels: Record<IncidentType, string> = {
  cancellation: 'Cancellation',
  damage: 'Damage',
  dispute: 'Dispute',
  refund: 'Refund',
};

interface IncidentDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  isUpdating: boolean;
}

function IncidentDetailDialog({ incident, open, onOpenChange, onUpdateStatus, isUpdating }: IncidentDialogProps) {
  if (!incident) return null;
  
  const Icon = typeIcons[incident.incident_type];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {typeLabels[incident.incident_type]} Incident
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge className={statusColors[incident.status]}>{incident.status}</Badge>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <div className="text-sm font-medium mt-1">{typeLabels[incident.incident_type]}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Occurred</label>
              <div className="text-sm mt-1">{new Date(incident.occurred_at).toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Created</label>
              <div className="text-sm mt-1">{new Date(incident.created_at).toLocaleString()}</div>
            </div>
          </div>
          
          {incident.notes && (
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <p className="text-sm mt-1 p-3 bg-muted/30 rounded">{incident.notes}</p>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Close
            </Button>
            {incident.status === 'open' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => onUpdateStatus(incident.id, 'processing')}
                  disabled={isUpdating}
                  data-testid="button-start-processing"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Start Processing
                </Button>
                <Button 
                  onClick={() => onUpdateStatus(incident.id, 'approved')}
                  disabled={isUpdating}
                  data-testid="button-approve"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Approve
                </Button>
              </>
            )}
            {incident.status === 'processing' && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => onUpdateStatus(incident.id, 'denied')}
                  disabled={isUpdating}
                  data-testid="button-deny"
                >
                  Deny
                </Button>
                <Button 
                  onClick={() => onUpdateStatus(incident.id, 'approved')}
                  disabled={isUpdating}
                  data-testid="button-approve-processing"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function IncidentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<IncidentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: incidentsData, isLoading } = useQuery<{ ok: boolean; incidents: Incident[] }>({
    queryKey: ['/api/p2/app/ops/incidents', { 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
    }],
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IncidentStatus }) => {
      const res = await apiRequest('PATCH', `/api/p2/app/ops/incidents/${id}`, { status });
      if (!res.ok) throw new Error('Failed to update incident');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/ops/incidents'] });
      toast({ title: `Incident ${variables.status}` });
      setDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error updating incident', variant: 'destructive' });
    },
  });
  
  const handleUpdateStatus = (id: string, status: IncidentStatus) => {
    updateStatusMutation.mutate({ id, status });
  };
  
  const incidents = incidentsData?.incidents || [];
  const filteredIncidents = incidents.filter(incident => {
    if (searchQuery && !incident.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  const openCount = incidents.filter(i => i.status === 'open').length;
  const processingCount = incidents.filter(i => i.status === 'processing').length;
  const totalIncidents = incidents.length;
  
  const handleViewIncident = (incident: Incident) => {
    setSelectedIncident(incident);
    setDialogOpen(true);
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Incident Console</h1>
            <p className="text-sm text-muted-foreground">Manage refunds, disputes, and cancellations</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search folio ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48"
                data-testid="input-search-incidents"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IncidentStatus | 'all')}>
              <SelectTrigger className="w-32" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as IncidentType | 'all')}>
              <SelectTrigger className="w-36" data-testid="select-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cancellation">Cancellation</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="dispute">Dispute</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 p-4 border-b">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{openCount}</div>
              <div className="text-xs text-muted-foreground">Open Incidents</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{processingCount}</div>
              <div className="text-xs text-muted-foreground">Processing</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <FileText className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalIncidents}</div>
              <div className="text-xs text-muted-foreground">Total Incidents</div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">ID</th>
                    <th className="text-left p-3 text-sm font-medium">Type</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Occurred</th>
                    <th className="text-left p-3 text-sm font-medium">Created</th>
                    <th className="text-left p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map(incident => {
                    const Icon = typeIcons[incident.incident_type];
                    return (
                      <tr key={incident.id} className="border-b hover:bg-muted/30" data-testid={`row-incident-${incident.id}`}>
                        <td className="p-3">
                          <div className="font-mono text-sm">{incident.id.slice(0, 8)}...</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Icon className="w-3 h-3" />
                            {typeLabels[incident.incident_type]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={statusColors[incident.status]}>{incident.status}</Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(incident.occurred_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(incident.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs"
                            onClick={() => handleViewIncident(incident)}
                            data-testid={`button-view-${incident.id}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredIncidents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No incidents found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
      
      <IncidentDetailDialog 
        incident={selectedIncident} 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onUpdateStatus={handleUpdateStatus}
        isUpdating={updateStatusMutation.isPending}
      />
    </div>
  );
}
